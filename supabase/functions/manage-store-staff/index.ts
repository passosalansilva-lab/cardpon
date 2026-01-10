import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type StaffRole = "store_staff" | "delivery_driver";

type ManageStaffRequest =
  | { action: "list" }
  | { action: "update"; staffUserId: string; payload: { fullName?: string; phone?: string | null; role?: StaffRole } }
  | { action: "deactivate"; staffUserId: string };

async function getOwnerAndCompany(supabaseAdmin: any, token: string) {
  // Validate JWT using service role
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    console.error("[manage-store-staff] Auth error:", userError);
    return { error: "Usuário não autenticado" } as const;
  }

  const ownerId = userData.user.id;
  const { data: company, error: companyError } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("owner_id", ownerId)
    .single();

  if (companyError || !company) {
    return { error: "Nenhuma empresa encontrada para este usuário" } as const;
  }

  return { owner: userData.user, company } as const;
}

async function listStaff(supabaseAdmin: any, companyId: string) {
  const { data: staffRows, error: staffError } = await supabaseAdmin
    .from("company_staff")
    .select("id, user_id, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (staffError) {
    throw staffError;
  }

  const members = staffRows ?? [];
  if (members.length === 0) return [];

  const userIds = members.map((m: any) => m.user_id);

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone")
    .in("id", userIds);

  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", userIds);

  const profilesMap = new Map<string, { full_name: string | null; phone: string | null }>();
  profiles?.forEach((p: any) => {
    profilesMap.set(p.id, { full_name: p.full_name ?? null, phone: p.phone ?? null });
  });

  const rolesMap = new Map<string, StaffRole>();
  roles?.forEach((r: any) => {
    if (r.role === "store_staff" || r.role === "delivery_driver") {
      rolesMap.set(r.user_id, r.role as StaffRole);
    }
  });

  const emailsMap = new Map<string, string | null>();
  for (const userId of userIds) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!error && data?.user) {
      emailsMap.set(userId, data.user.email ?? null);
    } else {
      emailsMap.set(userId, null);
    }
  }

  return members.map((m: any) => {
    const profile = profilesMap.get(m.user_id) ?? { full_name: null, phone: null };
    const role = rolesMap.get(m.user_id) ?? "store_staff";
    const email = emailsMap.get(m.user_id) ?? null;

    return {
      id: m.id,
      user_id: m.user_id,
      created_at: m.created_at,
      full_name: profile.full_name,
      phone: profile.phone,
      email,
      role,
    };
  });
}

async function updateStaff(supabaseAdmin: any, companyId: string, staffUserId: string, payload: { fullName?: string; phone?: string | null; role?: StaffRole }) {
  const { data: staffRow, error: staffError } = await supabaseAdmin
    .from("company_staff")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", staffUserId)
    .maybeSingle();

  if (staffError || !staffRow) {
    throw new Error("Funcionário não encontrado para esta empresa");
  }

  if (payload.fullName !== undefined || payload.phone !== undefined) {
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: staffUserId, full_name: payload.fullName, phone: payload.phone ?? null });

    if (profileError) throw profileError;
  }

  if (payload.role) {
    const role: StaffRole = payload.role;

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: staffUserId, role }, { onConflict: "user_id,role" });

    if (roleError) throw roleError;

    const { error: deleteOtherRolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", staffUserId)
      .neq("role", role);

    if (deleteOtherRolesError) throw deleteOtherRolesError;

    if (role === "delivery_driver") {
      const { error: driverError } = await supabaseAdmin
        .from("delivery_drivers")
        .upsert(
          {
            company_id: companyId,
            email: (await supabaseAdmin.auth.admin.getUserById(staffUserId)).data?.user?.email ?? null,
            driver_name: payload.fullName ?? null,
            user_id: staffUserId,
            is_active: true,
            is_available: true,
          },
          { onConflict: "company_id,user_id" as any },
        );

      if (driverError) throw driverError;
    }
  }
}

async function deactivateStaff(supabaseAdmin: any, companyId: string, staffUserId: string) {
  const { error: deleteLinkError } = await supabaseAdmin
    .from("company_staff")
    .delete()
    .eq("company_id", companyId)
    .eq("user_id", staffUserId);

  if (deleteLinkError) throw deleteLinkError;

  const { data: remainingLinks, error: remainingError } = await supabaseAdmin
    .from("company_staff")
    .select("id")
    .eq("user_id", staffUserId)
    .limit(1);

  if (remainingError) throw remainingError;

  if (!remainingLinks || remainingLinks.length === 0) {
    await supabaseAdmin.auth.admin.updateUserById(staffUserId, {
      banned_until: new Date("2999-12-31T23:59:59Z").toISOString(),
    });
  }
}

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

    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const ownerAndCompany = await getOwnerAndCompany(supabaseAdmin, token);
    if ("error" in ownerAndCompany) {
      return new Response(JSON.stringify({ error: ownerAndCompany.error }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { company } = ownerAndCompany;

    const body = (await req.json()) as ManageStaffRequest;

    if (!body || !("action" in body)) {
      return new Response(JSON.stringify({ error: "Requisição inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "list") {
      const staff = await listStaff(supabaseAdmin, company.id);
      return new Response(JSON.stringify({ success: true, staff }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "update") {
      if (!body.staffUserId) {
        return new Response(JSON.stringify({ error: "staffUserId é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await updateStaff(supabaseAdmin, company.id, body.staffUserId, body.payload ?? {});
      const staff = await listStaff(supabaseAdmin, company.id);
      return new Response(JSON.stringify({ success: true, staff }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "deactivate") {
      if (!body.staffUserId) {
        return new Response(JSON.stringify({ error: "staffUserId é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await deactivateStaff(supabaseAdmin, company.id, body.staffUserId);
      const staff = await listStaff(supabaseAdmin, company.id);
      return new Response(JSON.stringify({ success: true, staff }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação não suportada" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[manage-store-staff] error", error);
    return new Response(JSON.stringify({ error: "Erro interno ao gerenciar equipe" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
