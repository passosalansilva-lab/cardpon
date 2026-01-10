import { useState, useEffect } from 'react';
import { Bell, Receipt, HelpCircle, Droplets, Check, X, Clock, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

interface WaiterCall {
  id: string;
  company_id: string;
  table_id: string;
  table_session_id: string;
  call_type: string;
  status: string;
  notes: string | null;
  created_at: string;
  acknowledged_at: string | null;
  completed_at: string | null;
  table?: {
    table_number: number;
    name: string | null;
  };
}

interface WaiterCallsPanelProps {
  companyId: string;
}

const callTypeConfig: Record<string, { label: string; icon: typeof Bell; color: string; bgColor: string }> = {
  waiter: { label: 'Garçom', icon: Bell, color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  bill: { label: 'Conta', icon: Receipt, color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' },
  water: { label: 'Água', icon: Droplets, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  help: { label: 'Ajuda', icon: HelpCircle, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
};

export function WaiterCallsPanel({ companyId }: WaiterCallsPanelProps) {
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCalls = async () => {
    try {
      const { data, error } = await supabase
        .from('waiter_calls')
        .select(`
          *,
          table:tables(table_number, name)
        `)
        .eq('company_id', companyId)
        .in('status', ['pending', 'acknowledged'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      setCalls(data || []);
    } catch (error: any) {
      console.error('Error loading waiter calls:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalls();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('waiter-calls-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waiter_calls',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('Waiter call update:', payload);
          
          if (payload.eventType === 'INSERT') {
            // Play notification sound
            try {
              const audio = new Audio('/sounds/default-notification.mp3');
              audio.volume = 0.5;
              audio.play().catch(() => {});
            } catch {}

            // Show toast
            const newCall = payload.new as WaiterCall;
            const config = callTypeConfig[newCall.call_type] || callTypeConfig.waiter;
            toast.info(`Nova chamada: ${config.label}`, {
              description: 'Um cliente está solicitando atendimento',
            });
          }

          loadCalls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const handleAcknowledge = async (callId: string) => {
    try {
      const { error } = await supabase
        .from('waiter_calls')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', callId);

      if (error) throw error;
      toast.success('Chamada reconhecida');
      loadCalls();
    } catch (error: any) {
      toast.error('Erro ao reconhecer chamada');
    }
  };

  const handleComplete = async (callId: string) => {
    try {
      const { error } = await supabase
        .from('waiter_calls')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', callId);

      if (error) throw error;
      toast.success('Chamada concluída');
      loadCalls();
    } catch (error: any) {
      toast.error('Erro ao concluir chamada');
    }
  };

  const handleDismiss = async (callId: string) => {
    try {
      const { error } = await supabase
        .from('waiter_calls')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', callId);

      if (error) throw error;
      loadCalls();
    } catch (error: any) {
      toast.error('Erro ao dispensar chamada');
    }
  };

  const pendingCalls = calls.filter(c => c.status === 'pending');
  const acknowledgedCalls = calls.filter(c => c.status === 'acknowledged');

  if (calls.length === 0 && !loading) {
    return null;
  }

  return (
    <Card className="border-amber-200 dark:border-amber-800/50 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Bell className="h-4 w-4 text-white" />
          </div>
          <span>Chamadas de Atendimento</span>
          {pendingCalls.length > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {pendingCalls.length} pendente{pendingCalls.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <AnimatePresence>
          {calls.map((call) => {
            const config = callTypeConfig[call.call_type] || callTypeConfig.waiter;
            const Icon = config.icon;
            const isPending = call.status === 'pending';

            return (
              <motion.div
                key={call.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={cn(
                  'flex items-center justify-between gap-3 p-3 rounded-xl border transition-all',
                  isPending
                    ? 'bg-white dark:bg-black/20 border-amber-300 dark:border-amber-700 shadow-md'
                    : 'bg-muted/50 border-border'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'h-12 w-12 rounded-xl flex items-center justify-center',
                    config.bgColor,
                    isPending && 'animate-pulse'
                  )}>
                    <Icon className={cn('h-6 w-6', config.color)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">
                        Mesa {call.table?.table_number}
                      </span>
                      <Badge variant="outline" className={cn('text-xs', config.color)}>
                        {config.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(call.created_at), { addSuffix: true, locale: ptBR })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isPending ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDismiss(call.id)}
                        className="rounded-lg"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAcknowledge(call.id)}
                        className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Atender
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleComplete(call.id)}
                      className="rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Concluir
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
