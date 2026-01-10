import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Ticket,
  Plus,
  Trash2,
  Loader2,
  Percent,
  DollarSign,
  Calendar,
  Copy,
  Check,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useActivityLog } from '@/hooks/useActivityLog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const couponSchema = z.object({
  code: z.string().min(3, 'Mínimo 3 caracteres').max(20).toUpperCase(),
  description: z.string().max(200).optional(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.coerce.number().min(0.01, 'Valor deve ser maior que 0'),
  minOrderValue: z.coerce.number().min(0).default(0),
  maxUses: z.coerce.number().min(0).optional(),
  expiresAt: z.string().optional(),
});

type CouponFormData = z.infer<typeof couponSchema>;

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_order_value: number;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export default function CouponsManagement() {
  const { user, staffCompany } = useAuth();
  const { logActivity } = useActivityLog();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<CouponFormData>({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      discountType: 'percentage',
      minOrderValue: 0,
    },
  });

  const discountType = watch('discountType');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const companyQuery = staffCompany?.companyId
        ? supabase.from('companies').select('id').eq('id', staffCompany.companyId).maybeSingle()
        : supabase.from('companies').select('id').eq('owner_id', user.id).maybeSingle();

      const { data: company } = await companyQuery;

      if (!company) {
        setLoading(false);
        return;
      }

      setCompanyId(company.id);

      const { data: couponsData, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoupons(couponsData || []);
    } catch (error: any) {
      console.error('Error loading coupons:', error);
      toast.error('Erro ao carregar cupons');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: CouponFormData) => {
    if (!companyId) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('coupons').insert({
        company_id: companyId,
        code: data.code.toUpperCase(),
        description: data.description || null,
        discount_type: data.discountType,
        discount_value: data.discountValue,
        min_order_value: data.minOrderValue,
        max_uses: data.maxUses || null,
        expires_at: data.expiresAt || null,
      });

      if (error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          toast.error('Este código já existe');
          return;
        }
        throw error;
      }

      // Log activity
      logActivity({
        actionType: 'create',
        entityType: 'coupon',
        entityName: data.code,
        description: `Cupom "${data.code}" criado`,
        newData: {
          code: data.code,
          discount_type: data.discountType,
          discount_value: data.discountValue,
          min_order_value: data.minOrderValue,
        },
      });

      toast.success('Cupom criado com sucesso!');
      setDialogOpen(false);
      reset();
      loadData();
    } catch (error: any) {
      console.error('Error creating coupon:', error);
      toast.error('Erro ao criar cupom');
    } finally {
      setSaving(false);
    }
  };

  const toggleCoupon = async (id: string, isActive: boolean, couponCode: string) => {
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      logActivity({
        actionType: 'update',
        entityType: 'coupon',
        entityId: id,
        entityName: couponCode,
        description: isActive ? `Cupom "${couponCode}" desativado` : `Cupom "${couponCode}" ativado`,
        oldData: { is_active: isActive },
        newData: { is_active: !isActive },
      });

      loadData();
      toast.success(isActive ? 'Cupom desativado' : 'Cupom ativado');
    } catch (error: any) {
      toast.error('Erro ao atualizar cupom');
    }
  };

  const deleteCoupon = async (id: string, couponCode: string) => {
    if (!confirm('Tem certeza que deseja excluir este cupom?')) return;

    try {
      const { error } = await supabase.from('coupons').delete().eq('id', id);
      if (error) throw error;

      logActivity({
        actionType: 'delete',
        entityType: 'coupon',
        entityId: id,
        entityName: couponCode,
        description: `Cupom "${couponCode}" excluído`,
      });

      loadData();
      toast.success('Cupom excluído');
    } catch (error: any) {
      toast.error('Erro ao excluir cupom');
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Código copiado!');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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

  if (!companyId) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Configure sua loja primeiro</h2>
          <p className="text-muted-foreground">
            Você precisa cadastrar sua loja antes de criar cupons
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display">Cupons de Desconto</h1>
            <p className="text-muted-foreground">
              Crie e gerencie cupons promocionais
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" />
                Novo Cupom
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Cupom</DialogTitle>
                <DialogDescription>
                  Preencha os dados do novo cupom de desconto
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Código do Cupom *</Label>
                  <Input
                    id="code"
                    placeholder="EX: PROMO10"
                    className="uppercase"
                    {...register('code')}
                  />
                  {errors.code && (
                    <p className="text-sm text-destructive">{errors.code.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    placeholder="10% de desconto na primeira compra"
                    {...register('description')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Desconto</Label>
                    <Select
                      value={discountType}
                      onValueChange={(value: 'percentage' | 'fixed') =>
                        setValue('discountType', value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                        <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discountValue">
                      Valor {discountType === 'percentage' ? '(%)' : ''}
                    </Label>
                    {discountType === 'fixed' ? (
                      <CurrencyInput
                        id="discountValue"
                        value={watch('discountValue') || ''}
                        onChange={(value) => setValue('discountValue', parseFloat(value) || 0)}
                        placeholder="0,00"
                      />
                    ) : (
                      <Input
                        id="discountValue"
                        type="number"
                        step="1"
                        placeholder="10"
                        {...register('discountValue')}
                      />
                    )}
                    {errors.discountValue && (
                      <p className="text-sm text-destructive">{errors.discountValue.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minOrderValue">Pedido Mínimo</Label>
                    <CurrencyInput
                      id="minOrderValue"
                      value={watch('minOrderValue') || 0}
                      onChange={(value) => setValue('minOrderValue', parseFloat(value) || 0)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxUses">Limite de Usos</Label>
                    <Input
                      id="maxUses"
                      type="number"
                      placeholder="Ilimitado"
                      {...register('maxUses')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Data de Expiração</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    {...register('expiresAt')}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Criar Cupom
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Coupons List */}
        {coupons.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Nenhum cupom criado</h3>
              <p className="text-muted-foreground mb-4">
                Crie cupons promocionais para atrair mais clientes
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {coupons.map((coupon) => {
              const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
              const isMaxedOut = coupon.max_uses && coupon.current_uses >= coupon.max_uses;

              return (
                <Card key={coupon.id} className={!coupon.is_active || isExpired || isMaxedOut ? 'opacity-60' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 font-mono font-bold text-lg"
                          onClick={() => copyCode(coupon.code, coupon.id)}
                        >
                          {coupon.code}
                          {copiedId === coupon.id ? (
                            <Check className="h-4 w-4 ml-2 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4 ml-2" />
                          )}
                        </Button>
                      </div>
                      <Switch
                        checked={coupon.is_active}
                        onCheckedChange={() => toggleCoupon(coupon.id, coupon.is_active, coupon.code)}
                      />
                    </div>
                    {coupon.description && (
                      <CardDescription>{coupon.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      {coupon.discount_type === 'percentage' ? (
                        <Badge variant="secondary" className="gap-1">
                          <Percent className="h-3 w-3" />
                          {coupon.discount_value}% OFF
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(coupon.discount_value)} OFF
                        </Badge>
                      )}
                      {isExpired && <Badge variant="destructive">Expirado</Badge>}
                      {isMaxedOut && <Badge variant="outline">Esgotado</Badge>}
                    </div>

                    <div className="text-sm text-muted-foreground space-y-1">
                      {coupon.min_order_value > 0 && (
                        <p>Pedido mínimo: {formatCurrency(coupon.min_order_value)}</p>
                      )}
                      <p>
                        Usos: {coupon.current_uses}
                        {coupon.max_uses && ` / ${coupon.max_uses}`}
                      </p>
                      {coupon.expires_at && (
                        <p className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Expira: {format(new Date(coupon.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteCoupon(coupon.id, coupon.code)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
