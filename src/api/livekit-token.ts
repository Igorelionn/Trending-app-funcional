/**
 * Módulo cliente para gerar tokens LiveKit.
 * Chama o endpoint serverless /api/livekit-token que mantém o API secret
 * de forma segura no backend (nunca exposto no browser).
 */

export interface TokenRequest {
  roomName: string;
  userId: string;
  userName: string;
  userType?: 'streamer' | 'viewer' | 'participant';
  metadata?: Record<string, unknown>;
}

export interface TokenResponse {
  token: string;
  serverUrl: string;
  participantIdentity: string;
  participantName: string;
  roomName: string;
  expiresAt: number;
}

/**
 * Gera token LiveKit chamando o endpoint seguro no backend.
 */
export async function getLiveKitToken(request: TokenRequest): Promise<TokenResponse> {
  const { roomName, userId, userName, userType = 'participant', metadata } = request;

  if (!roomName || !userId || !userName) {
    throw new Error('Parâmetros obrigatórios: roomName, userId, userName');
  }

  const sanitizedRoomName = roomName.replace(/[^a-zA-Z0-9-_]/g, '');
  if (!sanitizedRoomName) {
    throw new Error('Nome da sala inválido');
  }

  const response = await fetch('/api/livekit-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomName: sanitizedRoomName,
      participantIdentity: `user-${userId}`,
      participantName: userName,
      role: userType === 'streamer' ? 'streamer' : 'viewer',
      metadata: metadata
        ? { ...metadata, joinedAt: new Date().toISOString(), userAgent: navigator.userAgent }
        : { joinedAt: new Date().toISOString() },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(error.error || `Erro HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Helper para componentes React gerarem token LiveKit.
 */
export async function fetchLiveKitToken(
  roomName: string,
  userId: string,
  userName: string,
  userType: 'streamer' | 'viewer' | 'participant' = 'participant'
): Promise<TokenResponse> {
  return getLiveKitToken({ roomName, userId, userName, userType });
}

/**
 * Renova token LiveKit se estiver próximo de expirar (30 minutos antes).
 */
export async function renewLiveKitToken(
  currentToken: string,
  roomName: string,
  userId: string,
  userName: string,
  userType: 'streamer' | 'viewer' | 'participant' = 'participant'
): Promise<TokenResponse | null> {
  try {
    const parts = currentToken.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    const expirationTime = payload.exp * 1000;
    const thirtyMinutes = 30 * 60 * 1000;

    if (expirationTime - Date.now() > thirtyMinutes) {
      return null;
    }

    return await fetchLiveKitToken(roomName, userId, userName, userType);
  } catch {
    return null;
  }
}
