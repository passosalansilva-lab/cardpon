CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'super_admin',
    'store_owner',
    'delivery_driver',
    'store_staff'
);


--
-- Name: company_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.company_status AS ENUM (
    'pending',
    'approved',
    'suspended'
);


--
-- Name: option_group_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.option_group_kind AS ENUM (
    'crust',
    'addon',
    'generic'
);


--
-- Name: option_group_scope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.option_group_scope AS ENUM (
    'global',
    'product'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'awaiting_driver',
    'out_for_delivery',
    'delivered',
    'cancelled'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'online',
    'cash',
    'card_on_delivery',
    'pix'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'paid',
    'failed',
    'refunded'
);


--
-- Name: pizza_price_rule; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pizza_price_rule AS ENUM (
    'higher_price',
    'average_price',
    'fixed_price'
);


--
-- Name: product_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.product_type AS ENUM (
    'principal',
    'pizza'
);


--
-- Name: apply_inventory_on_order_confirm(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_inventory_on_order_confirm() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  rec record;
BEGIN
  -- Só age quando muda para confirmed
  IF NEW.status = 'confirmed' AND (OLD IS NULL OR OLD.status <> 'confirmed') THEN
    FOR rec IN
      WITH item_units AS (
        -- Itens normais (sem metadados de meio a meio)
        SELECT 
          oi.id AS order_item_id,
          oi.product_id,
          oi.quantity::numeric AS units
        FROM public.order_items oi
        WHERE oi.order_id = NEW.id
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(COALESCE(oi.options, '[]'::jsonb)) opt
            WHERE opt ? 'half_half_flavor_product_ids'
          )
        UNION ALL
        -- Itens meio a meio: distribui a quantidade igualmente entre os sabores
        SELECT 
          oi.id AS order_item_id,
          (flavor_id)::uuid AS product_id,
          (oi.quantity::numeric / NULLIF(jsonb_array_length(meta_opt->'half_half_flavor_product_ids'), 0)) AS units
        FROM public.order_items oi
        CROSS JOIN LATERAL (
          SELECT opt AS meta_opt
          FROM jsonb_array_elements(COALESCE(oi.options, '[]'::jsonb)) opt
          WHERE opt ? 'half_half_flavor_product_ids'
          LIMIT 1
        ) meta
        CROSS JOIN LATERAL jsonb_array_elements_text(meta_opt->'half_half_flavor_product_ids') AS flavor_id
        WHERE oi.order_id = NEW.id
      )
      SELECT 
        ipi.ingredient_id,
        i.company_id,
        SUM(ipi.quantity_per_unit * iu.units) AS total_qty
      FROM item_units iu
      JOIN public.products p ON p.id = iu.product_id
      JOIN public.inventory_product_ingredients ipi ON ipi.product_id = p.id
      JOIN public.inventory_ingredients i ON i.id = ipi.ingredient_id
      GROUP BY ipi.ingredient_id, i.company_id
    LOOP
      -- atualiza estoque (saída)
      UPDATE public.inventory_ingredients
      SET current_stock = current_stock - rec.total_qty,
          updated_at = now()
      WHERE id = rec.ingredient_id;

      -- registra movimento de consumo
      INSERT INTO public.inventory_movements (
        company_id,
        ingredient_id,
        movement_type,
        quantity,
        unit_cost,
        related_order_id,
        note
      ) VALUES (
        rec.company_id,
        rec.ingredient_id,
        'consumption',
        -rec.total_qty,
        NULL,
        NEW.id,
        'Consumo por pedido confirmado'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: apply_inventory_purchase(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_inventory_purchase() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  old_stock numeric;
  old_cost numeric;
BEGIN
  SELECT current_stock, average_unit_cost
  INTO old_stock, old_cost
  FROM public.inventory_ingredients
  WHERE id = NEW.ingredient_id
  FOR UPDATE;

  IF old_stock IS NULL THEN
    old_stock := 0;
  END IF;
  IF old_cost IS NULL THEN
    old_cost := 0;
  END IF;

  -- novo custo médio ponderado
  IF (old_stock + NEW.quantity) > 0 THEN
    UPDATE public.inventory_ingredients
    SET current_stock = old_stock + NEW.quantity,
        average_unit_cost = ((old_stock * old_cost) + (NEW.quantity * NEW.unit_cost)) / (old_stock + NEW.quantity),
        updated_at = now()
    WHERE id = NEW.ingredient_id;
  ELSE
    UPDATE public.inventory_ingredients
    SET current_stock = old_stock + NEW.quantity,
        updated_at = now()
    WHERE id = NEW.ingredient_id;
  END IF;

  -- registra movimento de entrada
  INSERT INTO public.inventory_movements (
    company_id,
    ingredient_id,
    movement_type,
    quantity,
    unit_cost,
    note
  ) VALUES (
    NEW.company_id,
    NEW.ingredient_id,
    'purchase',
    NEW.quantity,
    NEW.unit_cost,
    'Compra de ingrediente'
  );

  RETURN NEW;
END;
$$;


--
-- Name: auto_assign_driver(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_assign_driver() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  available_driver_id uuid;
BEGIN
  -- Only trigger when status changes to 'awaiting_driver' and no driver assigned
  IF NEW.status = 'awaiting_driver' AND NEW.delivery_driver_id IS NULL THEN
    -- Find first available driver for this company
    SELECT id INTO available_driver_id
    FROM delivery_drivers
    WHERE company_id = NEW.company_id
      AND is_active = true
      AND is_available = true
      AND driver_status = 'available'
    ORDER BY updated_at ASC -- FIFO - first available gets it
    LIMIT 1;
    
    -- Assign driver if found
    IF available_driver_id IS NOT NULL THEN
      NEW.delivery_driver_id := available_driver_id;
      
      -- Update driver status to pending_acceptance (waiting for driver to accept)
      UPDATE delivery_drivers
      SET driver_status = 'pending_acceptance',
          is_available = false,
          updated_at = now()
      WHERE id = available_driver_id;
      
      -- Create notification for the driver
      INSERT INTO notifications (user_id, title, message, type, data)
      SELECT 
        dd.user_id,
        'Nova entrega disponível!',
        'Você tem uma nova entrega aguardando aceite. Pedido #' || LEFT(NEW.id::text, 8),
        'info',
        jsonb_build_object('type', 'new_delivery', 'order_id', NEW.id, 'company_id', NEW.company_id)
      FROM delivery_drivers dd
      WHERE dd.id = available_driver_id
        AND dd.user_id IS NOT NULL;
    END IF;
  END IF;
  
  -- When order is delivered, free up the driver
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' AND NEW.delivery_driver_id IS NOT NULL THEN
    UPDATE delivery_drivers
    SET driver_status = 'available',
        is_available = true,
        updated_at = now()
    WHERE id = NEW.delivery_driver_id;
  END IF;
  
  -- When order is cancelled, free up the driver
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' AND NEW.delivery_driver_id IS NOT NULL THEN
    UPDATE delivery_drivers
    SET driver_status = 'available',
        is_available = true,
        updated_at = now()
    WHERE id = NEW.delivery_driver_id;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: detect_bulk_customer_creation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.detect_bulk_customer_creation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Count customers created in last minute with same phone/email pattern
  SELECT COUNT(*) INTO recent_count
  FROM public.customers
  WHERE created_at > now() - interval '1 minute'
    AND (phone LIKE '%' || RIGHT(NEW.phone, 4) OR email LIKE '%' || NEW.email);
  
  -- If more than 10 similar customers in 1 minute, log warning
  IF recent_count > 10 THEN
    RAISE WARNING 'Possible bulk customer creation detected: % similar records in last minute', recent_count;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: ensure_default_pizza_settings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_default_pizza_settings() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only act when company niche is 'pizzaria'
  IF NEW.niche = 'pizzaria' THEN
    -- Create default settings only if they don't exist yet
    INSERT INTO public.pizza_settings (
      company_id,
      enable_half_half,
      enable_crust,
      enable_addons,
      allow_crust_extra_price,
      max_flavors
    )
    SELECT
      NEW.id,
      true,          -- meio a meio ativado por padrão
      true,          -- borda ativada por padrão
      true,          -- adicionais ativados por padrão
      true,          -- permitir preço extra de borda
      2              -- número máximo de sabores (mantém padrão atual)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.pizza_settings ps WHERE ps.company_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: get_user_company_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_company_id(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT id FROM public.companies WHERE owner_id = _user_id LIMIT 1
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'phone'
  );
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: has_staff_permission(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_staff_permission(_user_id uuid, _company_id uuid, _permission text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE _permission
    WHEN 'orders' THEN COALESCE((SELECT can_manage_orders FROM staff_permissions WHERE user_id = _user_id AND company_id = _company_id), false)
    WHEN 'menu' THEN COALESCE((SELECT can_manage_menu FROM staff_permissions WHERE user_id = _user_id AND company_id = _company_id), false)
    WHEN 'inventory' THEN COALESCE((SELECT can_manage_inventory FROM staff_permissions WHERE user_id = _user_id AND company_id = _company_id), false)
    WHEN 'coupons' THEN COALESCE((SELECT can_manage_coupons FROM staff_permissions WHERE user_id = _user_id AND company_id = _company_id), false)
    WHEN 'promotions' THEN COALESCE((SELECT can_manage_promotions FROM staff_permissions WHERE user_id = _user_id AND company_id = _company_id), false)
    WHEN 'drivers' THEN COALESCE((SELECT can_manage_drivers FROM staff_permissions WHERE user_id = _user_id AND company_id = _company_id), false)
    WHEN 'reports' THEN COALESCE((SELECT can_view_reports FROM staff_permissions WHERE user_id = _user_id AND company_id = _company_id), false)
    WHEN 'reviews' THEN COALESCE((SELECT can_manage_reviews FROM staff_permissions WHERE user_id = _user_id AND company_id = _company_id), false)
    ELSE false
  END
$$;


--
-- Name: increment_company_order_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_company_order_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  company_record RECORD;
  order_limit INTEGER;
BEGIN
  -- Only increment when order is confirmed (status changes from pending to confirmed)
  IF NEW.status = 'confirmed' AND (OLD IS NULL OR OLD.status = 'pending') THEN
    -- Get company data
    SELECT 
      c.subscription_status, 
      c.subscription_plan,
      c.monthly_order_count,
      c.order_count_reset_date
    INTO company_record
    FROM companies c
    WHERE c.id = NEW.company_id;
    
    -- Reset count if new month
    IF company_record.order_count_reset_date IS NULL OR 
       date_trunc('month', company_record.order_count_reset_date) < date_trunc('month', now()) THEN
      UPDATE companies 
      SET monthly_order_count = 0, order_count_reset_date = now()
      WHERE id = NEW.company_id;
      company_record.monthly_order_count := 0;
    END IF;
    
    -- Determine order limit based on plan
    CASE company_record.subscription_plan
      WHEN 'basic' THEN order_limit := 2000;
      WHEN 'pro' THEN order_limit := 5000;
      WHEN 'enterprise' THEN order_limit := -1; -- unlimited
      ELSE order_limit := 1000; -- free plan
    END CASE;
    
    -- Check if limit exceeded (skip if unlimited)
    IF order_limit != -1 AND company_record.monthly_order_count >= order_limit THEN
      -- Create notification for company owner
      INSERT INTO notifications (user_id, title, message, type, data)
      SELECT 
        c.owner_id,
        'Limite de pedidos atingido!',
        'Você atingiu o limite de ' || order_limit || ' pedidos do seu plano. Faça upgrade para continuar recebendo pedidos.',
        'warning',
        jsonb_build_object('type', 'order_limit', 'plan', COALESCE(company_record.subscription_plan, 'free'))
      FROM companies c
      WHERE c.id = NEW.company_id;
      
      RAISE EXCEPTION 'Limite de pedidos do plano atingido. Faça upgrade para continuar.';
    END IF;
    
    -- Increment order count
    UPDATE companies 
    SET monthly_order_count = COALESCE(monthly_order_count, 0) + 1
    WHERE id = NEW.company_id;
    
    -- Notify when approaching limit (80%)
    IF order_limit != -1 AND (company_record.monthly_order_count + 1) >= (order_limit * 0.8) 
       AND (company_record.monthly_order_count + 1) < order_limit THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      SELECT 
        c.owner_id,
        'Você está próximo do limite!',
        'Você usou ' || (company_record.monthly_order_count + 1) || ' de ' || order_limit || ' pedidos do mês. Considere fazer upgrade.',
        'info',
        jsonb_build_object('type', 'order_limit_warning', 'usage', company_record.monthly_order_count + 1, 'limit', order_limit)
      FROM companies c
      WHERE c.id = NEW.company_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: increment_company_revenue(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_company_revenue() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  company_record RECORD;
  revenue_limit NUMERIC;
BEGIN
  -- Só incrementa quando o pedido é confirmado
  IF NEW.status = 'confirmed' AND (OLD IS NULL OR OLD.status = 'pending') THEN
    -- Buscar dados da empresa
    SELECT 
      c.subscription_status, 
      c.subscription_plan,
      c.monthly_revenue,
      c.revenue_reset_date
    INTO company_record
    FROM companies c
    WHERE c.id = NEW.company_id;
    
    -- Resetar faturamento se novo mês
    IF company_record.revenue_reset_date IS NULL OR 
       date_trunc('month', company_record.revenue_reset_date) < date_trunc('month', now()) THEN
      UPDATE companies 
      SET monthly_revenue = 0, revenue_reset_date = now()
      WHERE id = NEW.company_id;
      company_record.monthly_revenue := 0;
    END IF;
    
    -- Determinar limite de faturamento baseado no plano
    SELECT COALESCE(sp.revenue_limit, 2000)
    INTO revenue_limit
    FROM subscription_plans sp
    WHERE sp.key = COALESCE(company_record.subscription_plan, 'free')
    LIMIT 1;
    
    -- Se não encontrar plano, usar limite padrão
    IF revenue_limit IS NULL THEN
      revenue_limit := 2000;
    END IF;
    
    -- Verificar se atingiu o limite (skip se ilimitado)
    IF revenue_limit != -1 AND (company_record.monthly_revenue + NEW.total) > revenue_limit THEN
      -- Criar notificação
      INSERT INTO notifications (user_id, title, message, type, data)
      SELECT 
        c.owner_id,
        'Limite de faturamento atingido!',
        'Você atingiu o limite de R$ ' || revenue_limit || ' em vendas do seu plano. Faça upgrade para continuar recebendo pedidos.',
        'warning',
        jsonb_build_object('type', 'revenue_limit', 'plan', COALESCE(company_record.subscription_plan, 'free'))
      FROM companies c
      WHERE c.id = NEW.company_id;
      
      RAISE EXCEPTION 'Limite de faturamento do plano atingido (R$ %). Faça upgrade para continuar.', revenue_limit;
    END IF;
    
    -- Incrementar faturamento
    UPDATE companies 
    SET monthly_revenue = COALESCE(monthly_revenue, 0) + NEW.total
    WHERE id = NEW.company_id;
    
    -- Notificar quando estiver próximo do limite (80%)
    IF revenue_limit != -1 AND 
       (company_record.monthly_revenue + NEW.total) >= (revenue_limit * 0.8) AND
       (company_record.monthly_revenue + NEW.total) < revenue_limit THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      SELECT 
        c.owner_id,
        'Você está próximo do limite!',
        'Você já faturou R$ ' || ROUND(company_record.monthly_revenue + NEW.total, 2) || ' de R$ ' || revenue_limit || ' do mês. Considere fazer upgrade.',
        'info',
        jsonb_build_object(
          'type', 'revenue_limit_warning', 
          'revenue', company_record.monthly_revenue + NEW.total, 
          'limit', revenue_limit
        )
      FROM companies c
      WHERE c.id = NEW.company_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$_$;


--
-- Name: is_driver_for_company(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_driver_for_company(_user_id uuid, _company_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.delivery_drivers
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND is_active = true
  )
$$;


--
-- Name: link_customer_on_login(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_customer_on_login() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Update customer record with matching email or phone to link to this user
  UPDATE public.customers
  SET user_id = NEW.id,
      updated_at = now()
  WHERE (email = NEW.email OR phone = NEW.phone)
    AND user_id IS NULL;
  
  -- Also link addresses that were created with guest session
  -- This links addresses from previous guest orders if email matches
  UPDATE public.customer_addresses
  SET user_id = NEW.id
  WHERE user_id IS NULL 
    AND session_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.delivery_address_id = customer_addresses.id 
      AND orders.customer_email = NEW.email
    );
  
  RETURN NEW;
END;
$$;


--
-- Name: link_driver_on_login(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_driver_on_login() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Update any driver records with matching email to link to this user
  UPDATE public.delivery_drivers
  SET user_id = NEW.id,
      updated_at = now()
  WHERE email = NEW.email
    AND user_id IS NULL;
  
  -- Also add driver role if they were linked
  IF EXISTS (SELECT 1 FROM public.delivery_drivers WHERE user_id = NEW.id AND is_active = true) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'delivery_driver')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: notify_low_stock_inventory(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_low_stock_inventory() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_owner_id uuid;
  v_title text;
  v_message text;
BEGIN
  -- Dispara somente quando o estoque está abaixo do mínimo
  -- e (no caso de UPDATE) houve cruzamento de limite
  IF NEW.current_stock < NEW.min_stock AND (
    TG_OP = 'INSERT' OR
    OLD.current_stock IS NULL OR
    OLD.current_stock >= OLD.min_stock
  ) THEN
    SELECT owner_id
      INTO v_owner_id
    FROM public.companies
    WHERE id = NEW.company_id;

    IF v_owner_id IS NOT NULL THEN
      v_title := 'Estoque baixo: ' || NEW.name;
      v_message := format(
        'O ingrediente %s está abaixo do mínimo configurado (%s %s restantes de %s %s).',
        NEW.name,
        COALESCE(NEW.current_stock::text, '0'),
        NEW.unit,
        COALESCE(NEW.min_stock::text, '0'),
        NEW.unit
      );

      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (
        v_owner_id,
        v_title,
        v_message,
        'inventory_low_stock',
        jsonb_build_object(
          'ingredient_id', NEW.id,
          'company_id', NEW.company_id,
          'current_stock', NEW.current_stock,
          'min_stock', NEW.min_stock,
          'unit', NEW.unit
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: notify_new_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_new_order() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  company_owner_id uuid;
  company_slug text;
BEGIN
  -- Get company owner and slug for link
  SELECT owner_id, slug INTO company_owner_id, company_slug
  FROM companies
  WHERE id = NEW.company_id;

  IF company_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert notification for store owner
  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (
    company_owner_id,
    'Novo pedido recebido',
    'Você acabou de receber um novo pedido do cliente ' || NEW.customer_name || '.',
    'success',
    jsonb_build_object(
      'type', 'new_order',
      'order_id', NEW.id,
      'company_id', NEW.company_id,
      'company_slug', company_slug
    )
  );

  RETURN NEW;
END;
$$;


--
-- Name: notify_new_review(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_new_review() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  company_owner_id uuid;
BEGIN
  -- Get company owner for this review
  SELECT owner_id INTO company_owner_id
  FROM companies
  WHERE id = NEW.company_id;

  IF company_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert notification for store owner
  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (
    company_owner_id,
    'Nova avaliação recebida',
    'Você recebeu uma nova avaliação de pedido com nota ' || NEW.rating || '.',
    'info',
    jsonb_build_object(
      'type', 'new_review',
      'order_id', NEW.order_id,
      'company_id', NEW.company_id,
      'rating', NEW.rating,
      'food_rating', NEW.food_rating,
      'delivery_rating', NEW.delivery_rating
    )
  );

  RETURN NEW;
END;
$$;


--
-- Name: sync_driver_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_driver_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- When driver becomes unavailable, set to offline
  IF NEW.is_available = false AND OLD.is_available = true THEN
    IF NEW.driver_status = 'available' THEN
      NEW.driver_status := 'offline';
    END IF;
  END IF;
  
  -- When driver becomes available
  IF NEW.is_available = true AND OLD.is_available = false THEN
    -- Only set to available if not currently in delivery
    IF NEW.driver_status != 'in_delivery' THEN
      NEW.driver_status := 'available';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_notification_sound_settings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_notification_sound_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_onboarding_steps_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_onboarding_steps_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_pizza_category_settings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_pizza_category_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_pizza_settings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_pizza_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    action_type text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    entity_name text,
    description text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.activity_logs REPLICA IDENTITY FULL;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    image_url text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.categories REPLICA IDENTITY FULL;


--
-- Name: combo_slot_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.combo_slot_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slot_id uuid NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.combo_slot_products REPLICA IDENTITY FULL;


--
-- Name: combo_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.combo_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    combo_id uuid NOT NULL,
    name text NOT NULL,
    min_quantity integer DEFAULT 1 NOT NULL,
    max_quantity integer DEFAULT 1 NOT NULL,
    category_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    emoji text
);

ALTER TABLE ONLY public.combo_slots REPLICA IDENTITY FULL;


--
-- Name: combos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.combos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    product_id uuid NOT NULL,
    price_type text DEFAULT 'fixed'::text NOT NULL,
    discount_percent numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    availability_info text,
    urgency_message text,
    show_discount_badge boolean DEFAULT true
);

ALTER TABLE ONLY public.combos REPLICA IDENTITY FULL;


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    logo_url text,
    cover_url text,
    phone text,
    email text,
    address text,
    city text,
    state text,
    zip_code text,
    primary_color text DEFAULT '#10B981'::text,
    secondary_color text DEFAULT '#059669'::text,
    status public.company_status DEFAULT 'pending'::public.company_status NOT NULL,
    is_open boolean DEFAULT false,
    opening_hours jsonb DEFAULT '{}'::jsonb,
    delivery_fee numeric(10,2) DEFAULT 0,
    min_order_value numeric(10,2) DEFAULT 0,
    max_delivery_radius_km numeric(5,2) DEFAULT 10,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pix_key text,
    pix_key_type text,
    stripe_customer_id text,
    subscription_status text DEFAULT 'free'::text,
    subscription_plan text,
    subscription_end_date timestamp with time zone,
    monthly_order_count integer DEFAULT 0,
    order_count_reset_date timestamp with time zone DEFAULT now(),
    monthly_revenue numeric DEFAULT 0,
    revenue_reset_date timestamp with time zone DEFAULT now(),
    niche text,
    auto_print_kitchen boolean DEFAULT false NOT NULL,
    auto_print_mode text DEFAULT 'kitchen'::text NOT NULL,
    menu_published boolean DEFAULT false NOT NULL,
    show_floating_orders_button boolean DEFAULT true NOT NULL,
    CONSTRAINT companies_pix_key_type_check CHECK ((pix_key_type = ANY (ARRAY['cpf'::text, 'cnpj'::text, 'email'::text, 'phone'::text, 'random'::text]))),
    CONSTRAINT companies_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['free'::text, 'active'::text, 'cancelled'::text, 'past_due'::text])))
);

ALTER TABLE ONLY public.companies REPLICA IDENTITY FULL;


--
-- Name: companies_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.companies_public AS
 SELECT id,
    name,
    slug,
    description,
    logo_url,
    cover_url,
    address,
    city,
    state,
    zip_code,
    niche,
    primary_color,
    secondary_color,
    is_open,
    opening_hours,
    delivery_fee,
    min_order_value,
    max_delivery_radius_km,
    menu_published,
    status,
    created_at,
    updated_at
   FROM public.companies
  WHERE (status = 'approved'::public.company_status);


--
-- Name: company_staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.company_staff REPLICA IDENTITY FULL;


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code text NOT NULL,
    description text,
    discount_type text NOT NULL,
    discount_value numeric NOT NULL,
    min_order_value numeric DEFAULT 0,
    max_uses integer,
    current_uses integer DEFAULT 0,
    is_active boolean DEFAULT true,
    starts_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coupons_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text]))),
    CONSTRAINT coupons_discount_value_check CHECK ((discount_value > (0)::numeric))
);

