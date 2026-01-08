import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Bell, Send, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export default function PromotionalNotifications() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Fetch company data
  const { data: company } = useQuery({
    queryKey: ['company', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, logo_url')
        .eq('owner_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Fetch subscriber count
  const { data: subscriberCount = 0 } = useQuery({
    queryKey: ['subscriber-count', company?.id],
    queryFn: async () => {
      if (!company?.id) return 0;
      const { count, error } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .eq('user_type', 'customer');
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!company?.id
  });

  const handleSendNotification = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Preencha o título e a mensagem");
      return;
    }

    if (!company?.id) {
      toast.error("Empresa não encontrada");
      return;
    }

    if (subscriberCount === 0) {
      toast.error("Não há clientes inscritos para receber notificações");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          companyId: company.id,
          userType: 'customer',
          broadcast: true, // Flag to indicate promotional broadcast
          payload: {
            title: title.trim(),
            body: body.trim(),
            icon: company.logo_url || '/pwa-192x192.png',
            tag: `promo-${company.id}-${Date.now()}`,
            data: {
              type: 'promotion',
              companyId: company.id,
              url: `/${company.id}`
            }
          }
        }
      });

      if (error) throw error;

      const sent = data?.sent || 0;
      toast.success(`Notificação enviada para ${sent} cliente(s)!`);
      setTitle("");
      setBody("");
    } catch (error) {
      console.error('Error sending promotional notification:', error);
      toast.error("Erro ao enviar notificação");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container max-w-2xl py-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Notificações Promocionais</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Enviar Notificação</CardTitle>
            <CardDescription>
              Envie uma notificação push para todos os clientes que ativaram notificações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {subscriberCount} cliente(s) inscrito(s) para receber notificações
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                placeholder="Ex: 🔥 Promoção Especial!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">{title.length}/50 caracteres</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Mensagem</Label>
              <Textarea
                id="body"
                placeholder="Ex: Aproveite 20% de desconto em todos os produtos hoje!"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">{body.length}/200 caracteres</p>
            </div>

            <Button 
              onClick={handleSendNotification} 
              disabled={isSending || !title.trim() || !body.trim() || subscriberCount === 0}
              className="w-full"
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar para {subscriberCount} cliente(s)
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
