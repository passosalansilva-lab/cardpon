import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

export interface StaffPermissions {
  can_manage_orders: boolean;
  can_manage_menu: boolean;
  can_manage_inventory: boolean;
  can_manage_coupons: boolean;
  can_manage_promotions: boolean;
  can_manage_drivers: boolean;
  can_view_reports: boolean;
  can_manage_reviews: boolean;
}

const defaultPermissions: StaffPermissions = {
  can_manage_orders: false,
  can_manage_menu: false,
  can_manage_inventory: false,
  can_manage_coupons: false,
  can_manage_promotions: false,
  can_manage_drivers: false,
  can_view_reports: false,
  can_manage_reviews: false,
};

export function useStaffPermissions() {
  const { user, hasRole, staffCompany, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<StaffPermissions>(defaultPermissions);
  const [loading, setLoading] = useState(true);

  const isStoreStaff = hasRole("store_staff");
  const isOwnerOrAdmin = hasRole("store_owner") || hasRole("super_admin");

  useEffect(() => {
    const fetchPermissions = async () => {
      // If user is owner or admin, they have all permissions
      if (isOwnerOrAdmin) {
        setPermissions({
          can_manage_orders: true,
          can_manage_menu: true,
          can_manage_inventory: true,
          can_manage_coupons: true,
          can_manage_promotions: true,
          can_manage_drivers: true,
          can_view_reports: true,
          can_manage_reviews: true,
        });
        setLoading(false);
        return;
      }

      // If user is staff, fetch their specific permissions
      if (isStoreStaff && user?.id && staffCompany?.companyId) {
        try {
          const { data, error } = await supabase
            .from("staff_permissions")
            .select("*")
            .eq("user_id", user.id)
            .eq("company_id", staffCompany.companyId)
            .single();

          if (error) {
            console.error("Error fetching staff permissions:", error);
            setPermissions(defaultPermissions);
          } else if (data) {
            setPermissions({
              can_manage_orders: data.can_manage_orders,
              can_manage_menu: data.can_manage_menu,
              can_manage_inventory: data.can_manage_inventory,
              can_manage_coupons: data.can_manage_coupons,
              can_manage_promotions: data.can_manage_promotions,
              can_manage_drivers: data.can_manage_drivers,
              can_view_reports: data.can_view_reports,
              can_manage_reviews: data.can_manage_reviews,
            });
          }
        } catch (error) {
          console.error("Error fetching staff permissions:", error);
          setPermissions(defaultPermissions);
        }
      } else {
        setPermissions(defaultPermissions);
      }

      setLoading(false);
    };

    if (!authLoading) {
      fetchPermissions();
    }
  }, [user?.id, staffCompany?.companyId, isStoreStaff, isOwnerOrAdmin, authLoading]);

  const hasPermission = (permission: keyof StaffPermissions): boolean => {
    // Owners and admins always have permission
    if (isOwnerOrAdmin) return true;
    
    return permissions[permission];
  };

  return {
    permissions,
    loading: loading || authLoading,
    hasPermission,
    isStoreStaff,
    isOwnerOrAdmin,
  };
}