ALTER TABLE ONLY public.coupons REPLICA IDENTITY FULL;


--
-- Name: customer_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    session_id text,
    street text NOT NULL,
    number text NOT NULL,
    complement text,
    neighborhood text NOT NULL,
    city text NOT NULL,
    state text NOT NULL,
    zip_code text NOT NULL,
    reference text,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    label text DEFAULT 'Casa'::text,
    customer_id uuid
);

ALTER TABLE ONLY public.customer_addresses REPLICA IDENTITY FULL;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    email text,
    phone text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.customers REPLICA IDENTITY FULL;


--
-- Name: delivery_drivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_drivers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    company_id uuid NOT NULL,
    vehicle_type text,
    license_plate text,
    is_available boolean DEFAULT true,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    driver_name text,
    driver_phone text,
    current_latitude numeric(10,8),
    current_longitude numeric(11,8),
    location_updated_at timestamp with time zone,
    email text,
    driver_status text DEFAULT 'offline'::text,
    CONSTRAINT delivery_drivers_driver_status_check CHECK ((driver_status = ANY (ARRAY['offline'::text, 'available'::text, 'pending_acceptance'::text, 'in_delivery'::text])))
);

ALTER TABLE ONLY public.delivery_drivers REPLICA IDENTITY FULL;


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.favorites REPLICA IDENTITY FULL;


