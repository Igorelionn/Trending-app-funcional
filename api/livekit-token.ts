/**
 * VERCEL SERVERLESS FUNCTION - GERAÇÃO SEGURA DE TOKEN LIVEKIT
 *
 * O API secret do LiveKit NUNCA deve ser exposto no frontend.
 * Esta função gera os tokens no backend com segurança.
 *
 * Endpoint: POST /api/livekit-token
 * Body: { roomName, participantIdentity, participantName, role }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://elion-6bws36yp.livekit.cloud';

function base64urlEncode(obj: object): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function createJWT(payload: object, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerEncoded = base64urlEncode(header);
  const payloadEncoded = base64urlEncode(payload);
  const data = `${headerEncoded}.${payloadEncoded}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${data}.${signature}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    console.error('❌ LIVEKIT_API_KEY ou LIVEKIT_API_SECRET não configurados');
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  const { roomName, participantIdentity, participantName, role = 'viewer', metadata } = req.body;

  if (!roomName || !participantIdentity || !participantName) {
    return res.status(400).json({ error: 'roomName, participantIdentity e participantName são obrigatórios' });
  }

  const sanitizedRoom = roomName.replace(/[^a-zA-Z0-9-_]/g, '');
  if (!sanitizedRoom) {
    return res.status(400).json({ error: 'Nome da sala inválido' });
  }

  const isStreamer = role === 'streamer';
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: LIVEKIT_API_KEY,
    sub: participantIdentity,
    name: participantName,
    metadata: metadata ? JSON.stringify(metadata) : '',
    video: {
      room: sanitizedRoom,
      roomJoin: true,
      roomAdmin: isStreamer,
      roomCreate: isStreamer,
      canPublish: isStreamer,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    },
    iat: now,
    exp: now + 6 * 60 * 60, // 6 horas
  };

  try {
    const token = createJWT(payload, LIVEKIT_API_SECRET);

    return res.status(200).json({
      token,
      serverUrl: LIVEKIT_URL,
      participantIdentity,
      participantName,
      roomName: sanitizedRoom,
      expiresAt: (now + 6 * 60 * 60) * 1000,
    });
  } catch (error) {
    console.error('❌ Erro ao gerar token LiveKit:', error);
    return res.status(500).json({ error: 'Erro ao gerar token' });
  }
}
