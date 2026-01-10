import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCallback } from 'react';

interface LogActivityParams {
  actionType: 'create' | 'update' | 'delete' | 'status_change' | 'assign' | 'other';
  entityType: 'order' | 'product' | 'category' | 'driver' | 'coupon' | 'promotion' | 'company' | 'inventory' | 'other';
  entityId?: string;
  entityName?: string;
  description: string;
  oldData?: any;
  newData?: any;
}

export const useActivityLog = () => {
  const { user, staffCompany } = useAuth();

  const logActivity = useCallback(async (params: LogActivityParams) => {
    if (!user) {
      console.warn('[ActivityLog] No user authenticated, skipping log');
      return;
    }

    try {
      let companyId: string | null = null;

      // Staff users: use staffCompany context
      if (staffCompany?.companyId) {
        companyId = staffCompany.companyId;
      } else {
        // Owners: lookup their own company
        const { data: companies } = await supabase
          .from('companies')
          .select('id')
          .eq('owner_id', user.id)
          .limit(1)
          .maybeSingle();

        companyId = companies?.id ?? null;
      }

      if (!companyId) {
        console.warn('[ActivityLog] No company found for user, skipping log');
        return;
      }

      const logEntry = {
        user_id: user.id,
        company_id: companyId,
        action_type: params.actionType,
        entity_type: params.entityType,
        entity_id: params.entityId,
        entity_name: params.entityName,
        description: params.description,
        old_data: params.oldData || null,
        new_data: params.newData || null,
        ip_address: null, // Could be populated from client or server
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      };

      const { error } = await supabase
        .from('activity_logs')
        .insert(logEntry);

      if (error) {
        console.error('[ActivityLog] Error logging activity:', error);
      }
    } catch (error) {
      console.error('[ActivityLog] Exception logging activity:', error);
    }
  }, [user, staffCompany]);

  return { logActivity };
};
