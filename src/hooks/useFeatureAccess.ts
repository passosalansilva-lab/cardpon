import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Feature {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  is_active: boolean;
}

interface FeaturePricing {
  id: string;
  feature_id: string;
  price_type: string;
  price: number;
}

interface CompanyFeature {
  id: string;
  feature_id: string;
  price_type: string;
  expires_at: string | null;
  is_active: boolean;
}

interface FeatureAccess {
  hasAccess: boolean;
  source: 'plan' | 'purchased' | 'none';
  expiresAt?: string;
}

type FeatureAccessCache = {
  userId?: string;
  companyId: string | null;
  companyPlan: string;
  planFeatures: string[];
  companyFeatures: CompanyFeature[];
  allFeatures: Feature[];
  featurePricing: FeaturePricing[];
  savedAt: number;
};

const LAST_CACHE_KEY = 'featureAccessCache:last';

function readCache(key: string): FeatureAccessCache | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as FeatureAccessCache;
  } catch {
    return null;
  }
}

export function useFeatureAccess() {
  const { user } = useAuth();

  // Carrega cache imediatamente (no primeiro render) para evitar “some e volta” no sidebar.
  const initialCache = (() => {
    try {
      return readCache(LAST_CACHE_KEY);
    } catch {
      return null;
    }
  })();

  const [companyId, setCompanyId] = useState<string | null>(() => initialCache?.companyId ?? null);
  const [companyPlan, setCompanyPlan] = useState<string>(() => initialCache?.companyPlan || 'free');
  const [planFeatures, setPlanFeatures] = useState<string[]>(() => initialCache?.planFeatures || []);
  const [companyFeatures, setCompanyFeatures] = useState<CompanyFeature[]>(() => initialCache?.companyFeatures || []);
  const [allFeatures, setAllFeatures] = useState<Feature[]>(() => initialCache?.allFeatures || []);
  const [featurePricing, setFeaturePricing] = useState<FeaturePricing[]>(() => initialCache?.featurePricing || []);

  // `loading` para telas que precisam de spinner. Se tem cache, começa como false.
  const [loading, setLoading] = useState(() => !initialCache);
  const [hasCache, setHasCache] = useState(() => !!initialCache);

  const [accessCache, setAccessCache] = useState<Record<string, boolean>>({});

  const cacheKey = user?.id ? `featureAccessCache:${user.id}` : null;

  // Se houver cache específico do usuário, aplica (sem esperar nenhum fetch)
  useEffect(() => {
    if (!cacheKey) return;

    const userCache = readCache(cacheKey);
    if (!userCache) return;

    // Se for cache de outro usuário, ignora
    if (userCache.userId && userCache.userId !== user?.id) return;

    setCompanyId(userCache.companyId ?? null);
    setCompanyPlan(userCache.companyPlan || 'free');
    setPlanFeatures(Array.isArray(userCache.planFeatures) ? userCache.planFeatures : []);
    setCompanyFeatures(Array.isArray(userCache.companyFeatures) ? userCache.companyFeatures : []);
    setAllFeatures(Array.isArray(userCache.allFeatures) ? userCache.allFeatures : []);
    setFeaturePricing(Array.isArray(userCache.featurePricing) ? userCache.featurePricing : []);
    setHasCache(true);
    setLoading(false);
  }, [cacheKey, user?.id]);

  const persistCache = useCallback(
    (data: Omit<FeatureAccessCache, 'savedAt'>) => {
      try {
        const payload: FeatureAccessCache = { ...data, savedAt: Date.now() };

        // Cache por usuário (quando possível)
        if (cacheKey) {
          sessionStorage.setItem(cacheKey, JSON.stringify(payload));
        }

        // Cache “last” para evitar flicker mesmo quando o user ainda não reidratou
        sessionStorage.setItem(LAST_CACHE_KEY, JSON.stringify(payload));

        setHasCache(true);
      } catch {
        // ignore
      }
    },
    [cacheKey],
  );

const loadData = useCallback(async () => {
  if (!user) return;

  // Se não tem cache, vale mostrar loading; com cache, atualiza em background.
  if (!hasCache) setLoading(true);

  try {
    // Buscar empresa do usuário (owner ou staff)
    let company: { id: string; subscription_plan: string | null } | null = null;

    // Primeiro tenta como owner
    const { data: ownedCompany } = await supabase
      .from('companies')
      .select('id, subscription_plan')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (ownedCompany) {
      company = ownedCompany;
    } else {
      // Tenta como staff
      const { data: staffLink } = await supabase
        .from('company_staff')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (staffLink) {
        const { data: staffCompany } = await supabase
          .from('companies')
          .select('id, subscription_plan')
          .eq('id', staffLink.company_id)
          .maybeSingle();
        company = staffCompany;
      }
    }

    // Carregar todas as funcionalidades (ATIVAS e INATIVAS) - necessário p/ sidebar respeitar is_active
    const { data: features } = await supabase.from('system_features').select('*');
    const featuresList = (features || []) as Feature[];
    setAllFeatures(featuresList);

    // Carregar preços das funcionalidades (apenas preços ativos)
    const { data: pricing } = await supabase
      .from('feature_pricing')
      .select('*')
      .eq('is_active', true);

    const pricingList = (pricing || []) as FeaturePricing[];
    setFeaturePricing(pricingList);

    // Se o usuário não está vinculado a uma empresa (ex: super_admin puro), ainda assim precisamos
    // manter as features carregadas para o sidebar/UX.
    if (!company) {
      setCompanyId(null);
      setCompanyPlan('free');
      setPlanFeatures([]);
      setCompanyFeatures([]);

      persistCache({
        companyId: null,
        companyPlan: 'free',
        planFeatures: [],
        companyFeatures: [],
        allFeatures: featuresList,
        featurePricing: pricingList,
      });

      return;
    }

    setCompanyId(company.id);
    setCompanyPlan(company.subscription_plan || 'free');

    // Buscar funcionalidades do plano atual
    const planKey = company.subscription_plan || 'free';
    const { data: planData } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('key', planKey)
      .maybeSingle();

    let planFeatureKeys: string[] = [];
    if (planData) {
      const { data: planFeaturesData } = await supabase
        .from('plan_features')
        .select('feature_id')
        .eq('plan_id', planData.id);

      if (planFeaturesData && planFeaturesData.length > 0) {
        const featureIds = planFeaturesData.map((pf) => pf.feature_id);
        const { data: featureKeys } = await supabase
          .from('system_features')
          .select('key, is_active')
          .in('id', featureIds);

        planFeatureKeys =
          (featureKeys || [])
            .filter((f: any) => f.is_active === true)
            .map((f: any) => f.key) || [];

        setPlanFeatures(planFeatureKeys);
      } else {
        setPlanFeatures([]);
      }
    } else {
      setPlanFeatures([]);
    }

    // Buscar funcionalidades compradas pela empresa
    const { data: purchased } = await supabase
      .from('company_features')
      .select('*')
      .eq('company_id', company.id)
      .eq('is_active', true);

    const purchasedList = (purchased || []) as CompanyFeature[];
    setCompanyFeatures(purchasedList);

    persistCache({
      companyId: company.id,
      companyPlan: company.subscription_plan || 'free',
      planFeatures: planFeatureKeys,
      companyFeatures: purchasedList,
      allFeatures: featuresList,
      featurePricing: pricingList,
    });
  } catch (error) {
    console.error('Error loading feature access:', error);
  } finally {
    setLoading(false);
  }
}, [user, hasCache, persistCache]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, loadData]);

