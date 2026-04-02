import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveStream } from '@/contexts/LiveStreamContext';
import { useLiveStreamPermission } from '@/components/LiveStreamPermissionProvider';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PeerPublisher, PeerViewer, PeerConnectionStatus } from '@/services/webrtc/peerService';
import {
  MessageSquare,
  Send,
  Mic,
  MicOff,
  Camera,
  VideoOff,
  X,
  Monitor,
  Settings,
  MoreVertical,
  PhoneOff,
  BadgeCheck,
  Eye,
  Clock,
  Signal,
  Video,
  Users,
  ChevronLeft,
  Share2,
  RefreshCw,
  CheckCircle2,
  UserPlus,
  Shield,
  ShieldAlert,
  Hand,
  Volume2,
  VolumeX,
  Pause,
  ArrowDown
} from 'lucide-react';

// Adicionar a interface StreamComment
interface StreamComment {
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

// Função para limpar todos os recursos de mídia
const cleanupAllMediaResources = () => {
  console.log('Limpando TODOS os recursos de mídia do navegador...');
  
  try {
    // Tentar acessar a propriedade global de streams de mídia (não documentada oficialmente)
    if (typeof navigator.mediaDevices !== 'undefined') {
      // Forçar liberação de todas as streams ativas no navegador
      const mediaDevices = navigator.mediaDevices as MediaDevices & { _activeStreams?: Record<string, MediaStream> };
      if (mediaDevices._activeStreams) {
        console.log(`Encontradas ${Object.keys(mediaDevices._activeStreams).length} streams ativas para liberar`);
        Object.values(mediaDevices._activeStreams).forEach((stream: MediaStream) => {
          stream.getTracks().forEach(track => {
            track.stop();
            console.log(`Track global ${track.kind}:${track.label} interrompida forçadamente`);
          });
        });
      }
    }
    
    // Tentar liberar recursos em todas as streams de vídeo no DOM (método alternativo)
    document.querySelectorAll('video').forEach(videoEl => {
      if (videoEl.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => {
            track.stop();
            console.log(`Track de vídeo DOM ${track.kind}:${track.label} interrompida`);
          });
          videoEl.srcObject = null;
        }
      }
    });
    
    return true;
  } catch (error) {
    console.error('Erro ao limpar recursos de mídia:', error);
    return false;
  }
};

