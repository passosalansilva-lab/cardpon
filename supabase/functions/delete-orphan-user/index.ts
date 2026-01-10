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

    const { email, adminToken } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email é obrigatório" }), {
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

    // Buscar usuário pelo email
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("Erro ao listar usuários:", listError);
      return new Response(JSON.stringify({ error: "Erro ao buscar usuário" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUser = usersData.users.find(u => u.email === email);
    
    if (!targetUser) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deletar roles do usuário
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", targetUser.id);

    // Deletar o usuário
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(targetUser.id);

    if (deleteUserError) {
      console.error("Erro ao deletar usuário:", deleteUserError);
      return new Response(JSON.stringify({ error: "Erro ao deletar usuário" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Usuário ${email} deletado com sucesso`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Usuário "${email}" deletado com sucesso` 
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
