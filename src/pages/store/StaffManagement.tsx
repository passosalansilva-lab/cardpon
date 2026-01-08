import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Loader2, UserPlus, Trash2, Settings2, ShoppingBag, UtensilsCrossed, Package, Ticket, Megaphone, Truck, BarChart3, Star, Copy, Check, ExternalLink } from "lucide-react";

interface StaffPermissions {
  can_manage_orders: boolean;
  can_manage_menu: boolean;
  can_manage_inventory: boolean;
  can_manage_coupons: boolean;
  can_manage_promotions: boolean;
  can_manage_drivers: boolean;
  can_view_reports: boolean;
  can_manage_reviews: boolean;
}

interface StaffMember {
  id: string;
  user_id: string;
  created_at: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  permissions?: StaffPermissions;
}

const defaultPermissions: StaffPermissions = {
  can_manage_orders: true,
  can_manage_menu: false,
  can_manage_inventory: false,
  can_manage_coupons: false,
  can_manage_promotions: false,
  can_manage_drivers: false,
  can_view_reports: false,
  can_manage_reviews: false,
};

const permissionLabels: { key: keyof StaffPermissions; label: string; icon: React.ReactNode; description: string }[] = [
  { key: "can_manage_orders", label: "Pedidos", icon: <ShoppingBag className="h-4 w-4" />, description: "Visualizar e gerenciar pedidos" },
  { key: "can_manage_menu", label: "Cardápio", icon: <UtensilsCrossed className="h-4 w-4" />, description: "Editar produtos e categorias" },
  { key: "can_manage_inventory", label: "Estoque", icon: <Package className="h-4 w-4" />, description: "Gerenciar ingredientes e compras" },
  { key: "can_manage_coupons", label: "Cupons", icon: <Ticket className="h-4 w-4" />, description: "Criar e editar cupons de desconto" },
  { key: "can_manage_promotions", label: "Promoções", icon: <Megaphone className="h-4 w-4" />, description: "Gerenciar promoções ativas" },
  { key: "can_manage_drivers", label: "Entregadores", icon: <Truck className="h-4 w-4" />, description: "Gerenciar motoristas de entrega" },
  { key: "can_view_reports", label: "Relatórios", icon: <BarChart3 className="h-4 w-4" />, description: "Visualizar relatórios e estatísticas" },
  { key: "can_manage_reviews", label: "Avaliações", icon: <Star className="h-4 w-4" />, description: "Visualizar avaliações de clientes" },
];

