import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Users, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import logoCardapioOn from "@/assets/logo-cardapio-on-new.png";

export default function StaffLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Preencha e-mail e senha.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("E-mail ou senha incorretos.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data.user) {
        // Check if user is a staff member
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id);

        const roles = roleData?.map(r => r.role) || [];
        
        if (roles.includes("store_staff")) {
          toast.success("Login realizado com sucesso!");
          navigate("/dashboard/orders");
        } else if (roles.includes("store_owner") || roles.includes("super_admin")) {
          toast.success("Login realizado com sucesso!");
          navigate("/dashboard");
        } else {
          // User is not authorized
          await supabase.auth.signOut();
          toast.error("Você não tem permissão para acessar esta área.");
        }
      }
    } catch (error: any) {
      console.error("Erro no login:", error);
      toast.error("Erro ao fazer login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <img 
            src={logoCardapioOn} 
            alt="Cardápio On" 
            className="h-16 w-auto object-contain"
          />
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Acesso da Equipe</CardTitle>
            <CardDescription>
              Entre com seu e-mail e senha fornecidos pelo lojista
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t">
              <Link 
                to="/auth" 
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para login do lojista
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Esta é uma área restrita para funcionários cadastrados.
          <br />
          Solicite suas credenciais ao administrador da loja.
        </p>
      </div>
    </div>
  );
}
