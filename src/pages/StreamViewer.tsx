import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from "@/contexts/AuthContext";
import { useLiveStream } from "@/contexts/LiveStreamContext";
import { useLiveKit } from "@/contexts/LiveKitContext";
import { RoomEvent, Track } from 'livekit-client';
import Hls from 'hls.js';
import { WHIPSender } from "@/services/whipService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Video, 
  Users,
  MessageSquare,
  Eye,
  Send,
  Heart,
  Share,
  X,
  AlertCircle,
  CheckCircle,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  ArrowLeft,
  ThumbsUp,
  MoreVertical
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface StreamComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  message: string;
  timestamp: Date;
  isStreamer: boolean;
}

export default function StreamViewer() {
  const { streamId } = useParams<{ streamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    activeStream, 
    fetchStreamById, 
    comments,
    fetchComments,
    addComment,
    stopPeerViewer,
  } = useLiveStream();

  const { room, joinRoom, leaveRoom, viewerCount: liveKitViewerCount } = useLiveKit();

  // Estados da visualização
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [streamComments, setStreamComments] = useState<StreamComment[]>([]);

  // Estados dos controles
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);
  const [chatMessage, setChatMessage] = useState('');

  // Estados da transmissão
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [streamerName, setStreamerName] = useState('');
  const [streamDuration, setStreamDuration] = useState(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Carregar dados da transmissão
  useEffect(() => {
    console.log('🎬 [StreamViewer] useEffect principal executado:', { streamId });
    
    if (streamId) {
      console.log('✅ [StreamViewer] streamId presente, carregando dados...');
      loadStreamData();
      fetchComments(streamId);
      // NÃO chamar connectToStream aqui - o vídeo ainda não foi renderizado!
    } else {
      console.warn('⚠️ [StreamViewer] streamId ausente!');
    }

    return () => {
      console.log('🧹 [StreamViewer] Limpando conexão...');
      leaveRoom();
      if (streamId) stopPeerViewer(streamId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]);

  // ✅ NOVO: Conectar quando o elemento de vídeo estiver pronto
  // ✅ CORREÇÃO: Usar ref para evitar múltiplas chamadas
  const hasConnectedRef = useRef(false);
  
  useEffect(() => {
    if (streamId && videoRef.current && !isConnected && !isConnecting && !hasConnectedRef.current) {
      console.log('📺 [StreamViewer] Elemento de vídeo pronto! Conectando...');
      hasConnectedRef.current = true; // ✅ Marcar como conectando
      connectToStream();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId, videoRef.current, isConnected, isConnecting]);

  // ✅ NOVO: Monitorar estado do vídeo periodicamente
  useEffect(() => {
    if (!isConnected || !videoRef.current) return;
    
    console.log('🔍 [StreamViewer] Iniciando monitoramento do vídeo...');
    
    const intervalId = setInterval(() => {
      if (!videoRef.current) return;
      
      const video = videoRef.current;
      const stream = video.srcObject as MediaStream | null;
      
      console.log('📊 [StreamViewer] Estado do vídeo:', {
        hasStream: !!stream,
        streamActive: stream?.active,
        videoTracks: stream?.getVideoTracks().length || 0,
        audioTracks: stream?.getAudioTracks().length || 0,
        videoTrackEnabled: stream?.getVideoTracks()[0]?.enabled,
        videoTrackReadyState: stream?.getVideoTracks()[0]?.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
        paused: video.paused,
        currentTime: video.currentTime,
        // Propriedades do DOM
        offsetWidth: video.offsetWidth,
        offsetHeight: video.offsetHeight,
        clientWidth: video.clientWidth,
        clientHeight: video.clientHeight,
        style: {
          display: video.style.display || 'default',
          opacity: video.style.opacity || 'default',
          visibility: video.style.visibility || 'default'
        }
      });
    }, 3000); // A cada 3 segundos
    
    return () => clearInterval(intervalId);
  }, [isConnected]);

  // Timer para duração da transmissão
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isConnected && activeStream?.startedAt) {
      const startTime = new Date(activeStream.startedAt).getTime();
      
      interval = setInterval(() => {
        const now = Date.now();
        const duration = Math.floor((now - startTime) / 1000);
        setStreamDuration(duration);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected, activeStream?.startedAt]);

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
        isStreamer: comment.userId === activeStream?.userId
      }));
      setStreamComments(formattedComments);
    }
  }, [comments, activeStream?.userId]);

  const loadStreamData = async () => {
    if (!streamId) return;
    
    try {
      const stream = await fetchStreamById(streamId);
      if (stream) {
        setStreamTitle(stream.title);
        setStreamDescription(stream.description || '');
        
        // Verificar se a transmissão está ativa
        if (stream.status !== 'live') {
          toast.error('Esta transmissão não está ativa no momento');
          navigate('/live');
          return;
        }

        // Simular dados do streamer (em uma implementação real, viria do banco)
        setStreamerName(String(stream.streamSettings?.hostName || 'Streamer'));
        setViewerCount(stream.viewerCount || 0);
      }
    } catch (error) {
      console.error('Erro ao carregar transmissão:', error);
      toast.error('Erro ao carregar dados da transmissão');
    }
  };

  const connectToStream = async () => {
    if (!streamId || !videoRef.current) return;

    setIsConnecting(true);
    const videoEl = videoRef.current;

    try {
      const mediaServerUrl = import.meta.env.VITE_MEDIA_SERVER_URL;

      if (mediaServerUrl && activeStream?.streamKey) {
        // ── Modo HLS: servidor dedicado (suporta 10k+ viewers) ──
        const hlsUrl = WHIPSender.getHLSUrl(activeStream.streamKey);

        if (Hls.isSupported()) {
          const hls = new Hls({
            lowLatencyMode: true,
            backBufferLength: 30,
          });
          hls.loadSource(hlsUrl);
          hls.attachMedia(videoEl);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            videoEl.play().catch(() => {});
            setIsConnected(true);
            toast.success('Conectado à transmissão!');
          });
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              console.error('[HLS] Erro fatal:', data);
              toast.error('Erro ao carregar stream');
              setIsConnected(false);
            }
          });
        } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari: suporte nativo a HLS
          videoEl.src = hlsUrl;
          videoEl.addEventListener('loadedmetadata', () => {
            videoEl.play().catch(() => {});
            setIsConnected(true);
            toast.success('Conectado à transmissão!');
          });
        } else {
          throw new Error('Seu navegador não suporta HLS');
        }
      } else {
        // ── Modo LiveKit: fallback sem servidor dedicado ──
        await stopPeerViewer(streamId);
        const success = await joinRoom(streamId, 'viewer');
        if (success) {
          setIsConnected(true);
          toast.success('Conectado à transmissão!');
        } else {
          throw new Error('Falha ao conectar à transmissão');
        }
      }
    } catch (error) {
      console.error('[StreamViewer] Erro ao conectar:', error);
      toast.error('Erro ao conectar à transmissão');
    } finally {
      setIsConnecting(false);
    }
  };

  // Anexar vídeo remoto ao elemento <video> quando a track chegar
  useEffect(() => {
    if (!room || !videoRef.current) return;

    const videoEl = videoRef.current;

    // Tentar tracks já existentes
    room.remoteParticipants.forEach(participant => {
      participant.trackPublications.forEach(pub => {
        if (pub.track && pub.kind === Track.Kind.Video && pub.isSubscribed) {
          pub.track.attach(videoEl);
          setIsConnected(true);
        }
      });
    });

    const onSubscribed = (track: { kind: string; attach: (el: HTMLVideoElement) => void }) => {
      if (track.kind === Track.Kind.Video) {
        track.attach(videoEl);
        setIsConnected(true);
      }
    };

    const onUnsubscribed = (track: { kind: string; detach: (el: HTMLVideoElement) => void }) => {
      if (track.kind === Track.Kind.Video) {
        track.detach(videoEl);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    room.on(RoomEvent.TrackSubscribed, onSubscribed as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    room.on(RoomEvent.TrackUnsubscribed, onUnsubscribed as any);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      room.off(RoomEvent.TrackSubscribed, onSubscribed as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      room.off(RoomEvent.TrackUnsubscribed, onUnsubscribed as any);
    };
  }, [room, videoRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincronizar viewerCount do LiveKit
  useEffect(() => {
    if (liveKitViewerCount > 0) setViewerCount(liveKitViewerCount);
  }, [liveKitViewerCount]);

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !streamId) return;
    
    try {
      const success = await addComment(streamId, chatMessage);
      if (success) {
        setChatMessage('');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem');
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
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

  const shareStream = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success('Link da transmissão copiado!');
  };

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
    <div className="min-h-screen bg-black text-white" ref={containerRef}>
      {/* Header da transmissão */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/live')}
              className="text-white hover:bg-zinc-800"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-500 font-semibold">AO VIVO</span>
              <span className="text-gray-400 text-sm">
                {formatDuration(streamDuration)}
              </span>
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            <div>
              <h1 className="font-semibold">{streamTitle}</h1>
              <p className="text-sm text-gray-400">{streamerName}</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1">
                <Eye className="w-4 h-4" />
                <span>{viewerCount}</span>
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={shareStream}
              className="border-zinc-700 hover:bg-zinc-800"
            >
              <Share className="w-4 h-4 mr-2" />
              Compartilhar
            </Button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Área principal de vídeo */}
        <div className="flex-1 relative bg-black">
          {/* Vídeo da transmissão */}
          <div className="relative h-full">
            {/* ✅ CORREÇÃO: Renderizar vídeo SEMPRE para ref estar disponível */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isMuted}
              className={`w-full h-full object-contain ${!isConnected ? 'hidden' : ''}`}
              onLoadedMetadata={() => {
                console.log('✅ [StreamViewer] Vídeo carregado - metadata disponível');
              }}
              onError={(e) => {
                console.error('❌ [StreamViewer] Erro no elemento de vídeo:', e);
                toast.error('Erro ao reproduzir vídeo');
              }}
            />
            
            {/* Overlay de loading quando conectando */}
            {isConnecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                <div className="text-center">
                  <div className="animate-spin w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-white">Conectando à transmissão...</p>
                </div>
              </div>
            )}
            
            {/* Overlay de erro quando desconectado */}
            {!isConnected && !isConnecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                <div className="text-center">
                  <AlertCircle className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">Desconectado</p>
                  <p className="text-gray-500 text-sm mt-2">Erro ao conectar à transmissão</p>
                  <Button 
                    onClick={connectToStream}
                    className="mt-4 bg-red-600 hover:bg-red-700"
                  >
                    Tentar novamente
                  </Button>
                </div>
              </div>
            )}

            {/* Status de conexão */}
            <div className="absolute top-4 left-4">
              <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2">
                <div className="flex items-center space-x-2">
                  {isConnected ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-green-500">Conectado</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm text-yellow-500">Desconectado</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Controles de vídeo */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
              <div className="bg-black/80 backdrop-blur-sm rounded-full px-6 py-3 flex items-center space-x-4">
                <Button
                  variant={isMuted ? "destructive" : "secondary"}
                  size="icon"
                  onClick={toggleMute}
                  className="rounded-full"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>

                <Button
                  variant="secondary"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="rounded-full"
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Painel lateral - Chat */}
        {chatVisible && (
          <div className="w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col">
            <div className="p-4 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Chat da Transmissão</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setChatVisible(false)}
                  className="h-8 w-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {streamComments.map((comment) => (
                  <div key={comment.id} className="flex space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={comment.userAvatar} />
                      <AvatarFallback>
                        {comment.userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-white">
                          {comment.userName}
                        </span>
                        {comment.isStreamer && (
                          <Badge variant="secondary" className="text-xs bg-red-600">
                            Streamer
                          </Badge>
                        )}
                        <span className="text-xs text-gray-400">
                          {format(comment.timestamp, 'HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 mt-1 break-words">
                        {comment.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-zinc-800">
              <div className="flex space-x-2">
                <Input
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="bg-zinc-800 border-zinc-700 text-white"
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button
                  onClick={handleSendMessage}
                  size="icon"
                  disabled={!chatMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Botão para mostrar chat quando oculto */}
        {!chatVisible && (
          <Button
            onClick={() => setChatVisible(true)}
            className="fixed right-4 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700"
            size="icon"
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Informações da transmissão (quando em fullscreen) */}
      {isFullscreen && (
        <div className="fixed top-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 z-50">
          <h2 className="font-semibold text-white">{streamTitle}</h2>
          <p className="text-sm text-gray-300">{streamerName}</p>
          <div className="flex items-center space-x-2 mt-1">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-red-500">AO VIVO</span>
            <span className="text-xs text-gray-400">{viewerCount} espectadores</span>
          </div>
        </div>
      )}
    </div>
  );
} 