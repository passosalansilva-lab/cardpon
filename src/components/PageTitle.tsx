import { usePageTitle } from '@/hooks/usePageTitle';

interface PageTitleProps {
  children: React.ReactNode;
}

export function PageTitle({ children }: PageTitleProps) {
  usePageTitle();
  return <>{children}</>;
}
