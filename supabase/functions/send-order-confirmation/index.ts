import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import React from 'https://esm.sh/react@18.3.1';
import { Resend } from 'https://esm.sh/resend@4.0.0';
import { renderAsync } from 'https://esm.sh/@react-email/components@0.0.22';
import { OrderConfirmationEmail } from './_templates/order-confirmation.tsx';

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  options?: { name: string }[];
  notes?: string;
}

interface OrderConfirmationRequest {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount?: number;
  total: number;
  paymentMethod: string;
  deliveryAddress: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    complement?: string;
  };
  companyName: string;
  companyPhone?: string;
  trackingUrl: string;
  estimatedDeliveryTime?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: OrderConfirmationRequest = await req.json();

    console.log(`Sending order confirmation email to: ${data.customerEmail}`);
    console.log(`Order #${data.orderNumber} for ${data.companyName}`);

    // Render the React Email template
    const html = await renderAsync(
      React.createElement(OrderConfirmationEmail, {
        orderNumber: data.orderNumber,
        customerName: data.customerName,
        items: data.items,
        subtotal: data.subtotal,
        deliveryFee: data.deliveryFee,
        discount: data.discount,
        total: data.total,
        paymentMethod: data.paymentMethod,
        deliveryAddress: data.deliveryAddress,
        companyName: data.companyName,
        companyPhone: data.companyPhone,
        trackingUrl: data.trackingUrl,
        estimatedDeliveryTime: data.estimatedDeliveryTime,
      })
    );

    // Send email via Resend
    const { data: emailData, error } = await resend.emails.send({
      from: `${data.companyName} <onboarding@resend.dev>`,
      to: [data.customerEmail],
      subject: `✅ Pedido #${data.orderNumber} confirmado - ${data.companyName}`,
      html,
    });

    if (error) {
      console.error("Resend API error:", error);
      throw new Error(`Failed to send email: ${JSON.stringify(error)}`);
    }

    console.log("Email sent successfully:", emailData);

    return new Response(
      JSON.stringify({ success: true, emailId: emailData?.id }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error sending order confirmation email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
