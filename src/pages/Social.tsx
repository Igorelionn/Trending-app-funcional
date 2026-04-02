import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveStreamPermission } from '@/components/LiveStreamPermissionProvider';
import { CreatePost } from '@/components/streaming/CreatePost';
import { PostCard } from '@/components/streaming/PostCard';
import * as postsService from '@/services/streamerPostsService';
import type { SocialPost } from '@/services/streamerPostsService';
import * as followService from '@/services/followService';
import type { StreamerProfile } from '@/services/followService';
import { fetchMarketNews } from '@/services/news';
import type { MarketNews } from '@/services/types';
import { translateNewsTitles } from '@/utils/translateNews';
import { getSupabaseAdmin, supabase } from '@/lib/supabase';
import { userService } from '@/services/userService';
import { Loader2, Users, Check, Plus, Minus, UserRound, ExternalLink, TrendingUp, Search, X, Trophy, Crown, Medal, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type TopRanker = {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  ranking_weekly: number | null;
};

const PodiumSlot = React.memo<{
  trader: TopRanker | null;
  rank: number;
  avatarCls: string;
  borderCls: string;
  barH: string;
  barFrom: string;
  barDelay: number;
  icon: React.ReactNode;
  onNavigate: (userId: string) => void;
}>(({ trader, rank, avatarCls, borderCls, barH, barFrom, barDelay, icon, onNavigate }) => (
  <div className="flex flex-col items-center gap-2 flex-1">
    {trader ? (
      <div
        className="flex flex-col items-center gap-2 cursor-pointer group w-full"
        onClick={() => onNavigate(trader.user_id)}
      >
        <div className="relative">
          <Avatar className={`${avatarCls} ${borderCls} group-hover:opacity-90 transition-all`}>
            <AvatarImage src={trader.avatar_url || ''} className="object-cover" />
            <AvatarFallback className="bg-zinc-900 text-white/70 font-bold">
              {trader.display_name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -top-1.5 -right-1.5">{icon}</div>
        </div>
        <p className="text-white/80 text-[11px] font-medium truncate max-w-full text-center leading-tight">
          {trader.display_name}
        </p>
      </div>
    ) : (
      <div className="flex flex-col items-center gap-2">
        <div className={`${avatarCls} rounded-full border border-white/10 bg-white/5 flex items-center justify-center`}>
          <span className="text-white/20 font-light">{rank}</span>
        </div>
        <span className="text-white/20 text-[10px]">Vazio</span>
      </div>
    )}
    <div className="w-full flex flex-col justify-end" style={{ height: barH }}>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: '100%', opacity: 1 }}
        transition={{ duration: 0.9, delay: barDelay, ease: [0.4, 0, 0.2, 1] }}
        className={`w-full rounded-t-xl relative overflow-hidden bg-gradient-to-t ${barFrom} to-transparent`}
      >
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <span className="text-2xl font-extralight text-white/15">{rank}</span>
        </div>
      </motion.div>
    </div>
  </div>
));

