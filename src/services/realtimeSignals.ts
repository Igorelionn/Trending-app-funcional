/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVIÇO DE SINAIS EM TEMPO REAL
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * NOVA LÓGICA (2026-01-20):
 * - Sinais gerados dinamicamente baseados no horário atual
 * - Rotação automática a cada 16 minutos
 * - Horários fixos: 03, 23, 43 minutos
 * - Sincronização via Supabase Realtime
 * - Todos os usuários veem os mesmos sinais
 * 
 * IMPORTANTE: Este é o ÚNICO serviço de sinais ativo
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { getSupabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getCachedData, setCachedData } from '@/utils/smartCache';

// =============================================
// TIPOS
// =============================================

export interface ActiveSignal {
  id: string;
  position: number;
  asset_id: string;
  symbol: string;
  display_name: string;
  category: string;
  entry_time: string;
  expiry_time: string;
  gale1_time: string;
  gale2_time: string;
  signal_type: 'BUY' | 'SELL';
  strength: string;
  success_rate: number;
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

export interface SignalUpdate {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  signal: ActiveSignal;
  oldSignal?: ActiveSignal;
}

export type SignalCallback = (signals: ActiveSignal[]) => void;
export type UpdateCallback = (update: SignalUpdate) => void;

interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: ActiveSignal | Record<string, never>;
  old: ActiveSignal | Record<string, never>;
  errors: string[] | null;
}

// =============================================
// SERVIÇO PRINCIPAL
// =============================================

class RealtimeSignalsService {
  private channel: RealtimeChannel | null = null;
  private signals: ActiveSignal[] = [];
  private callbacks: Set<SignalCallback> = new Set();
  private updateCallbacks: Set<UpdateCallback> = new Set();
  private isInitialized = false;
  private isIntentionalDisconnect = false; // 🔥 Flag para evitar loop de reconexão
  private supporterCode: string | null = null; // 🔥 Código de apoiador do usuário
  private readonly CACHE_VERSION_KEY = 'realtime_signals_cache_version';
  private readonly CURRENT_VERSION = '3.1'; // 🔥 Incrementar quando mudar estrutura de dados
  
  // 🔥 Getter dinâmico para STORAGE_KEY baseado no código
  private get STORAGE_KEY(): string {
    const code = this.getSupporterCode();
    return `realtime_signals_cache_${code || 'DEFAULT'}`;
  }
  
  // 🔥 Buscar código de apoiador do localStorage
  private getSupporterCode(): string | null {
    try {
      const prefs = localStorage.getItem('trader_preferences');
      if (prefs) {
        const parsed = JSON.parse(prefs);
        return parsed.supporter_code || null;
      }
    } catch {
      // Ignorar erro
    }
    return null;
  }
  
  constructor() {
    // 🔥 Verificar versão e limpar se necessário
    this.checkCacheVersion();
    
    // ✅ NÃO carregar cache inicial - sempre buscar do servidor
    // this.loadFromCache(); // DESABILITADO
    
    // ✅ CORREÇÃO: Não usar beforeunload (causa aviso do navegador)
    // O cache será salvo automaticamente quando necessário via visibilitychange
  }
  
  /**
   * Verifica versão do cache e limpa se necessário
   */
  private checkCacheVersion(): void {
    // Verificando versão do cache
    
    try {
      const cachedVersion = localStorage.getItem(this.CACHE_VERSION_KEY);
      
      // Se versão diferente, limpar
      if (cachedVersion !== this.CURRENT_VERSION) {
        // Limpando cache
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem('realtime_signals_cache_date');
        localStorage.setItem(this.CACHE_VERSION_KEY, this.CURRENT_VERSION);
      } else {
        // Cache na versão correta (silenciado)
      }
    } catch {
      // ignorar erros de verificação de cache
    }
  }
  
  /**
   * Salva sinais no localStorage usando smartCache
   */
  private saveToCache(): void {
    if (this.signals.length > 0) {
      setCachedData(this.STORAGE_KEY, this.signals);
    }
  }
  
  /**
   * Carrega sinais do localStorage usando smartCache
   * Apenas retorna dados se cache for válido (< 3 minutos)
   */
  private loadFromCache(): void {
    const cached = getCachedData<ActiveSignal[]>(this.STORAGE_KEY);
    if (cached) {
      this.signals = cached;
    }
  }

