import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GetCreditsRequest {
  companyId: string;
  customerId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyId, customerId } = await req.json() as GetCreditsRequest;

    console.log('[GET-CUSTOMER-CREDITS] Request:', { companyId, customerId });

    if (!companyId || !customerId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields', credits: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if referral program is enabled
    const { data: settings } = await supabase
      .from('customer_referral_settings')
      .select('is_enabled')
      .eq('company_id', companyId)
      .single();

    if (!settings?.is_enabled) {
      console.log('[GET-CUSTOMER-CREDITS] Referral program not enabled');
      return new Response(
        JSON.stringify({ credits: [], totalAvailable: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch available credits (remaining_amount > 0 and not expired)
    const { data: credits, error: creditsError } = await supabase
      .from('customer_referral_credits')
      .select('id, amount, remaining_amount, expires_at, created_at')
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .gt('remaining_amount', 0)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: true }); // Use oldest credits first

    if (creditsError) {
      console.error('[GET-CUSTOMER-CREDITS] Error fetching credits:', creditsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch credits', credits: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const totalAvailable = credits?.reduce((sum, c) => sum + (c.remaining_amount || 0), 0) || 0;

    console.log('[GET-CUSTOMER-CREDITS] Found credits:', { count: credits?.length, totalAvailable });

    return new Response(
      JSON.stringify({ 
        credits: credits || [], 
        totalAvailable 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[GET-CUSTOMER-CREDITS] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', credits: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
