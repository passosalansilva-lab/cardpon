import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from 'https://esm.sh/@react-email/components@0.0.22'
import * as React from 'https://esm.sh/react@18.3.1'

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  options?: { name: string }[];
  notes?: string;
}

interface OrderConfirmationEmailProps {
  orderNumber: string;
  customerName: string;
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

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const getPaymentMethodLabel = (method: string) => {
  const labels: Record<string, string> = {
    cash: 'Dinheiro',
    card_on_delivery: 'Cartão na entrega',
    pix: 'PIX',
    online: 'Pagamento online',
  };
  return labels[method] || method;
};

export const OrderConfirmationEmail = ({
  orderNumber,
  customerName,
  items,
  subtotal,
  deliveryFee,
  discount = 0,
  total,
  paymentMethod,
  deliveryAddress,
  companyName,
  companyPhone,
  trackingUrl,
  estimatedDeliveryTime,
}: OrderConfirmationEmailProps) => (
  <Html>
    <Head />
    <Preview>Pedido #{orderNumber} confirmado - {companyName}</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header */}
        <Section style={header}>
          <Heading style={h1}>✅ Pedido Confirmado!</Heading>
          <Text style={orderNumberText}>Pedido #{orderNumber}</Text>
        </Section>

        {/* Greeting */}
        <Text style={paragraph}>
          Olá <strong>{customerName}</strong>,
        </Text>
        <Text style={paragraph}>
          Seu pedido foi confirmado com sucesso! {companyName} já está preparando tudo com muito carinho.
        </Text>

        {estimatedDeliveryTime && (
          <Section style={estimatedTimeBox}>
            <Text style={estimatedTimeText}>
              🕒 <strong>Previsão de entrega:</strong> {estimatedDeliveryTime}
            </Text>
          </Section>
        )}

        <Hr style={hr} />

        {/* Order Items */}
        <Section>
          <Heading style={h2}>📦 Itens do Pedido</Heading>
          {items.map((item, index) => (
            <Section key={index} style={itemContainer}>
              <Text style={itemHeader}>
                <strong>{item.quantity}x {item.product_name}</strong>
                <span style={itemPrice}>{formatCurrency(item.total_price)}</span>
              </Text>
              {item.options && item.options.length > 0 && (
                <Text style={itemOptions}>
                  + {item.options.map(opt => opt.name).join(', ')}
                </Text>
              )}
              {item.notes && (
                <Text style={itemNotes}>
                  💬 Obs: {item.notes}
                </Text>
              )}
            </Section>
          ))}
        </Section>

        <Hr style={hr} />

        {/* Order Summary */}
        <Section>
          <Heading style={h2}>💰 Resumo do Pedido</Heading>
          
          <Section style={summaryRow}>
            <Text style={summaryLabel}>Subtotal:</Text>
            <Text style={summaryValue}>{formatCurrency(subtotal)}</Text>
          </Section>
          
          <Section style={summaryRow}>
            <Text style={summaryLabel}>Taxa de entrega:</Text>
            <Text style={summaryValue}>{formatCurrency(deliveryFee)}</Text>
          </Section>
          
          {discount > 0 && (
            <Section style={summaryRow}>
              <Text style={summaryLabelDiscount}>Desconto:</Text>
              <Text style={summaryValueDiscount}>-{formatCurrency(discount)}</Text>
            </Section>
          )}
          
          <Hr style={hrThin} />
          
          <Section style={summaryRow}>
            <Text style={totalLabel}>TOTAL:</Text>
            <Text style={totalValue}>{formatCurrency(total)}</Text>
          </Section>
        </Section>

        <Hr style={hr} />

        {/* Payment & Delivery Info */}
        <Section>
          <Heading style={h2}>💳 Forma de Pagamento</Heading>
          <Text style={infoText}>{getPaymentMethodLabel(paymentMethod)}</Text>
        </Section>

        <Section style={{ marginTop: '20px' }}>
          <Heading style={h2}>📍 Endereço de Entrega</Heading>
          <Text style={infoText}>
            {deliveryAddress.street}, {deliveryAddress.number}<br />
            {deliveryAddress.neighborhood}<br />
            {deliveryAddress.city}
            {deliveryAddress.complement && (
              <>
                <br />
                {deliveryAddress.complement}
              </>
            )}
          </Text>
        </Section>

        <Hr style={hr} />

        {/* Tracking Button */}
        <Section style={buttonContainer}>
          <Link href={trackingUrl} style={button}>
            🚚 Acompanhar Pedido
          </Link>
        </Section>

        {/* Company Info */}
        {companyPhone && (
          <Section style={companyInfoBox}>
            <Text style={companyInfoText}>
              📞 Dúvidas? Entre em contato: <strong>{companyPhone}</strong>
            </Text>
          </Section>
        )}

        {/* Footer */}
        <Section style={footer}>
          <Text style={footerText}>
            Este email foi enviado automaticamente por {companyName}.<br />
            Você está recebendo porque fez um pedido conosco.
          </Text>
          <Text style={footerTextSmall}>
            Pedido #{orderNumber} • {companyName}
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default OrderConfirmationEmail

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0',
  marginBottom: '64px',
  maxWidth: '600px',
}

const header = {
  padding: '32px 24px',
  textAlign: 'center' as const,
  backgroundColor: '#10B981',
  borderRadius: '12px 12px 0 0',
}

const h1 = {
  color: '#ffffff',
  fontSize: '32px',
  fontWeight: '700',
  margin: '0 0 8px',
  padding: '0',
  lineHeight: '1.3',
}

const orderNumberText = {
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: '500',
  margin: '0',
  opacity: '0.9',
}

const h2 = {
  color: '#1f2937',
  fontSize: '20px',
  fontWeight: '600',
  margin: '0 0 16px',
  padding: '0 24px',
}

const paragraph = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '16px 0',
  padding: '0 24px',
}

