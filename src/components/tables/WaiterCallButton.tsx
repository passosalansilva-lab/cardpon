import { useState } from 'react';
import { Bell, Receipt, HelpCircle, Droplets, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface WaiterCallButtonProps {
  companyId: string;
  tableId: string;
  tableSessionId: string;
  tableNumber: number;
}

const callTypes = [
  { type: 'waiter', label: 'Chamar Garçom', icon: Bell, color: 'text-amber-600' },
  { type: 'bill', label: 'Pedir a Conta', icon: Receipt, color: 'text-emerald-600' },
  { type: 'water', label: 'Pedir Água', icon: Droplets, color: 'text-blue-600' },
  { type: 'help', label: 'Preciso de Ajuda', icon: HelpCircle, color: 'text-purple-600' },
] as const;

export function WaiterCallButton({ companyId, tableId, tableSessionId, tableNumber }: WaiterCallButtonProps) {
  const [loading, setLoading] = useState(false);
  const [lastCall, setLastCall] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleCall = async (callType: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('waiter_calls').insert({
        company_id: companyId,
        table_id: tableId,
        table_session_id: tableSessionId,
        call_type: callType,
      });

      if (error) throw error;

      setLastCall(callType);
      setShowSuccess(true);
      
      const callLabel = callTypes.find(c => c.type === callType)?.label || 'Solicitação';
      toast.success(`${callLabel} enviado!`, {
        description: 'Um atendente virá em instantes',
      });

      // Hide success after 3 seconds
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error: any) {
      toast.error('Erro ao chamar', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            className="absolute -top-16 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 whitespace-nowrap z-10"
          >
            <Check className="h-4 w-4" />
            <span className="text-sm font-medium">Garçom notificado!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            className={cn(
              'w-full rounded-2xl h-14 text-base font-semibold shadow-lg transition-all',
              'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600',
              'text-white border-0',
              loading && 'opacity-70'
            )}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Bell className="h-5 w-5 mr-2" />
            )}
            Chamar Atendimento
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-56 rounded-xl p-2">
          {callTypes.map((call) => {
            const Icon = call.icon;
            return (
              <DropdownMenuItem
                key={call.type}
                onClick={() => handleCall(call.type)}
                className="flex items-center gap-3 py-3 px-4 rounded-lg cursor-pointer"
              >
                <div className={cn(
                  'h-10 w-10 rounded-full flex items-center justify-center',
                  call.type === 'waiter' && 'bg-amber-100 dark:bg-amber-900/30',
                  call.type === 'bill' && 'bg-emerald-100 dark:bg-emerald-900/30',
                  call.type === 'water' && 'bg-blue-100 dark:bg-blue-900/30',
                  call.type === 'help' && 'bg-purple-100 dark:bg-purple-900/30',
                )}>
                  <Icon className={cn('h-5 w-5', call.color)} />
                </div>
                <span className="font-medium">{call.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
