import React, { useState, useEffect } from 'react';
import { Clock, Loader2, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface DayPeriod {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface CategoryDayPeriod {
  category_id: string;
  day_period_id: string;
}

interface Category {
  id: string;
  name: string;
}

interface CategoryPeriodLinkerProps {
  companyId: string;
  categories: Category[];
}

export function CategoryPeriodLinker({ companyId, categories }: CategoryPeriodLinkerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<DayPeriod[]>([]);
  const [categoryPeriods, setCategoryPeriods] = useState<CategoryDayPeriod[]>([]);

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [periodsRes, categoryPeriodsRes] = await Promise.all([
        supabase
          .from('day_periods')
          .select('*')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('category_day_periods')
          .select('category_id, day_period_id'),
      ]);

      if (periodsRes.error) throw periodsRes.error;
      if (categoryPeriodsRes.error) throw categoryPeriodsRes.error;

      setPeriods(periodsRes.data || []);
      setCategoryPeriods(categoryPeriodsRes.data || []);
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Erro ao carregar períodos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getLinkedPeriods = (categoryId: string) => {
    return categoryPeriods
      .filter((cp) => cp.category_id === categoryId)
      .map((cp) => periods.find((p) => p.id === cp.day_period_id))
      .filter(Boolean) as DayPeriod[];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (periods.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-3">
            Nenhum período configurado. Configure os períodos nas configurações da loja.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/store?tab=horarios">
              Configurar períodos
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Períodos do Dia
          </h3>
          <p className="text-sm text-muted-foreground">
            Visualize quais categorias estão vinculadas a cada período.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard/store?tab=horarios">
            <Settings className="h-4 w-4 mr-1" />
            Gerenciar
          </Link>
        </Button>
      </div>

      <div className="grid gap-3">
        {categories.map((category) => {
          const linkedPeriods = getLinkedPeriods(category.id);
          return (
            <Card key={category.id} className="p-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium min-w-[120px]">{category.name}</span>
                <div className="flex flex-wrap gap-2 flex-1">
                  {linkedPeriods.length > 0 ? (
                    linkedPeriods.map((period) => (
                      <Badge key={period.id} variant="outline" className="text-xs">
                        {period.name}
                        <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                          {period.start_time.slice(0, 5)}-{period.end_time.slice(0, 5)}
                        </span>
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Dia todo
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
