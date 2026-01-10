import { useState, useEffect } from 'react';
import { Loader2, Plus, Pencil, Trash2, Save, X, Crown, Zap, Building2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Plan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  price: number;
  revenue_limit: number | null;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

interface PlanFormData {
  key: string;
  name: string;
  description: string;
  price: number;
  revenue_limit: number;
  stripe_price_id: string;
  stripe_product_id: string;
  features: string;
  is_active: boolean;
  sort_order: number;
}

const emptyFormData: PlanFormData = {
  key: '',
  name: '',
  description: '',
  price: 0,
  revenue_limit: 2000,
  stripe_price_id: '',
  stripe_product_id: '',
  features: 'Até R$ 2.000 em vendas/mês\nCardápio digital\nSuporte por email',
  is_active: true,
  sort_order: 0,
};

export default function AdminPlans() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Plan | null>(null);
  const [formData, setFormData] = useState<PlanFormData>(emptyFormData);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      
      setPlans(data?.map(p => ({
        ...p,
        features: Array.isArray(p.features) 
          ? (p.features as unknown as string[]).map(f => String(f))
          : []
      })) || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar planos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      key: plan.key,
      name: plan.name,
      description: plan.description || '',
      price: plan.price,
      revenue_limit: plan.revenue_limit || 2000,
      stripe_price_id: plan.stripe_price_id || '',
      stripe_product_id: plan.stripe_product_id || '',
      features: plan.features.join('\n'),
      is_active: plan.is_active,
      sort_order: plan.sort_order,
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingPlan(null);
    setFormData({
      ...emptyFormData,
      sort_order: plans.length,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.key || !formData.name) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha a chave e o nome do plano',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const planData = {
        key: formData.key.toLowerCase().replace(/\s+/g, '_'),
        name: formData.name,
        description: formData.description || null,
        price: formData.price,
        revenue_limit: formData.revenue_limit,
        stripe_price_id: formData.stripe_price_id || null,
        stripe_product_id: formData.stripe_product_id || null,
        features: formData.features.split('\n').filter(f => f.trim()),
        is_active: formData.is_active,
        sort_order: formData.sort_order,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('subscription_plans')
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;
        toast({ title: 'Plano atualizado com sucesso' });
      } else {
        const { error } = await supabase
          .from('subscription_plans')
          .insert(planData);

        if (error) throw error;
        toast({ title: 'Plano criado com sucesso' });
      }

      setIsDialogOpen(false);
      loadPlans();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar plano',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan: Plan) => {
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', plan.id);

      if (error) throw error;
      
      toast({ title: 'Plano removido com sucesso' });
      setDeleteConfirm(null);
      loadPlans();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover plano',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getIconForPlan = (key: string) => {
    switch (key) {
      case 'enterprise':
        return Building2;
      case 'pro':
      case 'basic':
        return Crown;
      default:
        return Zap;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display">Gerenciar Planos</h1>
            <p className="text-muted-foreground mt-1">
              Configure os planos de assinatura disponíveis
            </p>
          </div>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Plano
          </Button>
        </div>

        {/* Plans Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {plans.map((plan) => {
            const Icon = getIconForPlan(plan.key);
            return (
              <Card key={plan.id} className={!plan.is_active ? 'opacity-60' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {plan.key}
                        </CardDescription>
                      </div>
                    </div>
                    {!plan.is_active && (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <span className="text-2xl font-bold">
                      {plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2)}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-muted-foreground text-sm">/mês</span>
                    )}
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    {plan.revenue_limit === -1 
                      ? 'Faturamento ilimitado' 
                      : `Até R$ ${plan.revenue_limit?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês`}
                  </div>

                  {plan.stripe_price_id && (
                    <div className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded truncate">
                      {plan.stripe_price_id}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEdit(plan)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteConfirm(plan)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Edit/Create Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPlan ? 'Editar Plano' : 'Novo Plano'}
              </DialogTitle>
              <DialogDescription>
                Configure os detalhes do plano de assinatura
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="key">Chave (identificador)</Label>
                  <Input
                    id="key"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    placeholder="ex: basic, pro"
                    disabled={!!editingPlan}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="ex: Plano Básico"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição curta do plano"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Preço</Label>
                  <CurrencyInput
                    id="price"
                    value={formData.price}
                    onChange={(value) => setFormData({ ...formData, price: parseFloat(value) || 0 })}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="revenue_limit">Limite de Faturamento</Label>
                  <CurrencyInput
                    id="revenue_limit"
                    value={formData.revenue_limit}
                    onChange={(value) => setFormData({ ...formData, revenue_limit: parseFloat(value) || 0 })}
                    placeholder="-1 para ilimitado"
                  />
                  <p className="text-xs text-muted-foreground">Use -1 para ilimitado</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stripe_price_id">Stripe Price ID</Label>
                <Input
                  id="stripe_price_id"
                  value={formData.stripe_price_id}
                  onChange={(e) => setFormData({ ...formData, stripe_price_id: e.target.value })}
                  placeholder="price_..."
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stripe_product_id">Stripe Product ID</Label>
                <Input
                  id="stripe_product_id"
                  value={formData.stripe_product_id}
                  onChange={(e) => setFormData({ ...formData, stripe_product_id: e.target.value })}
                  placeholder="prod_..."
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="features">Recursos (um por linha)</Label>
                <Textarea
                  id="features"
                  value={formData.features}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                  placeholder="Até R$ 2.000 em vendas/mês&#10;Cardápio digital&#10;Suporte por email"
                  rows={5}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sort_order">Ordem de exibição</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Plano ativo</Label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover plano?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover o plano "{deleteConfirm?.name}"? 
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
