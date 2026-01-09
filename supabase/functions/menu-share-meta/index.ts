import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function isSocialCrawler(userAgent: string) {
  return /facebookexternalhit|WhatsApp|Twitterbot|Slackbot|Discordbot|LinkedInBot|TelegramBot|Googlebot|bingbot|DuckDuckBot|Baiduspider/i.test(
    userAgent,
  );
}

function extractSlug(url: URL): string | null {
  const qp = url.searchParams.get("slug")?.trim();
  if (qp) return qp;

  // Allow calling as: /menu-share-meta/<slug>
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.lastIndexOf("menu-share-meta");
  const candidate = idx >= 0 ? parts[idx + 1] : undefined;
  if (candidate?.trim()) return candidate.trim();

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = extractSlug(url);
    const origin = url.searchParams.get("origin") || "https://www.cardpondelivery.com";

    const userAgent = req.headers.get("user-agent") || "";
    const crawler = isSocialCrawler(userAgent);

    console.log(
      `[menu-share-meta] slug=${slug} origin=${origin} crawler=${crawler}`,
    );

    if (!slug) {
      return new Response(
        JSON.stringify({
          error: "Slug is required",
          hint: "Pass ?slug=SEU_SLUG or call /menu-share-meta/SEU_SLUG",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8",
          },
        },
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
      console.error("[menu-share-meta] DB error:", error);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
        },
      });
    }

    const shareUrl = `${origin}/s/${slug}`;
    const menuUrl = `${origin}/menu/${slug}`;

    if (!company) {
      const html = generateMetaHtml({
        title: "Cardápio Online",
        description: "Peça online com praticidade e rapidez.",
        imageUrl: null,
        shareUrl,
        menuUrl,
        companyName: "Cardápio Online",
      });

      return new Response(html, {
        status: 200,
        headers: buildHtmlHeaders(),
      });
    }

    const title = company.name;
    const description = company.description?.trim() ||
      `Peça online na ${company.name} com praticidade e rapidez.${company.city ? ` ${company.city}.` : ""}`;

    // Garantir URL de imagem absoluta e pública
    let imageUrl: string | null = null;
    const rawImage = company.logo_url || company.cover_url;
    
    if (rawImage) {
      if (rawImage.startsWith("http://") || rawImage.startsWith("https://")) {
        // Já é URL absoluta
        imageUrl = rawImage;
      } else if (rawImage.startsWith("/")) {
        // Caminho absoluto no storage
        imageUrl = `${supabaseUrl}/storage/v1/object/public${rawImage}`;
      } else {
        // Caminho relativo - assume bucket 'images'
        imageUrl = `${supabaseUrl}/storage/v1/object/public/images/${rawImage}`;
      }
    }

    console.log(
      `[menu-share-meta] meta for=${company.name} og_url=${shareUrl} image=${imageUrl}`,
    );

    const html = generateMetaHtml({
      title,
      description,
      imageUrl,
      shareUrl,
      menuUrl,
      companyName: company.name,
    });

    return new Response(html, {
      status: 200,
      headers: buildHtmlHeaders(),
    });
  } catch (error) {
    console.error("[menu-share-meta] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }
});

function buildHtmlHeaders(): Headers {
  const headers = new Headers(corsHeaders);
  // IMPORTANT: alguns crawlers (ex.: WhatsApp) dependem do header HTTP para detectar UTF-8.
  headers.set("content-type", "text/html; charset=utf-8");
  // Cache curto (5 min) para melhorar scrape e permitir atualização rápida.
  headers.set("cache-control", "public, max-age=300, s-maxage=300");
  headers.set("vary", "user-agent");
  return headers;
}

function generateMetaHtml(args: {
  title: string;
  description: string;
  imageUrl: string | null;
  shareUrl: string;
  menuUrl: string;
  companyName: string;
}): string {
  const {
    title,
    description,
    imageUrl,
    shareUrl,
    menuUrl,
    companyName,
  } = args;


  // Sem redirect HTTP (para não quebrar crawlers), mas com redirect via JS para humanos.
  // Bots de redes sociais normalmente NÃO executam JS; assim eles leem as OG tags,
  // enquanto pessoas que abrem o link são levadas automaticamente ao cardápio.

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(shareUrl)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${escapeHtml(companyName)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(shareUrl)}" />
  ${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/jpeg" />` : ""}

  <!-- Twitter -->
  <meta name="twitter:card" content="${imageUrl ? "summary_large_image" : "summary"}" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  ${imageUrl ? `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />` : ""}
</head>
 <body style="font-family: system-ui, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; background:#f5f5f5;">
   <div style="text-align:center; padding:24px; max-width:520px;">
     <p style="font-size:18px; color:#333; margin:0 0 8px;">Abrindo cardapio de ${escapeHtml(companyName)}...</p>
     <p style="margin:0;"><a href="${escapeHtml(menuUrl)}" style="color:#7c3aed;">Abrir cardapio</a></p>
   </div>

  <script>
    // Redirect para humanos (bots geralmente não executam JS)
    (function () {
      const target = ${JSON.stringify(menuUrl)};
      try {
        window.setTimeout(() => {
          try {
            window.location.replace(target);
          } catch (_) {
            window.location.href = target;
          }
        }, 80);
      } catch (_) {
        // noop
      }
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  // Além de escapar HTML, converte caracteres não-ASCII para entidades numéricas.
  // Isso evita "CardÃ¡pio" em clientes que interpretam a resposta como ISO-8859-1 por causa de headers intermediários.
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/[^\x00-\x7F]/g, (c) => `&#${c.codePointAt(0)};`);
}
