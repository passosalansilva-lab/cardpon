import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface UserCompany {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  kds_token: string | null;
}

export function useUserCompany() {
  const { user, hasRole } = useAuth();
  const [company, setCompany] = useState<UserCompany | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompany = useCallback(async () => {
    if (!user) {
      setCompany(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // If user is store_owner, fetch their company
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, slug, logo_url, kds_token')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setCompany(data);
    } catch (error) {
      console.error('Error fetching user company:', error);
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  return { company, loading, refetch: fetchCompany };
}
