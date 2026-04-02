import { supabase } from '@/lib/supabase';

export interface PrivilegedStreamer {
  id: string;
  user_id: string;
  granted_by: string | null;
  granted_at: string;
  is_active: boolean;
  notes: string | null;
  display_name?: string;
  avatar_url?: string;
}

export interface PrivilegedPermission {
  id: string;
  privileged_streamer_id: string;
  permission_type: 'poll_control' | 'likes_boost' | 'views_boost' | 'followers_boost' | 'supporters_boost';
  is_enabled: boolean;
}

export interface StreamerBoost {
  id: string;
  user_id: string;
  boost_type: 'likes' | 'views' | 'followers' | 'supporters';
  boost_value: number;
}

export interface PostBoost {
  id: string;
  post_id: string;
  user_id: string;
  boost_type: 'likes' | 'views';
  boost_value: number;
}

export interface PollOverride {
  id: string;
  poll_id: string;
  option_index: number;
  override_percentage: number;
}

// ============ ADMIN FUNCTIONS ============

/**
 * Listar todos os streamers privilegiados
 */
export async function listPrivilegedStreamers(): Promise<{ success: boolean; streamers?: PrivilegedStreamer[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('privileged_streamers')
      .select(`
        *,
        user_profiles!privileged_streamers_user_id_fkey(display_name, avatar_url)
      `)
      .order('granted_at', { ascending: false });

    if (error) throw error;

    const streamers = data?.map((item: any) => ({
      ...item,
      display_name: item.user_profiles?.display_name,
      avatar_url: item.user_profiles?.avatar_url,
    })) || [];

    return { success: true, streamers };
  } catch (error) {
    console.error('Erro ao listar streamers privilegiados:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao listar streamers' };
  }
}

/**
 * Adicionar streamer privilegiado
 */
export async function addPrivilegedStreamer(
  userId: string,
  grantedBy: string,
  permissions: string[],
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Inserir streamer privilegiado
    const { data: streamer, error: streamerError } = await supabase
      .from('privileged_streamers')
      .insert({
        user_id: userId,
        granted_by: grantedBy,
        notes: notes || null,
        is_active: true,
      })
      .select()
      .single();

    if (streamerError) throw streamerError;

    // Inserir permissões
    if (permissions.length > 0) {
      const permissionsData = permissions.map(type => ({
        privileged_streamer_id: streamer.id,
        permission_type: type,
        is_enabled: true,
      }));

      const { error: permError } = await supabase
        .from('privileged_permissions')
        .insert(permissionsData);

      if (permError) throw permError;
    }

    return { success: true };
  } catch (error) {
    console.error('Erro ao adicionar streamer privilegiado:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao adicionar streamer' };
  }
}

/**
 * Remover streamer privilegiado
 */
export async function removePrivilegedStreamer(privilegedId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('privileged_streamers')
      .delete()
      .eq('id', privilegedId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erro ao remover streamer privilegiado:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao remover streamer' };
  }
}

/**
 * Atualizar permissões de um streamer privilegiado
 */
