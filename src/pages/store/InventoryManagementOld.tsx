import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CurrencyInput } from '@/components/ui/currency-input';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useActivityLog } from '@/hooks/useActivityLog';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  average_unit_cost: number;
}

interface Purchase {
  id: string;
  ingredient_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  purchased_at: string;
  ingredient_name?: string;
}

interface ProductIngredient {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity_per_unit: number;
  product_name?: string;
  ingredient_name?: string;
}

interface ProductOption {
  id: string;
  name: string;
}

interface InventoryFinancialSummary {
  purchasesCost: number;
  consumptionCost: number;
}

export default function InventoryManagement() {
  const { user, staffCompany } = useAuth();
  const { toast } = useToast();
  const { logActivity } = useActivityLog();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [productIngredients, setProductIngredients] = useState<ProductIngredient[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [financialSummary, setFinancialSummary] = useState<InventoryFinancialSummary>({
    purchasesCost: 0,
    consumptionCost: 0,
  });

  const [loadingIngredients, setLoadingIngredients] = useState(false);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [ingredientForm, setIngredientForm] = useState({
    name: '',
    unit: 'kg',
    min_stock: '0',
  });
  const [savingIngredient, setSavingIngredient] = useState(false);
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);

  const [purchaseForm, setPurchaseForm] = useState({
    ingredient_id: '',
    quantity: '0',
    unit_cost: '0',
    supplier: '',
  });
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);

  const [recipeForm, setRecipeForm] = useState({
    product_id: '',
    ingredient_id: '',
    quantity_per_unit: '0',
  });
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  const [massRecipeProductId, setMassRecipeProductId] = useState('');
  const [massRecipeRows, setMassRecipeRows] = useState<
    { ingredient_id: string; quantity: string; enabled: boolean }[]
  >([]);
  const [savingMassRecipe, setSavingMassRecipe] = useState(false);

  useEffect(() => {
    if (!massRecipeProductId) {
      setMassRecipeRows([]);
      return;
    }

    const existingForProduct = productIngredients.filter(
      (pi) => pi.product_id === massRecipeProductId
    );

    setMassRecipeRows(
      ingredients.map((ing) => {
        const existing = existingForProduct.find(
          (pi) => pi.ingredient_id === ing.id
        );
        return {
          ingredient_id: ing.id,
          quantity: existing ? String(existing.quantity_per_unit ?? 0) : '',
          enabled: !!existing,
        };
      })
    );
  }, [massRecipeProductId, ingredients, productIngredients]);

  useEffect(() => {
    if (!user) return;
    loadCompany();
  }, [user]);

  const loadCompany = async () => {
    try {
      setLoadingCompany(true);

      // Staff users don't own a company row; use the staff-company link.
      if (staffCompany?.companyId) {
        setCompanyId(staffCompany.companyId);
        loadAll(staffCompany.companyId);
        return;
      }

      const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', user!.id)
        .single();

      if (error) throw error;
      setCompanyId(data.id);
      loadAll(data.id);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar empresa',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingCompany(false);
    }
  };

  const loadAll = async (companyIdParam: string) => {
    await Promise.all([
      loadIngredients(companyIdParam),
      loadPurchases(companyIdParam),
      loadProductIngredients(companyIdParam),
      loadFinancialSummary(companyIdParam),
    ]);
  };

  const loadIngredients = async (companyIdParam?: string) => {
    const id = companyIdParam || companyId;
    if (!id) return;
    try {
      setLoadingIngredients(true);
      const { data, error } = await supabase
        .from('inventory_ingredients')
        .select('id, name, unit, current_stock, min_stock, average_unit_cost')
        .eq('company_id', id)
        .order('name');

      if (error) throw error;
      setIngredients(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar ingredientes',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingIngredients(false);
    }
  };

  const loadPurchases = async (companyIdParam?: string) => {
    const id = companyIdParam || companyId;
    if (!id) return;
    try {
      setLoadingPurchases(true);
      const { data, error } = await supabase
        .from('inventory_purchases')
        .select(
          `id, ingredient_id, quantity, unit_cost, total_cost, purchased_at,
           inventory_ingredients ( name )`
        )
        .eq('company_id', id)
        .order('purchased_at', { ascending: false });

      if (error) throw error;
      const mapped: Purchase[] = (data || []).map((row: any) => ({
        id: row.id,
        ingredient_id: row.ingredient_id,
        quantity: row.quantity,
        unit_cost: row.unit_cost,
        total_cost: row.total_cost,
        purchased_at: row.purchased_at,
        ingredient_name: row.inventory_ingredients?.name ?? undefined,
      }));
      setPurchases(mapped);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar compras',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingPurchases(false);
    }
  };

  const loadProductIngredients = async (companyIdParam?: string) => {
    const id = companyIdParam || companyId;
    if (!id) return;
    try {
      setLoadingProducts(true);
      const [{ data: productsData, error: productsError }, { data, error }] = await Promise.all([
        supabase
          .from('products')
          .select('id, name')
          .eq('company_id', id)
          .order('name'),
        supabase
          .from('inventory_product_ingredients')
          .select(
            `id, product_id, ingredient_id, quantity_per_unit,
             products ( name ),
             inventory_ingredients ( name )`
          )
          .eq('company_id', id)
          .order('created_at', { ascending: false }),
      ] as any);

      if (productsError) throw productsError;
      setProducts((productsData || []).map((p: any) => ({ id: p.id, name: p.name })));

      if (error) throw error;
      const mapped: ProductIngredient[] = (data || []).map((row: any) => ({
        id: row.id,
        product_id: row.product_id,
        ingredient_id: row.ingredient_id,
        quantity_per_unit: row.quantity_per_unit,
        product_name: row.products?.name ?? undefined,
        ingredient_name: row.inventory_ingredients?.name ?? undefined,
      }));
      setProductIngredients(mapped);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar ficha técnica',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadFinancialSummary = async (companyIdParam?: string) => {
    const id = companyIdParam || companyId;
    if (!id) return;

    try {
      const today = new Date();
      const start = startOfDay(subDays(today, 29)).toISOString();
      const end = endOfDay(today).toISOString();

      const { data, error } = await supabase
        .from('inventory_movements')
        .select(
          `quantity, movement_type, unit_cost, ingredient_id,
           inventory_ingredients ( average_unit_cost )`
        )
        .eq('company_id', id)
        .gte('created_at', start)
        .lte('created_at', end);

      if (error) throw error;

      let purchasesCost = 0;
      let consumptionCost = 0;

      (data || []).forEach((row: any) => {
        const qty = Number(row.quantity) || 0;
        if (row.movement_type === 'purchase') {
          const unitCost = Number(row.unit_cost) || 0;
          purchasesCost += qty * unitCost;
        }
        if (row.movement_type === 'consumption') {
          const unitCost =
            typeof row.unit_cost === 'number' && !isNaN(row.unit_cost)
              ? row.unit_cost
              : Number(row.inventory_ingredients?.average_unit_cost) || 0;
          const absQty = Math.abs(qty);
          consumptionCost += absQty * unitCost;
        }
      });

      setFinancialSummary({ purchasesCost, consumptionCost });
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar resumo financeiro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSaveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    try {
      setSavingIngredient(true);
      const minStockNumber = parseFloat(ingredientForm.min_stock || '0');
      const payload = {
        name: ingredientForm.name.trim(),
        unit: ingredientForm.unit.trim() || 'un',
        min_stock: isNaN(minStockNumber) ? 0 : minStockNumber,
      };

      let error;
      if (editingIngredientId) {
        ({ error } = await supabase
          .from('inventory_ingredients')
          .update(payload)
          .eq('id', editingIngredientId));
        
        if (!error) {
          await logActivity({
            actionType: 'update',
            entityType: 'inventory',
            entityId: editingIngredientId,
            entityName: payload.name,
            description: `Ingrediente "${payload.name}" atualizado`,
          });
        }
      } else {
        const { data: inserted, error: insertError } = await supabase.from('inventory_ingredients').insert({
          company_id: companyId,
          ...payload,
        }).select('id').single();
        error = insertError;
        
        if (!error && inserted) {
          await logActivity({
            actionType: 'create',
            entityType: 'inventory',
            entityId: inserted.id,
            entityName: payload.name,
            description: `Ingrediente "${payload.name}" criado`,
          });
        }
      }

      if (error) throw error;

      toast({ title: editingIngredientId ? 'Ingrediente atualizado com sucesso' : 'Ingrediente criado com sucesso' });
      setIngredientForm({ name: '', unit: 'kg', min_stock: '0' });
      setEditingIngredientId(null);
      loadIngredients();
    } catch (error: any) {
      toast({
        title: editingIngredientId ? 'Erro ao atualizar ingrediente' : 'Erro ao criar ingrediente',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingIngredient(false);
    }
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    try {
      setSavingPurchase(true);
      const quantity = parseFloat(purchaseForm.quantity || '0');
      const unitCost = parseFloat(purchaseForm.unit_cost || '0');
      const ingredientName = ingredients.find(i => i.id === purchaseForm.ingredient_id)?.name || 'Ingrediente';

      const payload = {
        ingredient_id: purchaseForm.ingredient_id,
        quantity: isNaN(quantity) ? 0 : quantity,
        unit_cost: isNaN(unitCost) ? 0 : unitCost,
        supplier: purchaseForm.supplier || null,
      };

      let error;
      if (editingPurchaseId) {
        // Atualizar compra existente
        ({ error } = await supabase
          .from('inventory_purchases')
          .update(payload)
          .eq('id', editingPurchaseId));

        if (!error) {
          await logActivity({
            actionType: 'update',
            entityType: 'inventory',
            entityId: editingPurchaseId,
            entityName: ingredientName,
            description: `Compra de ${quantity} ${ingredientName} atualizada`,
          });
        }
      } else {
        // Criar nova compra
        const { data: inserted, error: insertError } = await supabase.from('inventory_purchases').insert({
          company_id: companyId,
          ...payload,
        }).select('id').single();
        error = insertError;

        if (!error && inserted) {
          await logActivity({
            actionType: 'create',
            entityType: 'inventory',
            entityId: inserted.id,
            entityName: ingredientName,
            description: `Compra de ${quantity} ${ingredientName} registrada`,
          });
        }
      }

      if (error) throw error;

      toast({ title: editingPurchaseId ? 'Compra atualizada com sucesso' : 'Compra registrada com sucesso' });
      setPurchaseForm({ ingredient_id: '', quantity: '0', unit_cost: '0', supplier: '' });
      setEditingPurchaseId(null);
      loadPurchases();
      loadIngredients(); // estoque atualizado pela trigger
    } catch (error: any) {
      toast({
        title: editingPurchaseId ? 'Erro ao atualizar compra' : 'Erro ao registrar compra',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingPurchase(false);
    }
  };

  const handleDeletePurchase = async (purchaseId: string, ingredientName: string) => {
    try {
      const { error } = await supabase
        .from('inventory_purchases')
        .delete()
        .eq('id', purchaseId);
      if (error) throw error;
      
      await logActivity({
        actionType: 'delete',
        entityType: 'inventory',
        entityId: purchaseId,
        entityName: ingredientName,
        description: `Compra de ${ingredientName} removida`,
      });
      
      toast({ title: 'Compra removida com sucesso' });
      loadPurchases();
      loadIngredients();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover compra',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    try {
      setSavingRecipe(true);
      const quantity = parseFloat(recipeForm.quantity_per_unit || '0');
      const productName =
        products.find((p) => p.id === recipeForm.product_id)?.name || 'Produto';
      const ingredientName =
        ingredients.find((i) => i.id === recipeForm.ingredient_id)?.name ||
        'Ingrediente';

      const payload = {
        product_id: recipeForm.product_id,
        ingredient_id: recipeForm.ingredient_id,
        quantity_per_unit: isNaN(quantity) ? 0 : quantity,
      };

      let error;
      if (editingRecipeId) {
        ({ error } = await supabase
          .from('inventory_product_ingredients')
          .update(payload)
          .eq('id', editingRecipeId));

        if (!error) {
          await logActivity({
            actionType: 'update',
            entityType: 'inventory',
            entityId: editingRecipeId,
            entityName: `${productName} - ${ingredientName}`,
            description: `Ficha técnica atualizada: ${ingredientName} em ${productName}`,
          });
        }
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('inventory_product_ingredients')
          .insert({
            company_id: companyId,
            ...payload,
          })
          .select('id')
          .single();
        error = insertError;

        if (!error && inserted) {
          await logActivity({
            actionType: 'create',
            entityType: 'inventory',
            entityId: inserted.id,
            entityName: `${productName} - ${ingredientName}`,
            description: `Ingrediente ${ingredientName} vinculado a ${productName}`,
          });
        }
      }

      if (error) throw error;

      toast({
        title: editingRecipeId
          ? 'Ficha técnica atualizada'
          : 'Ingrediente vinculado ao produto com sucesso',
      });
      setRecipeForm({
        product_id: '',
        ingredient_id: '',
        quantity_per_unit: '0',
      });
      setEditingRecipeId(null);
      loadProductIngredients();
    } catch (error: any) {
      toast({
        title: editingRecipeId
          ? 'Erro ao atualizar ficha técnica'
          : 'Erro ao vincular ingrediente',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingRecipe(false);
    }
  };

  const handleSaveMassRecipe = async () => {
    if (!companyId || !massRecipeProductId) return;

    try {
      setSavingMassRecipe(true);
      const existingForProduct = productIngredients.filter(
        (pi) => pi.product_id === massRecipeProductId
      );
      const existingByIngredient = new Map(
        existingForProduct.map((pi) => [pi.ingredient_id, pi])
      );

      const upsertPayload: {
        id?: string;
        company_id: string;
        product_id: string;
        ingredient_id: string;
        quantity_per_unit: number;
      }[] = [];
      const deleteIds: string[] = [];

      massRecipeRows.forEach((row) => {
        const existing = existingByIngredient.get(row.ingredient_id);
        const qty = parseFloat(row.quantity || '0');
        const safeQty = isNaN(qty) ? 0 : qty;

        if (row.enabled && safeQty > 0) {
          const base = {
            company_id: companyId,
            product_id: massRecipeProductId,
            ingredient_id: row.ingredient_id,
            quantity_per_unit: safeQty,
          };

          if (existing?.id) {
            upsertPayload.push({ ...base, id: existing.id });
          } else {
            upsertPayload.push(base);
          }
        } else if (!row.enabled && existing) {
          deleteIds.push(existing.id);
        }
      });

      if (upsertPayload.length) {
        const { error } = await supabase
          .from('inventory_product_ingredients')
          .upsert(upsertPayload);
        if (error) throw error;
      }

      if (deleteIds.length) {
        const { error } = await supabase
          .from('inventory_product_ingredients')
          .delete()
          .in('id', deleteIds);
        if (error) throw error;
      }

      const productName =
        products.find((p) => p.id === massRecipeProductId)?.name || 'Produto';

      await logActivity({
        actionType: 'update',
        entityType: 'inventory',
        entityId: massRecipeProductId,
        entityName: productName,
        description: `Ficha técnica atualizada em massa para o produto ${productName}`,
      });

      toast({ title: 'Ficha técnica do produto atualizada' });
      await loadProductIngredients();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar ficha técnica em massa',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingMassRecipe(false);
    }
  };
  const handleDeleteRecipe = async (recipeId: string, productName: string, ingredientName: string) => {
    try {
      const { error } = await supabase
        .from('inventory_product_ingredients')
        .delete()
        .eq('id', recipeId);
      if (error) throw error;
      
      await logActivity({
        actionType: 'delete',
        entityType: 'inventory',
        entityId: recipeId,
        entityName: `${productName} - ${ingredientName}`,
        description: `Ingrediente ${ingredientName} removido de ${productName}`,
      });
      
      toast({ title: 'Ingrediente removido da ficha técnica' });
      loadProductIngredients();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover da ficha técnica',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

  const productUnitCosts = useMemo(
    () => {
      const map: { productId: string; productName: string; cost: number }[] = [];
      const byId: Record<string, { productId: string; productName: string; cost: number }> = {};

      productIngredients.forEach((pi) => {
        const ingredient = ingredients.find((ing) => ing.id === pi.ingredient_id);
        const avgCost = ingredient?.average_unit_cost ?? 0;
        const partialCost = (pi.quantity_per_unit || 0) * avgCost;
        const key = pi.product_id;

        if (!byId[key]) {
          byId[key] = {
            productId: key,
            productName: pi.product_name || key,
            cost: 0,
          };
        }

        byId[key].cost += partialCost;
      });

      Object.values(byId).forEach((entry) => map.push(entry));
      return map.sort((a, b) => a.productName.localeCompare(b.productName));
    },
    [productIngredients, ingredients]
  );

  const inventorySummary = useMemo(() => {
    const totalItems = ingredients.length;
    const belowMin = ingredients.filter(
      (ing) => typeof ing.min_stock === 'number' && ing.min_stock > 0 && ing.current_stock <= ing.min_stock,
    ).length;
    const estimatedValue = ingredients.reduce((sum, ing) => {
      const stock = typeof ing.current_stock === 'number' ? ing.current_stock : 0;
      const cost = typeof ing.average_unit_cost === 'number' ? ing.average_unit_cost : 0;
      return sum + stock * cost;
    }, 0);

    return {
      totalItems,
      belowMin,
      estimatedValue,
    };
  }, [ingredients]);

  if (loadingCompany) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Carregando loja...
        </div>
      </DashboardLayout>
    );
  }

  if (!companyId) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-2">
          <p className="text-lg font-medium">Nenhuma loja encontrada</p>
          <p className="text-sm text-muted-foreground">
            Crie sua loja primeiro na tela "Minha Loja" para habilitar o controle de estoque.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estoque</h1>
          <p className="text-sm text-muted-foreground">
            Controle simples de ingredientes e compras. O sistema calcula automaticamente o consumo pelos pedidos.
          </p>
        </div>

        <Card>
          <CardContent className="py-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total de ingredientes</p>
                <p className="text-2xl font-semibold mt-1">{inventorySummary.totalItems}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Abaixo do mínimo</p>
                <p className="text-2xl font-semibold mt-1 text-destructive">
                  {inventorySummary.belowMin}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor estimado em estoque</p>
                <p className="text-2xl font-semibold mt-1">{formatCurrency(inventorySummary.estimatedValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Impacto financeiro dos ingredientes (últimos 30 dias)</CardTitle>
            <CardDescription>Baseado nas entradas (compras) e saídas por pedidos confirmados.</CardDescription>
          </CardHeader>
          <CardContent className="py-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Compras de ingredientes</p>
                <p className="text-2xl font-semibold mt-1">{formatCurrency(financialSummary.purchasesCost)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custo estimado consumido</p>
                <p className="text-2xl font-semibold mt-1">{formatCurrency(financialSummary.consumptionCost)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saldo (compras - consumo)</p>
                <p className="text-2xl font-semibold mt-1">
                  {formatCurrency(financialSummary.purchasesCost - financialSummary.consumptionCost)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="ingredients" className="w-full">

          <TabsList>
            <TabsTrigger value="ingredients">Ingredientes</TabsTrigger>
            <TabsTrigger value="purchases">Compras</TabsTrigger>
            <TabsTrigger value="recipes">Ficha técnica</TabsTrigger>
          </TabsList>

          <TabsContent value="ingredients" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Novo ingrediente</CardTitle>
                <CardDescription>Cadastro básico: nome, unidade (kg, un, ml) e quanto você considera o mínimo em estoque.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveIngredient} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div className="space-y-1 md:col-span-2">
                    <Label>Nome</Label>
                    <Input
                      value={ingredientForm.name}
                      onChange={(e) => setIngredientForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Ex: Queijo mussarela"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Unidade</Label>
                    <Input
                      value={ingredientForm.unit}
                      onChange={(e) => setIngredientForm((f) => ({ ...f, unit: e.target.value }))}
                      placeholder="Ex: kg, un, ml"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Estoque mínimo</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={ingredientForm.min_stock}
                      onChange={(e) => setIngredientForm((f) => ({ ...f, min_stock: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2 mt-2 md:mt-0">
                    <Button type="submit" disabled={savingIngredient} className="flex-1">
                      {savingIngredient ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          {editingIngredientId ? 'Salvar alterações' : 'Adicionar'}
                        </>
                      )}
                    </Button>
                    {editingIngredientId && (
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setEditingIngredientId(null);
                          setIngredientForm({ name: '', unit: 'kg', min_stock: '0' });
                        }}
                      >
                        Cancelar edição
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ingredientes cadastrados</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingIngredients ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando ingredientes...
                  </div>
                ) : ingredients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum ingrediente cadastrado ainda.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead className="text-right">Estoque atual</TableHead>
                        <TableHead className="text-right">Estoque mínimo</TableHead>
                        <TableHead className="text-right">Custo médio</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ingredients.map((ing) => {
                        const belowMin = ing.current_stock <= ing.min_stock;
                        return (
                          <TableRow key={ing.id} className={belowMin ? 'bg-destructive/5' : undefined}>
                            <TableCell>{ing.name}</TableCell>
                            <TableCell>{ing.unit}</TableCell>
                            <TableCell className="text-right">
                              {ing.current_stock.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right">
                              {ing.min_stock.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(ing.average_unit_cost)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setEditingIngredientId(ing.id);
                                    setIngredientForm({
                                      name: ing.name,
                                      unit: ing.unit,
                                      min_stock: String(ing.min_stock ?? 0),
                                    });
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8 text-destructive border-destructive/40 hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remover ingrediente</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Tem certeza que deseja remover o ingrediente "{ing.name}"? Essa ação não ajusta
                                        movimentações de estoque já registradas e não poderá ser desfeita.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={async () => {
                                          try {
                                            const { error } = await supabase
                                              .from('inventory_ingredients')
                                              .delete()
                                              .eq('id', ing.id);
                                            if (error) throw error;
                                            toast({ title: 'Ingrediente removido com sucesso' });
                                            loadIngredients();
                                          } catch (error: any) {
                                            toast({
                                              title: 'Erro ao remover ingrediente',
                                              description:
                                                error.message ||
                                                'Verifique se não há ficha técnica ou movimentações usando este ingrediente.',
                                              variant: 'destructive',
                                            });
                                          }
                                        }}
                                      >
                                        Remover
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="purchases" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{editingPurchaseId ? 'Editar compra' : 'Nova compra'}</CardTitle>
                <CardDescription>Informe quanto comprou de cada ingrediente e o custo unitário. O estoque é atualizado automaticamente.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSavePurchase} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div className="space-y-1 md:col-span-2">
                    <Label>Ingrediente</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={purchaseForm.ingredient_id}
                      onChange={(e) => setPurchaseForm((f) => ({ ...f, ingredient_id: e.target.value }))}
                      required
                    >
                      <option value="">Selecione...</option>
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({ing.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={purchaseForm.quantity}
                      onChange={(e) => setPurchaseForm((f) => ({ ...f, quantity: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Custo unitário</Label>
                    <CurrencyInput
                      value={purchaseForm.unit_cost}
                      onChange={(value) => setPurchaseForm((f) => ({ ...f, unit_cost: value }))}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Fornecedor (opcional)</Label>
                    <Input
                      value={purchaseForm.supplier}
                      onChange={(e) => setPurchaseForm((f) => ({ ...f, supplier: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2 mt-2 md:mt-0">
                    <Button type="submit" disabled={savingPurchase || ingredients.length === 0} className="flex-1">
                      {savingPurchase ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          {editingPurchaseId ? 'Salvar' : 'Registrar'}
                        </>
                      )}
                    </Button>
                    {editingPurchaseId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingPurchaseId(null);
                          setPurchaseForm({ ingredient_id: '', quantity: '0', unit_cost: '0', supplier: '' });
                        }}
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de compras</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPurchases ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando compras...
                  </div>
                ) : purchases.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma compra registrada ainda.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Ingrediente</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead className="text-right">Custo unitário</TableHead>
                        <TableHead className="text-right">Custo total</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{formatDate(p.purchased_at)}</TableCell>
                          <TableCell>{p.ingredient_name || '-'}</TableCell>
                          <TableCell className="text-right">
                            {p.quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(p.unit_cost)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(p.total_cost)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditingPurchaseId(p.id);
                                  setPurchaseForm({
                                    ingredient_id: p.ingredient_id,
                                    quantity: String(p.quantity ?? 0),
                                    unit_cost: String(p.unit_cost ?? 0),
                                    supplier: '',
                                  });
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 text-destructive border-destructive/40 hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover compra</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja remover esta compra de {p.ingredient_name}? O estoque não será ajustado automaticamente.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => handleDeletePurchase(p.id, p.ingredient_name || 'Ingrediente')}
                                    >
                                      Remover
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recipes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{editingRecipeId ? 'Editar vínculo' : 'Vincular ingrediente a produto'}</CardTitle>
                <CardDescription>
                  Aqui você monta a ficha técnica: para cada produto, diga quais ingredientes entram e em que quantidade.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <form
                    onSubmit={handleSaveRecipe}
                    className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
                  >
                    <div className="space-y-1 md:col-span-2">
                      <Label>Produto</Label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={recipeForm.product_id}
                        onChange={(e) =>
                          setRecipeForm((f) => ({ ...f, product_id: e.target.value }))
                        }
                        required
                      >
                        <option value="">Selecione um produto...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Ingrediente</Label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={recipeForm.ingredient_id}
                        onChange={(e) =>
                          setRecipeForm((f) => ({ ...f, ingredient_id: e.target.value }))
                        }
                        required
                      >
                        <option value="">Selecione um ingrediente...</option>
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} ({ing.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Quantidade por unidade</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Ex: 2 = duas fatias, 0.15 = 150g"
                        value={recipeForm.quantity_per_unit}
                        onChange={(e) =>
                          setRecipeForm((f) => ({
                            ...f,
                            quantity_per_unit: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="flex gap-2 mt-2 md:mt-0">
                      <Button
                        type="submit"
                        disabled={
                          savingRecipe || products.length === 0 || ingredients.length === 0
                        }
                        className="flex-1"
                      >
                        {savingRecipe ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            {editingRecipeId ? 'Salvar' : 'Vincular'}
                          </>
                        )}
                      </Button>
                      {editingRecipeId && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingRecipeId(null);
                            setRecipeForm({
                              product_id: '',
                              ingredient_id: '',
                              quantity_per_unit: '0',
                            });
                          }}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </form>

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-medium">
                        Editor em massa por produto
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Selecione um produto e marque todos os ingredientes que entram na
                        ficha técnica de uma vez, ajustando a quantidade de cada um.
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3 items-end">
                      <div className="space-y-1 md:col-span-2">
                        <Label>Produto para editar em massa</Label>
                        <select
                          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                          value={massRecipeProductId}
                          onChange={(e) => setMassRecipeProductId(e.target.value)}
                        >
                          <option value="">Selecione um produto...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex md:justify-end">
                        <Button
                          type="button"
                          onClick={handleSaveMassRecipe}
                          disabled={
                            savingMassRecipe ||
                            !massRecipeProductId ||
                            massRecipeRows.length === 0
                          }
                        >
                          {savingMassRecipe ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                            </>
                          ) : (
                            'Salvar ficha técnica do produto'
                          )}
                        </Button>
                      </div>
                    </div>

                    {!massRecipeProductId ? (
                      <p className="text-xs text-muted-foreground">
                        Escolha um produto acima para ver e editar os ingredientes.
                      </p>
                    ) : ingredients.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Cadastre ingredientes na aba de ingredientes para montar a ficha
                        técnica.
                      </p>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16">Usar</TableHead>
                              <TableHead>Ingrediente</TableHead>
                              <TableHead className="text-right">
                                Quantidade por unidade
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {massRecipeRows.map((row) => {
                              const ingredient = ingredients.find(
                                (ing) => ing.id === row.ingredient_id
                              );
                              if (!ingredient) return null;

                              return (
                                <TableRow key={row.ingredient_id}>
                                  <TableCell>
                                    <Checkbox
                                      checked={row.enabled}
                                      onCheckedChange={(checked) => {
                                        setMassRecipeRows((current) =>
                                          current.map((r) =>
                                            r.ingredient_id === row.ingredient_id
                                              ? {
                                                  ...r,
                                                  enabled: Boolean(checked),
                                                  quantity:
                                                    !r.quantity && checked
                                                      ? '0'
                                                      : r.quantity,
                                                }
                                              : r
                                          )
                                        );
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {ingredient.name} ({ingredient.unit})
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="h-8 w-32 ml-auto text-right"
                                      value={row.quantity}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        setMassRecipeRows((current) =>
                                          current.map((r) =>
                                            r.ingredient_id === row.ingredient_id
                                              ? { ...r, quantity: value }
                                              : r
                                          )
                                        );
                                      }}
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Custo estimado por unidade (ingredientes)</CardTitle>
              </CardHeader>
              <CardContent>
                {productUnitCosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum custo calculado ainda. Vincule ingredientes aos produtos para ver o custo estimado.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Custo de ingredientes por unidade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productUnitCosts.map((p) => (
                        <TableRow key={p.productId}>
                          <TableCell>{p.productName}</TableCell>
                          <TableCell className="text-right">{formatCurrency(p.cost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ficha técnica por produto</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingProducts ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando ficha técnica...
                  </div>
                ) : productIngredients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum ingrediente vinculado ainda. Use o formulário acima para montar a ficha técnica dos produtos.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Ingrediente</TableHead>
                        <TableHead className="text-right">Quantidade por unidade</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productIngredients.map((pi) => (
                        <TableRow key={pi.id}>
                          <TableCell>{pi.product_name || pi.product_id}</TableCell>
                          <TableCell>{pi.ingredient_name || pi.ingredient_id}</TableCell>
                          <TableCell className="text-right">
                            {pi.quantity_per_unit.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditingRecipeId(pi.id);
                                  setRecipeForm({
                                    product_id: pi.product_id,
                                    ingredient_id: pi.ingredient_id,
                                    quantity_per_unit: String(pi.quantity_per_unit ?? 0),
                                  });
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 text-destructive border-destructive/40 hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover da ficha técnica</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja remover {pi.ingredient_name} do produto {pi.product_name}?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => handleDeleteRecipe(pi.id, pi.product_name || 'Produto', pi.ingredient_name || 'Ingrediente')}
                                    >
                                      Remover
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
