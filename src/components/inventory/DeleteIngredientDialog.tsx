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

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  average_unit_cost: number;
}

interface DeleteIngredientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredient: Ingredient | null;
  onConfirm: () => void;
}

export function DeleteIngredientDialog({
  open,
  onOpenChange,
  ingredient,
  onConfirm,
}: DeleteIngredientDialogProps) {
  if (!ingredient) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover ingrediente</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja remover o ingrediente "{ingredient.name}"?
            <br />
            <br />
            Esta ação não pode ser desfeita e o ingrediente será removido do
            sistema. Movimentações já registradas não serão afetadas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
