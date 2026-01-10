import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';

export default function EmailSignature() {
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState({
    name: 'Contato Cardápio On',
    role: 'Suporte ao Cliente',
    phone: '(00) 00000-0000',
    email: 'contato@cardapioon.com.br',
    website: 'cardapioon.com.br',
    instagram: '@cardapioon',
    logoUrl: 'https://gwixvxdwhpjlllhnnnev.supabase.co/storage/v1/object/public/assets/logo-cardapio-on.png',
  });

  const signatureHTML = `
<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #292524;">
  <tr>
    <td style="padding-right: 20px; border-right: 3px solid #f59e0b; vertical-align: top;">
      <a href="https://${config.website}" target="_blank" style="display: block;">
        <img src="${config.logoUrl}" alt="Cardápio On" width="80" style="display: block;" />
      </a>
    </td>
    <td style="padding-left: 20px; vertical-align: top;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-size: 18px; font-weight: bold; color: #292524; padding-bottom: 2px;">
            ${config.name}
          </td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: #78716c; padding-bottom: 12px;">
            ${config.role}
          </td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: #57534e; padding-bottom: 4px;">
            <span style="color: #f59e0b; font-weight: bold;">✆</span>&nbsp;&nbsp;${config.phone}
          </td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: #57534e; padding-bottom: 4px;">
            <span style="color: #f59e0b; font-weight: bold;">✉</span>&nbsp;&nbsp;<a href="mailto:${config.email}" style="color: #57534e; text-decoration: none;">${config.email}</a>
          </td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: #57534e; padding-bottom: 4px;">
            <span style="color: #f59e0b; font-weight: bold;">🌐</span>&nbsp;&nbsp;<a href="https://${config.website}" style="color: #f59e0b; text-decoration: none; font-weight: 500;">${config.website}</a>
          </td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: #57534e;">
            <span style="color: #f59e0b; font-weight: bold;">📷</span>&nbsp;&nbsp;<a href="https://instagram.com/${config.instagram.replace('@', '')}" style="color: #57534e; text-decoration: none;">${config.instagram}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td colspan="2" style="padding-top: 16px;">
      <table cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(90deg, #fef3c7 0%, #fde68a 100%); border-radius: 8px; padding: 12px 16px;">
        <tr>
          <td style="font-size: 12px; color: #92400e;">
            <strong>🍕 Cardápio On</strong> — A plataforma completa para seu delivery
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  `.trim();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(signatureHTML);
      setCopied(true);
      toast.success('Código HTML copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-stone-900 mb-2">Assinatura de E-mail</h1>
        <p className="text-stone-600 mb-8">Personalize e copie o código HTML para usar no seu cliente de e-mail.</p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Config */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
            <h2 className="font-semibold text-stone-900 mb-4">Configurações</h2>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input 
                  value={config.name} 
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Cargo</Label>
                <Input 
                  value={config.role} 
                  onChange={(e) => setConfig({ ...config, role: e.target.value })}
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input 
                  value={config.phone} 
                  onChange={(e) => setConfig({ ...config, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input 
                  value={config.email} 
                  onChange={(e) => setConfig({ ...config, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Website</Label>
                <Input 
                  value={config.website} 
                  onChange={(e) => setConfig({ ...config, website: e.target.value })}
                />
              </div>
              <div>
                <Label>Instagram</Label>
                <Input 
                  value={config.instagram} 
                  onChange={(e) => setConfig({ ...config, instagram: e.target.value })}
                />
              </div>
              <div>
                <Label>URL da Logo</Label>
                <Input 
                  value={config.logoUrl} 
                  onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <h2 className="font-semibold text-stone-900 mb-4">Preview</h2>
              <div 
                className="p-4 bg-stone-50 rounded-lg"
                dangerouslySetInnerHTML={{ __html: signatureHTML }}
              />
            </div>

            <Button 
              onClick={copyToClipboard} 
              className="w-full bg-stone-900 hover:bg-stone-800"
              size="lg"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar código HTML
                </>
              )}
            </Button>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="font-medium text-amber-900 mb-2">Como usar no Gmail:</h3>
              <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
                <li>Copie o código HTML acima</li>
                <li>Abra o Gmail → Configurações → Ver todas as configurações</li>
                <li>Aba "Geral" → Seção "Assinatura"</li>
                <li>Crie uma nova assinatura e cole o código</li>
                <li>Salve as alterações</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
