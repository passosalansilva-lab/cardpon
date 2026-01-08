import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PizzaSettings {
  id: string;
  company_id: string;
  enable_half_half: boolean;
  enable_crust: boolean;
  enable_addons: boolean;
  max_flavors: number;
  allow_crust_extra_price: boolean;
}

interface PizzaConfig {
  settings: PizzaSettings | null;
  pizzaCategoryIds: string[];
  loading: boolean;
  error: Error | null;
}

export function usePizzaConfig(companyId: string | null): PizzaConfig {
  const [config, setConfig] = useState<PizzaConfig>({
    settings: null,
    pizzaCategoryIds: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!companyId) {
      setConfig({ settings: null, pizzaCategoryIds: [], loading: false, error: null });
      return;
    }

    const loadPizzaConfig = async () => {
      try {
        setConfig((prev) => ({ ...prev, loading: true, error: null }));

        // Buscar configurações de pizza
        const { data: settings, error: settingsError } = await supabase
          .from('pizza_settings')
          .select('*')
          .eq('company_id', companyId)
          .maybeSingle();

        if (settingsError && settingsError.code !== 'PGRST116') {
          throw settingsError;
        }

        // Buscar categorias marcadas como pizza
        const { data: pizzaCategories, error: categoriesError } = await supabase
          .from('pizza_categories')
          .select('category_id')
          .eq('company_id', companyId);

        if (categoriesError) throw categoriesError;

        setConfig({
          settings: settings || null,
          pizzaCategoryIds: pizzaCategories?.map((pc) => pc.category_id) || [],
          loading: false,
          error: null,
        });
      } catch (error: any) {
        console.error('Error loading pizza config:', error);
        setConfig({
          settings: null,
          pizzaCategoryIds: [],
          loading: false,
          error: error,
        });
      }
    };

    loadPizzaConfig();
  }, [companyId]);

  return config;
}
