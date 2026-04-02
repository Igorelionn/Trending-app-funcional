import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Eye, Trash2, MoreVertical, X, Pencil, Image as ImageIcon, Pin, Crown, Zap, ThumbsUp, Users, Shield, Lock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import * as postsService from '@/services/streamerPostsService';
import type { StreamerPost } from '@/services/streamerPostsService';
import * as privilegedService from '@/services/privilegedService';
import { PollCard } from './PollCard';
import { LinkPreview } from './LinkPreview';
import { FormattedText } from './FormattedText';

interface PostCardProps {
  post: StreamerPost;
  currentUserId: string;
  isOwner: boolean;
  streamerName: string;
  streamerAvatar?: string;
  streamerUserId?: string;
  onDeleted?: () => void;
  onReactionChanged?: () => void;
  onUpdated?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserId,
  isOwner,
  streamerName,
  streamerAvatar,
  streamerUserId,
  onDeleted,
  onReactionChanged,
  onUpdated,
}) => {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [localLiked, setLocalLiked] = useState<boolean>(post.user_reaction === 'like');
  const [localLikesCount, setLocalLikesCount] = useState<number>(post.likes_count || 0);
  const [localViewsCount, setLocalViewsCount] = useState<number>(post.views_count || 0);

  // Sincronizar contadores quando os dados do post mudarem (ex: reload do feed)
  React.useEffect(() => {
    if (!isLiking) {
      setLocalLiked(post.user_reaction === 'like');
      setLocalLikesCount(post.likes_count || 0);
    }
  }, [post.likes_count, post.user_reaction]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    setLocalViewsCount(post.views_count || 0);
  }, [post.views_count]);
  const [showFullText, setShowFullText] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);
  
  // Estados para edição
  const [showEditModal, setShowEditModal] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(post.media_url);
  const [isUploading, setIsUploading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);
  
  // Estados para edição de enquete
  const [editPollQuestion, setEditPollQuestion] = useState('');
  const [editPollOptions, setEditPollOptions] = useState<string[]>([]);

  // Estados para fixar
  const [isPinning, setIsPinning] = useState(false);
  const [localIsPinned, setLocalIsPinned] = useState(post.is_pinned || false);

  // Estados para funções privilegiadas
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [privilegedPermissions, setPrivilegedPermissions] = useState<string[]>([]);
  const [showBoostsModal, setShowBoostsModal] = useState(false);
  const [boostLikes, setBoostLikes] = useState('0');
  const [boostViews, setBoostViews] = useState('0');
  const [isSavingBoosts, setIsSavingBoosts] = useState(false);
  
  // Estados para controle de enquete
  const [showPollControlModal, setShowPollControlModal] = useState(false);
  const [pollOverrides, setPollOverrides] = useState<{ [key: number]: string }>({});
  const [isSavingPollControl, setIsSavingPollControl] = useState(false);

  // Verificar se é streamer privilegiado
  React.useEffect(() => {
    if (isOwner && currentUserId) {
      privilegedService.checkIfPrivileged(currentUserId).then(result => {
        if (result.success && result.isPrivileged && result.permissions) {
          setIsPrivileged(true);
          const permTypes = result.permissions.map((p: any) => p.permission_type);
          setPrivilegedPermissions(permTypes);
        }
      });

      // Buscar boosts atuais DESTE POST específico
      privilegedService.getPostBoosts(post.id).then(result => {
        if (result.success && result.boosts) {
          const likesBoost = result.boosts.find((b: any) => b.boost_type === 'likes');
          const viewsBoost = result.boosts.find((b: any) => b.boost_type === 'views');
          if (likesBoost) setBoostLikes(likesBoost.boost_value.toString());
          if (viewsBoost) setBoostViews(viewsBoost.boost_value.toString());
        }
      });

      // Buscar overrides de enquete se houver
      if (post.poll?.id) {
        privilegedService.getPollOverrides(post.poll.id).then(result => {
          if (result.success && result.overrides) {
            const overridesMap: { [key: number]: string } = {};
            result.overrides.forEach((o: any) => {
              overridesMap[o.option_index] = o.override_percentage?.toString() || '';
            });
            setPollOverrides(overridesMap);
          }
        });
      }
    }
  }, [isOwner, currentUserId, post.poll?.id, post.id]);

  const maxTextLength = 280;
  const shouldTruncate = post.content && post.content.length > maxTextLength;

  // Extrair URLs do conteúdo
  const extractUrls = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  const urls = post.content ? extractUrls(post.content) : [];
  const contentWithoutUrls = post.content ? post.content.replace(/(https?:\/\/[^\s]+)/g, '').trim() : '';

  // Incrementar visualização quando o componente é montado (para todos, incluindo o dono)
  React.useEffect(() => {
    if (!hasViewed && post.id && currentUserId) {
      postsService.incrementViews(post.id, currentUserId).then((result) => {
        if (result.success && result.wasIncremented) {
          setLocalViewsCount(prev => prev + 1);
        }
        setHasViewed(true);
      }).catch(() => {
        setHasViewed(true);
      });
    }
  }, [post.id, currentUserId, hasViewed]);

  const handleEdit = () => {
    setEditContent(post.content);
    setEditImagePreview(post.media_url);
    setEditImage(null);
    setRemoveImage(false);

    // Carregar dados da enquete se houver
    if (post.poll) {
      setEditPollQuestion(post.poll.question);
      const mappedOptions = post.poll.options.map((opt: any) =>
        typeof opt === 'string' ? opt : opt.text
      );
      setEditPollOptions(mappedOptions);
    } else {
      setEditPollQuestion('');
      setEditPollOptions([]);
    }

    setShowEditModal(true);
  };

  const handleTogglePin = async () => {
    setIsPinning(true);
    const previousPinned = localIsPinned;

    // Update otimista
    setLocalIsPinned(!localIsPinned);

    try {
      const result = await postsService.togglePinPost(
        post.id,
        post.streamer_id,
        !localIsPinned
      );

      if (!result.success) {
        setLocalIsPinned(previousPinned);
        toast.error(result.error || 'Erro ao fixar post');
        return;
      }

      toast.success(localIsPinned ? 'Post desfixado' : 'Post fixado');
      onUpdated?.();
    } catch (error) {
      setLocalIsPinned(previousPinned);
      console.error('Erro ao fixar post:', error);
      toast.error('Erro ao fixar post');
    } finally {
      setIsPinning(false);
    }
  };

  const handleOpenBoosts = () => {
    setShowBoostsModal(true);
  };

  const handleSaveBoosts = async () => {
    setIsSavingBoosts(true);
    try {
      const likesValue = parseInt(boostLikes) || 0;
      const viewsValue = parseInt(boostViews) || 0;

      if (privilegedPermissions.includes('likes_boost')) {
        await privilegedService.updatePostBoost(post.id, currentUserId, 'likes', likesValue);
      }

      if (privilegedPermissions.includes('views_boost')) {
        await privilegedService.updatePostBoost(post.id, currentUserId, 'views', viewsValue);
      }

      setShowBoostsModal(false);
      onUpdated?.();
    } catch (error) {
      console.error('Erro ao salvar boosts:', error);
    } finally {
      setIsSavingBoosts(false);
    }
  };

  const handleResetBoosts = async () => {
    try {
      if (privilegedPermissions.includes('likes_boost')) {
        await privilegedService.resetPostBoost(post.id, 'likes');
        setBoostLikes('0');
      }

      if (privilegedPermissions.includes('views_boost')) {
        await privilegedService.resetPostBoost(post.id, 'views');
        setBoostViews('0');
      }

      onUpdated?.();
    } catch (error) {
      console.error('Erro ao resetar boosts:', error);
    }
  };

  const handleOpenPollControl = () => {
    setShowPollControlModal(true);
  };

  const handleSavePollControl = async () => {
    if (!post.poll?.id) return;
    
    // Validar soma = 100%
    const total = Object.values(pollOverrides).reduce((sum, val) => {
      return sum + (parseInt(val) || 0);
    }, 0);

    if (total !== 100) {
      toast.error(`A soma das porcentagens deve ser 100% (atual: ${total}%)`);
      return;
    }
    
    setIsSavingPollControl(true);
    try {
      // Salvar overrides para cada opção
      for (const [indexStr, percentageStr] of Object.entries(pollOverrides)) {
        const index = parseInt(indexStr);
        const percentage = parseInt(percentageStr);

        if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
          await privilegedService.updatePollOverride(post.poll.id, index, percentage);
        }
      }

      setShowPollControlModal(false);
      onUpdated?.();
    } catch (error) {
      console.error('Erro ao salvar controle de enquete:', error);
    } finally {
      setIsSavingPollControl(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Arquivo deve ser uma imagem');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 5MB');
      return;
    }

    setEditImage(file);
    setRemoveImage(false);
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setEditImage(null);
    setEditImagePreview(null);
    setRemoveImage(true);
  };

  const handleUpdate = async () => {
    if (!editContent.trim()) {
      return;
    }

    if (editContent.length > 1000) {
      return;
    }

    setIsUpdating(true);

    try {
      let mediaUrl = post.media_url;

      if (editImage) {
        setIsUploading(true);
        const uploadResult = await postsService.uploadPostImage(post.streamer_id, editImage);
        setIsUploading(false);

        if (!uploadResult.success) {
          setIsUpdating(false);
          return;
        }

        mediaUrl = uploadResult.url || null;
      } else if (removeImage) {
        mediaUrl = null;
      }

      const result = await postsService.updatePost(post.id, post.streamer_id, {
        content: editContent.trim(),
        media_url: mediaUrl,
      });

      if (!result.success) {
        return;
      }

      // Atualizar enquete se houver
      if (post.poll && editPollQuestion && editPollOptions.length >= 2) {
        const pollResult = await postsService.updatePoll(
          post.poll.id,
          editPollQuestion,
          editPollOptions.filter(opt => opt.trim() !== '')
        );
        
        if (!pollResult.success) {
          toast.error(pollResult.error || 'Erro ao atualizar enquete');
          return;
        }
      }

      setShowEditModal(false);
      
      // Recarregar apenas os posts, não a página inteira
      if (onUpdated) {
        onUpdated();
      }
    } catch (error) {
      console.error('Erro ao atualizar post:', error);
    } finally {
      setIsUpdating(false);
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await postsService.deletePost(post.id, post.streamer_id);
      
      if (!result.success) {
        return;
      }

      onDeleted?.();
    } catch (error) {
      console.error('Erro ao deletar post:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLike = async () => {
    if (isLiking) return;

    setIsLiking(true);
    const previousLiked = localLiked;
    const previousCount = localLikesCount;

    // Otimistic update
    setLocalLiked(!localLiked);
    setLocalLikesCount(localLiked ? localLikesCount - 1 : localLikesCount + 1);

    try {
      const result = await postsService.addReaction(post.id, currentUserId, 'like');
      
      if (!result.success) {
        // Reverter em caso de erro
        setLocalLiked(previousLiked);
        setLocalLikesCount(previousCount);
        toast.error(result.error || 'Erro ao curtir');
        return;
      }

      // Não chamar onReactionChanged para evitar reload
    } catch (error) {
      // Reverter em caso de erro
      setLocalLiked(previousLiked);
      setLocalLikesCount(previousCount);
      console.error('Erro ao curtir:', error);
      toast.error('Erro ao curtir');
    } finally {
      setIsLiking(false);
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: ptBR,
      });
    } catch {
      return 'Há pouco tempo';
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const displayText = shouldTruncate && !showFullText 
    ? `${contentWithoutUrls.slice(0, maxTextLength)}...` 
    : contentWithoutUrls;

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 hover:bg-white/[0.07] transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <button
            className={streamerUserId ? 'cursor-pointer' : 'cursor-default'}
            onClick={() => streamerUserId && navigate(`/profile/${streamerUserId}`)}
            tabIndex={streamerUserId ? 0 : -1}
          >
            <Avatar className="h-10 w-10 ring-2 ring-white/10 hover:opacity-80 transition-opacity">
              <AvatarImage 
                src={streamerAvatar}
                className="object-cover w-full h-full"
              />
              <AvatarFallback className="bg-zinc-800 text-zinc-300 text-sm">
                {streamerName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </button>
          
          <div>
            <button
              className={streamerUserId ? 'text-sm font-semibold text-white hover:underline' : 'text-sm font-semibold text-white'}
              onClick={() => streamerUserId && navigate(`/profile/${streamerUserId}`)}
            >
              {streamerName}
            </button>
            <p className="text-xs text-zinc-500">{formatTime(post.created_at)}</p>
          </div>
          
          {/* Badge de Post Fixado */}
          {localIsPinned && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 border border-purple-500/50 rounded-full ml-2">
              <Pin className="h-3 w-3 text-purple-400" />
              <span className="text-xs text-purple-400 font-medium">Fixado</span>
            </div>
          )}
          {/* Badge de Post Exclusivo para Apoiadores — só visível para o dono */}
          {post.supporters_only && isOwner && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 rounded-full ml-2">
              <Lock className="h-3 w-3 text-amber-400" />
              <span className="text-xs text-amber-400 font-medium">Apoiadores</span>
            </div>
          )}
        </div>

        {/* Menu de opções (apenas para o dono) */}
        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-zinc-500 hover:text-white hover:bg-white/10"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-white/10">
              {/* Opções normais */}
              <DropdownMenuItem
                onClick={handleTogglePin}
                disabled={isPinning}
                className="text-zinc-300 hover:text-white focus:text-white hover:bg-white/10 focus:bg-white/10"
              >
                <Pin className="h-4 w-4 mr-2" />
                {localIsPinned ? 'Desafixar post' : 'Fixar post'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleEdit}
                className="text-zinc-300 hover:text-white focus:text-white hover:bg-white/10 focus:bg-white/10"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Editar post
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-red-400 hover:text-red-300 focus:text-red-300 hover:bg-white/10 focus:bg-white/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? 'Deletando...' : 'Deletar post'}
              </DropdownMenuItem>

              {/* Funções privilegiadas */}
              {isPrivileged && privilegedPermissions.length > 0 && (
                <>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuLabel className="text-xs text-zinc-500 flex items-center gap-2">
                    <Crown className="h-3 w-3 text-yellow-500" />
                    Funções Privilegiadas
                  </DropdownMenuLabel>

                  {(privilegedPermissions.includes('likes_boost') || privilegedPermissions.includes('views_boost')) && (
                    <DropdownMenuItem
                      onClick={handleOpenBoosts}
                      className="text-yellow-400 hover:text-yellow-300 focus:text-yellow-300 hover:bg-white/10 focus:bg-white/10"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Ajustar Boosts
                    </DropdownMenuItem>
                  )}

                  {privilegedPermissions.includes('poll_control') && post.poll && (
                    <DropdownMenuItem
                      onClick={handleOpenPollControl}
                      className="text-purple-400 hover:text-purple-300 focus:text-purple-300 hover:bg-white/10 focus:bg-white/10"
                    >
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      Controlar Enquete
                    </DropdownMenuItem>
                  )}

                  {(privilegedPermissions.includes('likes_boost') || privilegedPermissions.includes('views_boost')) && (
                    <DropdownMenuItem
                      onClick={handleResetBoosts}
                      className="text-red-400 hover:text-red-300 focus:text-red-300 hover:bg-white/10 focus:bg-white/10"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Resetar Boosts
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Conteúdo de texto (sem URLs) com formatação */}
      {contentWithoutUrls && (
        <div className="mb-3">
          <FormattedText 
            text={showFullText ? contentWithoutUrls : displayText}
            className="text-white text-[15px] leading-relaxed"
            mentions={post.mentions}
          />
          {shouldTruncate && (
            <button
              onClick={() => setShowFullText(!showFullText)}
              className="text-zinc-400 hover:text-white text-sm mt-1 transition-colors"
            >
              {showFullText ? 'Mostrar menos' : 'Mostrar mais'}
            </button>
          )}
        </div>
      )}

      {/* Preview de Links */}
      {urls.length > 0 && (
        <div className="space-y-2">
          {urls.map((url, index) => (
            <LinkPreview key={index} url={url} />
          ))}
        </div>
      )}

      {/* Enquete */}
      {post.poll && (
        <PollCard
          poll={post.poll}
          currentUserId={currentUserId}
          isOwner={isOwner}
          onVoteChanged={onUpdated}
        />
      )}

      {/* Imagem embaixo - estilo Twitter com altura maior */}
      {post.media_url && (
        <div 
          className="mb-3 rounded-xl overflow-hidden border border-white/10 cursor-pointer group"
          onClick={() => setShowImageModal(true)}
        >
          <img
            src={post.media_url}
            alt="Post"
            className="w-full h-[480px] object-cover group-hover:opacity-90 transition-opacity"
          />
        </div>
      )}

      {/* Stats e ações */}
      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        {/* Stats */}
        <div className="flex items-center gap-4 text-zinc-500 text-xs">
          {/* Visualizações */}
          <div className="flex items-center gap-1.5">
            <Eye className="h-4 w-4" />
            <span>{formatNumber(localViewsCount)}</span>
          </div>
        </div>

        {/* Botão de curtir */}
        <button
          onClick={handleLike}
          disabled={isLiking}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-full transition-all
            ${localLiked 
              ? 'bg-red-500/20 text-red-500' 
              : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
            }
            ${isLiking ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <Heart 
            className={`h-4 w-4 ${localLiked ? 'fill-current' : ''}`}
          />
          {localLikesCount > 0 && (
            <span className="text-sm font-medium">
              {formatNumber(localLikesCount)}
            </span>
          )}
        </button>
      </div>

      {/* Modal de zoom da imagem */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-4xl w-full bg-black/95 border-white/10 p-0">
          <div className="relative">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 z-50 p-2 bg-black/80 hover:bg-black rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-white" />
            </button>
            <img
              src={post.media_url || ''}
              alt="Post expandido"
              className="w-full h-auto max-h-[90vh] object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de edição - Design Clean e Minimalista */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-xl bg-zinc-950/95 backdrop-blur-xl border border-white/5 shadow-2xl">
          <DialogHeader className="border-b border-white/5 pb-4">
            <DialogTitle className="text-white text-lg font-normal">Editar publicação</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-5 py-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="O que você está pensando?"
              className="min-h-[100px] bg-transparent !border-none text-white placeholder:text-zinc-600 resize-none !ring-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 text-[15px] p-0 !outline-none"
              maxLength={1000}
            />

            {/* Edição de enquete (se houver) */}
            {post.poll && editPollOptions.length > 0 && (
              <div className="space-y-3 p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <ThumbsUp className="h-4 w-4" />
                  <span>Editar Enquete</span>
                </div>
                
                <Input
                  value={editPollQuestion}
                  onChange={(e) => setEditPollQuestion(e.target.value)}
                  placeholder="Pergunta da enquete"
                  className="bg-transparent !border-b !border-white/10 rounded-none text-white focus-visible:!ring-0 !outline-none"
                  maxLength={200}
                />

                <div className="space-y-2">
                  {editPollOptions.map((option, index) => (
                    <Input
                      key={index}
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...editPollOptions];
                        newOptions[index] = e.target.value;
                        setEditPollOptions(newOptions);
                      }}
                      placeholder={`Opção ${index + 1}`}
                      className="bg-transparent !border-b !border-white/5 rounded-none text-white focus-visible:!ring-0 !outline-none"
                      maxLength={100}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Preview da imagem com altura maior */}
            {editImagePreview && (
              <div className="relative rounded-lg overflow-hidden border border-white/5">
                <img
                  src={editImagePreview}
                  alt="Preview"
                  className="w-full h-[400px] object-cover"
                />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-3 right-3 p-1.5 bg-black/60 backdrop-blur-sm hover:bg-black/80 rounded-full transition-all"
                >
                  <X className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-white/5">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full cursor-pointer transition-all group">
                  <ImageIcon className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                  <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">
                    {editImagePreview ? 'Trocar' : 'Imagem'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
                
                <span className="text-[11px] text-zinc-600">
                  {editContent.length}/1000
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowEditModal(false)}
                  variant="ghost"
                  size="sm"
                  className="h-9 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded-full"
                  disabled={isUpdating || isUploading}
                >
                  Cancelar
                </Button>

                <Button
                  onClick={handleUpdate}
                  disabled={isUpdating || isUploading || !editContent.trim()}
                  size="sm"
                  className="h-9 px-6 text-sm font-medium bg-white text-black hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-all"
                >
                  {isUploading ? 'Enviando...' : isUpdating ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Boosts - Funções Privilegiadas */}
      <Dialog open={showBoostsModal} onOpenChange={setShowBoostsModal}>
        <DialogContent className="max-w-md bg-zinc-950/95 backdrop-blur-xl border border-yellow-500/20 shadow-2xl">
          <DialogHeader className="border-b border-yellow-500/20 pb-4">
            <DialogTitle className="text-white text-lg font-normal flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Ajustar Boosts
            </DialogTitle>
            <p className="text-xs text-zinc-500 mt-2">
              Os valores serão somados às suas métricas reais
            </p>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {privilegedPermissions.includes('likes_boost') && (
              <div className="space-y-2">
                <label className="text-sm text-zinc-300 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-400" />
                  Boost de Curtidas
                </label>
                <Input
                  type="number"
                  min="0"
                  value={boostLikes}
                  onChange={(e) => setBoostLikes(e.target.value)}
                  placeholder="0"
                  className="bg-transparent border-0 border-b border-white/10 rounded-none text-white focus-visible:ring-0 focus-visible:border-yellow-500/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none px-0"
                />
              </div>
            )}

            {privilegedPermissions.includes('views_boost') && (
              <div className="space-y-2">
                <label className="text-sm text-zinc-300 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-400" />
                  Boost de Visualizações
                </label>
                <Input
                  type="number"
                  min="0"
                  value={boostViews}
                  onChange={(e) => setBoostViews(e.target.value)}
                  placeholder="0"
                  className="bg-transparent border-0 border-b border-white/10 rounded-none text-white focus-visible:ring-0 focus-visible:border-yellow-500/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none px-0"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-yellow-500/20">
              <Button
                onClick={() => setShowBoostsModal(false)}
                variant="ghost"
                size="sm"
                className="h-9 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded-full"
                disabled={isSavingBoosts}
              >
                Cancelar
              </Button>

              <Button
                onClick={handleSaveBoosts}
                disabled={isSavingBoosts}
                size="sm"
                className="h-9 px-6 text-sm font-medium bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-50 rounded-full transition-all"
              >
                {isSavingBoosts ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Controle de Enquete - Funções Privilegiadas */}
      <Dialog open={showPollControlModal} onOpenChange={setShowPollControlModal}>
        <DialogContent className="max-w-md bg-zinc-950/95 backdrop-blur-xl border border-purple-500/20 shadow-2xl">
          <DialogHeader className="border-b border-purple-500/20 pb-4">
            <DialogTitle className="text-white text-lg font-normal flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-purple-500" />
              Controlar Enquete
            </DialogTitle>
            <p className="text-xs text-zinc-500 mt-2">
              Defina as porcentagens de cada opção (soma deve ser 100%)
            </p>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {post.poll?.options.map((option, index) => (
              <div key={index} className="space-y-2">
                <label className="text-sm text-zinc-300 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/20 text-xs text-purple-400">
                    {index + 1}
                  </span>
                  {typeof option === 'string' ? option : option.text}
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={pollOverrides[index] || ''}
                    onChange={(e) => setPollOverrides({
                      ...pollOverrides,
                      [index]: e.target.value
                    })}
                    placeholder="0"
                    className="bg-transparent border-0 border-b border-white/10 rounded-none text-white focus-visible:ring-0 focus-visible:border-purple-500/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none px-0"
                  />
                  <span className="text-sm text-zinc-500">%</span>
                </div>
              </div>
            ))}

            {/* Validação da soma */}
            {(() => {
              const total = Object.values(pollOverrides).reduce((sum, val) => {
                const num = parseInt(val) || 0;
                return sum + num;
              }, 0);
              const diff = 100 - total;
              const isValid = total === 100;

              return (
                <div className={`
                  p-3 rounded-lg border text-sm
                  ${isValid 
                    ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  }
                `}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total:</span>
                    <span className="font-bold">{total}%</span>
                  </div>
                  {!isValid && (
                    <p className="text-xs mt-1">
                      {diff > 0 
                        ? `Faltam ${diff}% para completar 100%` 
                        : `Excede em ${Math.abs(diff)}%, remova ${Math.abs(diff)}%`
                      }
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-purple-500/20">
              <Button
                onClick={() => setShowPollControlModal(false)}
                variant="ghost"
                size="sm"
                className="h-9 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded-full"
                disabled={isSavingPollControl}
              >
                Cancelar
              </Button>

              <Button
                onClick={handleSavePollControl}
                disabled={(() => {
                  const total = Object.values(pollOverrides).reduce((sum, val) => {
                    return sum + (parseInt(val) || 0);
                  }, 0);
                  return isSavingPollControl || total !== 100;
                })()}
                size="sm"
                className="h-9 px-6 text-sm font-medium bg-purple-500 text-white hover:bg-purple-400 disabled:opacity-50 rounded-full transition-all"
              >
                {isSavingPollControl ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
