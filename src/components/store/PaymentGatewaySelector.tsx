import { useState, useEffect } from 'react';
import { CreditCard, Check, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PaymentGatewaySettings {
  mercadopago_enabled: boolean;
  mercadopago_verified: boolean;
  picpay_enabled: boolean;
  picpay_verified: boolean;
  active_payment_gateway: string;
}

interface PaymentGatewaySelectorProps {
  companyId: string;
}

export function PaymentGatewaySelector({ companyId }: PaymentGatewaySelectorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PaymentGatewaySettings | null>(null);

  useEffect(() => {
    loadSettings();
  }, [companyId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_payment_settings')
        .select('mercadopago_enabled, mercadopago_verified, picpay_enabled, picpay_verified, active_payment_gateway')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          mercadopago_enabled: !!data.mercadopago_enabled,
          mercadopago_verified: !!data.mercadopago_verified,
          picpay_enabled: !!data.picpay_enabled,
          picpay_verified: !!data.picpay_verified,
          active_payment_gateway: data.active_payment_gateway || 'mercadopago',
        });
      } else {
        setSettings({
          mercadopago_enabled: false,
          mercadopago_verified: false,
          picpay_enabled: false,
          picpay_verified: false,
          active_payment_gateway: 'mercadopago',
        });
      }
    } catch (error) {
      console.error('Error loading payment settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGatewayChange = async (gateway: string) => {
    if (!settings) return;

    // Verificar se o gateway selecionado está configurado
    if (gateway === 'mercadopago' && (!settings.mercadopago_enabled || !settings.mercadopago_verified)) {
      toast({
        title: 'Mercado Pago não configurado',
        description: 'Configure o Mercado Pago antes de selecioná-lo como gateway ativo.',
        variant: 'destructive',
      });
      return;
    }

    if (gateway === 'picpay' && (!settings.picpay_enabled || !settings.picpay_verified)) {
      toast({
        title: 'PicPay não configurado',
        description: 'Configure o PicPay antes de selecioná-lo como gateway ativo.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_payment_settings')
        .update({ active_payment_gateway: gateway })
        .eq('company_id', companyId);

      if (error) throw error;

      setSettings({ ...settings, active_payment_gateway: gateway });
      toast({
        title: 'Gateway atualizado',
        description: `${gateway === 'mercadopago' ? 'Mercado Pago' : 'PicPay'} será usado para receber pagamentos online.`,
      });
    } catch (error) {
      console.error('Error updating gateway:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o gateway de pagamento.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Gateway de Pagamento Ativo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-24 bg-muted rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!settings) return null;

  const mercadoPagoReady = settings.mercadopago_enabled && settings.mercadopago_verified;
  const picPayReady = settings.picpay_enabled && settings.picpay_verified;
  const hasAnyGateway = mercadoPagoReady || picPayReady;

  if (!hasAnyGateway) {
    return (
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Gateway de Pagamento Ativo
          </CardTitle>
          <CardDescription>
            Configure pelo menos um gateway de pagamento (Mercado Pago ou PicPay) para receber pagamentos online.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <AlertCircle className="h-4 w-4" />
            Nenhum gateway configurado
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Gateway de Pagamento Ativo
        </CardTitle>
        <CardDescription>
          Escolha qual gateway será usado para processar os pagamentos online no seu cardápio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={settings.active_payment_gateway}
          onValueChange={handleGatewayChange}
          className="space-y-3"
          disabled={saving}
        >
          {/* Mercado Pago */}
          <div className={`flex items-center space-x-3 rounded-lg border p-4 transition-colors ${
            settings.active_payment_gateway === 'mercadopago' 
              ? 'border-primary bg-primary/5' 
              : 'border-border'
          } ${!mercadoPagoReady ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
            <RadioGroupItem 
              value="mercadopago" 
              id="gateway-mercadopago" 
              disabled={!mercadoPagoReady}
            />
            <Label 
              htmlFor="gateway-mercadopago" 
              className={`flex-1 ${!mercadoPagoReady ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-3">
                <div className="h-6 w-24 flex items-center">
                  <svg viewBox="0 0 100 32" className="h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100" height="32" rx="4" fill="#009ee3"/>
                    <text x="50" y="21" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">Mercado Pago</text>
                  </svg>
                </div>
                <span className="font-medium">Mercado Pago</span>
              </div>
            </Label>
            <div className="flex items-center gap-2">
              {mercadoPagoReady ? (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  Configurado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Não configurado
                </Badge>
              )}
            </div>
          </div>

          {/* PicPay */}
          <div className={`flex items-center space-x-3 rounded-lg border p-4 transition-colors ${
            settings.active_payment_gateway === 'picpay' 
              ? 'border-[#21c25e] bg-[#21c25e]/5' 
              : 'border-border'
          } ${!picPayReady ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
            <RadioGroupItem 
              value="picpay" 
              id="gateway-picpay" 
              disabled={!picPayReady}
            />
            <Label 
              htmlFor="gateway-picpay" 
              className={`flex-1 ${!picPayReady ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-3">
                <div className="h-6 w-16 flex items-center">
                  <svg viewBox="0 0 60 32" className="h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="60" height="32" rx="4" fill="#21c25e"/>
                    <text x="30" y="21" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">PicPay</text>
                  </svg>
                </div>
                <span className="font-medium">PicPay</span>
              </div>
            </Label>
            <div className="flex items-center gap-2">
              {picPayReady ? (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  Configurado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Não configurado
                </Badge>
              )}
            </div>
          </div>
        </RadioGroup>

        {settings.active_payment_gateway && (
          <p className="text-sm text-muted-foreground mt-4">
            Os clientes verão a opção de pagar com PIX via{' '}
            <strong>{settings.active_payment_gateway === 'mercadopago' ? 'Mercado Pago' : 'PicPay'}</strong>{' '}
            no checkout do cardápio.
          </p>
        )}
      </CardContent>
    </Card>
  );
}