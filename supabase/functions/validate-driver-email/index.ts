import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Use .select() without .single() to allow multiple rows
    // Then pick the first active one (or first one if none active)
    const { data: drivers, error } = await supabaseAdmin
      .from("delivery_drivers")
      .select("id, driver_name, is_active, company_id")
      .eq("email", email.toLowerCase().trim())
      .order("is_active", { ascending: false })
      .limit(10);

    if (error) throw error;

    // Get the first active driver, or the first driver if none are active
    const driver = drivers && drivers.length > 0 ? drivers[0] : null;

    return new Response(
      JSON.stringify({
        valid: !!driver,
        isActive: driver?.is_active ?? false,
        driverName: driver?.driver_name ?? null,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error validating driver email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
