import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/**
 * Verifica se há uma sessão válida no servidor (não apenas no localStorage)
 * @returns Promise<boolean>
 */
const isLockContention = (err: unknown): boolean => {
  if (!err) return false;
  const msg = (err as any)?.message || '';
  const name = (err as any)?.name || '';
  return name === 'AbortError' || msg.includes('steal') || msg.includes('Lock broken');
};

export const hasValidSession = async (): Promise<boolean> => {
  try {
    const { data: sessionData, error } = await (supabase as SupabaseClient<Database>).auth.getSession();
    
    if (error) {
      if (isLockContention(error)) {
        // Contenção de lock é transitória — presume sessão válida
        return true;
      }
      console.warn('⚠️ [AutoAuth] Erro ao verificar sessão:', error);
      return false;
    }
    
    if (!sessionData.session) {
      return false;
    }
    
    const { data: userData, error: userError } = await (supabase as SupabaseClient<Database>).auth.getUser();
    
    if (userError) {
      if (isLockContention(userError)) {
        // Contenção de lock — sessão local existe, presume válida
        return true;
      }
      console.warn('⚠️ [AutoAuth] Sessão inválida ou expirada');
      return false;
    }
    
    return !!userData.user;
    
  } catch (error) {
    if (isLockContention(error)) {
      // AbortError por lock contention é transitório — não invalida a sessão
      return true;
    }
    console.warn('⚠️ [AutoAuth] Erro na verificação de sessão:', error);
    return false;
  }
};

/**
 * Limpa dados de autenticação inválidos do localStorage
 */
export const clearInvalidAuthData = (): void => {
  console.log('🧹 [AutoAuth] Limpando dados de autenticação inválidos...');
  
  // Limpar dados do Supabase
  const supabaseKeys = Object.keys(localStorage).filter(key => 
    key.startsWith('sb-') || 
    key.includes('supabase') ||
    key === 'supabase.auth.token'
  );
  
  supabaseKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log(`🗑️ [AutoAuth] Removido: ${key}`);
  });
  
  // Limpar dados de sessão personalizados
  const customAuthKeys = [
    'auth_last_email',
    'auth_remember',
    'auth_user_email',
    'currentUser'
  ];
  
  customAuthKeys.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      console.log(`🗑️ [AutoAuth] Removido: ${key}`);
    }
  });
  
  console.log('✅ [AutoAuth] Limpeza de dados inválidos concluída');
};

/**
 * Tenta fazer login automático usando credenciais salvas
 * @returns Promise<boolean> - true se conseguiu fazer login, false caso contrário
 */
export const attemptAutoLogin = async (): Promise<boolean> => {
  try {
    console.log('🔄 [AutoAuth] Tentando recuperar sessão automaticamente...');
    
    // Primeiro, verificar se já há uma sessão válida
    const hasSession = await hasValidSession();
    if (hasSession) {
      console.log('✅ [AutoAuth] Sessão válida já existe');
      return true;
    }
    
    // Tentar refresh da sessão atual
    const { data: refreshData, error: refreshError } = await (supabase as SupabaseClient<Database>).auth.refreshSession();
    if (refreshData.session && !refreshError) {
      console.log('✅ [AutoAuth] Sessão renovada com sucesso');
      return true;
    }
    
    if (refreshError) {
      // Apenas logar se não for erro de sessão ausente
      if (!refreshError.message?.includes('Auth session missing')) {
        console.warn('⚠️ [AutoAuth] Erro no refresh da sessão:', refreshError.message);
      }
      
      // Se o refresh falhou, limpar dados inválidos apenas se não for erro de sessão ausente
      if (!refreshError.message?.includes('Auth session missing')) {
        clearInvalidAuthData();
      }
    }
    
    console.log('ℹ️ [AutoAuth] Não foi possível recuperar a sessão automaticamente');
    return false;
  } catch (error) {
    console.warn('⚠️ [AutoAuth] Erro na tentativa de login automático:', error);
    
    // Em caso de erro, limpar dados potencialmente corrompidos
    clearInvalidAuthData();
    return false;
  }
};

/**
 * Verifica se há dados de autenticação inconsistentes
 * @returns boolean - true se há inconsistências
 */
export const hasInconsistentAuthData = async (): Promise<boolean> => {
  try {
    // Verificar se há dados no localStorage que sugerem que o usuário está logado
    const hasLocalAuthData = Object.keys(localStorage).some(key => 
      key.startsWith('sb-') && localStorage.getItem(key)
    );
    
    if (!hasLocalAuthData) {
      return false; // Sem dados locais, sem inconsistência
    }
    
    // Se há dados locais, verificar se há sessão válida no servidor
    const hasServerSession = await hasValidSession();
    
    // Inconsistência = dados locais mas sem sessão no servidor
    return hasLocalAuthData && !hasServerSession;
    
  } catch (error) {
    if (isLockContention(error)) {
      // Contenção de lock é transitória — não assumir inconsistência
      return false;
    }
    console.warn('⚠️ [AutoAuth] Erro ao verificar inconsistências:', error);
    return false;
  }
};

/**
 * Força logout completo e limpeza de dados
 */
export const forceLogout = async (): Promise<void> => {
  try {
    console.log('🚪 [AutoAuth] Forçando logout completo...');
    
    // Tentar logout no Supabase
    await (supabase as SupabaseClient<Database>).auth.signOut();
    
    // Limpar todos os dados de autenticação
    clearInvalidAuthData();
    
    // Limpar também dados do usuário
    localStorage.removeItem('user-name');
    localStorage.removeItem('user-avatar');
    
    console.log('✅ [AutoAuth] Logout completo realizado');
    
  } catch (error) {
    console.warn('⚠️ [AutoAuth] Erro no logout:', error);
    
    // Mesmo com erro, limpar dados locais
    clearInvalidAuthData();
  }
};

/**
 * Limpa dados de autenticação salvos
 */
export const clearAuthData = (): void => {
  localStorage.removeItem('auth_last_email');
  localStorage.removeItem('auth_remember');
  localStorage.removeItem('auth_redirect_url');
};

/**
 * Salva dados de autenticação para uso futuro
 */
export const saveAuthData = (email: string, remember: boolean): void => {
  if (remember) {
    localStorage.setItem('auth_last_email', email);
    localStorage.setItem('auth_remember', 'true');
  } else {
    clearAuthData();
  }
};

/**
 * Obtém a URL de redirecionamento após login
 */
export const getRedirectUrl = (): string => {
  const savedUrl = localStorage.getItem('auth_redirect_url');
  localStorage.removeItem('auth_redirect_url');
  return savedUrl || '/';
}; 