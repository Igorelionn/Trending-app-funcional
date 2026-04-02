import React, { useState, useEffect } from 'react';
import { Notification, useNotifications } from '@/contexts/NotificationContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Check, Tag, X, ChevronRight, Calendar, Clock, Filter, Trash2, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Formata o tempo relativo (há quanto tempo aconteceu)
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'Agora mesmo';
  } else if (diffMin < 60) {
    return `${diffMin} min atrás`;
  } else if (diffHour < 24) {
    return `${diffHour}h atrás`;
  } else if (diffDay === 1) {
    return 'Ontem';
  } else if (diffDay < 7) {
    return `${diffDay} dias atrás`;
  } else {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
}

/**
 * Formata a data completa
 */
function formatFullDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Configurações de cores por tipo de notificação - Estilo minimalista
const notificationStyles: Record<string, { icon: React.ReactNode; color: string; bgColor: string; borderColor: string }> = {
  signals: { 
    icon: <Tag size={16} />, 
    color: 'text-white/60', 
    bgColor: 'bg-white/[0.02]',
    borderColor: 'border-white/5'
  },
  completed: { 
    icon: <Check size={16} />, 
    color: 'text-white/60', 
    bgColor: 'bg-white/[0.02]',
    borderColor: 'border-white/5'
  },
  stopped: { 
    icon: <X size={16} />, 
    color: 'text-white/60', 
    bgColor: 'bg-white/[0.02]',
    borderColor: 'border-white/5'
  },
  system: { 
    icon: <Bell size={16} />, 
    color: 'text-white/60', 
    bgColor: 'bg-white/[0.02]',
    borderColor: 'border-white/5'
  },
  info: { 
    icon: <Bell size={16} />, 
    color: 'text-white/60', 
    bgColor: 'bg-white/[0.02]',
    borderColor: 'border-white/5'
  }
};

// Componente para um item de notificação
interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  onRemove?: (id: string) => void;
  onClick?: () => void;
  compact?: boolean;
}

const NotificationItem = ({ notification, onMarkAsRead, onRemove, onClick, compact = false }: NotificationItemProps) => {
  const navigate = useNavigate();
  const style = notificationStyles[notification.type] || notificationStyles.system;
  
  const handleAction = () => {
    if (notification.actionLink) {
      window.open(notification.actionLink, '_blank');
    }
    if (onClick) onClick();
    if (!notification.read && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
  };

  const renderActionButton = () => {
    if (notification.type === 'signals' && notification.actionLink) {
      return (
        <Button
          variant="default"
          size="sm"
          className="mt-3 w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            window.open(notification.actionLink, '_blank');
          }}
        >
          <span className="flex items-center justify-center gap-2 text-sm font-light">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Abrir Corretora
          </span>
        </Button>
      );
    }
    return null;
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative border p-4 mb-2 rounded-lg transition-all cursor-pointer group",
        "bg-white/[0.02] backdrop-blur-sm",
        notification.read 
          ? "border-white/5 opacity-60" 
          : "border-white/10",
        compact ? "p-3" : "p-4",
        "hover:bg-white/[0.04] hover:border-white/20"
      )}
      onClick={handleAction}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-2 rounded-lg transition-all bg-white/5 border border-white/10",
          style.color,
          "group-hover:bg-white/10"
        )}>
          {style.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-white/90">
            {notification.title}
          </h4>
          
          <p className="text-sm mt-1 text-white/60 font-light">
            {notification.message}
          </p>

          {renderActionButton()}
          
          <div className="flex items-center gap-1.5 mt-2 text-xs text-white/40">
            <Clock size={12} />
            <span>
              {formatRelativeTime(new Date(notification.timestamp))}
            </span>
          </div>
        </div>
        
        {!compact && (
          <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!notification.read && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/40 hover:text-white/80 hover:bg-white/5"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onMarkAsRead) onMarkAsRead(notification.id);
                }}
              >
                <Check size={14} />
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/40 hover:text-red-400 hover:bg-white/5"
              onClick={(e) => {
                e.stopPropagation();
                if (onRemove) onRemove(notification.id);
              }}
            >
              <X size={14} />
            </Button>
          </div>
        )}
      </div>

      {!notification.read && (
        <div className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-white/60" />
      )}
    </motion.div>
  );
};

