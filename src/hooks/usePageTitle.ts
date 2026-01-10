import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, string> = {
  '/': 'Início',
  '/auth': 'Entrar',
  '/dashboard': 'Painel',
  '/dashboard/menu': 'Cardápio',
  '/dashboard/orders': 'Pedidos',
  '/dashboard/drivers': 'Entregadores',
  '/dashboard/coupons': 'Cupons',
  '/dashboard/store': 'Configurações da Loja',
  '/dashboard/settings': 'Configurações do Usuário',
  '/dashboard/plans': 'Planos',
  '/dashboard/help': 'Ajuda',
  '/driver': 'Login Entregador',
  '/driver/dashboard': 'Painel do Entregador',
  '/admin/companies': 'Admin - Empresas',
  '/order-history': 'Histórico de Pedidos',
};

export function usePageTitle(customTitle?: string) {
  const location = useLocation();

  useEffect(() => {
    const baseTitle = 'CardpOn';
    
    if (customTitle) {
      document.title = `${customTitle} | ${baseTitle}`;
      return;
    }

    const pageTitle = pageTitles[location.pathname];
    
    if (pageTitle) {
      document.title = `${pageTitle} | ${baseTitle}`;
    } else if (location.pathname.startsWith('/menu/')) {
      // Public menu pages will set their own title
      return;
    } else if (location.pathname.startsWith('/track/')) {
      document.title = `Rastrear Pedido | ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [location.pathname, customTitle]);
}
