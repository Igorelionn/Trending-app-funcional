import { supabase } from '@/lib/supabase';

export interface StreamerPost {
  id: string;
  streamer_id: string;
  content: string;
  media_url: string | null;
  created_at: string;
  updated_at: string;
  views_count?: number;
  likes_count?: number;
  user_reaction?: string | null;
  poll?: PostPoll | null;
  is_pinned?: boolean;
  pinned_at?: string | null;
  mentions?: PostMention[];
  supporters_only?: boolean;
}

export interface PostMention {
  id: string;
  mentioned_user_id: string;
  mentioned_user_name?: string;
}

export interface PostDraft {
  id: string;
  streamer_id: string;
  content: string;
  media_url: string | null;
  poll_data: any;
  created_at: string;
  expires_at: string;
}

export interface PostPoll {
  id: string;
  post_id: string;
  question: string;
  options: PollOption[];
  votes_count: number;
  ends_at: string | null;
  created_at: string;
  user_vote?: number | null;
}

export interface PollOption {
  text: string;
  votes: number;
}

export interface PostReaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: 'like';
  created_at: string;
}

export interface CreatePostData {
  content: string;
  media_url?: string | null;
  poll?: {
    question: string;
    options: string[];
    duration?: number;
  };
  mentions?: string[];
  isDraft?: boolean;
  supporters_only?: boolean;
}

/**
 * Criar um novo post
 */
export async function createPost(
  streamerId: string,
  data: CreatePostData
): Promise<{ success: boolean; post?: StreamerPost; error?: string }> {
  try {
    const { data: post, error } = await supabase
      .from('streamer_posts')
      .insert({
        streamer_id: streamerId,
        content: data.content,
        media_url: data.media_url || null,
        supporters_only: data.supporters_only ?? false,
      })
      .select()
      .single();

    if (error) throw error;

    // Salvar menções se fornecidas
    if (data.mentions && data.mentions.length > 0 && post) {
      const mentionsToInsert = data.mentions.map(mentionedUserId => ({
        post_id: post.id,
        mentioned_user_id: mentionedUserId,
      }));

      const { error: mentionsError } = await supabase
        .from('post_mentions')
        .insert(mentionsToInsert);

      if (mentionsError) {
        console.error('Erro ao salvar menções:', mentionsError);
      }
    }

    // Criar enquete se fornecida
    if (data.poll && post) {
      const endsAt = data.poll.duration
        ? new Date(Date.now() + data.poll.duration * 60 * 60 * 1000).toISOString()
        : null;

      const pollOptions = data.poll.options.map(text => ({ text, votes: 0 }));

      const { error: pollError } = await supabase
        .from('post_polls')
        .insert({
          post_id: post.id,
          question: data.poll.question,
          options: pollOptions,
          ends_at: endsAt,
        });

      if (pollError) {
        console.error('Erro ao criar enquete:', pollError);
      }
    }

    return { success: true, post };
  } catch (error) {
    console.error('Erro ao criar post:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao criar post'
    };
  }
}

/**
 * Buscar posts de um streamer
 */
