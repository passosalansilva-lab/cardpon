import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PremiumBadge } from '@/components/layout/PremiumBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Filter, Activity, Package, ShoppingCart, Users, Tag, TrendingUp } from 'lucide-react';

interface ActivityLog {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  description: string;
  old_data: any;
  new_data: any;
  created_at: string;
  user_agent: string | null;
  user_id: string;
}

const actionTypeColors: Record<string, string> = {
  create: 'bg-green-500/10 text-green-700 border-green-500/20',
  update: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  delete: 'bg-red-500/10 text-red-700 border-red-500/20',
  status_change: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
  assign: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  other: 'bg-gray-500/10 text-gray-700 border-gray-500/20',
};

const actionTypeLabels: Record<string, string> = {
  create: 'Criação',
  update: 'Atualização',
  delete: 'Exclusão',
  status_change: 'Mudança de Status',
  assign: 'Atribuição',
  other: 'Outro',
};

const entityTypeIcons: Record<string, any> = {
  order: ShoppingCart,
  product: Package,
  category: Tag,
  driver: Users,
  coupon: Tag,
  promotion: TrendingUp,
  inventory: Package,
  other: Activity,
};

const entityTypeLabels: Record<string, string> = {
  order: 'Pedido',
  product: 'Produto',
  category: 'Categoria',
  driver: 'Entregador',
  coupon: 'Cupom',
  promotion: 'Promoção',
  inventory: 'Estoque',
  company: 'Empresa',
  other: 'Outro',
};

const fieldLabels: Record<string, string> = {
  status: 'Status do pedido',
  cancellation_reason: 'Motivo do cancelamento',
  customer_name: 'Nome do cliente',
  customer_phone: 'Telefone do cliente',
  payment_method: 'Forma de pagamento',
  payment_status: 'Status do pagamento',
  total: 'Total do pedido',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  ready: 'Pronto',
  awaiting_driver: 'Aguardando entregador',
  out_for_delivery: 'Saiu para entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

const formatFieldValue = (key: string, value: any): string => {
  if (value === null || value === undefined) return '—';

  if (key === 'status' && typeof value === 'string') {
    return statusLabels[value] || value;
  }

  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') return value.toString();

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const renderDataDiff = (oldData: any, newData: any) => {
  if (!oldData && !newData) return null;

  const oldObj = (oldData && typeof oldData === 'object') ? oldData : {};
  const newObj = (newData && typeof newData === 'object') ? newData : {};

  const keys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));

  if (keys.length === 0) return null;

  return (
    <div className="space-y-3">
      {keys.map((key) => {
        const previous = oldObj[key];
        const current = newObj[key];

        return (
          <div key={key} className="text-xs border-b last:border-b-0 border-border/40 pb-2 last:pb-0">
            <p className="font-semibold">
              {fieldLabels[key] || key}
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium">Anterior:</span> {formatFieldValue(key, previous)}
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium">Novo:</span> {formatFieldValue(key, current)}
            </p>
          </div>
        );
      })}
    </div>
  );
};

type ActorType = 'owner' | 'employee' | 'system';

const actorTypeLabels: Record<ActorType, string> = {
  owner: 'Lojista',
  employee: 'Funcionário',
  system: 'Sistema',
};

const actorTypeStyles: Record<ActorType, string> = {
  owner: 'border-primary/40 text-primary',
  employee: 'border-foreground/20 text-foreground/80',
  system: 'border-muted-foreground/40 text-muted-foreground',
};

const getActorType = (log: ActivityLog, ownerId: string | null): ActorType => {
  if (!log.user_agent) return 'system';
  if (ownerId && log.user_id === ownerId) return 'owner';
  return 'employee';
};

