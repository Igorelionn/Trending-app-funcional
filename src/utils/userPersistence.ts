/**
 * Utilitários para persistência de dados do usuário entre sessões
 * Inspirado em como WhatsApp, Instagram e outros aplicativos mantêm dados do usuário.
 */

import { getSavedUserName, saveUserName } from './userNameUtils';
import { getSavedAvatar, saveAvatar } from './imageUtils';
import { supabase, getSupabaseAdmin } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Chaves para armazenamento local
const USER_SETTINGS_KEY = 'prof-eyes-user-settings';
const USER_SETTINGS_TIMESTAMP_KEY = 'prof-eyes-user-settings-timestamp';
const SYNC_STATUS_KEY = 'prof-eyes-sync-status';
const FIRST_LOGIN_KEY = 'prof-eyes-first-login';

// Interface para configurações do usuário
export interface UserSettings {
  displayName: string | null;
  avatarUrl: string | null;
  preferences: Record<string, any>;
  lastUpdated: number;
  email?: string | null;
  userId?: string | null;
  phone?: string | null;
  fullName?: string | null;
  metadata?: Record<string, any>; // Metadados adicionais do usuário
}

// Interface para status de sincronização
interface SyncStatus {
  lastSync: number;
  pending: boolean;
  retryCount: number;
  lastError?: string;
}

/**
 * Inicializa as configurações padrão quando o usuário não possui configurações salvas
 */
const getDefaultSettings = (): UserSettings => ({
  displayName: null,
  avatarUrl: null,
  preferences: {},
  lastUpdated: Date.now()
});

/**
 * Inicializa o status de sincronização padrão
 */
const getDefaultSyncStatus = (): SyncStatus => ({
  lastSync: 0,
  pending: false,
  retryCount: 0
});

/**
 * Carrega o status de sincronização do localStorage
 */
const loadSyncStatus = (): SyncStatus => {
  try {
    const statusJson = localStorage.getItem(SYNC_STATUS_KEY);
    if (!statusJson) {
      return getDefaultSyncStatus();
    }
    return JSON.parse(statusJson) as SyncStatus;
  } catch (error) {
    console.error("Erro ao carregar status de sincronização:", error);
    return getDefaultSyncStatus();
  }
};

/**
 * Salva o status de sincronização no localStorage
 */
const saveSyncStatus = (status: Partial<SyncStatus>): SyncStatus => {
  try {
    const currentStatus = loadSyncStatus();
    const updatedStatus: SyncStatus = {
      ...currentStatus,
      ...status
    };
    localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(updatedStatus));
    return updatedStatus;
  } catch (error) {
    console.error("Erro ao salvar status de sincronização:", error);
    return loadSyncStatus();
  }
};

/**
 * Carrega as configurações do usuário do armazenamento local
 */
export const loadUserSettings = (): UserSettings => {
  try {
    const settingsJson = localStorage.getItem(USER_SETTINGS_KEY);
    if (!settingsJson) {
      return getDefaultSettings();
    }
    
    const settings = JSON.parse(settingsJson) as UserSettings;
    
    // Verificar se há valores mais recentes em outros storages
    const storedName = getSavedUserName();
    const storedAvatar = getSavedAvatar();
    
    if (storedName) {
      settings.displayName = storedName;
    }
    
    if (storedAvatar) {
      settings.avatarUrl = storedAvatar;
    }
    
    // Obter as informações do usuário atual se não houver userId
    if (!settings.userId) {
      // Obter de forma assíncrona - não bloqueia a carga inicial
      (supabase as SupabaseClient<Database>).auth.getUser().then(({ data }) => {
        if (data?.user) {
          const updatedSettings = {
            ...settings,
            userId: data.user.id,
            email: data.user.email
          };
          saveUserSettings(updatedSettings);
        }
      }).catch(console.error);
    }
    
    return settings;
  } catch (error) {
    console.error("Erro ao carregar configurações do usuário:", error);
    return getDefaultSettings();
  }
};

/**
 * Salva as configurações do usuário no armazenamento local
 */
