import { AlertTriangle, Crown } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';

interface RecommendedPlan {
  key: string;
  name: string;
  revenueLimit: number;
  price: number;
}

interface SubscriptionAlertProps {
  plan: string;
  revenueLimit: number;
  monthlyRevenue: number;
  displayName: string;
  isNearLimit: boolean;
  isAtLimit: boolean;
  usagePercentage: number;
  recommendedPlan?: RecommendedPlan;
}

export function SubscriptionAlert({
  plan,
  revenueLimit,
  monthlyRevenue,
  displayName,
  isNearLimit,
  isAtLimit,
  usagePercentage,
  recommendedPlan,
}: SubscriptionAlertProps) {
  // Don't show alert for enterprise (unlimited) or if usage is normal
  if (revenueLimit === -1 || (!isNearLimit && !isAtLimit)) {
    return null;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };

  const formatLimit = (limit: number) => {
    if (limit === -1) return 'Ilimitado';
    return formatCurrency(limit);
  };

  return (
    <Alert
      variant={isAtLimit ? 'destructive' : 'default'}
      className={isAtLimit ? 'border-destructive/50 bg-destructive/10' : 'border-warning/50 bg-warning/10'}
    >
      <AlertTriangle className={`h-4 w-4 ${isAtLimit ? 'text-destructive' : 'text-warning'}`} />
      <AlertTitle className="flex items-center gap-2">
        {isAtLimit ? 'Limite de faturamento atingido!' : 'Você está próximo do limite!'}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span>
            {formatCurrency(monthlyRevenue)} / {formatCurrency(revenueLimit)} faturados
          </span>
          <span className="font-medium">{displayName}</span>
        </div>
        
        <Progress
          value={Math.min(usagePercentage, 100)}
          className={`h-2 ${isAtLimit ? '[&>div]:bg-destructive' : '[&>div]:bg-warning'}`}
        />
        
        {isAtLimit ? (
          <p className="text-sm">
            Parabéns pelo crescimento! Você atingiu o limite de faturamento do modo gratuito. 
            Para continuar recebendo pedidos, é necessário assinar um plano.
            {recommendedPlan && (
              <span className="font-medium">
                {' '}Recomendamos o <strong>{recommendedPlan.name}</strong> (até {formatLimit(recommendedPlan.revenueLimit)}/mês por {formatCurrency(recommendedPlan.price)}/mês).
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm">
            Você usou {usagePercentage.toFixed(0)}% do seu limite mensal de faturamento.
            Ao atingir 100%, será necessário assinar um plano para continuar recebendo pedidos.
            {recommendedPlan && (
              <span className="font-medium">
                {' '}Considere mudar para o <strong>{recommendedPlan.name}</strong> (até {formatLimit(recommendedPlan.revenueLimit)}/mês por {formatCurrency(recommendedPlan.price)}/mês).
              </span>
            )}
          </p>
        )}
        
        <Button asChild size="sm" className="w-full sm:w-auto">
          <Link to="/dashboard/plans">
            <Crown className="h-4 w-4 mr-2" />
            {recommendedPlan ? `Mudar para ${recommendedPlan.name}` : 'Ver planos e fazer upgrade'}
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
