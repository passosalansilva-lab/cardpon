-- =====================================================
-- SCRIPT DE EXPORTAÇÃO DE DADOS - CARDAPIO ON
-- Execute este script no SQL Editor do novo Supabase
-- =====================================================

-- 1. SUBSCRIPTION PLANS
INSERT INTO subscription_plans (id, key, name, description, price, order_limit, revenue_limit, features, stripe_product_id, stripe_price_id, is_active, sort_order, created_at, updated_at) VALUES
('899f2a32-2b8d-4902-bf57-a231db994ebb', 'free', 'Plano Gratuito', 'Ideal para começar e testar a plataforma sem custos.', 0, 1000, 2000, '["Todas as funcionalidades liberadas", "Cardápio online ilimitado", "Gestão completa de pedidos", "Entregadores ilimitados", "Cupons e promoções", "Relatórios de vendas"]', 'prod_ThCYaYvlfk3ek3', 'price_1Sjo9FCjIGOfNgffTwiE6FEO', true, 0, '2025-12-29 21:38:42.122215+00', '2025-12-31 21:50:07.999448+00'),
('9c010e1c-6918-4ca9-b543-c7112cead2ee', 'basic', 'Plano Básico', 'Ideal para negócios em crescimento com demanda estável.', 99, 2500, 10000, '["Todas as funcionalidades liberadas", "Cardápio online ilimitado", "Gestão completa de pedidos", "Entregadores ilimitados", "Cupons e promoções", "Relatórios de vendas"]', 'prod_ThCYghPuYze1KC', 'price_1Sjo9HCjIGOfNgffcvJK0CIm', true, 2, '2025-12-29 21:38:44.078106+00', '2025-12-29 22:26:08.483168+00'),
('d2c8d247-8c87-4374-a65a-a53002645406', 'growth', 'Plano Crescimento', 'Para operações em expansão que precisam de mais volume.', 149, 4000, 30000, '["Todas as funcionalidades liberadas", "Cardápio online ilimitado", "Gestão completa de pedidos", "Entregadores ilimitados", "Cupons e promoções", "Relatórios de vendas"]', 'prod_ThCY0J7TEflKl0', 'price_1Sjo9ICjIGOfNgffZ8113G9I', true, 3, '2025-12-29 21:38:45.038448+00', '2025-12-29 22:26:08.483168+00'),
('ceb91aa0-db97-4467-9c26-8728c8e554a1', 'pro', 'Plano Pro', 'Para operações intensas com alto volume de vendas.', 199, 6000, 50000, '["Todas as funcionalidades liberadas", "Cardápio online ilimitado", "Gestão completa de pedidos", "Entregadores ilimitados", "Cupons e promoções", "Relatórios de vendas"]', 'prod_ThCYcLo2HwNKAK', 'price_1Sjo9JCjIGOfNgffCQVNpPJi', true, 4, '2025-12-29 21:38:46.009046+00', '2025-12-29 22:26:08.483168+00')
ON CONFLICT (id) DO UPDATE SET
  key = EXCLUDED.key,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  order_limit = EXCLUDED.order_limit,
  revenue_limit = EXCLUDED.revenue_limit,
  features = EXCLUDED.features,
  stripe_product_id = EXCLUDED.stripe_product_id,
  stripe_price_id = EXCLUDED.stripe_price_id,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- 2. SYSTEM FEATURES
