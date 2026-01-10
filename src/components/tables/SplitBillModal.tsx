import { useState, useMemo } from 'react';
import { Users, DollarSign, Percent, Check, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface SplitBillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  items: OrderItem[];
  onConfirm: (splits: SplitResult[]) => void;
}

export interface SplitResult {
  label: string;
  amount: number;
  items?: string[];
}

export function SplitBillModal({ open, onOpenChange, total, items, onConfirm }: SplitBillModalProps) {
  const [splitMode, setSplitMode] = useState<'equal' | 'items'>('equal');
  const [numberOfPeople, setNumberOfPeople] = useState(2);
  const [selectedItemsByPerson, setSelectedItemsByPerson] = useState<Record<number, string[]>>({});
  const [currentPerson, setCurrentPerson] = useState(0);

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Equal split calculation
  const equalSplit = useMemo(() => {
    const perPerson = total / numberOfPeople;
    return Array.from({ length: numberOfPeople }, (_, i) => ({
      label: `Pessoa ${i + 1}`,
      amount: perPerson,
    }));
  }, [total, numberOfPeople]);

  // Items split calculation
  const itemsSplit = useMemo(() => {
    const splits: SplitResult[] = [];
    
    for (let i = 0; i < numberOfPeople; i++) {
      const personItems = selectedItemsByPerson[i] || [];
      const personTotal = items
        .filter(item => personItems.includes(item.id))
        .reduce((sum, item) => sum + item.total_price, 0);
      
      splits.push({
        label: `Pessoa ${i + 1}`,
        amount: personTotal,
        items: personItems,
      });
    }
    
    return splits;
  }, [items, selectedItemsByPerson, numberOfPeople]);

  const totalAssigned = itemsSplit.reduce((sum, s) => sum + s.amount, 0);
  const remaining = total - totalAssigned;

  const toggleItemForPerson = (itemId: string) => {
    setSelectedItemsByPerson(prev => {
      const personItems = prev[currentPerson] || [];
      const isSelected = personItems.includes(itemId);
      
      // Remove from all other people first
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        const k = parseInt(key);
        if (k !== currentPerson) {
          updated[k] = (updated[k] || []).filter(id => id !== itemId);
        }
      });
      
      // Toggle for current person
      if (isSelected) {
        updated[currentPerson] = personItems.filter(id => id !== itemId);
      } else {
        updated[currentPerson] = [...personItems, itemId];
      }
      
      return updated;
    });
  };

  const handleConfirm = () => {
    const splits = splitMode === 'equal' ? equalSplit : itemsSplit;
    onConfirm(splits);
    onOpenChange(false);
  };

  const getItemOwner = (itemId: string): number | null => {
    for (const [person, itemIds] of Object.entries(selectedItemsByPerson)) {
      if (itemIds.includes(itemId)) {
        return parseInt(person);
      }
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Dividir Conta
          </DialogTitle>
          <DialogDescription>
            Total: <span className="font-bold text-foreground">{formatCurrency(total)}</span>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={splitMode} onValueChange={(v) => setSplitMode(v as 'equal' | 'items')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="equal" className="gap-2">
              <Percent className="h-4 w-4" />
              Dividir Igual
            </TabsTrigger>
            <TabsTrigger value="items" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Por Item
            </TabsTrigger>
          </TabsList>

          <TabsContent value="equal" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Número de pessoas</Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setNumberOfPeople(Math.max(2, numberOfPeople - 1))}
                  disabled={numberOfPeople <= 2}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="text-3xl font-bold w-16 text-center">{numberOfPeople}</div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setNumberOfPeople(Math.min(20, numberOfPeople + 1))}
                  disabled={numberOfPeople >= 20}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {equalSplit.map((split, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20"
                >
                  <div className="text-sm text-muted-foreground">{split.label}</div>
                  <div className="text-xl font-bold text-primary">{formatCurrency(split.amount)}</div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="items" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Número de pessoas</Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setNumberOfPeople(Math.max(2, numberOfPeople - 1))}
                  disabled={numberOfPeople <= 2}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="text-3xl font-bold w-16 text-center">{numberOfPeople}</div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setNumberOfPeople(Math.min(20, numberOfPeople + 1))}
                  disabled={numberOfPeople >= 20}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Person selector */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {Array.from({ length: numberOfPeople }, (_, i) => (
                <Button
                  key={i}
                  variant={currentPerson === i ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPerson(i)}
                  className="shrink-0"
                >
                  Pessoa {i + 1}
                  {(selectedItemsByPerson[i]?.length || 0) > 0 && (
                    <span className="ml-1 text-xs opacity-70">
                      ({selectedItemsByPerson[i].length})
                    </span>
                  )}
                </Button>
              ))}
            </div>

            {/* Items list */}
            <ScrollArea className="h-48 rounded-lg border p-3">
              <div className="space-y-2">
                {items.map((item) => {
                  const owner = getItemOwner(item.id);
                  const isOwnedByCurrentPerson = owner === currentPerson;
                  const isOwnedByOther = owner !== null && owner !== currentPerson;

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleItemForPerson(item.id)}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all',
                        isOwnedByCurrentPerson && 'bg-primary/10 border border-primary/30',
                        isOwnedByOther && 'bg-muted/50 opacity-50',
                        !owner && 'hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox checked={isOwnedByCurrentPerson} />
                        <div>
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.quantity}x {formatCurrency(item.unit_price)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{formatCurrency(item.total_price)}</div>
                        {isOwnedByOther && (
                          <div className="text-xs text-muted-foreground">
                            Pessoa {owner! + 1}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              {itemsSplit.map((split, i) => (
                <div
                  key={i}
                  className={cn(
                    'p-3 rounded-xl border',
                    currentPerson === i
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-muted/30 border-border'
                  )}
                >
                  <div className="text-sm text-muted-foreground">{split.label}</div>
                  <div className="text-lg font-bold">{formatCurrency(split.amount)}</div>
                </div>
              ))}
            </div>

            {remaining > 0.01 && (
              <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/20 p-3 rounded-lg">
                ⚠️ Faltam {formatCurrency(remaining)} para atribuir
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="gap-2">
            <Check className="h-4 w-4" />
            Confirmar Divisão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
