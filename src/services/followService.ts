import { getSupabase } from '@/lib/supabase';

export interface StreamerProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email: string;
  followers_count: number;
  supporters_count: number;
  referral_code?: string;
  is_following?: boolean;
  bio?: string | null;
  about?: string | null;
}

export interface Follower {
  id: string;
  follower_id: string;
  followed_id: string;
  created_at: string;
}

const supabase = getSupabase();

/**
 * Seguir um streamer
 */
export async function followStreamer(
  followerId: string,
  streamerId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (!followerId || !streamerId) {
      return { success: false, error: 'IDs são obrigatórios' };
    }

    if (followerId === streamerId) {
      return { success: false, error: 'Você não pode seguir a si mesmo' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('user_follows')
      .insert({
        follower_id: followerId,
        followed_id: streamerId
      });

    if (error) {
      // Se já está seguindo, não é um erro
      if (error.code === '23505') {
        return { success: true, error: null };
      }
      throw error;
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao seguir streamer:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro ao seguir streamer' 
    };
  }
}

/**
 * Deixar de seguir um streamer
 */
export async function unfollowStreamer(
  followerId: string,
  streamerId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (!followerId || !streamerId) {
      return { success: false, error: 'IDs são obrigatórios' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('user_follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('followed_id', streamerId);

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao deixar de seguir streamer:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro ao deixar de seguir streamer' 
    };
  }
}

/**
 * Verificar se está seguindo um streamer
 */
export async function isFollowing(
  followerId: string,
  streamerId: string
): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('user_follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('followed_id', streamerId)
      .maybeSingle();

    if (error) throw error;

    return !!data;
  } catch (error) {
    console.error('Erro ao verificar se está seguindo:', error);
    return false;
  }
}

/**
 * Listar todos os streamers (apenas com permissão de fazer live) com contagem de seguidores e apoiadores
 */
export async function getAllStreamers(currentUserId?: string): Promise<StreamerProfile[]> {
  try {
    // Buscar apenas usuários com is_admin = true (streamers)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profiles, error } = await (supabase as any)
      .from('user_profiles')
      .select(`
        user_id,
        display_name,
        avatar_url,
        email,
        referral_code,
        is_admin,
        bio,
        about
      `)
      .eq('is_admin', true)
      .order('display_name', { ascending: true });

    if (error) throw error;

    if (!profiles || profiles.length === 0) {
      return [];
    }

    // Buscar contagens de seguidores para todos os usuários
    const userIds = profiles.map((p: { user_id: string }) => p.user_id);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: followCounts } = await (supabase as any)
      .from('user_follows')
      .select('followed_id')
      .in('followed_id', userIds);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: supporterCounts } = await (supabase as any)
      .from('user_profiles')
      .select('referred_by')
      .in('referred_by', userIds)
      .not('referred_by', 'is', null);

    // Contar seguidores e apoiadores por usuário
    const followersMap = new Map<string, number>();
    const supportersMap = new Map<string, number>();

    followCounts?.forEach((f: { followed_id: string }) => {
      followersMap.set(f.followed_id, (followersMap.get(f.followed_id) || 0) + 1);
    });

    supporterCounts?.forEach((s: { referred_by: string }) => {
      supportersMap.set(s.referred_by, (supportersMap.get(s.referred_by) || 0) + 1);
    });

    // Verificar quem o usuário atual está seguindo
    let followingSet = new Set<string>();
    if (currentUserId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: following } = await (supabase as any)
        .from('user_follows')
        .select('followed_id')
        .eq('follower_id', currentUserId);

      followingSet = new Set(following?.map((f: { followed_id: string }) => f.followed_id) || []);
    }

    return profiles.map((p: { 
      user_id: string; 
      display_name: string; 
      avatar_url: string | null; 
      email: string;
      referral_code?: string;
      bio?: string | null;
      about?: string | null;
    }) => ({
      id: p.user_id,
      display_name: p.display_name || 'Usuário',
      avatar_url: p.avatar_url,
      email: p.email,
      followers_count: followersMap.get(p.user_id) || 0,
      supporters_count: supportersMap.get(p.user_id) || 0,
      referral_code: p.referral_code,
      is_following: followingSet.has(p.user_id),
      bio: p.bio,
      about: p.about,
    }));
  } catch (error) {
    console.error('Erro ao listar streamers:', error);
    return [];
  }
}

/**
 * Obter quantidade de seguidores de um streamer
 */
export async function getFollowersCount(streamerId: string): Promise<number> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (supabase as any)
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('followed_id', streamerId);

    if (error) throw error;

    return count || 0;
  } catch (error) {
    console.error('Erro ao obter contagem de seguidores:', error);
    return 0;
  }
}

/**
 * Obter quantidade de apoiadores de um streamer
 */
export async function getSupportersCount(streamerId: string): Promise<number> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (supabase as any)
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('referred_by', streamerId);

    if (error) throw error;

    return count || 0;
  } catch (error) {
    console.error('Erro ao obter contagem de apoiadores:', error);
    return 0;
  }
}