--
-- Name: inventory_ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    name text NOT NULL,
    unit text NOT NULL,
    current_stock numeric DEFAULT 0 NOT NULL,
    min_stock numeric DEFAULT 0 NOT NULL,
    average_unit_cost numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.inventory_ingredients REPLICA IDENTITY FULL;


--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    movement_type text NOT NULL,
    quantity numeric NOT NULL,
    unit_cost numeric,
    related_order_id uuid,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.inventory_movements REPLICA IDENTITY FULL;


--
-- Name: inventory_product_ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_product_ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    product_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    quantity_per_unit numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.inventory_product_ingredients REPLICA IDENTITY FULL;


--
-- Name: inventory_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    quantity numeric NOT NULL,
    unit_cost numeric NOT NULL,
    total_cost numeric GENERATED ALWAYS AS ((quantity * unit_cost)) STORED,
    supplier text,
    purchased_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.inventory_purchases REPLICA IDENTITY FULL;


--
-- Name: notification_sound_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_sound_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid,
    event_type text NOT NULL,
    sound_key text DEFAULT 'default'::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    volume numeric DEFAULT 0.6 NOT NULL
);

ALTER TABLE ONLY public.notification_sound_settings REPLICA IDENTITY FULL;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    is_read boolean DEFAULT false,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.notifications REPLICA IDENTITY FULL;


--
-- Name: onboarding_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    step_key text NOT NULL,
    title text NOT NULL,
    description text,
    tip text,
    video_url text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.onboarding_steps REPLICA IDENTITY FULL;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_name text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    options jsonb DEFAULT '[]'::jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.order_items REPLICA IDENTITY FULL;


--
-- Name: order_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    driver_id uuid NOT NULL,
    company_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone
);

ALTER TABLE ONLY public.order_offers REPLICA IDENTITY FULL;


--
-- Name: order_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    company_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    delivery_rating integer,
    food_rating integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_reviews_delivery_rating_check CHECK (((delivery_rating >= 1) AND (delivery_rating <= 5))),
    CONSTRAINT order_reviews_food_rating_check CHECK (((food_rating >= 1) AND (food_rating <= 5))),
    CONSTRAINT order_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

ALTER TABLE ONLY public.order_reviews REPLICA IDENTITY FULL;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    customer_id uuid,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    customer_email text,
    delivery_address_id uuid,
    delivery_driver_id uuid,
    status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    payment_method public.payment_method NOT NULL,
    payment_status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    stripe_payment_intent_id text,
    subtotal numeric(10,2) NOT NULL,
    delivery_fee numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) NOT NULL,
    notes text,
    estimated_delivery_time timestamp with time zone,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    coupon_id uuid,
    discount_amount numeric DEFAULT 0,
    needs_change boolean DEFAULT false,
    change_for numeric,
    cancellation_reason text
);

ALTER TABLE ONLY public.orders REPLICA IDENTITY FULL;


--
-- Name: pizza_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pizza_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    category_id uuid NOT NULL,
    is_pizza_category boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.pizza_categories REPLICA IDENTITY FULL;


--
-- Name: pizza_category_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pizza_category_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    allow_half_half boolean DEFAULT true,
    max_flavors integer DEFAULT 2,
    half_half_pricing_rule text DEFAULT 'higher_price'::text,
    half_half_discount_percentage numeric(5,2),
    allow_crust_extra_price_override boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    allow_repeated_flavors boolean DEFAULT true
);

ALTER TABLE ONLY public.pizza_category_settings REPLICA IDENTITY FULL;


--
-- Name: pizza_category_sizes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pizza_category_sizes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    name text NOT NULL,
    base_price numeric DEFAULT 0 NOT NULL,
    max_flavors integer DEFAULT 1 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    slices integer DEFAULT 8 NOT NULL
);

ALTER TABLE ONLY public.pizza_category_sizes REPLICA IDENTITY FULL;


--
-- Name: pizza_crust_flavors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pizza_crust_flavors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type_id uuid NOT NULL,
    name text NOT NULL,
    extra_price numeric DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.pizza_crust_flavors REPLICA IDENTITY FULL;


--
-- Name: pizza_crust_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pizza_crust_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.pizza_crust_types REPLICA IDENTITY FULL;


--
-- Name: pizza_dough_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pizza_dough_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    extra_price numeric DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.pizza_dough_types REPLICA IDENTITY FULL;


--
-- Name: pizza_product_crust_flavors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pizza_product_crust_flavors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    crust_flavor_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.pizza_product_crust_flavors REPLICA IDENTITY FULL;


--
-- Name: pizza_product_doughs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pizza_product_doughs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    dough_type_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.pizza_product_doughs REPLICA IDENTITY FULL;


--
-- Name: pizza_product_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pizza_product_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    allow_half_half boolean,
    max_flavors integer,
    half_half_pricing_rule text,
    half_half_discount_percentage numeric,
    allow_crust_extra_price_override boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.pizza_product_settings REPLICA IDENTITY FULL;


--
-- Name: pizza_product_sizes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pizza_product_sizes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    size_id uuid NOT NULL,
    slices integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pizza_product_sizes_slices_check CHECK ((slices > 0))
);

ALTER TABLE ONLY public.pizza_product_sizes REPLICA IDENTITY FULL;


--
-- Name: pizza_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pizza_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    enable_half_half boolean DEFAULT false NOT NULL,
    enable_crust boolean DEFAULT false NOT NULL,
    enable_addons boolean DEFAULT false NOT NULL,
    max_flavors integer DEFAULT 2 NOT NULL,
    allow_crust_extra_price boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.pizza_settings REPLICA IDENTITY FULL;


--
-- Name: pizza_sizes_global; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pizza_sizes_global (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.pizza_sizes_global REPLICA IDENTITY FULL;


--
-- Name: product_option_group_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_option_group_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    group_id uuid NOT NULL,
    linked_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.product_option_group_links REPLICA IDENTITY FULL;


--
-- Name: product_option_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_option_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    name text NOT NULL,
    description text,
    is_required boolean DEFAULT false,
    min_selections integer DEFAULT 0,
    max_selections integer DEFAULT 1,
    selection_type text DEFAULT 'single'::text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    free_quantity_limit integer DEFAULT 0 NOT NULL,
    extra_unit_price numeric(10,2) DEFAULT 0 NOT NULL,
    scope public.option_group_scope DEFAULT 'product'::public.option_group_scope NOT NULL,
    kind public.option_group_kind DEFAULT 'generic'::public.option_group_kind NOT NULL,
    CONSTRAINT product_option_groups_selection_type_check CHECK ((selection_type = ANY (ARRAY['single'::text, 'multiple'::text, 'half_half'::text])))
);

ALTER TABLE ONLY public.product_option_groups REPLICA IDENTITY FULL;


--
-- Name: product_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    name text NOT NULL,
    price_modifier numeric(10,2) DEFAULT 0,
    is_required boolean DEFAULT false,
    max_selections integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    group_id uuid,
    description text,
    is_available boolean DEFAULT true,
    sort_order integer DEFAULT 0
);

ALTER TABLE ONLY public.product_options REPLICA IDENTITY FULL;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    category_id uuid,
    name text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    image_url text,
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    preparation_time_minutes integer DEFAULT 30,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sort_order integer DEFAULT 0,
    product_type public.product_type DEFAULT 'principal'::public.product_type NOT NULL
);

