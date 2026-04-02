import React, { useState, useRef, useEffect } from 'react';
import { Send, Users, MessageCircle, Crown, Trash2, Shield, AlertCircle, Loader2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLiveStream } from '@/contexts/LiveStreamContext';
import { ModerationActionsMenu } from './ModerationActionsMenu';
import * as moderationService from '@/services/moderationService';
import { toast } from 'sonner';

interface Message {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: Date;
  isHost: boolean;
  isModerator?: boolean;
}

interface EnhancedMinimalChatProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  currentUserId: string;
  streamId: string;
  streamerId: string;
  viewerCount: number;
  isStreamer?: boolean;
  chatEnabled?: boolean;
  linksAllowed?: boolean;
  linksModeratorOnly?: boolean;
  onClose?: () => void;
}

export const EnhancedMinimalChat: React.FC<EnhancedMinimalChatProps> = ({
  messages,
  onSendMessage,
  currentUserId,
  streamId,
  streamerId,
  viewerCount,
  isStreamer = false,
  chatEnabled = true,
  linksAllowed = true,
  linksModeratorOnly = false,
  onClose
}) => {
  const [inputValue, setInputValue] = useState('');
  const [canMod, setCanMod] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { deleteComment, canModerate } = useLiveStream();

  // Verificar se pode moderar
  useEffect(() => {
    const checkModeration = async () => {
      if (!streamId) {
        setCanMod(false);
        return;
      }
      const canMod = await canModerate(streamId);
      setCanMod(canMod);
    };
    checkModeration();
  }, [streamId, canModerate]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const hasLink = (text: string): boolean => {
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/g;
    return urlRegex.test(text);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatEnabled) {
      toast.error('O chat está desabilitado');
      return;
    }

    if (!inputValue.trim()) return;

    // Verificar status de moderação do usuário
    try {
      const moderationStatus = await moderationService.checkUserModerationStatus(
        currentUserId,
        streamerId
      );

      // Verificar se está banido
      if (moderationStatus.isBanned) {
        toast.error('Você está banido das lives deste streamer');
        setInputValue('');
        return;
      }

      // Verificar se está mutado
      if (moderationStatus.isMuted) {
        toast.error('Você está mutado e não pode enviar mensagens');
        setInputValue('');
        return;
      }

      // Verificar se está em timeout
      if (moderationStatus.isInTimeout && moderationStatus.timeoutExpiresAt) {
        const remainingMinutes = Math.ceil(
          (moderationStatus.timeoutExpiresAt.getTime() - Date.now()) / 60000
        );
        toast.error(`Você está em timeout. Tempo restante: ${remainingMinutes} minuto(s)`);
        setInputValue('');
        return;
      }
    } catch (error) {
      console.error('Erro ao verificar status de moderação:', error);
      // Continuar mesmo com erro na verificação
    }

    // Verificar links
    if (hasLink(inputValue)) {
      if (!linksAllowed) {
        toast.error('Links não são permitidos neste chat');
        return;
      }
      if (linksModeratorOnly && !canMod) {
        toast.error('Apenas moderadores podem enviar links');
        return;
      }
    }

    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!canMod) {
      toast.error('Você não tem permissão para deletar mensagens');
      return;
    }

    setDeletingId(messageId);
    try {
      const success = await deleteComment(messageId, streamId);
      if (success) {
        toast.success('Mensagem deletada');
      } else {
        toast.error('Erro ao deletar mensagem');
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-xl border-l border-white/[0.05]">
      {/* Header ultra minimalista */}
      <div className="flex items-center justify-between px-7 py-6 border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/[0.02] border border-white/[0.05] rounded-xl">
            <MessageCircle className="h-3.5 w-3.5 text-white/60" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-light text-white/90 tracking-wide">Chat ao Vivo</span>
            {!chatEnabled && (
              <span className="text-[10px] text-red-400/70 font-extralight">Desabilitado</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.02] border border-white/[0.05] rounded-full">
            <Users className="h-3 w-3 text-white/40" strokeWidth={1.5} />
            <span className="text-[11px] font-light text-white/60 tabular-nums">{viewerCount}</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/[0.05] border border-white/[0.05] rounded-xl transition-all duration-200 group"
              aria-label="Fechar chat"
            >
              <X className="h-3.5 w-3.5 text-white/40 group-hover:text-white/70" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* Área de mensagens */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-7 py-6 minimal-scrollbar"
      >
        <div className="space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl mb-4">
                <MessageCircle className="h-8 w-8 text-white/20" strokeWidth={1.5} />
              </div>
              <p className="text-[13px] text-white/40 font-light">Nenhuma mensagem ainda</p>
              <p className="text-[11px] text-white/20 font-extralight mt-1">Seja o primeiro a comentar!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className="group flex gap-3 hover:bg-white/[0.01] -mx-4 px-4 py-3 rounded-xl transition-all duration-300"
              >
                {/* Avatar minimalista */}
                <div className="relative flex-shrink-0 mt-0.5">
                  <Avatar className="h-8 w-8 ring-1 ring-white/[0.08]">
                    <AvatarImage src={message.userAvatar} />
                    <AvatarFallback className="bg-white/[0.03] text-white/60 text-[11px] font-light">
                      {message.userName?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {message.isHost && (
                    <div className="absolute -bottom-0.5 -right-0.5 p-[3px] bg-black rounded-full ring-1 ring-white/[0.12]">
                      <Crown className="h-2 w-2 text-amber-400" fill="currentColor" strokeWidth={1.5} />
                    </div>
                  )}
                  {message.isModerator && !message.isHost && (
                    <div className="absolute -bottom-0.5 -right-0.5 p-[3px] bg-black rounded-full ring-1 ring-white/[0.12]">
                      <Shield className="h-2 w-2 text-blue-400" fill="currentColor" strokeWidth={1.5} />
                    </div>
                  )}
                </div>

                {/* Conteúdo minimalista */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-[12px] font-light text-white/90 tracking-wide">
                      {message.userName}
                    </span>
                    <span className="text-[10px] text-white/25 font-extralight">
                      {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-[13px] text-white/70 font-extralight leading-relaxed break-words">
                    {message.content}
                  </p>
                </div>

                {/* Menu de ações de moderação */}
                {canMod && (
                  <div className="self-start mt-1">
                    <ModerationActionsMenu
                      messageId={message.id}
                      userId={message.userId}
                      userName={message.userName}
                      streamerId={streamerId}
                      currentUserId={currentUserId}
                      isStreamer={isStreamer}
                      isModerator={canMod && !isStreamer}
                      onDeleteMessage={handleDeleteMessage}
                    />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Separador ultra sutil */}
      <div className="h-[0.5px] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent mx-7" />

      {/* Input ultra minimalista */}
      <form onSubmit={handleSubmit} className="px-7 py-6">
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={chatEnabled ? "Enviar mensagem..." : "Chat desabilitado"}
            disabled={!chatEnabled}
            className="w-full h-11 bg-white/[0.02] border border-white/[0.05] rounded-2xl pl-4 pr-12 text-[13px] font-light text-white/90 placeholder:text-white/25 focus:outline-none focus:bg-white/[0.03] focus:border-white/[0.12] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || !chatEnabled}
            aria-label="Enviar mensagem"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl bg-white/95 hover:bg-white active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center group"
          >
            <Send className="h-3.5 w-3.5 text-black translate-x-[1px]" strokeWidth={2} />
          </button>
        </div>
        
        {/* Indicadores de restrições ultra minimalistas */}
        {(linksModeratorOnly || !linksAllowed) && chatEnabled && (
          <div className="mt-3 flex items-center gap-2 text-[10px] text-white/30 font-extralight">
            <div className="p-1 bg-white/[0.02] border border-white/[0.05] rounded-md">
              <AlertCircle className="h-2.5 w-2.5 text-white/40" strokeWidth={1.5} />
            </div>
            {!linksAllowed ? (
              <span>Links não permitidos</span>
            ) : linksModeratorOnly ? (
              <span>Links apenas para moderadores</span>
            ) : null}
          </div>
        )}
      </form>
    </div>
  );
};
