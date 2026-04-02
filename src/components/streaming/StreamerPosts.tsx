import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, MessageSquare, Lock } from 'lucide-react';
import { CreatePost } from './CreatePost';
import { PostCard } from './PostCard';
import * as postsService from '@/services/streamerPostsService';
import type { StreamerPost } from '@/services/streamerPostsService';
import { getSupabaseAdmin } from '@/lib/supabase';
import { userService } from '@/services/userService';

interface StreamerPostsProps {
  streamerId: string;
  currentUserId: string;
  isOwner: boolean;
  streamerName: string;
  streamerAvatar?: string;
}

export const StreamerPosts: React.FC<StreamerPostsProps> = ({
  streamerId,
  currentUserId,
  isOwner,
  streamerName,
  streamerAvatar,
}) => {
  const [posts, setPosts] = useState<StreamerPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [streamerCode, setStreamerCode] = useState<string>('');
  const [currentSupporterCode, setCurrentSupporterCode] = useState<string>(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem('trader_preferences') || '{}');
      return String(prefs.supporter_code || '').toUpperCase().trim();
    } catch { return ''; }
  });

  const loadPosts = async () => {
    setIsLoading(true);
    try {
      const result = await postsService.getStreamerPosts(streamerId, currentUserId);
      if (result.success && result.posts) {
        setPosts(result.posts);
      }
    } catch (error) {
      console.error('Erro ao carregar posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStreamerCode = useCallback(async () => {
    try {
      const adminDb = getSupabaseAdmin() as any;
      const { data } = await adminDb
        .from('supporter_codes')
        .select('code')
        .eq('user_id', streamerId)
        .eq('is_active', true)
        .limit(1)
        .single();
      if (data?.code) setStreamerCode(data.code.toUpperCase().trim());
    } catch { /* streamer pode não ter código */ }
  }, [streamerId]);

  useEffect(() => {
    loadPosts();
    loadStreamerCode();
  }, [streamerId, currentUserId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const code = String((e as CustomEvent).detail?.code || '').toUpperCase().trim();
      setCurrentSupporterCode(code);
    };
    window.addEventListener('supporter-code-changed', handler);
    return () => window.removeEventListener('supporter-code-changed', handler);
  }, []);

  return (
    <div className="space-y-6">
      {/* Criar post (apenas para o dono) */}
      {isOwner && (
        <CreatePost
          streamerId={streamerId}
          onPostCreated={loadPosts}
        />
      )}

      {/* Lista de posts */}
      <div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-zinc-500" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl">
            <MessageSquare className="h-14 w-14 text-zinc-700 mb-4" />
            <p className="text-zinc-400 text-sm max-w-xs">
              {isOwner 
                ? 'Compartilhe suas análises e insights com seus seguidores'
                : 'Nenhum post ainda'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const isSupporter = !!streamerCode && currentSupporterCode === streamerCode;
              const isLocked = post.supporters_only && !isOwner && !isSupporter;

              return (
                <div key={post.id} className="relative">
                  <div className={isLocked ? 'blur-[1.5px] opacity-60 pointer-events-none select-none' : ''}>
                    <PostCard
                      post={post}
                      currentUserId={currentUserId}
                      isOwner={isOwner}
                      streamerName={streamerName}
                      streamerAvatar={streamerAvatar}
                      onDeleted={loadPosts}
                      onReactionChanged={loadPosts}
                      onUpdated={loadPosts}
                    />
                  </div>
                  {isLocked && (
                    <div
                      className="absolute inset-0 rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-3"
                      style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.92) 55%, rgba(0,0,0,0.97) 100%)' }}
                    >
                      <div className="flex flex-col items-center gap-2 px-6 text-center">
                        <div className="p-2.5 rounded-full bg-amber-500/15 border border-amber-500/25 mb-1">
                          <Lock className="h-5 w-5 text-amber-400" />
                        </div>
                        <p className="text-white font-semibold text-sm leading-snug">
                          Post exclusivo para apoiadores
                        </p>
                        <p className="text-white/45 text-xs leading-relaxed">
                          Apoie <span className="text-white/70 font-medium">{streamerName}</span> para desbloquear este conteúdo
                        </p>
                        {streamerCode && (
                          <button
                            onClick={async () => {
                              setCurrentSupporterCode(streamerCode);
                              await userService.updateTraderPreferences({ supporter_code: streamerCode });
                            }}
                            className="mt-1 px-5 py-2 rounded-full bg-white text-black text-xs font-semibold hover:bg-white/90 transition-colors"
                          >
                            Apoiar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