export async function getStreamerPosts(
  streamerId: string,
  userId?: string,
  limit: number = 20
): Promise<{ success: boolean; posts?: StreamerPost[]; error?: string }> {
  try {
    let query = supabase
      .from('streamer_posts')
      .select(`
        *,
        likes:post_reactions!post_reactions_post_id_fkey(count)
      `)
      .eq('streamer_id', streamerId)
      .order('is_pinned', { ascending: false })  // Posts fixados primeiro
      .order('created_at', { ascending: false }) // Depois por data
      .limit(limit);

    const { data, error } = await query;

    if (error) throw error;

    // Buscar reações do usuário separadamente se userId fornecido
    let userReactions: { [postId: string]: string } = {};
    if (userId && data && data.length > 0) {
      const postIds = data.map((post: any) => post.id);
      const { data: reactions } = await supabase
        .from('post_reactions')
        .select('post_id, reaction_type')
        .eq('user_id', userId)
        .in('post_id', postIds);

      if (reactions) {
        reactions.forEach((reaction: any) => {
          userReactions[reaction.post_id] = reaction.reaction_type;
        });
      }
    }

    // Buscar enquetes e votos do usuário
    const postIds = data?.map((post: any) => post.id) || [];
    let pollsMap: { [postId: string]: any } = {};
    let userVotesMap: { [pollId: string]: number } = {};
    let mentionsMap: { [postId: string]: any[] } = {};

    if (postIds.length > 0) {
      // Buscar menções dos posts
      const { data: mentions } = await supabase
        .from('post_mentions')
        .select(`
          post_id,
          user_profiles!post_mentions_mentioned_user_id_fkey(
            id,
            display_name,
            avatar_url
          )
        `)
        .in('post_id', postIds);

      if (mentions) {
        mentions.forEach((mention: any) => {
          if (!mentionsMap[mention.post_id]) {
            mentionsMap[mention.post_id] = [];
          }
          mentionsMap[mention.post_id].push({
            id: mention.user_profiles.id,
            nome: mention.user_profiles.display_name,
            avatar_url: mention.user_profiles.avatar_url,
          });
        });
      }

      const { data: polls } = await supabase
        .from('post_polls')
        .select('*')
        .in('post_id', postIds);

      if (polls) {
        polls.forEach((poll: any) => {
          pollsMap[poll.post_id] = poll;
        });

        // Buscar votos do usuário nas enquetes
        if (userId) {
          const pollIds = polls.map((poll: any) => poll.id);
          const { data: userVotes } = await supabase
            .from('poll_votes')
            .select('poll_id, option_index')
            .eq('user_id', userId)
            .in('poll_id', pollIds);

          if (userVotes) {
            userVotes.forEach((vote: any) => {
              userVotesMap[vote.poll_id] = vote.option_index;
            });
          }
        }

        // Buscar contagem de votos
        for (const poll of polls) {
          const { data: votes } = await supabase
            .from('poll_votes')
            .select('option_index')
            .eq('poll_id', poll.id);

          if (votes) {
            const options = [...poll.options];
            votes.forEach((vote: any) => {
              if (options[vote.option_index]) {
                options[vote.option_index].votes++;
              }
            });
            poll.options = options;
            poll.votes_count = votes.length;
          }
        }
      }
    }

    // Processar os dados para adicionar contagem de likes, enquetes e menções
    const posts = data?.map((post: any) => {
      const poll = pollsMap[post.id];
      return {
        ...post,
        likes_count: post.likes?.[0]?.count || 0,
        user_reaction: userReactions[post.id] || null,
        mentions: mentionsMap[post.id] || [],
        poll: poll ? {
          ...poll,
          user_vote: userVotesMap[poll.id] ?? null,
        } : null,
      };
    }) || [];

    // Aplicar boosts por post (não mais globais)
    const boostedPosts = await Promise.all(
      posts.map(async (post) => {
        const { data: boosts } = await supabase
          .from('post_boosts')
          .select('boost_type, boost_value')
          .eq('post_id', post.id);

        let boostedPost = { ...post };
        
        if (boosts && boosts.length > 0) {
          boosts.forEach((boost: any) => {
            if (boost.boost_type === 'likes') {
              boostedPost.likes_count = (boostedPost.likes_count || 0) + boost.boost_value;
            } else if (boost.boost_type === 'views') {
              boostedPost.views_count = (boostedPost.views_count || 0) + boost.boost_value;
            }
          });
        }

        return boostedPost;
      })
    );

    return { success: true, posts: boostedPosts };
  } catch (error) {
    console.error('Erro ao buscar posts:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro ao buscar posts' 
    };
  }
}

/**
 * Atualizar um post
 */
