import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Pizza, Settings2, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePizzaConfig } from '@/hooks/usePizzaConfig';
import { supabase } from '@/integrations/supabase/client';
import { CurrencyInput } from '@/components/ui/currency-input';

interface PizzaConfigWizardProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  companyId: string | null;
  onOpenOptionsEditor?: () => void;
}

interface OptionGroupSummary {
  id: string;
  name: string;
  description: string | null;
  extra_unit_price?: number | string | null;
}

export function PizzaConfigWizard({
  open,
  onClose,
  productId,
  productName,
  companyId,
  onOpenOptionsEditor,
}: PizzaConfigWizardProps) {
  const { toast } = useToast();
  const { settings: companyPizzaSettings } = usePizzaConfig(companyId);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [globalCrustGroups, setGlobalCrustGroups] = useState<OptionGroupSummary[]>([]);
  const [globalAddonGroups, setGlobalAddonGroups] = useState<OptionGroupSummary[]>([]);

  const [selectedGlobalCrustIds, setSelectedGlobalCrustIds] = useState<Set<string>>(new Set());
  const [selectedGlobalAddonIds, setSelectedGlobalAddonIds] = useState<Set<string>>(new Set());

  const [allowHalfHalf, setAllowHalfHalf] = useState<boolean | null>(null);
  const [maxFlavors, setMaxFlavors] = useState<number | null>(null);
  const [pricingRule, setPricingRule] = useState<string>('highest_flavor');
  const [discountPercentage, setDiscountPercentage] = useState<string>('0');
  const [allowCrustExtraPriceOverride, setAllowCrustExtraPriceOverride] = useState<boolean | null>(
    null,
  );

  useEffect(() => {
    if (open && productId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId]);

  const loadData = async () => {
    if (!productId) return;

    try {
      setLoading(true);

      const [linksResult, crustResult, addonResult, pizzaSettingsResult] = await Promise.all([
        supabase
          .from('product_option_group_links')
          .select('group_id, linked_type')
          .eq('product_id', productId),
        supabase
          .from('product_option_groups')
          .select('id, name, description, extra_unit_price')
          .eq('scope', 'global')
          .eq('kind', 'crust')
          .order('name'),
        supabase
          .from('product_option_groups')
          .select('id, name, description')
          .eq('scope', 'global')
          .eq('kind', 'addon')
          .order('name'),
        supabase
          .from('pizza_product_settings')
          .select('*')
          .eq('product_id', productId)
          .maybeSingle(),
      ]);

      const linksError = linksResult.error;
      const crustError = crustResult.error;
      const addonError = addonResult.error;
      const pizzaSettingsError = pizzaSettingsResult.error;

      if (linksError) throw linksError;
      if (crustError) throw crustError;
      if (addonError) throw addonError;
      if (pizzaSettingsError && pizzaSettingsError.code !== 'PGRST116') throw pizzaSettingsError;

      const links = linksResult.data || [];

      setSelectedGlobalCrustIds(
        new Set(
          links
            .filter((l) => l.linked_type === 'global_crust')
            .map((l) => l.group_id as string),
        ),
      );
      setSelectedGlobalAddonIds(
        new Set(
          links
            .filter((l) => l.linked_type === 'global_addon')
            .map((l) => l.group_id as string),
        ),
      );

      setGlobalCrustGroups((crustResult.data as OptionGroupSummary[]) || []);
      setGlobalAddonGroups((addonResult.data as OptionGroupSummary[]) || []);

      const pizzaSettings = pizzaSettingsResult.data as
        | {
            allow_half_half: boolean | null;
            max_flavors: number | null;
            half_half_pricing_rule: string | null;
            half_half_discount_percentage: number | null;
            allow_crust_extra_price_override: boolean | null;
          }
        | null;

      const defaultAllowHalfHalf = companyPizzaSettings?.enable_half_half ?? true;
      const defaultMaxFlavors = companyPizzaSettings?.max_flavors ?? 2;
      const defaultAllowCrustExtraPrice = companyPizzaSettings?.allow_crust_extra_price ?? true;

      setAllowHalfHalf(pizzaSettings?.allow_half_half ?? defaultAllowHalfHalf);
      setMaxFlavors(pizzaSettings?.max_flavors ?? defaultMaxFlavors);
      setPricingRule(pizzaSettings?.half_half_pricing_rule || 'highest_flavor');
      setDiscountPercentage(
        pizzaSettings?.half_half_discount_percentage != null
          ? String(pizzaSettings.half_half_discount_percentage)
          : '0',
      );
      setAllowCrustExtraPriceOverride(
        pizzaSettings?.allow_crust_extra_price_override ?? defaultAllowCrustExtraPrice,
      );
    } catch (error: any) {
      console.error('Erro ao carregar configuração de pizza:', error);
      toast({
        title: 'Erro ao carregar configuração',
        description: error.message || 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleGlobalLink = async (
    groupId: string,
    kind: 'crust' | 'addon',
    checked: boolean,
  ) => {
    try {
      if (checked) {
        const linkedType = kind === 'crust' ? 'global_crust' : 'global_addon';
        const { error } = await supabase.from('product_option_group_links').insert({
          product_id: productId,
          group_id: groupId,
          linked_type: linkedType,
        });
        if (error) throw error;

        if (kind === 'crust') {
          setSelectedGlobalCrustIds((prev) => new Set(prev).add(groupId));
        } else {
          setSelectedGlobalAddonIds((prev) => new Set(prev).add(groupId));
        }
      } else {
        const linkedType = kind === 'crust' ? 'global_crust' : 'global_addon';
        const { error } = await supabase
          .from('product_option_group_links')
          .delete()
          .eq('product_id', productId)
          .eq('group_id', groupId)
          .eq('linked_type', linkedType);
        if (error) throw error;

        if (kind === 'crust') {
          setSelectedGlobalCrustIds((prev) => {
            const next = new Set(prev);
            next.delete(groupId);
            return next;
          });
        } else {
          setSelectedGlobalAddonIds((prev) => {
            const next = new Set(prev);
            next.delete(groupId);
            return next;
          });
        }
      }
    } catch (error: any) {
      console.error('Erro ao atualizar vínculo de grupo global:', error);
      toast({
        title: 'Erro ao atualizar grupos globais',
        description: error.message || 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveSettings = async () => {
    if (!productId) return;

    setSaving(true);
    try {
      const { data: existing, error: existingError } = await supabase
        .from('pizza_product_settings')
        .select('*')
        .eq('product_id', productId)
        .maybeSingle();

      if (existingError && existingError.code !== 'PGRST116') throw existingError;

      const payload = {
        product_id: productId,
        allow_half_half: allowHalfHalf ?? true,
        max_flavors: maxFlavors ?? 2,
        half_half_pricing_rule: pricingRule,
        half_half_discount_percentage: parseFloat(discountPercentage) || 0,
        allow_crust_extra_price_override: allowCrustExtraPriceOverride ?? true,
      };

      if (existing) {
        const { error } = await supabase
          .from('pizza_product_settings')
          .update(payload)
          .eq('id', (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pizza_product_settings').insert(payload);
        if (error) throw error;
      }

      toast({ title: 'Configuração de pizza salva com sucesso.' });
      onClose();
    } catch (error: any) {
      console.error('Erro ao salvar configuração de pizza:', error);
      toast({
        title: 'Erro ao salvar configuração',
        description: error.message || 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pizza className="h-5 w-5 text-primary" />
            Configurar pizza: {productName}
          </DialogTitle>
          <DialogDescription>
            Defina grupos globais, grupos próprios e regras de meio a meio para esta pizza.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="crust" className="mt-2">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="crust">Bordas</TabsTrigger>
              <TabsTrigger value="addons">Adicionais</TabsTrigger>
              <TabsTrigger value="halfhalf">Meio a meio</TabsTrigger>
            </TabsList>

            <TabsContent value="crust" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Bordas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {globalCrustGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma borda cadastrada ainda.
                    </p>
                  ) : (
                    <div className="w-full border rounded-md overflow-hidden">
                      <div className="grid grid-cols-[auto_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.4fr)] items-center gap-2 px-4 py-2 bg-muted text-xs font-medium text-muted-foreground">
                        <span></span>
                        <span>Borda</span>
                        <span>Preço extra padrão</span>
                        <span className="text-right">Status de vendas</span>
                      </div>
                      <div className="divide-y">
                        {globalCrustGroups.map((group) => {
                          const isActive = selectedGlobalCrustIds.has(group.id);
                          return (
                            <div
                              key={group.id}
                              className="grid grid-cols-[auto_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.4fr)] items-center gap-3 px-4 py-3"
                            >
                              <GripVertical className="h-3 w-3 text-muted-foreground" />
                              <div className="space-y-1">
                                <Input
                                  value={group.name}
                                  readOnly
                                  className="h-9 text-sm"
                                />
                                {group.description && (
                                  <p className="text-[11px] text-muted-foreground">
                                    {group.description}
                                  </p>
                                )}
                              </div>
                              <div className="max-w-[140px]">
                                <CurrencyInput
                                  value={Number(group.extra_unit_price ?? 0)}
                                  onChange={async (value) => {
                                    const numericValue =
                                      typeof value === 'number'
                                        ? value
                                        : parseFloat((value as string) || '0');

                                    const { error } = await supabase
                                      .from('product_option_groups')
                                      .update({ extra_unit_price: numericValue })
                                      .eq('id', group.id);
                                    if (error) {
                                      console.error('Erro ao atualizar preço de borda:', error);
                                      toast({
                                        title: 'Erro ao atualizar preço',
                                        description:
                                          error.message || 'Tente novamente mais tarde.',
                                        variant: 'destructive',
                                      });
                                    } else {
                                      setGlobalCrustGroups((prev) =>
                                        prev.map((g) =>
                                          g.id === group.id
                                            ? { ...g, extra_unit_price: numericValue }
                                            : g,
                                        ),
                                      );
                                    }
                                  }}
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant={isActive ? 'outline' : 'default'}
                                  size="sm"
                                  onClick={() =>
                                    isActive
                                      ? toggleGlobalLink(group.id, 'crust', false)
                                      : toggleGlobalLink(group.id, 'crust', true)
                                  }
                                >
                                  {isActive ? 'Ativado' : 'Pausado'}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Grupos próprios de borda
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Use o editor completo de opções para criar grupos exclusivos desta
                    pizza, como tipos de borda especiais.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onOpenOptionsEditor}
                  >
                    Abrir editor de opções completas
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="addons" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Grupos globais de adicionais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {globalAddonGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum grupo global de adicionais cadastrado ainda.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {globalAddonGroups.map((group) => (
                        <label
                          key={group.id}
                          className="flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer hover:bg-accent/40"
                        >
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">{group.name}</p>
                            {group.description && (
                              <p className="text-xs text-muted-foreground">
                                {group.description}
                              </p>
                            )}
                          </div>
                          <Switch
                            checked={selectedGlobalAddonIds.has(group.id)}
                            onCheckedChange={(checked) =>
                              toggleGlobalLink(group.id, 'addon', checked)
                            }
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Grupos próprios de adicionais
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Use o editor completo de opções para criar adicionais exclusivos desta pizza.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onOpenOptionsEditor}
                  >
                    Abrir editor de opções completas
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="halfhalf" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Regras de meio a meio</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Permitir meio a meio</p>
                      <p className="text-xs text-muted-foreground">
                        Se ativado, o cliente poderá combinar sabores nesta pizza.
                      </p>
                    </div>
                    <Switch
                      checked={!!allowHalfHalf}
                      onCheckedChange={(checked) => setAllowHalfHalf(checked)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Máximo de sabores</Label>
                      <Input
                        type="number"
                        min={2}
                        value={maxFlavors ?? ''}
                        onChange={(e) =>
                          setMaxFlavors(e.target.value ? parseInt(e.target.value, 10) : null)
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Regra de preço</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={pricingRule === 'highest_flavor' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPricingRule('highest_flavor')}
                        >
                          Maior sabor
                        </Button>
                        <Button
                          type="button"
                          variant={pricingRule === 'average_flavor' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPricingRule('average_flavor')}
                        >
                          Média dos sabores
                        </Button>
                        <Button
                          type="button"
                          variant={pricingRule === 'sum_with_discount' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPricingRule('sum_with_discount')}
                        >
                          Soma com desconto
                        </Button>
                      </div>
                    </div>
                  </div>

                  {pricingRule === 'sum_with_discount' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Desconto (%) sobre a soma</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={discountPercentage}
                        onChange={(e) => setDiscountPercentage(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Permitir preço extra de borda</p>
                      <p className="text-xs text-muted-foreground">
                        Se desativado, o preço da borda não será somado no cálculo.
                      </p>
                    </div>
                    <Switch
                      checked={!!allowCrustExtraPriceOverride}
                      onCheckedChange={(checked) => setAllowCrustExtraPriceOverride(checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Wizard de pizza</Badge>
            <span>Você pode ajustar essas regras a qualquer momento.</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar configuração
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
