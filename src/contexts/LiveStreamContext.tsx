import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseClient = supabase as any;

type PeerConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'failed';

// Interfaces
export interface StreamPermission {
  id: string;
  userId: string;
  canCreate: boolean;
  canModerate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LiveStream {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  thumbnail?: string | null;
  meetingUrl: string | null;
  streamKey: string;
  streamUrl: string | null;
  status: 'scheduled' | 'live' | 'ended' | 'deleted';
  scheduledStart: string | null;
  startedAt: string | null;
  endedAt: string | null;
  userId: string;
  streamerId?: string;
  streamerName?: string;
  streamerAvatar?: string;
  viewerCount: number;
  tags: string[];
  language: string;
  category: string | null;
  level: string | null;
  webcamEnabled: boolean;
  screenShareEnabled: boolean;
  streamSettings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface StreamComment {
  id: string;
  streamId: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    user_metadata: {
      full_name?: string;
      avatar_url?: string;
    };
  };
}


// Tipo para o contexto
export interface LiveStreamContextType {
  streams: LiveStream[];
  activeStream: LiveStream | null;
  userPermissions: StreamPermission | null;
  comments: StreamComment[];
  isLoadingStreams: boolean;
  isLoadingComments: boolean;
  isLoadingActiveStream: boolean;
  isProcessingAction: boolean;
  error: string | null;
  fetchStreams: () => Promise<LiveStream[]>;
  fetchStreamById: (streamId: string) => Promise<LiveStream | null>;
  createStream: (streamData: Partial<LiveStream>) => Promise<LiveStream | null>;
  updateStream: (streamId: string, updateData: Partial<LiveStream>) => Promise<boolean>;
  deleteStream: (streamId: string) => Promise<boolean>;
  startStream: (streamId: string) => Promise<boolean>;
  endStream: (streamId: string) => Promise<boolean>;
  fetchComments: (streamId: string) => Promise<void>;
  addComment: (streamId: string, content: string) => Promise<boolean>;
  deleteComment: (commentId: string, streamId: string) => Promise<boolean>;
  canModerate: (streamId: string) => Promise<boolean>;
  generateStreamKey: () => string;
  checkUserPermissions: () => Promise<StreamPermission | null>;
  hasStreamingPermission: boolean;
  initializeWebRTC: (streamId: string, requestMedia: boolean) => Promise<boolean>;
  stopWebRTC: () => Promise<boolean>;
  updatePublisherStream: (newStream: MediaStream) => Promise<boolean>;
  getPeerId: () => string | null;
  getConnectionStatus: () => PeerConnectionStatus | null;
  initializePeerViewer: (streamId: string, videoElement: HTMLVideoElement) => Promise<boolean>;
  stopPeerViewer: (streamId?: string) => Promise<boolean>;
  verificarTabelas: () => Promise<{success: boolean, error?: string}>;
}

// Criando o contexto
const LiveStreamContext = createContext<LiveStreamContextType | undefined>(undefined);

// Provider function
export function LiveStreamProvider({ children }: { children: ReactNode }) {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [activeStream, setActiveStream] = useState<LiveStream | null>(null);
  const [comments, setComments] = useState<StreamComment[]>([]);
  const [userPermissions, setUserPermissions] = useState<StreamPermission | null>(null);
  const [isLoadingStreams, setIsLoadingStreams] = useState<boolean>(false);
  const [isLoadingComments, setIsLoadingComments] = useState<boolean>(false);
  const [isLoadingActiveStream, setIsLoadingActiveStream] = useState<boolean>(false);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasStreamingPermission, setHasStreamingPermission] = useState<boolean>(false);

  // Gerar um ID de instância único para este componente
  const instanceIdRef = React.useRef<string>(`instance-${Math.random().toString(36).substring(2, 9)}`);
  
  // Usar uma referência para o canal para evitar múltiplas inscrições
  const channelRef = React.useRef<RealtimeChannel | null>(null);

  const { user, isAdmin: isAuthAdmin } = useAuth();
  const { addNotification } = useNotifications();
  
  const userRef = React.useRef(user);
  React.useEffect(() => { userRef.current = user; }, [user]);

