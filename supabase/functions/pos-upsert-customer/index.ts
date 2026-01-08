import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type UpsertCustomerBody = {
  companyId: string;
  name: string;
  phone: string;
  email?: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      return new Response(JSON.stringify({ error: "Configuração do servidor incompleta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const body = (await req.json()) as UpsertCustomerBody;

    const companyId = body.companyId;
    const name = (body.name ?? "").trim();
    const phone = (body.phone ?? "").replace(/\D/g, "");
    const email = (body.email ?? null)?.toLowerCase().trim() || null;

    if (!companyId || !name || !phone) {
      return new Response(JSON.stringify({ error: "companyId, name e phone são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário autenticado não encontrado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorize: must be owner or staff for the company
    const [{ data: ownerCompany, error: ownerCompanyError }, { data: staffLink, error: staffError }] =
      await Promise.all([
        supabaseAdmin.from("companies").select("id").eq("id", companyId).eq("owner_id", user.id).maybeSingle(),
        supabaseAdmin
          .from("company_staff")
          .select("id")
          .eq("company_id", companyId)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

    if (ownerCompanyError || staffError) {
      console.error("[pos-upsert-customer] auth query error", ownerCompanyError ?? staffError);
      return new Response(JSON.stringify({ error: "Erro ao validar permissões" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowed = !!ownerCompany || !!staffLink;
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Sem permissão para criar cliente nesta empresa" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert by phone (best effort)
    const { data: existingCustomer, error: findError } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error("[pos-upsert-customer] findError", findError);
      return new Response(JSON.stringify({ error: "Erro ao buscar cliente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingCustomer?.id) {
      const { error: updateError } = await supabaseAdmin
        .from("customers")
        .update({ name, email })
        .eq("id", existingCustomer.id);

      if (updateError) {
        console.error("[pos-upsert-customer] updateError", updateError);
        return new Response(JSON.stringify({ error: "Erro ao atualizar cliente" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ customerId: existingCustomer.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: createdCustomer, error: insertError } = await supabaseAdmin
      .from("customers")
      .insert({ name, phone, email, user_id: null })
      .select("id")
      .single();

    if (insertError || !createdCustomer) {
      console.error("[pos-upsert-customer] insertError", insertError);
      return new Response(JSON.stringify({ error: insertError?.message ?? "Erro ao criar cliente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ customerId: createdCustomer.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[pos-upsert-customer] error", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