export async function updatePost(
  postId: string,
  streamerId: string,
  data: { content: string; media_url?: string | null }
): Promise<{ success: boolean; post?: StreamerPost; error?: string }> {
  try {
    const { data: post, error } = await supabase
      .from('streamer_posts')
      .update({
        content: data.content,
        media_url: data.media_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .eq('streamer_id', streamerId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, post };
  } catch (error) {
    console.error('Erro ao atualizar post:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro ao atualizar post' 
    };
  }
}

/**
 * Deletar um post
 */
export async function deletePost(
  postId: string,
  streamerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('streamer_posts')
      .delete()
      .eq('id', postId)
      .eq('streamer_id', streamerId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Erro ao deletar post:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro ao deletar post' 
    };
  }
}

/**
 * Adicionar reação a um post
 */
export async function addReaction(
  postId: string,
  userId: string,
  reactionType: 'like'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verificar se já existe reação do usuário
    const { data: existingReaction } = await supabase
      .from('post_reactions')
      .select('id, reaction_type')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingReaction) {
      // Se já curtiu, remover curtida
      const { error } = await supabase
        .from('post_reactions')
        .delete()
        .eq('id', existingReaction.id);

      if (error) throw error;
    } else {
      // Criar nova curtida
      const { error } = await supabase
        .from('post_reactions')
        .insert({
          post_id: postId,
          user_id: userId,
          reaction_type: reactionType,
        });

      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Erro ao adicionar reação:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro ao adicionar reação' 
    };
  }
}

/**
 * Incrementar visualizações de um post (apenas uma vez por usuário)
 */
/**
 * Incrementar visualizações únicas de um post
 * Updated: 2026-03-15 23:48:11
 */
export async function incrementViews(
  postId: string,
  userId: string
): Promise<{ success: boolean; wasIncremented?: boolean; error?: string }> {
  try {
    // Validação básica
    if (!userId || userId.trim() === '') {
      return { success: false, wasIncremented: false };
    }

    // IMPORTANTE: Verificar primeiro se já visualizou (evita erro 409)
    const { data: existingView } = await supabase
      .from('post_views')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    // Já visualizou? Não fazer nada
    if (existingView) {
      return { success: true, wasIncremented: false };
    }

    // Tentar incrementar apenas se for visualização nova
    const { data, error } = await supabase
      .rpc('increment_post_view_unique', {
        p_post_id: postId,
        p_user_id: userId
      })
      .then(res => res)
      .catch(err => ({ data: null, error: err }));

    if (error) {
      // Silenciar todos os erros de visualização (já verificamos duplicatas antes)
      return { success: false, wasIncremented: false };
    }

    return { success: true, wasIncremented: data };
  } catch (error) {
    // Silenciar todos os erros de visualização
    return { 
      success: false, 
      wasIncremented: false
    };
  }
}

/**
 * Verificar se usuário já visualizou o post
 */
export async function hasUserViewedPost(
  postId: string,
  userId: string
): Promise<{ success: boolean; hasViewed?: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('post_views')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    return { success: true, hasViewed: !!data };
  } catch (error) {
    console.error('Erro ao verificar visualização:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro ao verificar visualização' 
    };
  }
}

/**
 * Upload de imagem para post
 */
export async function uploadPostImage(
  streamerId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'Arquivo deve ser uma imagem' };
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: 'Imagem deve ter no máximo 5MB' };
    }

    // Gerar nome único para o arquivo
    const fileExt = file.name.split('.').pop();
    const fileName = `${streamerId}/${Date.now()}.${fileExt}`;

    // Upload para o storage
    const { error: uploadError } = await supabase.storage
      .from('post-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Obter URL pública
    const { data } = supabase.storage
      .from('post-images')
      .getPublicUrl(fileName);

    return { success: true, url: data.publicUrl };
  } catch (error) {
    console.error('Erro ao fazer upload da imagem:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro ao fazer upload' 
    };
  }
}

/**
 * Votar em uma enquete
 */
export async function voteInPoll(
  pollId: string,
  userId: string,
  optionIndex: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .rpc('vote_in_poll', {
        p_poll_id: pollId,
        p_user_id: userId,
        p_option_index: optionIndex,
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Erro ao votar:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro ao votar' 
    };
  }
}

/**
 * Fixar/Desfixar um post
 */
export async function togglePinPost(
  postId: string,
  streamerId: string,
  pin: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('streamer_posts')
      .update({
        is_pinned: pin,
        pinned_at: pin ? new Date().toISOString() : null,
      })
      .eq('id', postId)
      .eq('streamer_id', streamerId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Erro ao fixar post:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro ao fixar post' 
    };
  }
}

/**
 * Salvar post como rascunho
 */