ALTER TABLE ONLY public.products REPLICA IDENTITY FULL;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    phone text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.profiles REPLICA IDENTITY FULL;


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    discount_type text NOT NULL,
    discount_value numeric NOT NULL,
    product_id uuid,
    category_id uuid,
    image_url text,
    is_active boolean DEFAULT true,
    starts_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT promotions_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text]))),
    CONSTRAINT promotions_discount_value_check CHECK ((discount_value > (0)::numeric))
);

ALTER TABLE ONLY public.promotions REPLICA IDENTITY FULL;


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_type text DEFAULT 'customer'::text NOT NULL,
    company_id uuid,
    order_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.push_subscriptions REPLICA IDENTITY FULL;


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referrer_company_id uuid NOT NULL,
    referred_company_id uuid NOT NULL,
    commission_percentage numeric DEFAULT 0.10 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    valid_until timestamp with time zone,
    notes text,
    CONSTRAINT referrals_no_self_referral CHECK ((referrer_company_id <> referred_company_id))
);

ALTER TABLE ONLY public.referrals REPLICA IDENTITY FULL;


--
-- Name: staff_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    can_manage_orders boolean DEFAULT true NOT NULL,
    can_manage_menu boolean DEFAULT false NOT NULL,
    can_manage_inventory boolean DEFAULT false NOT NULL,
    can_manage_coupons boolean DEFAULT false NOT NULL,
    can_manage_promotions boolean DEFAULT false NOT NULL,
    can_manage_drivers boolean DEFAULT false NOT NULL,
    can_view_reports boolean DEFAULT false NOT NULL,
    can_manage_reviews boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.staff_permissions REPLICA IDENTITY FULL;


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    description text,
    price numeric DEFAULT 0 NOT NULL,
    order_limit integer DEFAULT 1000 NOT NULL,
    stripe_price_id text,
    stripe_product_id text,
    features jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    revenue_limit numeric DEFAULT 2000
);

ALTER TABLE ONLY public.subscription_plans REPLICA IDENTITY FULL;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.user_roles REPLICA IDENTITY FULL;


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: combo_slot_products combo_slot_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combo_slot_products
    ADD CONSTRAINT combo_slot_products_pkey PRIMARY KEY (id);


--
-- Name: combo_slots combo_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combo_slots
    ADD CONSTRAINT combo_slots_pkey PRIMARY KEY (id);


--
-- Name: combos combos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combos
    ADD CONSTRAINT combos_pkey PRIMARY KEY (id);


--
-- Name: combos combos_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combos
    ADD CONSTRAINT combos_product_id_key UNIQUE (product_id);


--
-- Name: companies companies_niche_not_empty; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.companies
    ADD CONSTRAINT companies_niche_not_empty CHECK (((niche IS NULL) OR (btrim(niche) <> ''::text))) NOT VALID;


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: companies companies_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_slug_key UNIQUE (slug);


--
-- Name: company_staff company_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_staff
    ADD CONSTRAINT company_staff_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_company_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_company_id_code_key UNIQUE (company_id, code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: customer_addresses customer_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_pkey PRIMARY KEY (id);


--
-- Name: customers customers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_email_key UNIQUE (email);


--
-- Name: customers customers_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_phone_key UNIQUE (phone);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: delivery_drivers delivery_drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_drivers
    ADD CONSTRAINT delivery_drivers_pkey PRIMARY KEY (id);


--
-- Name: delivery_drivers delivery_drivers_user_id_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_drivers
    ADD CONSTRAINT delivery_drivers_user_id_company_id_key UNIQUE (user_id, company_id);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_user_product_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_product_unique UNIQUE (user_id, product_id);


--
-- Name: inventory_ingredients inventory_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_ingredients
    ADD CONSTRAINT inventory_ingredients_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory_product_ingredients inventory_product_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_product_ingredients
    ADD CONSTRAINT inventory_product_ingredients_pkey PRIMARY KEY (id);


--
-- Name: inventory_purchases inventory_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_purchases
    ADD CONSTRAINT inventory_purchases_pkey PRIMARY KEY (id);


--
-- Name: notification_sound_settings notification_sound_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_sound_settings
    ADD CONSTRAINT notification_sound_settings_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: onboarding_steps onboarding_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_steps
    ADD CONSTRAINT onboarding_steps_pkey PRIMARY KEY (id);


--
-- Name: onboarding_steps onboarding_steps_step_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_steps
    ADD CONSTRAINT onboarding_steps_step_key_key UNIQUE (step_key);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_offers order_offers_order_id_driver_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_offers
    ADD CONSTRAINT order_offers_order_id_driver_id_key UNIQUE (order_id, driver_id);


--
-- Name: order_offers order_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_offers
    ADD CONSTRAINT order_offers_pkey PRIMARY KEY (id);


--
-- Name: order_reviews order_reviews_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reviews
    ADD CONSTRAINT order_reviews_order_id_key UNIQUE (order_id);


--
-- Name: order_reviews order_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reviews
    ADD CONSTRAINT order_reviews_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: pizza_categories pizza_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_categories
    ADD CONSTRAINT pizza_categories_pkey PRIMARY KEY (id);


--
-- Name: pizza_category_settings pizza_category_settings_category_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_category_settings
    ADD CONSTRAINT pizza_category_settings_category_unique UNIQUE (category_id);


--
-- Name: pizza_category_settings pizza_category_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_category_settings
    ADD CONSTRAINT pizza_category_settings_pkey PRIMARY KEY (id);


--
-- Name: pizza_category_sizes pizza_category_sizes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_category_sizes
    ADD CONSTRAINT pizza_category_sizes_pkey PRIMARY KEY (id);


--
-- Name: pizza_category_sizes pizza_category_sizes_slices_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.pizza_category_sizes
    ADD CONSTRAINT pizza_category_sizes_slices_check CHECK ((slices > 0)) NOT VALID;


--
-- Name: pizza_crust_flavors pizza_crust_flavors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_crust_flavors
    ADD CONSTRAINT pizza_crust_flavors_pkey PRIMARY KEY (id);


--
-- Name: pizza_crust_types pizza_crust_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_crust_types
    ADD CONSTRAINT pizza_crust_types_pkey PRIMARY KEY (id);


--
-- Name: pizza_dough_types pizza_dough_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_dough_types
    ADD CONSTRAINT pizza_dough_types_pkey PRIMARY KEY (id);


--
-- Name: pizza_product_crust_flavors pizza_product_crust_flavors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_product_crust_flavors
    ADD CONSTRAINT pizza_product_crust_flavors_pkey PRIMARY KEY (id);


--
-- Name: pizza_product_crust_flavors pizza_product_crust_flavors_product_id_crust_flavor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_product_crust_flavors
    ADD CONSTRAINT pizza_product_crust_flavors_product_id_crust_flavor_id_key UNIQUE (product_id, crust_flavor_id);


--
-- Name: pizza_product_doughs pizza_product_doughs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_product_doughs
    ADD CONSTRAINT pizza_product_doughs_pkey PRIMARY KEY (id);


--
-- Name: pizza_product_doughs pizza_product_doughs_product_id_dough_type_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_product_doughs
    ADD CONSTRAINT pizza_product_doughs_product_id_dough_type_id_key UNIQUE (product_id, dough_type_id);


--
-- Name: pizza_product_settings pizza_product_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_product_settings
    ADD CONSTRAINT pizza_product_settings_pkey PRIMARY KEY (id);


--
-- Name: pizza_product_settings pizza_product_settings_product_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_product_settings
    ADD CONSTRAINT pizza_product_settings_product_unique UNIQUE (product_id);


--
-- Name: pizza_product_sizes pizza_product_sizes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_product_sizes
    ADD CONSTRAINT pizza_product_sizes_pkey PRIMARY KEY (id);


--
-- Name: pizza_product_sizes pizza_product_sizes_product_id_size_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_product_sizes
    ADD CONSTRAINT pizza_product_sizes_product_id_size_id_key UNIQUE (product_id, size_id);


--
-- Name: pizza_settings pizza_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_settings
    ADD CONSTRAINT pizza_settings_pkey PRIMARY KEY (id);


--
-- Name: pizza_sizes_global pizza_sizes_global_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_sizes_global
    ADD CONSTRAINT pizza_sizes_global_pkey PRIMARY KEY (id);


--
-- Name: product_option_group_links product_option_group_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_option_group_links
    ADD CONSTRAINT product_option_group_links_pkey PRIMARY KEY (id);


--
-- Name: product_option_group_links product_option_group_links_product_group_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_option_group_links
    ADD CONSTRAINT product_option_group_links_product_group_unique UNIQUE (product_id, group_id);


--
-- Name: product_option_groups product_option_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_option_groups
    ADD CONSTRAINT product_option_groups_pkey PRIMARY KEY (id);


--
-- Name: product_options product_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_options
    ADD CONSTRAINT product_options_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_unique_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_unique_pair UNIQUE (referrer_company_id, referred_company_id);


--
-- Name: staff_permissions staff_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_permissions
    ADD CONSTRAINT staff_permissions_pkey PRIMARY KEY (id);


--
-- Name: staff_permissions staff_permissions_user_id_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_permissions
    ADD CONSTRAINT staff_permissions_user_id_company_id_key UNIQUE (user_id, company_id);


--
-- Name: subscription_plans subscription_plans_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_key_key UNIQUE (key);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: combo_slot_products_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX combo_slot_products_unique ON public.combo_slot_products USING btree (slot_id, product_id);


--
-- Name: idx_activity_logs_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_company_id ON public.activity_logs USING btree (company_id);


--
-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at DESC);


--
-- Name: idx_activity_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_entity ON public.activity_logs USING btree (entity_type, entity_id);


--
-- Name: idx_activity_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs USING btree (user_id);


--
-- Name: idx_customer_addresses_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_addresses_customer_id ON public.customer_addresses USING btree (customer_id);


--
-- Name: idx_delivery_drivers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_drivers_email ON public.delivery_drivers USING btree (email);


--
-- Name: idx_favorites_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorites_company_id ON public.favorites USING btree (company_id);


--
-- Name: idx_favorites_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorites_product_id ON public.favorites USING btree (product_id);


--
-- Name: idx_favorites_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorites_user_id ON public.favorites USING btree (user_id);


--
-- Name: idx_notification_sound_settings_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_sound_settings_company ON public.notification_sound_settings USING btree (company_id);


--
-- Name: idx_notification_sound_settings_user_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_sound_settings_user_event ON public.notification_sound_settings USING btree (user_id, event_type);


--
-- Name: idx_option_groups_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_option_groups_product_id ON public.product_option_groups USING btree (product_id);


--
-- Name: idx_order_offers_driver_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_offers_driver_status ON public.order_offers USING btree (driver_id, status);


--
-- Name: idx_order_offers_order_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_offers_order_status ON public.order_offers USING btree (order_id, status);


