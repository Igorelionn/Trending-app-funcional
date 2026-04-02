import { Sidebar, SidebarContent, SidebarHeader, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  Menu, 
  LayoutDashboard, 
  Newspaper, 
  Settings, 
  Signal,
  Bell,
  Check,
  HelpCircle,
  MessageSquare,
  Video,
  Shield,
  Trophy,
  Users,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useNavigate, useLocation } from 'react-router-dom';
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useNotifications } from "@/contexts/NotificationContext";
import { useUser } from "@/contexts/UserContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useRef } from 'react';
import { supabase } from "@/lib/supabase";
import type { SupabaseClient } from '@supabase/supabase-js';
import { Badge } from '@/components/ui/badge';
import { ProfileMenu } from "@/components/ui/profile-menu";
import { isBackgroundModeEnabled } from '../utils/visibilityManager';
// Importar o componente de teste apenas em ambiente de desenvolvimento
// import StreamTestUI from '@/components/dev/StreamTestUI';

interface LayoutProps {
  children: React.ReactNode;
}

// Componente personalizado para o badge de notificação
const NotificationBadge = ({ count }: { count: number }) => {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ 
        type: "spring",
        stiffness: 500,
        damping: 15
      }}
      className="relative ml-auto flex items-center justify-center"
    >
      <span className="absolute inset-0 rounded-full animate-ping bg-red-500 opacity-40"></span>
      <span className="relative flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-red-600 px-1.5 text-xs font-semibold text-white shadow-lg ring-1 ring-inset ring-white/10">
        {count}
      </span>
    </motion.div>
  );
};

// ─── Componente interno: usa useSidebar (precisa estar dentro do SidebarProvider) ───
interface NavContentProps {
  navigate: (path: string) => void;
  location: { pathname: string; search: string };
  t: (key: string) => string;
  isAdmin: boolean;
  liveStreamsCount: number;
  unreadCount: number;
  userName: string;
  avatarUrl: string | null;
}

function NavSidebarContent({
  navigate, location, t, isAdmin, liveStreamsCount, unreadCount,
}: NavContentProps) {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) => location.pathname === path;

  const NavBtn = ({
    icon: Icon,
    label,
    path,
    badge,
  }: {
    icon: React.ElementType;
    label: React.ReactNode;
    path: string;
    badge?: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      className={cn(
        "w-full justify-start gap-3 py-3 text-sm font-medium transition-all",
        "hover:bg-white/5 text-white/80 hover:text-white",
        isActive(path)
          ? "bg-white/5 text-white border-l-2 border-white/60 pl-3"
          : "pl-4",
        isCollapsed && "justify-center pl-0 pr-0"
      )}
      onClick={() => navigate(path)}
    >
      <Icon className="h-4 w-4 opacity-70 shrink-0" />
      {!isCollapsed && <span className="truncate">{label}</span>}
      {!isCollapsed && badge}
    </Button>
  );

  return (
    <>
      {/* Header: logo + perfil — ocultos quando recolhido */}
      <SidebarHeader className={cn(
        "flex items-center p-4 transition-all",
        isCollapsed ? "justify-center" : "justify-between"
      )}>
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <Logo />
          </div>
        )}
        {!isCollapsed && <ProfileMenu />}
      </SidebarHeader>

      <SidebarContent className="p-4 flex flex-col h-[calc(100vh-65px)] overflow-visible">
        <nav className="space-y-0.5">
          <NavBtn icon={LayoutDashboard} label={t('nav.dashboard')} path="/" />
          <NavBtn icon={Signal} label={t('nav.signals') || 'Trades'} path="/signals" />
          <NavBtn icon={Newspaper} label={t('nav.news') || 'Notícias'} path="/news" />
          <NavBtn icon={HelpCircle} label={t('nav.instructions')} path="/instructions" />
          <NavBtn
            icon={Video}
            label={t('nav.live') || 'Ao Vivo'}
            path="/live"
            badge={
              liveStreamsCount > 0 && (
                <span className="ml-auto relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
              )
            }
          />
          <NavBtn icon={Trophy} label="Ranking" path="/ranking" />
          <NavBtn icon={Users} label="Social" path="/social" />
        </nav>

        {!isCollapsed && (
          <div className="my-4 flex items-center gap-2 px-2">
            <div className="h-px flex-1 bg-white/5" />
            <span className="text-[10px] uppercase text-white/30 font-medium">
              {t('nav.settings.notifications') || 'Área do Usuário'}
            </span>
            <div className="h-px flex-1 bg-white/5" />
          </div>
        )}
        {isCollapsed && <div className="my-4 h-px bg-white/5" />}

        <nav className="space-y-0.5">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 py-3 text-sm font-medium transition-all notification-button-group relative",
              "hover:bg-white/5 text-white/80 hover:text-white",
              isActive('/notifications') && !location.search.includes('filter=read')
                ? "bg-white/5 text-white border-l-2 border-white/60 pl-3"
                : "pl-4",
              isCollapsed && "justify-center pl-0 pr-0"
            )}
            onClick={() => navigate('/notifications')}
          >
            <div className="relative shrink-0">
              <Bell className="h-4 w-4 opacity-70" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
            {!isCollapsed && (
              <>
                <span>{t('nav.notifications') || 'Notificações'}</span>
                {unreadCount > 0 && <NotificationBadge count={unreadCount} />}
              </>
            )}
          </Button>

          <NavBtn icon={Settings} label={t('nav.settings')} path="/settings" />
          <NavBtn icon={MessageSquare} label={t('nav.support') || 'Suporte'} path="/support" />
          {isAdmin && <NavBtn icon={Shield} label="Admin" path="/admin" />}
        </nav>

        {/* Botão de colapso — fixo no fundo da sidebar */}
        <div className="mt-auto pt-4 border-t border-white/5">
          <Button
            variant="ghost"
            onClick={toggleSidebar}
            className={cn(
              "w-full py-2.5 text-white/40 hover:text-white hover:bg-white/5 transition-all",
              isCollapsed ? "justify-center px-0" : "justify-start gap-3 pl-4"
            )}
            title={isCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
          >
            {isCollapsed
              ? <ChevronRight className="h-4 w-4" />
              : <>
                  <ChevronLeft className="h-4 w-4" />
                  <span className="text-xs">Recolher</span>
                </>
            }
          </Button>
        </div>
      </SidebarContent>
    </>
  );
}