export async function saveDraft(
  streamerId: string,
  content: string,
  mediaUrl?: string | null,
  pollData?: any
): Promise<{ success: boolean; draft?: PostDraft; error?: string }> {
  try {
    const { data: draft, error } = await supabase
      .from('post_drafts')
      .insert({
        streamer_id: streamerId,
        content,
        media_url: mediaUrl,
        poll_data: pollData,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, draft };
  } catch (error) {
    console.error('Erro ao salvar rascunho:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro ao salvar rascunho' 
    };
  }
}

/**
 * Buscar rascunhos do streamer
 */
export async function getDrafts(
  streamerId: string
): Promise<{ success: boolean; drafts?: PostDraft[]; error?: string }> {
  try {
    const { data: drafts, error } = await supabase
      .from('post_drafts')
      .select('*')
      .eq('streamer_id', streamerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, drafts: drafts || [] };
  } catch (error) {
    console.error('Erro ao buscar rascunhos:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro ao buscar rascunhos' 
    };
  }
}

/**
 * Deletar rascunho
 */
export async function deleteDraft(
  draftId: string,
  streamerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('post_drafts')
      .delete()
      .eq('id', draftId)
      .eq('streamer_id', streamerId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Erro ao deletar rascunho:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro ao deletar rascunho' 
    };
  }
}

/**
 * Buscar streamers/traders para menção (apenas quem tem posts)
 */
export async function searchStreamersForMention(
  query: string,
  limit: number = 10
): Promise<{ success: boolean; streamers?: Array<{id: string; nome: string; avatar_url?: string}>; error?: string }> {
  try {
    // Buscar apenas streamers/traders ativos (quem já criou posts)
    const { data, error } = await supabase.rpc(
      'search_active_streamers',
      { 
        search_query: query, 
        result_limit: limit 
      }
    );

    if (error) throw error;

    return { success: true, streamers: data || [] };
  } catch (error) {
    console.error('Erro ao buscar streamers:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro ao buscar streamers' 
    };
  }
}

/**
 * Atualizar enquete de um post
 */
export async function updatePoll(
  pollId: string,
  question: string,
  options: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Buscar votos atuais
    const { data: currentPoll } = await supabase
      .from('post_polls')
      .select('options')
      .eq('id', pollId)
      .single();

    // Manter votos atuais se as opções não mudaram de ordem
    const updatedOptions = options.map((opt, idx) => {
      const currentOpt = currentPoll?.options?.[idx];
      return {
        text: opt.trim(),
        votes: currentOpt?.votes || 0
      };
    });

    const { error } = await supabase
      .from('post_polls')
      .update({
        question: question.trim(),
        options: updatedOptions
      })
      .eq('id', pollId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar enquete:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao atualizar enquete'
    };
  }
}

export interface SocialPost extends StreamerPost {
  streamer_name: string;
  streamer_avatar: string | null;
  streamer_display_name: string;
  supporters_only: boolean;
}

/**
 * Buscar feed global de posts de todos os streamers (para a aba Social)
 */
