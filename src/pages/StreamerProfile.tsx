import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { StreamerPosts } from '@/components/streaming/StreamerPosts';
import { 
  Users, 
  Heart, 
  Calendar, 
  Clock, 
  Video, 
  TrendingUp,
  ArrowLeft,
  ThumbsUp,
  Flame,
  Star,
  CheckCircle,
  Trophy,
  Edit,
  Crown,
  Plus,
  Trash2,
  Send,
  Tag,
  Copy,
  Check,
  ImagePlus,
  Settings,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// Type-safe workaround: O schema Database não inclui todas as tabelas
// mas o código funciona corretamente em runtime
const db = supabase as any;

interface StreamerData {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  about: string | null;
  banner_url: string | null;
  followers_count: number;
  supporters_count: number;
  is_following: boolean;
  ranking_lifetime: number | null;
  ranking_monthly: number | null;
  ranking_weekly: number | null;
  total_streams: number;
  supporter_code: string | null;
  trader_support_link: string | null;
  supporters_using_code_count: number;
}

interface StreamerPost {
  id: string;
  streamer_id: string;
  content: string;
  media_url: string | null;
  created_at: string;
  reactions: {
    like: number;
    love: number;
    fire: number;
    star: number;
  };
  user_reaction: string | null;
}

interface LiveSchedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  description: string | null;
}

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const REACTION_ICONS = {
  like: ThumbsUp,
  love: Heart,
  fire: Flame,
  star: Star
};

