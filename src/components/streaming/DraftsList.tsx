import React, { useState, useEffect } from 'react';
import { Clock, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import * as postsService from '@/services/streamerPostsService';
import type { PostDraft } from '@/services/streamerPostsService';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DraftsListProps {
  streamerId: string;
  onLoadDraft: (draft: PostDraft) => void;
  onDraftDeleted: () => void;
}

export const DraftsList: React.FC<DraftsListProps> = ({
  streamerId,
  onLoadDraft,
  onDraftDeleted,
}) => {
  const [drafts, setDrafts] = useState<PostDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadDrafts();
  }, [streamerId]);

  const loadDrafts = async () => {
    setIsLoading(true);
    const result = await postsService.getDrafts(streamerId);
    if (result.success && result.drafts) {
      setDrafts(result.drafts);
    }
    setIsLoading(false);
  };

  const handleDelete = async (draftId: string) => {
    setDeletingId(draftId);
    const result = await postsService.deleteDraft(draftId, streamerId);
    
    if (result.success) {
      setDrafts(drafts.filter(d => d.id !== draftId));
      onDraftDeleted();
    }
    
    setDeletingId(null);
  };

  const formatExpiration = (date: string) => {
    try {
      const expiresAt = new Date(date);
      const now = new Date();
      const diffInHours = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInHours / 24);

      if (diffInHours < 1) {
        return 'Expira em menos de 1 hora';
      } else if (diffInHours < 24) {
        return `Expira em ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`;
      } else if (diffInDays === 1) {
        return 'Expira em 1 dia';
      } else {
        return `Expira em ${diffInDays} dias`;
      }
    } catch {
      return 'Expira em breve';
    }
  };

  if (isLoading) {
    return <div className="text-zinc-500 text-sm">Carregando rascunhos...</div>;
  }

  if (drafts.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-lg space-y-2">
      <h3 className="text-sm font-medium text-zinc-400 mb-2">Rascunhos Salvos</h3>
      {drafts.map(draft => (
        <div
          key={draft.id}
          className="flex items-start justify-between p-2 bg-white/5 rounded hover:bg-white/10 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm truncate">
              {draft.content.substring(0, 60)}...
            </p>
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3 text-zinc-500" />
              <span className="text-xs text-zinc-500">
                Expira {formatExpiration(draft.expires_at)}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 ml-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onLoadDraft(draft)}
              className="h-7 w-7 p-0"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDelete(draft.id)}
              disabled={deletingId === draft.id}
              className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
