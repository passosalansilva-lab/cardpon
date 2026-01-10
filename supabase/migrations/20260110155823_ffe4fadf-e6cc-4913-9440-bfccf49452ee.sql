-- Adicionar novas funcionalidades que faltam no sistema
INSERT INTO public.system_features (key, name, description, category, is_active) VALUES
  ('dashboard', 'Dashboard', 'Painel principal com métricas e relatórios', 'Principal', true),
  ('orders', 'Pedidos', 'Gestão de pedidos da loja', 'Principal', true),
  ('kds', 'Cozinha (KDS)', 'Tela de exibição para cozinha', 'Principal', true),
  ('store_settings', 'Dados da Loja', 'Configurações e informações da loja', 'Minha Loja', true),
  ('menu', 'Cardápio', 'Gestão do cardápio e produtos', 'Minha Loja', true),
  ('inventory', 'Estoque', 'Controle de estoque e ingredientes', 'Minha Loja', true),
  ('plans', 'Planos', 'Visualização de planos e assinatura', 'Configurações', true),
  ('notifications', 'Notificações', 'Central de notificações', 'Configurações', true),
  ('notification_sounds', 'Sons e Alertas', 'Configuração de sons de notificação', 'Configurações', true),
  ('settings', 'Configurações', 'Configurações gerais do usuário', 'Configurações', true),
  ('help', 'Ajuda', 'Central de ajuda e suporte', 'Suporte', true)
ON CONFLICT (key) DO NOTHING;