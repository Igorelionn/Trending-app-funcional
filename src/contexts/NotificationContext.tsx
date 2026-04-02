import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { sendNotification, NotificationPriority, requestNotificationPermission, isNotificationPermissionGranted } from '@/utils/notifications';
import { toast } from 'sonner';
import { TradingSignal, SignalType } from '@/services/types';
import { shouldShowToast } from '@/services/notificationSettings';
import preSignalNotificationService from '@/services/signals/PreSignalNotificationService';
import { useLanguage } from './LanguageContext';
import { userNotificationDB } from '@/services/userNotificationDatabase';
import { supabase } from '@/lib/supabase';

// Tipos para as notificações
export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'system' | 'live' | 'signals';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt?: Date;
  timestamp: Date;
  read: boolean;
  linkTo?: string;
  actionLink?: string;
  image?: string;
  duration?: number;
  data?: Record<string, unknown>;
}

// Configurações de notificações
export interface NotificationSettings {
  enabled: boolean;
  browserNotifications: boolean;
  appNotifications: boolean;
  sound: boolean;
  volume: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  types: {
    id: string;
    name: string;
    enabled: boolean;
    sound: boolean;
    description: string;
  }[];
}

// Interface para notificação de sinal
interface SignalNotification {
  type: 'signals';
  title: string;
  message: string;
  confidence: 'high' | 'medium' | 'low';
  pair: string;
  direction: 'buy' | 'sell';
  timestamp: Date;
}

// Interface do contexto
interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  notificationsEnabled: boolean;
  browserNotificationsEnabled: boolean;
  appNotificationsEnabled: boolean;
  settings: NotificationSettings;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'read'>, showToast?: boolean) => void;
  addSignalNotification: (signal: TradingSignal, type: string, showToast?: boolean) => void;
  addPreSignalNotification: (signal: TradingSignal) => void;

  showSignalPreview: (signal: TradingSignal) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  clearAllNotifications: () => void;
  removeNotification: (id: string) => void;
  testNotification: () => void;
  requestPermission: () => Promise<boolean>;
  hasPermission: boolean;
  sendLiveNotification: (stream: {
    id: string;
    title: string;
    streamerName: string;
    streamerAvatar: string;
  }) => void;
}

// Função para obter configurações padrão com traduções
const getDefaultSettings = (t: (key: string) => string): NotificationSettings => ({
  enabled: true,
  browserNotifications: true,
  appNotifications: true,
  sound: true,
  volume: 70,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  types: [
    {
      id: 'signals',
      name: t('notifications.types.signals'),
      enabled: true,
      sound: true,
      description: t('notifications.types.signalsDesc')
    },
    {
      id: 'live',
      name: t('notifications.types.live'),
      enabled: true,
      sound: true,
      description: t('notifications.types.liveDesc')
    }
  ]
});

// Criação do contexto
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Hook para usar o contexto
// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications deve ser usado dentro de um NotificationProvider');
  }
  return context;
};

