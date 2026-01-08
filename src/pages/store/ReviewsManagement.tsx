import { useState, useEffect } from 'react';
import { Star, Loader2, MessageSquare, TrendingUp, ChefHat, Truck } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Review {
  id: string;
  order_id: string;
  rating: number;
  food_rating: number | null;
  delivery_rating: number | null;
  comment: string | null;
  created_at: string;
}

interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  averageFoodRating: number;
  averageDeliveryRating: number;
  ratingDistribution: Record<number, number>;
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClasses[size]} ${
            star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );
}

export default function ReviewsManagement() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsEnabled, setReviewsEnabled] = useState(true);
  const [togglingReviews, setTogglingReviews] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [stats, setStats] = useState<ReviewStats>({
    totalReviews: 0,
    averageRating: 0,
    averageFoodRating: 0,
    averageDeliveryRating: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });

  useEffect(() => {
    loadReviews();
  }, [user]);

  const loadReviews = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get company
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!company) {
        setLoading(false);
        return;
      }

      setCompanyId(company.id);

      // Get review settings
      const { data: settings } = await supabase
        .from('company_review_settings')
        .select('reviews_enabled')
        .eq('company_id', company.id)
        .maybeSingle();

      // Default to true if no settings exist
      setReviewsEnabled(settings?.reviews_enabled ?? true);

      // Get reviews
      const { data: reviewsData, error } = await supabase
        .from('order_reviews')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setReviews(reviewsData || []);

      // Calculate stats
      if (reviewsData && reviewsData.length > 0) {
        const totalReviews = reviewsData.length;
        const averageRating = reviewsData.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
        
        const foodRatings = reviewsData.filter(r => r.food_rating !== null);
        const averageFoodRating = foodRatings.length > 0
          ? foodRatings.reduce((sum, r) => sum + (r.food_rating || 0), 0) / foodRatings.length
          : 0;
        
        const deliveryRatings = reviewsData.filter(r => r.delivery_rating !== null);
        const averageDeliveryRating = deliveryRatings.length > 0
          ? deliveryRatings.reduce((sum, r) => sum + (r.delivery_rating || 0), 0) / deliveryRatings.length
          : 0;

        const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        reviewsData.forEach(r => {
          ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
        });

        setStats({
          totalReviews,
          averageRating,
          averageFoodRating,
          averageDeliveryRating,
          ratingDistribution,
        });
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleReviewsEnabled = async (enabled: boolean) => {
    if (!companyId) return;

    setTogglingReviews(true);
    try {
      // Check if settings exist
      const { data: existing } = await supabase
        .from('company_review_settings')
        .select('id')
        .eq('company_id', companyId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('company_review_settings')
          .update({ reviews_enabled: enabled })
          .eq('company_id', companyId);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('company_review_settings')
          .insert({ company_id: companyId, reviews_enabled: enabled });

        if (error) throw error;
      }

      setReviewsEnabled(enabled);
      toast.success(enabled ? 'Avaliações ativadas' : 'Avaliações desativadas');
    } catch (error) {
      console.error('Error toggling reviews:', error);
      toast.error('Erro ao alterar configuração');
    } finally {
      setTogglingReviews(false);
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-500';
    if (rating >= 3.5) return 'text-yellow-500';
    if (rating >= 2.5) return 'text-orange-500';
    return 'text-red-500';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Avaliações</h1>
            <p className="text-muted-foreground mt-1">
              Veja o feedback dos seus clientes
            </p>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <Switch
              id="reviews-enabled"
              checked={reviewsEnabled}
              onCheckedChange={toggleReviewsEnabled}
              disabled={togglingReviews}
            />
            <Label htmlFor="reviews-enabled" className="cursor-pointer">
              {reviewsEnabled ? 'Avaliações ativadas' : 'Avaliações desativadas'}
            </Label>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Avaliações</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReviews}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nota Geral</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getRatingColor(stats.averageRating)}`}>
                {stats.averageRating.toFixed(1)}
              </div>
              <StarRating rating={Math.round(stats.averageRating)} size="sm" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nota da Comida</CardTitle>
              <ChefHat className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getRatingColor(stats.averageFoodRating)}`}>
                {stats.averageFoodRating > 0 ? stats.averageFoodRating.toFixed(1) : '-'}
              </div>
              {stats.averageFoodRating > 0 && (
                <StarRating rating={Math.round(stats.averageFoodRating)} size="sm" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nota da Entrega</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getRatingColor(stats.averageDeliveryRating)}`}>
                {stats.averageDeliveryRating > 0 ? stats.averageDeliveryRating.toFixed(1) : '-'}
              </div>
              {stats.averageDeliveryRating > 0 && (
                <StarRating rating={Math.round(stats.averageDeliveryRating)} size="sm" />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Rating Distribution */}
        {stats.totalReviews > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = stats.ratingDistribution[rating] || 0;
                  const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
                  return (
                    <div key={rating} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-16">
                        <span className="text-sm font-medium">{rating}</span>
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      </div>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reviews List */}
        <Card>
          <CardHeader>
            <CardTitle>Avaliações Recentes</CardTitle>
            <CardDescription>
              Todas as avaliações deixadas pelos clientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reviews.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Nenhuma avaliação ainda</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  As avaliações dos clientes aparecerão aqui
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="border border-border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <StarRating rating={review.rating} size="md" />
                          <Badge variant="outline" className="text-xs">
                            Pedido #{review.order_id.slice(0, 8)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(review.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>

                    {(review.food_rating || review.delivery_rating) && (
                      <div className="flex gap-4 text-sm">
                        {review.food_rating && (
                          <div className="flex items-center gap-2">
                            <ChefHat className="h-4 w-4 text-muted-foreground" />
                            <span>Comida: {review.food_rating}</span>
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          </div>
                        )}
                        {review.delivery_rating && (
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <span>Entrega: {review.delivery_rating}</span>
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          </div>
                        )}
                      </div>
                    )}

                    {review.comment && (
                      <p className="text-sm text-foreground bg-muted/50 rounded-md p-3 italic">
                        "{review.comment}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
