import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { companyId, ownerId } = await req.json();

    if (!companyId || !ownerId) {
      return new Response(
        JSON.stringify({ error: "companyId e ownerId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 🔎 Buscar empresa
    const { data: company } = await supabase
      .from("companies")
      .select("name, slug")
      .eq("id", companyId)
      .single();

    // 🔎 Buscar owner
    const { data: user } = await supabase.auth.admin.getUserById(ownerId);

    if (!company || !user?.user?.email) {
      throw new Error("Empresa ou usuário não encontrado");
    }

    const menuUrl = `https://www.cardpondelivery.com/menu/${company.slug}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CardpOn <contato@cardpondelivery.com>",
        to: [user.user.email],
        subject: `🎉 Sua empresa ${company.name} foi aprovada!`,
        html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Empresa aprovada</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:20px 0;">
    <tr>
      <td align="center">
        <!-- Container -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff; border-radius:12px; overflow:hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background:#111827; padding:24px; text-align:center;">
              <h1 style="margin:0; font-size:24px; color:#ffffff;">
                🎉 Empresa aprovada!
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px; font-size:16px; color:#111827;">
                Parabéns!
              </p>

              <p style="margin:0 0 24px; font-size:15px; color:#374151; line-height:1.6;">
                Sua empresa <strong>${company.name}</strong> foi aprovada com sucesso no
                <strong>CardpOn</strong>.
                <br />
                Agora seu cardápio já pode ser acessado online e compartilhado com seus clientes.
              </p>

              <!-- Button -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a
                      href="${menuUrl}"
                      target="_blank"
                      style="
                        display:inline-block;
                        padding:14px 28px;
                        background-color:#16a34a;
                        color:#ffffff;
                        font-size:16px;
                        font-weight:bold;
                        text-decoration:none;
                        border-radius:8px;
                      "
                    >
                      🍽️ Acessar meu cardápio
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:32px 0 0; font-size:13px; color:#6b7280; text-align:center;">
                Se tiver qualquer dúvida, é só responder este email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb; padding:20px; text-align:center;">
              <p style="margin:0; font-size:12px; color:#9ca3af;">
                © ${new Date().getFullYear()} CardpOn — Seu cardápio online
              </p>
              <p style="margin:6px 0 0; font-size:12px; color:#9ca3af;">
                <a href="https://www.cardpondelivery.com/" style="color:#9ca3af; text-decoration:none;">
                  cardpon.com.br
                </a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /Container -->
      </td>
    </tr>
  </table>
</body>
</html>
`
,
      }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
