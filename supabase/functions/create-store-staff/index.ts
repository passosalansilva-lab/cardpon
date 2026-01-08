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

    const supabaseClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const {
      fullName,
      email,
      phone,
      password,
      role,
    } = await req.json();

    if (!fullName || !email || !password) {
      return new Response(JSON.stringify({ error: "Nome, e-mail e senha são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validRoles = ["store_staff", "delivery_driver"] as const;
    const requestedRole = (role as string | undefined)?.toLowerCase() || "store_staff";
    if (!validRoles.includes(requestedRole as any)) {
      return new Response(JSON.stringify({ error: "Papel inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user: owner },
      error: ownerError,
    } = await supabaseClient.auth.getUser();

    if (ownerError || !owner) {
      return new Response(JSON.stringify({ error: "Usuário autenticado não encontrado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("owner_id", owner.id)
      .single();

    if (companyError || !company) {
      return new Response(JSON.stringify({ error: "Nenhuma empresa encontrada para este usuário" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = (email as string).toLowerCase().trim();

    // Check if email belongs to a store owner (lojista cannot be staff)
    const { data: existingOwnerCompany } = await supabaseAdmin
      .from("companies")
      .select("id, name")
      .eq("owner_id", (await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data?.users?.find(u => u.email?.toLowerCase() === normalizedEmail)?.id ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle();

    if (existingOwnerCompany) {
      return new Response(
        JSON.stringify({ error: "Este e-mail pertence a um lojista e não pode ser cadastrado como funcionário." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Also check user_roles for store_owner role
    const checkStoreOwnerRole = async (targetEmail: string) => {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const user = users?.users?.find(u => u.email?.toLowerCase() === targetEmail);
      if (!user) return false;
      
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "store_owner")
        .maybeSingle();
      
      return !!roles;
    };

    if (await checkStoreOwnerRole(normalizedEmail)) {
      return new Response(
        JSON.stringify({ error: "Este e-mail pertence a um lojista e não pode ser cadastrado como funcionário." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create user, but if email already exists, link the existing user instead.
    const findExistingUserByEmail = async (targetEmail: string) => {
      const perPage = 1000;
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (error) throw error;

        const found = data?.users?.find((u) => u.email?.toLowerCase() === targetEmail);
        if (found) return found;

        // If we got less than a full page, there are no more users to scan.
        if (!data?.users || data.users.length < perPage) break;
      }
      return null;
    };

    let staffUserId: string;
    let isExistingUser = false;

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone,
      },
    });

    if (authError || !authData?.user) {
      const msg = (authError?.message ?? "").toLowerCase();

      if (msg.includes("already been registered") || msg.includes("already registered")) {
        isExistingUser = true;

        let existingUser;
        try {
          existingUser = await findExistingUserByEmail(normalizedEmail);
        } catch (e) {
          console.error("[create-store-staff] listUsers error", e);
          return new Response(JSON.stringify({ error: "Erro ao localizar usuário existente" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!existingUser) {
          return new Response(
            JSON.stringify({
              error:
                "Este e-mail já está cadastrado, mas não foi possível localizar o usuário para vincular como funcionário.",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        staffUserId = existingUser.id;

        // Check if already staff for this company
        const { data: existingStaff, error: existingStaffError } = await supabaseAdmin
          .from("company_staff")
          .select("id")
          .eq("company_id", company.id)
          .eq("user_id", staffUserId)
          .maybeSingle();

        if (existingStaffError) {
          console.error("[create-store-staff] existingStaffError", existingStaffError);
          return new Response(JSON.stringify({ error: "Erro ao verificar vínculo do funcionário" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (existingStaff) {
          return new Response(JSON.stringify({ error: "Este usuário já faz parte da equipe desta empresa" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: authError?.message ?? "Erro ao criar usuário" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      staffUserId = authData.user.id;
    }

    // Keep profile in sync (new or existing)
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: staffUserId, full_name: fullName, phone: phone ?? null });

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: staffUserId, role: requestedRole }, { onConflict: "user_id,role" });

    if (requestedRole === "delivery_driver") {
      await supabaseAdmin
        .from("delivery_drivers")
        .upsert({
          company_id: company.id,
          email: normalizedEmail,
          driver_name: fullName,
          driver_phone: phone ?? null,
          user_id: staffUserId,
          is_active: true,
          is_available: true,
        }, { onConflict: "company_id,email" as any });
    }

    const { error: companyStaffError } = await supabaseAdmin.from("company_staff").insert({
      company_id: company.id,
      user_id: staffUserId,
    });

    if (companyStaffError) {
      return new Response(JSON.stringify({ error: companyStaffError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        staffUserId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[create-store-staff] error", error);
    return new Response(JSON.stringify({ error: "Erro interno ao criar funcionário" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
