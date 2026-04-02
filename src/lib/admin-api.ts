import { supabase, getSupabaseAdmin } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export type UserData = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  app_metadata: {
    provider?: string;
  };
  user_metadata: {
    name?: string;
    birthdate?: string;
  };
  email_confirmed_at: string | null;
};

const adminClient = () => getSupabaseAdmin() as SupabaseClient<Database>;

export const checkAdminPermission = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await (supabase as SupabaseClient<Database>)
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', userId)
      .single();
    if (error || !data) return false;
    return !!data.is_admin;
  } catch {
    return false;
  }
};

export const listUsers = async (page: number = 1, perPage: number = 10): Promise<{
  users: UserData[];
  total: number;
  error: string | null;
}> => {
  try {
    const response = await adminClient().auth.admin.listUsers({ page, perPage });
    if (response.error) throw new Error(response.error.message);

    const users = response.data.users as UserData[];
    const total = (response.data as { total?: number }).total ?? 0;
    return { users, total, error: null };
  } catch (err: unknown) {
    return {
      users: [],
      total: 0,
      error: err instanceof Error ? err.message : 'Erro ao buscar usuários'
    };
  }
};

export const createUser = async (email: string, password: string, userData: {
  name?: string;
  isAdmin?: boolean;
}): Promise<{
  user: UserData | null;
  error: string | null;
}> => {
  try {
    const admin = adminClient();
    const response = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: userData.name }
    });
    if (response.error) throw new Error(response.error.message);

    const newUser = response.data.user;

    await admin.from('user_profiles').upsert({
      user_id: newUser.id,
      email,
      display_name: userData.name || null,
      is_admin: !!userData.isAdmin,
      verified_email: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return { user: newUser as UserData, error: null };
  } catch (err: unknown) {
    return {
      user: null,
      error: err instanceof Error ? err.message : 'Erro ao criar usuário'
    };
  }
};

export const deleteUser = async (userId: string): Promise<{
  success: boolean;
  error: string | null;
}> => {
  try {
    const admin = adminClient();
    await admin.from('user_profiles').delete().eq('user_id', userId);
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { success: true, error: null };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro ao excluir usuário'
    };
  }
};

export type ProfileData = {
  is_admin: boolean;
  display_name: string | null;
};

export const getUserProfiles = async (): Promise<Record<string, ProfileData>> => {
  try {
    const { data } = await adminClient()
      .from('user_profiles')
      .select('user_id, is_admin, display_name');
    const map: Record<string, ProfileData> = {};
    (data || []).forEach((p: { user_id: string; is_admin: boolean | null; display_name: string | null }) => {
      map[p.user_id] = { is_admin: !!p.is_admin, display_name: p.display_name };
    });
    return map;
  } catch {
    return {};
  }
};

export const updateUserRole = async (userId: string, isAdmin: boolean): Promise<{
  success: boolean;
  error: string | null;
}> => {
  try {
    const { error } = await adminClient()
      .from('user_profiles')
      .update({ is_admin: isAdmin, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) throw error;
    return { success: true, error: null };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro ao atualizar role'
    };
  }
};

export const resetUserPassword = async (email: string): Promise<{
  success: boolean;
  error: string | null;
}> => {
  try {
    const { error } = await (supabase as SupabaseClient<Database>).auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
    return { success: true, error: null };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro ao enviar email'
    };
  }
};

// ── User Daily Activity ──

export const recordUserActivity = async (userId: string): Promise<void> => {
  if (!userId) return;
  try {
    const admin = adminClient();
    const today = new Date().toISOString().split('T')[0];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin as any)
      .from('user_daily_activity')
      .select('id, page_views')
      .eq('user_id', userId)
      .eq('activity_date', today)
      .single();

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('user_daily_activity')
        .update({
          page_views: (existing as { page_views: number }).page_views + 1,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', (existing as { id: string }).id);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('user_daily_activity')
        .insert({
          user_id: userId,
          activity_date: today,
          page_views: 1,
          last_seen_at: new Date().toISOString(),
        });
    }
  } catch (err) {
    console.error('Erro ao registrar atividade:', err);
  }
};

// ── Click Events (tabela criada via MCP Supabase) ──

async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await (supabase as SupabaseClient<Database>).auth.getSession();
    return data.session?.user?.id || null;
  } catch {
    return null;
  }
}

export const saveClickEvent = async (eventType: string): Promise<void> => {
  try {
    const admin = adminClient();
    const today = new Date().toISOString().split('T')[0];
    const userId = await getCurrentUserId();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (admin as any)
      .from('admin_click_events')
      .select('id, click_count')
      .eq('event_type', eventType)
      .eq('event_date', today);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.is('user_id', null);
    }

    const { data: existing } = await query.single();

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('admin_click_events')
        .update({
          click_count: (existing as { click_count: number }).click_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', (existing as { id: string }).id);
    } else {
      const insertData: Record<string, unknown> = {
        event_type: eventType,
        click_count: 1,
        event_date: today,
      };
      if (userId) insertData.user_id = userId;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('admin_click_events')
        .insert(insertData);
    }
  } catch (err) {
    console.error('Erro ao salvar click event:', err);
  }
};