  const fetchStreams = async () => {
    const currentUser = userRef.current || user;
    if (!currentUser) return [];
    
    setIsLoadingStreams(true);
    setError(null);
    
    try {
      const { data, error } = await supabaseClient
        .from('live_streams')
        .select('*')
        .in('status', ['live', 'scheduled'])
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      // Buscar profiles em batch
      const userIds = [...new Set(data.map((s: Record<string, unknown>) => s.user_id as string))];
      const profileMap: Record<string, { display_name: string; avatar_url: string }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabaseClient
          .from('user_profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);
        if (profiles) {
          for (const p of profiles) {
            profileMap[p.user_id] = p;
          }
        }
      }

      // Limpeza de streams fantasma (a cada 2 min)
      const now = new Date();
      const lastCleanupKey = 'lastStreamCleanup';
      const lastCleanup = sessionStorage.getItem(lastCleanupKey);
      if (!lastCleanup || (now.getTime() - parseInt(lastCleanup)) > 120000) {
        const ghostStreams = data.filter((stream: Record<string, unknown>) => {
          if (stream.status !== 'live') return false;
          const lastUpdate = new Date(stream.updated_at as string);
          return (now.getTime() - lastUpdate.getTime()) / 60000 > 5;
        });
        
        if (ghostStreams.length > 0) {
          const ghostIds = ghostStreams.map((s: Record<string, unknown>) => s.id);
          await supabaseClient
            .from('live_streams')
            .update({ status: 'ended', ended_at: now.toISOString() })
            .in('id', ghostIds);
          data.forEach((stream: Record<string, unknown>) => {
            if (ghostIds.includes(stream.id)) {
              stream.status = 'ended';
              stream.ended_at = now.toISOString();
            }
          });
        }
        sessionStorage.setItem(lastCleanupKey, now.getTime().toString());
      }
      
      const formattedStreams = data.map((item: Record<string, unknown>) => {
        const profile = profileMap[item.user_id as string] || {};
        const settings = (item.settings || {}) as Record<string, unknown>;
        return {
          id: item.id,
          title: item.title,
          description: item.description,
          thumbnailUrl: item.thumbnail_url,
          thumbnail: item.thumbnail_url,
          meetingUrl: item.meeting_url || null,
          streamKey: item.stream_key,
          streamUrl: item.stream_url,
          status: item.status,
          scheduledStart: item.scheduled_for,
          startedAt: item.started_at,
          endedAt: item.ended_at,
          userId: item.user_id,
          streamerId: item.user_id,
          streamerName: (profile as Record<string, unknown>).display_name || 'Usuário',
          streamerAvatar: (profile as Record<string, unknown>).avatar_url || '',
          viewerCount: (item.viewers_count as number) || 0,
          tags: (item.tags as string[]) || [],
          language: item.language || 'pt',
          category: item.category,
          level: null,
          webcamEnabled: settings.webcam_enabled || true,
          screenShareEnabled: settings.screen_share_enabled || false,
          streamSettings: settings,
          createdAt: item.created_at,
          updatedAt: item.updated_at
        };
      }) as LiveStream[];
      
      setStreams(formattedStreams);
      return formattedStreams;
    } catch (err: unknown) {
      setError('Não foi possível buscar as transmissões');
      return [];
    } finally {
      setIsLoadingStreams(false);
    }
  };

  // Função para buscar uma transmissão pelo ID
  const fetchStreamById = async (streamId: string): Promise<LiveStream | null> => {
    setIsLoadingActiveStream(true);
    setError(null);
    
    try {
      const { data, error } = await supabaseClient
        .from('live_streams')
        .select('*')
        .eq('id', streamId)
        .single();
      
      if (error) throw error;
      
      const { data: userProfile } = await supabaseClient
        .from('user_profiles')
        .select('display_name, avatar_url')
        .eq('user_id', data.user_id)
        .maybeSingle();
      
      const formattedStream = {
        id: data.id,
        title: data.title,
        description: data.description,
        thumbnailUrl: data.thumbnail_url,
        thumbnail: data.thumbnail_url,
        meetingUrl: data.meeting_url || null,
        streamKey: data.stream_key,
        streamUrl: data.stream_url,
        status: data.status,
        scheduledStart: data.scheduled_for,
        startedAt: data.started_at,
        endedAt: data.ended_at,
        userId: data.user_id,
        streamerId: data.user_id,
        streamerName: userProfile?.display_name || 'Usuário',
        streamerAvatar: userProfile?.avatar_url || '',
        viewerCount: data.viewers_count || 0,
        tags: data.tags || [],
        language: data.language || 'pt',
        category: data.category,
        level: null,
        webcamEnabled: data.settings?.webcam_enabled || true,
        screenShareEnabled: data.settings?.screen_share_enabled || false,
        streamSettings: data.settings || {},
        createdAt: data.created_at,
        updatedAt: data.updated_at
      } as LiveStream;
      
      setActiveStream(formattedStream);
      return formattedStream;
    } catch (err: unknown) {
      setError('Não foi possível buscar a transmissão');
      return null;
    } finally {
      setIsLoadingActiveStream(false);
    }
  };