export default function StaffManagement() {
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [newPermissions, setNewPermissions] = useState<StaffPermissions>(defaultPermissions);
  const [editingPermissions, setEditingPermissions] = useState<{ userId: string; permissions: StaffPermissions } | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const staffLoginUrl = `${window.location.origin}/staff/login`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(staffLoginUrl);
      setCopiedLink(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const toggleAllNewPermissions = (enabled: boolean) => {
    setNewPermissions({
      can_manage_orders: enabled,
      can_manage_menu: enabled,
      can_manage_inventory: enabled,
      can_manage_coupons: enabled,
      can_manage_promotions: enabled,
      can_manage_drivers: enabled,
      can_view_reports: enabled,
      can_manage_reviews: enabled,
    });
  };

  const toggleAllEditingPermissions = (enabled: boolean) => {
    if (!editingPermissions) return;
    setEditingPermissions({
      ...editingPermissions,
      permissions: {
        can_manage_orders: enabled,
        can_manage_menu: enabled,
        can_manage_inventory: enabled,
        can_manage_coupons: enabled,
        can_manage_promotions: enabled,
        can_manage_drivers: enabled,
        can_view_reports: enabled,
        can_manage_reviews: enabled,
      },
    });
  };

  const allNewPermissionsEnabled = Object.values(newPermissions).every(Boolean);
  const allEditingPermissionsEnabled = editingPermissions
    ? Object.values(editingPermissions.permissions).every(Boolean)
    : false;

  useEffect(() => {
    if (!user || !session) return;

    const loadStaffAndCompany = async () => {
      setLoading(true);
      try {
        // Get company ID
        const { data: companyData } = await supabase
          .from("companies")
          .select("id")
          .eq("owner_id", user.id)
          .single();

        if (companyData) {
          setCompanyId(companyData.id);
        }

        const { data, error } = await supabase.functions.invoke("manage-store-staff", {
          body: { action: "list" },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (error) throw error;
        if (!data?.success) {
          throw new Error(data?.error || "Erro ao carregar equipe");
        }

        // Load permissions for each staff member
        const staffWithPermissions = await Promise.all(
          (data.staff || []).map(async (member: StaffMember) => {
            if (companyData) {
              const { data: permData } = await supabase
                .from("staff_permissions")
                .select("*")
                .eq("user_id", member.user_id)
                .eq("company_id", companyData.id)
                .single();

              return {
                ...member,
                permissions: permData || defaultPermissions,
              };
            }
            return { ...member, permissions: defaultPermissions };
          })
        );

        setStaff(staffWithPermissions);
      } catch (error) {
        console.error("Erro ao carregar equipe:", error);
        toast.error("Não foi possível carregar a equipe.");
      } finally {
        setLoading(false);
      }
    };

    loadStaffAndCompany();
  }, [user, session]);

  const refreshStaff = async () => {
    if (!session || !companyId) return;
    try {
      const { data, error } = await supabase.functions.invoke("manage-store-staff", {
        body: { action: "list" },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao carregar equipe");

      const staffWithPermissions = await Promise.all(
        (data.staff || []).map(async (member: StaffMember) => {
          const { data: permData } = await supabase
            .from("staff_permissions")
            .select("*")
            .eq("user_id", member.user_id)
            .eq("company_id", companyId)
            .single();

          return {
            ...member,
            permissions: permData || defaultPermissions,
          };
        })
      );

      setStaff(staffWithPermissions);
    } catch (error) {
      console.error("Erro ao atualizar equipe:", error);
      toast.error("Não foi possível atualizar a equipe.");
    }
  };

  const handleAddStaff = async () => {
    if (!session || !companyId) {
      toast.error("Sessão inválida. Faça login novamente.");
      return;
    }

    if (!fullName || !email || !password) {
      toast.error("Preencha nome, e-mail e senha.");
      return;
    }

    setSaving(true);
    try {
      const { error, data } = await supabase.functions.invoke("create-store-staff", {
        body: { fullName, email, phone, password, role: "store_staff" },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Create permissions for the new staff member
      if (data?.staffUserId) {
        await supabase.from("staff_permissions").insert({
          user_id: data.staffUserId,
          company_id: companyId,
          ...newPermissions,
        });

        // Immediately add to local state for instant UI feedback
        const newMember: StaffMember = {
          id: crypto.randomUUID(),
          user_id: data.staffUserId,
          created_at: new Date().toISOString(),
          full_name: fullName,
          email: email,
          phone: phone || null,
          permissions: newPermissions,
        };
        setStaff(prev => [...prev, newMember]);
      }

      toast.success("Funcionário criado com sucesso.");
      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setNewPermissions(defaultPermissions);
      setIsAddDialogOpen(false);

      // Background sync to ensure data consistency
      refreshStaff();
    } catch (error: any) {
      console.error("Erro ao adicionar funcionário:", error);
      toast.error(error?.message || "Não foi possível adicionar o funcionário.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveStaff = async (userId: string) => {
    if (!session) return;

    setSaving(true);
    try {
      // Remove permissions first
      if (companyId) {
        await supabase
          .from("staff_permissions")
          .delete()
          .eq("user_id", userId)
          .eq("company_id", companyId);
      }

      const { data, error } = await supabase.functions.invoke("manage-store-staff", {
        body: { action: "deactivate", staffUserId: userId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao desligar funcionário");

      await refreshStaff();
      toast.success("Funcionário desligado.");
    } catch (error) {
      console.error("Erro ao desligar funcionário:", error);
      toast.error("Não foi possível desligar o funcionário.");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!editingPermissions || !companyId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("staff_permissions")
        .upsert({
          user_id: editingPermissions.userId,
          company_id: companyId,
          ...editingPermissions.permissions,
        }, {
          onConflict: "user_id,company_id",
        });

      if (error) throw error;

      setStaff(prev =>
        prev.map(member =>
          member.user_id === editingPermissions.userId
            ? { ...member, permissions: editingPermissions.permissions }
            : member
        )
      );

      toast.success("Permissões atualizadas com sucesso.");
      setIsPermissionsDialogOpen(false);
      setEditingPermissions(null);
    } catch (error) {
      console.error("Erro ao salvar permissões:", error);
      toast.error("Não foi possível salvar as permissões.");
    } finally {
      setSaving(false);
    }
  };

  const openPermissionsDialog = (member: StaffMember) => {
    setEditingPermissions({
      userId: member.user_id,
      permissions: member.permissions || defaultPermissions,
    });
    setIsPermissionsDialogOpen(true);
  };

  const getActivePermissionsCount = (permissions?: StaffPermissions) => {
    if (!permissions) return 0;
    return Object.values(permissions).filter(Boolean).length;
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Staff Login Link Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Link de acesso para funcionários</p>
                <p className="text-xs text-muted-foreground">
                  Compartilhe este link com sua equipe para que eles possam acessar o sistema
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  value={staffLoginUrl}
                  readOnly
                  className="text-xs bg-background h-9 min-w-[200px]"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  className="shrink-0 h-9 w-9"
                >
                  {copiedLink ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  asChild
                  className="shrink-0 h-9 w-9"
                >
                  <a href={staffLoginUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Equipe da Loja
              </CardTitle>
              <CardDescription>
                Gerencie os funcionários e suas permissões de acesso
              </CardDescription>
            </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Adicionar Funcionário
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Funcionário</DialogTitle>
                <DialogDescription>
                  Preencha os dados e defina as permissões de acesso
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome completo *</Label>
                    <Input
                      id="fullName"
                      placeholder="Ex: João da Silva"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="joao@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      placeholder="(00) 00000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha de acesso *</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <Label className="text-base font-medium">Permissões de Acesso</Label>
                      <p className="text-sm text-muted-foreground">
                        Defina o que este funcionário poderá acessar no sistema
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="toggle-all-new" className="text-sm text-muted-foreground">
                        Todos
                      </Label>
                      <Switch
                        id="toggle-all-new"
                        checked={allNewPermissionsEnabled}
                        onCheckedChange={toggleAllNewPermissions}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {permissionLabels.map(({ key, label, icon, description }) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-muted-foreground">{icon}</div>
                          <div>
                            <p className="text-sm font-medium">{label}</p>
                            <p className="text-xs text-muted-foreground">{description}</p>
                          </div>
                        </div>
                        <Switch
                          checked={newPermissions[key]}
                          onCheckedChange={(checked) =>
                            setNewPermissions(prev => ({ ...prev, [key]: checked }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={handleAddStaff} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Criando...
                    </>
                  ) : (
                    "Criar Funcionário"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && staff.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground">
                Nenhum funcionário cadastrado ainda.
              </p>
              <p className="text-sm text-muted-foreground">
                Clique em "Adicionar Funcionário" para começar.
              </p>
            </div>
          )}

          {!loading && staff.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Permissões</TableHead>
                    <TableHead>Adicionado em</TableHead>
                    <TableHead className="w-[120px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.full_name || "Usuário"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{member.email || "-"}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {getActivePermissionsCount(member.permissions)} de {permissionLabels.length} ativas
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(member.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openPermissionsDialog(member)}
                            disabled={saving}
                            title="Gerenciar permissões"
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveStaff(member.user_id)}
                            disabled={saving}
                            title="Desligar funcionário"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Permissions Dialog */}
      <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Permissões de Acesso
            </DialogTitle>
            <DialogDescription>
              Defina o que este funcionário pode acessar no sistema
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Toggle all switch */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-primary/30 bg-primary/5">
              <div>
                <p className="text-sm font-medium">Liberar todos os acessos</p>
                <p className="text-xs text-muted-foreground">Marcar/desmarcar todas as permissões</p>
              </div>
              <Switch
                checked={allEditingPermissionsEnabled}
                onCheckedChange={toggleAllEditingPermissions}
              />
            </div>

            <div className="space-y-3 max-h-[40vh] overflow-y-auto">
              {editingPermissions && permissionLabels.map(({ key, label, icon, description }) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-muted-foreground">{icon}</div>
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={editingPermissions.permissions[key]}
                    onCheckedChange={(checked) =>
                      setEditingPermissions(prev =>
                        prev ? { ...prev, permissions: { ...prev.permissions, [key]: checked } } : null
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsPermissionsDialogOpen(false);
                setEditingPermissions(null);
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSavePermissions} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                "Salvar Permissões"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
