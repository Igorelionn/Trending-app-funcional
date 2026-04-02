import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import * as postsService from '@/services/streamerPostsService';
import type { PostPoll } from '@/services/streamerPostsService';
import * as privilegedService from '@/services/privilegedService';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PollCardProps {
  poll: PostPoll;
  currentUserId: string;
  isOwner: boolean;
  onVoteChanged?: () => void;
}

export const PollCard: React.FC<PollCardProps> = ({
  poll,
  currentUserId,
  isOwner,
  onVoteChanged,
}) => {
  const [isVoting, setIsVoting] = useState(false);
  const [localUserVote, setLocalUserVote] = useState<number | null>(poll.user_vote ?? null);
  const [localOptions, setLocalOptions] = useState(poll.options);
  const [localVotesCount, setLocalVotesCount] = useState(poll.votes_count);
  const [pollOverrides, setPollOverrides] = useState<{ [key: number]: number }>({});

  const hasVoted = localUserVote !== null;
  const totalVotes = localVotesCount;
  const isExpired = poll.ends_at ? new Date(poll.ends_at) < new Date() : false;

  // Buscar overrides da enquete (se houver)
  useEffect(() => {
    privilegedService.getPollOverrides(poll.id).then(result => {
      if (result.success && result.overrides) {
        const overridesMap: { [key: number]: number } = {};
        result.overrides.forEach((o: any) => {
          overridesMap[o.option_index] = o.override_percentage;
        });
        setPollOverrides(overridesMap);
      }
    });
  }, [poll.id]);

  const handleVote = async (optionIndex: number) => {
    if (isVoting || isExpired) return;

    console.log('🗳️ Tentando votar:', { 
      pollId: poll.id, 
      optionIndex, 
      currentUserId,
      previousVote: localUserVote,
      currentOptions: localOptions
    });

    setIsVoting(true);
    const previousVote = localUserVote;
    const previousOptions = [...localOptions];
    const previousCount = localVotesCount;

    // Update otimista
    const newOptions = localOptions.map((opt, idx) => {
      const newVotes = idx === optionIndex 
        ? opt.votes + (previousVote === null ? 1 : previousVote === idx ? 0 : 1)
        : previousVote === idx 
          ? opt.votes - 1 
          : opt.votes;
      
      console.log(`Option ${idx}: ${opt.votes} -> ${newVotes}`);
      
      return {
        ...opt,
        votes: newVotes
      };
    });

    setLocalOptions(newOptions);
    setLocalUserVote(previousVote === optionIndex ? null : optionIndex);
    setLocalVotesCount(previousVote === null ? totalVotes + 1 : totalVotes);

    console.log('📊 Update otimista:', { newOptions, newVote: previousVote === optionIndex ? null : optionIndex });

    try {
      const result = await postsService.voteInPoll(poll.id, currentUserId, optionIndex);

      console.log('✅ Resultado do voto:', result);

      if (!result.success) {
        // Reverter em caso de erro
        setLocalOptions(previousOptions);
        setLocalUserVote(previousVote);
        setLocalVotesCount(previousCount);
        toast.error(result.error || 'Erro ao votar');
        return;
      }

      // Voto registrado com sucesso - update otimista já aplicado
      // Não recarregar posts para evitar perder estado
    } catch (error) {
      // Reverter em caso de erro
      setLocalOptions(previousOptions);
      setLocalUserVote(previousVote);
      setLocalVotesCount(previousCount);
      console.error('❌ Erro ao votar:', error);
      toast.error('Erro ao votar');
    } finally {
      setIsVoting(false);
    }
  };

  const getPercentage = (votes: number, optionIndex: number) => {
    // Se houver override para esta opção, usar o override
    if (pollOverrides[optionIndex] !== undefined) {
      return pollOverrides[optionIndex];
    }
    
    // Caso contrário, calcular normalmente
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  const formatTimeRemaining = () => {
    if (!poll.ends_at) return 'Sem prazo';
    if (isExpired) return 'Encerrada';
    
    try {
      const endsAt = new Date(poll.ends_at);
      const now = new Date();
      const diffInMinutes = Math.floor((endsAt.getTime() - now.getTime()) / (1000 * 60));
      const diffInHours = Math.floor(diffInMinutes / 60);
      const diffInDays = Math.floor(diffInHours / 24);

      if (diffInMinutes < 1) {
        return 'Expira em instantes';
      } else if (diffInMinutes < 60) {
        return `Expira em ${diffInMinutes}min`;
      } else if (diffInHours < 24) {
        return `Expira em ${diffInHours}h`;
      } else if (diffInDays === 1) {
        return 'Expira em 1 dia';
      } else {
        return `Expira em ${diffInDays} dias`;
      }
    } catch {
      return 'Sem prazo';
    }
  };

  return (
    <div className="mb-3 p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
      {/* Pergunta */}
      <div className="flex items-start gap-2">
        <p className="text-white font-medium text-[15px]">{poll.question}</p>
      </div>

      {/* Opções */}
      <div className="space-y-2">
        {localOptions.map((option, index) => {
          const percentage = getPercentage(option.votes, index);
          const isSelected = localUserVote === index;
          const showResults = hasVoted || isOwner || isExpired;

          return (
            <button
              key={index}
              onClick={() => !isExpired && handleVote(index)}
              disabled={isVoting || isExpired}
              className={`
                w-full text-left p-3 rounded-lg border transition-all relative overflow-hidden
                ${showResults
                  ? 'cursor-default'
                  : 'cursor-pointer hover:bg-white/10'
                }
                ${isSelected
                  ? 'border-purple-500/50 bg-purple-500/10'
                  : 'border-white/10 bg-white/5'
                }
                ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {/* Barra de progresso */}
              {showResults && (
                <div
                  className="absolute inset-0 bg-purple-500/20 transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              )}

              {/* Conteúdo */}
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  {isSelected ? (
                    <CheckCircle2 className="h-4 w-4 text-purple-400 flex-shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                  )}
                  <span className="text-white text-sm">{option.text}</span>
                </div>

                {showResults && (
                  <span className="text-white font-medium text-sm">
                    {percentage}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Info */}
      <div className="flex items-center justify-end text-xs text-zinc-500 pt-2 border-t border-white/10">
        <span>
          {formatTimeRemaining()}
        </span>
      </div>
    </div>
  );
};
