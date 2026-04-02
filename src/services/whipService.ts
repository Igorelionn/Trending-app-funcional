/**
 * WHIP — WebRTC-HTTP Ingestion Protocol (RFC draft)
 *
 * O streamer envia vídeo/áudio do browser diretamente para o MediaMTX
 * via um único endpoint HTTP. O servidor converte para HLS automaticamente.
 *
 * Fluxo:
 *  1. Browser cria RTCPeerConnection + adiciona tracks da câmera
 *  2. Cria SDP offer + espera ICE candidates
 *  3. POST /whip/{streamKey} com o SDP
 *  4. Servidor responde com SDP answer
 *  5. Conexão WebRTC estabelecida → servidor recebe vídeo
 *  6. MediaMTX gera HLS em /hls/{streamKey}/index.m3u8
 */

const MEDIA_SERVER_URL = import.meta.env.VITE_MEDIA_SERVER_URL || '';
const MEDIA_SERVER_KEY = import.meta.env.VITE_MEDIA_SERVER_KEY || '';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export type WHIPStatus = 'idle' | 'connecting' | 'connected' | 'failed' | 'disconnected';

export interface WHIPCallbacks {
  onStatusChange?: (status: WHIPStatus) => void;
  onError?: (error: string) => void;
}

export class WHIPSender {
  private pc: RTCPeerConnection | null = null;
  private resourceUrl: string | null = null; // retornado pelo servidor no header Location
  private status: WHIPStatus = 'idle';
  private callbacks: WHIPCallbacks;

  constructor(callbacks: WHIPCallbacks = {}) {
    this.callbacks = callbacks;
  }

  private setStatus(s: WHIPStatus) {
    this.status = s;
    this.callbacks.onStatusChange?.(s);
  }

  getStatus() { return this.status; }

  /**
   * Inicia a transmissão via WHIP para o servidor de mídia.
   * @param streamKey  chave única da live (stream_key do banco)
   * @param mediaStream stream da câmera/tela do streamer
   */
  async start(streamKey: string, mediaStream: MediaStream): Promise<boolean> {
    if (!MEDIA_SERVER_URL) {
      this.callbacks.onError?.('VITE_MEDIA_SERVER_URL não configurado');
      return false;
    }

    this.setStatus('connecting');

    try {
      this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      // Adicionar todas as tracks do streamer
      mediaStream.getTracks().forEach(track => {
        this.pc!.addTrack(track, mediaStream);
      });

      // Criar offer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // Aguardar ICE gathering completar (máx 4s)
      await this.waitForICE(this.pc, 4000);

      const finalSdp = this.pc.localDescription!.sdp;

      // Enviar para o servidor via WHIP
      const headers: HeadersInit = { 'Content-Type': 'application/sdp' };
      if (MEDIA_SERVER_KEY) headers['Authorization'] = `Bearer ${MEDIA_SERVER_KEY}`;

      const res = await fetch(`${MEDIA_SERVER_URL}/whip/${encodeURIComponent(streamKey)}`, {
        method: 'POST',
        headers,
        body: finalSdp,
      });

      if (!res.ok) {
        throw new Error(`Servidor retornou ${res.status}: ${await res.text()}`);
      }

      const answerSdp = await res.text();
      this.resourceUrl = res.headers.get('Location');

      await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      // Monitorar estado da conexão
      this.pc.onconnectionstatechange = () => {
        const state = this.pc?.connectionState;
        if (state === 'connected') this.setStatus('connected');
        else if (state === 'failed' || state === 'disconnected') {
          this.setStatus('failed');
          this.callbacks.onError?.('Conexão WebRTC perdida');
        }
      };

      this.setStatus('connected');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[WHIPSender] Erro:', msg);
      this.callbacks.onError?.(msg);
      this.setStatus('failed');
      return false;
    }
  }

  /**
   * Substitui as tracks publicadas (troca câmera ↔ tela).
   */
  async replaceTrack(newTrack: MediaStreamTrack): Promise<void> {
    if (!this.pc) return;
    const sender = this.pc.getSenders().find(s => s.track?.kind === newTrack.kind);
    if (sender) await sender.replaceTrack(newTrack);
  }

  /**
   * Substitui todo o stream (câmera → tela ou vice-versa).
   */
  async replaceStream(newStream: MediaStream): Promise<void> {
    if (!this.pc) return;
    for (const track of newStream.getTracks()) {
      await this.replaceTrack(track);
    }
  }

  /**
   * Encerra a transmissão e libera recursos.
   */
  async stop(): Promise<void> {
    // DELETE no recurso WHIP para avisar o servidor
    if (this.resourceUrl) {
      const headers: HeadersInit = {};
      if (MEDIA_SERVER_KEY) headers['Authorization'] = `Bearer ${MEDIA_SERVER_KEY}`;
      try {
        await fetch(this.resourceUrl, { method: 'DELETE', headers });
      } catch { /* não crítico */ }
      this.resourceUrl = null;
    }

    this.pc?.close();
    this.pc = null;
    this.setStatus('disconnected');
  }

  /** Retorna a URL do stream HLS para viewers */
  static getHLSUrl(streamKey: string): string {
    if (!MEDIA_SERVER_URL) return '';
    return `${MEDIA_SERVER_URL}/hls/${encodeURIComponent(streamKey)}/index.m3u8`;
  }

  private waitForICE(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') { resolve(); return; }
      const timeout = setTimeout(resolve, timeoutMs);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        }
      };
    });
  }
}
