import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from "@/contexts/AuthContext";
import { useLiveStream } from "@/contexts/LiveStreamContext";
import { useLiveKit } from "@/contexts/LiveKitContext";
import { WHIPSender, WHIPStatus } from "@/services/whipService";
import { useNotifications } from "@/contexts/NotificationContext";
import { StreamSettingsPanel } from "@/components/streaming/StreamSettingsPanel";
import { ViewersControlPanel } from "@/components/streaming/ViewersControlPanel";
import { EnhancedMinimalChat } from "@/components/streaming/EnhancedMinimalChat";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import { 
  Video, 
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Users,
  MessageSquare,
  Settings,
  Eye,
  Square,
  Circle,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Camera,
  CameraOff,
  Share,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  MoreVertical,
  Copy,
  ExternalLink,
  Trash2,
  Edit3,
  Move,
  Expand,
  Shrink,
  ChevronDown,
  Headphones,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus
} from "lucide-react";
import { toast } from "sonner";

interface StreamComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  message: string;
  timestamp: Date;
  isStreamer: boolean;
}

interface StreamStats {
  viewerCount: number;
  duration: number;
  peakViewers: number;
  totalMessages: number;
}

interface CameraPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  scale: number;
}

export default function StreamerDashboard() {
  const { streamId } = useParams<{ streamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Debug: Verificar streamId
  useEffect(() => {
    console.log('🔍 [StreamerDashboard] streamId dos params:', streamId);
    if (!streamId || streamId === 'undefined') {
      console.error('❌ [StreamerDashboard] streamId inválido, redirecionando...');
      navigate('/live');
    }
  }, [streamId, navigate]);
  
  const { 
    activeStream, 
    fetchStreamById, 
    updateStream, 
    startStream, 
    endStream,
    comments,
    fetchComments,
    addComment,
    initializeWebRTC,
    stopWebRTC,
    updatePublisherStream,
    getConnectionStatus
  } = useLiveStream();

  const {
    joinRoom: liveKitJoinRoom,
    leaveRoom: liveKitLeaveRoom,
    publishStream: liveKitPublishStream,
    replaceStream: liveKitReplaceStream,
    viewerCount: liveKitViewerCount,
    isConnected: liveKitConnected,
  } = useLiveKit();

  const { addNotification } = useNotifications();
  const supabase = getSupabase();

  // Estados da transmissão
  const [isLive, setIsLive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const whipSenderRef = useRef<WHIPSender | null>(null);
  const [whipStatus, setWhipStatus] = useState<WHIPStatus>('idle');
  const [streamStats, setStreamStats] = useState<StreamStats>({
    viewerCount: 0,
    duration: 0,
    peakViewers: 0,
    totalMessages: 0
  });
  
  // Estados para viewers adicionados (boost)
  const [realViewerCount, setRealViewerCount] = useState(0);
  const [addedViewers, setAddedViewers] = useState(0);
  const [totalViewerCount, setTotalViewerCount] = useState(0);

  // Estados dos controles de mídia
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Estados para seletores de dispositivos
  const [showMicSelector, setShowMicSelector] = useState(false);
  const [showCameraSelector, setShowCameraSelector] = useState(false);
  const [showHeadphoneSelector, setShowHeadphoneSelector] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [selectedHeadphoneId, setSelectedHeadphoneId] = useState<string>('');
  
  // Estados para configurações (movidas da barra superior)
  const [showStreamSettings, setShowStreamSettings] = useState(false);
  const [showCameraControls, setShowCameraControls] = useState(false);

  // Estados do chat
  const [chatMessage, setChatMessage] = useState('');
  const [chatVisible, setChatVisible] = useState(true);
  const [streamComments, setStreamComments] = useState<StreamComment[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // Sistema anti-spam: Mapeia userId -> { lastMessage: string, timestamp: number }
  const [userLastMessages, setUserLastMessages] = useState<Record<string, { message: string; timestamp: number }>>({});
  
  // Sistema de bloqueio: Lista de IDs de usuários bloqueados
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  
  // Estados para controle do chat pausado
  const [isChatPaused, setIsChatPaused] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Estado para controle da mensagem anti-spam
  const [antiSpamMessage, setAntiSpamMessage] = useState<string | null>(null);
  
  // Estado para evitar duplo clique
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  // Estados para controle de tamanho do chat
  const [chatWidth, setChatWidth] = useState(320); // largura padrão em pixels
  const [isResizingChat, setIsResizingChat] = useState(false);
  const [chatResizeStartX, setChatResizeStartX] = useState(0);
  const [chatResizeStartWidth, setChatResizeStartWidth] = useState(0);

  // Estados de configuração
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [streamLanguage, setStreamLanguage] = useState('pt');
  const [streamTags, setStreamTags] = useState('');
  const [chatEnabled, setChatEnabled] = useState(true);
  const [chatDelaySeconds, setChatDelaySeconds] = useState(0);
  const [subscribersOnly, setSubscribersOnly] = useState(false);
  const [linksAllowed, setLinksAllowed] = useState(true);
  const [linksModeratorOnly, setLinksModeratorOnly] = useState(false);

  // Estados para controle avançado da câmera
  const [cameraPosition, setCameraPosition] = useState<CameraPosition>({
    x: 20,
    y: 20,
    width: 320,
    height: 240,
    corner: 'bottom-right',
    scale: 1
  });
  const [isDraggingCamera, setIsDraggingCamera] = useState(false);
  const [isResizingCamera, setIsResizingCamera] = useState(false);
  const [isCameraFullscreen, setIsCameraFullscreen] = useState(false);
  
  // Refs para otimização de movimento
  const lastMoveTime = useRef<number>(0);
  const moveThrottleDelay = 16; // ~60fps

  // Refs para elementos de vídeo
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);
  const pipCameraRef = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  
  // ✅ NOVO: Ref para evitar duplicação de compartilhamento de tela (React StrictMode)
  const isScreenSharingInProgress = useRef<boolean>(false);
  
  // ✅ NOVO: Canvas para combinar tela + câmera
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositeStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // ✅ NOVO: Refs para elementos de vídeo temporários (para limpeza)
  const tempScreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const tempCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  
  // ✅ NOVO: Ref para acessar cameraPosition atualizada no loop de renderização
  const cameraPositionRef = useRef(cameraPosition);
  
  // ✅ NOVO: Atualizar ref quando state muda
  useEffect(() => {
    cameraPositionRef.current = cameraPosition;
  }, [cameraPosition]);

  // ✅ NOVO: Heartbeat para manter stream "viva" no banco
  // Atualiza updated_at a cada 1 minuto enquanto isLive === true
  useEffect(() => {
    if (!isLive || !streamId) return;
    
    console.log('💓 [StreamerDashboard] Iniciando heartbeat da transmissão');
    
    const heartbeatInterval = setInterval(async () => {
      try {
        console.log('💓 [StreamerDashboard] Enviando heartbeat...');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('live_streams')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', streamId);
        
        if (error) {
          console.error('❌ [StreamerDashboard] Erro no heartbeat:', error);
        } else {
          console.log('✅ [StreamerDashboard] Heartbeat enviado com sucesso');
        }
      } catch (err) {
        console.error('💥 [StreamerDashboard] Exceção no heartbeat:', err);
      }
    }, 60000); // A cada 1 minuto
    
    return () => {
      console.log('🛑 [StreamerDashboard] Parando heartbeat da transmissão');
      clearInterval(heartbeatInterval);
    };
  }, [isLive, streamId, supabase]);

  // Carregar dados da transmissão e inicializar câmera
  useEffect(() => {
    if (streamId) {
      loadStreamData();
      fetchComments(streamId);
      // Inicializar câmera automaticamente quando a página carregar
      initializeCamera();
      // Carregar dispositivos disponíveis
      loadAvailableDevices();
      // Configurar listener para mudanças de dispositivos
      setupDeviceChangeListener();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]); // loadStreamData, fetchComments, loadAvailableDevices, setupDeviceChangeListener são estáveis

  // Fechar seletor de emojis ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // Verificar se o clique foi fora do seletor de emojis
      if (showEmojiPicker && !target.closest('.emoji-picker-container')) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      // Delay pequeno para não fechar imediatamente ao abrir
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Configurar listener para mudanças de dispositivos em tempo real
  const setupDeviceChangeListener = () => {
    const handleDeviceChange = () => {
      console.log('🔄 Dispositivos alterados, recarregando lista...');
      // Delay pequeno para garantir que os dispositivos estejam disponíveis
      setTimeout(() => {
        loadAvailableDevices();
      }, 500);
    };

    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      
      // Cleanup function
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  };

  // Fechar seletores quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.device-selector')) {
        setShowMicSelector(false);
        setShowCameraSelector(false);
        setShowHeadphoneSelector(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Controle de redimensionamento do chat melhorado
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingChat) {
        e.preventDefault();
        const deltaX = e.clientX - chatResizeStartX;
        const newWidth = Math.max(280, Math.min(500, chatResizeStartWidth - deltaX)); // Limites: 280px a 500px
        setChatWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingChat(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizingChat) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp, { passive: false });
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingChat, chatResizeStartX, chatResizeStartWidth]);

  // Timer para duração da transmissão
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isLive) {
      interval = setInterval(() => {
        setStreamStats(prev => ({
          ...prev,
          duration: prev.duration + 1
        }));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLive]);

  // Atualizar comentários em tempo real
  useEffect(() => {
    if (comments) {
      const formattedComments: StreamComment[] = comments.map(comment => ({
        id: comment.id,
        userId: comment.userId,
        userName: comment.user?.user_metadata?.full_name || 'Usuário',
        userAvatar: comment.user?.user_metadata?.avatar_url || '',
        message: comment.content,
        timestamp: new Date(comment.createdAt),
        isStreamer: comment.userId === user?.id
      }));
      setStreamComments(formattedComments);
      setStreamStats(prev => ({ ...prev, totalMessages: formattedComments.length }));
    }
  }, [comments, user?.id]);
  
  // Sincronizar viewers do LiveKit (fonte de verdade) com streamStats
  useEffect(() => {
    if (liveKitConnected && liveKitViewerCount >= 0) {
      setStreamStats(prev => ({ ...prev, viewerCount: liveKitViewerCount }));
    }
  }, [liveKitViewerCount, liveKitConnected]);

  // Sincronizar viewers reais com o sistema de viewers adicionados
  useEffect(() => {
    setRealViewerCount(streamStats.viewerCount);
    setTotalViewerCount(streamStats.viewerCount + addedViewers);
  }, [streamStats.viewerCount, addedViewers]);

  // Carregar usuários bloqueados
  useEffect(() => {
    if (streamId) {
      loadBlockedUsers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]); // loadBlockedUsers é estável

  const loadBlockedUsers = async () => {
    if (!streamId) return;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from('blocked_stream_users')
        .select('user_id')
        .eq('stream_id', streamId);

      if (error) throw error;

      setBlockedUsers(data.map((item: { user_id: string }) => item.user_id));
    } catch (error) {
      console.error('Erro ao carregar usuários bloqueados:', error);
    }
  };

  // Sincronizar stream da câmera PiP com o stream principal
  useEffect(() => {
    if (pipCameraRef.current && localStream.current && isScreenSharing && isCameraOn) {
      pipCameraRef.current.srcObject = localStream.current;
      pipCameraRef.current.play().catch(error => {
        console.warn('Erro ao reproduzir câmera PiP:', error);
      });
    }
  }, [isScreenSharing, isCameraOn]);

  // Garantir que o stream de compartilhamento de tela seja exibido corretamente
  useEffect(() => {
    if (isScreenSharing && screenStream.current && screenShareRef.current) {
      console.log('📺 [StreamerDashboard] Configurando preview de compartilhamento de tela');
      console.log('📺 [StreamerDashboard] screenStream tracks:', {
        video: screenStream.current.getVideoTracks().length,
        audio: screenStream.current.getAudioTracks().length,
        videoTrackId: screenStream.current.getVideoTracks()[0]?.id,
        videoTrackReadyState: screenStream.current.getVideoTracks()[0]?.readyState
      });
      
      screenShareRef.current.srcObject = screenStream.current;
      console.log('📺 [StreamerDashboard] srcObject aplicado ao preview');
      
      screenShareRef.current.play()
        .then(() => {
          console.log('✅ [StreamerDashboard] Preview play() bem-sucedido');
          console.log('📺 [StreamerDashboard] Estado do preview:', {
            videoWidth: screenShareRef.current!.videoWidth,
            videoHeight: screenShareRef.current!.videoHeight,
            readyState: screenShareRef.current!.readyState,
            paused: screenShareRef.current!.paused,
            offsetWidth: screenShareRef.current!.offsetWidth,
            offsetHeight: screenShareRef.current!.offsetHeight,
            display: window.getComputedStyle(screenShareRef.current!).display,
            visibility: window.getComputedStyle(screenShareRef.current!).visibility,
            opacity: window.getComputedStyle(screenShareRef.current!).opacity
          });
        })
        .catch(error => {
          console.error('❌ [StreamerDashboard] Erro ao reproduzir compartilhamento:', error);
        });
    }
  }, [isScreenSharing]);

  // Garantir que a câmera principal seja sempre exibida quando não há compartilhamento
  useEffect(() => {
    if (!isScreenSharing && isCameraOn && localStream.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream.current;
      localVideoRef.current.play().catch(error => {
        console.warn('Erro ao reproduzir câmera principal:', error);
      });
    }
  }, [isScreenSharing, isCameraOn]);

  const loadStreamData = async () => {
    if (!streamId) return;
    
    try {
      const stream = await fetchStreamById(streamId);
      if (stream) {
        setStreamTitle(stream.title);
        setStreamDescription(stream.description || '');
        setStreamLanguage(stream.language || 'pt');
        setStreamTags(stream.tags?.join(', ') || '');
        setIsLive(stream.status === 'live');
        
        // Verificar se o usuário é o dono da transmissão
        if (stream.userId !== user?.id) {
          toast.error('Você não tem permissão para acessar esta transmissão');
          navigate('/live');
          return;
        }
      }
    } catch (error) {
      console.error('Erro ao carregar transmissão:', error);
      toast.error('Erro ao carregar dados da transmissão');
    }
  };

  const initializeCamera = async () => {
    try {
      console.log('📹 [StreamerDashboard] Inicializando câmera...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });

      console.log('📹 [StreamerDashboard] Stream obtido:', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        videoTrackId: stream.getVideoTracks()[0]?.id,
        videoTrackLabel: stream.getVideoTracks()[0]?.label,
        videoTrackReadyState: stream.getVideoTracks()[0]?.readyState,
        videoTrackEnabled: stream.getVideoTracks()[0]?.enabled,
        videoTrackMuted: stream.getVideoTracks()[0]?.muted
      });

      localStream.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play().catch(error => {
          console.warn('Erro ao reproduzir câmera inicial:', error);
        });
        
        // Aguardar metadata carregar com timeout de 3s para não travar
        await new Promise<void>((resolve) => {
          if (!localVideoRef.current || localVideoRef.current.readyState >= 2) {
            resolve();
            return;
          }
          const timeout = setTimeout(resolve, 3000); // nunca trava mais de 3s
          localVideoRef.current!.onloadedmetadata = () => {
            clearTimeout(timeout);
            resolve();
          };
        });
        
        console.log('📹 [StreamerDashboard] Vídeo da câmera carregado:', {
          videoWidth: localVideoRef.current.videoWidth,
          videoHeight: localVideoRef.current.videoHeight,
          readyState: localVideoRef.current.readyState
        });
      }

      // Atualizar estados
      setIsCameraOn(true);
      setIsMicOn(true);
      
      console.log('✅ [StreamerDashboard] Câmera inicializada com sucesso');
      return true;
    } catch (error) {
      console.error('❌ [StreamerDashboard] Erro ao acessar câmera:', error);
      toast.error('Erro ao acessar câmera e microfone');
      setIsCameraOn(false);
      return false;
    }
  };

  // ✅ NOVO: Criar stream composto (tela + câmera em PiP)
  const createCompositeStream = async (screenStream: MediaStream, cameraStream: MediaStream): Promise<MediaStream> => {
    console.log('🎨 [StreamerDashboard] ========== INÍCIO createCompositeStream ==========');
    
    // ✅ PARAR qualquer composite anterior ANTES de criar novo
    if (animationFrameRef.current || compositeStreamRef.current || compositeCanvasRef.current) {
      console.warn('⚠️ [StreamerDashboard] Composite anterior ainda ativo! Limpando...');
      stopCompositeStream();
      // Aguardar um pouco para garantir que tudo foi limpo
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // ✅ CLONAR cameraStream para evitar que tracks sejam parados externamente
    console.log('🔄 [StreamerDashboard] Clonando cameraStream para proteção...');
    const cameraStreamClone = cameraStream.clone();
    console.log('✅ [StreamerDashboard] CameraStream clonado:', {
      originalId: cameraStream.id,
      cloneId: cameraStreamClone.id,
      originalActive: cameraStream.active,
      cloneActive: cameraStreamClone.active,
      cloneTracks: {
        video: cameraStreamClone.getVideoTracks().length,
        audio: cameraStreamClone.getAudioTracks().length
      }
    });
    
    console.log('📊 [StreamerDashboard] Streams recebidos:', {
      screenTracks: {
        video: screenStream.getVideoTracks().length,
        audio: screenStream.getAudioTracks().length,
        videoId: screenStream.getVideoTracks()[0]?.id,
        videoLabel: screenStream.getVideoTracks()[0]?.label,
        videoReadyState: screenStream.getVideoTracks()[0]?.readyState
      },
      cameraTracks: {
        video: cameraStreamClone.getVideoTracks().length,
        audio: cameraStreamClone.getAudioTracks().length,
        videoId: cameraStreamClone.getVideoTracks()[0]?.id,
        videoLabel: cameraStreamClone.getVideoTracks()[0]?.label,
        videoReadyState: cameraStreamClone.getVideoTracks()[0]?.readyState
      }
    });
    
    // ✅ AUMENTAR RESOLUÇÃO para máxima qualidade
    const CANVAS_WIDTH = 1920;  // Full HD
    const CANVAS_HEIGHT = 1080;
    
    // ✅ SEMPRE criar novo canvas (evitar conflitos de reutilização)
    console.log('🆕 [StreamerDashboard] Criando novo canvas limpo');
    compositeCanvasRef.current = document.createElement('canvas');
    compositeCanvasRef.current.width = CANVAS_WIDTH;
    compositeCanvasRef.current.height = CANVAS_HEIGHT;
    
    const canvas = compositeCanvasRef.current;
    const ctx = canvas.getContext('2d', {
      alpha: false,  // Sem transparência = melhor performance
      desynchronized: true,  // Melhor performance
    })!;
    
    console.log('✅ [StreamerDashboard] Canvas configurado:', {
      width: canvas.width,
      height: canvas.height,
      hasContext: !!ctx
    });
    
    // ✅ Habilitar suavização de imagem para melhor qualidade
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // ✅ Preencher canvas com fundo vermelho inicialmente (para debug)
    console.log('🎨 [StreamerDashboard] Preenchendo canvas com cor de teste (vermelho)');
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // ✅ LIMPAR elementos temporários antigos (se existirem)
    if (tempScreenVideoRef.current) {
      console.log('🧹 [StreamerDashboard] Limpando screenVideo anterior');
      tempScreenVideoRef.current.srcObject = null;
      tempScreenVideoRef.current = null;
    }
    if (tempCameraVideoRef.current) {
      console.log('🧹 [StreamerDashboard] Limpando cameraVideo anterior');
      tempCameraVideoRef.current.srcObject = null;
      tempCameraVideoRef.current = null;
    }
    
    // Criar elementos de vídeo temporários para desenhar
    console.log('📹 [StreamerDashboard] Criando elementos de vídeo temporários');
    const screenVideo = document.createElement('video');
    screenVideo.srcObject = screenStream;
    screenVideo.muted = true;
    screenVideo.autoplay = true;
    tempScreenVideoRef.current = screenVideo;  // ✅ Armazenar referência
    
    const cameraVideo = document.createElement('video');
    cameraVideo.srcObject = cameraStreamClone;  // ✅ Usar CLONE
    cameraVideo.muted = true;
    cameraVideo.autoplay = true;
    tempCameraVideoRef.current = cameraVideo;  // ✅ Armazenar referência
    
    console.log('✅ [StreamerDashboard] Elementos de vídeo criados e armazenados');
    
    // ✅ AGUARDAR vídeos carregarem
    console.log('⏳ [StreamerDashboard] Aguardando vídeos carregarem...');
    const startTime = Date.now();
    
    await Promise.all([
      new Promise<void>((resolve) => {
        if (screenVideo.readyState >= 2) {
          console.log('✅ [StreamerDashboard] screenVideo já estava pronto');
          resolve();
        } else {
          console.log('⏳ [StreamerDashboard] Aguardando screenVideo carregar...');
          screenVideo.addEventListener('loadeddata', () => {
            console.log('✅ [StreamerDashboard] screenVideo carregado!');
            resolve();
          }, { once: true });
        }
      }),
      new Promise<void>((resolve) => {
        if (cameraVideo.readyState >= 2) {
          console.log('✅ [StreamerDashboard] cameraVideo já estava pronto');
          resolve();
        } else {
          console.log('⏳ [StreamerDashboard] Aguardando cameraVideo carregar...');
          cameraVideo.addEventListener('loadeddata', () => {
            console.log('✅ [StreamerDashboard] cameraVideo carregado!');
            resolve();
          }, { once: true });
        }
      })
    ]);
    
    const loadTime = Date.now() - startTime;
    console.log('✅ [StreamerDashboard] Vídeos carregados em', loadTime, 'ms', {
      screenReadyState: screenVideo.readyState,
      screenVideoWidth: screenVideo.videoWidth,
      screenVideoHeight: screenVideo.videoHeight,
      cameraReadyState: cameraVideo.readyState,
      cameraVideoWidth: cameraVideo.videoWidth,
      cameraVideoHeight: cameraVideo.videoHeight
    });
    
    // Garantir que vídeos estão tocando
    console.log('▶️ [StreamerDashboard] Iniciando reprodução dos vídeos...');
    await screenVideo.play()
      .then(() => console.log('✅ [StreamerDashboard] screenVideo.play() OK'))
      .catch(e => console.warn('❌ [StreamerDashboard] Erro ao reproduzir screenVideo:', e));
    await cameraVideo.play()
      .then(() => console.log('✅ [StreamerDashboard] cameraVideo.play() OK'))
      .catch(e => console.warn('❌ [StreamerDashboard] Erro ao reproduzir cameraVideo:', e));
    
    // ✅ AGUARDAR mais um pouco para vídeos estarem realmente prontos
    console.log('⏳ [StreamerDashboard] Aguardando vídeos estabilizarem...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // ✅ TESTAR se cameraVideo tem frames válidos (não pretos)
    console.log('🔍 [StreamerDashboard] Testando se cameraVideo tem frames válidos...');
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 100;
    testCanvas.height = 100;
    const testCtx = testCanvas.getContext('2d')!;
    
    try {
      testCtx.drawImage(cameraVideo, 0, 0, 100, 100);
      const imageData = testCtx.getImageData(50, 50, 1, 1);
      const pixel = imageData.data;
      
      console.log('🔍 [StreamerDashboard] Pixel do cameraVideo (50,50):', {
        r: pixel[0],
        g: pixel[1],
        b: pixel[2],
        a: pixel[3]
      });
      
      const isBlack = pixel[0] < 10 && pixel[1] < 10 && pixel[2] < 10;
      if (isBlack) {
        console.error('❌ [StreamerDashboard] CÂMERA ESTÁ PRODUZINDO FRAMES PRETOS!');
        console.warn('⚠️ [StreamerDashboard] Possíveis causas:');
        console.warn('  1. Câmera ainda está inicializando (aguarde alguns segundos)');
        console.warn('  2. Problema de hardware/driver da câmera');
        console.warn('  3. Outra aplicação está usando a câmera');
        console.warn('💡 [StreamerDashboard] Solução: Troque de câmera no seletor e volte para a original');
      } else {
        console.log('✅ [StreamerDashboard] Câmera tem frames válidos (não preto)');
      }
    } catch (e) {
      console.error('❌ [StreamerDashboard] Erro ao testar cameraVideo:', e);
    }
    
    // ✅ RENDERIZAR alguns frames ANTES de capturar stream
    console.log('🎨 [StreamerDashboard] Renderizando frames iniciais...');
    let frameCount = 0;
    
    // ✅ Função para verificar se Canvas tem conteúdo real
    const checkCanvasContent = () => {
      const imageData = ctx.getImageData(100, 100, 1, 1);
      const pixel = imageData.data;
      console.log('🔍 [StreamerDashboard] Pixel do canvas (100,100):', {
        r: pixel[0],
        g: pixel[1],
        b: pixel[2],
        a: pixel[3]
      });
      
      // Verificar se não é preto puro (0,0,0) nem vermelho puro (255,0,0)
      const isNotBlack = pixel[0] > 10 || pixel[1] > 10 || pixel[2] > 10;
      const isNotRed = !(pixel[0] > 200 && pixel[1] < 50 && pixel[2] < 50);
      
      return isNotBlack && isNotRed;
    };
    
    const renderFrame = () => {
      const currentPosition = cameraPositionRef.current;
      
      // Desenhar tela (fundo completo)
      let screenDrawSuccess = false;
      try {
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
        screenDrawSuccess = true;
        if (frameCount === 0) {
          console.log('✅ [StreamerDashboard] Primeiro frame de tela desenhado com sucesso');
        }
      } catch (e) {
        if (frameCount === 0) {
          console.warn('⚠️ [StreamerDashboard] Erro ao desenhar tela no primeiro frame:', e);
        }
        // Usar fundo verde se não conseguir desenhar (debug)
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      // Desenhar câmera em PiP (posição atual)
      const pipWidth = currentPosition.width;
      const pipHeight = (pipWidth * 9) / 16;
      const pipX = currentPosition.x;
      const pipY = currentPosition.y;
      
      // Borda do PiP
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.strokeRect(pipX, pipY, pipWidth, pipHeight);
      
      // Desenhar câmera
      let cameraDrawSuccess = false;
      try {
        ctx.drawImage(cameraVideo, pipX, pipY, pipWidth, pipHeight);
        cameraDrawSuccess = true;
        if (frameCount === 0) {
          console.log('✅ [StreamerDashboard] Primeiro frame de câmera desenhado com sucesso');
        }
      } catch (e) {
        if (frameCount === 0) {
          console.warn('⚠️ [StreamerDashboard] Erro ao desenhar câmera no primeiro frame:', e);
        }
      }
      
      frameCount++;
      
      // Log detalhado a cada 60 frames (~1 segundo)
      if (frameCount % 60 === 0) {
        // ✅ Verificar se câmera ficou preta
        const cameraStreamActive = cameraStreamClone.active;
        const cameraVideoTrack = cameraStreamClone.getVideoTracks()[0];
        const cameraVideoTrackState = cameraVideoTrack?.readyState;
        
        // Testar pixel da câmera
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 10;
        testCanvas.height = 10;
        const testCtx = testCanvas.getContext('2d')!;
        let cameraPixel = { r: 0, g: 0, b: 0 };
        try {
          testCtx.drawImage(cameraVideo, 0, 0, 10, 10);
          const imageData = testCtx.getImageData(5, 5, 1, 1);
          cameraPixel = {
            r: imageData.data[0],
            g: imageData.data[1],
            b: imageData.data[2]
          };
        } catch (e) {
          // Ignorar erro
        }
        
        const isCameraBlack = cameraPixel.r < 10 && cameraPixel.g < 10 && cameraPixel.b < 10;
        
        console.log(`🎨 [StreamerDashboard] Frame ${frameCount}:`, {
          screenDrawSuccess,
          cameraDrawSuccess,
          screenVideoReadyState: screenVideo.readyState,
          cameraVideoReadyState: cameraVideo.readyState,
          screenVideoPaused: screenVideo.paused,
          cameraVideoPaused: cameraVideo.paused,
          // ✅ NOVO: Estado da câmera (CLONE)
          cameraStreamCloneActive: cameraStreamActive,
          cameraVideoTrackState,
          cameraPixel,
          isCameraBlack: isCameraBlack ? '❌ PRETO!' : '✅ OK'
        });
        
        if (isCameraBlack) {
          console.error('❌ [StreamerDashboard] CÂMERA FICOU PRETA no frame', frameCount);
          console.error('❌ [StreamerDashboard] Estado detalhado:', {
            cameraStreamClone: {
              active: cameraStreamActive,
              videoTracks: cameraStreamClone.getVideoTracks().length,
              videoTrack: {
                id: cameraVideoTrack?.id,
                readyState: cameraVideoTrackState,
                enabled: cameraVideoTrack?.enabled,
                muted: cameraVideoTrack?.muted
              }
            },
            cameraVideo: {
              srcObject: !!cameraVideo.srcObject,
              readyState: cameraVideo.readyState,
              paused: cameraVideo.paused,
              videoWidth: cameraVideo.videoWidth,
              videoHeight: cameraVideo.videoHeight
            }
          });
        }
      }
    };
    
    // Renderizar 10 frames iniciais para "aquecer" o canvas
    console.log('🔄 [StreamerDashboard] Renderizando 10 frames de aquecimento...');
    for (let i = 0; i < 10; i++) {
      renderFrame();
      await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps
      if ((i + 1) % 3 === 0) {
        console.log(`🎨 [StreamerDashboard] Frame ${i + 1}/10 renderizado`);
      }
    }
    
    console.log('✅ [StreamerDashboard] Frames iniciais renderizados! Total:', frameCount);
    
    // ✅ VERIFICAR se Canvas tem conteúdo real (não está preto)
    const hasContent = checkCanvasContent();
    console.log('🔍 [StreamerDashboard] Canvas tem conteúdo válido?', hasContent);
    
    if (!hasContent) {
      console.warn('⚠️ [StreamerDashboard] Canvas parece estar sem conteúdo! Aguardando mais frames...');
      // Renderizar mais frames até ter conteúdo
      let attempts = 0;
      while (!checkCanvasContent() && attempts < 30) {
        renderFrame();
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
      }
      
      if (checkCanvasContent()) {
        console.log('✅ [StreamerDashboard] Canvas agora tem conteúdo após', attempts, 'tentativas');
      } else {
        console.error('❌ [StreamerDashboard] Canvas continua sem conteúdo após 30 tentativas!');
      }
    }
    
    // ✅ Desenhar indicador visual de DEBUG (canto superior direito)
    ctx.fillStyle = '#FF00FF'; // Magenta
    ctx.fillRect(canvas.width - 50, 0, 50, 50);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('LIVE', canvas.width - 45, 30);
    console.log('🎨 [StreamerDashboard] Indicador visual de DEBUG desenhado');
    
    // ✅ AGORA capturar stream do canvas
    console.log('📹 [StreamerDashboard] Capturando stream do canvas...');
    const compositeStream = canvas.captureStream(60);
    
    console.log('✅ [StreamerDashboard] Stream capturado:', {
      hasStream: !!compositeStream,
      videoTracks: compositeStream.getVideoTracks().length,
      videoTrackId: compositeStream.getVideoTracks()[0]?.id,
      videoTrackLabel: compositeStream.getVideoTracks()[0]?.label,
      videoTrackReadyState: compositeStream.getVideoTracks()[0]?.readyState,
      videoTrackEnabled: compositeStream.getVideoTracks()[0]?.enabled,
      videoTrackMuted: compositeStream.getVideoTracks()[0]?.muted,
      videoTrackSettings: compositeStream.getVideoTracks()[0]?.getSettings()
    });
    
    // ✅ Testar se o track do canvas está gerando frames
    const videoTrack = compositeStream.getVideoTracks()[0];
    if (videoTrack) {
      console.log('🔍 [StreamerDashboard] Testando se track está gerando frames...');
      
      // Criar um ImageCapture para testar
      try {
        const imageCapture = new ImageCapture(videoTrack);
        
        // Aguardar um pouco para garantir que Canvas já renderizou
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // @ts-expect-error - grabFrame exists but may not be in TypeScript definitions
        const imageBitmap = await imageCapture.grabFrame();
        console.log('✅ [StreamerDashboard] Frame capturado do track!', {
          width: imageBitmap.width,
          height: imageBitmap.height
        });
        
        // ✅ TESTAR se o frame do track contém a câmera (verificar região do PiP)
        const testCanvas = document.createElement('canvas');
        testCanvas.width = imageBitmap.width;
        testCanvas.height = imageBitmap.height;
        const testCtx = testCanvas.getContext('2d')!;
        testCtx.drawImage(imageBitmap, 0, 0);
        
        // Verificar pixel no centro do Canvas (deve ter conteúdo da tela)
        const centerPixel = testCtx.getImageData(imageBitmap.width / 2, imageBitmap.height / 2, 1, 1).data;
        console.log('🔍 [StreamerDashboard] Pixel do centro do track:', {
          r: centerPixel[0],
          g: centerPixel[1],
          b: centerPixel[2]
        });
        
        // Verificar pixel no canto superior direito (onde está o quadrado MAGENTA)
        const magentaPixel = testCtx.getImageData(imageBitmap.width - 25, 25, 1, 1).data;
        console.log('🔍 [StreamerDashboard] Pixel do indicador MAGENTA:', {
          r: magentaPixel[0],
          g: magentaPixel[1],
          b: magentaPixel[2]
        });
        
        const isMagenta = magentaPixel[0] > 200 && magentaPixel[1] < 50 && magentaPixel[2] > 200;
        if (isMagenta) {
          console.log('✅ [StreamerDashboard] Indicador MAGENTA visível no track!');
        } else {
          console.warn('⚠️ [StreamerDashboard] Indicador MAGENTA NÃO está no track!');
        }
        
        // Verificar pixel na região do PiP (canto onde deveria estar a câmera)
        const pipPosition = cameraPositionRef.current;
        const pipCenterX = pipPosition.x + pipPosition.width / 2;
        const pipCenterY = pipPosition.y + (pipPosition.width * 9 / 16) / 2;
        const pipPixel = testCtx.getImageData(pipCenterX, pipCenterY, 1, 1).data;
        console.log('🔍 [StreamerDashboard] Pixel do centro do PiP no track:', {
          r: pipPixel[0],
          g: pipPixel[1],
          b: pipPixel[2],
          position: { x: pipCenterX, y: pipCenterY }
        });
        
        const isPipBlack = pipPixel[0] < 10 && pipPixel[1] < 10 && pipPixel[2] < 10;
        if (isPipBlack) {
          console.error('❌ [StreamerDashboard] PiP ESTÁ PRETO NO TRACK!');
          console.warn('⚠️ [StreamerDashboard] Canvas está desenhando câmera mas track não está capturando!');
        } else {
          console.log('✅ [StreamerDashboard] PiP tem conteúdo no track!');
        }
        
        imageBitmap.close();
      } catch (e) {
        console.error('❌ [StreamerDashboard] Erro ao capturar frame:', e);
      }
    }
    
    // ✅ Loop de renderização contínua
    console.log('🔄 [StreamerDashboard] Iniciando loop de renderização contínua');
    const render = () => {
      renderFrame();
      animationFrameRef.current = requestAnimationFrame(render);
    };
    
    // Iniciar renderização contínua
    render();
    
    // Adicionar áudio da câmera (CLONE) e da tela
    console.log('🔊 [StreamerDashboard] Adicionando tracks de áudio...');
    let audioTracksAdded = 0;
    cameraStreamClone.getAudioTracks().forEach(track => {
      compositeStream.addTrack(track);
      console.log('➕ [StreamerDashboard] Áudio da câmera (clone) adicionado:', track.id);
      audioTracksAdded++;
    });
    screenStream.getAudioTracks().forEach(track => {
      compositeStream.addTrack(track);
      console.log('➕ [StreamerDashboard] Áudio da tela adicionado:', track.id);
      audioTracksAdded++;
    });
    
    compositeStreamRef.current = compositeStream;
    
    console.log('✅ [StreamerDashboard] Stream composto FINALIZADO:', {
      videoTracks: compositeStream.getVideoTracks().length,
      audioTracks: compositeStream.getAudioTracks().length,
      audioTracksAdded,
      allTracks: compositeStream.getTracks().map(t => ({
        kind: t.kind,
        id: t.id,
        label: t.label,
        readyState: t.readyState,
        enabled: t.enabled
      }))
    });
    console.log('🎨 [StreamerDashboard] ========== FIM createCompositeStream ==========');
    
    return compositeStream;
  };

  // ✅ NOVO: Parar stream composto
  const stopCompositeStream = () => {
    console.log('🛑 [StreamerDashboard] ===== PARANDO STREAM COMPOSTO =====');
    
    // 1. Cancelar loop de animação
    if (animationFrameRef.current) {
      console.log('🛑 [StreamerDashboard] Cancelando animationFrame:', animationFrameRef.current);
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    } else {
      console.log('ℹ️ [StreamerDashboard] Nenhum animationFrame ativo');
    }
    
    // 2. Parar tracks do composite stream
    if (compositeStreamRef.current) {
      console.log('🛑 [StreamerDashboard] Parando tracks do stream composto:', {
        tracks: compositeStreamRef.current.getTracks().length
      });
      compositeStreamRef.current.getTracks().forEach(track => {
        console.log('🛑 [StreamerDashboard] Parando track:', track.kind, track.id);
        track.stop();
      });
      compositeStreamRef.current = null;
    } else {
      console.log('ℹ️ [StreamerDashboard] Nenhum stream composto ativo');
    }
    
    // 3. Limpar elementos de vídeo temporários
    if (tempScreenVideoRef.current) {
      console.log('🧹 [StreamerDashboard] Limpando tempScreenVideo');
      tempScreenVideoRef.current.pause();
      tempScreenVideoRef.current.srcObject = null;
      tempScreenVideoRef.current.remove();  // Remover do DOM (se estiver)
      tempScreenVideoRef.current = null;
    }
    
    if (tempCameraVideoRef.current) {
      console.log('🧹 [StreamerDashboard] Limpando tempCameraVideo');
      tempCameraVideoRef.current.pause();
      tempCameraVideoRef.current.srcObject = null;
      tempCameraVideoRef.current.remove();  // Remover do DOM (se estiver)
      tempCameraVideoRef.current = null;
    }
    
    // 4. Limpar canvas
    if (compositeCanvasRef.current) {
      console.log('🧹 [StreamerDashboard] Limpando canvas');
      const ctx = compositeCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, compositeCanvasRef.current.width, compositeCanvasRef.current.height);
      }
      compositeCanvasRef.current = null;
    }
    
    console.log('✅ [StreamerDashboard] Stream composto parado e TUDO limpo');
  };

  const startScreenShare = async () => {
    // ✅ NOVO: Evitar duplicação (React StrictMode pode chamar 2x)
    if (isScreenSharingInProgress.current) {
      console.log('⚠️ [StreamerDashboard] Compartilhamento de tela já em andamento, ignorando...');
      return false;
    }
    
    try {
      isScreenSharingInProgress.current = true;
      
      // ✅ Solicitar máxima qualidade para compartilhamento de tela
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 60, max: 60 },  // 60 FPS para suavidade
        },
        audio: true
      });

      screenStream.current = stream;
      
      // Garantir que o vídeo seja atribuído imediatamente
      if (screenShareRef.current) {
        screenShareRef.current.srcObject = stream;
        // Forçar reprodução
        await screenShareRef.current.play().catch(console.warn);
      }

      setIsScreenSharing(true);
      
      // Detectar quando o usuário para o compartilhamento
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      console.log('🖥️ Compartilhamento de tela iniciado');
      
      // ✅ NOVO: Atualizar stream para viewers
      console.log('🔍 [StreamerDashboard] Debug compartilhamento:', {
        isLive,
        hasLocalStream: !!localStream.current,
        isCameraOn,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });
      
      if (isLive && localStream.current) {
        let streamToSend: MediaStream;
        
        // Se a câmera está ligada, criar stream composto (tela + câmera PiP)
        if (isCameraOn) {
          console.log('🎨 [StreamerDashboard] Criando stream composto com câmera PiP');
          
          // ✅ VALIDAR se câmera ainda está ativa
          const cameraActive = localStream.current.active;
          const cameraVideoTrack = localStream.current.getVideoTracks()[0];
          const cameraAudioTrack = localStream.current.getAudioTracks()[0];
          
          console.log('🔍 [StreamerDashboard] Estado da câmera antes de clonar:', {
            streamId: localStream.current.id,
            streamActive: cameraActive,
            videoTrack: cameraVideoTrack ? {
              id: cameraVideoTrack.id,
              readyState: cameraVideoTrack.readyState,
              enabled: cameraVideoTrack.enabled
            } : null,
            audioTrack: cameraAudioTrack ? {
              id: cameraAudioTrack.id,
              readyState: cameraAudioTrack.readyState,
              enabled: cameraAudioTrack.enabled
            } : null
          });
          
          // ✅ Se câmera está inativa, RE-INICIALIZAR!
          if (!cameraActive || cameraVideoTrack?.readyState === 'ended' || cameraAudioTrack?.readyState === 'ended') {
            console.warn('⚠️ [StreamerDashboard] Câmera está inativa! Re-inicializando...');
            await initializeCamera();
            console.log('✅ [StreamerDashboard] Câmera re-inicializada:', {
              newStreamId: localStream.current.id,
              active: localStream.current.active
            });
          }
          
          streamToSend = await createCompositeStream(stream, localStream.current);
          
          // ✅ APLICAR composite ao preview local também!
          if (screenShareRef.current) {
            console.log('📺 [StreamerDashboard] Aplicando composite ao preview local');
            screenShareRef.current.srcObject = streamToSend;
            await screenShareRef.current.play().catch(e => console.warn('Erro ao reproduzir preview:', e));
            
            console.log('📺 [StreamerDashboard] Estado do preview após aplicar composite:', {
              videoWidth: screenShareRef.current.videoWidth,
              videoHeight: screenShareRef.current.videoHeight,
              readyState: screenShareRef.current.readyState,
              paused: screenShareRef.current.paused,
              offsetWidth: screenShareRef.current.offsetWidth,
              offsetHeight: screenShareRef.current.offsetHeight
            });
          }
        } else {
          // Se câmera desligada, enviar apenas tela + áudio
          console.log('🖥️ [StreamerDashboard] Enviando apenas tela (sem câmera)');
          streamToSend = new MediaStream();
          
          // Adicionar vídeo da tela
          stream.getVideoTracks().forEach(track => {
            streamToSend.addTrack(track);
          });
          
          // Adicionar áudio da câmera (microfone)
          localStream.current.getAudioTracks().forEach(track => {
            streamToSend.addTrack(track);
          });
          
          // Adicionar áudio da tela (se houver)
          stream.getAudioTracks().forEach(track => {
            streamToSend.addTrack(track);
          });
        }
        
        console.log('🔄 [StreamerDashboard] Enviando stream para viewers:', {
          totalTracks: streamToSend.getTracks().length,
          videoTracks: streamToSend.getVideoTracks().length,
          audioTracks: streamToSend.getAudioTracks().length,
          isComposite: isCameraOn
        });
        
        await updatePublisherStream(streamToSend);
        if (liveKitConnected) await liveKitReplaceStream(streamToSend);
        if (whipSenderRef.current) await whipSenderRef.current.replaceStream(streamToSend);
      } else {
        console.warn('⚠️ [StreamerDashboard] Não foi possível enviar compartilhamento:', {
          isLive,
          hasLocalStream: !!localStream.current
        });
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao compartilhar tela:', error);
      isScreenSharingInProgress.current = false; // ✅ Resetar em caso de erro
      return false;
    }
  };

  const stopScreenShare = async () => {
    // ✅ NOVO: Resetar flag de compartilhamento
    isScreenSharingInProgress.current = false;
    
    // ✅ NOVO: Parar stream composto
    stopCompositeStream();
    
    if (screenStream.current) {
      screenStream.current.getTracks().forEach(track => track.stop());
      screenStream.current = null;
    }
    
    if (screenShareRef.current) {
      screenShareRef.current.srcObject = null;
    }
    
    setIsScreenSharing(false);
    
    // Garantir que a câmera principal volte a ser exibida
    if (isCameraOn && localStream.current && localVideoRef.current) {
      // Reassociar o stream da câmera ao vídeo principal
      localVideoRef.current.srcObject = localStream.current;
      localVideoRef.current.play().catch(error => {
        console.warn('Erro ao reproduzir câmera principal:', error);
      });
    }
    
    // Se a câmera estava desligada, ligar automaticamente quando parar compartilhamento
    if (!isCameraOn && localStream.current) {
      const videoTrack = localStream.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = true;
        setIsCameraOn(true);
        
        // Garantir que o vídeo seja exibido
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream.current;
          localVideoRef.current.play().catch(error => {
            console.warn('Erro ao reproduzir câmera:', error);
          });
        }
      }
    }
    
    console.log('🖥️ Compartilhamento de tela encerrado');
    
    // Voltar para stream da câmera para viewers
    if (isLive && localStream.current) {
      await updatePublisherStream(localStream.current);
      if (liveKitConnected) await liveKitReplaceStream(localStream.current);
      if (whipSenderRef.current) await whipSenderRef.current.replaceStream(localStream.current);
    }
  };

  const toggleCamera = () => {
    if (localStream.current) {
      const videoTrack = localStream.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
        
        // Se câmera foi ligada e não há compartilhamento, garantir que seja exibida
        if (videoTrack.enabled && !isScreenSharing && localVideoRef.current) {
          localVideoRef.current.srcObject = localStream.current;
          localVideoRef.current.play().catch(error => {
            console.warn('Erro ao reproduzir câmera após ligar:', error);
          });
        }
      }
    }
  };

  const toggleMicrophone = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  // Funções para controle da câmera PiP - OTIMIZADO
  const updateCameraPosition = useCallback((newPosition: Partial<CameraPosition>) => {
    setCameraPosition(prev => {
      // Evitar atualizações desnecessárias se os valores são os mesmos
      const hasChanges = Object.keys(newPosition).some(key => 
        prev[key as keyof CameraPosition] !== newPosition[key as keyof CameraPosition]
      );
      
      return hasChanges ? { ...prev, ...newPosition } : prev;
    });
  }, []);

  const moveCameraToCorner = (corner: CameraPosition['corner']) => {
    const container = document.querySelector('.video-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const { width, height } = cameraPosition;
    
    let x, y;
    switch (corner) {
      case 'top-left':
        x = 20;
        y = 20;
        break;
      case 'top-right':
        x = containerRect.width - width - 20;
        y = 20;
        break;
      case 'bottom-left':
        x = 20;
        y = containerRect.height - height - 20;
        break;
      case 'bottom-right':
        x = containerRect.width - width - 20;
        y = containerRect.height - height - 20;
        break;
    }

    updateCameraPosition({ x, y, corner });
  };

  const resizeCamera = (scale: number) => {
    const baseWidth = 320;
    const baseHeight = 240;
    const newWidth = baseWidth * scale;
    const newHeight = baseHeight * scale;
    
    // Verificar se a nova posição não sai da tela
    const container = document.querySelector('.video-container');
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const maxX = containerRect.width - newWidth - 10;
      const maxY = containerRect.height - newHeight - 10;
      
      const adjustedX = Math.min(cameraPosition.x, maxX);
      const adjustedY = Math.min(cameraPosition.y, maxY);
      
      updateCameraPosition({
        x: adjustedX,
        y: adjustedY,
        width: newWidth,
        height: newHeight,
        scale
      });
    } else {
      updateCameraPosition({
        width: newWidth,
        height: newHeight,
        scale
      });
    }
  };

  const resetCameraPosition = () => {
    setCameraPosition({
      x: 20,
      y: 20,
      width: 320,
      height: 240,
      corner: 'bottom-right',
      scale: 1
    });
    moveCameraToCorner('bottom-right');
  };

  // Função para alternar fullscreen da câmera
  const toggleCameraFullscreen = () => {
    if (isCameraFullscreen) {
      // Voltar ao modo PiP
      setIsCameraFullscreen(false);
      resizeCamera(0.6); // Tamanho pequeno quando em compartilhamento
      moveCameraToCorner('bottom-right');
    } else {
      // Ir para fullscreen (ocupar toda a área de vídeo)
      setIsCameraFullscreen(true);
      const container = document.querySelector('.video-container');
      if (container) {
        const containerRect = container.getBoundingClientRect();
        updateCameraPosition({
          x: 0,
          y: 0,
          width: containerRect.width,
          height: containerRect.height,
          scale: containerRect.width / 320
        });
      }
    }
  };

  // Manipular arrastar câmera - VERSÃO OTIMIZADA
  const handleCameraMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingCamera(true);
    
    const startX = e.clientX - cameraPosition.x;
    const startY = e.clientY - cameraPosition.y;
    let animationFrame: number;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      
      const now = performance.now();
      if (now - lastMoveTime.current < moveThrottleDelay) {
        return;
      }
      lastMoveTime.current = now;
      
      // Cancelar frame anterior se existir
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      
      // Usar requestAnimationFrame para movimento suave
      animationFrame = requestAnimationFrame(() => {
        const container = document.querySelector('.video-container');
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const newX = Math.max(10, Math.min(e.clientX - startX, containerRect.width - cameraPosition.width - 10));
        const newY = Math.max(10, Math.min(e.clientY - startY, containerRect.height - cameraPosition.height - 10));
        
        updateCameraPosition({ x: newX, y: newY });
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      setIsDraggingCamera(false);
      
      // Limpar animation frame se existir
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      
      document.removeEventListener('mousemove', handleMouseMove, { passive: false } as AddEventListenerOptions);
      document.removeEventListener('mouseup', handleMouseUp, { passive: false } as AddEventListenerOptions);
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: false } as AddEventListenerOptions);
    document.addEventListener('mouseup', handleMouseUp, { passive: false } as AddEventListenerOptions);
  };

  // Manipular redimensionar câmera - VERSÃO OTIMIZADA
  const handleCameraResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    setIsResizingCamera(true);
    const startWidth = cameraPosition.width;
    const startHeight = cameraPosition.height;
    const startX = e.clientX;
    const startY = e.clientY;
    let animationFrame: number;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      
      // Cancelar frame anterior se existir
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      
      // Usar requestAnimationFrame para redimensionamento suave
      animationFrame = requestAnimationFrame(() => {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        const newWidth = Math.max(160, Math.min(startWidth + deltaX, 640));
        const newHeight = Math.max(120, Math.min(startHeight + deltaY, 480));
        const newScale = newWidth / 320; // Calcular escala baseada na largura base
        
        updateCameraPosition({ 
          width: newWidth, 
          height: newHeight,
          scale: newScale
        });
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      setIsResizingCamera(false);
      
      // Limpar animation frame se existir
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      
      document.removeEventListener('mousemove', handleMouseMove, { passive: false } as AddEventListenerOptions);
      document.removeEventListener('mouseup', handleMouseUp, { passive: false } as AddEventListenerOptions);
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: false } as AddEventListenerOptions);
    document.addEventListener('mouseup', handleMouseUp, { passive: false } as AddEventListenerOptions);
  };

  // Função para redimensionar pela borda (handles) - com suporte a bordas individuais
  const handleBorderResize = (e: React.MouseEvent, direction: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w') => {
    e.stopPropagation();
    e.preventDefault();
    
    setIsResizingCamera(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startPosition = { ...cameraPosition };
    let animationFrame: number;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      
      animationFrame = requestAnimationFrame(() => {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newWidth = startPosition.width;
        let newHeight = startPosition.height;
        let newX = startPosition.x;
        let newY = startPosition.y;

        // Aplicar delta baseado na direção
        switch (direction) {
          case 'se': // sudeste (bottom-right)
            newWidth = Math.max(160, Math.min(startPosition.width + deltaX, 640));
            newHeight = Math.max(120, Math.min(startPosition.height + deltaY, 480));
            break;
          case 'sw': // sudoeste (bottom-left)
            newWidth = Math.max(160, Math.min(startPosition.width - deltaX, 640));
            newHeight = Math.max(120, Math.min(startPosition.height + deltaY, 480));
            newX = startPosition.x + (startPosition.width - newWidth);
            break;
          case 'ne': // nordeste (top-right)
            newWidth = Math.max(160, Math.min(startPosition.width + deltaX, 640));
            newHeight = Math.max(120, Math.min(startPosition.height - deltaY, 480));
            newY = startPosition.y + (startPosition.height - newHeight);
            break;
          case 'nw': // noroeste (top-left)
            newWidth = Math.max(160, Math.min(startPosition.width - deltaX, 640));
            newHeight = Math.max(120, Math.min(startPosition.height - deltaY, 480));
            newX = startPosition.x + (startPosition.width - newWidth);
            newY = startPosition.y + (startPosition.height - newHeight);
            break;
          case 'e': // leste (right)
            newWidth = Math.max(160, Math.min(startPosition.width + deltaX, 640));
            break;
          case 'w': // oeste (left)
            newWidth = Math.max(160, Math.min(startPosition.width - deltaX, 640));
            newX = startPosition.x + (startPosition.width - newWidth);
            break;
          case 's': // sul (bottom)
            newHeight = Math.max(120, Math.min(startPosition.height + deltaY, 480));
            break;
          case 'n': // norte (top)
            newHeight = Math.max(120, Math.min(startPosition.height - deltaY, 480));
            newY = startPosition.y + (startPosition.height - newHeight);
            break;
        }
        
        const newScale = newWidth / 320;
        
        updateCameraPosition({ 
          x: newX,
          y: newY,
          width: newWidth, 
          height: newHeight,
          scale: newScale
        });
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      setIsResizingCamera(false);
      
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      
      document.removeEventListener('mousemove', handleMouseMove, { passive: false } as AddEventListenerOptions);
      document.removeEventListener('mouseup', handleMouseUp, { passive: false } as AddEventListenerOptions);
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: false } as AddEventListenerOptions);
    document.addEventListener('mouseup', handleMouseUp, { passive: false } as AddEventListenerOptions);
  };

  const handleStartStream = async () => {
    if (!streamId) return;
    
    setIsStarting(true);
    
    try {
      // Inicializar câmera
      const cameraInitialized = await initializeCamera();
      if (!cameraInitialized) {
        throw new Error('Falha ao inicializar câmera');
      }

      // Atualizar status no banco PRIMEIRO (nunca bloqueia)
      const success = await startStream(streamId);
      if (!success) {
        throw new Error('Falha ao iniciar transmissão no servidor');
      }

      setIsLive(true);

      // Tentar WHIP (servidor dedicado, escala para 10k viewers)
      const mediaServerUrl = import.meta.env.VITE_MEDIA_SERVER_URL;
      if (mediaServerUrl && localStream.current) {
        const { stream_key } = activeStream || { stream_key: streamId };
        const whip = new WHIPSender({
          onStatusChange: setWhipStatus,
          onError: (err) => console.warn('[WHIP]', err),
        });
        whipSenderRef.current = whip;
        whip.start(stream_key || streamId, localStream.current)
          .then(ok => {
            if (ok) console.log('✅ WHIP conectado — HLS disponível para 10k viewers');
            else console.warn('⚠️ WHIP falhou, usando LiveKit como fallback');
          })
          .catch(() => { /* fallback abaixo */ });
      }

      // LiveKit em background como fallback (funciona sem servidor dedicado)
      if (!import.meta.env.VITE_MEDIA_SERVER_URL) {
        liveKitJoinRoom(streamId, 'streamer')
          .then(async (joined) => {
            if (joined && localStream.current) {
              await liveKitPublishStream(localStream.current);
              console.log('✅ LiveKit conectado (modo fallback)');
            }
          })
          .catch((err) => console.warn('⚠️ LiveKit fallback falhou:', err));
      }
      // toast.success('Transmissão iniciada com sucesso!'); // Removido
      
    } catch (error) {
      console.error('Erro ao iniciar transmissão:', error);
      toast.error('Erro ao iniciar transmissão');
      
      // Limpar recursos em caso de erro
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
        localStream.current = null;
      }
    } finally {
      setIsStarting(false);
    }
  };

  const handleEndStream = async () => {
    if (!streamId) return;
    
    setIsEnding(true);
    
    try {
      // Parar elementos de vídeo ANTES de remover streams para evitar AbortError
      if (localVideoRef.current) {
        localVideoRef.current.pause();
        localVideoRef.current.srcObject = null;
      }
      
      if (screenShareRef.current) {
        screenShareRef.current.pause();
        screenShareRef.current.srcObject = null;
      }
      
      if (pipCameraRef.current) {
        pipCameraRef.current.pause();
        pipCameraRef.current.srcObject = null;
      }

      // Parar WHIP e LiveKit
      try {
        if (whipSenderRef.current) {
          await whipSenderRef.current.stop();
          whipSenderRef.current = null;
          setWhipStatus('idle');
        }
        await liveKitLeaveRoom();
        await stopWebRTC();
      } catch (webrtcError) {
        console.warn('Erro ao parar transmissão:', webrtcError);
      }
      
      // Parar streams locais
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (trackError) {
            console.warn('Erro ao parar track:', trackError);
          }
        });
        localStream.current = null;
      }
      
      if (screenStream.current) {
        screenStream.current.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (trackError) {
            console.warn('Erro ao parar screen track:', trackError);
          }
        });
        screenStream.current = null;
      }

      // Atualizar estados locais primeiro
      setIsLive(false);
      setIsCameraOn(false);
      setIsMicOn(false);
      setIsScreenSharing(false);

      // Atualizar status no banco com tratamento melhorado de erro
      try {
      const success = await endStream(streamId);
      if (!success) {
          console.warn('Falha ao atualizar status no servidor, mas transmissão foi encerrada localmente');
      }
      } catch (dbError) {
        console.warn('Erro ao atualizar banco de dados:', dbError);
        // Não interromper o processo se houver erro no banco
      }

      // toast.success('Transmissão encerrada com sucesso!'); // Removido
      
      // Redirecionar após alguns segundos
      setTimeout(() => {
        navigate('/live');
      }, 2000);
      
    } catch (error) {
      console.error('Erro ao encerrar transmissão:', error);
      toast.error('Erro ao encerrar transmissão');
    } finally {
      setIsEnding(false);
    }
  };

  // Função para limpar o chat
  const handleClearChat = async () => {
    if (!streamId || !user?.id) return;
    
    try {
      // Limpar mensagens localmente
      setStreamComments([]);
      // Aqui você deve implementar a lógica para limpar no banco de dados
      toast.success('Chat limpo com sucesso!');
    } catch (error) {
      console.error('Erro ao limpar chat:', error);
      toast.error('Erro ao limpar o chat');
    }
  };

  // Função para bloquear/desbloquear usuário
  const handleToggleBlockUser = async (userId: string, userName: string) => {
    if (!streamId || !user) return;

    try {
      const isBlocked = blockedUsers.includes(userId);
      
      if (isBlocked) {
        // Desbloquear usuário
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from('blocked_stream_users')
          .delete()
          .eq('stream_id', streamId)
          .eq('user_id', userId);

        if (error) throw error;
        
        setBlockedUsers(prev => prev.filter(id => id !== userId));
        toast.success(`${userName} foi desbloqueado`);
      } else {
        // Bloquear usuário
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from('blocked_stream_users')
          .insert({
            stream_id: streamId,
            user_id: userId,
            blocked_by: user.id,
            blocked_at: new Date().toISOString()
          });

        if (error) throw error;
        
        setBlockedUsers(prev => [...prev, userId]);
        toast.success(`${userName} foi bloqueado`);
      }
    } catch (error) {
      console.error('Erro ao gerenciar bloqueio:', error);
      toast.error('Erro ao gerenciar bloqueio do usuário');
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !streamId || !user || isSendingMessage) return;
    
    setIsSendingMessage(true); // Bloquear novos envios
    
    try {
      // Verificar se o usuário está bloqueado
      if (blockedUsers.includes(user.id)) {
        setAntiSpamMessage('Você foi bloqueado e não pode enviar mensagens nesta transmissão');
        return;
      }

      // Verificar se o usuário está tentando enviar uma mensagem duplicada
      const currentTime = Date.now();
      const lastMessageInfo = userLastMessages[user.id];
      const isAdmin = user.user_metadata?.isAdmin === true;
      const isStreamer = activeStream?.userId === user.id; // Verificar se é o streamer
      
      // Anti-spam só se aplica a usuários normais (não admin nem streamer)
      if (!isAdmin && !isStreamer && 
          lastMessageInfo && 
          lastMessageInfo.message === chatMessage.trim() && 
          currentTime - lastMessageInfo.timestamp < 30000) {
        
        const secondsLeft = Math.ceil((30000 - (currentTime - lastMessageInfo.timestamp)) / 1000);
        setAntiSpamMessage(`Aguarde ${secondsLeft} segundos para enviar a mesma mensagem novamente`);
        
        // Limpar a mensagem após o tempo necessário
        setTimeout(() => {
          setAntiSpamMessage(null);
        }, (secondsLeft * 1000) + 100);
        
        return;
      }
      
      // Limpar mensagem de erro se existir
      setAntiSpamMessage(null);
      
      const success = await addComment(streamId, chatMessage);
      if (success) {
        // Atualizar o registro de última mensagem do usuário (apenas para usuários normais)
        if (!isAdmin && !isStreamer) {
          setUserLastMessages(prev => ({
            ...prev,
            [user.id]: {
              message: chatMessage.trim(),
              timestamp: currentTime
            }
          }));
        }
        
        setChatMessage('');
        setShowEmojiPicker(false); // Fechar seletor de emojis após enviar
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setAntiSpamMessage('Erro ao enviar mensagem');
    } finally {
      setIsSendingMessage(false); // Liberar envios novamente
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const copyStreamUrl = () => {
    const url = `${window.location.origin}/watch/${streamId}`;
    navigator.clipboard.writeText(url);
  };

  // Função para carregar dispositivos disponíveis
  const loadAvailableDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
      
      setAudioDevices([...audioInputs, ...audioOutputs]);
      setVideoDevices(videoInputs);
      
      // Selecionar dispositivos padrão se não houver seleção
      if (!selectedMicId && audioInputs.length > 0) {
        setSelectedMicId(audioInputs[0].deviceId);
      }
      if (!selectedCameraId && videoInputs.length > 0) {
        setSelectedCameraId(videoInputs[0].deviceId);
      }
      if (!selectedHeadphoneId && audioOutputs.length > 0) {
        setSelectedHeadphoneId(audioOutputs[0].deviceId);
      }
    } catch (error) {
      console.error('Erro ao carregar dispositivos:', error);
      toast.error('Erro ao carregar dispositivos de mídia');
    }
  };

  // Função para trocar dispositivo de microfone
  const changeMicrophone = async (deviceId: string) => {
    try {
      if (localStream.current) {
        // Parar stream atual
        localStream.current.getTracks().forEach(track => track.stop());
      }

      // Criar novo stream com novo microfone
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: { deviceId: { exact: deviceId } }
      });

      localStream.current = newStream;
      setSelectedMicId(deviceId);
      
      // Atualizar refs de vídeo
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
      }
      if (pipCameraRef.current) {
        pipCameraRef.current.srcObject = newStream;
      }
    } catch (error) {
      console.error('Erro ao alterar microfone:', error);
    }
  };

  // Função para trocar dispositivo de câmera
  const changeCamera = async (deviceId: string) => {
    try {
      console.log('📹 [StreamerDashboard] Trocando câmera para:', deviceId);
      
      if (localStream.current) {
        // Parar stream atual
        console.log('🛑 [StreamerDashboard] Parando stream atual');
        localStream.current.getTracks().forEach(track => {
          console.log('🛑 [StreamerDashboard] Parando track:', track.kind, track.id);
          track.stop();
        });
      }

      // Criar novo stream com nova câmera
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: { deviceId: selectedMicId ? { exact: selectedMicId } : undefined }
      });

      console.log('✅ [StreamerDashboard] Novo stream obtido:', {
        videoTracks: newStream.getVideoTracks().length,
        audioTracks: newStream.getAudioTracks().length,
        videoTrackLabel: newStream.getVideoTracks()[0]?.label
      });

      // ✅ VERIFICAR se a nova câmera está capturando frames
      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        console.log('🔍 [StreamerDashboard] Verificando se nova câmera está capturando...');
        try {
          const imageCapture = new ImageCapture(videoTrack);
          // Aguardar um pouco para câmera "aquecer"
          await new Promise(resolve => setTimeout(resolve, 300));
          // @ts-expect-error - grabFrame exists but may not be in TypeScript definitions
          const imageBitmap = await imageCapture.grabFrame();
          console.log('✅ [StreamerDashboard] Nova câmera capturando frames!', {
            width: imageBitmap.width,
            height: imageBitmap.height
          });
          imageBitmap.close();
        } catch (e) {
          console.warn('⚠️ [StreamerDashboard] Nova câmera ainda não está capturando frames:', e);
        }
      }

      localStream.current = newStream;
      setSelectedCameraId(deviceId);
      
      // Atualizar refs de vídeo
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
        await localVideoRef.current.play().catch(e => console.warn('Erro ao reproduzir:', e));
      }
      if (pipCameraRef.current) {
        pipCameraRef.current.srcObject = newStream;
        await pipCameraRef.current.play().catch(e => console.warn('Erro ao reproduzir PiP:', e));
      }
      
      console.log('✅ [StreamerDashboard] Câmera trocada com sucesso');
      
      // Atualizar stream para viewers
      if (isLive && !isScreenSharing) {
        await updatePublisherStream(newStream);
        if (liveKitConnected) await liveKitReplaceStream(newStream);
        if (whipSenderRef.current) await whipSenderRef.current.replaceStream(newStream);
      }
    } catch (error) {
      console.error('❌ [StreamerDashboard] Erro ao alterar câmera:', error);
      toast.error('Erro ao trocar câmera');
    }
  };

  // Função para aplicar dispositivo de saída de áudio (se suportado pelo navegador)
  const changeAudioOutput = async (deviceId: string) => {
    try {
      // Verificar se o navegador suporta setSinkId
      if ('setSinkId' in HTMLMediaElement.prototype) {
        const videoElements = [localVideoRef.current, pipCameraRef.current, screenShareRef.current];
        
        for (const videoElement of videoElements) {
          if (videoElement && typeof (videoElement as HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> }).setSinkId === 'function') {
            await (videoElement as HTMLVideoElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId);
          }
        }
        
        setSelectedHeadphoneId(deviceId);
      }
    } catch (error) {
      console.error('Erro ao alterar dispositivo de saída:', error);
    }
  };

  // Funções para controle do chat pausado
  const checkScrollPosition = useCallback(() => {
    if (!chatContainerRef.current) return;
    
    const container = chatContainerRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    
    if (isAtBottom) {
      // Se chegou ao final, reativa rolagem automática
      setIsChatPaused(false);
      setHasNewMessages(false);
    } else {
      // Se não está no final, pausa o chat
      setIsChatPaused(true);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setIsChatPaused(false);
      setHasNewMessages(false);
    }
  }, []);

  const handleChatScroll = useCallback(() => {
    // Sempre verificar posição quando usuário rola manualmente
    checkScrollPosition();
  }, [checkScrollPosition]);

  // Effect para detectar novas mensagens quando o chat está pausado
  useEffect(() => {
    if (isChatPaused && streamComments.length > 0) {
      setHasNewMessages(true);
    }
  }, [streamComments, isChatPaused]);

  // Effect para scroll automático APENAS quando chat NÃO está pausado
  useEffect(() => {
    if (!isChatPaused && streamComments.length > 0) {
      setTimeout(() => {
        if (messagesEndRef.current && !isChatPaused) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [streamComments, isChatPaused]);

  if (!streamId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Transmissão não encontrada</h1>
          <Button onClick={() => navigate('/live')} variant="outline">
            Voltar para transmissões
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex h-screen">
        {/* Área principal de vídeo */}
        <div className="flex-1 relative bg-black video-container">
          {/* Vídeo principal */}
          <div className="relative h-full">
            {isScreenSharing ? (
              <div className="relative w-full h-full">
              <video
                ref={screenShareRef}
                autoPlay
                playsInline
                  className="w-full h-full object-cover bg-black"
              />

              </div>
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover bg-black -scale-x-100"
              />
            )}
            
            {!isCameraOn && !isScreenSharing && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                <div className="text-center">
                  <CameraOff className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">Câmera desligada</p>
                </div>
              </div>
            )}

            {/* Picture-in-Picture para câmera quando compartilhando tela - NOVO DESIGN */}
            {isScreenSharing && isCameraOn && (
              <div 
                className={`absolute bg-black rounded-lg overflow-hidden ${
                  isCameraFullscreen ? 'border-2 border-zinc-800' : 'border border-zinc-800'
                } cursor-move ${
                  isDraggingCamera ? 'shadow-2xl' : 'shadow-lg transition-shadow duration-200'
                } ${isResizingCamera ? 'cursor-se-resize' : ''} ${
                  isDraggingCamera || isResizingCamera ? '[transform:translateZ(0)] [will-change:transform] [backface-visibility:hidden] [perspective:1000px]' : ''
                } [left:var(--camera-x)] [top:var(--camera-y)] [width:var(--camera-width)] [height:var(--camera-height)] [z-index:var(--camera-z)]`}
                style={{
                  '--camera-x': `${cameraPosition.x}px`,
                  '--camera-y': `${cameraPosition.y}px`,
                  '--camera-width': `${cameraPosition.width}px`,
                  '--camera-height': `${cameraPosition.height}px`,
                  '--camera-z': isCameraFullscreen ? 30 : 10
                } as React.CSSProperties}
                onMouseDown={handleCameraMouseDown}
              >
                <video
                  ref={pipCameraRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
                
                {/* Handle de redimensionamento simples no canto inferior direito */}
                {!isCameraFullscreen && (
                  <div
                    className="absolute -bottom-1 -right-1 w-4 h-4 cursor-se-resize opacity-0 hover:opacity-60 transition-opacity rounded-br-lg [background:linear-gradient(-45deg,transparent_30%,rgba(255,255,255,0.8)_30%,rgba(255,255,255,0.8)_70%,transparent_70%)]"
                    onMouseDown={handleCameraResize}
                    title="Arrastar para redimensionar"
                  />
                )}
                
                                  {/* Controles da câmera PiP */}
                <div className={`absolute inset-0 bg-black/10 transition-opacity duration-200 ${
                  isDraggingCamera || isResizingCamera ? 'opacity-100' : 'opacity-0 hover:opacity-100'
                }`}>
                  {/* Indicador de arrastar */}
                  <div className="absolute top-2 left-2">
                    <Move className="w-4 h-4 text-white/60" />
                  </div>
                  
                  {/* Botão de fullscreen/minimize */}
                  <button
                    className="absolute top-2 right-2 w-8 h-8 bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/90 transition-colors border border-zinc-700/50"
                    onClick={toggleCameraFullscreen}
                    title={isCameraFullscreen ? "Minimizar câmera" : "Expandir câmera"}
                  >
                    {isCameraFullscreen ? (
                      <Minimize className="w-4 h-4 text-white/90" />
                    ) : (
                      <Maximize className="w-4 h-4 text-white/90" />
                    )}
                  </button>
                </div>
              </div>
            )}




          </div>

          {/* Controles de transmissão */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40">
            <div className="bg-black/70 backdrop-blur-md rounded-full px-6 py-3 flex items-center space-x-4 border border-zinc-800/50">
              {!isLive ? (
                <Button
                  onClick={handleStartStream}
                  disabled={isStarting}
                  className="bg-red-600 hover:bg-red-700 text-white px-6"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Iniciando...
                    </>
                  ) : (
                    <>
                      <Circle className="w-4 h-4 mr-2" />
                      Iniciar Transmissão
                    </>
                  )}
                </Button>
              ) : (
                <>
                  {/* Controles de áudio e vídeo com seletores */}
                  <div className="relative device-selector">
                    <div className="flex">
                  <Button
                        variant="ghost"
                    size="icon"
                    onClick={toggleMicrophone}
                        className={`rounded-full rounded-r-none ${
                          isMicOn 
                            ? 'bg-zinc-800/80 hover:bg-zinc-700/80 text-white border border-zinc-600/50' 
                            : 'bg-red-900/80 hover:bg-red-800/80 text-red-200 border border-red-700/50'
                        } backdrop-blur-sm transition-all`}
                        title={isMicOn ? "Desligar microfone" : "Ligar microfone"}
                  >
                    {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowMicSelector(!showMicSelector)}
                        className={`rounded-full rounded-l-none border-l ${
                          isMicOn 
                            ? 'bg-zinc-800/80 hover:bg-zinc-700/80 text-white border-zinc-600/50 border-l-zinc-500' 
                            : 'bg-red-900/80 hover:bg-red-800/80 text-red-200 border-red-700/50 border-l-red-600'
                        } backdrop-blur-sm transition-all px-2`}
                        title="Selecionar microfone"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </div>
                    {showMicSelector && (
                      <div className="absolute bottom-full left-0 mb-2 bg-zinc-800 border border-zinc-700 rounded-md py-1 z-50 min-w-48">
                        {audioDevices.filter(device => device.kind === 'audioinput').map((device) => (
                          <button
                            key={device.deviceId}
                            onClick={() => {
                              changeMicrophone(device.deviceId);
                              setShowMicSelector(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-700 ${
                              selectedMicId === device.deviceId ? 'bg-blue-600 text-white' : 'text-zinc-300'
                            }`}
                          >
                            <Mic className="w-3 h-3 inline mr-2" />
                            {device.label || `Microfone ${device.deviceId.slice(0, 8)}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative device-selector">
                    <div className="flex">
                  <Button
                        variant="ghost"
                    size="icon"
                    onClick={toggleCamera}
                        className={`rounded-full rounded-r-none ${
                          isCameraOn 
                            ? 'bg-zinc-800/80 hover:bg-zinc-700/80 text-white border border-zinc-600/50' 
                            : 'bg-red-900/80 hover:bg-red-800/80 text-red-200 border border-red-700/50'
                        } backdrop-blur-sm transition-all`}
                        title={isCameraOn ? "Desligar câmera" : "Ligar câmera"}
                  >
                    {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowCameraSelector(!showCameraSelector)}
                        className={`rounded-full rounded-l-none border-l ${
                          isCameraOn 
                            ? 'bg-zinc-800/80 hover:bg-zinc-700/80 text-white border-zinc-600/50 border-l-zinc-500' 
                            : 'bg-red-900/80 hover:bg-red-800/80 text-red-200 border-red-700/50 border-l-red-600'
                        } backdrop-blur-sm transition-all px-2`}
                        title="Selecionar câmera"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </div>
                    {showCameraSelector && (
                      <div className="absolute bottom-full left-0 mb-2 bg-zinc-800 border border-zinc-700 rounded-md py-1 z-50 min-w-48">
                        {videoDevices.map((device) => (
                          <button
                            key={device.deviceId}
                            onClick={() => {
                              changeCamera(device.deviceId);
                              setShowCameraSelector(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-700 ${
                              selectedCameraId === device.deviceId ? 'bg-blue-600 text-white' : 'text-zinc-300'
                            }`}
                          >
                            <Video className="w-3 h-3 inline mr-2" />
                            {device.label || `Câmera ${device.deviceId.slice(0, 8)}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Botão de Fone/Headphone */}
                  <div className="relative device-selector">
                  <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowHeadphoneSelector(!showHeadphoneSelector)}
                      className="rounded-full bg-zinc-800/80 hover:bg-zinc-700/80 text-white border border-zinc-600/50 backdrop-blur-sm transition-all"
                      title="Dispositivos de saída de áudio"
                    >
                      <Headphones className="w-4 h-4" />
                    </Button>
                    {showHeadphoneSelector && (
                      <div className="absolute bottom-full left-0 mb-2 bg-zinc-800 border border-zinc-700 rounded-md py-1 z-50 min-w-48">
                        {audioDevices.filter(device => device.kind === 'audiooutput').map((device) => (
                          <button
                            key={device.deviceId}
                            onClick={() => {
                              changeAudioOutput(device.deviceId);
                              setShowHeadphoneSelector(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-700 ${
                              selectedHeadphoneId === device.deviceId ? 'bg-blue-600 text-white' : 'text-zinc-300'
                            }`}
                          >
                            <Headphones className="w-3 h-3 inline mr-2" />
                            {device.label || `Fone ${device.deviceId.slice(0, 8)}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                    className={`rounded-full ${
                      isScreenSharing 
                        ? 'bg-green-900/80 hover:bg-green-800/80 text-green-200 border border-green-700/50' 
                        : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-white border border-zinc-600/50'
                    } backdrop-blur-sm transition-all`}
                    title={isScreenSharing ? "Parar compartilhamento de tela" : "Compartilhar tela"}
                  >
                    {isScreenSharing ? (
                      <div className="flex items-center">
                        <MonitorOff className="w-4 h-4" />
                      </div>
                    ) : (
                      <Monitor className="w-4 h-4" />
                    )}
                  </Button>

                  <Separator orientation="vertical" className="h-6" />

                  {/* Controles de tamanho da câmera quando compartilhando tela */}
                  {isScreenSharing && isCameraOn && (
                    <>
                      <div className="flex items-center space-x-1 bg-black/60 rounded-full px-2 py-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newScale = Math.max(0.3, cameraPosition.scale - 0.1);
                            resizeCamera(newScale);
                          }}
                          className="h-8 w-8 hover:bg-white/20"
                          title="Diminuir câmera"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        
                        <span className="text-xs text-white/80 px-2 min-w-[40px] text-center">
                          {Math.round(cameraPosition.scale * 100)}%
                        </span>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newScale = Math.min(2, cameraPosition.scale + 0.1);
                            resizeCamera(newScale);
                          }}
                          className="h-8 w-8 hover:bg-white/20"
                          title="Aumentar câmera"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      
                      <Separator orientation="vertical" className="h-6" />
                    </>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowStreamSettings(!showStreamSettings)}
                    className={`rounded-full ${
                      showStreamSettings 
                        ? 'bg-blue-900/80 hover:bg-blue-800/80 text-blue-200 border border-blue-700/50' 
                        : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-white border border-zinc-600/50'
                    } backdrop-blur-sm transition-all`}
                    title="Configurações da transmissão"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (isScreenSharing && isCameraOn) {
                        // Se está compartilhando tela, expandir/minimizar câmera PiP
                        toggleCameraFullscreen();
                      } else {
                        // Comportamento normal de tela cheia
                        setIsFullscreen(!isFullscreen);
                      }
                    }}
                    className={`rounded-full ${
                      (isFullscreen || isCameraFullscreen)
                        ? 'bg-purple-900/80 hover:bg-purple-800/80 text-purple-200 border border-purple-700/50' 
                        : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-white border border-zinc-600/50'
                    } backdrop-blur-sm transition-all`}
                    title={
                      isScreenSharing && isCameraOn 
                        ? (isCameraFullscreen ? "Minimizar câmera" : "Expandir câmera")
                        : (isFullscreen ? "Sair da tela cheia" : "Tela cheia")
                    }
                  >
                    {(isFullscreen || isCameraFullscreen) ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setChatVisible(!chatVisible)}
                    className={`rounded-full ${
                      chatVisible 
                        ? 'bg-orange-900/80 hover:bg-orange-800/80 text-orange-200 border border-orange-700/50' 
                        : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-white border border-zinc-600/50'
                    } backdrop-blur-sm transition-all`}
                    title={chatVisible ? "Ocultar chat" : "Mostrar chat"}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>

                  <Separator orientation="vertical" className="h-6" />

                  {/* Estatísticas em tempo real */}
                  <div className="flex items-center space-x-3 text-sm text-gray-300">
                    <div className="flex items-center space-x-1">
                      <Eye className="w-4 h-4" />
                      <span>{totalViewerCount}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{formatDuration(streamStats.duration)}</span>
                    </div>
                  </div>

                  <Separator orientation="vertical" className="h-6" />

                  {/* Botão de encerrar */}
                  <Button
                    variant="destructive"
                    onClick={handleEndStream}
                    disabled={isEnding}
                    className="px-4"
                  >
                    {isEnding ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Encerrando...
                      </>
                    ) : (
                      <>
                        <Square className="w-4 h-4 mr-2" />
                        Encerrar
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Painel lateral - Chat com controle de largura */}
        {chatVisible && (
          <>
            {/* Barra de redimensionamento do chat - mais limpa */}
            <div
              className="w-1 bg-transparent hover:bg-blue-500/20 cursor-col-resize transition-all duration-200 flex-shrink-0 group relative"
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizingChat(true);
                setChatResizeStartX(e.clientX);
                setChatResizeStartWidth(chatWidth);
              }}
              title="Arrastar para ajustar largura do chat"
            >
              <div className="absolute inset-y-0 left-1/2 w-px bg-zinc-600 group-hover:bg-blue-400 transition-colors transform -translate-x-1/2"></div>
            </div>
            
            <div 
              className="backdrop-blur-xl flex flex-col transition-all duration-200 h-full [width:var(--chat-width)]"
              style={{ '--chat-width': `${chatWidth}px` } as React.CSSProperties}
            >
              <EnhancedMinimalChat
                messages={streamComments.map(comment => ({
                  id: comment.id,
                  userId: comment.userId,
                  userName: comment.userName,
                  userAvatar: comment.userAvatar,
                  content: comment.message,
                  timestamp: comment.timestamp,
                  isHost: comment.isStreamer,
                  isModerator: false
                }))}
                onSendMessage={async (content) => {
                  if (streamId && user) {
                    const success = await addComment(streamId, content);
                    if (!success) {
                      console.error('Falha ao enviar mensagem');
                    }
                  }
                }}
                currentUserId={user?.id || ''}
                streamId={streamId || ''}
                streamerId={user?.id || ''}
                viewerCount={totalViewerCount}
                isStreamer={true}
                chatEnabled={chatEnabled}
                linksAllowed={linksAllowed}
                linksModeratorOnly={linksModeratorOnly}
                onClose={() => setChatVisible(false)}
              />
            </div>
          </>
        )}

        {/* Botão para mostrar chat quando oculto */}
        {!chatVisible && (
          <Button
            onClick={() => setChatVisible(true)}
            className="fixed right-4 top-1/2 transform -translate-y-1/2 bg-blue-500/50 hover:bg-blue-500/60 text-white/90 border border-blue-400/40 backdrop-blur-xl transition-all shadow-lg"
            size="icon"
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Painel de configurações ultra minimalista (padrão Admin) */}
      <StreamSettingsPanel
        isOpen={showStreamSettings}
        onClose={() => setShowStreamSettings(false)}
        streamId={streamId}
        
        streamTitle={streamTitle}
        setStreamTitle={setStreamTitle}
        streamDescription={streamDescription}
        setStreamDescription={setStreamDescription}
        streamLanguage={streamLanguage}
        setStreamLanguage={setStreamLanguage}
        streamTags={streamTags}
        setStreamTags={setStreamTags}
        
        chatEnabled={chatEnabled}
        setChatEnabled={setChatEnabled}
        chatDelaySeconds={chatDelaySeconds}
        setChatDelaySeconds={setChatDelaySeconds}
        subscribersOnly={subscribersOnly}
        setSubscribersOnly={setSubscribersOnly}
        linksAllowed={linksAllowed}
        setLinksAllowed={setLinksAllowed}
        linksModeratorOnly={linksModeratorOnly}
        setLinksModeratorOnly={setLinksModeratorOnly}

        viewerCount={totalViewerCount}
        peakViewers={streamStats.peakViewers}
        duration={streamStats.duration}
        totalMessages={streamStats.totalMessages}
        
        realViewers={realViewerCount}
        onViewersUpdate={(total, added) => {
          setTotalViewerCount(total);
          setAddedViewers(added);
        }}
        
        onSave={async () => {
          if (streamId) {
            await updateStream(streamId, {
              title: streamTitle,
              description: streamDescription,
              language: streamLanguage,
              tags: streamTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
            });
            toast.success('Configurações salvas com sucesso!');
            setShowStreamSettings(false);
          }
        }}
        isSaving={false}
      />

      {/* Modal de confirmação ao sair - REMOVIDO */}
    </div>
  );
} 