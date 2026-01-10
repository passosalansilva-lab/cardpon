import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type ChromaKeyImageProps = {
  src: string;
  alt: string;
  className?: string;
  /** Remove pixels muito claros (fundo) tornando-os transparentes */
  lightnessThreshold?: number; // 0-255
};

export function ChromaKeyImage({
  src,
  alt,
  className,
  lightnessThreshold = 235,
}: ChromaKeyImageProps) {
  const [processedSrc, setProcessedSrc] = useState<string | null>(null);

  const threshold = useMemo(
    () => Math.min(255, Math.max(0, lightnessThreshold)),
    [lightnessThreshold]
  );

  useEffect(() => {
    let cancelled = false;

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Remove pixels muito claros (brancos/cinzas do fundo)
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const isNearGray = max - min < 18;

          if (isNearGray && r >= threshold && g >= threshold && b >= threshold) {
            data[i + 3] = 0; // alpha
          }
        }

        ctx.putImageData(imageData, 0, 0);
        const out = canvas.toDataURL("image/png");
        if (!cancelled) setProcessedSrc(out);
      } catch {
        if (!cancelled) setProcessedSrc(null);
      }
    };

    img.onerror = () => {
      if (!cancelled) setProcessedSrc(null);
    };

    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src, threshold]);

  return (
    <img
      src={processedSrc ?? src}
      alt={alt}
      className={cn("object-contain", className)}
      loading="lazy"
      decoding="async"
    />
  );
}
