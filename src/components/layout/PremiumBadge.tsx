import { Crown } from 'lucide-react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { cn } from '@/lib/utils';

interface PremiumBadgeProps {
  featureKey: string;
  className?: string;
  showAlways?: boolean; // Se true, mostra mesmo quando está no plano
}

export function PremiumBadge({ featureKey, className, showAlways = false }: PremiumBadgeProps) {
  const { hasFeatureAccess, getFeaturePrice, loading } = useFeatureAccess();

  if (loading) return null;

  const access = hasFeatureAccess(featureKey);
  const price = getFeaturePrice(featureKey);
  
  // Não mostrar se não é uma feature premium
  if (!price) return null;
  
  // Se está no plano e não é para mostrar sempre, não mostrar
  if (access.source === 'plan' && !showAlways) return null;
  
  // Se não tem acesso, não mostrar (vai mostrar o modal de compra)
  if (!access.hasAccess) return null;

  // Só mostrar se foi comprado individualmente
  if (access.source !== 'purchased') return null;

  return (
    <span 
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full",
        "bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-sm",
        className
      )}
    >
      <Crown className="h-3.5 w-3.5" />
      Premium
    </span>
  );
}
