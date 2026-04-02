import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { userService } from '@/services/userService';
import { getSupabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthContextType, AuthState, Provider, Session, User, UserProfile } from '@/types/auth';
import { toast } from 'sonner';
import { recordUserActivity } from '@/lib/admin-api';

// Contexto de autenticação
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Estado inicial de autenticação
const initialAuthState: AuthState = {
  user: null,
  session: null,
  profile: null,
  loading: true,
  error: null,
  isAdmin: false,
};

interface AuthProviderProps {
  children: ReactNode;
}

// Função removida - causava problemas com estado desatualizado

// Componente provedor de autenticação 
export const AuthProvider = React.memo<AuthProviderProps>(({ children }) => {
  const [state, setState] = useState<AuthState>(initialAuthState);
  const activityRecordedRef = useRef(false);
  
  // Buscar perfil e admin em background sem bloquear a UI
  const fetchProfileInBackground = useCallback(async (user: User, session: Session) => {
    const supabase = getSupabase();
    
    let profile = null;
    try {
      const { data } = await (supabase as SupabaseClient)
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      profile = data;
    } catch (error) {
      // Silencioso - perfil será null
    }
    
    if (!profile) {
      try {
        const { data: newProfile } = await (supabase as SupabaseClient)
          .from('user_profiles')
          .upsert({
            user_id: user.id,
            email: user.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            verified_email: true
          }, { onConflict: 'user_id' })
          .select()
          .maybeSingle();
        profile = newProfile;
      } catch (error) {
        // Silencioso - perfil será null
      }
    }
    
    let isAdmin = false;
    try {
      isAdmin = await userService.isAdmin();
      console.log('[AuthContext] isAdmin check result:', isAdmin, 'for user:', user.email);
    } catch (error) {
      console.error('[AuthContext] Error checking isAdmin:', error);
    }
    
    console.log('[AuthContext] Updating state with profile and admin:', { 
      hasProfile: !!profile, 
      isAdmin, 
      profileIsAdmin: profile?.is_admin,
      userId: user.id?.substring(0, 8)
    });
    
    setState(prev => ({
      ...prev,
      profile: profile || prev.profile,
      isAdmin,
    }));
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const initAuth = async () => {
      try {
        const supabase = getSupabase();
        
        // Timeout para getSession de 10s
        const sessionPromise = (supabase as SupabaseClient).auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('getSession timeout')), 10000)
        );
        
        let session;
        try {
          const result = await Promise.race([
            sessionPromise,
            timeoutPromise
          ]) as { data: { session: Session | null } };
          session = result.data.session;
        } catch (timeoutError) {
          session = null;
        }
        if (!isMounted) return;
        
        if (session?.user) {
          const user = session.user;
          
          if (!activityRecordedRef.current) {
            activityRecordedRef.current = true;
            recordUserActivity(user.id).catch(() => {});
          }

          // INSTANTÂNEO: Setar user + session + loading:false IMEDIATAMENTE
          setState({
            user,
            session,
            profile: null,
            loading: false,
            error: null,
            isAdmin: false
          });
          
          // Buscar perfil e admin em BACKGROUND (não bloqueia a UI)
          fetchProfileInBackground(user, session);
        } else {
          if (isMounted) {
            setState({ ...initialAuthState, loading: false });
          }
        }
      } catch (error) {
        console.error('❌ AuthContext: Erro ao inicializar:', error);
        if (isMounted) {
          setState({ ...initialAuthState, loading: false, error: error as Error });
        }
      }
    };
    
    initAuth();
    
    // Configurar listener de mudanças de autenticação
    const supabase = getSupabase();
    const { data: { subscription } } = (supabase as SupabaseClient).auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            const user = session.user;
            
            const isNormalLogin = sessionStorage.getItem('normal-login-in-progress') === 'true';
            const justRegistered = sessionStorage.getItem('just-registered') === 'true';
            const preventAuthRedirect = sessionStorage.getItem('prevent_auth_redirect') === 'true';
            const preventDashboardRedirect = localStorage.getItem('prevent_dashboard_redirect') === 'true';
            
            if (isNormalLogin) {
              sessionStorage.removeItem('just-registered');
              sessionStorage.removeItem('prevent_auth_redirect');
              localStorage.removeItem('prevent_dashboard_redirect');
              localStorage.removeItem('prevent_dashboard_redirect_expiration');
              sessionStorage.removeItem('normal-login-in-progress');
            }
            
            if ((justRegistered || preventAuthRedirect || preventDashboardRedirect) && event === 'SIGNED_IN' && !isNormalLogin) {
              try {
                await (supabase as SupabaseClient).auth.signOut();
              } catch (e) {
                // Silencioso
              }
              return;
            }
            
            if (!activityRecordedRef.current) {
              activityRecordedRef.current = true;
              recordUserActivity(user.id).catch(() => {});
            }
            
            // INSTANTÂNEO: Setar user + session + loading:false IMEDIATAMENTE
            setState({
              user,
              session,
              profile: null,
              isAdmin: false,
              loading: false,
              error: null
            });
            
            // Disparar evento de login bem-sucedido
            window.dispatchEvent(new CustomEvent('auth-login-success'));
            
            // Buscar perfil e admin em BACKGROUND (não bloqueia a UI)
            fetchProfileInBackground(user, session);
          }
        } else if (event === 'SIGNED_OUT') {
          // Limpar dados de perfil do usuário para evitar vazamento entre contas
          localStorage.removeItem('user-avatar');
          localStorage.removeItem('user-avatar-timestamp');
          localStorage.removeItem('avatar-backup-dataurl');
          localStorage.removeItem('user-name');
          localStorage.removeItem('trader_preferences');
          localStorage.removeItem('avatar-migrated-to-db');
          // Notificar outros contextos para resetar estado em memória
          window.dispatchEvent(new CustomEvent('auth-signed-out'));
          setState({ ...initialAuthState, loading: false });
        }
      }
    );
    
    // Cleanup
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfileInBackground]);

  // Função para atualizar o perfil do usuário
  const refreshUserProfile = useCallback(async () => {
    if (state.user) {
      try {
        const { data: profile } = await userService.getUserProfile();
        const isAdmin = await userService.isAdmin();
        setState(prevState => ({
          ...prevState,
          profile,
          isAdmin,
        }));
      } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        setState(prevState => ({
          ...prevState,
          error: error as Error,
        }));
      }
    }
  }, [state.user]);


  // Fazer login com email/senha
  const signInWithEmail = useCallback(async (email: string, password: string, remember: boolean = false) => {
    // Marcar que é um login normal (não cadastro)
    sessionStorage.setItem('normal-login-in-progress', 'true');
    
    // Timeout de segurança: Se demorar > 20s, forçar loading=false
    const signInTimeout = setTimeout(() => {
      setState(prevState => ({ ...prevState, loading: false }));
      sessionStorage.removeItem('normal-login-in-progress');
    }, 20000);
    
    try {
      setState(prevState => ({ ...prevState, loading: true }));
      
      // Fazer login
      const { data, error } = await userService.signInWithEmail(email, password, remember);
      
      if (error) {
        clearTimeout(signInTimeout);
        sessionStorage.removeItem('normal-login-in-progress');
        setState(prevState => ({
          ...prevState,
          error: error instanceof Error ? error : new Error(String(error)),
          loading: false,
        }));
        return { error: error instanceof Error ? error : new Error(String(error)) };
      }
      
      // Login bem-sucedido - O onAuthStateChange vai atualizar o estado
      if (remember) {
        localStorage.setItem('remember-user', 'true');
        if (data?.user?.id) {
          userService.saveAuthorizedDevice(data.user.id).catch(() => {});
        }
      } else {
        localStorage.removeItem('remember-user');
      }
      
      // Limpar timeout após sucesso
      clearTimeout(signInTimeout);
      
      return { error: null as Error | null };
    } catch (error) {
      clearTimeout(signInTimeout);
      sessionStorage.removeItem('normal-login-in-progress');
      
      setState(prevState => ({
        ...prevState,
        error: error as Error,
        loading: false,
      }));
      return { error: error as Error };
    }
  }, []);

  // Fazer cadastro com email
  const signUp = useCallback(async (email: string, password: string, birthdate?: string) => {
    try {
      setState(prevState => ({ ...prevState, loading: true }));
      
      const { error } = await userService.signUp(email, password, birthdate);
      
      if (error) {
        setState(prevState => ({
          ...prevState,
          error: error instanceof Error ? error : new Error(String(error)),
          loading: false,
        }));
        return { error: error instanceof Error ? error : new Error(String(error)) };
      }
      
      setState(prevState => ({
        ...prevState,
        loading: false,
        error: null,
      }));
      
      return { error: null as Error | null };
    } catch (error) {
      console.error('Erro durante cadastro:', error);
      setState(prevState => ({
        ...prevState,
        error: error as Error,
        loading: false,
      }));
      return { error: error as Error };
    }
  }, []);

  // Fazer login com provedor (Google, GitHub, etc.)
  const signInWithProvider = async (provider: Provider) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const { data, error } = await userService.signInWithProvider(provider);
      
      if (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error : new Error(String(error)),
          loading: false,
        }));
        return { error: error instanceof Error ? error : new Error(String(error)) };
      }
      
      return { error: null as Error | null };
    } catch (error) {
      console.error(`Erro ao fazer login com ${provider}:`, error);
      setState(prev => ({
        ...prev,
        error: error as Error,
        loading: false,
      }));
      return { error: error as Error };
    }
  };

  // Fazer logout
  const signOut = async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      // Salvar o idioma atual antes de fazer logout
      const appLanguage = localStorage.getItem('app-language');
      
      const { error } = await userService.signOut();
      
      if (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error : new Error(String(error)),
          loading: false,
        }));
        return;
      }
      
      // Limpar TODOS os caches problemáticos
      localStorage.removeItem('realtime_signals_cache');
      localStorage.removeItem('extended_signals_cache');
      localStorage.removeItem('extended_signals_cache_date');
      localStorage.removeItem('prevent_dashboard_redirect');
      localStorage.removeItem('prevent_dashboard_redirect_expiration');
      sessionStorage.removeItem('just-registered');
      sessionStorage.removeItem('prevent_auth_redirect');
      sessionStorage.removeItem('normal-login-in-progress');
      sessionStorage.removeItem('registered-email');

      // Limpar dados de perfil do usuário anterior (avatar, nome, preferências)
      localStorage.removeItem('user-avatar');
      localStorage.removeItem('user-avatar-timestamp');
      localStorage.removeItem('avatar-backup-dataurl');
      localStorage.removeItem('user-name');
      localStorage.removeItem('trader_preferences');
      localStorage.removeItem('avatar-migrated-to-db');
      sessionStorage.removeItem('news_translations_v2');
      
      // Restaurar o idioma no localStorage após o logout
      if (appLanguage) {
        localStorage.setItem('app-language', appLanguage);
      }
      
      setState({ ...initialAuthState, loading: false });
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      setState(prev => ({
        ...prev,
        error: error as Error,
        loading: false,
      }));
    }
  };

  // Verificar email
  const verifyEmail = async (email: string) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const { error } = await userService.verifyEmail(email);
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
      
      if (!error) {
        toast.success(
          'Email de verificação enviado com sucesso!',
          { duration: 5000 }
        );
      }
      
      return { error: error instanceof Error ? error : (error ? new Error(String(error)) : null) };
    } catch (error) {
      console.error('Erro ao verificar email:', error);
      setState(prev => ({
        ...prev,
        error: error as Error,
        loading: false,
      }));
      return { error: error as Error };
    }
  };

  // Recuperação de senha
  const resetPassword = async (email: string) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const { error } = await userService.resetPassword(email);
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
      
      if (!error) {
        toast.success(
          'Email de recuperação de senha enviado com sucesso!',
          { duration: 5000 }
        );
      }
      
      return { error: error instanceof Error ? error : (error ? new Error(String(error)) : null) };
    } catch (error) {
      console.error('Erro ao resetar senha:', error);
      setState(prev => ({
        ...prev,
        error: error as Error,
        loading: false,
      }));
      return { error: error as Error };
    }
  };

  // Atualizar perfil
  const updateProfile = async (profile: Partial<UserProfile>) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const { data, error } = await userService.updateUserProfile(profile);
      
      if (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error : new Error(String(error)),
          loading: false,
        }));
        return { error: error instanceof Error ? error : new Error(String(error)) };
      }
      
      setState(prev => ({
        ...prev,
        profile: data,
        loading: false,
        error: null,
      }));
      
      toast.success('Perfil atualizado com sucesso!');
      
      return { error: null as Error | null };
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      setState(prev => ({
        ...prev,
        error: error as Error,
        loading: false,
      }));
      return { error: error as Error };
    }
  };

  // Verificar força da senha
  const isStrongPassword = userService.isStrongPassword;

  const contextValue: AuthContextType = {
    ...state,
    signInWithEmail,
    signUp,
    signOut,
    verifyEmail,
    resetPassword,
    updateProfile,
    isStrongPassword,
    refreshUserProfile,
    signInWithProvider,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
});

AuthProvider.displayName = 'AuthProvider';

// Hook para usar o contexto de autenticação
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  
  return context;
}