  const createStream = async (streamData: Partial<LiveStream>): Promise<LiveStream | null> => {
    if (!user) return null;
    
    setIsProcessingAction(true);
    setError(null);
    
    try {
      let isAuthorized = isAuthAdmin;
      
      if (!isAuthorized) {
        try {
          const { data: permissionData } = await supabaseClient
            .from('stream_permissions')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          if (permissionData?.can_create) isAuthorized = true;
        } catch { /* silenciado */ }
      }
      
      if (!isAuthorized) {
        throw new Error('Você não tem permissão para criar transmissões');
      }

      let username = user.email || 'Usuário';
      let userAvatar = '';
      try {
        const { data: profile } = await supabaseClient
          .from('user_profiles')
          .select('display_name, avatar_url')
          .eq('user_id', user.id)
          .maybeSingle();
        if (profile?.display_name) username = profile.display_name;
        if (profile?.avatar_url) userAvatar = profile.avatar_url;
      } catch { /* silenciado */ }
      
      const streamKey = generateStreamKey();
      
      const insertData: Record<string, unknown> = {
        title: streamData.title || 'Nova transmissão',
        description: streamData.description || '',
        user_id: user.id,
        username: username,
        stream_key: streamKey,
        stream_url: null,
        meeting_url: streamData.meetingUrl || null,
        thumbnail_url: streamData.thumbnailUrl || streamData.thumbnail || null,
        viewers_count: 0,
        scheduled_for: new Date().toISOString(),
        started_at: null,
        ended_at: null,
        status: streamData.meetingUrl ? 'live' : 'scheduled',
        category: streamData.category || null,
        tags: streamData.tags || [],
        language: streamData.language || 'pt',
        settings: {
          chat_enabled: true,
          webcam_enabled: true,
          recording_enabled: false,
          screen_share_enabled: false,
          ...streamData.streamSettings
        }
      };
      
      const { data, error } = await supabaseClient
        .from('live_streams')
        .insert([insertData])
        .select()
        .single();
      
      if (error) throw new Error(`Erro ao criar transmissão: ${String(error.message || error)}`);
      if (!data) throw new Error('Nenhum dado retornado após criação');
      
      const newStream: LiveStream = {
        id: data.id,
        title: data.title,
        description: data.description,
        thumbnailUrl: data.thumbnail_url,
        thumbnail: data.thumbnail_url,
        meetingUrl: data.meeting_url || null,
        streamKey: data.stream_key,
        streamUrl: data.stream_url,
        status: data.status,
        scheduledStart: data.scheduled_for,
        startedAt: data.started_at,
        endedAt: data.ended_at,
        userId: data.user_id,
        streamerId: data.user_id,
        streamerName: username,
        streamerAvatar: userAvatar,
        viewerCount: data.viewers_count || 0,
        tags: data.tags || [],
        language: data.language || 'pt',
        category: data.category,
        level: null,
        webcamEnabled: data.settings?.webcam_enabled || true,
        screenShareEnabled: data.settings?.screen_share_enabled || false,
        streamSettings: data.settings || {},
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
      
      setStreams(prev => [newStream, ...prev]);
      return newStream;
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao criar transmissão';
      setError(errorMessage);
      addNotification({
        type: 'error',
        title: 'Erro ao criar transmissão',
        message: errorMessage,
        timestamp: new Date()
      });
      return null;
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Função para atualizar uma transmissão
  const updateStream = async (streamId: string, updateData: Partial<LiveStream>): Promise<boolean> => {
    if (!user) return false;
    
    setIsProcessingAction(true);
    setError(null);
    
    try {
      // Admins podem atualizar qualquer transmissão; demais usuários só a própria
      if (!isAuthAdmin) {
        const { data: stream, error: fetchError } = await supabaseClient
          .from('live_streams')
          .select('user_id')
          .eq('id', streamId)
          .single();
        
        if (fetchError) throw fetchError;
        
        if (!stream) {
          throw new Error('Transmissão não encontrada');
        }
        
        if (stream.user_id !== user.id) {
          throw new Error('Você não tem permissão para atualizar esta transmissão');
        }
      }
      
      // Converter nomes de campos para o formato do banco de dados
      const dbUpdateData: Record<string, unknown> = {};
      if (updateData.thumbnailUrl !== undefined) dbUpdateData.thumbnail_url = updateData.thumbnailUrl;
      if (updateData.streamKey !== undefined) dbUpdateData.stream_key = updateData.streamKey;
      if (updateData.streamUrl !== undefined) dbUpdateData.stream_url = updateData.streamUrl;
      if (updateData.scheduledStart !== undefined) dbUpdateData.scheduled_start = updateData.scheduledStart;
      if (updateData.startedAt !== undefined) dbUpdateData.started_at = updateData.startedAt;
      if (updateData.endedAt !== undefined) dbUpdateData.ended_at = updateData.endedAt;
      if (updateData.userId !== undefined) dbUpdateData.user_id = updateData.userId;
      if (updateData.viewerCount !== undefined) dbUpdateData.viewer_count = updateData.viewerCount;
      if (updateData.webcamEnabled !== undefined) dbUpdateData.webcam_enabled = updateData.webcamEnabled;
      if (updateData.screenShareEnabled !== undefined) dbUpdateData.screen_share_enabled = updateData.screenShareEnabled;
      if (updateData.streamSettings !== undefined) dbUpdateData.stream_settings = updateData.streamSettings;
      if (updateData.createdAt !== undefined) dbUpdateData.created_at = updateData.createdAt;
      if (updateData.updatedAt !== undefined) dbUpdateData.updated_at = updateData.updatedAt;
      if (updateData.meetingUrl !== undefined) dbUpdateData.meeting_url = updateData.meetingUrl;
      
      if (updateData.title !== undefined) dbUpdateData.title = updateData.title;
      if (updateData.description !== undefined) dbUpdateData.description = updateData.description;
      if (updateData.status !== undefined) dbUpdateData.status = updateData.status;
      if (updateData.tags !== undefined) dbUpdateData.tags = updateData.tags;
      if (updateData.language !== undefined) dbUpdateData.language = updateData.language;
      if (updateData.category !== undefined) dbUpdateData.category = updateData.category;
      if (updateData.level !== undefined) dbUpdateData.level = updateData.level;

      const { data, error } = await supabaseClient
        .from('live_streams')
        .update(dbUpdateData)
        .eq('id', streamId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Atualizar o estado local
      setStreams(prev => prev.map(stream => 
        stream.id === streamId ? { ...stream, ...data } as LiveStream : stream
      ));
      
      if (activeStream?.id === streamId) {
        setActiveStream({ ...activeStream, ...data } as LiveStream);
      }
      
      addNotification({
        type: 'success',
        title: 'Transmissão atualizada',
        message: 'Sua transmissão foi atualizada com sucesso!',
        timestamp: new Date()
      });
      
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      addNotification({
        type: 'error',
        title: 'Erro ao atualizar transmissão',
        message: err instanceof Error ? err.message : String(err),
        timestamp: new Date()
      });
      return false;
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Função para excluir uma transmissão
  const deleteStream = async (streamId: string): Promise<boolean> => {
    if (!user) return false;
    
    setIsProcessingAction(true);
    setError(null);
    
    try {
      // Admins podem excluir qualquer transmissão; demais usuários só a própria
      if (!isAuthAdmin) {
        const { data: stream, error: fetchError } = await supabaseClient
          .from('live_streams')
          .select('user_id')
          .eq('id', streamId)
          .single();
        
        if (fetchError) throw fetchError;
        
        if (!stream) {
          throw new Error('Transmissão não encontrada');
        }
        
        if (stream.user_id !== user.id) {
          throw new Error('Você não tem permissão para excluir esta transmissão');
        }
      }
      
      const { error } = await supabaseClient
        .from('live_streams')
        .delete()
        .eq('id', streamId);
      
      if (error) throw error;
      
      // Atualizar o estado local
      setStreams(prev => prev.filter(stream => stream.id !== streamId));
      
      if (activeStream?.id === streamId) {
        setActiveStream(null);
      }
      
      addNotification({
        type: 'success',
        title: 'Transmissão excluída',
        message: 'Sua transmissão foi excluída com sucesso!',
        timestamp: new Date()
      });
      
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      addNotification({
        type: 'error',
        title: 'Erro ao excluir transmissão',
        message: err instanceof Error ? err.message : String(err),
        timestamp: new Date()
      });
      return false;
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Função para buscar comentários de uma transmissão
  const fetchComments = async (streamId: string): Promise<void> => {
    setIsLoadingComments(true);
    setError(null);
    
    try {
      
      
      // Usar uma query simplificada sem joins para evitar erros 400
      const { data, error } = await supabaseClient
        .from('stream_comments')
        .select('*')
        .eq('stream_id', streamId)
        .order('created_at', { ascending: true });
      
      if (error) {
        throw error;
      }
      
      // Se dados foram recebidos com sucesso, buscar informações de usuário separadamente
      if (data && data.length > 0) {
        
        
        // Preparar array formatado de comentários
        const formattedComments: StreamComment[] = [];
        
        for (const comment of data) {
          try {
            // Buscar dados do usuário para cada comentário
            const { data: userData } = await supabaseClient
              .from('user_profiles')
              .select('*')
              .eq('user_id', comment.user_id)
              .maybeSingle();
            
            formattedComments.push({
              ...comment,
              // Garantir que createdAt seja uma string de data ISO válida
              createdAt: comment.created_at ? new Date(comment.created_at).toISOString() : new Date().toISOString(),
              user: {
                id: comment.user_id,
                email: userData?.email || '',
                user_metadata: {
                  full_name: userData?.display_name || 'Usuário',
                  avatar_url: userData?.avatar_url || `https://ui-avatars.com/api/?name=${userData?.display_name?.charAt(0) || 'U'}`
                }
              }
            });
          } catch (userErr) {
            // Se falhar ao buscar dados do usuário, adicionar o comentário com dados básicos
            formattedComments.push({
              ...comment,
              // Garantir que createdAt seja uma string de data ISO válida
              createdAt: comment.created_at ? new Date(comment.created_at).toISOString() : new Date().toISOString(),
              user: {
                id: comment.user_id,
                email: '',
                user_metadata: {
                  full_name: 'Usuário',
                  avatar_url: `https://ui-avatars.com/api/?name=U`
                }
              }
            });
          }
        }
        
        setComments(formattedComments);
        
      } else {
        setComments([]);
        
      }
      
      // Configurar escuta em tempo real para novos comentários
      setupRealtimeComments(streamId);
      
    } catch (err: unknown) {
      console.error('❌ [LiveStream] Erro ao buscar comentários:', err);
      setError('Não foi possível buscar os comentários da transmissão');
      setComments([]);
    } finally {
      setIsLoadingComments(false);
    }
  };

  // Configurar escuta em tempo real para comentários
  const setupRealtimeComments = (streamId: string) => {
    // Limpar canal anterior se existir
    if (channelRef.current) {
      
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    
    
    
    // Criar novo canal para escuta de comentários em tempo real
    const channel = supabaseClient
      .channel(`stream-comments-${streamId}-${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_comments',
          filter: `stream_id=eq.${streamId}`
        },
        async (payload) => {
          
          
          try {
            const newCommentData = payload.new;
            
            // Buscar dados do usuário que fez o comentário
            const { data: userData } = await supabaseClient
              .from('user_profiles')
              .select('*')
              .eq('user_id', newCommentData.user_id)
              .maybeSingle();
            
            // Criar objeto de comentário formatado
            const newComment: StreamComment = {
              ...newCommentData,
              createdAt: newCommentData.created_at ? new Date(newCommentData.created_at).toISOString() : new Date().toISOString(),
              user: {
                id: newCommentData.user_id,
                email: userData?.email || '',
                user_metadata: {
                  full_name: userData?.display_name || 'Usuário',
                  avatar_url: userData?.avatar_url || `https://ui-avatars.com/api/?name=${userData?.display_name?.charAt(0) || 'U'}`
                }
              }
            };
            
            // Adicionar novo comentário ao estado
            setComments(prev => {
              // Verificar se o comentário já existe para evitar duplicatas
              const exists = prev.find(comment => comment.id === newComment.id);
              if (exists) {
                
                return prev;
              }
              
              
              return [...prev, newComment];
            });
            
            // Notificação visual opcional
            addNotification({
              type: 'info',
              title: 'Novo comentário',
              message: `${userData?.display_name || 'Usuário'}: ${newCommentData.content.substring(0, 50)}${newCommentData.content.length > 50 ? '...' : ''}`,
              timestamp: new Date()
            });
            
          } catch { /* silenciado */ }
        }
      )
      .subscribe((status) => {
        
        if (status === 'SUBSCRIBED') {
          // Canal inscrito com sucesso
        }
      });
    
    // Armazenar referência do canal
    channelRef.current = channel;
  };

  // Limpar escuta de comentários
  const cleanupRealtimeComments = () => {
    if (channelRef.current) {
      
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
  };

  // Limpar escuta ao desmontar o componente
  useEffect(() => {
    return () => {
      cleanupRealtimeComments();
    };
  }, []);

  // Função para adicionar um comentário
  const addComment = async (streamId: string, content: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const commentData = {
        stream_id: streamId,
        user_id: user.id,
        content: content,
        created_at: new Date().toISOString()
      };
      
      const { data, error } = await supabaseClient
        .from('stream_comments')
        .insert([commentData])
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Buscar informações do usuário para incluir no comentário
      const { data: userData, error: userError } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      // Criar objeto comentário completo
      const newComment: StreamComment = {
        ...data,
        // Garantir que createdAt seja uma string de data ISO válida
        createdAt: data.created_at ? new Date(data.created_at).toISOString() : new Date().toISOString(),
        user: {
          id: user.id,
          email: user.email || '',
          user_metadata: {
              full_name: userData?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
            avatar_url: userData?.avatar_url || user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user.email?.charAt(0) || 'U'}`
          }
        }
      };
      
      // Atualizar o estado
      setComments(prev => [...prev, newComment]);
      
      return true;
    } catch (err: unknown) {
      console.error('Erro ao adicionar comentário:', err);
      setError(err instanceof Error ? err.message : String(err));
      addNotification({
        type: 'error',
        title: 'Erro ao adicionar comentário',
        message: err instanceof Error ? err.message : String(err),
        timestamp: new Date()
      });
      return false;
    }
  };

  // Função para deletar comentário (streamer ou moderador)
  const deleteComment = async (commentId: string, streamId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Verificar se o usuário pode moderar
      const canMod = await canModerate(streamId);
      if (!canMod) {
        return false;
      }

      const { error } = await supabaseClient
        .from('stream_comments')
        .delete()
        .eq('id', commentId);
      
      if (error) {
        throw error;
      }
      
      // Remover do estado local
      setComments(prev => prev.filter(c => c.id !== commentId));
      
      return true;
    } catch (err: unknown) {
      console.error('Erro ao deletar comentário:', err);
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  // Função para verificar se o usuário pode moderar uma stream
  const canModerate = async (streamId: string): Promise<boolean> => {
    if (!user) return false;
    if (!streamId || streamId === 'undefined') {
      return false;
    }
    
    try {
      // Buscar informações da stream
      const { data: streamData, error: streamError } = await supabaseClient
        .from('live_streams')
        .select('user_id')
        .eq('id', streamId)
        .single();
      
      if (streamError || !streamData) {
        return false;
      }
      
      // É o próprio streamer?
      if (streamData.user_id === user.id) {
        return true;
      }
      
      // É moderador deste streamer?
      const { data: modData, error: modError } = await supabaseClient
        .from('streamer_moderators')
        .select('id')
        .eq('streamer_id', streamData.user_id)
        .eq('moderator_id', user.id)
        .eq('is_active', true)
        .single();
      
      if (modError) {
        // Pode ser que não seja moderador (erro esperado)
        return false;
      }
      
      return !!modData;
    } catch {
      return false;
    }
  };

  // Função para gerar uma chave de stream única
  const generateStreamKey = (): string => {
    return `${user?.id}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  };

  // Função para verificar as permissões do usuário
  const checkUserPermissions = async (): Promise<StreamPermission | null> => {
    if (!user) return null;
    
    try {
      // Administradores (is_admin=true no banco) têm permissão automática
      if (isAuthAdmin) {
        const autoPermission: StreamPermission = {
          id: `auto-${user.id}`,
          userId: user.id,
          canCreate: true,
          canModerate: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        setUserPermissions(autoPermission);
        setHasStreamingPermission(true);
        return autoPermission;
      }
      
      // Verificar na tabela stream_permissions
      const { data: permissionData, error: permissionError } = await supabaseClient
        .from('stream_permissions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (permissionError) {
        setUserPermissions(null);
        setHasStreamingPermission(false);
        return null;
      } 
      
      if (permissionData && permissionData.can_create) {
        // Criar objeto de permissão baseado nos dados do banco
        const dbPermission: StreamPermission = {
          id: permissionData.id,
          userId: permissionData.user_id,
          canCreate: permissionData.can_create,
          canModerate: permissionData.can_moderate || false,
          createdAt: permissionData.created_at,
          updatedAt: permissionData.updated_at
        };
        
        setUserPermissions(dbPermission);
        setHasStreamingPermission(true);
        return dbPermission;
      }
      
      // Para usuários não autorizados
      setUserPermissions(null);
      setHasStreamingPermission(false);
      return null;
      
    } catch {
      setUserPermissions(null);
      setHasStreamingPermission(false);
      return null;
    }
  };

  // Verificar se o usuário tem uma permissão específica para uma transmissão
  const hasPermission = (streamId: string): boolean => {
    if (!user || !userPermissions) return false;
    
    // Se o usuário é o criador da transmissão, ele tem todas as permissões
    if (activeStream && activeStream.userId === user.id) {
      return true;
    }
    
    // Verificar nas permissões do usuário
    return userPermissions.canModerate;
  };

  // Verificar permissões do usuário ao carregar
  useEffect(() => {
    if (user) {
      checkUserPermissions();
    } else {
      setUserPermissions(null);
      setHasStreamingPermission(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // checkUserPermissions não pode ser incluída para evitar loop infinito

  // Configurar listeners em tempo real
  useEffect(() => {
    if (!user) return;
    
    // Verificar permissões do usuário
    checkUserPermissions();
    
    // Carregar transmissões iniciais
    fetchStreams();
    
    // Criar uma única instância do canal para toda a vida útil do componente
    // Usar o ID da instância para garantir um nome único para o canal
    const channelName = `streams-changes-${user.id}-${instanceIdRef.current}`;
    
    // Criar um novo canal
    const channel = supabaseClient.channel(channelName);
    
    // Configurar o canal com os listeners necessários
    channel.on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'live_streams' 
    }, (payload) => {
      if (payload.eventType === 'INSERT') {
        setStreams(prev => [payload.new as LiveStream, ...prev]);
      } else if (payload.eventType === 'UPDATE') {
        setStreams(prev => prev.map(stream => 
          stream.id === payload.new.id ? { ...stream, ...payload.new } as LiveStream : stream
        ));
        
        if (activeStream?.id === payload.new.id) {
          setActiveStream({ ...activeStream, ...payload.new } as LiveStream);
        }
      } else if (payload.eventType === 'DELETE') {
        setStreams(prev => prev.filter(stream => stream.id !== payload.old.id));
        
        if (activeStream?.id === payload.old.id) {
          setActiveStream(null);
        }
      }
    });
    
    // Armazenar o canal na referência para limpeza posterior
    channelRef.current = channel;
    
    // Inscrever-se no canal uma única vez
    try {
      channel.subscribe((status) => {
        // Status da inscrição (silenciado)
      });
    } catch { /* silenciado */ }
    
    // Função de limpeza - executada quando o componente é desmontado
    return () => {
      // Capturar o instanceId atual para o cleanup
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const currentInstanceId = instanceIdRef.current;
      // Cancelar a inscrição e remover o canal
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Dependência apenas no ID do usuário para evitar recriações desnecessárias. activeStream, checkUserPermissions, fetchStreams não incluídos para evitar loops

  // Limpeza quando o usuário sai
  useEffect(() => {
    if (!user) {
      setStreams([]);
      setActiveStream(null);
      setComments([]);
      setUserPermissions(null);
    }
  }, [user]);

  // ─── WebRTC / LiveKit stubs ───────────────────────────────────────────────
  // O vídeo real é gerenciado pelo LiveKitContext em cada página.
  // Estas funções fazem apenas operações de banco (tracking de viewers).

  const initializeWebRTC = async (_streamId: string, _requestMedia: boolean = true): Promise<boolean> => {
    return true;
  };

  const stopWebRTC = async (): Promise<boolean> => {
    return true;
  };

  const updatePublisherStream = async (_newStream: MediaStream): Promise<boolean> => {
    return true;
  };

  const getPeerId = (): string | null => null;

  const getConnectionStatus = (): PeerConnectionStatus | null => null;

  const initializePeerViewer = async (streamId: string, _videoElement: HTMLVideoElement): Promise<boolean> => {
    if (!user) return false;
    const sessionId = `${user.id}-${Date.now()}`;
    try {
      await supabaseClient.rpc('join_stream_viewer', {
        p_stream_id: streamId,
        p_user_id: user.id,
        p_session_id: sessionId,
      });
    } catch { /* silenciado */ }
    return true;
  };

  const stopPeerViewer = async (streamId?: string): Promise<boolean> => {
    if (!user || !streamId) return true;
    try {
      await supabaseClient.rpc('leave_stream_viewer', {
        p_stream_id: streamId,
        p_user_id: user.id,
      });
    } catch { /* silenciado */ }
    return true;
  };

  const verificarTabelas = async (): Promise<{ success: boolean; error?: string }> => {
    return { success: true };
  };
  // ─────────────────────────────────────────────────────────────────────────

  // Função para iniciar uma transmissão
  const startStream = async (streamId: string): Promise<boolean> => {
    if (!user) return false;
    
    setIsProcessingAction(true);
    setError(null);
    
    try {
      // Buscar informações da transmissão
      const stream = await fetchStreamById(streamId);
      
      if (!stream) {
        throw new Error('Transmissão não encontrada');
      }
      
      // Verificar se o usuário é o dono da transmissão
      if (stream.userId !== user.id) {
        throw new Error('Você não tem permissão para iniciar esta transmissão');
      }
      
      // Atualizar status da transmissão para 'live'
      const { error } = await supabaseClient
        .from('live_streams')
        .update({
          status: 'live',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', streamId);
      
      if (error) {
        throw error;
      }
      
      // Atualizar cache local
      setStreams(prev => prev.map(s => {
        if (s.id === streamId) {
          return { ...s, status: 'live', startedAt: new Date().toISOString() };
        }
        return s;
      }));
      
      if (activeStream?.id === streamId) {
        setActiveStream(prev => prev ? { ...prev, status: 'live', startedAt: new Date().toISOString() } : null);
      }
      
      // Notificar o usuário - REMOVIDO
      // addNotification({
      //   title: 'Transmissão iniciada',
      //   message: 'Sua transmissão ao vivo foi iniciada com sucesso.',
      //   type: 'success',
      //   timestamp: new Date()
      // });
      
      return true;
    } catch (err: unknown) {
      console.error('Erro ao iniciar transmissão:', err);
      setError((err instanceof Error ? err.message : String(err)) || 'Erro ao iniciar transmissão');
      
      addNotification({
        title: 'Erro',
        message: err instanceof Error ? err.message : String(err) || 'Ocorreu um erro ao iniciar a transmissão.',
        type: 'error',
        timestamp: new Date()
      });
      
      return false;
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Função para encerrar uma transmissão
  const endStream = async (streamId: string): Promise<boolean> => {
    if (!user) return false;
    
    setIsProcessingAction(true);
    setError(null);
    
    try {
      // Buscar informações da transmissão
      const stream = await fetchStreamById(streamId);
      
      if (!stream) {
        throw new Error('Transmissão não encontrada');
      }
      
      // Verificar se o usuário é o dono da transmissão
      if (stream.userId !== user.id) {
        throw new Error('Você não tem permissão para encerrar esta transmissão');
      }
      
      // Atualizar status da transmissão para 'ended'
      const { error } = await supabaseClient
        .from('live_streams')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('id', streamId);
      
      if (error) {
        throw error;
      }
      
      // Atualizar cache local
      setStreams(prev => prev.map(s => {
        if (s.id === streamId) {
          return { ...s, status: 'ended', endedAt: new Date().toISOString() };
        }
        return s;
      }));
      
      if (activeStream?.id === streamId) {
        setActiveStream(prev => prev ? { ...prev, status: 'ended', endedAt: new Date().toISOString() } : null);
      }
      
      // Notificar o usuário - REMOVIDO
      // addNotification({
      //   title: 'Transmissão encerrada',
      //   message: 'Sua transmissão ao vivo foi encerrada com sucesso.',
      //   type: 'success',
      //   timestamp: new Date()
      // });
      
      return true;
    } catch (err: unknown) {
      console.error('Erro ao encerrar transmissão:', err);
      setError((err instanceof Error ? err.message : String(err)) || 'Erro ao encerrar transmissão');
      
      addNotification({
        title: 'Erro',
        message: err instanceof Error ? err.message : String(err) || 'Ocorreu um erro ao encerrar a transmissão.',
        type: 'error',
        timestamp: new Date()
      });
      
      return false;
    } finally {
      setIsProcessingAction(false);
    }
  };

  // (implementações dos stubs estão acima, antes do startStream)

  const value: LiveStreamContextType = {
    streams,
    activeStream,
    userPermissions,
    comments,
    isLoadingStreams,
    isLoadingComments,
    isLoadingActiveStream,
    isProcessingAction,
    error,
    fetchStreams,
    fetchStreamById,
    createStream,
    updateStream,
    deleteStream,
    startStream,
    endStream,
    fetchComments,
    addComment,
    deleteComment,
    canModerate,
    generateStreamKey,
    checkUserPermissions,
    hasStreamingPermission,
    initializeWebRTC,
    stopWebRTC,
    updatePublisherStream,
    getPeerId,
    getConnectionStatus,
    initializePeerViewer,
    stopPeerViewer,
    verificarTabelas
  };

  return (
    <LiveStreamContext.Provider value={value}>
      {children}
    </LiveStreamContext.Provider>
  );
}

// Hook personalizado para usar o contexto
// eslint-disable-next-line react-refresh/only-export-components
export const useLiveStream = () => {
  const context = useContext(LiveStreamContext);
  
  if (context === undefined) {
    throw new Error('useLiveStream deve ser usado dentro de um LiveStreamProvider');
  }
  
  return context;
}; 