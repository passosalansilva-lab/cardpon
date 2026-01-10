import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoCardapioOnDefault from "@/assets/logo-cardapio-on-new.png";

type LogoLocation = "sidebar" | "landing" | "public_menu";

// Cache logos to avoid flicker on navigation
const cachedLogos: Record<string, string | null> = {};

export function useSystemLogo(location: LogoLocation = "sidebar") {
  const key = `logo_${location}`;
  const [logoUrl, setLogoUrl] = useState<string>(cachedLogos[key] || logoCardapioOnDefault);
  const [loading, setLoading] = useState(!cachedLogos[key]);

  useEffect(() => {
    // If we already have a cached logo for this location, use it
    if (cachedLogos[key]) {
      setLogoUrl(cachedLogos[key]!);
      setLoading(false);
      return;
    }

    const fetchLogo = async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();

      if (!error && data?.value) {
        cachedLogos[key] = data.value;
        setLogoUrl(data.value);
      } else {
        // Fallback to default if no custom logo
        cachedLogos[key] = logoCardapioOnDefault;
        setLogoUrl(logoCardapioOnDefault);
      }
      setLoading(false);
    };

    fetchLogo();
  }, [key]);

  return { logoUrl, loading };
}

// Helper to clear cache (useful when logos are updated)
export function clearSystemLogoCache() {
  Object.keys(cachedLogos).forEach(key => {
    delete cachedLogos[key];
  });
}
