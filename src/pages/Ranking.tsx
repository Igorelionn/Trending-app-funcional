import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Crown, Medal, Settings, Search, Check, X, Copy } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { getSupabaseAdmin } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface RankedTrader {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  ranking_lifetime: number | null;
  ranking_monthly: number | null;
  ranking_weekly: number | null;
  supporter_code: string | null;
}

const Ranking = () => {
  const [rankingPeriod, setRankingPeriod] = useState<'weekly' | 'monthly' | 'lifetime'>('lifetime');
  const [traders, setTraders] = useState<RankedTrader[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin states
  const [editingRanking, setEditingRanking] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RankedTrader[]>([]);
  const [selectedTrader, setSelectedTrader] = useState<RankedTrader | null>(null);
  const [rankingForm, setRankingForm] = useState({
    ranking_lifetime: '',
    ranking_monthly: '',
    ranking_weekly: ''
  });
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadRankings();
  }, [rankingPeriod]);

  // Debounce para busca
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadRankings = async () => {
    setLoading(true);
    try {
      const rankingField = rankingPeriod === 'lifetime'
        ? 'ranking_lifetime'
        : rankingPeriod === 'monthly'
        ? 'ranking_monthly'
        : 'ranking_weekly';

      // Usar admin client para garantir acesso sem restrições de RLS
      const adminDb = getSupabaseAdmin() as any;

      const { data, error } = await adminDb
        .from('user_profiles')
        .select('id, user_id, display_name, avatar_url, ranking_lifetime, ranking_monthly, ranking_weekly')
        .not(rankingField, 'is', null)
        .order(rankingField, { ascending: true })
        .limit(100);

      if (error) throw error;

      const profiles: RankedTrader[] = data || [];

      // Buscar supporter codes da tabela correta
      if (profiles.length > 0) {
        const userIds = profiles.map((t: any) => t.user_id).filter(Boolean);
        const { data: codes } = await adminDb
          .from('supporter_codes')
          .select('user_id, code')
          .in('user_id', userIds)
          .eq('is_active', true);

        const codeMap: Record<string, string> = {};
        (codes || []).forEach((c: any) => { codeMap[c.user_id] = c.code; });

        setTraders(profiles.map((t: any) => ({
          ...t,
          supporter_code: codeMap[t.user_id] || null,
        })));
      } else {
        setTraders([]);
      }
    } catch (error) {
      console.error('Erro ao carregar rankings:', error);
      setTraders([]);
    } finally {
      setLoading(false);
    }
  };

  const getRank = (trader: RankedTrader): number | null => {
    if (rankingPeriod === 'lifetime') return trader.ranking_lifetime;
    if (rankingPeriod === 'monthly') return trader.ranking_monthly;
    return trader.ranking_weekly;
  };

  // Buscar trader específico por rank
  const getTraderByRank = (rank: number) =>
    traders.find(t => getRank(t) === rank) || null;

  // Admin: buscar traders (usa admin client para ignorar RLS)
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const adminDb = getSupabaseAdmin() as any;
      const { data, error } = await adminDb
        .from('user_profiles')
        .select('id, user_id, display_name, avatar_url, ranking_lifetime, ranking_monthly, ranking_weekly')
        .ilike('display_name', `%${query}%`)
        .limit(10);

      if (error) throw error;

      const profiles: RankedTrader[] = data || [];

      // Buscar supporter codes
      if (profiles.length > 0) {
        const userIds = profiles.map((t: any) => t.user_id).filter(Boolean);
        const { data: codes } = await adminDb
          .from('supporter_codes')
          .select('user_id, code')
          .in('user_id', userIds)
          .eq('is_active', true);

        const codeMap: Record<string, string> = {};
        (codes || []).forEach((c: any) => { codeMap[c.user_id] = c.code; });

        setSearchResults(profiles.map((t: any) => ({
          ...t,
          supporter_code: codeMap[t.user_id] || null,
        })));
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    }
  };

  const handleSelectTrader = (trader: RankedTrader) => {
    setSelectedTrader(trader);
    setRankingForm({
      ranking_lifetime: trader.ranking_lifetime?.toString() || '',
      ranking_monthly: trader.ranking_monthly?.toString() || '',
      ranking_weekly: trader.ranking_weekly?.toString() || ''
    });
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleSaveRanking = async () => {
    if (!selectedTrader) return;
    setSaving(true);
    try {
      const lifetime = rankingForm.ranking_lifetime ? parseInt(rankingForm.ranking_lifetime) : null;
      const monthly = rankingForm.ranking_monthly ? parseInt(rankingForm.ranking_monthly) : null;
      const weekly = rankingForm.ranking_weekly ? parseInt(rankingForm.ranking_weekly) : null;

      const adminDb = getSupabaseAdmin() as any;
      const { error } = await adminDb
        .from('user_profiles')
        .update({ ranking_lifetime: lifetime, ranking_monthly: monthly, ranking_weekly: weekly })
        .eq('user_id', selectedTrader.user_id);

      if (error) throw error;

      toast.success(`Ranking de ${selectedTrader.display_name} atualizado!`);
      setSelectedTrader(null);
      setRankingForm({ ranking_lifetime: '', ranking_monthly: '', ranking_weekly: '' });
      setEditingRanking(false);
      loadRankings();
    } catch (err) {
      toast.error('Erro ao salvar ranking');
    } finally {
      setSaving(false);
    }
  };

  const rank1 = getTraderByRank(1);
  const rank2 = getTraderByRank(2);
  const rank3 = getTraderByRank(3);

  // Posições 4-50 para o ticker lateral
  const ITEM_H = 44;
  const allSlots = Array.from({ length: 47 }, (_, i) => {
    const pos = i + 4;
    return { position: pos, trader: traders.find(t => getRank(t) === pos) || null };
  });

  return (
    <Layout>
      <div className="w-full px-8 py-8 max-w-[1400px] mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-end justify-between mb-12"
        >
          {/* Título */}
          <div>
            <p className="text-xs tracking-[0.25em] text-white/30 uppercase mb-2.5 font-light">
              Top traders
            </p>
            <h1 className="text-5xl font-bold leading-none tracking-tight">
              <span className="bg-gradient-to-br from-white via-white/90 to-white/40 bg-clip-text text-transparent">
                Ranking
              </span>
            </h1>
          </div>

          {/* Controles */}
          <div className="flex items-center gap-4 pb-1">
            {/* Filtros de período */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              {(['weekly', 'monthly', 'lifetime'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setRankingPeriod(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    rankingPeriod === p
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-white/35 hover:text-white/65'
                  }`}
                >
                  {p === 'weekly' ? 'Semana' : p === 'monthly' ? 'Mês' : 'Geral'}
                </button>
              ))}
            </div>

            {isAdmin && (
              <button
                onClick={() => setEditingRanking(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] text-white/40 hover:text-white/80 hover:border-white/20 transition-all duration-200 text-sm"
              >
                <Settings className="w-4 h-4" />
                <span className="font-light">Gerenciar</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* CSS animações */}
        <style>{`
          @keyframes rankingTicker {
            0%   { transform: translateY(0px); }
            100% { transform: translateY(-${50 * ITEM_H}px); }
          }
          .ranking-ticker { animation: rankingTicker ${50 * 1.2}s linear infinite; }
          .ranking-ticker-wrap:hover .ranking-ticker { animation-play-state: paused; }

        `}</style>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/40" />
          </div>
        ) : (
          <div className="flex gap-12 items-start">

            {/* ── Pódio Top 3 ─────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 pb-6"
            >
              <div className="flex items-end justify-center gap-8">

                {/* 2º Lugar */}
                <div className="flex flex-col items-center gap-5 w-44">
                  {rank2 ? (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center gap-3 cursor-pointer group"
                      onClick={() => navigate(`/profile/${rank2.user_id}`)}
                    >
                      <div className="relative">
                        <Avatar className="w-20 h-20 border-2 border-gray-400/40 group-hover:border-gray-400/70 transition-all">
                          <AvatarImage src={rank2.avatar_url || ''} className="object-cover" />
                          <AvatarFallback className="text-xl">{rank2.display_name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -top-2 -right-2 bg-gray-400/20 rounded-full p-1">
                          <Medal className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-white/80 text-sm font-medium truncate max-w-[140px]">{rank2.display_name}</div>
                        {rank2.supporter_code && (
                          <div className="text-white/30 text-[10px] font-mono mt-0.5">#{rank2.supporter_code}</div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-20 h-20 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
                        <span className="text-white/20 text-2xl font-light">2</span>
                      </div>
                      <div className="text-white/20 text-xs">Vazio</div>
                    </div>
                  )}

                  {/* Barra 2º lugar */}
                  <div className="relative w-full flex flex-col justify-end" style={{ height: '340px' }}>
                    <motion.div
                      key={`rank2-${rankingPeriod}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: '75%', opacity: 1 }}
                      transition={{ duration: 1, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
                      className={`w-full rounded-t-2xl relative overflow-hidden ${
                        rank2 ? 'bg-gradient-to-t from-gray-400/20 to-transparent' : 'bg-gradient-to-t from-white/[0.06] to-transparent'
                      }`}
                    >
                      <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
                        <span className={`text-5xl font-extralight ${rank2 ? 'text-gray-400/50' : 'text-white/15'}`}>2</span>
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* 1º Lugar — mais alto e centralizado */}
                <div className="flex flex-col items-center gap-5 w-44">
                  {rank1 ? (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                      className="flex flex-col items-center gap-3 cursor-pointer group"
                      onClick={() => navigate(`/profile/${rank1.user_id}`)}
                    >
                      <div className="relative">
                        <Avatar className="w-24 h-24 border-2 border-yellow-500/50 group-hover:border-yellow-500/80 transition-all">
                          <AvatarImage src={rank1.avatar_url || ''} className="object-cover" />
                          <AvatarFallback className="text-2xl">{rank1.display_name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -top-3 -right-2 bg-yellow-500/20 rounded-full p-1.5">
                          <Crown className="w-5 h-5 text-yellow-500" fill="currentColor" />
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-white text-sm font-semibold truncate max-w-[140px]">{rank1.display_name}</div>
                        {rank1.supporter_code && (
                          <div className="text-yellow-500/50 text-[10px] font-mono mt-0.5">#{rank1.supporter_code}</div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-24 h-24 rounded-full border border-yellow-500/20 bg-yellow-500/5 flex items-center justify-center">
                        <Crown className="w-8 h-8 text-yellow-500/20" fill="currentColor" />
                      </div>
                      <div className="text-white/20 text-xs">Vazio</div>
                    </div>
                  )}

                  {/* Barra 1º lugar */}
                  <div className="relative w-full flex flex-col justify-end" style={{ height: '420px' }}>
                    <motion.div
                      key={`rank1-${rankingPeriod}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: '100%', opacity: 1 }}
                      transition={{ duration: 1, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
                      className={`w-full rounded-t-2xl relative overflow-hidden ${
                        rank1 ? 'bg-gradient-to-t from-yellow-500/20 to-transparent' : 'bg-gradient-to-t from-white/[0.06] to-transparent'
                      }`}
                    >
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                        <span className={`text-6xl font-extralight ${rank1 ? 'text-yellow-500/50' : 'text-white/15'}`}>1</span>
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* 3º Lugar */}
                <div className="flex flex-col items-center gap-5 w-44">
                  {rank3 ? (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="flex flex-col items-center gap-3 cursor-pointer group"
                      onClick={() => navigate(`/profile/${rank3.user_id}`)}
                    >
                      <div className="relative">
                        <Avatar className="w-20 h-20 border-2 border-orange-600/40 group-hover:border-orange-600/70 transition-all">
                          <AvatarImage src={rank3.avatar_url || ''} className="object-cover" />
                          <AvatarFallback className="text-xl">{rank3.display_name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -top-2 -right-2 bg-orange-600/20 rounded-full p-1">
                          <Medal className="w-4 h-4 text-orange-600" />
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-white/80 text-sm font-medium truncate max-w-[140px]">{rank3.display_name}</div>
                        {rank3.supporter_code && (
                          <div className="text-white/30 text-[10px] font-mono mt-0.5">#{rank3.supporter_code}</div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-20 h-20 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
                        <span className="text-white/20 text-2xl font-light">3</span>
                      </div>
                      <div className="text-white/20 text-xs">Vazio</div>
                    </div>
                  )}

                  {/* Barra 3º lugar */}
                  <div className="relative w-full flex flex-col justify-end" style={{ height: '340px' }}>
                    <motion.div
                      key={`rank3-${rankingPeriod}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: '60%', opacity: 1 }}
                      transition={{ duration: 1, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
                      className={`w-full rounded-t-2xl relative overflow-hidden ${
                        rank3 ? 'bg-gradient-to-t from-orange-600/20 to-transparent' : 'bg-gradient-to-t from-white/[0.06] to-transparent'
                      }`}
                    >
                      <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
                        <span className={`text-5xl font-extralight ${rank3 ? 'text-orange-600/50' : 'text-white/15'}`}>3</span>
                      </div>
                    </motion.div>
                  </div>
                </div>

              </div>
            </motion.div>

            {/* ── Ticker infinito (lado direito) ────────── */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="w-56 flex-shrink-0"
            >
              {/* Container do ticker com fades */}
              <div
                className="ranking-ticker-wrap relative overflow-hidden"
                style={{ height: `${7 * ITEM_H}px` }}
              >
                {/* Fade topo */}
                <div className="absolute top-0 inset-x-0 z-10 pointer-events-none"
                  style={{ height: `${ITEM_H * 2}px`, background: 'linear-gradient(to bottom, black, transparent)' }} />

                {/* Faixa rolante: lista duplicada para loop infinito */}
                <div className="ranking-ticker">
                  {[...allSlots, ...allSlots].map((slot, i) => {
                    const isCopied = copiedId === (slot.trader?.id ?? `empty-${i}`);
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 group hover:bg-white/[0.04] transition-colors rounded-lg"
                        style={{ height: `${ITEM_H}px` }}
                      >
                        {/* Número */}
                        <span className="text-xs font-light text-white/20 w-6 text-right flex-shrink-0 tabular-nums">
                          {slot.position}
                        </span>

                        {/* Avatar circular */}
                        {slot.trader ? (
                          <button
                            onClick={() => navigate(`/profile/${slot.trader!.user_id}`)}
                            className="flex-shrink-0"
                          >
                            <Avatar className="border border-white/10 group-hover:border-white/30 transition-all" style={{ width: 30, height: 30 }}>
                              <AvatarImage src={slot.trader.avatar_url || ''} className="object-cover" />
                              <AvatarFallback className="text-[10px]">{slot.trader.display_name[0]}</AvatarFallback>
                            </Avatar>
                          </button>
                        ) : (
                          <div className="flex-shrink-0 rounded-full border border-white/5 bg-white/[0.02]" style={{ width: 30, height: 30 }} />
                        )}

                        {/* Nome */}
                        <div className="flex-1 min-w-0">
                          {slot.trader ? (
                            <button
                              onClick={() => navigate(`/profile/${slot.trader!.user_id}`)}
                              className="text-left truncate block w-full"
                            >
                              <span className="text-white/60 text-xs font-light group-hover:text-white/90 transition-colors">
                                {slot.trader.display_name}
                              </span>
                            </button>
                          ) : (
                            <span className="text-white/15 text-xs font-light">—</span>
                          )}
                        </div>

                        {/* Código copiável */}
                        {slot.trader?.supporter_code && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(slot.trader!.supporter_code!);
                              setCopiedId(slot.trader!.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
                            title="Copiar código"
                          >
                            {isCopied ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-white/25 group-hover:text-white/50" />
                            )}
                            <span className="text-[10px] font-mono text-white/25 group-hover:text-white/50 transition-colors">
                              {slot.trader.supporter_code}
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Fade base */}
                <div className="absolute bottom-0 inset-x-0 z-10 pointer-events-none"
                  style={{ height: `${ITEM_H * 2}px`, background: 'linear-gradient(to top, black, transparent)' }} />
              </div>
            </motion.div>

          </div>
        )}
      </div>

      {/* Dialog: Gerenciar Ranking (Admin) */}
      <Dialog open={editingRanking} onOpenChange={setEditingRanking}>
        <DialogContent className="bg-black/95 backdrop-blur-xl border border-white/10 max-w-md">
          <DialogHeader className="border-b border-white/5 pb-4">
            <DialogTitle className="text-white text-xl font-light flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Gerenciar
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">

          <>
            {/* Busca de trader */}
            <div className="space-y-2">
              <Label className="text-white/70 text-sm font-normal">Buscar Trader</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  placeholder="Nome do trader..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11 rounded-xl"
                />
              </div>

              {/* Resultados da busca */}
              {searchResults.length > 0 && (
                <div className="bg-black/80 border border-white/10 rounded-xl overflow-hidden">
                  {searchResults.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTrader(t)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={t.avatar_url || ''} className="object-cover" />
                        <AvatarFallback className="text-xs">{t.display_name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-white/90 text-sm">{t.display_name}</div>
                        {t.ranking_lifetime && (
                          <div className="text-white/30 text-xs">Atual: #{t.ranking_lifetime} (geral)</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Trader selecionado */}
            {selectedTrader && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={selectedTrader.avatar_url || ''} className="object-cover" />
                    <AvatarFallback>{selectedTrader.display_name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-white text-sm font-medium">{selectedTrader.display_name}</div>
                  </div>
                  <button onClick={() => setSelectedTrader(null)} className="text-white/30 hover:text-white/60">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-white/60 text-xs">Geral</Label>
                    <Input
                      type="number" min="1" placeholder="#"
                      value={rankingForm.ranking_lifetime}
                      onChange={(e) => setRankingForm({ ...rankingForm, ranking_lifetime: e.target.value })}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 rounded-lg text-center"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/60 text-xs">Mensal</Label>
                    <Input
                      type="number" min="1" placeholder="#"
                      value={rankingForm.ranking_monthly}
                      onChange={(e) => setRankingForm({ ...rankingForm, ranking_monthly: e.target.value })}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 rounded-lg text-center"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/60 text-xs">Semanal</Label>
                    <Input
                      type="number" min="1" placeholder="#"
                      value={rankingForm.ranking_weekly}
                      onChange={(e) => setRankingForm({ ...rankingForm, ranking_weekly: e.target.value })}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 rounded-lg text-center"
                    />
                  </div>
                </div>
                <p className="text-white/25 text-xs">Deixe em branco para remover a posição</p>
              </div>
            )}
          </>

          </div>

          <DialogFooter className="border-t border-white/5 pt-4 gap-2">
            <Button
              onClick={() => { setEditingRanking(false); setSelectedTrader(null); setSearchQuery(''); }}
              variant="ghost"
              className="flex-1 text-white/50 hover:text-white hover:bg-white/5 h-11 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveRanking}
              disabled={!selectedTrader || saving}
              className="flex-1 bg-white text-black hover:bg-white/90 h-11 rounded-xl disabled:opacity-40"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Ranking;
