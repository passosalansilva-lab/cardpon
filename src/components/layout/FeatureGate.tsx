import { ReactNode, useEffect, useState, useMemo } from 'react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Skeleton } from '@/components/ui/skeleton';
import { FeaturePurchaseModal } from '@/components/features/FeaturePurchaseModal';

interface FeatureGateProps {
  featureKey: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ featureKey, children, fallback }: FeatureGateProps) {
  const { checkFeatureAccessRPC, allFeatures, companyId, featurePricing } = useFeatureAccess();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  // Verificação via RPC no banco de dados (segura)
  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      setLoading(true);
      const access = await checkFeatureAccessRPC(featureKey);
      if (!cancelled) {
        setHasAccess(access);
        setLoading(false);
        // Se não tem acesso, mostra o modal automaticamente
        if (!access) {
          setShowPurchaseModal(true);
        }
      }
    };

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, [featureKey, checkFeatureAccessRPC]);

  // Buscar informações completas da feature incluindo pricing
  const featureInfo = useMemo(() => {
    const feature = allFeatures.find(f => f.key === featureKey);
    if (!feature) return null;

    // Buscar pricing desta feature
    const pricing = featurePricing.filter(p => p.feature_id === feature.id);

    return {
      ...feature,
      pricing,
    };
  }, [allFeatures, featureKey, featurePricing]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Mostra o modal de compra quando não tem acesso
  return (
    <>
      <FeaturePurchaseModal
        open={showPurchaseModal}
        onOpenChange={setShowPurchaseModal}
        feature={featureInfo}
        companyId={companyId}
        onPurchaseComplete={() => {
          setShowPurchaseModal(false);
          // Recarregar página para verificar acesso novamente
          window.location.reload();
        }}
      />
      {/* Fallback visual enquanto o modal está aberto */}
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="text-center text-muted-foreground">
          <p>Verificando acesso à funcionalidade...</p>
        </div>
      </div>
    </>
  );
}