export default function StreamerProfile() {
  const { streamerId } = useParams<{ streamerId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const match = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('sidebar:state='));
      if (match) return match.split('=')[1].trim() !== 'true';
    } catch {}
    return false;
  });

  useEffect(() => {
    const onStorageOrCookie = () => {
      try {
        const match = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('sidebar:state='));
        if (match) setSidebarCollapsed(match.split('=')[1].trim() !== 'true');
      } catch {}
    };
    window.addEventListener('resize', onStorageOrCookie);
    const interval = setInterval(onStorageOrCookie, 300);
    return () => { window.removeEventListener('resize', onStorageOrCookie); clearInterval(interval); };
  }, []);

  const [streamer, setStreamer] = useState<StreamerData | null>(null);
  const [posts, setPosts] = useState<StreamerPost[]>([]);
  const [schedules, setSchedules] = useState<LiveSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutText, setAboutText] = useState('');
  const [rankingPeriod, setRankingPeriod] = useState<'lifetime' | 'monthly' | 'weekly'>('monthly');
  
  // Estado para copiar código
  const [copiedTop, setCopiedTop] = useState(false);
  const [copiedPodium, setCopiedPodium] = useState(false);

  const handleCopyPodiumCode = () => {
    if (streamer?.supporter_code) {
      navigator.clipboard.writeText(streamer.supporter_code);
      setCopiedPodium(true);
      setTimeout(() => setCopiedPodium(false), 2000);
    }
  };

  // Estados para horários
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [editingDayOfWeek, setEditingDayOfWeek] = useState<number | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    start_time: '',
    end_time: '',
    description: ''
  });

  // Estados para edição de ranking (admin)
  const [editingRanking, setEditingRanking] = useState(false);
  const [rankingForm, setRankingForm] = useState({
    ranking_lifetime: '',
    ranking_monthly: '',
    ranking_weekly: ''
  });


  useEffect(() => {
    if (streamerId) {
      loadStreamerData();
      loadSchedules();
    }
  }, [streamerId]);

  useEffect(() => {
    setIsOwner(user?.id === streamerId);
  }, [user, streamerId]);

  const loadStreamerData = async () => {
    try {
      setLoading(true);
      
      // Buscar dados do streamer usando maybeSingle (fix 406 error)
      // Buscar tanto por 'id' quanto por 'user_id' para suportar ambos os casos
      const { data: userData, error: userError } = await db
        .from('user_profiles')
        .select('*')
        .or(`id.eq.${streamerId},user_id.eq.${streamerId}`)
        .maybeSingle();

      if (userError) {
        throw userError;
      }

      if (!userData) {
        throw new Error('Usuário não encontrado');
      }

      // Buscar se está seguindo
      let isFollowingData = false;
      if (user) {
        const { data: followData } = await db
          .from('user_follows')
          .select('*')
          .eq('follower_id', user.id)
          .eq('followed_id', streamerId)
          .maybeSingle();
        
        isFollowingData = !!followData;
      }

      // Buscar estatísticas REAIS
      const { count: followersCount } = await db
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('followed_id', streamerId);

      const { count: streamsCount } = await db
        .from('live_streams')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', streamerId)
        .eq('status', 'ended');

      // Buscar código de apoiador vinculado
      const { data: supporterCode } = await db
        .from('supporter_codes')
        .select('id, code')
        .eq('user_id', streamerId)
        .eq('is_active', true)
        .maybeSingle();

      // Buscar quantas pessoas usam o código deste streamer
      let supportersUsingCodeCount = 0;
      if (supporterCode) {
        const { count } = await db
          .from('supporter_code_usage')
          .select('*', { count: 'exact', head: true })
          .eq('trader_id', streamerId);
        
        supportersUsingCodeCount = count || 0;
      }

      // Aplicar boosts (valores fake somados aos reais)
      const { data: boosts } = await db
        .from('streamer_boosts')
        .select('boost_type, boost_value')
        .eq('user_id', userData.user_id);

      let boostedFollowers = followersCount || 0;
      let boostedSupporters = supportersUsingCodeCount;

      if (boosts && boosts.length > 0) {
        boosts.forEach((boost: any) => {
          if (boost.boost_type === 'followers') {
            boostedFollowers += boost.boost_value;
          } else if (boost.boost_type === 'supporters') {
            boostedSupporters += boost.boost_value;
          }
        });
      }

      setStreamer({
        id: userData.user_id,
        display_name: userData.display_name || userData.email || 'Trader',
        avatar_url: userData.avatar_url,
        bio: userData.bio,
        about: userData.about || null,
        banner_url: userData.banner_url || null,
        followers_count: boostedFollowers,
        supporters_count: boostedSupporters,
        is_following: isFollowingData,
        ranking_lifetime: userData.ranking_lifetime || null,
        ranking_monthly: userData.ranking_monthly || null,
        ranking_weekly: userData.ranking_weekly || null,
        total_streams: streamsCount || 0,
        supporter_code: supporterCode?.code || null,
        trader_support_link: userData.trader_support_link,
        supporters_using_code_count: boostedSupporters
      });

      setIsFollowing(isFollowingData);
      setAboutText(userData.about || '');
    } catch (error) {
      console.error('❌ Erro ao carregar dados do trader:', error);
      
      // Mostrar erro mais detalhado
      if (error instanceof Error) {
        toast.error(`Erro: ${error.message}`);
      } else if (typeof error === 'object' && error !== null) {
        const errorObj = error as any;
        if (errorObj.message) {
          toast.error(`Erro: ${errorObj.message}`);
        } else if (errorObj.code) {
          toast.error(`Erro código: ${errorObj.code}`);
        } else {
          toast.error('Erro ao carregar perfil do trader');
        }
      } else {
        toast.error('Erro ao carregar perfil do trader');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      // Buscar postagens do streamer
      const { data: postsData, error: postsError } = await db
        .from('streamer_posts')
        .select('*')
        .eq('streamer_id', streamerId)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Buscar reações para cada postagem
      const postsWithReactions = await Promise.all(
        (postsData || []).map(async (post) => {
          // Contar reações por tipo
          const { data: reactions } = await db
            .from('post_reactions')
            .select('reaction_type')
            .eq('post_id', post.id);

          const reactionCounts = {
            like: 0,
            love: 0,
            fire: 0,
            star: 0
          };

          reactions?.forEach((r) => {
            if (r.reaction_type in reactionCounts) {
              reactionCounts[r.reaction_type as keyof typeof reactionCounts]++;
            }
          });

          // Verificar se o usuário atual já reagiu
          let userReaction = null;
          if (user) {
            const { data: userReactionData } = await db
              .from('post_reactions')
              .select('reaction_type')
              .eq('post_id', post.id)
              .eq('user_id', user.id)
              .maybeSingle();
            
            userReaction = userReactionData?.reaction_type || null;
          }

          return {
            ...post,
            reactions: reactionCounts,
            user_reaction: userReaction
          };
        })
      );

      setPosts(postsWithReactions);
    } catch (error) {
      console.error('Erro ao carregar postagens:', error);
    }
  };

  const loadSchedules = async () => {
    try {
      const { data, error } = await db
        .from('stream_schedules')
        .select('*')
        .eq('streamer_id', streamerId)
        .eq('is_active', true)
        .order('day_of_week');

      if (error) throw error;

      setSchedules(data || []);
    } catch (error) {
      console.error('Erro ao carregar horários:', error);
    }
  };

  // Função para copiar código
  const handleCopyCodeTop = () => {
    if (streamer?.supporter_code) {
      navigator.clipboard.writeText(streamer.supporter_code);
      setCopiedTop(true);
      setTimeout(() => setCopiedTop(false), 2000);
    }
  };

  // Função para fazer upload do banner
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !isOwner) {
      toast.error('Você não tem permissão para alterar o banner');
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo: 5MB');
      return;
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast.error('Arquivo deve ser uma imagem');
      return;
    }

    try {
      toast.loading('Enviando banner...');

      // Upload para o storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/banner-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('banners')
        .getPublicUrl(fileName);

      // Atualizar perfil
      const { error: updateError } = await db
        .from('user_profiles')
        .update({ banner_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Atualizar estado local
      if (streamer) {
        setStreamer({ ...streamer, banner_url: publicUrl });
      }

      toast.dismiss();
      toast.success('Banner atualizado!');
    } catch (error) {
      console.error('Erro ao fazer upload do banner:', error);
      toast.dismiss();
      toast.error('Erro ao atualizar banner');
    } finally {
      // Limpar input
      e.target.value = '';
    }
  };

  const handleFollow = async () => {
    if (!user) {
      toast.error('Faça login para seguir traders');
      return;
    }

    try {
      if (isFollowing) {
        await db
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('followed_id', streamerId);
        
        setIsFollowing(false);
      } else {
        await db
          .from('user_follows')
          .insert({
            follower_id: user.id,
            followed_id: streamerId
          });
        
        setIsFollowing(true);
      }

      // Atualizar contador
      if (streamer) {
        setStreamer({
          ...streamer,
          followers_count: streamer.followers_count + (isFollowing ? -1 : 1)
        });
      }
    } catch (error) {
      console.error('Erro ao seguir/deixar de seguir:', error);
      toast.error('Erro ao atualizar follow');
    }
  };

  const handleSaveAbout = async () => {
    if (!user || user.id !== streamerId) return;

    try {
      const { error } = await db
        .from('user_profiles')
        .update({ about: aboutText })
        .eq('user_id', streamerId);

      if (error) throw error;

      toast.success('Informações atualizadas com sucesso!');
      setEditingAbout(false);
      
      if (streamer) {
        setStreamer({ ...streamer, about: aboutText });
      }
    } catch (error) {
      console.error('Erro ao salvar sobre:', error);
      toast.error('Erro ao atualizar informações');
    }
  };

  const handleOpenRankingEdit = () => {
    if (!streamer) return;
    
    setRankingForm({
      ranking_lifetime: streamer.ranking_lifetime?.toString() || '',
      ranking_monthly: streamer.ranking_monthly?.toString() || '',
      ranking_weekly: streamer.ranking_weekly?.toString() || ''
    });
    setEditingRanking(true);
  };

  const handleSaveRanking = async () => {
    if (!user || !streamer) return;

    try {
      const lifetime = rankingForm.ranking_lifetime ? parseInt(rankingForm.ranking_lifetime) : null;
      const monthly = rankingForm.ranking_monthly ? parseInt(rankingForm.ranking_monthly) : null;
      const weekly = rankingForm.ranking_weekly ? parseInt(rankingForm.ranking_weekly) : null;

      const { error } = await db
        .from('user_profiles')
        .update({
          ranking_lifetime: lifetime,
          ranking_monthly: monthly,
          ranking_weekly: weekly
        })
        .eq('user_id', streamer.id);

      if (error) throw error;

      toast.success('Ranking atualizado com sucesso!');
      setEditingRanking(false);
      
      // Atualizar estado local
      setStreamer({
        ...streamer,
        ranking_lifetime: lifetime,
        ranking_monthly: monthly,
        ranking_weekly: weekly
      });
    } catch (error) {
      console.error('Erro ao salvar ranking:', error);
      toast.error('Erro ao atualizar ranking');
    }
  };

  const handleReaction = async (postId: string, reactionType: string) => {
    if (!user) {
      toast.error('Faça login para reagir');
      return;
    }

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      // Se já reagiu com o mesmo tipo, remove a reação
      if (post.user_reaction === reactionType) {
        await db
          .from('post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        
        toast.success('Reação removida!');
      } else {
        // Remove reação anterior se existir e adiciona nova
        await db
          .from('post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        await db
          .from('post_reactions')
          .insert({
            post_id: postId,
            user_id: user.id,
            reaction_type: reactionType
          });
        
        toast.success('Reação adicionada!');
      }

      // Recarregar postagens
      await loadPosts();
    } catch (error) {
      console.error('Erro ao reagir:', error);
      toast.error('Erro ao adicionar reação');
    }
  };

  // Função removida - agora usamos o componente StreamerPosts
  // const handleCreatePost = async () => { ... };
  
  const handleDeletePost = async (postId: string) => {
    if (!user || user.id !== streamerId) return;

    try {
      const { error } = await db
        .from('streamer_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      toast.success('Postagem deletada!');
      await loadPosts();
    } catch (error) {
      console.error('Erro ao deletar postagem:', error);
      toast.error('Erro ao deletar postagem');
    }
  };

  const handleSaveSchedule = async () => {
    if (!user || user.id !== streamerId || editingDayOfWeek === null) return;
    if (!scheduleForm.start_time || !scheduleForm.end_time) {
      toast.error('Preencha o horário de início e fim');
      return;
    }

    try {
      // Verificar se já existe um horário para esse dia
      const { data: existing } = await db
        .from('stream_schedules')
        .select('id')
        .eq('streamer_id', streamerId)
        .eq('day_of_week', editingDayOfWeek)
        .maybeSingle();

      if (existing) {
        // Atualizar
        await db
          .from('stream_schedules')
          .update({
            start_time: scheduleForm.start_time,
            end_time: scheduleForm.end_time,
            description: scheduleForm.description || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        // Criar novo
        await db
          .from('stream_schedules')
          .insert({
            streamer_id: streamerId,
            day_of_week: editingDayOfWeek,
            start_time: scheduleForm.start_time,
            end_time: scheduleForm.end_time,
            description: scheduleForm.description || null
          });
      }

      toast.success('Horário salvo!');
      setEditingSchedule(false);
      setEditingDayOfWeek(null);
      setScheduleForm({ start_time: '', end_time: '', description: '' });
      await loadSchedules();
    } catch (error) {
      console.error('Erro ao salvar horário:', error);
      toast.error('Erro ao salvar horário');
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!user || user.id !== streamerId) return;

    try {
      await db
        .from('stream_schedules')
        .delete()
        .eq('id', scheduleId);

      toast.success('Horário removido!');
      await loadSchedules();
    } catch (error) {
      console.error('Erro ao deletar horário:', error);
      toast.error('Erro ao deletar horário');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-white/20 border-t-white"></div>
        </div>
      </Layout>
    );
  }

  if (!streamer) {
    return (
      <Layout>
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <p className="text-white/60 mb-4">Streamer não encontrado</p>
            <Button onClick={() => navigate(-1)} variant="outline">
              Voltar
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-black">
        {/* Botão voltar fixo — sempre visível ao rolar */}
        <button
          onClick={() => navigate(-1)}
          className="fixed top-4 z-[200] flex items-center gap-2 px-3 py-2 bg-black/80 hover:bg-black backdrop-blur-md rounded-xl border border-white/10 transition-all shadow-lg"
          style={{ left: sidebarCollapsed ? 'calc(4.5rem + 12px)' : 'calc(16rem + 12px)' }}
        >
          <ArrowLeft className="h-4 w-4 text-white" />
          <span className="text-sm text-white font-medium">Voltar</span>
        </button>

        {/* Header com background banner ou gradient - ALTURA AUMENTADA */}
        <div className="relative h-80 bg-gradient-to-b from-gray-900 to-black overflow-hidden">
          {/* Banner de fundo (se existir) */}
          {streamer.banner_url && (
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${streamer.banner_url})` }}
            >
              {/* Degradê mais para baixo quando tiver banner */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-60% to-black"></div>
            </div>
          )}
          
          {/* Fallback gradient pattern (se não tiver banner) */}
          {!streamer.banner_url && (
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)'
            }}></div>
          )}
          
          {/* Botão para editar banner (apenas para dono) */}
          {isOwner && (
            <label className="absolute top-6 right-6 p-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-xl transition-colors cursor-pointer z-10 group">
              <ImagePlus className="h-5 w-5 text-white" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBannerUpload}
              />
              <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-black/80 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Alterar banner (1920x300px)
              </span>
            </label>
          )}
          
        </div>

        {/* Perfil Content - Ajustado para ficar mais embaixo no fade preto */}
        <div className="max-w-5xl mx-auto px-6 -mt-16 relative z-10">
          {/* Avatar e Info Principal */}
          <div className="flex items-start gap-6 mb-8">
            {/* Avatar Maior */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="relative z-20 flex-shrink-0"
            >
              <Avatar className="h-40 w-40 border-4 border-black ring-2 ring-white/10">
                <AvatarImage 
                  src={streamer.avatar_url || undefined}
                  className="object-cover w-full h-full"
                />
                <AvatarFallback className="bg-gray-900 text-white text-4xl">
                  {streamer.display_name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </motion.div>

            {/* Info Principal Alinhada */}
            <div className="flex-1 relative z-20 pt-2">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  {/* Nome */}
                  <h1 className="text-4xl font-bold text-white drop-shadow-lg mb-3">
                    {streamer.display_name}
                  </h1>
                  
                  {/* Código de Apoiador - Sem contorno */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-white/50 text-sm font-light">Código de Apoiador:</span>
                    {streamer.supporter_code ? (
                      <div className="flex items-center gap-2 group cursor-pointer" onClick={handleCopyCodeTop}>
                        <code className="text-white font-mono text-lg font-medium">
                          {streamer.supporter_code}
                        </code>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                          {copiedTop ? (
                            <Check className="h-4 w-4 text-green-400" />
                          ) : (
                            <Copy className="h-4 w-4 text-white/60" />
                          )}
                        </span>
                      </div>
                    ) : (
                      <span className="text-white/40 italic text-sm">Não possui ainda</span>
                    )}
                  </div>
                  
                  {streamer.bio && (
                    <p className="text-white/60 text-sm font-light max-w-2xl">
                      {streamer.bio}
                    </p>
                  )}
                </div>

                {!isOwner && (
                  <Button
                    onClick={handleFollow}
                    className={
                      isFollowing
                        ? 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                        : 'bg-white text-black hover:bg-white/90'
                    }
                  >
                    {isFollowing ? 'Seguindo' : 'Seguir'}
                  </Button>
                )}
              </div>

              {/* Stats */}
              <div className="flex gap-6 text-sm">
                <div className="text-center">
                  <div className="text-white font-medium text-lg">{streamer.followers_count}</div>
                  <div className="text-white/40 font-light">Seguidores</div>
                </div>
                <Separator orientation="vertical" className="h-12 bg-white/5" />
                <div className="text-center">
                  <div className="text-white font-medium text-lg">{streamer.supporters_using_code_count}</div>
                  <div className="text-white/40 font-light">Apoiadores</div>
                </div>
                <Separator orientation="vertical" className="h-12 bg-white/5" />
                <div className="text-center">
                  <div className="text-white font-medium text-lg">
                    {streamer.ranking_lifetime !== null ? (
                      streamer.ranking_lifetime <= 10 ? (
                        `#${streamer.ranking_lifetime}`
                      ) : (
                        'Top +10'
                      )
                    ) : (
                      '--'
                    )}
                  </div>
                  <div className="text-white/40 font-light">Ranking Geral</div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-black/50 border-b border-white/5 w-full justify-start rounded-none h-auto p-0">
              <TabsTrigger 
                value="posts"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none text-white/60 data-[state=active]:text-white px-6 py-3"
              >
                Postagens
              </TabsTrigger>
              <TabsTrigger 
                value="about"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none text-white/60 data-[state=active]:text-white px-6 py-3"
              >
                Sobre
              </TabsTrigger>
              <TabsTrigger 
                value="schedules"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none text-white/60 data-[state=active]:text-white px-6 py-3"
              >
                Horários
              </TabsTrigger>
              <TabsTrigger 
                value="ranking"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none text-white/60 data-[state=active]:text-white px-6 py-3"
              >
                Ranking
              </TabsTrigger>
            </TabsList>

            {/* Tab: Postagens */}
            <TabsContent value="posts" className="mt-6">
              <StreamerPosts
                streamerId={streamer?.id || streamerId!}
                currentUserId={user?.id || ''}
                isOwner={isOwner}
                streamerName={streamer?.display_name || 'Streamer'}
                streamerAvatar={streamer?.avatar_url || undefined}
              />
            </TabsContent>

            {/* Tab: Horários */}
            <TabsContent value="schedules" className="mt-6">
              <div className="space-y-6">
                {/* Info adicional sobre horários */}
                {schedules.length > 0 && (
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-white/60">
                        <Video className="h-4 w-4" />
                        <span>{schedules.length} {schedules.length === 1 ? 'dia agendado' : 'dias agendados'}</span>
                      </div>
                      {(() => {
                        // Calcular próxima live
                        const now = new Date();
                        const currentDay = now.getDay();
                        const currentTime = now.getHours() * 60 + now.getMinutes();
                        
                        let nextSchedule = null;
                        let daysUntilNext = 7;
                        
                        for (let i = 0; i < 7; i++) {
                          const checkDay = (currentDay + i) % 7;
                          const schedule = schedules.find(s => s.day_of_week === checkDay);
                          
                          if (schedule) {
                            const [startHour, startMin] = schedule.start_time.split(':').map(Number);
                            const scheduleTime = startHour * 60 + startMin;
                            
                            // Se é hoje e ainda não passou o horário, ou se é outro dia
                            if (i === 0 && scheduleTime > currentTime) {
                              nextSchedule = { ...schedule, daysUntil: 0 };
                              break;
                            } else if (i > 0) {
                              nextSchedule = { ...schedule, daysUntil: i };
                              break;
                            }
                          }
                        }
                        
                        if (nextSchedule) {
                          return (
                            <div className="flex items-center gap-2 text-white/80">
                              <span>
                                Próxima: {DAYS_OF_WEEK[nextSchedule.day_of_week]}{' '}
                                {nextSchedule.start_time.slice(0, 5)}
                                {nextSchedule.daysUntil === 0 ? ' (hoje)' : 
                                 nextSchedule.daysUntil === 1 ? ' (amanhã)' : 
                                 ` (em ${nextSchedule.daysUntil} dias)`}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                )}

                {/* Calendário Semanal */}
                <div className="grid grid-cols-7 gap-3">
                  {DAYS_OF_WEEK.map((day, index) => {
                    const schedule = schedules.find(s => s.day_of_week === index);
                    const hasSchedule = !!schedule;
                    
                    // Calcular duração da live
                    let duration = '';
                    if (schedule) {
                      const [startHour, startMin] = schedule.start_time.split(':').map(Number);
                      const [endHour, endMin] = schedule.end_time.split(':').map(Number);
                      const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
                      const hours = Math.floor(totalMinutes / 60);
                      const minutes = totalMinutes % 60;
                      
                      if (hours > 0 && minutes > 0) {
                        duration = `${hours}h ${minutes}min`;
                      } else if (hours > 0) {
                        duration = `${hours}h`;
                      } else {
                        duration = `${minutes}min`;
                      }
                    }
                    
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => {
                          if (isOwner) {
                            setEditingDayOfWeek(index);
                            if (schedule) {
                              setScheduleForm({
                                start_time: schedule.start_time,
                                end_time: schedule.end_time,
                                description: schedule.description || ''
                              });
                            } else {
                              setScheduleForm({ start_time: '', end_time: '', description: '' });
                            }
                            setEditingSchedule(true);
                          }
                        }}
                        className={`
                          relative rounded-2xl p-4 border-2 transition-all cursor-pointer
                          bg-white/[0.02] border-white/5 hover:border-white/10
                          ${isOwner ? 'hover:scale-105' : ''}
                        `}
                      >
                        <div className="text-center">
                          <div className="text-white/90 font-medium mb-2">{day}</div>
                          
                          {hasSchedule && schedule ? (
                            <div className="space-y-1">
                              <div className="text-white text-sm font-medium">
                                {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                              </div>
                              {duration && (
                                <div className="text-white/60 text-xs font-medium">
                                  {duration}
                                </div>
                              )}
                              {schedule.description && (
                                <div className="text-white/40 text-xs line-clamp-2">
                                  {schedule.description}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-4">
                              <div className="text-white/20 text-xs">
                                {isOwner ? 'Clique para definir' : 'Sem horário'}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {isOwner && hasSchedule && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSchedule(schedule!.id);
                            }}
                            variant="ghost"
                            size="sm"
                            className="absolute top-1 right-1 h-6 w-6 p-0 text-white/30 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {!isOwner && schedules.length === 0 && (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-white/20 mx-auto mb-4" />
                    <p className="text-white/40 font-light">Nenhum horário definido</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Dialog para editar horário */}
            <Dialog open={editingSchedule} onOpenChange={setEditingSchedule}>
              <DialogContent className="bg-black/95 backdrop-blur-xl border border-white/10 max-w-lg">
                <DialogHeader className="border-b border-white/5 pb-6">
                  <DialogTitle className="text-white text-2xl font-light">
                    {editingDayOfWeek !== null ? DAYS_OF_WEEK[editingDayOfWeek] : ''}
                  </DialogTitle>
                  <p className="text-white/40 text-sm font-light mt-2">
                    Configure o horário da sua live neste dia
                  </p>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                  {/* Horário de Início */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-white/70 text-sm font-normal">
                        Horário de início
                      </Label>
                    </div>
                    <Input
                      type="time"
                      value={scheduleForm.start_time}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                      className="bg-white/5 border-white/10 text-white h-14 text-center font-mono text-xl hover:bg-white/10 focus:bg-white/10 transition-colors rounded-xl"
                    />
                    <p className="text-white/30 text-xs font-light">
                      Defina quando você começará a transmitir
                    </p>
                  </div>

                  {/* Duração da Live */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-white/70 text-sm font-normal">
                        Duração estimada
                      </Label>
                      <span className="text-white/30 text-xs">em horas</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3, 4, 5, 6].map((hours) => {
                        const endTime = scheduleForm.start_time ? (() => {
                          const [h, m] = scheduleForm.start_time.split(':').map(Number);
                          const totalMinutes = h * 60 + m + hours * 60;
                          const endH = Math.floor(totalMinutes / 60) % 24;
                          const endM = totalMinutes % 60;
                          return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                        })() : '';
                        
                        const isSelected = scheduleForm.end_time === endTime;
                        
                        return (
                          <button
                            key={hours}
                            type="button"
                            onClick={() => {
                              if (scheduleForm.start_time && endTime) {
                                setScheduleForm({ ...scheduleForm, end_time: endTime });
                              }
                            }}
                            disabled={!scheduleForm.start_time}
                            className={`
                              p-4 rounded-xl border-2 transition-all text-center
                              ${isSelected 
                                ? 'bg-white/10 border-white/30 text-white' 
                                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'
                              }
                              disabled:opacity-30 disabled:cursor-not-allowed
                            `}
                          >
                            <div className="text-2xl font-light">{hours}h</div>
                            {scheduleForm.start_time && endTime && (
                              <div className="text-xs text-white/40 mt-1">
                                até {endTime}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-white/30 text-xs font-light">
                      Selecione quanto tempo durará sua live aproximadamente
                    </p>
                  </div>

                  {/* Preview do Horário Final */}
                  {scheduleForm.start_time && scheduleForm.end_time && (
                    <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-white/50 text-xs font-light mb-1">Horário completo</div>
                          <div className="text-white text-lg font-mono">
                            {scheduleForm.start_time.slice(0, 5)} - {scheduleForm.end_time.slice(0, 5)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-white/50 text-xs font-light mb-1">Duração</div>
                          <div className="text-blue-400 text-lg font-medium">
                            {(() => {
                              const [startHour, startMin] = scheduleForm.start_time.split(':').map(Number);
                              const [endHour, endMin] = scheduleForm.end_time.split(':').map(Number);
                              const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
                              const hours = Math.floor(totalMinutes / 60);
                              const minutes = totalMinutes % 60;
                              
                              if (hours > 0 && minutes > 0) {
                                return `${hours}h ${minutes}min`;
                              } else if (hours > 0) {
                                return `${hours}h`;
                              } else {
                                return `${minutes}min`;
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Descrição/Tema da Live */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-white/70 text-sm font-normal">
                        Tema da live
                      </Label>
                      <span className="text-white/30 text-xs">opcional</span>
                    </div>
                    <Textarea
                      value={scheduleForm.description}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
                      placeholder="Ex: Análise técnica do mercado, Trading ao vivo com sinais..."
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[100px] resize-none hover:bg-white/10 focus:bg-white/10 transition-colors rounded-xl"
                    />
                    <p className="text-white/30 text-xs font-light">
                      Descreva o que você fará durante a transmissão
                    </p>
                  </div>
                </div>

                {/* Footer com botões */}
                <DialogFooter className="border-t border-white/5 pt-6 gap-3">
                  <Button
                    onClick={() => {
                      setEditingSchedule(false);
                      setEditingDayOfWeek(null);
                      setScheduleForm({ start_time: '', end_time: '', description: '' });
                    }}
                    variant="ghost"
                    className="flex-1 text-white/60 hover:text-white hover:bg-white/5 h-11 rounded-xl"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveSchedule}
                    disabled={!scheduleForm.start_time || !scheduleForm.end_time}
                    className="flex-1 bg-white text-black hover:bg-white/90 h-11 font-medium rounded-xl disabled:opacity-30"
                  >
                    Salvar horário
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Tab: Horários - REMOVIDA */}

            {/* Tab: Sobre */}
            <TabsContent value="about" className="mt-6">
              <div className="space-y-6">
                {/* Sobre o Trader */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white/90 text-base font-medium">Sobre o Trader</h3>
                    {isOwner && !editingAbout && (
                      <Button
                        onClick={() => setEditingAbout(true)}
                        variant="ghost"
                        size="sm"
                        className="text-white/40 hover:text-white/80"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                    )}
                  </div>

                  {editingAbout && isOwner ? (
                    <div className="space-y-4">
                      <Textarea
                        value={aboutText}
                        onChange={(e) => setAboutText(e.target.value)}
                        placeholder="Escreva sobre você, sua experiência com trading, estratégias..."
                        className="min-h-[150px] bg-white/[0.02] border-white/10 text-white placeholder:text-white/30"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          onClick={() => {
                            setEditingAbout(false);
                            setAboutText(streamer?.about || '');
                          }}
                          variant="outline"
                          size="sm"
                          className="border-white/10 text-white/60 hover:bg-white/5"
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={handleSaveAbout}
                          size="sm"
                          className="bg-white text-black hover:bg-white/90"
                        >
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {streamer.about ? (
                        <p className="text-white/70 text-sm font-light leading-relaxed whitespace-pre-wrap">
                          {streamer.about}
                        </p>
                      ) : (
                        <p className="text-white/30 text-sm font-light italic text-center py-8">
                          {isOwner
                            ? 'Clique em "Editar" para adicionar informações sobre você'
                            : 'Nenhuma informação adicionada ainda'}
                        </p>
                      )}
                    </div>
                  )}
                </div>


                {/* Link de Apoio */}
                {streamer.trader_support_link && (
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                    <h4 className="text-white/90 font-medium text-sm mb-3">Apoie Este Trader</h4>
                    <Button
                      onClick={() => window.open(streamer.trader_support_link || '', '_blank')}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    >
                      <Heart className="h-4 w-4 mr-2" />
                      Apoiar Trader
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab: Ranking - Lista Completa */}
            <TabsContent value="ranking" className="mt-6">
              <div className="max-w-3xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Filtro de Período */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRankingPeriod('weekly')}
                        className={`px-4 py-2 rounded-lg text-sm font-light transition-all ${
                          rankingPeriod === 'weekly'
                            ? 'bg-white/10 text-white'
                            : 'bg-transparent text-white/40 hover:text-white/60'
                        }`}
                      >
                        Semanal
                      </button>
                      <button
                        onClick={() => setRankingPeriod('monthly')}
                        className={`px-4 py-2 rounded-lg text-sm font-light transition-all ${
                          rankingPeriod === 'monthly'
                            ? 'bg-white/10 text-white'
                            : 'bg-transparent text-white/40 hover:text-white/60'
                        }`}
                      >
                        Mensal
                      </button>
                      <button
                        onClick={() => setRankingPeriod('lifetime')}
                        className={`px-4 py-2 rounded-lg text-sm font-light transition-all ${
                          rankingPeriod === 'lifetime'
                            ? 'bg-white/10 text-white'
                            : 'bg-transparent text-white/40 hover:text-white/60'
                        }`}
                      >
                        Geral
                      </button>
                    </div>

                    {isAdmin && (
                      <Button
                        onClick={handleOpenRankingEdit}
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-white/60 hover:text-white"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* Pódio Top 3 */}
                  {(() => {
                    const currentRank = rankingPeriod === 'lifetime'
                      ? streamer.ranking_lifetime
                      : rankingPeriod === 'monthly'
                      ? streamer.ranking_monthly
                      : streamer.ranking_weekly;

                    const isInPos = (pos: number) => currentRank === pos;

                    const AnonAvatar = ({ colors, size }: { colors: string; size: string }) => (
                      <div className={`relative ${size}`}>
                        <div className={`absolute inset-0 rounded-full ${colors} blur-sm animate-pulse`} />
                        <div className={`relative ${size} rounded-full border border-white/20 bg-white/5 flex items-center justify-center overflow-hidden`}>
                          <Users className="w-8 h-8 text-white/30" />
                          <motion.div
                            animate={{ x: ['-100%', '100%'] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                          />
                        </div>
                      </div>
                    );

                    return (
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-8">
                        <div className="flex items-end justify-center gap-8">

                          {/* 2º Lugar */}
                          <div className="flex flex-col items-center gap-5 w-40">
                            {isInPos(2) ? (
                              <>
                                <Avatar className="w-20 h-20 border-2 border-gray-400/40">
                                  <AvatarImage src={streamer.avatar_url || ''} className="object-cover" />
                                  <AvatarFallback>{streamer.display_name[0]}</AvatarFallback>
                                </Avatar>
                                <div className="text-center">
                                  <div className="text-white/80 text-sm font-light truncate max-w-[140px]">{streamer.display_name}</div>
                                  {streamer.supporter_code && (
                                    <button
                                      onClick={handleCopyPodiumCode}
                                      className="flex items-center gap-1 mt-1 text-white/30 hover:text-white/60 transition-colors font-mono text-[10px]"
                                    >
                                      {copiedPodium ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                      {streamer.supporter_code}
                                    </button>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <AnonAvatar colors="bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-pink-500/20" size="w-20 h-20" />
                                <div className="h-8" />
                              </>
                            )}
                            <div className="relative w-full flex flex-col justify-end" style={{ height: '200px' }}>
                              <motion.div
                                key={`p2-${rankingPeriod}`}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: '75%', opacity: 1 }}
                                transition={{ duration: 0.8, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
                                className={`w-full rounded-t-lg relative overflow-hidden ${
                                  isInPos(2) ? 'bg-gradient-to-t from-gray-400/20 to-transparent' : 'bg-gradient-to-t from-white/8 to-transparent'
                                }`}
                              >
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                                  <span className={`text-4xl font-extralight ${isInPos(2) ? 'text-gray-400/70' : 'text-white/20'}`}>2</span>
                                </div>
                              </motion.div>
                            </div>
                          </div>

                          {/* 1º Lugar */}
                          <div className="flex flex-col items-center gap-5 w-40">
                            {isInPos(1) ? (
                              <>
                                <div className="relative">
                                  <Avatar className="w-24 h-24 border-2 border-yellow-500/50">
                                    <AvatarImage src={streamer.avatar_url || ''} className="object-cover" />
                                    <AvatarFallback>{streamer.display_name[0]}</AvatarFallback>
                                  </Avatar>
                                  <div className="absolute -top-2 -right-2 bg-yellow-500/20 rounded-full p-1.5">
                                    <Crown className="w-5 h-5 text-yellow-500/80" fill="currentColor" />
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-white text-sm font-semibold truncate max-w-[140px]">{streamer.display_name}</div>
                                  {streamer.supporter_code && (
                                    <button
                                      onClick={handleCopyPodiumCode}
                                      className="flex items-center gap-1 mt-1 text-yellow-500/50 hover:text-yellow-500/80 transition-colors font-mono text-[10px]"
                                    >
                                      {copiedPodium ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                      {streamer.supporter_code}
                                    </button>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="relative">
                                  <AnonAvatar colors="bg-gradient-to-br from-yellow-500/20 via-orange-500/20 to-red-500/20" size="w-24 h-24" />
                                  <div className="absolute -top-2 -right-2 bg-yellow-500/10 rounded-full p-1.5">
                                    <Crown className="w-4 h-4 text-yellow-500/30" fill="currentColor" />
                                  </div>
                                </div>
                                <div className="h-8" />
                              </>
                            )}
                            <div className="relative w-full flex flex-col justify-end" style={{ height: '240px' }}>
                              <motion.div
                                key={`p1-${rankingPeriod}`}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: '100%', opacity: 1 }}
                                transition={{ duration: 0.8, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
                                className={`w-full rounded-t-lg relative overflow-hidden ${
                                  isInPos(1) ? 'bg-gradient-to-t from-yellow-500/20 to-transparent' : 'bg-gradient-to-t from-white/8 to-transparent'
                                }`}
                              >
                                <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
                                  <span className={`text-5xl font-extralight ${isInPos(1) ? 'text-yellow-500/70' : 'text-white/20'}`}>1</span>
                                </div>
                              </motion.div>
                            </div>
                          </div>

                          {/* 3º Lugar */}
                          <div className="flex flex-col items-center gap-5 w-40">
                            {isInPos(3) ? (
                              <>
                                <Avatar className="w-20 h-20 border-2 border-orange-600/40">
                                  <AvatarImage src={streamer.avatar_url || ''} className="object-cover" />
                                  <AvatarFallback>{streamer.display_name[0]}</AvatarFallback>
                                </Avatar>
                                <div className="text-center">
                                  <div className="text-white/80 text-sm font-light truncate max-w-[140px]">{streamer.display_name}</div>
                                  {streamer.supporter_code && (
                                    <button
                                      onClick={handleCopyPodiumCode}
                                      className="flex items-center gap-1 mt-1 text-white/30 hover:text-white/60 transition-colors font-mono text-[10px]"
                                    >
                                      {copiedPodium ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                      {streamer.supporter_code}
                                    </button>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <AnonAvatar colors="bg-gradient-to-br from-orange-500/20 via-red-500/20 to-pink-500/20" size="w-20 h-20" />
                                <div className="h-8" />
                              </>
                            )}
                            <div className="relative w-full flex flex-col justify-end" style={{ height: '200px' }}>
                              <motion.div
                                key={`p3-${rankingPeriod}`}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: '60%', opacity: 1 }}
                                transition={{ duration: 0.8, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
                                className={`w-full rounded-t-lg relative overflow-hidden ${
                                  isInPos(3) ? 'bg-gradient-to-t from-orange-600/20 to-transparent' : 'bg-gradient-to-t from-white/8 to-transparent'
                                }`}
                              >
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                                  <span className={`text-4xl font-extralight ${isInPos(3) ? 'text-orange-600/70' : 'text-white/20'}`}>3</span>
                                </div>
                              </motion.div>
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })()}

                </motion.div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialog: Editar Ranking (Admin) */}
      <Dialog open={editingRanking} onOpenChange={setEditingRanking}>
        <DialogContent className="bg-black/95 backdrop-blur-xl border border-white/10 max-w-md">
          <DialogHeader className="border-b border-white/5 pb-4">
            <DialogTitle className="text-white text-xl font-light flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Editar Ranking
            </DialogTitle>
            <p className="text-white/40 text-sm font-light mt-2">
              Defina as posições de ranking do streamer
            </p>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Ranking Geral */}
            <div className="space-y-2">
              <Label className="text-white/70 text-sm font-normal">
                Ranking Geral
              </Label>
              <Input
                type="number"
                min="1"
                placeholder="Ex: 1"
                value={rankingForm.ranking_lifetime}
                onChange={(e) => setRankingForm({ ...rankingForm, ranking_lifetime: e.target.value })}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 hover:bg-white/10 focus:bg-white/10 transition-colors rounded-xl"
              />
              <p className="text-white/30 text-xs font-light">
                Deixe em branco para remover
              </p>
            </div>

            {/* Ranking Mensal */}
            <div className="space-y-2">
              <Label className="text-white/70 text-sm font-normal">
                Ranking Mensal
              </Label>
              <Input
                type="number"
                min="1"
                placeholder="Ex: 3"
                value={rankingForm.ranking_monthly}
                onChange={(e) => setRankingForm({ ...rankingForm, ranking_monthly: e.target.value })}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 hover:bg-white/10 focus:bg-white/10 transition-colors rounded-xl"
              />
              <p className="text-white/30 text-xs font-light">
                Deixe em branco para remover
              </p>
            </div>

            {/* Ranking Semanal */}
            <div className="space-y-2">
              <Label className="text-white/70 text-sm font-normal">
                Ranking Semanal
              </Label>
              <Input
                type="number"
                min="1"
                placeholder="Ex: 5"
                value={rankingForm.ranking_weekly}
                onChange={(e) => setRankingForm({ ...rankingForm, ranking_weekly: e.target.value })}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 hover:bg-white/10 focus:bg-white/10 transition-colors rounded-xl"
              />
              <p className="text-white/30 text-xs font-light">
                Deixe em branco para remover
              </p>
            </div>
          </div>

          <DialogFooter className="border-t border-white/5 pt-4 gap-3">
            <Button
              onClick={() => {
                setEditingRanking(false);
                setRankingForm({
                  ranking_lifetime: '',
                  ranking_monthly: '',
                  ranking_weekly: ''
                });
              }}
              variant="ghost"
              className="flex-1 text-white/60 hover:text-white hover:bg-white/5 h-11 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveRanking}
              className="flex-1 bg-white text-black hover:bg-white/90 h-11 rounded-xl"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

