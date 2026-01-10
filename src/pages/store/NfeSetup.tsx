import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Upload, 
  FileCheck, 
  Shield, 
  Building2, 
  Key, 
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Info,
  FileWarning
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NfeCompanySettings {
  id: string;
  company_id: string;
  certificate_path: string | null;
  certificate_password: string | null;
  certificate_expires_at: string | null;
  csc_id: string | null;
  csc_token: string | null;
  serie_nfce: number;
  numero_atual_nfce: number;
  ambiente: string;
  is_configured: boolean;
}

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  razao_social: string | null;
  inscricao_estadual: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

export default function NfeSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [settings, setSettings] = useState<NfeCompanySettings | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    certificate_password: "",
    csc_id: "",
    csc_token: "",
    serie_nfce: 1,
    numero_atual_nfce: 1,
    ambiente: "homologation"
  });

  const loadData = useCallback(async () => {
    if (!user) return;
    
    try {
      // Load company
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("id, name, cnpj, razao_social, inscricao_estadual, address, city, state, zip_code")
        .eq("owner_id", user.id)
        .single();

      if (companyError) throw companyError;
      setCompany(companyData);

      // Load NFe settings
      const { data: settingsData } = await supabase
        .from("nfe_company_settings")
        .select("*")
        .eq("company_id", companyData.id)
        .single();

      if (settingsData) {
        setSettings(settingsData);
        setFormData({
          certificate_password: settingsData.certificate_password || "",
          csc_id: settingsData.csc_id || "",
          csc_token: settingsData.csc_token || "",
          serie_nfce: settingsData.serie_nfce || 1,
          numero_atual_nfce: settingsData.numero_atual_nfce || 1,
          ambiente: settingsData.ambiente || "homologation"
        });
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.pfx') && !file.name.endsWith('.p12')) {
        toast.error("O certificado deve ser um arquivo .pfx ou .p12");
        return;
      }
      setCertificateFile(file);
    }
  };

  const uploadCertificate = async (): Promise<string | null> => {
    if (!certificateFile || !company) return null;
    
    setUploading(true);
    try {
      const fileExt = certificateFile.name.split('.').pop();
      const filePath = `${company.id}/certificate.${fileExt}`;

      // Delete existing certificate if any
      if (settings?.certificate_path) {
        await supabase.storage
          .from("certificates")
          .remove([settings.certificate_path]);
      }

      const { error: uploadError } = await supabase.storage
        .from("certificates")
        .upload(filePath, certificateFile, { upsert: true });

      if (uploadError) throw uploadError;

      return filePath;
    } catch (error) {
      console.error("Error uploading certificate:", error);
      toast.error("Erro ao fazer upload do certificado");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!company) return;
    
    // Validate required company data
    if (!company.cnpj) {
      toast.error("Configure o CNPJ da empresa nas configurações da loja primeiro");
      return;
    }

    setSaving(true);
    try {
      let certificatePath = settings?.certificate_path || null;
      
      // Upload certificate if selected
      if (certificateFile) {
        const uploadedPath = await uploadCertificate();
        if (uploadedPath) {
          certificatePath = uploadedPath;
        }
      }

      const settingsPayload = {
        company_id: company.id,
        certificate_path: certificatePath,
        certificate_password: formData.certificate_password || null,
        csc_id: formData.csc_id || null,
        csc_token: formData.csc_token || null,
        serie_nfce: formData.serie_nfce,
        numero_atual_nfce: formData.numero_atual_nfce,
        ambiente: formData.ambiente,
        is_configured: !!certificatePath && !!formData.certificate_password
      };

      if (settings) {
        // Update existing
        const { error } = await supabase
          .from("nfe_company_settings")
          .update(settingsPayload)
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("nfe_company_settings")
          .insert(settingsPayload);

        if (error) throw error;
      }

      toast.success("Configurações de NFe salvas com sucesso!");
      setCertificateFile(null);
      loadData();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const getConfigurationStatus = () => {
    if (!settings) return { status: "not_started", label: "Não configurado", color: "destructive" as const };
    if (!settings.certificate_path) return { status: "no_cert", label: "Sem certificado", color: "destructive" as const };
    if (!settings.certificate_password) return { status: "no_password", label: "Senha pendente", color: "secondary" as const };
    if (settings.is_configured) return { status: "configured", label: "Configurado", color: "default" as const };
    return { status: "partial", label: "Parcial", color: "secondary" as const };
  };

  const configStatus = getConfigurationStatus();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const missingCompanyData = !company?.cnpj || !company?.razao_social || !company?.inscricao_estadual;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Configuração de NFe</h1>
            <p className="text-muted-foreground">
              Configure seu certificado digital e dados fiscais para emissão de NFCe
            </p>
          </div>
          <Badge variant={configStatus.color}>
            {configStatus.label}
          </Badge>
        </div>

        {/* Company Fiscal Data Warning */}
        {missingCompanyData && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="flex items-start gap-4 pt-6">
              <AlertTriangle className="h-6 w-6 text-yellow-600 shrink-0" />
              <div className="space-y-2">
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                  Dados fiscais incompletos
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Para emitir NFe, você precisa configurar os dados fiscais da empresa:
                </p>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-1">
                  {!company?.cnpj && <li>CNPJ</li>}
                  {!company?.razao_social && <li>Razão Social</li>}
                  {!company?.inscricao_estadual && <li>Inscrição Estadual</li>}
                </ul>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => navigate("/store/settings?tab=fiscal")}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Ir para Configurações da Loja
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Company Info Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Dados da Empresa
            </CardTitle>
            <CardDescription>
              Informações fiscais que serão usadas na emissão da NFe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs">Razão Social</Label>
                <p className="font-medium">{company?.razao_social || "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">CNPJ</Label>
                <p className="font-medium">{company?.cnpj || "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Inscrição Estadual</Label>
                <p className="font-medium">{company?.inscricao_estadual || "-"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Endereço</Label>
                <p className="font-medium">
                  {company?.address ? `${company.address}, ${company.city}/${company.state}` : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Certificate Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Certificado Digital A1
            </CardTitle>
            <CardDescription>
              Faça upload do seu certificado digital para assinar as notas fiscais
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings?.certificate_path ? (
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <FileCheck className="h-6 w-6 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    Certificado instalado
                  </p>
                  {settings.certificate_expires_at && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Válido até {format(new Date(settings.certificate_expires_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Ativo
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg border border-dashed">
                <FileWarning className="h-6 w-6 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">Nenhum certificado instalado</p>
                  <p className="text-sm text-muted-foreground">
                    Faça upload do arquivo .pfx ou .p12 do seu certificado A1
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="certificate">
                {settings?.certificate_path ? "Substituir certificado" : "Upload do certificado"}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="certificate"
                  type="file"
                  accept=".pfx,.p12"
                  onChange={handleFileChange}
                  className="flex-1"
                />
                {certificateFile && (
                  <Badge variant="secondary" className="shrink-0">
                    {certificateFile.name}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="certificate_password">Senha do certificado</Label>
              <Input
                id="certificate_password"
                type="password"
                placeholder="Digite a senha do certificado A1"
                value={formData.certificate_password}
                onChange={(e) => setFormData(prev => ({ ...prev, certificate_password: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* CSC Configuration (for NFCe) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Código de Segurança do Contribuinte (CSC)
            </CardTitle>
            <CardDescription>
              Necessário para emissão de NFCe - obtido no portal da SEFAZ do seu estado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                O CSC (Código de Segurança do Contribuinte) é um código gerado pela SEFAZ do seu estado. 
                Acesse o portal da SEFAZ e solicite o CSC para emissão de NFCe.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="csc_id">ID do CSC</Label>
                <Input
                  id="csc_id"
                  placeholder="Ex: 1"
                  value={formData.csc_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, csc_id: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="csc_token">Token do CSC</Label>
                <Input
                  id="csc_token"
                  type="password"
                  placeholder="Token fornecido pela SEFAZ"
                  value={formData.csc_token}
                  onChange={(e) => setFormData(prev => ({ ...prev, csc_token: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NFCe Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações de Numeração</CardTitle>
            <CardDescription>
              Série e número inicial das notas fiscais
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serie_nfce">Série NFCe</Label>
                <Input
                  id="serie_nfce"
                  type="number"
                  min="1"
                  value={formData.serie_nfce}
                  onChange={(e) => setFormData(prev => ({ ...prev, serie_nfce: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numero_atual_nfce">Próximo Número</Label>
                <Input
                  id="numero_atual_nfce"
                  type="number"
                  min="1"
                  value={formData.numero_atual_nfce}
                  onChange={(e) => setFormData(prev => ({ ...prev, numero_atual_nfce: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ambiente">Ambiente</Label>
                <Select
                  value={formData.ambiente}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, ambiente: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homologation">Homologação (testes)</SelectItem>
                    <SelectItem value="production">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.ambiente === "production" && (
              <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  <strong>Atenção:</strong> Em ambiente de produção, as notas fiscais emitidas têm validade jurídica. 
                  Certifique-se de que todos os dados estão corretos antes de emitir.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate("/store/nfe")}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || uploading || missingCompanyData}
          >
            {(saving || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {uploading ? "Enviando certificado..." : saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
