import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Loader2, Check, AlertCircle, CreditCard, Lock, Calendar, User, Hash, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Extend window for MercadoPago SDK
declare global {
  interface Window {
    MercadoPago: any;
  }
}

interface OrderItem {
  product_name: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string | null;
  options?: any[];
}

interface CardPaymentScreenProps {
  companyId: string;
  companyName: string;
  items: OrderItem[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddressId?: string;
  deliveryFee: number;
  subtotal: number;
  total: number;
  couponId?: string;
  discountAmount: number;
  notes?: string;
  onSuccess: (orderId: string) => void;
  onCancel: () => void;
}

type PaymentStatus = 'loading' | 'form' | 'processing' | 'success' | 'error';

// Função para detectar bandeira do cartão
function detectCardBrand(cardNumber: string): string {
  const cleanNumber = cardNumber.replace(/\D/g, '');
  
  if (/^4/.test(cleanNumber)) return 'visa';
  if (/^5[1-5]/.test(cleanNumber) || /^2[2-7]/.test(cleanNumber)) return 'master';
  if (/^3[47]/.test(cleanNumber)) return 'amex';
  if (/^6(?:011|5)/.test(cleanNumber)) return 'discover';
  if (/^(636368|636369|438935|504175|451416|636297|5067|4576|4011)/.test(cleanNumber)) return 'elo';
  if (/^(606282|3841)/.test(cleanNumber)) return 'hipercard';
  
  return 'unknown';
}

// Formatar número do cartão
function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

// Formatar data de expiração
function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 2) {
    return digits.slice(0, 2) + '/' + digits.slice(2);
  }
  return digits;
}