// Provedor do contexto
export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>(() => getDefaultSettings(t));
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [hasSyncedLocalStorage, setHasSyncedLocalStorage] = useState(false);
  
  // ✅ Set para rastrear notificações recentes e evitar duplicatas
  const recentNotificationsRef = React.useRef<Set<string>>(new Set());
  
  // ✅ Map para rastrear timeouts pendentes de notificações (debounce)
  const pendingNotificationsRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Verificar permissão inicial
  useEffect(() => {
    setHasPermission(isNotificationPermissionGranted());
  }, []);
  
  // Atualizar traduções quando idioma mudar
  useEffect(() => {
    setSettings(prevSettings => ({
      ...prevSettings,
      types: getDefaultSettings(t).types.map(defaultType => {
        const existingType = prevSettings.types.find(type => type.id === defaultType.id);
        return existingType ? {
          ...existingType,
          name: defaultType.name,
          description: defaultType.description
        } : defaultType;
      })
    }));
  }, [t]);
  
  // ✅ Carregar notificações e configurar Realtime Subscription
  useEffect(() => {
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
    
    const loadNotificationsFromDatabase = async () => {
      try {
        // ✅ LIMPAR NOTIFICAÇÕES ANTIGAS DO LOCALSTORAGE (com "Preço atual")
        try {
          const oldNotifs = localStorage.getItem('userNotifications');
          if (oldNotifs) {
            const parsed = JSON.parse(oldNotifs);
            if (Array.isArray(parsed) && parsed.some(n => n.message?.includes('Preço atual'))) {
              localStorage.removeItem('userNotifications');
              console.log('🗑️ Notificações antigas removidas do localStorage');
            }
          }
        } catch (e) {
          // Ignorar erro
        }
        
        // Verificar se há usuário autenticado
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          // ✅ NÃO carregar do localStorage (já foi limpo)
          setIsLoadingNotifications(false);
          return;
        }
        
        // Carregar notificações do banco de dados
        const { notifications: dbNotifications, error } = await userNotificationDB.loadNotifications(100, 0, false);
        
        if (error) {
          console.error('❌ Erro ao carregar notificações do banco:', error);
          // ✅ NÃO usar localStorage como fallback (dados podem estar desatualizados)
          setNotifications([]);
        } else {
          setNotifications(dbNotifications);
          
          // Sincronizar localStorage com banco de dados (apenas uma vez)
          if (!hasSyncedLocalStorage) {
            await userNotificationDB.syncLocalStorageToDatabase();
            setHasSyncedLocalStorage(true);
          }
        }
        
        // ✅ CONFIGURAR REALTIME SUBSCRIPTION para sincronizar entre navegadores/abas
        realtimeChannel = supabase
          .channel(`user-notifications-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'user_notifications',
              filter: `user_id=eq.${user.id}`
            },
            async (payload) => {
              if (payload.eventType === 'INSERT') {
                // Nova notificação adicionada em outro navegador/aba
                const newNotif = payload.new as Record<string, unknown>;
                const notification: Notification = {
                  id: String(newNotif.id),
                  type: newNotif.type as NotificationType,
                  title: String(newNotif.title),
                  message: String(newNotif.message),
                  read: Boolean(newNotif.read),
                  linkTo: newNotif.link_to ? String(newNotif.link_to) : undefined,
                  actionLink: newNotif.action_link ? String(newNotif.action_link) : undefined,
                  image: newNotif.image ? String(newNotif.image) : undefined,
                  data: (newNotif.data as Record<string, unknown>) || {},
                  timestamp: new Date(String(newNotif.created_at)),
                  createdAt: new Date(String(newNotif.created_at)),
                };
                
                setNotifications(prev => {
                  // Evitar duplicatas
                  if (prev.some(n => n.id === notification.id)) {
                    return prev;
                  }
                  return [notification, ...prev];
                });
              } else if (payload.eventType === 'DELETE') {
                // Notificação deletada em outro navegador/aba
                const deletedId = String(payload.old.id);
                setNotifications(prev => prev.filter(n => n.id !== deletedId));
              } else if (payload.eventType === 'UPDATE') {
                // Notificação atualizada (ex: marcada como lida)
                const updatedNotif = payload.new as Record<string, unknown>;
                setNotifications(prev =>
                  prev.map(n =>
                    n.id === String(updatedNotif.id)
                      ? { ...n, read: Boolean(updatedNotif.read) }
                      : n
                  )
                );
              }
            }
          )
          .subscribe();
        
      } catch (error) {
        console.error('❌ Erro ao carregar notificações:', error);
      } finally {
        setIsLoadingNotifications(false);
      }
    };

    loadNotificationsFromDatabase();
    
    // Configurar listener para mudanças de autenticação
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        loadNotificationsFromDatabase();
      } else if (event === 'SIGNED_OUT') {
        setNotifications([]);
        setHasSyncedLocalStorage(false);
        // Limpar canal de realtime
        if (realtimeChannel) {
          realtimeChannel.unsubscribe();
          realtimeChannel = null;
        }
      }
    });

    return () => {
      if (data?.subscription) {
        data.subscription.unsubscribe();
      }
      if (realtimeChannel) {
        realtimeChannel.unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Carregar configurações do localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('notificationSettings');
      const defaultSettings = getDefaultSettings(t);
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings) as Partial<NotificationSettings>;
        const updatedTypes = defaultSettings.types.map(defaultType => {
          const savedType = parsedSettings.types?.find((type) => type.id === defaultType.id);
          return savedType ? {
            ...savedType,
            name: defaultType.name,
            description: defaultType.description
          } : defaultType;
        });
        setSettings({...defaultSettings, ...parsedSettings, types: updatedTypes});
      } else {
        setSettings(defaultSettings);
        localStorage.setItem('notificationSettings', JSON.stringify(defaultSettings));
      }
    } catch (error) {
      console.error('Erro ao carregar configurações de notificações:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // ✅ NÃO salvar notificações no localStorage (usar apenas banco de dados)
  // Evita dessincronia e dados obsoletos
  
  // Salvar configurações quando mudam
  useEffect(() => {
    try {
      localStorage.setItem('notificationSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Erro ao salvar configurações de notificações:', error);
    }
  }, [settings]);
  
  // Número de notificações não lidas
  const unreadCount = notifications.filter(notif => !notif.read).length;
  
  // Função para solicitar permissão
  const requestPermission = async (): Promise<boolean> => {
    const granted = await requestNotificationPermission();
    setHasPermission(granted);
    return granted;
  };
  
  // Atualizar configurações
  const updateSettings = (newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => ({
      ...prev,
      ...newSettings
    }));
  };
  
  // Verificar se um tipo de notificação está habilitado
  const isNotificationTypeEnabled = (type: string): boolean => {
    const typeConfig = settings.types.find(t => t.id === type);
    return settings.enabled && typeConfig?.enabled === true;
  };
  
  // Verificar se o som deve ser tocado para um tipo
  const shouldPlaySoundForType = (type: string): boolean => {
    const typeConfig = settings.types.find(t => t.id === type);
    return settings.sound && typeConfig?.sound === true;
  };
  
  // ✅ Função para adicionar uma notificação COM DEDUPLICAÇÃO ROBUSTA
  const addNotification = async (notification: Omit<Notification, 'id' | 'read'>, showToast = true) => {
    // ✅ Criar chave única para deduplicação (mais específica)
    const dedupeKey = `${notification.type}-${notification.title}-${notification.message}`;
    
    // ✅ Verificar se já adicionamos esta notificação recentemente (últimos 5 minutos)
    if (recentNotificationsRef.current.has(dedupeKey)) {
      return; // Ignorar duplicata silenciosamente
    }
    
    // ✅ Debounce: Se já há um salvamento pendente, cancelar e reagendar
    const existingTimeout = pendingNotificationsRef.current.get(dedupeKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // ✅ VERIFICAR NO BANCO SE JÁ EXISTE (últimos 10 minutos)
        const { data: existingNotifications } = await supabase
          .from('user_notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('title', notification.title)
          .eq('message', notification.message)
          .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
          .limit(1);
        
        if (existingNotifications && existingNotifications.length > 0) {
          console.warn('⚠️ Notificação já existe no banco, ignorando duplicata');
          // Adicionar ao cache para evitar verificações repetidas
          recentNotificationsRef.current.add(dedupeKey);
          setTimeout(() => recentNotificationsRef.current.delete(dedupeKey), 5 * 60 * 1000);
          return; // Já existe no banco
        }
        
        // ✅ DEBOUNCE: Aguardar 500ms antes de salvar (consolidar múltiplas tentativas)
        const saveTimeout = setTimeout(async () => {
          pendingNotificationsRef.current.delete(dedupeKey);
          
          // Verificar novamente antes de salvar (dupla verificação)
          const { data: recheck } = await supabase
            .from('user_notifications')
            .select('id')
            .eq('user_id', user.id)
            .eq('title', notification.title)
            .eq('message', notification.message)
            .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
            .limit(1);
          
          if (recheck && recheck.length > 0) {
            console.log('✅ Duplicata detectada na dupla verificação');
            return;
          }
          
          // ✅ Salvar no banco e obter ID real
          const tempId = `notification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const newNotification: Notification = {
            ...notification,
            id: tempId,
            read: false,
            createdAt: notification.createdAt || new Date(),
          };
          
          const result = await userNotificationDB.saveNotificationWithId(newNotification);
          
          if (result.success && result.id) {
            // ✅ Adicionar ao cache para evitar duplicatas locais
            recentNotificationsRef.current.add(dedupeKey);
            setTimeout(() => recentNotificationsRef.current.delete(dedupeKey), 5 * 60 * 1000);
            
            // ⚠️ NÃO adicionar ao estado local - deixar o Realtime sincronizar
            // Isso evita duplicatas causadas por race conditions
            console.log('✅ Notificação salva, aguardando Realtime sincronizar');
          } else if (result.error) {
            // Se erro de constraint unique, é uma duplicata válida - ignorar
            if (result.error.message?.includes('unique') || result.error.message?.includes('duplicate')) {
              console.log('✅ Duplicata prevenida pelo banco');
              return;
            }
            console.error('❌ Erro ao salvar notificação:', result.error);
          }
        }, 500); // 500ms de debounce
        
        pendingNotificationsRef.current.set(dedupeKey, saveTimeout);
      } else {
        // Usuário não autenticado - salvar apenas localmente
        const tempId = `notification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const newNotification: Notification = {
          ...notification,
          id: tempId,
          read: false,
          createdAt: notification.createdAt || new Date(),
        };
        
        setNotifications((prev) => [newNotification, ...prev]);
      }
    } catch (error) {
      console.error('❌ Erro ao salvar notificação:', error);
      return;
    }
    
    // Adicionar notificação toast apenas se showToast for true
    if (showToast && notification.type) {
      const { title, message } = notification;
      
      // Usar toast apenas se configurado para exibir
      if (shouldShowToast(notification.type, 'toast')) {
        switch(notification.type) {
          case 'success':
            toast.success(title, { description: message });
            break;
          case 'error':
            toast.error(title, { description: message });
            break;
          case 'warning':
            toast.warning(title, { description: message });
            break;
          case 'info':
          case 'system':
          case 'signals':
          case 'live':
          default:
            toast.info(title, { description: message });
            break;
        }
      }
    }
  };
    
  // Função para adicionar notificação de sinal
  const addSignalNotification = (signal: TradingSignal, type: string, showToast = true) => {
    // Converter o sinal para uma notificação adequada
    let title = '';
    let message = '';
    
    // Determinar título e mensagem de acordo com o tipo de sinal
    switch(type) {
      case 'new':
        title = `🎯 Novo Sinal de ${signal.signal === 'BUY' ? 'COMPRA' : 'VENDA'}`;
        message = `${signal.pair} - ${signal.type} - Força: ${signal.strength}`;
        break;
      case 'update':
        title = `🔄 Sinal Atualizado`;
        message = `${signal.pair} - ${signal.signal === 'BUY' ? 'COMPRA' : 'VENDA'} - ${signal.type}`;
        break;
      case 'complete':
        title = `✅ Sinal Concluído com Sucesso`;
        message = `${signal.pair} - ${signal.signal === 'BUY' ? 'COMPRA' : 'VENDA'} - Alvo atingido`;
        break;
      case 'stop':
        title = `⚠️ Sinal Interrompido`;
        message = `${signal.pair} - ${signal.signal === 'BUY' ? 'COMPRA' : 'VENDA'} - Stop acionado`;
        break;
      default:
        title = `Sinal de Trading`;
        message = `${signal.pair} - ${signal.signal === 'BUY' ? 'COMPRA' : 'VENDA'}`;
        break;
    }
    
    addNotification({
      type: 'signals',
      title,
      message,
      createdAt: new Date(),
      timestamp: new Date(),
      actionLink: 'https://trade.avalonbroker.io/register?aff=385853&aff_model=revenue&afftrack=mesnagensfree',
      data: {
        type,
        pair: signal.pair,
        direction: signal.signal
      }
    }, showToast);

    // Enviar notificação do navegador se permitido E se showToast for true
    if (settings.browserNotifications && showToast) {
      sendNotification({
        title,
        body: message,
        icon: '/logo.png',
        tag: 'signal',
        requireInteraction: true,
        actions: [
          {
            action: 'open_broker',
            title: 'Abrir Corretora'
          }
        ]
      });
    }
  };
  
  // Função para mostrar notificação prévia de sinal
  const showSignalPreview = (signal: TradingSignal) => {
    const signalTime = new Date(signal.timestamp);
    const actionText = signal.signal === 'BUY' ? t('signals.buy') : t('signals.sell');
    
    // Toast removido conforme solicitado
    
    // Também envia uma notificação do navegador
    if (settings.browserNotifications && isNotificationPermissionGranted()) {
      new Notification(t('signals.notification'), {
        body: `${signal.symbol} - ${actionText} - ${t('signals.minutes_before')}`,
        icon: '/favicon.ico',
        tag: `signal-${signal.id || signal.timestamp}`
      });
    }
  };

  // Função para adicionar notificação prévia de sinal (5 minutos antes)
  // ✅ Usar useCallback para estabilizar a função e evitar reconfigurações desnecessárias
  const addPreSignalNotification = useCallback((signal: TradingSignal) => {
    const actionText = signal.signal === 'BUY' ? 'COMPRA' : 'VENDA';
    const directionEmoji = signal.signal === 'BUY' ? '📈' : '📉';
    const signalTime = signal.entry_time || new Date(signal.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const symbolName = signal.symbol || signal.pair || "Ativo";
    
    // Calcular informações adicionais do sinal
    const successRate = signal.success_rate ? (signal.success_rate * 100).toFixed(1) + '%' : 'Alta';
    
    addNotification({
      type: 'signals',
      title: `${directionEmoji} Sinal de ${actionText} em 5 minutos!`,
      message: `${symbolName} às ${signalTime} - Expectativa: ${successRate}`,
      createdAt: new Date(),
      timestamp: new Date(),
      actionLink: 'https://trade.avalonbroker.io/register?aff=385853&aff_model=revenue&afftrack=mesnagensfree',
      data: {
        type: 'pre-signal',
        pair: symbolName,
        direction: signal.signal,
        entry_time: signalTime,
        success_rate: successRate
      }
    }, false); // false para não mostrar toast (já mostrado pelo serviço)
  }, [addNotification]);

  // ✅ Inicializar o serviço de notificação prévia de sinais (APÓS definir addPreSignalNotification)
  useEffect(() => {
    // ✅ Configurar callback ANTES de iniciar o serviço
    preSignalNotificationService.setNotificationCallback(addPreSignalNotification);
    
    // Iniciar o serviço de notificações prévias de sinais
    preSignalNotificationService.start();
    
    // Cleanup function - parar o serviço quando o componente for desmontado
    return () => {
      preSignalNotificationService.stop();
      preSignalNotificationService.setNotificationCallback(() => {});
    };
  }, [addPreSignalNotification]);
  
  // Marcar uma notificação como lida
  const markAsRead = async (id: string) => {
    // Atualizar estado local imediatamente (UI responsiva)
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
    
    // Atualizar no banco de dados em background
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        await userNotificationDB.markAsRead(id);
      }
    } catch (error) {
      console.error('❌ Erro ao marcar notificação como lida no banco:', error);
    }
  };
  
  // Marcar todas as notificações como lidas
  const markAllAsRead = async () => {
    // Atualizar estado local imediatamente
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
    
    // Atualizar no banco de dados em background
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        await userNotificationDB.markAllAsRead();
      }
    } catch (error) {
      console.error('❌ Erro ao marcar todas como lidas no banco:', error);
    }
  };
  
  // Limpar todas as notificações
  const clearNotifications = async () => {
    // Limpar estado local imediatamente
    setNotifications([]);
    
    // Limpar no banco de dados em background
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        await userNotificationDB.deleteAllNotifications();
      }
    } catch (error) {
      console.error('❌ Erro ao deletar notificações do banco:', error);
    }
  };
  
  // Remover uma notificação específica
  const removeNotification = async (id: string) => {
    // Remover do estado local imediatamente
    setNotifications(prev =>
      prev.filter(notif => notif.id !== id)
    );
    
    // Remover do banco de dados em background
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        await userNotificationDB.deleteNotification(id);
      }
    } catch (error) {
      console.error('❌ Erro ao remover notificação do banco:', error);
    }
  };
  
  // Função para enviar uma notificação de teste
  const testNotification = () => {
    addNotification({
      title: 'Notificação de Teste',
      message: 'Esta é uma notificação de teste. Seus sistemas de notificação estão funcionando corretamente.',
      type: 'system',
      image: '/logo.png',
      linkTo: '/settings/notifications',
      createdAt: new Date(),
      timestamp: new Date()
    });
  };
  
  // Enviar notificação específica para transmissão ao vivo
  const sendLiveNotification = (stream: {
    id: string;
    title: string;
    streamerName: string;
    streamerAvatar: string;
  }) => {
    addNotification({
      type: 'live',
      title: `${stream.streamerName} está ao vivo agora!`,
      message: `"${stream.title}" começou agora. Clique para assistir.`,
      linkTo: `/live/${stream.id}`,
      image: stream.streamerAvatar,
      createdAt: new Date(),
      timestamp: new Date()
    });
  };
  
  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        settings,
        notificationsEnabled: settings.enabled,
        browserNotificationsEnabled: settings.browserNotifications,
        appNotificationsEnabled: settings.appNotifications,
        updateSettings,
        addNotification,
        addSignalNotification,
        addPreSignalNotification,
        showSignalPreview,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        clearAllNotifications: clearNotifications,
        removeNotification,
        testNotification,
        requestPermission,
        hasPermission,
        sendLiveNotification
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}; 