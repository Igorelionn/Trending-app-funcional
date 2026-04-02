import React, { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { Room, RoomEvent, RemoteParticipant, LocalParticipant, Track, LocalTrack } from 'livekit-client';
import { useAuth } from './AuthContext';
import { fetchLiveKitToken } from '@/api/livekit-token';
import { LIVEKIT_CONFIG } from '@/services/livekitService';

export interface LiveKitRoom {
  id: string;
  title: string;
  description?: string;
  createdBy: string;
  participantCount: number;
  isLive: boolean;
  thumbnail?: string;
  tags?: string[];
}

export interface LiveKitParticipant {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isLocal: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  metadata?: string;
}

export interface LiveKitContextType {
  // Estado da conexão
  room: Room | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  
  // Participantes
  participants: LiveKitParticipant[];
  localParticipant: LiveKitParticipant | null;
  
  // Mídia
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isScreenSharing: boolean;
  
  // Chat
  messages: Array<{
    id: string;
    participantName: string;
    message: string;
    timestamp: Date;
  }>;
  
  // Ações
  joinRoom: (roomName: string, userType?: 'streamer' | 'viewer') => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  toggleAudio: () => Promise<void>;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  sendMessage: (message: string) => void;
  /** Publica um MediaStream existente na sala (câmera/screen do streamer) */
  publishStream: (stream: MediaStream) => Promise<void>;
  /** Substitui as tracks publicadas por um novo MediaStream */
  replaceStream: (stream: MediaStream) => Promise<void>;
  
  // Status
  viewerCount: number;
  streamDuration: number;
}

const LiveKitContext = createContext<LiveKitContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export function useLiveKit() {
  const context = useContext(LiveKitContext);
  if (!context) {
    throw new Error('useLiveKit deve ser usado dentro de LiveKitProvider');
  }
  return context;
}

interface LiveKitProviderProps {
  children: ReactNode;
}

export function LiveKitProvider({ children }: LiveKitProviderProps) {
  const { user } = useAuth();
  
  // Estados principais
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Participantes
  const [participants, setParticipants] = useState<LiveKitParticipant[]>([]);
  const [localParticipant, setLocalParticipant] = useState<LiveKitParticipant | null>(null);
  
  // Estados de mídia
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // Chat
  const [messages, setMessages] = useState<Array<{
    id: string;
    participantName: string;
    message: string;
    timestamp: Date;
  }>>([]);
  
  // Contadores
  const [viewerCount, setViewerCount] = useState(0);
  const [streamDuration, setStreamDuration] = useState(0);
  
  // Refs para timers
  const durationTimer = useRef<NodeJS.Timeout>();
  const connectionStartTime = useRef<Date>();

  // Converter participante LiveKit para nosso formato
  const convertParticipant = useCallback((participant: LocalParticipant | RemoteParticipant, isLocal: boolean = false): LiveKitParticipant => {
    return {
      identity: participant.identity,
      name: participant.name || participant.identity,
      isSpeaking: participant.isSpeaking,
      isLocal,
      audioEnabled: participant.isMicrophoneEnabled,
      videoEnabled: participant.isCameraEnabled,
      metadata: participant.metadata,
    };
  }, []);

  // Configurar eventos da sala
  const setupRoomEvents = useCallback((room: Room) => {
    console.log('🎬 Configurando eventos da sala LiveKit...');

    // Participante entrou
    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log('👋 Participante conectado:', participant.name);
      setParticipants(prev => [...prev, convertParticipant(participant)]);
      setViewerCount(prev => prev + 1);
    });

    // Participante saiu
    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log('👋 Participante desconectado:', participant.name);
      setParticipants(prev => prev.filter(p => p.identity !== participant.identity));
      setViewerCount(prev => Math.max(0, prev - 1));
    });

    // Track publicada
    room.on(RoomEvent.TrackPublished, (publication, participant) => {
      console.log('📹 Track publicada:', publication.trackName, 'por', participant.name);
    });

    // Track não publicada
    room.on(RoomEvent.TrackUnpublished, (publication, participant) => {
      console.log('📹 Track não publicada:', publication.trackName, 'por', participant.name);
    });

    // Dados recebidos (chat)
    room.on(RoomEvent.DataReceived, (payload, participant) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type === 'chat') {
          setMessages(prev => [...prev, {
            id: `${Date.now()}-${Math.random()}`,
            participantName: participant?.name || 'Desconhecido',
            message: data.message,
            timestamp: new Date(),
          }]);
        }
      } catch (error) {
        console.error('❌ Erro ao processar dados recebidos:', error);
      }
    });

    // Erros da sala
    room.on(RoomEvent.Disconnected, (reason) => {
      console.log('🔌 Desconectado da sala:', reason);
      setIsConnected(false);
      setConnectionError(typeof reason === 'string' ? reason : 'Desconectado');
    });

    // Estado de falando mudou
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const speakerIdentities = speakers.map(s => s.identity);
      setParticipants(prev => prev.map(p => ({
        ...p,
        isSpeaking: speakerIdentities.includes(p.identity)
      })));
    });

  }, [convertParticipant]);

  // Entrar na sala
  const joinRoom = useCallback(async (roomName: string, userType: 'streamer' | 'viewer' = 'viewer'): Promise<boolean> => {
    if (!user) {
      setConnectionError('Usuário não autenticado');
      return false;
    }

    if (isConnecting || isConnected) {
      console.warn('⚠️ Já está conectando ou conectado');
      return false;
    }

    try {
      setIsConnecting(true);
      setConnectionError(null);
      
      console.log('🚀 Iniciando conexão LiveKit...', { roomName, userType });

      // Obter token
      const tokenData = await fetchLiveKitToken(
        roomName,
        user.id,
        user.user_metadata?.name || user.email || 'Usuário',
        userType
      );

      console.log('🎫 Token obtido, conectando à sala...');

      // Criar nova sala
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: {
            width: 1280,
            height: 720,
            frameRate: 30,
          },
        },
      });

      // Configurar eventos antes de conectar
      setupRoomEvents(newRoom);

      // Conectar à sala
      await newRoom.connect(LIVEKIT_CONFIG.serverUrl, tokenData.token);

      console.log('✅ Conectado à sala LiveKit!');

      // Atualizar estados
      setRoom(newRoom);
      setIsConnected(true);
      connectionStartTime.current = new Date();

      // Configurar participante local
      if (newRoom.localParticipant) {
        setLocalParticipant(convertParticipant(newRoom.localParticipant, true));
      }

      // Listar participantes existentes
      const remoteParticipants = Array.from(newRoom.remoteParticipants.values());
      setParticipants(remoteParticipants.map(p => convertParticipant(p)));
      setViewerCount(remoteParticipants.length);

      // Iniciar timer de duração
      durationTimer.current = setInterval(() => {
        if (connectionStartTime.current) {
          setStreamDuration(Math.floor((Date.now() - connectionStartTime.current.getTime()) / 1000));
        }
      }, 1000);

      // Viewers não precisam de câmera/microfone
      // Streamers publicam via publishStream() após joinRoom()

      return true;

    } catch (error: unknown) {
      console.error('❌ Erro ao conectar à sala LiveKit:', error);
      setConnectionError(error instanceof Error ? error.message : 'Erro de conexão');
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [user, isConnecting, isConnected, setupRoomEvents, convertParticipant]);

  // Sair da sala
  const leaveRoom = useCallback(async () => {
    if (room) {
      console.log('👋 Saindo da sala LiveKit...');
      
      // Limpar timer
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = undefined;
      }

      // Desconectar
      await room.disconnect();
      
      // Limpar estados
      setRoom(null);
      setIsConnected(false);
      setParticipants([]);
      setLocalParticipant(null);
      setMessages([]);
      setViewerCount(0);
      setStreamDuration(0);
      setIsScreenSharing(false);
      connectionStartTime.current = undefined;
      
      console.log('✅ Desconectado da sala LiveKit');
    }
  }, [room]);

  // Alternar vídeo
  const toggleVideo = useCallback(async () => {
    if (room?.localParticipant) {
      const enabled = !isVideoEnabled;
      await room.localParticipant.setCameraEnabled(enabled);
      setIsVideoEnabled(enabled);
      
      if (localParticipant) {
        setLocalParticipant({ ...localParticipant, videoEnabled: enabled });
      }
    }
  }, [room, isVideoEnabled, localParticipant]);

  // Alternar áudio
  const toggleAudio = useCallback(async () => {
    if (room?.localParticipant) {
      const enabled = !isAudioEnabled;
      await room.localParticipant.setMicrophoneEnabled(enabled);
      setIsAudioEnabled(enabled);
      
      if (localParticipant) {
        setLocalParticipant({ ...localParticipant, audioEnabled: enabled });
      }
    }
  }, [room, isAudioEnabled, localParticipant]);

  // Compartilhar tela
  const startScreenShare = useCallback(async () => {
    if (room?.localParticipant) {
      try {
        await room.localParticipant.setScreenShareEnabled(true);
        setIsScreenSharing(true);
        console.log('🖥️ Compartilhamento de tela iniciado');
      } catch (error) {
        console.error('❌ Erro ao iniciar compartilhamento de tela:', error);
      }
    }
  }, [room]);

  // Parar compartilhamento de tela
  const stopScreenShare = useCallback(async () => {
    if (room?.localParticipant) {
      try {
        await room.localParticipant.setScreenShareEnabled(false);
        setIsScreenSharing(false);
        console.log('🖥️ Compartilhamento de tela parado');
      } catch (error) {
        console.error('❌ Erro ao parar compartilhamento de tela:', error);
      }
    }
  }, [room]);

  // Publicar um MediaStream existente na sala (para streamers com câmera própria)
  const publishStream = useCallback(async (stream: MediaStream): Promise<void> => {
    if (!room?.localParticipant) {
      console.warn('⚠️ publishStream: sala não conectada');
      return;
    }
    try {
      for (const track of stream.getVideoTracks()) {
        await room.localParticipant.publishTrack(track, { source: Track.Source.Camera, name: 'camera' });
      }
      for (const track of stream.getAudioTracks()) {
        await room.localParticipant.publishTrack(track, { source: Track.Source.Microphone, name: 'microphone' });
      }
      setIsVideoEnabled(stream.getVideoTracks().length > 0);
      setIsAudioEnabled(stream.getAudioTracks().length > 0);
      console.log('✅ publishStream: tracks publicadas', stream.getTracks().map(t => t.kind));
    } catch (error) {
      console.error('❌ publishStream error:', error);
    }
  }, [room]);

  // Substituir tracks publicadas (câmera → screen share ou vice-versa)
  const replaceStream = useCallback(async (stream: MediaStream): Promise<void> => {
    if (!room?.localParticipant) {
      console.warn('⚠️ replaceStream: sala não conectada');
      return;
    }
    try {
      // Remover tracks de vídeo publicadas
      const publishedTracks = Array.from(room.localParticipant.trackPublications.values());
      for (const pub of publishedTracks) {
        if (pub.track && (pub.source === Track.Source.Camera || pub.source === Track.Source.ScreenShare)) {
          await room.localParticipant.unpublishTrack(pub.track as LocalTrack);
        }
      }
      // Publicar novo stream
      await publishStream(stream);
      console.log('✅ replaceStream: tracks substituídas');
    } catch (error) {
      console.error('❌ replaceStream error:', error);
    }
  }, [room, publishStream]);

  // Enviar mensagem
  const sendMessage = useCallback((message: string) => {
    if (room?.localParticipant && message.trim()) {
      const data = {
        type: 'chat',
        message: message.trim(),
        timestamp: new Date().toISOString(),
      };
      
      const encoder = new TextEncoder();
      room.localParticipant.publishData(encoder.encode(JSON.stringify(data)), { reliable: true });
      
      // Adicionar à lista local
      setMessages(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        participantName: localParticipant?.name || 'Você',
        message: message.trim(),
        timestamp: new Date(),
      }]);
    }
  }, [room, localParticipant]);

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
      }
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  const value: LiveKitContextType = {
    // Estado da conexão
    room,
    isConnected,
    isConnecting,
    connectionError,
    
    // Participantes
    participants,
    localParticipant,
    
    // Mídia
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    
    // Chat
    messages,
    
    // Ações
    joinRoom,
    leaveRoom,
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    sendMessage,
    publishStream,
    replaceStream,
    
    // Status
    viewerCount,
    streamDuration,
  };

  return (
    <LiveKitContext.Provider value={value}>
      {children}
    </LiveKitContext.Provider>
  );
} 