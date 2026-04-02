import { Room, RoomEvent, RemoteParticipant, LocalParticipant, RemoteTrackPublication, RemoteTrack } from 'livekit-client';

// URL e API key pública do LiveKit — o secret fica exclusivamente no backend (/api/livekit-token)
const LIVEKIT_API_KEY = import.meta.env.VITE_LIVEKIT_API_KEY || '';
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://elion-6bws36yp.livekit.cloud';

export interface LiveKitRoomSettings {
  maxParticipants?: number;
  emptyTimeout?: number;
  enableRecording?: boolean;
}

/**
 * Configurações e constantes do LiveKit
 */
export const LIVEKIT_CONFIG = {
  serverUrl: LIVEKIT_URL,
  apiKey: LIVEKIT_API_KEY,
  // Não expor o secret no frontend
} as const;

/**
 * Valida se um token LiveKit é válido
 */
export function validateLiveKitToken(token: string): boolean {
  try {
    // Decodificar JWT básico (sem verificar assinatura no frontend)
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    const payload = JSON.parse(atob(parts[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Verificar se não expirou
    return payload.exp > currentTime;
  } catch {
    return false;
  }
}

/**
 * Validação avançada do token LiveKit segundo documentação oficial
 */
export function validateLiveKitTokenAdvanced(token: string): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  payload?: Record<string, unknown>;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let payload: Record<string, unknown> = null;

  try {
    // 1. Verificar estrutura JWT
    const parts = token.split('.');
    if (parts.length !== 3) {
      errors.push('Token não tem estrutura JWT válida (deve ter 3 partes)');
      return { isValid: false, errors, warnings };
    }

    // 2. Decodificar e validar header
    try {
      const header = JSON.parse(atob(parts[0]));
      if (header.alg !== 'HS256') {
        errors.push(`Algoritmo incorreto: ${header.alg} (deve ser HS256)`);
      }
      if (header.typ !== 'JWT') {
        warnings.push(`Tipo incorreto: ${header.typ} (recomendado: JWT)`);
      }
    } catch (e) {
      errors.push('Erro ao decodificar header do token');
    }

    // 3. Decodificar e validar payload
    try {
      payload = JSON.parse(atob(parts[1]));
      
      // Campos obrigatórios segundo documentação LiveKit
      const requiredFields = ['iss', 'sub', 'iat', 'exp'];
      for (const field of requiredFields) {
        if (!payload[field]) {
          errors.push(`Campo obrigatório ausente: ${field}`);
        }
      }

      // Validar issuer (deve ser a API key)
      if (payload.iss !== LIVEKIT_API_KEY) {
        errors.push(`Issuer incorreto: ${payload.iss} (deve ser: ${LIVEKIT_API_KEY})`);
      }

      // Validar expiração
      const currentTime = Math.floor(Date.now() / 1000);
      if ((payload.exp as number) <= currentTime) {
        errors.push('Token expirado');
      }

      // Validar issued at
      if ((payload.iat as number) > currentTime + 300) { // 5 minutos de tolerância no futuro
        warnings.push('Token emitido no futuro (possível problema de sincronização de relógio)');
      }

      // Validar video grant
      if (payload.video) {
        const video = payload.video as { roomJoin?: boolean; room?: string; canPublish?: boolean; canSubscribe?: boolean };
        
        // roomJoin deve estar presente se há video grant
        if (video.roomJoin === undefined) {
          warnings.push('roomJoin não definido no video grant');
        }

        // Se roomJoin for true, room deve estar presente
        if (video.roomJoin && !video.room) {
          errors.push('Campo room obrigatório quando roomJoin=true');
        }

        // Validar permissões básicas
        if (video.canPublish === undefined) {
          warnings.push('canPublish não definido (pode causar problemas)');
        }
        if (video.canSubscribe === undefined) {
          warnings.push('canSubscribe não definido (pode causar problemas)');
        }
      } else {
        warnings.push('Video grant ausente (necessário para LiveKit)');
      }

    } catch (e) {
      errors.push('Erro ao decodificar payload do token');
    }

    // 4. Verificar assinatura (básico - apenas verificar se existe)
    if (parts[2].length < 10) {
      warnings.push('Assinatura muito curta (pode não ser válida)');
    }

  } catch (e) {
    errors.push(`Erro geral na validação: ${e.message}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    payload
  };
}

/**
 * Testa as credenciais LiveKit fazendo uma validação básica
 */
export async function testLiveKitCredentials(): Promise<{
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}> {
  try {
    console.log('🧪 Testando credenciais LiveKit...');
    
    // Testar geração de token básico
    const testToken = await generateViewerToken({
      roomName: 'test-credentials-' + Date.now(),
      participantIdentity: 'test-user',
      participantName: 'Test User',
      metadata: 'credential-test'
    });

    // Validar token gerado
    const validation = validateLiveKitTokenAdvanced(testToken);
    
    if (!validation.isValid) {
      return {
        success: false,
        message: 'Token gerado é inválido',
        details: {
          errors: validation.errors,
          warnings: validation.warnings
        }
      };
    }

    // Verificar se o token pode ser decodificado corretamente
    const payload = validation.payload;
    if (!payload) {
      return {
        success: false,
        message: 'Não foi possível decodificar o payload do token'
      };
    }

    return {
      success: true,
      message: 'Credenciais LiveKit válidas',
      details: {
        tokenGenerated: true,
        validationPassed: true,
        issuer: payload.iss,
        expiresIn: Math.round(((payload.exp as number) * 1000 - Date.now()) / 1000 / 60) + ' minutos',
        warnings: validation.warnings
      }
    };

  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string };
    return {
      success: false,
      message: 'Erro ao testar credenciais',
      details: {
        error: err.message,
        stack: err.stack
      }
    };
  }
}

/**
 * Extrai informações básicas do token (sem verificar assinatura)
 */
export function parseTokenInfo(token: string): {
  identity: string;
  name: string;
  room: string;
  exp: number;
} | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    
    return {
      identity: payload.sub || '',
      name: payload.name || '',
      room: payload.video?.room || '',
      exp: payload.exp || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Classe para gerenciar a conexão com o LiveKit
 */
export class LiveKitManager {
  private room: Room;
  private onParticipantConnectedCallback?: (participant: RemoteParticipant) => void;
  private onParticipantDisconnectedCallback?: (participant: RemoteParticipant) => void;
  private onTrackSubscribedCallback?: (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => void;
  
  constructor() {
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: { width: 1280, height: 720 },
      },
    });
    
    this.setupEventListeners();
  }
  
  /**
   * Configura os event listeners para a sala
   */
  private setupEventListeners() {
    this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log('Participant connected', participant.identity);
      if (this.onParticipantConnectedCallback) {
        this.onParticipantConnectedCallback(participant);
      }
    });
    
    this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log('Participant disconnected', participant.identity);
      if (this.onParticipantDisconnectedCallback) {
        this.onParticipantDisconnectedCallback(participant);
      }
    });
    
    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('Track subscribed', track.kind, 'from', participant.identity);
      if (this.onTrackSubscribedCallback) {
        this.onTrackSubscribedCallback(track, publication, participant);
      }
    });
  }
  
  /**
   * Conecta à sala
   */
  async connect(url: string, token: string): Promise<boolean> {
    try {
      await this.room.connect(url, token);
      console.log('Connected to room', this.room.name);
      return true;
    } catch (error) {
      console.error('Error connecting to room', error);
      return false;
    }
  }
  
  /**
   * Publica áudio e vídeo local
   */
  async publishLocalTracks(): Promise<void> {
    try {
      // Publica webcam e microfone
      await this.room.localParticipant.enableCameraAndMicrophone();
      console.log('Local tracks published');
    } catch (error) {
      console.error('Error publishing local tracks', error);
    }
  }
  
  /**
   * Começa a compartilhar tela
   */
  async startScreenShare(): Promise<void> {
    try {
      await this.room.localParticipant.setScreenShareEnabled(true);
      console.log('Screen sharing started');
    } catch (error) {
      console.error('Error starting screen share', error);
    }
  }
  
  /**
   * Para de compartilhar tela
   */
  async stopScreenShare(): Promise<void> {
    try {
      await this.room.localParticipant.setScreenShareEnabled(false);
      console.log('Screen sharing stopped');
    } catch (error) {
      console.error('Error stopping screen share', error);
    }
  }
  
  /**
   * Liga/desliga o microfone
   */
  async toggleMicrophone(enabled: boolean): Promise<void> {
    try {
      await this.room.localParticipant.setMicrophoneEnabled(enabled);
      console.log('Microphone', enabled ? 'enabled' : 'disabled');
    } catch (error) {
      console.error('Error toggling microphone', error);
    }
  }
  
  /**
   * Liga/desliga a câmera
   */
  async toggleCamera(enabled: boolean): Promise<void> {
    try {
      await this.room.localParticipant.setCameraEnabled(enabled);
      console.log('Camera', enabled ? 'enabled' : 'disabled');
    } catch (error) {
      console.error('Error toggling camera', error);
    }
  }
  
  /**
   * Desconecta da sala
   */
  disconnect(): void {
    this.room.disconnect();
    console.log('Disconnected from room');
  }
  
  /**
   * Obtém o participante local
   */
  getLocalParticipant(): LocalParticipant {
    return this.room.localParticipant;
  }
  
  /**
   * Obtém todos os participantes remotos
   */
  getRemoteParticipants(): Map<string, RemoteParticipant> {
    return this.room.remoteParticipants;
  }
  
  /**
   * Define callback para quando um participante se conecta
   */
  onParticipantConnected(callback: (participant: RemoteParticipant) => void): void {
    this.onParticipantConnectedCallback = callback;
  }
  
  /**
   * Define callback para quando um participante se desconecta
   */
  onParticipantDisconnected(callback: (participant: RemoteParticipant) => void): void {
    this.onParticipantDisconnectedCallback = callback;
  }
  
  /**
   * Define callback para quando um track é inscrito
   */
  onTrackSubscribed(callback: (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => void): void {
    this.onTrackSubscribedCallback = callback;
  }
  
  /**
   * Obtém a instância da sala
   */
  getRoom(): Room {
    return this.room;
  }
}

/**
 * Cria um JWT simples (para desenvolvimento)
 * NOTA: Em produção, usar biblioteca adequada no backend
 * DEPRECATED: Usar createValidJWT() em vez desta função
 */
function createSimpleJWT(payload: Record<string, unknown>, secret: string): string {
  console.warn('⚠️ createSimpleJWT está depreciada, use createValidJWT()');
  
  // Header padrão para JWT
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  // Encode base64url
  const base64urlEncode = (obj: Record<string, unknown>) => {
    return btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const headerEncoded = base64urlEncode(header);
  const payloadEncoded = base64urlEncode(payload);
  const data = `${headerEncoded}.${payloadEncoded}`;

  // Para desenvolvimento, usar uma assinatura simples
  // Em produção, implementar HMAC-SHA256 adequadamente no backend
  const signature = btoa(data + secret)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${data}.${signature}`;
} 