export const saveUserSettings = (settings: Partial<UserSettings>): UserSettings => {
  try {
    // Carregar configurações existentes para fazer merge
    const currentSettings = loadUserSettings();
    
    // Mesclar com as novas configurações
    const updatedSettings: UserSettings = {
      ...currentSettings,
      ...settings,
      lastUpdated: Date.now()
    };
    
    // Remover senha antes de salvar no localStorage por segurança
    const settingsToSave = { ...updatedSettings };
    delete settingsToSave.password;
    
    // Salvar no localStorage
    localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(settingsToSave));
    localStorage.setItem(USER_SETTINGS_TIMESTAMP_KEY, updatedSettings.lastUpdated.toString());
    
    // Garantir que nome e avatar específicos também sejam atualizados
    if (settings.displayName) {
      localStorage.setItem("user-name", settings.displayName);
    }
    
    if (settings.avatarUrl) {
      localStorage.setItem("user-avatar", settings.avatarUrl);
    }
    
    // Marcar para sincronização
    saveSyncStatus({ pending: true, lastSync: Date.now() });
    
    return updatedSettings;
  } catch (error) {
    console.error("Erro ao salvar configurações do usuário:", error);
    return loadUserSettings();
  }
};

// Adicionar uma função auxiliar para obter o usuário atual de forma mais robusta
const getCurrentUserRobust = async (): Promise<{ userId: string | null; userData: Record<string, unknown> | null; error?: Record<string, unknown> }> => {
  try {
    // 1. Primeiro tentar getUser() - método mais confiável
    const { data: userData, error: userError } = await (supabase as SupabaseClient<Database>).auth.getUser();
    
    if (!userError && userData?.user?.id) {
      return {
        userId: userData.user.id,
        userData: userData
      };
    }
    
    // 2. Se getUser() falhar, tentar getSession()
    const { data: sessionData, error: sessionError } = await (supabase as SupabaseClient<Database>).auth.getSession();
    
    if (!sessionError && sessionData?.session?.user?.id) {
      return {
        userId: sessionData.session.user.id,
        userData: { user: sessionData.session.user }
      };
    }
    
    // 3. Verificar localStorage diretamente com múltiplas chaves possíveis
    const possibleKeys = [
      'sb-arkrjextwpwqhrvcijyr.supabase.co-auth-token',
      'sb-trbbmwtiggmkzvrliomr-auth-token', // Legacy - manter para migração
      'supabase.auth.token',
      'sb-auth-token'
    ];
    
    for (const key of possibleKeys) {
      const storedAuth = localStorage.getItem(key);
      if (storedAuth) {
        try {
          const authData = JSON.parse(storedAuth);
          const userId = authData?.user?.id || authData?.currentSession?.user?.id;
          if (userId) {
            return {
              userId: userId,
              userData: { user: authData.user || authData.currentSession?.user }
            };
          }
        } catch (parseError) {
          console.warn(`Erro ao analisar dados de auth do localStorage (${key}):`, parseError);
        }
      }
    }
    
    // 4. Último recurso: verificar window.location para tokens
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      
          if (accessToken) {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://arkrjextwpwqhrvcijyr.supabase.co';
          const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
          const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'apikey': supabaseAnonKey
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            if (userData?.id) {
              return {
                userId: userData.id,
                userData: { user: userData }
              };
            }
          }
        } catch (tokenError) {
          console.warn('Erro ao usar token da URL:', tokenError);
        }
      }
    }
    
    return {
      userId: null,
      userData: null,
      error: userError || sessionError || 'Nenhum método de autenticação funcionou'
    };
    
  } catch (error) {
    return {
      userId: null,
      userData: null,
      error
    };
  }
};

/**
 * Sincroniza as configurações do usuário com o servidor
 */