// Componente para o filtro de notificações
interface NotificationFilterProps {
  selectedType: string;
  onSelectType: (type: string) => void;
  onClear: () => void;
  onMarkAllAsRead: () => void;
  unreadOnly: boolean;
  setUnreadOnly: (value: boolean) => void;
}

const NotificationFilter = ({
  selectedType,
  onSelectType,
  onClear,
  onMarkAllAsRead,
  unreadOnly,
  setUnreadOnly
}: NotificationFilterProps) => {
  const { settings } = useNotifications();
  const notificationTypes = settings.types;
  const { t } = useLanguage();
  
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">
          {t('notifications.yours')}
        </h3>
        
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onMarkAllAsRead}
                  className="bg-black/40 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700 text-zinc-300 transition-all duration-300"
                >
                  <Check size={14} className="mr-1.5 text-green-400" />
                  <span className="hidden sm:inline">{t('notifications.markAll')}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('notifications.markAllAsRead')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onClear}
                  className="bg-black/40 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700 text-zinc-300 transition-all duration-300"
                >
                  <Trash2 size={14} className="mr-1.5 text-red-400" />
                  <span className="hidden sm:inline">{t('notifications.clearAll')}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('notifications.removeAll')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8 bg-black/40 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700 text-zinc-300 transition-all duration-300"
                    >
                      <Filter size={14} />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('notifications.filter')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <DropdownMenuContent align="end" className="w-56 bg-black/90 border-zinc-800 backdrop-blur-sm">
              <DropdownMenuLabel className="text-zinc-400">{t('notifications.filterByType')}</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-800" />
              
              <DropdownMenuItem 
                onClick={() => onSelectType('all')}
                className={cn(
                  "flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-800/50 transition-colors duration-200",
                  selectedType === 'all' && "bg-zinc-800/50 text-white"
                )}
              >
                <Bell size={14} className="text-cyan-400" />
                {t('notifications.all')}
                {selectedType === 'all' && <Check size={14} className="ml-auto text-cyan-400" />}
              </DropdownMenuItem>
              
              {notificationTypes.map(type => (
                <DropdownMenuItem 
                  key={type.id}
                  onClick={() => onSelectType(type.id)}
                  className={cn(
                    "flex items-center gap-2 text-zinc-300 hover:text-white hover:bg-zinc-800/50 transition-colors duration-200",
                    selectedType === type.id && "bg-zinc-800/50 text-white"
                  )}
                >
                  {notificationStyles[type.id]?.icon || <Bell size={14} />}
                  {type.name}
                  {selectedType === type.id && <Check size={14} className="ml-auto text-cyan-400" />}
                </DropdownMenuItem>
              ))}
              
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuLabel className="text-zinc-400">{t('notifications.display')}</DropdownMenuLabel>
              <DropdownMenuItem 
                onClick={() => setUnreadOnly(!unreadOnly)}
                className="flex items-center justify-between text-zinc-300 hover:text-white hover:bg-zinc-800/50 transition-colors duration-200"
              >
                <span>{t('notifications.onlyUnread')}</span>
                {unreadOnly && <Check size={14} className="text-cyan-400" />}
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem asChild>
                <button 
                  className="flex items-center w-full text-zinc-300 hover:text-white hover:bg-zinc-800/50 transition-colors duration-200" 
                  onClick={() => window.location.href = '/settings'}
                >
                  <Settings size={14} className="mr-2 text-purple-400" />
                  {t('notifications.settings')}
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {selectedType !== 'all' && (
        <div className="mb-4">
          <Badge 
            variant="outline" 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 border-zinc-800 text-zinc-300"
          >
            {notificationStyles[selectedType]?.icon || <Bell size={12} />}
            <span>
              {settings.types.find(t => t.id === selectedType)?.name || t('notifications.filteringByType')}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-4 w-4 ml-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50" 
              onClick={() => onSelectType('all')}
            >
              <X size={10} />
            </Button>
          </Badge>
        </div>
      )}
    </div>
  );
};

// Componente principal
interface NotificationListProps {
  compact?: boolean;
  maxItems?: number;
}

