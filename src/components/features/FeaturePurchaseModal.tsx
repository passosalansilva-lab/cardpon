import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Lock, Sparkles, CreditCard, QrCode, Loader2, Crown, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface FeaturePricing {
  id: string;
  price_type: string;
  price: number;
}

interface FeatureInfo {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  pricing: FeaturePricing[];
}

interface FeaturePurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: FeatureInfo | null;
  companyId: string | null;
  onPurchaseComplete?: () => void;
}

export function FeaturePurchaseModal({
  open,
  onOpenChange,
  feature,
  companyId,
  onPurchaseComplete,
}: FeaturePurchaseModalProps) {
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix' | null>(null);
  const [processing, setProcessing] = useState(false);

  // Reset payment method when modal opens
  useEffect(() => {
    if (open) {
      setPaymentMethod(null);
    }
  }, [open]);

  if (!feature) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Pega o único preço disponível (só pode ter um tipo por feature)
  const pricing = feature.pricing?.[0] || null;
  const isMonthly = pricing?.price_type === 'monthly';
  const isOneTime = pricing?.price_type === 'one_time';

  const handlePurchase = async () => {
    if (!pricing || !paymentMethod || !companyId || !feature) {
      toast.error('Selecione o método de pagamento');
      return;
    }

    setProcessing(true);

    try {
      // Verificar se o usuário está autenticado
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        toast.error('Sessão expirada. Por favor, faça login novamente.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-feature-checkout', {
        body: {
          featureId: feature.id,
          featureKey: feature.key,
          featureName: feature.name,
          pricingId: pricing.id,
          priceType: pricing.price_type,
          price: pricing.price,
          companyId,
          paymentMethod,
          returnUrl: `${window.location.origin}/dashboard/plans?feature_purchase=pending`,
        },
      });

      if (error) {
        console.error('Function error:', error);
        throw new Error(error.message || 'Erro ao processar pagamento');
      }

      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data?.pixData) {
        toast.success('PIX gerado! Redirecionando...');
        navigate(`/dashboard/plans?feature_pix=${data.preferenceId}`);
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      toast.error(error.message || 'Erro ao processar compra');
    } finally {
      setProcessing(false);
    }
  };

  const hasPricing = !!pricing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center">{feature.name}</DialogTitle>
          <DialogDescription className="text-center">
            {feature.description || 'Esta funcionalidade não está disponível no seu plano atual.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hasPricing ? (
            <>
              {/* Exibe o preço único disponível */}
              <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isOneTime ? (
                      <Crown className="h-6 w-6 text-amber-500" />
                    ) : (
                      <RefreshCw className="h-6 w-6 text-primary" />
                    )}
                    <div>
                      <p className="font-medium">
                        {isOneTime ? 'Acesso Vitalício' : 'Assinatura Mensal'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {isOneTime 
                          ? 'Pague uma vez, use para sempre' 
                          : 'Cobrança recorrente todo mês'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-primary">
                      {formatCurrency(pricing.price)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isOneTime ? 'único' : '/mês'}
                    </p>
                  </div>
                </div>
                {isOneTime && (
                  <Badge className="mt-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0">
                    Acesso permanente
                  </Badge>
                )}
              </div>

              <Separator />
              
              <div className="space-y-3">
                <p className="text-sm font-medium text-center">Forma de pagamento:</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod('card')}
                    className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                      paymentMethod === 'card'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <CreditCard className="h-6 w-6" />
                    <span className="text-sm font-medium">Cartão</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('pix')}
                    className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                      paymentMethod === 'pix'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <QrCode className="h-6 w-6" />
                    <span className="text-sm font-medium">PIX</span>
                  </button>
                </div>
              </div>

              <Button
                onClick={handlePurchase}
                disabled={!paymentMethod || processing}
                className="w-full gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {isOneTime ? 'Comprar' : 'Assinar'} por {formatCurrency(pricing.price)}
                  </>
                )}
              </Button>

              {isMonthly && (
                <p className="text-xs text-center text-muted-foreground">
                  Você pode cancelar a qualquer momento
                </p>
              )}
            </>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Esta funcionalidade está disponível apenas em planos superiores.
              </p>
              <Button onClick={() => navigate('/dashboard/plans')} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Ver Planos
              </Button>
            </div>
          )}

          <Separator />

          <div className="flex flex-col items-center gap-2">
            {hasPricing && (
              <Button 
                variant="link" 
                onClick={() => navigate('/dashboard/plans')} 
                className="text-xs text-muted-foreground"
              >
                Ou mude para um plano que inclua esta funcionalidade
              </Button>
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
