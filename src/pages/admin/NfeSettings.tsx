import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Shield, AlertTriangle, CheckCircle2, Eye, EyeOff } from "lucide-react";

interface NfeSettings {
  id: string;
  focus_nfe_token: string | null;
  environment: string;
  is_enabled: boolean;
}

export default function NfeSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NfeSettings | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [formData, setFormData] = useState({
    focus_nfe_token: "",
    environment: "homologation",
    is_enabled: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("nfe_global_settings")
        .select("*")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setSettings(data);
        setFormData({
          focus_nfe_token: data.focus_nfe_token || "",
          environment: data.environment || "homologation",
          is_enabled: data.is_enabled || false,
        });
      }
    } catch (error) {
      console.error("Error loading NFe settings:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("nfe_global_settings")
        .update({
          focus_nfe_token: formData.focus_nfe_token || null,
          environment: formData.environment,
          is_enabled: formData.is_enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);

      if (error) throw error;

      toast.success("Configurações salvas com sucesso!");
      loadSettings();
    } catch (error) {
      console.error("Error saving NFe settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Nota Fiscal Eletrônica</h1>
            <p className="text-muted-foreground">
              Configure a integração com o Focus NFe para emissão de notas fiscais
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Status da Integração
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {formData.is_enabled ? (
                  <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Ativo
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Inativo
                  </Badge>
                )}
                <Badge variant="outline">
                  Ambiente: {formData.environment === "production" ? "Produção" : "Homologação"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Focus NFe</CardTitle>
              <CardDescription>
                Insira as credenciais da sua conta Focus NFe para habilitar a emissão de notas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  As credenciais inseridas aqui serão utilizadas por todos os lojistas da plataforma.
                  Certifique-se de que a conta Focus NFe possui limite suficiente para todas as emissões.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="token">Token de Acesso Focus NFe</Label>
                  <div className="relative">
                    <Input
                      id="token"
                      type={showToken ? "text" : "password"}
                      value={formData.focus_nfe_token}
                      onChange={(e) =>
                        setFormData({ ...formData, focus_nfe_token: e.target.value })
                      }
                      placeholder="Insira o token da API Focus NFe"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Obtenha o token no painel do Focus NFe em Configurações → API
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="environment">Ambiente</Label>
                  <Select
                    value={formData.environment}
                    onValueChange={(value) =>
                      setFormData({ ...formData, environment: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homologation">
                        Homologação (Testes)
                      </SelectItem>
                      <SelectItem value="production">
                        Produção
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Use homologação para testes. Mude para produção apenas quando estiver pronto.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Habilitar Emissão de NF-e</Label>
                    <p className="text-sm text-muted-foreground">
                      Quando ativo, os lojistas poderão emitir notas fiscais para pedidos entregues
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_enabled: checked })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar Configurações
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Importantes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium">Requisitos Legais</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• CNPJ ativo e regular</li>
                    <li>• Inscrição Estadual (IE)</li>
                    <li>• Certificado Digital A1 ou A3</li>
                    <li>• Credenciamento na SEFAZ</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Tipos de Nota Suportados</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• NFC-e (Nota Fiscal ao Consumidor)</li>
                    <li>• NF-e (Nota Fiscal Eletrônica)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
