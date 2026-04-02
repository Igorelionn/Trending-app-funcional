// Configurações de autenticação
export const authConfig = {
  // Verificar se estamos em ambiente de desenvolvimento
  isDevelopment: window.location.hostname === 'localhost' || 
                 window.location.hostname === '127.0.0.1' ||
                 window.location.hostname.includes('localhost'),
  
  // Configurações de email
  email: {
    // Não exigir confirmação em desenvolvimento conforme memórias
    requireConfirmation: false,
    
    // Permitir login sem confirmação em desenvolvimento
    allowUnconfirmedInDev: true,
    
    // URLs de redirecionamento
    redirectUrls: {
      development: 'http://127.0.0.1:8090/auth/callback',
      production: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`
    }
  },
  
  // Configurações do Supabase
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    
    // Configurações de auth
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce' as const,
      debug: process.env.NODE_ENV === 'development'
    }
  },
  
  // Configurações de debug
  debug: {
    enabled: process.env.NODE_ENV === 'development',
    logLevel: 'info' as 'error' | 'warn' | 'info' | 'debug'
  }
};

// Função para verificar se deve exigir confirmação de email
export const shouldRequireEmailConfirmation = (): boolean => {
  // Sempre retornar false conforme correção nas memórias
    return false;
};

// Função para obter URL de redirecionamento
export const getRedirectUrl = (): string => {
  if (authConfig.isDevelopment) {
    return authConfig.email.redirectUrls.development;
  }
  return authConfig.email.redirectUrls.production;
};

// Função para log condicional
export const authLog = (level: 'error' | 'warn' | 'info' | 'debug', message: string, ...args: unknown[]) => {
  if (!authConfig.debug.enabled) return;
  
  const levels = ['error', 'warn', 'info', 'debug'];
  const currentLevelIndex = levels.indexOf(authConfig.debug.logLevel);
  const messageLevelIndex = levels.indexOf(level);
  
  if (messageLevelIndex <= currentLevelIndex) {
    console[level](`[AUTH] ${message}`, ...args);
  }
}; 