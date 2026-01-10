import React, { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AcaiSize {
  id: string;
  category_id: string;
  name: string;
  base_price: number;
  sort_order: number;
}

interface AcaiOptionGroup {
  id: string;
  size_id: string;
  name: string;
  description: string | null;
  min_selections: number;
  max_selections: number;
  free_quantity: number;
  extra_price_per_item: number;
  sort_order: number;
}

interface AcaiOption {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  price_modifier: number;
  is_available: boolean;
  sort_order: number;
}

interface AcaiSizeOptionsEditorProps {
  categoryId: string;
  categoryName: string;
  open: boolean;
  onClose: () => void;
}

export function AcaiSizeOptionsEditor({
  categoryId,
  categoryName,
  open,
  onClose,
}: AcaiSizeOptionsEditorProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [sizes, setSizes] = useState<AcaiSize[]>([]);
  const [groups, setGroups] = useState<Record<string, AcaiOptionGroup[]>>({});
  const [options, setOptions] = useState<Record<string, AcaiOption[]>>({});
  const [expandedSizes, setExpandedSizes] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Size form
  const [sizeModal, setSizeModal] = useState<{ open: boolean; size: AcaiSize | null }>({
    open: false,
    size: null,
  });
  const [sizeForm, setSizeForm] = useState({ name: '', base_price: '0' });
  const [savingSize, setSavingSize] = useState(false);

  // Group form
  const [groupModal, setGroupModal] = useState<{
    open: boolean;
    sizeId: string;
    group: AcaiOptionGroup | null;
  }>({ open: false, sizeId: '', group: null });
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    min_selections: '0',
    max_selections: '5',
    free_quantity: '0',
    extra_price_per_item: '0',
  });
  const [savingGroup, setSavingGroup] = useState(false);

  // Option inline
  const [newOptions, setNewOptions] = useState<
    Record<string, { name: string; description: string; price_modifier: string }>
  >({});
  const [savingOption, setSavingOption] = useState(false);

  useEffect(() => {
    if (open && categoryId) {
      loadData();
    }
  }, [open, categoryId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load sizes
      const { data: sizesData, error: sizesError } = await supabase
        .from('acai_category_sizes')
        .select('*')
        .eq('category_id', categoryId)
        .order('sort_order');

      if (sizesError) throw sizesError;
      setSizes(sizesData || []);
      setExpandedSizes(new Set((sizesData || []).map((s: AcaiSize) => s.id)));

      // Load groups for all sizes
      if (sizesData && sizesData.length > 0) {
        const sizeIds = sizesData.map((s: AcaiSize) => s.id);

        const { data: groupsData, error: groupsError } = await supabase
          .from('acai_size_option_groups')
          .select('*')
          .in('size_id', sizeIds)
          .order('sort_order');

        if (groupsError) throw groupsError;

        const groupsMap: Record<string, AcaiOptionGroup[]> = {};
        (groupsData || []).forEach((g: AcaiOptionGroup) => {
          if (!groupsMap[g.size_id]) groupsMap[g.size_id] = [];
          groupsMap[g.size_id].push(g);
        });
        setGroups(groupsMap);
        setExpandedGroups(new Set((groupsData || []).map((g: AcaiOptionGroup) => g.id)));

        // Load options for all groups
        if (groupsData && groupsData.length > 0) {
          const groupIds = groupsData.map((g: AcaiOptionGroup) => g.id);

          const { data: optionsData, error: optionsError } = await supabase
            .from('acai_size_options')
            .select('*')
            .in('group_id', groupIds)
            .order('sort_order');

          if (optionsError) throw optionsError;

          const optionsMap: Record<string, AcaiOption[]> = {};
          (optionsData || []).forEach((o: AcaiOption) => {
            if (!optionsMap[o.group_id]) optionsMap[o.group_id] = [];
            optionsMap[o.group_id].push(o);
          });
          setOptions(optionsMap);
        }
      }
    } catch (error: any) {
      console.error('Error loading açaí data:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Size handlers
  const openSizeModal = (size?: AcaiSize) => {
    if (size) {
      setSizeForm({ name: size.name, base_price: String(size.base_price) });
      setSizeModal({ open: true, size });
    } else {
      setSizeForm({ name: '', base_price: '0' });
      setSizeModal({ open: true, size: null });
    }
  };

  const saveSize = async () => {
    if (!sizeForm.name.trim()) return;

    setSavingSize(true);
    try {
      if (sizeModal.size) {
        // Update
        const { error } = await supabase
          .from('acai_category_sizes')
          .update({
            name: sizeForm.name.trim(),
            base_price: parseFloat(sizeForm.base_price) || 0,
          })
          .eq('id', sizeModal.size.id);

        if (error) throw error;
        toast({ title: 'Tamanho atualizado' });
      } else {
        // Create
        const { error } = await supabase.from('acai_category_sizes').insert({
          category_id: categoryId,
          name: sizeForm.name.trim(),
          base_price: parseFloat(sizeForm.base_price) || 0,
          sort_order: sizes.length,
        });

        if (error) throw error;
        toast({ title: 'Tamanho criado' });
      }

      setSizeModal({ open: false, size: null });
      await loadData();
    } catch (error: any) {
      console.error('Error saving size:', error);
      toast({
        title: 'Erro ao salvar tamanho',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingSize(false);
    }
  };

  const deleteSize = async (sizeId: string) => {
    try {
      const { error } = await supabase
        .from('acai_category_sizes')
        .delete()
        .eq('id', sizeId);

      if (error) throw error;
      toast({ title: 'Tamanho removido' });
      await loadData();
    } catch (error: any) {
      console.error('Error deleting size:', error);
      toast({
        title: 'Erro ao remover tamanho',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Group handlers
  const openGroupModal = (sizeId: string, group?: AcaiOptionGroup) => {
    if (group) {
      setGroupForm({
        name: group.name,
        description: group.description || '',
        min_selections: String(group.min_selections),
        max_selections: String(group.max_selections),
        free_quantity: String(group.free_quantity),
        extra_price_per_item: String(group.extra_price_per_item),
      });
      setGroupModal({ open: true, sizeId, group });
    } else {
      setGroupForm({
        name: '',
        description: '',
        min_selections: '0',
        max_selections: '5',
        free_quantity: '0',
        extra_price_per_item: '0',
      });
      setGroupModal({ open: true, sizeId, group: null });
    }
  };

  const saveGroup = async () => {
    if (!groupForm.name.trim()) return;

    setSavingGroup(true);
    try {
      if (groupModal.group) {
        // Update
        const { error } = await supabase
          .from('acai_size_option_groups')
          .update({
            name: groupForm.name.trim(),
            description: groupForm.description.trim() || null,
            min_selections: parseInt(groupForm.min_selections) || 0,
            max_selections: parseInt(groupForm.max_selections) || 1,
            free_quantity: parseInt(groupForm.free_quantity) || 0,
            extra_price_per_item: parseFloat(groupForm.extra_price_per_item) || 0,
          })
          .eq('id', groupModal.group.id);

        if (error) throw error;
        toast({ title: 'Grupo atualizado' });
      } else {
        // Create
        const existingGroups = groups[groupModal.sizeId] || [];
        const { error } = await supabase.from('acai_size_option_groups').insert({
          size_id: groupModal.sizeId,
          name: groupForm.name.trim(),
          description: groupForm.description.trim() || null,
          min_selections: parseInt(groupForm.min_selections) || 0,
          max_selections: parseInt(groupForm.max_selections) || 1,
          free_quantity: parseInt(groupForm.free_quantity) || 0,
          extra_price_per_item: parseFloat(groupForm.extra_price_per_item) || 0,
          sort_order: existingGroups.length,
        });

        if (error) throw error;
        toast({ title: 'Grupo criado' });
      }

      setGroupModal({ open: false, sizeId: '', group: null });
      await loadData();
    } catch (error: any) {
      console.error('Error saving group:', error);
      toast({
        title: 'Erro ao salvar grupo',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingGroup(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    try {
      const { error } = await supabase
        .from('acai_size_option_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;
      toast({ title: 'Grupo removido' });
      await loadData();
    } catch (error: any) {
      console.error('Error deleting group:', error);
      toast({
        title: 'Erro ao remover grupo',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Option handlers
  const addOption = async (groupId: string) => {
    const current = newOptions[groupId] || { name: '', description: '', price_modifier: '0' };
    if (!current.name.trim()) {
      toast({
        title: 'Informe o nome da opção',
        variant: 'destructive',
      });
      return;
    }

    setSavingOption(true);
    try {
      const existingOptions = options[groupId] || [];
      const { error } = await supabase.from('acai_size_options').insert({
        group_id: groupId,
        name: current.name.trim(),
        description: current.description.trim() || null,
        price_modifier: parseFloat(current.price_modifier) || 0,
        is_available: true,
        sort_order: existingOptions.length,
      });

      if (error) throw error;

      toast({ title: 'Opção adicionada' });
      setNewOptions((prev) => ({
        ...prev,
        [groupId]: { name: '', description: '', price_modifier: '0' },
      }));
      await loadData();
    } catch (error: any) {
      console.error('Error adding option:', error);
      toast({
        title: 'Erro ao adicionar opção',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingOption(false);
    }
  };

  const deleteOption = async (optionId: string) => {
    try {
      const { error } = await supabase
        .from('acai_size_options')
        .delete()
        .eq('id', optionId);

      if (error) throw error;
      toast({ title: 'Opção removida' });
      await loadData();
    } catch (error: any) {
      console.error('Error deleting option:', error);
      toast({
        title: 'Erro ao remover opção',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleNewOptionChange = (
    groupId: string,
    field: 'name' | 'description' | 'price_modifier',
    value: string
  ) => {
    setNewOptions((prev) => {
      const existing = prev[groupId] || { name: '', description: '', price_modifier: '0' };
      return {
        ...prev,
        [groupId]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Configurar Açaí - {categoryName}</SheetTitle>
            <SheetDescription>
              Configure os tamanhos e opções de adicionais para cada tamanho de açaí.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Tamanhos</h3>
                  <Button size="sm" onClick={() => openSizeModal()}>
                    <Plus className="h-4 w-4 mr-1" />
                    Novo tamanho
                  </Button>
                </div>

                {sizes.length === 0 ? (
                  <Card>
                    <CardContent className="py-6 text-center text-muted-foreground">
                      Nenhum tamanho cadastrado. Crie os tamanhos para configurar as opções.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {sizes.map((size) => (
                      <Card key={size.id}>
                        <Collapsible
                          open={expandedSizes.has(size.id)}
                          onOpenChange={(o) => {
                            setExpandedSizes((prev) => {
                              const next = new Set(prev);
                              if (o) next.add(size.id);
                              else next.delete(size.id);
                              return next;
                            });
                          }}
                        >
                          <CardHeader className="p-4">
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between cursor-pointer">
                                <div className="flex items-center gap-3">
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <CardTitle className="text-base">{size.name}</CardTitle>
                                    <p className="text-sm text-muted-foreground">
                                      R$ {size.base_price.toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">
                                    {(groups[size.id] || []).length} grupos
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openSizeModal(size);
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
                                      deleteSize(size.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  {expandedSizes.has(size.id) ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </div>
                              </div>
                            </CollapsibleTrigger>
                          </CardHeader>

                          <CollapsibleContent>
                            <CardContent className="pt-0 space-y-4">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">Grupos de opções</p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openGroupModal(size.id)}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Novo grupo
                                </Button>
                              </div>

                              {(groups[size.id] || []).length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">
                                  Nenhum grupo de opções. Crie um grupo para adicionar opções.
                                </p>
                              ) : (
                                <div className="space-y-3">
                                  {(groups[size.id] || []).map((group) => (
                                    <Card key={group.id} className="border-dashed">
                                      <Collapsible
                                        open={expandedGroups.has(group.id)}
                                        onOpenChange={(o) => {
                                          setExpandedGroups((prev) => {
                                            const next = new Set(prev);
                                            if (o) next.add(group.id);
                                            else next.delete(group.id);
                                            return next;
                                          });
                                        }}
                                      >
                                        <CardHeader className="p-3">
                                          <CollapsibleTrigger asChild>
                                            <div className="flex items-center justify-between cursor-pointer">
                                              <div>
                                                <CardTitle className="text-sm">
                                                  {group.name}
                                                </CardTitle>
                                                <div className="flex gap-2 mt-1">
                                                  <Badge variant="secondary" className="text-xs">
                                                    {group.free_quantity} grátis
                                                  </Badge>
                                                  {group.extra_price_per_item > 0 && (
                                                    <Badge variant="outline" className="text-xs">
                                                      +R$ {group.extra_price_per_item.toFixed(2)}/extra
                                                    </Badge>
                                                  )}
                                                  <Badge variant="outline" className="text-xs">
                                                    máx: {group.max_selections}
                                                  </Badge>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    openGroupModal(size.id, group);
                                                  }}
                                                >
                                                  Editar
                                                </Button>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-7 w-7 text-destructive"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteGroup(group.id);
                                                  }}
                                                >
                                                  <Trash2 className="h-3 w-3" />
                                                </Button>
                                                {expandedGroups.has(group.id) ? (
                                                  <ChevronUp className="h-4 w-4" />
                                                ) : (
                                                  <ChevronDown className="h-4 w-4" />
                                                )}
                                              </div>
                                            </div>
                                          </CollapsibleTrigger>
                                        </CardHeader>

                                        <CollapsibleContent>
                                          <CardContent className="pt-0 pb-3 space-y-2">
                                            {(options[group.id] || []).map((option) => (
                                              <div
                                                key={option.id}
                                                className="flex items-center justify-between p-2 rounded border bg-background"
                                              >
                                                <div>
                                                  <p className="text-sm font-medium">{option.name}</p>
                                                  {option.description && (
                                                    <p className="text-xs text-muted-foreground">
                                                      {option.description}
                                                    </p>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <span
                                                    className={`text-sm ${
                                                      option.price_modifier > 0
                                                        ? 'text-success'
                                                        : 'text-muted-foreground'
                                                    }`}
                                                  >
                                                    {option.price_modifier > 0
                                                      ? `+R$ ${option.price_modifier.toFixed(2)}`
                                                      : 'Incluso'}
                                                  </span>
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive"
                                                    onClick={() => deleteOption(option.id)}
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              </div>
                                            ))}

                                            {/* Inline add option */}
                                            <div className="border-t pt-2 mt-2 space-y-2">
                                              <p className="text-xs text-muted-foreground">
                                                Adicionar opção
                                              </p>
                                              <div className="grid grid-cols-3 gap-2">
                                                <Input
                                                  placeholder="Nome"
                                                  value={newOptions[group.id]?.name || ''}
                                                  onChange={(e) =>
                                                    handleNewOptionChange(
                                                      group.id,
                                                      'name',
                                                      e.target.value
                                                    )
                                                  }
                                                  className="h-8 text-sm"
                                                />
                                                <Input
                                                  placeholder="Descrição"
                                                  value={newOptions[group.id]?.description || ''}
                                                  onChange={(e) =>
                                                    handleNewOptionChange(
                                                      group.id,
                                                      'description',
                                                      e.target.value
                                                    )
                                                  }
                                                  className="h-8 text-sm"
                                                />
                                                <CurrencyInput
                                                  placeholder="Preço extra"
                                                  value={newOptions[group.id]?.price_modifier || '0'}
                                                  onChange={(value) =>
                                                    handleNewOptionChange(
                                                      group.id,
                                                      'price_modifier',
                                                      value
                                                    )
                                                  }
                                                  className="h-8 text-sm"
                                                />
                                              </div>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="w-full"
                                                onClick={() => addOption(group.id)}
                                                disabled={savingOption}
                                              >
                                                {savingOption && (
                                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                )}
                                                <Plus className="h-3 w-3 mr-1" />
                                                Adicionar
                                              </Button>
                                            </div>
                                          </CardContent>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    </Card>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </CollapsibleContent>
                        </Collapsible>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Size Modal */}
      <Dialog
        open={sizeModal.open}
        onOpenChange={(o) => !o && setSizeModal({ open: false, size: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{sizeModal.size ? 'Editar tamanho' : 'Novo tamanho'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do tamanho *</Label>
              <Input
                value={sizeForm.name}
                onChange={(e) => setSizeForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: 300ml, 500ml, Grande"
              />
            </div>
            <div className="space-y-2">
              <Label>Preço base *</Label>
              <CurrencyInput
                value={sizeForm.base_price}
                onChange={(value) => setSizeForm((f) => ({ ...f, base_price: value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSizeModal({ open: false, size: null })}
            >
              Cancelar
            </Button>
            <Button onClick={saveSize} disabled={savingSize || !sizeForm.name.trim()}>
              {savingSize && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Modal */}
      <Dialog
        open={groupModal.open}
        onOpenChange={(o) => !o && setGroupModal({ open: false, sizeId: '', group: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {groupModal.group ? 'Editar grupo de opções' : 'Novo grupo de opções'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do grupo *</Label>
              <Input
                value={groupForm.name}
                onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Adicionais, Frutas, Caldas"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={groupForm.description}
                onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Escolha seus acompanhamentos"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mín. seleções</Label>
                <Input
                  type="number"
                  min="0"
                  value={groupForm.min_selections}
                  onChange={(e) => setGroupForm((f) => ({ ...f, min_selections: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Máx. seleções</Label>
                <Input
                  type="number"
                  min="1"
                  value={groupForm.max_selections}
                  onChange={(e) => setGroupForm((f) => ({ ...f, max_selections: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade grátis</Label>
                <Input
                  type="number"
                  min="0"
                  value={groupForm.free_quantity}
                  onChange={(e) => setGroupForm((f) => ({ ...f, free_quantity: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Quantos adicionais são inclusos no preço base
                </p>
              </div>
              <div className="space-y-2">
                <Label>Preço por extra</Label>
                <CurrencyInput
                  value={groupForm.extra_price_per_item}
                  onChange={(value) =>
                    setGroupForm((f) => ({ ...f, extra_price_per_item: value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Preço cobrado por cada item além do grátis
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGroupModal({ open: false, sizeId: '', group: null })}
            >
              Cancelar
            </Button>
            <Button onClick={saveGroup} disabled={savingGroup || !groupForm.name.trim()}>
              {savingGroup && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
