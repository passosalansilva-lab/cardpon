import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar se o usuário é super_admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas super admins podem excluir empresas." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { companyId, adminToken } = await req.json();

    if (!companyId) {
      return new Response(JSON.stringify({ error: "ID da empresa é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!adminToken) {
      return new Response(JSON.stringify({ error: "Token de super admin é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar token de super admin
    const superadminToken = Deno.env.get("SUPERADMIN_SETUP_SECRET");
    if (!superadminToken || adminToken !== superadminToken) {
      return new Response(JSON.stringify({ error: "Token incorreto" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar a empresa e o owner_id
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, name, owner_id")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ownerId = company.owner_id;
    const companyName = company.name;

    // Deletar a empresa (cascade vai deletar todos os dados relacionados)
    const { error: deleteCompanyError } = await supabaseAdmin
      .from("companies")
      .delete()
      .eq("id", companyId);

    if (deleteCompanyError) {
      console.error("Erro ao deletar empresa:", deleteCompanyError);
      return new Response(JSON.stringify({ error: "Erro ao deletar empresa" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deletar roles do usuário
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", ownerId);

    // Deletar o usuário owner do auth.users
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(ownerId);

    if (deleteUserError) {
      console.error("Erro ao deletar usuário:", deleteUserError);
      return new Response(JSON.stringify({ 
        success: true, 
        warning: "Empresa deletada, mas houve um erro ao deletar o usuário owner",
        companyName 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Empresa "${companyName}" e usuário owner deletados com sucesso`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Empresa "${companyName}" e usuário owner deletados com sucesso` 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