INSERT INTO system_features (id, key, name, description, category, icon, is_active, created_at, updated_at) VALUES
('4170f7a2-98df-4a42-8151-8e74f6fc5581', 'delivery_map', 'Mapa de Entregas', 'Visualização em tempo real das entregas no mapa', 'Cardápio', 'Globe', true, '2025-12-31 21:11:30.464107+00', '2025-12-31 22:10:53.707655+00'),
('a0ede291-ecbb-4a90-9ea7-d8bd4d817115', 'nfe', 'NF-e / NFC-e', 'Emissão de notas fiscais eletrônicas integrada ao sistema', 'Minha Loja', 'FileText', false, '2025-12-31 21:11:30.464107+00', '2026-01-03 02:11:04.77346+00'),
('9ae55857-25d9-4452-b6b6-bf8a4e21f41f', 'tables', 'Mesas e QR Code', 'Gestão de mesas para atendimento presencial com QR Code', 'Principal', 'LayoutGrid', true, '2025-12-31 21:11:30.464107+00', '2025-12-31 21:43:50.766289+00'),
('5eeb169d-83c9-4759-8a47-ba91823e64fe', 'coupons', 'Cupons de Desconto', 'Sistema de cupons promocionais', 'Marketing', 'Package', true, '2025-12-31 21:11:30.464107+00', '2025-12-31 21:43:50.766289+00'),
('e18e50bb-f3ad-4cdd-9542-a6298a4fca5e', 'promotions', 'Promoções', 'Criação de promoções e ofertas especiais', 'Marketing', 'Package', true, '2025-12-31 21:11:30.464107+00', '2025-12-31 21:43:50.766289+00'),
('8a721754-f17a-4db9-9f2f-5cb2be6b7530', 'push_notifications', 'Notificações Push', 'Envio de notificações promocionais para clientes', 'Marketing', 'MessageCircle', true, '2025-12-31 21:11:30.464107+00', '2025-12-31 21:43:50.766289+00'),
('6efbdb11-fb74-4593-97c9-dd94572d31b5', 'referrals', 'Programa de Indicação', 'Sistema de indicação com recompensas', 'Marketing', 'Package', true, '2025-12-31 21:11:30.464107+00', '2025-12-31 21:43:50.766289+00'),
('add96755-3e41-44a2-87b5-9bcdeeca92cb', 'drivers', 'Gestão de Entregadores', 'Controle de entregadores com rastreamento em tempo real', 'Operações', 'Truck', true, '2025-12-31 21:11:30.464107+00', '2025-12-31 21:43:50.766289+00'),
('039c0e8d-6a36-4d18-aa6b-efc3c913fc5f', 'staff', 'Gestão de Funcionários', 'Controle de funcionários com permissões granulares', 'Operações', 'Building', true, '2025-12-31 21:11:30.464107+00', '2025-12-31 21:43:50.766289+00'),
('990929f5-0937-4aa4-bd7d-6328c9421396', 'reviews', 'Sistema de Avaliações', 'Gestão de avaliações e feedback dos clientes', 'Operações', 'MessageCircle', true, '2025-12-31 21:11:30.464107+00', '2025-12-31 21:43:50.766289+00'),
('7976b58b-3e42-4a38-b1fc-467810417cdf', 'pos', 'PDV / Caixa', 'Ponto de venda para pedidos manuais', 'Operações', 'LayoutGrid', true, '2025-12-31 21:11:30.464107+00', '2025-12-31 21:43:50.766289+00'),
('ed52c0a4-bae7-42e2-9c1d-53fa4420784c', 'activity_logs', 'Logs de Atividade', 'Auditoria completa de todas as ações no sistema', 'Configurações', 'FileText', true, '2025-12-31 21:11:30.464107+00', '2025-12-31 21:43:50.766289+00'),
('90e78303-3d4d-432c-9866-69cc2db55805', 'pizza_config', 'Configuração de Pizzas', 'Sistema completo de pizzas com meio a meio, bordas e tamanhos', 'Cardápio', 'LayoutGrid', true, '2025-12-31 21:11:30.464107+00', '2025-12-31 21:43:50.766289+00'),
('8c139bfe-2423-466e-987d-8af61d5a89a7', 'acai_config', 'Configuração de Açaí', 'Sistema de montagem de açaí com complementos e tamanhos', 'Cardápio', 'LayoutGrid', true, '2025-12-31 21:11:30.464107+00', '2025-12-31 21:43:50.766289+00'),
('68cfa489-ef03-4d37-93e4-feb411cbfce6', 'combos', 'Sistema de Combos', 'Criação de combos e kits promocionais', 'Cardápio', 'Package', true, '2025-12-31 21:11:30.464107+00', '2025-12-31 21:43:50.766289+00'),
('14ad4786-4c9f-4a85-8c7e-bec92e3ebc64', 'day_periods', 'Períodos do Dia', 'Categorias disponíveis apenas em horários específicos', 'Cardápio', 'LayoutGrid', true, '2025-12-31 21:11:30.464107+00', '2025-12-31 21:43:50.766289+00')
ON CONFLICT (id) DO UPDATE SET
  key = EXCLUDED.key,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active;

-- 3. FEATURE PRICING
INSERT INTO feature_pricing (id, feature_id, price_type, price, is_active, created_at, updated_at) VALUES
('c7e8c103-86ac-4dd0-b4dd-e79bb96c164e', '4170f7a2-98df-4a42-8151-8e74f6fc5581', 'monthly', 0, true, '2025-12-31 22:11:54.908104+00', '2025-12-31 22:13:08.804301+00'),
('444d2632-8047-4416-9b32-49603f55768a', 'a0ede291-ecbb-4a90-9ea7-d8bd4d817115', 'one_time', 15, true, '2025-12-31 22:23:52.972134+00', '2025-12-31 22:24:55.908156+00'),
('608f2ce6-bc07-4d3e-a770-3ad5cdc51d9b', '90e78303-3d4d-432c-9866-69cc2db55805', 'one_time', 5, true, '2025-12-31 22:39:57.008803+00', '2025-12-31 22:39:57.008803+00'),
('c973dffc-823c-4a02-965b-c059e23bfe51', 'ed52c0a4-bae7-42e2-9c1d-53fa4420784c', 'monthly', 0, true, '2025-12-31 22:58:37.920105+00', '2025-12-31 22:58:37.920105+00')
ON CONFLICT (id) DO UPDATE SET
  feature_id = EXCLUDED.feature_id,
  price_type = EXCLUDED.price_type,
  price = EXCLUDED.price,
  is_active = EXCLUDED.is_active;

