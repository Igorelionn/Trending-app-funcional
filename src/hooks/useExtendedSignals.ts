/**
 * Hook para buscar 7 sinais (3 ativos + 4 adicionais) via RPC
 * Usado APENAS na aba Trades
 * Dashboard usa useRealtimeSignals() para 3 sinais
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { ActiveSignal } from '@/services/realtimeSignals';
import { useAuth } from '@/contexts/AuthContext';

// Declaração global para debounce
declare global {
  interface Window {
    __lastExtendedSignalsFetch?: number;
  }
}

export function useExtendedSignals() {
  const { loading: authLoading } = useAuth();  // ✅ Pega status de loading do auth
  
  // 🔥 BUSCAR CÓDIGO DE APOIADOR PARA CACHE
  const getSupporterCode = () => {
    try {
      const prefs = localStorage.getItem('trader_preferences');
      if (prefs) {
        const parsed = JSON.parse(prefs);
        return parsed.supporter_code || 'DEFAULT';
      }
    } catch {
      // Ignorar erro
    }
    return 'DEFAULT';
  };
  
  const supporterCode = getSupporterCode();
  const STORAGE_KEY = `extended_signals_cache_${supporterCode}`;
  const CACHE_DATE_KEY = `extended_signals_cache_date_${supporterCode}`;
  
  // 🔥 VERSÃO 3.0: LIMPEZA INTELIGENTE
  const CACHE_VERSION_KEY = 'extended_signals_cache_version';
  const CURRENT_VERSION = '3.1'; // Incrementar sempre que mudar estrutura de dados
  
  const [signals, setSignals] = useState<ActiveSignal[]>(() => {
    try {
      const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY);
      
      if (cachedVersion !== CURRENT_VERSION) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(CACHE_DATE_KEY);
        localStorage.setItem(CACHE_VERSION_KEY, CURRENT_VERSION);
        return [];
      }
      
      const today = new Date().toDateString();
      const cacheDate = localStorage.getItem(CACHE_DATE_KEY);
      
      if (cacheDate === today) {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch {
      // cache inválido
    }
    
    return [];
  });
  
  const [isLoading, setIsLoading] = useState(() => {
    try {
      const today = new Date().toDateString();
      const cacheDate = localStorage.getItem(CACHE_DATE_KEY);
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cacheDate === today && cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return false; // Tem cache válido, não está loading
        }
      }
    } catch {
      // Erro ao verificar cache, considera vazio
    }
    return true; // Sem cache válido, está loading
  });
  const [error, setError] = useState<Error | null>(null);
  
  // 🔥 TIMEOUT GLOBAL: Garantir que isLoading sempre vire false após 12s
  useEffect(() => {
    const globalTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 12000);
    
    return () => {
      clearTimeout(globalTimeout);
    };
  }, []); // Executar apenas uma vez ao montar

  const fetchExtendedSignals = useCallback(async () => {
    // 🔥 TIMEOUT DE SEGURANÇA: Se demorar mais de 10s, desativar loading
    const safetyTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 10000);
    
    try {
      setIsLoading(true);
      setError(null);

      const supabase = getSupabase();
      
      // 🔥 BUSCAR CÓDIGO DE APOIADOR DO LOCALSTORAGE
      let supporterCode: string | null = null;
      try {
        const prefs = localStorage.getItem('trader_preferences');
        if (prefs) {
          const parsed = JSON.parse(prefs);
          supporterCode = parsed.supporter_code || null;
        }
      } catch {
        // Ignorar erro ao buscar preferências
      }
      
      // 🔥 DEBUG: Log do código usado
      console.log('🔍 [Extended Signals] Código de apoiador:', supporterCode || 'DEFAULT');

      // ⚡ RETRY com TIMEOUT REDUZIDO de 8s por tentativa (evitar travamento)
      let result;
      let lastError: Error | null = null;
      const maxRetries = 1; // ⚡ Reduzido para 1 tentativa
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const attemptPromise = (supabase as any).rpc('get_extended_signals_with_code', {
            p_supporter_code: supporterCode
          });
          const attemptTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`RPC timeout tentativa ${attempt}`)), 8000)
          );
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await Promise.race([attemptPromise, attemptTimeout]) as any;
          break; // Sucesso, sair do loop
        } catch (error) {
          lastError = error as Error;
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            throw lastError;
          }
        }
      }
      
      if (!result) {
        throw lastError || new Error('Todas as tentativas falharam');
      }
      
      const { data, error: rpcError } = result;

      if (rpcError) {
        throw rpcError;
      }

      if (!data || data.length === 0) {
        // ✅ FALLBACK: Se RPC retornar vazio mas tem cache, manter cache
        const currentSignals = signals.length > 0 ? signals : JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (currentSignals.length > 0) {
          setSignals(currentSignals);
        }
        clearTimeout(safetyTimeout);
        setIsLoading(false);
        return;
      }

      // Converter JSON para ActiveSignal COM VALIDAÇÃO
      const currentDate = new Date();
      const currentHour = currentDate.getHours();
      const currentMinute = currentDate.getMinutes();
      
      const convertedSignals = (data || [])
        .map((signalJson: unknown) => {
          const signal = signalJson as ActiveSignal;
          
          const entryTimeStr = signal.entry_time?.substring(0, 5) || signal.entry_time;
          const [entryHourStr, entryMinuteStr] = entryTimeStr.split(':');
          const entryHour = parseInt(entryHourStr);
          const entryMinute = parseInt(entryMinuteStr);
          
          let timeDiffMinutes = (currentHour * 60 + currentMinute) - (entryHour * 60 + entryMinute);
          
          if (timeDiffMinutes > 720) {
            timeDiffMinutes -= 1440;
          } else if (timeDiffMinutes < -720) {
            timeDiffMinutes += 1440;
          }
          
          if (timeDiffMinutes > 30) {
            return null;
          }
          
          return {
            ...signal,
            entry_time: entryTimeStr,
            expiry_time: signal.expiry_time?.substring(0, 5) || signal.expiry_time,
            gale1_time: signal.gale1_time?.substring(0, 5) || signal.gale1_time,
            gale2_time: signal.gale2_time?.substring(0, 5) || signal.gale2_time,
          };
        })
        .filter((s): s is ActiveSignal => s !== null);

      // ✅ CORREÇÃO CRÍTICA: Ordenar por POSITION (não por entry_time)
      const sortedSignals = convertedSignals.sort((a, b) => {
        return (a.position || 0) - (b.position || 0);
      });

      const currentCache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const currentOrder = sortedSignals.map(s => `${s.symbol}_${s.entry_time}_${s.position}`).join('|');
      const cachedOrder = currentCache.map((s: ActiveSignal) => `${s.symbol}_${s.entry_time}_${s.position}`).join('|');
      
      if (currentOrder === cachedOrder && currentCache.length === sortedSignals.length) {
        setIsLoading(false);
        return;
      }
      
      // ✅ VALIDAÇÃO: Verificar integridade dos sinais
      if (typeof window !== 'undefined') {
        import('@/utils/signalValidation').then(({ validateSignalSet, logValidationResult }) => {
          const validation = validateSignalSet(sortedSignals);
          logValidationResult('Extended Signals', validation);
        }).catch(() => {
          // silenciar falha de validação
        });
      }
      
      // ✅ Salvar cache com timestamp
      try {
        const today = new Date().toDateString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sortedSignals));
        localStorage.setItem(CACHE_DATE_KEY, today);
      } catch {
        // silenciar erro ao salvar cache
      }
      
      setSignals(sortedSignals);
      
      clearTimeout(safetyTimeout);
      
      setIsLoading(false);
    } catch (err) {
      clearTimeout(safetyTimeout);
      
      // ✅ FALLBACK: Em caso de erro, manter sinais do cache
      const currentSignals = signals.length > 0 ? signals : JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (currentSignals.length > 0) {
        setSignals(currentSignals);
      } else {
        setError(err as Error);
      }
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ SEM DEPENDÊNCIAS - função estável, signals usado apenas como fallback

  const hasInitialized = useRef(false);
  
  useEffect(() => {
    if (authLoading) {
      const authTimeout = setTimeout(() => {
        setIsLoading(false);
      }, 10000);
      
      return () => clearTimeout(authTimeout);
    }
    
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      
      // Carregar cache existente imediatamente enquanto busca dados frescos
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsedCache = JSON.parse(cached);
          if (Array.isArray(parsedCache) && parsedCache.length > 0) {
            setSignals(parsedCache);
            setIsLoading(false);
          }
        }
      } catch {
        // cache inválido - ignorar
      }
    }
    
    // 🔥 Pequeno delay antes de buscar para dar tempo do layout renderizar
    const fetchDelay = setTimeout(() => {
      fetchExtendedSignals();
    }, 100); // 100ms de delay
    
    let refreshTimeout: NodeJS.Timeout | null = null;
    
    const handleBackgroundResume = () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => { fetchExtendedSignals(); }, 500);
    };
    
    const handleForceRefresh = () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => { fetchExtendedSignals(); }, 500);
    };
    
    window.addEventListener('force-update-after-background', handleBackgroundResume);
    window.addEventListener('force-refresh-signals', handleForceRefresh);
    
    return () => {
      if (fetchDelay) clearTimeout(fetchDelay); // 🔥 Limpar delay
      if (refreshTimeout) clearTimeout(refreshTimeout);
      window.removeEventListener('force-update-after-background', handleBackgroundResume);
      window.removeEventListener('force-refresh-signals', handleForceRefresh);
    };
  }, [authLoading, fetchExtendedSignals]);

  // ✅ REALTIME: Escutar mudanças APENAS nos 3 sinais principais (active_signals)
  useEffect(() => {
    if (authLoading) {
      return;
    }
    
    if (!hasInitialized.current) {
      return;
    }
    
    const supabase = getSupabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase as any)
      .channel('extended-signals-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'active_signals'
        },
        () => {
          const lastCall = window.__lastExtendedSignalsFetch || 0;
          const timeSinceLastCall = Date.now() - lastCall;
          
          if (timeSinceLastCall < 5000) {
            return;
          }
          
          window.__lastExtendedSignalsFetch = Date.now();
          fetchExtendedSignals();
        }
      )
      .subscribe();

    const handleDashboardRotation = () => {
      window.__lastExtendedSignalsFetch = Date.now();
      fetchExtendedSignals();
    };

    window.addEventListener('signalsRotated', handleDashboardRotation);

    const handleForceUpdate = () => {
      consecutiveChecks = 0;
      window.__lastExtendedSignalsFetch = Date.now();
      fetchExtendedSignals();
    };

    const handleForceRefresh = () => {
      window.__lastExtendedSignalsFetch = Date.now();
      fetchExtendedSignals();
    };

    window.addEventListener('force-update-after-background', handleForceUpdate);
    window.addEventListener('force-refresh-signals', handleForceRefresh);

    let pollingTimeoutId: NodeJS.Timeout | null = null;
    let consecutiveChecks = 0;
    const MAX_CONSECUTIVE = 100;
    
    const checkRotation = () => {
      if (consecutiveChecks > MAX_CONSECUTIVE) {
        return;
      }
      consecutiveChecks++;
      
      if (signals.length === 0) {
        pollingTimeoutId = setTimeout(checkRotation, 30000);
        return;
      }
      
      const firstSignal = signals[0];
      if (!firstSignal) {
        pollingTimeoutId = setTimeout(checkRotation, 30000);
        return;
      }
      
      const entryTime = firstSignal.entry_time;
      const [entryHour, entryMinute] = entryTime.split(':').map(Number);
      
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      let minutesSinceEntry = (currentHour * 60 + currentMinute) - (entryHour * 60 + entryMinute);
      
      if (minutesSinceEntry > 720) {
        minutesSinceEntry -= 1440;
      } else if (minutesSinceEntry < -720) {
        minutesSinceEntry += 1440;
      }
      
      if (minutesSinceEntry >= 15) {
        consecutiveChecks = 0;
        fetchExtendedSignals();
        pollingTimeoutId = setTimeout(checkRotation, 60000);
      } else {
        const timeUntilRotation = 15 - minutesSinceEntry;
        
        let nextCheckInterval;
        if (timeUntilRotation <= 1) {
          nextCheckInterval = 15000;
        } else if (timeUntilRotation <= 3) {
          nextCheckInterval = 30000;
        } else {
          nextCheckInterval = 60000;
        }
        
        pollingTimeoutId = setTimeout(checkRotation, nextCheckInterval);
      }
    };
    
    checkRotation();

    return () => {
      if (pollingTimeoutId) {
        clearTimeout(pollingTimeoutId);
        pollingTimeoutId = null;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).removeChannel(channel);
      window.removeEventListener('signalsRotated', handleDashboardRotation);
      window.removeEventListener('force-update-after-background', handleForceUpdate);
      window.removeEventListener('force-refresh-signals', handleForceRefresh);
    };
  }, [authLoading, fetchExtendedSignals, signals]);

  return {
    signals,
    isLoading,
    error,
    refresh: fetchExtendedSignals,
  };
}