  /**
   * Inicializa o serviço e estabelece conexão Realtime
   */
  async initialize(): Promise<void> {
    
    if (this.isInitialized && this.signals.length > 0 && this.channel) {
      return;
    }

    try {
      // Inicializando

      if (this.isInitialized) {
        this.cleanup();
      }

      // Buscar sinais iniciais
      // Buscando sinais iniciais
      await this.fetchInitialSignals();
      // Sinais iniciais carregados

      // Configurar Realtime subscription
      // Configurando Realtime
      this.setupRealtimeSubscription();
      // Realtime configurado
      
      this.startConnectionMonitor();
      this.setupForceRefreshListener();
      this.isInitialized = true;
    } catch (error) {
      this.isInitialized = false;
      throw error;
    }
  }
  
  /**
   * Limpa o serviço (remove channels e callbacks)
   */
  private cleanup(): void {
    if (this.channel) {
      const supabase = getSupabase();
      (supabase as SupabaseClient<Database>).removeChannel(this.channel);
      this.channel = null;
    }
    this.isInitialized = false;
  }

  /**
   * Transforma horário removendo segundos (HH:mm:ss -> HH:mm)
   */
  private formatTimeWithoutSeconds(time: string): string {
    if (!time) return time;
    // Se o horário tiver segundos (formato HH:mm:ss), remover
    const parts = time.split(':');
    if (parts.length === 3) {
      return `${parts[0]}:${parts[1]}`;
    }
    return time;
  }

  /**
   * Transforma um sinal removendo segundos dos horários
   */
  private transformSignal(signal: ActiveSignal): ActiveSignal {
    return {
      ...signal,
      entry_time: this.formatTimeWithoutSeconds(signal.entry_time),
      expiry_time: this.formatTimeWithoutSeconds(signal.expiry_time),
      gale1_time: this.formatTimeWithoutSeconds(signal.gale1_time),
      gale2_time: this.formatTimeWithoutSeconds(signal.gale2_time),
    };
  }

