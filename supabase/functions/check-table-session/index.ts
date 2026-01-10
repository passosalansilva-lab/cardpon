import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { sessionToken } = await req.json()
    
    console.log(`Checking table session with token: ${sessionToken}`)

    if (!sessionToken) {
      return new Response(
        JSON.stringify({ 
          hasActiveSession: false, 
          reason: 'no_token',
          message: 'Token de sessão não fornecido'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Find the session by token
    const { data: session, error: sessionError } = await supabase
      .from('table_sessions')
      .select(`
        id, 
        status, 
        customer_name, 
        opened_at,
        table_id,
        tables!inner (
          id,
          table_number,
          name,
          is_active,
          company_id,
          companies!inner (
            id,
            slug,
            status
          )
        )
      `)
      .eq('session_token', sessionToken)
      .maybeSingle()

    if (sessionError) {
      console.error('Error checking session:', sessionError)
      return new Response(
        JSON.stringify({ error: 'Error checking session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!session) {
      console.log('Session token not found or expired')
      return new Response(
        JSON.stringify({ 
          hasActiveSession: false, 
          reason: 'invalid_token',
          message: 'Link inválido ou sessão expirada. Peça ao garçom para abrir sua mesa.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if session is still open
    if (session.status !== 'open') {
      console.log('Session is not open, status:', session.status)
      return new Response(
        JSON.stringify({ 
          hasActiveSession: false, 
          reason: 'session_closed',
          message: 'Esta sessão já foi encerrada. Peça ao garçom para abrir uma nova.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const table = session.tables as any
    const company = table.companies

    console.log('Active session found:', session.id, 'for table', table.table_number)
    return new Response(
      JSON.stringify({ 
        hasActiveSession: true, 
        sessionId: session.id,
        tableId: table.id,
        tableNumber: table.table_number,
        tableName: table.name || `Mesa ${table.table_number}`,
        companyId: company.id,
        companySlug: company.slug,
        openedAt: session.opened_at
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
