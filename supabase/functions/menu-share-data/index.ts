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
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug")?.trim();
    const origin = url.searchParams.get("origin") || "https://www.cardpondelivery.com";

    console.log(`[menu-share-data] Request for slug: ${slug}, origin: ${origin}`);

    if (!slug) {
      return new Response(
        JSON.stringify({ error: "Slug is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: company, error } = await supabase
      .from("companies_public")
      .select("name, slug, description, logo_url, cover_url, city")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error("[menu-share-data] DB error:", error);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!company) {
      console.log(`[menu-share-data] Company not found: ${slug}`);
      return new Response(
        JSON.stringify({ error: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build absolute image URL
    let image = company.logo_url || company.cover_url || null;
    if (image && !image.startsWith("http")) {
      if (image.startsWith("/")) {
        image = `${supabaseUrl}/storage/v1/object/public${image}`;
      } else {
        image = `${supabaseUrl}/storage/v1/object/public/images/${image}`;
      }
    }

    const shareUrl = `${origin}/menu/${slug}`;
    const description = company.description?.trim() ||
      `Peça online na ${company.name} com praticidade e rapidez.${company.city ? ` ${company.city}.` : ""}`;

    const responseData = {
      name: `${company.name} | Cardápio Online`,
      description,
      image,
      shareUrl,
      slug: company.slug,
    };

    console.log(`[menu-share-data] Returning data for: ${company.name}`);

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[menu-share-data] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
