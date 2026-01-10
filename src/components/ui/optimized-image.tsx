import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  fallback?: React.ReactNode;
}

/**
 * Optimized image component with:
 * - Lazy loading (only loads when in viewport)
 * - Skeleton placeholder while loading
 * - Smooth fade-in transition when loaded
 * - Error handling with fallback
 */
export function OptimizedImage({
  src,
  alt,
  className,
  containerClassName,
  fallback,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px', // Start loading 100px before entering viewport
        threshold: 0.01,
      }
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Reset states when src changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  if (hasError && fallback) {
    return <>{fallback}</>;
  }

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', containerClassName)}>
      {/* Skeleton placeholder */}
      <div
        className={cn(
          'absolute inset-0 bg-muted transition-opacity duration-300',
          isLoaded ? 'opacity-0' : 'opacity-100'
        )}
      />

      {/* Actual image - only render src when in view */}
      {isInView && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'transition-opacity duration-300 ease-out',
            isLoaded ? 'opacity-100' : 'opacity-0',
            className
          )}
        />
      )}
    </div>
  );
}
