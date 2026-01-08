import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store,
  UtensilsCrossed,
  Truck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  X,
  ChevronRight,
  Lightbulb,
  Package,
  CreditCard,
  Eye,
  SkipForward,
  PlayCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  tip: string;
  completed: boolean;
  skipped?: boolean;
  videoUrl?: string;
  videoDescription?: string;
}

interface StoreOnboardingProps {
  companyId: string | null;
  userId: string;
}

export function StoreOnboarding({ companyId, userId }: StoreOnboardingProps) {
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    checkOnboardingStatus();
  }, [companyId, userId]);

  const checkOnboardingStatus = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    try {
      // Check if user has seen onboarding
      const hasSeenOnboarding = localStorage.getItem(`onboarding_seen_${userId}`);
      const skippedSteps = JSON.parse(localStorage.getItem(`onboarding_skipped_${userId}`) || '{}');
      
      // Check store configuration
      const { data: company } = await supabase
        .from('companies')
        .select('name, phone, address, logo_url, pix_key, delivery_fee, min_order_value, menu_published')
        .eq('id', companyId)
        .single();

      // Check categories count
      const { count: categoriesCount } = await supabase
        .from('categories')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);

      // Check products count
      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);

      // Check inventory count
      const { count: inventoryCount } = await supabase
        .from('inventory_ingredients')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);

      // Check drivers count
      const { count: driversCount } = await supabase
        .from('delivery_drivers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);

      const isStoreConfigured = !!(
        company?.phone &&
        company?.address &&
        company?.logo_url
      );

      const hasMenu = (categoriesCount || 0) > 0 && (productsCount || 0) > 0;
      const hasInventory = (inventoryCount || 0) > 0;
      const hasDrivers = (driversCount || 0) > 0;
      const hasPaymentConfig = !!(company?.pix_key && company?.delivery_fee !== null);
      const isMenuPublished = company?.menu_published || false;

      const updatedSteps: OnboardingStep[] = [
        {
          id: 'store',
          title: 'Configurar Loja',
          description: 'Adicione logo, endereço, telefone e horários de funcionamento',
          icon: Store,
          route: '/dashboard/store',
          tip: 'Uma loja bem configurada passa mais confiança para seus clientes e melhora seu posicionamento!',
          completed: isStoreConfigured,
          skipped: skippedSteps['store'] || false,
          videoUrl: '/videos/onboarding-store.mp4',
          videoDescription: 'Veja em menos de 1 minuto como completar os dados básicos da sua loja.',
        },
        {
          id: 'menu',
          title: 'Criar Cardápio',
          description: 'Adicione categorias e produtos com fotos e descrições',
          icon: UtensilsCrossed,
          route: '/dashboard/menu',
          tip: 'Comece com pelo menos 3 categorias e adicione fotos atrativas aos produtos. Isso aumenta muito as vendas!',
          completed: hasMenu,
          skipped: skippedSteps['menu'] || false,
          videoUrl: '/videos/onboarding-menu.mp4',
          videoDescription: 'Aprenda a criar categorias, produtos e fotos em poucos cliques.',
        },
        {
          id: 'inventory',
          title: 'Configurar Estoque',
          description: 'Configure ingredientes e controle automático de estoque',
          icon: Package,
          route: '/dashboard/inventory',
          tip: 'O controle de estoque evita vendas de produtos indisponíveis e ajuda no planejamento de compras.',
          completed: hasInventory,
          skipped: skippedSteps['inventory'] || false,
          videoUrl: '/videos/onboarding-inventory.mp4',
          videoDescription: 'Veja como cadastrar ingredientes e acompanhar o saldo automaticamente.',
        },
        {
          id: 'drivers',
          title: 'Cadastrar Entregadores',
          description: 'Adicione sua equipe de entrega para receber pedidos',
          icon: Truck,
          route: '/dashboard/drivers',
          tip: 'Os entregadores receberão notificações automáticas de novos pedidos e podem acompanhar em tempo real!',
          completed: hasDrivers,
          skipped: skippedSteps['drivers'] || false,
          videoUrl: '/videos/onboarding-drivers.mp4',
          videoDescription: 'Cadastre novos entregadores e veja como funciona o fluxo de ofertas.',
        },
        {
          id: 'payment',
          title: 'Configurar Pagamentos',
          description: 'Configure PIX, taxa de entrega e valor mínimo',
          icon: CreditCard,
          route: '/dashboard/store',
          tip: 'Configure seus dados de pagamento para começar a receber pelos pedidos. PIX é instantâneo e sem taxas!',
          completed: hasPaymentConfig,
          skipped: skippedSteps['payment'] || false,
          videoUrl: '/videos/onboarding-payment.mp4',
          videoDescription: 'Passo a passo para configurar PIX, taxas e valor mínimo de pedido.',
        },
        {
          id: 'publish',
          title: 'Publicar Menu',
          description: 'Deixe seu cardápio visível para os clientes',
          icon: Eye,
          route: '/dashboard/menu',
          tip: 'Após publicar, compartilhe o link da sua loja com clientes e nas redes sociais!',
          completed: isMenuPublished,
          skipped: skippedSteps['publish'] || false,
          videoUrl: '/videos/onboarding-publish.mp4',
          videoDescription: 'Veja como publicar o cardápio e testar o fluxo como cliente.',
        },
      ];

      setSteps(updatedSteps);

      // Find first incomplete step
      const firstIncomplete = updatedSteps.findIndex(s => !s.completed && !s.skipped);
      if (firstIncomplete !== -1) {
        setCurrentStepIndex(firstIncomplete);
      }

      // Show welcome modal only on first visit and if not all steps completed
      const allCompleted = updatedSteps.every(s => s.completed || s.skipped);
      if (!hasSeenOnboarding && !allCompleted) {
        setShowWelcome(true);
        localStorage.setItem(`onboarding_seen_${userId}`, 'true');
      }

      // Always show checklist banner if not all steps completed
      setShowChecklist(!allCompleted);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSkipStep = (stepId: string) => {
    const skippedSteps = JSON.parse(localStorage.getItem(`onboarding_skipped_${userId}`) || '{}');
    skippedSteps[stepId] = true;
    localStorage.setItem(`onboarding_skipped_${userId}`, JSON.stringify(skippedSteps));
    
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, skipped: true } : s));
    
    // Move to next incomplete step
    const nextIncomplete = steps.findIndex((s, i) => i > currentStepIndex && !s.completed && !s.skipped);
    if (nextIncomplete !== -1) {
      setCurrentStepIndex(nextIncomplete);
    }
    
    toast.success('Etapa marcada como pulada. Você pode voltar depois!');
  };

  const handleResetOnboarding = () => {
    localStorage.removeItem(`onboarding_skipped_${userId}`);
    checkOnboardingStatus();
    toast.success('Onboarding reiniciado!');
  };

  const completedCount = steps.filter(s => s.completed).length;
  const skippedCount = steps.filter(s => s.skipped && !s.completed).length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  const handleStartStep = (route: string) => {
    setShowWelcome(false);
    navigate(route);
  };

  const getNextStep = () => {
    return steps.find(s => !s.completed && !s.skipped);
  };

  if (loading || !showChecklist) {
    return null;
  }

  const nextStep = getNextStep();
  const currentStep = steps[currentStepIndex];

  return (
    <>
      {/* Welcome Modal - Enhanced */}
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-center pb-2">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-4 animate-scale-in">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <DialogTitle className="text-3xl font-display">
              Bem-vindo ao seu sistema! 🎉
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Sua loja foi criada com sucesso! Vamos configurar tudo em {steps.length} passos simples para você começar a receber pedidos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
              <p className="text-sm text-center font-medium mb-2">
                ⚡ Tempo estimado: 10-15 minutos
              </p>
              <p className="text-xs text-center text-muted-foreground">
                Você pode pular etapas e voltar depois quando quiser
              </p>
            </div>

            <div className="space-y-3">
              {steps.map((step, index) => (
                <Card
                  key={step.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    step.completed
                      ? 'border-primary/30 bg-primary/5'
                      : index === currentStepIndex
                      ? 'border-primary/50 ring-2 ring-primary/20'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => handleStartStep(step.route)}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        step.completed
                          ? 'bg-primary text-primary-foreground'
                          : index === currentStepIndex
                          ? 'bg-primary/20 text-primary ring-2 ring-primary/30'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {step.completed ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : (
                        <step.icon className="h-6 w-6" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold flex items-center gap-1">
                          {step.title}
                          {step.videoUrl && (
                            <HoverCard openDelay={150}>
                              <HoverCardTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center rounded-full border border-border/60 bg-background/60 p-1 text-[10px] text-muted-foreground hover-scale"
                                  aria-label={`Ver dica em vídeo de ${step.title}`}
                                >
                                  <PlayCircle className="h-3 w-3" />
                                </button>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-80">
                                <p className="text-xs font-medium mb-2">
                                  {step.videoDescription || 'Veja rapidamente como completar esta etapa.'}
                                </p>
                                <div className="rounded-md overflow-hidden bg-muted aspect-video">
                                  <video
                                    src={step.videoUrl}
                                    className="w-full h-full object-cover"
                                    autoPlay
                                    muted
                                    loop
                                  />
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          )}
                        </p>
                        {index === currentStepIndex && (
                          <Badge variant="default" className="text-xs">
                            Próximo
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                      <div className="flex items-start gap-2 mt-2">
                        <Lightbulb className="h-3 w-3 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">{step.tip}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {nextStep && (
              <Button
                className="w-full gradient-primary"
                size="lg"
                onClick={() => handleStartStep(nextStep.route)}
              >
                Começar Agora: {nextStep.title}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowWelcome(false)}
            >
              Fazer isso depois
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Checklist Banner */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-secondary/5">
        <CardContent className="p-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Progress Section */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Configure sua loja</h3>
                  <p className="text-xs text-muted-foreground">
                    Complete todos os passos para começar a receber pedidos
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-sm">
                    {completedCount}/{steps.length}
                  </Badge>
                  {skippedCount > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {skippedCount} puladas
                    </Badge>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">
                  {Math.round(progress)}% concluído
                </p>
              </div>
            </div>

            {/* Steps Pills */}
            <div className="flex flex-wrap gap-2">
              {steps.map((step) => (
                <Button
                  key={step.id}
                  variant={step.completed ? 'default' : step.skipped ? 'outline' : 'outline'}
                  size="sm"
                  className={
                    step.completed
                      ? 'bg-primary/90 hover:bg-primary'
                      : step.skipped
                      ? 'opacity-60'
                      : ''
                  }
                  onClick={() => navigate(step.route)}
                >
                  {step.completed ? (
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                  ) : step.skipped ? (
                    <SkipForward className="h-4 w-4 mr-1" />
                  ) : (
                    <step.icon className="h-4 w-4 mr-1" />
                  )}
                  {step.title}
                </Button>
              ))}
            </div>
          </div>

          {/* Current Step Section */}
          {currentStep && !currentStep.completed && !currentStep.skipped && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <Lightbulb className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-foreground">
                        Próximo passo: {currentStep.title}
                      </p>
                      {currentStep.videoUrl && (
                        <HoverCard openDelay={150}>
                          <HoverCardTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center rounded-full border border-border/60 bg-background/60 p-1 text-[10px] text-muted-foreground hover-scale"
                              aria-label={`Ver vídeo explicativo de ${currentStep.title}`}
                            >
                              <PlayCircle className="h-3 w-3" />
                            </button>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80">
                            <p className="text-xs font-medium mb-2">
                              {currentStep.videoDescription || 'Veja rapidamente como completar esta configuração.'}
                            </p>
                            <div className="rounded-md overflow-hidden bg-muted aspect-video">
                              <video
                                src={currentStep.videoUrl}
                                className="w-full h-full object-cover"
                                autoPlay
                                muted
                                loop
                              />
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {currentStep.tip}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSkipStep(currentStep.id)}
                  >
                    <SkipForward className="h-4 w-4 mr-1" />
                    Pular
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => navigate(currentStep.route)}
                  >
                    Ir agora
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Reset option */}
          {(completedCount + skippedCount) > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={handleResetOnboarding}
              >
                Reiniciar onboarding
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
