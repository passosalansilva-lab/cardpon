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

    // Verify user is authenticated and is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }

    // Check if user is super_admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "super_admin")
      .single();

    if (roleError || !roleData) {
      throw new Error("Access denied: Super admin role required");
    }

    const { functionName, limit = 50 } = await req.json();

    // Query edge function logs from analytics
    const { data: logs, error: logsError } = await supabaseClient
      .from("postgres_logs" as any)
      .select("*")
      .limit(limit);

    // Since we can't directly query analytics, we'll return mock structure
    // In production, this would query the analytics database
    
    // For now, return a helpful message
    const response = {
      message: "Logs system initialized",
      functions: [
        "create-subscription",
        "check-subscription", 
        "customer-portal",
        "create-checkout",
        "verify-payment"
      ],
      note: "Use Supabase Dashboard > Logs > Edge Functions for detailed logs",
      user: userData.user.email
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
