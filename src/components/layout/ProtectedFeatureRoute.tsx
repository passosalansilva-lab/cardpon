import { ReactNode, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { FeaturePurchaseModal } from '@/components/features/FeaturePurchaseModal';

interface ProtectedFeatureRouteProps {
  featureKey: string;
  children: ReactNode;
}

/**
 * Protege uma rota por feature.
 * - Se tem acesso: mostra o conteúdo
 * - Se não tem acesso E feature tem preço: mostra modal de compra
 * - Se não tem acesso E feature não tem preço: redireciona para planos
 */
export function ProtectedFeatureRoute({ featureKey, children }: ProtectedFeatureRouteProps) {
  const navigate = useNavigate();
  const { 
    checkFeatureAccessRPC, 
    getFeaturePrice, 
    allFeatures, 
    featurePricing,
    companyId,
    loading 
  } = useFeatureAccess();
  
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  // Buscar informações completas da feature incluindo pricing
  const featureInfo = useMemo(() => {
    const feature = allFeatures.find(f => f.key === featureKey);
    if (!feature) return null;

    const pricing = featurePricing.filter(p => p.feature_id === feature.id);

    return {
      ...feature,
      pricing,
    };
  }, [allFeatures, featureKey, featurePricing]);

  useEffect(() => {
    if (loading) return;

    let cancelled = false;

    (async () => {
      const ok = await checkFeatureAccessRPC(featureKey);
      if (cancelled) return;

      setHasAccess(ok);

      if (!ok) {
        // Verificar se a feature tem preço configurado
        const featurePrice = getFeaturePrice(featureKey);
        
        if (featurePrice) {
          // Tem preço → mostrar modal de compra
          setShowPurchaseModal(true);
        } else {
          // Não tem preço → redirecionar para planos
          toast.error('Funcionalidade disponível apenas em planos superiores');
          navigate('/dashboard/plans');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [featureKey, checkFeatureAccessRPC, getFeaturePrice, navigate, loading]);

  // Se ainda está verificando ou tem acesso, mostra o conteúdo
  if (hasAccess === null || hasAccess) {
    return <>{children}</>;
  }

  // Se não tem acesso e feature tem preço, mostra o modal
  return (
    <>
      <FeaturePurchaseModal
        open={showPurchaseModal}
        onOpenChange={(open) => {
          setShowPurchaseModal(open);
          if (!open) {
            // Se fechar o modal sem comprar, volta para o dashboard
            navigate('/dashboard');
          }
        }}
        feature={featureInfo}
        companyId={companyId}
        onPurchaseComplete={() => {
          setShowPurchaseModal(false);
          window.location.reload();
        }}
      />
      {/* Conteúdo de fundo enquanto o modal está aberto */}
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="text-center text-muted-foreground">
          <p>Verificando acesso...</p>
        </div>
      </div>
    </>
  );
}
