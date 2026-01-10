import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, Info } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
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

interface IngredientFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredient?: Ingredient | null;
  existingUnits?: IngredientUnit[];
  onSave: (data: { 
    name: string; 
    unit: string; 
    min_stock: number;
    units: IngredientUnit[];
  }) => Promise<void>;
}

const COMMON_UNITS = [
  { name: 'Unidade', abbreviation: 'un' },
  { name: 'Quilograma', abbreviation: 'kg' },
  { name: 'Grama', abbreviation: 'g' },
  { name: 'Litro', abbreviation: 'L' },
  { name: 'Mililitro', abbreviation: 'ml' },
  { name: 'Caixa', abbreviation: 'cx' },
  { name: 'Pacote', abbreviation: 'pct' },
  { name: 'Fardo', abbreviation: 'frd' },
  { name: 'Dúzia', abbreviation: 'dz' },
];

export function IngredientFormModal({
  open,
  onOpenChange,
  ingredient,
  existingUnits = [],
  onSave,
}: IngredientFormModalProps) {
  const [name, setName] = useState('');
  const [minStock, setMinStock] = useState('0');
  const [saving, setSaving] = useState(false);
  
  // Sistema de unidades
  const [units, setUnits] = useState<IngredientUnit[]>([]);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitAbbr, setNewUnitAbbr] = useState('');
  const [newUnitFactor, setNewUnitFactor] = useState('1');

  const isEditing = !!ingredient;
  const baseUnit = units.find(u => u.is_base_unit);

  useEffect(() => {
    if (open) {
      if (ingredient) {
        setName(ingredient.name);
        setMinStock(String(ingredient.min_stock));
        
        // Carregar unidades existentes ou criar unidade base padrão
        if (existingUnits.length > 0) {
          setUnits(existingUnits);
        } else {
          // Criar unidade base a partir da unidade atual
          setUnits([{
            name: getUnitFullName(ingredient.unit),
            abbreviation: ingredient.unit,
            conversion_factor: 1,
            is_base_unit: true,
          }]);
        }
      } else {
        setName('');
        setMinStock('0');
        // Começar com uma unidade base padrão
        setUnits([{
          name: 'Unidade',
          abbreviation: 'un',
          conversion_factor: 1,
          is_base_unit: true,
        }]);
      }
      setShowAddUnit(false);
      setNewUnitName('');
      setNewUnitAbbr('');
      setNewUnitFactor('1');
    }
  }, [ingredient, existingUnits, open]);

  const getUnitFullName = (abbr: string) => {
    const found = COMMON_UNITS.find(u => u.abbreviation === abbr);
    return found?.name || abbr;
  };

  const handleSetBaseUnit = (unitName: string, unitAbbr: string) => {
    // Se já tem unidades, resetar e definir nova base
    setUnits([{
      name: unitName,
      abbreviation: unitAbbr,
      conversion_factor: 1,
      is_base_unit: true,
    }]);
  };

  const handleAddUnit = () => {
    if (!newUnitName.trim() || !newUnitAbbr.trim()) return;
    
    const factor = parseFloat(newUnitFactor) || 1;
    
    setUnits(prev => [...prev, {
      name: newUnitName.trim(),
      abbreviation: newUnitAbbr.trim(),
      conversion_factor: factor,
      is_base_unit: false,
    }]);
    
    setNewUnitName('');
    setNewUnitAbbr('');
    setNewUnitFactor('1');
    setShowAddUnit(false);
  };

  const handleRemoveUnit = (index: number) => {
    setUnits(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !baseUnit) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        unit: baseUnit.abbreviation,
        min_stock: parseFloat(minStock) || 0,
        units: units,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Ingrediente' : 'Novo Ingrediente'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informações do ingrediente.'
              : 'Cadastre um novo ingrediente para controlar o estoque.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome do ingrediente *</Label>
            <Input
              id="name"
              placeholder="Ex: Refrigerante Coca-Cola 2L"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Unidade Base */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label>Unidade base (menor unidade) *</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>A unidade base é a menor unidade do produto. Ex: para refrigerantes, seria "Unidade" (1 garrafa). O estoque mínimo é controlado nesta unidade.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {COMMON_UNITS.map((u) => (
                <Badge
                  key={u.abbreviation}
                  variant={baseUnit?.abbreviation === u.abbreviation ? 'default' : 'outline'}
                  className="cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => handleSetBaseUnit(u.name, u.abbreviation)}
                >
                  {u.name} ({u.abbreviation})
                </Badge>
              ))}
            </div>
            
            {baseUnit && (
              <p className="text-sm text-muted-foreground">
                Selecionada: <span className="font-medium">{baseUnit.name}</span>
              </p>
            )}
          </div>

          {/* Unidades de Conversão */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>Unidades de compra (opcional)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Adicione unidades maiores para facilitar o registro de compras. Ex: "Fardo" contendo 6 unidades.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {!showAddUnit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddUnit(true)}
                  disabled={!baseUnit}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar
                </Button>
              )}
            </div>

            {/* Lista de unidades adicionais */}
            {units.filter(u => !u.is_base_unit).length > 0 && (
              <div className="space-y-2">
                {units.filter(u => !u.is_base_unit).map((unit, idx) => {
                  const realIndex = units.findIndex(u => u.name === unit.name && !u.is_base_unit);
                  return (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div>
                        <span className="font-medium">{unit.name}</span>
                        <span className="text-muted-foreground ml-1">({unit.abbreviation})</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          = {unit.conversion_factor} {baseUnit?.abbreviation}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveUnit(realIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Formulário para nova unidade */}
            {showAddUnit && baseUnit && (
              <div className="p-4 rounded-lg border border-dashed space-y-3 bg-muted/20">
                <p className="text-sm font-medium">Nova unidade de compra</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label className="text-xs">Nome</Label>
                    <Input
                      placeholder="Ex: Fardo"
                      value={newUnitName}
                      onChange={(e) => {
                        setNewUnitName(e.target.value);
                        // Auto-gerar abreviação
                        const abbr = e.target.value.slice(0, 3).toLowerCase();
                        setNewUnitAbbr(abbr);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Sigla</Label>
                    <Input
                      placeholder="frd"
                      value={newUnitAbbr}
                      onChange={(e) => setNewUnitAbbr(e.target.value)}
                      maxLength={5}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">
                    1 {newUnitName || 'unidade'} = quantas {baseUnit.abbreviation}?
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="Ex: 6"
                    value={newUnitFactor}
                    onChange={(e) => setNewUnitFactor(e.target.value)}
                  />
                  {newUnitName && newUnitFactor && (
                    <p className="text-xs text-muted-foreground mt-1">
                      1 {newUnitName} = {newUnitFactor} {baseUnit.name.toLowerCase()}(s)
                    </p>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddUnit(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddUnit}
                    disabled={!newUnitName.trim() || !newUnitAbbr.trim()}
                  >
                    Adicionar
                  </Button>
                </div>
              </div>
            )}

            {!showAddUnit && units.filter(u => !u.is_base_unit).length === 0 && baseUnit && (
              <p className="text-xs text-muted-foreground">
                Ex: Se você compra em fardos com 6 unidades, adicione "Fardo" = 6 {baseUnit.abbreviation}
              </p>
            )}
          </div>

          {/* Estoque Mínimo */}
          <div className="space-y-2">
            <Label htmlFor="minStock">
              Estoque mínimo {baseUnit ? `(${baseUnit.abbreviation})` : ''}
            </Label>
            <Input
              id="minStock"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Você será notificado quando o estoque atingir este valor.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !name.trim() || !baseUnit}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : isEditing ? (
                'Salvar alterações'
              ) : (
                'Cadastrar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
