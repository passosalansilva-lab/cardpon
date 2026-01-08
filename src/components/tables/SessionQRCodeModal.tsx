import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, QrCode, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface SessionQRCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionToken: string | null;
  tableNumber: number;
  tableName: string | null;
  companySlug: string;
}

export function SessionQRCodeModal({
  open,
  onOpenChange,
  sessionToken,
  tableNumber,
  tableName,
  companySlug,
}: SessionQRCodeModalProps) {
  const { toast } = useToast();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const sessionUrl = sessionToken 
    ? `${window.location.origin}/menu/${companySlug}?sessao=${sessionToken}`
    : null;

  useEffect(() => {
    if (!open || !sessionUrl) return;

    const generateQRCode = async () => {
      setGenerating(true);
      try {
        const dataUrl = await QRCode.toDataURL(sessionUrl, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
        setQrCode(dataUrl);
      } catch (err) {
        console.error('Error generating QR code:', err);
      } finally {
        setGenerating(false);
      }
    };

    generateQRCode();
  }, [open, sessionUrl]);

  const handleCopyLink = async () => {
    if (!sessionUrl) return;
    
    try {
      await navigator.clipboard.writeText(sessionUrl);
      setCopied(true);
      toast({ title: 'Link copiado!' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  if (!sessionToken) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code da Mesa {tableNumber}
            {tableName && ` - ${tableName}`}
          </DialogTitle>
          <DialogDescription>
            Mostre este QR code para o cliente fazer pedidos direto do celular. 
            Este link é válido apenas enquanto a mesa estiver aberta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {generating ? (
            <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : qrCode ? (
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <img 
                src={qrCode} 
                alt={`QR Code Mesa ${tableNumber}`}
                className="w-56 h-56"
              />
            </div>
          ) : null}

          <div className="w-full space-y-2">
            <p className="text-xs text-muted-foreground text-center break-all px-4">
              {sessionUrl}
            </p>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleCopyLink}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar link
                </>
              )}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="font-medium text-amber-700 dark:text-amber-400">Link único e seguro</p>
            <p className="mt-1">Este link só funciona enquanto a sessão estiver ativa. 
            Quando a mesa for fechada, o link expira automaticamente.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
