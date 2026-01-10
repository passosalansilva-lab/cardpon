import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle, CreditCard, ChevronDown, ExternalLink, Eye, EyeOff, Info } from 'lucide-react';

interface PaymentSettings {
  picpay_enabled: boolean;
  picpay_verified: boolean;
  picpay_client_id: string | null;
  picpay_client_secret: string | null;
  picpay_account_email: string | null;
}

interface PicPayConfigProps {
  companyId: string;
}

const PicPayRequirementsInfo = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Como obter as credenciais do PicPay?
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Alert className="mt-2">
          <AlertDescription className="text-sm space-y-2">
            <p><strong>Para integrar o PicPay:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Acesse sua conta no <a href="https://lojista.picpay.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">PicPay Empresas <ExternalLink className="h-3 w-3" /></a></li>
              <li>Vá em <strong>Integrações</strong></li>
              <li>Clique em <strong>Gateway de Pagamento</strong></li>
              <li>Copie o <strong>Client ID</strong> e o <strong>Client Secret</strong></li>
              <li>Cole os valores nos campos abaixo</li>
            </ol>
            <p className="text-xs text-muted-foreground mt-2">
              As credenciais são únicas da sua conta e permitem receber pagamentos via PicPay.
            </p>
          </AlertDescription>
        </Alert>
      </CollapsibleContent>
    </Collapsible>
  );
};

export function PicPayConfig({ companyId }: PicPayConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [companyId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_payment_settings')
        .select('picpay_enabled, picpay_verified, picpay_client_id, picpay_client_secret, picpay_account_email')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data as PaymentSettings);
        if (data.picpay_client_id) {
          setClientId(data.picpay_client_id);
        }
        if (data.picpay_client_secret) {
          setClientSecret('••••••••••••••••');
        }
      } else {
        setSettings({
          picpay_enabled: false,
          picpay_verified: false,
          picpay_client_id: null,
          picpay_client_secret: null,
          picpay_account_email: null,
        });
      }
    } catch (error: any) {
      console.error('Error loading PicPay settings:', error);
      toast.error('Erro ao carregar configurações do PicPay');
    } finally {
      setLoading(false);
    }
  };

  const validateAndSaveCredentials = async () => {
    if (!clientId.trim()) {
      toast.error('Por favor, insira o Client ID');
      return;
    }

    // Se o secret está mascarado e não foi alterado, não validar novamente
    const secretToSave = clientSecret === '••••••••••••••••' ? null : clientSecret;
    
    if (!secretToSave && !settings?.picpay_client_secret) {
      toast.error('Por favor, insira o Client Secret');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-picpay-credentials', {
        body: { 
          clientId: clientId.trim(), 
          clientSecret: secretToSave || undefined,
          companyId 
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Credenciais do PicPay validadas com sucesso!');
        loadSettings();
      } else {
        toast.error(data.error || 'Erro ao validar credenciais');
      }
    } catch (error: any) {
      console.error('Error validating PicPay credentials:', error);
      toast.error('Erro ao validar credenciais do PicPay');
    } finally {
      setSaving(false);
    }
  };

  const disablePayment = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_payment_settings')
        .update({
          picpay_enabled: false,
          picpay_verified: false,
          picpay_client_id: null,
          picpay_client_secret: null,
          picpay_account_email: null,
          picpay_verified_at: null,
        })
        .eq('company_id', companyId);

      if (error) throw error;

      setClientId('');
      setClientSecret('');
      toast.success('PicPay desativado com sucesso');
      loadSettings();
    } catch (error: any) {
      console.error('Error disabling PicPay:', error);
      toast.error('Erro ao desativar PicPay');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isConfigured = settings?.picpay_enabled && settings?.picpay_verified;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#21C25E]/10 rounded-lg">
              <CreditCard className="h-5 w-5 text-[#21C25E]" />
            </div>
            <div>
              <CardTitle className="text-lg">PicPay</CardTitle>
              <CardDescription>Receba pagamentos via PicPay</CardDescription>
            </div>
          </div>
          {isConfigured ? (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Ativo
            </Badge>
          ) : (
            <Badge variant="secondary">
              <XCircle className="h-3 w-3 mr-1" />
              Inativo
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConfigured ? (
          <>
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                PicPay configurado e pronto para receber pagamentos.
                {settings.picpay_account_email && (
                  <span className="block text-sm mt-1">
                    Conta vinculada: <strong>{settings.picpay_account_email}</strong>
                  </span>
                )}
              </AlertDescription>
            </Alert>


            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setSettings(prev => prev ? { ...prev, picpay_verified: false } : null)}
              >
                Atualizar credenciais
              </Button>
              <Button variant="destructive" onClick={disablePayment} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Desativar
              </Button>
            </div>
          </>
        ) : (
          <>
            <PicPayRequirementsInfo />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="picpay-client-id">Client ID</Label>
                <Input
                  id="picpay-client-id"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Seu Client ID do PicPay"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="picpay-client-secret">Client Secret</Label>
                <div className="relative">
                  <Input
                    id="picpay-client-secret"
                    type={showSecret ? 'text' : 'password'}
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Seu Client Secret do PicPay"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button 
                onClick={validateAndSaveCredentials} 
                disabled={saving || !clientId.trim()}
                className="w-full bg-[#21C25E] hover:bg-[#1aa850]"
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Validar e Ativar PicPay
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