-- 4. SYSTEM SETTINGS (URLs precisam ser atualizadas para o novo projeto)
-- NOTA: Atualize as URLs para apontar para o storage do novo projeto Supabase
INSERT INTO system_settings (id, key, value, created_at, updated_at) VALUES
('9efaabfa-2e09-4de9-a975-0772c888c1aa', 'system_logo', 'https://SEU-PROJECT-ID.supabase.co/storage/v1/object/public/images/system/system-logo.png', '2026-01-01 17:40:48.760565+00', '2026-01-02 11:34:47.881843+00'),
('4bb32109-ce83-442e-be17-8060a988572c', 'logo_landing', 'https://SEU-PROJECT-ID.supabase.co/storage/v1/object/public/images/system/logo_landing.png', '2026-01-02 11:38:35.158621+00', '2026-01-02 11:45:43.645351+00'),
('0ccc5a22-ecb8-488c-be2a-59a7b8a0e533', 'logo_sidebar', 'https://SEU-PROJECT-ID.supabase.co/storage/v1/object/public/images/system/logo_sidebar.png', '2026-01-02 11:42:57.568351+00', '2026-01-02 11:59:11.456123+00'),
('c876b873-7a3e-4ce5-b541-e8f9e0196550', 'logo_public_menu', 'https://SEU-PROJECT-ID.supabase.co/storage/v1/object/public/images/system/logo_public_menu.png', '2026-01-03 02:12:27.618791+00', '2026-01-03 02:12:27.618791+00')
ON CONFLICT (id) DO UPDATE SET
  key = EXCLUDED.key,
  value = EXCLUDED.value;

-- 5. PLAN FEATURES (associação plano <-> funcionalidades)
-- Primeiro limpar dados existentes para evitar duplicatas
DELETE FROM plan_features;

-- Plano Básico (9c010e1c-6918-4ca9-b543-c7112cead2ee)
INSERT INTO plan_features (plan_id, feature_id) VALUES
('9c010e1c-6918-4ca9-b543-c7112cead2ee', '9ae55857-25d9-4452-b6b6-bf8a4e21f41f'),
('9c010e1c-6918-4ca9-b543-c7112cead2ee', 'add96755-3e41-44a2-87b5-9bcdeeca92cb'),
('9c010e1c-6918-4ca9-b543-c7112cead2ee', '039c0e8d-6a36-4d18-aa6b-efc3c913fc5f'),
('9c010e1c-6918-4ca9-b543-c7112cead2ee', '5eeb169d-83c9-4759-8a47-ba91823e64fe'),
('9c010e1c-6918-4ca9-b543-c7112cead2ee', 'e18e50bb-f3ad-4cdd-9542-a6298a4fca5e'),
('9c010e1c-6918-4ca9-b543-c7112cead2ee', '990929f5-0937-4aa4-bd7d-6328c9421396'),
('9c010e1c-6918-4ca9-b543-c7112cead2ee', '8a721754-f17a-4db9-9f2f-5cb2be6b7530'),
('9c010e1c-6918-4ca9-b543-c7112cead2ee', '6efbdb11-fb74-4593-97c9-dd94572d31b5'),
('9c010e1c-6918-4ca9-b543-c7112cead2ee', '90e78303-3d4d-432c-9866-69cc2db55805'),
('9c010e1c-6918-4ca9-b543-c7112cead2ee', '8c139bfe-2423-466e-987d-8af61d5a89a7'),
('9c010e1c-6918-4ca9-b543-c7112cead2ee', '68cfa489-ef03-4d37-93e4-feb411cbfce6'),
('9c010e1c-6918-4ca9-b543-c7112cead2ee', 'ed52c0a4-bae7-42e2-9c1d-53fa4420784c'),
('9c010e1c-6918-4ca9-b543-c7112cead2ee', '14ad4786-4c9f-4a85-8c7e-bec92e3ebc64'),
('9c010e1c-6918-4ca9-b543-c7112cead2ee', '4170f7a2-98df-4a42-8151-8e74f6fc5581'),
('9c010e1c-6918-4ca9-b543-c7112cead2ee', '7976b58b-3e42-4a38-b1fc-467810417cdf');