// Atualiza o sidebar imediatamente quando uma feature é ativada/desativada no admin
useEffect(() => {
  if (!user) return;

  const channel = supabase
    .channel(`feature-access:system-features:${user.id}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'system_features' },
      (payload: any) => {
        const row = (payload.new ?? payload.old) as any;
        if (!row?.key) return;

        if (payload.eventType === 'DELETE') {
          setAllFeatures((prev) => prev.filter((f) => f.key !== row.key && f.id !== row.id));
        } else {
          setAllFeatures((prev) => {
            const next = prev.filter((f) => f.key !== row.key && f.id !== row.id);
            const normalized: Feature = {
              id: row.id,
              key: row.key,
              name: row.name,
              description: row.description ?? null,
              icon: row.icon ?? null,
              category: row.category ?? null,
              is_active: row.is_active === true,
            };
            return [...next, normalized];
          });
        }

        // Sincroniza cache e dependências (plano, preços, compras) em background
        loadData();
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user, loadData]);

  // Fallback (mesma aba): telas administrativas podem disparar um evento para forçar revalidação
  useEffect(() => {
    const handler = () => {
      loadData();
    };

    window.addEventListener('feature-access-refresh', handler);
    return () => window.removeEventListener('feature-access-refresh', handler);
  }, [loadData]);

  // Verificação local (rápida, para UI)
  const hasFeatureAccess = useCallback(
    (featureKey: string): FeatureAccess => {
      // Verificar se está incluído no plano
      if (planFeatures.includes(featureKey)) {
        return { hasAccess: true, source: 'plan' };
      }

      // Verificar se foi comprado
      const feature = allFeatures.find((f) => f.key === featureKey);
      if (feature) {
        const purchased = companyFeatures.find(
          (cf) => cf.feature_id === feature.id && cf.is_active,
        );

        if (purchased) {
          // Verificar se não expirou (para mensais)
          if (purchased.price_type === 'monthly' && purchased.expires_at) {
            const expiresAt = new Date(purchased.expires_at);
            if (expiresAt > new Date()) {
              return { hasAccess: true, source: 'purchased', expiresAt: purchased.expires_at };
            }
          } else if (purchased.price_type === 'one_time') {
            return { hasAccess: true, source: 'purchased' };
          }
        }
      }

      return { hasAccess: false, source: 'none' };
    },
    [planFeatures, companyFeatures, allFeatures],
  );

  // Verificação via RPC no banco (segura, para ações críticas)
  const checkFeatureAccessRPC = useCallback(
    async (featureKey: string): Promise<boolean> => {
      if (!user) return false;

      // Usar cache se disponível
      if (accessCache[featureKey] !== undefined) {
        return accessCache[featureKey];
      }

      try {
        const { data, error } = await supabase.rpc('has_feature_access', {
          _user_id: user.id,
          _feature_key: featureKey,
        });

        if (error) {
          console.error('Error checking feature access:', error);
          return false;
        }

        // Atualizar cache
        setAccessCache((prev) => ({ ...prev, [featureKey]: data }));
        return data;
      } catch (error) {
        console.error('Error checking feature access:', error);
        return false;
      }
    },
    [user, accessCache],
  );

  const getFeaturePrice = useCallback(
    (featureKey: string): FeaturePricing | null => {
      const feature = allFeatures.find((f) => f.key === featureKey);
      if (!feature) return null;

      const pricing = featurePricing.find((p) => p.feature_id === feature.id);
      return pricing || null;
    },
    [allFeatures, featurePricing],
  );

  const getAllAvailableFeatures = useCallback(() => {
    return allFeatures.map((feature) => {
      const access = hasFeatureAccess(feature.key);
      const pricing = featurePricing.filter((p) => p.feature_id === feature.id);

      return {
        ...feature,
        access,
        pricing,
      };
    });
  }, [allFeatures, hasFeatureAccess, featurePricing]);

  return {
    loading,
    companyId,
    companyPlan,
    allFeatures,
    planFeatures,
    featurePricing,
    hasFeatureAccess,
    checkFeatureAccessRPC,
    getFeaturePrice,
    getAllAvailableFeatures,
    refetch: loadData,
  };
}