export const syncUserSettings = async (): Promise<boolean> => {
  try {
    const settings = loadUserSettings();
    
    // VERIFICAÇÃO DE AUTENTICAÇÃO (silenciado)
    
    // Verificação rápida inicial - se não há sessão ativa, não executar
    try {
      const { data: sessionCheck } = await (supabase as SupabaseClient<Database>).auth.getSession();
      if (!sessionCheck?.session?.user?.id) {
        console.log("⚠️ Nenhuma sessão ativa detectada - adiando sincronização");
        return false;
      }
    } catch (sessionError) {
      console.log("⚠️ Erro ao verificar sessão - adiando sincronização:", sessionError);
      return false;
    }
    
    // Usar a função robusta para obter o usuário atual
    const { userId, userData, error } = await getCurrentUserRobust();
    
    if (!userId) {
      console.log("📊 Debug das configurações:", {
        settingsUserId: settings.userId,
        settingsEmail: settings.email,
        authError: error
      });
      console.log("❌ Usuário não autenticado, sincronização adiada para quando houver autenticação");
      return false;
    }
    
    // AUTENTICAÇÃO CONFIRMADA (silenciado)
    
    // Iniciando sincronização (silenciado)
    
    // Verificar se é o primeiro login e criar perfil se necessário
    const firstLoginCheck = await checkFirstLogin();
    
    // Atualizar userId e email nas configurações se necessário
    if (!settings.userId || !settings.email) {
      saveUserSettings({
        userId,
        email: userData?.user?.email
      });
    }
    
    // 1. SINCRONIZAR NOME DE EXIBIÇÃO
    if (settings.displayName) {
      // Sincroniza APENAS com a tabela de perfis
      // ❌ NÃO atualizar auth.updateUser() aqui para evitar rate limit
      await saveUserName(settings.displayName, userId, true);
    }
    
    // 2. SINCRONIZAR AVATAR/FOTO
    if (settings.avatarUrl) {
      // Salva APENAS na tabela user_profiles
      // ❌ NÃO atualizar auth.updateUser() aqui para evitar rate limit
      await saveAvatar(settings.avatarUrl, userId);
    }
    
    // 3. ATUALIZAR TABELA USER_PROFILES (principal fonte de persistência)
    try {
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(); // Usar maybeSingle() em vez de single() para evitar erros
      
      // Construir objeto para upsert, mantendo dados existentes se houver
      const userEmail = userData?.user?.email || settings.email || existingProfile?.email;
      const userMetadata = userData?.user?.user_metadata || {};
      const userPhone = userData?.user?.phone || settings.phone || existingProfile?.phone;
      
      const profileData = {
        user_id: userId,
        display_name: settings.displayName || existingProfile?.display_name,
        avatar_url: settings.avatarUrl || existingProfile?.avatar_url,
        email: userEmail,
        updated_at: new Date().toISOString(),
        // Garantir que informações de contato sejam mantidas
        phone_number: userPhone,
        // Dados adicionais para sincronização completa
        last_login_at: new Date().toISOString(),
        login_count: (existingProfile?.login_count || 0) + 1
      };
      
      // Dados do perfil
      
      // Realizar upsert (inserir ou atualizar) na tabela de perfis
      const { error: upsertError, data: upsertResult } = await supabase
        .from('user_profiles')
        .upsert(profileData, { onConflict: 'user_id' })
        .select();
      
      if (upsertError) {
        console.error("❌ Erro ao sincronizar perfil do usuário:", upsertError);
        return false;
      }
      
      // Perfil sincronizado
      
    } catch (profileError) {
      console.error("❌ Erro ao processar perfil do usuário:", profileError);
      return false;
    }
    
    // 5. ATUALIZAR METADADOS DO USUÁRIO no Auth para garantir consistência
    try {
      const updateData = {
        display_name: settings.displayName,
        avatar_url: settings.avatarUrl,
        phone: settings.phone,
        updated_at: new Date().toISOString()
      };
      
      // Remover campos undefined para evitar problemas
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined || updateData[key] === null) {
          delete updateData[key];
        }
      });
      
      // Atualizando metadados
      
      // ✅ OTIMIZAÇÃO: Adicionar delay para evitar rate limit (429)
      // Aguardar 1 segundo antes de atualizar auth para evitar múltiplas chamadas
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { error: metadataError } = await (supabase as SupabaseClient<Database>).auth.updateUser({
        data: updateData
      });
      
      if (metadataError) {
        // Se for erro de rate limit, não logar como erro grave
        if (metadataError.message?.includes('rate limit')) {
          console.warn("⏳ Rate limit atingido ao atualizar metadados - dados salvos na tabela user_profiles");
        } else {
          console.warn("⚠️ Erro ao atualizar metadados do usuário:", metadataError);
        }
      } else {
        // Metadados atualizados
      }
    } catch (metadataError) {
      console.warn("⚠️ Erro ao atualizar metadados do usuário:", metadataError);
    }
    
    // Atualizar status de sincronização indicando sucesso
    saveSyncStatus({
      lastSync: Date.now(),
      pending: false,
      retryCount: 0
    });
    
    // Sincronização completa
    return true;
  } catch (error) {
    console.error("Erro ao sincronizar configurações:", error);
    
    // Atualizar status de sincronização indicando falha
    const syncStatus = loadSyncStatus();
    saveSyncStatus({
      pending: true,
      retryCount: syncStatus.retryCount + 1,
      lastError: error.message
    });
    
    return false;
  }
};

