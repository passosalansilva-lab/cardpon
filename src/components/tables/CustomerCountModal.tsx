import { useState } from 'react';
import { Users, Minus, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CustomerCountModalProps {
  open: boolean;
  onConfirm: (count: number) => void;
  tableNumber: number;
}

export function CustomerCountModal({ open, onConfirm, tableNumber }: CustomerCountModalProps) {
  const [count, setCount] = useState(1);

  const handleConfirm = () => {
    onConfirm(count);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[400px]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Bem-vindo à Mesa {tableNumber}! 🍽️
          </DialogTitle>
          <DialogDescription className="text-center">
            Quantas pessoas estão na mesa?
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div className="flex items-center justify-center gap-6">
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={() => setCount((c) => Math.max(1, c - 1))}
              disabled={count <= 1}
            >
              <Minus className="h-5 w-5" />
            </Button>
            
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                <span className="text-4xl font-bold text-primary">{count}</span>
              </div>
              <span className="text-sm text-muted-foreground mt-1">
                {count === 1 ? 'pessoa' : 'pessoas'}
              </span>
            </div>
            
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={() => setCount((c) => Math.min(20, c + 1))}
              disabled={count >= 20}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <Button onClick={handleConfirm} className="w-full" size="lg">
          Confirmar e ver cardápio
        </Button>
      </DialogContent>
    </Dialog>
  );
}
