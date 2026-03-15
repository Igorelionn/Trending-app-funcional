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
  Send
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface StreamerData {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  about: string | null;
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
  const { user } = useAuth();
  
  const [streamer, setStreamer] = useState<StreamerData | null>(null);
  const [posts, setPosts] = useState<StreamerPost[]>([]);
  const [schedules, setSchedules] = useState<LiveSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('about');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutText, setAboutText] = useState('');
  const [rankingPeriod, setRankingPeriod] = useState<'lifetime' | 'monthly' | 'weekly'>('monthly');
  
  // Estados para postagens
  const [newPostContent, setNewPostContent] = useState('');
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  
  // Estados para horários
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [editingDayOfWeek, setEditingDayOfWeek] = useState<number | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    start_time: '',
    end_time: '',
    description: ''
  });

  useEffect(() => {
    if (streamerId) {
      loadStreamerData();
      loadPosts();
      loadSchedules();
    }
  }, [streamerId]);

  useEffect(() => {
    setIsOwner(user?.id === streamerId);
  }, [user, streamerId]);

  const loadStreamerData = async () => {
    try {
      setLoading(true);
      
      // Buscar dados do streamer
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', streamerId)
        .single();

      if (userError) throw userError;

      // Buscar se está seguindo
      let isFollowingData = false;
      if (user) {
        const { data: followData } = await supabase
          .from('user_follows')
          .select('*')
          .eq('follower_id', user.id)
          .eq('followed_id', streamerId)
          .single();
        
        isFollowingData = !!followData;
      }

      // Buscar estatísticas REAIS
      const { count: followersCount } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('followed_id', streamerId);

      const { count: streamsCount } = await supabase
        .from('live_streams')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', streamerId)
        .eq('status', 'ended');

      // Buscar código de apoiador vinculado
      const { data: supporterCode } = await supabase
        .from('supporter_codes')
        .select('id, code')
        .eq('user_id', streamerId)
        .eq('is_active', true)
        .maybeSingle();

      // Buscar quantas pessoas usam o código deste streamer
      let supportersUsingCodeCount = 0;
      if (supporterCode) {
        const { count } = await supabase
          .from('supporter_code_usage')
          .select('*', { count: 'exact', head: true })
          .eq('trader_id', streamerId);
        
        supportersUsingCodeCount = count || 0;
      }

      setStreamer({
        id: userData.user_id,
        display_name: userData.display_name || userData.email || 'Trader',
        avatar_url: userData.avatar_url,
        bio: userData.bio,
        about: userData.about || null,
        followers_count: followersCount || 0,
        supporters_count: 0,
        is_following: isFollowingData,
        ranking_lifetime: userData.ranking_lifetime || null,
        ranking_monthly: userData.ranking_monthly || null,
        ranking_weekly: userData.ranking_weekly || null,
        total_streams: streamsCount || 0,
        supporter_code: supporterCode?.code || null,
        trader_support_link: userData.trader_support_link,
        supporters_using_code_count: supportersUsingCodeCount
      });

      setIsFollowing(isFollowingData);
      setAboutText(userData.about || '');
    } catch (error) {
      console.error('Erro ao carregar dados do trader:', error);
      toast.error('Erro ao carregar perfil do trader');
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      // Buscar postagens do streamer
      const { data: postsData, error: postsError } = await supabase
        .from('streamer_posts')
        .select('*')
        .eq('streamer_id', streamerId)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Buscar reações para cada postagem
      const postsWithReactions = await Promise.all(
        (postsData || []).map(async (post) => {
          // Contar reações por tipo
          const { data: reactions } = await supabase
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
            const { data: userReactionData } = await supabase
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
      const { data, error } = await supabase
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

  const handleFollow = async () => {
    if (!user) {
      toast.error('Faça login para seguir traders');
      return;
    }

    try {
      if (isFollowing) {
        await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('followed_id', streamerId);
        
        setIsFollowing(false);
      } else {
        await supabase
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
      const { error } = await supabase
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
        await supabase
          .from('post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        
        toast.success('Reação removida!');
      } else {
        // Remove reação anterior se existir e adiciona nova
        await supabase
          .from('post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        await supabase
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

  const handleCreatePost = async () => {
    if (!user || user.id !== streamerId) return;
    if (!newPostContent.trim()) {
      toast.error('Escreva algo para postar');
      return;
    }

    try {
      setIsCreatingPost(true);
      
      const { error } = await supabase
        .from('streamer_posts')
        .insert({
          streamer_id: streamerId,
          content: newPostContent.trim()
        });

      if (error) throw error;

      toast.success('Postagem criada!');
      setNewPostContent('');
      await loadPosts();
    } catch (error) {
      console.error('Erro ao criar postagem:', error);
      toast.error('Erro ao criar postagem');
    } finally {
      setIsCreatingPost(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user || user.id !== streamerId) return;

    try {
      const { error } = await supabase
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
      const { data: existing } = await supabase
        .from('stream_schedules')
        .select('id')
        .eq('streamer_id', streamerId)
        .eq('day_of_week', editingDayOfWeek)
        .maybeSingle();

      if (existing) {
        // Atualizar
        await supabase
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
        await supabase
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
      await supabase
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
            <Button onClick={() => navigate('/live')} variant="outline">
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
        {/* Header com background gradient */}
        <div className="relative h-48 bg-gradient-to-b from-gray-900 to-black">
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)'
          }}></div>
          
          {/* Botão voltar */}
          <button
            onClick={() => navigate('/live')}
            className="absolute top-6 left-6 p-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-xl transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Perfil Content */}
        <div className="max-w-5xl mx-auto px-6 -mt-20">
          {/* Avatar e Info Principal */}
          <div className="flex flex-col md:flex-row md:items-end gap-6 mb-8">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Avatar className="h-32 w-32 border-4 border-black ring-2 ring-white/10">
                <AvatarImage src={streamer.avatar_url || undefined} />
                <AvatarFallback className="bg-gray-900 text-white text-3xl">
                  {streamer.display_name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </motion.div>

            <div className="flex-1">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-light text-white">
                      {streamer.display_name}
                    </h1>
                    <Badge className="bg-white/5 text-white/80 border-white/10 hover:bg-white/5">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verificado
                    </Badge>
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
              <div className="flex flex-col gap-4">
                {/* Código de Apoiador - Linha Superior */}
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-white/40 text-sm font-light">Código de Apoiador:</span>
                        {streamer.supporter_code ? (
                          <code className="text-white font-mono text-lg font-medium bg-white/5 px-4 py-1.5 rounded">
                            {streamer.supporter_code}
                          </code>
                        ) : (
                          <span className="text-white/30 italic text-sm">Não configurado</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Estatísticas - Linha Inferior */}
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
              <div className="space-y-4">
                {/* Criar Postagem (só para o dono) */}
                {isOwner && (
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                    <Textarea
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder="Compartilhe algo com seus seguidores..."
                      className="min-h-[100px] bg-white/[0.02] border-white/10 text-white placeholder:text-white/30 mb-4"
                    />
                    <div className="flex justify-end">
                      <Button
                        onClick={handleCreatePost}
                        disabled={isCreatingPost || !newPostContent.trim()}
                        className="bg-white text-black hover:bg-white/90"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {isCreatingPost ? 'Postando...' : 'Publicar'}
                      </Button>
                    </div>
                  </div>
                )}

                {posts.length === 0 ? (
                  <div className="text-center py-16">
                    <Video className="h-12 w-12 text-white/20 mx-auto mb-4" />
                    <p className="text-white/40 font-light">
                      {isOwner ? 'Crie sua primeira postagem acima' : 'Nenhuma postagem ainda'}
                    </p>
                  </div>
                ) : (
                  posts.map(post => (
                    <div
                      key={post.id}
                      className="bg-white/[0.02] border border-white/5 rounded-2xl p-6"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <p className="text-white/80 text-sm font-light flex-1">
                          {post.content}
                        </p>
                        {isOwner && (
                          <Button
                            onClick={() => handleDeletePost(post.id)}
                            variant="ghost"
                            size="sm"
                            className="text-white/30 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="text-white/30 text-xs mb-4">
                        {new Date(post.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      
                      {/* Reações */}
                      <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                        {Object.entries(REACTION_ICONS).map(([key, Icon]) => {
                          const isActive = post.user_reaction === key;
                          return (
                            <button
                              key={key}
                              onClick={() => handleReaction(post.id, key)}
                              className={`flex items-center gap-2 transition-colors ${
                                isActive
                                  ? 'text-white'
                                  : 'text-white/40 hover:text-white/80'
                              }`}
                            >
                              <Icon className={`h-4 w-4 ${isActive ? 'fill-current' : ''}`} />
                              <span className="text-xs font-medium">
                                {post.reactions[key as keyof typeof post.reactions]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Tab: Horários */}
            <TabsContent value="schedules" className="mt-6">
              <div className="space-y-6">
                {/* Calendário Semanal */}
                <div className="grid grid-cols-7 gap-3">
                  {DAYS_OF_WEEK.map((day, index) => {
                    const schedule = schedules.find(s => s.day_of_week === index);
                    const hasSchedule = !!schedule;
                    
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
                          ${hasSchedule 
                            ? 'bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30 hover:border-blue-500/50' 
                            : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                          }
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
                              {schedule.description && (
                                <div className="text-white/40 text-xs line-clamp-2">
                                  {schedule.description}
                                </div>
                              )}
                              <div className="flex items-center justify-center mt-2">
                                <Clock className="h-3 w-3 text-blue-400" />
                              </div>
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
              <DialogContent className="bg-gray-900 border-white/10">
                <DialogHeader>
                  <DialogTitle className="text-white">
                    Horário de {editingDayOfWeek !== null ? DAYS_OF_WEEK[editingDayOfWeek] : ''}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-white/80">Horário de Início</Label>
                    <Input
                      type="time"
                      value={scheduleForm.start_time}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-white/80">Horário de Término</Label>
                    <Input
                      type="time"
                      value={scheduleForm.end_time}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-white/80">Descrição (opcional)</Label>
                    <Textarea
                      value={scheduleForm.description}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
                      placeholder="Ex: Trading ao vivo, Análise de mercado..."
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    onClick={() => {
                      setEditingSchedule(false);
                      setEditingDayOfWeek(null);
                      setScheduleForm({ start_time: '', end_time: '', description: '' });
                    }}
                    variant="outline"
                    className="border-white/10 text-white/60 hover:bg-white/5"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveSchedule}
                    className="bg-white text-black hover:bg-white/90"
                  >
                    Salvar
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

                {/* Código de Apoiador */}
                {streamer.supporter_code && (
                  <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <Tag className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                          <h4 className="text-white/90 font-medium text-sm">Código de Apoiador</h4>
                          <p className="text-white/40 text-xs font-light">Use este código para apoiar o trader</p>
                        </div>
                      </div>
                      
                      {/* Badge com quantidade de apoiadores */}
                      <div className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3 text-white/60" />
                          <span className="text-white/80 text-xs font-medium">
                            {streamer.supporters_using_code_count}
                          </span>
                          <span className="text-white/40 text-xs font-light">
                            {streamer.supporters_using_code_count === 1 ? 'apoiador' : 'apoiadores'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Nome do Trader */}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-white/40 font-light">Trader:</span>
                        <span className="text-white/90 font-medium">{streamer.display_name}</span>
                      </div>
                      
                      {/* Código */}
                      <div className="bg-black/30 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <div className="text-white/40 text-xs font-light mb-1">Código</div>
                          <code className="text-white font-mono text-lg">{streamer.supporter_code}</code>
                        </div>
                        <Button
                          onClick={() => {
                            navigator.clipboard.writeText(streamer.supporter_code || '');
                            toast.success('Código copiado!');
                          }}
                          variant="outline"
                          size="sm"
                          className="border-white/10 text-white/80 hover:bg-white/5"
                        >
                          Copiar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

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

            {/* Tab: Ranking - Redesenhada completamente */}
            <TabsContent value="ranking" className="mt-6">
              <div className="relative">
                {/* Podium Style - Top 3 */}
                <div className="mb-8">
                  <div className="flex items-end justify-center gap-4 mb-6">
                    {/* Segundo Lugar */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="flex flex-col items-center"
                    >
                      <div className={`relative ${streamer.ranking_lifetime === 2 ? 'ring-2 ring-gray-400/50' : ''}`}>
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center mb-3">
                          <span className="text-3xl font-bold text-white">2</span>
                        </div>
                        {streamer.ranking_lifetime === 2 && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.4, type: "spring" }}
                            className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center"
                          >
                            <Trophy className="h-4 w-4 text-white" />
                          </motion.div>
                        )}
                      </div>
                      <div className="h-24 w-full bg-gradient-to-t from-gray-600/20 to-gray-400/20 border-t-2 border-gray-400 rounded-t-lg"></div>
                    </motion.div>

                    {/* Primeiro Lugar */}
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="flex flex-col items-center"
                    >
                      <div className={`relative ${streamer.ranking_lifetime === 1 ? 'ring-4 ring-yellow-500/50' : ''}`}>
                        <motion.div
                          animate={{ 
                            boxShadow: streamer.ranking_lifetime === 1 
                              ? ['0 0 20px rgba(234, 179, 8, 0.3)', '0 0 40px rgba(234, 179, 8, 0.5)', '0 0 20px rgba(234, 179, 8, 0.3)']
                              : '0 0 0px rgba(0, 0, 0, 0)'
                          }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="w-28 h-28 rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 flex items-center justify-center mb-3"
                        >
                          <span className="text-5xl font-bold text-white">1</span>
                        </motion.div>
                        {streamer.ranking_lifetime === 1 && (
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ delay: 0.5, type: "spring" }}
                            className="absolute -top-6 left-1/2 -translate-x-1/2"
                          >
                            <Crown className="h-8 w-8 text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                          </motion.div>
                        )}
                      </div>
                      <div className="h-32 w-full bg-gradient-to-t from-yellow-600/20 to-yellow-400/20 border-t-4 border-yellow-400 rounded-t-lg"></div>
                    </motion.div>

                    {/* Terceiro Lugar */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="flex flex-col items-center"
                    >
                      <div className={`relative ${streamer.ranking_lifetime === 3 ? 'ring-2 ring-orange-600/50' : ''}`}>
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-600 to-orange-800 flex items-center justify-center mb-3">
                          <span className="text-3xl font-bold text-white">3</span>
                        </div>
                        {streamer.ranking_lifetime === 3 && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.4, type: "spring" }}
                            className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center"
                          >
                            <Trophy className="h-4 w-4 text-white" />
                          </motion.div>
                        )}
                      </div>
                      <div className="h-16 w-full bg-gradient-to-t from-orange-800/20 to-orange-600/20 border-t-2 border-orange-600 rounded-t-lg"></div>
                    </motion.div>
                  </div>
                </div>

                {/* Posição Atual do Trader */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                  className="bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/10 rounded-3xl p-8 backdrop-blur-xl"
                >
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-3 mb-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                        <Avatar className="w-14 h-14 border-2 border-white/20">
                          <AvatarImage src={streamer.avatar_url || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-gray-800 to-gray-700">
                            {streamer.display_name[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                    
                    <h3 className="text-2xl font-light text-white mb-2">{streamer.display_name}</h3>
                    
                    <div className="inline-flex items-center gap-2 bg-white/5 px-6 py-3 rounded-full border border-white/10">
                      <TrendingUp className="h-5 w-5 text-white/60" />
                      <span className="text-white/80 text-sm font-light">Posição no Ranking</span>
                    </div>
                  </div>

                  <div className="flex justify-center gap-8">
                    {/* Ranking Geral */}
                    <div className="text-center">
                      <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-blue-600 mb-2">
                        {streamer.ranking_lifetime !== null ? (
                          streamer.ranking_lifetime <= 10 ? (
                            `#${streamer.ranking_lifetime}`
                          ) : (
                            <span className="text-4xl">Top +10</span>
                          )
                        ) : (
                          '--'
                        )}
                      </div>
                      <div className="text-white/40 text-xs font-light uppercase tracking-wider">Geral</div>
                    </div>

                    <Separator orientation="vertical" className="h-20 bg-white/10" />

                    {/* Ranking Mensal */}
                    <div className="text-center">
                      <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 to-orange-600 mb-2">
                        {streamer.ranking_monthly !== null ? (
                          streamer.ranking_monthly <= 10 ? (
                            `#${streamer.ranking_monthly}`
                          ) : (
                            <span className="text-4xl">Top +10</span>
                          )
                        ) : (
                          '--'
                        )}
                      </div>
                      <div className="text-white/40 text-xs font-light uppercase tracking-wider">Mensal</div>
                    </div>

                    <Separator orientation="vertical" className="h-20 bg-white/10" />

                    {/* Ranking Semanal */}
                    <div className="text-center">
                      <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-green-400 to-emerald-600 mb-2">
                        {streamer.ranking_weekly !== null ? (
                          streamer.ranking_weekly <= 10 ? (
                            `#${streamer.ranking_weekly}`
                          ) : (
                            <span className="text-4xl">Top +10</span>
                          )
                        ) : (
                          '--'
                        )}
                      </div>
                      <div className="text-white/40 text-xs font-light uppercase tracking-wider">Semanal</div>
                    </div>
                  </div>

                  {/* Indicador de Top 10 */}
                  {streamer.ranking_lifetime !== null && streamer.ranking_lifetime <= 10 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 }}
                      className="mt-8 pt-6 border-t border-white/5"
                    >
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span className="text-white/60 font-light">
                          Trader no <span className="text-white font-medium">Top 10</span> Geral
                        </span>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
