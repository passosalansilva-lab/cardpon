import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: ("super_admin" | "store_owner" | "delivery_driver" | "store_staff")[];
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Drivers should go to driver login
    if (location.pathname.startsWith('/driver')) {
      return <Navigate to="/driver/login" state={{ from: location }} replace />;
    }
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  const isDriver = hasRole('delivery_driver');
  const isStoreOwner = hasRole('store_owner');
  const isSuperAdmin = hasRole('super_admin');
  const isOnDriverRoute = location.pathname.startsWith('/driver');
  const isOnDashboardRoute = location.pathname.startsWith('/dashboard');

  // If user is ONLY a driver (not store owner or admin) and trying to access dashboard routes
  if (isDriver && !isStoreOwner && !isSuperAdmin && isOnDashboardRoute) {
    return <Navigate to="/driver" replace />;
  }

  // If user is store owner or admin trying to access driver routes (optional - allow or block)
  // For now, we allow store owners to access driver dashboard if needed

  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some((role) => hasRole(role));
    if (!hasRequiredRole) {
      // Redirect based on user role
      if (isDriver && !isStoreOwner && !isSuperAdmin) {
        return <Navigate to="/driver" replace />;
      }
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}