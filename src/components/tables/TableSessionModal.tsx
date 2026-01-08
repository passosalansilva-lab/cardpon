import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Loader2,
  Receipt,
  Clock,
  Users,
  Check,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  DollarSign,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { POSProductModal, SelectedOption } from '@/components/pos/POSProductModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface TableSession {
  id: string;
  table_id: string;
  customer_name: string | null;
  customer_count: number;
  opened_at: string;
  status: string;
  notes: string | null;
}

interface Table {
  id: string;
  table_number: number;
  name: string | null;
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  options: any;
  created_at: string;
  order_id: string;
}

interface Order {
  id: string;
  total: number;
  status: string;
  created_at: string;
  payment_method: string;
  payment_status: string;
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  category_id: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
  notes: string;
  options: SelectedOption[];
  calculatedPrice: number;
}

interface TableSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: Table | null;
  session: TableSession | null;
  companyId: string;
  onUpdate: () => void;
}

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Dinheiro', icon: Banknote },
  { id: 'pix', label: 'PIX', icon: Smartphone },
  { id: 'credit_card', label: 'Cartão de Crédito', icon: CreditCard },
  { id: 'debit_card', label: 'Cartão de Débito', icon: Wallet },
];

export function TableSessionModal({
  open,
  onOpenChange,
  table,
  session,
  companyId,
  onUpdate,
}: TableSessionModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'items' | 'add'>('items');

  // Session data
  const [orders, setOrders] = useState<Order[]>([]);
  const [allItems, setAllItems] = useState<OrderItem[]>([]);

  // Add items
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Product modal for options
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);

  // Payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('cash');
  const [closingSession, setClosingSession] = useState(false);

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const loadSessionData = useCallback(async () => {
    if (!session) return;
    setLoading(true);

    try {
      // Load orders for this session (ignore cancelled)
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, total, status, created_at, payment_method, payment_status')
        .eq('table_session_id', session.id)
        .neq('status', 'cancelled')
        .order('created_at');

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);

      // Load all items from all orders
      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map((o) => o.id);
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds)
          .order('created_at');

        if (itemsError) throw itemsError;
        setAllItems(itemsData || []);
      } else {
        setAllItems([]);
      }
    } catch (error: any) {
      console.error('Error loading session data:', error);
      toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [session, toast]);

  const loadProducts = useCallback(async () => {
    if (!companyId) return;

    try {
      // Load categories
      const { data: catData } = await supabase
        .from('categories')
        .select('id, name, sort_order')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('sort_order');

      setCategories(catData || []);
      if (catData && catData.length > 0 && !selectedCategory) {
        setSelectedCategory(catData[0].id);
      }

      // Load products
      const { data: prodData } = await supabase
        .from('products')
        .select('id, name, description, price, image_url, is_active, category_id, requires_preparation')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');

      setProducts(prodData || []);
    } catch (error: any) {
      console.error('Error loading products:', error);
    }
  }, [companyId, selectedCategory]);

  useEffect(() => {
    if (open && session) {
      loadSessionData();
      loadProducts();
      setCart([]);
      setActiveTab('items');
    }
  }, [open, session, loadSessionData, loadProducts]);

  // Realtime subscription for orders on this session
  useEffect(() => {
    if (!open || !session) return;

    const channel = supabase
      .channel(`session-orders-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `table_session_id=eq.${session.id}`
        },
        (payload) => {
          console.log('[TableSessionModal] Order changed:', payload);
          loadSessionData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, session, loadSessionData]);

  const totalSession = allItems.reduce((sum, item) => sum + item.total_price, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.calculatedPrice * item.quantity, 0);

  const filteredProducts = products.filter((p) => {
    const matchesCategory = !selectedCategory || p.category_id === selectedCategory;
    const matchesSearch =
      !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setProductModalOpen(true);
  };

  const handleAddToCart = (
    product: Product,
    quantity: number,
    options: SelectedOption[],
    notes: string,
    calculatedPrice: number
  ) => {
    setCart((prev) => [
      ...prev,
      { product, quantity, notes, options, calculatedPrice },
    ]);
    setProductModalOpen(false);
    setSelectedProduct(null);
  };

  const updateCartQuantity = (index: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((c, i) =>
          i === index ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddItems = async () => {
    if (!session || !companyId || cart.length === 0) return;

    setSubmitting(true);
    try {
      const subtotal = cartTotal;
      const total = subtotal;

      // Check if ALL items don't require preparation (e.g., sodas, industrialized products)
      const allItemsNoPreparation = cart.every(
        (c) => (c.product as any).requires_preparation === false
      );

      // If all items don't need preparation, go directly to 'ready' (served)
      // Otherwise, go to 'confirmed' to enter preparation flow
      const orderStatus = allItemsNoPreparation ? 'ready' : 'confirmed';

      // Create order for table (source: 'table' to differentiate from 'pos' or 'online')
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          company_id: companyId,
          table_session_id: session.id,
          customer_name: session.customer_name || 'Cliente',
          customer_phone: '00000000000',
          payment_method: 'cash' as any,
          payment_status: 'pending' as any,
          status: orderStatus as any,
          subtotal,
          delivery_fee: 0,
          total,
          source: 'table', // Different source for table orders
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

      // Create order items with options
      const items = cart.map((c) => ({
        order_id: order.id,
        product_id: c.product.id,
        product_name: c.product.name,
        quantity: c.quantity,
        unit_price: c.calculatedPrice,
        total_price: c.calculatedPrice * c.quantity,
        notes: c.notes || null,
        options: c.options.length > 0 
          ? JSON.parse(JSON.stringify(c.options)) 
          : null,
        requires_preparation: (c.product as any).requires_preparation !== false,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(items);
      if (itemsError) throw itemsError;

      // Update table status to occupied if not already
      await supabase
        .from('tables')
        .update({ status: 'occupied' })
        .eq('id', session.table_id);

      toast({ title: 'Itens adicionados!' });
      setCart([]);
      setActiveTab('items');
      loadSessionData();
      onUpdate();
    } catch (error: any) {
      console.error('Error adding items:', error);
      toast({ title: 'Erro ao adicionar itens', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPaymentDialog = () => {
    if (allItems.length === 0) {
      toast({ title: 'Nenhum item na mesa', variant: 'destructive' });
      return;
    }
    setPaymentDialogOpen(true);
  };

  const handleCloseSession = async () => {
    if (!session || !companyId) return;

    setClosingSession(true);
    try {
      // Update all orders in this session with the payment method and status
      const orderIds = orders.map((o) => o.id);
      
      for (const orderId of orderIds) {
        await supabase
          .from('orders')
          .update({
            payment_method: selectedPaymentMethod as any,
            payment_status: 'paid' as any,
            status: 'delivered' as any,
          })
          .eq('id', orderId);
      }

      // Close the session and clear customer data
      await supabase
        .from('table_sessions')
        .update({ 
          status: 'closed', 
          closed_at: new Date().toISOString(),
          customer_name: null,
          customer_phone: null,
          customer_count: null,
        })
        .eq('id', session.id);

      // Cancel all pending waiter calls for this table
      await supabase
        .from('waiter_calls')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('table_id', session.table_id)
        .in('status', ['pending', 'acknowledged']);

      // Free the table
      await supabase
        .from('tables')
        .update({ status: 'available' })
        .eq('id', session.table_id);

      toast({ title: 'Conta fechada com sucesso!' });
      setPaymentDialogOpen(false);
      onOpenChange(false);
      onUpdate();
    } catch (error: any) {
      console.error('Error closing session:', error);
      toast({ title: 'Erro ao fechar conta', description: error.message, variant: 'destructive' });
    } finally {
      setClosingSession(false);
    }
  };

  // Parse options to display
  const formatItemOptions = (options: any): string => {
    if (!options) return '';
    if (Array.isArray(options)) {
      return options.map((opt: any) => opt.name).join(', ');
    }
    return '';
  };

  if (!table || !session) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 flex flex-col">
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-xl">
                  Mesa {table.table_number}
                  {table.name && <span className="text-muted-foreground font-normal ml-2">({table.name})</span>}
                </SheetTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                  {session.customer_name && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {session.customer_name}
                    </span>
                  )}
                  {session.customer_count > 0 && (
                    <span className="text-xs">({session.customer_count} pessoas)</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(session.opened_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">{formatCurrency(totalSession)}</div>
                <div className="text-sm text-muted-foreground">{allItems.length} itens</div>
              </div>
            </div>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-4 mt-2">
              <TabsTrigger value="items" className="flex-1">
                <Receipt className="h-4 w-4 mr-2" />
                Conta ({allItems.length})
              </TabsTrigger>
              <TabsTrigger value="add" className="flex-1">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
                {cart.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{cart.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="flex-1 overflow-hidden m-0 flex flex-col">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : allItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum item pedido ainda</p>
                  <Button className="mt-4" onClick={() => setActiveTab('add')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar primeiro item
                  </Button>
                </div>
              ) : (
                <>
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-2">
                      {allItems.map((item) => (
                        <Card key={item.id} className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="shrink-0">
                                  {item.quantity}x
                                </Badge>
                                <span className="font-medium">{item.product_name}</span>
                              </div>
                              {/* Show options */}
                              {item.options && (
                                <p className="text-xs text-primary mt-1">
                                  {formatItemOptions(item.options)}
                                </p>
                              )}
                              {item.notes && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Obs: {item.notes}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-semibold">{formatCurrency(item.total_price)}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatCurrency(item.unit_price)} un.
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Session summary and payment */}
                  <div className="p-4 border-t bg-muted/30 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Cliente:</span>
                      <span className="font-medium">{session.customer_name || 'Não identificado'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Pessoas:</span>
                      <span className="font-medium">{session.customer_count || 1}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center text-lg">
                      <span className="font-semibold">Total da Mesa:</span>
                      <span className="font-bold text-primary">{formatCurrency(totalSession)}</span>
                    </div>
                    <Button 
                      className="w-full" 
                      size="lg" 
                      onClick={handleOpenPaymentDialog}
                      disabled={allItems.length === 0}
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Fechar Conta
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="add" className="flex-1 overflow-hidden m-0 flex flex-col">
              <div className="p-4 border-b space-y-3">
                <Input
                  placeholder="Buscar produto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <ScrollArea className="w-full">
                  <div className="flex gap-2 pb-2">
                    {categories.map((cat) => (
                      <Button
                        key={cat.id}
                        variant={selectedCategory === cat.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedCategory(cat.id)}
                        className="shrink-0"
                      >
                        {cat.name}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Products list */}
                <ScrollArea className="flex-1 p-4">
                  <div className="grid grid-cols-2 gap-2">
                    {filteredProducts.map((product) => (
                      <Card
                        key={product.id}
                        className="cursor-pointer hover:bg-accent transition-colors overflow-hidden"
                        onClick={() => handleProductClick(product)}
                      >
                        <CardContent className="p-3">
                          {product.image_url && (
                            <div className="aspect-video rounded-md overflow-hidden mb-2 bg-muted">
                              <img 
                                src={product.image_url} 
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="font-medium text-sm truncate">{product.name}</div>
                          {product.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {product.description}
                            </p>
                          )}
                          <div className="text-primary font-semibold text-sm mt-1">
                            {formatCurrency(product.price)}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>

                {/* Cart sidebar */}
                {cart.length > 0 && (
                  <div className="w-72 border-l bg-muted/30 flex flex-col">
                    <div className="p-3 border-b font-semibold flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Carrinho ({cart.length})
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="p-2 space-y-2">
                        {cart.map((item, index) => (
                          <Card key={index} className="p-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{item.product.name}</div>
                                {item.options.length > 0 && (
                                  <p className="text-xs text-primary mt-0.5">
                                    {item.options.map(o => o.name).join(', ')}
                                  </p>
                                )}
                                {item.notes && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {item.notes}
                                  </p>
                                )}
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 shrink-0"
                                onClick={() => removeFromCart(index)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-6 w-6"
                                  onClick={() => updateCartQuantity(index, -1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-6 text-center text-sm">{item.quantity}</span>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-6 w-6"
                                  onClick={() => updateCartQuantity(index, 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <span className="text-sm font-semibold">
                                {formatCurrency(item.calculatedPrice * item.quantity)}
                              </span>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                    <div className="p-3 border-t space-y-2">
                      <div className="flex justify-between font-semibold">
                        <span>Total:</span>
                        <span>{formatCurrency(cartTotal)}</span>
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleAddItems}
                        disabled={submitting || cart.length === 0}
                      >
                        {submitting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        Confirmar Itens
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Product modal with options */}
      <POSProductModal
        product={selectedProduct}
        open={productModalOpen}
        onClose={() => {
          setProductModalOpen(false);
          setSelectedProduct(null);
        }}
        onAddToCart={handleAddToCart}
      />

      {/* Payment method dialog */}
      <AlertDialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar Conta - Mesa {table?.table_number}</AlertDialogTitle>
            <AlertDialogDescription>
              Total: <span className="font-bold text-foreground text-lg">{formatCurrency(totalSession)}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <Label className="text-sm font-medium mb-3 block">Forma de Pagamento</Label>
            <RadioGroup
              value={selectedPaymentMethod}
              onValueChange={setSelectedPaymentMethod}
              className="grid grid-cols-2 gap-3"
            >
              {PAYMENT_METHODS.map((method) => {
                const Icon = method.icon;
                return (
                  <div key={method.id}>
                    <RadioGroupItem
                      value={method.id}
                      id={method.id}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={method.id}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors",
                        "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                      )}
                    >
                      <Icon className="h-6 w-6" />
                      <span className="text-sm font-medium">{method.label}</span>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={closingSession}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCloseSession}
              disabled={closingSession}
              className="bg-primary"
            >
              {closingSession ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirmar Pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
