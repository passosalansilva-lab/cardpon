import React, { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, Loader2, Package, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ImageUpload } from '@/components/ui/image-upload';
import { CurrencyInput } from '@/components/ui/currency-input';
import { cn } from '@/lib/utils';

interface ComboEditorProps {
  comboId: string | null;
  productId: string | null;
  categoryId: string | null;
  companyId: string;
  onClose: () => void;
}

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  image_url: string | null;
}

interface ComboSlot {
  id: string;
  name: string;
  min_quantity: number;
  max_quantity: number;
  sort_order: number;
  products: string[];
}

// Componente de slot arrastável simplificado
function SortableSlotCard({ 
  slot, 
  products,
  comboMode,
  onDelete,
  onProductToggle,
  onNameChange,
  onQuantityChange,
}: { 
  slot: ComboSlot; 
  products: Product[];
  comboMode: 'fixed' | 'selectable';
  onDelete: () => void;
  onProductToggle: (productId: string) => void;
  onNameChange: (name: string) => void;
  onQuantityChange: (min: number, max: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id });
  const [isExpanded, setIsExpanded] = useState(true);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const selectedProducts = products.filter(p => slot.products.includes(p.id));
  const totalPrice = selectedProducts.reduce((sum, p) => Math.max(sum, p.price), 0);

  return (
    <div ref={setNodeRef} style={style} className="bg-card border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-4 bg-muted/30">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <Input
            value={slot.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Nome do slot (ex: Lanche, Bebida)"
            className="font-semibold border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center gap-2">
          {selectedProducts.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {selectedProducts.length} {selectedProducts.length === 1 ? 'produto' : 'produtos'}
            </Badge>
          )}
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Ocultar' : 'Mostrar'}
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 border-t space-y-4">
          {/* Configuração de quantidade (apenas para modo selectable) */}
          {comboMode === 'selectable' && (
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Cliente escolhe</Label>
                <Input
                  type="number"
                  min="1"
                  max={selectedProducts.length || 99}
                  value={slot.min_quantity}
                  onChange={(e) => {
                    const min = Math.max(1, parseInt(e.target.value) || 1);
                    onQuantityChange(min, Math.max(min, slot.max_quantity));
                  }}
                  className="w-16 h-8 text-center text-sm"
                />
                <span className="text-xs text-muted-foreground">a</span>
                <Input
                  type="number"
                  min={slot.min_quantity}
                  max={selectedProducts.length || 99}
                  value={slot.max_quantity}
                  onChange={(e) => {
                    const max = Math.max(slot.min_quantity, parseInt(e.target.value) || 1);
                    onQuantityChange(slot.min_quantity, max);
                  }}
                  className="w-16 h-8 text-center text-sm"
                />
                <span className="text-xs text-muted-foreground">
                  {slot.max_quantity === 1 ? 'item' : 'itens'}
                </span>
              </div>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-3">
              {comboMode === 'selectable' 
                ? 'Selecione os produtos disponíveis para escolha:'
                : 'Selecione os produtos que compõem este slot:'
              }
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {products.map((product) => {
                const isSelected = slot.products.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => onProductToggle(product.id)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border text-left transition-all",
                      isSelected 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <div className={cn(
                      "h-5 w-5 rounded border flex items-center justify-center flex-shrink-0",
                      isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                    )}>
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">R$ {Number(product.price).toFixed(2)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          
          {selectedProducts.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Preço considerado para este slot: R$ {totalPrice.toFixed(2)} (maior valor)
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ComboEditor({ comboId, productId, categoryId, companyId, onClose }: ComboEditorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [slots, setSlots] = useState<ComboSlot[]>([]);
  
  // Dados do combo
  const [comboName, setComboName] = useState('');
  const [comboDescription, setComboDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountPercent, setDiscountPercent] = useState('10');
  const [comboMode, setComboMode] = useState<'fixed' | 'selectable'>('fixed');

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    loadData();
  }, [comboId, productId]);

  // Calcular preço base do combo
  const basePrice = slots.reduce((total, slot) => {
    if (!slot.products.length) return total;
    
    // Sempre soma TODOS os produtos do slot (para referência no editor)
    const slotTotal = slot.products.reduce((sum, id) => {
      const product = products.find(p => p.id === id);
      return sum + (product?.price || 0);
    }, 0);
    return total + slotTotal;
  }, 0);

  const discountValue = hasDiscount ? (basePrice * (parseFloat(discountPercent) || 0)) / 100 : 0;
  const finalPrice = Math.max(basePrice - discountValue, 0);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar produtos ativos (excluindo outros combos)
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, price, category_id, image_url')
        .eq('company_id', companyId)
        .eq('is_active', true);

      if (productsError) throw productsError;
      
      // Buscar produtos que já são combos
      const { data: existingCombos } = await supabase
        .from('combos')
        .select('product_id')
        .eq('company_id', companyId);
      
      // Buscar categorias do tipo 'combos' para excluir seus produtos
      const { data: comboCategories } = await supabase
        .from('categories')
        .select('id')
        .eq('company_id', companyId)
        .eq('category_type', 'combos');
      
      const comboProductIds = new Set((existingCombos || []).map(c => c.product_id));
      const comboCategoryIds = new Set((comboCategories || []).map(c => c.id));
      
      // Filtrar: excluir o produto atual, produtos que já são combos, e produtos de categorias de combos
      const filteredProducts = (productsData || []).filter(p => 
        p.id !== productId && 
        !comboProductIds.has(p.id) &&
        !comboCategoryIds.has(p.category_id || '')
      );
      
      setProducts(filteredProducts);

      // Carregar dados do produto base
      if (productId) {
        const { data: productData } = await supabase
          .from('products')
          .select('name, description, image_url')
          .eq('id', productId)
          .single();
        
        if (productData) {
          setComboName(productData.name || '');
          setComboDescription(productData.description || '');
          setImageUrl(productData.image_url);
        }
      }

      // Carregar combo existente
      if (comboId) {
        const { data: comboData, error: comboError } = await supabase
          .from('combos')
          .select('*')
          .eq('id', comboId)
          .single();

        if (comboError) throw comboError;

        setHasDiscount(comboData.price_type === 'percentage' && (comboData.discount_percent || 0) > 0);
        setDiscountPercent(String(comboData.discount_percent || 10));
        setComboMode((comboData.combo_mode as 'fixed' | 'selectable') || 'fixed');

        // Carregar slots
        const { data: slotsData, error: slotsError } = await supabase
          .from('combo_slots')
          .select('*')
          .eq('combo_id', comboId)
          .order('sort_order');

        if (slotsError) throw slotsError;

        const slotsWithProducts = await Promise.all(
          (slotsData || []).map(async (slot) => {
            const { data: slotProducts } = await supabase
              .from('combo_slot_products')
              .select('product_id')
              .eq('slot_id', slot.id);

            return {
              id: slot.id,
              name: slot.name,
              min_quantity: slot.min_quantity,
              max_quantity: slot.max_quantity,
              sort_order: slot.sort_order,
              products: (slotProducts || []).map((sp) => sp.product_id),
            };
          })
        );

        setSlots(slotsWithProducts);
      }
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Erro ao carregar dados',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCombo = async () => {
    if (!comboName.trim()) {
      toast({ title: 'Nome do combo é obrigatório', variant: 'destructive' });
      return;
    }
    if (slots.length === 0) {
      toast({ title: 'Adicione pelo menos um slot', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);

      let finalProductId = productId;

      // Se não tem productId, criar o produto primeiro
      if (!finalProductId) {
        if (!categoryId) {
          toast({ title: 'Categoria não definida', variant: 'destructive' });
          return;
        }

        const { data: newProduct, error: createError } = await supabase
          .from('products')
          .insert({
            company_id: companyId,
            name: comboName.trim(),
            description: comboDescription.trim() || null,
            price: Number(finalPrice.toFixed(2)),
            image_url: imageUrl,
            category_id: categoryId,
            is_active: true,
            is_featured: false,
          })
          .select('id')
          .single();

        if (createError) throw createError;
        finalProductId = newProduct.id;
      } else {
        // Atualizar produto existente
        const { error: productError } = await supabase
          .from('products')
          .update({
            name: comboName.trim(),
            description: comboDescription.trim() || null,
            image_url: imageUrl,
            price: Number(finalPrice.toFixed(2)),
          })
          .eq('id', finalProductId);

        if (productError) throw productError;
      }

      // Salvar combo
      const comboPayload = {
        company_id: companyId,
        product_id: finalProductId,
        price_type: hasDiscount ? 'percentage' : 'fixed',
        discount_percent: hasDiscount ? Number(discountPercent) : null,
        show_discount_badge: hasDiscount,
        combo_mode: comboMode,
      };

      let finalComboId = comboId;

      if (comboId) {
        const { error } = await supabase.from('combos').update(comboPayload).eq('id', comboId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('combos').insert(comboPayload).select('id').single();
        if (error) throw error;
        finalComboId = data.id;
      }

      // Deletar slots antigos que não existem mais
      if (comboId) {
        const currentSlotIds = slots.filter(s => !s.id.startsWith('temp-')).map(s => s.id);
        if (currentSlotIds.length > 0) {
          await supabase.from('combo_slots').delete().eq('combo_id', comboId).not('id', 'in', `(${currentSlotIds.join(',')})`);
        } else {
          await supabase.from('combo_slots').delete().eq('combo_id', comboId);
        }
      }

      // Salvar slots
      await Promise.all(
        slots.map(async (slot, index) => {
          const slotPayload = {
            combo_id: finalComboId,
            name: slot.name || `Slot ${index + 1}`,
            min_quantity: slot.min_quantity || 1,
            max_quantity: slot.max_quantity || 1,
            sort_order: index,
          };

          let slotId = slot.id;

          if (slot.id.startsWith('temp-')) {
            const { data, error } = await supabase
              .from('combo_slots')
              .insert(slotPayload)
              .select('id')
              .single();
            if (error) throw error;
            slotId = data.id;
          } else {
            const { error } = await supabase.from('combo_slots').update(slotPayload).eq('id', slot.id);
            if (error) throw error;
          }

          // Atualizar produtos do slot
          await supabase.from('combo_slot_products').delete().eq('slot_id', slotId);

          if (slot.products.length > 0) {
            const { error } = await supabase
              .from('combo_slot_products')
              .insert(slot.products.map((prodId) => ({ slot_id: slotId, product_id: prodId })));
            if (error) throw error;
          }
        })
      );

      toast({ title: comboId ? 'Combo atualizado!' : 'Combo criado!' });
      onClose();
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Erro ao salvar combo',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddSlot = () => {
    const newSlot: ComboSlot = {
      id: `temp-${Date.now()}`,
      name: '',
      min_quantity: 1,
      max_quantity: 1,
      sort_order: slots.length,
      products: [],
    };
    setSlots([...slots, newSlot]);
  };

  const handleDeleteSlot = (slotId: string) => {
    setSlots(slots.filter((s) => s.id !== slotId));
  };

  const handleSlotNameChange = (slotId: string, name: string) => {
    setSlots(slots.map(s => s.id === slotId ? { ...s, name } : s));
  };

  const handleProductToggle = (slotId: string, productId: string) => {
    setSlots(slots.map(s => {
      if (s.id !== slotId) return s;
      const isSelected = s.products.includes(productId);
      return {
        ...s,
        products: isSelected 
          ? s.products.filter(id => id !== productId)
          : [...s.products, productId],
      };
    }));
  };

  const handleSlotQuantityChange = (slotId: string, min: number, max: number) => {
    setSlots(slots.map(s => s.id === slotId ? { ...s, min_quantity: min, max_quantity: max } : s));
  };

  const handleSlotDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = slots.findIndex((s) => s.id === active.id);
    const newIndex = slots.findIndex((s) => s.id === over.id);

    setSlots(arrayMove(slots, oldIndex, newIndex));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {/* Dados básicos do combo */}
      <div className="space-y-4">
        <div className="grid md:grid-cols-[200px_1fr] gap-6">
          <div>
            <Label className="mb-2 block">Imagem</Label>
            <ImageUpload
              value={imageUrl}
              onChange={setImageUrl}
              folder={companyId}
              aspectRatio="square"
              showGallery
              companyId={companyId}
            />
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="comboName">Nome do Combo *</Label>
              <Input
                id="comboName"
                value={comboName}
                onChange={(e) => setComboName(e.target.value)}
                placeholder="Ex: Combo Família, Combo Duplo"
                className="text-lg font-semibold"
              />
            </div>

            <div>
              <Label htmlFor="comboDescription">Descrição (opcional)</Label>
              <Input
                id="comboDescription"
                value={comboDescription}
                onChange={(e) => setComboDescription(e.target.value)}
                placeholder="Ex: Perfeito para compartilhar"
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Tipo de combo */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Tipo de Combo</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setComboMode('fixed')}
            className={cn(
              "p-4 rounded-lg border-2 text-left transition-all",
              comboMode === 'fixed'
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            )}
          >
            <div className="font-semibold mb-1">📦 Combo Fixo</div>
            <p className="text-xs text-muted-foreground">
              Itens já definidos. O cliente só adiciona ao carrinho.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setComboMode('selectable')}
            className={cn(
              "p-4 rounded-lg border-2 text-left transition-all",
              comboMode === 'selectable'
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            )}
          >
            <div className="font-semibold mb-1">🎯 Com Escolhas</div>
            <p className="text-xs text-muted-foreground">
              O cliente escolhe uma opção em cada slot.
            </p>
          </button>
        </div>
      </div>

      <Separator />

      {/* Slots do combo */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">O que vem no combo?</h3>
            <p className="text-sm text-muted-foreground">
              {comboMode === 'fixed' 
                ? 'Adicione os slots e selecione os produtos que compõem o combo'
                : 'Adicione os slots e selecione quais produtos o cliente pode escolher em cada um'
              }
            </p>
          </div>
          <Button onClick={handleAddSlot} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Adicionar slot
          </Button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSlotDragEnd}>
          <SortableContext items={slots.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {slots.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h4 className="font-medium mb-1">Nenhum slot adicionado</h4>
                    <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                      Slots são as partes do combo. Ex: "Lanche", "Acompanhamento", "Bebida"
                    </p>
                    <Button onClick={handleAddSlot}>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar primeiro slot
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                slots.map((slot) => (
                  <SortableSlotCard
                    key={slot.id}
                    slot={slot}
                    products={products}
                    comboMode={comboMode}
                    onDelete={() => handleDeleteSlot(slot.id)}
                    onProductToggle={(productId) => handleProductToggle(slot.id, productId)}
                    onNameChange={(name) => handleSlotNameChange(slot.id, name)}
                    onQuantityChange={(min, max) => handleSlotQuantityChange(slot.id, min, max)}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <Separator />

      {/* Preço e desconto */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Preço do Combo</h3>
        
        <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
          {comboMode === 'selectable' && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>⚠️ Combo com escolhas:</strong> O valor abaixo é a soma de todos os produtos disponíveis. 
                O cliente pagará apenas pelos produtos que selecionar, com o desconto aplicado sobre a seleção dele.
              </p>
            </div>
          )}
          
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {comboMode === 'fixed' ? 'Soma dos produtos:' : 'Total disponível (referência):'}
            </span>
            <span className="font-medium">R$ {basePrice.toFixed(2)}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={hasDiscount}
                onCheckedChange={setHasDiscount}
                id="hasDiscount"
              />
              <Label htmlFor="hasDiscount" className="cursor-pointer">
                Aplicar desconto
              </Label>
            </div>
            {hasDiscount && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="99"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  className="w-20 text-center"
                />
                <span className="text-sm">%</span>
              </div>
            )}
          </div>

          {hasDiscount && (
            <p className="text-xs text-muted-foreground">
              {comboMode === 'fixed' 
                ? `Desconto de ${discountPercent}% será aplicado no valor total.`
                : `Desconto de ${discountPercent}% será aplicado sobre o valor dos produtos que o cliente escolher.`
              }
            </p>
          )}

          {comboMode === 'fixed' && hasDiscount && discountValue > 0 && (
            <div className="flex justify-between text-sm text-destructive">
              <span>Desconto ({discountPercent}%):</span>
              <span>- R$ {discountValue.toFixed(2)}</span>
            </div>
          )}

          <Separator />

          <div className="flex justify-between text-lg font-bold">
            <span>{comboMode === 'fixed' ? 'Preço final:' : 'Preço varia conforme seleção'}</span>
            {comboMode === 'fixed' && (
              <span className="text-primary">R$ {finalPrice.toFixed(2)}</span>
            )}
          </div>
          
          {comboMode === 'selectable' && (
            <p className="text-xs text-muted-foreground">
              O cliente verá R$ 0,00 inicialmente e o valor será atualizado conforme selecionar os produtos.
            </p>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="flex gap-2 pt-2">
        <Button 
          onClick={handleSaveCombo} 
          disabled={saving || slots.length === 0 || !comboName.trim()} 
          className="flex-1"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar Combo
        </Button>
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
