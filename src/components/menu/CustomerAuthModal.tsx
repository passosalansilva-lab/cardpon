import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Mail } from 'lucide-react';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

const emailSchema = z.object({
  email: z.string().email('Email inválido'),
});

type EmailFormData = z.infer<typeof emailSchema>;

export interface CustomerData {
  id: string;
  name: string;
  email: string | null;
  phone: string;
}

interface CustomerAuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (customer: CustomerData) => void;
}

interface CustomerAuthFormProps {
  onClose: () => void;
  onSuccess: (customer: CustomerData) => void;
}

function CustomerAuthForm({ onClose, onSuccess }: CustomerAuthFormProps) {
  const [loading, setLoading] = useState(false);
  const { executeRecaptcha } = useGoogleReCaptcha();

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  const resetState = () => {
    emailForm.reset();
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleEmailLogin = async (data: EmailFormData) => {
    setLoading(true);
    try {
      // Verify reCAPTCHA only if configured and available
      if (RECAPTCHA_SITE_KEY && executeRecaptcha) {
        try {
          const recaptchaToken = await executeRecaptcha('customer_login');
          
          const { data: recaptchaResult, error: recaptchaError } = await supabase.functions.invoke('verify-recaptcha', {
            body: { token: recaptchaToken }
          });

          if (recaptchaError || !recaptchaResult?.success) {
            console.error('reCAPTCHA verification failed:', recaptchaError || recaptchaResult?.error);
            toast.error(recaptchaResult?.error || 'Verificação de segurança falhou. Tente novamente.');
            setLoading(false);
            return;
          }
        } catch (recaptchaErr) {
          console.warn('reCAPTCHA error, proceeding without:', recaptchaErr);
          // Continue without reCAPTCHA if it fails
        }
      }

      // Use secure Edge Function for customer lookup
      const { data: result, error } = await supabase.functions.invoke('lookup-customer', {
        body: { email: data.email.toLowerCase().trim() }
      });

      if (error) {
        console.error('Customer lookup error:', error);
        throw new Error(error.message || 'Erro ao buscar cliente');
      }

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      if (result?.found && result?.customerId) {
        toast.success(`Bem-vindo de volta, ${result.firstName}!`);
        
        // Cliente já existe
        const customer: CustomerData = {
          id: result.customerId,
          name: result.name || result.firstName,
          email: result.email || data.email.toLowerCase().trim(),
          phone: result.phone || '',
        };
        
        onSuccess(customer);
        handleClose();
      } else {
        // Mantemos o comportamento original: só deixa entrar se já tiver feito pedido
        // e estiver cadastrado em `customers`.
        toast.error('Email não encontrado. Faça seu primeiro pedido para se cadastrar.');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.message?.includes('429') || error.status === 429) {
        toast.error('Muitas tentativas. Aguarde um minuto e tente novamente.');
      } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
      } else {
        toast.error(error.message || 'Erro ao buscar cliente. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-center">Acessar minha conta</DialogTitle>
      </DialogHeader>

      <form onSubmit={emailForm.handleSubmit(handleEmailLogin)} className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              className="pl-10"
              {...emailForm.register('email')}
            />
          </div>
          {emailForm.formState.errors.email && (
            <p className="text-sm text-destructive">{emailForm.formState.errors.email.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Entrar
        </Button>
      </form>

      <p className="mt-4 text-xs text-muted-foreground text-center">
        Use o mesmo email do seu primeiro pedido para acessar seus endereços salvos.
      </p>
    </>
  );
}

export function CustomerAuthModal({ open, onClose, onSuccess }: CustomerAuthModalProps) {
  if (!RECAPTCHA_SITE_KEY) {
    console.warn('VITE_RECAPTCHA_SITE_KEY not configured');
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        {RECAPTCHA_SITE_KEY ? (
          <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
            <CustomerAuthForm onClose={onClose} onSuccess={onSuccess} />
          </GoogleReCaptchaProvider>
        ) : (
          <CustomerAuthForm onClose={onClose} onSuccess={onSuccess} />
        )}
      </DialogContent>
    </Dialog>
  );
}
