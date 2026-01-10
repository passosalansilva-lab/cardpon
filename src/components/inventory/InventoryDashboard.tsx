import { Package, AlertTriangle, TrendingDown, DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface InventoryDashboardProps {
  totalIngredients: number;
  lowStockCount: number;
  totalStockValue: number;
  consumptionCost: number;
}

export function InventoryDashboard({
  totalIngredients,
  lowStockCount,
  totalStockValue,
  consumptionCost,
}: InventoryDashboardProps) {
  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const stats = [
    {
      label: 'Total de Ingredientes',
      value: totalIngredients,
      icon: Package,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Estoque Baixo',
      value: lowStockCount,
      icon: AlertTriangle,
      color: lowStockCount > 0 ? 'text-destructive' : 'text-success',
      bgColor: lowStockCount > 0 ? 'bg-destructive/10' : 'bg-success/10',
    },
    {
      label: 'Valor em Estoque',
      value: formatCurrency(totalStockValue),
      icon: DollarSign,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      label: 'Consumo (30 dias)',
      value: formatCurrency(consumptionCost),
      icon: TrendingDown,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
