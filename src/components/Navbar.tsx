import { useNotifications } from "@/contexts/NotificationContext";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/ui/language-selector";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/utils";
import { 
  ChevronDown, 
  ChevronRight, 
  Home, 
  LayoutDashboard, 
  Settings, 
  BookOpen, 
  Radio, 
  Newspaper,
  LogOut,
  User,
  UserCircle,
  MessageSquare,
  Trophy
} from "lucide-react";

const Navbar = () => {
  const { unreadCount } = useNotifications();
  const { t } = useLanguage();
  
  // Obter o pathname atual
  const pathname = window.location.pathname;

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-black/60 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2">
            <img src="/profeyes-shapes-logo.png" width={24} height={24} alt="ProfEyes Logo" />
            <span className="font-bold sm:inline-block text-white/90">
              ProfEyes Trading Assistant
            </span>
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link
              href="/"
              className={cn(
                "flex items-center text-sm font-medium",
                pathname === "/" ? "text-white/90" : "text-white/60 hover:text-white/90"
              )}
            >
              {t('nav.home')}
            </Link>
            <Link
              href="/dashboard"
              className={cn(
                "flex items-center text-sm font-medium",
                pathname === "/dashboard" ? "text-white/90" : "text-white/60 hover:text-white/90"
              )}
            >
              {t('nav.dashboard')}
            </Link>
            <Link
              href="/instructions"
              className={cn(
                "flex items-center text-sm font-medium",
                pathname === "/instructions" ? "text-white/90" : "text-white/60 hover:text-white/90"
              )}
            >
              {t('nav.instructions')}
            </Link>
            <Link
              href="/ranking"
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium",
                pathname === "/ranking" ? "text-white/90" : "text-white/60 hover:text-white/90"
              )}
            >
              <Trophy className="h-4 w-4" />
              Ranking
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <LanguageSelector variant="minimal" />
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {}}
            className="hover:bg-transparent"
            style={{
              transition: 'none'
            }}
          >
            {unreadCount > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                {unreadCount}
              </Badge>
            )}
            <Bell className="h-5 w-5 text-white/80" style={{ transition: 'none' }} />
          </Button>
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-white/70 transition-all hover:text-white",
              pathname === "/settings" && "bg-white/10 text-white"
            )}
          >
            <Settings className="h-4 w-4" />
            <span>{t('nav.settings')}</span>
          </Link>
          
          <Link
            href="/support"
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-white/70 transition-all hover:text-white",
              pathname === "/support" && "bg-white/10 text-white"
            )}
          >
            <MessageSquare className="h-4 w-4" />
            <span>{t('nav.support') || "Suporte"}</span>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Navbar; 