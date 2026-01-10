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

    const menuUrl = `https://www.cardpondelivery.com/auth`;

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
  <title>${company.name} aprovada no CardpOn</title>
</head>

<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:Arial, Helvetica, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:24px 0;">
<tr>
<td align="center">

<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.05);">

<!-- Header -->
<tr>
<td style="background:#111827; padding:28px; text-align:center;">
  <h1 style="margin:0; font-size:24px; color:#ffffff;">
    🎉 Sua loja já está no ar!
  </h1>
  <p style="margin:8px 0 0; font-size:14px; color:#9ca3af;">
    ${company.name} agora faz parte do CardpOn
  </p>
</td>
</tr>

<!-- Body -->
<tr>
<td style="padding:36px 32px 40px 32px;">

<p style="margin:0 0 16px; font-size:16px; color:#111827;">
Olá 👋
</p>

<p style="margin:0 0 24px; font-size:15px; color:#374151; line-height:1.6;">
Sua empresa <strong>${company.name}</strong> foi aprovada e já está ativa no
<strong>CardpOn</strong> 🚀  
Agora seus clientes podem acessar seu cardápio online, escolher os produtos e fazer pedidos direto pelo celular.
</p>

<!-- Highlight box -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb; border-radius:10px; margin-bottom:28px;">
<tr>
<td style="padding:20px;">
  <p style="margin:0; font-size:14px; color:#111827; font-weight:bold;">
  O que você já pode fazer agora:
  </p>
  <ul style="margin:12px 0 0; padding-left:18px; font-size:14px; color:#374151; line-height:1.6;">
    <li>Adicionar e editar seus produtos</li>
    <li>Definir preços, fotos e descrições</li>
    <li>Receber pedidos em tempo real</li>
    <li>Compartilhar seu link de vendas</li>
  </ul>
</td>
</tr>
</table>

<!-- Button -->
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td align="center">
  <a href="${menuUrl}" target="_blank"
    style="
      display:inline-block;
      padding:16px 32px;
      background:#16a34a;
      color:#ffffff;
      font-size:16px;
      font-weight:bold;
      text-decoration:none;
      border-radius:10px;
    ">
    🍔 Acessar meu painel
  </a>
</td>
</tr>
</table>

<p style="margin:28px 0 0; font-size:13px; color:#6b7280; text-align:center;">
Dica: copie o link do seu cardápio e compartilhe no WhatsApp e Instagram para começar a vender hoje mesmo.
</p>

</td>
</tr>

<!-- Footer -->
<tr>
<td style="background:#f9fafb; padding:22px; text-align:center;">
  <p style="margin:0; font-size:12px; color:#9ca3af;">
    © ${new Date().getFullYear()} CardpOn — seu cardápio online, simples e poderoso
  </p>
  <p style="margin:6px 0 0; font-size:12px;">
    <a href="https://www.cardpondelivery.com" style="color:#9ca3af; text-decoration:none;">
      www.cardpondelivery.com
    </a>
  </p>
</td>
</tr>

</table>

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
