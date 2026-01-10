import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Sparkles, Leaf, WheatOff, Flame, Award, Clock, Heart } from 'lucide-react';

const AVAILABLE_TAGS = [
  { id: 'novo', label: 'Novo', icon: Sparkles, color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  { id: 'mais_vendido', label: 'Mais Vendido', icon: Award, color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  { id: 'vegano', label: 'Vegano', icon: Leaf, color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  { id: 'vegetariano', label: 'Vegetariano', icon: Leaf, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  { id: 'sem_gluten', label: 'Sem Glúten', icon: WheatOff, color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  { id: 'picante', label: 'Picante', icon: Flame, color: 'bg-red-500/10 text-red-600 border-red-500/30' },
  { id: 'favorito_casa', label: 'Favorito da Casa', icon: Heart, color: 'bg-pink-500/10 text-pink-600 border-pink-500/30' },
  { id: 'tempo_limitado', label: 'Tempo Limitado', icon: Clock, color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
];

interface ProductTagsEditorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export function ProductTagsEditor({ selectedTags, onChange }: ProductTagsEditorProps) {
  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onChange(selectedTags.filter((t) => t !== tagId));
    } else {
      onChange([...selectedTags, tagId]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Selos do produto</label>
      <p className="text-xs text-muted-foreground">
        Adicione selos visuais para destacar características do produto
      </p>
      <div className="flex flex-wrap gap-2 mt-2">
        {AVAILABLE_TAGS.map((tag) => {
          const Icon = tag.icon;
          const isSelected = selectedTags.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                border transition-all duration-200
                ${isSelected 
                  ? tag.color + ' ring-2 ring-offset-2 ring-primary/20' 
                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                }
              `}
            >
              <Icon className="h-3.5 w-3.5" />
              {tag.label}
              {isSelected && <X className="h-3 w-3 ml-1" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Component to display tags on product cards
export function ProductTagsBadges({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tagId) => {
        const tag = AVAILABLE_TAGS.find((t) => t.id === tagId);
        if (!tag) return null;
        const Icon = tag.icon;
        return (
          <span
            key={tagId}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${tag.color}`}
          >
            <Icon className="h-3 w-3" />
            {tag.label}
          </span>
        );
      })}
    </div>
  );
}

export { AVAILABLE_TAGS };
