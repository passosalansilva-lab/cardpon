import { describe, it, vi, expect } from 'vitest';
import { render } from '@testing-library/react';
import { screen, waitFor, fireEvent } from '@testing-library/dom';
import OrdersManagement from '@/pages/store/OrdersManagement';

// Mocks das dependências externas usadas na página
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } }),
}));

const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

const logActivityMock = vi.fn();
vi.mock('@/hooks/useActivityLog', () => ({
  useActivityLog: () => ({ logActivity: logActivityMock }),
}));

vi.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => ({ status: 'active' }),
}));

const ordersMock = [
  {
    id: 'order-pending',
    created_at: new Date().toISOString(),
    customer_name: 'Cliente Pendente',
    customer_phone: '11999999999',
    customer_email: null,
    status: 'pending',
    payment_method: 'cash',
    payment_status: 'pending',
    subtotal: 50,
    delivery_fee: 5,
    total: 55,
    notes: null,
    delivery_driver_id: null,
    order_items: [{ id: 'item1', product_name: 'Pizza', quantity: 1, unit_price: 50, total_price: 50, options: [], notes: null }],
    customer_addresses: null,
  },
  {
    id: 'order-delivered',
    created_at: new Date().toISOString(),
    customer_name: 'Cliente Entregue',
    customer_phone: '11999999998',
    customer_email: null,
    status: 'delivered',
    payment_method: 'cash',
    payment_status: 'paid',
    subtotal: 30,
    delivery_fee: 0,
    total: 30,
    notes: null,
    delivery_driver_id: null,
    order_items: [],
    customer_addresses: null,
  },
  {
    id: 'order-cancelled',
    created_at: new Date().toISOString(),
    customer_name: 'Cliente Cancelado',
    customer_phone: '11999999997',
    customer_email: null,
    status: 'cancelled',
    payment_method: 'cash',
    payment_status: 'failed',
    subtotal: 40,
    delivery_fee: 0,
    total: 40,
    notes: null,
    delivery_driver_id: null,
    order_items: [],
    customer_addresses: null,
  },
];

let lastUpdatePayload: any = null;

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'companies') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    id: 'company-1',
                    name: 'Loja Teste',
                    slug: 'loja-teste',
                    auto_print_kitchen: false,
                    auto_print_mode: 'kitchen',
                  },
                  error: null,
                }),
            }),
          }),
        } as any;
      }

      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: ordersMock, error: null }),
            }),
          }),
          update: (payload: any) => {
            lastUpdatePayload = payload;
            return {
              eq: () => Promise.resolve({ error: null }),
            } as any;
          },
        } as any;
      }

      if (table === 'delivery_drivers') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
            }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        } as any;
      }

      if (table === 'order_items') {
        return {
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        } as any;
      }

      return {
        select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
      } as any;
    },
    functions: {
      invoke: () => Promise.resolve({ data: { success: true }, error: null }),
    },
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
    removeChannel: () => {},
  },
}));

// Mock do layout para não depender de roteamento real
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mocks de notificações para não fazer chamadas reais
vi.mock('@/hooks/useOrderNotifications', () => ({
  notifyOrderStatusChange: () => Promise.resolve(),
  notifyDriverNewOrder: () => Promise.resolve(),
}));


describe('OrdersManagement page', () => {
  it('renders and mostra contagens corretas por status', async () => {
    render(<OrdersManagement />);

    // Espera carregar título da página
    await screen.findByText('Pedidos');

    // Aba Ativos deve contar apenas pendentes/não entregues/cancelados
    expect(
      screen.getByText(/Ativos/i).textContent,
    ).toContain('1');

    // Entregues
    expect(
      screen.getByText(/Entregues/i).textContent,
    ).toContain('1');

    // Cancelados
    expect(
      screen.getByText(/Cancelados/i).textContent,
    ).toContain('1');
  });

  it('avança status do pedido pendente para confirmado', async () => {
    render(<OrdersManagement />);

    await screen.findByText('Pedidos');

    // Abre o modal clicando no cartão do pedido pendente
    const card = await screen.findByText('Cliente Pendente');
    fireEvent.click(card);

    // Botão "Avançar para" deve aparecer e, ao clicar, atualizar status
    const advanceButton = await screen.findByRole('button', { name: /Avançar para/i });
    fireEvent.click(advanceButton);

    await waitFor(() => {
      expect(lastUpdatePayload).toEqual({ status: 'confirmed' });
    });
  });

  it('mostra toast de erro quando atualização falha', async () => {
    // Força erro na próxima chamada de update
    lastUpdatePayload = null;

    // Substitui implementação de update para retornar erro
    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any) = (table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({ order: () => Promise.resolve({ data: ordersMock, error: null }) }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: { message: 'Erro de teste' } }),
          }),
        } as any;
      }
      return {
        select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
      } as any;
    };

    render(<OrdersManagement />);

    await screen.findByText('Pedidos');

    const card = await screen.findByText('Cliente Pendente');
    fireEvent.click(card);

    const advanceButton = await screen.findByRole('button', { name: /Avançar para/i });
    fireEvent.click(advanceButton);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Erro ao atualizar',
          variant: 'destructive',
        }),
      );
    });
  });
});

