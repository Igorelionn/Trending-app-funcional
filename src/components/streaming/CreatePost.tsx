import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Loader2, BarChart3, Plus, Link as LinkIcon, Lock, LockOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import * as postsService from '@/services/streamerPostsService';
import { RichTextEditor } from './RichTextEditor';

interface CreatePostProps {
  streamerId: string;
  onPostCreated?: () => void;
}

export const CreatePost: React.FC<CreatePostProps> = ({ streamerId, onPostCreated }) => {
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados da enquete
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollDuration, setPollDuration] = useState<number>(24); // 24 horas padrão

  // Estados de link
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  // Post exclusivo para apoiadores
  const [supportersOnly, setSupportersOnly] = useState(false);

  const maxLength = 500;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast.error('Arquivo deve ser uma imagem');
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 5MB');
      return;
    }

    setImageFile(file);

    // Criar preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const togglePollForm = () => {
    setShowPollForm(!showPollForm);
    if (showPollForm) {
      setPollQuestion('');
      setPollOptions(['', '']);
      setPollDuration(24);
    }
    // Não desabilitar mais a imagem quando enquete estiver ativa
  };

  const addPollOption = () => {
    if (pollOptions.length < 4) {
      setPollOptions([...pollOptions, '']);
    }
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const toggleLinkInput = () => {
    setShowLinkInput(!showLinkInput);
    if (showLinkInput) {
      setLinkUrl('');
    }
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() && !imageFile && !showPollForm && !linkUrl) {
      toast.error('Adicione conteúdo ao seu post');
      return;
    }

    if (content.length > maxLength) {
      toast.error(`Texto deve ter no máximo ${maxLength} caracteres`);
      return;
    }

    // Validar link se fornecido
    if (linkUrl && !isValidUrl(linkUrl)) {
      toast.error('URL inválida');
      return;
    }

    // Validar enquete se estiver ativa
    if (showPollForm) {
      if (!pollQuestion.trim()) {
        toast.error('Digite uma pergunta para a enquete');
        return;
      }
      const validOptions = pollOptions.filter(opt => opt.trim());
      if (validOptions.length < 2) {
        toast.error('Adicione pelo menos 2 opções para a enquete');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let mediaUrl: string | null = null;

      // Upload da imagem se existir
      if (imageFile) {
        setIsUploading(true);
        const uploadResult = await postsService.uploadPostImage(streamerId, imageFile);
        setIsUploading(false);

        if (!uploadResult.success) {
          toast.error(uploadResult.error || 'Erro ao fazer upload da imagem');
          return;
        }

        mediaUrl = uploadResult.url || null;
      }

      // Preparar conteúdo com link se fornecido
      let finalContent = content.trim();
      if (linkUrl) {
        finalContent = finalContent ? `${finalContent}\n\n${linkUrl}` : linkUrl;
      }

      // Extrair menções do conteúdo (buscar IDs dos usuários mencionados)
      const mentionRegex = /@([\wÀ-ÿ\s]+)/g;
      const mentionMatches = Array.from(finalContent.matchAll(mentionRegex));
      const mentionedUserIds: string[] = [];

      if (mentionMatches.length > 0) {
        // Buscar IDs dos usuários mencionados
        for (const match of mentionMatches) {
          const mentionedName = match[1].trim();
          const searchResult = await postsService.searchStreamersForMention(mentionedName);
          
          if (searchResult.success && searchResult.streamers && searchResult.streamers.length > 0) {
            // Encontrar correspondência exata
            const exactMatch = searchResult.streamers.find(
              s => s.nome.toLowerCase() === mentionedName.toLowerCase()
            );
            if (exactMatch && !mentionedUserIds.includes(exactMatch.id)) {
              mentionedUserIds.push(exactMatch.id);
            }
          }
        }
      }

      // Preparar dados da enquete
      let pollData = undefined;
      if (showPollForm) {
        pollData = {
          question: pollQuestion.trim(),
          options: pollOptions.filter(opt => opt.trim()),
          duration: pollDuration,
        };
      }

      // Criar post
      const result = await postsService.createPost(streamerId, {
        content: finalContent,
        media_url: mediaUrl,
        poll: pollData,
        mentions: mentionedUserIds.length > 0 ? mentionedUserIds : undefined,
        supporters_only: supportersOnly,
      });

      if (!result.success) {
        toast.error(result.error || 'Erro ao criar post');
        return;
      }

      toast.success('Post criado com sucesso!');
      
      // Limpar formulário
      setContent('');
      removeImage();
      setShowPollForm(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      setPollDuration(24);
      setShowLinkInput(false);
      setLinkUrl('');
      setSupportersOnly(false);
      
      // Callback
      onPostCreated?.();
    } catch (error) {
      console.error('Erro ao criar post:', error);
      toast.error('Erro ao criar post');
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const remainingChars = maxLength - content.length;
  const isOverLimit = remainingChars < 0;
  const canSubmit = (content.trim() || imageFile || linkUrl || (showPollForm && pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2)) && !isOverLimit;

  return (
    <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-4">
      <div className="space-y-3">
        {/* Rich Text Editor */}
        <RichTextEditor
          value={content}
          onChange={setContent}
          disabled={isSubmitting}
          maxLength={maxLength}
        />

        {/* Preview da imagem / gráfico */}
        {imagePreview && (
          <div className="relative rounded-xl overflow-hidden border border-white/10 bg-zinc-950">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full max-h-[420px] object-contain"
              style={{ display: 'block' }}
            />
            <button
              onClick={removeImage}
              disabled={isSubmitting}
              className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-black rounded-full transition-colors"
            >
              <X className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        )}

        {/* Formulário da enquete */}
        {showPollForm && (
          <div className="space-y-4 py-3">
            <Input
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Faça uma pergunta..."
              className="bg-transparent border-none border-b border-white/10 rounded-none text-white placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:border-white/20 px-0 text-[15px]"
              disabled={isSubmitting}
              maxLength={200}
            />

            <div className="space-y-2">
              {pollOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-3 group">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 flex-shrink-0">
                    <span className="text-zinc-500 text-xs font-medium">{index + 1}</span>
                  </div>
                  <Input
                    value={option}
                    onChange={(e) => updatePollOption(index, e.target.value)}
                    placeholder="Adicionar opção"
                    className="bg-transparent border-none border-b border-white/5 rounded-none text-white placeholder:text-zinc-700 focus-visible:ring-0 focus-visible:border-white/20 px-0 text-sm"
                    disabled={isSubmitting}
                    maxLength={100}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      onClick={() => removePollOption(index)}
                      disabled={isSubmitting}
                      className="p-1 hover:bg-white/10 rounded-full transition-all opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3 text-zinc-500" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {pollOptions.length < 4 && (
              <button
                onClick={addPollOption}
                disabled={isSubmitting}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1.5"
              >
                <Plus className="h-3 w-3" />
                Adicionar opção
              </button>
            )}

            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs text-zinc-600">Duração</span>
              <div className="flex items-center gap-1">
                {[
                  { label: '1h', value: 1 },
                  { label: '6h', value: 6 },
                  { label: '1d', value: 24 },
                  { label: '3d', value: 72 },
                  { label: '7d', value: 168 },
                ].map((duration) => (
                  <button
                    key={duration.value}
                    onClick={() => setPollDuration(duration.value)}
                    disabled={isSubmitting}
                    className={`
                      px-2.5 py-1 text-xs rounded-full transition-all
                      ${pollDuration === duration.value
                        ? 'bg-white text-black font-medium'
                        : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-400'
                      }
                    `}
                  >
                    {duration.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input de link */}
        {showLinkInput && (
          <div className="flex items-center gap-2 py-2">
            <LinkIcon className="h-4 w-4 text-zinc-500 flex-shrink-0" />
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Cole o link aqui..."
              className="bg-transparent border-none border-b border-white/10 rounded-none text-white placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:border-white/20 px-0 text-sm"
              disabled={isSubmitting}
            />
            {linkUrl && (
              <button
                onClick={() => setLinkUrl('')}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="h-3 w-3 text-zinc-500" />
              </button>
            )}
          </div>
        )}

        {/* Barra de ações */}
        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          <div className="flex items-center gap-3">
            {/* Botão de adicionar imagem */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting || !!imageFile}
              className={`
                p-1.5 rounded-full transition-all
                ${imageFile
                  ? 'text-white bg-white/10'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                }
              `}
              title="Adicionar imagem"
            >
              <ImageIcon className="h-4 w-4" />
            </button>

            {/* Botão de enquete */}
            <button
              type="button"
              onClick={togglePollForm}
              disabled={isSubmitting}
              className={`
                p-1.5 rounded-full transition-all
                ${showPollForm
                  ? 'text-white bg-white/10'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                }
              `}
              title="Criar enquete"
            >
              <BarChart3 className="h-4 w-4" />
            </button>

            {/* Botão de link */}
            <button
              type="button"
              onClick={toggleLinkInput}
              disabled={isSubmitting}
              className={`
                p-1.5 rounded-full transition-all
                ${showLinkInput
                  ? 'text-white bg-white/10'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                }
              `}
              title="Adicionar link"
            >
              <LinkIcon className="h-4 w-4" />
            </button>

            {/* Botão Somente para Apoiadores */}
            <button
              type="button"
              onClick={() => setSupportersOnly(v => !v)}
              disabled={isSubmitting}
              className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all
                ${supportersOnly
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
                }
              `}
              title="Somente para apoiadores"
            >
              {supportersOnly
                ? <><Lock className="h-3.5 w-3.5" /> Apoiadores</>
                : <><LockOpen className="h-3.5 w-3.5" /> Apoiadores</>
              }
            </button>

            {/* Contador de caracteres */}
            {content.length > 0 && (
              <span className={`text-xs font-medium ${
                isOverLimit 
                  ? 'text-red-400' 
                  : remainingChars < 50 
                    ? 'text-amber-400' 
                    : 'text-zinc-500'
              }`}>
                {remainingChars}
              </span>
            )}
          </div>

          {/* Botões de ação */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !canSubmit}
              size="sm"
              className="bg-white hover:bg-zinc-200 text-black font-medium rounded-full px-5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  {isUploading ? 'Enviando...' : 'Publicando...'}
                </>
              ) : (
                'Publicar'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
