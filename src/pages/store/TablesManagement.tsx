import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Loader2,
  Users,
  Clock,
  Receipt,
  MoreVertical,
  Edit,
  Trash2,
  ArrowRightLeft,
  UserPlus,
  Grid3X3,
  List,
  QrCode,
  Utensils,
  DollarSign,
  CheckCircle2,
  Timer,
  Sparkles,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FeatureGate } from '@/components/layout/FeatureGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TableSessionModal } from '@/components/tables/TableSessionModal';
import { TableQRCodeModal } from '@/components/tables/TableQRCodeModal';
import { SessionQRCodeModal } from '@/components/tables/SessionQRCodeModal';
import { WaiterCallsPanel } from '@/components/tables/WaiterCallsPanel';
import { motion } from 'framer-motion';

interface Table {
  id: string;
  table_number: number;
  name: string | null;
  capacity: number;
  status: string;
  is_active: boolean;
}

interface TableSession {
  id: string;
  table_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_count: number;
  opened_at: string;
  status: string;
  notes: string | null;
  session_token: string | null;
}

interface Order {
  id: string;
  total: number;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: typeof CheckCircle2; gradient: string }> = {
  available: { 
    label: 'Disponível', 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bgColor: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800/50',
    icon: CheckCircle2,
    gradient: 'from-emerald-500 to-emerald-600'
  },
  occupied: { 
    label: 'Ocupada', 
    color: 'text-amber-600 dark:text-amber-400', 
    bgColor: 'bg-gradient-to-br from-amber-50 to-orange-100/50 dark:from-amber-950/40 dark:to-orange-900/20 border-amber-200 dark:border-amber-800/50',
    icon: Utensils,
    gradient: 'from-amber-500 to-orange-500'
  },
  reserved: { 
    label: 'Reservada', 
    color: 'text-blue-600 dark:text-blue-400', 
    bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-100/50 dark:from-blue-950/40 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800/50',
    icon: Clock,
    gradient: 'from-blue-500 to-indigo-500'
  },
  cleaning: { 
    label: 'Limpeza', 
    color: 'text-purple-600 dark:text-purple-400', 
    bgColor: 'bg-gradient-to-br from-purple-50 to-fuchsia-100/50 dark:from-purple-950/40 dark:to-fuchsia-900/20 border-purple-200 dark:border-purple-800/50',
    icon: Sparkles,
    gradient: 'from-purple-500 to-fuchsia-500'
  },
};

