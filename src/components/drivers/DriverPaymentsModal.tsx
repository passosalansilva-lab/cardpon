import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  DollarSign, 
  TrendingUp, 
  Package, 
  Calendar,
  Receipt,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DriverPayment {
  id: string;
  amount: number;
  payment_type: string;
  paid_at: string;
  delivery_count: number | null;
  description: string | null;
  reference_period_start: string | null;
  reference_period_end: string | null;
}

interface DriverPaymentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverId: string;
  driverName: string;
  pendingEarnings: number;
  totalPaid: number;
  deliveryCount: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function DriverPaymentsModal({
  open,
  onOpenChange,
  driverId,
  driverName,
  pendingEarnings,
  totalPaid,
  deliveryCount,
}: DriverPaymentsModalProps) {
  const [payments, setPayments] = useState<DriverPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && driverId) {
      loadPayments();
    }
  }, [open, driverId]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('driver_payments')
        .select('*')
        .eq('driver_id', driverId)
        .order('paid_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case 'per_delivery':
        return 'Por entrega';
      case 'fixed_salary':
        return 'Salário fixo';
      case 'bonus':
        return 'Bônus';
      default:
        return type;
    }
  };

  // Abbreviate driver name
  const abbreviateName = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Meus Pagamentos
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {abbreviateName(driverName)}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-green-500/10 border-green-500/20">
              <CardContent className="p-3 text-center">
                <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">A receber</p>
                <p className="text-sm font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(pendingEarnings)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="p-3 text-center">
                <TrendingUp className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Recebido</p>
                <p className="text-sm font-bold text-primary">
                  {formatCurrency(totalPaid)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-secondary">
              <CardContent className="p-3 text-center">
                <Package className="h-4 w-4 text-foreground mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Entregas</p>
                <p className="text-sm font-bold">{deliveryCount}</p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Payment History */}
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Histórico de Pagamentos
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum pagamento registrado</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <Card key={payment.id} className="border">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {getPaymentTypeLabel(payment.payment_type)}
                              </Badge>
                              {payment.delivery_count && (
                                <span className="text-xs text-muted-foreground">
                                  {payment.delivery_count} entregas
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(payment.paid_at), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                            </p>
                            {payment.description && (
                              <p className="text-xs text-muted-foreground">
                                {payment.description}
                              </p>
                            )}
                            {payment.reference_period_start && payment.reference_period_end && (
                              <p className="text-xs text-muted-foreground">
                                Período: {format(new Date(payment.reference_period_start), 'dd/MM')} - {format(new Date(payment.reference_period_end), 'dd/MM')}
                              </p>
                            )}
                          </div>
                          <p className="font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(payment.amount)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
