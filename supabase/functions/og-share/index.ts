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
    
    // Aceita slug via query string OU path: /og-share/meu-slug ou /og-share?slug=meu-slug
    let slug: string | undefined = url.searchParams.get("slug")?.trim() || undefined;
    if (!slug) {
      const parts = url.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      slug = last && last !== "og-share" ? last : undefined;
    }

    const origin = url.searchParams.get("origin") || "https://www.cardpondelivery.com";

    console.log(`[og-share] slug=${slug} origin=${origin}`);

    if (!slug) {
      return new Response(
        JSON.stringify({ error: "Slug is required", usage: "/og-share/{slug} or /og-share?slug={slug}" }),
        { status: 400, headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" } }
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
      console.error("[og-share] DB error:", error);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" } }
      );
    }

    const shareUrl = `${origin}/s/${slug}`;
    const menuUrl = `${origin}/menu/${slug}`;

    // Fallback se empresa não existe
    if (!company) {
      return new Response(
        buildHtml({
          title: "Cardápio Online",
          description: "Peça online com praticidade e rapidez.",
          imageUrl: null,
          shareUrl,
          menuUrl,
          companyName: "Cardápio Online",
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=300, s-maxage=300",
            "vary": "user-agent",
          },
        }
      );
    }

    const title = company.name;
    const description = company.description?.trim() || 
      `Peça online na ${company.name} com praticidade e rapidez.${company.city ? ` ${company.city}.` : ""}`;

    // Montar URL da imagem
    let imageUrl: string | null = null;
    const rawImage = company.logo_url || company.cover_url;
    if (rawImage) {
      if (rawImage.startsWith("http")) {
        imageUrl = rawImage;
      } else if (rawImage.startsWith("/")) {
        imageUrl = `${supabaseUrl}/storage/v1/object/public${rawImage}`;
      } else {
        imageUrl = `${supabaseUrl}/storage/v1/object/public/images/${rawImage}`;
      }
    }

    console.log(`[og-share] company=${company.name} image=${imageUrl}`);

    return new Response(
      buildHtml({ title, description, imageUrl, shareUrl, menuUrl, companyName: company.name }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=300, s-maxage=300",
          "vary": "user-agent",
        },
      }
    );

  } catch (err) {
    console.error("[og-share] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" } }
    );
  }
});

function buildHtml(args: {
  title: string;
  description: string;
  imageUrl: string | null;
  shareUrl: string;
  menuUrl: string;
  companyName: string;
}): string {
  const { title, description, imageUrl, shareUrl, menuUrl, companyName } = args;

  const esc = (s: string) => s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    // Força UTF seguro (entidades) para crawlers/clientes que não respeitam charset corretamente.
    .replace(/[^\x00-\x7F]/g, (c) => `&#${c.codePointAt(0)};`);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(shareUrl)}">

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(companyName)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(shareUrl)}">
  ${imageUrl ? `<meta property="og:image" content="${esc(imageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">` : ""}

  <!-- Twitter -->
  <meta name="twitter:card" content="${imageUrl ? "summary_large_image" : "summary"}">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  ${imageUrl ? `<meta name="twitter:image" content="${esc(imageUrl)}">` : ""}
</head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;">
  <div style="text-align:center;padding:24px;max-width:520px;">
    <p style="font-size:18px;color:#333;margin:0 0 8px;">Abrindo cardápio de ${esc(companyName)}...</p>
    <p style="margin:0;"><a href="${esc(menuUrl)}" style="color:#7c3aed;">Abrir cardápio</a></p>
  </div>
  <script>
    setTimeout(function(){location.replace(${JSON.stringify(menuUrl)});},100);
  </script>
</body>
</html>`;
}
