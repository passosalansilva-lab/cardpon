import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }

    const { accessToken, publicKey } = await req.json();

    if (!accessToken || typeof accessToken !== 'string' || accessToken.trim().length < 10) {
      return new Response(
        JSON.stringify({ valid: false, error: "Access Token inválido ou vazio" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!publicKey || typeof publicKey !== 'string' || publicKey.trim().length < 10) {
      return new Response(
        JSON.stringify({ valid: false, error: "Public Key inválida ou vazia" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Validate public key format
    const trimmedPublicKey = publicKey.trim();
    if (!trimmedPublicKey.startsWith('APP_USR-') && !trimmedPublicKey.startsWith('TEST-')) {
      return new Response(
        JSON.stringify({ valid: false, error: "Public Key deve começar com APP_USR- ou TEST-" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("[validate-mercadopago-token] Validating token for user:", userData.user.id);

    // Validate the token by calling Mercado Pago API
    const mpResponse = await fetch("https://api.mercadopago.com/users/me", {
      headers: {
        "Authorization": `Bearer ${accessToken.trim()}`,
      },
    });

    if (!mpResponse.ok) {
      console.log("[validate-mercadopago-token] MP token validation failed:", mpResponse.status);
      return new Response(
        JSON.stringify({ valid: false, error: "Access Token inválido. Verifique se copiou corretamente." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const mpUser = await mpResponse.json();
    console.log("[validate-mercadopago-token] Mercado Pago user validated:", mpUser.email);

    // Get user's company
    const { data: company, error: companyError } = await supabaseClient
      .from("companies")
      .select("id")
      .eq("owner_id", userData.user.id)
      .single();

    if (companyError || !company) {
      throw new Error("Empresa não encontrada");
    }

    // Save/update the payment settings with public key
    const { error: upsertError } = await supabaseClient
      .from("company_payment_settings")
      .upsert({
        company_id: company.id,
        mercadopago_access_token: accessToken.trim(),
        mercadopago_public_key: trimmedPublicKey,
        mercadopago_enabled: true,
        mercadopago_verified: true,
        mercadopago_verified_at: new Date().toISOString(),
        mercadopago_account_email: mpUser.email,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "company_id",
      });

    if (upsertError) {
      console.error("[validate-mercadopago-token] Error saving payment settings:", upsertError);
      throw new Error("Erro ao salvar configurações");
    }

    console.log("[validate-mercadopago-token] Payment settings saved for company:", company.id);

    return new Response(
      JSON.stringify({ 
        valid: true, 
        email: mpUser.email,
        message: "Credenciais validadas com sucesso!" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[validate-mercadopago-token] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ valid: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