-- Plano Crescimento (d2c8d247-8c87-4374-a65a-a53002645406)
INSERT INTO plan_features (plan_id, feature_id) VALUES
('d2c8d247-8c87-4374-a65a-a53002645406', '9ae55857-25d9-4452-b6b6-bf8a4e21f41f'),
('d2c8d247-8c87-4374-a65a-a53002645406', 'add96755-3e41-44a2-87b5-9bcdeeca92cb'),
('d2c8d247-8c87-4374-a65a-a53002645406', '039c0e8d-6a36-4d18-aa6b-efc3c913fc5f'),
('d2c8d247-8c87-4374-a65a-a53002645406', '5eeb169d-83c9-4759-8a47-ba91823e64fe'),
('d2c8d247-8c87-4374-a65a-a53002645406', 'e18e50bb-f3ad-4cdd-9542-a6298a4fca5e'),
('d2c8d247-8c87-4374-a65a-a53002645406', '990929f5-0937-4aa4-bd7d-6328c9421396'),
('d2c8d247-8c87-4374-a65a-a53002645406', '8a721754-f17a-4db9-9f2f-5cb2be6b7530'),
('d2c8d247-8c87-4374-a65a-a53002645406', '6efbdb11-fb74-4593-97c9-dd94572d31b5'),
('d2c8d247-8c87-4374-a65a-a53002645406', '90e78303-3d4d-432c-9866-69cc2db55805'),
('d2c8d247-8c87-4374-a65a-a53002645406', '8c139bfe-2423-466e-987d-8af61d5a89a7'),
('d2c8d247-8c87-4374-a65a-a53002645406', '68cfa489-ef03-4d37-93e4-feb411cbfce6'),
('d2c8d247-8c87-4374-a65a-a53002645406', 'ed52c0a4-bae7-42e2-9c1d-53fa4420784c'),
('d2c8d247-8c87-4374-a65a-a53002645406', '14ad4786-4c9f-4a85-8c7e-bec92e3ebc64'),
('d2c8d247-8c87-4374-a65a-a53002645406', '4170f7a2-98df-4a42-8151-8e74f6fc5581'),
('d2c8d247-8c87-4374-a65a-a53002645406', '7976b58b-3e42-4a38-b1fc-467810417cdf');

-- Plano Pro (ceb91aa0-db97-4467-9c26-8728c8e554a1)
INSERT INTO plan_features (plan_id, feature_id) VALUES
('ceb91aa0-db97-4467-9c26-8728c8e554a1', '9ae55857-25d9-4452-b6b6-bf8a4e21f41f'),
('ceb91aa0-db97-4467-9c26-8728c8e554a1', 'add96755-3e41-44a2-87b5-9bcdeeca92cb'),
('ceb91aa0-db97-4467-9c26-8728c8e554a1', '039c0e8d-6a36-4d18-aa6b-efc3c913fc5f'),
('ceb91aa0-db97-4467-9c26-8728c8e554a1', '5eeb169d-83c9-4759-8a47-ba91823e64fe'),
('ceb91aa0-db97-4467-9c26-8728c8e554a1', 'e18e50bb-f3ad-4cdd-9542-a6298a4fca5e'),
('ceb91aa0-db97-4467-9c26-8728c8e554a1', '990929f5-0937-4aa4-bd7d-6328c9421396'),
('ceb91aa0-db97-4467-9c26-8728c8e554a1', '8a721754-f17a-4db9-9f2f-5cb2be6b7530'),
('ceb91aa0-db97-4467-9c26-8728c8e554a1', '6efbdb11-fb74-4593-97c9-dd94572d31b5'),
('ceb91aa0-db97-4467-9c26-8728c8e554a1', '90e78303-3d4d-432c-9866-69cc2db55805'),
('ceb91aa0-db97-4467-9c26-8728c8e554a1', '8c139bfe-2423-466e-987d-8af61d5a89a7'),
('ceb91aa0-db97-4467-9c26-8728c8e554a1', '68cfa489-ef03-4d37-93e4-feb411cbfce6'),
('ceb91aa0-db97-4467-9c26-8728c8e554a1', 'ed52c0a4-bae7-42e2-9c1d-53fa4420784c'),
('ceb91aa0-db97-4467-9c26-8728c8e554a1', '14ad4786-4c9f-4a85-8c7e-bec92e3ebc64'),
('ceb91aa0-db97-4467-9c26-8728c8e554a1', '4170f7a2-98df-4a42-8151-8e74f6fc5581'),
('ceb91aa0-db97-4467-9c26-8728c8e554a1', '7976b58b-3e42-4a38-b1fc-467810417cdf');

-- =====================================================
-- NOTA IMPORTANTE:
-- Este script exporta apenas os dados de configuração do sistema.
-- Dados de empresas, pedidos, clientes, produtos, etc. NÃO são exportados
-- pois são dados específicos de cada instalação.
--
-- Para exportar dados completos, use:
-- pg_dump --data-only --no-owner --no-privileges DATABASE_URL > backup.sql
-- =====================================================
