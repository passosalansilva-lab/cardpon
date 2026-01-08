import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NfeInvoice {
  id: string;
  company_id: string;
  order_id: string;
  status: string;
}

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number | null;
  total: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  razao_social: string | null;
  inscricao_estadual: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  email: string | null;
}

interface NfeCompanySettings {
  id: string;
  company_id: string;
  certificate_path: string | null;
  certificate_password: string | null;
  csc_id: string | null;
  csc_token: string | null;
  serie_nfce: number;
  numero_atual_nfce: number;
  ambiente: string;
  is_configured: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('[process-nfe] Starting NFe processing...');

    // Get global NFe settings
    const { data: settings, error: settingsError } = await supabase
      .from('nfe_global_settings')
      .select('*')
      .limit(1)
      .single();

    if (settingsError || !settings) {
      console.log('[process-nfe] NFe settings not found');
      return new Response(
        JSON.stringify({ error: 'NFe settings not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.is_enabled) {
      console.log('[process-nfe] NFe is disabled');
      return new Response(
        JSON.stringify({ error: 'NFe is disabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.focus_nfe_token) {
      console.log('[process-nfe] Focus NFe token not configured');
      return new Response(
        JSON.stringify({ error: 'Focus NFe token not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get pending invoices
    const { data: pendingInvoices, error: invoicesError } = await supabase
      .from('nfe_invoices')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: true })
      .limit(10);

    if (invoicesError) {
      console.error('[process-nfe] Error fetching invoices:', invoicesError);
      throw invoicesError;
    }

    if (!pendingInvoices || pendingInvoices.length === 0) {
      console.log('[process-nfe] No pending invoices to process');
      return new Response(
        JSON.stringify({ message: 'No pending invoices', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[process-nfe] Found ${pendingInvoices.length} pending invoices`);

    const results = [];

    for (const invoice of pendingInvoices as NfeInvoice[]) {
      console.log(`[process-nfe] Processing invoice ${invoice.id} for order ${invoice.order_id}`);

      try {
        // Update status to processing
        await supabase
          .from('nfe_invoices')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', invoice.id);

        // Get order details
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', invoice.order_id)
          .single();

        if (orderError || !order) {
          throw new Error(`Order not found: ${invoice.order_id}`);
        }

        // Get order items
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', invoice.order_id);

        if (itemsError) {
          throw new Error(`Error fetching order items: ${itemsError.message}`);
        }

        // Get company details
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', invoice.company_id)
          .single();

        if (companyError || !company) {
          throw new Error(`Company not found: ${invoice.company_id}`);
        }

        if (!company.cnpj) {
          throw new Error('Company CNPJ not configured');
        }

        // Get company-specific NFe settings
        const { data: companyNfeSettings } = await supabase
          .from('nfe_company_settings')
          .select('*')
          .eq('company_id', invoice.company_id)
          .single();

        const nfeSettings = companyNfeSettings as NfeCompanySettings | null;
        
        // Determine which environment to use (company-specific or global)
        const useEnvironment = nfeSettings?.ambiente || settings.environment;
        const focusBaseUrl = useEnvironment === 'production'
          ? 'https://api.focusnfe.com.br'
          : 'https://homologacao.focusnfe.com.br';

        // Build NFCe payload for Focus NFe
        const nfcePayload = buildNfcePayload(order as Order, orderItems as OrderItem[], company as Company, nfeSettings);

        console.log(`[process-nfe] Sending NFCe to Focus NFe for invoice ${invoice.id}`);

        // Send to Focus NFe API
        const focusResponse = await fetch(`${focusBaseUrl}/v2/nfce?ref=${invoice.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(settings.focus_nfe_token + ':' + '')}`,
          },
          body: JSON.stringify(nfcePayload),
        });

        const focusData = await focusResponse.json();
        console.log(`[process-nfe] Focus NFe response:`, focusData);

        if (focusResponse.ok && focusData.status !== 'erro_autorizacao') {
          // Success or processing
          const updateData: Record<string, any> = {
            status: focusData.status === 'autorizado' ? 'authorized' : 'processing',
            focus_nfe_id: focusData.id || null,
            nfe_number: focusData.numero || null,
            access_key: focusData.chave_nfe || null,
            updated_at: new Date().toISOString(),
          };

          // If authorized, get PDF and XML URLs
          if (focusData.status === 'autorizado') {
            updateData.pdf_url = focusData.caminho_danfe || null;
            updateData.xml_url = focusData.caminho_xml_nota_fiscal || null;
          }

          await supabase
            .from('nfe_invoices')
            .update(updateData)
            .eq('id', invoice.id);

          results.push({ id: invoice.id, status: 'success', focusStatus: focusData.status });
        } else {
          // Error
          const errorMessage = focusData.mensagem || focusData.erros?.[0]?.mensagem || 'Erro desconhecido';
          
          await supabase
            .from('nfe_invoices')
            .update({
              status: 'error',
              error_message: errorMessage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', invoice.id);

          results.push({ id: invoice.id, status: 'error', error: errorMessage });
        }
      } catch (error: any) {
        console.error(`[process-nfe] Error processing invoice ${invoice.id}:`, error);

        await supabase
          .from('nfe_invoices')
          .update({
            status: 'error',
            error_message: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoice.id);

        results.push({ id: invoice.id, status: 'error', error: error.message });
      }
    }

    console.log(`[process-nfe] Processed ${results.length} invoices`);

    return new Response(
      JSON.stringify({ message: 'Processing complete', results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[process-nfe] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildNfcePayload(order: Order, items: OrderItem[], company: Company, nfeSettings: NfeCompanySettings | null) {
  // Clean CNPJ - remove non-digits
  const cnpj = company.cnpj?.replace(/\D/g, '') || '';
  const ie = company.inscricao_estadual?.replace(/\D/g, '') || '';

  // Map payment method to Focus NFe format
  const paymentMap: Record<string, string> = {
    'pix': '17', // PIX
    'cash': '01', // Dinheiro
    'card': '03', // Cartão de Crédito
    'card_online': '03',
    'debit': '04', // Cartão de Débito
  };

  const formaPagamento = paymentMap[order.payment_method] || '99'; // 99 = Outros

  // Build items array for NFCe
  const nfceItems = items.map((item, index) => ({
    numero_item: String(index + 1),
    codigo_produto: item.id.slice(0, 60),
    descricao: item.product_name.slice(0, 120),
    quantidade: item.quantity,
    unidade_comercial: 'UN',
    valor_unitario_comercial: item.unit_price.toFixed(2),
    valor_unitario_tributavel: item.unit_price.toFixed(2),
    unidade_tributavel: 'UN',
    codigo_ncm: '21069090', // NCM genérico para alimentos preparados
    valor_bruto: item.total_price.toFixed(2),
    // ICMS Simples Nacional
    icms_situacao_tributaria: '102', // Tributada pelo Simples Nacional sem permissão de crédito
    icms_origem: '0', // Nacional
  }));

  // Add delivery fee as item if present
  if (order.delivery_fee > 0) {
    nfceItems.push({
      numero_item: String(nfceItems.length + 1),
      codigo_produto: 'ENTREGA',
      descricao: 'Taxa de Entrega',
      quantidade: 1,
      unidade_comercial: 'UN',
      valor_unitario_comercial: order.delivery_fee.toFixed(2),
      valor_unitario_tributavel: order.delivery_fee.toFixed(2),
      unidade_tributavel: 'UN',
      codigo_ncm: '49019900', // NCM para serviços
      valor_bruto: order.delivery_fee.toFixed(2),
      icms_situacao_tributaria: '102',
      icms_origem: '0',
    });
  }

  const payload: Record<string, any> = {
    natureza_operacao: 'VENDA AO CONSUMIDOR',
    forma_pagamento: '0', // 0 = à vista
    tipo_documento: '1', // 1 = saída
    finalidade_emissao: '1', // 1 = normal
    consumidor_final: '1', // 1 = sim
    presenca_comprador: '4', // 4 = entrega a domicílio
    
    cnpj_emitente: cnpj,
    inscricao_estadual_emitente: ie || undefined,
    
    // Consumer data (simplified for NFCe)
    nome_destinatario: order.customer_name.slice(0, 60),
    
    // Items
    items: nfceItems,
    
    // Payment
    formas_pagamento: [{
      forma_pagamento: formaPagamento,
      valor_pagamento: order.total.toFixed(2),
    }],
    
    // Totals
    valor_produtos: order.subtotal.toFixed(2),
    valor_desconto: (order.discount_amount || 0).toFixed(2),
    valor_total: order.total.toFixed(2),
    
    // Additional info
    informacoes_adicionais_contribuinte: order.notes 
      ? `Pedido: ${order.id.slice(0, 8)} | Obs: ${order.notes.slice(0, 200)}`
      : `Pedido: ${order.id.slice(0, 8)}`,
  };

  // Add CSC info if configured (required for NFCe)
  if (nfeSettings?.csc_id && nfeSettings?.csc_token) {
    payload.csc_id = nfeSettings.csc_id;
    payload.csc = nfeSettings.csc_token;
  }

  // Add serie if configured
  if (nfeSettings?.serie_nfce) {
    payload.serie = String(nfeSettings.serie_nfce);
  }

  return payload;
}