const estimatedTimeBox = {
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 24px',
}

const estimatedTimeText = {
  color: '#92400e',
  fontSize: '16px',
  margin: '0',
  textAlign: 'center' as const,
}

const hr = {
  borderColor: '#e5e7eb',
  margin: '24px 0',
}

const hrThin = {
  borderColor: '#e5e7eb',
  margin: '12px 0',
}

const itemContainer = {
  padding: '12px 24px',
  marginBottom: '8px',
}

const itemHeader = {
  color: '#1f2937',
  fontSize: '15px',
  fontWeight: '500',
  margin: '0 0 4px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const itemPrice = {
  color: '#10B981',
  fontWeight: '600',
  marginLeft: 'auto',
}

const itemOptions = {
  color: '#6b7280',
  fontSize: '13px',
  margin: '4px 0 0',
  fontStyle: 'italic' as const,
}

const itemNotes = {
  color: '#9ca3af',
  fontSize: '13px',
  margin: '4px 0 0',
  fontStyle: 'italic' as const,
}

const summaryRow = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 24px',
}

const summaryLabel = {
  color: '#6b7280',
  fontSize: '15px',
  margin: '0',
}

const summaryValue = {
  color: '#374151',
  fontSize: '15px',
  fontWeight: '500',
  margin: '0',
}

const summaryLabelDiscount = {
  ...summaryLabel,
  color: '#10B981',
}

const summaryValueDiscount = {
  ...summaryValue,
  color: '#10B981',
}

const totalLabel = {
  color: '#1f2937',
  fontSize: '18px',
  fontWeight: '700',
  margin: '0',
}

const totalValue = {
  color: '#10B981',
  fontSize: '20px',
  fontWeight: '700',
  margin: '0',
}

const infoText = {
  color: '#374151',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0',
  padding: '0 24px',
}

const buttonContainer = {
  padding: '32px 24px',
  textAlign: 'center' as const,
}

const button = {
  backgroundColor: '#10B981',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
}

const companyInfoBox = {
  backgroundColor: '#f3f4f6',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 24px',
}

const companyInfoText = {
  color: '#374151',
  fontSize: '14px',
  margin: '0',
  textAlign: 'center' as const,
}

const footer = {
  padding: '24px',
  textAlign: 'center' as const,
}

const footerText = {
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '1.6',
  margin: '0 0 8px',
}

const footerTextSmall = {
  color: '#9ca3af',
  fontSize: '11px',
  margin: '0',
}