/**
 * Verifica se é o primeiro login do usuário e configura o perfil inicial se necessário
 * @returns Um objeto com informações sobre o primeiro login
 */
export const checkFirstLogin = async (): Promise<{
  isFirstLogin: boolean;
  profileCreated: boolean;
  userId?: string;
  error?: Record<string, unknown>;
}> => {
  try {
    // Verificar primeiro se existe uma sessão ativa
    const { data: sessionData } = await (supabase as SupabaseClient<Database>).auth.getSession();
    if (!sessionData?.session) {
      // Nenhuma sessão encontrada
      return { isFirstLogin: false, profileCreated: false };
    }
    
    // Se temos sessão, obter dados do usuário
    const { data: userData } = await (supabase as SupabaseClient<Database>).auth.getUser();
    
    if (!userData?.user?.id) {
      console.log("Dados de usuário não disponíveis, verificação de primeiro login cancelada");
      return { isFirstLogin: false, profileCreated: false };
    }
    
    const userId = userData.user.id;
    
    // Verificar se já marcamos este usuário como tendo feito login antes
    const hasLoggedInBefore = localStorage.getItem(`${FIRST_LOGIN_KEY}-${userId}`);
    
    if (hasLoggedInBefore === 'false') {
      // Usuário já fez login (silenciado)
      return { isFirstLogin: false, profileCreated: true, userId };
    }
    
    // Verificar se o perfil já existe no banco de dados
    const { data: profileData, error: profileError } = await getSupabaseAdmin()
      .from('user_profiles')
      .select('id, created_at')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (profileError && profileError.code !== 'PGRST116') {
      console.warn("Erro ao verificar perfil do usuário:", profileError);
      return { isFirstLogin: false, profileCreated: false, userId, error: profileError };
    }
    
    // Se não encontrou perfil, é o primeiro login
    if (!profileData) {
      console.log("Primeiro login detectado para o usuário:", userId);
      
      // Criar perfil básico para o usuário
      const { error: createError } = await getSupabaseAdmin()
        .from('user_profiles')
        .insert({
          user_id: userId,
          display_name: userData.user.user_metadata?.name || userData.user.email?.split('@')[0] || 'Usuário',
          email: userData.user.email,
          avatar_url: userData.user.user_metadata?.avatar_url || null,
          is_active: true,
          verified_email: true, // Por padrão, consideramos o email verificado
          language: localStorage.getItem('app-language') || 'pt', // Usar idioma atual ou padrão
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (createError) {
        console.error("Erro ao criar perfil inicial do usuário:", createError);
        return { isFirstLogin: true, profileCreated: false, userId, error: createError };
      }
      
      // Marcar que não é mais o primeiro login
      localStorage.setItem(`${FIRST_LOGIN_KEY}-${userId}`, 'false');
      
      return { isFirstLogin: true, profileCreated: true, userId };
    }
    
    // Se encontrou perfil, não é o primeiro login
    console.log("Usuário já possui perfil criado em:", profileData.created_at);
    localStorage.setItem(`${FIRST_LOGIN_KEY}-${userId}`, 'false');
    
    return { isFirstLogin: false, profileCreated: true, userId };
  } catch (error) {
    console.error("Erro ao verificar primeiro login:", error);
    return { isFirstLogin: false, profileCreated: false, error };
  }
};

/**
 * Carrega dados do usuário do servidor para o armazenamento local
 */
export const loadUserDataFromServer = async (): Promise<boolean> => {
  try {
    // Primeiro verificar se existe uma sessão ativa
    const { data: sessionData } = await (supabase as SupabaseClient<Database>).auth.getSession();
    if (!sessionData?.session) {
      // Não logamos como warning, apenas como informação, pois é um estado normal
      // Nenhuma sessão ativa
      return false;
    }
    
    // Se temos sessão, então podemos obter os dados do usuário
    const { data: userData } = await (supabase as SupabaseClient<Database>).auth.getUser();
    
    if (!userData?.user?.id) {
      // Log como informação em vez de warning
      console.log("Dados de usuário não disponíveis, carga de dados cancelada");
      return false;
    }
    
    const userId = userData.user.id;
    
    // Verificar primeiro login e criar perfil se necessário
    const firstLoginCheck = await checkFirstLogin();
    
    // Obter dados do perfil do usuário - usar getSupabaseAdmin para evitar erros de RLS
    const { data: profileData, error } = await getSupabaseAdmin()
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (error) {
      console.warn("Erro ao carregar perfil do servidor:", error);
      return false;
    }
    
    // Se não tiver dados de perfil, não há o que carregar
    if (!profileData) {
      console.log("Perfil não encontrado no servidor para sincronização");
      return false;
    }
    
    // Atualizar configurações locais com dados do servidor
    const updatedSettings: Partial<UserSettings> = {
      userId,
      email: userData.user.email,
      displayName: profileData.display_name || userData.user.user_metadata?.display_name,
      avatarUrl: profileData.avatar_url || userData.user.user_metadata?.avatar_url,
      preferences: profileData.preferences || {},
      phone: profileData.phone_number || userData.user.phone
    };
    
    // Salvar dados localmente
    saveUserSettings(updatedSettings);
    
    // Atualizar localStorage para uso direto pelos componentes
    if (updatedSettings.displayName) {
      localStorage.setItem("user-name", updatedSettings.displayName);
    }
    
    if (updatedSettings.avatarUrl) {
      localStorage.setItem("user-avatar", updatedSettings.avatarUrl);
    }
    
    // Salvar idioma no localStorage se estiver disponível
    if (profileData.language) {
      localStorage.setItem(`user-language-${userId}`, profileData.language);
      localStorage.setItem('app-language', profileData.language);
      sessionStorage.setItem('language-selection-completed', 'true');
      
      // Disparar evento para o sistema de idiomas
      window.dispatchEvent(new CustomEvent('language-loaded-from-db', {
        detail: { 
          language: profileData.language, 
          userId 
        }
      }));
    }
    
    // Notificar componentes sobre atualizações
    if (updatedSettings.displayName) {
      window.dispatchEvent(new CustomEvent('username-updated', { 
        detail: { userName: updatedSettings.displayName, fromServer: true }
      }));
    }
    
    if (updatedSettings.avatarUrl) {
      window.dispatchEvent(new CustomEvent('avatar-updated', { 
        detail: { avatarUrl: updatedSettings.avatarUrl, syncedFromServer: true }
      }));
    }
    
    // Dados carregados (silenciado)
    return true;
  } catch (error) {
    console.error("Erro ao carregar dados do servidor:", error);
    return false;
  }
};

/**
 * Inicia o serviço de sincronização automática
 */
export const startUserSettingsSyncService = (intervalMs: number = 5 * 60 * 1000): () => void => {
  // Iniciando serviço de sincronização
  
  // Verificar se o usuário está autenticado antes de tentar carregar dados
  (async () => {
    try {
      const { data: sessionData } = await (supabase as SupabaseClient<Database>).auth.getSession();
      
      if (sessionData?.session) {
        // Carregar dados do servidor apenas se o usuário estiver autenticado
        loadUserDataFromServer().then(success => {
          // Carga inicial (silenciado)
          
          if (success) {
            // Depois sincronizar as configurações locais se a carga for bem-sucedida
            syncUserSettings().then(syncSuccess => {
              // Sincronização inicial
            });
          }
        });
      } else {
        // Serviço em modo de espera
      }
    } catch (error) {
      console.error("Erro ao verificar sessão para inicialização do serviço de sincronização:", error);
    }
  })();
  
  // Configurar sincronização periódica
  const intervalId = setInterval(() => {
    const syncStatus = loadSyncStatus();
    
    // Verificar se há sincronização pendente
    if (syncStatus.pending) {
      // Se há muitas tentativas, aumentar o intervalo (backoff exponencial)
      if (syncStatus.retryCount > 3) {
        console.log("Muitas falhas de sincronização, aguardando próxima tentativa");
        return;
      }
      
      syncUserSettings().then(success => {
        console.log("Sincronização periódica de configurações:", success ? "sucesso" : "falha");
      });
    } else {
      // Verificar se é hora de sincronizar dados do servidor
      const now = Date.now();
      if (now - syncStatus.lastSync > 30 * 60 * 1000) { // 30 minutos
        loadUserDataFromServer().then(success => {
          // Carga periódica (silenciado)
        });
      }
    }
  }, intervalMs);
  
  // Adicionar listeners para eventos importantes
  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible') {
      // Verificar primeiro se o usuário está autenticado
      try {
        const { data: sessionData } = await (supabase as SupabaseClient<Database>).auth.getSession();
        if (!sessionData?.session) {
          // Usuário não está autenticado, não fazer nada
          return;
        }
        
        // Verificar se há sincronização pendente
        const syncStatus = loadSyncStatus();
        
        if (syncStatus.pending) {
          syncUserSettings().then(success => {
            console.log("Sincronização ao retornar à página:", success ? "sucesso" : "falha");
          });
        } else {
          // Se não há sincronização pendente, verificar quando foi a última sincronização
          const now = Date.now();
          if (now - syncStatus.lastSync > 10 * 60 * 1000) { // 10 minutos
            loadUserDataFromServer().then(success => {
              console.log("Carga de dados ao retornar à página:", success ? "sucesso" : "falha");
            });
          }
        }
      } catch (error) {
        console.error("Erro ao verificar sessão durante mudança de visibilidade:", error);
      }
    }
  };
  
  // ✅ CORREÇÃO: Removido handleBeforeUnload para evitar aviso do navegador
  // A sincronização será feita periodicamente e ao retornar à página
  
  const handleNetworkChange = () => {
    if (navigator.onLine) {
      // Quando a conexão for restaurada, verificar se há sincronização pendente
      const syncStatus = loadSyncStatus();
      if (syncStatus.pending) {
        console.log("Conexão restaurada, tentando sincronizar dados pendentes");
        syncUserSettings().then(success => {
          console.log("Sincronização após reconexão:", success ? "sucesso" : "falha");
        });
      }
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('online', handleNetworkChange);
  
  // Função para parar o serviço de sincronização
  return () => {
    clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('online', handleNetworkChange);
    // Serviço parado (silenciado)
  };
};

/**
 * Versão simplificada para atualizar nome de exibição
 * Esta versão usa apenas localStorage e dispara eventos para manter a UI sincronizada
 */
export const updateDisplayNameSimple = async (name: string): Promise<boolean> => {
  try {
    console.log("🔄 Atualizando nome de exibição (versão simplificada):", name);
    
    // Salvar localmente imediatamente
    saveUserSettings({ displayName: name });
    
    // Disparar evento para atualizar a UI
    window.dispatchEvent(new CustomEvent('userNameUpdated', { 
      detail: name 
    }));
    
    console.log("✅ Nome salvo localmente e evento disparado");
    
    // Tentar sincronizar com o banco em background (não bloquear a UI)
    setTimeout(async () => {
      try {
        // Tentar usar o método otimizado do userService
        const { userService } = await import('@/services/userService');
        const result = await userService.updateDisplayNameDirect(name);
        
        if (result.success) {
          console.log("✅ Nome sincronizado com o banco de dados em background");
        } else {
          console.warn("⚠️ Falha na sincronização em background:", result.error);
          
          // Tentar método alternativo
          const fallbackResult = await syncUserSettings();
          if (fallbackResult) {
            console.log("✅ Sincronização realizada via método alternativo");
          } else {
            console.warn("⚠️ Falha na sincronização alternativa");
          }
        }
      } catch (error) {
        console.warn("⚠️ Erro na sincronização em background:", error);
      }
    }, 1000); // Aguardar 1 segundo para não bloquear a UI
    
    return true;
  } catch (error) {
    console.error("❌ Erro ao atualizar nome de exibição:", error);
    return false;
  }
};

/**
 * Atualiza o nome de exibição do usuário (versão original com sincronização imediata)
 */
export const updateDisplayName = async (name: string): Promise<boolean> => {
  try {
    console.log("🔄 Atualizando nome de exibição:", name);
    
    // Salvar localmente primeiro (imediato)
    saveUserSettings({ displayName: name });
    console.log("✅ Nome salvo localmente:", name);
    
    // Tentar sincronizar com o servidor (pode falhar se offline)
    const synced = await syncUserSettings();
    
    if (synced) {
      console.log("✅ Nome sincronizado com o servidor com sucesso");
    } else {
      console.warn("⚠️ Nome salvo localmente, mas falha na sincronização com o servidor");
    }
    
    // Disparar evento para outros componentes
    window.dispatchEvent(new CustomEvent('username-updated', { 
      detail: { userName: name, fromSave: true }
    }));
    
    return synced;
  } catch (error) {
    console.error("❌ Erro ao atualizar nome de exibição:", error);
    return false;
  }
};

/**
 * Atualiza o avatar do usuário
 */
export const updateUserAvatar = async (avatarUrl: string): Promise<boolean> => {
  try {
    // Salvar localmente primeiro (imediato)
    saveUserSettings({ avatarUrl });
    
    // Tentar sincronizar com o servidor (pode falhar se offline)
    const synced = await syncUserSettings();
    
    // Disparar evento para outros componentes
    window.dispatchEvent(new CustomEvent('avatar-updated', { 
      detail: { avatarUrl, persisted: true }
    }));
    
    return synced;
  } catch (error) {
    console.error("Erro ao atualizar avatar:", error);
    return false;
  }
};

/**
 * Atualiza a senha do usuário diretamente via Supabase Auth
 */
export const updateUserPassword = async (newPassword: string): Promise<boolean> => {
  try {
    const { error } = await (supabase as SupabaseClient<Database>).auth.updateUser({ password: newPassword });
    if (error) {
      console.error("Erro ao atualizar senha:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Erro ao atualizar senha do usuário:", error);
    return false;
  }
};

/**
 * Atualiza o email do usuário
 */
export const updateUserEmail = async (newEmail: string): Promise<boolean> => {
  try {
    // Atualizar no Supabase Auth
    const { error } = await (supabase as SupabaseClient<Database>).auth.updateUser({ email: newEmail });
    
    if (error) {
      console.error("Erro ao atualizar email:", error);
      return false;
    }
    
    // Salvar localmente
    saveUserSettings({ email: newEmail });
    
    // Sincronizar com o servidor para garantir consistência
    await syncUserSettings();
    
    return true;
  } catch (error) {
    console.error("Erro ao atualizar email do usuário:", error);
    return false;
  }
};

/**
 * Atualiza o telefone do usuário
 */
export const updateUserPhone = async (phoneNumber: string): Promise<boolean> => {
  try {
    // Atualizar no Supabase Auth
    const { error } = await (supabase as SupabaseClient<Database>).auth.updateUser({ phone: phoneNumber });
    
    if (error) {
      console.error("Erro ao atualizar telefone:", error);
      return false;
    }
    
    // Salvar localmente
    saveUserSettings({ phone: phoneNumber });
    
    // Sincronizar com o servidor
    await syncUserSettings();
    
    return true;
  } catch (error) {
    console.error("Erro ao atualizar telefone do usuário:", error);
    return false;
  }
};

/**
 * Atualiza as preferências do usuário
 */
export const updateUserPreferences = async (preferences: Record<string, any>): Promise<boolean> => {
  try {
    // Obter as preferências atuais
    const settings = loadUserSettings();
    
    // Mesclar com as novas preferências
    const updatedPreferences = {
      ...settings.preferences,
      ...preferences
    };
    
    // Salvar localmente
    saveUserSettings({ preferences: updatedPreferences });
    
    // Tentar sincronizar com o servidor
    const synced = await syncUserSettings();
    
    return synced;
  } catch (error) {
    console.error("Erro ao atualizar preferências:", error);
    return false;
  }
};

/**
 * Verifica se há configurações para sincronizar durante o carregamento do aplicativo
 */
export const checkPendingSyncOnLoad = async (): Promise<void> => {
  const needsSync = localStorage.getItem('needs-sync') === 'true';
  const syncStatus = loadSyncStatus();
  
  // Limpar flag de necessidade de sincronização
  if (needsSync) {
    localStorage.removeItem('needs-sync');
  }
  
  // Verificar se há sincronização pendente
  if (needsSync || syncStatus.pending) {
    console.log("Sincronização pendente detectada durante inicialização");
    
    // Tentar carregar do servidor primeiro para evitar conflitos
    await loadUserDataFromServer();
    
    // Em seguida sincronizar configurações locais
    await syncUserSettings();
  } else {
    // Se não há sincronização pendente, verificar quando foi a última sincronização
    const now = Date.now();
    if (now - syncStatus.lastSync > 24 * 60 * 60 * 1000) { // 24 horas
      // Recarregando dados do servidor
      await loadUserDataFromServer();
    }
  }
}; 