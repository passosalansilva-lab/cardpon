import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useActivityLog } from '@/hooks/useActivityLog';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Package, ShoppingCart, FileText, Loader2 } from 'lucide-react';
import { subDays, startOfDay, endOfDay } from 'date-fns';

// Components
import { InventoryDashboard } from '@/components/inventory/InventoryDashboard';
import { IngredientCard } from '@/components/inventory/IngredientCard';
import { IngredientFormModal } from '@/components/inventory/IngredientFormModal';
import { PurchaseFormModal } from '@/components/inventory/PurchaseFormModal';
import { PurchaseHistoryTable } from '@/components/inventory/PurchaseHistoryTable';
import { DeleteIngredientDialog } from '@/components/inventory/DeleteIngredientDialog';

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

interface Purchase {
  id: string;
  ingredient_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  purchased_at: string;
  ingredient_name?: string;
}

export default function InventoryManagement() {
  const { user, staffCompany } = useAuth();
  const { toast } = useToast();
  const { logActivity } = useActivityLog();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientUnits, setIngredientUnits] = useState<Record<string, IngredientUnit[]>>({});
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loadingIngredients, setLoadingIngredients] = useState(false);
  const [loadingPurchases, setLoadingPurchases] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [consumptionCost, setConsumptionCost] = useState(0);

  // Modal states
  const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [selectedIngredientForPurchase, setSelectedIngredientForPurchase] = useState<Ingredient | null>(null);
  const [ingredientToDelete, setIngredientToDelete] = useState<Ingredient | null>(null);

  // Computed values
  const filteredIngredients = useMemo(() => {
    if (!searchTerm) return ingredients;
    const term = searchTerm.toLowerCase();
    return ingredients.filter((ing) =>
      ing.name.toLowerCase().includes(term)
    );
  }, [ingredients, searchTerm]);

  const lowStockIngredients = useMemo(
    () => ingredients.filter((ing) => ing.current_stock <= ing.min_stock),
    [ingredients]
  );

  const totalStockValue = useMemo(
    () =>
      ingredients.reduce(
        (sum, ing) => sum + ing.current_stock * ing.average_unit_cost,
        0
      ),
    [ingredients]
  );

  useEffect(() => {
    if (!user) return;
    loadCompany();
  }, [user]);

  const loadCompany = async () => {
    try {
      setLoadingCompany(true);

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
      loadIngredientUnits(companyIdParam),
      loadPurchases(companyIdParam),
      loadConsumption(companyIdParam),
    ]);
  };

  const loadIngredientUnits = async (companyIdParam?: string) => {
    const id = companyIdParam || companyId;
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('inventory_ingredient_units')
        .select('id, ingredient_id, name, abbreviation, conversion_factor, is_base_unit')
        .eq('company_id', id);

      if (error) throw error;
      
      // Agrupar por ingredient_id
      const grouped: Record<string, IngredientUnit[]> = {};
      (data || []).forEach((row: any) => {
        if (!grouped[row.ingredient_id]) {
          grouped[row.ingredient_id] = [];
        }
        grouped[row.ingredient_id].push({
          id: row.id,
          name: row.name,
          abbreviation: row.abbreviation,
          conversion_factor: Number(row.conversion_factor),
          is_base_unit: row.is_base_unit,
        });
      });
      setIngredientUnits(grouped);
    } catch (error: any) {
      console.error('Error loading ingredient units:', error);
    }
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

  const loadConsumption = async (companyIdParam?: string) => {
    const id = companyIdParam || companyId;
    if (!id) return;

    try {
      const today = new Date();
      const start = startOfDay(subDays(today, 29)).toISOString();
      const end = endOfDay(today).toISOString();

      const { data, error } = await supabase
        .from('inventory_movements')
        .select(
          `quantity, movement_type, unit_cost,
           inventory_ingredients ( average_unit_cost )`
        )
        .eq('company_id', id)
        .eq('movement_type', 'consumption')
        .gte('created_at', start)
        .lte('created_at', end);

      if (error) throw error;

      let cost = 0;
      (data || []).forEach((row: any) => {
        const qty = Math.abs(Number(row.quantity) || 0);
        const unitCost =
          typeof row.unit_cost === 'number' && !isNaN(row.unit_cost)
            ? row.unit_cost
            : Number(row.inventory_ingredients?.average_unit_cost) || 0;
        cost += qty * unitCost;
      });

      setConsumptionCost(cost);
    } catch (error: any) {
      console.error('Error loading consumption:', error);
    }
  };

  // Handlers
  const handleSaveIngredient = async (data: {
    name: string;
    unit: string;
    min_stock: number;
    units: IngredientUnit[];
  }) => {
    if (!companyId) return;

    try {
      let ingredientId: string;
      
      if (editingIngredient) {
        const { error } = await supabase
          .from('inventory_ingredients')
          .update({ name: data.name, unit: data.unit, min_stock: data.min_stock })
          .eq('id', editingIngredient.id);

        if (error) throw error;
        ingredientId = editingIngredient.id;

        await logActivity({
          actionType: 'update',
          entityType: 'inventory',
          entityId: editingIngredient.id,
          entityName: data.name,
          description: `Ingrediente "${data.name}" atualizado`,
        });

        toast({ title: 'Ingrediente atualizado com sucesso' });
      } else {
        const { data: inserted, error } = await supabase
          .from('inventory_ingredients')
          .insert({ company_id: companyId, name: data.name, unit: data.unit, min_stock: data.min_stock })
          .select('id')
          .single();

        if (error) throw error;
        ingredientId = inserted.id;

        await logActivity({
          actionType: 'create',
          entityType: 'inventory',
          entityId: inserted.id,
          entityName: data.name,
          description: `Ingrediente "${data.name}" criado`,
        });

        toast({ title: 'Ingrediente cadastrado com sucesso' });
      }

      // Salvar unidades de conversão
      // Primeiro, deletar unidades existentes deste ingrediente
      await supabase
        .from('inventory_ingredient_units')
        .delete()
        .eq('ingredient_id', ingredientId);

      // Inserir novas unidades
      if (data.units.length > 0) {
        const unitsToInsert = data.units.map(u => ({
          ingredient_id: ingredientId,
          company_id: companyId,
          name: u.name,
          abbreviation: u.abbreviation,
          conversion_factor: u.conversion_factor,
          is_base_unit: u.is_base_unit,
        }));

        const { error: unitsError } = await supabase
          .from('inventory_ingredient_units')
          .insert(unitsToInsert);

        if (unitsError) {
          console.error('Error saving units:', unitsError);
        }
      }

      setEditingIngredient(null);
      await Promise.all([loadIngredients(), loadIngredientUnits()]);
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar ingrediente',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleSavePurchase = async (data: {
    ingredient_id: string;
    quantity: number;
    unit_cost: number;
    supplier?: string;
    unit_id?: string;
    conversion_factor: number;
  }) => {
    if (!companyId) return;

    try {
      const ingredient = ingredients.find((i) => i.id === data.ingredient_id);
      const ingredientName = ingredient?.name || 'Ingrediente';
      
      // Converter quantidade para unidade base
      const quantityInBaseUnits = data.quantity * data.conversion_factor;
      // Custo por unidade base
      const costPerBaseUnit = data.conversion_factor > 0 
        ? data.unit_cost / data.conversion_factor 
        : data.unit_cost;

      const { data: inserted, error } = await supabase
        .from('inventory_purchases')
        .insert({
          company_id: companyId,
          ingredient_id: data.ingredient_id,
          quantity: quantityInBaseUnits, // Salvar em unidades base
          unit_cost: costPerBaseUnit, // Custo por unidade base
          supplier: data.supplier || null,
          unit_id: data.unit_id || null,
        })
        .select('id')
        .single();

      if (error) throw error;

      await logActivity({
        actionType: 'create',
        entityType: 'inventory',
        entityId: inserted.id,
        entityName: ingredientName,
        description: `Compra de ${data.quantity} ${ingredientName} registrada`,
      });

      toast({ title: 'Compra registrada com sucesso' });
      setSelectedIngredientForPurchase(null);
      loadPurchases();
      loadIngredients();
    } catch (error: any) {
      toast({
        title: 'Erro ao registrar compra',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleDeleteIngredient = async () => {
    if (!ingredientToDelete) return;

    try {
      const { error } = await supabase
        .from('inventory_ingredients')
        .delete()
        .eq('id', ingredientToDelete.id);

      if (error) throw error;

      await logActivity({
        actionType: 'delete',
        entityType: 'inventory',
        entityId: ingredientToDelete.id,
        entityName: ingredientToDelete.name,
        description: `Ingrediente "${ingredientToDelete.name}" removido`,
      });

      toast({ title: 'Ingrediente removido com sucesso' });
      setIngredientToDelete(null);
      setDeleteDialogOpen(false);
      loadIngredients();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover ingrediente',
        description:
          error.message ||
          'Verifique se não há ficha técnica usando este ingrediente.',
        variant: 'destructive',
      });
    }
  };

  const handleDeletePurchase = async (purchase: Purchase) => {
    try {
      const { error } = await supabase
        .from('inventory_purchases')
        .delete()
        .eq('id', purchase.id);

      if (error) throw error;

      await logActivity({
        actionType: 'delete',
        entityType: 'inventory',
        entityId: purchase.id,
        entityName: purchase.ingredient_name || 'Compra',
        description: `Compra de ${purchase.ingredient_name} removida`,
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

  if (loadingCompany) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Estoque</h1>
            <p className="text-muted-foreground">
              Controle de ingredientes e compras
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedIngredientForPurchase(null);
                setPurchaseModalOpen(true);
              }}
              disabled={ingredients.length === 0}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Nova Compra
            </Button>
            <Button
              onClick={() => {
                setEditingIngredient(null);
                setIngredientModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Ingrediente
            </Button>
          </div>
        </div>

        {/* Dashboard Stats */}
        <InventoryDashboard
          totalIngredients={ingredients.length}
          lowStockCount={lowStockIngredients.length}
          totalStockValue={totalStockValue}
          consumptionCost={consumptionCost}
        />

        {/* Tabs */}
        <Tabs defaultValue="ingredients" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
            <TabsTrigger value="ingredients" className="gap-2">
              <Package className="h-4 w-4" />
              Ingredientes
            </TabsTrigger>
            <TabsTrigger value="purchases" className="gap-2">
              <FileText className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ingredients" className="space-y-4 mt-4">
            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar ingrediente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Ingredients Grid */}
            {loadingIngredients ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">
                  Carregando ingredientes...
                </span>
              </div>
            ) : filteredIngredients.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">
                  {searchTerm
                    ? 'Nenhum ingrediente encontrado'
                    : 'Nenhum ingrediente cadastrado'}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm
                    ? 'Tente buscar com outros termos.'
                    : 'Comece cadastrando seus ingredientes.'}
                </p>
                {!searchTerm && (
                  <Button
                    className="mt-4"
                    onClick={() => {
                      setEditingIngredient(null);
                      setIngredientModalOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Cadastrar ingrediente
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredIngredients.map((ingredient) => (
                  <IngredientCard
                    key={ingredient.id}
                    ingredient={ingredient}
                    units={ingredientUnits[ingredient.id] || []}
                    onEdit={(ing) => {
                      setEditingIngredient(ing);
                      setIngredientModalOpen(true);
                    }}
                    onDelete={(ing) => {
                      setIngredientToDelete(ing);
                      setDeleteDialogOpen(true);
                    }}
                    onAddPurchase={(ing) => {
                      setSelectedIngredientForPurchase(ing);
                      setPurchaseModalOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="purchases" className="mt-4">
            <PurchaseHistoryTable
              purchases={purchases}
              loading={loadingPurchases}
              onDelete={handleDeletePurchase}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <IngredientFormModal
        open={ingredientModalOpen}
        onOpenChange={setIngredientModalOpen}
        ingredient={editingIngredient}
        existingUnits={editingIngredient ? ingredientUnits[editingIngredient.id] || [] : []}
        onSave={handleSaveIngredient}
      />

      <PurchaseFormModal
        open={purchaseModalOpen}
        onOpenChange={setPurchaseModalOpen}
        ingredients={ingredients}
        ingredientUnits={ingredientUnits}
        selectedIngredient={selectedIngredientForPurchase}
        onSave={handleSavePurchase}
      />

      <DeleteIngredientDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        ingredient={ingredientToDelete}
        onConfirm={handleDeleteIngredient}
      />
    </DashboardLayout>
  );
}
