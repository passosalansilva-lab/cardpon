import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CartItem {
  productName: string;
  categoryName?: string;
}

interface AvailableProduct {
  id: string;
  name: string;
  categoryName: string;
  price: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cartItems, availableProducts } = await req.json() as {
      cartItems: CartItem[];
      availableProducts: AvailableProduct[];
    };

    if (!cartItems || cartItems.length === 0) {
      return new Response(
        JSON.stringify({ suggestedIds: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!availableProducts || availableProducts.length === 0) {
      return new Response(
        JSON.stringify({ suggestedIds: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ suggestedIds: [], error: "AI not configured" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cartDescription = cartItems
      .map(item => `- ${item.productName}${item.categoryName ? ` (${item.categoryName})` : ''}`)
      .join('\n');

    const productsList = availableProducts
      .map(p => `ID: ${p.id} | Nome: ${p.name} | Categoria: ${p.categoryName} | Preço: R$${p.price.toFixed(2)}`)
      .join('\n');

    const systemPrompt = `Você é um assistente de vendas inteligente para um cardápio digital de restaurante/lanchonete.
Sua tarefa é sugerir produtos complementares baseado no que o cliente já tem no carrinho.

Regras importantes:
1. Sugira no máximo 5 produtos
2. Priorize produtos que complementam a refeição (ex: bebidas para lanches, sobremesas após pratos principais)
3. NÃO sugira produtos similares ao que já está no carrinho (ex: se já tem hambúrguer, não sugira outro hambúrguer)
4. Pense em combinações naturais: lanche + batata + bebida, pizza + refrigerante, açaí + complementos
5. Considere o valor do pedido - sugira produtos de faixa de preço compatível
6. Retorne APENAS os IDs dos produtos sugeridos, separados por vírgula, sem explicações

Exemplo de resposta correta: id1,id2,id3`;

    const userPrompt = `O cliente tem os seguintes itens no carrinho:
${cartDescription}

Produtos disponíveis para sugestão (que NÃO estão no carrinho):
${productsList}

Quais produtos você sugere? Retorne apenas os IDs separados por vírgula.`;

    console.log("Calling AI for smart suggestions...");
    console.log("Cart items:", cartItems.map(i => i.productName).join(", "));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(
          JSON.stringify({ suggestedIds: [], error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(
          JSON.stringify({ suggestedIds: [], error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ suggestedIds: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";
    
    console.log("AI response:", content);

    // Parse the IDs from the response
    const suggestedIds = content
      .split(',')
      .map((id: string) => id.trim())
      .filter((id: string) => {
        // Validate that the ID exists in available products
        return availableProducts.some(p => p.id === id);
      })
      .slice(0, 5);

    console.log("Suggested product IDs:", suggestedIds);

    return new Response(
      JSON.stringify({ suggestedIds }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in smart-suggestions:", error);
    return new Response(
      JSON.stringify({ suggestedIds: [], error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
