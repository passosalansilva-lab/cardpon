import { useEffect, useRef, useCallback } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  options: unknown;
  notes: string | null;
  requires_preparation?: boolean;
}

interface DeliveryAddress {
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  reference: string | null;
}

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
}

interface Order {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  status: string;
  payment_method: string;
  subtotal: number;
  delivery_fee: number;
  discount_amount?: number | null;
  total: number;
  notes: string | null;
  order_items?: OrderItem[];
  customer_addresses?: DeliveryAddress;
  needs_change?: boolean;
  change_for?: number | null;
  coupons?: Coupon;
}

interface PrintReceiptProps {
  order: Order;
  companyName?: string;
  autoPrintEnabled?: boolean;
  autoPrintMode?: 'kitchen' | 'full' | 'both';
  autoPrintTrigger?: number;
}

const paymentMethodLabels: Record<string, string> = {
  pix: 'PIX',
  cash: 'Dinheiro',
  card_on_delivery: 'Cartão na entrega',
  online: 'Cartão online',
};

export function PrintReceipt({
  order,
  companyName = 'Loja',
  autoPrintEnabled = false,
  autoPrintMode = 'kitchen',
  autoPrintTrigger = 0,
}: PrintReceiptProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const kitchenPrintRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Cria ou reutiliza iframe invisível para impressão
  const getOrCreateIframe = useCallback(() => {
    if (iframeRef.current) {
      return iframeRef.current;
    }
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
    iframeRef.current = iframe;
    return iframe;
  }, []);

  // Cleanup iframe ao desmontar
  useEffect(() => {
    return () => {
      if (iframeRef.current) {
        document.body.removeChild(iframeRef.current);
        iframeRef.current = null;
      }
    };
  }, []);

  const handlePrint = useCallback((isKitchen: boolean = false) => {
    const printContent = isKitchen ? kitchenPrintRef.current : printRef.current;
    if (!printContent) return;

    const html = printContent.innerHTML;

    const styles = `
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          width: 80mm;
          padding: 5mm;
          line-height: 1.4;
        }
        .header {
          text-align: center;
          border-bottom: 1px dashed #000;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }
        .company-name {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 4px;
        }
        .order-number {
          font-size: 14px;
          font-weight: bold;
        }
        .kitchen-title {
          font-size: 18px;
          font-weight: bold;
          text-transform: uppercase;
          background: #000;
          color: #fff;
          padding: 4px 8px;
          margin-bottom: 4px;
        }
        .date {
          font-size: 10px;
          color: #666;
        }
        .section {
          margin: 8px 0;
          padding: 8px 0;
          border-bottom: 1px dashed #000;
        }
        .section-title {
          font-weight: bold;
          margin-bottom: 4px;
          text-transform: uppercase;
          font-size: 11px;
        }
        .customer-info p {
          margin: 2px 0;
        }
        .address p {
          margin: 2px 0;
        }
        .item {
          display: flex;
          justify-content: space-between;
          margin: 6px 0;
          flex-wrap: wrap;
        }
        .item-kitchen {
          margin: 10px 0;
          padding: 8px;
          border: 1px solid #000;
        }
        .item-name {
          flex: 1;
          font-weight: bold;
        }
        .item-name-kitchen {
          font-weight: bold;
          font-size: 14px;
        }
        .item-qty {
          margin-right: 8px;
        }
        .item-qty-kitchen {
          font-size: 16px;
          font-weight: bold;
          background: #000;
          color: #fff;
          padding: 2px 8px;
          display: inline-block;
          margin-bottom: 4px;
        }
        .item-price {
          text-align: right;
        }
        .item-options {
          width: 100%;
          font-size: 10px;
          color: #666;
          margin-left: 16px;
        }
        .item-options-kitchen {
          font-size: 12px;
          margin-top: 4px;
          padding-left: 8px;
          border-left: 2px solid #000;
        }
        .item-notes {
          width: 100%;
          font-size: 10px;
          font-style: italic;
          margin-left: 16px;
          color: #333;
        }
        .item-notes-kitchen {
          font-size: 12px;
          font-weight: bold;
          margin-top: 6px;
          padding: 4px;
          background: #fff3cd;
          border: 1px solid #ffc107;
        }
        .totals {
          margin-top: 8px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
        }
        .grand-total {
          font-weight: bold;
          font-size: 14px;
          border-top: 1px solid #000;
          padding-top: 6px;
          margin-top: 6px;
        }
        .payment {
          text-align: center;
          margin-top: 8px;
          padding: 8px;
          background: #f0f0f0;
        }
        .payment-method {
          font-weight: bold;
        }
        .notes {
          margin-top: 8px;
          padding: 8px;
          background: #fff3cd;
          border: 1px solid #ffc107;
        }
        .notes-kitchen {
          margin-top: 12px;
          padding: 10px;
          background: #fff3cd;
          border: 2px solid #ffc107;
          font-size: 12px;
        }
        .notes-title {
          font-weight: bold;
          margin-bottom: 4px;
        }
        .footer {
          text-align: center;
          margin-top: 12px;
          font-size: 10px;
          color: #666;
        }
        .divider {
          border-bottom: 1px dashed #000;
          margin: 8px 0;
        }
        .change-info {
          background: #d4edda;
          padding: 6px;
          margin-top: 6px;
          text-align: center;
          font-weight: bold;
        }
      </style>
    `;

    const iframe = getOrCreateIframe();
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${isKitchen ? 'Cozinha' : 'Comanda'} #${order.id.slice(0, 8)}</title>
          ${styles}
        </head>
        <body>
          ${html}
        </body>
      </html>
    `);
    doc.close();

    // Aguarda o carregamento do conteúdo e dispara a impressão
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 150);
  }, [order.id, getOrCreateIframe]);

  useEffect(() => {
    if (autoPrintEnabled && order.status === 'confirmed') {
      if (autoPrintMode === 'kitchen') {
        handlePrint(true);
      } else if (autoPrintMode === 'full') {
        handlePrint(false);
      } else if (autoPrintMode === 'both') {
        handlePrint(false);
        handlePrint(true);
      }
    }
  }, [autoPrintEnabled, autoPrintMode, autoPrintTrigger, order.status, handlePrint]);

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePrint(false)}
          className="gap-2"
        >
          <Printer className="h-4 w-4" />
          Comanda
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePrint(true)}
          className="gap-2"
        >
          <Printer className="h-4 w-4" />
          Cozinha
        </Button>
      </div>

      {/* Hidden print content - Full Receipt */}
      <div className="hidden">
        <div ref={printRef}>
          {/* Header */}
          <div className="header">
            <div className="company-name">{companyName}</div>
            <div className="order-number">PEDIDO #{order.id.slice(0, 8).toUpperCase()}</div>
            <div className="date">
              {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          </div>

          {/* Customer */}
          <div className="section customer-info">
            <div className="section-title">Cliente</div>
            <p><strong>{order.customer_name}</strong></p>
            <p>Tel: {order.customer_phone}</p>
            {order.customer_email && <p>{order.customer_email}</p>}
          </div>

          {/* Address */}
          {order.customer_addresses && (
            <div className="section address">
              <div className="section-title">Endereço de Entrega</div>
              <p>
                {order.customer_addresses.street}, {order.customer_addresses.number}
                {order.customer_addresses.complement && ` - ${order.customer_addresses.complement}`}
              </p>
              <p>{order.customer_addresses.neighborhood}</p>
              <p>{order.customer_addresses.city}/{order.customer_addresses.state}</p>
              <p>CEP: {order.customer_addresses.zip_code}</p>
              {order.customer_addresses.reference && (
                <p><em>Ref: {order.customer_addresses.reference}</em></p>
              )}
            </div>
          )}

          {/* Items */}
          <div className="section">
            <div className="section-title">Itens do Pedido</div>
            {order.order_items?.map((item) => {
              const options = Array.isArray(item.options) 
                ? (item.options as { name: string; priceModifier: number }[]) 
                : [];
              return (
                <div key={item.id} className="item">
                  <span className="item-qty">{item.quantity}x</span>
                  <span className="item-name">{item.product_name}</span>
                  <span className="item-price">R$ {Number(item.total_price).toFixed(2)}</span>
                  {options.length > 0 && (
                    <div className="item-options">
                      + {options.map((o) => o.name).join(', ')}
                    </div>
                  )}
                  {item.notes && (
                    <div className="item-notes">Obs: {item.notes}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="totals">
            <div className="total-row">
              <span>Subtotal:</span>
              <span>R$ {Number(order.subtotal).toFixed(2)}</span>
            </div>
            {(order.discount_amount ?? 0) > 0 && (
              <div className="total-row" style={{ color: '#16a34a' }}>
                <span>Desconto{order.coupons?.code ? ` (${order.coupons.code})` : ''}:</span>
                <span>-R$ {Number(order.discount_amount).toFixed(2)}</span>
              </div>
            )}
            <div className="total-row">
              <span>Taxa de entrega:</span>
              <span>R$ {Number(order.delivery_fee).toFixed(2)}</span>
            </div>
            <div className="total-row grand-total">
              <span>TOTAL:</span>
              <span>R$ {Number(order.total).toFixed(2)}</span>
            </div>
            {order.order_items && order.order_items.some((item) =>
              item.product_name.toLowerCase().includes('meio a meio')
            ) && (
              <div className="total-row" style={{ fontSize: '10px', marginTop: '4px', color: '#555' }}>
                <span>Regra pizza meio a meio:</span>
                <span>preço é a média dos sabores, nunca apenas o mais caro.</span>
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="payment">
            <div className="payment-method">
              {paymentMethodLabels[order.payment_method] || order.payment_method}
            </div>
            {order.payment_method === 'cash' && order.needs_change && order.change_for && (
              <div className="change-info">
                TROCO PARA: R$ {Number(order.change_for).toFixed(2)}
                <br />
                TROCO: R$ {(Number(order.change_for) - Number(order.total)).toFixed(2)}
              </div>
            )}
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="notes">
              <div className="notes-title">OBSERVAÇÕES:</div>
              <p>{order.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="footer">
            <div className="divider"></div>
            <p>Obrigado pela preferência!</p>
            <p>Volte sempre!</p>
          </div>
        </div>
      </div>

      {/* Hidden print content - Kitchen Receipt */}
      <div className="hidden">
        <div ref={kitchenPrintRef}>
          {/* Header */}
          <div className="header">
            <div className="kitchen-title">🍳 COZINHA</div>
            <div className="order-number">PEDIDO #{order.id.slice(0, 8).toUpperCase()}</div>
            <div className="date">
              {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          </div>

          {/* Customer Name - Highlighted for Kitchen */}
          <div className="section" style={{ textAlign: 'center', background: '#e0f7fa', padding: '10px', border: '2px solid #00acc1' }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>Pedido de</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {order.customer_name}
            </div>
            <div style={{ fontSize: '11px', marginTop: '4px' }}>
              Tel: {order.customer_phone}
            </div>
          </div>

          {/* Order Type Indicator */}
          <div className="section" style={{ textAlign: 'center', padding: '6px' }}>
            {order.customer_addresses ? (
              <div style={{ background: '#fff3e0', padding: '6px', border: '1px solid #ff9800', fontWeight: 'bold' }}>
                🛵 ENTREGA
              </div>
            ) : (
              <div style={{ background: '#e8f5e9', padding: '6px', border: '1px solid #4caf50', fontWeight: 'bold' }}>
                🏪 RETIRADA NO LOCAL
              </div>
            )}
          </div>

          {/* Items - Kitchen Format (only items that require preparation) */}
          <div className="section">
            <div className="section-title" style={{ marginBottom: '8px', fontSize: '12px' }}>ITENS PARA PREPARO</div>
            {(() => {
              const kitchenItems = order.order_items?.filter((item) => item.requires_preparation !== false) || [];
              if (kitchenItems.length === 0) {
                return (
                  <div style={{ padding: '10px', textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
                    Nenhum item para preparo neste pedido
                  </div>
                );
              }
              return kitchenItems.map((item) => {
                const options = Array.isArray(item.options) 
                  ? (item.options as { name: string; priceModifier: number }[]) 
                  : [];
                return (
                  <div key={item.id} className="item-kitchen">
                    <div className="item-qty-kitchen">{item.quantity}x</div>
                    <div className="item-name-kitchen">{item.product_name}</div>
                    {options.length > 0 && (
                      <div className="item-options-kitchen">
                        ➕ {options.map((o) => o.name).join(', ')}
                      </div>
                    )}
                    {item.notes && (
                      <div className="item-notes-kitchen">⚠️ OBS: {item.notes}</div>
                    )}
                  </div>
                );
              });
            })()}
          </div>

          {/* General Notes */}
          {order.notes && (
            <div className="notes-kitchen">
              <div className="notes-title">⚠️ OBSERVAÇÕES DO PEDIDO:</div>
              <p>{order.notes}</p>
            </div>
          )}

          {/* Footer with customer name reminder */}
          <div className="footer" style={{ marginTop: '16px' }}>
            <div className="divider"></div>
            <p style={{ fontSize: '12px', fontWeight: 'bold' }}>
              PEDIDO DE: {order.customer_name.toUpperCase()}
            </p>
            <p>#{order.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
      </div>
    </>
  );
}
