import { useEffect, useState } from 'react';

const STORAGE_PREFIX = 'menupro_favorites_';

export function useFavorites(companyId: string | null) {
  const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setFavoriteProductIds([]);
      return;
    }

    setLoading(true);
    try {
      if (typeof window === 'undefined') {
        setFavoriteProductIds([]);
        return;
      }

      const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${companyId}`);
      if (!raw) {
        setFavoriteProductIds([]);
      } else {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setFavoriteProductIds(parsed.filter((id) => typeof id === 'string'));
        } else {
          setFavoriteProductIds([]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar favoritos do cliente:', error);
      setFavoriteProductIds([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const toggleFavorite = (productId: string) => {
    if (!companyId) return;

    setFavoriteProductIds((prev) => {
      const isFavorite = prev.includes(productId);
      const next = isFavorite
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];

      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(`${STORAGE_PREFIX}${companyId}` , JSON.stringify(next));
        }
      } catch (error) {
        console.error('Erro ao salvar favoritos do cliente:', error);
      }

      return next;
    });
  };

  return {
    favoriteProductIds,
    toggleFavorite,
    loading,
  };
}
