import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email é obrigatório" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Validate driver exists + active (server-side, bypassing RLS)
    // Handle multiple drivers with same email (different companies)
    const { data: drivers, error: driverError } = await supabaseAdmin
      .from("delivery_drivers")
      .select("driver_name, is_active, company_id")
      .eq("email", normalizedEmail)
      .order("is_active", { ascending: false })
      .limit(10);

    if (driverError) throw driverError;

    // Get first active driver or null if none
    const driver = drivers?.find(d => d.is_active) || (drivers?.length ? drivers[0] : null);

    if (!driver) {
      return new Response(JSON.stringify({ error: "Email não cadastrado como entregador" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!driver.is_active) {
      return new Response(JSON.stringify({ error: "Conta de entregador desativada" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Generate OTP using signInWithOtp - this sends the default Supabase email with OTP code
    const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
        data: {
          full_name: driver.driver_name,
          role: 'delivery_driver'
        }
      }
    });

    if (otpError) {
      console.error("OTP error:", otpError);
      throw otpError;
    }

    console.log("OTP sent successfully to:", normalizedEmail);

    return new Response(
      JSON.stringify({ success: true, message: "Código enviado para seu email" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("send-driver-otp error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Erro interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
