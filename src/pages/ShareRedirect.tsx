import { useEffect } from "react";
import { useParams } from "react-router-dom";

const ShareRedirect = () => {
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    if (slug) {
      // Fallback (quando o Worker não intercepta): chama a function que devolve HTML com OG tags.
      // IMPORTANT: passar o slug no PATH (e não no query) evita perda de parâmetros em alguns proxies/caches.
      const backendBase = import.meta.env.VITE_SUPABASE_URL;
      const origin = encodeURIComponent(window.location.origin);
      const safeSlug = encodeURIComponent(slug);
      window.location.replace(
        `${backendBase}/functions/v1/menu-share-meta/${safeSlug}?origin=${origin}`,
      );
    }
  }, [slug]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecionando...</p>
      </div>
    </div>
  );
};

export default ShareRedirect;
