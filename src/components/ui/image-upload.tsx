import { useState, useRef } from 'react';
import { Upload, X, Loader2, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ImageGalleryModal } from './image-gallery-modal';

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder: string;
  aspectRatio?: 'square' | 'video' | 'banner';
  className?: string;
  showGallery?: boolean;
  companyId?: string;
}

export function ImageUpload({
  value,
  onChange,
  folder,
  aspectRatio = 'square',
  className,
  showGallery = false,
  companyId,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const aspectClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    banner: 'aspect-[3/1]',
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'A imagem deve ter no máximo 5MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      onChange(publicUrl);
      toast({
        title: 'Imagem enviada',
        description: 'A imagem foi enviada com sucesso',
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Erro no upload',
        description: error.message || 'Não foi possível enviar a imagem',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    onChange(null);
  };

  return (
    <div className={cn('relative', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {value ? (
        <div className={cn('relative rounded-xl overflow-hidden border border-border', aspectClasses[aspectRatio])}>
          <img
            src={value}
            alt="Preview"
            className="w-full h-full object-cover"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              'w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground',
              aspectClasses[aspectRatio],
              uploading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <>
                <Upload className="h-8 w-8" />
                <span className="text-sm">Clique para enviar</span>
              </>
            )}
          </button>
          
          {showGallery && companyId && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setGalleryOpen(true)}
            >
              <Images className="h-4 w-4 mr-2" />
              Escolher da galeria
            </Button>
          )}
        </div>
      )}

      {showGallery && companyId && (
        <ImageGalleryModal
          open={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          onSelect={onChange}
          companyId={companyId}
        />
      )}
    </div>
  );
}