import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import Layout from '@/components/Layout';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, RefreshCw, Trash2, Plus, Search, Users,
  Eye, Mail, MousePointerClick, Wifi, ChevronLeft, ChevronRight,
  MoreHorizontal, KeyRound, ShieldCheck, CalendarDays, Heart, Pencil, Power,
  Crown, Zap,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  checkAdminPermission, createUser, deleteUser, listUsers,
  resetUserPassword, getUserProfiles, updateUserRole, getClickMetrics,
  getAdminDashboardMetrics,
  listSupporterCodes, addSupporterCode, updateSupporterCode, deleteSupporterCode,
} from '@/lib/admin-api';
import type { UserData, ProfileData, ClickMetrics, AdminDashboardMetrics, SupporterCode } from '@/lib/admin-api';
import * as privilegedService from '@/services/privilegedService';
import type { PrivilegedStreamer } from '@/services/privilegedService';

const ONLINE_THRESHOLD_MS = 15 * 60 * 1000;

function isUserOnline(profile: ProfileData | undefined, lastSignIn: string | null): boolean {
  // Usar apenas lastSignIn do auth já que last_login_at não existe em user_profiles
  if (!lastSignIn) return false;
  return Date.now() - new Date(lastSignIn).getTime() < ONLINE_THRESHOLD_MS;
}

