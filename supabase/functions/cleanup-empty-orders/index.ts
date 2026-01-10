import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY env vars");
      return new Response(
        JSON.stringify({ error: "Backend configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const jwt = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify the JWT using the admin client
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData?.user) {
      console.error("[cleanup-empty-orders] Auth getUser error", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = userData.user.id;

    const { companyId } = (await req.json().catch(() => ({}))) as {
      companyId?: string;
    };

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "companyId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[cleanup-empty-orders] Starting cleanup for company ${companyId}`);

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("owner_id")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) {
      console.error("[cleanup-empty-orders] Error loading company", companyError);
      throw companyError;
    }

    if (!company) {
      return new Response(
        JSON.stringify({ error: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let isAllowed = company.owner_id === userId;

    if (!isAllowed) {
      const { data: staffRow, error: staffError } = await supabaseAdmin
        .from("company_staff")
        .select("id")
        .eq("company_id", companyId)
        .eq("user_id", userId)
        .maybeSingle();

      if (staffError) {
        console.error("[cleanup-empty-orders] Error checking staff link", staffError);
        throw staffError;
      }

      isAllowed = !!staffRow;
    }

    if (!isAllowed) {
      const { data: adminRole, error: roleError } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "super_admin")
        .maybeSingle();

      if (roleError) {
        console.error("[cleanup-empty-orders] Error checking super_admin role", roleError);
        throw roleError;
      }

      isAllowed = !!adminRole;
    }

    if (!isAllowed) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch orders for this company with their items
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id, order_items(id)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (ordersError) {
      console.error("[cleanup-empty-orders] Error fetching orders", ordersError);
      throw ordersError;
    }

    const emptyOrderIds = (orders || [])
      .filter((order: any) => !order.order_items || order.order_items.length === 0)
      .map((order: any) => order.id);

    if (emptyOrderIds.length === 0) {
      console.log("[cleanup-empty-orders] No empty orders found");
      return new Response(
        JSON.stringify({ success: true, removed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(
      `[cleanup-empty-orders] Deleting ${emptyOrderIds.length} empty orders for company ${companyId}`,
    );

    const bestEffortDelete = async (table: string, column: string) => {
      const { error } = await supabaseAdmin
        // deno/edge: dynamic table name
        .from(table as any)
        .delete()
        .in(column, emptyOrderIds);

      if (error) {
        console.error(`[cleanup-empty-orders] Error deleting ${table}`, error);
      }
    };

    const bestEffortNullify = async (table: string, column: string) => {
      const { error } = await supabaseAdmin
        .from(table as any)
        .update({ [column]: null } as any)
        .in(column, emptyOrderIds);

      if (error) {
        console.error(`[cleanup-empty-orders] Error nullifying ${table}.${column}`, error);
      }
    };

    // Delete / detach related records first to avoid foreign key violations
    await bestEffortDelete("pending_order_payments", "order_id");
    await bestEffortDelete("push_subscriptions", "order_id");
    await bestEffortDelete("order_offers", "order_id");
    await bestEffortDelete("order_public_status", "order_id");
    await bestEffortDelete("order_reviews", "order_id");
    await bestEffortNullify("customer_referral_usage", "order_id");
    await bestEffortDelete("lottery_tickets", "order_id");
    await bestEffortDelete("nfe_invoices", "order_id");
    await bestEffortDelete("driver_deliveries", "order_id");
    await bestEffortNullify("inventory_movements", "related_order_id");
    await bestEffortDelete("order_items", "order_id");

    // Sanity check: pending payments should be gone
    const { count: pendingPaymentsLeft, error: pendingPaymentsCountError } = await supabaseAdmin
      .from("pending_order_payments")
      .select("id", { count: "exact", head: true })
      .in("order_id", emptyOrderIds);

    if (pendingPaymentsCountError) {
      console.error("[cleanup-empty-orders] Error counting pending_order_payments", pendingPaymentsCountError);
    } else {
      console.log(`[cleanup-empty-orders] pending_order_payments remaining: ${pendingPaymentsLeft ?? 0}`);
    }

    // Delete the orders
    const { error: ordersDeleteError } = await supabaseAdmin
      .from("orders")
      .delete()
      .in("id", emptyOrderIds);

    if (ordersDeleteError) {
      console.error("[cleanup-empty-orders] Error deleting empty orders", ordersDeleteError);
      throw ordersDeleteError;
    }

    console.log(
      `[cleanup-empty-orders] Successfully removed ${emptyOrderIds.length} empty orders for company ${companyId}`,
    );

    return new Response(
      JSON.stringify({ success: true, removed: emptyOrderIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[cleanup-empty-orders] Unexpected error", error);
    return new Response(
      JSON.stringify({ error: "Failed to cleanup empty orders" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
