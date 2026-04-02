import React from "react";
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Suprimir erros de HMR/stale-cache durante desenvolvimento
if (import.meta.env.DEV) {
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    const msg = String(message);
    if (
      msg.includes('is not defined') && msg.includes('Admin') ||
      msg.includes('is not defined') && (source || '').includes('routes')
    ) {
      return true; // suprimir
    }
    return originalOnError ? originalOnError(message, source, lineno, colno, error) : false;
  };
}

const originalError = console.error;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
console.error = (...args: any[]) => {
  const message = args[0]?.toString() || '';
  if (
    message.includes('DialogTitle') ||
    message.includes('Missing `Description`') ||
    message.includes('aria-describedby') ||
    message.includes('The above error occurred in the') ||
    message.includes('Consider adding an error boundary') ||
    message.includes('failed to connect to websocket') ||
    message.includes('WebSocket (failing)') ||
    message.includes('NotSupportedError') ||
    message.includes('no supported sources') ||
    message.includes('Invalid hook call') ||
    message.includes('mismatching versions of React') ||
    message.includes('Cannot read properties of null')
  ) {
    return;
  }
  originalError.apply(console, args);
};

// Limpar apenas caches órfãos e obsoletos (não interferir em caches ativos)
try {
  localStorage.removeItem('userNotifications');
  localStorage.removeItem('pre-signal-notification-cache');
  localStorage.removeItem('trading-signals-cache');
  localStorage.removeItem('daily-signals-cache');
} catch {
  // ignorar
}

import App from './App.tsx'
import './index.css'
import './global.css'
// Importar o patch de segurança para toasts
import './safe-toast-init'

// Removidas importações duplicadas de React, ReactDOM, QueryClient, etc.
import { BrowserRouter } from 'react-router-dom';

import { LanguageProvider } from './contexts/LanguageContext.tsx';
import { TimeZoneProvider } from './contexts/TimeZoneContext.tsx';
import { NotificationProvider } from './contexts/NotificationContext.tsx';
import { TrendingNotificationProvider } from './contexts/TrendingNotificationContext.tsx';
import { AuthProvider } from './contexts/AuthContext';
import { UserProvider } from './contexts/UserContext';
import { Toaster } from 'sonner';

import { initAvatarPreloading, ensureAvatarPreloaded, getSavedAvatar, preloadImage } from './utils/imageUtils';
import { checkPendingSyncOnLoad, startUserSettingsSyncService } from './utils/userPersistence.ts';
import { ensureCorrectPort } from './utils/portRedirect';
import { getSupabase } from './lib/supabase';
import { userService } from './services/userService';
import { initVisibilityManager, setBackgroundMode } from './utils/visibilityManager';
import { removeCachesByPattern } from './utils/cacheValidator';

// ⚡ GARANTIR PORTA CORRETA ANTES DE QUALQUER COISA
ensureCorrectPort();

// Notificações já limpas na inicialização acima

// Inicializar sistema de pré-carregamento de avatar para evitar flickering
// e garantir persistência entre sessões
initAvatarPreloading();

// Precarregar imagem do avatar no início da execução
const storedAvatar = getSavedAvatar();
if (storedAvatar) {
  // Criar imagem em background para precarregar
  preloadImage(storedAvatar)
    .then(() => {
      // Avatar precarregado (silenciado)
      // Notificar componentes sobre o avatar carregado
      window.dispatchEvent(new CustomEvent('avatar-loaded', { 
        detail: { avatarUrl: storedAvatar }
      }));
    })
    .catch(() => {});
}

// Verificar avatar sempre que a aba receber foco
window.addEventListener('focus', () => {
  ensureAvatarPreloaded(true);
});

// Verificar avatar quando a página estiver completamente carregada
window.addEventListener('load', () => {
  ensureAvatarPreloaded();
});

// Verificar também quando o usuário voltar à aplicação após suspender o dispositivo
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    ensureAvatarPreloaded(true);
  }
});