export default function Admin() {
  const { user } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const itemsPerPage = 10;

  const [profiles, setProfiles] = useState<Record<string, ProfileData>>({});
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', isAdmin: false });
  const [saving, setSaving] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [periodPreset, setPeriodPreset] = useState<string>('14');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [clickMetrics, setClickMetrics] = useState<ClickMetrics>({ dashboard: 0, trades: 0, instructions: 0, total: 0, byDay: [] });
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [dashMetrics, setDashMetrics] = useState<AdminDashboardMetrics>({ totalUsers: 0, onlineNow: 0, activeByDay: [], signupsByDay: [] });
  const [dashMetricsLoading, setDashMetricsLoading] = useState(false);
  const [cardsPeriod, setCardsPeriod] = useState<string>('14');

  const [supporterCodes, setSupporterCodes] = useState<SupporterCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [isCodeDialogOpen, setIsCodeDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<SupporterCode | null>(null);
  const [codeForm, setCodeForm] = useState({ code: '', link: '', description: '', special_message: '', display_name: '', broker_name: 'AVALON', user_id: '', user_email: '' });
  const [codeSaving, setCodeSaving] = useState(false);
  const [searchingUser, setSearchingUser] = useState(false);
  const [userSuggestions, setUserSuggestions] = useState<Array<{ user_id: string; display_name: string; email: string }>>([]);
  const [codeUsersMap, setCodeUsersMap] = useState<Record<string, string>>({});

  // Privileged Streamers
  const [privilegedStreamers, setPrivilegedStreamers] = useState<PrivilegedStreamer[]>([]);
  const [privilegedLoading, setPrivilegedLoading] = useState(false);
  const [isPrivilegedDialogOpen, setIsPrivilegedDialogOpen] = useState(false);
  const [editingPrivileged, setEditingPrivileged] = useState<PrivilegedStreamer | null>(null);
  const [privilegedForm, setPrivilegedForm] = useState({
    userId: '',
    notes: '',
    permissions: {
      poll_control: false,
      likes_boost: false,
      views_boost: false,
      followers_boost: false,
      supporters_boost: false,
    },
  });
  const [privilegedSaving, setPrivilegedSaving] = useState(false);

  useEffect(() => {
    if (!user) { setIsAuthorized(false); return; }
    checkAdminPermission(user.id).then(setIsAuthorized);
  }, [user]);

  const fetchUsers = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    setError(null);
    try {
      const [result, profs] = await Promise.all([
        listUsers(currentPage, itemsPerPage),
        getUserProfiles(),
      ]);
      if (result.error) throw new Error(result.error);
      setUsers(result.users);
      setTotalUsers(result.total);
      setProfiles(profs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, currentPage]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Range dos cards de métricas (topo)
  const cardsDateRange = useMemo(() => {
    const days = parseInt(cardsPeriod) || 14;
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
  }, [cardsPeriod]);

  const cardsDays = parseInt(cardsPeriod) || 14;

  // Range dos gráficos de atividade (abaixo)
  const dateRange = useMemo(() => {
    if (periodPreset === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    const days = parseInt(periodPreset) || 14;
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
  }, [periodPreset, customFrom, customTo]);

  const chartDays = useMemo(() => {
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }, [dateRange]);

  // Buscar métricas dos cards
  useEffect(() => {
    if (!isAuthorized) return;
    setMetricsLoading(true);
    getClickMetrics(cardsDateRange.from, cardsDateRange.to)
      .then(setClickMetrics)
      .finally(() => setMetricsLoading(false));
  }, [isAuthorized, cardsDateRange]);

  // Buscar métricas dos gráficos
  useEffect(() => {
    if (!isAuthorized) return;
    setDashMetricsLoading(true);
    getAdminDashboardMetrics(dateRange.from, dateRange.to)
      .then(setDashMetrics)
      .finally(() => setDashMetricsLoading(false));
  }, [isAuthorized, dateRange]);

  const totalPages = Math.max(1, Math.ceil(totalUsers / itemsPerPage));

  const filteredUsers = useMemo(() =>
    users.filter(u =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.user_metadata?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    ), [users, searchTerm]);

  const onlineCount = dashMetrics.onlineNow;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.password) { toast.error('Preencha email e senha'); return; }
    setSaving(true);
    try {
      const result = await createUser(newUser.email, newUser.password, {
        name: newUser.name,
        isAdmin: newUser.isAdmin,
      });
      if (result.error) throw new Error(result.error);
      toast.success('Membro adicionado');
      if (result.user) {
        setUsers(prev => [result.user as UserData, ...prev]);
        setProfiles(prev => ({
          ...prev,
          [result.user!.id]: { is_admin: newUser.isAdmin, display_name: newUser.name || null, last_login_at: null },
        }));
      }
      setNewUser({ email: '', password: '', name: '', isAdmin: false });
      setIsAddOpen(false);
      setTotalUsers(prev => prev + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Tem certeza que deseja remover este membro?')) return;
    try {
      const result = await deleteUser(userId);
      if (result.error) throw new Error(result.error);
      toast.success('Membro removido');
      setUsers(prev => prev.filter(u => u.id !== userId));
      setTotalUsers(prev => Math.max(0, prev - 1));
      setIsDetailOpen(false);
      setActionMenuId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover');
    }
  };

  const handleToggleRole = async (userId: string) => {
    const current = profiles[userId]?.is_admin ?? false;
    const newRole = !current;
    try {
      const result = await updateUserRole(userId, newRole);
      if (result.error) throw new Error(result.error);
      setProfiles(prev => ({
        ...prev,
        [userId]: { ...prev[userId], is_admin: newRole },
      }));
      toast.success(newRole ? 'Promovido a administrador' : 'Alterado para padrão');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar role');
    }
  };

  const handleResetPw = async (email: string) => {
    try {
      const result = await resetUserPassword(email);
      if (result.error) throw new Error(result.error);
      toast.success('Email de redefinição enviado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  };

  // ── Supporter Codes ──
  const fetchSupporterCodes = useCallback(async () => {
    if (!isAuthorized) return;
    setCodesLoading(true);
    try {
      const codes = await listSupporterCodes();
      setSupporterCodes(codes);
      
      // Buscar nomes dos usuários associados
      const userIds = codes.filter(c => c.user_id).map(c => c.user_id);
      if (userIds.length > 0) {
        const { data } = await supabase
          .from('user_profiles')
          .select('user_id, display_name, email')
          .in('user_id', userIds);
        
        if (data) {
          const usersMap: Record<string, string> = {};
          data.forEach((user: any) => {
            usersMap[user.user_id] = user.display_name || user.email;
          });
          setCodeUsersMap(usersMap);
        }
      }
    } catch { /* ignore */ } finally {
      setCodesLoading(false);
    }
  }, [isAuthorized]);

  useEffect(() => { fetchSupporterCodes(); }, [fetchSupporterCodes]);

  const handleSaveCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeForm.code || !codeForm.link) { toast.error('Código e link são obrigatórios'); return; }
    setCodeSaving(true);
    try {
      if (editingCode) {
        const r = await updateSupporterCode(editingCode.id, {
          ...codeForm,
          user_id: codeForm.user_id || null
        });
        if (r.error) throw new Error(r.error);
        toast.success('Código atualizado');
      } else {
        const r = await addSupporterCode(
          codeForm.code, 
          codeForm.link, 
          codeForm.description, 
          codeForm.special_message, 
          codeForm.display_name, 
          codeForm.broker_name,
          codeForm.user_id || null
        );
        if (r.error) throw new Error(r.error);
        toast.success('Código adicionado');
      }
      setIsCodeDialogOpen(false);
      setEditingCode(null);
      setCodeForm({ code: '', link: '', description: '', special_message: '', display_name: '', broker_name: 'AVALON', user_id: '', user_email: '' });
      fetchSupporterCodes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    } finally {
      setCodeSaving(false);
    }
  };

  const handleDeleteCode = async (id: string) => {
    if (!confirm('Remover este código de apoiador?')) return;
    try {
      const r = await deleteSupporterCode(id);
      if (r.error) throw new Error(r.error);
      toast.success('Código removido');
      setSupporterCodes(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  };

  const handleToggleCodeActive = async (sc: SupporterCode) => {
    try {
      const r = await updateSupporterCode(sc.id, { is_active: !sc.is_active });
      if (r.error) throw new Error(r.error);
      setSupporterCodes(prev => prev.map(c => c.id === sc.id ? { ...c, is_active: !c.is_active } : c));
      toast.success(sc.is_active ? 'Código desativado' : 'Código ativado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  };

  // ── Privileged Streamers ──
  const fetchPrivilegedStreamers = useCallback(async () => {
    if (!isAuthorized) return;
    setPrivilegedLoading(true);
    try {
      const result = await privilegedService.listPrivilegedStreamers();
      if (result.success && result.streamers) {
        setPrivilegedStreamers(result.streamers);
      }
    } catch { /* ignore */ } finally {
      setPrivilegedLoading(false);
    }
  }, [isAuthorized]);

  useEffect(() => { fetchPrivilegedStreamers(); }, [fetchPrivilegedStreamers]);

  const handleSavePrivileged = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privilegedForm.userId) { toast.error('Selecione um streamer'); return; }
    setPrivilegedSaving(true);
    try {
      if (editingPrivileged) {
        // Atualizar permissões
        const r = await privilegedService.updatePrivilegedPermissions(
          editingPrivileged.id,
          privilegedForm.permissions
        );
        if (r.error) throw new Error(r.error);
        toast.success('Permissões atualizadas');
      } else {
        // Adicionar novo
        const enabledPerms = Object.entries(privilegedForm.permissions)
          .filter(([_, enabled]) => enabled)
          .map(([perm]) => perm);
        
        const r = await privilegedService.addPrivilegedStreamer(
          privilegedForm.userId,
          user!.id,
          enabledPerms,
          privilegedForm.notes
        );
        if (r.error) throw new Error(r.error);
        toast.success('Streamer privilegiado adicionado');
      }
      setIsPrivilegedDialogOpen(false);
      setEditingPrivileged(null);
      setPrivilegedForm({
        userId: '',
        notes: '',
        permissions: {
          poll_control: false,
          likes_boost: false,
          views_boost: false,
          followers_boost: false,
          supporters_boost: false,
        },
      });
      fetchPrivilegedStreamers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    } finally {
      setPrivilegedSaving(false);
    }
  };

  const handleDeletePrivileged = async (id: string) => {
    if (!confirm('Remover privilégios deste streamer?')) return;
    try {
      const r = await privilegedService.removePrivilegedStreamer(id);
      if (r.error) throw new Error(r.error);
      toast.success('Privilégios removidos');
      setPrivilegedStreamers(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });

  const activityData = useMemo(() => {
    const activityMap: Record<string, number> = {};
    dashMetrics.activeByDay.forEach(d => { activityMap[d.date] = d.count; });

    const days: { date: string; label: string; ativos: number }[] = [];
    const start = new Date(dateRange.from);
    const end = new Date(dateRange.to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      days.push({ date: dayStr, label, ativos: activityMap[dayStr] || 0 });
    }
    return days;
  }, [dashMetrics.activeByDay, dateRange]);

  const signupData = useMemo(() => {
    const signupMap: Record<string, number> = {};
    dashMetrics.signupsByDay.forEach(d => { signupMap[d.date] = d.count; });

    const days: { date: string; label: string; novos: number }[] = [];
    const start = new Date(dateRange.from);
    const end = new Date(dateRange.to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      days.push({ date: dayStr, label, novos: signupMap[dayStr] || 0 });
    }
    return days;
  }, [dashMetrics.signupsByDay, dateRange]);

  if (isAuthorized === null) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-5 w-5 animate-spin text-white/20" />
        </div>
      </Layout>
    );
  }

  if (!isAuthorized) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
          <div className="h-12 w-12 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
            <Users className="h-5 w-5 text-white/20" />
          </div>
          <p className="text-white/30 text-sm">Acesso restrito a administradores</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5 lg:space-y-6 2xl:space-y-8 w-full max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl 2xl:text-2xl font-medium text-white/90 tracking-tight">Administração</h1>
            <p className="text-white/30 text-xs 2xl:text-sm mt-0.5">Gestão de membros e métricas</p>
          </div>
          <button
            onClick={() => setIsAddOpen(true)}
            className="h-8 px-3 rounded-md bg-white/[0.05] hover:bg-white/[0.08] text-white/60 hover:text-white/80 text-xs font-medium transition-all flex items-center gap-1.5"
          >
            <Plus className="h-3 w-3" />
            Adicionar
          </button>
        </div>

        {/* Period selector for metric cards */}
        <div className="flex items-center gap-1.5 bg-white/[0.02] rounded-lg p-0.5 w-fit">
          {[
            { label: '7d', value: '7' },
            { label: '14d', value: '14' },
            { label: '30d', value: '30' },
            { label: '60d', value: '60' },
            { label: '90d', value: '90' },
          ].map(p => (
            <button
              key={p.value}
              onClick={() => setCardsPeriod(p.value)}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                cardsPeriod === p.value
                  ? 'bg-white/[0.07] text-white/60'
                  : 'text-white/20 hover:text-white/35'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 2xl:gap-5">
          <div className="bg-black/20 backdrop-blur-md rounded-xl border border-white/[0.04] p-4 lg:p-5 2xl:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-3.5 w-3.5 text-white/20 2xl:h-4 2xl:w-4" />
              <span className="text-white/30 text-[10px] 2xl:text-[11px] font-medium tracking-wider uppercase">Membros</span>
            </div>
            <p className="text-[26px] lg:text-[28px] 2xl:text-[34px] font-light text-white/80 tracking-tight leading-none">{dashMetricsLoading ? '...' : dashMetrics.totalUsers || totalUsers}</p>
            <p className="text-white/15 text-[9px] 2xl:text-[10px] mt-1.5">total</p>
          </div>

          <div className="bg-black/20 backdrop-blur-md rounded-xl border border-white/[0.04] p-4 lg:p-5 2xl:p-6">
            <div className="flex items-center gap-2 mb-3">
              <MousePointerClick className="h-3.5 w-3.5 text-white/20 2xl:h-4 2xl:w-4" />
              <span className="text-white/30 text-[10px] 2xl:text-[11px] font-medium tracking-wider uppercase">Cliques Dashboard</span>
            </div>
            <p className="text-[26px] lg:text-[28px] 2xl:text-[34px] font-light text-white/80 tracking-tight leading-none">{metricsLoading ? '...' : clickMetrics.dashboard}</p>
            <p className="text-white/15 text-[9px] 2xl:text-[10px] mt-1.5">últimos {cardsDays}d</p>
          </div>

          <div className="bg-black/20 backdrop-blur-md rounded-xl border border-white/[0.04] p-4 lg:p-5 2xl:p-6">
            <div className="flex items-center gap-2 mb-3">
              <MousePointerClick className="h-3.5 w-3.5 text-white/20 2xl:h-4 2xl:w-4" />
              <span className="text-white/30 text-[10px] 2xl:text-[11px] font-medium tracking-wider uppercase">Cliques Trades</span>
            </div>
            <p className="text-[26px] lg:text-[28px] 2xl:text-[34px] font-light text-white/80 tracking-tight leading-none">{metricsLoading ? '...' : clickMetrics.trades}</p>
            <p className="text-white/15 text-[9px] 2xl:text-[10px] mt-1.5">últimos {cardsDays}d</p>
          </div>

          <div className="bg-black/20 backdrop-blur-md rounded-xl border border-white/[0.04] p-4 lg:p-5 2xl:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Wifi className="h-3.5 w-3.5 text-white/20 2xl:h-4 2xl:w-4" />
              <span className="text-white/30 text-[10px] 2xl:text-[11px] font-medium tracking-wider uppercase">Online agora</span>
            </div>
            <p className="text-[26px] lg:text-[28px] 2xl:text-[34px] font-light text-white/80 tracking-tight leading-none">{dashMetricsLoading ? '...' : onlineCount}</p>
            <p className="text-white/15 text-[9px] 2xl:text-[10px] mt-1.5">todos os membros</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/15" />
            <Input
              placeholder="Buscar membro..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-9 2xl:h-10 bg-black/20 border-white/[0.04] text-white text-sm 2xl:text-base placeholder:text-white/15 focus:border-white/10 rounded-lg"
            />
          </div>
          <button
            onClick={fetchUsers}
            aria-label="Atualizar lista de membros"
            className="h-9 w-9 2xl:h-10 2xl:w-10 flex items-center justify-center rounded-lg text-white/20 hover:text-white/50 hover:bg-white/[0.03] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Members Table */}
        <div className="bg-black/20 backdrop-blur-md rounded-xl border border-white/[0.04] overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-white/15" />
            </div>
          ) : error ? (
            <div className="py-16 text-center space-y-3">
              <p className="text-white/30 text-sm">{error}</p>
              <button onClick={fetchUsers} className="text-white/30 hover:text-white/50 text-xs transition-colors">
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr,60px] sm:grid-cols-[1fr,80px,130px,90px,50px] lg:grid-cols-[1fr,90px,150px,100px,60px] 2xl:grid-cols-[1fr,110px,180px,120px,70px] px-5 lg:px-6 2xl:px-8 py-3 border-b border-white/[0.04] min-w-[320px]">
                <span className="text-white/20 text-[10px] 2xl:text-[11px] font-medium uppercase tracking-wider">Membro</span>
                <span className="text-white/20 text-[10px] 2xl:text-[11px] font-medium uppercase tracking-wider hidden sm:block">Role</span>
                <span className="text-white/20 text-[10px] 2xl:text-[11px] font-medium uppercase tracking-wider hidden sm:block">Cadastro</span>
                <span className="text-white/20 text-[10px] 2xl:text-[11px] font-medium uppercase tracking-wider hidden sm:block">Status</span>
                <span />
              </div>

              {filteredUsers.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-white/15 text-sm">{searchTerm ? 'Nenhum resultado' : 'Nenhum membro'}</p>
                </div>
              ) : (
                <div className="max-h-[420px] 2xl:max-h-[520px] overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-white/[0.06] scrollbar-track-transparent">
                <div className="divide-y divide-white/[0.025]">
                  {filteredUsers.map(u => {
                    const profile = profiles[u.id];
                    const isAdmin = profile?.is_admin ?? false;
                    const online = isUserOnline(profile, u.last_sign_in_at);
                    return (
                      <div
                        key={u.id}
                        className="grid grid-cols-[1fr,60px] sm:grid-cols-[1fr,80px,130px,90px,50px] lg:grid-cols-[1fr,90px,150px,100px,60px] 2xl:grid-cols-[1fr,110px,180px,120px,70px] px-5 lg:px-6 2xl:px-8 py-3 2xl:py-4 items-center hover:bg-white/[0.01] transition-colors min-w-[320px]"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 2xl:w-2 2xl:h-2 rounded-full shrink-0 ${online ? 'bg-emerald-400/70' : 'bg-white/[0.08]'}`} />
                            <p className="text-white/60 text-sm 2xl:text-[15px] truncate">{u.email}</p>
                          </div>
                          {(u.user_metadata?.name || profile?.display_name) && (
                            <p className="text-white/20 text-[11px] 2xl:text-xs truncate ml-3.5 mt-0.5">{u.user_metadata?.name || profile?.display_name}</p>
                          )}
                        </div>

                        <div className="hidden sm:block">
                          <span className={`text-[10px] 2xl:text-[12px] ${isAdmin ? 'text-white/40' : 'text-white/15'}`}>
                            {isAdmin ? 'Admin' : 'Padrão'}
                          </span>
                        </div>

                        <span className="text-white/20 text-[11px] 2xl:text-xs hidden sm:block">{formatDate(u.created_at)}</span>

                        <div className="hidden sm:block">
                          <span className={`text-[10px] 2xl:text-[12px] ${online ? 'text-emerald-400/60' : 'text-white/15'}`}>
                            {online ? 'Online' : 'Offline'}
                          </span>
                        </div>

                        {/* Mobile: show online dot + actions */}
                        <div className="flex justify-end relative">
                          <button
                            onClick={() => setActionMenuId(actionMenuId === u.id ? null : u.id)}
                            aria-label="Abrir menu de ações"
                            className="h-7 w-7 flex items-center justify-center rounded-md text-white/15 hover:text-white/40 hover:bg-white/[0.03] transition-colors"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                          {actionMenuId === u.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setActionMenuId(null)} />
                              <div className="absolute right-0 top-8 z-50 bg-[#0a0a0c] border border-white/[0.05] rounded-lg shadow-2xl shadow-black/80 py-1 min-w-[160px]">
                                <button
                                  onClick={() => { setSelectedUser(u); setIsDetailOpen(true); setActionMenuId(null); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] text-white/40 hover:text-white/70 hover:bg-white/[0.03] transition-colors"
                                >
                                  <Eye className="h-3 w-3" /> Detalhes
                                </button>
                                <button
                                  onClick={() => { handleToggleRole(u.id); setActionMenuId(null); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] text-white/40 hover:text-white/70 hover:bg-white/[0.03] transition-colors"
                                >
                                  <ShieldCheck className="h-3 w-3" /> {isAdmin ? 'Tornar padrão' : 'Tornar admin'}
                                </button>
                                <button
                                  onClick={() => { handleResetPw(u.email); setActionMenuId(null); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] text-white/40 hover:text-white/70 hover:bg-white/[0.03] transition-colors"
                                >
                                  <KeyRound className="h-3 w-3" /> Redefinir senha
                                </button>
                                <div className="h-px bg-white/[0.03] my-1" />
                                <button
                                  onClick={() => { handleDelete(u.id); setActionMenuId(null); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] text-white/20 hover:text-red-400/60 hover:bg-white/[0.02] transition-colors"
                                >
                                  <Trash2 className="h-3 w-3" /> Remover
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-white/15 text-[11px]">{currentPage} / {totalPages}</span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                aria-label="Página anterior"
                className="h-7 w-7 flex items-center justify-center rounded-md text-white/20 hover:text-white/40 hover:bg-white/[0.03] disabled:opacity-20 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                aria-label="Próxima página"
                className="h-7 w-7 flex items-center justify-center rounded-md text-white/20 hover:text-white/40 hover:bg-white/[0.03] disabled:opacity-20 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Analytics ── */}
        {!loading && (
          <div className="space-y-4 pt-2">
            {/* Period selector */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-white/40 text-[13px] font-medium">Atividade</p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-white/[0.02] rounded-lg p-0.5">
                  {[
                    { label: '7d', value: '7' },
                    { label: '14d', value: '14' },
                    { label: '30d', value: '30' },
                    { label: '60d', value: '60' },
                    { label: '90d', value: '90' },
                  ].map(p => (
                    <button
                      key={p.value}
                      onClick={() => setPeriodPreset(p.value)}
                      className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                        periodPreset === p.value
                          ? 'bg-white/[0.07] text-white/60'
                          : 'text-white/20 hover:text-white/35'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setPeriodPreset('custom');
                      if (!customFrom || !customTo) {
                        const to = new Date();
                        const from = new Date();
                        from.setDate(from.getDate() - 14);
                        setCustomFrom(from.toISOString().split('T')[0]);
                        setCustomTo(to.toISOString().split('T')[0]);
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 ${
                      periodPreset === 'custom'
                        ? 'bg-white/[0.07] text-white/60'
                        : 'text-white/20 hover:text-white/35'
                    }`}
                  >
                    <CalendarDays className="h-3 w-3" />
                    Personalizado
                  </button>
                </div>
                {periodPreset === 'custom' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customFrom}
                      onChange={e => setCustomFrom(e.target.value)}
                      aria-label="Data inicial"
                      className="h-7 px-2 rounded-md bg-black/40 border border-white/[0.06] text-white/60 text-[11px] outline-none focus:border-white/[0.15] transition-colors [color-scheme:dark]"
                    />
                    <span className="text-white/20 text-[10px]">até</span>
                    <input
                      type="date"
                      value={customTo}
                      onChange={e => setCustomTo(e.target.value)}
                      aria-label="Data final"
                      className="h-7 px-2 rounded-md bg-black/40 border border-white/[0.06] text-white/60 text-[11px] outline-none focus:border-white/[0.15] transition-colors [color-scheme:dark]"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 2xl:gap-5">
              {/* Active users chart */}
              <div className="bg-black rounded-xl border border-white/[0.04] p-4 sm:p-6 2xl:p-8 pb-4">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-white/60 text-sm 2xl:text-base font-medium">Usuários ativos</p>
                    <p className="text-white/20 text-[11px] 2xl:text-xs mt-0.5">{periodPreset === 'custom' ? `${dateRange.from} — ${dateRange.to}` : `Últimos ${chartDays} dias`}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-white/70 text-xl 2xl:text-2xl font-light">{onlineCount}</span>
                    <p className="text-white/20 text-[10px] 2xl:text-[11px]">online agora</p>
                  </div>
                </div>
                <div className="h-[180px] sm:h-[200px] xl:h-[240px] 2xl:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                          <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="label"
                        tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.04)' }}
                        tickLine={false}
                        interval={chartDays <= 14 ? 1 : chartDays <= 30 ? 3 : 7}
                      />
                      <YAxis
                        tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                        width={30}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0a0a0c',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '10px',
                          fontSize: '12px',
                          padding: '10px 14px',
                          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
                        }}
                        itemStyle={{ color: 'rgba(255,255,255,0.7)' }}
                        labelStyle={{ color: 'rgba(255,255,255,0.35)', marginBottom: 6, fontSize: '11px' }}
                        cursor={{ stroke: 'rgba(255,255,255,0.06)' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="ativos"
                        name="Ativos"
                        stroke="rgba(255,255,255,0.35)"
                        strokeWidth={2}
                        fill="url(#activeGrad)"
                        dot={chartDays <= 14 ? { r: 2.5, fill: 'rgba(255,255,255,0.3)', stroke: 'none' } : false}
                        activeDot={{ r: 4, fill: '#fff', strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* New signups chart */}
              <div className="bg-black rounded-xl border border-white/[0.04] p-4 sm:p-6 2xl:p-8 pb-4">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-white/60 text-sm 2xl:text-base font-medium">Novos membros</p>
                    <p className="text-white/20 text-[11px] 2xl:text-xs mt-0.5">{periodPreset === 'custom' ? `${dateRange.from} — ${dateRange.to}` : `Últimos ${chartDays} dias`}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-white/70 text-xl 2xl:text-2xl font-light">{dashMetrics.totalUsers || totalUsers}</span>
                    <p className="text-white/20 text-[10px] 2xl:text-[11px]">total</p>
                  </div>
                </div>
                <div className="h-[180px] sm:h-[200px] xl:h-[240px] 2xl:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={signupData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(52,211,153,0.2)" />
                          <stop offset="100%" stopColor="rgba(52,211,153,0.01)" />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="label"
                        tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.04)' }}
                        tickLine={false}
                        interval={chartDays <= 14 ? 1 : chartDays <= 30 ? 3 : 7}
                      />
                      <YAxis
                        tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                        width={30}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0a0a0c',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '10px',
                          fontSize: '12px',
                          padding: '10px 14px',
                          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
                        }}
                        itemStyle={{ color: 'rgba(110,231,183,0.8)' }}
                        labelStyle={{ color: 'rgba(255,255,255,0.35)', marginBottom: 6, fontSize: '11px' }}
                        cursor={{ stroke: 'rgba(52,211,153,0.08)' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="novos"
                        name="Novos"
                        stroke="rgba(52,211,153,0.5)"
                        strokeWidth={2}
                        fill="url(#signupGrad)"
                        dot={chartDays <= 14 ? { r: 2.5, fill: 'rgba(52,211,153,0.4)', stroke: 'none' } : false}
                        activeDot={{ r: 4, fill: 'rgb(52,211,153)', strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Supporter Codes ── */}
        {!loading && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Heart className="h-3.5 w-3.5 text-purple-400/50" />
                <div>
                  <p className="text-white/40 text-[13px] 2xl:text-sm font-medium">Códigos de Apoiador</p>
                  <p className="text-white/15 text-[10px] mt-0.5">Códigos válidos para "Apoie seu Trader"</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingCode(null);
                  setCodeForm({ code: '', link: '', description: '', special_message: '', display_name: '', broker_name: 'AVALON' });
                  setIsCodeDialogOpen(true);
                }}
                className="h-7 px-3 rounded-md bg-white/[0.05] hover:bg-white/[0.08] text-white/60 hover:text-white/80 text-[11px] font-medium transition-all flex items-center gap-1.5"
              >
                <Plus className="h-3 w-3" />
                Novo código
              </button>
            </div>

            <div className="bg-black/20 backdrop-blur-md rounded-xl border border-white/[0.04] overflow-hidden overflow-x-auto">
              {codesLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-4 w-4 animate-spin text-white/15" />
                </div>
              ) : supporterCodes.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-white/15 text-sm">Nenhum código cadastrado</p>
                  <p className="text-white/10 text-[11px] mt-1">Adicione códigos para que os usuários possam usá-los</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[90px,1fr,1fr,120px,70px,70px] sm:grid-cols-[110px,1fr,1fr,140px,80px,80px] 2xl:grid-cols-[130px,1fr,1fr,160px,100px,90px] px-5 lg:px-6 py-3 border-b border-white/[0.04] min-w-[620px]">
                    <span className="text-white/20 text-[10px] 2xl:text-[11px] font-medium uppercase tracking-wider">Código</span>
                    <span className="text-white/20 text-[10px] 2xl:text-[11px] font-medium uppercase tracking-wider">Link</span>
                    <span className="text-white/20 text-[10px] 2xl:text-[11px] font-medium uppercase tracking-wider">Descrição</span>
                    <span className="text-white/20 text-[10px] 2xl:text-[11px] font-medium uppercase tracking-wider">Usuário</span>
                    <span className="text-white/20 text-[10px] 2xl:text-[11px] font-medium uppercase tracking-wider">Status</span>
                    <span className="text-white/20 text-[10px] 2xl:text-[11px] font-medium uppercase tracking-wider text-right">Ações</span>
                  </div>
                  <div className="divide-y divide-white/[0.025]">
                    {supporterCodes.map(sc => (
                      <div
                        key={sc.id}
                        className="grid grid-cols-[90px,1fr,1fr,120px,70px,70px] sm:grid-cols-[110px,1fr,1fr,140px,80px,80px] 2xl:grid-cols-[130px,1fr,1fr,160px,100px,90px] px-5 lg:px-6 py-3 2xl:py-3.5 items-center hover:bg-white/[0.01] transition-colors min-w-[620px]"
                      >
                        <span className="text-white/70 text-sm 2xl:text-[15px] font-mono tracking-wide">{sc.code}</span>
                        <span className="text-white/25 text-[11px] 2xl:text-xs truncate pr-4">{sc.link}</span>
                        <span className="text-white/20 text-[11px] 2xl:text-xs truncate pr-4">{sc.description || '—'}</span>
                        <span className="text-white/30 text-[11px] 2xl:text-xs truncate pr-4">
                          {sc.user_id && codeUsersMap[sc.user_id] ? codeUsersMap[sc.user_id] : '—'}
                        </span>
                        <button
                          onClick={() => handleToggleCodeActive(sc)}
                          className={`text-[10px] 2xl:text-[11px] flex items-center gap-1 transition-colors ${sc.is_active ? 'text-emerald-400/60 hover:text-emerald-400/80' : 'text-red-400/60 hover:text-red-400/80'}`}
                        >
                          <Power className="h-3 w-3" />
                          {sc.is_active ? 'Ativo' : 'Inativo'}
                        </button>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={async () => {
                              setEditingCode(sc);
                              
                              // Buscar email do usuário se tiver user_id
                              let userEmail = '';
                              if (sc.user_id) {
                                const { data } = await supabase
                                  .from('user_profiles')
                                  .select('email')
                                  .eq('user_id', sc.user_id)
                                  .maybeSingle();
                                userEmail = data?.email || '';
                              }
                              
                              setCodeForm({ 
                                code: sc.code, 
                                link: sc.link, 
                                description: sc.description || '', 
                                special_message: sc.special_message || '', 
                                display_name: sc.display_name || '', 
                                broker_name: sc.broker_name || 'AVALON',
                                user_id: sc.user_id || '',
                                user_email: userEmail
                              });
                              setIsCodeDialogOpen(true);
                            }}
                            aria-label="Editar código"
                            className="h-6 w-6 flex items-center justify-center rounded text-white/15 hover:text-white/40 hover:bg-white/[0.03] transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteCode(sc.id)}
                            aria-label="Excluir código"
                            className="h-6 w-6 flex items-center justify-center rounded text-white/10 hover:text-red-400/50 hover:bg-white/[0.02] transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Privileged Streamers ── */}
        {!loading && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Crown className="h-3.5 w-3.5 text-amber-400/50" />
                <div>
                  <p className="text-white/40 text-[13px] 2xl:text-sm font-medium">Streamers Privilegiados</p>
                  <p className="text-white/15 text-[10px] mt-0.5">Funções secretas para manipular métricas</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingPrivileged(null);
                  setPrivilegedForm({
                    userId: '',
                    notes: '',
                    permissions: {
                      poll_control: false,
                      likes_boost: false,
                      views_boost: false,
                      followers_boost: false,
                      supporters_boost: false,
                    },
                  });
                  setIsPrivilegedDialogOpen(true);
                }}
                className="h-7 px-3 rounded-md bg-white/[0.05] hover:bg-white/[0.08] text-white/60 hover:text-white/80 text-[11px] font-medium transition-all flex items-center gap-1.5"
              >
                <Plus className="h-3 w-3" />
                Adicionar privilegiado
              </button>
            </div>

            <div className="bg-black/20 backdrop-blur-md rounded-xl border border-white/[0.04] overflow-hidden overflow-x-auto">
              {privilegedLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-4 w-4 animate-spin text-white/15" />
                </div>
              ) : privilegedStreamers.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-white/15 text-sm">Nenhum streamer privilegiado</p>
                  <p className="text-white/10 text-[11px] mt-1">Adicione streamers para dar acesso a funções secretas</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr,100px,100px,100px,100px,100px,80px] px-5 lg:px-6 py-3 border-b border-white/[0.04] min-w-[720px]">
                    <span className="text-white/20 text-[10px] 2xl:text-[11px] font-medium uppercase tracking-wider">Streamer</span>
                    <span className="text-white/20 text-[10px] 2xl:text-[11px] font-medium uppercase tracking-wider text-center">Enquetes</span>
                    <span className="text-white/20 text-[10px] 2xl:text-[11px] font-medium uppercase tracking-wider text-center">Curtidas</span>
                    <span className="text-white/20 text-[10px] 2xl:text-[11px] font-medium uppercase tracking-wider text-center">Views</span>
                    <span className="text-white/20 text-[10px] 2xl:text-[11px] font-medium uppercase tracking-wider text-center">Seguidores</span>
                    <span className="text-white/20 text-[10px] 2xl:text-[11px] font-medium uppercase tracking-wider text-center">Apoiadores</span>
                    <span className="text-white/20 text-[10px] 2xl:text-[11px] font-medium uppercase tracking-wider text-right">Ações</span>
                  </div>
                  <div className="divide-y divide-white/[0.025]">
                    {privilegedStreamers.map(ps => {
                      // Buscar permissões (precisaria vir do backend, simplificando aqui)
                      const hasPermission = (type: string) => true; // TODO: implementar busca real
                      
                      return (
                        <div
                          key={ps.id}
                          className="grid grid-cols-[1fr,100px,100px,100px,100px,100px,80px] px-5 lg:px-6 py-3 2xl:py-3.5 items-center hover:bg-white/[0.01] transition-colors min-w-[720px]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {ps.avatar_url ? (
                              <img
                                src={ps.avatar_url}
                                alt={ps.display_name || 'Avatar'}
                                className="w-7 h-7 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                                <Crown className="h-3.5 w-3.5 text-white/20" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-white/70 text-sm 2xl:text-[15px] truncate">{ps.display_name || 'Sem nome'}</p>
                              <p className="text-white/15 text-[10px] truncate">{ps.notes || '—'}</p>
                            </div>
                          </div>
                          
                          <div className="flex justify-center">
                            <Zap className={`h-3.5 w-3.5 ${hasPermission('poll_control') ? 'text-amber-400/60' : 'text-white/10'}`} />
                          </div>
                          <div className="flex justify-center">
                            <Heart className={`h-3.5 w-3.5 ${hasPermission('likes_boost') ? 'text-pink-400/60' : 'text-white/10'}`} />
                          </div>
                          <div className="flex justify-center">
                            <Eye className={`h-3.5 w-3.5 ${hasPermission('views_boost') ? 'text-blue-400/60' : 'text-white/10'}`} />
                          </div>
                          <div className="flex justify-center">
                            <Users className={`h-3.5 w-3.5 ${hasPermission('followers_boost') ? 'text-emerald-400/60' : 'text-white/10'}`} />
                          </div>
                          <div className="flex justify-center">
                            <ShieldCheck className={`h-3.5 w-3.5 ${hasPermission('supporters_boost') ? 'text-purple-400/60' : 'text-white/10'}`} />
                          </div>
                          
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => {
                                // TODO: Carregar permissões reais
                                setEditingPrivileged(ps);
                                setPrivilegedForm({
                                  userId: ps.user_id,
                                  notes: ps.notes || '',
                                  permissions: {
                                    poll_control: true,
                                    likes_boost: true,
                                    views_boost: true,
                                    followers_boost: true,
                                    supporters_boost: true,
                                  },
                                });
                                setIsPrivilegedDialogOpen(true);
                              }}
                              aria-label="Editar permissões"
                              className="h-6 w-6 flex items-center justify-center rounded text-white/15 hover:text-white/40 hover:bg-white/[0.03] transition-colors"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeletePrivileged(ps.id)}
                              aria-label="Remover privilégios"
                              className="h-6 w-6 flex items-center justify-center rounded text-white/10 hover:text-red-400/50 hover:bg-white/[0.02] transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Dialog: Add Member ── */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-black border-white/[0.03] text-white sm:max-w-[400px] p-0 gap-0 rounded-2xl overflow-hidden shadow-2xl shadow-black/90">
          <DialogHeader className="sr-only">
            <DialogTitle>Novo membro</DialogTitle>
            <DialogDescription>Criar conta</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdd} className="flex flex-col">
            <div className="px-7 pt-7 pb-1">
              <p className="text-white/70 text-[15px] font-medium">Novo membro</p>
            </div>

            <div className="px-7 py-5 space-y-6">
              {/* Email */}
              <div>
                <input
                  type="email" required
                  value={newUser.email}
                  onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                  placeholder="Email"
                  autoComplete="off"
                  className="w-full bg-transparent text-white/80 text-[13px] placeholder:text-white/15 border-0 border-b border-white/[0.05] focus:border-white/[0.12] outline-none pb-2.5 transition-colors"
                />
              </div>

              {/* Password */}
              <div>
                <input
                  type="password" required minLength={6}
                  value={newUser.password}
                  onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                  placeholder="Senha"
                  autoComplete="new-password"
                  className="w-full bg-transparent text-white/80 text-[13px] placeholder:text-white/15 border-0 border-b border-white/[0.05] focus:border-white/[0.12] outline-none pb-2.5 transition-colors"
                />
              </div>

              {/* Name */}
              <div>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))}
                  placeholder="Nome (opcional)"
                  autoComplete="off"
                  className="w-full bg-transparent text-white/80 text-[13px] placeholder:text-white/15 border-0 border-b border-white/[0.05] focus:border-white/[0.12] outline-none pb-2.5 transition-colors"
                />
              </div>

              {/* Role */}
              <div className="flex items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={() => setNewUser(p => ({ ...p, isAdmin: false }))}
                  className={`text-[12px] pb-1 transition-all border-b ${
                    !newUser.isAdmin
                      ? 'text-white/60 border-white/20'
                      : 'text-white/15 border-transparent hover:text-white/30'
                  }`}
                >
                  Padrão
                </button>
                <button
                  type="button"
                  onClick={() => setNewUser(p => ({ ...p, isAdmin: true }))}
                  className={`text-[12px] pb-1 transition-all border-b ${
                    newUser.isAdmin
                      ? 'text-white/60 border-white/20'
                      : 'text-white/15 border-transparent hover:text-white/30'
                  }`}
                >
                  Administrador
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-7 py-6 mt-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="flex-1 h-10 rounded-lg text-white/30 hover:text-white/50 text-[13px] transition-all hover:bg-white/[0.02]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 h-10 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/70 hover:text-white text-[13px] font-medium transition-all disabled:opacity-30 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Criar membro
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Member Details ── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-black border-white/[0.03] text-white sm:max-w-[380px] p-0 gap-0 rounded-2xl overflow-hidden shadow-2xl shadow-black/90">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalhes</DialogTitle>
            <DialogDescription>Info do membro</DialogDescription>
          </DialogHeader>
          {selectedUser && (() => {
            const sp = profiles[selectedUser.id];
            const online = isUserOnline(sp, selectedUser.last_sign_in_at);
            return (
              <div className="flex flex-col">
                <div className="px-7 pt-7 pb-4 flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-400/70' : 'bg-white/[0.08]'}`} />
                  <p className="text-white/60 text-[13px] truncate">{selectedUser.email}</p>
                </div>
                <div className="px-7 pb-6 space-y-3">
                  {[
                    { k: 'Nome', v: selectedUser.user_metadata?.name || sp?.display_name || '—' },
                    { k: 'Permissão', v: sp?.is_admin ? 'Administrador' : 'Padrão' },
                    { k: 'Cadastro', v: formatDate(selectedUser.created_at) },
                    { k: 'Último acesso', v: selectedUser.last_sign_in_at ? formatDate(selectedUser.last_sign_in_at) : '—' },
                    { k: 'Status', v: online ? 'Online' : 'Offline' },
                  ].map(row => (
                    <div key={row.k} className="flex justify-between items-center">
                      <span className="text-white/15 text-[11px]">{row.k}</span>
                      <span className="text-white/40 text-[11px]">{row.v}</span>
                    </div>
                  ))}
                  <div className="pt-2">
                    <span className="text-white/[0.06] text-[9px] font-mono break-all">{selectedUser.id}</span>
                  </div>
                </div>
                <div className="flex justify-end gap-4 px-7 py-4 border-t border-white/[0.025]">
                  <button
                    onClick={() => selectedUser && handleResetPw(selectedUser.email)}
                    className="text-white/20 hover:text-white/40 text-[11px] flex items-center gap-1.5 transition-colors"
                  >
                    <Mail className="h-3 w-3" /> Redefinir senha
                  </button>
                  <button
                    onClick={() => selectedUser && handleDelete(selectedUser.id)}
                    className="text-white/10 hover:text-red-400/50 text-[11px] flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" /> Remover
                  </button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Supporter Code ── */}
      <Dialog open={isCodeDialogOpen} onOpenChange={setIsCodeDialogOpen}>
        <DialogContent className="bg-black border-white/[0.03] text-white sm:max-w-[400px] p-0 gap-0 rounded-2xl overflow-hidden shadow-2xl shadow-black/90">
          <DialogHeader className="sr-only">
            <DialogTitle>{editingCode ? 'Editar código' : 'Novo código'}</DialogTitle>
            <DialogDescription>Gerenciar código de apoiador</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCode} className="flex flex-col">
            <div className="px-7 pt-7 pb-1">
              <p className="text-white/70 text-[15px] font-medium">{editingCode ? 'Editar código' : 'Novo código de apoiador'}</p>
            </div>

            <div className="px-7 py-5 space-y-6">
              <div>
                <input
                  type="text" required
                  value={codeForm.code}
                  onChange={e => setCodeForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="CÓDIGO (ex: TRADER123)"
                  autoComplete="off"
                  className="w-full bg-transparent text-white/80 text-[13px] placeholder:text-white/15 border-0 border-b border-white/[0.05] focus:border-white/[0.12] outline-none pb-2.5 transition-colors font-mono uppercase tracking-wider"
                />
              </div>
              <div>
                <input
                  type="url" required
                  value={codeForm.link}
                  onChange={e => setCodeForm(p => ({ ...p, link: e.target.value }))}
                  placeholder="Link de afiliado (https://...)"
                  autoComplete="off"
                  className="w-full bg-transparent text-white/80 text-[13px] placeholder:text-white/15 border-0 border-b border-white/[0.05] focus:border-white/[0.12] outline-none pb-2.5 transition-colors"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={codeForm.description}
                  onChange={e => setCodeForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Descrição (opcional, ex: Trader João)"
                  autoComplete="off"
                  className="w-full bg-transparent text-white/80 text-[13px] placeholder:text-white/15 border-0 border-b border-white/[0.05] focus:border-white/[0.12] outline-none pb-2.5 transition-colors"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={codeForm.special_message}
                  onChange={e => setCodeForm(p => ({ ...p, special_message: e.target.value }))}
                  placeholder="Mensagem Especial (ex: BO (XXBROKER))"
                  autoComplete="off"
                  className="w-full bg-transparent text-white/80 text-[13px] placeholder:text-white/15 border-0 border-b border-white/[0.05] focus:border-white/[0.12] outline-none pb-2.5 transition-colors"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={codeForm.display_name}
                  onChange={e => setCodeForm(p => ({ ...p, display_name: e.target.value }))}
                  placeholder="Nome de Exibição (ex: XXBROKER - substitui 'Avalon' no suporte)"
                  autoComplete="off"
                  className="w-full bg-transparent text-white/80 text-[13px] placeholder:text-white/15 border-0 border-b border-white/[0.05] focus:border-white/[0.12] outline-none pb-2.5 transition-colors"
                />
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={codeForm.user_email}
                  onChange={async (e) => {
                    const search = e.target.value;
                    setCodeForm(p => ({ ...p, user_email: search, user_id: '' }));
                    
                    // Buscar usuários conforme digita (mínimo 2 caracteres)
                    if (search.length >= 2) {
                      setSearchingUser(true);
                      try {
                        const { data } = await supabase
                          .from('user_profiles')
                          .select('user_id, display_name, email')
                          .or(`email.ilike.%${search}%,display_name.ilike.%${search}%`)
                          .limit(5);
                        
                        setUserSuggestions(data || []);
                      } catch (error) {
                        console.error('Erro ao buscar usuários:', error);
                        setUserSuggestions([]);
                      } finally {
                        setSearchingUser(false);
                      }
                    } else {
                      setUserSuggestions([]);
                    }
                  }}
                  onFocus={() => {
                    if (codeForm.user_email.length >= 2) {
                      const search = codeForm.user_email;
                      supabase
                        .from('user_profiles')
                        .select('user_id, display_name, email')
                        .or(`email.ilike.%${search}%,display_name.ilike.%${search}%`)
                        .limit(5)
                        .then(({ data }) => setUserSuggestions(data || []));
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setUserSuggestions([]), 200);
                  }}
                  placeholder="Email ou nome do Streamer"
                  autoComplete="off"
                  className="w-full bg-transparent text-white/80 text-[13px] placeholder:text-white/15 border-0 border-b border-white/[0.05] focus:border-white/[0.12] outline-none pb-2.5 transition-colors"
                />
                
                {/* Dropdown minimalista */}
                {userSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-black/95 border border-white/[0.05] rounded-md shadow-2xl max-h-44 overflow-y-auto">
                    {userSuggestions.map((user) => (
                      <button
                        key={user.user_id}
                        type="button"
                        onClick={() => {
                          setCodeForm(p => ({ 
                            ...p, 
                            user_email: user.email, 
                            user_id: user.user_id 
                          }));
                          setUserSuggestions([]);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-white/[0.03] transition-colors border-b border-white/[0.02] last:border-0"
                      >
                        <div className="text-white/70 text-[12px]">{user.display_name}</div>
                        <div className="text-white/30 text-[11px] mt-0.5">{user.email}</div>
                      </button>
                    ))}
                  </div>
                )}
                
                {searchingUser && (
                  <p className="text-white/40 text-xs mt-1">Procurando...</p>
                )}
                {codeForm.user_id && !searchingUser && (
                  <p className="text-green-400/60 text-xs mt-1">✓ Associado</p>
                )}
              </div>
              <div>
                <select
                  value={codeForm.broker_name}
                  onChange={e => setCodeForm(p => ({ ...p, broker_name: e.target.value }))}
                  aria-label="Selecionar corretora"
                  className="w-full bg-transparent text-white/80 text-[13px] border-0 border-b border-white/[0.05] focus:border-white/[0.12] outline-none pb-2.5 transition-colors cursor-pointer"
                >
                  <option value="AVALON" className="bg-zinc-900 text-white">AVALON</option>
                  <option value="XXBROKER" className="bg-zinc-900 text-white">XXBROKER</option>
                  <option value="YOUXBROKER" className="bg-zinc-900 text-white">YOUXBROKER</option>
                  <option value="IQOPTION" className="bg-zinc-900 text-white">IQOPTION</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 px-7 py-6 mt-2">
              <button
                type="button"
                onClick={() => setIsCodeDialogOpen(false)}
                className="flex-1 h-10 rounded-lg text-white/30 hover:text-white/50 text-[13px] transition-all hover:bg-white/[0.02]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={codeSaving}
                className="flex-1 h-10 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/70 hover:text-white text-[13px] font-medium transition-all disabled:opacity-30 flex items-center justify-center gap-2"
              >
                {codeSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingCode ? 'Salvar' : 'Criar código'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Privileged Streamer ── */}
      <Dialog open={isPrivilegedDialogOpen} onOpenChange={setIsPrivilegedDialogOpen}>
        <DialogContent className="bg-black border-white/[0.03] text-white sm:max-w-[420px] p-0 gap-0 rounded-2xl overflow-hidden shadow-2xl shadow-black/90">
          <DialogHeader className="sr-only">
            <DialogTitle>{editingPrivileged ? 'Editar permissões' : 'Adicionar privilegiado'}</DialogTitle>
            <DialogDescription>Gerenciar streamer privilegiado</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePrivileged} className="flex flex-col">
            <div className="px-7 pt-7 pb-1">
              <p className="text-white/70 text-[15px] font-medium">
                {editingPrivileged ? 'Editar Permissões' : 'Novo Streamer Privilegiado'}
              </p>
            </div>

            <div className="px-7 py-5 space-y-5">
              {!editingPrivileged && (
                <div>
                  <select
                    required
                    value={privilegedForm.userId}
                    onChange={e => setPrivilegedForm(p => ({ ...p, userId: e.target.value }))}
                    aria-label="Selecionar streamer"
                    className="w-full bg-transparent text-white/80 text-[13px] border-0 border-b border-white/[0.05] focus:border-white/[0.12] outline-none pb-2.5 transition-colors cursor-pointer"
                  >
                    <option value="" className="bg-zinc-900">Selecione um streamer...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id} className="bg-zinc-900 text-white">
                        {u.email} {profiles[u.id]?.display_name ? `(${profiles[u.id]?.display_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <input
                  type="text"
                  value={privilegedForm.notes}
                  onChange={e => setPrivilegedForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Notas (opcional)"
                  autoComplete="off"
                  className="w-full bg-transparent text-white/80 text-[13px] placeholder:text-white/15 border-0 border-b border-white/[0.05] focus:border-white/[0.12] outline-none pb-2.5 transition-colors"
                />
              </div>

              <div className="space-y-3 pt-3">
                <p className="text-white/30 text-[11px] uppercase tracking-wider">Permissões</p>
                
                {[
                  { key: 'poll_control', label: 'Controlar Enquetes', icon: Zap, color: 'text-amber-400/60' },
                  { key: 'likes_boost', label: 'Boost de Curtidas', icon: Heart, color: 'text-pink-400/60' },
                  { key: 'views_boost', label: 'Boost de Views', icon: Eye, color: 'text-blue-400/60' },
                  { key: 'followers_boost', label: 'Boost de Seguidores', icon: Users, color: 'text-emerald-400/60' },
                  { key: 'supporters_boost', label: 'Boost de Apoiadores', icon: ShieldCheck, color: 'text-purple-400/60' },
                ].map(({ key, label, icon: Icon, color }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPrivilegedForm(p => ({
                      ...p,
                      permissions: {
                        ...p.permissions,
                        [key]: !p.permissions[key as keyof typeof p.permissions],
                      },
                    }))}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`h-4 w-4 ${privilegedForm.permissions[key as keyof typeof privilegedForm.permissions] ? color : 'text-white/15'}`} />
                      <span className="text-white/60 text-[12px]">{label}</span>
                    </div>
                    <div className={`h-4 w-4 rounded border ${
                      privilegedForm.permissions[key as keyof typeof privilegedForm.permissions]
                        ? 'bg-white/10 border-white/20'
                        : 'border-white/10'
                    } transition-colors`}>
                      {privilegedForm.permissions[key as keyof typeof privilegedForm.permissions] && (
                        <div className="h-full w-full flex items-center justify-center">
                          <div className="h-2 w-2 rounded-sm bg-white/60" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 px-7 py-6 mt-2">
              <button
                type="button"
                onClick={() => setIsPrivilegedDialogOpen(false)}
                className="flex-1 h-10 rounded-lg text-white/30 hover:text-white/50 text-[13px] transition-all hover:bg-white/[0.02]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={privilegedSaving}
                className="flex-1 h-10 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/70 hover:text-white text-[13px] font-medium transition-all disabled:opacity-30 flex items-center justify-center gap-2"
              >
                {privilegedSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingPrivileged ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