export type ClickMetrics = {
  dashboard: number;
  trades: number;
  instructions: number;
  total: number;
  byDay: { date: string; dashboard: number; trades: number; instructions: number; total: number }[];
};

export const getClickMetrics = async (
  startDate: string,
  endDate: string
): Promise<ClickMetrics> => {
  const fallback: ClickMetrics = { dashboard: 0, trades: 0, instructions: 0, total: 0, byDay: [] };

  try {
    const admin = adminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from('admin_click_events')
      .select('event_type, click_count, event_date')
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .order('event_date', { ascending: true });

    if (error || !data) return fallback;

    let dashboard = 0;
    let trades = 0;
    let instructions = 0;
    const dayMap: Record<string, { dashboard: number; trades: number; instructions: number }> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any[]).forEach((row: any) => {
      const count = Number(row.click_count) || 0;
      if (row.event_type === 'dashboard') dashboard += count;
      else if (row.event_type === 'trades') trades += count;
      else if (row.event_type === 'instructions') instructions += count;

      if (!dayMap[row.event_date]) dayMap[row.event_date] = { dashboard: 0, trades: 0, instructions: 0 };
      if (row.event_type === 'dashboard') dayMap[row.event_date].dashboard += count;
      else if (row.event_type === 'trades') dayMap[row.event_date].trades += count;
      else if (row.event_type === 'instructions') dayMap[row.event_date].instructions += count;
    });

    const byDay = Object.entries(dayMap).map(([date, counts]) => ({
      date,
      ...counts,
      total: counts.dashboard + counts.trades + counts.instructions,
    }));
    return { dashboard, trades, instructions, total: dashboard + trades + instructions, byDay };
  } catch {
    return fallback;
  }
};

// ── Admin Aggregated Metrics (dados de TODOS os membros) ──

export type AdminDashboardMetrics = {
  totalUsers: number;
  onlineNow: number;
  activeByDay: { date: string; count: number }[];
  signupsByDay: { date: string; count: number }[];
};

export const getAdminDashboardMetrics = async (
  startDate: string,
  endDate: string
): Promise<AdminDashboardMetrics> => {
  const fallback: AdminDashboardMetrics = {
    totalUsers: 0,
    onlineNow: 0,
    activeByDay: [],
    signupsByDay: [],
  };

  try {
    const admin = adminClient();

    // Total de usuários via auth admin
    const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    const totalUsers = (authData as { total?: number })?.total ?? 0;

    // Calcular usuários online (últimos 15 minutos)
    const ONLINE_THRESHOLD_MS = 15 * 60 * 1000;
    const onlineThreshold = new Date(Date.now() - ONLINE_THRESHOLD_MS).toISOString();
    
    // Buscar todos os usuários para contar online
    let onlineCount = 0;
    let page = 1;
    const perPage = 100;
    let hasMore = true;
    while (hasMore) {
      const response = await admin.auth.admin.listUsers({ page, perPage });
      if (response.error) break;
      const batch = (response.data.users || []) as UserData[];
      
      // Contar quantos estão online
      batch.forEach(u => {
        if (u.last_sign_in_at && u.last_sign_in_at >= onlineThreshold) {
          onlineCount++;
        }
      });
      
      const batchTotal = (response.data as { total?: number }).total ?? 0;
      hasMore = batch.length + (page - 1) * perPage < batchTotal;
      page++;
      if (page > 50) break; // Limite de segurança
    }

    const onlineNow = onlineCount;

    // Atividade diária (user_daily_activity) - dados de TODOS os membros
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: activityData } = await (admin as any)
      .from('user_daily_activity')
      .select('activity_date, user_id')
      .gte('activity_date', startDate)
      .lte('activity_date', endDate)
      .order('activity_date', { ascending: true });

    const activityByDay: Record<string, Set<string>> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((activityData as any[]) || []).forEach((row: any) => {
      if (!activityByDay[row.activity_date]) activityByDay[row.activity_date] = new Set();
      activityByDay[row.activity_date].add(row.user_id);
    });

    const activeByDay = Object.entries(activityByDay).map(([date, users]) => ({
      date,
      count: users.size,
    }));

    // Novos cadastros por dia - buscar TODOS os usuários do período
    let allUsers: UserData[] = [];
    let signupPage = 1;
    const signupPerPage = 100;
    let hasMoreSignups = true;
    while (hasMoreSignups) {
      const response = await admin.auth.admin.listUsers({ page: signupPage, perPage: signupPerPage });
      if (response.error) break;
      const batch = (response.data.users || []) as UserData[];
      allUsers = allUsers.concat(batch);
      const batchTotal = (response.data as { total?: number }).total ?? 0;
      hasMoreSignups = allUsers.length < batchTotal;
      signupPage++;
      if (signupPage > 50) break;
    }

    const signupsMap: Record<string, number> = {};
    allUsers.forEach(u => {
      const signupDate = u.created_at.split('T')[0];
      if (signupDate >= startDate && signupDate <= endDate) {
        signupsMap[signupDate] = (signupsMap[signupDate] || 0) + 1;
      }
    });

    const signupsByDay = Object.entries(signupsMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { totalUsers, onlineNow, activeByDay, signupsByDay };
  } catch (err) {
    console.error('Erro ao buscar métricas do admin:', err);
    return fallback;
  }
};

