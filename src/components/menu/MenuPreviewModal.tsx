import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Smartphone, Monitor, Tablet, ExternalLink, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuPreviewModalProps {
  open: boolean;
  onClose: () => void;
  menuUrl: string;
}

type DeviceMode = 'mobile' | 'tablet' | 'desktop';

const devices: { id: DeviceMode; label: string; icon: typeof Smartphone; width: number; height: number }[] = [
  { id: 'mobile', label: 'Mobile', icon: Smartphone, width: 390, height: 844 },
  { id: 'tablet', label: 'Tablet', icon: Tablet, width: 820, height: 1180 },
  { id: 'desktop', label: 'Desktop', icon: Monitor, width: 1440, height: 900 },
];

export function MenuPreviewModal({ open, onClose, menuUrl }: MenuPreviewModalProps) {
  const [selectedDevice, setSelectedDevice] = useState<DeviceMode>('mobile');
  const fullUrl = `${window.location.origin}${menuUrl}?preview=1`;

  const handleOpenPreview = () => {
    const device = devices.find((d) => d.id === selectedDevice)!;
    const left = (window.screen.width - device.width) / 2;
    const top = (window.screen.height - device.height) / 2;

    window.open(
      fullUrl,
      `menu_preview`,
      `width=${device.width},height=${device.height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Preview do Cardápio
          </DialogTitle>
          <DialogDescription>
            Visualize como seu cardápio aparece para os clientes
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Device selector */}
          <p className="text-sm font-medium mb-3">Escolha o dispositivo:</p>
          <div className="grid grid-cols-3 gap-3">
            {devices.map((device) => {
              const Icon = device.icon;
              const isSelected = selectedDevice === device.id;
              return (
                <button
                  key={device.id}
                  onClick={() => setSelectedDevice(device.id)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center rounded-lg transition-colors',
                      device.id === 'mobile' && 'w-8 h-14 border-2',
                      device.id === 'tablet' && 'w-12 h-16 border-2 rounded-xl',
                      device.id === 'desktop' && 'w-16 h-10 border-2 rounded-lg',
                      isSelected ? 'border-primary bg-primary/10' : 'border-muted-foreground/30 bg-muted/30'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 transition-colors',
                        isSelected ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      'text-sm font-medium transition-colors',
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {device.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={handleOpenPreview} className="w-full gap-2">
            <ExternalLink className="h-4 w-4" />
            Abrir Preview
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Abre em uma janela com as dimensões do dispositivo selecionado
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