--
-- Name: idx_order_reviews_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_reviews_company_id ON public.order_reviews USING btree (company_id);


--
-- Name: idx_order_reviews_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_reviews_order_id ON public.order_reviews USING btree (order_id);


--
-- Name: idx_product_options_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_options_group_id ON public.product_options USING btree (group_id);


--
-- Name: idx_push_subscriptions_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_subscriptions_company ON public.push_subscriptions USING btree (company_id);


--
-- Name: idx_push_subscriptions_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_subscriptions_order ON public.push_subscriptions USING btree (order_id);


--
-- Name: idx_push_subscriptions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions USING btree (user_id);


--
-- Name: customers detect_bulk_customers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER detect_bulk_customers BEFORE INSERT ON public.customers FOR EACH ROW EXECUTE FUNCTION public.detect_bulk_customer_creation();


--
-- Name: orders increment_revenue_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER increment_revenue_trigger BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.increment_company_revenue();


--
-- Name: inventory_ingredients inventory_ingredients_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER inventory_ingredients_set_updated_at BEFORE UPDATE ON public.inventory_ingredients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: inventory_purchases inventory_purchases_after_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER inventory_purchases_after_insert AFTER INSERT ON public.inventory_purchases FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_purchase();


--
-- Name: orders orders_after_update_inventory; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orders_after_update_inventory AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_on_order_confirm();


--
-- Name: pizza_category_sizes pizza_category_sizes_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pizza_category_sizes_set_updated_at BEFORE UPDATE ON public.pizza_category_sizes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: companies trg_ensure_default_pizza_settings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ensure_default_pizza_settings AFTER INSERT OR UPDATE OF niche ON public.companies FOR EACH ROW EXECUTE FUNCTION public.ensure_default_pizza_settings();


--
-- Name: inventory_ingredients trg_notify_low_stock_inventory; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_low_stock_inventory AFTER INSERT OR UPDATE OF current_stock, min_stock ON public.inventory_ingredients FOR EACH ROW EXECUTE FUNCTION public.notify_low_stock_inventory();


--
-- Name: orders trg_notify_new_order; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_new_order AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_new_order();


--
-- Name: order_reviews trg_notify_new_review; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_new_review AFTER INSERT ON public.order_reviews FOR EACH ROW EXECUTE FUNCTION public.notify_new_review();


--
-- Name: pizza_category_settings trg_pizza_category_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pizza_category_settings_updated_at BEFORE UPDATE ON public.pizza_category_settings FOR EACH ROW EXECUTE FUNCTION public.update_pizza_category_settings_updated_at();


--
-- Name: pizza_crust_flavors trg_pizza_crust_flavors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pizza_crust_flavors_updated_at BEFORE UPDATE ON public.pizza_crust_flavors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pizza_crust_types trg_pizza_crust_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pizza_crust_types_updated_at BEFORE UPDATE ON public.pizza_crust_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pizza_dough_types trg_pizza_dough_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pizza_dough_types_updated_at BEFORE UPDATE ON public.pizza_dough_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pizza_product_sizes trg_pizza_product_sizes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pizza_product_sizes_updated_at BEFORE UPDATE ON public.pizza_product_sizes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pizza_sizes_global trg_pizza_sizes_global_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pizza_sizes_global_updated_at BEFORE UPDATE ON public.pizza_sizes_global FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: onboarding_steps trg_update_onboarding_steps_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_onboarding_steps_updated_at BEFORE UPDATE ON public.onboarding_steps FOR EACH ROW EXECUTE FUNCTION public.update_onboarding_steps_updated_at();


--
-- Name: pizza_settings trg_update_pizza_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_pizza_settings_updated_at BEFORE UPDATE ON public.pizza_settings FOR EACH ROW EXECUTE FUNCTION public.update_pizza_settings_updated_at();


--
-- Name: orders trigger_auto_assign_driver; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_assign_driver BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.auto_assign_driver();


--
-- Name: orders trigger_auto_assign_driver_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_assign_driver_insert BEFORE INSERT ON public.orders FOR EACH ROW WHEN ((new.status = 'awaiting_driver'::public.order_status)) EXECUTE FUNCTION public.auto_assign_driver();


--
-- Name: orders trigger_increment_order_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_increment_order_count AFTER INSERT OR UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.increment_company_order_count();


--
-- Name: delivery_drivers trigger_sync_driver_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_driver_status BEFORE UPDATE ON public.delivery_drivers FOR EACH ROW EXECUTE FUNCTION public.sync_driver_status();


--
-- Name: categories update_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: companies update_companies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: coupons update_coupons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: delivery_drivers update_delivery_drivers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_delivery_drivers_updated_at BEFORE UPDATE ON public.delivery_drivers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_sound_settings update_notification_sound_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_notification_sound_settings_updated_at BEFORE UPDATE ON public.notification_sound_settings FOR EACH ROW EXECUTE FUNCTION public.update_notification_sound_settings_updated_at();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pizza_product_settings update_pizza_product_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pizza_product_settings_updated_at BEFORE UPDATE ON public.pizza_product_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: promotions update_promotions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: push_subscriptions update_push_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: staff_permissions update_staff_permissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_staff_permissions_updated_at BEFORE UPDATE ON public.staff_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscription_plans update_subscription_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: activity_logs activity_logs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: categories categories_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: combo_slot_products combo_slot_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combo_slot_products
    ADD CONSTRAINT combo_slot_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: combo_slot_products combo_slot_products_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combo_slot_products
    ADD CONSTRAINT combo_slot_products_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.combo_slots(id) ON DELETE CASCADE;


--
-- Name: combo_slots combo_slots_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combo_slots
    ADD CONSTRAINT combo_slots_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: combo_slots combo_slots_combo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combo_slots
    ADD CONSTRAINT combo_slots_combo_id_fkey FOREIGN KEY (combo_id) REFERENCES public.combos(id) ON DELETE CASCADE;


--
-- Name: combos combos_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combos
    ADD CONSTRAINT combos_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: combos combos_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combos
    ADD CONSTRAINT combos_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: companies companies_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: company_staff company_staff_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_staff
    ADD CONSTRAINT company_staff_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: coupons coupons_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: customer_addresses customer_addresses_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: customer_addresses customer_addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: customers customers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: delivery_drivers delivery_drivers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_drivers
    ADD CONSTRAINT delivery_drivers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: delivery_drivers delivery_drivers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_drivers
    ADD CONSTRAINT delivery_drivers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: inventory_ingredients inventory_ingredients_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_ingredients
    ADD CONSTRAINT inventory_ingredients_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.inventory_ingredients(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_related_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_related_order_id_fkey FOREIGN KEY (related_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: inventory_product_ingredients inventory_product_ingredients_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_product_ingredients
    ADD CONSTRAINT inventory_product_ingredients_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: inventory_product_ingredients inventory_product_ingredients_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_product_ingredients
    ADD CONSTRAINT inventory_product_ingredients_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.inventory_ingredients(id) ON DELETE CASCADE;


--
-- Name: inventory_product_ingredients inventory_product_ingredients_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_product_ingredients
    ADD CONSTRAINT inventory_product_ingredients_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: inventory_purchases inventory_purchases_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_purchases
    ADD CONSTRAINT inventory_purchases_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: inventory_purchases inventory_purchases_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_purchases
    ADD CONSTRAINT inventory_purchases_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.inventory_ingredients(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: order_offers order_offers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_offers
    ADD CONSTRAINT order_offers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: order_offers order_offers_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_offers
    ADD CONSTRAINT order_offers_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.delivery_drivers(id) ON DELETE CASCADE;


--
-- Name: order_offers order_offers_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_offers
    ADD CONSTRAINT order_offers_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_reviews order_reviews_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reviews
    ADD CONSTRAINT order_reviews_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: order_reviews order_reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_reviews
    ADD CONSTRAINT order_reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: orders orders_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id);


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: orders orders_delivery_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_delivery_address_id_fkey FOREIGN KEY (delivery_address_id) REFERENCES public.customer_addresses(id) ON DELETE SET NULL;


--
-- Name: orders orders_delivery_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_delivery_driver_id_fkey FOREIGN KEY (delivery_driver_id) REFERENCES public.delivery_drivers(id) ON DELETE SET NULL;


--
-- Name: pizza_categories pizza_categories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_categories
    ADD CONSTRAINT pizza_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: pizza_categories pizza_categories_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_categories
    ADD CONSTRAINT pizza_categories_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: pizza_category_settings pizza_category_settings_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_category_settings
    ADD CONSTRAINT pizza_category_settings_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: pizza_category_sizes pizza_category_sizes_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_category_sizes
    ADD CONSTRAINT pizza_category_sizes_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: pizza_crust_flavors pizza_crust_flavors_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_crust_flavors
    ADD CONSTRAINT pizza_crust_flavors_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.pizza_crust_types(id) ON DELETE CASCADE;


--
-- Name: pizza_product_crust_flavors pizza_product_crust_flavors_crust_flavor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_product_crust_flavors
    ADD CONSTRAINT pizza_product_crust_flavors_crust_flavor_id_fkey FOREIGN KEY (crust_flavor_id) REFERENCES public.pizza_crust_flavors(id) ON DELETE RESTRICT;


--
-- Name: pizza_product_crust_flavors pizza_product_crust_flavors_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_product_crust_flavors
    ADD CONSTRAINT pizza_product_crust_flavors_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: pizza_product_doughs pizza_product_doughs_dough_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_product_doughs
    ADD CONSTRAINT pizza_product_doughs_dough_type_id_fkey FOREIGN KEY (dough_type_id) REFERENCES public.pizza_dough_types(id) ON DELETE RESTRICT;


--
-- Name: pizza_product_doughs pizza_product_doughs_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_product_doughs
    ADD CONSTRAINT pizza_product_doughs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: pizza_product_settings pizza_product_settings_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_product_settings
    ADD CONSTRAINT pizza_product_settings_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: pizza_product_sizes pizza_product_sizes_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_product_sizes
    ADD CONSTRAINT pizza_product_sizes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: pizza_product_sizes pizza_product_sizes_size_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_product_sizes
    ADD CONSTRAINT pizza_product_sizes_size_id_fkey FOREIGN KEY (size_id) REFERENCES public.pizza_sizes_global(id) ON DELETE RESTRICT;


--
-- Name: pizza_settings pizza_settings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_settings
    ADD CONSTRAINT pizza_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: product_option_group_links product_option_group_links_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_option_group_links
    ADD CONSTRAINT product_option_group_links_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.product_option_groups(id) ON DELETE CASCADE;


--
-- Name: product_option_group_links product_option_group_links_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_option_group_links
    ADD CONSTRAINT product_option_group_links_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_option_groups product_option_groups_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_option_groups
    ADD CONSTRAINT product_option_groups_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_options product_options_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_options
    ADD CONSTRAINT product_options_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.product_option_groups(id) ON DELETE CASCADE;


--
-- Name: product_options product_options_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_options
    ADD CONSTRAINT product_options_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: products products_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: promotions promotions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: promotions promotions_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: promotions promotions_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_referred_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_company_id_fkey FOREIGN KEY (referred_company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_referrer_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referrer_company_id_fkey FOREIGN KEY (referrer_company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: staff_permissions staff_permissions_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_permissions
    ADD CONSTRAINT staff_permissions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: staff_permissions staff_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_permissions
    ADD CONSTRAINT staff_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: order_items Anyone can create order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT WITH CHECK (true);


--
-- Name: orders Anyone can create orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (true);


--
-- Name: push_subscriptions Anyone can create push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create push subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK (true);


--
-- Name: coupons Anyone can view active coupons of approved companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active coupons of approved companies" ON public.coupons FOR SELECT USING (((is_active = true) AND ((expires_at IS NULL) OR (expires_at > now())) AND (EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = coupons.company_id) AND (companies.status = 'approved'::public.company_status))))));


--
-- Name: subscription_plans Anyone can view active plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active plans" ON public.subscription_plans FOR SELECT USING ((is_active = true));


--
-- Name: promotions Anyone can view active promotions of approved companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active promotions of approved companies" ON public.promotions FOR SELECT USING (((is_active = true) AND ((expires_at IS NULL) OR (expires_at > now())) AND (EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = promotions.company_id) AND (companies.status = 'approved'::public.company_status))))));


--
-- Name: companies Anyone can view approved companies (limited fields); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view approved companies (limited fields)" ON public.companies FOR SELECT USING ((status = 'approved'::public.company_status));


--
-- Name: categories Anyone can view categories of approved companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view categories of approved companies" ON public.categories FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = categories.company_id) AND (companies.status = 'approved'::public.company_status)))));


--
-- Name: onboarding_steps Anyone can view onboarding steps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view onboarding steps" ON public.onboarding_steps FOR SELECT USING (true);


--
-- Name: product_option_groups Anyone can view option groups of approved companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view option groups of approved companies" ON public.product_option_groups FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.companies c ON ((c.id = p.company_id)))
  WHERE ((p.id = product_option_groups.product_id) AND (c.status = 'approved'::public.company_status)))));


--
-- Name: product_options Anyone can view product options; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view product options" ON public.product_options FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.companies c ON ((c.id = p.company_id)))
  WHERE ((p.id = product_options.product_id) AND (c.status = 'approved'::public.company_status)))));


