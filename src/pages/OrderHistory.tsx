import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search,
  Loader2,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  ChefHat,
  Mail,
  ArrowLeft,
  MapPin,
  Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const searchSchema = z.object({
  email: z.string().email('Email inválido'),
});

type SearchFormData = z.infer<typeof searchSchema>;

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  options: any[];
}

interface Order {
  id: string;
  created_at: string;
  status: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number | null;
  total: number;
  customer_name: string;
  notes: string | null;
  company: {
    name: string;
    logo_url: string | null;
  };
  delivery_address: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
  } | null;
  order_items: OrderItem[];
}

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: 'Pendente', icon: Clock, color: 'bg-yellow-500' },
  confirmed: { label: 'Confirmado', icon: CheckCircle, color: 'bg-blue-500' },
  preparing: { label: 'Preparando', icon: ChefHat, color: 'bg-orange-500' },
  ready: { label: 'Pronto', icon: Package, color: 'bg-purple-500' },
  out_for_delivery: { label: 'Saiu para entrega', icon: Truck, color: 'bg-indigo-500' },
  delivered: { label: 'Entregue', icon: CheckCircle, color: 'bg-green-500' },
  cancelled: { label: 'Cancelado', icon: XCircle, color: 'bg-red-500' },
};

const paymentMethodLabels: Record<string, string> = {
  pix: 'PIX',
  cash: 'Dinheiro',
  card_on_delivery: 'Cartão na entrega',
  online: 'Cartão online',
};

export default function OrderHistory() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searched, setSearched] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SearchFormData>({
    resolver: zodResolver(searchSchema),
  });

  const onSubmit = async (data: SearchFormData) => {
    setLoading(true);
    setSearched(true);
    setCustomerEmail(data.email);

    try {
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          status,
          payment_method,
          payment_status,
          subtotal,
          delivery_fee,
          discount_amount,
          total,
          customer_name,
          notes,
          company:companies(name, logo_url),
          delivery_address:customer_addresses(street, number, neighborhood, city, state),
          order_items(id, product_name, quantity, unit_price, total_price, options)
        `)
        .eq('customer_email', data.email.toLowerCase().trim())
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform the data to handle the nested company object
      const transformedOrders = (ordersData || []).map(order => ({
        ...order,
        company: Array.isArray(order.company) ? order.company[0] : order.company,
        delivery_address: Array.isArray(order.delivery_address) ? order.delivery_address[0] : order.delivery_address,
      })) as Order[];
      
      setOrders(transformedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    return statusConfig[status] || statusConfig.pending;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-display font-bold">Meus Pedidos</h1>
        </div>
      </header>

      <div className="container py-8 max-w-3xl">
        {/* Search Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Buscar Pedidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="flex gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="email" className="sr-only">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Digite seu email para ver seus pedidos"
                    className="pl-10"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">Buscar</span>
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        {searched && !loading && (
          <>
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Nenhum pedido encontrado</h2>
                <p className="text-muted-foreground">
                  Não encontramos pedidos associados ao email {customerEmail}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {orders.length} pedido{orders.length !== 1 ? 's' : ''} encontrado{orders.length !== 1 ? 's' : ''} para {customerEmail}
                </p>

                {orders.map((order) => {
                  const statusInfo = getStatusInfo(order.status);
                  const StatusIcon = statusInfo.icon;

                  return (
                    <Card key={order.id} className="overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            {order.company?.logo_url ? (
                              <img
                                src={order.company.logo_url}
                                alt={order.company.name}
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Package className="h-5 w-5 text-primary" />
                              </div>
                            )}
                            <div>
                              <h3 className="font-semibold">{order.company?.name || 'Loja'}</h3>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(order.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          <Badge className={`${statusInfo.color} text-white gap-1`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0 space-y-4">
                        {/* Order Items */}
                        <div className="space-y-2">
                          {order.order_items.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span>
                                {item.quantity}x {item.product_name}
                              </span>
                              <span className="text-muted-foreground">
                                R$ {item.total_price.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <Separator />

                        {/* Order Summary */}
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span>R$ {order.subtotal.toFixed(2)}</span>
                          </div>
                          {(order.discount_amount || 0) > 0 && (
                            <div className="flex justify-between text-green-600">
                              <span>Desconto</span>
                              <span>-R$ {order.discount_amount?.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Entrega</span>
                            <span>R$ {order.delivery_fee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-semibold pt-1">
                            <span>Total</span>
                            <span className="text-primary">R$ {order.total.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Address & Payment */}
                        <div className="grid gap-3 sm:grid-cols-2 text-sm">
                          {order.delivery_address && (
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <span className="text-muted-foreground">
                                {order.delivery_address.street}, {order.delivery_address.number} - {order.delivery_address.neighborhood}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground">
                              {paymentMethodLabels[order.payment_method] || order.payment_method}
                            </span>
                          </div>
                        </div>

                        {order.notes && (
                          <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                            Obs: {order.notes}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Empty State - Before Search */}
        {!searched && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Acompanhe seus pedidos</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Digite o email que você usou nos seus pedidos para ver o histórico e acompanhar o status de cada um.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
