import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Bell } from "lucide-react";

export function SidebarOrdersBadge() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [hasNewOrder, setHasNewOrder] = useState(false);
  const companyIdRef = useRef<string | null>(null);
  const { playSound: playNewOrderSound } = useNotificationSound('new_order');

  const fetchPendingCount = useCallback(async (companyId: string) => {
    const { count, error } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('status', ['pending', 'confirmed']);

    if (!error && count !== null) {
      setPendingCount(count);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let isCancelled = false;
    let channel: any = null;

    const setupSubscription = async () => {
      // Get company ID
      const { data: companyData } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!companyData?.id || isCancelled) return;
      
      companyIdRef.current = companyData.id;
      await fetchPendingCount(companyData.id);

      // Subscribe to order changes
      channel = supabase
        .channel(`sidebar-orders-${companyData.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
            filter: `company_id=eq.${companyData.id}`,
          },
          () => {
            playNewOrderSound();
            setHasNewOrder(true);
            fetchPendingCount(companyData.id);
            
            // Reset animation after 3 seconds
            setTimeout(() => setHasNewOrder(false), 3000);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `company_id=eq.${companyData.id}`,
          },
          () => {
            fetchPendingCount(companyData.id);
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
  }, [user?.id, fetchPendingCount, playNewOrderSound]);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            <Bell
              className={cn(
                "h-4 w-4",
                hasNewOrder
                  ? "text-yellow-400 animate-bounce"
                  : pendingCount > 0
                    ? "text-primary"
                    : "text-muted-foreground"
              )}
            />
            <Badge
              variant="destructive"
              className={cn(
                "h-5 min-w-5 px-1 text-xs flex items-center justify-center",
                hasNewOrder && "animate-pulse",
                pendingCount === 0 && "opacity-70"
              )}
            >
              {pendingCount}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" align="center">
          <p className="text-xs leading-snug">
            Central de pedidos da loja. {" "}
            {pendingCount > 0
              ? `Você tem ${pendingCount} pedido(s) pendente(s) para atender.`
              : "No momento não há pedidos pendentes."}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