/** Lê o cookie sidebar:state para preservar o estado de collapse entre navegações/reloads */
function getSidebarInitialOpen(): boolean {
  try {
    const match = document.cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('sidebar:state='));
    if (match) return match.split('=')[1].trim() === 'true';
  } catch { /* noop */ }
  return true; // padrão: expandido
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  
  // Usando o contexto real de notificações
  const { notifications, unreadCount } = useNotifications();
  const readCount = notifications.filter(n => n.read).length;
  
  // Usando o contexto do usuário
  const { userName, avatarUrl, refreshUserData } = useUser();
  
  // 📌 REF para estabilizar refreshUserData nos useEffects
  const refreshUserDataRef = useRef(refreshUserData);
  
  useEffect(() => {
    refreshUserDataRef.current = refreshUserData;
  }, [refreshUserData]);
  
  // Estado para rastrear transmissões ativas
  const [liveStreamsCount, setLiveStreamsCount] = useState(0);
  
  // Estado para verificar se o componente carregou corretamente
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  // Referência para controlar se veio da página de seleção de idioma
  const fromLanguageSelectRef = useRef(
    sessionStorage.getItem('redirecting-from-language-select') === 'true' ||
    sessionStorage.getItem('language-selection-completed') === 'true'
  );
  
  // Verificar e limpar flags de redirecionamento
  useEffect(() => {
    const checkRedirectionFlags = () => {
      const redirectingFromLanguage = sessionStorage.getItem('redirecting-from-language-select') === 'true';
      const languageSelectionCompleted = sessionStorage.getItem('language-selection-completed') === 'true';
      
      if (redirectingFromLanguage || languageSelectionCompleted) {
        // Limpando flags de redirecionamento
        
        // Limpar flags de redirecionamento
        sessionStorage.removeItem('redirecting-from-language-select');
        sessionStorage.removeItem('language-selection-completed');
        
        // Forçar a atualização de dados do usuário (usa ref para evitar loop)
        refreshUserDataRef.current();
      }
    };
    
    // Verificar flags no carregamento
    checkRedirectionFlags();
    
    // Marcar componente como carregado após um breve delay
    const timer = setTimeout(() => {
      setLayoutLoaded(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []); // ✅ ESTÁVEL — refreshUserData REMOVIDO, acessado via ref
  
  // Forçar renderização completa quando vem da página de seleção de idioma
  useEffect(() => {
    if (fromLanguageSelectRef.current) {
      // Aplicar estilos globais para garantir renderização correta
      document.documentElement.classList.add('layout-forced');
      document.body.classList.add('bg-black');
      
      // Limpar a referência após o uso
      fromLanguageSelectRef.current = false;
    }
    
    return () => {
      document.documentElement.classList.remove('layout-forced');
    };
  }, []);
  
  // Precarregar o avatar no cache do navegador para evitar flickering
  useEffect(() => {
    const preloadAvatar = () => {
      // Verificar primeiro no localStorage
      const storedAvatar = localStorage.getItem("user-avatar");
      const avatarToPreload = storedAvatar || avatarUrl;
      
      if (avatarToPreload) {
        const img = new Image();
        img.src = avatarToPreload;
      }
    };
    
    // Precarregar imediatamente
    preloadAvatar();
    
    // Precarregar quando a página carregar completamente
    window.addEventListener('load', preloadAvatar);
    
    return () => {
      window.removeEventListener('load', preloadAvatar);
    };
  }, [avatarUrl]);
  
  // Efeito para verificar alterações na foto de perfil e recarregar dados ao trocar abas
  useEffect(() => {
    // Função para verificar e atualizar dados do usuário silenciosamente
    const syncUserData = async () => {
      // Se o modo background está ativo, não fazer nada
      if (isBackgroundModeEnabled()) {
        return;
      }
      await refreshUserData();
    };

    // Verificar avatar no localStorage silenciosamente
    const storedAvatar = localStorage.getItem("user-avatar");
    if (!avatarUrl && storedAvatar) {
      syncUserData();
    }

    // Executar na montagem do componente
    syncUserData();
    
    // Handler para quando o app volta do background
    const handleBackgroundResume = () => {
      // Se o modo background está ativo, não fazer nada
      if (isBackgroundModeEnabled()) {
        return;
      }
      syncUserData();
    };
    
    // Handler para eventos de avatar atualizado
    const handleAvatarUpdated = () => {
      syncUserData();
    };
    
    window.addEventListener('background-resume', handleBackgroundResume);
    window.addEventListener('avatar-updated', handleAvatarUpdated);
    
    return () => {
      window.removeEventListener('background-resume', handleBackgroundResume);
      window.removeEventListener('avatar-updated', handleAvatarUpdated);
    };
  }, [refreshUserData, avatarUrl]);
  
  // Verificar transmissões ativas
  useEffect(() => {
    const checkActiveStreams = async () => {
      try {
        const { data, error } = await (supabase as SupabaseClient)
          .from('live_streams')
          .select('id')
          .eq('status', 'live');
          
        if (!error && data) {
          setLiveStreamsCount(data.length);
        }
      } catch {
        // silenciar erro de verificação de streams
      }
    };
    
    // Verificar streams ativos na inicialização
    checkActiveStreams();
    
    // Usar polling em vez de Realtime para verificar streams ativos
    const pollingInterval = setInterval(checkActiveStreams, 30000); // A cada 30 segundos
      
    return () => {
      clearInterval(pollingInterval);
    };
  }, []);
  
  // Verificar se estamos em ambiente de desenvolvimento
  const isDevelopment = import.meta.env.DEV;

  return (
      /* --sidebar-width-icon sobrescrito para sidebar recolhida mais larga */
      <SidebarProvider
        defaultOpen={getSidebarInitialOpen()}
        style={{ "--sidebar-width-icon": "4.5rem" } as React.CSSProperties}
      >
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar className="border-r border-white/5 overflow-visible z-30" collapsible="icon">
          <NavSidebarContent
            navigate={navigate}
            location={location}
            t={t}
            isAdmin={isAdmin}
            liveStreamsCount={liveStreamsCount}
            unreadCount={unreadCount}
            userName={userName}
            avatarUrl={avatarUrl}
          />
        </Sidebar>
        
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto relative min-w-0 z-0">
          <div className="md:hidden flex items-center mb-4 gap-2">
            <SidebarTrigger className="h-9 w-9 shrink-0 border-white/10 bg-black/20" />
            <span className="ml-1 text-sm font-medium truncate">{location.pathname === '/' ? 'Dashboard' : location.pathname.substring(1).charAt(0).toUpperCase() + location.pathname.substring(2)}</span>
          </div>
          
          {children}
          
          {/* Incluir o componente de teste apenas em desenvolvimento */}
          {/* {isDevelopment && <StreamTestUI />} */}
        </main>
      </div>
    </SidebarProvider>
  );
}
