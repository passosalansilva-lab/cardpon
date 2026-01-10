import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MP-SUBSCRIPTION-WEBHOOK] ${step}${detailsStr}`);
};

// Verify webhook signature from Mercado Pago
const verifySignature = async (
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string,
  secret: string
): Promise<boolean> => {
  if (!xSignature || !xRequestId) {
    logStep("Missing signature headers");
    return false;
  }

  try {
    // Parse x-signature header (format: ts=xxx,v1=xxx)
    const parts: Record<string, string> = {};
    xSignature.split(",").forEach((part) => {
      const [key, value] = part.split("=");
      if (key && value) {
        parts[key.trim()] = value.trim();
      }
    });

    const ts = parts["ts"];
    const v1 = parts["v1"];

    if (!ts || !v1) {
      logStep("Invalid signature format", { xSignature });
      return false;
    }

    // Build the manifest string
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    
    // Create HMAC signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(manifest)
    );
    
    // Convert to hex
    const hashArray = Array.from(new Uint8Array(signature));
    const calculatedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const isValid = calculatedSignature === v1;
    logStep("Signature verification", { isValid, manifest: manifest.substring(0, 50) + "..." });
    
    return isValid;
  } catch (error) {
    logStep("Signature verification error", { error: String(error) });
    return false;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const mpAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!mpAccessToken) {
      throw new Error("MERCADO_PAGO_ACCESS_TOKEN is not set");
    }

    const webhookSecret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get webhook data
    const body = await req.json();
    logStep("Webhook body", body);

    // Verify signature if secret is configured
    if (webhookSecret) {
      const xSignature = req.headers.get("x-signature");
      const xRequestId = req.headers.get("x-request-id");
      const dataId = body.data?.id?.toString() || "";
      
      const isValid = await verifySignature(xSignature, xRequestId, dataId, webhookSecret);
      
      if (!isValid) {
        logStep("Invalid webhook signature - rejecting request");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        });
      }
      logStep("Webhook signature verified successfully");
    } else {
      logStep("No webhook secret configured - skipping signature verification");
    }

    // Handle different notification types
    if (body.type === "payment" || body.action === "payment.created" || body.action === "payment.updated") {
      const paymentId = body.data?.id;
      
      if (!paymentId) {
        logStep("No payment ID in webhook");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Get payment details from Mercado Pago
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
        },
      });

      if (!paymentResponse.ok) {
        const errorText = await paymentResponse.text();
        logStep("Error fetching payment", { status: paymentResponse.status, error: errorText });
        throw new Error(`Failed to fetch payment: ${paymentResponse.status}`);
      }

      const payment = await paymentResponse.json();
      logStep("Payment details", { 
        status: payment.status, 
        externalReference: payment.external_reference,
        amount: payment.transaction_amount 
      });

      // Parse external reference
      let referenceData;
      try {
        referenceData = JSON.parse(payment.external_reference);
      } catch (e) {
        logStep("Invalid external reference", { ref: payment.external_reference });
        return new Response(JSON.stringify({ received: true, error: "Invalid reference" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Check if this is a subscription payment (both recurring and PIX one-time)
      if (referenceData.type !== "subscription" && referenceData.type !== "pix_subscription" && referenceData.type !== "preapproval") {
        logStep("Not a subscription payment, skipping", { type: referenceData.type });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const isPixPayment = referenceData.type === "pix_subscription";

      const { companyId, planKey, userId } = referenceData;

      // Handle REFUNDED payments - cancel subscription
      if (payment.status === "refunded" || payment.status === "cancelled" || payment.status === "charged_back") {
        logStep("Payment refunded/cancelled - cancelling subscription", { 
          status: payment.status, 
          companyId, 
          planKey 
        });

        // Reset company subscription to free
        const { error: updateError } = await supabaseClient
          .from("companies")
          .update({
            subscription_plan: null,
            subscription_status: "free",
            subscription_end_date: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", companyId);

        if (updateError) {
          logStep("Error updating company for refund", { error: updateError.message });
          throw updateError;
        }

        logStep("Subscription cancelled due to refund", { companyId });

        // Create notification for the user
        if (userId) {
          await supabaseClient
            .from("notifications")
            .insert({
              user_id: userId,
              title: "Assinatura cancelada",
              message: "Sua assinatura foi cancelada devido a um estorno. Você voltou para o plano gratuito.",
              type: "warning",
              data: {
                type: "subscription_cancelled",
                reason: payment.status,
                companyId,
              },
            });
          logStep("Refund notification created for user");
        }

        return new Response(JSON.stringify({ 
          received: true, 
          processed: true,
          action: "subscription_cancelled",
          reason: payment.status,
          companyId 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Handle APPROVED payments - activate subscription
      if (payment.status === "approved") {
        logStep("Processing approved subscription", { companyId, planKey, userId });

        // Get plan details
        const { data: plan, error: planError } = await supabaseClient
          .from("subscription_plans")
          .select("*")
          .eq("key", planKey)
          .single();

        if (planError || !plan) {
          logStep("Plan not found", { planKey, error: planError?.message });
          throw new Error(`Plan not found: ${planKey}`);
        }

        // Calculate subscription end date (30 days from now)
        const subscriptionEnd = new Date();
        subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);

        // Update company subscription
        const { error: updateError } = await supabaseClient
          .from("companies")
          .update({
            subscription_plan: planKey,
            subscription_status: "active",
            subscription_end_date: subscriptionEnd.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", companyId);

        if (updateError) {
          logStep("Error updating company", { error: updateError.message });
          throw updateError;
        }

        logStep("Subscription activated successfully", { 
          companyId, 
          planKey, 
          subscriptionEnd: subscriptionEnd.toISOString() 
        });

        // Create notification for the user
        if (userId) {
          const notificationMessage = isPixPayment 
            ? `Seu plano ${plan.name} foi ativado com sucesso via PIX. Lembre-se: o pagamento precisa ser renovado manualmente a cada mês.`
            : `Seu plano ${plan.name} foi ativado com sucesso. Aproveite todos os benefícios!`;
          
          await supabaseClient
            .from("notifications")
            .insert({
              user_id: userId,
              title: "Assinatura ativada! 🎉",
              message: notificationMessage,
              type: "success",
              data: {
                type: "subscription_activated",
                planKey,
                companyId,
                paymentMethod: isPixPayment ? "pix" : "recurring",
              },
            });
          logStep("Notification created for user");
        }

        return new Response(JSON.stringify({ 
          received: true, 
          processed: true,
          action: "subscription_activated",
          planKey,
          companyId 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // For other payment statuses (pending, in_process, etc.), just acknowledge
      logStep("Payment not in final state, skipping", { status: payment.status });
      return new Response(JSON.stringify({ received: true, status: payment.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // For other notification types, just acknowledge
    logStep("Non-payment notification, acknowledging");
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    // Always return 200 for webhooks to prevent retries
    return new Response(JSON.stringify({ received: true, error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