// ✅ SIMPLIFICAÇÃO: Limpeza única de chaves órfãs na primeira execução
if (!sessionStorage.getItem('app-initialized')) {
  // Primeira inicialização - limpando chaves órfãs
  
  const orphanKeys = [
    'trending-react-query',
    'REACT_QUERY_OFFLINE_CACHE',
    'needs-sync',
    'navigation-pending',
    'form-dirty',
    'unsaved-changes'
  ];
  
  orphanKeys.forEach(key => {
    if (localStorage.getItem(key) || sessionStorage.getItem(key)) {
      // Removendo chave antiga (silenciado)
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  });
  
  sessionStorage.setItem('app-initialized', 'true');
  // Limpeza concluída
}

// ✅ SIMPLIFICAÇÃO: React Query com configurações balanceadas + BACKGROUND
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 3 * 60 * 1000, // 3 minutos
      gcTime: 10 * 60 * 1000, // 10 minutos
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
      refetchIntervalInBackground: true, // ✅ Continuar atualização em background
      retry: 2,
    },
  },
});

// React Query gerencia automaticamente refetch com refetchOnWindowFocus/refetchOnReconnect

// ✅ CORREÇÃO 3: Limpeza automática de localStorage (liberar espaço e evitar dados corrompidos)
function cleanOldCacheData() {
  try {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 dias
    let cleanedCount = 0;
    
    // Iniciando limpeza de cache
    
    keys.forEach(key => {
      // Limpar dados com timestamp antigo
      if (key.includes('_timestamp')) {
        try {
          const timestamp = parseInt(localStorage.getItem(key) || '0', 10);
          if (now - timestamp > MAX_AGE) {
            const dataKey = key.replace('_timestamp', '');
            localStorage.removeItem(key);
            localStorage.removeItem(dataKey);
            cleanedCount++;
            // Removido (silenciado)
          }
        } catch {
          // ignorar
        }
      }
    });
    
    // ✅ Limitar cache de traduções (máximo 500 entradas)
    try {
      const translationCache = localStorage.getItem('translation_cache_google');
      if (translationCache) {
        const parsed = JSON.parse(translationCache);
        const entries = Object.entries(parsed);
        if (entries.length > 500) {
          // Manter apenas as 500 mais recentes
          const limited = Object.fromEntries(entries.slice(-500));
          localStorage.setItem('translation_cache_google', JSON.stringify(limited));
          // Cache reduzido (silenciado)
          cleanedCount++;
        }
      }
    } catch {
      // ignorar
    }
  } catch {
    // ignorar erros de limpeza de cache
  }
}

// Executar limpeza após 5 segundos (não bloqueia inicialização)
setTimeout(cleanOldCacheData, 5000);

// Log do ambiente
// Ambiente e versão (silenciado)

// Obter instância única do Supabase para evitar múltiplas inicializações
const supabaseInstance = getSupabase();

// Configurações do toast - Estilo Dark na parte inferior
const toastOptions = {
  position: 'bottom-right' as const,
  duration: 5000,
  closeButton: true,
  richColors: true,
  theme: 'dark' as const,
  style: {
    background: 'rgb(17, 24, 39)', // bg-gray-900
    border: '1px solid rgb(55, 65, 81)', // border-gray-700
    color: 'rgb(243, 244, 246)', // text-gray-100
  },
};

// Limpar apenas caches com data diferente do dia atual (manter cache do dia)
try {
  const today = new Date().toDateString();
  const extCacheDate = localStorage.getItem('extended_signals_cache_date');
  const rtCacheDate = localStorage.getItem('realtime_signals_cache_date');
  
  if (extCacheDate && extCacheDate !== today) {
    localStorage.removeItem('extended_signals_cache');
    localStorage.removeItem('extended_signals_cache_date');
  }
  if (rtCacheDate && rtCacheDate !== today) {
    localStorage.removeItem('realtime_signals_cache');
    localStorage.removeItem('realtime_signals_cache_date');
  }
} catch {
  // ignorar erros
}

// Inicializar o gerenciador de visibilidade
initVisibilityManager();

// Habilitar o modo background por padrão
setBackgroundMode(true);

