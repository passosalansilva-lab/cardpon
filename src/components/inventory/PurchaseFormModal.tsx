import { useState, useEffect, useMemo } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

interface PurchaseFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredients: Ingredient[];
  ingredientUnits: Record<string, IngredientUnit[]>; // ingredient_id -> units
  selectedIngredient?: Ingredient | null;
  onSave: (data: {
    ingredient_id: string;
    quantity: number;
    unit_cost: number;
    supplier?: string;
    unit_id?: string;
    conversion_factor: number;
  }) => Promise<void>;
}

export function PurchaseFormModal({
  open,
  onOpenChange,
  ingredients,
  ingredientUnits,
  selectedIngredient,
  onSave,
}: PurchaseFormModalProps) {
  const [ingredientId, setIngredientId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedIng = ingredients.find((i) => i.id === ingredientId);
  const availableUnits = useMemo(() => {
    if (!ingredientId) return [];
    const units = ingredientUnits[ingredientId] || [];
    // Se não tem unidades cadastradas, criar uma virtual baseada na unidade do ingrediente
    if (units.length === 0 && selectedIng) {
      return [{
        id: 'base',
        name: selectedIng.unit,
        abbreviation: selectedIng.unit,
        conversion_factor: 1,
        is_base_unit: true,
      }];
    }
    return units;
  }, [ingredientId, ingredientUnits, selectedIng]);

  const selectedUnit = availableUnits.find(u => 
    u.id === selectedUnitId || 
    (selectedUnitId === 'base' && u.is_base_unit) ||
    (!selectedUnitId && u.is_base_unit)
  ) || availableUnits.find(u => u.is_base_unit) || availableUnits[0];
  
  const baseUnit = availableUnits.find(u => u.is_base_unit) || availableUnits[0];

  // Calcular quantidade em unidades base
  const quantityInBaseUnits = useMemo(() => {
    const qty = parseFloat(quantity) || 0;
    const factor = selectedUnit?.conversion_factor || 1;
    return qty * factor;
  }, [quantity, selectedUnit]);

  const totalCost = (parseFloat(quantity) || 0) * (parseFloat(unitCost) || 0);
  
  // Custo por unidade base
  const costPerBaseUnit = useMemo(() => {
    if (!quantityInBaseUnits || quantityInBaseUnits === 0) return 0;
    return totalCost / quantityInBaseUnits;
  }, [totalCost, quantityInBaseUnits]);

  useEffect(() => {
    if (open) {
      if (selectedIngredient) {
        setIngredientId(selectedIngredient.id);
        if (selectedIngredient.average_unit_cost > 0) {
          setUnitCost(String(selectedIngredient.average_unit_cost));
        }
      } else {
        setIngredientId('');
        setUnitCost('');
      }
      setSelectedUnitId('');
      setQuantity('');
      setSupplier('');
    }
  }, [selectedIngredient, open]);

  // Quando muda o ingrediente, resetar unidade selecionada
  useEffect(() => {
    setSelectedUnitId('');
    // Se tem unidade com maior fator de conversão, selecionar ela (compra geralmente é em embalagens maiores)
    const units = ingredientUnits[ingredientId] || [];
    const largestUnit = units.reduce((max, u) => 
      u.conversion_factor > (max?.conversion_factor || 0) ? u : max
    , units[0]);
    if (largestUnit?.id) {
      setSelectedUnitId(largestUnit.id);
    }
  }, [ingredientId, ingredientUnits]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredientId || !quantity) return;

    setSaving(true);
    try {
      await onSave({
        ingredient_id: ingredientId,
        quantity: parseFloat(quantity) || 0,
        unit_cost: parseFloat(unitCost) || 0,
        supplier: supplier || undefined,
        unit_id: selectedUnit?.id !== 'base' ? selectedUnit?.id : undefined,
        conversion_factor: selectedUnit?.conversion_factor || 1,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatNumber = (value: number) =>
    value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Compra</DialogTitle>
          <DialogDescription>
            Adicione uma entrada de estoque. O saldo será atualizado automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ingredient">Ingrediente *</Label>
            <Select value={ingredientId} onValueChange={setIngredientId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um ingrediente" />
              </SelectTrigger>
              <SelectContent>
                {ingredients.map((ing) => (
                  <SelectItem key={ing.id} value={ing.id}>
                    {ing.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de unidade */}
          {ingredientId && availableUnits.length > 1 && (
            <div className="space-y-2">
              <Label>Unidade de compra</Label>
              <Select 
                value={selectedUnitId || selectedUnit?.id || ''} 
                onValueChange={setSelectedUnitId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableUnits.map((unit) => (
                    <SelectItem key={unit.id || unit.abbreviation} value={unit.id || 'base'}>
                      {unit.name} ({unit.abbreviation})
                      {unit.conversion_factor > 1 && (
                        <span className="text-muted-foreground ml-1">
                          = {unit.conversion_factor} {baseUnit?.abbreviation}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">
                Quantidade {selectedUnit ? `(${selectedUnit.abbreviation})` : ''} *
              </Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitCost">
                Custo {selectedUnit ? `por ${selectedUnit.abbreviation}` : 'unitário'}
              </Label>
              <CurrencyInput
                value={unitCost}
                onChange={setUnitCost}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier">Fornecedor (opcional)</Label>
            <Input
              id="supplier"
              placeholder="Ex: Distribuidora ABC"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
          </div>

          {quantity && parseFloat(quantity) > 0 && (
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              {/* Conversão */}
              {selectedUnit && selectedUnit.conversion_factor > 1 && baseUnit && (
                <div className="flex items-center gap-2 text-sm pb-2 border-b border-border/50">
                  <span className="text-muted-foreground">Conversão:</span>
                  <span className="font-medium">
                    {formatNumber(parseFloat(quantity))} {selectedUnit.abbreviation}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-primary">
                    {formatNumber(quantityInBaseUnits)} {baseUnit.abbreviation}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Custo total:</span>
                <span className="font-semibold">{formatCurrency(totalCost)}</span>
              </div>
              
              {selectedUnit && selectedUnit.conversion_factor > 1 && baseUnit && costPerBaseUnit > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custo por {baseUnit.abbreviation}:</span>
                  <span className="font-medium">{formatCurrency(costPerBaseUnit)}</span>
                </div>
              )}
              
              {selectedIng && (
                <div className="flex justify-between text-sm pt-2 border-t border-border/50">
                  <span className="text-muted-foreground">Novo estoque:</span>
                  <span className="font-medium">
                    {formatNumber(selectedIng.current_stock + quantityInBaseUnits)} {selectedIng.unit}
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !ingredientId || !quantity || parseFloat(quantity) <= 0}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                'Registrar compra'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