export async function getAllPostsFeed(
  userId?: string,
  limit: number = 30,
  offset: number = 0
): Promise<{ success: boolean; posts?: SocialPost[]; error?: string }> {
  try {
    // 1. Buscar posts
    const { data, error } = await supabase
      .from('streamer_posts')
      .select(`*, likes:post_reactions!post_reactions_post_id_fkey(count)`)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    if (!data || data.length === 0) return { success: true, posts: [] };

    const postIds = data.map((p: any) => p.id);
    const streamerIds = [...new Set(data.map((p: any) => p.streamer_id as string))];

    // 2. Buscar perfis dos streamers (user_profiles.user_id = streamer_posts.streamer_id)
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', streamerIds);

    const profileMap: { [userId: string]: { display_name: string; avatar_url: string | null } } = {};
    profiles?.forEach((p: any) => { profileMap[p.user_id] = p; });

    // 3. Reações do usuário
    let userReactions: { [postId: string]: string } = {};
    if (userId) {
      const { data: reactions } = await supabase
        .from('post_reactions')
        .select('post_id, reaction_type')
        .eq('user_id', userId)
        .in('post_id', postIds);
      reactions?.forEach((r: any) => { userReactions[r.post_id] = r.reaction_type; });
    }

    // 4. Menções — post_mentions.mentioned_user_id → user_profiles.id (PK interna)
    let mentionsMap: { [postId: string]: any[] } = {};
    const { data: mentions } = await supabase
      .from('post_mentions')
      .select('post_id, mentioned_user_id')
      .in('post_id', postIds);

    if (mentions && mentions.length > 0) {
      const mentionedIds = [...new Set(mentions.map((m: any) => m.mentioned_user_id as string))];
      // Busca por .id (PK interna), não por .user_id
      const { data: mentionProfiles } = await supabase
        .from('user_profiles')
        .select('id, user_id, display_name, avatar_url')
        .in('id', mentionedIds);

      const mentionProfileMap: { [id: string]: any } = {};
      mentionProfiles?.forEach((p: any) => { mentionProfileMap[p.id] = p; });

      mentions.forEach((m: any) => {
        if (!mentionsMap[m.post_id]) mentionsMap[m.post_id] = [];
        const prof = mentionProfileMap[m.mentioned_user_id];
        if (prof) {
          mentionsMap[m.post_id].push({
            id: prof.user_id,          // user_id para navegação /profile/:id
            nome: prof.display_name || 'Usuário',
            avatar_url: prof.avatar_url,
          });
        }
      });
    }

    // 5. Enquetes
    let pollsMap: { [postId: string]: any } = {};
    let userVotesMap: { [pollId: string]: number } = {};

    const { data: polls } = await supabase
      .from('post_polls')
      .select('*')
      .in('post_id', postIds);

    if (polls) {
      for (const poll of polls) {
        const { data: votes } = await supabase
          .from('poll_votes')
          .select('option_index')
          .eq('poll_id', poll.id);
        if (votes) {
          const options = [...poll.options];
          votes.forEach((v: any) => { if (options[v.option_index]) options[v.option_index].votes++; });
          poll.options = options;
          poll.votes_count = votes.length;
        }
        pollsMap[poll.post_id] = poll;
      }

      if (userId) {
        const pollIds = polls.map((p: any) => p.id);
        const { data: userVotes } = await supabase
          .from('poll_votes')
          .select('poll_id, option_index')
          .eq('user_id', userId)
          .in('poll_id', pollIds);
        userVotes?.forEach((v: any) => { userVotesMap[v.poll_id] = v.option_index; });
      }
    }

    // 6. Montar posts base
    const basePosts: SocialPost[] = data.map((post: any) => {
      const poll = pollsMap[post.id];
      const profile = profileMap[post.streamer_id];
      return {
        ...post,
        likes_count: post.likes?.[0]?.count || 0,
        user_reaction: userReactions[post.id] || null,
        mentions: mentionsMap[post.id] || [],
        streamer_name: profile?.display_name || 'Streamer',
        streamer_avatar: profile?.avatar_url || null,
        streamer_display_name: profile?.display_name || 'Streamer',
        poll: poll ? { ...poll, user_vote: userVotesMap[poll.id] ?? null } : null,
      };
    });

    // 7. Aplicar boosts (valores simulados definidos pelo streamer)
    const { data: allBoosts } = await supabase
      .from('post_boosts')
      .select('post_id, boost_type, boost_value')
      .in('post_id', postIds);

    const boostsMap: { [postId: string]: any[] } = {};
    allBoosts?.forEach((b: any) => {
      if (!boostsMap[b.post_id]) boostsMap[b.post_id] = [];
      boostsMap[b.post_id].push(b);
    });

    const posts = basePosts.map((post) => {
      const boosts = boostsMap[post.id];
      if (!boosts || boosts.length === 0) return post;
      const boostedPost = { ...post };
      boosts.forEach((boost: any) => {
        if (boost.boost_type === 'likes') {
          boostedPost.likes_count = (boostedPost.likes_count || 0) + boost.boost_value;
        } else if (boost.boost_type === 'views') {
          boostedPost.views_count = (boostedPost.views_count || 0) + boost.boost_value;
        }
      });
      return boostedPost;
    });

    return { success: true, posts };
  } catch (error) {
    console.error('Erro ao buscar feed social:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar feed social'
    };
  }
}