export default function TablesManagement() {
  const navigate = useNavigate();
  const { user, staffCompany } = useAuth();
  const { toast } = useToast();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companySlug, setCompanySlug] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<Table[]>([]);
  const [sessions, setSessions] = useState<TableSession[]>([]);
  const [sessionOrders, setSessionOrders] = useState<Record<string, Order[]>>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [qrCodeModalOpen, setQrCodeModalOpen] = useState(false);
  const [sessionQrModalOpen, setSessionQrModalOpen] = useState(false);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [openTableDialogOpen, setOpenTableDialogOpen] = useState(false);
  const [closeTableDialogOpen, setCloseTableDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedSession, setSelectedSession] = useState<TableSession | null>(null);

  // Form states
  const [newTable, setNewTable] = useState({ table_number: '', name: '', capacity: '4' });
  const [openTableData, setOpenTableData] = useState({ customer_name: '', customer_count: '1', notes: '' });
  const [transferTarget, setTransferTarget] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [user, staffCompany]);

  // Realtime subscription for table sessions and orders
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('tables-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_sessions',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          console.log('Table session changed:', payload);
          loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          console.log('Order changed:', payload);
          // Reload data when orders change (including cancellations)
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get company
      const companyQuery = staffCompany?.companyId
        ? supabase.from('companies').select('id, slug, name').eq('id', staffCompany.companyId).maybeSingle()
        : supabase.from('companies').select('id, slug, name').eq('owner_id', user.id).maybeSingle();

      const { data: company, error: companyError } = await companyQuery;
      if (companyError) throw companyError;
      if (!company) {
        toast({ title: 'Empresa não encontrada', variant: 'destructive' });
        return;
      }

      setCompanyId(company.id);
      setCompanySlug(company.slug);
      setCompanyName(company.name);
      // Load tables
      const { data: tablesData, error: tablesError } = await supabase
        .from('tables')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('table_number');

      if (tablesError) throw tablesError;
      setTables(tablesData || []);

      // Load open sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('table_sessions')
        .select('*')
        .eq('company_id', company.id)
        .eq('status', 'open');

      if (sessionsError) throw sessionsError;
      setSessions(sessionsData || []);

      // Load orders for each session
      if (sessionsData && sessionsData.length > 0) {
        const sessionIds = sessionsData.map(s => s.id);
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('id, total, status, created_at, table_session_id')
          .in('table_session_id', sessionIds)
          .neq('status', 'cancelled');

        if (!ordersError && ordersData) {
          const ordersBySession: Record<string, Order[]> = {};
          ordersData.forEach(order => {
            if (order.table_session_id) {
              if (!ordersBySession[order.table_session_id]) {
                ordersBySession[order.table_session_id] = [];
              }
              ordersBySession[order.table_session_id].push(order);
            }
          });
          setSessionOrders(ordersBySession);
        }
      }
    } catch (error: any) {
      console.error('Error loading tables:', error);
      toast({ title: 'Erro ao carregar mesas', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getSessionForTable = (tableId: string) => sessions.find(s => s.table_id === tableId);

  const getSessionTotal = (sessionId: string) => {
    const orders = sessionOrders[sessionId] || [];
    return orders.reduce((sum, o) => sum + o.total, 0);
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Check if session is running long (more than 2 hours)
  const isSessionLong = (openedAt: string) => {
    const opened = new Date(openedAt);
    const now = new Date();
    const diffMs = now.getTime() - opened.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours >= 2;
  };

  // Format session duration in HH:MM
  const formatSessionDuration = (openedAt: string) => {
    const opened = new Date(openedAt);
    const now = new Date();
    const diffMs = now.getTime() - opened.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes.toString().padStart(2, '0')}min`;
  };

  // Create table
  const handleCreateTable = async () => {
    if (!companyId) return;
    if (!newTable.table_number) {
      toast({ title: 'Informe o número da mesa', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.from('tables').insert({
        company_id: companyId,
        table_number: parseInt(newTable.table_number),
        name: newTable.name || null,
        capacity: parseInt(newTable.capacity) || 4,
      });

      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
          toast({ 
            title: 'Mesa já existe', 
            description: `Já existe uma mesa com o número ${newTable.table_number}. Por favor, escolha outro número.`, 
            variant: 'destructive' 
          });
          return;
        }
        throw error;
      }

      toast({ title: 'Mesa criada com sucesso!' });
      setCreateDialogOpen(false);
      setNewTable({ table_number: '', name: '', capacity: '4' });
      loadData();
    } catch (error: any) {
      toast({ title: 'Erro ao criar mesa', description: error.message, variant: 'destructive' });
    }
  };

  // Update table
  const handleUpdateTable = async () => {
    if (!selectedTable) return;

    try {
      const { error } = await supabase
        .from('tables')
        .update({
          table_number: parseInt(newTable.table_number),
          name: newTable.name || null,
          capacity: parseInt(newTable.capacity) || 4,
        })
        .eq('id', selectedTable.id);

      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
          toast({ 
            title: 'Mesa já existe', 
            description: `Já existe uma mesa com o número ${newTable.table_number}. Por favor, escolha outro número.`, 
            variant: 'destructive' 
          });
          return;
        }
        throw error;
      }

      toast({ title: 'Mesa atualizada!' });
      setEditDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar mesa', description: error.message, variant: 'destructive' });
    }
  };

  // Delete table
  const handleDeleteTable = async (table: Table) => {
    if (!confirm(`Deseja realmente excluir a mesa ${table.table_number}?`)) return;

    try {
      const { error } = await supabase
        .from('tables')
        .update({ is_active: false })
        .eq('id', table.id);

      if (error) throw error;

      toast({ title: 'Mesa removida!' });
      loadData();
    } catch (error: any) {
      toast({ title: 'Erro ao remover mesa', description: error.message, variant: 'destructive' });
    }
  };

  // Open table (create session with unique token)
  const handleOpenTable = async () => {
    if (!companyId || !selectedTable) return;

    try {
      // Generate a unique session token
      const generateToken = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let token = '';
        for (let i = 0; i < 12; i++) {
          token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token;
      };

      const sessionToken = generateToken();

      const { error } = await supabase.from('table_sessions').insert({
        company_id: companyId,
        table_id: selectedTable.id,
        customer_name: openTableData.customer_name || null,
        customer_count: parseInt(openTableData.customer_count) || 1,
        notes: openTableData.notes || null,
        session_token: sessionToken,
      });

      if (error) throw error;

      toast({ title: 'Mesa aberta!' });
      setOpenTableDialogOpen(false);
      setOpenTableData({ customer_name: '', customer_count: '1', notes: '' });
      loadData();
    } catch (error: any) {
      toast({ title: 'Erro ao abrir mesa', description: error.message, variant: 'destructive' });
    }
  };

  // Close table session
  const handleCloseTable = async () => {
    if (!selectedSession) return;

    try {
      const { error } = await supabase
        .from('table_sessions')
        .update({ status: 'closed', closed_at: new Date().toISOString() })
        .eq('id', selectedSession.id);

      if (error) throw error;

      // Cancel all pending waiter calls for this table
      await supabase
        .from('waiter_calls')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('table_id', selectedSession.table_id)
        .in('status', ['pending', 'acknowledged']);

      toast({ title: 'Mesa fechada!' });
      setCloseTableDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: 'Erro ao fechar mesa', description: error.message, variant: 'destructive' });
    }
  };

  // Transfer table
  const handleTransferTable = async () => {
    if (!selectedSession || !transferTarget) return;

    try {
      // Generate new token for transferred session
      const generateToken = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let token = '';
        for (let i = 0; i < 12; i++) {
          token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token;
      };

      // Close current session with transferred status
      await supabase
        .from('table_sessions')
        .update({ status: 'transferred', closed_at: new Date().toISOString() })
        .eq('id', selectedSession.id);

      // Create new session on target table with same data and new token
      const { data: newSession, error: newError } = await supabase
        .from('table_sessions')
        .insert({
          company_id: companyId,
          table_id: transferTarget,
          customer_name: selectedSession.customer_name,
          customer_count: selectedSession.customer_count,
          notes: `Transferido da mesa anterior. ${selectedSession.notes || ''}`.trim(),
          session_token: generateToken(),
        })
        .select('id')
        .single();

      if (newError) throw newError;

      // Update orders to new session
      const orders = sessionOrders[selectedSession.id] || [];
      if (orders.length > 0 && newSession) {
        await supabase
          .from('orders')
          .update({ table_session_id: newSession.id })
          .in('id', orders.map(o => o.id));
      }

      toast({ title: 'Mesa transferida!' });
      setTransferDialogOpen(false);
      setTransferTarget('');
      loadData();
    } catch (error: any) {
      toast({ title: 'Erro ao transferir mesa', description: error.message, variant: 'destructive' });
    }
  };

  // Clear orders from table session (cancel pending orders)
  const handleClearOrders = async (session: TableSession) => {
    if (!confirm('Deseja cancelar todos os pedidos desta mesa? Os pedidos serão marcados como cancelados.')) return;

    try {
      const orders = sessionOrders[session.id] || [];
      const pendingOrders = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
      
      if (pendingOrders.length === 0) {
        toast({ title: 'Não há pedidos para cancelar', variant: 'default' });
        return;
      }

      // Cancel all pending orders
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .in('id', pendingOrders.map(o => o.id));

      if (error) throw error;

      // Clear customer info from session
      await supabase
        .from('table_sessions')
        .update({ 
          customer_name: null, 
          customer_phone: null 
        })
        .eq('id', session.id);

      toast({ title: `${pendingOrders.length} pedido(s) cancelado(s)!` });
      loadData();
    } catch (error: any) {
      toast({ title: 'Erro ao limpar pedidos', description: error.message, variant: 'destructive' });
    }
  };

  // Click on table - open session modal if has session, otherwise open table dialog
  const handleTableClick = (table: Table) => {
    const session = getSessionForTable(table.id);
    if (session) {
      // Table already has session - open modal to view/add items
      setSelectedTable(table);
      setSelectedSession(session);
      setSessionModalOpen(true);
    } else {
      // No session - open table first
      setSelectedTable(table);
      setOpenTableDialogOpen(true);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const occupiedCount = tables.filter(t => t.status === 'occupied').length;
  const availableCount = tables.filter(t => t.status === 'available').length;
  const totalOpen = sessions.reduce((sum, s) => sum + getSessionTotal(s.id), 0);

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Mesas
            </h1>
            <p className="text-muted-foreground">Gerencie as mesas do seu estabelecimento</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-xl overflow-hidden bg-muted/30 p-0.5">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-lg"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-lg"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setQrCodeModalOpen(true)}
              disabled={tables.length === 0}
              className="rounded-xl"
            >
              <QrCode className="h-4 w-4 mr-2" />
              QR Codes
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)} className="rounded-xl shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4 mr-2" />
              Nova Mesa
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 shadow-lg">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-slate-200/50 to-transparent dark:from-slate-700/30 rounded-bl-[80px]" />
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-lg">
                    <Grid3X3 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold">{tables.length}</div>
                    <div className="text-sm text-muted-foreground font-medium">Total de mesas</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/50 dark:to-emerald-900/30 shadow-lg">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-emerald-200/50 to-transparent dark:from-emerald-700/30 rounded-bl-[80px]" />
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <CheckCircle2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{availableCount}</div>
                    <div className="text-sm text-muted-foreground font-medium">Disponíveis</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-50 to-orange-100/50 dark:from-amber-950/50 dark:to-orange-900/30 shadow-lg">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-amber-200/50 to-transparent dark:from-amber-700/30 rounded-bl-[80px]" />
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                    <Utensils className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{occupiedCount}</div>
                    <div className="text-sm text-muted-foreground font-medium">Ocupadas</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5 shadow-lg">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary/20 to-transparent rounded-bl-[80px]" />
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30">
                    <DollarSign className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary">{formatCurrency(totalOpen)}</div>
                    <div className="text-sm text-muted-foreground font-medium">Total em aberto</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Waiter Calls Panel */}
        {companyId && <WaiterCallsPanel companyId={companyId} />}

        {/* Tables grid/list */}
        {tables.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-2">
            <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mx-auto mb-6">
              <Grid3X3 className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Nenhuma mesa cadastrada</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Adicione mesas para começar a gerenciar seu salão e controlar os pedidos
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} size="lg" className="rounded-xl shadow-lg shadow-primary/20">
              <Plus className="h-5 w-5 mr-2" />
              Criar primeira mesa
            </Button>
          </Card>
        ) : (
          <div className={cn(
            viewMode === 'grid'
              ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
              : 'space-y-3'
          )}>
            {tables.map((table, index) => {
              const session = getSessionForTable(table.id);
              const total = session ? getSessionTotal(session.id) : 0;
              const orders = session ? sessionOrders[session.id] || [] : [];
              const config = statusConfig[table.status] || statusConfig.available;
              const StatusIcon = config.icon;

              return viewMode === 'grid' ? (
                <motion.div
                  key={table.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card
                    className={cn(
                      'group relative overflow-hidden transition-all duration-300 cursor-pointer border rounded-2xl',
                      'hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1',
                      config.bgColor,
                      session && 'ring-2 ring-amber-400/50 dark:ring-amber-500/30'
                    )}
                    onClick={() => handleTableClick(table)}
                  >
                    {/* Animated gradient overlay for occupied tables */}
                    {session && (
                      <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}

                    <CardContent className="p-4 relative">
                      {/* Status indicator dot */}
                      <div className={cn(
                        'absolute top-3 left-3 h-2.5 w-2.5 rounded-full',
                        session ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                      )} />

                      {/* Dropdown menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-1.5 right-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTable(table);
                              setNewTable({
                                table_number: String(table.table_number),
                                name: table.name || '',
                                capacity: String(table.capacity),
                              });
                              setEditDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          {session && (
                            <>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTable(table);
                                  setSelectedSession(session);
                                  setSessionQrModalOpen(true);
                                }}
                              >
                                <QrCode className="h-4 w-4 mr-2" />
                                QR Code da sessão
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSession(session);
                                  setTransferDialogOpen(true);
                                }}
                              >
                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                Transferir
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSession(session);
                                  setCloseTableDialogOpen(true);
                                }}
                              >
                                <Receipt className="h-4 w-4 mr-2" />
                                Fechar conta
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClearOrders(session);
                                }}
                                className="text-amber-600 focus:text-amber-600"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Limpar pedidos
                              </DropdownMenuItem>
                            </>
                          )}
                          {!session && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTable(table);
                                setOpenTableDialogOpen(true);
                              }}
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              Abrir mesa
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTable(table);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Table number - big and centered */}
                      <div className="text-center pt-2 pb-3">
                        <div className={cn(
                          'inline-flex items-center justify-center h-16 w-16 rounded-2xl text-3xl font-bold mb-2',
                          'bg-gradient-to-br shadow-lg',
                          config.gradient,
                          'text-white'
                        )}>
                          {table.table_number}
                        </div>
                        {table.name && (
                          <div className="text-xs text-muted-foreground truncate font-medium px-2">
                            {table.name}
                          </div>
                        )}
                      </div>

                      {/* Status badge */}
                      <div className={cn(
                        'flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-semibold mb-3 mx-auto w-fit',
                        'bg-white/60 dark:bg-black/20 backdrop-blur-sm',
                        config.color
                      )}>
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </div>

                      {/* Session info */}
                      {session ? (
                        <div className="space-y-2 bg-white/40 dark:bg-black/20 backdrop-blur-sm rounded-xl p-2.5">
                          <div className="flex items-center gap-2 text-xs">
                            <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate font-medium">
                              {session.customer_name || 'Cliente não identificado'}
                            </span>
                          </div>
                          <div className={cn(
                            'flex items-center gap-2 text-xs',
                            isSessionLong(session.opened_at) ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'
                          )}>
                            {isSessionLong(session.opened_at) ? (
                              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                            ) : (
                              <Timer className="h-3.5 w-3.5 flex-shrink-0" />
                            )}
                            <span>{formatSessionDuration(session.opened_at)}</span>
                          </div>
                          {total > 0 && (
                            <div className="flex items-center justify-between pt-1 border-t border-border/50">
                              <span className="text-xs text-muted-foreground">{orders.length} pedido{orders.length !== 1 ? 's' : ''}</span>
                              <span className="text-sm font-bold text-foreground">{formatCurrency(total)}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground bg-white/40 dark:bg-black/20 backdrop-blur-sm rounded-xl py-2">
                          <Users className="h-3.5 w-3.5" />
                          <span>{table.capacity} lugares</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  key={table.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <Card className={cn(
                    'border-l-4 rounded-xl overflow-hidden transition-all hover:shadow-lg',
                    table.status === 'occupied' ? 'border-l-amber-500' : 'border-l-emerald-500',
                    session && 'bg-amber-50/30 dark:bg-amber-950/10'
                  )}>
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          'h-14 w-14 rounded-xl flex items-center justify-center text-xl font-bold text-white shadow-lg',
                          'bg-gradient-to-br',
                          config.gradient
                        )}>
                          {table.table_number}
                        </div>
                        <div>
                          <div className="font-semibold text-base">{table.name || `Mesa ${table.table_number}`}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className={cn(
                              'flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                              'bg-white/60 dark:bg-black/20',
                              config.color
                            )}>
                              <StatusIcon className="h-3 w-3" />
                              {config.label}
                            </div>
                            {session && (
                              <span className={cn(
                                'text-xs flex items-center gap-1',
                                isSessionLong(session.opened_at) ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'
                              )}>
                                {isSessionLong(session.opened_at) && <AlertTriangle className="h-3 w-3" />}
                                {formatSessionDuration(session.opened_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {session && (
                        <div className="text-right hidden sm:block">
                          <div className="text-lg font-bold">{formatCurrency(total)}</div>
                          <div className="text-xs text-muted-foreground">{orders.length} pedido{orders.length !== 1 ? 's' : ''}</div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => handleTableClick(table)} className="rounded-lg shadow-sm">
                          <Plus className="h-4 w-4 mr-1" />
                          {session ? 'Adicionar' : 'Abrir'}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-lg">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem onClick={() => {
                              setSelectedTable(table);
                              setNewTable({
                                table_number: String(table.table_number),
                                name: table.name || '',
                                capacity: String(table.capacity),
                              });
                              setEditDialogOpen(true);
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {session ? (
                            <>
                              <DropdownMenuItem onClick={() => {
                                setSelectedSession(session);
                                setTransferDialogOpen(true);
                              }}>
                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                Transferir
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedSession(session);
                                setCloseTableDialogOpen(true);
                              }}>
                                <Receipt className="h-4 w-4 mr-2" />
                                Fechar conta
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleClearOrders(session)}
                                className="text-amber-600 focus:text-amber-600"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Limpar pedidos
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem onClick={() => {
                              setSelectedTable(table);
                              setOpenTableDialogOpen(true);
                            }}>
                              <UserPlus className="h-4 w-4 mr-2" />
                              Abrir mesa
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteTable(table)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Table Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Mesa</DialogTitle>
            <DialogDescription>Adicione uma nova mesa ao seu estabelecimento</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Número da Mesa *</Label>
              <Input
                type="number"
                value={newTable.table_number}
                onChange={(e) => setNewTable({ ...newTable, table_number: e.target.value })}
                placeholder="Ex: 1, 2, 3..."
              />
            </div>
            <div>
              <Label>Nome/Identificação (opcional)</Label>
              <Input
                value={newTable.name}
                onChange={(e) => setNewTable({ ...newTable, name: e.target.value })}
                placeholder="Ex: Varanda, Mezanino..."
              />
            </div>
            <div>
              <Label>Capacidade</Label>
              <Input
                type="number"
                value={newTable.capacity}
                onChange={(e) => setNewTable({ ...newTable, capacity: e.target.value })}
                placeholder="Número de lugares"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateTable}>Criar Mesa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Table Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Mesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Número da Mesa *</Label>
              <Input
                type="number"
                value={newTable.table_number}
                onChange={(e) => setNewTable({ ...newTable, table_number: e.target.value })}
              />
            </div>
            <div>
              <Label>Nome/Identificação</Label>
              <Input
                value={newTable.name}
                onChange={(e) => setNewTable({ ...newTable, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Capacidade</Label>
              <Input
                type="number"
                value={newTable.capacity}
                onChange={(e) => setNewTable({ ...newTable, capacity: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateTable}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open Table Dialog */}
      <Dialog open={openTableDialogOpen} onOpenChange={setOpenTableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir Mesa {selectedTable?.table_number}</DialogTitle>
            <DialogDescription>Informe os dados do cliente para abrir a mesa</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Cliente</Label>
              <Input
                value={openTableData.customer_name}
                onChange={(e) => setOpenTableData({ ...openTableData, customer_name: e.target.value })}
                placeholder="Nome ou identificação"
              />
            </div>
            <div>
              <Label>Quantidade de pessoas</Label>
              <Input
                type="number"
                value={openTableData.customer_count}
                onChange={(e) => setOpenTableData({ ...openTableData, customer_count: e.target.value })}
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Input
                value={openTableData.notes}
                onChange={(e) => setOpenTableData({ ...openTableData, notes: e.target.value })}
                placeholder="Anotações sobre a mesa"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenTableDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleOpenTable}>Abrir Mesa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Table Dialog */}
      <Dialog open={closeTableDialogOpen} onOpenChange={setCloseTableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar Mesa</DialogTitle>
            <DialogDescription>
              Confirma o fechamento da conta desta mesa?
            </DialogDescription>
          </DialogHeader>
          {selectedSession && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span>Cliente:</span>
                <span className="font-medium">{selectedSession.customer_name || 'Não informado'}</span>
              </div>
              <div className="flex justify-between">
                <span>Pedidos:</span>
                <span className="font-medium">{(sessionOrders[selectedSession.id] || []).length}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>{formatCurrency(getSessionTotal(selectedSession.id))}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseTableDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCloseTable}>Fechar Conta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Table Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Mesa</DialogTitle>
            <DialogDescription>Selecione a mesa de destino para transferir a conta</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mesa de destino</Label>
              <Select value={transferTarget} onValueChange={setTransferTarget}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma mesa" />
                </SelectTrigger>
                <SelectContent>
                  {tables
                    .filter(t => t.status === 'available' && t.id !== selectedSession?.table_id)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        Mesa {t.table_number} {t.name ? `(${t.name})` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleTransferTable} disabled={!transferTarget}>Transferir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Session Modal - View items and add new ones */}
      <TableSessionModal
        open={sessionModalOpen}
        onOpenChange={setSessionModalOpen}
        table={selectedTable}
        session={selectedSession}
        companyId={companyId || ''}
        onUpdate={loadData}
      />

      {/* QR Code Modal */}
      <TableQRCodeModal
        open={qrCodeModalOpen}
        onOpenChange={setQrCodeModalOpen}
        tables={tables}
        companySlug={companySlug || ''}
        companyName={companyName || ''}
      />

      {/* Session QR Code Modal - Unique link per session */}
      <SessionQRCodeModal
        open={sessionQrModalOpen}
        onOpenChange={setSessionQrModalOpen}
        sessionToken={selectedSession?.session_token || null}
        tableNumber={selectedTable?.table_number || 0}
        tableName={selectedTable?.name || null}
        companySlug={companySlug || ''}
      />
    </DashboardLayout>
  );
}
