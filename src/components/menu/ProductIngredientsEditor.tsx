import React, { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, X } from 'lucide-react';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Ingredient {
  id: string;
  name: string;
  is_removable: boolean;
  sort_order: number;
}

interface ProductIngredientsEditorProps {
  productId: string;
}

function SortableIngredient({
  ingredient,
  onToggleRemovable,
  onDelete,
}: {
  ingredient: Ingredient;
  onToggleRemovable: (id: string, value: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: ingredient.id });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 bg-card border rounded-lg"
    >
      <span {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </span>
      <span className="flex-1 text-sm">{ingredient.name}</span>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Switch
            checked={ingredient.is_removable}
            onCheckedChange={(checked) => onToggleRemovable(ingredient.id, checked)}
            className="scale-75"
          />
          <span className="text-xs text-muted-foreground">Removível</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={() => onDelete(ingredient.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function ProductIngredientsEditor({ productId }: ProductIngredientsEditorProps) {
  const { toast } = useToast();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIngredient, setNewIngredient] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadIngredients();
  }, [productId]);

  const loadIngredients = async () => {
    try {
      const { data, error } = await supabase
        .from('product_ingredients')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order');

      if (error) throw error;
      setIngredients(data || []);
    } catch (error) {
      console.error('Error loading ingredients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIngredient = async () => {
    if (!newIngredient.trim()) return;

    setAdding(true);
    try {
      const { data, error } = await supabase
        .from('product_ingredients')
        .insert({
          product_id: productId,
          name: newIngredient.trim(),
          sort_order: ingredients.length,
        })
        .select()
        .single();

      if (error) throw error;

      setIngredients([...ingredients, data]);
      setNewIngredient('');
      toast({ title: 'Ingrediente adicionado' });
    } catch (error: any) {
      toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const handleToggleRemovable = async (id: string, isRemovable: boolean) => {
    try {
      const { error } = await supabase
        .from('product_ingredients')
        .update({ is_removable: isRemovable })
        .eq('id', id);

      if (error) throw error;

      setIngredients(ingredients.map((i) => (i.id === id ? { ...i, is_removable: isRemovable } : i)));
    } catch (error) {
      console.error('Error updating ingredient:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('product_ingredients')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setIngredients(ingredients.filter((i) => i.id !== id));
      toast({ title: 'Ingrediente removido' });
    } catch (error: any) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ingredients.findIndex((i) => i.id === active.id);
    const newIndex = ingredients.findIndex((i) => i.id === over.id);

    const reordered = arrayMove(ingredients, oldIndex, newIndex);
    setIngredients(reordered);

    try {
      await Promise.all(
        reordered.map((i, index) =>
          supabase.from('product_ingredients').update({ sort_order: index }).eq('id', i.id)
        )
      );
    } catch (error) {
      console.error('Error reordering:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddIngredient();
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Carregando ingredientes...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Ex: Cebola, Tomate, Queijo..."
          value={newIngredient}
          onChange={(e) => setNewIngredient(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button onClick={handleAddIngredient} disabled={adding || !newIngredient.trim()} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {ingredients.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Nenhum ingrediente cadastrado. Adicione os ingredientes que o cliente poderá remover.
        </p>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ingredients.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {ingredients.map((ingredient) => (
                <SortableIngredient
                  key={ingredient.id}
                  ingredient={ingredient}
                  onToggleRemovable={handleToggleRemovable}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <p className="text-xs text-muted-foreground">
        Ingredientes marcados como "Removível" aparecerão para o cliente escolher remover.
      </p>
    </div>
  );
}
