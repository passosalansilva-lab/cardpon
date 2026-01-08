import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mail, Loader2, Truck, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export default function DriverLogin() {
  const navigate = useNavigate();
  const { companySlug } = useParams<{ companySlug?: string }>();
  const { user, loading: authLoading, hasRole, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyLoading, setCompanyLoading] = useState(!!companySlug);

  // Load company info if slug is provided
  useEffect(() => {
    const loadCompanyInfo = async () => {
      if (!companySlug) {
        setCompanyLoading(false);
        return;
      }

      try {
        const { data: company, error } = await supabase
          .from('companies')
          .select('name, logo_url')
          .eq('slug', companySlug)
          .maybeSingle();

        if (error) throw error;
        
        if (company) {
          setCompanyName(company.name);
        } else {
          toast.error('Empresa não encontrada', {
            description: 'O link de acesso pode estar incorreto.',
          });
        }
      } catch (error) {
        console.error('Error loading company:', error);
      } finally {
        setCompanyLoading(false);
      }
    };

    loadCompanyInfo();
  }, [companySlug]);

  // Check if user is already logged in
  useEffect(() => {
    if (authLoading) return;
    
    if (user) {
      const isDriver = hasRole('delivery_driver');
      const isStoreOwner = hasRole('store_owner');
      const isSuperAdmin = hasRole('super_admin');
      
      // If user is a driver, redirect to driver dashboard
      if (isDriver) {
        navigate('/driver', { replace: true });
        return;
      }
      
      // If user is store owner or admin (not a driver), sign them out first
      if (isStoreOwner || isSuperAdmin) {
        toast.info('Você está logado como lojista', {
          description: 'Faça logout para acessar como entregador',
        });
        signOut();
      }
    }
  }, [user, authLoading, hasRole, navigate, signOut]);

  // Show loading while checking auth
  if (authLoading || companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error('Digite seu email');
      return;
    }

    setLoading(true);

    try {
      // Login direto via edge function - passando o slug da empresa se existir
      const { data: loginData, error: loginError } = await supabase.functions.invoke(
        'driver-direct-login',
        { body: { email: email.toLowerCase().trim(), companySlug: companySlug || null } }
      );

      if (loginError) throw loginError;

      if (loginData?.error) {
        toast.error('Erro ao fazer login', {
          description: loginData.error,
        });
        setLoading(false);
        return;
      }

      if (loginData?.session) {
        // Set the session manually
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: loginData.session.access_token,
          refresh_token: loginData.session.refresh_token,
        });

        if (sessionError) throw sessionError;

        toast.success('Login realizado com sucesso!');
        navigate('/driver');
      } else {
        throw new Error('Não foi possível criar a sessão');
      }
    } catch (error: any) {
      console.error('Error logging in:', error);
      toast.error('Erro ao fazer login', {
        description: error.message || 'Tente novamente',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Truck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-display">Área do Entregador</CardTitle>
          <CardDescription>
            {companyName ? (
              <span className="flex items-center justify-center gap-2 mt-2">
                <Store className="h-4 w-4" />
                Acesso para <span className="font-medium text-foreground">{companyName}</span>
              </span>
            ) : (
              'Acesse com o email cadastrado pelo estabelecimento'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                disabled={loading}
                autoFocus
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full gradient-primary text-primary-foreground"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          {!companySlug && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              Se você trabalha em mais de uma empresa, peça o link de acesso específico ao estabelecimento.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