--
-- Name: products Anyone can view products of approved companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view products of approved companies" ON public.products FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = products.company_id) AND (companies.status = 'approved'::public.company_status)))));


--
-- Name: order_reviews Anyone can view reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view reviews" ON public.order_reviews FOR SELECT USING (true);


--
-- Name: companies Authenticated users can create companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create companies" ON public.companies FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));


--
-- Name: combo_slot_products Combo slot products owners manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Combo slot products owners manage" ON public.combo_slot_products USING ((EXISTS ( SELECT 1
   FROM ((public.combo_slots s
     JOIN public.combos cb ON ((cb.id = s.combo_id)))
     JOIN public.companies c ON ((c.id = cb.company_id)))
  WHERE ((s.id = combo_slot_products.slot_id) AND (c.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((public.combo_slots s
     JOIN public.combos cb ON ((cb.id = s.combo_id)))
     JOIN public.companies c ON ((c.id = cb.company_id)))
  WHERE ((s.id = combo_slot_products.slot_id) AND (c.owner_id = auth.uid())))));


--
-- Name: combo_slot_products Combo slot products public view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Combo slot products public view" ON public.combo_slot_products FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((public.combo_slots s
     JOIN public.combos cb ON ((cb.id = s.combo_id)))
     JOIN public.companies c ON ((c.id = cb.company_id)))
  WHERE ((s.id = combo_slot_products.slot_id) AND (c.status = 'approved'::public.company_status)))));


--
-- Name: combo_slot_products Combo slot products staff manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Combo slot products staff manage" ON public.combo_slot_products USING ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (((public.combo_slots s
     JOIN public.combos cb ON ((cb.id = s.combo_id)))
     JOIN public.companies c ON ((c.id = cb.company_id)))
     JOIN public.company_staff cs ON ((cs.company_id = c.id)))
  WHERE ((s.id = combo_slot_products.slot_id) AND (cs.user_id = auth.uid())))))) WITH CHECK ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (((public.combo_slots s
     JOIN public.combos cb ON ((cb.id = s.combo_id)))
     JOIN public.companies c ON ((c.id = cb.company_id)))
     JOIN public.company_staff cs ON ((cs.company_id = c.id)))
  WHERE ((s.id = combo_slot_products.slot_id) AND (cs.user_id = auth.uid()))))));


--
-- Name: combo_slots Combo slots owners manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Combo slots owners manage" ON public.combo_slots USING ((EXISTS ( SELECT 1
   FROM (public.combos cb
     JOIN public.companies c ON ((c.id = cb.company_id)))
  WHERE ((cb.id = combo_slots.combo_id) AND (c.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.combos cb
     JOIN public.companies c ON ((c.id = cb.company_id)))
  WHERE ((cb.id = combo_slots.combo_id) AND (c.owner_id = auth.uid())))));


--
-- Name: combo_slots Combo slots public view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Combo slots public view" ON public.combo_slots FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.combos cb
     JOIN public.companies c ON ((c.id = cb.company_id)))
  WHERE ((cb.id = combo_slots.combo_id) AND (c.status = 'approved'::public.company_status)))));


--
-- Name: combo_slots Combo slots staff manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Combo slots staff manage" ON public.combo_slots USING ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM ((public.combos cb
     JOIN public.companies c ON ((c.id = cb.company_id)))
     JOIN public.company_staff cs ON ((cs.company_id = c.id)))
  WHERE ((cb.id = combo_slots.combo_id) AND (cs.user_id = auth.uid())))))) WITH CHECK ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM ((public.combos cb
     JOIN public.companies c ON ((c.id = cb.company_id)))
     JOIN public.company_staff cs ON ((cs.company_id = c.id)))
  WHERE ((cb.id = combo_slots.combo_id) AND (cs.user_id = auth.uid()))))));


--
-- Name: combos Combos owners manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Combos owners manage" ON public.combos USING ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = combos.company_id) AND (c.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = combos.company_id) AND (c.owner_id = auth.uid())))));


--
-- Name: combos Combos public view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Combos public view" ON public.combos FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = combos.company_id) AND (c.status = 'approved'::public.company_status)))));


--
-- Name: combos Combos staff manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Combos staff manage" ON public.combos USING ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (public.company_staff cs
     JOIN public.companies c ON ((c.id = cs.company_id)))
  WHERE ((cs.user_id = auth.uid()) AND (c.id = combos.company_id)))))) WITH CHECK ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (public.company_staff cs
     JOIN public.companies c ON ((c.id = cs.company_id)))
  WHERE ((cs.user_id = auth.uid()) AND (c.id = combos.company_id))))));


--
-- Name: activity_logs Company owners can create logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company owners can create logs" ON public.activity_logs FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = activity_logs.company_id) AND (companies.owner_id = auth.uid())))));


--
-- Name: coupons Company owners can manage their coupons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company owners can manage their coupons" ON public.coupons USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = coupons.company_id) AND (companies.owner_id = auth.uid())))));


--
-- Name: delivery_drivers Company owners can manage their drivers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company owners can manage their drivers" ON public.delivery_drivers TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = delivery_drivers.company_id) AND (companies.owner_id = auth.uid())))));


--
-- Name: order_offers Company owners can manage their order offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company owners can manage their order offers" ON public.order_offers USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = order_offers.company_id) AND (companies.owner_id = auth.uid())))));


--
-- Name: promotions Company owners can manage their promotions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company owners can manage their promotions" ON public.promotions USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = promotions.company_id) AND (companies.owner_id = auth.uid())))));


--
-- Name: orders Company owners can update their orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company owners can update their orders" ON public.orders FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = orders.company_id) AND (companies.owner_id = auth.uid())))));


--
-- Name: customers Company owners can view customers from orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company owners can view customers from orders" ON public.customers FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.companies c ON ((c.id = o.company_id)))
  WHERE ((o.customer_id = customers.id) AND (c.owner_id = auth.uid())))));


--
-- Name: order_items Company owners can view order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company owners can view order items" ON public.order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.companies c ON ((c.id = o.company_id)))
  WHERE ((o.id = order_items.order_id) AND (c.owner_id = auth.uid())))));


--
-- Name: activity_logs Company owners can view their logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company owners can view their logs" ON public.activity_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = activity_logs.company_id) AND (companies.owner_id = auth.uid())))));


--
-- Name: order_offers Company owners can view their order offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company owners can view their order offers" ON public.order_offers FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = order_offers.company_id) AND (companies.owner_id = auth.uid())))));


--
-- Name: orders Company owners can view their orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company owners can view their orders" ON public.orders FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = orders.company_id) AND (companies.owner_id = auth.uid())))));


--
-- Name: order_reviews Company owners can view their reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company owners can view their reviews" ON public.order_reviews FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = order_reviews.company_id) AND (companies.owner_id = auth.uid())))));


--
-- Name: pizza_categories Company owners manage pizza categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company owners manage pizza categories" ON public.pizza_categories USING ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = pizza_categories.company_id) AND (c.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = pizza_categories.company_id) AND (c.owner_id = auth.uid())))));


--
-- Name: pizza_settings Company owners manage pizza settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company owners manage pizza settings" ON public.pizza_settings USING ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = pizza_settings.company_id) AND (c.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = pizza_settings.company_id) AND (c.owner_id = auth.uid())))));


--
-- Name: referrals Company owners view referrals where they are referred; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company owners view referrals where they are referred" ON public.referrals FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = referrals.referred_company_id) AND (c.owner_id = auth.uid())))));


--
-- Name: referrals Company owners view their referrals as referrer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Company owners view their referrals as referrer" ON public.referrals FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = referrals.referrer_company_id) AND (c.owner_id = auth.uid())))));


--
-- Name: order_reviews Customers can create their own reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can create their own reviews" ON public.order_reviews FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.customers c ON ((c.id = o.customer_id)))
  WHERE ((o.id = order_reviews.order_id) AND (c.user_id = auth.uid())))));


--
-- Name: profiles Deny public profile access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny public profile access" ON public.profiles FOR SELECT USING (false);


--
-- Name: orders Drivers can update assigned orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can update assigned orders" ON public.orders FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.delivery_drivers
  WHERE ((delivery_drivers.id = orders.delivery_driver_id) AND (delivery_drivers.user_id = auth.uid())))));


--
-- Name: order_offers Drivers can update their own offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can update their own offers" ON public.order_offers FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.delivery_drivers
  WHERE ((delivery_drivers.id = order_offers.driver_id) AND (delivery_drivers.user_id = auth.uid())))));


