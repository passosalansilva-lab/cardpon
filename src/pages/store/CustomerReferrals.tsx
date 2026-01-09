import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  Link2, 
  Percent, 
  Copy, 
  Check, 
  Users, 
  Gift, 
  TrendingUp,
  Save
} from "lucide-react";

interface ReferralSettings {
  id?: string;
  company_id: string;
  is_enabled: boolean;
  referrer_discount_percent: number;
  referred_discount_percent: number;
  max_uses_per_referrer: number;
  max_uses_per_referred: number;
}

interface ReferralCode {
  id: string;
  code: string;
  customer_id: string;
  total_referrals: number;
  total_discount_given: number;
  created_at: string;
  customer?: {
    name: string;
    phone: string;
  };
}

interface ReferralUsage {
  id: string;
  discount_applied: number;
  referrer_discount_applied: number;
  created_at: string;
  referred_customer?: {
    name: string;
    phone: string;
  };
  order?: {
    id: string;
    total: number;
  };
}

const CustomerReferrals = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companySlug, setCompanySlug] = useState<string | null>(null);
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [referralCodes, setReferralCodes] = useState<ReferralCode[]>([]);
  const [referralUsages, setReferralUsages] = useState<ReferralUsage[]>([]);
  const [copied, setCopied] = useState(false);

  // Form state
  const [isEnabled, setIsEnabled] = useState(false);
  const [referrerDiscount, setReferrerDiscount] = useState(10);
  const [referredDiscount, setReferredDiscount] = useState(10);
  const [maxUsesReferrer, setMaxUsesReferrer] = useState(10);
  const [maxUsesReferred, setMaxUsesReferred] = useState(1);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Get company
        const { data: company, error: companyError } = await supabase
          .from("companies")
          .select("id, slug")
          .eq("owner_id", user.id)
          .limit(1)
          .maybeSingle();

        if (companyError) throw companyError;
        if (!company) {
          setLoading(false);
          return;
        }

        setCompanyId(company.id);
        setCompanySlug(company.slug);

        // Load settings, codes, and usages in parallel
        const [settingsRes, codesRes, usagesRes] = await Promise.all([
          supabase
            .from("customer_referral_settings")
            .select("*")
            .eq("company_id", company.id)
            .maybeSingle(),
          supabase
            .from("customer_referral_codes")
            .select(`
              *,
              customer:customer_id (name, phone)
            `)
            .eq("company_id", company.id)
            .order("total_referrals", { ascending: false })
            .limit(50),
          supabase
            .from("customer_referral_usage")
            .select(`
              *,
              referred_customer:referred_customer_id (name, phone),
              order:order_id (id, total)
            `)
            .eq("company_id", company.id)
            .order("created_at", { ascending: false })
            .limit(100),
        ]);

        if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw settingsRes.error;
        if (codesRes.error) throw codesRes.error;
        if (usagesRes.error) throw usagesRes.error;

        if (settingsRes.data) {
          setSettings(settingsRes.data);
          setIsEnabled(settingsRes.data.is_enabled || false);
          setReferrerDiscount(Number(settingsRes.data.referrer_discount_percent) || 10);
          setReferredDiscount(Number(settingsRes.data.referred_discount_percent) || 10);
          setMaxUsesReferrer(settingsRes.data.max_uses_per_referrer || 10);
          setMaxUsesReferred(settingsRes.data.max_uses_per_referred || 1);
        }

        setReferralCodes((codesRes.data || []) as ReferralCode[]);
        setReferralUsages((usagesRes.data || []) as ReferralUsage[]);
      } catch (error: any) {
        console.error("Error loading referral data:", error);
        toast({
          title: "Erro ao carregar dados",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, toast]);

  const handleSaveSettings = async () => {
    if (!companyId) return;

    try {
      setSaving(true);

      const settingsData = {
        company_id: companyId,
        is_enabled: isEnabled,
        referrer_discount_percent: referrerDiscount,
        referred_discount_percent: referredDiscount,
        max_uses_per_referrer: maxUsesReferrer,
        max_uses_per_referred: maxUsesReferred,
      };

      if (settings?.id) {
        // Update
        const { error } = await supabase
          .from("customer_referral_settings")
          .update(settingsData)
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from("customer_referral_settings")
          .insert(settingsData);

        if (error) throw error;
      }

      toast({
        title: "Configurações salvas",
        description: "As configurações de indicação foram atualizadas com sucesso.",
      });
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const referralLink = companySlug 
    ? `https://s.cardpondelivery.com/${companySlug}?ref=CODIGO_DO_CLIENTE`
    : null;

  const handleCopyLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Link copiado!",
        description: "O modelo do link foi copiado para a área de transferência.",
      });
    }
  };

  // Stats
  const totalReferrals = useMemo(() => 
    referralCodes.reduce((sum, code) => sum + (code.total_referrals || 0), 0),
    [referralCodes]
  );

  const totalDiscountGiven = useMemo(() =>
    referralUsages.reduce((sum, usage) => 
      sum + Number(usage.discount_applied || 0) + Number(usage.referrer_discount_applied || 0), 0
    ),
    [referralUsages]
  );

  const activeReferrers = referralCodes.filter(code => code.total_referrals > 0).length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!companyId) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Indicações de Clientes</h1>
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Você precisa ter uma empresa cadastrada para usar o sistema de indicações.
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Indicações de Clientes</h1>
          <p className="text-muted-foreground text-sm max-w-3xl">
            Configure descontos para incentivar seus clientes a indicarem seu cardápio para amigos.
            Quando alguém acessa pelo link de indicação, ambos ganham desconto!
          </p>
        </header>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Indicações</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalReferrals}</div>
              <p className="text-xs text-muted-foreground">
                {activeReferrers} clientes ativos indicando
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Descontos Concedidos</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalDiscountGiven.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Em descontos para indicadores e indicados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${isEnabled ? 'text-green-600' : 'text-muted-foreground'}`}>
                {isEnabled ? 'Ativo' : 'Inativo'}
              </div>
              <p className="text-xs text-muted-foreground">
                {isEnabled ? 'Clientes podem indicar' : 'Sistema de indicações desativado'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" />
              Configurações de Desconto
            </CardTitle>
            <CardDescription>
              Configure os percentuais de desconto para quem indica e quem é indicado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">Ativar indicações</Label>
                <p className="text-sm text-muted-foreground">
                  Quando ativado, clientes podem gerar seus links de indicação
                </p>
              </div>
              <Switch
                id="enabled"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="referred-discount">
                  Desconto para quem é indicado (%)
                </Label>
                <Input
                  id="referred-discount"
                  type="number"
                  min="0"
                  max="100"
                  value={referredDiscount}
                  onChange={(e) => setReferredDiscount(Number(e.target.value))}
                  placeholder="10"
                />
                <p className="text-xs text-muted-foreground">
                  Desconto que o novo cliente recebe ao acessar pelo link
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="referrer-discount">
                  Desconto para quem indicou (%)
                </Label>
                <Input
                  id="referrer-discount"
                  type="number"
                  min="0"
                  max="100"
                  value={referrerDiscount}
                  onChange={(e) => setReferrerDiscount(Number(e.target.value))}
                  placeholder="10"
                />
                <p className="text-xs text-muted-foreground">
                  Crédito de desconto que o indicador recebe no próximo pedido
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="max-referred">
                  Limite de uso por indicado
                </Label>
                <Input
                  id="max-referred"
                  type="number"
                  min="1"
                  max="100"
                  value={maxUsesReferred}
                  onChange={(e) => setMaxUsesReferred(Number(e.target.value))}
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground">
                  Quantas vezes o desconto pode ser usado pelo novo cliente
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-referrer">
                  Limite de indicações por cliente
                </Label>
                <Input
                  id="max-referrer"
                  type="number"
                  min="1"
                  max="1000"
                  value={maxUsesReferrer}
                  onChange={(e) => setMaxUsesReferrer(Number(e.target.value))}
                  placeholder="10"
                />
                <p className="text-xs text-muted-foreground">
                  Quantas pessoas cada cliente pode indicar
                </p>
              </div>
            </div>

            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar Configurações
            </Button>
          </CardContent>
        </Card>

        {/* Link Example */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Como funciona o link
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cada cliente logado no seu cardápio terá seu próprio link de indicação. 
              O link terá o formato abaixo, onde o código é gerado automaticamente para cada cliente:
            </p>
            
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs md:text-sm font-mono break-all">
                {referralLink || "Configure o slug da sua loja primeiro"}
              </div>
              {referralLink && (
                <Button variant="outline" size="icon" onClick={handleCopyLink}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              )}
            </div>

            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium">Fluxo de indicação:</p>
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                <li>Cliente acessa sua conta no cardápio e pega seu link de indicação</li>
                <li>Ele compartilha o link com amigos via WhatsApp, Instagram, etc.</li>
                <li>O amigo acessa pelo link e faz um pedido com {referredDiscount}% de desconto</li>
                <li>O indicador recebe {referrerDiscount}% de crédito para usar no próximo pedido</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Top Referrers */}
        {referralCodes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Maiores Indicadores</CardTitle>
              <CardDescription>
                Clientes que mais indicaram seu cardápio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead className="text-right">Indicações</TableHead>
                      <TableHead className="text-right">Desconto Gerado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referralCodes.slice(0, 10).map((code) => (
                      <TableRow key={code.id}>
                        <TableCell className="font-medium">
                          {code.customer?.name || "Cliente"}
                        </TableCell>
                        <TableCell>{code.customer?.phone || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{code.code}</TableCell>
                        <TableCell className="text-right">{code.total_referrals}</TableCell>
                        <TableCell className="text-right">
                          R$ {Number(code.total_discount_given || 0).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Referrals */}
        {referralUsages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Últimas Indicações</CardTitle>
              <CardDescription>
                Histórico recente de indicações e descontos aplicados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente Indicado</TableHead>
                      <TableHead className="text-right">Desconto no Pedido</TableHead>
                      <TableHead className="text-right">Crédito do Indicador</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referralUsages.slice(0, 20).map((usage) => (
                      <TableRow key={usage.id}>
                        <TableCell>
                          {new Date(usage.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {usage.referred_customer?.name || "Cliente"}
                        </TableCell>
                        <TableCell className="text-right">
                          R$ {Number(usage.discount_applied || 0).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          R$ {Number(usage.referrer_discount_applied || 0).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CustomerReferrals;
