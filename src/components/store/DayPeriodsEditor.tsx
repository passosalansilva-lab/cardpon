import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DayPeriod {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  sort_order: number;
}

interface CategoryDayPeriod {
  category_id: string;
  day_period_id: string;
}

interface Category {
  id: string;
  name: string;
}

interface DayPeriodsEditorProps {
  companyId: string;
  categories: Category[];
  onPeriodsChange?: () => void;
}

export function DayPeriodsEditor({ companyId, categories, onPeriodsChange }: DayPeriodsEditorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [periods, setPeriods] = useState<DayPeriod[]>([]);
  const [categoryPeriods, setCategoryPeriods] = useState<CategoryDayPeriod[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<DayPeriod | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    start_time: '11:00',
    end_time: '15:00',
  });

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [periodsRes, categoryPeriodsRes] = await Promise.all([
        supabase
          .from('day_periods')
          .select('*')
          .eq('company_id', companyId)
          .order('sort_order'),
        supabase
          .from('category_day_periods')
          .select('category_id, day_period_id'),
      ]);

      if (periodsRes.error) throw periodsRes.error;
      if (categoryPeriodsRes.error) throw categoryPeriodsRes.error;

      setPeriods(periodsRes.data || []);
      setCategoryPeriods(categoryPeriodsRes.data || []);
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Erro ao carregar períodos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openNewPeriod = () => {
    setEditingPeriod(null);
    setFormData({ name: '', start_time: '11:00', end_time: '15:00' });
    setDialogOpen(true);
  };

  const openEditPeriod = (period: DayPeriod) => {
    setEditingPeriod(period);
    setFormData({
      name: period.name,
      start_time: period.start_time.slice(0, 5),
      end_time: period.end_time.slice(0, 5),
    });
    setDialogOpen(true);
  };

  const savePeriod = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      if (editingPeriod) {
        const { error } = await supabase
          .from('day_periods')
          .update({
            name: formData.name.trim(),
            start_time: formData.start_time,
            end_time: formData.end_time,
          })
          .eq('id', editingPeriod.id);
        if (error) throw error;
        toast({ title: 'Período atualizado' });
      } else {
        const { error } = await supabase.from('day_periods').insert({
          company_id: companyId,
          name: formData.name.trim(),
          start_time: formData.start_time,
          end_time: formData.end_time,
          sort_order: periods.length,
        });
        if (error) throw error;
        toast({ title: 'Período criado' });
      }
      setDialogOpen(false);
      loadData();
      onPeriodsChange?.();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar período',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const deletePeriod = async (periodId: string) => {
    try {
      const { error } = await supabase
        .from('day_periods')
        .delete()
        .eq('id', periodId);
      if (error) throw error;
      toast({ title: 'Período excluído' });
      loadData();
      onPeriodsChange?.();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir período',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const togglePeriodActive = async (period: DayPeriod) => {
    try {
      const { error } = await supabase
        .from('day_periods')
        .update({ is_active: !period.is_active })
        .eq('id', period.id);
      if (error) throw error;
      loadData();
      onPeriodsChange?.();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar período',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const toggleCategoryPeriod = async (categoryId: string, periodId: string, isLinked: boolean) => {
    try {
      if (isLinked) {
        const { error } = await supabase
          .from('category_day_periods')
          .delete()
          .eq('category_id', categoryId)
          .eq('day_period_id', periodId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('category_day_periods').insert({
          category_id: categoryId,
          day_period_id: periodId,
        });
        if (error) throw error;
      }
      loadData();
      onPeriodsChange?.();
    } catch (error: any) {
      toast({
        title: 'Erro ao vincular categoria',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const isCategoryLinked = (categoryId: string, periodId: string) => {
    return categoryPeriods.some(
      (cp) => cp.category_id === categoryId && cp.day_period_id === periodId
    );
  };

  const getCategoriesForPeriod = (periodId: string) => {
    return categoryPeriods
      .filter((cp) => cp.day_period_id === periodId)
      .map((cp) => categories.find((c) => c.id === cp.category_id))
      .filter(Boolean) as Category[];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Períodos do Dia</h3>
          <p className="text-sm text-muted-foreground">
            Configure períodos (ex: Almoço, Jantar) e associe categorias que aparecem em cada um.
          </p>
        </div>
        <Button type="button" onClick={openNewPeriod} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Novo período
        </Button>
      </div>

      {periods.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum período configurado. Todas as categorias aparecem o dia todo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {periods.map((period) => {
            const linkedCategories = getCategoriesForPeriod(period.id);
            return (
              <Card key={period.id} className={!period.is_active ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">{period.name}</CardTitle>
                      <Badge variant="outline" className="font-mono text-xs">
                        {period.start_time.slice(0, 5)} - {period.end_time.slice(0, 5)}
                      </Badge>
                      {!period.is_active && (
                        <Badge variant="secondary" className="text-xs">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={period.is_active}
                        onCheckedChange={() => togglePeriodActive(period)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditPeriod(period)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => deletePeriod(period.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Categorias exibidas neste período:
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((category) => {
                        const isLinked = isCategoryLinked(category.id, period.id);
                        return (
                          <label
                            key={category.id}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Checkbox
                              checked={isLinked}
                              onCheckedChange={() =>
                                toggleCategoryPeriod(category.id, period.id, isLinked)
                              }
                            />
                            <span className="text-sm">{category.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    {linkedCategories.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Nenhuma categoria selecionada. Este período não afetará a exibição.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingPeriod ? 'Editar período' : 'Novo período'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do período</Label>
              <Input
                placeholder="Ex: Almoço, Jantar, Café da manhã..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) =>
                    setFormData({ ...formData, start_time: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Fim</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) =>
                    setFormData({ ...formData, end_time: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={savePeriod} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
