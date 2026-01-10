import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[FEATURE-PURCHASE-WEBHOOK] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const body = await req.json();
    logStep("Webhook body", body);

    const { type, data, action } = body;
    const mercadoPagoToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!mercadoPagoToken) {
      throw new Error("Mercado Pago token not configured");
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ========================================
    // TIPO 1: Pagamento único (payment)
    // ========================================
    if (type === "payment") {
      const paymentId = data?.id;
      if (!paymentId) {
        logStep("No payment ID in webhook");
        return new Response(JSON.stringify({ error: "No payment ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        { headers: { Authorization: `Bearer ${mercadoPagoToken}` } }
      );

      const paymentData = await paymentResponse.json();
      logStep("Payment data", paymentData);

      if (paymentData.status !== "approved") {
        logStep("Payment not approved", { status: paymentData.status });
        return new Response(JSON.stringify({ received: true, status: paymentData.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Parse external_reference
      let referenceData;
      try {
        referenceData = JSON.parse(paymentData.external_reference);
      } catch {
        logStep("Failed to parse external_reference", { ref: paymentData.external_reference });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (referenceData.type !== "feature_purchase") {
        logStep("Not a feature purchase", { type: referenceData.type });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await processFeaturePurchase(adminClient, referenceData, paymentData.transaction_amount, paymentId.toString());

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================================
    // TIPO 2: Assinatura (subscription_preapproval)
    // ========================================
    if (type === "subscription_preapproval") {
      const preapprovalId = data?.id;
      if (!preapprovalId) {
        logStep("No preapproval ID in webhook");
        return new Response(JSON.stringify({ error: "No preapproval ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Buscar detalhes do preapproval
      const preapprovalResponse = await fetch(
        `https://api.mercadopago.com/preapproval/${preapprovalId}`,
        { headers: { Authorization: `Bearer ${mercadoPagoToken}` } }
      );

      const preapprovalData = await preapprovalResponse.json();
      logStep("Preapproval data", preapprovalData);

      // Parse external_reference
      let referenceData;
      try {
        referenceData = JSON.parse(preapprovalData.external_reference);
      } catch {
        logStep("Failed to parse external_reference", { ref: preapprovalData.external_reference });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (referenceData.type !== "feature_purchase") {
        logStep("Not a feature purchase preapproval");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { featureId, companyId, userId } = referenceData;
      const status = preapprovalData.status;

      logStep("Processing preapproval", { status, featureId, companyId });

      // Buscar feature existente
      const { data: existingFeature } = await adminClient
        .from("company_features")
        .select("id, is_active")
        .eq("company_id", companyId)
        .eq("feature_id", featureId)
        .maybeSingle();

      if (status === "authorized" || status === "pending") {
        // Assinatura ativa - renovar acesso por mais 1 mês
        const expireDate = new Date();
        expireDate.setMonth(expireDate.getMonth() + 1);
        const expiresAt = expireDate.toISOString();

        if (existingFeature) {
          await adminClient
            .from("company_features")
            .update({
              is_active: true,
              expires_at: expiresAt,
              payment_reference: preapprovalId,
            })
            .eq("id", existingFeature.id);

          logStep("Feature subscription renewed", { id: existingFeature.id });
        } else {
          // Primeira ativação da assinatura
          await adminClient
            .from("company_features")
            .insert({
              company_id: companyId,
              feature_id: featureId,
              price_type: "monthly",
              price_paid: preapprovalData.auto_recurring?.transaction_amount || 0,
              expires_at: expiresAt,
              is_active: true,
              purchased_at: new Date().toISOString(),
              payment_reference: preapprovalId,
            });

          // Notificar usuário
          const { data: feature } = await adminClient
            .from("system_features")
            .select("name")
            .eq("id", featureId)
            .single();

          await adminClient.from("notifications").insert({
            user_id: userId,
            title: "Assinatura ativada! 🎉",
            message: `A funcionalidade "${feature?.name || "Premium"}" foi ativada com sucesso.`,
            type: "success",
            data: { type: "feature_subscribed", feature_id: featureId },
          });

          logStep("Feature subscription created");
        }
      } else if (status === "cancelled" || status === "paused") {
        // Assinatura cancelada ou pausada - desativar acesso
        if (existingFeature) {
          await adminClient
            .from("company_features")
            .update({
              is_active: false,
              expires_at: new Date().toISOString(), // Expira agora
            })
            .eq("id", existingFeature.id);

          // Notificar usuário
          const { data: feature } = await adminClient
            .from("system_features")
            .select("name")
            .eq("id", featureId)
            .single();

          await adminClient.from("notifications").insert({
            user_id: userId,
            title: "Assinatura cancelada",
            message: `A funcionalidade "${feature?.name || "Premium"}" foi desativada pois a assinatura foi cancelada.`,
            type: "warning",
            data: { type: "feature_subscription_cancelled", feature_id: featureId },
          });

          logStep("Feature subscription cancelled", { id: existingFeature.id });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================================
    // TIPO 3: Pagamento de assinatura (subscription_authorized_payment)
    // ========================================
    if (type === "subscription_authorized_payment") {
      const paymentId = data?.id;
      if (!paymentId) {
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Buscar detalhes do pagamento autorizado
      const paymentResponse = await fetch(
        `https://api.mercadopago.com/authorized_payments/${paymentId}`,
        { headers: { Authorization: `Bearer ${mercadoPagoToken}` } }
      );

      const paymentData = await paymentResponse.json();
      logStep("Subscription payment data", paymentData);

      if (paymentData.status === "approved") {
        // Pagamento mensal aprovado - renovar por mais 1 mês
        const preapprovalId = paymentData.preapproval_id;
        
        // Buscar o preapproval para pegar o external_reference
        const preapprovalResponse = await fetch(
          `https://api.mercadopago.com/preapproval/${preapprovalId}`,
          { headers: { Authorization: `Bearer ${mercadoPagoToken}` } }
        );

        const preapprovalData = await preapprovalResponse.json();
        
        let referenceData;
        try {
          referenceData = JSON.parse(preapprovalData.external_reference);
        } catch {
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (referenceData.type === "feature_purchase") {
          const { featureId, companyId } = referenceData;
          
          const expireDate = new Date();
          expireDate.setMonth(expireDate.getMonth() + 1);

          await adminClient
            .from("company_features")
            .update({
              is_active: true,
              expires_at: expireDate.toISOString(),
            })
            .eq("company_id", companyId)
            .eq("feature_id", featureId);

          logStep("Feature subscription payment renewed", { featureId, companyId });
        }
      } else if (paymentData.status === "rejected") {
        // Pagamento rejeitado - marcar para expirar (não desativa imediatamente, espera expirar)
        logStep("Subscription payment rejected, will expire naturally");
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Ignoring unhandled notification type", { type });
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    logStep("Error processing webhook", { message: error.message, stack: error.stack });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Função auxiliar para processar compra de feature (pagamento único)
async function processFeaturePurchase(
  adminClient: any,
  referenceData: any,
  amount: number,
  paymentReference: string
) {
  const { featureId, priceType, companyId, userId } = referenceData;

  // Calcular data de expiração para assinatura mensal
  let expiresAt: string | null = null;
  if (priceType === "monthly") {
    const expireDate = new Date();
    expireDate.setMonth(expireDate.getMonth() + 1);
    expiresAt = expireDate.toISOString();
  }
  // Para compra única (one_time), expires_at permanece NULL = acesso permanente

  // Verificar se já existe uma compra para esta feature
  const { data: existingPurchase } = await adminClient
    .from("company_features")
    .select("id")
    .eq("company_id", companyId)
    .eq("feature_id", featureId)
    .maybeSingle();

  if (existingPurchase) {
    await adminClient
      .from("company_features")
      .update({
        is_active: true,
        price_type: priceType,
        price_paid: amount,
        expires_at: expiresAt,
        purchased_at: new Date().toISOString(),
        payment_reference: paymentReference,
      })
      .eq("id", existingPurchase.id);

    logStep("Feature purchase renewed", { id: existingPurchase.id });
  } else {
    await adminClient
      .from("company_features")
      .insert({
        company_id: companyId,
        feature_id: featureId,
        price_type: priceType,
        price_paid: amount,
        expires_at: expiresAt,
        is_active: true,
        purchased_at: new Date().toISOString(),
        payment_reference: paymentReference,
      });

    logStep("Feature purchase created");
  }

  // Criar notificação para o usuário
  const { data: feature } = await adminClient
    .from("system_features")
    .select("name")
    .eq("id", featureId)
    .single();

  const isOneTime = priceType === "one_time";
  await adminClient.from("notifications").insert({
    user_id: userId,
    title: isOneTime ? "Funcionalidade liberada para sempre! 🎉" : "Funcionalidade liberada! 🎉",
    message: isOneTime 
      ? `A funcionalidade "${feature?.name || "Premium"}" foi ativada permanentemente.`
      : `A funcionalidade "${feature?.name || "Premium"}" foi ativada por mais um mês.`,
    type: "success",
    data: { type: "feature_purchased", feature_id: featureId, price_type: priceType },
  });

  logStep("Notification sent to user");
}