export async function updatePrivilegedPermissions(
  privilegedId: string,
  permissions: { [key: string]: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Buscar permissões existentes
    const { data: existing } = await supabase
      .from('privileged_permissions')
      .select('*')
      .eq('privileged_streamer_id', privilegedId);

    const existingMap = new Map(existing?.map(p => [p.permission_type, p.id]) || []);

    // Atualizar/inserir permissões
    for (const [type, enabled] of Object.entries(permissions)) {
      const existingId = existingMap.get(type);

      if (existingId) {
        // Atualizar
        await supabase
          .from('privileged_permissions')
          .update({ is_enabled: enabled })
          .eq('id', existingId);
      } else if (enabled) {
        // Inserir nova
        await supabase
          .from('privileged_permissions')
          .insert({
            privileged_streamer_id: privilegedId,
            permission_type: type,
            is_enabled: true,
          });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar permissões:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar permissões' };
  }
}

// ============ STREAMER FUNCTIONS ============

/**
 * Verificar se usuário é privilegiado
 */
export async function checkIfPrivileged(userId: string): Promise<{ success: boolean; isPrivileged: boolean; permissions?: PrivilegedPermission[]; error?: string }> {
  try {
    const { data: streamer, error: streamerError } = await supabase
      .from('privileged_streamers')
      .select('id, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (streamerError) throw streamerError;

    if (!streamer) {
      return { success: true, isPrivileged: false, permissions: [] };
    }

    const { data: perms, error: permsError } = await supabase
      .from('privileged_permissions')
      .select('*')
      .eq('privileged_streamer_id', streamer.id)
      .eq('is_enabled', true);

    if (permsError) throw permsError;

    return {
      success: true,
      isPrivileged: true,
      permissions: perms || [],
    };
  } catch (error) {
    console.error('Erro ao verificar privilégios:', error);
    return { 
      success: false, 
      isPrivileged: false, 
      permissions: [],
      error: error instanceof Error ? error.message : 'Erro ao verificar privilégios'
    };
  }
}

/**
 * Obter boosts de um streamer
 */
export async function getStreamerBoosts(userId: string): Promise<{ success: boolean; boosts?: StreamerBoost[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('streamer_boosts')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true, boosts: data || [] };
  } catch (error) {
    console.error('Erro ao obter boosts:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao obter boosts' };
  }
}

/**
 * Atualizar boost
 */
export async function updateStreamerBoost(
  userId: string,
  boostType: 'likes' | 'views' | 'followers' | 'supporters',
  boostValue: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('streamer_boosts')
      .upsert({
        user_id: userId,
        boost_type: boostType,
        boost_value: boostValue,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,boost_type',
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar boost:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar boost' };
  }
}

/**
 * Obter overrides de enquete
 */
export async function getPollOverrides(pollId: string): Promise<{ success: boolean; overrides?: PollOverride[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('poll_overrides')
      .select('*')
      .eq('poll_id', pollId);

    if (error) throw error;
    return { success: true, overrides: data || [] };
  } catch (error) {
    console.error('Erro ao obter overrides:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao obter overrides' };
  }
}

/**
 * Atualizar override de enquete
 */
export async function updatePollOverride(
  pollId: string,
  optionIndex: number,
  overridePercentage: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('poll_overrides')
      .upsert({
        poll_id: pollId,
        option_index: optionIndex,
        override_percentage: overridePercentage,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'poll_id,option_index',
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar override:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar override' };
  }
}

/**
 * Remover override de enquete
 */
export async function removePollOverride(pollId: string, optionIndex: number): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('poll_overrides')
      .delete()
      .eq('poll_id', pollId)
      .eq('option_index', optionIndex);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erro ao remover override:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao remover override' };
  }
}

// ============ POST-SPECIFIC BOOSTS ============

/**
 * Obter boosts de um post específico
 */
export async function getPostBoosts(postId: string): Promise<{ success: boolean; boosts?: PostBoost[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('post_boosts')
      .select('*')
      .eq('post_id', postId);

    if (error) throw error;
    return { success: true, boosts: data || [] };
  } catch (error) {
    console.error('Erro ao buscar boosts do post:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao buscar boosts' };
  }
}

/**
 * Atualizar boost de um post específico
 */
export async function updatePostBoost(
  postId: string,
  userId: string,
  boostType: 'likes' | 'views',
  boostValue: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('post_boosts')
      .upsert({
        post_id: postId,
        user_id: userId,
        boost_type: boostType,
        boost_value: boostValue,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'post_id,boost_type'
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar boost do post:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar boost' };
  }
}

/**
 * Resetar boost de um post (remover)
 */
export async function resetPostBoost(
  postId: string,
  boostType: 'likes' | 'views'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('post_boosts')
      .delete()
      .eq('post_id', postId)
      .eq('boost_type', boostType);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erro ao resetar boost do post:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao resetar boost' };
  }
}

/**
 * Aplicar boosts nas métricas de um post (somar valores fake aos reais)
 * ATUALIZADO: Agora usa post_boosts (por post) em vez de streamer_boosts (global)
 */
export async function applyBoostsToPost(post: any): Promise<any> {
  try {
    // Buscar boosts específicos deste post
    const { data: boosts } = await supabase
      .from('post_boosts')
      .select('boost_type, boost_value')
      .eq('post_id', post.id);

    if (!boosts || boosts.length === 0) {
      return post;
    }

    // Aplicar boosts
    const boostedPost = { ...post };
    boosts.forEach((boost: any) => {
      switch (boost.boost_type) {
        case 'likes':
          boostedPost.likes_count = (boostedPost.likes_count || 0) + boost.boost_value;
          break;
        case 'views':
          boostedPost.views_count = (boostedPost.views_count || 0) + boost.boost_value;
          break;
      }
    });

    return boostedPost;
  } catch (error) {
    console.error('Erro ao aplicar boosts:', error);
    return post;
  }
}

/**
 * Aplicar boosts nas métricas do perfil de um streamer
 */
export async function applyBoostsToProfile(userId: string, metrics: {
  followers_count?: number;
  supporters_count?: number;
  likes_count?: number;
  views_count?: number;
}): Promise<typeof metrics> {
  try {
    // Buscar boosts do streamer
    const { data: boosts } = await supabase
      .from('streamer_boosts')
      .select('boost_type, boost_value')
      .eq('user_id', userId);

    if (!boosts || boosts.length === 0) {
      return metrics;
    }

    // Aplicar boosts
    const boostedMetrics = { ...metrics };
    boosts.forEach(boost => {
      switch (boost.boost_type) {
        case 'followers':
          if (boostedMetrics.followers_count !== undefined) {
            boostedMetrics.followers_count += boost.boost_value;
          }
          break;
        case 'supporters':
          if (boostedMetrics.supporters_count !== undefined) {
            boostedMetrics.supporters_count += boost.boost_value;
          }
          break;
        case 'likes':
          if (boostedMetrics.likes_count !== undefined) {
            boostedMetrics.likes_count += boost.boost_value;
          }
          break;
        case 'views':
          if (boostedMetrics.views_count !== undefined) {
            boostedMetrics.views_count += boost.boost_value;
          }
          break;
      }
    });

    return boostedMetrics;
  } catch (error) {
    console.error('Erro ao aplicar boosts ao perfil:', error);
    return metrics;
  }
}