export function CardPaymentScreen({
  companyId,
  companyName,
  items,
  customerName,
  customerPhone,
  customerEmail,
  deliveryAddressId,
  deliveryFee,
  subtotal,
  total,
  couponId,
  discountAmount,
  notes,
  onSuccess,
  onCancel,
}: CardPaymentScreenProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<PaymentStatus>('loading');
  const [cancelling, setCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const mpInstanceRef = useRef<any>(null);
  
  // Form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cpf, setCpf] = useState('');
  
  const [cardBrand, setCardBrand] = useState('unknown');
  const [isFormValid, setIsFormValid] = useState(false);

  // Load Mercado Pago SDK and get public key
  useEffect(() => {
    const loadMercadoPagoSDK = async () => {
      try {
        // Get public key from backend
        const { data: keyData, error: keyError } = await supabase.functions.invoke('get-mercadopago-public-key', {
          body: { companyId },
        });

        if (keyError || !keyData?.publicKey) {
          throw new Error('Não foi possível configurar o pagamento');
        }

        setPublicKey(keyData.publicKey);

        // Load SDK dynamically
        if (!window.MercadoPago) {
          const script = document.createElement('script');
          script.src = 'https://sdk.mercadopago.com/js/v2';
          script.async = true;
          script.onload = () => {
            mpInstanceRef.current = new (window as any).MercadoPago(keyData.publicKey, {
              locale: 'pt-BR',
            });
            setStatus('form');
          };
          script.onerror = () => {
            throw new Error('Erro ao carregar SDK de pagamento');
          };
          document.body.appendChild(script);
        } else {
          mpInstanceRef.current = new (window as any).MercadoPago(keyData.publicKey, {
            locale: 'pt-BR',
          });
          setStatus('form');
        }
      } catch (err: any) {
        console.error('[CardPaymentScreen] SDK load error:', err);
        setErrorMessage(err.message || 'Erro ao configurar pagamento');
        setStatus('error');
      }
    };

    loadMercadoPagoSDK();
  }, [companyId]);

  // Detect card brand
  useEffect(() => {
    setCardBrand(detectCardBrand(cardNumber));
  }, [cardNumber]);

  // Validate form
  useEffect(() => {
    const cardDigits = cardNumber.replace(/\D/g, '');
    const expiryDigits = expiry.replace(/\D/g, '');
    const cvvDigits = cvv.replace(/\D/g, '');
    const cpfDigits = cpf.replace(/\D/g, '');
    
    const isValid = 
      cardDigits.length >= 13 &&
      cardDigits.length <= 19 &&
      cardholderName.trim().length >= 3 &&
      expiryDigits.length === 4 &&
      cvvDigits.length >= 3 &&
      cvvDigits.length <= 4 &&
      cpfDigits.length === 11;
    
    setIsFormValid(isValid);
  }, [cardNumber, cardholderName, expiry, cvv, cpf]);

  const formatCpf = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  // Cancel payment intent
  const handleCancelPayment = async () => {
    setCancelling(true);
    try {
      toast({ 
        title: 'Pagamento cancelado', 
        description: 'Você pode escolher outra forma de pagamento.' 
      });
      onCancel();
    } catch (err) {
      console.error('Error cancelling payment:', err);
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid || !mpInstanceRef.current) return;
    
    setStatus('processing');
    setErrorMessage('');

    try {
      const expiryDigits = expiry.replace(/\D/g, '');
      const expirationMonth = expiryDigits.slice(0, 2);
      const expirationYear = '20' + expiryDigits.slice(2, 4);
      const cardNumberClean = cardNumber.replace(/\D/g, '');
      const cpfClean = cpf.replace(/\D/g, '');

      // Create card token using MP SDK
      const cardData = {
        cardNumber: cardNumberClean,
        cardholderName: cardholderName,
        cardExpirationMonth: expirationMonth,
        cardExpirationYear: expirationYear,
        securityCode: cvv.replace(/\D/g, ''),
        identificationType: 'CPF',
        identificationNumber: cpfClean,
      };

      console.log('[CardPaymentScreen] Creating card token...');
      
      const tokenResponse = await mpInstanceRef.current.createCardToken(cardData);
      
      if (!tokenResponse?.id) {
        throw new Error('Não foi possível processar os dados do cartão');
      }

      console.log('[CardPaymentScreen] Token created:', tokenResponse.id);

      // Send token to backend for payment processing
      const { data, error } = await supabase.functions.invoke('process-card-payment', {
        body: {
          companyId,
          token: tokenResponse.id,
          paymentMethodId: cardBrand !== 'unknown' ? cardBrand : 'visa',
          installments: 1,
          cpf: cpfClean,
          items,
          customerName,
          customerPhone,
          customerEmail,
          deliveryAddressId,
          deliveryFee,
          subtotal,
          total,
          couponId,
          discountAmount,
          notes,
        },
      });

      // Transport-level error (timeout, function down, etc.)
      if (error) {
        throw new Error('Não foi possível comunicar com o servidor de pagamento. Tente novamente.');
      }

      // Business-level result (always 200)
      if (data?.success && data?.orderId) {
        setStatus('success');
        toast({
          title: 'Pagamento aprovado!',
          description: 'Seu pedido foi realizado com sucesso.',
        });

        setTimeout(() => {
          onSuccess(data.orderId);
        }, 2000);
        return;
      }

      const backendMessage =
        data?.error ||
        data?.message ||
        'Pagamento não aprovado. Tente novamente ou use outro cartão.';

      throw new Error(backendMessage);
    } catch (err: any) {
      console.error('[CardPaymentScreen] Payment error:', err);

      const userMessage =
        typeof err?.message === 'string' && err.message.trim()
          ? err.message
          : 'Erro ao processar pagamento';

      setErrorMessage(userMessage);
      setStatus('error');
      toast({
        title: 'Erro no pagamento',
        description: userMessage,
        variant: 'destructive',
      });
    }
  };

  // Loading screen
  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Carregando pagamento...</p>
      </div>
    );
  }

  // Success screen
  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6 animate-in zoom-in duration-300">
          <Check className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Pagamento Aprovado!</h2>
        <p className="text-muted-foreground">Seu pedido foi realizado com sucesso.</p>
      </div>
    );
  }

  // Error screen with retry
  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Pagamento Recusado</h2>
        <p className="text-muted-foreground mb-2">{errorMessage}</p>
        <p className="text-sm text-muted-foreground mb-6">
          Verifique os dados do cartão e tente novamente.
        </p>
        <div className="flex gap-3">
          <Button onClick={onCancel} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Button onClick={() => setStatus('form')}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  // Processing screen
  if (status === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Processando pagamento...</h2>
        <p className="text-muted-foreground">Aguarde enquanto validamos seu pagamento</p>
      </div>
    );
  }

  // Payment form
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border p-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Pagamento com Cartão
          </h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full">
        {/* Amount */}
        <div className="text-center mb-6">
          <p className="text-sm text-muted-foreground">Valor a pagar</p>
          <p className="text-3xl font-bold text-primary">
            R$ {total.toFixed(2).replace('.', ',')}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{companyName}</p>
        </div>

        {/* Card Form */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          {/* Card Number */}
          <div className="space-y-2">
            <Label htmlFor="cardNumber" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Número do Cartão
            </Label>
            <div className="relative">
              <Input
                id="cardNumber"
                type="text"
                inputMode="numeric"
                placeholder="0000 0000 0000 0000"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                className="pr-12"
              />
              {cardBrand !== 'unknown' && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium uppercase text-muted-foreground">
                  {cardBrand}
                </div>
              )}
            </div>
          </div>

          {/* Cardholder Name */}
          <div className="space-y-2">
            <Label htmlFor="cardholderName" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Nome no Cartão
            </Label>
            <Input
              id="cardholderName"
              type="text"
              placeholder="Como está impresso no cartão"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
            />
          </div>

          {/* Expiry and CVV */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiry" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Validade
              </Label>
              <Input
                id="expiry"
                type="text"
                inputMode="numeric"
                placeholder="MM/AA"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cvv" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                CVV
              </Label>
              <Input
                id="cvv"
                type="text"
                inputMode="numeric"
                placeholder="000"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </div>
          </div>

          {/* CPF */}
          <div className="space-y-2">
            <Label htmlFor="cpf" className="flex items-center gap-2">
              <Hash className="w-4 h-4" />
              CPF do Titular
            </Label>
            <Input
              id="cpf"
              type="text"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
            />
          </div>
        </div>

        {/* Submit button */}
        <Button
          className="w-full mt-6"
          size="lg"
          onClick={handleSubmit}
          disabled={!isFormValid}
        >
          <Lock className="w-4 h-4 mr-2" />
          Pagar R$ {total.toFixed(2).replace('.', ',')}
        </Button>

        {/* Cancel button */}
        <Button
          onClick={handleCancelPayment}
          variant="ghost"
          className="w-full mt-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          disabled={cancelling}
        >
          {cancelling ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <XCircle className="w-4 h-4 mr-2" />
          )}
          {cancelling ? 'Cancelando...' : 'Cancelar e escolher outro pagamento'}
        </Button>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-4">
          <Lock className="w-4 h-4" />
          <span>Pagamento seguro via Mercado Pago</span>
        </div>
      </main>
    </div>
  );
}