// ── Supporter Codes (tabela criada via MCP Supabase) ──

export type SupporterCode = {
  id: string;
  code: string;
  link: string;
  description: string | null;
  special_message: string | null;
  display_name: string | null;
  broker_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_id: string | null;
};

export const listSupporterCodes = async (): Promise<SupporterCode[]> => {
  try {
    const admin = adminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from('supporter_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as SupporterCode[];
  } catch {
    return [];
  }
};

export const addSupporterCode = async (
  code: string, link: string, description?: string, specialMessage?: string, displayName?: string, brokerName?: string, userId?: string | null
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const admin = adminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from('supporter_codes')
      .insert({
        code: code.toUpperCase().trim(),
        link: link.trim(),
        description: description?.trim() || null,
        special_message: specialMessage?.trim() || null,
        display_name: displayName?.trim() || null,
        broker_name: brokerName || 'AVALON',
        is_active: true,
        user_id: userId || null,
      });

    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao criar código' };
  }
};

export const updateSupporterCode = async (
  id: string,
  updates: { code?: string; link?: string; description?: string; special_message?: string; display_name?: string; broker_name?: string; is_active?: boolean; user_id?: string | null }
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const admin = adminClient();
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.code !== undefined) payload.code = updates.code.toUpperCase().trim();
    if (updates.link !== undefined) payload.link = updates.link.trim();
    if (updates.description !== undefined) payload.description = updates.description.trim() || null;
    if (updates.special_message !== undefined) payload.special_message = updates.special_message.trim() || null;
    if (updates.display_name !== undefined) payload.display_name = updates.display_name.trim() || null;
    if (updates.broker_name !== undefined) payload.broker_name = updates.broker_name;
    if (updates.is_active !== undefined) payload.is_active = updates.is_active;
    if (updates.user_id !== undefined) payload.user_id = updates.user_id || null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from('supporter_codes')
      .update(payload)
      .eq('id', id);

    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao atualizar' };
  }
};

export const deleteSupporterCode = async (id: string): Promise<{
  success: boolean; error: string | null;
}> => {
  try {
    const admin = adminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from('supporter_codes')
      .delete()
      .eq('id', id);

    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao remover' };
  }
};

export const validateSupporterCode = async (code: string): Promise<{
  valid: boolean;
  link: string | null;
  description: string | null;
  special_message: string | null;
  display_name: string | null;
}> => {
  const invalid = { valid: false, link: null, description: null, special_message: null, display_name: null };
  if (!code || !code.trim()) return invalid;

  try {
    const admin = adminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from('supporter_codes')
      .select('link, description, special_message, display_name, is_active')
      .eq('code', code.toUpperCase().trim())
      .eq('is_active', true)
      .single();

    if (error || !data) return invalid;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any;
    return { valid: true, link: row.link, description: row.description, special_message: row.special_message, display_name: row.display_name };
  } catch {
    return invalid;
  }
};

// Registrar uso de código de apoiador
export const registerSupporterCodeUsage = async (code: string): Promise<{ success: boolean; error: string | null }> => {
  if (!code || !code.trim()) return { success: false, error: 'Código inválido' };

  try {
    // Buscar o usuário atual primeiro
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    if (!userId) {
      console.log('❌ Usuário não autenticado, não pode registrar código');
      return { success: false, error: 'Usuário não autenticado' };
    }

    // Buscar o código e o trader_id usando client normal
    const { data: codeData, error: codeError } = await (supabase as SupabaseClient<Database>)
      .from('supporter_codes')
      .select('id, user_id')
      .eq('code', code.toUpperCase().trim())
      .eq('is_active', true)
      .maybeSingle();

    if (codeError || !codeData) {
      console.error('❌ Código não encontrado:', code, codeError);
      return { success: false, error: 'Código não encontrado' };
    }

    console.log('✅ Registrando uso do código:', {
      code,
      code_id: codeData.id,
      user_id: userId,
      trader_id: codeData.user_id
    });

    // Registrar o uso (com upsert para evitar duplicatas)
    const { error: insertError } = await (supabase as SupabaseClient<Database>)
      .from('supporter_code_usage')
      .upsert({
        code_id: codeData.id,
        user_id: userId,
        trader_id: codeData.user_id,
        used_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,code_id',
        ignoreDuplicates: false // Atualizar o used_at se já existir
      });

    if (insertError) {
      console.error('❌ Erro ao registrar uso:', insertError);
      return { success: false, error: insertError.message };
    }

    console.log('✅ Uso do código registrado com sucesso!');
    return { success: true, error: null };
  } catch (err) {
    console.error('❌ Erro inesperado ao registrar uso:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao registrar uso' };
  }
};