export const NotificationList = ({ compact = false, maxItems }: NotificationListProps) => {
  const { 
    notifications, 
    markAsRead, 
    removeNotification, 
    markAllAsRead, 
    clearAllNotifications 
  } = useNotifications();
  
  const [selectedType, setSelectedType] = useState('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  
  // Simulação de carregamento para UX
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);
  
  // Filtra notificações com base nos critérios selecionados
  const filteredNotifications = notifications
    .filter(notification => 
      (selectedType === 'all' || notification.type === selectedType) &&
      (!unreadOnly || !notification.read)
    )
    .slice(0, maxItems);
  
  // Renderiza esqueletos durante o carregamento
  if (loading) {
    return (
      <div className="space-y-3">
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-4 border rounded-lg">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  // Interface para listagem completa
  if (!compact) {
    return (
      <div className="space-y-2">
        <NotificationFilter
          selectedType={selectedType}
          onSelectType={setSelectedType}
          onClear={clearAllNotifications}
          onMarkAllAsRead={markAllAsRead}
          unreadOnly={unreadOnly}
          setUnreadOnly={setUnreadOnly}
        />
        
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6 bg-black/40 border border-zinc-800 p-1">
            <TabsTrigger 
              value="all"
              className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 hover:text-zinc-200 transition-colors duration-200"
            >
              {t('notifications.all')}
            </TabsTrigger>
            <TabsTrigger 
              value="unread"
              className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 hover:text-zinc-200 transition-colors duration-200"
            >
              {t('notifications.unread')} 
              {notifications.filter(n => !n.read).length > 0 && (
                <Badge className="ml-1.5 bg-black/80 border border-white/10 text-white hover:bg-black/90 transition-colors">
                  {notifications.filter(n => !n.read).length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            <ScrollArea className="h-[calc(100vh-240px)]">
              <AnimatePresence initial={false}>
                {filteredNotifications.length > 0 ? (
                  filteredNotifications.map(notification => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={markAsRead}
                      onRemove={removeNotification}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Bell size={40} className="text-muted-foreground opacity-20 mb-4" />
                    <h3 className="text-lg font-medium">{t('notifications.notFound')}</h3>
                    <p className="text-muted-foreground mt-1">
                      {unreadOnly 
                        ? t('notifications.allRead')
                        : selectedType !== 'all' 
                          ? t('notifications.noneOfType')
                          : t('notifications.willAppearHere')}
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="unread">
            <ScrollArea className="h-[calc(100vh-240px)]">
              <AnimatePresence initial={false}>
                {notifications.filter(n => !n.read).length > 0 ? (
                  notifications
                    .filter(n => !n.read)
                    .filter(n => selectedType === 'all' || n.type === selectedType)
                    .map(notification => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkAsRead={markAsRead}
                        onRemove={removeNotification}
                      />
                    ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Check size={40} className="text-muted-foreground opacity-20 mb-4" />
                    <h3 className="text-lg font-medium">{t('notifications.noUnread')}</h3>
                    <p className="text-muted-foreground mt-1">
                      {t('notifications.allRead')}
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    );
  }
  
  // Interface compacta para sidebar/dropdown
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold">{t('notifications.recent')}</h3>
              <Button 
          variant="link" 
                size="sm" 
          className="text-xs h-auto p-0"
          onClick={() => window.location.href = '/notifications'}
              >
          {t('notifications.viewAll')}
              </Button>
            </div>
      
      <div className="space-y-1">
        <AnimatePresence initial={false}>
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map(notification => (
              <NotificationItem 
                key={notification.id} 
                notification={notification} 
                onMarkAsRead={markAsRead}
                onRemove={removeNotification}
                compact={true}
              />
            ))
          ) : (
            <div className="text-center py-5">
              <Bell size={24} className="text-muted-foreground opacity-20 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                {t('notifications.none')}
              </p>
            </div>
          )}
          </AnimatePresence>
      </div>
      
      {notifications.length > 0 && (
        <div className="mt-3 flex justify-end gap-2">
              <Button
            variant="ghost" 
                size="sm"
            className="text-xs h-7" 
                onClick={markAllAsRead}
              >
            {t('notifications.markAsRead')}
              </Button>
        </div>
      )}
    </div>
  );
}; 