--
-- Name: delivery_drivers Drivers can update their own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can update their own record" ON public.delivery_drivers FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: orders Drivers can view assigned orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can view assigned orders" ON public.orders FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.delivery_drivers
  WHERE ((delivery_drivers.id = orders.delivery_driver_id) AND (delivery_drivers.user_id = auth.uid())))));


--
-- Name: order_offers Drivers can view their own offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can view their own offers" ON public.order_offers FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.delivery_drivers
  WHERE ((delivery_drivers.id = order_offers.driver_id) AND (delivery_drivers.user_id = auth.uid())))));


--
-- Name: delivery_drivers Drivers can view their own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers can view their own record" ON public.delivery_drivers FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: customer_addresses Drivers view order addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Drivers view order addresses" ON public.customer_addresses FOR SELECT USING (((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.delivery_drivers d ON ((d.id = o.delivery_driver_id)))
  WHERE ((o.delivery_address_id = customer_addresses.id) AND (d.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM ((public.order_offers oo
     JOIN public.delivery_drivers d ON ((d.id = oo.driver_id)))
     JOIN public.orders o ON ((o.id = oo.order_id)))
  WHERE ((o.delivery_address_id = customer_addresses.id) AND (d.user_id = auth.uid()))))));


--
-- Name: company_staff Owner manage company staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owner manage company staff" ON public.company_staff USING ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = company_staff.company_id) AND (c.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = company_staff.company_id) AND (c.owner_id = auth.uid())))));


--
-- Name: product_options Owners can manage product options; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage product options" ON public.product_options TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.companies c ON ((c.id = p.company_id)))
  WHERE ((p.id = product_options.product_id) AND (c.owner_id = auth.uid())))));


--
-- Name: categories Owners can manage their categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage their categories" ON public.categories TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = categories.company_id) AND (companies.owner_id = auth.uid())))));


--
-- Name: product_option_groups Owners can manage their option groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage their option groups" ON public.product_option_groups USING ((EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.companies c ON ((c.id = p.company_id)))
  WHERE ((p.id = product_option_groups.product_id) AND (c.owner_id = auth.uid())))));


--
-- Name: products Owners can manage their products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage their products" ON public.products TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.companies
  WHERE ((companies.id = products.company_id) AND (companies.owner_id = auth.uid())))));


--
-- Name: companies Owners can update their companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update their companies" ON public.companies FOR UPDATE TO authenticated USING ((owner_id = auth.uid()));


--
-- Name: companies Owners can view their own companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view their own companies" ON public.companies FOR SELECT TO authenticated USING ((owner_id = auth.uid()));


--
-- Name: inventory_ingredients Owners manage ingredients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners manage ingredients" ON public.inventory_ingredients USING ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = inventory_ingredients.company_id) AND (c.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = inventory_ingredients.company_id) AND (c.owner_id = auth.uid())))));


--
-- Name: inventory_movements Owners manage inventory movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners manage inventory movements" ON public.inventory_movements USING ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = inventory_movements.company_id) AND (c.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = inventory_movements.company_id) AND (c.owner_id = auth.uid())))));


--
-- Name: pizza_product_settings Owners manage pizza product settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners manage pizza product settings" ON public.pizza_product_settings USING ((EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.companies c ON ((c.id = p.company_id)))
  WHERE ((p.id = pizza_product_settings.product_id) AND (c.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.companies c ON ((c.id = p.company_id)))
  WHERE ((p.id = pizza_product_settings.product_id) AND (c.owner_id = auth.uid())))));


--
-- Name: inventory_product_ingredients Owners manage product ingredients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners manage product ingredients" ON public.inventory_product_ingredients USING ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = inventory_product_ingredients.company_id) AND (c.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = inventory_product_ingredients.company_id) AND (c.owner_id = auth.uid())))));


--
-- Name: product_option_group_links Owners manage product option group links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners manage product option group links" ON public.product_option_group_links USING ((EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.companies c ON ((c.id = p.company_id)))
  WHERE ((p.id = product_option_group_links.product_id) AND (c.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.companies c ON ((c.id = p.company_id)))
  WHERE ((p.id = product_option_group_links.product_id) AND (c.owner_id = auth.uid())))));


--
-- Name: inventory_purchases Owners manage purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners manage purchases" ON public.inventory_purchases USING ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = inventory_purchases.company_id) AND (c.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = inventory_purchases.company_id) AND (c.owner_id = auth.uid())))));


--
-- Name: staff_permissions Owners manage staff permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners manage staff permissions" ON public.staff_permissions USING ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = staff_permissions.company_id) AND (c.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = staff_permissions.company_id) AND (c.owner_id = auth.uid())))));


--
-- Name: customer_addresses Owners view order addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners view order addresses" ON public.customer_addresses FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.companies c ON ((c.id = o.company_id)))
  WHERE ((o.delivery_address_id = customer_addresses.id) AND (c.owner_id = auth.uid())))));


--
-- Name: customer_addresses Public insert addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public insert addresses" ON public.customer_addresses FOR INSERT WITH CHECK ((((auth.uid() IS NOT NULL) AND (user_id = auth.uid())) OR ((user_id IS NULL) AND (session_id IS NOT NULL)) OR ((user_id IS NULL) AND (customer_id IS NOT NULL))));


--
-- Name: customers Public insert customers for orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public insert customers for orders" ON public.customers FOR INSERT WITH CHECK ((((auth.uid() IS NOT NULL) AND (user_id = auth.uid())) OR ((auth.uid() IS NULL) AND (user_id IS NULL))));


--
-- Name: pizza_categories Public view pizza categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public view pizza categories" ON public.pizza_categories FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = pizza_categories.company_id) AND (c.status = 'approved'::public.company_status)))));


--
-- Name: pizza_product_settings Public view pizza product settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public view pizza product settings" ON public.pizza_product_settings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.companies c ON ((c.id = p.company_id)))
  WHERE ((p.id = pizza_product_settings.product_id) AND (c.status = 'approved'::public.company_status)))));


--
-- Name: pizza_settings Public view pizza settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public view pizza settings" ON public.pizza_settings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = pizza_settings.company_id) AND (c.status = 'approved'::public.company_status)))));


--
-- Name: product_option_group_links Public view product option group links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public view product option group links" ON public.product_option_group_links FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.companies c ON ((c.id = p.company_id)))
  WHERE ((p.id = product_option_group_links.product_id) AND (c.status = 'approved'::public.company_status)))));


--
-- Name: referrals Referred owners can insert referrals for their company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Referred owners can insert referrals for their company" ON public.referrals FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.companies c
  WHERE ((c.id = referrals.referred_company_id) AND (c.owner_id = auth.uid())))));


--
-- Name: company_staff Staff view own company link; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff view own company link" ON public.company_staff FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: staff_permissions Staff view own permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff view own permissions" ON public.staff_permissions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: categories Store staff manage categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store staff manage categories" ON public.categories USING ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.company_staff cs
  WHERE ((cs.user_id = auth.uid()) AND (cs.company_id = cs.company_id)))))) WITH CHECK ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.company_staff cs
  WHERE ((cs.user_id = auth.uid()) AND (cs.company_id = cs.company_id))))));


--
-- Name: delivery_drivers Store staff manage delivery drivers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store staff manage delivery drivers" ON public.delivery_drivers USING ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.company_staff cs
  WHERE ((cs.user_id = auth.uid()) AND (cs.company_id = cs.company_id)))))) WITH CHECK ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.company_staff cs
  WHERE ((cs.user_id = auth.uid()) AND (cs.company_id = cs.company_id))))));


--
-- Name: orders Store staff manage orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store staff manage orders" ON public.orders USING ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.company_staff cs
  WHERE ((cs.user_id = auth.uid()) AND (cs.company_id = cs.company_id)))))) WITH CHECK ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.company_staff cs
  WHERE ((cs.user_id = auth.uid()) AND (cs.company_id = cs.company_id))))));


--
-- Name: pizza_categories Store staff manage pizza categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store staff manage pizza categories" ON public.pizza_categories USING ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.company_staff cs
  WHERE ((cs.user_id = auth.uid()) AND (cs.company_id = cs.company_id)))))) WITH CHECK ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.company_staff cs
  WHERE ((cs.user_id = auth.uid()) AND (cs.company_id = cs.company_id))))));


--
-- Name: pizza_product_settings Store staff manage pizza product settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store staff manage pizza product settings" ON public.pizza_product_settings USING ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.company_staff cs ON ((cs.company_id = p.company_id)))
  WHERE ((p.id = pizza_product_settings.product_id) AND (cs.user_id = auth.uid())))))) WITH CHECK ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.company_staff cs ON ((cs.company_id = p.company_id)))
  WHERE ((p.id = pizza_product_settings.product_id) AND (cs.user_id = auth.uid()))))));


--
-- Name: pizza_settings Store staff manage pizza settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store staff manage pizza settings" ON public.pizza_settings USING ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.company_staff cs
  WHERE ((cs.user_id = auth.uid()) AND (cs.company_id = cs.company_id)))))) WITH CHECK ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.company_staff cs
  WHERE ((cs.user_id = auth.uid()) AND (cs.company_id = cs.company_id))))));


--
-- Name: product_option_group_links Store staff manage product option group links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store staff manage product option group links" ON public.product_option_group_links USING ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.company_staff cs ON ((cs.company_id = p.company_id)))
  WHERE ((p.id = product_option_group_links.product_id) AND (cs.user_id = auth.uid())))))) WITH CHECK ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.company_staff cs ON ((cs.company_id = p.company_id)))
  WHERE ((p.id = product_option_group_links.product_id) AND (cs.user_id = auth.uid()))))));


--
-- Name: product_option_groups Store staff manage product option groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store staff manage product option groups" ON public.product_option_groups USING ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.company_staff cs ON ((cs.company_id = p.company_id)))
  WHERE ((p.id = product_option_groups.product_id) AND (cs.user_id = auth.uid())))))) WITH CHECK ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.company_staff cs ON ((cs.company_id = p.company_id)))
  WHERE ((p.id = product_option_groups.product_id) AND (cs.user_id = auth.uid()))))));


--
-- Name: product_options Store staff manage product options; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store staff manage product options" ON public.product_options USING ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.company_staff cs ON ((cs.company_id = p.company_id)))
  WHERE ((p.id = product_options.product_id) AND (cs.user_id = auth.uid())))))) WITH CHECK ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.company_staff cs ON ((cs.company_id = p.company_id)))
  WHERE ((p.id = product_options.product_id) AND (cs.user_id = auth.uid()))))));


--
-- Name: products Store staff manage products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Store staff manage products" ON public.products USING ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.company_staff cs
  WHERE ((cs.user_id = auth.uid()) AND (cs.company_id = cs.company_id)))))) WITH CHECK ((public.has_role(auth.uid(), 'store_staff'::public.app_role) AND (EXISTS ( SELECT 1
   FROM public.company_staff cs
  WHERE ((cs.user_id = auth.uid()) AND (cs.company_id = cs.company_id))))));


