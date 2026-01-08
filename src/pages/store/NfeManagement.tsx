import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Loader2, Download, ExternalLink, AlertCircle, CheckCircle, Clock, RefreshCw, Settings } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FeatureGate } from '@/components/layout/FeatureGate';
import { PremiumBadge } from '@/components/layout/PremiumBadge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NfeInvoice {
  id: string;
  order_id: string | null;
  status: string;
  nfe_number: string | null;
  access_key: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  error_message: string | null;
  created_at: string;
}

interface NfeGlobalSettings {
  is_enabled: boolean;
  environment: string;
}

export default function NfeManagement() {
  const navigate = useNavigate();
  const { user, staffCompany } = useAuth();
  const { toast } = useToast();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyCnpj, setCompanyCnpj] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<NfeInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [nfeEnabled, setNfeEnabled] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get company ID and CNPJ
      const companyQuery = staffCompany?.companyId
        ? supabase.from('companies').select('id, cnpj').eq('id', staffCompany.companyId).maybeSingle()
        : supabase.from('companies').select('id, cnpj').eq('owner_id', user.id).maybeSingle();

      const { data: company, error: companyError } = await companyQuery;
      if (companyError) throw companyError;
      if (!company) {
        setLoading(false);
        return;
      }

      setCompanyId(company.id);
      setCompanyCnpj(company.cnpj || null);

      // Check if NFe is enabled globally
      const { data: settings } = await supabase
        .from('nfe_global_settings')
        .select('is_enabled, environment')
        .limit(1)
        .maybeSingle();

      setNfeEnabled(settings?.is_enabled ?? false);

      // Load invoices for this company
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('nfe_invoices')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;
      setInvoices(invoicesData || []);
    } catch (error: any) {
      console.error('Error loading NFe data:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, staffCompany, toast]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription for invoice updates
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('nfe-invoices-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'nfe_invoices',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('[NFe] Realtime update:', payload);
          if (payload.eventType === 'INSERT') {
            setInvoices((prev) => [payload.new as NfeInvoice, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setInvoices((prev) =>
              prev.map((inv) =>
                inv.id === (payload.new as NfeInvoice).id ? (payload.new as NfeInvoice) : inv
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setInvoices((prev) => prev.filter((inv) => inv.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  // Process pending NFe invoices
  const processNfeQueue = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-nfe');
      
      if (error) throw error;
      
      toast({
        title: 'Processamento iniciado',
        description: data?.message || 'As notas estão sendo processadas.',
      });
    } catch (error: any) {
      console.error('Error processing NFe:', error);
      toast({
        title: 'Erro ao processar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'authorized':
        return (
          <Badge className="bg-emerald-500 text-white">
            <CheckCircle className="h-3 w-3 mr-1" />
            Autorizada
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="outline">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processando
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="secondary">
            Cancelada
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!companyId) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium mb-2">Nenhuma loja encontrada</h2>
            <p className="text-muted-foreground text-center mb-4">
              Você precisa cadastrar sua loja antes de gerenciar notas fiscais
            </p>
            <Button asChild>
              <a href="/dashboard/store">Cadastrar Loja</a>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (!nfeEnabled) {
    return (
      <DashboardLayout>
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-xl animate-pulse" />
              <div className="relative bg-amber-100 dark:bg-amber-900/50 p-6 rounded-full">
                <FileText className="h-12 w-12 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <h2 className="text-xl font-semibold mb-3 text-center">
              Nota Fiscal não disponível
            </h2>
            <p className="text-muted-foreground text-center max-w-md">
              A emissão de Nota Fiscal eletrônica ainda não foi habilitada pelo administrador do sistema.
              Entre em contato com o suporte para mais informações.
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (!companyCnpj) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold font-display">Notas Fiscais</h1>
            <p className="text-muted-foreground">
              Gerencie as notas fiscais emitidas para seus pedidos
            </p>
          </div>

          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-xl animate-pulse" />
                <div className="relative bg-amber-100 dark:bg-amber-900/50 p-5 rounded-full">
                  <AlertCircle className="h-10 w-10 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <h2 className="text-xl font-semibold mb-3 text-center">
                CNPJ não configurado
              </h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Para emitir notas fiscais, você precisa cadastrar o CNPJ da sua empresa nas configurações da loja.
                A nota fiscal será emitida com os dados fiscais da sua empresa.
              </p>
              <Button asChild>
                <a href="/dashboard/store">
                  <FileText className="h-4 w-4 mr-2" />
                  Configurar Dados Fiscais
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold font-display">Notas Fiscais</h1>
              <p className="text-muted-foreground">
                Gerencie as notas fiscais emitidas para seus pedidos
              </p>
            </div>
            <PremiumBadge featureKey="nfe" />
          </div>
          <Button onClick={() => navigate('/dashboard/nfe/setup')}>
            <Settings className="h-4 w-4 mr-2" />
            Configurar NFe
          </Button>
        </div>

        {/* Invoices List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Notas Emitidas
              </CardTitle>
              <CardDescription>
                Histórico de notas fiscais emitidas para os pedidos da sua loja
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={processNfeQueue}
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Processar Fila
            </Button>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma nota fiscal emitida ainda
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  As notas fiscais aparecerão aqui quando forem emitidas para os pedidos
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {invoice.nfe_number ? `NFe #${invoice.nfe_number}` : 'Processando...'}
                        </span>
                        {getStatusBadge(invoice.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Pedido: #{invoice.order_id?.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(invoice.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                      </p>
                      {invoice.error_message && (
                        <p className="text-sm text-destructive">{invoice.error_message}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {invoice.pdf_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </a>
                        </Button>
                      )}
                      {invoice.xml_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={invoice.xml_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-1" />
                            XML
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