// ✅ SISTEMA APRIMORADO: Força atualização quando a aba volta do background
let lastActiveTime = Date.now();
let backgroundStartTime: number | null = null;
const BACKGROUND_THRESHOLD = 15 * 1000; // 15 segundos (otimizado para responsividade)

// ✅ POLLING ADICIONAL: Verificar periodicamente se deve forçar update (funciona mesmo em background)
let backgroundCheckTimeout: NodeJS.Timeout | null = null;

const scheduleBackgroundCheck = () => {
  if (backgroundCheckTimeout) {
    clearTimeout(backgroundCheckTimeout);
  }
  
  backgroundCheckTimeout = setTimeout(() => {
    // Se está em background, agendar próxima verificação
    if (document.visibilityState === 'hidden' && backgroundStartTime) {
      // Em background (silenciado)
      
      // Continuar verificando
      scheduleBackgroundCheck();
    }
  }, 30000); // Verificar a cada 30 segundos
};

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const timeInBackground = backgroundStartTime ? Date.now() - backgroundStartTime : 0;
    
    // Aba voltou (silenciado)
    
    // Cancelar verificações de background
    if (backgroundCheckTimeout) {
      clearTimeout(backgroundCheckTimeout);
      backgroundCheckTimeout = null;
    }
    backgroundStartTime = null;
    
    // Se ficou mais de 15 segundos em background, forçar atualização
    if (timeInBackground > BACKGROUND_THRESHOLD) {
      // Forçando atualização (silenciado)
      
      // 1. Invalidar todas as queries do React Query
      queryClient.invalidateQueries();
      
      // 2. Disparar evento customizado para componentes específicos (Extended Signals, etc.)
      window.dispatchEvent(new CustomEvent('force-update-after-background', {
        detail: { timeInBackground }
      }));
      
      // 3. Disparar evento adicional para Dashboard
      window.dispatchEvent(new CustomEvent('force-refresh-signals', {
        detail: { reason: 'background-return', timeInBackground }
      }));
      
      // Eventos disparados (silenciado)
    } else {
      // Tempo curto (silenciado)
    }
    
    lastActiveTime = Date.now();
  } else {
    // Quando a aba fica oculta, salvar o timestamp
    // Aba foi para background (silenciado)
    backgroundStartTime = Date.now();
    lastActiveTime = Date.now();
    
    // Iniciar verificações periódicas em background
    scheduleBackgroundCheck();
  }
});

// Renderização do aplicativo
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <LanguageProvider>
      <TimeZoneProvider>
        <AuthProvider>
          <UserProvider>
            <NotificationProvider>
              <QueryClientProvider client={queryClient}>
                <Toaster {...toastOptions} />
                <App />
              </QueryClientProvider>
            </NotificationProvider>
          </UserProvider>
        </AuthProvider>
      </TimeZoneProvider>
    </LanguageProvider>
  </BrowserRouter>
);

// ✅ Importar serviço de notificações de sinais
import { signalNotificationService } from './services/signalNotifications';

// Verificar se a API do Supabase está acessível
(supabaseInstance as SupabaseClient<Database>).auth.getSession().then(({ data, error }) => {
  if (!error) {
    // Conexão estabelecida
    
    // Só inicializar o serviço de usuários se houver uma sessão ativa
    if (data?.session?.user) {
      // Sessão ativa (silenciado)
      
      signalNotificationService.initialize().catch(() => {});
      
      userService.init().then(() => {
        try {
          import('./scripts/migrateAvatarsToDb').then((module) => {
            module.default();
          }).catch(() => {});
          
          import('./scripts/migrateUserNamesToDb').then((module) => {
            module.default();
          }).catch(() => {});
        } catch {
          // ignorar erros de migração
        }
      }).catch(() => {});
    }
  }
});

checkPendingSyncOnLoad().catch(() => {});

// Iniciar serviço de persistência global
const stopUserSettingsSync = startUserSettingsSyncService();

// ✅ CORREÇÃO: Não usar beforeunload (causa aviso do navegador)
// A limpeza será feita automaticamente pelo navegador
