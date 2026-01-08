import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Filter, Loader2, Search, Trash2, Square, CheckSquare, XSquare, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  data: any;
}

// Helper to determine navigation route based on notification type and data
function getNotificationRoute(notification: Notification): string | null {
  const { type, data } = notification;
  
  // Check for specific data fields first
  if (data?.order_id) {
    return '/dashboard/orders';
  }
  if (data?.review_id) {
    return '/dashboard/reviews';
  }
  if (data?.driver_id) {
    return '/dashboard/drivers';
  }
  if (data?.product_id) {
    return '/dashboard/menu';
  }
  if (data?.coupon_id) {
    return '/dashboard/coupons';
  }
  if (data?.table_id) {
    return '/dashboard/tables';
  }
  
  // Fallback to type-based routing
  switch (type) {
    case 'order':
    case 'new_order':
      return '/dashboard/orders';
    case 'review':
      return '/dashboard/reviews';
    case 'payment':
    case 'subscription':
      return '/dashboard/plans';
    case 'driver':
      return '/dashboard/drivers';
    case 'inventory':
      return '/dashboard/inventory';
    case 'promotion':
      return '/dashboard/promotions';
    default:
      return null;
  }
}

export default function NotificationsCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'read'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deletedCount, setDeletedCount] = useState(0);
  const [totalToDelete, setTotalToDelete] = useState(0);

  const handleNotificationClick = async (notification: Notification) => {
    if (isSelectionMode) {
      toggleSelection(notification.id);
      return;
    }
    
    // Mark as read
    await markAsRead(notification.id);
    
    // Navigate to the appropriate route
    const route = getNotificationRoute(notification);
    if (route) {
      navigate(route);
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifications();

      const channel = supabase
        .channel('notifications-center')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications(prev => [payload.new as Notification, ...prev]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast.error('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAsUnread = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: false })
        .eq('id', notificationId);

      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, is_read: false } : n))
      );
    } catch (error) {
      console.error('Error marking notification as unread:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('Todas as notificações foram marcadas como lidas');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Erro ao marcar notificações');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      toast.success('Notificação removida');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Erro ao remover notificação');
    }
  };

  const deleteAllRead = async () => {
    if (!user) return;

    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('is_read', true);

      setNotifications(prev => prev.filter(n => !n.is_read));
      toast.success('Notificações lidas foram removidas');
    } catch (error) {
      console.error('Error deleting read notifications:', error);
      toast.error('Erro ao remover notificações');
    }
  };

  const deleteSelectedNotifications = async () => {
    if (selectedIds.size === 0) return;

    setShowDeleteDialog(false);
    setIsDeleting(true);
    setDeleteProgress(0);
    setDeletedCount(0);
    
    const idsToDelete = Array.from(selectedIds);
    setTotalToDelete(idsToDelete.length);

    try {
      // Delete in batches of 10 for visual progress
      const batchSize = 10;
      let deleted = 0;

      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('notifications')
          .delete()
          .in('id', batch);

        if (error) throw error;

        deleted += batch.length;
        setDeletedCount(deleted);
        setDeleteProgress((deleted / idsToDelete.length) * 100);
        
        // Small delay for visual feedback
        if (i + batchSize < idsToDelete.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)));
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      toast.success(`${idsToDelete.length} notificação(ões) removida(s)`);
    } catch (error) {
      console.error('Error deleting selected notifications:', error);
      toast.error('Erro ao remover notificações selecionadas');
    } finally {
      setIsDeleting(false);
      setDeleteProgress(0);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotifications.map(n => n.id)));
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const cancelSelection = () => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'warning':
        return 'bg-warning text-warning-foreground';
      case 'error':
        return 'bg-destructive text-destructive-foreground';
      case 'success':
        return 'bg-green-500 text-white';
      default:
        return 'bg-primary text-primary-foreground';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'warning':
        return 'Aviso';
      case 'error':
        return 'Erro';
      case 'success':
        return 'Sucesso';
      case 'order':
        return 'Pedido';
      case 'payment':
        return 'Pagamento';
      case 'subscription':
        return 'Assinatura';
      default:
        return 'Info';
    }
  };

  const filteredNotifications = notifications.filter(n => {
    // Tab filter
    if (activeTab === 'unread' && n.is_read) return false;
    if (activeTab === 'read' && !n.is_read) return false;

    // Type filter
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        n.title.toLowerCase().includes(query) ||
        n.message.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const readCount = notifications.filter(n => n.is_read).length;

  const uniqueTypes = [...new Set(notifications.map(n => n.type))];

  const allSelected = filteredNotifications.length > 0 && selectedIds.size === filteredNotifications.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredNotifications.length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Central de Notificações</h1>
              <p className="text-muted-foreground text-sm">
                {unreadCount > 0
                  ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}`
                  : 'Todas as notificações lidas'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isSelectionMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {allSelected ? (
                    <>
                      <XSquare className="h-4 w-4 mr-2" />
                      Desmarcar todas
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Selecionar todas ({filteredNotifications.length})
                    </>
                  )}
                </Button>
                {selectedIds.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir ({selectedIds.size})
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={cancelSelection}>
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                {notifications.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSelectionMode(true)}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Selecionar
                  </Button>
                )}
                {unreadCount > 0 && (
                  <Button variant="outline" size="sm" onClick={markAllAsRead}>
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Marcar todas como lidas
                  </Button>
                )}
                {readCount > 0 && (
                  <Button variant="outline" size="sm" onClick={deleteAllRead}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Limpar lidas
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar notificações..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {uniqueTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {getTypeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="all">
              Todas ({notifications.length})
            </TabsTrigger>
            <TabsTrigger value="unread">
              Não lidas ({unreadCount})
            </TabsTrigger>
            <TabsTrigger value="read">
              Lidas ({readCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground text-center">
                    {searchQuery || typeFilter !== 'all'
                      ? 'Nenhuma notificação encontrada com os filtros aplicados'
                      : activeTab === 'unread'
                      ? 'Nenhuma notificação não lida'
                      : activeTab === 'read'
                      ? 'Nenhuma notificação lida'
                      : 'Nenhuma notificação'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredNotifications.map((notification) => (
                  <Card
                    key={notification.id}
                    className={`transition-colors ${
                      !notification.is_read ? 'bg-accent/30 border-primary/20' : ''
                    } ${selectedIds.has(notification.id) ? 'ring-2 ring-primary' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Selection checkbox or indicator */}
                        <div className="pt-1">
                          {isSelectionMode ? (
                            <Checkbox
                              checked={selectedIds.has(notification.id)}
                              onCheckedChange={() => toggleSelection(notification.id)}
                            />
                          ) : !notification.is_read ? (
                            <span className="block w-2.5 h-2.5 bg-primary rounded-full" />
                          ) : (
                            <span className="block w-2.5 h-2.5 border-2 border-muted-foreground/30 rounded-full" />
                          )}
                        </div>

                        {/* Content */}
                        <div 
                          className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`${getTypeColor(notification.type)} text-xs`}>
                              {getTypeLabel(notification.type)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(notification.created_at), "dd/MM/yyyy 'às' HH:mm", {
                                locale: ptBR,
                              })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({formatDistanceToNow(new Date(notification.created_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })})
                            </span>
                          </div>
                          <h3 className="font-semibold text-sm">{notification.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                        </div>

                        {/* Actions */}
                        {!isSelectionMode && (
                          <div className="flex items-center gap-1 shrink-0">
                            {notification.is_read ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => markAsUnread(notification.id)}
                                title="Marcar como não lida"
                              >
                                <Bell className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => markAsRead(notification.id)}
                                title="Marcar como lida"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteNotification(notification.id)}
                              title="Remover"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir notificações</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja excluir {selectedIds.size} notificação(ões)? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteSelectedNotifications}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Progress dialog for bulk delete */}
      <Dialog open={isDeleting} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Excluindo notificações...
            </DialogTitle>
            <DialogDescription>
              Aguarde enquanto as notificações são removidas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Progress value={deleteProgress} className="h-3" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{deletedCount} de {totalToDelete} removidas</span>
              <span>{Math.round(deleteProgress)}%</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}