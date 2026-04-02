-- =============================================
-- SINAIS PERSONALIZADOS POR CÓDIGO DE APOIADOR
-- =============================================
-- Data: 2026-03-15
-- Objetivo: Permitir que usuários com diferentes códigos de apoiador
--          vejam sinais diferentes (ativos e ordem diferentes)
-- Lógica: 
--   - Usuários com mesmo código veem mesmos sinais
--   - Usuários sem código veem sinais padrão
--   - Variação baseada em hash determinístico (código + data + posição)
-- =============================================

-- =============================================
-- FUNÇÃO: GERAR HASH PARA SELEÇÃO DE ATIVO
-- =============================================

CREATE OR REPLACE FUNCTION get_asset_selection_seed(
  p_supporter_code TEXT DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE,
  p_position INTEGER DEFAULT 1
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  -- Se não tem código, usa 'DEFAULT' como seed
  -- Isso garante que todos sem código vejam os mesmos sinais
  IF p_supporter_code IS NULL OR p_supporter_code = '' THEN
    RETURN 'DEFAULT_' || TO_CHAR(p_date, 'YYYYMMDD') || '_' || p_position::TEXT;
  END IF;
  
  -- Com código, cria seed única para aquele código
  RETURN p_supporter_code || '_' || TO_CHAR(p_date, 'YYYYMMDD') || '_' || p_position::TEXT;
END;
$$;

-- =============================================
-- FUNÇÃO: GERAR NOVO SINAL COM CÓDIGO DE APOIADOR
-- =============================================

CREATE OR REPLACE FUNCTION generate_new_signal_with_code(
  p_position INTEGER DEFAULT 3,
  p_entry_time TIME DEFAULT NULL,
  p_supporter_code TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset RECORD;
  v_entry_time TIME;
  v_signal_type TEXT;
  v_success_rate NUMERIC;
  v_strength TEXT;
  v_new_signal_id UUID;
  v_day_of_week INTEGER;
  v_seed TEXT;
  v_hash_value INTEGER;
BEGIN
  v_entry_time := COALESCE(p_entry_time, get_next_valid_entry_time(LOCALTIME));
  v_day_of_week := EXTRACT(DOW FROM CURRENT_DATE);
  
  -- Gerar seed baseada no código de apoiador
  v_seed := get_asset_selection_seed(p_supporter_code, CURRENT_DATE, p_position);
  
  -- Converter seed para hash numérico
  v_hash_value := ('x' || substring(md5(v_seed), 1, 8))::bit(32)::int;
  
  -- Selecionar ativo usando hash determinístico
  -- Usuários com mesmo código verão mesmo ativo
  SELECT 
    ta.id,
    ta.symbol,
    ta.display_name,
    COALESCE(ac.name, 'Cripto') as category_name
  INTO v_asset
  FROM public.trading_assets ta
  LEFT JOIN public.asset_categories ac ON ta.category_id = ac.id
  WHERE ta.is_active = TRUE
    AND is_asset_available_at(ta.id, v_entry_time, v_day_of_week)
  ORDER BY md5(ta.symbol || v_seed)  -- Ordem determinística baseada na seed
  LIMIT 1;
  
  IF v_asset.id IS NULL THEN
    RAISE EXCEPTION 'Nenhum ativo disponível para % com código %', v_entry_time, p_supporter_code;
  END IF;
  
  -- Tipo de sinal baseado no hash (determinístico)
  v_signal_type := CASE WHEN (ABS(v_hash_value) % 2) = 0 THEN 'BUY' ELSE 'SELL' END;
  
  -- Taxa de sucesso baseada no hash (75-95%)
  v_success_rate := 0.75 + ((ABS(v_hash_value) % 20) / 100.0);
  v_strength := CASE
    WHEN v_success_rate >= 0.90 THEN 'Expectativa alta'
    WHEN v_success_rate >= 0.80 THEN 'Expectativa média'
    ELSE 'Expectativa baixa'
  END;
  
  -- Inserir sinal
  INSERT INTO public.active_signals (
    position, asset_id, symbol, display_name, category,
    entry_time, expiry_time, gale1_time, gale2_time,
    signal_type, strength, success_rate, expires_at
  ) VALUES (
    p_position, v_asset.id, v_asset.symbol, v_asset.display_name, v_asset.category_name,
    v_entry_time,
    v_entry_time + INTERVAL '5 minutes',
    v_entry_time + INTERVAL '5 minutes',
    v_entry_time + INTERVAL '10 minutes',
    v_signal_type, v_strength, v_success_rate,
    NOW() + INTERVAL '16 minutes'
  )
  RETURNING id INTO v_new_signal_id;
  
  -- Histórico
  INSERT INTO public.signals_history (
    asset_id, symbol, display_name, entry_time, signal_type, strength
  ) VALUES (
    v_asset.id, v_asset.symbol, v_asset.display_name, v_entry_time, v_signal_type, v_strength
  );
  
  RETURN v_new_signal_id;
END;
$$;

-- =============================================
-- FUNÇÃO: INICIALIZAR SINAIS COM CÓDIGO
-- =============================================

CREATE OR REPLACE FUNCTION initialize_signals_with_code(
  p_supporter_code TEXT DEFAULT NULL
)
RETURNS TABLE (position INTEGER, signal_id UUID, symbol TEXT, entry_time TIME)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_time TIME := LOCALTIME;
  v_times TIME[];
  v_id UUID;
  i INTEGER;
BEGIN
  DELETE FROM public.active_signals;
  
  v_times := ARRAY[
    get_next_valid_entry_time(v_time),
    get_next_valid_entry_time(get_next_valid_entry_time(v_time) + INTERVAL '1 minute'),
    get_next_valid_entry_time(get_next_valid_entry_time(v_time) + INTERVAL '21 minutes')
  ];
  
  FOR i IN 1..3 LOOP
    v_id := generate_new_signal_with_code(i, v_times[i], p_supporter_code);
    RETURN QUERY
    SELECT i, v_id, acs.symbol, acs.entry_time
    FROM public.active_signals acs WHERE acs.id = v_id;
  END LOOP;
END;
$$;

-- =============================================
-- FUNÇÃO: GET EXTENDED SIGNALS COM CÓDIGO
-- =============================================

CREATE OR REPLACE FUNCTION public.get_extended_signals_with_code(
  p_supporter_code TEXT DEFAULT NULL
)
RETURNS json[]
LANGUAGE plpgsql
AS $function$
DECLARE
  v_results json[] := ARRAY[]::json[];
  v_next_hour INTEGER;
  v_next_minute INTEGER;
  v_asset RECORD;
  v_count INTEGER := 0;
  v_used_symbols TEXT[] := ARRAY[]::TEXT[];
  v_seed TEXT;
  v_hash_int INTEGER;
  v_signal_type TEXT;
  v_success_base NUMERIC;
  v_last_entry TIME;
  v_current_time TIME;
BEGIN
  v_current_time := LOCALTIME;
  
  -- 1. Adicionar os 3 sinais ativos
  SELECT array_agg(row_to_json(t)) INTO v_results
  FROM (
    SELECT 
      a.id::TEXT,
      a.position,
      a.asset_id::TEXT,
      a.symbol,
      a.display_name,
      a.category,
      a.entry_time::TEXT,
      a.expiry_time::TEXT,
      a.gale1_time::TEXT,
      a.gale2_time::TEXT,
      a.signal_type,
      a.strength,
      a.success_rate,
      a.created_at,
      a.expires_at,
      a.is_active,
      false AS is_additional
    FROM active_signals a
    WHERE a.is_active = true
    ORDER BY a.position ASC
  ) t;
  
  -- 2. Pegar símbolos já usados
  SELECT array_agg(a.symbol) INTO v_used_symbols
  FROM active_signals a
  WHERE a.is_active = true;
  
  -- 3. Calcular próximo horário
  SELECT MAX(a.entry_time) INTO v_last_entry
  FROM active_signals a
  WHERE a.is_active = true;
  
  IF v_last_entry IS NULL THEN
    v_last_entry := v_current_time;
  END IF;
  
  v_next_hour := EXTRACT(HOUR FROM v_last_entry);
  v_next_minute := EXTRACT(MINUTE FROM v_last_entry);
  
  IF v_next_minute >= 43 THEN
    v_next_hour := (v_next_hour + 1) % 24;
    v_next_minute := 3;
  ELSIF v_next_minute >= 23 THEN
    v_next_minute := 43;
  ELSIF v_next_minute >= 3 THEN
    v_next_minute := 23;
  ELSE
    v_next_minute := 3;
  END IF;
  
  WHILE make_time(v_next_hour, v_next_minute, 0) < v_current_time LOOP
    IF v_next_minute = 3 THEN
      v_next_minute := 23;
    ELSIF v_next_minute = 23 THEN
      v_next_minute := 43;
    ELSIF v_next_minute = 43 THEN
      v_next_minute := 3;
      v_next_hour := (v_next_hour + 1) % 24;
    END IF;
  END LOOP;
  
  -- 4. Gerar 4 sinais adicionais com código de apoiador
  FOR v_asset IN 
    SELECT 
      ta.id,
      ta.symbol,
      ta.display_name,
      ac.name AS category
    FROM trading_assets ta
    JOIN asset_categories ac ON ta.category_id = ac.id
    WHERE 
      ta.is_active = true
      AND (v_used_symbols IS NULL OR ta.symbol != ALL(v_used_symbols))
    ORDER BY md5(ta.symbol || get_asset_selection_seed(p_supporter_code, CURRENT_DATE, 4 + v_count))
    LIMIT 4
  LOOP
    v_count := v_count + 1;
    
    -- Seed baseada no código
    v_seed := get_asset_selection_seed(p_supporter_code, CURRENT_DATE, 3 + v_count);
    v_hash_int := ('x' || substring(md5(v_seed), 1, 8))::bit(32)::int;
    v_signal_type := CASE WHEN (ABS(v_hash_int) % 2) = 0 THEN 'BUY' ELSE 'SELL' END;
    v_success_base := 0.85 + ((ABS(v_hash_int) % 100) / 1000.0);
    
    v_results := v_results || json_build_object(
      'id', gen_random_uuid()::TEXT,
      'position', 3 + v_count,
      'asset_id', v_asset.id::TEXT,
      'symbol', v_asset.symbol,
      'display_name', v_asset.display_name,
      'category', v_asset.category,
      'entry_time', make_time(v_next_hour, v_next_minute, 0)::TEXT,
      'expiry_time', make_time(v_next_hour, (v_next_minute + 5) % 60, 0)::TEXT,
      'gale1_time', make_time(v_next_hour, (v_next_minute + 5) % 60, 0)::TEXT,
      'gale2_time', make_time(v_next_hour, (v_next_minute + 10) % 60, 0)::TEXT,
      'signal_type', v_signal_type,
      'strength', 
        CASE 
          WHEN v_success_base >= 0.92 THEN 'Alta expectativa'
          WHEN v_success_base >= 0.85 THEN 'Expectativa média'
          ELSE 'Expectativa baixa'
        END,
      'success_rate', v_success_base,
      'created_at', NOW(),
      'expires_at', (CURRENT_DATE + make_time(v_next_hour, v_next_minute, 0)) + INTERVAL '15 minutes',
      'is_active', true,
      'is_additional', true
    );
    
    IF v_next_minute = 3 THEN
      v_next_minute := 23;
    ELSIF v_next_minute = 23 THEN
      v_next_minute := 43;
    ELSIF v_next_minute = 43 THEN
      v_next_minute := 3;
      v_next_hour := (v_next_hour + 1) % 24;
    END IF;
  END LOOP;
  
  RETURN v_results;
END;
$function$;

-- =============================================
-- COMENTÁRIOS
-- =============================================

COMMENT ON FUNCTION get_asset_selection_seed IS 'Gera seed única baseada no código de apoiador + data + posição';
COMMENT ON FUNCTION generate_new_signal_with_code IS 'Gera sinal usando seed do código de apoiador para selecionar ativo';
COMMENT ON FUNCTION initialize_signals_with_code IS 'Inicializa sistema com 3 sinais baseados no código';
COMMENT ON FUNCTION get_extended_signals_with_code IS 'Retorna 7 sinais (3 ativos + 4 adicionais) personalizados por código';
