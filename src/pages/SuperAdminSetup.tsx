import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';

export default function SuperAdminSetup() {
  const { user, session, hasRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !session) {
      toast({
        title: 'Faça login primeiro',
        description: 'Acesse sua conta antes de configurar o superadmin.',
        variant: 'destructive',
      });
      return;
    }

    if (hasRole('super_admin')) {
      toast({
        title: 'Já configurado',
        description: 'Você já é superadmin.',
      });
      navigate('/dashboard');
      return;
    }

    if (!token.trim()) {
      toast({
        title: 'Token obrigatório',
        description: 'Informe o token secreto para continuar.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('bootstrap-superadmin', {
        body: { token: token.trim(), userId: user.id },
      });

      if (error || !data?.success) {
        throw new Error((data as any)?.error || error?.message || 'Erro ao configurar superadmin');
      }

      toast({
        title: 'Superadmin criado com sucesso',
        description: 'Você agora tem acesso administrativo completo.',
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível configurar o superadmin.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center bg-primary/10 text-primary mb-2">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <CardTitle>Configurar Superadmin</CardTitle>
            <CardDescription>
              Use esta tela apenas uma vez para registrar o superadmin principal do sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Lock className="h-4 w-4" />
                  Token secreto
                </label>
                <Input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Digite o token fornecido pelo desenvolvedor"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  'Registrar como Superadmin'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
