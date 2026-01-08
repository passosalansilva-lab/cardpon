import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DRIVER-DIRECT-LOGIN] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { email, companySlug } = await req.json();
    
    if (!email) {
      throw new Error("Email is required");
    }

    const normalizedEmail = email.toLowerCase().trim();
    logStep("Processing login", { email: normalizedEmail, companySlug });

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // If companySlug is provided, verify the company exists first
    let targetCompanyId: string | null = null;
    let companyName: string | null = null;
    
    if (companySlug) {
      const { data: company, error: companyError } = await supabaseAdmin
        .from("companies")
        .select("id, name, slug")
        .eq("slug", companySlug)
        .maybeSingle();

      if (companyError) {
        logStep("Error fetching company", { error: companyError.message });
        throw new Error("Erro ao verificar empresa");
      }

      if (!company) {
        logStep("Company not found", { slug: companySlug });
        return new Response(JSON.stringify({ 
          error: "Empresa não encontrada. Verifique o link de acesso." 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      targetCompanyId = company.id;
      companyName = company.name;
      logStep("Company found", { companyId: targetCompanyId, name: companyName });
    }

    // Build query for driver
    let driverQuery = supabaseAdmin
      .from("delivery_drivers")
      .select("id, email, driver_name, is_active, user_id, company_id")
      .eq("email", normalizedEmail)
      .eq("is_active", true);

    // If company slug was provided, filter by that company
    if (targetCompanyId) {
      driverQuery = driverQuery.eq("company_id", targetCompanyId);
    }

    const { data: drivers, error: driverError } = await driverQuery
      .order("created_at", { ascending: false })
      .limit(1);

    if (driverError) {
      logStep("Error fetching driver", { error: driverError.message });
      throw new Error("Erro ao verificar entregador");
    }

    const driver = drivers && drivers.length > 0 ? drivers[0] : null;

    if (!driver) {
      logStep("Driver not found or inactive", { companySlug, email: normalizedEmail });
      
      // Give more specific error if company was specified
      if (companySlug) {
        return new Response(JSON.stringify({ 
          error: `Você não está cadastrado como entregador em ${companyName || 'esta empresa'}. Verifique com o estabelecimento.` 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
      
      return new Response(JSON.stringify({ 
        error: "Email não cadastrado ou conta desativada" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Driver found", { driverId: driver.id, hasUserId: !!driver.user_id, companyId: driver.company_id });

    let userId = driver.user_id;

    // If driver doesn't have a user_id, create auth user
    if (!userId) {
      logStep("Creating new auth user for driver");
      
      // Generate a random password (user won't need it)
      const randomPassword = crypto.randomUUID() + crypto.randomUUID();
      
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: randomPassword,
        email_confirm: true,
        user_metadata: {
          full_name: driver.driver_name || "Entregador",
        },
      });

      if (authError) {
        // User might already exist
        if (authError.message.includes("already been registered")) {
          logStep("User already exists, fetching user");
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = existingUsers?.users?.find(u => u.email === normalizedEmail);
          if (existingUser) {
            userId = existingUser.id;
          } else {
            throw authError;
          }
        } else {
          throw authError;
        }
      } else {
        userId = authData.user.id;
      }

      // Link user to driver record
      const { error: updateError } = await supabaseAdmin
        .from("delivery_drivers")
        .update({ user_id: userId })
        .eq("id", driver.id);

      if (updateError) {
        logStep("Error linking user to driver", { error: updateError.message });
      }

      // Add driver role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ 
          user_id: userId, 
          role: "delivery_driver" 
        }, { 
          onConflict: "user_id,role" 
        });

      if (roleError) {
        logStep("Error adding driver role", { error: roleError.message });
      }

      logStep("Created and linked new user", { userId });
    }

    // Generate session tokens for the user
    logStep("Generating session for user", { userId });

    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
    });

    if (sessionError) {
      logStep("Error generating link", { error: sessionError.message });
      throw sessionError;
    }

    // Extract the token from the action link and create a session
    const actionLink = sessionData.properties?.action_link;
    if (!actionLink) {
      throw new Error("Could not generate login link");
    }

    // Parse the token from the link
    const url = new URL(actionLink);
    const token = url.searchParams.get("token");
    const tokenType = url.searchParams.get("type");

    if (!token) {
      throw new Error("Could not extract token");
    }

    // Verify the OTP to get a session
    const { data: otpData, error: otpError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: token,
      type: tokenType as any || "magiclink",
    });

    if (otpError) {
      logStep("Error verifying token", { error: otpError.message });
      throw otpError;
    }

    if (!otpData.session) {
      throw new Error("Could not create session");
    }

    logStep("Session created successfully");

    return new Response(JSON.stringify({
      session: {
        access_token: otpData.session.access_token,
        refresh_token: otpData.session.refresh_token,
      },
      user: otpData.user,
      companyId: driver.company_id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