export default function ActivityLogs() {
  const { user, staffCompany, hasRole } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActionType, setFilterActionType] = useState<string>('all');
  const [filterEntityType, setFilterEntityType] = useState<string>('all');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [userNamesMap, setUserNamesMap] = useState<Record<string, string>>({});

  // Only store owners can see activity logs, not staff
  const isStaff = hasRole('store_staff') && !!staffCompany?.companyId;

  useEffect(() => {
    if (!isStaff) {
      loadLogs();
    } else {
      setLoading(false);
    }
  }, [user, isStaff]);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, filterActionType, filterEntityType]);

  const loadLogs = async () => {
    if (!user) return;

    try {
      setLoading(true);

      let companyId: string | null = null;
      let fetchedOwnerId: string | null = null;

      if (staffCompany?.companyId) {
        companyId = staffCompany.companyId;
        // Get owner_id from company
        const { data: companyData } = await supabase
          .from('companies')
          .select('owner_id')
          .eq('id', companyId)
          .single();
        fetchedOwnerId = companyData?.owner_id ?? null;
      } else {
        const { data: companies } = await supabase
          .from('companies')
          .select('id, owner_id')
          .eq('owner_id', user.id)
          .limit(1)
          .single();

        if (!companies) {
          setLoading(false);
          return;
        }
        companyId = companies.id;
        fetchedOwnerId = companies.owner_id;
      }

      setOwnerId(fetchedOwnerId);

      if (fetchedOwnerId) {
        try {
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', fetchedOwnerId)
            .single();

          setOwnerName(ownerProfile?.full_name ?? null);
        } catch (profileError) {
          console.error('Error loading owner profile:', profileError);
        }
      }

      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      setLogs(data || []);

      // Fetch names for all unique user_ids in logs
      const uniqueUserIds = Array.from(new Set((data || []).map((l) => l.user_id)));
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', uniqueUserIds);

        const namesMap: Record<string, string> = {};
        (profiles || []).forEach((p) => {
          if (p.full_name) namesMap[p.id] = p.full_name;
        });
        setUserNamesMap(namesMap);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];

    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.entity_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterActionType !== 'all') {
      filtered = filtered.filter((log) => log.action_type === filterActionType);
    }

    if (filterEntityType !== 'all') {
      filtered = filtered.filter((log) => log.entity_type === filterEntityType);
    }

    setFilteredLogs(filtered);
  };

  // Staff cannot see logs
  if (isStaff) {
    return (
      <DashboardLayout>
        <div className="container mx-auto py-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-medium mb-2">Acesso restrito</h2>
              <p className="text-muted-foreground">
                Apenas o lojista principal pode visualizar os logs de atividade.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold">Logs de Atividade</h1>
            <p className="text-muted-foreground">
              Histórico completo de todas as ações realizadas no sistema
            </p>
          </div>
          <PremiumBadge featureKey="activity_logs" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <CardDescription>Filtre os logs por tipo de ação ou entidade</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar nos logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={filterActionType} onValueChange={setFilterActionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="create">Criação</SelectItem>
                  <SelectItem value="update">Atualização</SelectItem>
                  <SelectItem value="delete">Exclusão</SelectItem>
                  <SelectItem value="status_change">Mudança de Status</SelectItem>
                  <SelectItem value="assign">Atribuição</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterEntityType} onValueChange={setFilterEntityType}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de entidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as entidades</SelectItem>
                  <SelectItem value="order">Pedidos</SelectItem>
                  <SelectItem value="product">Produtos</SelectItem>
                  <SelectItem value="category">Categorias</SelectItem>
                  <SelectItem value="driver">Entregadores</SelectItem>
                  <SelectItem value="coupon">Cupons</SelectItem>
                  <SelectItem value="promotion">Promoções</SelectItem>
                  <SelectItem value="inventory">Estoque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Atividades Recentes
              </span>
              <Badge variant="secondary">{filteredLogs.length} registros</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando logs...</div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum log encontrado com os filtros selecionados.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredLogs.map((log, index) => {
                    const EntityIcon = entityTypeIcons[log.entity_type] || Activity;
                    const actorType = getActorType(log, ownerId);
                    const actorLabel = actorTypeLabels[actorType];
                    const actorStyle = actorTypeStyles[actorType];
                    
                    return (
                      <div key={log.id}>
                        <div className="flex gap-4 py-3">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <EntityIcon className="h-5 w-5 text-primary" />
                            </div>
                          </div>
                          
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge
                                    variant="outline"
                                    className={actionTypeColors[log.action_type] || ''}
                                  >
                                    {actionTypeLabels[log.action_type] || log.action_type}
                                  </Badge>
                                  <Badge variant="secondary">
                                    {entityTypeLabels[log.entity_type] || log.entity_type}
                                  </Badge>
                                  <Badge variant="outline" className={actorStyle}>
                                    {actorLabel}
                                  </Badge>
                                  {log.entity_name && (
                                    <span className="text-sm font-medium text-foreground">
                                      {log.entity_name}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-foreground">{log.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(log.created_at), "dd 'de' MMM 'às' HH:mm", {
                                    locale: ptBR,
                                  })}
                                </p>
                                {/* Show who performed the action */}
                                {(() => {
                                  const displayName = userNamesMap[log.user_id] || null;
                                  const roleLabel = actorType === 'owner' ? 'Lojista' : actorType === 'employee' ? 'Funcionário' : 'Sistema';
                                  if (displayName) {
                                    return (
                                      <p className="text-xs text-muted-foreground">
                                        Realizado por: <span className="font-medium">{displayName}</span> ({roleLabel})
                                      </p>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>

                            {(log.old_data || log.new_data) && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                  Ver detalhes da alteração
                                </summary>
                                <div className="mt-2 p-3 bg-muted rounded-md space-y-2">
                                  {renderDataDiff(log.old_data, log.new_data)}
                                </div>
                              </details>
                            )}
                          </div>
                        </div>
                        {index < filteredLogs.length - 1 && <Separator />}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
