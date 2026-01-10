import { useState, useRef } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AvatarUploadProps {
  currentUrl?: string | null;
  fallback: string;
  onUpload: (file: File) => Promise<string | null>;
  onRemove?: () => Promise<void>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-16 w-16',
  md: 'h-24 w-24',
  lg: 'h-32 w-32',
};

export function AvatarUpload({
  currentUrl,
  fallback,
  onUpload,
  onRemove,
  size = 'md',
  className,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    setUploading(true);
    try {
      await onRemove();
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const displayUrl = previewUrl || currentUrl;

  return (
    <div className={cn('relative inline-block', className)}>
      <Avatar className={cn(sizeClasses[size], 'border-2 border-border')}>
        <AvatarImage src={displayUrl || undefined} className="object-cover" />
        <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
          {fallback}
        </AvatarFallback>
      </Avatar>

      {/* Upload overlay */}
      <button
        type="button"
        onClick={handleClick}
        disabled={uploading}
        className={cn(
          'absolute inset-0 flex items-center justify-center rounded-full',
          'bg-black/50 opacity-0 hover:opacity-100 transition-opacity',
          'cursor-pointer disabled:cursor-not-allowed',
          uploading && 'opacity-100'
        )}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 text-white animate-spin" />
        ) : (
          <Camera className="h-6 w-6 text-white" />
        )}
      </button>

      {/* Remove button */}
      {displayUrl && onRemove && !uploading && (
        <button
          type="button"
          onClick={handleRemove}
          className="absolute -top-1 -right-1 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
