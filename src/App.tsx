import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { useEffect, useState, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import IndexPage from '@/pages/Index.tsx';
import Signals from '@/pages/Signals';
import Settings from '@/pages/Settings';
import News from '@/pages/News';
import NotificationsPage from '@/pages/Notifications';
import NotFound from '@/pages/NotFound';
import Auth from '@/pages/Auth';
import SplashScreen from '@/pages/SplashScreen';
import LanguageSelectPage from '@/pages/LanguageSelectPage';
import ResetPassword from '@/pages/ResetPassword';
// signalMonitor removido - funcionalidade obsoleta
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/contexts/UserContext';
import { TrendingNotificationProvider } from '@/contexts/TrendingNotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { Toaster as HotToaster } from 'react-hot-toast';
import Instructions from '@/pages/Instructions';

// Importações das novas páginas
import MediaHub from '@/pages/MediaHub';
import VideoPlayerPage from '@/pages/VideoPlayerPage';
import ShortsPlayer from '@/pages/ShortsPlayer';
import UploadPage from '@/pages/UploadPage';
import { VideoProvider } from '@/contexts/VideoContext';

import { useLanguage, Language } from '@/contexts/LanguageContext';
import Support from '@/pages/Support';
import Admin from '@/pages/Admin';
import Live from '@/pages/Live';
import StreamerProfile from '@/pages/StreamerProfile';
import { LiveStreamProvider } from '@/contexts/LiveStreamContext';
import { LiveStreamPermissionProvider } from '@/components/LiveStreamPermissionProvider';
import MeetingRoom from '@/pages/MeetingRoom';
import StreamerDashboard from '@/pages/StreamerDashboard';
import StreamViewer from '@/pages/StreamViewer';
import StreamDebug from '@/pages/StreamDebug';
import { AvatarPersistence } from '@/components/AvatarPersistence';
import { loadUserSettings, checkPendingSyncOnLoad } from '@/utils/userPersistence';
import Ranking from '@/pages/Ranking';
import Social from '@/pages/Social';

import { useUserPreferences } from '@/hooks/useUserPreferences';
import LiveKitStreaming from '@/pages/LiveKitStreaming';
import { LiveKitProvider } from '@/contexts/LiveKitContext';

// Duração do cache (10 minutos)
const CACHE_DURATION = 10 * 60 * 1000;

// Componente para gerenciar persistência de perfil do usuário
const UserProfilePersistence = () => {
  const { user } = useAuth();
  
  // Hook para carregar automaticamente todas as preferências do usuário
  useUserPreferences();

  useEffect(() => {
    // Verificar se há dados pendentes para sincronizar
    if (user) {
      checkPendingSyncOnLoad().catch(error => {
        // Erro ao verificar sincronização (silenciado)
      });
    }
  }, [user]);

  return null; // Componente sem renderização visual
};

// Componente interno que usa os hooks para gerenciar rotas protegidas e públicas
const AppRouter = () => {
  const { user, loading } = useAuth();
  const { updateUserLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const isPublicRoute = location.pathname === '/splash' || location.pathname === '/auth';
  
  // 🔍 DEBUG: Detectar mudanças no estado de auth (silencioso)
  useEffect(() => {
    // Monitoramento silencioso
  }, [user, loading, location.pathname]);
  
  // ✅ PROTEÇÃO: Evitar loop de redirecionamento após login
  useEffect(() => {
    if (!loading && user && location.pathname === '/auth') {
      // Usuário logado tentando acessar /auth, redirecionar para home
      navigate('/', { replace: true });
    }
  }, [loading, user, location.pathname, navigate]);
  
  // ✅ SIMPLIFICAÇÃO: Estados simples sem lógica de F5
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [rememberUser] = useState(() => localStorage.getItem('remember-user') === 'true');
  const [redirectingFromLanguage, setRedirectingFromLanguage] = useState(false);

  const [hasSelectedLanguage, setHasSelectedLanguage] = useState(() => {
    if (!user) return false;
    
    const sessionLanguage = sessionStorage.getItem('user-selected-language');
    if (sessionLanguage) {
        // Idioma encontrado (silenciado)
      return true;
    }
    
    const userLanguage = localStorage.getItem(`user-language-${user.id}`);
    if (userLanguage) return true;
    
    const appLanguage = localStorage.getItem('app-language');
    if (appLanguage) return true;
    
    return false;
  });

  const hasSelectedLanguageRef = useRef(hasSelectedLanguage);
  
  useEffect(() => {
    hasSelectedLanguageRef.current = hasSelectedLanguage;
  }, [hasSelectedLanguage]);

  useEffect(() => {
    const isRedirectingFromLanguage = sessionStorage.getItem('redirecting-from-language-select') === 'true';
    const languageSelectionCompleted = sessionStorage.getItem('language-selection-completed') === 'true';
    
    if (isRedirectingFromLanguage || languageSelectionCompleted) {
      setRedirectingFromLanguage(true);
      sessionStorage.removeItem('redirecting-from-language-select');
      sessionStorage.removeItem('language-selection-completed');
      
      setHasSelectedLanguage(true);
      
      setShowLoadingScreen(false);
      setLoadingProgress(100);
      
      const sessionLanguage = sessionStorage.getItem('user-selected-language');
      if (sessionLanguage && user?.id) {
        updateUserLanguage(user.id, sessionLanguage as Language);
        
        localStorage.setItem(`user-language-${user.id}`, sessionLanguage);
        localStorage.setItem('app-language', sessionLanguage);
        
        // Idioma atualizado (silenciado)
      }
    }
  }, [location.pathname, user, updateUserLanguage]);

  const userIdRef = useRef(user?.id);
  const hasHandledLanguageCheck = useRef(false);

  useEffect(() => {
    // useEffect Language Check executando (silenciado)
    
    if (user?.id === userIdRef.current && hasHandledLanguageCheck.current) {
      // Já processado (silenciado)
      return;
    }
    
    if (redirectingFromLanguage) {
      // Pulando - redirecionando (silenciado)
      return;
    }
    
    userIdRef.current = user?.id;
    
    if (user) {
      hasHandledLanguageCheck.current = true;
      
      const sessionLanguage = sessionStorage.getItem('user-selected-language');
      if (sessionLanguage) {
        // setHasSelectedLanguage(true) - sessionLanguage (silenciado)
        setHasSelectedLanguage(true);
        const existingLanguage = localStorage.getItem(`user-language-${user.id}`);
        if (existingLanguage !== sessionLanguage) {
        updateUserLanguage(user.id, sessionLanguage as Language);
        }
        return;
      }
      
      const userLanguage = localStorage.getItem(`user-language-${user.id}`);
      
      if (userLanguage) {
        // setHasSelectedLanguage(true) - userLanguage (silenciado)
        setHasSelectedLanguage(true);
      } else {
        const appLanguage = localStorage.getItem('app-language');
        if (appLanguage) {
          const existingLanguage = localStorage.getItem(`user-language-${user.id}`);
          if (existingLanguage !== appLanguage) {
          updateUserLanguage(user.id, appLanguage as Language);
          }
          // setHasSelectedLanguage(true) - appLanguage (silenciado)
          setHasSelectedLanguage(true);
        } else {
          // setHasSelectedLanguage(false) - sem idioma (silenciado)
          setHasSelectedLanguage(false);
        }
      }
    } else {
      // setHasSelectedLanguage(false) - sem user (silenciado)
      setHasSelectedLanguage(false);
      hasHandledLanguageCheck.current = false;
    }
  }, [user, user?.id, updateUserLanguage, redirectingFromLanguage]);

  // ✅ SIMPLIFICAÇÃO: Gerenciar loading screen apenas baseado no estado de loading
  useEffect(() => {
    if (!loading) {
      setLoadingProgress(100);
      setShowLoadingScreen(false);
    }
  }, [loading]);
  
  useEffect(() => {
    const isFromLanguageSelect = 
      sessionStorage.getItem('redirecting-from-language-select') === 'true' ||
      sessionStorage.getItem('language-selection-completed') === 'true';
    
    if (isFromLanguageSelect) {
      // Redirecionamento da página de idioma (silenciado)
      setLoadingProgress(100);
      setShowLoadingScreen(false);
      
      setRedirectingFromLanguage(true);
      
      sessionStorage.removeItem('redirecting-from-language-select');
      sessionStorage.removeItem('language-selection-completed');
    }
  }, [location.pathname]);
  
  // ✅ SIMPLIFICAÇÃO: Removido progresso animado de loading
  
  const homePathElement = useMemo(() => {
    // useMemo executado (silenciado)
    
    // ✅ CORREÇÃO CRÍTICA: Durante o loading, mostrar a página normalmente sem redirecionar
    if (!loading && !user) {
      // Sem usuário, redirecionando (silenciado)
      return <Navigate to="/splash" replace />;
    }

    if (!loading && user) {
      // Usuário autenticado (silenciado)
    }
    
    if (loading) {
      // Loading=true (silenciado)
    }

    // Definir português como idioma padrão se não houver nenhum
    if (!localStorage.getItem('app-language')) {
      localStorage.setItem('app-language', 'pt');
    }

    // Sempre marcar que o idioma foi selecionado
    sessionStorage.setItem('language-selection-completed', 'true');

    // Ir direto para a página inicial
    return <AuthGuard checkOnly={true}><IndexPage /></AuthGuard>;
  }, [user, loading]);

  const splashPathElement = useMemo(() => {
    // useMemo executado (silenciado)
    
    // ✅ CORREÇÃO CRÍTICA: Durante o loading, não redirecionar
    // ✅ CORREÇÃO DE LOOP: Só redirecionar se REALMENTE tiver user, não apenas rememberUser
    if (!loading && user) {
      // Usuário autenticado, redirecionando (silenciado)
      return <Navigate to="/" replace />;
    }
    
    if (loading) {
      // Loading=true (silenciado)
    }
    
    // Mostrando SplashScreen (silenciado)
    return <SplashScreen />;
  }, [user, loading]);

  const authPathElement = useMemo(() => {
    // useMemo executado (silenciado)
    
    const languageSelectionCompleted = sessionStorage.getItem('language-selection-completed') === 'true';
    
    // ULTRA-CRÍTICO: VERIFICAÇÕES MÁXIMAS para garantir tela de cadastro concluído
    const justRegistered = sessionStorage.getItem('just-registered') === 'true';
    const preventAuthRedirect = sessionStorage.getItem('prevent_auth_redirect') === 'true';
    const preventDashboardRedirect = localStorage.getItem('prevent_dashboard_redirect') === 'true';
    
    // Verificar expiração da flag prevent_dashboard_redirect
    let preventDashboardRedirectValid = preventDashboardRedirect;
    if (preventDashboardRedirect) {
      const expirationTime = localStorage.getItem('prevent_dashboard_redirect_expiration');
      if (expirationTime && parseInt(expirationTime) < Date.now()) {
        // Flag expirada (silenciado)
        localStorage.removeItem('prevent_dashboard_redirect');
        localStorage.removeItem('prevent_dashboard_redirect_expiration');
        preventDashboardRedirectValid = false;
      }
    }
    
    const cadastroConcluido = justRegistered || preventAuthRedirect || preventDashboardRedirectValid;
    
    
    // ULTRA-CRÍTICO: Se acabou de se cadastrar, SEMPRE mostrar Auth (tela de sucesso)
    // Esta verificação tem PRIORIDADE ABSOLUTA MÁXIMA sobre todas as outras
    if (cadastroConcluido) {
      // Proteções anti-redirecionamento ativadas (silenciado)
      
      // Forçar logout para garantir que não haverá redirecionamento automático
      if (user) {
        // Forçando logout (silenciado)
        setTimeout(() => {
          try {
            import('@/lib/supabase').then(({ getSupabase }) => {
              (getSupabase() as SupabaseClient<Database>).auth.signOut();
              // Logout realizado (silenciado)
            });
          } catch (e) {
            // Erro ao forçar logout (silenciado)
          }
        }, 100);
      }
      
      return <Auth />;
    }
    
    // Só processar outros redirecionamentos se NÃO acabou de se cadastrar
    if (!cadastroConcluido && !loading) {
      // CORREÇÃO: Só redirecionar se rememberUser E tiver usuário
      if (rememberUser && user) {
        // RememberUser ativo (silenciado)
        return <Navigate to="/" replace />;
      }
      
      if (user) {
        if (hasSelectedLanguage || languageSelectionCompleted) {
          // Redirecionando para dashboard (silenciado)
          return <Navigate to="/" replace />;
        }
        // Redirecionando para seleção de idioma (silenciado)
        return <Navigate to="/language-select" replace />;
      }
    }
    
    // Se não tem usuário ou outros casos, mostrar Auth
    // Mostrando tela Auth (silenciado)
    return <Auth />;
  }, [user, rememberUser, hasSelectedLanguage, loading]);

  const languageSelectPathElement = useMemo(() => {
    // ✅ CORREÇÃO CRÍTICA: Durante o loading, não redirecionar
    if (!loading && !user) {
      return <Navigate to="/auth" replace />;
    }
    return <LanguageSelectPage />;
  }, [user, loading]);

  const memoizedRoutes = useMemo(() => (
    <Routes>
      <Route path="/" element={homePathElement} />
      <Route path="/splash" element={splashPathElement} />
      <Route path="/auth" element={authPathElement} />
      <Route path="/auth/reset-password" element={<ResetPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      <Route path="/language-select" element={languageSelectPathElement} />
      
      <Route path="/signals" element={<AuthGuard checkOnly={true}><Signals /></AuthGuard>} />
      <Route path="/settings" element={<AuthGuard checkOnly={true}><Settings /></AuthGuard>} />
      <Route path="/news" element={<AuthGuard checkOnly={true}><News /></AuthGuard>} />
      <Route path="/notifications" element={<AuthGuard checkOnly={true}><NotificationsPage /></AuthGuard>} />
      <Route path="/instructions" element={<AuthGuard checkOnly={true}><Instructions /></AuthGuard>} />
      <Route path="/support" element={<AuthGuard checkOnly={true}><Support /></AuthGuard>} />
      <Route path="/admin" element={<AuthGuard checkOnly={true}><Admin /></AuthGuard>} />
      <Route path="/ranking" element={<AuthGuard checkOnly={true}><Ranking /></AuthGuard>} />
      <Route path="/social" element={<AuthGuard checkOnly={true}><Social /></AuthGuard>} />
      
      {/* Novas rotas para o sistema de mídia */}
      <Route path="/media" element={<AuthGuard checkOnly={true}><MediaHub /></AuthGuard>} />
      <Route path="/video/:id" element={<AuthGuard checkOnly={true}><VideoPlayerPage /></AuthGuard>} />
      <Route path="/shorts" element={<AuthGuard checkOnly={true}><ShortsPlayer /></AuthGuard>} />
      <Route path="/shorts/:id" element={<AuthGuard checkOnly={true}><ShortsPlayer /></AuthGuard>} />
      <Route path="/upload" element={<AuthGuard checkOnly={true}><UploadPage /></AuthGuard>} />
      
      {/* Rotas existentes de streaming */}
      <Route path="/live" element={<AuthGuard checkOnly={true}><Live /></AuthGuard>} />
      <Route path="/profile/:streamerId" element={<AuthGuard checkOnly={true}><StreamerProfile /></AuthGuard>} />
      <Route path="/live/:streamId" element={<AuthGuard checkOnly={true}><MeetingRoom /></AuthGuard>} />
      <Route path="/streamer/:streamId" element={<AuthGuard checkOnly={true}><StreamerDashboard /></AuthGuard>} />
      <Route path="/watch/:streamId" element={<AuthGuard checkOnly={true}><StreamViewer /></AuthGuard>} />
      <Route path="/stream-debug" element={<AuthGuard checkOnly={true}><StreamDebug /></AuthGuard>} />
      <Route path="/streaming" element={<Navigate to="/live" replace />} />
      <Route path="/livekit-streaming" element={<AuthGuard checkOnly={true}><LiveKitStreaming /></AuthGuard>} />
      <Route path="/livekit-streaming/:roomId" element={<AuthGuard checkOnly={true}><LiveKitStreaming /></AuthGuard>} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  ), [homePathElement, splashPathElement, authPathElement, languageSelectPathElement]);
  
  // ✅ SIMPLIFICAÇÃO: Mostrar loading screen se loading=true
  if (loading) {
    return <LoadingScreen />;
  }

  return memoizedRoutes;
};



const App = () => {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const preloadData = async () => {
      try {
        await Promise.allSettled([
          queryClient.prefetchQuery({
            queryKey: ['dashboardSignals'],
            queryFn: () => Promise.resolve([]),
            staleTime: 0,
          }),
          Promise.allSettled(
            ['/profeyes-logo-removebg-preview.png', '/favicon.ico'].map(src => preloadImage(src))
          ),
        ]);
      } catch (error) {
        console.error('Erro no pré-carregamento:', error);
      }
    };
    
    preloadData();
  }, [queryClient]);

  useEffect(() => {
    const savedAvatar = localStorage.getItem('user-avatar');
    if (savedAvatar) {
      preloadImage(savedAvatar);
    }
    
    preloadImage('/profeyes-logo-removebg-preview.png');
    preloadImage('/placeholder.svg');
    
    preloadImage('/user-avatar.png');
  }, []);

  const preloadImage = (src: string) => {
    return new Promise((resolve, reject) => {
      const imageCache = localStorage.getItem('image-cache') || '{}';
      const cachedImages = JSON.parse(imageCache);
      
      if (cachedImages[src] === true) {
        // Imagem já carregada (silenciado)
        return resolve(src);
      }
      
      if (src.includes('favicon.ico')) {
        // Pulando favicon (silenciado)
        
        fetch(src, { method: 'HEAD', cache: 'force-cache' })
          .then(response => {
            if (response.ok) {
              cachedImages[src] = true;
              localStorage.setItem('image-cache', JSON.stringify(cachedImages));
              // Favicon verificado (silenciado)
            } else {
              // Favicon não encontrado (silenciado)
            }
            resolve(src);
          })
          .catch(error => {
            // Erro ao verificar favicon (silenciado)
            resolve(null);
          });
        return;
      }
      
      const img = new Image();
      img.onload = () => {
        cachedImages[src] = true;
        localStorage.setItem('image-cache', JSON.stringify(cachedImages));
        resolve(src);
      };
      img.onerror = () => {
        // Falha ao pré-carregar (silenciado)
        
        if (src.startsWith('/')) {
          const alternativePath = src.substring(1);
          // Tentando caminho alternativo (silenciado)
          
          const altImg = new Image();
          altImg.onload = () => {
            cachedImages[alternativePath] = true;
            localStorage.setItem('image-cache', JSON.stringify(cachedImages));
            resolve(alternativePath);
          };
          altImg.onerror = () => {
            // Também falhou (silenciado)
            resolve(null);
          };
          altImg.src = alternativePath;
        } else {
          resolve(null);
        }
      };
      img.src = src;
    });
  };

  // Estados removidos - já declarados no AppRouter
  // const [loadingProgress, setLoadingProgress] = useState(0);
  // const [showLoadingScreen, setShowLoadingScreen] = useState(false);

  // useEffect removido - estados não existem mais no App component
  // A lógica de loading está no AppRouter

  // Forçar que o usuário sempre tenha um idioma selecionado para evitar redirecionamento
  useEffect(() => {
    // Se não há idioma definido, definir português como padrão
    if (!localStorage.getItem('app-language')) {
      localStorage.setItem('app-language', 'pt');
    }
    
    // Se o usuário está logado, garantir que tenha idioma associado
    const user = JSON.parse(localStorage.getItem('supabase.auth.token') || '{}')?.user;
    if (user?.id && !localStorage.getItem(`user-language-${user.id}`)) {
      localStorage.setItem(`user-language-${user.id}`, 'pt');
    }

    // Marcar que o idioma foi selecionado para evitar redirecionamento
    sessionStorage.setItem('language-selection-completed', 'true');
  }, []);

  return (
    <TrendingNotificationProvider>
      <VideoProvider>
        <LiveStreamProvider>
          <LiveKitProvider>
            <LiveStreamPermissionProvider>
              <AvatarPersistence />
              <UserProfilePersistence />
              <div className="min-h-screen" style={{ backgroundColor: 'transparent' }}>
                <HotToaster position="bottom-center" />
                <AppRouter />
                <Toaster />
              </div>
            </LiveStreamPermissionProvider>
          </LiveKitProvider>
        </LiveStreamProvider>
      </VideoProvider>
    </TrendingNotificationProvider>
  );
};

export default App;
