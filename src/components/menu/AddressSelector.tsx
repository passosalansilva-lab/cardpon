import { useState, useEffect } from 'react';
import { MapPin, Plus, Check, Home, Building, Briefcase, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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

interface Address {
  id: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  reference: string | null;
  label: string | null;
  is_default: boolean | null;
  customer_id?: string | null;
}

interface AddressSelectorProps {
  customerId: string;
  selectedAddressId: string | null;
  onSelect: (address: Address | null) => void;
  onAddNew: () => void;
}

export function AddressSelector({ customerId, selectedAddressId, onSelect, onAddNew }: AddressSelectorProps) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addressToDelete, setAddressToDelete] = useState<Address | null>(null);

  useEffect(() => {
    if (customerId) {
      loadAddresses();
    } else {
      setAddresses([]);
      setLoading(false);
    }
  }, [customerId]);

  const loadAddresses = async () => {
    if (!customerId) return;
    
    setLoading(true);
    try {
      // Use Edge Function to bypass RLS (secure server-side lookup)
      const { data: result, error } = await supabase.functions.invoke('get-customer-addresses', {
        body: { customerId }
      });

      if (error) throw error;
      
      const data = result?.addresses || [];
      setAddresses(data);

      // Auto-select default or first address
      if (data.length > 0 && !selectedAddressId) {
        const defaultAddr = data.find((a: Address) => a.is_default) || data[0];
        onSelect(defaultAddr);
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = async () => {
    if (!addressToDelete) return;
    
    setDeletingId(addressToDelete.id);
    try {
      const { error } = await supabase.functions.invoke('delete-customer-address', {
        body: { addressId: addressToDelete.id, customerId }
      });

      if (error) throw error;

      // Remove from local state
      const updatedAddresses = addresses.filter(a => a.id !== addressToDelete.id);
      setAddresses(updatedAddresses);

      // If we deleted the selected address, select another one
      if (selectedAddressId === addressToDelete.id) {
        const newSelection = updatedAddresses.find(a => a.is_default) || updatedAddresses[0] || null;
        onSelect(newSelection);
      }

      toast.success('Endereço removido com sucesso');
    } catch (error) {
      console.error('Error deleting address:', error);
      toast.error('Erro ao remover endereço');
    } finally {
      setDeletingId(null);
      setAddressToDelete(null);
    }
  };

  const getLabelIcon = (label: string | null) => {
    switch (label?.toLowerCase()) {
      case 'trabalho':
        return <Briefcase className="h-4 w-4" />;
      case 'apartamento':
        return <Building className="h-4 w-4" />;
      default:
        return <Home className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (addresses.length === 0) {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
          <MapPin className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Nenhum endereço cadastrado</p>
          <p className="text-xs text-muted-foreground">Adicione um endereço para continuar</p>
        </div>
        <Button onClick={onAddNew} variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Endereço
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RadioGroup
        value={selectedAddressId || ''}
        onValueChange={(value) => {
          const addr = addresses.find(a => a.id === value);
          onSelect(addr || null);
        }}
        className="space-y-3"
      >
        {addresses.map((address) => (
          <div key={address.id} className="relative group">
            <Label
              htmlFor={address.id}
              className={cn(
                'flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all pr-12',
                selectedAddressId === address.id
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <RadioGroupItem value={address.id} id={address.id} className="mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getLabelIcon(address.label)}
                  <span className="font-medium">{address.label || 'Casa'}</span>
                  {address.is_default && (
                    <Badge variant="secondary" className="text-xs">Padrão</Badge>
                  )}
                </div>
                <p className="text-sm">
                  {address.street}, {address.number}
                  {address.complement && ` - ${address.complement}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {address.neighborhood} - {address.city}/{address.state}
                </p>
                {address.reference && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ref: {address.reference}
                  </p>
                )}
              </div>
              {selectedAddressId === address.id && (
                <Check className="h-5 w-5 text-primary flex-shrink-0" />
              )}
            </Label>
            
            {/* Delete button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAddressToDelete(address);
              }}
              disabled={deletingId === address.id}
            >
              {deletingId === address.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        ))}
      </RadioGroup>

      <Button onClick={onAddNew} variant="outline" className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Novo Endereço
      </Button>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!addressToDelete} onOpenChange={(open) => !open && setAddressToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover endereço?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o endereço "{addressToDelete?.label || 'Casa'}" ({addressToDelete?.street}, {addressToDelete?.number})?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteAddress();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
