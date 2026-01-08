import React, { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Settings2,
  Loader2,
} from 'lucide-react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface OptionItem {
  id: string;
  name: string;
  description: string | null;
  price_modifier: number;
  is_required: boolean;
  is_available: boolean;
  sort_order: number;
  group_id: string | null;
}

interface OptionGroup {
  id: string;
  product_id?: string;
  name: string;
  description: string | null;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  selection_type: string;
  sort_order: number;
  created_at?: string;
  free_quantity_limit: number;
  extra_unit_price: number;
  scope?: 'global' | 'product';
  kind?: 'crust' | 'addon' | 'generic';
  options: OptionItem[];
}

interface DoughType {
  id: string;
  name: string;
  extra_price: number;
  active: boolean;
}

interface CrustType {
  id: string;
  name: string;
  active: boolean;
}

interface CrustFlavor {
  id: string;
  type_id: string;
  name: string;
  extra_price: number;
  active: boolean;
}

interface GlobalSize {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

interface CategorySize {
  id: string;
  category_id: string;
  name: string;
  base_price: number;
  max_flavors: number;
  sort_order: number;
  slices?: number;
}

interface SortableGroupCardProps {
  group: OptionGroup;
  expanded: boolean;
  toggleExpanded: (id: string) => void;
  openGroupModal: (group: OptionGroup) => void;
  deleteGroup: (id: string) => void;
  openOptionModal: (groupId: string, option?: OptionItem) => void;
  deleteOption: (id: string) => void;
  newOptions: Record<string, { name: string; description: string; price_modifier: string }>;
  setNewOptions: React.Dispatch<
    React.SetStateAction<
      Record<string, { name: string; description: string; price_modifier: string }>
    >
  >;
  saving: boolean;
  productId: string;
  onInlineOptionAdded: (groupId: string, option: OptionItem) => void;
  optionDescriptionPlaceholder: string;
}


interface ProductOptionsEditorProps {
  productId: string;
  productName: string;
  open: boolean;
  onClose: () => void;
  embedded?: boolean;
}

const SELECTION_TYPES = [
  { value: 'single', label: 'Escolha única', description: 'Cliente escolhe apenas uma opção' },
  { value: 'multiple', label: 'Múltipla escolha', description: 'Cliente pode escolher várias opções' },
  { value: 'half_half', label: 'Meio a meio', description: 'Para pizzas: escolher 2 sabores' },
];

const SortableGroupCard: React.FC<SortableGroupCardProps> = ({
  group,
  expanded,
  toggleExpanded,
  openGroupModal,
  deleteGroup,
  openOptionModal,
  deleteOption,
  newOptions,
  setNewOptions,
  saving,
  productId,
  onInlineOptionAdded,
  optionDescriptionPlaceholder,
}) => {
  const { toast } = useToast();

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: group.id,
    disabled: group.id === 'ungrouped',
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
  };

  const inline =
    newOptions[group.id] || ({ name: '', description: '', price_modifier: '0' } as const);
  const isSavingInline = saving;

  const handleChange = (field: 'name' | 'description' | 'price_modifier', value: string) => {
    setNewOptions((prev) => ({
      ...prev,
      [group.id]: {
        name: field === 'name' ? value : inline.name,
        description: field === 'description' ? value : inline.description,
        price_modifier: field === 'price_modifier' ? value : inline.price_modifier,
      },
    }));
  };

