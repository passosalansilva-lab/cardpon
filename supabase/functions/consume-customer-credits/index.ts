import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConsumeCreditsRequest {
  companyId: string;
  customerId: string;
  amountToConsume: number;
  orderId: string;
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

    const { companyId, customerId, amountToConsume, orderId } = await req.json() as ConsumeCreditsRequest;

    console.log('[CONSUME-CREDITS] Request:', { companyId, customerId, amountToConsume, orderId });

    if (!companyId || !customerId || !amountToConsume || !orderId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields', consumed: 0 }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch available credits (remaining_amount > 0 and not expired)
    const { data: credits, error: creditsError } = await supabase
      .from('customer_referral_credits')
      .select('id, remaining_amount')
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .gt('remaining_amount', 0)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: true }); // Use oldest credits first

    if (creditsError) {
      console.error('[CONSUME-CREDITS] Error fetching credits:', creditsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch credits', consumed: 0 }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!credits || credits.length === 0) {
      console.log('[CONSUME-CREDITS] No credits available');
      return new Response(
        JSON.stringify({ consumed: 0, message: 'No credits available' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let remainingToConsume = amountToConsume;
    let totalConsumed = 0;

    // Consume credits in order (oldest first)
    for (const credit of credits) {
      if (remainingToConsume <= 0) break;

      const consumeFromThis = Math.min(credit.remaining_amount, remainingToConsume);
      const newRemaining = credit.remaining_amount - consumeFromThis;

      const { error: updateError } = await supabase
        .from('customer_referral_credits')
        .update({ remaining_amount: newRemaining })
        .eq('id', credit.id);

      if (updateError) {
        console.error('[CONSUME-CREDITS] Error updating credit:', updateError);
        continue;
      }

      remainingToConsume -= consumeFromThis;
      totalConsumed += consumeFromThis;

      console.log('[CONSUME-CREDITS] Consumed from credit:', { 
        creditId: credit.id, 
        consumed: consumeFromThis, 
        newRemaining 
      });
    }

    console.log('[CONSUME-CREDITS] Total consumed:', totalConsumed);

    return new Response(
      JSON.stringify({ 
        consumed: totalConsumed,
        message: `Consumed ${totalConsumed.toFixed(2)} in credits`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[CONSUME-CREDITS] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', consumed: 0 }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
