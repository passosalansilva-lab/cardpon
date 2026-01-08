import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, Loader2, Package, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { useCart } from '@/hooks/useCart';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
}

interface ComboSlot {
  id: string;
  name: string;
  sort_order: number;
  min_quantity: number;
  max_quantity: number;
  products: Product[];
}

interface ComboModalProps {
  open: boolean;
  onClose: () => void;
  comboProductId: string;
  comboName: string;
  comboDescription: string | null;
  comboImageUrl: string | null;
  comboPrice: number;
  originalPrice?: number;
  companyId: string;
}

export function ComboModal({
  open,
  onClose,
  comboProductId,
  comboName,
  comboDescription,
  comboImageUrl,
  comboPrice,
  originalPrice,
  companyId,
}: ComboModalProps) {
  const { addItem } = useCart();
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<ComboSlot[]>([]);
  const [adding, setAdding] = useState(false);
  const [discountPercent, setDiscountPercent] = useState<number | null>(null);
  const [comboMode, setComboMode] = useState<'fixed' | 'selectable' | null>(null); // null = não carregado ainda
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (open && comboProductId) {
      loadComboData();
    }
  }, [open, comboProductId]);

  const loadComboData = async () => {
    try {
      setLoading(true);

      // Buscar combo
      const { data: comboData, error: comboError } = await supabase
        .from('combos')
        .select('id, discount_percent, combo_mode')
        .eq('product_id', comboProductId)
        .single();

      if (comboError || !comboData) {
        console.error('Combo não encontrado:', comboError);
        setSlots([]);
        setLoading(false);
        return;
      }

      setDiscountPercent(comboData.discount_percent);
      setComboMode((comboData.combo_mode as 'fixed' | 'selectable') || 'fixed');

      // Buscar slots do combo
      const { data: slotsData, error: slotsError } = await supabase
        .from('combo_slots')
        .select('id, name, sort_order, min_quantity, max_quantity')
        .eq('combo_id', comboData.id)
        .order('sort_order');

      if (slotsError) throw slotsError;

      // Buscar produtos de cada slot
      const slotsWithProducts = await Promise.all(
        (slotsData || []).map(async (slot) => {
          const { data: slotProductsData } = await supabase
            .from('combo_slot_products')
            .select('product_id')
            .eq('slot_id', slot.id);

          const productIds = (slotProductsData || []).map(sp => sp.product_id);

          if (productIds.length === 0) {
            return { ...slot, products: [] };
          }

          const { data: productsData } = await supabase
            .from('products')
            .select('id, name, description, price, image_url')
            .in('id', productIds);

          return {
            ...slot,
            min_quantity: slot.min_quantity || 1,
            max_quantity: slot.max_quantity || 1,
            products: (productsData || []).map(p => ({
              ...p,
              price: Number(p.price),
            })),
          };
        })
      );

      setSlots(slotsWithProducts);
      
      // Inicializar seleções
      const initialSelections: Record<string, string[]> = {};
      const mode = (comboData.combo_mode as 'fixed' | 'selectable') || 'fixed';
      
      slotsWithProducts.forEach(slot => {
        if (mode === 'fixed') {
          // Combo fixo: todos os produtos já estão selecionados
          initialSelections[slot.id] = slot.products.map(p => p.id);
        } else {
          // Combo com escolhas: começa vazio (R$ 0,00)
          initialSelections[slot.id] = [];
        }
      });
      setSelections(initialSelections);
    } catch (error) {
      console.error('Erro ao carregar combo:', error);
    } finally {
      setLoading(false);
    }
  };

  // Ordenar slots: bebidas sempre por último
  const sortedSlots = [...slots].sort((a, b) => {
    const aIsBeverage = a.name.toLowerCase().includes('bebida') || 
      a.products.some(p => p.name.toLowerCase().includes('bebida'));
    const bIsBeverage = b.name.toLowerCase().includes('bebida') || 
      b.products.some(p => p.name.toLowerCase().includes('bebida'));
    
    if (aIsBeverage && !bIsBeverage) return 1;
    if (!aIsBeverage && bIsBeverage) return -1;
    return a.sort_order - b.sort_order;
  });

  // Descrição dos itens do combo para o carrinho
  const getComboItemsDescription = () => {
    // Retorna os produtos selecionados (ambos os modos usam selections agora)
    const selectedItems = sortedSlots
      .flatMap(slot => {
        const selectedIds = selections[slot.id] || [];
        return slot.products
          .filter(p => selectedIds.includes(p.id))
          .map(p => p.name);
      })
      .filter(Boolean);
    
    // Se modo fixo e algum item foi removido, indicar
    if (comboMode === 'fixed') {
      const allItems = sortedSlots.flatMap(slot => slot.products);
      const totalSelected = sortedSlots.reduce((sum, slot) => sum + (selections[slot.id]?.length || 0), 0);
      const removedCount = allItems.length - totalSelected;
      
      if (removedCount > 0) {
        const removedItems = sortedSlots
          .flatMap(slot => {
            const selectedIds = selections[slot.id] || [];
            return slot.products
              .filter(p => !selectedIds.includes(p.id))
              .map(p => p.name);
          });
        return selectedItems.join(', ') + ` (sem: ${removedItems.join(', ')})`;
      }
    }
    
    return selectedItems.join(', ');
  };

  // Toggle de item em combo fixo (remover/adicionar de volta)
  const toggleFixedComboItem = (slotId: string, productId: string) => {
    setSelections(prev => {
      const currentSelections = prev[slotId] || [];
      const isSelected = currentSelections.includes(productId);
      
      if (isSelected) {
        // Remover item
        return { ...prev, [slotId]: currentSelections.filter(id => id !== productId) };
      } else {
        // Adicionar de volta
        return { ...prev, [slotId]: [...currentSelections, productId] };
      }
    });
  };

  // Verificar se todas as seleções foram feitas (modo selectable)
  const allSelectionsComplete = comboMode === 'fixed' || 
    (comboMode === 'selectable' && sortedSlots.every(slot => {
      const selectedCount = (selections[slot.id] || []).length;
      return selectedCount >= slot.min_quantity;
    }));

  // Toggle de seleção de produto
  const toggleProductSelection = (slotId: string, productId: string, maxQty: number) => {
    setSelections(prev => {
      const currentSelections = prev[slotId] || [];
      const isSelected = currentSelections.includes(productId);
      
      if (isSelected) {
        // Remover seleção
        return { ...prev, [slotId]: currentSelections.filter(id => id !== productId) };
      } else {
        // Adicionar seleção (respeitando max)
        if (currentSelections.length >= maxQty) {
          // Se já atingiu o máximo, substituir o primeiro
          return { ...prev, [slotId]: [...currentSelections.slice(1), productId] };
        }
        return { ...prev, [slotId]: [...currentSelections, productId] };
      }
    });
  };

  // Calcular preço baseado no modo e seleções
  // Se ainda não carregou o modo, mostra 0 para evitar flicker
  const calculatedPrice = (() => {
    if (comboMode === null || loading) {
      return 0; // Evita flicker: mostra 0 enquanto carrega
    }
    if (comboMode === 'fixed') {
      return comboPrice;
    }
    
    // Modo selectable: soma os produtos selecionados
    let totalSelectedPrice = 0;
    sortedSlots.forEach(slot => {
      const selectedIds = selections[slot.id] || [];
      selectedIds.forEach(productId => {
        const product = slot.products.find(p => p.id === productId);
        if (product) {
          totalSelectedPrice += product.price;
        }
      });
    });
    
    if (discountPercent && discountPercent > 0) {
      return totalSelectedPrice * (1 - discountPercent / 100);
    }
    return totalSelectedPrice;
  })();

  const originalSelectedPrice = (() => {
    if (comboMode === null || loading) {
      return 0;
    }
    if (comboMode === 'fixed') {
      return originalPrice;
    }
    
    let total = 0;
    sortedSlots.forEach(slot => {
      const selectedIds = selections[slot.id] || [];
      selectedIds.forEach(productId => {
        const product = slot.products.find(p => p.id === productId);
        if (product) {
          total += product.price;
        }
      });
    });
    return total;
  })();

  const hasDiscount = Boolean(discountPercent && discountPercent > 0);
  const displayPrice = (comboMode === 'fixed' ? comboPrice : calculatedPrice);
  const displayOriginalPrice = comboMode === 'fixed' 
    ? (hasDiscount ? comboPrice / (1 - discountPercent! / 100) : originalPrice)
    : originalSelectedPrice;
  const savings = (hasDiscount && displayOriginalPrice && displayOriginalPrice > 0) 
    ? displayOriginalPrice - displayPrice 
    : 0;
  
  // No modo selectable enquanto carrega ou sem seleções, não exibe preço original riscado
  const showOriginalPrice = Boolean(hasDiscount && displayOriginalPrice && displayOriginalPrice > 0 && (comboMode === 'fixed' || Object.values(selections).some(arr => arr.length > 0)));

  const handleAddToCart = async () => {
    setAdding(true);
    try {
      const itemsDescription = getComboItemsDescription();
      
      addItem({
        productId: comboProductId,
        productName: comboName,
        price: displayPrice,
        quantity: 1,
        imageUrl: comboImageUrl || undefined,
        options: itemsDescription ? [{
          name: itemsDescription,
          priceModifier: 0,
          groupName: 'Itens inclusos',
        }] : [],
        notes: itemsDescription ? `Combo: ${itemsDescription}` : undefined,
        requiresPreparation: true, // Combos always need preparation
      });

      toast.success('Combo adicionado à sacola!');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao adicionar combo');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[90vh] bg-background rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        {/* Header com imagem */}
        <div className="relative">
          {comboImageUrl ? (
            <div className="relative h-48 sm:h-56">
              <OptimizedImage
                src={comboImageUrl}
                alt={comboName}
                className="w-full h-full object-cover"
                containerClassName="w-full h-full"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <Badge className="mb-2 bg-primary text-primary-foreground">
                  🎁 Combo
                </Badge>
                <h2 className="text-white font-display font-bold text-2xl">{comboName}</h2>
                {comboDescription && (
                  <p className="text-white/80 text-sm mt-1">{comboDescription}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 pb-2">
              <Badge className="mb-2 bg-primary text-primary-foreground">
                🎁 Combo
              </Badge>
              <h2 className="font-display font-bold text-xl">{comboName}</h2>
              {comboDescription && (
                <p className="text-muted-foreground text-sm mt-1">{comboDescription}</p>
              )}
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center shadow-lg hover:bg-background transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content - Lista do que vem no combo */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : slots.length === 0 || slots.every(s => s.products.length === 0) ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">Combo não configurado</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {comboMode === 'selectable' ? 'Monte seu combo' : 'O que vem no combo'}
              </h3>
              
              {sortedSlots.map((slot) => {
                const selectedIds = selections[slot.id] || [];
                const selectedCount = selectedIds.length;
                const minQty = slot.min_quantity || 1;
                const maxQty = slot.max_quantity || 1;
                
                return (
                <div key={slot.id} className="space-y-2">
                  {slot.name && (
                    <p className="text-xs font-medium text-muted-foreground">
                      {slot.name}
                      {comboMode === 'selectable' && (
                        <span className="ml-1 text-primary">
                          (escolha {minQty === maxQty ? minQty : `${minQty} a ${maxQty}`})
                          {selectedCount > 0 && ` - ${selectedCount}/${maxQty}`}
                        </span>
                      )}
                    </p>
                  )}
                  {slot.products.map((product) => {
                    const isSelected = selectedIds.includes(product.id);
                    // Combo fixo: sempre clicável para remover/adicionar
                    // Combo selectable: sempre clicável para permitir seleção/remoção
                    const isClickable = comboMode === 'fixed' || comboMode === 'selectable';
                    
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => {
                          if (comboMode === 'fixed') {
                            toggleFixedComboItem(slot.id, product.id);
                          } else if (comboMode === 'selectable') {
                            toggleProductSelection(slot.id, product.id, maxQty);
                          }
                        }}
                        disabled={!isClickable}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl w-full text-left transition-all",
                          isClickable
                            ? "cursor-pointer hover:bg-primary/5" 
                            : "cursor-default",
                          isSelected
                            ? "bg-primary/10 border-2 border-primary"
                            : "bg-muted/30 border-2 border-dashed border-muted-foreground/30 opacity-60"
                        )}
                      >
                        {product.image_url ? (
                          <div className={cn(
                            "w-12 h-12 rounded-lg overflow-hidden flex-shrink-0",
                            !isSelected && "grayscale"
                          )}>
                            <OptimizedImage
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              containerClassName="w-full h-full"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                            <Package className="h-5 w-5 text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={cn(
                              "font-medium text-sm",
                              !isSelected && "line-through text-muted-foreground"
                            )}>
                              {product.name}
                            </p>
                            {comboMode === 'selectable' && (
                              <span className="text-sm font-semibold text-primary flex-shrink-0">
                                R$ {product.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                          {product.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {product.description}
                            </p>
                          )}
                          {comboMode === 'fixed' && !isSelected && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                              Clique para adicionar de volta
                            </p>
                          )}
                          {comboMode === 'fixed' && isSelected && (
                            <p className="text-xs text-muted-foreground/70 mt-0.5">
                              Clique para remover
                            </p>
                          )}
                        </div>
                        {isSelected ? (
                          <Check className="h-5 w-5 text-primary flex-shrink-0" />
                        ) : (
                          <X className="h-5 w-5 text-muted-foreground/50 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer com preço e botão */}
        <div className="p-4 border-t bg-background space-y-3">
          {/* Preço */}
          <div className="flex items-center justify-between">
            <div>
              {showOriginalPrice && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground line-through">
                    R$ {displayOriginalPrice?.toFixed(2)}
                  </span>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    -{discountPercent}%
                  </Badge>
                </div>
              )}
              <p className="text-2xl font-bold text-primary">
                R$ {displayPrice.toFixed(2)}
              </p>
              {showOriginalPrice && savings > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Você economiza R$ {savings.toFixed(2)}
                </p>
              )}
            </div>
          </div>

          <Button
            onClick={handleAddToCart}
            disabled={adding || loading || !allSelectionsComplete}
            className="w-full h-14 text-base rounded-2xl gradient-primary"
          >
            {adding ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <ShoppingBag className="h-5 w-5 mr-2" />
                Adicionar à sacola
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