const MeetingRoom = () => {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canStartLive, userRole, isAdmin } = useLiveStreamPermission();
  const { 
    activeStream, 
    fetchStreamById, 
    comments, 
    fetchComments, 
    addComment, 
    startStream,
    endStream 
  } = useLiveStream();

  // Refs para elementos de mídia
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const screenPreviewRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  // Refs para a câmera flutuante
  const floatingCameraRef = useRef<HTMLVideoElement>(null);
  const floatingCameraContainerRef = useRef<HTMLDivElement>(null);
  
  // Estados da reunião
  const [isLoading, setIsLoading] = useState(true);
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [isHost, setIsHost] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showScreenDialog, setShowScreenDialog] = useState(false);
  const [screenShareType, setScreenShareType] = useState<'screen' | 'window' | 'tab'>('screen');
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);
  const [stream, setStream] = useState<MediaStream | Record<string, unknown> | null>(null);
  
  // Estado para controlar a câmera flutuante durante o compartilhamento de tela
  const [cameraPosition, setCameraPosition] = useState({ 
    x: Math.max(50, window.innerWidth * 0.05), // Garantir pelo menos 50px ou 5% da largura da tela
    y: Math.max(50, window.innerHeight * 0.05) // Garantir pelo menos 50px ou 5% da altura da tela
  });
  const [cameraSize, setCameraSize] = useState({ width: 200, height: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ width: 0, height: 0, x: 0, y: 0 });
  
  // Novos estados para funcionalidades de reunião
  const [participants, setParticipants] = useState<Array<Record<string, unknown>>>([]);
  const [isChatEnabled, setIsChatEnabled] = useState(true);
  const [isEveryoneMuted, setIsEveryoneMuted] = useState(false);
  const [raisedHands, setRaisedHands] = useState<string[]>([]);
  const [hasRaisedHand, setHasRaisedHand] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [meetingLayout, setMeetingLayout] = useState<'grid' | 'focus' | 'sidebar'>('grid');
  
  // Referência para o objeto PeerPublisher (WebRTC)
  const [peerPublisher, setPeerPublisher] = useState<PeerPublisher | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<PeerConnectionStatus>('disconnected');
  
  // Estados para configurações avançadas
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [videoQuality, setVideoQuality] = useState<'sd' | 'hd' | 'fullhd'>('fullhd');
  const [audioQuality, setAudioQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [networkQuality, setNetworkQuality] = useState<'auto' | 'low' | 'high'>('high');

  // Funções para controle do chat pausado
  const checkScrollPosition = useCallback(() => {
    if (!chatContainerRef.current) return;
    
    const container = chatContainerRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    
    if (isAtBottom) {
      setIsChatPaused(false);
      setHasNewMessages(false);
    } else {
      setIsChatPaused(true);
    }
  }, []);

  const scrollToBottomSmooth = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setIsChatPaused(false);
      setHasNewMessages(false);
    }
  }, []);

  const handleChatScroll = useCallback(() => {
    checkScrollPosition();
  }, [checkScrollPosition]);

  // Estados para estatísticas em tempo real
  const [streamStats, setStreamStats] = useState({
    bitrate: 0,
    fps: 0,
    resolution: { width: 0, height: 0 },
    networkLatency: 0,
    connectedViewers: 0,
  });
  
  // Estado para controle de erro
  const [error, setError] = useState<string | null>(null);
  
  // Verificar se estamos no modo streamer pela URL
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const isStreamerMode = queryParams.get('mode') === 'streamer';

  // Referência para o objeto PeerViewer (para espectadores)
  const [peerViewer, setPeerViewer] = useState<PeerViewer | null>(null);

  // Adicionar um novo estado para modo somente áudio
  const [isAudioOnlyMode, setIsAudioOnlyMode] = useState(false);

  // Adicionar um novo estado para controle de problemas da câmera
  const [cameraResetAttempts, setCameraResetAttempts] = useState(0);
  const [showCameraErrorHelp, setShowCameraErrorHelp] = useState(false);

  // Estados para controle do chat pausado
  const [isChatPaused, setIsChatPaused] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Estado para controle da mensagem anti-spam
  const [antiSpamMessage, setAntiSpamMessage] = useState<string | null>(null);
  
  // Estado para evitar duplo clique
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Efeito para carregar os dados da reunião
  useEffect(() => {
    let isMounted = true;
    let mediaRequested = false;
    const maxRetries = 2;
    let retryCount = 0;
    const abortController = new AbortController();
    let isDataFetched = false;
    
    // Primeira coisa a fazer: limpar TODOS os recursos de mídia existentes
    // Isso vai garantir que qualquer câmera usada em outras telas seja liberada
    cleanupAllMediaResources();
    
    // Função para carregar os dados da reunião
    const loadMeetingData = async () => {
      // Evitar carregamentos duplicados
      if (!isMounted || isDataFetched) return;
      
      // Se já temos os dados do stream, não precisamos buscar novamente
      if (stream && stream.id === streamId) {
        console.log('Stream já carregado, ignorando nova busca');
        setIsLoading(false);
        isDataFetched = true;
        return;
      }
      
      if (retryCount >= maxRetries) {
        console.log('Número máximo de tentativas excedido');
        setIsLoading(false);
        toast.error('Erro ao carregar a transmissão após várias tentativas');
      navigate('/live');
      return;
    }

      setIsLoading(true);
      
      try {
        if (!streamId) {
          toast.error('ID da reunião não fornecido');
          navigate('/live');
          return;
        }
        
        // Adicionar tratamento para caso de cancelamento
        if (abortController.signal.aborted) {
          console.log('Operação cancelada');
          return;
        }
        
        console.log(`Tentativa ${retryCount + 1} de buscar stream: ${streamId}`);
        
        // Buscar dados da transmissão com timeout
        const fetchPromise = fetchStreamById(streamId);
        const timeoutPromise = new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout ao buscar stream')), 10000)
        );
        
        const streamData = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (!streamData) {
          toast.error('Reunião não encontrada');
          navigate('/live');
          return;
        }

        // Definir tipagem adequada para o streamData para evitar erros de 'unknown'
        interface StreamData {
          id: string;
          userId: string;
          streamerName?: string;
          status?: 'scheduled' | 'live' | 'ended';
          [key: string]: unknown;
        }
        
        // Type assertion para o streamData
        const typedStreamData = streamData as unknown as StreamData;
        
        if (isMounted) {
          setStream(typedStreamData);
          isDataFetched = true;
          
          // Buscar comentários da transmissão
          try {
        await fetchComments(streamId);
          } catch (commentError) {
            console.error('Erro ao buscar comentários:', commentError);
            // Não impede o funcionamento principal se comentários falharem
          }
        
        // Verificar se o usuário é anfitrião
        const isUserHost = 
            (userRole === 'streamer' && typedStreamData.userId === user?.id) ||
          (userRole === 'admin') || 
          isAdmin;
          
        setIsHost(isUserHost);
        
        console.log('Verificação de anfitrião:', {
          email: user?.email,
          userId: user?.id,
          userRole,
          isAdmin,
            streamUserId: typedStreamData.userId,
            isHost: isUserHost
        });
        
        // Inicializar lista de participantes
        const initialParticipants = [{
            id: typedStreamData.userId,
            name: typedStreamData.streamerName || 'Anfitrião',
          avatar: user?.user_metadata?.avatar_url,
          isHost: true,
          isMuted: false,
          isCameraOff: false,
          isScreenSharing: false
        }];
        
          if (user?.id && user?.id !== typedStreamData.userId) {
          initialParticipants.push({
            id: user?.id,
            name: (user?.user_metadata?.full_name as string) || (user?.email as string) || 'Participante',
            avatar: user?.user_metadata?.avatar_url,
            isHost: false,
            isMuted: false,
            isCameraOff: false,
            isScreenSharing: false
          });
        }
        
        setParticipants(initialParticipants);
        setParticipantCount(initialParticipants.length);
        
          if (typedStreamData.status === 'live') {
            setIsMeetingActive(true);
            console.log('Transmissão já está ativa, atualizando estado');
          }
          
          // Solicitar permissões de mídia somente se necessário e com proteção contra múltiplas solicitações
          if ((isUserHost || typedStreamData.status === 'live') && !mediaRequested && !localStream) {
            console.log(`${isUserHost ? 'Usuário é o anfitrião' : 'Reunião em andamento'}, solicitando permissões de mídia`);
            mediaRequested = true;
            try {
          await requestMediaPermissions();
            } catch (mediaError) {
              console.error('Erro ao solicitar permissões de mídia:', mediaError);
              // Não tenta novamente aqui para evitar loops
        }
          }
        }
      } catch (error) {
        console.error('Erro ao carregar reunião:', error);
        
        // Verificar se já foi carregado anteriormente para evitar repetição desnecessária
        if (stream && stream.id === streamId) {
          console.log('Já temos dados do stream, ignorando erro de atualização');
          setIsLoading(false);
          return;
        }
        
        // Tentar novamente apenas para erros de rede, não para erros de lógica
        const isNetworkError = error instanceof Error && 
          (['NetworkError', 'TypeError', 'AbortError', 'Timeout'].some(type => 
            error.name.includes(type) || error.message.includes(type)
          ));
          
        if (isNetworkError && retryCount < maxRetries) {
          retryCount++;
          console.log(`Tentando novamente (${retryCount}/${maxRetries})...`);
          
          if (isMounted) {
            // Aguardar um pouco antes de tentar novamente (evita ciclos muito rápidos)
            // Backoff exponencial para aumentar o tempo entre tentativas
            const delay = 1000 * Math.pow(2, retryCount);
            setTimeout(() => {
              if (isMounted) loadMeetingData();
            }, delay);
          }
        } else {
          // Não é um erro de rede ou já excedeu as tentativas
        toast.error('Erro ao carregar a reunião');
          setIsLoading(false);
        }
        return;
      } finally {
        if (isMounted) {
        setIsLoading(false);
        }
      }
    };

    // Executa apenas uma vez usando um ID de execução único
    const executionId = Math.random().toString(36).substring(2, 9);
    console.log(`[${executionId}] Executando efeito de carregamento`);
    loadMeetingData();

    // Efeito para rolar para o último comentário quando chegar um novo
    const scrollToBottom = () => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    };

    scrollToBottom();
    // Observe quando novos comentários chegarem
    const observer = new MutationObserver(scrollToBottom);
    if (chatContainerRef.current) {
      observer.observe(chatContainerRef.current, { childList: true, subtree: true });
    }

    return () => {
      console.log(`[${executionId}] Limpando efeito de carregamento`);
      isMounted = false;
      abortController.abort();
      
      // Liberar todos os recursos de mídia ao desmontar
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
          console.log(`Track ${track.kind} interrompida ao desmontar componente`);
        });
      }
      
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
      }
      
      // Limpar todas as referências para garantir que o GC remova os recursos
      setLocalStream(null);
      setScreenStream(null);
      
      // Também limpar recursos de mídia globais
      cleanupAllMediaResources();
      
      observer.disconnect();
    };
  // Usar React.useCallback para memoizar funções que são dependências do useEffect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId, navigate]);

  // Effect para detectar novas mensagens quando o chat está pausado
  useEffect(() => {
    if (isChatPaused && comments && comments.length > 0) {
      setHasNewMessages(true);
    }
  }, [comments, isChatPaused]);

  // Effect para scroll automático APENAS quando chat NÃO está pausado
  useEffect(() => {
    if (!isChatPaused && comments && comments.length > 0) {
      setTimeout(() => {
        if (messagesEndRef.current && !isChatPaused) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [comments, isChatPaused]);

  // Verificar disponibilidade de câmera
  const checkCameraAvailability = async (): Promise<boolean> => {
    try {
      console.log('Verificando disponibilidade da câmera...');
      
      // Tentar enumerar dispositivos de mídia
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      console.log(`Dispositivos de vídeo encontrados: ${videoDevices.length}`);
      
      if (videoDevices.length === 0) {
        console.warn('Nenhuma câmera detectada no sistema');
        toast.warning('Nenhuma câmera detectada no seu dispositivo');
        setIsAudioOnlyMode(true);
        return false;
      }
      
      // Verificar se podemos realmente acessar a câmera
      try {
        // Tentar uma configuração simples
        const testStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 320 },
            height: { ideal: 240 },
            frameRate: { ideal: 10 }
          }
        });
        
        // Liberar recursos imediatamente
        testStream.getTracks().forEach(track => track.stop());
        console.log('Câmera está disponível e funcionando');
        setShowCameraErrorHelp(false);
        return true;
      } catch (error) {
        console.warn('Falha no teste de acesso à câmera:', error);
        
        if (error.name === 'NotReadableError' || 
            error.name === 'AbortError' || 
            error.message?.includes('Could not start video source')) {
          
          console.error('Câmera encontrada, mas não pode ser acessada. Possível uso por outro aplicativo');
          toast.error('Não foi possível acessar sua câmera. Ela pode estar sendo usada por outro aplicativo ou estar desativada.');
          
          // Mostrar interface de ajuda
          setShowCameraErrorHelp(true);
          
          // Sugestões para o usuário
          toast.info('Tente reiniciar a câmera ou continuar apenas com áudio');
          
          setIsAudioOnlyMode(true);
          return false;
        } else if (error.name === 'NotAllowedError') {
          toast.error('Permissão para acessar a câmera foi negada');
          setShowCameraErrorHelp(true);
          return false;
        }
        
        setShowCameraErrorHelp(true);
        return false;
      }
    } catch (error) {
      console.error('Erro ao verificar disponibilidade da câmera:', error);
      setShowCameraErrorHelp(true);
      return false;
    }
  };

  // Solicitar permissões de mídia (câmera e microfone) - utilizando a abordagem que funciona na tela de configuração
  const requestMediaPermissions = async () => {
    // Limpar streams existentes antes de solicitar novos
    if (localStream) {
      console.log('Liberando recursos de mídia existentes antes de solicitar novos...');
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`Track existente ${track.kind} interrompida`);
      });
      // Limpar referência
      setLocalStream(null);
      
      // Limpar elemento de vídeo
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    }
    
    // Limpar TODOS os recursos de mídia existentes para garantir
    cleanupAllMediaResources();
    
    // Declarar as variáveis no escopo da função para evitar problemas de escopo
    let hasCamera = false;
    let hasMicrophone = false;
    
    try {
      // Verificar dispositivos disponíveis primeiro
      const devices = await navigator.mediaDevices.enumerateDevices();
      hasCamera = devices.some(device => device.kind === 'videoinput');
      hasMicrophone = devices.some(device => device.kind === 'audioinput');
      
      if (!hasCamera && !hasMicrophone) {
        toast.error('Nenhuma câmera ou microfone foi encontrado no seu dispositivo');
        setIsAudioOnlyMode(true);
        return false;
      }
      
      // Configurar restrições baseadas em dispositivos disponíveis
      const constraints = {
        video: hasCamera ? {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        } : false,
        audio: hasMicrophone ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false
      };
      
      console.log('Tentando acessar mídia com restrições:', constraints);
      
      // Solicitar acesso à câmera e/ou microfone
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setShowCameraErrorHelp(false);
      
      // Configurar stream e UI
      setIsMicEnabled(!!stream.getAudioTracks().length);
      setIsCameraEnabled(!!stream.getVideoTracks().length);
      setLocalStream(stream);
      setIsAudioOnlyMode(!stream.getVideoTracks().length);
      
      // Importante: utilizamos setTimeout para garantir que o DOM seja atualizado antes de configurar o vídeo
      setTimeout(() => {
        // Associar o stream ao elemento de vídeo
        if (localVideoRef.current) {
          console.log('Configurando vídeo local');
          localVideoRef.current.srcObject = stream;
          
          // Garantir que o vídeo seja reproduzido imediatamente
          localVideoRef.current.play().catch(e => {
            console.error('Erro ao iniciar reprodução do vídeo:', e);
          });
        } else {
          console.warn('Elemento de vídeo não encontrado');
        }
      }, 100);
      
      return true;
    } catch (err: unknown) {
      console.error('Erro ao acessar dispositivos de mídia:', err);
      
      // Mensagens de erro mais amigáveis baseadas no tipo de erro
      let mensagemErro = 'Verifique as permissões do navegador';
      
      const errorName = err instanceof Error ? err.name : String(err);
      
      if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        mensagemErro = 'Nenhum dispositivo de mídia encontrado. Conecte uma câmera ou microfone e tente novamente.';
      } else if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        mensagemErro = 'Permissão para acessar câmera/microfone negada. Verifique as configurações do seu navegador.';
      } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
        mensagemErro = 'Não foi possível acessar a câmera/microfone. O dispositivo pode estar sendo usado por outro aplicativo.';
      } else if (errorName === 'OverconstrainedError') {
        mensagemErro = 'As configurações solicitadas não são suportadas pelo seu dispositivo.';
      } else if (errorName === 'TypeError') {
        mensagemErro = 'Configuração inválida para acesso aos dispositivos.';
      }
      
      setError(`Erro ao acessar câmera/microfone: ${mensagemErro}`);
      toast.error(`Erro ao acessar câmera/microfone: ${mensagemErro}`);
      setShowCameraErrorHelp(true);
      
      // Tentar apenas com áudio se falhar com vídeo+áudio
      if (hasCamera && hasMicrophone) {
        try {
          console.log('Tentando novamente apenas com áudio...');
          const audioStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }, 
            video: false 
          });
          
          setLocalStream(audioStream);
          setIsMicEnabled(true);
          setIsCameraEnabled(false);
          setIsAudioOnlyMode(true);
          
          // Configurar o elemento de vídeo mesmo para áudio (para mostrar a interface)
          setTimeout(() => {
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = audioStream;
              localVideoRef.current.poster = "/placeholder.svg";
            }
          }, 100);
          
          return true;
        } catch (audioErr) {
          console.error('Também falhou ao acessar apenas o microfone:', audioErr);
          return false;
        }
      }
      
      return false;
    }
  };

  // Toggle câmera - implementação corrigida
  const toggleCamera = () => {
    console.log('Tentando alternar câmera. Estado atual:', isCameraEnabled);
    
    // Se estamos em modo somente áudio e tentando ativar a câmera
    if (isAudioOnlyMode && !isCameraEnabled) {
      console.log('Em modo somente áudio. Verificando se podemos usar a câmera...');
      
      // Verificar se a câmera está disponível
      checkCameraAvailability().then(available => {
        if (available) {
          // Se a câmera estiver disponível agora, desativar modo somente áudio e solicitar permissões
          setIsAudioOnlyMode(false);
          requestMediaPermissions();
      } else {
          console.error('Câmera não disponível ou em uso por outro aplicativo');
        }
      });
      return;
    }
    
    // Se não tivermos um stream local, precisamos solicitar permissões primeiro
    if (!localStream) {
      console.log('LocalStream não disponível, solicitando permissões de mídia...');
      
      requestMediaPermissions().then(success => {
        if (!success) {
          console.error('Não foi possível ativar a câmera');
        }
      });
      return;
    }
    
    // Atualizar o estado da UI primeiro para feedback imediato
    setIsCameraEnabled(!isCameraEnabled);
    
    try {
      if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      console.log('Trilhas de vídeo encontradas:', videoTracks.length);
      
        if (videoTracks.length > 0) {
          // O novo estado é o oposto do estado atual
      const newState = !isCameraEnabled;
      
      // Aplicar estado a todas as trilhas de vídeo
      videoTracks.forEach(track => {
        track.enabled = newState;
        console.log(`Trilha de vídeo "${track.label}" agora está ${newState ? 'ATIVADA' : 'DESATIVADA'}`);
      });
      
          // Se estiver ativando a câmera, atualizar o elemento de vídeo
      if (newState && localVideoRef.current) {
        console.log("Atualizando exibição do vídeo no elemento");
        
        // Garantir que o stream esteja corretamente atribuído ao elemento de vídeo
        if (localVideoRef.current.srcObject !== localStream) {
          localVideoRef.current.srcObject = localStream;
          console.log("Stream atribuído ao elemento de vídeo");
        }
        
        // Se estiver em compartilhamento de tela, vamos interromper para mostrar a câmera
        if (isScreenSharing) {
          stopScreenSharing();
        }
        
        // Tentar garantir que o vídeo seja reproduzido
        localVideoRef.current.play().catch(err => {
          console.error("Erro ao reproduzir vídeo:", err);
        });
      }
      
      // Verificar se a alteração foi aplicada
      setTimeout(() => {
        // Verificar novamente se ainda temos videoTracks (podem ter sido removidos por outro processo)
        const currentVideoTracks = localStream.getVideoTracks();
        if (currentVideoTracks.length > 0) {
          const checkState = currentVideoTracks[0]?.enabled;
          console.log('Estado do vídeo após alteração:', checkState);
          
          if (checkState !== newState) {
            console.warn('A alteração do estado do vídeo pode não ter sido aplicada corretamente');
            // Tentar forçar novamente
            currentVideoTracks.forEach(track => {
              track.enabled = newState;
            });
          }
        }
      }, 300);
        } else {
          console.error('Não há trilhas de vídeo disponíveis');
          
          // Tentar solicitar permissões novamente
          requestMediaPermissions();
        }
      } else {
        console.error('LocalStream não disponível para alternar câmera');
        
        // Tentar solicitar permissões
        requestMediaPermissions().then(success => {
          if (success) {
            // Tentar alternar novamente após obter permissões
            setTimeout(() => {
              // Apenas atualizar estado UI, já que a função será chamada novamente
              setIsCameraEnabled(!isCameraEnabled);
            }, 1000);
          }
        });
      }
    } catch (error) {
      console.error('Erro ao alternar câmera:', error);
    }
  };

  // Alternar microfone
  const toggleMicrophone = () => {
    try {
      if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
          const newState = !isMicEnabled;
          setIsMicEnabled(newState);
          
          audioTracks.forEach(track => {
            track.enabled = newState;
          });
        }
      }
    } catch (error) {
      console.error('Erro ao alternar microfone:', error);
    }
  };

  // Iniciar reunião
  const startMeeting = async () => {
    if (!streamId || !localStream) {
      console.error('Verifique sua câmera e microfone antes de iniciar');
      return;
    }
    
    try {
      console.log('Iniciando reunião. StreamID:', streamId);
      
      // Verificar se tem permissão (via LiveStreamPermissionProvider)
      if (!canStartLive) {
        console.error('Tentativa de iniciar reunião sem permissão');
        return;
      }
      
      // Verificar se já está em reunião
      if (isMeetingActive) {
        console.log('Reunião já está ativa, ignorando solicitação duplicada');
        return;
      }
      
      // Garantir que temos acesso a câmera/microfone antes de iniciar
      if (!localStream) {
        const hasMedia = await requestMediaPermissions();
        if (!hasMedia) {
          toast.error('Não foi possível acessar sua câmera e microfone');
          return;
        }
      } else {
        // Aplicar configurações de alta qualidade se já tivermos o stream
        applyStreamSettings();
      }
      
      // Notificar o usuário que estamos configurando a reunião
      toast.loading('Iniciando reunião...', { id: 'start-meeting' });
      
      // Marcar como ativa primeiro para evitar tentativas duplicadas 
      setIsMeetingActive(true);
      
      console.log('Iniciando serviço WebRTC');
      
      // Inicializar o serviço WebRTC para transmissão (com timeout)
      let webrtcSuccess = false;
      try {
        // Criar uma promise com timeout
        const webrtcPromise = initializeWebRTCPublisher();
        const timeoutPromise = new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(false), 15000); // 15 segundos de timeout
        });
        
        // Corrida entre a inicialização do WebRTC e o timeout
        webrtcSuccess = await Promise.race([webrtcPromise, timeoutPromise]);
        
        if (webrtcSuccess) {
          console.log('Serviço WebRTC inicializado com sucesso');
          toast.success('Conexão estabelecida!', { id: 'start-meeting' });
        } else {
          console.warn('Falha ou timeout ao inicializar WebRTC, mas continuando com a reunião via API');
          toast.error('Falha na conexão de vídeo, mas a reunião continuará. Tente atualizar a página.', { id: 'start-meeting' });
        }
      } catch (webrtcError) {
        console.error('Erro ao inicializar WebRTC:', webrtcError);
        toast.error('Erro na conexão de vídeo', { id: 'start-meeting' });
      }
      
      // Iniciar a transmissão no backend usando a API
      try {
      const success = await startStream(streamId);
      if (success) {
          console.log('Reunião iniciada com sucesso via API');
          
          // Atualizar UI somente se já não estiver atualizada
          if (!isMeetingActive) {
            setIsMeetingActive(true);
          }
          
          toast.success('Reunião iniciada com sucesso!', { id: 'start-meeting' });
          return;
      } else {
          console.error('Falha ao iniciar reunião via API');
          
          // Se o WebRTC teve sucesso mas a API falhou, ainda consideramos como iniciada
          // mas mostramos uma mensagem de aviso
          if (webrtcSuccess) {
            toast.error('Reunião parcialmente iniciada. Algumas funções podem estar limitadas.', { id: 'start-meeting' });
            return;
      }
      
          // Ambos falharam, reverter estado
          setIsMeetingActive(false);
          toast.error('Não foi possível iniciar a reunião. Tente novamente.', { id: 'start-meeting' });
        }
      } catch (apiError) {
        console.error('Erro na API ao iniciar reunião:', apiError);
        
        // Se o WebRTC teve sucesso mas a API falhou com erro, ainda consideramos como iniciada
        if (webrtcSuccess) {
          toast.error('Reunião parcialmente iniciada. Algumas funções podem estar limitadas.', { id: 'start-meeting' });
          return;
        }
        
        // Ambos falharam, reverter estado
      setIsMeetingActive(false);
        toast.error('Erro ao iniciar a reunião', { id: 'start-meeting' });
      }
    } catch (error) {
      console.error('Erro global ao iniciar reunião:', error);
      setIsMeetingActive(false);
      toast.error('Ocorreu um erro ao iniciar a reunião', { id: 'start-meeting' });
    }
  };

  // Encerrar reunião
  const endMeeting = async () => {
    try {
      console.log('INÍCIO DO PROCESSO DE ENCERRAMENTO DE REUNIÃO');
      toast.loading('Encerrando reunião...', { id: 'end-meeting' });
      
      // BLOCO 1: Limpeza agressiva de todos os recursos
      console.log('ETAPA 1: Limpeza agressiva de todos os recursos de mídia');
      
      // Limpar todos os recursos de mídia
      cleanupAllMediaResources();
      
      // Forçar parada de todas as trilhas de mídia
      if (localStream) {
        localStream.getTracks().forEach(track => {
          try {
            track.stop();
            console.log(`Track ${track.kind} interrompida`);
          } catch (e) {
            console.error('Erro ao parar track:', e);
          }
        });
        setLocalStream(null);
      }
      
      // Limpar compartilhamento de tela
      if (screenStream) {
        screenStream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) {
            console.error('Erro ao parar track de tela:', e);
          }
        });
        setScreenStream(null);
      }
      
      // BLOCO 2: Tentar parar comunicação WebRTC
      console.log('ETAPA 2: Encerrando comunicação WebRTC');
      if (peerPublisher) {
        try {
        await peerPublisher.stop();
        setPeerPublisher(null);
          console.log('WebRTC encerrado com sucesso');
        } catch (e) {
          console.error('Erro ao encerrar WebRTC, continuando mesmo assim:', e);
        }
      }

      // BLOCO 3: Atualizar estados locais independentemente da resposta do servidor
      console.log('ETAPA 3: Atualizando estados locais');
        setIsMeetingActive(false);
        setConnectionStatus('disconnected');
      
      // BLOCO 4: Tentar comunicar com o servidor, mas não esperar pela resposta para continuar
      console.log('ETAPA 4: Comunicando com o servidor');
      if (streamId) {
        try {
          // Iniciar a chamada ao backend mas não aguardar
          endStream(streamId).then(success => {
            console.log('Resposta do servidor sobre encerramento:', success ? 'SUCESSO' : 'FALHA');
          }).catch(err => {
            console.error('Erro na comunicação com servidor:', err);
          });
          // Não esperamos a resposta para continuar
        } catch (e) {
          console.error('Erro ao iniciar comunicação com servidor:', e);
        }
      }
      
      // BLOCO 5: Preparar para redirecionamento forçado
      console.log('ETAPA 5: Preparando redirecionamento');
      toast.success('Reunião encerrada! Redirecionando...', { id: 'end-meeting' });
      
      // BLOCO 6: FORÇA BRUTA - Redirecionamento agressivo
      console.log('ETAPA 6: REDIRECIONAMENTO FORÇADO');
      
      // Método 1: Usando window.location.replace (mais forte que href)
      setTimeout(() => {
        console.log('Tentativa 1: window.location.replace');
        window.location.replace('/live');
      }, 500);
      
      // Método 2: Backup com window.location.href
      setTimeout(() => {
        console.log('Tentativa 2: window.location.href');
        window.location.href = '/live';
      }, 1000);
      
      // Método 3: Último recurso - redirecionamento com reload completo
      setTimeout(() => {
        console.log('Tentativa 3: window.location com URL completa e reload');
        const baseUrl = window.location.origin;
        window.location.href = `${baseUrl}/live`;
        // Forçar reload após pequeno delay como último recurso
        setTimeout(() => window.location.reload(), 500);
      }, 1500);
      
    } catch (error) {
      console.error('ERRO CRÍTICO ao encerrar reunião:', error);
      
      // Mesmo com erro crítico, ainda tentamos navegar
      alert('Erro ao encerrar reunião. A página será redirecionada mesmo assim.');
      window.location.href = '/live';
    }
    
    // MÉTODO FINAL DE SEGURANÇA: Retornar false para impedir qualquer comportamento padrão que possa estar bloqueando
    return false;
  };

  // Atualizar status de um participante
  const updateParticipantStatus = (participantId?: string, action?: 'join' | 'leave' | 'toggleMic' | 'toggleCamera') => {
    if (!participantId) return;
    
    setParticipants(prev => {
      // Caso o participante esteja entrando
      if (action === 'join') {
        // Verificar se o participante já existe
        const exists = prev.some(p => p.id === participantId);
        if (exists) return prev;
        
        // Adicionar novo participante
        const newParticipant = {
          id: participantId,
          name: user?.user_metadata?.full_name || user?.email || 'Participante',
          avatar: user?.user_metadata?.avatar_url,
          isHost: false,
          isMuted: false,
          isCameraOff: false,
          isScreenSharing: false
        };
        
        return [...prev, newParticipant];
      }
      
      // Caso o participante esteja saindo
      if (action === 'leave') {
        return prev.filter(p => p.id !== participantId);
      }
      
      // Alternar microfone
      if (action === 'toggleMic') {
        return prev.map(p => 
          p.id === participantId ? { ...p, isMuted: !p.isMuted } : p
        );
      }
      
      // Alternar câmera
      if (action === 'toggleCamera') {
        return prev.map(p => 
          p.id === participantId ? { ...p, isCameraOff: !p.isCameraOff } : p
        );
      }
      
      return prev;
    });
    
    // Atualizar contagem de participantes
    setParticipantCount(participants.length);
  };

  // Silenciar todos os participantes
  const muteAllParticipants = () => {
    setParticipants(prev => 
      prev.map(p => 
        p.isHost ? p : { ...p, isMuted: true }
      )
    );
    toast.success('Todos os participantes foram silenciados');
    
    // Aqui também implementaríamos a lógica para enviar sinais WebRTC a todos os participantes
  };

  // Alternar estado do chat
  const toggleChat = () => {
    setIsChatEnabled(!isChatEnabled);
    toast.success(isChatEnabled ? 'Chat desativado' : 'Chat ativado');
  };
  
  // Levantar/abaixar a mão para pedir palavra
  const toggleRaiseHand = () => {
    // Garantir que apenas não-anfitriões possam usar essa funcionalidade
    if (isHost) {
      console.log('Anfitrião não precisa levantar a mão');
      return;
    }
    
    if (!user?.id) return;
    
    if (hasRaisedHand) {
      // Abaixar a mão
      setRaisedHands(prev => prev.filter(id => id !== user.id));
      setHasRaisedHand(false);
    } else {
      // Levantar a mão
      setRaisedHands(prev => [...prev, user.id]);
      setHasRaisedHand(true);
      
      // Notificar anfitrião (em implementação real, enviar via WebRTC ou websockets)
      toast.success('Mão levantada! O anfitrião será notificado.');
        console.log('Notificando anfitrião sobre mão levantada');
    }
  };
  
  // Permitir falar a quem levantou a mão
  const allowParticipantToSpeak = (participantId: string) => {
    // Apenas o anfitrião pode permitir participantes a falar
    if (!isHost) {
      console.log('Apenas o anfitrião pode permitir participantes a falar');
      return;
    }
    
    // Remover da lista de mãos levantadas
    setRaisedHands(prev => prev.filter(id => id !== participantId));
    
    // Habilitar áudio para o participante
    setParticipants(prev => 
      prev.map(p => 
        p.id === participantId ? { ...p, isMuted: false } : p
      )
    );
    
    // Notificar o participante (em implementação real, enviar via WebRTC ou websockets)
    toast.success(`Participante pode falar agora`);
  };

  // Verificar se a transmissão já está ativa quando o componente montar
  useEffect(() => {
    if (!activeStream) return;
    
    // Se a transmissão já estiver ativa
    if (activeStream.status === 'live') {
      console.log('Transmissão já está ativa, atualizando estado');
      setIsMeetingActive(true);
    }
  }, [activeStream]);

  // Enviar comentário
  const handleSendComment = async () => {
    if (!streamId || !newComment.trim() || isSendingMessage) return;
    
    setIsSendingMessage(true); // Bloquear novos envios
    
    try {
      // Verificar se está no final do chat antes de enviar
      const wasAtBottom = !isChatPaused;
      
      // Verificar se é admin ou streamer (host)
      const isAdmin = user?.user_metadata?.isAdmin === true;
      const isStreamer = isHost; // No MeetingRoom, isHost indica se é o streamer
      
      // Se não for admin nem streamer, verificar se pode enviar (exemplo básico)
      if (!isAdmin && !isStreamer) {
        // Aqui você pode adicionar lógica anti-spam mais complexa se necessário
        // Por exemplo, verificar se enviou mensagem recentemente
      }
      
      // Limpar mensagem de erro se existir
      setAntiSpamMessage(null);
      
      const success = await addComment(streamId, newComment);
      
      if (success) {
        setNewComment('');
        // Só rolar automaticamente se estava no final antes de enviar
        if (wasAtBottom) {
        setTimeout(() => {
            if (messagesEndRef.current) {
              messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
        }
      } else {
        setAntiSpamMessage('Não foi possível enviar o comentário');
      }
    } catch (error) {
      console.error('Erro ao enviar comentário:', error);
      setAntiSpamMessage('Erro ao enviar o comentário');
    } finally {
      setIsSendingMessage(false); // Liberar envios novamente
    }
  };

  // Auto-iniciar streaming se estiver no modo streamer
  useEffect(() => {
    if (isStreamerMode && isHost && !isMeetingActive && activeStream) {
      console.log('Modo streamer detectado, iniciando transmissão automaticamente');
      
      // Se a transmissão já está com status 'live', apenas atualizar o estado local
      if (activeStream.status === 'live') {
        setIsMeetingActive(true);
        toast.success('Transmissão ao vivo!');
      } else {
        // Caso contrário, iniciar a transmissão via API
        startMeeting();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreamerMode, isHost, activeStream, isMeetingActive]); // startMeeting é estável via useCallback

  // Compartilhamento de tela
  const handleScreenShare = async () => {
    try {
      // Opções de compartilhamento baseadas no tipo selecionado
      const displayMediaOptions: MediaStreamConstraints = {
        video: {
          cursor: 'always',
          displaySurface: screenShareType,
          // Adicionar configurações para melhorar qualidade e evitar o quadrado preto
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        } as MediaTrackConstraints,
        audio: true
      };

      // Solicitar compartilhamento de tela
      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      
      // Aplicar configurações para melhorar a qualidade
      stream.getVideoTracks().forEach(track => {
        if (track.applyConstraints) {
          track.applyConstraints({
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          }).catch(e => console.error('Erro ao aplicar configurações:', e));
        }
      });
      
      // Guardar referência do stream de câmera se estiver ativa
      if (localStream && isCameraEnabled) {
        // Configurar o elemento de vídeo flutuante com o stream da câmera
        if (floatingCameraRef.current) {
          floatingCameraRef.current.srcObject = localStream;
        }
      }
      
      // Salvar o stream para referência posterior
      setScreenStream(stream);
      setIsScreenSharing(true);

      if (localVideoRef.current) {
        // Limpar possíveis estilos e configurações anteriores
        localVideoRef.current.style.backgroundColor = 'transparent';
        localVideoRef.current.style.border = 'none';
        
        // Mostrar o compartilhamento de tela em vez da câmera
        localVideoRef.current.srcObject = stream;
        toast.success('Compartilhamento de tela ativado!');
        
        // Configurar listener para quando o usuário interromper o compartilhamento
        stream.getVideoTracks()[0].onended = () => {
          stopScreenSharing();
        };
      }
    } catch (error) {
      console.error('Erro ao compartilhar tela:', error);
      toast.error('Não foi possível compartilhar sua tela');
    }
    
    // Fechar o diálogo
    setShowScreenDialog(false);
  };

  // Parar compartilhamento de tela
  const stopScreenSharing = async () => {
    // Parar todas as trilhas do stream de tela
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
    
    setIsScreenSharing(false);
    toast.info('Compartilhamento de tela finalizado');
    
    // Resetar estilos de vídeo
    if (localVideoRef.current) {
      localVideoRef.current.style.backgroundColor = 'black';
      // Remover o objeto de mídia atual antes de configurar o novo
      localVideoRef.current.srcObject = null;
      
      // Pequeno delay para garantir que a transição seja suave
      setTimeout(() => {
        // Voltar para a câmera
        if (localStream && localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        } else {
          // Se não tiver stream de câmera, solicitar novamente
          requestMediaPermissions();
        }
      }, 50);
    }
  };

  // Aplicar configurações de qualidade
  const applyStreamSettings = () => {
    if (!localStream) return;
    
    try {
      // Aplicar configurações de vídeo
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const videoTrack = videoTracks[0];
        
        // Obter as configurações atuais
        const settings = videoTrack.getSettings();
        
        // Configurações sempre com qualidade máxima
        const newWidth = 1920;
        const newHeight = 1080;
        const newFrameRate = 30;
        
        // Aplicar configurações se o navegador suportar
        if (videoTrack.applyConstraints) {
          videoTrack.applyConstraints({
            width: { ideal: newWidth },
            height: { ideal: newHeight },
            frameRate: { ideal: newFrameRate },
          }).then(() => {
            console.log('Configurações de vídeo aplicadas:', {
              width: newWidth,
              height: newHeight,
              frameRate: newFrameRate
            });
          }).catch(error => {
            console.error('Erro ao aplicar configurações de vídeo:', error);
          });
        }
      }
      
      console.log('Configurações de alta qualidade aplicadas automaticamente');
    } catch (error) {
      console.error('Erro ao aplicar configurações:', error);
      toast.error('Não foi possível aplicar as configurações');
    }
  };

  // Atualizar estatísticas periodicamente
  useEffect(() => {
    if (!isMeetingActive || !localStream) return;
    
    // Função para coletar estatísticas
    const collectStats = () => {
      // Em uma implementação real, estas estatísticas seriam obtidas do serviço WebRTC
      // Aqui estamos apenas simulando valores
      setStreamStats({
        bitrate: Math.floor(Math.random() * 5000) + 1000, // 1000-6000 kbps
        fps: videoQuality === 'fullhd' ? 30 : (videoQuality === 'hd' ? 30 : 24),
        resolution: { 
          width: videoQuality === 'fullhd' ? 1920 : (videoQuality === 'hd' ? 1280 : 640),
          height: videoQuality === 'fullhd' ? 1080 : (videoQuality === 'hd' ? 720 : 480),
        },
        networkLatency: Math.floor(Math.random() * 300) + 50, // 50-350ms
        connectedViewers: participantCount,
      });
    };
    
    // Coletar estatísticas iniciais
    collectStats();
    
    // Configurar intervalo para atualizar estatísticas
    const statsInterval = setInterval(collectStats, 5000);
    
    // Limpar intervalo quando o componente for desmontado
    return () => clearInterval(statsInterval);
  }, [isMeetingActive, localStream, videoQuality, participantCount]);

  // Inicializar serviço PeerJS para transmissão
  const initializeWebRTCPublisher = async (): Promise<boolean> => {
    console.log('🔍 [WebRTC Publisher] Iniciando verificação de pré-requisitos:', {
      streamId: !!streamId,
      userId: user?.id,
      hasLocalStream: !!localStream,
      videoTracks: localStream?.getVideoTracks().length,
      audioTracks: localStream?.getAudioTracks().length
    });

    if (!streamId || !user || !localStream) {
      console.error('❌ [WebRTC Publisher] Inicialização falhou: requisitos não atendidos',
        !streamId ? 'Sem streamId' : !user ? 'Sem usuário' : 'Sem stream local');
      return false;
    }

    try {
      console.log('🔍 [WebRTC Publisher] Criando instância para streamId:', streamId);
      console.log('📋 [WebRTC Publisher] Detalhes do usuário:', { id: user.id, email: user.email });
      
      // Criar uma nova instância de PeerPublisher
      const publisher = new PeerPublisher(user.id, streamId);
      console.log('✅ [WebRTC Publisher] Instância criada com sucesso');
      
      // Configurar listeners de status
      publisher.onStatusChange((status) => {
        console.log(`🔄 [WebRTC Publisher] Status alterado: ${status}`);
        setConnectionStatus(status);
        
        if (status === 'connected') {
          toast.success('Conexão WebRTC estabelecida com sucesso!');
          console.log('🎉 [WebRTC Publisher] Conexão estabelecida com sucesso');
        } else if (status === 'failed') {
          toast.error('Falha na conexão WebRTC');
          console.error('💥 [WebRTC Publisher] Falha na conexão');
        } else if (status === 'connecting') {
          console.log('⏳ [WebRTC Publisher] Tentando estabelecer conexão...');
        } else if (status === 'disconnected') {
          console.log('🔌 [WebRTC Publisher] Conexão encerrada');
        }
      });
      
      // Configurar listener de espectadores
      publisher.onViewerConnected((viewerId) => {
        console.log('👁️ [WebRTC Publisher] Novo espectador conectado:', viewerId);
        // Atualizar contagem de espectadores
        setParticipantCount(prev => prev + 1);
      });
      
      publisher.onViewerDisconnected((viewerId) => {
        console.log('👋 [WebRTC Publisher] Espectador desconectado:', viewerId);
        // Atualizar contagem de espectadores
        setParticipantCount(prev => Math.max(0, prev - 1));
      });
      
      // Configurar listener de erros
      publisher.onError((error) => {
        console.error('💥 [WebRTC Publisher] Erro:', error);
        toast.error(`Erro na transmissão: ${error.message}`);
      });
      
      console.log('🎥 [WebRTC Publisher] Preparando para inicializar com stream local:', {
        hasVideoTracks: localStream.getVideoTracks().length,
        videoSettings: localStream.getVideoTracks()[0]?.getSettings(),
        hasAudioTracks: localStream.getAudioTracks().length,
        audioSettings: localStream.getAudioTracks()[0]?.getSettings()
      });
      
      // Inicializar com o stream local
      console.log('🔄 [WebRTC Publisher] Chamando método initialize...');
      const success = await publisher.initialize(localStream);
      
      if (success) {
        setPeerPublisher(publisher);
        console.log('✅ [WebRTC Publisher] Inicialização bem-sucedida');
        
        // Expor o publisher para depuração
        if (typeof window !== 'undefined') {
          window.publisherPeer = publisher;
          console.log('🛠️ [WebRTC Publisher] Objeto exposto para depuração como window.publisherPeer');
        }
        
        // Forçar atualização do estado para garantir renderização correta
        setIsMeetingActive(true);
        console.log('📺 [WebRTC Publisher] Estado de transmissão ativado');
        
        return true;
      } else {
        console.error('❌ [WebRTC Publisher] Falha na inicialização');
        return false;
      }
    } catch (error) {
      console.error('💥 [WebRTC Publisher] Erro crítico na inicialização:', error);
      return false;
    }
  };

  // Inicializar o serviço WebRTC para visualização (espectador)
  const initializeWebRTCViewer = async () => {
    // Variável para verificar se é streamer a partir da URL
    const isStreamerMode = queryParams.get('mode') === 'streamer';
    
    console.log('🔍 [WebRTC Viewer] Iniciando inicialização com params:', {
      streamId,
      userId: user?.id,
      remoteVideoRef: !!remoteVideoRef.current,
      isStreamerMode,
      streamData: stream
    });

    if (!streamId || !remoteVideoRef.current || isHost || !stream) {
      console.error('❌ [WebRTC Viewer] Inicialização falhou:',
        !streamId ? 'Sem streamId' : 
        !remoteVideoRef.current ? 'Elemento de vídeo não disponível' : 
        isHost ? 'É o dono do stream' : 'Sem dados do stream');
      return false;
    }

    try {
      const streamUserId = stream && typeof stream === 'object' && 'userId' in stream ? String(stream.userId) : streamId;
      
      console.log('🚀 [WebRTC Viewer] Criando instância para streamId:', streamId);
      console.log('🎯 [WebRTC Viewer] Publisher User ID:', streamUserId);
      
      // BUG CORRIGIDO: Usar stream.userId (o criador da stream) como publisherId, não o streamId
      const viewer = new PeerViewer(
        user?.id || 'anonymous', 
        streamUserId, // ← AQUI ESTÁ A CORREÇÃO PRINCIPAL! Antes estava usando streamId
        remoteVideoRef
      );
      
      console.log('✅ [WebRTC Viewer] Instância criada com sucesso');
      console.log('🔗 [WebRTC Viewer] Conectando viewer ao publisher:', {
        viewerId: user?.id,
        publisherId: streamUserId, // Publisher é quem criou a stream
        streamId: streamId
      });
      
      setPeerViewer(viewer);
      
      // Registrar evento de conexão estabelecida
      viewer.onStatusChange((status) => {
        console.log(`🔄 [WebRTC Viewer] Status alterado: ${status}`);
        setConnectionStatus(status);
        
        if (status === 'connected') {
          toast.success('📺 Conectado à transmissão!', { id: 'viewer-connect' });
          console.log('🎉 [WebRTC Viewer] Conexão estabelecida com sucesso');
          setError(null); // Limpar erros anteriores
        } else if (status === 'connecting') {
          toast.loading('⏳ Conectando à transmissão...', { id: 'viewer-connect' });
          console.log('⏳ [WebRTC Viewer] Tentando estabelecer conexão...');
        } else if (status === 'disconnected') {
          toast.info('🔌 Desconectado da transmissão', { id: 'viewer-connect' });
          console.log('🔌 [WebRTC Viewer] Conexão encerrada');
        } else if (status === 'failed') {
          toast.error('❌ Falha ao conectar à transmissão', { id: 'viewer-connect' });
          console.error('💥 [WebRTC Viewer] Falha na conexão');
          
          // Não fazer retry automático aqui, deixar o useEffect lidar com isso
          setError('Erro ao conectar à transmissão. Tentativas de reconexão em andamento...');
        }
      });

      // Registrar evento de adição de stream
      viewer.onStreamAdded((stream) => {
        console.log('📹 [WebRTC Viewer] Stream remoto recebido:', {
          streamId: stream.id,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          videoTrackEnabled: stream.getVideoTracks()[0]?.enabled,
          audioTrackEnabled: stream.getAudioTracks()[0]?.enabled
        });
        
        if (remoteVideoRef.current) {
          console.log('🖥️ [WebRTC Viewer] Atribuindo stream ao elemento de vídeo');
          remoteVideoRef.current.srcObject = stream;
          
          // Configurar element de vídeo para melhor experiência
          remoteVideoRef.current.autoplay = true;
          remoteVideoRef.current.playsInline = true;
          remoteVideoRef.current.muted = false; // Permitir áudio
          
          remoteVideoRef.current.play().catch(err => {
            console.error('❌ [WebRTC Viewer] Erro ao reproduzir vídeo:', err);
            // Se falhar devido a política de autoplay, mostrar botão para usuário clicar
            if (err.name === 'NotAllowedError') {
              console.log('👆 [WebRTC Viewer] Reprodução requer interação do usuário');
              setNeedsUserInteraction(true);
              toast.info('Clique no vídeo para ativar o áudio', { duration: 5000 });
            }
          });
        } else {
          console.error('⛔ [WebRTC Viewer] Elemento de vídeo remoto não está disponível');
        }
      });

      // Registrar evento de erro
      viewer.onError((error) => {
        console.error('💥 [WebRTC Viewer] Erro na conexão:', error);
        toast.error(`Erro na conexão: ${error.message}`);
        
        // Se o erro for de publisher não encontrado, tentar novamente após delay
        if (error.message.includes('não está disponível')) {
          setTimeout(() => {
            console.log('🔄 [WebRTC Viewer] Tentando novamente após erro...');
            initializeWebRTCViewer();
          }, 5000);
        }
      });

      // Inicializar visualizador
      console.log('🔄 [WebRTC Viewer] Inicializando com elemento de vídeo');
      const success = await viewer.initialize();
      
      if (success) {
        console.log('✅ [WebRTC Viewer] Inicialização bem-sucedida');
        return true;
      } else {
        console.error('❌ [WebRTC Viewer] Falha na inicialização');
        return false;
      }
    } catch (error) {
      console.error('💥 [WebRTC Viewer] Erro crítico na inicialização:', error);
      toast.error('Erro ao conectar à transmissão');
      return false;
    }
  };

  // Auto-inicializar visualização para espectadores quando a transmissão estiver ativa
  useEffect(() => {
    let retryAttempts = 0;
    const maxRetryAttempts = 5;
    let retryTimeoutId: number | null = null;
    
    // Função para tentar inicializar viewer com retry inteligente
    const tryInitializeViewer = async () => {
      if (!isHost && activeStream?.status === 'live' && !peerViewer && remoteVideoRef.current && stream) {
        retryAttempts++;
        
        console.log('🚀 [Auto-Init] Tentativa', retryAttempts, '/', maxRetryAttempts, 'de inicialização do viewer:', {
          isHost,
          streamStatus: activeStream?.status,
          hasPeerViewer: !!peerViewer,
          hasVideoRef: !!remoteVideoRef.current,
          hasStreamData: !!stream,
          streamId: streamId,
          publisherId: stream && typeof stream === 'object' && 'userId' in stream ? stream.userId : streamId,
          connectionStatus
        });
        
        // Verificar se já não está tentando conectar
        if (connectionStatus === 'connecting') {
          console.log('⏳ [Auto-Init] Já existe uma tentativa de conexão em andamento');
          return;
        }
        
        const success = await initializeWebRTCViewer();
        
        if (success) {
          console.log('✅ [Auto-Init] Conexão estabelecida com sucesso!');
          retryAttempts = 0; // Reset counter on success
        } else if (retryAttempts < maxRetryAttempts) {
          // Calcular delay com backoff exponencial
          const baseDelay = 5000; // 5 segundos
          const delay = baseDelay * Math.pow(1.5, retryAttempts - 1);
          
          console.error(`❌ [Auto-Init] Tentativa ${retryAttempts}/${maxRetryAttempts} falhou, retry em ${Math.round(delay/1000)}s...`);
          
          // Retry automático com delay crescente
          retryTimeoutId = window.setTimeout(() => {
            if (!peerViewer && retryAttempts < maxRetryAttempts) {
              console.log(`🔄 [Auto-Init] Retry automático ${retryAttempts + 1}/${maxRetryAttempts}`);
              tryInitializeViewer();
            }
          }, delay);
        } else {
          console.error('💥 [Auto-Init] Esgotadas todas as tentativas de conexão');
          setError('Não foi possível conectar à transmissão após várias tentativas. Verifique sua conexão.');
        }
      }
    };

    // Executar com um pequeno delay para garantir que todos os states estejam atualizados
    const timeoutId = setTimeout(() => {
      if (!isHost && activeStream?.status === 'live' && !peerViewer) {
        tryInitializeViewer();
      }
    }, 1000);
    
    // Também reagir a mudanças no status da stream
    if (activeStream?.status === 'live' && !isHost && !peerViewer && stream) {
      console.log('📡 [Auto-Init] Stream ficou ativa, tentando conectar viewer...');
      clearTimeout(timeoutId);
      retryAttempts = 0; // Reset na nova tentativa
      tryInitializeViewer();
    }
    
    // Limpar recursos ao desmontar
    return () => {
      clearTimeout(timeoutId);
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
      
      if (peerViewer && !isHost) {
        console.log('🧹 [Auto-Init] Limpando viewer ao desmontar');
        peerViewer.stop().catch(err => console.error('Erro ao parar viewer:', err));
        setPeerViewer(null);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, activeStream?.status, peerViewer, streamId, user?.id, connectionStatus]); 
  // stream.userId extraído para evitar expressão complexa, initializeWebRTCViewer e stream são usados internamente

  // Função auxiliar para configurar o stream
  const configureMediaStream = async (stream) => {
    if (!stream) return false;
    
    // Garantir que as faixas comecem habilitadas
    stream.getVideoTracks().forEach(track => {
      track.enabled = true;
      console.log('Trilha de vídeo habilitada:', track.label);
    });
    
    stream.getAudioTracks().forEach(track => {
      track.enabled = true;
      console.log('Trilha de áudio habilitada:', track.label);
    });
    
    // Atualizar os estados
    setIsMicEnabled(true);
    setIsCameraEnabled(stream.getVideoTracks().length > 0);
    setLocalStream(stream);
    
    if (localVideoRef.current) {
      console.log('Atribuindo stream de vídeo ao elemento de vídeo local');
      localVideoRef.current.srcObject = stream;
      
      // Tentar iniciar a reprodução do vídeo
      try {
        await localVideoRef.current.play();
        console.log('Reprodução de vídeo iniciada com sucesso');
      } catch (error) {
        console.warn('Erro ao iniciar reprodução automática do vídeo:', error);
        // O navegador pode exigir interação do usuário para reproduzir
      }
    } else {
      console.error('Elemento de vídeo local não encontrado!');
    }
    
    // Aplicar configurações de alta qualidade automaticamente, se tivermos vídeo
    if (stream.getVideoTracks().length > 0) {
      setTimeout(() => {
        applyStreamSettings();
      }, 1000);
    }
    
    return true;
  };

  // Função para forçar o reset da câmera
  const forceCameraReset = async () => {
    setCameraResetAttempts(prev => prev + 1);
    
    // Limpar todos os recursos primeiro
    cleanupAllMediaResources();
    
    // Tentar acessar o dispositivo diretamente
    try {
      // Primeiro obter lista de dispositivos
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length === 0) {
        toast.error('Nenhuma câmera detectada no sistema');
        return false;
      }
      
      // Forçar um acesso direto usando o deviceId da primeira câmera
      const firstCamera = videoDevices[0];
      console.log(`Tentando resetar dispositivo de câmera: ${firstCamera.label || 'Dispositivo sem nome'}`);
      
      // Tentar acessar com configurações mínimas
      const testStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: firstCamera.deviceId },
          width: { ideal: 320 },
          height: { ideal: 240 }
        }
      });
      
      // Liberar imediatamente
      testStream.getTracks().forEach(track => track.stop());
      
      // Agora tentar obter media com parâmetros normais
      setIsAudioOnlyMode(false);
      
      // Pequeno delay antes de tentar obter permissão normal
      setTimeout(() => {
        requestMediaPermissions();
      }, 1000);
      
      return true;
    } catch (error) {
      console.error('Falha ao tentar resetar câmera:', error);
      toast.error('Não foi possível reiniciar a câmera');
      setShowCameraErrorHelp(true);
      return false;
    }
  };

  // Função para liberar o áudio de um participante específico
  const allowParticipantAudio = (participantId: string, allow: boolean) => {
    if (!isHost) return;
    
    setParticipants(prev => prev.map(p => 
      p.id === participantId ? { ...p, isMuted: !allow } : p
    ));
    
    // Notificar o participante (em uma implementação real, enviar via WebRTC)
    if (allow) {
      toast.success(`Áudio do participante liberado`);
    } else {
      toast.success(`Áudio do participante silenciado`);
    }
  };

  // Função para saída de emergência (mantida para compatibilidade com código)
  const forceExitMeeting = () => {
    // Redirecionar para a página de transmissões
    window.location.replace('/live');
  };
  
  // Atualizar participantes iniciais para garantir que apenas o anfitrião esteja com áudio ligado
  useEffect(() => {
    if (participants.length > 0) {
      // Por padrão, todos os não-anfitriões devem estar com microfone desligado
      setParticipants(prev => prev.map(p => 
        p.isHost ? p : { ...p, isMuted: true }
      ));
    }
  }, [participants.length]);
  
  // Adicionar eventos de mouse globais para controlar arraste e redimensionamento - OTIMIZADO
  useEffect(() => {
    if (!isScreenSharing) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      // Só executar se estiver realmente arrastando ou redimensionando
      if (!isDragging && !isResizing) return;
      
      // Usar requestAnimationFrame para suavizar o movimento
      requestAnimationFrame(() => {
        if (isDragging) {
          // Agora usamos position fixed, então calculamos em relação ao viewport
          let newX = e.clientX - dragStart.x;
          let newY = e.clientY - dragStart.y;
          
          // Limites para não sair da tela inteira (viewport) com margem de segurança
          const marginSafety = 10; // Margem de segurança para evitar cortes
          const maxX = window.innerWidth - cameraSize.width - marginSafety;
          const maxY = window.innerHeight - cameraSize.height - marginSafety;
          
          // Garantir que nunca seja menor que a margem de segurança
          newX = Math.max(marginSafety, Math.min(newX, maxX));
          newY = Math.max(marginSafety, Math.min(newY, maxY));
          
          setCameraPosition({ x: newX, y: newY });
        }
        
        if (isResizing) {
          // Calcular novo tamanho com suavização
          const deltaX = e.clientX - resizeStart.x;
          const deltaY = e.clientY - resizeStart.y;
          
          // Manter proporção do vídeo (aspecto 4:3)
          const aspectRatio = 4/3;
          let newWidth = Math.max(150, resizeStart.width + deltaX);
          let newHeight = newWidth / aspectRatio;
          
          // Limites para tamanho mínimo e máximo
          newWidth = Math.max(150, Math.min(newWidth, 400));
          newHeight = Math.max(100, Math.min(newHeight, 300));
          
          setCameraSize({ width: newWidth, height: newHeight });
        }
      });
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      
      // Restaurar comportamento normal do body
      document.body.style.userSelect = '';
      document.body.style.overflow = '';
    };
    
    // Adicionar eventos globais com opções otimizadas
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseup', handleMouseUp, { passive: true });
    
    // Remover eventos ao desmontar
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScreenSharing, isDragging, isResizing, dragStart, resizeStart, cameraSize.width, cameraSize.height]);
  
  // Configurar o vídeo da câmera flutuante ao iniciar compartilhamento de tela
  useEffect(() => {
    if (isScreenSharing && floatingCameraRef.current && localStream && isCameraEnabled) {
      floatingCameraRef.current.srcObject = localStream;
    }
  }, [isScreenSharing, localStream, isCameraEnabled]);

  // Funções para controle da câmera flutuante durante o compartilhamento de tela
  const handleDragStart = (e: React.MouseEvent) => {
    if (!isScreenSharing || !floatingCameraContainerRef.current) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - cameraPosition.x,
      y: e.clientY - cameraPosition.y
    });
    
    // Prevenir seleção de texto e outros comportamentos durante arraste
    e.preventDefault();
    e.stopPropagation();
    
    // Adicionar classe ao body para evitar scroll durante drag
    document.body.style.userSelect = 'none';
    document.body.style.overflow = 'hidden';
  };
  
  const handleResizeStart = (e: React.MouseEvent) => {
    if (!isScreenSharing) return;
    
    setIsResizing(true);
    setResizeStart({
      width: cameraSize.width,
      height: cameraSize.height,
      x: e.clientX,
      y: e.clientY
    });
    
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Layout>
      {isLoading ? (
        <div className="flex items-center justify-center h-[80vh]">
          <div className="animate-spin h-12 w-12 border-4 border-t-blue-500 border-blue-500/30 rounded-full"/>
        </div>
      ) : (
        <div className="container mx-auto py-6">
          {/* Modificando o layout para remover a divisão na metade */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Área principal - videoconferência (agora ocupa mais espaço) */}
            <div className="lg:w-3/4 space-y-6">
              {/* Informações da reunião */}
              <Card className="bg-black/20 border-white/5 rounded-xl" style={{ overflow: 'visible' }}>
                <CardHeader className="border-b border-white/5 p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mr-2" 
                        onClick={() => navigate('/live')}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Voltar
                      </Button>
                      
                      <Avatar className="h-10 w-10 border border-white/10">
                        <AvatarImage src={(user?.user_metadata?.avatar_url as string) || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-gray-800 to-gray-900">
                          {activeStream?.title?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div>
                        <CardTitle className="text-lg font-medium">
                          {activeStream?.title || 'Carregando...'}
                        </CardTitle>
                        <p className="text-sm text-white/60">
                          {(user?.user_metadata?.full_name as string) || (user?.email as string) || 'Usuário'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Contador de participantes e status da reunião */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-full text-sm">
                        <Users className="h-4 w-4 text-white/70" />
                        <span>{participantCount} participantes</span>
                      </div>
                      
                      {isMeetingActive ? (
                        <div className="flex items-center gap-2 bg-green-500/20 text-green-400 px-3 py-1.5 rounded-full text-sm">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                          <span>EM ANDAMENTO</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-yellow-500/20 text-yellow-400 px-3 py-1.5 rounded-full text-sm">
                          <span>Aguardando início</span>
                        </div>
                      )}
                      
                      {/* Botão para iniciar/encerrar reunião */}
                      <div className="flex gap-2">
                      {isHost && (
                        isMeetingActive ? (
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={endMeeting}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            <PhoneOff className="h-4 w-4 mr-1" />
                            Encerrar
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            onClick={startMeeting}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Video className="h-4 w-4 mr-1" />
                            Iniciar Reunião
                          </Button>
                        )
                      )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-0" style={{ overflow: 'visible' }}>
                  {/* Área de visualização da reunião - tela cheia sem divisão */}
                  <div className="relative w-full" style={{ overflow: 'visible' }}>
                    <div className="aspect-video bg-black relative" style={{ overflow: 'visible' }}>
                      {/* Layout da reunião modificado para tela inteira */}
                      {!isHost && (
                        <div className="h-full w-full">
                          {isMeetingActive ? (
                                    <video 
                                      ref={remoteVideoRef}
                                      autoPlay 
                                      playsInline 
                                      className="h-full w-full object-contain"
                                      style={{
                                        backgroundColor: 'transparent',
                                        border: 'none'
                                      }}
                                    />
                                  ) : (
                                    <div className="flex flex-col items-center justify-center h-full">
                              <div className="bg-white/5 backdrop-blur-md p-6 rounded-xl text-center">
                                <Clock className="h-12 w-12 mx-auto text-yellow-500/70 mb-4" />
                                <h3 className="text-xl font-medium text-white/90 mb-2">Aguardando início da transmissão</h3>
                                <p className="text-white/60">O anfitrião ainda não iniciou esta transmissão</p>
                                    </div>
                                </div>
                          )}
                                </div>
                              )}
                              
                      {isHost && (
                        <div className="h-full w-full relative video-container" style={{ overflow: 'visible' }}>
                          {/* Vídeo principal do anfitrião com estilo melhorado */}
                          <video 
                            ref={localVideoRef}
                            autoPlay 
                            playsInline 
                            muted 
                            className="h-full w-full z-10"
                            style={{ 
                              backgroundColor: isScreenSharing ? 'transparent' : 'black',
                              objectFit: 'contain',
                              minHeight: '300px',
                              border: 'none'
                            }}
                          />
                          
                          {/* Espaço reservado para onde a câmera flutuante estava */}
                          
                          {/* Indicador de câmera desligada */}
                          {/* Não mostrar nenhum indicador quando a câmera estiver desligada */}
                          
                          {/* Miniatura para screen share */}
                          {isScreenSharing && (
                            <div className="absolute top-4 right-4 w-1/5 aspect-video rounded-lg" style={{ overflow: 'visible' }}>
                              <video 
                                ref={screenPreviewRef}
                                autoPlay 
                                playsInline 
                                muted 
                                className="h-full w-full object-contain"
                                style={{
                                  backgroundColor: 'transparent',
                                  border: 'none'
                                }}
                              />
                            </div>
                          )}
                              
                          {/* Notificação de início de reunião se não estiver ativa */}
                          {!isMeetingActive && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                              <div className="bg-white/5 backdrop-blur-md p-6 rounded-xl text-center">
                                <Video className="h-12 w-12 mx-auto text-blue-500/70 mb-4" />
                                <h3 className="text-xl font-medium text-white/90 mb-2">Pronto para iniciar</h3>
                                <p className="text-white/60 mb-4">Clique no botão "Iniciar Reunião" para começar a transmissão</p>
                                    <Button 
                                  onClick={startMeeting}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Video className="h-4 w-4 mr-2" />
                                  Iniciar Reunião
                                    </Button>
                                  </div>
                                </div>
                              )}
                                </div>
                              )}
                            </div>
                    </div>
                    
                  {/* Painel de controle */}
                  <div className="p-4 pt-8 pb-8 bg-black/50 border-t border-white/5 flex justify-between items-center">
                    <div className="flex gap-4">
                      {/* Controles de áudio/vídeo com indicadores visuais */}
                          <div className="relative">
                            <Button 
                              variant={isMicEnabled ? "default" : "destructive"} 
                              size="icon" 
                              onClick={toggleMicrophone}
                              className={`${isMicEnabled 
                                ? "bg-green-600/20 border border-green-600/30 text-green-400" 
                                : "bg-red-600/20 border border-red-600/30 text-red-400"}`}
                            >
                              {isMicEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                            </Button>
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isMicEnabled ? 'bg-green-400' : 'bg-red-400'} opacity-30`}></span>
                              <span className={`relative inline-flex rounded-full h-3 w-3 ${isMicEnabled ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            </span>
                            <span className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs font-medium whitespace-nowrap">
                              {isMicEnabled ? 
                                <span className="text-green-400">Ativo</span> : 
                                <span className="text-red-400">Mudo</span>
                              }
                            </span>
                          </div>
                          
                          <div className="relative">
                            <Button 
                              variant={isCameraEnabled ? "default" : "destructive"} 
                              size="icon" 
                              onClick={toggleCamera}
                              className={`${isCameraEnabled 
                                ? "bg-green-600/20 border border-green-600/30 text-green-400" 
                                : "bg-red-600/20 border border-red-600/30 text-red-400"}`}
                            >
                              {isCameraEnabled ? <Camera className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                            </Button>
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isCameraEnabled ? 'bg-green-400' : 'bg-red-400'} opacity-30`}></span>
                              <span className={`relative inline-flex rounded-full h-3 w-3 ${isCameraEnabled ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            </span>
                            <span className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs font-medium whitespace-nowrap">
                              {isCameraEnabled ? 
                                <span className="text-green-400">Ativa</span> : 
                                <span className="text-red-400">Desligada</span>
                              }
                            </span>
                          </div>
                        
                      {/* Botão de compartilhamento de tela */}
                          <div className="relative">
                            <Button 
                              variant={isScreenSharing ? "destructive" : "default"}
                              size="icon" 
                              onClick={() => isScreenSharing ? stopScreenSharing() : setShowScreenDialog(true)}
                              className={`${isScreenSharing 
                                ? "bg-purple-600/20 border border-purple-600/30 text-purple-400" 
                                : "bg-white/10 border border-white/20 text-white"}`}
                            >
                              <Monitor className="h-5 w-5" />
                            </Button>
                            <span className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs font-medium whitespace-nowrap">
                              {isScreenSharing ? 
                                <span className="text-purple-400">Tela</span> : 
                                <span className="text-white/70">Tela</span>
                              }
                            </span>
                          </div>
                        
                      {/* Botão para levantar a mão - apenas para espectadores */}
                      {!isHost && (
                          <div className="relative">
                            <Button 
                              variant={hasRaisedHand ? "secondary" : "default"}
                              size="icon" 
                              onClick={toggleRaiseHand}
                              className={`${hasRaisedHand 
                                ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400' 
                                : 'bg-white/10 border border-white/20 text-white'}`}
                            >
                              <Hand className="h-5 w-5" />
                            </Button>
                            <span className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs font-medium whitespace-nowrap">
                              {hasRaisedHand ? 
                                <span className="text-yellow-400">Mão</span> : 
                                <span className="text-white/70">Mão</span>
                              }
                            </span>
                          </div>
                      )}

                      {/* Indicador de mãos levantadas para o anfitrião */}
                      {isHost && raisedHands.length > 0 && (
                        <div className="relative">
                          <Button 
                            variant="default"
                            size="icon" 
                            className="bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 relative"
                            onClick={() => toast.info('Participantes com mão levantada querem falar')}
                          >
                            <Hand className="h-5 w-5" />
                            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center bg-amber-500 text-white text-xs rounded-full">
                              {raisedHands.length}
                            </span>
                          </Button>
                          <span className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs font-medium whitespace-nowrap text-yellow-400">
                            Mãos levantadas
                          </span>
                        </div>
                      )}
                        </div>
                        
                    <div className="flex gap-2">
                      {/* Configurações removidas */}
                        
                        {isHost && (
                            <Button 
                          variant="default"
                          size="sm"
                              onClick={toggleChat}
                          className={`${isChatEnabled ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-red-500/20 text-red-400'}`}
                            >
                          {isChatEnabled ? (
                            <>
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Chat ativado
                            </>
                          ) : (
                            <>
                              <VolumeX className="h-4 w-4 mr-1" />
                              Chat desativado
                            </>
                          )}
                          </Button>
                        )}
                      
                        {/* Botão para mutar todos os participantes */}
                        {isHost && (
                            <Button 
                            variant="default"
                            size="sm" 
                            onClick={muteAllParticipants}
                            className="bg-white/10 hover:bg-white/15 text-white"
                            >
                            <VolumeX className="h-4 w-4 mr-1" />
                            Mutar todos
                            </Button>
                        )}
                    </div>
                  </div>
                  
                  {/* Painel de ajuda da câmera - posicionado dentro do Card */}
                  {showCameraErrorHelp && (
                    <div className="p-4 bg-amber-500/20 rounded-b-xl border-t border-amber-400/30">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0 pt-1">
                          <ShieldAlert className="h-6 w-6 text-amber-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-amber-300 mb-2">Problemas com a câmera detectados</h3>
                          <p className="text-sm text-white/80 mb-2">A câmera não pôde ser acessada. Isso pode ocorrer por vários motivos:</p>
                          <ul className="text-sm text-white/70 list-disc pl-4 mb-3 space-y-1">
                            <li>A câmera está sendo usada por outro aplicativo</li>
                            <li>Problemas com drivers da câmera</li>
                            <li>Câmera desativada no gerenciador de dispositivos</li>
                            <li>Permissões de navegador bloqueadas</li>
                          </ul>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={forceCameraReset}
                              className="bg-white/10 hover:bg-white/20 border-amber-500/50 text-amber-300"
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Forçar reinício da câmera
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setShowCameraErrorHelp(false);
                                setIsAudioOnlyMode(true);
                                // Tentar novamente com áudio apenas
                                navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                                  .then(stream => {
                                    setLocalStream(stream);
                                    setIsMicEnabled(true);
                                    setIsCameraEnabled(false);
                                    
                                    if (localVideoRef.current) {
                                      localVideoRef.current.srcObject = stream;
                                      localVideoRef.current.poster = "/placeholder.svg";
                                    }
                                    
                                    toast.success('Modo somente áudio ativado');
                                  })
                                  .catch(err => {
                                    console.error('Erro ao acessar áudio:', err);
                                    toast.error('Não foi possível acessar seu microfone');
                                  });
                              }}
                              className="bg-white/10 hover:bg-white/20 border-white/30"
                            >
                              <Volume2 className="h-4 w-4 mr-2" />
                              Continuar só com áudio
                            </Button>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowCameraErrorHelp(false)}
                          className="text-white/50 hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Chat da reunião (agora lateral mais compacto) */}
            <div className="lg:w-1/4">
              <Card className="bg-black/20 border-white/5 rounded-xl mb-4 h-[calc(50vh-125px)]">
                <CardHeader className="border-b border-white/5 p-4">
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Chat
                    {!isChatEnabled && (
                      <Badge variant="outline" className="ml-2 text-xs border-red-500/30 text-red-500">Desativado</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="p-0 flex flex-col h-[calc(50vh-180px)]">
                  <div className="flex-1 relative">
                    <div 
                      className="h-full overflow-y-auto custom-scrollbar"
                      ref={chatContainerRef}
                      onScroll={handleChatScroll}
                    >
                    {isChatEnabled ? (
                      <div className="p-4 space-y-4">
                        {comments && comments.length > 0 ? (
                          comments.map((comment) => (
                            <div key={comment.id} className="flex gap-3">
                              <Avatar className="h-10 w-10 flex-shrink-0">
                                <AvatarImage src={comment.user?.user_metadata?.avatar_url} />
                                <AvatarFallback className="bg-gradient-to-br from-gray-800 to-gray-900">
                                  {comment.user?.user_metadata?.full_name?.[0] || '?'}
                                </AvatarFallback>
                              </Avatar>
                              
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium text-sm ${
                                    isHost && activeStream?.userId === comment.userId 
                                      ? 'text-blue-400' 
                                      : 'text-white'
                                  }`}>
                                    {comment.user?.user_metadata?.full_name || comment.user?.email || 'Usuário'}
                                    {activeStream?.userId === comment.userId && (
                                      <Badge className="ml-1 text-[10px] py-0 bg-blue-500/30 text-blue-400">Anfitrião</Badge>
                                    )}
                                  </span>
                                  <span className="text-white/40 text-xs">
                                    {comment.createdAt && !isNaN(new Date(comment.createdAt).getTime()) 
                                      ? new Date(comment.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                                      : ''}
                                  </span>
                                </div>
                                <p className="text-white/80 text-sm mt-1">{comment.content}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-white/40 text-sm p-12">
                            <MessageSquare className="h-10 w-10 mb-2 text-white/20" />
                            <p>Sem mensagens ainda</p>
                            <p className="text-xs mt-1">Seja o primeiro a enviar uma mensagem</p>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-white/40 text-sm p-12">
                        <VolumeX className="h-10 w-10 mb-2 text-red-400/20" />
                        <p>Chat desativado pelo anfitrião</p>
                      </div>
                    )}
                  </div>

                  {/* Botão de chat pausado */}
                  {isChatPaused && hasNewMessages && (
                    <div className="absolute bottom-4 left-4 right-4 z-10">
                      <button
                        onClick={scrollToBottomSmooth}
                        className="w-full bg-black/70 hover:bg-black/80 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-3 transition-all duration-200 shadow-lg hover:shadow-xl group"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <div className="flex items-center space-x-2">
                            <Pause className="w-4 h-4 text-white/80" />
                            <span className="text-sm font-medium text-white/80 group-hover:hidden">
                              Chat pausado devido à rolagem
                            </span>
                            <span className="text-sm font-medium text-white/80 hidden group-hover:block">
                              Veja novas mensagens
                            </span>
                          </div>
                          <ArrowDown className="w-4 h-4 text-white/60 group-hover:text-white animate-bounce" />
                        </div>
                      </button>
                    </div>
                  )}
                </div>
                  
                  <div className="p-4 border-t border-white/5 mt-auto">
                    <div className="flex gap-2">
                      <Input
                        placeholder={isChatEnabled ? "Digite sua mensagem..." : "Chat desativado pelo anfitrião"}
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => isChatEnabled && e.key === 'Enter' && !isSendingMessage && handleSendComment()}
                        className="bg-white/5 border-white/10 text-white"
                        disabled={!isChatEnabled || isSendingMessage}
                      />
                      <Button 
                        size="icon" 
                        className="bg-white/10 hover:bg-white/15 text-white"
                        onClick={handleSendComment}
                        disabled={!isChatEnabled || isSendingMessage}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Mensagem de aviso anti-spam */}
                    {antiSpamMessage && (
                      <div className="mt-2 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-md">
                        <p className="text-red-400 text-xs">{antiSpamMessage}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Painel de participantes */}
              <Card className="bg-black/20 border-white/5 rounded-xl h-[calc(50vh-125px)]">
                <CardHeader className="border-b border-white/5 p-4">
                  <CardTitle className="text-lg font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Participantes ({participants.length})
                    </div>
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="p-0 flex flex-col h-[calc(50vh-180px)]">
                  <ScrollArea className="flex-1 h-full">
                    <div className="p-4 space-y-2">
                      {participants.map((participant) => {
                        const participantId = String(participant.id || '');
                        const participantAvatar = String(participant.avatar || '');
                        const participantName = String(participant.name || 'Usuário');
                        const participantIsHost = Boolean(participant.isHost);
                        const participantIsMuted = Boolean(participant.isMuted);
                        
                        return (
                        <div key={participantId} className="flex items-center justify-between p-2 rounded-md hover:bg-black/30">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={participantAvatar} />
                              <AvatarFallback className="bg-gradient-to-br from-gray-800 to-gray-900">
                                {participantName && participantName[0] ? participantName[0] : '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium flex items-center gap-1">
                                {participantName}
                                {participantIsHost && (
                                  <Badge className="ml-1 text-[10px] py-0 px-1 bg-blue-500/30 text-blue-400">Anfitrião</Badge>
                                )}
                              </p>
                              <div className="flex items-center gap-1 text-xs text-white/60">
                                <div className={`h-2 w-2 rounded-full ${participantIsMuted ? 'bg-red-500' : 'bg-green-500'}`} />
                                {participantIsMuted ? 'Mudo' : 'Falando'}
                              </div>
                            </div>
                          </div>
                          
                          {isHost && !participantIsHost && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => allowParticipantAudio(participantId, participantIsMuted)}
                              className={`${participantIsMuted ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}
                            >
                              {participantIsMuted ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                            </Button>
                          )}
                          
                          {raisedHands.includes(participantId) && (
                            <Badge className="bg-yellow-500/30 text-yellow-400 border-yellow-500/30">
                              Mão levantada
                            </Badge>
                          )}
                          
                          {isHost && raisedHands.includes(participantId) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => allowParticipantToSpeak(participantId)}
                              className="text-yellow-400 border-yellow-500/30 hover:border-yellow-500/60 ml-2"
                            >
                              Permitir falar
                            </Button>
                          )}
                        </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {showScreenDialog && (
        <Dialog open={showScreenDialog} onOpenChange={setShowScreenDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Compartilhar tela</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">
                  Tipo de compartilhamento
                </Label>
                <Select 
                  value={screenShareType} 
                  onValueChange={(value: string) => {
                    if (value === 'screen' || value === 'window' || value === 'tab') {
                      setScreenShareType(value);
                    }
                  }}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecione o tipo de compartilhamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="screen">Tela inteira</SelectItem>
                    <SelectItem value="window">Janela</SelectItem>
                    <SelectItem value="tab">Aba</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {isScreenSharing && (
                <div className="mt-4">
                  <p className="text-sm text-amber-400 mb-2">
                    Você já está compartilhando sua tela. Deseja mudar o compartilhamento?
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={stopScreenSharing}
                    className="w-full"
                  >
                    Parar compartilhamento atual
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleScreenShare}>
                Compartilhar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Câmera flutuante usando Portal para renderizar no body - GARANTIA ABSOLUTA DE VISIBILIDADE */}
      {isScreenSharing && isCameraEnabled && localStream && createPortal(
        <div 
          ref={floatingCameraContainerRef}
          className={`
            fixed rounded-lg overflow-hidden shadow-xl
            floating-camera-container floating-camera-always-visible
            ${isDragging ? 'floating-camera-dragging cursor-grabbing' : 'cursor-grab'}
            ${isResizing ? 'floating-camera-resizing' : ''}
          `}
          style={{ 
            width: `${cameraSize.width}px`, 
            height: `${cameraSize.height}px`,
            top: `${cameraPosition.y}px`, 
            left: `${cameraPosition.x}px`,
            border: isDragging ? '3px solid #3b82f6' : '2px solid rgba(255,255,255,0.3)',
            backgroundColor: '#000', // Fundo sólido para evitar conflitos
            backdropFilter: 'none', // Remover blur para evitar conflitos
            zIndex: 2147483647, // Z-index máximo absoluto
            position: 'fixed' // Forçar position fixed para ficar sempre visível
          }}
          onMouseDown={handleDragStart}
        >
          <video
            ref={floatingCameraRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{
              pointerEvents: 'none', // Evitar interferência com drag
              userSelect: 'none' // Evitar seleção
            }}
          />
          {/* Controle de redimensionamento otimizado */}
          <div 
            className="absolute bottom-0 right-0 w-7 h-7 bg-white/30 hover:bg-white/50 cursor-se-resize flex items-center justify-center transition-all duration-200 backdrop-blur-sm"
            style={{
              zIndex: 2147483647, // Z-index máximo para o controle
              borderTopLeftRadius: '6px'
            }}
            onMouseDown={handleResizeStart}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" className="text-white opacity-90">
              <path d="M0 12V10H2V12H0ZM4 12V10H6V12H4ZM8 12V10H10V12H8ZM0 8V6H2V8H0ZM8 8V6H10V8H8ZM0 4V2H2V4H0ZM4 4V2H6V4H4ZM8 4V2H10V4H8Z" fill="currentColor"/>
            </svg>
          </div>
          
          {/* Indicador visual de arrasto */}
          {isDragging && (
            <div 
              className="absolute inset-0 border-2 border-blue-400 rounded-lg pointer-events-none"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                animation: 'pulse 2s infinite'
              }}
            />
          )}
        </div>,
        document.body // Renderizar diretamente no body
      )}
    </Layout>
  );
};

export default MeetingRoom;