  const handleAdd = async () => {
    console.log('ProductOptionsEditor: handleAdd inline option clicked', {
      groupId: group.id,
      current: newOptions[group.id] || inline,
    });

    const current = newOptions[group.id] || inline;

    // Garante que o nome foi preenchido, senão mostra aviso
    if (!current.name.trim()) {
      toast({
        title: 'Informe o nome da opção',
        description: 'Digite o nome da opção antes de adicionar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const groupId = group.id === 'ungrouped' ? null : group.id;
      const data = {
        product_id: productId,
        group_id: groupId,
        name: current.name.trim(),
        description: current.description.trim() || null,
        price_modifier: parseFloat(current.price_modifier) || 0,
        is_required: false,
        is_available: true,
        sort_order: group.options.length,
      };

      console.log('ProductOptionsEditor: inserting inline option', data);

      const { data: inserted, error } = await supabase
        .from('product_options')
        .insert(data)
        .select('*')
        .single();
      if (error) throw error;

      toast({ title: 'Opção adicionada' });
      setNewOptions((prev) => ({
        ...prev,
        [group.id]: { name: '', description: '', price_modifier: '0' },
      }));
      if (inserted) {
        onInlineOptionAdded(group.id, inserted as OptionItem);
      }
    } catch (error: any) {
      console.error('ProductOptionsEditor: erro ao adicionar opção', error);
      toast({
        title: 'Erro ao adicionar opção',
        description: error.message,
        variant: 'destructive',
      });
    }
  };
  return (
    <Card ref={setNodeRef} style={style} className="overflow-hidden">
      <Collapsible open={expanded}>
        <CardHeader
          className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => toggleExpanded(group.id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                {...listeners}
                {...attributes}
                onClick={(e) => e.stopPropagation()}
                className="cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </span>
              <div>
                <CardTitle className="text-base">{group.name}</CardTitle>
                <div className="flex gap-2 mt-1">
                  {group.is_required && (
                    <Badge variant="secondary" className="text-xs">
                      Obrigatório
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {SELECTION_TYPES.find((t) => t.value === group.selection_type)?.label ||
                      group.selection_type}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {group.options.length} {group.options.length === 1 ? 'opção' : 'opções'}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {group.id !== 'ungrouped' && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openGroupModal(group);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteGroup(group.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="p-4 pt-0 space-y-2">
            {group.options.map((option) => (
              <div
                key={option.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-background"
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{option.name}</p>
                    {option.description && (
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`font-medium ${
                      option.price_modifier > 0
                        ? 'text-success'
                        : option.price_modifier < 0
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {option.price_modifier > 0 && '+'}
                    {option.price_modifier !== 0
                      ? `R$ ${Number(option.price_modifier).toFixed(2)}`
                      : 'Incluso'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openOptionModal(group.id, option)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteOption(option.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="mt-3 border-t pt-3 space-y-2">

              <p className="text-xs text-muted-foreground">Nova opção rápida neste grupo</p>
              <div className="grid grid-cols-3 gap-2 items-end">
                <div className="space-y-1 col-span-1">
                  <Label className="text-xs">Nome *</Label>
                  <Input
                    value={inline.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder={
                      group.name
                        ? `Ex: opção para "${group.name}"`
                        : 'Ex: primeira opção deste grupo'
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1 col-span-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input
                    value={inline.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder={
                      group.name
                        ? `Detalhe da opção em "${group.name}" (opcional)`
                        : 'Descreva melhor esta opção (opcional)'
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1 col-span-1">
                  <Label className="text-xs">Preço</Label>
                  <CurrencyInput
                    value={inline.price_modifier}
                    onChange={(value) => handleChange('price_modifier', value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-dashed"
                  onClick={handleAdd}
                  disabled={isSavingInline}
                >
                  {isSavingInline && (
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  )}
                  <Plus className="h-3 w-3 mr-1" />
                  Salvar item
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export function ProductOptionsEditor({
  productId,
  productName,
  open,
  onClose,
  embedded = false,
}: ProductOptionsEditorProps) {
  const { toast } = useToast();

  const normalizedName = productName.toLowerCase();
  const isPizzaProduct = normalizedName.includes('pizza');
  const isAcaiProduct = normalizedName.includes('açaí') || normalizedName.includes('acai');

  const groupDescriptionPlaceholder = isPizzaProduct
    ? 'Ex: Escolha o tamanho da pizza'
    : isAcaiProduct
      ? 'Ex: Monte seu açaí com os acompanhamentos'
      : 'Ex: Escolha as opções ou adicionais do produto';

  const optionDescriptionPlaceholder = isPizzaProduct
    ? 'Ex: Pizza de 12 fatias'
    : isAcaiProduct
      ? 'Ex: Açaí 500ml, com granola e leite condensado'
      : 'Ex: Porção extra, tamanho grande, sem cebola';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [reordering, setReordering] = useState(false);

  // Group form
  const [groupModal, setGroupModal] = useState<{ open: boolean; group: OptionGroup | null}>(
    {
      open: false,
      group: null,
    },
  );
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    is_required: false,
    min_selections: 0,
    max_selections: 1,
    selection_type: 'single',
    free_quantity_limit: 0,
    extra_unit_price: '0',
    applyToAllPizzas: false,
  });

  // Option form
  const [optionModal, setOptionModal] = useState<{ open: boolean; groupId: string; option: OptionItem | null }>(
    {
      open: false,
      groupId: '',
      option: null,
    },
  );
  const [optionForm, setOptionForm] = useState({
    name: '',
    description: '',
    price_modifier: '',
  });
  const [newOptions, setNewOptions] = useState<Record<string, { name: string; description: string; price_modifier: string }>>({});
 
  const [isPizzaCategory, setIsPizzaCategory] = useState(false);
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dough' | 'crust' | 'sizes' | 'extras'>('dough');
  
  // Dough types state
  const [doughTypes, setDoughTypes] = useState<DoughType[]>([]);
  const [selectedDoughs, setSelectedDoughs] = useState<Set<string>>(new Set());
  const [loadingDoughs, setLoadingDoughs] = useState(false);
  const [savingDoughs, setSavingDoughs] = useState(false);
  const [newDoughName, setNewDoughName] = useState('');
  const [newDoughPrice, setNewDoughPrice] = useState('0');
  
  // Crust types and flavors state
  const [crustTypes, setCrustTypes] = useState<CrustType[]>([]);
  const [crustFlavors, setCrustFlavors] = useState<CrustFlavor[]>([]);
  const [selectedCrusts, setSelectedCrusts] = useState<Set<string>>(new Set());
  const [loadingCrusts, setLoadingCrusts] = useState(false);
  const [savingCrusts, setSavingCrusts] = useState(false);
  const [newCrustTypeName, setNewCrustTypeName] = useState('');
  const [newFlavor, setNewFlavor] = useState<{ typeId: string; name: string; price: string } | null>(null);
  
  // Sizes state
  const [globalSizes, setGlobalSizes] = useState<any[]>([]);
  const [categorySizes, setCategorySizes] = useState<any[]>([]);
  const [loadingSizes, setLoadingSizes] = useState(false);
  const [savingSizes, setSavingSizes] = useState(false);
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizePrice, setNewSizePrice] = useState('0');
  const [newSizeMaxFlavors, setNewSizeMaxFlavors] = useState('2');
  const [newSizeSlices, setNewSizeSlices] = useState('8');
  
  // Extras state (simple inline extras group)
  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraPrice, setNewExtraPrice] = useState('0');
  const [savingExtra, setSavingExtra] = useState(false);

  useEffect(() => {
    if ((open || embedded) && productId) {
      loadOptions();
      checkIfPizzaCategory();
    }
  }, [open, embedded, productId]);

  const loadOptions = async () => {
    setLoading(true);
    try {
      const { data: groupsData, error: groupsError } = await supabase
        .from('product_option_groups')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order');

      if (groupsError) throw groupsError;

      const { data: optionsData, error: optionsError } = await supabase
        .from('product_options')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order');

      if (optionsError) throw optionsError;

      const groupedOptions = (groupsData || []).map((group) => ({
        ...group,
        options: (optionsData || []).filter((opt) => opt.group_id === group.id),
      }));

      const ungroupedOptions = (optionsData || []).filter((opt) => !opt.group_id);
      if (ungroupedOptions.length > 0) {
        groupedOptions.push({
          id: 'ungrouped',
          product_id: productId,
          name: 'Opções sem grupo',
          description: 'Opções criadas anteriormente',
          is_required: false,
          min_selections: 0,
          max_selections: ungroupedOptions.length,
          selection_type: 'multiple',
          sort_order: 999,
          created_at: new Date().toISOString(),
          free_quantity_limit: 0,
          extra_unit_price: 0,
          scope: 'product',
          kind: 'generic',
          options: ungroupedOptions,
        });
      }

      setGroups(groupedOptions);
      setExpandedGroups(new Set(groupedOptions.map((g) => g.id)));
    } catch (error: any) {
      console.error('Error loading options:', error);
      toast({
        title: 'Erro ao carregar opções',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const checkIfPizzaCategory = async () => {
    try {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('category_id')
        .eq('id', productId)
        .single();

      if (productError || !product?.category_id) {
        setIsPizzaCategory(false);
        return;
      }

      const { data: pizzaCategory, error: pizzaError } = await supabase
        .from('pizza_categories')
        .select('id')
        .eq('category_id', product.category_id)
        .maybeSingle();

      if (pizzaError) {
        console.error('Error checking pizza category:', pizzaError);
        setIsPizzaCategory(false);
        return;
      }

      setIsPizzaCategory(!!pizzaCategory);
      if (pizzaCategory) {
        setCurrentCategoryId(product.category_id);
        await loadDoughTypes();
        await loadCrustTypes();
        await loadSizes(product.category_id);
      } else {
        setCurrentCategoryId(null);
      }
    } catch (error) {
      console.error('Error checking pizza category:', error);
      setIsPizzaCategory(false);
      setCurrentCategoryId(null);
    }
  };

  const handleGroupDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = groups.findIndex((g) => g.id === active.id);
    const newIndex = groups.findIndex((g) => g.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...groups];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    setGroups(reordered);
    setReordering(true);

    try {
      const updates = reordered
        .filter((g) => g.id !== 'ungrouped')
        .map((g, index) => ({ id: g.id, sort_order: index }));

      for (const u of updates) {
        const { error } = await supabase
          .from('product_option_groups')
          .update({ sort_order: u.sort_order })
          .eq('id', u.id);
        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Error updating group order:', error);
      toast({
        title: 'Erro ao reordenar grupos',
        description: error.message,
        variant: 'destructive',
      });
      loadOptions();
    } finally {
      setReordering(false);
    }
  };
  // Dough types functions
  const loadDoughTypes = async () => {
    try {
      setLoadingDoughs(true);
      const { data: allDoughs, error: doughsError } = await supabase
        .from('pizza_dough_types')
        .select('*')
        .eq('active', true)
        .order('name');

      if (doughsError) throw doughsError;

      const { data: productDoughs, error: productDoughsError } = await supabase
        .from('pizza_product_doughs')
        .select('dough_type_id')
        .eq('product_id', productId);

      if (productDoughsError) throw productDoughsError;

      setDoughTypes(allDoughs || []);
      setSelectedDoughs(new Set((productDoughs || []).map((pd) => pd.dough_type_id)));
    } catch (error) {
      console.error('Error loading dough types:', error);
      setDoughTypes([]);
      setSelectedDoughs(new Set());
    } finally {
      setLoadingDoughs(false);
    }
  };

  const createDoughType = async () => {
    if (!newDoughName.trim()) return;
    try {
      const { data, error } = await supabase
        .from('pizza_dough_types')
        .insert({
          name: newDoughName.trim(),
          extra_price: parseFloat(newDoughPrice) || 0,
          active: true,
        })
        .select('*')
        .single();

      if (error) throw error;
      setDoughTypes((prev) => [...prev, data]);
      setNewDoughName('');
      setNewDoughPrice('0');
      toast({ title: 'Tipo de massa criado' });
    } catch (error: any) {
      console.error('Error creating dough type:', error);
      toast({
        title: 'Erro ao criar tipo de massa',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const archiveDoughType = async (doughId: string) => {
    try {
      const { error } = await supabase
        .from('pizza_dough_types')
        .update({ active: false })
        .eq('id', doughId);

      if (error) throw error;
      setDoughTypes((prev) => prev.filter((d) => d.id !== doughId));
    } catch (error: any) {
      console.error('Error removing dough type:', error);
      toast({
        title: 'Erro ao remover tipo de massa',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const saveDoughs = async () => {
    try {
      setSavingDoughs(true);

      // Remove existing associations
      const { error: deleteError } = await supabase
        .from('pizza_product_doughs')
        .delete()
        .eq('product_id', productId);

      if (deleteError) throw deleteError;

      // Add new associations
      if (selectedDoughs.size > 0) {
        const inserts = Array.from(selectedDoughs).map((doughId) => ({
          product_id: productId,
          dough_type_id: doughId,
        }));

        const { error: insertError } = await supabase
          .from('pizza_product_doughs')
          .insert(inserts);

        if (insertError) throw insertError;
      }

      toast({
        title: 'Tipos de massa salvos',
        description: 'Os tipos de massa disponíveis foram atualizados.',
      });
    } catch (error: any) {
      console.error('Error saving doughs:', error);
      toast({
        title: 'Erro ao salvar tipos de massa',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingDoughs(false);
    }
  };

  // Crust types functions
  const loadCrustTypes = async () => {
    try {
      setLoadingCrusts(true);
      const { data: types, error: typesError } = await supabase
        .from('pizza_crust_types')
        .select('*')
        .eq('active', true)
        .order('name');

      if (typesError) throw typesError;

      const { data: flavors, error: flavorsError } = await supabase
        .from('pizza_crust_flavors')
        .select('*')
        .eq('active', true)
        .order('name');

      if (flavorsError) throw flavorsError;

      const { data: productCrusts, error: productCrustsError } = await supabase
        .from('pizza_product_crust_flavors')
        .select('crust_flavor_id')
        .eq('product_id', productId);

      if (productCrustsError) throw productCrustsError;

      setCrustTypes(types || []);
      setCrustFlavors(flavors || []);
      setSelectedCrusts(new Set((productCrusts || []).map((pc) => pc.crust_flavor_id)));
    } catch (error) {
      console.error('Error loading crust types:', error);
      setCrustTypes([]);
      setCrustFlavors([]);
      setSelectedCrusts(new Set());
    } finally {
      setLoadingCrusts(false);
    }
  };

  const createCrustType = async () => {
    if (!newCrustTypeName.trim()) return;
    try {
      const { data, error } = await supabase
        .from('pizza_crust_types')
        .insert({
          name: newCrustTypeName.trim(),
          active: true,
        })
        .select('*')
        .single();

      if (error) throw error;
      setCrustTypes((prev) => [...prev, data]);
      setNewCrustTypeName('');
      toast({ title: 'Tipo de borda criado' });
    } catch (error: any) {
      console.error('Error creating crust type:', error);
      toast({
        title: 'Erro ao criar tipo de borda',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const archiveCrustType = async (typeId: string) => {
    try {
      const { error } = await supabase
        .from('pizza_crust_types')
        .update({ active: false })
        .eq('id', typeId);

      if (error) throw error;
      setCrustTypes((prev) => prev.filter((t) => t.id !== typeId));
      setCrustFlavors((prev) => prev.filter((f) => f.type_id !== typeId));
    } catch (error: any) {
      console.error('Error removing crust type:', error);
      toast({
        title: 'Erro ao remover tipo de borda',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const startNewFlavor = (typeId: string) => {
    setNewFlavor({ typeId, name: '', price: '0' });
  };

  const createCrustFlavor = async () => {
    if (!newFlavor || !newFlavor.name.trim()) return;
    try {
      const { data, error } = await supabase
        .from('pizza_crust_flavors')
        .insert({
          type_id: newFlavor.typeId,
          name: newFlavor.name.trim(),
          extra_price: parseFloat(newFlavor.price) || 0,
          active: true,
        })
        .select('*')
        .single();

      if (error) throw error;
      setCrustFlavors((prev) => [...prev, data]);
      setNewFlavor(null);
      toast({ title: 'Borda criada' });
    } catch (error: any) {
      console.error('Error creating crust flavor:', error);
      toast({
        title: 'Erro ao criar borda',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const archiveCrustFlavor = async (flavorId: string) => {
    try {
      const { error } = await supabase
        .from('pizza_crust_flavors')
        .update({ active: false })
        .eq('id', flavorId);

      if (error) throw error;
      setCrustFlavors((prev) => prev.filter((f) => f.id !== flavorId));
      setSelectedCrusts((prev) => {
        const next = new Set(prev);
        next.delete(flavorId);
        return next;
      });
    } catch (error: any) {
      console.error('Error removing crust flavor:', error);
      toast({
        title: 'Erro ao remover borda',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const saveCrusts = async () => {
    try {
      setSavingCrusts(true);

      // Remove existing associations
      const { error: deleteError } = await supabase
        .from('pizza_product_crust_flavors')
        .delete()
        .eq('product_id', productId);

      if (deleteError) throw deleteError;

      // Add new associations
      if (selectedCrusts.size > 0) {
        const inserts = Array.from(selectedCrusts).map((crustId) => ({
          product_id: productId,
          crust_flavor_id: crustId,
        }));

        const { error: insertError } = await supabase
          .from('pizza_product_crust_flavors')
          .insert(inserts);

        if (insertError) throw insertError;
      }

      toast({
        title: 'Bordas salvas',
        description: 'As bordas disponíveis foram atualizadas.',
      });
    } catch (error: any) {
      console.error('Error saving crusts:', error);
      toast({
        title: 'Erro ao salvar bordas',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingCrusts(false);
    }
  };

  // Sizes functions
  const loadSizes = async (categoryId: string) => {
    try {
      setLoadingSizes(true);
      
      const { data: global, error: globalError } = await supabase
        .from('pizza_sizes_global')
        .select('*')
        .eq('active', true)
        .order('sort_order');

      if (globalError) throw globalError;

      const { data: category, error: categoryError } = await supabase
        .from('pizza_category_sizes')
        .select('*')
        .eq('category_id', categoryId)
        .order('sort_order');

      if (categoryError) throw categoryError;

      setGlobalSizes(global || []);
      setCategorySizes(category || []);
    } catch (error) {
      console.error('Error loading sizes:', error);
      setGlobalSizes([]);
      setCategorySizes([]);
    } finally {
      setLoadingSizes(false);
    }
  };

  const addSizeToCategory = async (sizeId: string) => {
    if (!currentCategoryId) return;

    const globalSize = globalSizes.find((s) => s.id === sizeId);
    if (!globalSize) return;

    try {
      setSavingSizes(true);

      const nextSortOrder =
        categorySizes.length > 0 ? Math.max(...categorySizes.map((s) => s.sort_order)) + 1 : 0;

      const { data, error } = await supabase
        .from('pizza_category_sizes')
        .insert({
          category_id: currentCategoryId,
          name: globalSize.name,
          base_price: 0,
          max_flavors: 1,
          sort_order: nextSortOrder,
        })
        .select()
        .single();

      if (error) throw error;

      setCategorySizes([...categorySizes, data]);
      toast({
        title: 'Tamanho adicionado',
        description: `O tamanho ${globalSize.name} foi adicionado à categoria.`,
      });
    } catch (error: any) {
      console.error('Error adding size:', error);
      toast({
        title: 'Erro ao adicionar tamanho',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingSizes(false);
    }
  };

  const createCategorySize = async () => {
    if (!currentCategoryId || !newSizeName.trim()) return;

    try {
      setSavingSizes(true);

      const nextSortOrder =
        categorySizes.length > 0 ? Math.max(...categorySizes.map((s) => s.sort_order)) + 1 : 0;

      const basePrice = parseFloat(newSizePrice) || 0;
      const maxFlavors = parseInt(newSizeMaxFlavors) || 1;
      const slices = parseInt(newSizeSlices) || 8;

      const { data, error } = await supabase
        .from('pizza_category_sizes')
        .insert({
          category_id: currentCategoryId,
          name: newSizeName.trim(),
          base_price: basePrice,
          max_flavors: maxFlavors,
          slices,
          sort_order: nextSortOrder,
        })
        .select()
        .single();

      if (error) throw error;

      setCategorySizes((prev) => [...prev, data]);
      setNewSizeName('');
      setNewSizePrice('0');
      setNewSizeMaxFlavors('2');
      setNewSizeSlices('8');

      toast({
        title: 'Tamanho criado',
        description: 'O novo tamanho foi adicionado à categoria.',
      });
    } catch (error: any) {
      console.error('Error creating size:', error);
      toast({
        title: 'Erro ao criar tamanho',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingSizes(false);
    }
  };

  const removeSizeFromCategory = async (sizeId: string) => {
    try {
      setSavingSizes(true);
      const { error } = await supabase
        .from('pizza_category_sizes')
        .delete()
        .eq('id', sizeId);

      if (error) throw error;

      setCategorySizes(categorySizes.filter((s) => s.id !== sizeId));
      toast({
        title: 'Tamanho removido',
        description: 'O tamanho foi removido da categoria.',
      });
    } catch (error: any) {
      console.error('Error removing size:', error);
      toast({
        title: 'Erro ao remover tamanho',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingSizes(false);
    }
  };

  const updateCategorySize = async (
    sizeId: string,
    updates: { base_price?: number; max_flavors?: number; slices?: number }
  ) => {
    try {
      const { error } = await supabase
        .from('pizza_category_sizes')
        .update(updates)
        .eq('id', sizeId);

      if (error) throw error;

      setCategorySizes((prev) =>
        prev.map((s) => (s.id === sizeId ? { ...s, ...updates } : s))
      );
    } catch (error: any) {
      console.error('Error updating size:', error);
      toast({
        title: 'Erro ao atualizar tamanho',
        description: error.message,
        variant: 'destructive',
      });
    }
  };
  const openGroupModal = (group?: OptionGroup) => {
    if (group && group.id !== 'ungrouped') {
      setGroupForm({
        name: group.name,
        description: group.description || '',
        is_required: group.is_required,
        min_selections: group.min_selections,
        max_selections: group.max_selections,
        selection_type: group.selection_type,
        free_quantity_limit: group.free_quantity_limit ?? 0,
        extra_unit_price: group.extra_unit_price?.toString() ?? '0',
        applyToAllPizzas: false,
      });
      setGroupModal({ open: true, group });
    } else {
      setGroupForm({
        name: '',
        description: '',
        is_required: false,
        min_selections: 0,
        max_selections: 1,
        selection_type: 'single',
        free_quantity_limit: 0,
        extra_unit_price: '0',
        applyToAllPizzas: false,
      });
      setGroupModal({ open: true, group: null });
    }
  };

  const saveGroup = async () => {
    if (!groupForm.name.trim()) return;

    setSaving(true);
    try {
      const baseData = {
        product_id: productId,
        name: groupForm.name.trim(),
        description: groupForm.description.trim() || null,
        is_required: groupForm.is_required,
        min_selections: groupForm.min_selections,
        max_selections: groupForm.max_selections,
        selection_type: groupForm.selection_type,
        sort_order: groupModal.group?.sort_order ?? groups.length,
        free_quantity_limit: groupForm.free_quantity_limit,
        extra_unit_price: parseFloat(groupForm.extra_unit_price) || 0,
      };

      let sourceGroupId: string | null = null;

      if (groupModal.group) {
        const { error } = await supabase
          .from('product_option_groups')
          .update(baseData)
          .eq('id', groupModal.group.id);
        if (error) throw error;
        sourceGroupId = groupModal.group.id;
        toast({ title: 'Grupo atualizado' });
      } else {
        const { data: inserted, error } = await supabase
          .from('product_option_groups')
          .insert(baseData)
          .select()
          .single();
        if (error) throw error;
        sourceGroupId = inserted.id;
        toast({ title: 'Grupo criado' });
      }

      // Antes: salvávamos automaticamente a "nova opção rápida" ao salvar o grupo.
      // Agora, o item só é criado quando o usuário clica em "Salvar item" no card do grupo.

      if (sourceGroupId && groupForm.applyToAllPizzas) {
        try {
          const { data: baseProduct, error: baseProductError } = await supabase
            .from('products')
            .select('id, company_id')
            .eq('id', productId)
            .single();

          if (baseProductError || !baseProduct) throw baseProductError;

          const { data: pizzaCats, error: pizzaCatsError } = await supabase
            .from('pizza_categories')
            .select('category_id')
            .eq('company_id', baseProduct.company_id);

          if (pizzaCatsError) throw pizzaCatsError;

          const pizzaCategoryIds = (pizzaCats || []).map((pc) => pc.category_id);

          if (pizzaCategoryIds.length > 0) {
            const { data: pizzaProducts, error: pizzaProductsError } = await supabase
              .from('products')
              .select('id')
              .eq('company_id', baseProduct.company_id)
              .in('category_id', pizzaCategoryIds);

            if (pizzaProductsError) throw pizzaProductsError;

            const targetProductIds = (pizzaProducts || [])
              .map((p) => p.id)
              .filter((id) => id !== productId);

            if (targetProductIds.length > 0) {
              const { data: existingGroups, error: existingGroupsError } = await supabase
                .from('product_option_groups')
                .select('id, product_id')
                .in('product_id', targetProductIds)
                .eq('name', groupForm.name.trim())
                .eq('selection_type', groupForm.selection_type);

              if (existingGroupsError) throw existingGroupsError;

              const existingByProduct = new Map<string, string>();
              (existingGroups || []).forEach((g) => {
                existingByProduct.set(g.product_id, g.id);
              });

              const productsNeedingGroup = targetProductIds.filter(
                (id) => !existingByProduct.has(id),
              );

              let createdGroups: { id: string; product_id: string }[] = [];

              if (productsNeedingGroup.length > 0) {
                const groupsToInsert = productsNeedingGroup.map((pid, index) => ({
                  ...baseData,
                  product_id: pid,
                  sort_order: baseData.sort_order + index,
                }));

                const { data: insertedGroups, error: insertGroupsError } = await supabase
                  .from('product_option_groups')
                  .insert(groupsToInsert)
                  .select('id, product_id');

                if (insertGroupsError) throw insertGroupsError;

                createdGroups = insertedGroups || [];
              }

              const allTargetGroups: { id: string; product_id: string }[] = [
                ...createdGroups,
                ...Array.from(existingByProduct.entries()).map(([pid, gid]) => ({
                  id: gid,
                  product_id: pid,
                })),
              ];

              const { data: sourceOptions, error: sourceOptionsError } = await supabase
                .from('product_options')
                .select('*')
                .eq('group_id', sourceGroupId)
                .order('sort_order');

              if (sourceOptionsError) throw sourceOptionsError;

              if ((sourceOptions || []).length > 0 && allTargetGroups.length > 0) {
                const { data: existingOptionsAll, error: existingOptionsAllError } =
                  await supabase
                    .from('product_options')
                    .select('id, product_id, name, group_id')
                    .in(
                      'group_id',
                      allTargetGroups.map((g) => g.id),
                    );

                if (existingOptionsAllError) throw existingOptionsAllError;

                const existingOptKey = new Set(
                  (existingOptionsAll || []).map(
                    (opt) => `${opt.product_id}|${opt.name.toLowerCase().trim()}`,
                  ),
                );

                const optionsToInsert: any[] = [];

                for (const group of allTargetGroups) {
                  for (const opt of sourceOptions || []) {
                    const key = `${group.product_id}|${opt.name.toLowerCase().trim()}`;
                    if (existingOptKey.has(key)) continue;

                    optionsToInsert.push({
                      product_id: group.product_id,
                      group_id: group.id,
                      name: opt.name,
                      description: opt.description,
                      price_modifier: opt.price_modifier,
                      is_required: opt.is_required,
                      is_available: opt.is_available,
                      sort_order: opt.sort_order,
                    });
                  }
                }

                if (optionsToInsert.length > 0) {
                  const { error: insertOptionsError } = await supabase
                    .from('product_options')
                    .insert(optionsToInsert);

                  if (insertOptionsError) throw insertOptionsError;
                }
              }
            }
          }

          toast({
            title: 'Aplicado a todas as pizzas',
            description:
              'Este grupo e suas opções foram replicados para os produtos de pizza.',
          });
        } catch (cloneError: any) {
          console.error('Erro ao aplicar em todas as pizzas:', cloneError);
          toast({
            title: 'Erro ao aplicar em todas as pizzas',
            description: cloneError?.message || 'Tente novamente mais tarde.',
            variant: 'destructive',
          });
        }
      }

      setGroupModal({ open: false, group: null });
      loadOptions();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (groupId === 'ungrouped') return;

    try {
      const { error } = await supabase
        .from('product_option_groups')
        .delete()
        .eq('id', groupId);
      if (error) throw error;
      toast({ title: 'Grupo excluído' });
      loadOptions();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openOptionModal = (groupId: string, option?: OptionItem) => {
    if (option) {
      setOptionForm({
        name: option.name,
        description: option.description || '',
        price_modifier: option.price_modifier.toString(),
      });
      setOptionModal({ open: true, groupId, option });
    } else {
      setOptionForm({ name: '', description: '', price_modifier: '0' });
      setOptionModal({ open: true, groupId, option: null });
    }
  };

  const saveOption = async () => {
    if (!optionForm.name.trim()) return;

    setSaving(true);
    try {
      const groupId = optionModal.groupId === 'ungrouped' ? null : optionModal.groupId;
      const group = groups.find((g) => g.id === optionModal.groupId);

      const data = {
        product_id: productId,
        group_id: groupId,
        name: optionForm.name.trim(),
        description: optionForm.description.trim() || null,
        price_modifier: parseFloat(optionForm.price_modifier) || 0,
        is_required: false,
        is_available: true,
        sort_order: optionModal.option?.sort_order ?? (group?.options.length || 0),
      };

      if (optionModal.option) {
        const { error } = await supabase
          .from('product_options')
          .update(data)
          .eq('id', optionModal.option.id);
        if (error) throw error;
        toast({ title: 'Opção atualizada' });
      } else {
        const { error } = await supabase.from('product_options').insert(data);
        if (error) throw error;
        toast({ title: 'Opção adicionada' });
      }

      setOptionModal({ open: false, groupId: '', option: null });
      loadOptions();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteOption = async (optionId: string) => {
    try {
      const { error } = await supabase
        .from('product_options')
        .delete()
        .eq('id', optionId);
      if (error) throw error;
      toast({ title: 'Opção excluída' });
      loadOptions();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const toggleExpanded = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };


  const groupsContent = (
    <div className="space-y-4 mt-2">
      <Button onClick={() => openGroupModal()} className="w-full" variant="outline">
        <Plus className="h-4 w-4 mr-2" />
        Novo Grupo de Opções
      </Button>
      <p className="text-xs text-muted-foreground mt-1">
        Arraste os grupos pelo ícone ao lado do nome para definir quais opções aparecem
        primeiro na seleção do cardápio online.
      </p>

      {groups.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <p>Nenhuma opção configurada</p>
          <p className="text-sm">
            {isPizzaProduct
              ? 'Crie grupos como "Tamanho", "Borda", "Adicionais"'
              : isAcaiProduct
              ? 'Crie grupos como "Tamanho", "Complementos", "Coberturas"'
              : 'Crie grupos como "Tamanho", "Adicionais", "Observações"'}
          </p>
        </div>
      ) : (
        <DndContext onDragEnd={handleGroupDragEnd}>
          <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {groups.map((group) => (
                <SortableGroupCard
                  key={group.id}
                  group={group}
                  expanded={expandedGroups.has(group.id)}
                  toggleExpanded={toggleExpanded}
                  openGroupModal={openGroupModal}
                  deleteGroup={deleteGroup}
                  openOptionModal={openOptionModal}
                  deleteOption={deleteOption}
                  newOptions={newOptions}
                  setNewOptions={setNewOptions}
                  saving={saving}
                  productId={productId}
                  onInlineOptionAdded={(groupId, option) => {
                    setGroups((prev) =>
                      prev.map((g) =>
                        g.id === groupId
                          ? { ...g, options: [...(g.options || []), option] }
                          : g,
                      ),
                    );
                  }}
                  optionDescriptionPlaceholder={optionDescriptionPlaceholder}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );


  const content = (
    <>
      <div className="flex items-center gap-2">
        <Settings2 className="h-5 w-5" />
        <h3 className="text-base font-medium">Opções de {productName}</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {isPizzaProduct
          ? 'Configure tamanhos, bordas, adicionais e outras opções do produto.'
          : isAcaiProduct
          ? 'Configure acompanhamentos, complementos e outras opções do produto.'
          : 'Configure tamanhos, adicionais e outras opções do produto.'}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isPizzaCategory ? (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'dough' | 'crust' | 'sizes' | 'extras')} className="mt-3">
          <TabsList className="w-full justify-start flex flex-wrap gap-1">
            <TabsTrigger value="dough">Tipo de massa</TabsTrigger>
            <TabsTrigger value="crust">Bordas</TabsTrigger>
            <TabsTrigger value="sizes">Tamanhos</TabsTrigger>
            <TabsTrigger value="extras">Extras</TabsTrigger>
          </TabsList>

          <TabsContent value="dough" className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">
              Cadastre os tipos de massa e selecione quais estarão disponíveis para este
              produto.
            </p>
            {loadingDoughs ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-md p-4 space-y-3">
                  <h4 className="text-sm font-medium">Novo tipo de massa</h4>
                  <div className="grid grid-cols-3 gap-3 items-end">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Nome</Label>
                      <Input
                        value={newDoughName}
                        onChange={(e) => setNewDoughName(e.target.value)}
                        placeholder="Ex: Tradicional, Integral, Fina"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Adicional (opcional)</Label>
                      <CurrencyInput
                        value={newDoughPrice}
                        onChange={(value) => setNewDoughPrice(value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={createDoughType} disabled={!newDoughName.trim()}>
                      Criar tipo de massa
                    </Button>
                  </div>
                </div>

                {doughTypes.length === 0 ? (
                  <div className="border rounded-md p-4 text-xs text-muted-foreground">
                    Nenhum tipo de massa cadastrado no sistema ainda.
                  </div>
                ) : (
                  <div className="border rounded-md p-4 space-y-3">
                    <h4 className="text-sm font-medium">Tipos cadastrados</h4>
                    {doughTypes.map((dough) => (
                      <div
                        key={dough.id}
                        className="flex items-center justify-between gap-3 border rounded-md px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={selectedDoughs.has(dough.id)}
                            onCheckedChange={(checked) => {
                              setSelectedDoughs((prev) => {
                                const next = new Set(prev);
                                if (checked) {
                                  next.add(dough.id);
                                } else {
                                  next.delete(dough.id);
                                }
                                return next;
                              });
                            }}
                          />
                          <div>
                            <p className="text-sm font-medium">{dough.name}</p>
                            {dough.extra_price > 0 && (
                              <p className="text-xs text-muted-foreground">
                                + R$ {dough.extra_price.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => archiveDoughType(dough.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex justify-end pt-2">
                      <Button size="sm" onClick={saveDoughs} disabled={savingDoughs}>
                        {savingDoughs && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Salvar tipos de massa
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="crust" className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">
              Cadastre tipos de borda e sabores (incluindo "sem borda") e selecione quais
              estarão disponíveis para este produto.
            </p>
            {loadingCrusts ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-md p-4 space-y-3">
                  <h4 className="text-sm font-medium">Novo tipo de borda</h4>
                  <div className="grid grid-cols-3 gap-3 items-end">
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">Nome</Label>
                      <Input
                        value={newCrustTypeName}
                        onChange={(e) => setNewCrustTypeName(e.target.value)}
                        placeholder="Ex: Recheada, Tradicional, Sem borda"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={createCrustType}
                      disabled={!newCrustTypeName.trim()}
                    >
                      Criar tipo de borda
                    </Button>
                  </div>
                </div>

                {crustTypes.length === 0 ? (
                  <div className="border rounded-md p-4 text-xs text-muted-foreground">
                    Nenhum tipo de borda cadastrado no sistema ainda.
                  </div>
                ) : (
                  <div className="border rounded-md p-4 space-y-4">
                    {crustTypes.map((type) => {
                      const typeFlavors = crustFlavors.filter((f) => f.type_id === type.id);

                      return (
                        <div key={type.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">{type.name}</h4>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => archiveCrustType(type.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {typeFlavors.length > 0 && (
                            <div className="space-y-2">
                              {typeFlavors.map((flavor) => (
                                <div
                                  key={flavor.id}
                                  className="flex items-center justify-between gap-3 border rounded-md px-3 py-2"
                                >
                                  <div className="flex items-center gap-3">
                                    <Switch
                                      checked={selectedCrusts.has(flavor.id)}
                                      onCheckedChange={(checked) => {
                                        setSelectedCrusts((prev) => {
                                          const next = new Set(prev);
                                          if (checked) {
                                            next.add(flavor.id);
                                          } else {
                                            next.delete(flavor.id);
                                          }
                                          return next;
                                        });
                                      }}
                                    />
                                    <div>
                                      <p className="text-sm font-medium">{flavor.name}</p>
                                      {flavor.extra_price > 0 && (
                                        <p className="text-xs text-muted-foreground">
                                          + R$ {flavor.extra_price.toFixed(2)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => archiveCrustFlavor(flavor.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}

                          {newFlavor && newFlavor.typeId === type.id && (
                            <div className="mt-2 grid grid-cols-3 gap-3 items-end">
                              <div className="col-span-2 space-y-1">
                                <Label className="text-xs">Nome da borda</Label>
                                <Input
                                  value={newFlavor.name}
                                  onChange={(e) =>
                                    setNewFlavor({ ...newFlavor, name: e.target.value })
                                  }
                                  placeholder="Ex: Catupiry, Cheddar, Sem borda"
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Adicional (opcional)</Label>
                                <CurrencyInput
                                  value={newFlavor.price}
                                  onChange={(value) =>
                                    setNewFlavor({ ...newFlavor, price: value })
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="col-span-3 flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setNewFlavor(null)}
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={createCrustFlavor}
                                  disabled={!newFlavor.name.trim()}
                                >
                                  Salvar borda
                                </Button>
                              </div>
                            </div>
                          )}

                          {!newFlavor || newFlavor.typeId !== type.id ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2 border-dashed"
                              onClick={() => startNewFlavor(type.id)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Nova borda para este tipo
                            </Button>
                          ) : null}
                        </div>
                      );
                    })}

                    <div className="flex justify-end pt-2">
                      <Button size="sm" onClick={saveCrusts} disabled={savingCrusts}>
                        {savingCrusts && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Salvar bordas
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sizes" className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">
              Configure os tamanhos disponíveis e seus preços base para esta categoria.
            </p>
            {loadingSizes ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {categorySizes.length > 0 && (
                  <div className="border rounded-md p-4 space-y-3">
                    <h4 className="text-sm font-medium">Tamanhos configurados</h4>
                    {categorySizes.map((size) => (
                      <div key={size.id} className="border rounded-md p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{size.name}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSizeFromCategory(size.id)}
                            disabled={savingSizes}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Preço base</Label>
                            <CurrencyInput
                              value={size.base_price}
                              onChange={(value) =>
                                updateCategorySize(size.id, {
                                  base_price: parseFloat(value) || 0,
                                })
                              }
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Máx. sabores</Label>
                            <Input
                              type="number"
                              min={1}
                              value={size.max_flavors}
                              onChange={(e) =>
                                updateCategorySize(size.id, {
                                  max_flavors: parseInt(e.target.value) || 1,
                                })
                              }
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Fatias</Label>
                            <Input
                              type="number"
                              min={1}
                              value={size.slices ?? 8}
                              onChange={(e) =>
                                updateCategorySize(size.id, {
                                  slices: parseInt(e.target.value) || 8,
                                })
                              }
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {globalSizes.length > 0 && (
                  <div className="border rounded-md p-4">
                    <h4 className="text-sm font-medium mb-3">
                      Adicionar tamanho à categoria a partir da base global
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {globalSizes
                        .filter((gs) => !categorySizes.some((cs) => cs.name === gs.name))
                        .map((size) => (
                          <Button
                            key={size.id}
                            variant="outline"
                            size="sm"
                            onClick={() => addSizeToCategory(size.id)}
                            disabled={savingSizes}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {size.name}
                          </Button>
                        ))}
                    </div>
                  </div>
                )}

                <div className="border rounded-md p-4 space-y-3">
                  <h4 className="text-sm font-medium">Novo tamanho para esta categoria</h4>
                  <div className="grid grid-cols-4 gap-3 items-end">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Nome</Label>
                      <Input
                        value={newSizeName}
                        onChange={(e) => setNewSizeName(e.target.value)}
                        placeholder="Ex: Pequena, Média, Grande"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Preço base</Label>
                      <CurrencyInput
                        value={newSizePrice}
                        onChange={(value) => setNewSizePrice(value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Máx. sabores</Label>
                      <Input
                        type="number"
                        min={1}
                        value={newSizeMaxFlavors}
                        onChange={(e) => setNewSizeMaxFlavors(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Fatias</Label>
                      <Input
                        type="number"
                        min={1}
                        value={newSizeSlices}
                        onChange={(e) => setNewSizeSlices(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-4 flex justify-end">
                      <Button
                        size="sm"
                        onClick={createCategorySize}
                        disabled={savingSizes || !newSizeName.trim() || !currentCategoryId}
                      >
                        {savingSizes && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Criar tamanho
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="extras" className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">
              Cadastre extras simples com nome e preço para este produto.
            </p>
            {(() => {
              const extrasGroup = groups.find(
                (g) => g.name === 'Extras' && g.selection_type === 'multiple'
              );
              const extrasOptions = extrasGroup?.options || [];

              const handleCreateExtra = async () => {
                if (!newExtraName.trim() || savingExtra) return;
                try {
                  setSavingExtra(true);

                  let groupId = extrasGroup?.id;

                  if (!groupId) {
                    const { data: insertedGroup, error: groupError } = await supabase
                      .from('product_option_groups')
                      .insert({
                        product_id: productId,
                        name: 'Extras',
                        description: 'Extras do produto',
                        is_required: false,
                        min_selections: 0,
                        max_selections: 99,
                        selection_type: 'multiple',
                        sort_order: groups.length,
                        free_quantity_limit: 0,
                        extra_unit_price: 0,
                      })
                      .select('*')
                      .single();

                    if (groupError) throw groupError;
                    groupId = insertedGroup.id;
                  }

                  const { error: optionError } = await supabase.from('product_options').insert({
                    product_id: productId,
                    group_id: groupId,
                    name: newExtraName.trim(),
                    description: null,
                    price_modifier: parseFloat(newExtraPrice) || 0,
                    is_required: false,
                    is_available: true,
                    sort_order: extrasOptions.length,
                  });

                  if (optionError) throw optionError;

                  setNewExtraName('');
                  setNewExtraPrice('0');
                  await loadOptions();
                } catch (error: any) {
                  console.error('Error creating extra:', error);
                  toast({
                    title: 'Erro ao criar extra',
                    description: error.message,
                    variant: 'destructive',
                  });
                } finally {
                  setSavingExtra(false);
                }
              };

              const handleDeleteExtra = async (optionId: string) => {
                try {
                  const { error } = await supabase
                    .from('product_options')
                    .delete()
                    .eq('id', optionId);

                  if (error) throw error;
                  await loadOptions();
                } catch (error: any) {
                  console.error('Error deleting extra:', error);
                  toast({
                    title: 'Erro ao remover extra',
                    description: error.message,
                    variant: 'destructive',
                  });
                }
              };

              return (
                <div className="space-y-4">
                  <div className="border rounded-md p-4 space-y-3">
                    <h4 className="text-sm font-medium">Novo extra</h4>
                    <div className="grid grid-cols-3 gap-3 items-end">
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Nome</Label>
                        <Input
                          value={newExtraName}
                          onChange={(e) => setNewExtraName(e.target.value)}
                          placeholder="Ex: Bacon extra, Queijo extra"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Preço</Label>
                        <CurrencyInput
                          value={newExtraPrice}
                          onChange={(value) => setNewExtraPrice(value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleCreateExtra}
                        disabled={!newExtraName.trim() || savingExtra}
                      >
                        {savingExtra && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Adicionar extra
                      </Button>
                    </div>
                  </div>

                  {extrasOptions.length > 0 && (
                    <div className="border rounded-md p-4 space-y-3">
                      <h4 className="text-sm font-medium">Extras cadastrados</h4>
                      {extrasOptions.map((extra) => (
                        <div
                          key={extra.id}
                          className="flex items-center justify-between gap-3 border rounded-md px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium">{extra.name}</p>
                            <p className="text-xs text-muted-foreground">
                              R$ {Number(extra.price_modifier).toFixed(2)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteExtra(extra.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      ) : (
        groupsContent
      )}
    </>
  );

  return (
    <>
      {embedded ? (
        <div className="space-y-4 mt-2">{content}</div>
      ) : (
        <Sheet
          open={open}
          onOpenChange={(isOpen) => {
            if (!isOpen) onClose();
          }}
        >
          <SheetContent side="right" className="w-full sm:max-w-xl">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Opções de {productName}
              </SheetTitle>
              <SheetDescription>
                {isPizzaProduct
                  ? 'Configure tamanhos, bordas, adicionais e outras opções do produto'
                  : isAcaiProduct
                  ? 'Configure acompanhamentos, complementos e outras opções do produto'
                  : 'Configure tamanhos, adicionais e outras opções do produto'}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4">{content}</div>

            <SheetFooter className="mt-4">
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}

      {/* Group Modal */}
      <Dialog
        open={groupModal.open}
        onOpenChange={(open) => !open && setGroupModal({ open: false, group: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{groupModal.group ? 'Editar Grupo' : 'Novo Grupo de Opções'}</DialogTitle>
            <DialogDescription>
              {isPizzaProduct
                ? 'Ex: "Tamanho", "Borda", "Adicionais", "Sabores"'
                : isAcaiProduct
                ? 'Ex: "Tamanho", "Complementos", "Coberturas"'
                : 'Ex: "Tamanho", "Adicionais", "Observações"'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do grupo *</Label>
              <Input
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                placeholder={
                  isPizzaProduct
                    ? 'Ex: Tamanho, Borda, Adicionais'
                    : isAcaiProduct
                    ? 'Ex: Tamanho, Complementos, Coberturas'
                    : 'Ex: Tamanho, Adicionais, Observações'
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                placeholder={groupDescriptionPlaceholder}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de seleção</Label>
              <Select
                value={groupForm.selection_type}
                onValueChange={(value) => setGroupForm({ ...groupForm, selection_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SELECTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <p className="font-medium">{type.label}</p>
                        <p className="text-xs text-muted-foreground">{type.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label>Obrigatório</Label>
                <p className="text-sm text-muted-foreground">Cliente precisa escolher</p>
              </div>
              <Switch
                checked={groupForm.is_required}
                onCheckedChange={(checked) =>
                  setGroupForm({ ...groupForm, is_required: checked })
                }
              />
            </div>

            {isPizzaCategory && (
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <Label>Usar este grupo em todas as pizzas</Label>
                  <p className="text-sm text-muted-foreground">
                    Replica este grupo e opções para todos os produtos das categorias marcadas como pizza
                  </p>
                </div>
                <Switch
                  checked={groupForm.applyToAllPizzas}
                  onCheckedChange={(checked) =>
                    setGroupForm({ ...groupForm, applyToAllPizzas: checked })
                  }
                />
              </div>
            )}

            {groupForm.selection_type === 'multiple' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mínimo de seleções</Label>
                  <Input
                    type="number"
                    min="0"
                    value={groupForm.min_selections}
                    onChange={(e) =>
                      setGroupForm({
                        ...groupForm,
                        min_selections: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Máximo de seleções</Label>
                  <Input
                    type="number"
                    min="1"
                    value={groupForm.max_selections}
                    onChange={(e) =>
                      setGroupForm({
                        ...groupForm,
                        max_selections: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGroupModal({ open: false, group: null })}
            >
              Cancelar
            </Button>
            <Button onClick={saveGroup} disabled={saving || !groupForm.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {groupModal.group ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Option Modal */}
      <Dialog
        open={optionModal.open}
        onOpenChange={(open) =>
          !open && setOptionModal({ open: false, groupId: '', option: null })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{optionModal.option ? 'Editar Opção' : 'Nova Opção'}</DialogTitle>
            <DialogDescription>
              Ex: "Grande (+R$10)", "Catupiry (+R$5)", "Sem cebola"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da opção *</Label>
              <Input
                value={optionForm.name}
                onChange={(e) => setOptionForm({ ...optionForm, name: e.target.value })}
                placeholder="Ex: Grande, Catupiry, Calabresa"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={optionForm.description}
                onChange={(e) =>
                  setOptionForm({ ...optionForm, description: e.target.value })
                }
                placeholder={optionDescriptionPlaceholder}
              />
            </div>

            <div className="space-y-2">
              <Label>Alteração no preço</Label>
              <CurrencyInput
                value={optionForm.price_modifier}
                onChange={(value) =>
                  setOptionForm({ ...optionForm, price_modifier: value })
                }
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                Use valores positivos para adicionar ao preço, negativos para desconto, ou 0
                se incluso
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setOptionModal({ open: false, groupId: '', option: null })
              }
            >
              Cancelar
            </Button>
            <Button onClick={saveOption} disabled={saving || !optionForm.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {optionModal.option ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