const TopPodiumCard = React.memo<{
  topRankers: TopRanker[];
  onNavigate: (userId: string) => void;
}>(({ topRankers, onNavigate }) => {
  if (topRankers.length === 0) return null;
  const rank1 = topRankers.find(t => t.ranking_weekly === 1) ?? null;
  const rank2 = topRankers.find(t => t.ranking_weekly === 2) ?? null;
  const rank3 = topRankers.find(t => t.ranking_weekly === 3) ?? null;
  return (
    <div className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <span className="text-sm font-bold text-white">Top Traders da Semana</span>
      </div>
      <div className="flex items-end gap-2 px-3 pt-5">
        <PodiumSlot
          trader={rank2} rank={2}
          avatarCls="w-14 h-14 border-2" borderCls="border-gray-400/40"
          barH="80px" barFrom="from-gray-400/25" barDelay={0.1}
          icon={<div className="bg-gray-400/20 rounded-full p-0.5"><Medal className="w-3 h-3 text-gray-400" /></div>}
          onNavigate={onNavigate}
        />
        <PodiumSlot
          trader={rank1} rank={1}
          avatarCls="w-16 h-16 border-2" borderCls="border-yellow-500/50"
          barH="110px" barFrom="from-yellow-500/25" barDelay={0.2}
          icon={<div className="bg-yellow-500/20 rounded-full p-0.5"><Crown className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" /></div>}
          onNavigate={onNavigate}
        />
        <PodiumSlot
          trader={rank3} rank={3}
          avatarCls="w-12 h-12 border-2" borderCls="border-orange-600/40"
          barH="60px" barFrom="from-orange-600/25" barDelay={0.3}
          icon={<div className="bg-orange-600/20 rounded-full p-0.5"><Medal className="w-3 h-3 text-orange-600" /></div>}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
});

type SearchResults = {
  traders: import('@/services/followService').StreamerProfile[];
  posts: import('@/services/streamerPostsService').SocialPost[];
};

const SearchDropdown = React.memo<{
  results: SearchResults;
  searchQuery: string;
  onNavigate: (id: string) => void;
  onClear: () => void;
  onSubmit: (q: string) => void;
}>(({ results, searchQuery, onNavigate, onClear, onSubmit }) => (
  <div className="absolute top-full left-0 right-0 mt-1.5 z-[110] rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl overflow-hidden max-h-[420px] overflow-y-auto">
    {results.traders.length === 0 && results.posts.length === 0 ? (
      <div className="px-4 py-5 text-center text-sm text-white/30">
        Nenhum resultado para "{searchQuery}"
      </div>
    ) : (
      <>
        {results.traders.length > 0 && (
          <div>
            <p className="px-3 pt-3 pb-1.5 text-[10px] uppercase tracking-wider text-white/30 font-semibold">Streamers</p>
            {results.traders.map(trader => (
              <button
                key={trader.id}
                onMouseDown={() => { onNavigate(trader.id); onClear(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.05] transition-colors text-left"
              >
                <Avatar className="h-8 w-8 shrink-0 overflow-hidden">
                  <AvatarImage src={trader.avatar_url || undefined} className="object-cover w-full h-full" />
                  <AvatarFallback className="bg-zinc-800 text-xs text-white/60">
                    {trader.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{trader.display_name}</p>
                  {trader.bio && <p className="text-xs text-white/40 truncate">{trader.bio}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
        {results.posts.length > 0 && (
          <div className={results.traders.length > 0 ? "border-t border-white/[0.06]" : ""}>
            <p className="px-3 pt-3 pb-1.5 text-[10px] uppercase tracking-wider text-white/30 font-semibold">Posts</p>
            {results.posts.map(post => (
              <div
                key={post.id}
                onMouseDown={onClear}
                className="flex items-start gap-3 px-3 py-2.5 hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                <Avatar className="h-7 w-7 mt-0.5 shrink-0 overflow-hidden">
                  <AvatarImage src={post.streamer_avatar || undefined} className="object-cover w-full h-full" />
                  <AvatarFallback className="bg-zinc-800 text-[10px] text-white/60">
                    {post.streamer_display_name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs text-white/50 mb-0.5">{post.streamer_display_name}</p>
                  <p className="text-sm text-white/80 line-clamp-2 leading-snug">{post.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Ver todos no feed */}
        <div className="border-t border-white/[0.06]">
          <button
            onMouseDown={() => onSubmit(searchQuery)}
            className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/[0.05] transition-colors text-left"
          >
            <Search className="h-3.5 w-3.5 text-white/40 shrink-0" />
            <span className="text-sm text-white/60">Ver todos os resultados para <span className="text-white font-medium">"{searchQuery}"</span></span>
          </button>
        </div>
      </>
    )}
  </div>
));

const Social = () => {
  const { user } = useAuth();
  const { canStartLive } = useLiveStreamPermission();
  const navigate = useNavigate();

  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const [allTraders, setAllTraders] = useState<StreamerProfile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loadingFollow, setLoadingFollow] = useState<string | null>(null);
  const [supporterCodeMap, setSupporterCodeMap] = useState<Record<string, string>>({});
  const [showTraderBio, setShowTraderBio] = useState(false);
  const [currentSupporterCode, setCurrentSupporterCode] = useState<string>(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem('trader_preferences') || '{}');
      return String(prefs.supporter_code || '').toUpperCase().trim();
    } catch { return ''; }
  });
  const [topRankers, setTopRankers] = useState<TopRanker[]>([]);
  const [news, setNews] = useState<MarketNews[]>([]);
  // Aba ativa do feed
  const [feedTab, setFeedTab] = useState<'foryou' | 'following'>('foryou');
  const [newsIndex, setNewsIndex] = useState(0);
  const [newsFading, setNewsFading] = useState(false);
  const NEWS_PER_PAGE = 3;

  // Pesquisa
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchSubmitted, setSearchSubmitted] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  const submitSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    setSearchSubmitted(trimmed);
    setSearchFocused(false);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchSubmitted('');
    setSearchFocused(false);
  }, []);

  // Sticky header (search + tabs) ao rolar
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const match = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('sidebar:state='));
      if (match) return match.split('=')[1].trim() !== 'true';
    } catch {}
    return false;
  });

  // Posts filtrados pela aba ativa
  const feedPosts = useMemo(() => {
    if (feedTab === 'following') {
      return posts.filter(p => followingIds.has(p.streamer_id));
    }
    return posts;
  }, [posts, feedTab, followingIds]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const matchedPosts = posts
      .filter(p =>
        (p.content || '').toLowerCase().includes(q) ||
        (p.streamer_display_name || '').toLowerCase().includes(q)
      )
      .slice(0, 4);
    const matchedTraders = allTraders
      .filter(t =>
        (t.display_name || '').toLowerCase().includes(q) ||
        (t.bio || '').toLowerCase().includes(q)
      )
      .slice(0, 4);
    return { posts: matchedPosts, traders: matchedTraders };
  }, [searchQuery, posts, allTraders]);

  // Resultados completos após pressionar Enter / clicar em buscar
  const submittedFeedPosts = useMemo(() => {
    const q = searchSubmitted.trim().toLowerCase();
    if (!q) return null;
    return posts.filter(p =>
      (p.content || '').toLowerCase().includes(q) ||
      (p.streamer_display_name || '').toLowerCase().includes(q)
    );
  }, [searchSubmitted, posts]);

  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await postsService.getAllPostsFeed(user?.id, 30, 0);
      if (result.success && result.posts) {
        setPosts(result.posts);
      }
    } catch (error) {
      console.error('Erro ao carregar feed social:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const loadSuggestions = useCallback(async () => {
    if (!user?.id) return;
    try {
      const streamers = await followService.getAllStreamers(user.id);
      const others = streamers
        .filter((s) => s.id !== user.id)
        .sort((a, b) => (a.is_following === b.is_following ? 0 : a.is_following ? 1 : -1));
      setAllTraders(others);
      const following = streamers.filter((s) => s.is_following).map((s) => s.id);
      setFollowingIds(new Set(following));
    } catch (err) {
      console.error('Erro ao carregar sugestões:', err);
    }
  }, [user?.id]);

  // Alternância bio/seguidores nos cards de traders (só quando há bio)
  useEffect(() => {
    const hasBio = allTraders.some(t => !!(t.bio || t.about));
    if (!hasBio) {
      setShowTraderBio(false);
      return;
    }
    const interval = setInterval(() => setShowTraderBio(v => !v), 6000);
    return () => clearInterval(interval);
  }, [allTraders]);

  // Rotação automática das notícias
  useEffect(() => {
    if (news.length <= NEWS_PER_PAGE) return;
    const interval = setInterval(() => {
      setNewsFading(true);
      setTimeout(() => {
        setNewsIndex(prev => (prev + NEWS_PER_PAGE) % news.length);
        setNewsFading(false);
      }, 500);
    }, 6000);
    return () => clearInterval(interval);
  }, [news.length]);

  const loadSupporterCodes = useCallback(async () => {
    try {
      const adminDb = getSupabaseAdmin() as any;
      const { data } = await adminDb
        .from('supporter_codes')
        .select('user_id, code')
        .eq('is_active', true);
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((row: { user_id: string; code: string }) => {
          if (row.user_id) map[row.user_id] = row.code.toUpperCase().trim();
        });
        setSupporterCodeMap(map);
      }
    } catch (err) {
      console.error('Erro ao carregar códigos de apoiador:', err);
    }
  }, []);

  const loadTopRankers = useCallback(async () => {
    try {
      const adminDb = getSupabaseAdmin() as any;
      const { data } = await adminDb
        .from('user_profiles')
        .select('id, user_id, display_name, avatar_url, ranking_weekly')
        .not('ranking_weekly', 'is', null)
        .order('ranking_weekly', { ascending: true })
        .limit(3);
      if (data) setTopRankers(data as TopRanker[]);
    } catch (err) {
      console.error('Erro ao carregar top rankers:', err);
    }
  }, []);

  const loadNews = useCallback(async () => {
    try {
      const items = await fetchMarketNews({ limit: 20 });
      const sliced = items.slice(0, 20);
      setNews(sliced);

      const titles = sliced.map((n) => (n.headline || n.title || ''));
      try {
        const translated = await translateNewsTitles(titles);
        const hasTranslations = translated.some((t, i) => t !== titles[i]);
        if (hasTranslations) {
          setNews(sliced.map((n, i) => ({
            ...n,
            headline: translated[i] || n.headline || n.title || '',
            title: translated[i] || n.title || n.headline || '',
          })));
        }
      } catch (translateErr) {
        console.warn('[Social] Tradução falhou, mantendo títulos originais:', translateErr);
      }
    } catch (err) {
      console.error('Erro ao carregar notícias:', err);
    }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const code = String((e as CustomEvent).detail?.code || '').toUpperCase().trim();
      setCurrentSupporterCode(code);
    };
    window.addEventListener('supporter-code-changed', handler);
    return () => window.removeEventListener('supporter-code-changed', handler);
  }, []);

  // Rastreia estado da sidebar via cookie
  useEffect(() => {
    const update = () => {
      try {
        const match = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('sidebar:state='));
        if (match) setSidebarCollapsed(match.split('=')[1].trim() !== 'true');
      } catch {}
    };
    const interval = setInterval(update, 300);
    return () => clearInterval(interval);
  }, []);

  // Mostra sticky header quando as tabs saem do viewport
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyHeader(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleNavigateToProfile = useCallback((userId: string) => {
    navigate(`/profile/${userId}`);
  }, [navigate]);

  useEffect(() => {
    loadPosts();
    loadSuggestions();
    loadNews();
    loadTopRankers();
    loadSupporterCodes();
  }, [loadPosts, loadSuggestions, loadNews, loadTopRankers, loadSupporterCodes]);

  // Realtime: atualiza feed quando novos posts são criados/deletados
  useEffect(() => {
    const channel = supabase
      .channel('social-posts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streamer_posts' }, () => {
        loadPosts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadPosts]);

  // Atualiza quando o usuário volta à aba
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadPosts();
        loadSuggestions();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadPosts, loadSuggestions]);

  const handleFollow = async (streamerId: string) => {
    if (!user?.id || loadingFollow) return;
    setLoadingFollow(streamerId);
    try {
      if (followingIds.has(streamerId)) {
        await followService.unfollowStreamer(user.id, streamerId);
        setFollowingIds((prev) => { const s = new Set(prev); s.delete(streamerId); return s; });
      } else {
        await followService.followStreamer(user.id, streamerId);
        setFollowingIds((prev) => new Set([...prev, streamerId]));
        toast.success('Seguindo!');
      }
      // Recarrega sugestões para refletir contagem de seguidores atualizada
      loadSuggestions();
    } catch {
      toast.error('Erro ao atualizar seguimento');
    } finally {
      setLoadingFollow(null);
    }
  };

  return (
    <Layout>
      {/* ── Sticky header: aparece ao rolar (search + tabs) ── */}
      <div
        className={cn(
          "fixed top-0 z-[100] flex items-stretch bg-black/90 backdrop-blur-lg border-b border-white/[0.08] transition-all duration-300",
          showStickyHeader ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full pointer-events-none"
        )}
        style={{ left: sidebarCollapsed ? '4.5rem' : '16rem', right: 0 }}
      >
        {/* Tabs */}
        <div className="flex items-center">
          {(['foryou', 'following'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFeedTab(tab)}
              className={cn(
                "relative px-5 py-3.5 text-sm font-semibold transition-colors",
                feedTab === tab ? "text-white" : "text-white/40 hover:text-white/70"
              )}
            >
              {tab === 'foryou' ? 'For You' : 'Seguindo'}
              {feedTab === tab && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-white rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Espaçador */}
        <div className="flex-1" />

        {/* Search bar compacta */}
        <div className="hidden lg:flex items-center w-[340px] xl:w-[380px] px-4 py-2.5">
          <div className="relative w-full">
            <div className={cn(
              "flex items-center gap-2.5 px-4 py-2 rounded-full border w-full transition-all duration-200",
              "bg-white/[0.05] border-white/[0.18]",
              searchFocused && "border-white/35"
            )}>
              <Search className="h-4 w-4 text-white/40 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); if (e.target.value) setSearchFocused(true); }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                onKeyDown={e => { if (e.key === 'Enter' && searchQuery.trim()) submitSearch(searchQuery); }}
                placeholder="Buscar posts e streamers..."
                className="flex-1 bg-transparent text-sm text-white placeholder-white/35 outline-none min-w-0"
              />
              {searchQuery && (
                <button onClick={clearSearch} className="text-white/35 hover:text-white/60 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {searchResults && showStickyHeader && (
              <SearchDropdown
                results={searchResults}
                searchQuery={searchQuery}
                onNavigate={(id) => navigate(`/profile/${id}`)}
                onClear={clearSearch}
                onSubmit={submitSearch}
              />
            )}
          </div>
        </div>
      </div>

      <div className="w-full px-1 sm:px-2 py-3 sm:py-4">

        {/* ── Linha superior: Traders (esq) + Pesquisa (dir) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-4 lg:gap-6 mb-6 lg:mb-8">

          {/* Coluna esquerda: Traders Recomendados */}
          <div>
            {allTraders.length > 0 && (
              <div>
                <p className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4 px-1">Traders Recomendados</p>
                <div className="h-px bg-white/5 mb-4 sm:mb-6" />
                <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 scrollbar-none -mx-1 px-1">
                  {allTraders.map((trader) => {
                    const rawBio = trader.bio || trader.about || '';
                    const bio = rawBio.length > 80 ? rawBio.slice(0, 80) + '…' : rawBio;
                    return (
                    <div
                      key={trader.id}
                      className="flex-shrink-0 w-48 sm:w-56 md:w-60 bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 sm:p-5 flex flex-col items-center gap-2.5 sm:gap-3"
                    >
                      <button onClick={() => navigate(`/profile/${trader.id}`)}>
                        <Avatar className="h-20 w-20 border-2 border-white/10 hover:opacity-80 transition-opacity overflow-hidden">
                          <AvatarImage src={trader.avatar_url || undefined} className="object-cover w-full h-full" />
                          <AvatarFallback className="bg-zinc-800 text-white/70 text-2xl font-bold">
                            {trader.display_name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                      <button
                        onClick={() => navigate(`/profile/${trader.id}`)}
                        className="text-sm font-semibold text-white text-center leading-tight hover:underline line-clamp-1 w-full"
                      >
                        {trader.display_name}
                      </button>
                      <div className="min-h-[32px] flex items-center justify-center">
                        <p
                          key={bio ? (showTraderBio ? 'bio' : 'followers') : 'followers'}
                          className="text-[11px] text-white/40 text-center leading-relaxed transition-opacity duration-500"
                          style={{ opacity: 1, animation: bio ? 'fadeIn 0.5s ease' : undefined }}
                        >
                          {showTraderBio && bio
                            ? bio
                            : `${trader.followers_count} ${trader.followers_count === 1 ? 'seguidor' : 'seguidores'}`}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 w-full mt-0.5">
                        <button
                          onClick={() => handleFollow(trader.id)}
                          disabled={loadingFollow === trader.id}
                          className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all ${
                            followingIds.has(trader.id)
                              ? 'bg-white/10 text-white/60 hover:bg-red-500/10 hover:text-red-400'
                              : 'bg-white text-black hover:bg-white/90'
                          }`}
                        >
                          {loadingFollow === trader.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : followingIds.has(trader.id) ? 'Seguindo' : 'Seguir'}
                        </button>
                        {(() => {
                          const traderCode = supporterCodeMap[trader.id] || trader.referral_code?.toUpperCase().trim() || '';
                          const isApoiado = !!traderCode && currentSupporterCode === traderCode;
                          return (
                            <button
                              onClick={async () => {
                                if (isApoiado) {
                                  setCurrentSupporterCode('');
                                  await userService.updateTraderPreferences({ supporter_code: '' });
                                } else {
                                  const code = traderCode || trader.id;
                                  setCurrentSupporterCode(code);
                                  await userService.updateTraderPreferences({ supporter_code: code });
                                }
                              }}
                              className={cn(
                                "w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-colors duration-200",
                                isApoiado
                                  ? "bg-black border border-white/20 text-white/50 hover:border-red-500/30 hover:text-red-400/60"
                                  : "bg-black border border-white/20 text-white hover:border-white/40"
                              )}
                            >
                              {isApoiado ? (
                                <><Check className="h-3.5 w-3.5 stroke-[2.5]" /> Apoiado</>
                              ) : 'Apoiar'}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                    );
                  })}
                </div>
                <div className="h-px bg-white/5 mt-6" />
              </div>
            )}
          </div>

          {/* Coluna direita: Barra de pesquisa — alinhada com o sidebar */}
          <div className="hidden lg:block">
            <div ref={searchRef} className="relative">
              <div className={cn(
                "flex items-center gap-2.5 px-4 py-3 rounded-full border transition-all duration-200",
                "bg-black border-white/[0.22]",
                searchFocused && "border-white/40"
              )}>
                <Search className="h-4 w-4 text-white/40 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); if (e.target.value) setSearchFocused(true); }}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  onKeyDown={e => { if (e.key === 'Enter' && searchQuery.trim()) submitSearch(searchQuery); }}
                  placeholder="Buscar posts e streamers..."
                  className="flex-1 bg-transparent text-sm text-white placeholder-white/35 outline-none min-w-0"
                />
                {searchQuery && (
                  <button onClick={clearSearch} className="text-white/35 hover:text-white/60 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {searchResults && !showStickyHeader && (
                <SearchDropdown
                  results={searchResults}
                  searchQuery={searchQuery}
                  onNavigate={(id) => navigate(`/profile/${id}`)}
                  onClear={clearSearch}
                  onSubmit={submitSearch}
                />
              )}
            </div>

            {/* ── Card Pódio Top 3 — ranking geral (ranking_lifetime) ── */}
            <TopPodiumCard topRankers={topRankers} onNavigate={handleNavigateToProfile} />

          </div>

        </div>

        {/* ── Grid: Feed + Sidebar alinhados entre si ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-4 lg:gap-6 items-start">

          {/* ── Feed principal ── */}
          <div className="min-w-0">

            {/* Tabs For You / Seguindo */}
            <div ref={tabsRef} className="flex justify-center items-center mb-4 sm:mb-5 border-b border-white/[0.07]">
              {(['foryou', 'following'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setFeedTab(tab)}
                  className={cn(
                    "relative px-4 sm:px-6 py-3 sm:py-3.5 text-sm sm:text-base font-semibold transition-colors",
                    feedTab === tab
                      ? "text-white"
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  {tab === 'foryou' ? 'For You' : 'Seguindo'}
                  {feedTab === tab && (
                    <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-white rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Feed */}
            {submittedFeedPosts !== null ? (
              /* ── Modo pesquisa: resultados do Enter ── */
              <div>
                <div className="flex items-center justify-between mb-4 px-1">
                  <p className="text-sm text-white/50">
                    <span className="text-white font-medium">{submittedFeedPosts.length}</span> resultado{submittedFeedPosts.length !== 1 ? 's' : ''} para <span className="text-white font-medium">"{searchSubmitted}"</span>
                  </p>
                  <button
                    onClick={clearSearch}
                    className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" /> Limpar busca
                  </button>
                </div>
                {submittedFeedPosts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                    <div className="p-5 rounded-full bg-white/[0.03] border border-white/5 mb-4">
                      <Search className="h-8 w-8 text-zinc-600" />
                    </div>
                    <p className="text-white font-semibold mb-1">Nenhum post encontrado</p>
                    <p className="text-zinc-500 text-sm">Tente pesquisar por outro termo.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {submittedFeedPosts.map((post) => {
                      const isOwner = user?.id === post.streamer_id;
                      const traderCode = supporterCodeMap[post.streamer_id] || '';
                      const isSupporter = !!traderCode && currentSupporterCode === traderCode;
                      const isLocked = post.supporters_only && !isOwner && !isSupporter;
                      return (
                        <div key={post.id} className="relative">
                          <div className={isLocked ? 'blur-[1.5px] opacity-60 pointer-events-none select-none' : ''}>
                            <PostCard
                              post={post}
                              currentUserId={user?.id || ''}
                              isOwner={isOwner}
                              streamerName={post.streamer_display_name}
                              streamerAvatar={post.streamer_avatar || undefined}
                              streamerUserId={post.streamer_id}
                              onDeleted={loadPosts}
                              onReactionChanged={loadPosts}
                              onUpdated={loadPosts}
                            />
                          </div>
                          {isLocked && (
                            <div className="absolute inset-0 rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-3"
                              style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.92) 55%, rgba(0,0,0,0.97) 100%)' }}
                            >
                              <div className="flex flex-col items-center gap-2 px-6 text-center">
                                <div className="p-2.5 rounded-full bg-amber-500/15 border border-amber-500/25 mb-1">
                                  <Lock className="h-5 w-5 text-amber-400" />
                                </div>
                                <p className="text-white font-semibold text-sm">Post exclusivo para apoiadores</p>
                                <p className="text-white/45 text-xs">Apoie <span className="text-white/70 font-medium">{post.streamer_display_name}</span> para desbloquear</p>
                                {traderCode && (
                                  <button
                                    onClick={async () => { setCurrentSupporterCode(traderCode); await userService.updateTraderPreferences({ supporter_code: traderCode }); }}
                                    className="mt-1 px-5 py-2 rounded-full bg-white text-black text-xs font-semibold hover:bg-white/90 transition-colors"
                                  >Apoiar</button>
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
            ) : isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-7 w-7 animate-spin text-zinc-600" />
              </div>
            ) : feedPosts.length === 0 ? (
              feedTab === 'following' ? (
                /* ── Sem seguidos: mostra sugestões de traders ── */
                <div className="px-1">
                  <div className="mb-6 text-center">
                    <div className="inline-flex p-4 rounded-full bg-white/[0.03] border border-white/5 mb-3">
                      <Users className="h-8 w-8 text-zinc-600" />
                    </div>
                    <p className="text-white font-semibold text-base mb-1">Comece a seguir traders</p>
                    <p className="text-zinc-500 text-sm">Veja os posts de quem você segue aqui.</p>
                  </div>

                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Sugestões</p>
                  <div className="space-y-3">
                    {allTraders.filter(t => !followingIds.has(t.id)).slice(0, 5).map(trader => (
                      <div
                        key={trader.id}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
                      >
                        <button onClick={() => navigate(`/profile/${trader.id}`)}>
                          <Avatar className="h-10 w-10 shrink-0 border border-white/10">
                            <AvatarImage src={trader.avatar_url || undefined} />
                            <AvatarFallback className="bg-zinc-800 text-white/70 font-bold text-sm">
                              {trader.display_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => navigate(`/profile/${trader.id}`)}
                            className="text-sm font-semibold text-white hover:underline truncate block text-left"
                          >
                            {trader.display_name}
                          </button>
                          <p className="text-xs text-white/40 truncate">
                            {trader.bio || trader.about || `${trader.followers_count} seguidores`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleFollow(trader.id)}
                          disabled={loadingFollow === trader.id}
                          className="shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold bg-white text-black hover:bg-white/90 transition-all"
                        >
                          {loadingFollow === trader.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : 'Seguir'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <div className="p-6 rounded-full bg-white/[0.03] border border-white/5 mb-4">
                    <Users className="h-10 w-10 text-zinc-600" />
                  </div>
                  <p className="text-white font-semibold text-lg mb-1">Nenhum post ainda</p>
                  <p className="text-zinc-500 text-sm max-w-xs">
                    Os streamers ainda não publicaram nada. Siga alguns para ver o conteúdo deles aqui.
                  </p>
                </div>
              )
            ) : (
              <div className="space-y-3">
                {feedPosts.map((post) => {
                  const isOwner = user?.id === post.streamer_id;
                  const traderCode = supporterCodeMap[post.streamer_id] || '';
                  const isSupporter = !!traderCode && currentSupporterCode === traderCode;
                  const isLocked = post.supporters_only && !isOwner && !isSupporter;

                  return (
                    <div key={post.id} className="relative">
                      <div className={isLocked ? 'blur-[1.5px] opacity-60 pointer-events-none select-none' : ''}>
                        <PostCard
                          post={post}
                          currentUserId={user?.id || ''}
                          isOwner={isOwner}
                          streamerName={post.streamer_display_name}
                          streamerAvatar={post.streamer_avatar || undefined}
                          streamerUserId={post.streamer_id}
                          onDeleted={loadPosts}
                          onReactionChanged={loadPosts}
                          onUpdated={loadPosts}
                        />
                      </div>
                      {isLocked && (
                        <div className="absolute inset-0 rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-3"
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
                              Apoie <span className="text-white/70 font-medium">{post.streamer_display_name}</span> para desbloquear este conteúdo
                            </p>
                            {traderCode && (
                              <button
                                onClick={async () => {
                                  setCurrentSupporterCode(traderCode);
                                  await userService.updateTraderPreferences({ supporter_code: traderCode });
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

          {/* ── Sidebar: Notícias ── */}
          <div className="hidden lg:block min-w-0">
            <div className="sticky top-4 flex flex-col gap-4">

              {/* Tópicos do dia / Notícias com rotação */}
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-white/50" />
                  <h2 className="font-bold text-white text-base">Tópicos do Dia</h2>
                  {news.length > NEWS_PER_PAGE && (
                    <div className="ml-auto flex items-center gap-1">
                      {Array.from({ length: Math.ceil(news.length / NEWS_PER_PAGE) }).map((_, pi) => (
                        <button
                          key={pi}
                          onClick={() => {
                            setNewsFading(true);
                            setTimeout(() => { setNewsIndex(pi * NEWS_PER_PAGE); setNewsFading(false); }, 400);
                          }}
                          className={`h-1 rounded-full transition-all duration-300 ${
                            Math.floor(newsIndex / NEWS_PER_PAGE) === pi
                              ? 'w-4 bg-white/60'
                              : 'w-1.5 bg-white/20 hover:bg-white/40'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {news.length === 0 ? (
                  <div className="px-4 py-6 flex flex-col items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
                    <p className="text-xs text-white/30">Carregando notícias...</p>
                  </div>
                ) : (
                  <div>
                    {/* Container com fade */}
                    <div
                      className="transition-opacity duration-500"
                      style={{ opacity: newsFading ? 0 : 1 }}
                    >
                      {news.slice(newsIndex, newsIndex + NEWS_PER_PAGE).map((item, i) => {
                        const img = item.imageUrl || item.image;
                        const title = item.headline || item.title;
                        const ago = (() => {
                          try {
                            // published_at é sempre ISO string; datetime já está em ms (news.ts multiplica por 1000)
                            const raw = item.published_at || null;
                            if (!raw) return '';
                            const d = new Date(raw);
                            if (isNaN(d.getTime()) || d.getFullYear() > 2100) return '';
                            return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
                          } catch { return ''; }
                        })();

                        return (
                          <a
                            key={item.id || (newsIndex + i)}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col gap-3 px-4 py-5 hover:bg-white/[0.04] transition-colors border-b border-white/[0.09] last:border-0 group"
                          >
                            {img && !item.isTemporaryImage ? (
                              <img
                                src={img}
                                alt=""
                                className="w-full h-60 rounded-xl object-cover bg-zinc-900"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-full h-60 rounded-xl bg-white/[0.04] flex items-center justify-center">
                                <TrendingUp className="h-10 w-10 text-white/10" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-base font-semibold text-white leading-snug line-clamp-3 group-hover:text-white/80 transition-colors mb-2">
                                {title}
                              </p>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-white/30 truncate">{item.source}</span>
                                {ago && <span className="text-xs text-white/20">· {ago}</span>}
                                <ExternalLink className="h-3 w-3 text-white/20 ml-auto flex-shrink-0" />
                              </div>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* Painel de criar post — sobe da parte inferior */}
      {canStartLive && user && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out overflow-y-auto max-h-[70vh] [background:linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.7)_15%,rgba(0,0,0,0.92)_35%,#000_100%)] ${
            showCreateDialog ? 'translate-y-0' : 'translate-y-full pointer-events-none'
          }`}
        >
          <div className="max-w-2xl mx-auto px-4 pt-5 pb-24">
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
            <CreatePost
              streamerId={user.id}
              onPostCreated={() => {
                setShowCreateDialog(false);
                loadPosts();
              }}
            />
          </div>
        </div>
      )}

      {/* Botão flutuante */}
      {canStartLive && user && (
        <button
          onClick={() => setShowCreateDialog((v) => !v)}
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-white shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200"
          aria-label={showCreateDialog ? 'Fechar' : 'Criar post'}
        >
          {showCreateDialog
            ? <Minus className="h-5 w-5 text-black stroke-[2.5]" />
            : <Plus className="h-5 w-5 text-black stroke-[2.5]" />
          }
        </button>
      )}
    </Layout>
  );
};

export default Social;
