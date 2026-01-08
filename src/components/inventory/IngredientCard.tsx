import { Pencil, Trash2, ShoppingCart, Package2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface IngredientUnit {
  id?: string;
  name: string;
  abbreviation: string;
  conversion_factor: number;
  is_base_unit: boolean;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  average_unit_cost: number;
}

interface IngredientCardProps {
  ingredient: Ingredient;
  units?: IngredientUnit[];
  onEdit: (ingredient: Ingredient) => void;
  onDelete: (ingredient: Ingredient) => void;
  onAddPurchase: (ingredient: Ingredient) => void;
}

export function IngredientCard({
  ingredient,
  units = [],
  onEdit,
  onDelete,
  onAddPurchase,
}: IngredientCardProps) {
  const stockPercentage = ingredient.min_stock > 0 
    ? Math.min((ingredient.current_stock / (ingredient.min_stock * 2)) * 100, 100)
    : 100;
  
  const isLowStock = ingredient.current_stock <= ingredient.min_stock;
  const isCritical = ingredient.current_stock <= ingredient.min_stock * 0.5;

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatNumber = (value: number) =>
    value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const stockValue = ingredient.current_stock * ingredient.average_unit_cost;
  
  // Unidades adicionais (não base)
  const additionalUnits = units.filter(u => !u.is_base_unit && u.conversion_factor > 1);
  const baseUnit = units.find(u => u.is_base_unit);

  // Calcular estoque em unidades maiores
  const stockInLargerUnits = additionalUnits.map(unit => ({
    ...unit,
    quantity: ingredient.current_stock / unit.conversion_factor,
  }));

  return (
    <Card className={`border transition-all hover:shadow-md ${
      isCritical ? 'border-destructive/50 bg-destructive/5' : 
      isLowStock ? 'border-warning/50 bg-warning/5' : 
      'border-border/50'
    }`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{ingredient.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-muted-foreground">
                Unidade: {baseUnit?.name || ingredient.unit}
              </p>
              {additionalUnits.length > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                        <Package2 className="h-3 w-3 mr-1" />
                        +{additionalUnits.length}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-medium mb-1">Unidades de compra:</p>
                      {additionalUnits.map(u => (
                        <p key={u.id || u.abbreviation} className="text-xs">
                          1 {u.name} = {u.conversion_factor} {ingredient.unit}
                        </p>
                      ))}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
          {isLowStock && (
            <Badge variant={isCritical ? "destructive" : "secondary"} className="ml-2 shrink-0">
              {isCritical ? 'Crítico' : 'Baixo'}
            </Badge>
          )}
        </div>

        <div className="space-y-3">
          {/* Stock Level */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Estoque</span>
              <span className="font-medium">
                {formatNumber(ingredient.current_stock)} {ingredient.unit}
              </span>
            </div>
            <Progress 
              value={stockPercentage} 
              className={`h-2 ${
                isCritical ? '[&>div]:bg-destructive' : 
                isLowStock ? '[&>div]:bg-warning' : 
                '[&>div]:bg-success'
              }`}
            />
            <div className="flex justify-between mt-1">
              <p className="text-xs text-muted-foreground">
                Mínimo: {formatNumber(ingredient.min_stock)} {ingredient.unit}
              </p>
              {/* Mostrar estoque em unidade maior se disponível */}
              {stockInLargerUnits.length > 0 && stockInLargerUnits[0].quantity >= 1 && (
                <p className="text-xs text-muted-foreground">
                  ≈ {formatNumber(stockInLargerUnits[0].quantity)} {stockInLargerUnits[0].abbreviation}
                </p>
              )}
            </div>
          </div>

          {/* Value Info */}
          <div className="flex justify-between text-sm pt-2 border-t border-border/50">
            <div>
              <p className="text-xs text-muted-foreground">Custo médio</p>
              <p className="font-medium">{formatCurrency(ingredient.average_unit_cost)}/{ingredient.unit}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Valor em estoque</p>
              <p className="font-medium">{formatCurrency(stockValue)}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onAddPurchase(ingredient)}
            >
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
              Comprar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(ingredient)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(ingredient)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