  /**
   * Busca apenas os 3 sinais ativos de active_signals
   * (Para dashboard - NÃO usar RPC aqui)
   */
  private async fetchInitialSignals(): Promise<void> {
    const maxRetries = 1; // ⚡ Reduzido para 1 tentativa (evitar travamento)
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const supabase = getSupabase();
        
        // 🔥 Atualizar código de apoiador
        this.supporterCode = this.getSupporterCode();
        
        // ⚡ Timeout REDUZIDO para 8 segundos (evitar travamento da UI)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabaseAny = supabase as any;
        const queryPromise = supabaseAny.rpc('get_active_signals_with_code', {
          p_supporter_code: this.supporterCode
        });
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Query timeout após 8s (tentativa ${attempt})`)), 8000)
        );
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

        if (error) {
          lastError = error;
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
          throw error;
        }

        // Sinais recebidos do banco

        if (!data || data.length === 0) {
          this.signals = [];
          this.notifyCallbacks();
          return;
        }

        // ✅ VALIDAÇÃO: Filtrar sinais muito antigos (> 90 min)
        const currentDate = new Date();
        const currentHour = currentDate.getHours();
        const currentMinute = currentDate.getMinutes();
        
        // Horário atual
        
        const validSignals = (data || []).filter((signal: ActiveSignal) => {
          const entryTimeStr = signal.entry_time?.substring(0, 5) || signal.entry_time;
          const [entryHourStr, entryMinuteStr] = entryTimeStr.split(':');
          const entryHour = parseInt(entryHourStr);
          const entryMinute = parseInt(entryMinuteStr);
          
          // Calcular diferença em minutos considerando wrap de 24h
          let timeDiffMinutes = (currentHour * 60 + currentMinute) - (entryHour * 60 + entryMinute);
          
          // ✅ CORREÇÃO COMPLETA: Ajustar para horários que cruzam meia-noite
          // Se a diferença for > 720 minutos (12 horas), o sinal é do próximo dia (futuro)
          if (timeDiffMinutes > 720) {
            timeDiffMinutes -= 1440;
          } else if (timeDiffMinutes < -720) {
            timeDiffMinutes += 1440;
          }
          
          if (timeDiffMinutes > 30) {
            return false;
          }
          
          return true;
        });

        // Total após validação

        // Transformar sinais para remover segundos
        this.signals = validSignals.map((signal: ActiveSignal) => this.transformSignal(signal));
        // Sinais processados
        
        // Salvar no cache
        this.saveToCache();
        // Cache atualizado
        
        // Notificar callbacks
        this.notifyCallbacks();
        // Callbacks notificados
        
        // Sucesso! Sair do loop
        return;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    // Fallback: usar cache ou array vazio para desbloquear UI
    if (this.signals.length > 0) {
      this.notifyCallbacks();
    } else {
      this.signals = [];
      this.notifyCallbacks();
    }
  }

  /**
   * Configura subscription do Supabase Realtime
   * 🔥 DESABILITADO: Sinais agora são gerados dinamicamente por código de apoiador
   * Não precisamos mais escutar mudanças na tabela active_signals
   */
  private setupRealtimeSubscription(): void {
    // 🔥 Realtime subscription desabilitada
    // Os sinais são gerados dinamicamente baseados no código de apoiador
    // e não vêm mais da tabela active_signals
    
    // Manter atualização periódica via polling
    // O startConnectionMonitor já faz isso
    return;
  }

  /**
   * ✅ CORREÇÃO 5: Verificação periódica de conexão Realtime
   * Garante que a conexão está ativa, reconecta se necessário
   */
  private startConnectionMonitor(): void {
    // ✅ POLLING OTIMIZADO: Sistema recursivo que funciona melhor em background
    let lastCheckTime = Date.now();
    let monitorTimeoutId: NodeJS.Timeout | null = null;
    const MONITOR_INTERVAL = 30000; // 30 segundos
    
    const checkConnection = () => {
      const now = Date.now();
      const timeSinceLastCheck = now - lastCheckTime;
      // Verificar conexão (silencioso para evitar spam)
      // 🔥 Realtime desabilitado - apenas polling
      
      // Verificar se precisa rotacionar sinais baseado no horário
      if (this.signals.length > 0) {
        const firstSignal = this.signals[0];
        if (firstSignal) {
          const entryTime = firstSignal.entry_time;
          const [entryHour, entryMinute] = entryTime.split(':').map(Number);
          
          const currentDate = new Date();
          const currentHour = currentDate.getHours();
          const currentMinute = currentDate.getMinutes();
          
          let minutesSinceEntry = (currentHour * 60 + currentMinute) - (entryHour * 60 + entryMinute);
          
          // Ajustar para meia-noite
          if (minutesSinceEntry > 720) minutesSinceEntry -= 1440;
          else if (minutesSinceEntry < -720) minutesSinceEntry += 1440;
          
          // Se passou 15 minutos, forçar refresh (silencioso)
          if (minutesSinceEntry >= 15) {
            this.fetchInitialSignals().catch(() => {});
          }
        }
      }
      
      lastCheckTime = now;
      
      // ✅ OTIMIZAÇÃO: Intervalo adaptativo - mais frequente quando está visível
      const isVisible = document.visibilityState === 'visible';
      const nextInterval = isVisible ? MONITOR_INTERVAL : MONITOR_INTERVAL * 2; // 30s visível, 60s background
      
      // Agendar próxima verificação (usar setTimeout recursivo em vez de setInterval)
      monitorTimeoutId = setTimeout(checkConnection, nextInterval);
    };
    
    // Iniciar monitoramento
    checkConnection();
    
    // ✅ ADICIONAL: Forçar verificação IMEDIATA quando a aba voltar do background
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const timeInBackground = Date.now() - lastCheckTime;
        if (monitorTimeoutId) {
          clearTimeout(monitorTimeoutId);
          monitorTimeoutId = null;
        }
        if (timeInBackground > MONITOR_INTERVAL) {
          this.fetchInitialSignals().catch(() => {});
        }
        checkConnection();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // ✅ Cleanup: Remover listener quando o serviço for destruído
    const originalDestroy = this.destroy.bind(this);
    this.destroy = () => {
      if (monitorTimeoutId) {
        clearTimeout(monitorTimeoutId);
        monitorTimeoutId = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      originalDestroy();
    };
  }

  /**
   * Processa atualizações do Realtime
   */
  private handleRealtimeUpdate(payload: RealtimePayload): void {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    switch (eventType) {
      case 'INSERT':
        this.handleInsert(newRecord as ActiveSignal);
        break;
      
      case 'UPDATE':
        this.handleUpdate(newRecord as ActiveSignal, oldRecord as ActiveSignal);
        break;
      
      case 'DELETE':
        this.handleDelete(oldRecord as ActiveSignal);
        break;
    }

    // Reordenar por posição
    this.signals.sort((a, b) => a.position - b.position);
    
    // Notificar callbacks
    this.notifyCallbacks();
  }

  /**
   * Trata inserção de novo sinal
   */
  private handleInsert(signal: ActiveSignal): void {
    // Transformar sinal antes de adicionar
    const transformedSignal = this.transformSignal(signal);
    
    // Adicionar à lista
    this.signals.push(transformedSignal);
    
    // Notificar update callbacks
    this.notifyUpdateCallbacks({
      type: 'INSERT',
      signal: transformedSignal
    });
  }

  /**
   * Trata atualização de sinal
   */
  private handleUpdate(newSignal: ActiveSignal, oldSignal: ActiveSignal): void {
    // Log removido para evitar spam no console
    // console.log(`🔄 Sinal atualizado - Posição ${newSignal.position}:`, newSignal.symbol);
    
    // Transformar sinal antes de atualizar
    const transformedSignal = this.transformSignal(newSignal);
    
    // Encontrar e atualizar
    const index = this.signals.findIndex(s => s.id === transformedSignal.id);
    if (index !== -1) {
      this.signals[index] = transformedSignal;
    }
    
    // Notificar update callbacks
    this.notifyUpdateCallbacks({
      type: 'UPDATE',
      signal: transformedSignal,
      oldSignal
    });
  }

  /**
   * Trata remoção de sinal
   */
  private handleDelete(signal: ActiveSignal): void {
    // Remover da lista
    this.signals = this.signals.filter(s => s.id !== signal.id);
    
    // Notificar update callbacks
    this.notifyUpdateCallbacks({
      type: 'DELETE',
      signal
    });
  }

  /**
   * Notifica todos os callbacks registrados
   */
  private notifyCallbacks(): void {
    // Salvar no cache
    this.saveToCache();
    
    this.callbacks.forEach(callback => {
      try {
        callback([...this.signals]);
      } catch {
        // ignorar erros de callback
      }
    });
  }

  /**
   * Notifica callbacks de update
   */
  private notifyUpdateCallbacks(update: SignalUpdate): void {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(update);
      } catch {
        // ignorar erros de callback
      }
    });
  }

  /**
   * Registra callback para receber sinais atualizados
   */
  subscribe(callback: SignalCallback): () => void {
    this.callbacks.add(callback);
    
    // Enviar sinais atuais imediatamente
    if (this.signals.length > 0) {
      callback([...this.signals]);
    }
    
    // Retornar função para cancelar subscription
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Registra callback para receber updates individuais
   */
  subscribeToUpdates(callback: UpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    
    // Retornar função para cancelar subscription
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }

  /**
   * Retorna sinais atuais (snapshot)
   */
  getSignals(): ActiveSignal[] {
    return [...this.signals];
  }

  /**
   * Retorna quantidade de sinais ativos
   */
  getSignalsCount(): number {
    return this.signals.length;
  }

  /**
   * Força refresh dos sinais
   */
  async refresh(): Promise<void> {
    // Forçando refresh
    await this.fetchInitialSignals();
  }

  /**
   * Desconecta o Realtime e limpa recursos
   */
  destroy(): void {
    if (this.channel) {
      const supabase = getSupabase();
      (supabase as SupabaseClient<Database>).removeChannel(this.channel);
      this.channel = null;
    }
    
    this.callbacks.clear();
    this.updateCallbacks.clear();
    this.signals = [];
    this.isInitialized = false;
  }

  /**
   * Configura listener para refresh forçado de sinais
   */
  private setupForceRefreshListener(): void {
    const handleForceRefresh = () => {
      this.fetchInitialSignals().catch(() => {});
    };
    
    window.addEventListener('force-refresh-signals', handleForceRefresh);
    window.addEventListener('force-update-after-background', handleForceRefresh);
  }

  /**
   * Chama função SQL para forçar rotação
   */
  async forceRotation(): Promise<void> {
    const supabase = getSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('rotate_signals');
    if (error) throw error;
  }

  /**
   * Reinicializa o sistema de sinais (admin)
   */
  async reinitialize(): Promise<void> {
    const supabase = getSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('initialize_signals');
    if (error) throw error;
    await this.refresh();
  }
}

// =============================================
// EXPORTAR INSTÂNCIA SINGLETON
// =============================================

export const realtimeSignalsService = new RealtimeSignalsService();

if (typeof window !== 'undefined') {
  realtimeSignalsService.initialize().catch(() => {});
}
