import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ShoppingBag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function PendingOrdersAlert() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [inProgressCount, setInProgressCount] = useState(0); // confirmed, preparing, ready
  const [dismissed, setDismissed] = useState(false);
  const companyIdRef = useRef<string | null>(null);

  const fetchCounts = useCallback(async (companyId: string) => {
    // Buscar pendentes (aguardando confirmação)
    const { count: pending } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'pending');

    // Buscar em andamento (confirmed, preparing, ready)
    const { count: inProgress } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('status', ['confirmed', 'preparing', 'ready']);

    setPendingCount(pending ?? 0);
    setInProgressCount(inProgress ?? 0);
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let isCancelled = false;
    let channel: any = null;

    const setupSubscription = async () => {
      // Primeiro tenta via staff
      let companyId: string | null = null;

      const { data: staffRow } = await supabase
        .from('company_staff')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (staffRow?.company_id) {
        companyId = staffRow.company_id;
      }

      // Se não for staff, tenta como dono
      if (!companyId) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (companyData?.id) {
          companyId = companyData.id;
        }
      }

      if (!companyId || isCancelled) return;

      companyIdRef.current = companyId;
      await fetchCounts(companyId);

      // Subscribe to order changes
      channel = supabase
        .channel(`header-pending-orders-${companyId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `company_id=eq.${companyId}`,
          },
          () => {
            fetchCounts(companyId!);
            // Reset dismissed when new orders arrive
            setDismissed(false);
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      isCancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user?.id, fetchCounts]);

  const totalActive = pendingCount + inProgressCount;

  // Não mostrar se não há pedidos ou foi dispensado
  if (totalActive === 0 || dismissed) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300",
        pendingCount > 0
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
          : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30"
      )}
    >
      {pendingCount > 0 ? (
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      ) : (
        <ShoppingBag className="h-4 w-4 flex-shrink-0" />
      )}

      <span className="hidden sm:inline">
        {pendingCount > 0 && inProgressCount > 0 ? (
          <>
            <strong>{pendingCount}</strong> pendente{pendingCount !== 1 && 's'} e{' '}
            <strong>{inProgressCount}</strong> em andamento
          </>
        ) : pendingCount > 0 ? (
          <>
            <strong>{pendingCount}</strong> pedido{pendingCount !== 1 && 's'} pendente{pendingCount !== 1 && 's'}
          </>
        ) : (
          <>
            <strong>{inProgressCount}</strong> pedido{inProgressCount !== 1 && 's'} em andamento
          </>
        )}
      </span>

      <span className="sm:hidden">
        <strong>{totalActive}</strong> pedido{totalActive !== 1 && 's'}
      </span>

      <Link to="/dashboard/orders">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 px-2 text-xs font-semibold",
            pendingCount > 0
              ? "hover:bg-amber-500/20 text-amber-700 dark:text-amber-400"
              : "hover:bg-blue-500/20 text-blue-700 dark:text-blue-400"
          )}
        >
          Ver pedidos
        </Button>
      </Link>

      <button
        onClick={() => setDismissed(true)}
        className={cn(
          "p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors",
          pendingCount > 0
            ? "text-amber-600 dark:text-amber-500"
            : "text-blue-600 dark:text-blue-500"
        )}
        title="Dispensar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