--
-- Name: subscription_plans Super admins can manage plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage plans" ON public.subscription_plans USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: user_roles Super admins can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: companies Super admins can update any company; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can update any company" ON public.companies FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: companies Super admins can view all companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all companies" ON public.companies FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: activity_logs Super admins can view all logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all logs" ON public.activity_logs FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: referrals Super admins manage all referrals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins manage all referrals" ON public.referrals USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: onboarding_steps Super admins manage onboarding steps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins manage onboarding steps" ON public.onboarding_steps USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: inventory_ingredients Super admins view all inventory ingredients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins view all inventory ingredients" ON public.inventory_ingredients FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: inventory_movements Super admins view all inventory movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins view all inventory movements" ON public.inventory_movements FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: inventory_purchases Super admins view all inventory purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins view all inventory purchases" ON public.inventory_purchases FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: user_roles Users can add store_owner role to themselves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add store_owner role to themselves" ON public.user_roles FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (role = 'store_owner'::public.app_role)));


--
-- Name: push_subscriptions Users can delete their own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own subscriptions" ON public.push_subscriptions FOR DELETE USING (((user_id = auth.uid()) OR (user_id IS NULL)));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: customers Users can update own customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own customer" ON public.customers FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid()));


--
-- Name: notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: customers Users can view own customer profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own customer profile" ON public.customers FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)));


--
-- Name: order_items Users can view their order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their order items" ON public.order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.customer_id = auth.uid())))));


--
-- Name: notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: orders Users can view their own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT TO authenticated USING ((customer_id = auth.uid()));


--
-- Name: push_subscriptions Users can view their own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own subscriptions" ON public.push_subscriptions FOR SELECT USING (((user_id = auth.uid()) OR (user_id IS NULL)));


--
-- Name: customer_addresses Users delete own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own addresses" ON public.customer_addresses FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: notification_sound_settings Users manage own notification sounds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own notification sounds" ON public.notification_sound_settings USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: favorites Users manage their favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage their favorites" ON public.favorites USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: customer_addresses Users update own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own addresses" ON public.customer_addresses FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: customer_addresses Users view own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own addresses" ON public.customer_addresses FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: combo_slot_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.combo_slot_products ENABLE ROW LEVEL SECURITY;

--
-- Name: combo_slots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.combo_slots ENABLE ROW LEVEL SECURITY;

--
-- Name: combos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;

--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: company_staff; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_staff ENABLE ROW LEVEL SECURITY;

--
-- Name: coupons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_drivers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;

--
-- Name: favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_ingredients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_ingredients ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_product_ingredients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_product_ingredients ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_purchases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_sound_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_sound_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: onboarding_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_offers ENABLE ROW LEVEL SECURITY;

--
-- Name: order_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: pizza_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pizza_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: pizza_category_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pizza_category_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: pizza_category_settings pizza_category_settings_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_category_settings_delete ON public.pizza_category_settings FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ((public.categories c
     JOIN public.companies co ON ((co.id = c.company_id)))
     LEFT JOIN public.company_staff cs ON (((cs.company_id = co.id) AND (cs.user_id = auth.uid()))))
  WHERE ((c.id = pizza_category_settings.category_id) AND ((co.owner_id = auth.uid()) OR (cs.user_id IS NOT NULL))))));


--
-- Name: pizza_category_settings pizza_category_settings_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_category_settings_insert ON public.pizza_category_settings FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ((public.categories c
     JOIN public.companies co ON ((co.id = c.company_id)))
     LEFT JOIN public.company_staff cs ON (((cs.company_id = co.id) AND (cs.user_id = auth.uid()))))
  WHERE ((c.id = pizza_category_settings.category_id) AND ((co.owner_id = auth.uid()) OR (cs.user_id IS NOT NULL))))));


--
-- Name: pizza_category_settings pizza_category_settings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_category_settings_select ON public.pizza_category_settings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((public.categories c
     JOIN public.companies co ON ((co.id = c.company_id)))
     LEFT JOIN public.company_staff cs ON (((cs.company_id = co.id) AND (cs.user_id = auth.uid()))))
  WHERE ((c.id = pizza_category_settings.category_id) AND ((co.owner_id = auth.uid()) OR (cs.user_id IS NOT NULL))))));


--
-- Name: pizza_category_settings pizza_category_settings_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_category_settings_update ON public.pizza_category_settings FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ((public.categories c
     JOIN public.companies co ON ((co.id = c.company_id)))
     LEFT JOIN public.company_staff cs ON (((cs.company_id = co.id) AND (cs.user_id = auth.uid()))))
  WHERE ((c.id = pizza_category_settings.category_id) AND ((co.owner_id = auth.uid()) OR (cs.user_id IS NOT NULL)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((public.categories c
     JOIN public.companies co ON ((co.id = c.company_id)))
     LEFT JOIN public.company_staff cs ON (((cs.company_id = co.id) AND (cs.user_id = auth.uid()))))
  WHERE ((c.id = pizza_category_settings.category_id) AND ((co.owner_id = auth.uid()) OR (cs.user_id IS NOT NULL))))));


--
-- Name: pizza_category_sizes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pizza_category_sizes ENABLE ROW LEVEL SECURITY;

--
-- Name: pizza_category_sizes pizza_category_sizes_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_category_sizes_manage ON public.pizza_category_sizes TO authenticated USING ((EXISTS ( SELECT 1
   FROM ((public.categories c
     JOIN public.companies co ON ((co.id = c.company_id)))
     LEFT JOIN public.company_staff cs ON (((cs.company_id = co.id) AND (cs.user_id = auth.uid()))))
  WHERE ((c.id = pizza_category_sizes.category_id) AND ((co.owner_id = auth.uid()) OR (cs.user_id IS NOT NULL)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((public.categories c
     JOIN public.companies co ON ((co.id = c.company_id)))
     LEFT JOIN public.company_staff cs ON (((cs.company_id = co.id) AND (cs.user_id = auth.uid()))))
  WHERE ((c.id = pizza_category_sizes.category_id) AND ((co.owner_id = auth.uid()) OR (cs.user_id IS NOT NULL))))));


--
-- Name: pizza_category_sizes pizza_category_sizes_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_category_sizes_select_public ON public.pizza_category_sizes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.categories c
     JOIN public.companies co ON ((co.id = c.company_id)))
  WHERE ((c.id = pizza_category_sizes.category_id) AND (co.status = 'approved'::public.company_status)))));


--
-- Name: pizza_crust_flavors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pizza_crust_flavors ENABLE ROW LEVEL SECURITY;

--
-- Name: pizza_crust_flavors pizza_crust_flavors_manage_store; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_crust_flavors_manage_store ON public.pizza_crust_flavors TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'store_owner'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'store_owner'::public.app_role)));


--
-- Name: pizza_crust_flavors pizza_crust_flavors_manage_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_crust_flavors_manage_super_admin ON public.pizza_crust_flavors USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: pizza_crust_flavors pizza_crust_flavors_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_crust_flavors_select_public ON public.pizza_crust_flavors FOR SELECT USING (true);


--
-- Name: pizza_crust_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pizza_crust_types ENABLE ROW LEVEL SECURITY;

--
-- Name: pizza_crust_types pizza_crust_types_manage_store; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_crust_types_manage_store ON public.pizza_crust_types TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'store_owner'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'store_owner'::public.app_role)));


--
-- Name: pizza_crust_types pizza_crust_types_manage_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_crust_types_manage_super_admin ON public.pizza_crust_types USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: pizza_crust_types pizza_crust_types_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_crust_types_select_public ON public.pizza_crust_types FOR SELECT USING (true);


--
-- Name: pizza_dough_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pizza_dough_types ENABLE ROW LEVEL SECURITY;

--
-- Name: pizza_dough_types pizza_dough_types_manage_store; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_dough_types_manage_store ON public.pizza_dough_types TO authenticated USING ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'store_owner'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'super_admin'::public.app_role) OR public.has_role(auth.uid(), 'store_owner'::public.app_role)));


--
-- Name: pizza_dough_types pizza_dough_types_manage_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_dough_types_manage_super_admin ON public.pizza_dough_types USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: pizza_dough_types pizza_dough_types_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_dough_types_select_public ON public.pizza_dough_types FOR SELECT USING (true);


--
-- Name: pizza_product_crust_flavors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pizza_product_crust_flavors ENABLE ROW LEVEL SECURITY;

--
-- Name: pizza_product_crust_flavors pizza_product_crust_flavors_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_product_crust_flavors_manage ON public.pizza_product_crust_flavors USING ((EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.companies c ON ((c.id = p.company_id)))
  WHERE ((p.id = pizza_product_crust_flavors.product_id) AND ((c.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'store_staff'::public.app_role)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.companies c ON ((c.id = p.company_id)))
  WHERE ((p.id = pizza_product_crust_flavors.product_id) AND ((c.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'store_staff'::public.app_role))))));


--
-- Name: pizza_product_doughs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pizza_product_doughs ENABLE ROW LEVEL SECURITY;

--
-- Name: pizza_product_doughs pizza_product_doughs_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_product_doughs_manage ON public.pizza_product_doughs USING ((EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.companies c ON ((c.id = p.company_id)))
  WHERE ((p.id = pizza_product_doughs.product_id) AND ((c.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'store_staff'::public.app_role)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.companies c ON ((c.id = p.company_id)))
  WHERE ((p.id = pizza_product_doughs.product_id) AND ((c.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'store_staff'::public.app_role))))));


--
-- Name: pizza_product_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pizza_product_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: pizza_product_sizes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pizza_product_sizes ENABLE ROW LEVEL SECURITY;

--
-- Name: pizza_product_sizes pizza_product_sizes_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_product_sizes_manage ON public.pizza_product_sizes USING ((EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.companies c ON ((c.id = p.company_id)))
  WHERE ((p.id = pizza_product_sizes.product_id) AND ((c.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'store_staff'::public.app_role)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.companies c ON ((c.id = p.company_id)))
  WHERE ((p.id = pizza_product_sizes.product_id) AND ((c.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'store_staff'::public.app_role))))));


--
-- Name: pizza_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pizza_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: pizza_sizes_global; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pizza_sizes_global ENABLE ROW LEVEL SECURITY;

--
-- Name: pizza_sizes_global pizza_sizes_global_manage_super_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_sizes_global_manage_super_admin ON public.pizza_sizes_global USING (public.has_role(auth.uid(), 'super_admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: pizza_sizes_global pizza_sizes_global_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pizza_sizes_global_select_public ON public.pizza_sizes_global FOR SELECT USING (true);


--
-- Name: product_option_group_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_option_group_links ENABLE ROW LEVEL SECURITY;

--
-- Name: product_option_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: product_options; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: promotions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: referrals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;