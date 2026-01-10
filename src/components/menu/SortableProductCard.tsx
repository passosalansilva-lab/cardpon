import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Edit,
  Trash2,
  FolderOpen,
  Package,
  MoreVertical,
  Eye,
  EyeOff,
  Star,
  Clock,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProductTagsBadges } from './ProductTagsEditor';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  category_id: string | null;
  preparation_time_minutes: number;
  sort_order: number;
  product_type: 'principal' | 'pizza';
  tags?: string[];
  sales_count?: number;
}

interface Category {
  id: string;
  name: string;
}

interface SortableProductCardProps {
  product: Product;
  category?: Category;
  onEdit: (product: Product) => void;
  onToggleActive: (product: Product) => void;
  onToggleFeatured: (product: Product) => void;
  onDelete: (product: Product) => void;
  isDragging?: boolean;
}

export function SortableProductCard({
  product,
  category,
  onEdit,
  onToggleActive,
  onToggleFeatured,
  onDelete,
}: SortableProductCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`transition-all hover:shadow-md ${!product.is_active ? 'opacity-60' : ''} ${isDragging ? 'shadow-lg ring-2 ring-primary' : ''}`}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="flex items-center cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Product Image */}
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-20 h-20 lg:w-24 lg:h-24 rounded-xl object-cover flex-shrink-0 border"
            />
          ) : (
            <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 border-2 border-dashed">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          )}

          {/* Product Info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">{product.name}</h3>
                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {product.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold text-primary whitespace-nowrap">
                  R$ {Number(product.price).toFixed(2)}
                </p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(product)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar Produto
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onToggleActive(product)}>
                      {product.is_active ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Desativar
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Ativar
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggleFeatured(product)}>
                      <Star className={`h-4 w-4 mr-2 ${product.is_featured ? 'fill-current' : ''}`} />
                      {product.is_featured ? 'Remover Destaque' : 'Destacar'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(product)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Product Tags */}
            {product.tags && product.tags.length > 0 && (
              <ProductTagsBadges tags={product.tags} />
            )}

            {/* Product Details */}
            <div className="flex flex-wrap items-center gap-2">
              {category && (
                <Badge variant="outline" className="gap-1">
                  <FolderOpen className="h-3 w-3" />
                  {category.name}
                </Badge>
              )}
              {product.preparation_time_minutes && (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {product.preparation_time_minutes} min
                </Badge>
              )}
              {product.sales_count !== undefined && product.sales_count > 0 && (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  {product.sales_count} vendas
                </Badge>
              )}
              {!product.is_active && (
                <Badge variant="destructive">Inativo</Badge>
              )}
              {product.is_featured && (
                <Badge className="bg-warning/10 text-warning border-warning/30 gap-1">
                  <Star className="h-3 w-3 fill-current" />
                  Destaque
                </Badge>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(product)}
              >
                <Edit className="h-3 w-3 mr-1" />
                Editar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
