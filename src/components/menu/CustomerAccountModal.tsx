import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

const signupSchema = loginSchema
  .extend({
    fullName: z
      .string()
      .min(2, 'Nome deve ter pelo menos 2 caracteres')
      .max(100, 'Nome deve ter no máximo 100 caracteres'),
    phone: z
      .string()
      .min(8, 'Telefone deve ter pelo menos 8 dígitos')
      .max(20, 'Telefone deve ter no máximo 20 caracteres')
      .regex(/^[0-9()+\s-]+$/, 'Telefone deve conter apenas números e símbolos válidos'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

export type CustomerAuthMode = 'login' | 'signup';

interface CustomerAccountModalProps {
  open: boolean;
  mode: CustomerAuthMode;
  onModeChange: (mode: CustomerAuthMode) => void;
  onClose: () => void;
}

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

type FormData = SignupFormData;

export function CustomerAccountModal({
  open,
  mode,
  onModeChange,
  onClose,
}: CustomerAccountModalProps) {
  const { toast } = useToast();
  const { signIn, signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isLogin = mode === 'login';
  const schema = isLogin ? loginSchema : signupSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await signIn(data.email, data.password);
        if (error) {
          toast({
            title: 'Erro no login',
            description:
              error.message.includes('Invalid login credentials')
                ? 'Email ou senha incorretos'
                : error.message,
            variant: 'destructive',
          });
          return;
        }
        toast({
          title: 'Bem-vindo!',
          description: 'Login realizado com sucesso',
        });
        handleClose();
      } else {
        const { error } = await signUp(data.email, data.password, data.fullName, data.phone);
        if (error) {
          toast({
            title: 'Erro no cadastro',
            description:
              error.message.includes('User already registered')
                ? 'Este email já está em uso. Tente fazer login.'
                : error.message,
            variant: 'destructive',
          });
          return;
        }

        // Opcional: força o usuário a confirmar o email antes de usar a conta.
        toast({
          title: 'Conta criada!',
          description: 'Se necessário, confira seu email para confirmar a conta.',
        });
        handleClose();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = (document.getElementById('customer-auth-email') as HTMLInputElement | null)?.value?.trim();
    if (!email) {
      toast({
        title: 'Informe seu email',
        description: 'Preencha o campo de email para redefinir a senha.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const redirectUrl = `${window.location.origin}/auth`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) {
        toast({
          title: 'Erro ao enviar email',
          description: 'Tente novamente em alguns instantes.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Confira seu email',
        description: 'Se o email existir, enviaremos um link para redefinir sua senha.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {isLogin ? 'Entrar na minha conta' : 'Criar conta rápida'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="customer-fullName">Nome completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="customer-fullName"
                  type="text"
                  placeholder="Seu nome completo"
                  className="pl-10"
                  {...register('fullName')}
                />
              </div>
              {errors.fullName && (
                <p className="text-sm text-destructive">{errors.fullName.message}</p>
              )}
            </div>
          )}

          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="customer-phone">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="customer-phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  className="pl-10"
                  {...register('phone')}
                />
              </div>
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="customer-auth-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="customer-auth-email"
                type="email"
                placeholder="seu@email.com"
                className="pl-10"
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-auth-password">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="customer-auth-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="pl-10 pr-10"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="customer-auth-confirmPassword">Confirmar senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="customer-auth-confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10"
                  {...register('confirmPassword')}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLogin ? 'Entrar' : 'Criar conta'}
          </Button>

          {isLogin && (
            <button
              type="button"
              onClick={handleForgotPassword}
              className="mt-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Esqueci minha senha
            </button>
          )}

          <div className="pt-2 text-center text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => onModeChange(isLogin ? 'signup' : 'login')}
              className="font-medium text-primary hover:underline"
            >
              {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
