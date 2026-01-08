import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';

interface Purchase {
  id: string;
  ingredient_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  purchased_at: string;
  ingredient_name?: string;
}

interface PurchaseHistoryTableProps {
  purchases: Purchase[];
  loading: boolean;
  onDelete: (purchase: Purchase) => void;
}

export function PurchaseHistoryTable({
  purchases,
  loading,
  onDelete,
}: PurchaseHistoryTableProps) {
  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (date: string) =>
    format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando histórico...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Histórico de Compras</CardTitle>
      </CardHeader>
      <CardContent>
        {purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma compra registrada ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Ingrediente</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Custo unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.slice(0, 20).map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="text-sm">
                      {formatDate(purchase.purchased_at)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {purchase.ingredient_name || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {purchase.quantity.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(purchase.unit_cost)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(purchase.total_cost)}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover compra</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja remover esta compra? O estoque não será ajustado automaticamente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => onDelete(purchase)}
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {purchases.length > 20 && (
              <p className="text-xs text-muted-foreground text-center mt-4">
                Exibindo as últimas 20 compras de {purchases.length} no total.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
