/**
 * Hook para consumir sinais em tempo real
 * Atualiza automaticamente quando há mudanças no banco
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  realtimeSignalsService, 
  type ActiveSignal, 
  type SignalUpdate 
} from '@/services/realtimeSignals';
import { useAuth } from '@/contexts/AuthContext';

interface UseRealtimeSignalsOptions {
  /**
   * Se true, escuta updates individuais (INSERT/UPDATE/DELETE)
   * Útil para animações e transições
   */
  listenToUpdates?: boolean;
  
  /**
   * Callback chamado quando há um update
   */
  onUpdate?: (update: SignalUpdate) => void;
  
  /**
   * Auto-inicializar o serviço
   */
  autoInitialize?: boolean;
}

interface UseRealtimeSignalsReturn {
  /** Sinais ativos atuais (sempre 3) */
  signals: ActiveSignal[];
  
  /** Se está carregando */
  isLoading: boolean;
  
  /** Se houve erro */
  error: Error | null;
  
  /** Forçar refresh manual */
  refresh: () => Promise<void>;
  
  /** Forçar rotação (admin) */
  forceRotation: () => Promise<void>;
  
  /** Reinicializar sistema (admin) */
  reinitialize: () => Promise<void>;
  
  /** Quantidade de sinais */
  count: number;
}

export function useRealtimeSignals(
  options: UseRealtimeSignalsOptions = {}
): UseRealtimeSignalsReturn {
  const {
    listenToUpdates = false,
    onUpdate,
    autoInitialize = true
  } = options;

  const { loading: authLoading } = useAuth();
  const [signals, setSignals] = useState<ActiveSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const isInitializedRef = useRef(false);
  const hasTriedRecoveryRef = useRef(false);
  
  // 🔥 Armazenar código atual para detectar mudanças
  const [currentCode, setCurrentCode] = useState<string | null>(() => {
    try {
      const prefs = localStorage.getItem('trader_preferences');
      if (prefs) {
        const parsed = JSON.parse(prefs);
        return parsed.supporter_code || null;
      }
    } catch {
      // Ignorar
    }
    return null;
  });
  
  // 🔥 Verificar se o código mudou e forçar refresh
  useEffect(() => {
    const checkCodeChange = () => {
      try {
        const prefs = localStorage.getItem('trader_preferences');
        let newCode: string | null = null;
        if (prefs) {
          const parsed = JSON.parse(prefs);
          newCode = parsed.supporter_code || null;
        }
        
        if (newCode !== currentCode) {
          setCurrentCode(newCode);
          // Código mudou - forçar refresh
          if (isInitializedRef.current) {
            realtimeSignalsService.refresh().catch(() => {});
          }
        }
      } catch {
        // Ignorar erro
      }
    };
    
    // Verificar a cada 2 segundos
    const interval = setInterval(checkCodeChange, 2000);
    
    // Também escutar evento customizado
    const handleCodeChange = () => {
      checkCodeChange();
    };
    
    window.addEventListener('supporter-code-changed', handleCodeChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('supporter-code-changed', handleCodeChange);
    };
  }, [currentCode]);

  // Inicializar serviço - AGUARDAR AUTENTICAÇÃO COMPLETAR
  useEffect(() => {
    if (!autoInitialize || isInitializedRef.current) return;
    
    // ✅ AGUARDAR AUTENTICAÇÃO COMPLETAR
    if (authLoading) {
      return;
    }

    isInitializedRef.current = true;
    // Autenticação completa - inicializando

    const init = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        await realtimeSignalsService.initialize();
        
        // Obter sinais iniciais
        const initialSignals = realtimeSignalsService.getSignals();
        setSignals(initialSignals);
        
        setIsLoading(false);
      } catch (err) {
        setError(err as Error);
        setIsLoading(false);
      }
    };

    init();
  }, [autoInitialize, authLoading]);

  // Subscribe para mudanças nos sinais
  useEffect(() => {
    const unsubscribe = realtimeSignalsService.subscribe((updatedSignals) => {
      // Log removido para evitar spam no console
      // console.log('🔔 Hook recebeu atualização de sinais:', updatedSignals.length);
      setSignals(updatedSignals);
      setIsLoading(false);
      
      // ✅ CORREÇÃO: Limpar erro quando sinais são recebidos com sucesso
      if (updatedSignals && updatedSignals.length > 0) {
        setError(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // ✅ CORREÇÃO: Tentar recuperar sinais ao montar (quando volta para a aba)
  useEffect(() => {
    if (hasTriedRecoveryRef.current || authLoading) return;
    
    // Tentar obter sinais existentes do serviço
    const existingSignals = realtimeSignalsService.getSignals();
    
    if (existingSignals && existingSignals.length > 0) {
      // Sinais disponíveis - atualizar estado
      setSignals(existingSignals);
      setIsLoading(false);
      setError(null);
      hasTriedRecoveryRef.current = true;
    } else if (isInitializedRef.current && !isLoading) {
      // Serviço já foi inicializado mas não há sinais - tentar refresh automático
      hasTriedRecoveryRef.current = true;
      
      const autoRecovery = async () => {
        try {
          await realtimeSignalsService.refresh();
          const recoveredSignals = realtimeSignalsService.getSignals();
          
          if (recoveredSignals && recoveredSignals.length > 0) {
            setSignals(recoveredSignals);
            setError(null);
          }
        } catch {
          // silenciar falha de recuperação automática
        }
      };
      
      autoRecovery();
    }
  }, [authLoading, isLoading]);

  // Ref para onUpdate — evita recriar subscriber quando callback inline muda referência
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  // Subscribe para updates individuais (se habilitado)
  useEffect(() => {
    if (!listenToUpdates) return;

    const unsubscribe = realtimeSignalsService.subscribeToUpdates((update) => {
      onUpdateRef.current?.(update);
    });

    return () => {
      unsubscribe();
    };
  }, [listenToUpdates]); // onUpdate não precisa mais estar nas deps

  // Funções auxiliares
  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await realtimeSignalsService.refresh();
      
      // ✅ CORREÇÃO: Obter sinais após refresh
      const refreshedSignals = realtimeSignalsService.getSignals();
      setSignals(refreshedSignals);
      
      setIsLoading(false);
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
    }
  }, []);

  const forceRotation = useCallback(async () => {
    await realtimeSignalsService.forceRotation();
  }, []);

  const reinitialize = useCallback(async () => {
    try {
      setIsLoading(true);
      await realtimeSignalsService.reinitialize();
      setIsLoading(false);
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
      throw err;
    }
  }, []);

  return {
    signals,
    isLoading,
    error,
    refresh,
    forceRotation,
    reinitialize,
    count: signals.length
  };
}

/**
 * Hook simplificado que retorna apenas os 3 sinais
 * Ideal para Dashboard
 */
export function useActiveSignals(): ActiveSignal[] {
  const { signals } = useRealtimeSignals();
  return signals;
}

/**
 * Hook que retorna um sinal específico por posição
 */
export function useSignalByPosition(position: 1 | 2 | 3): ActiveSignal | null {
  const { signals } = useRealtimeSignals();
  return signals.find(s => s.position === position) || null;
}
