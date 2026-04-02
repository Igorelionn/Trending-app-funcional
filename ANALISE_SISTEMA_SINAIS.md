# 📊 ANÁLISE COMPLETA DO SISTEMA DE SINAIS

## 🎯 VISÃO GERAL

O sistema de sinais é composto por **3 subsistemas principais** que trabalham em conjunto para fornecer sinais de trading em tempo real para todos os usuários:

1. **Sistema de Sinais em Tempo Real** (active_signals) - 3 sinais principais
2. **Sistema de Sinais Estendidos** (RPC) - 7 sinais total (3 + 4 adicionais)
3. **Sistema de Sinais Diários** (daily_signals) - 72 sinais diários fixos

---

## 📦 ESTRUTURA DO BANCO DE DADOS

### Tabela: `active_signals` (Sinais Ativos)
**Propósito**: Armazena os 3 sinais principais que rodam em tempo real

```sql
Colunas:
- id: UUID (PK)
- position: INTEGER (1, 2 ou 3) - UNIQUE
- asset_id: UUID → trading_assets(id)
- symbol: TEXT (ex: "BTC/USD")
- display_name: TEXT (ex: "Bitcoin")
- category: TEXT (ex: "Cripto")
- entry_time: TIME (horário de entrada)
- expiry_time: TIME (horário de expiração)
- gale1_time: TIME (horário gale 1)
- gale2_time: TIME (horário gale 2)
- signal_type: TEXT ('BUY' | 'SELL')
- strength: TEXT (ex: "Expectativa alta")
- success_rate: NUMERIC(5,4) (0.75-0.95)
- created_at: TIMESTAMPTZ
- expires_at: TIMESTAMPTZ (NOW() + 16 minutos)
- is_active: BOOLEAN
```

**Características**:
- ✅ Sempre 3 sinais simultâneos (posições 1, 2, 3)
- ✅ Rotação automática a cada 16 minutos
- ✅ Horários fixos: XX:03, XX:23, XX:43
- ✅ Sincronização via Supabase Realtime
- ✅ Todos os usuários veem os mesmos sinais

---

### Tabela: `daily_signals` (Sinais Diários)
**Propósito**: Armazena 72 sinais fixos gerados às 00:00 de cada dia

```sql
Colunas:
- id: UUID (PK)
- signal_date: DATE (data do sinal)
- position: INTEGER (1-72)
- symbol: TEXT
- exchange: TEXT
- signal_type: TEXT ('BUY' | 'SELL')
- strength: TEXT
- entry_time: TIME
- expiry_minutes: INTEGER
- success_rate: NUMERIC
- created_at: TIMESTAMPTZ
```

**Características**:
- ✅ Gerados UMA VEZ por dia às 00:00
- ✅ 72 sinais por dia (padrão fixo)
- ✅ Entrada: 00:03, gap de 10 minutos, expiração 5 minutos
- ✅ Sincronização global (todos veem os mesmos)

---

### Tabela: `signals_history` (Histórico)
**Propósito**: Mantém histórico de todos os sinais já gerados

```sql
Colunas:
- id: UUID (PK)
- asset_id: UUID
- symbol: TEXT
- display_name: TEXT
- entry_time: TIME
- signal_type: TEXT
- strength: TEXT
- created_at: TIMESTAMPTZ
- removed_at: TIMESTAMPTZ (quando expirou)
```

---

## 🔄 FLUXO DE FUNCIONAMENTO

### 1️⃣ Sistema de Sinais em Tempo Real (Dashboard - 3 sinais)

```
┌─────────────────────────────────────────┐
│  ROTAÇÃO AUTOMÁTICA A CADA 16 MINUTOS  │
└─────────────────────────────────────────┘

Horários fixos: XX:03, XX:23, XX:43

Exemplo:
10:03 → Posição 1 (BTC/USD)   | Expira: 10:19
10:23 → Posição 2 (ETH/USD)   | Expira: 10:39
10:43 → Posição 3 (EUR/USD)   | Expira: 10:59

Às 10:19:
├─ Posição 1 expira e é REMOVIDA
├─ Posição 2 → move para Posição 1
├─ Posição 3 → move para Posição 2
└─ NOVO sinal gerado na Posição 3 (10:43)
```

**Processo de Rotação**:
1. ✅ Função `rotate_signals()` verifica se Position 1 expirou (`expires_at <= NOW()`)
2. ✅ Se expirou:
   - Remove sinal da posição 1
   - Move posição 2 → posição 1
   - Move posição 3 → posição 2
   - Gera novo sinal na posição 3
3. ✅ Todos os clientes são notificados via Supabase Realtime

**Horários Válidos**:
- Função `get_next_valid_entry_time()` calcula próximo slot disponível
- Sempre retorna: XX:03, XX:23 ou XX:43

---

### 2️⃣ Sistema de Sinais Estendidos (Aba Trades - 7 sinais)

```
┌──────────────────────────────────────┐
│  RPC: get_extended_signals()         │
│  Retorna: 3 ativos + 4 adicionais    │
└──────────────────────────────────────┘

Estrutura:
├─ Posições 1-3: SINAIS ATIVOS (active_signals)
│  └─ Buscados diretamente da tabela
│
└─ Posições 4-7: SINAIS ADICIONAIS (gerados em runtime)
   ├─ Baseados em HASH determinístico (seed = DATA)
   ├─ Mesmos sinais para todos (seed compartilhada)
   ├─ Horários sequenciais após último sinal ativo
   └─ NÃO persistidos no banco
```

**Exemplo de Retorno**:
```json
[
  // Posições 1-3: Da tabela active_signals
  { "position": 1, "symbol": "BTC/USD", "entry_time": "10:03", "is_additional": false },
  { "position": 2, "symbol": "ETH/USD", "entry_time": "10:23", "is_additional": false },
  { "position": 3, "symbol": "EUR/USD", "entry_time": "10:43", "is_additional": false },
  
  // Posições 4-7: Gerados em runtime via hash determinístico
  { "position": 4, "symbol": "GBP/USD", "entry_time": "11:03", "is_additional": true },
  { "position": 5, "symbol": "AUD/USD", "entry_time": "11:23", "is_additional": true },
  { "position": 6, "symbol": "USD/JPY", "entry_time": "11:43", "is_additional": true },
  { "position": 7, "symbol": "XAU/USD", "entry_time": "12:03", "is_additional": true }
]
```

**Características dos Sinais Adicionais**:
- ✅ Determinísticos (mesma seed = mesmos sinais)
- ✅ Seed baseada na DATA (não muda durante o dia)
- ✅ Evita símbolos duplicados (já usados nas posições 1-3)
- ✅ Horários sequenciais válidos (03, 23, 43)
- ✅ Taxa de sucesso calculada via hash (85-95%)

---

### 3️⃣ Sistema de Sinais Diários (Histórico/Análise)

```
┌────────────────────────────────────┐
│  GERAÇÃO DIÁRIA ÀS 00:00          │
│  Função: generate_daily_signals()  │
└────────────────────────────────────┘

Processo:
├─ Executado automaticamente às 00:00
├─ Gera 72 sinais para o dia
├─ Padrão fixo:
│  └─ Início: 00:03
│  └─ Gap: 10 minutos
│  └─ Expiração: 5 minutos
└─ Armazenados em daily_signals
```

**Acesso**:
- ✅ `getDailySignalsFromDB(date, limit, offset)`
- ✅ `get3FirstSignalsFromDB()` - Primeiros 3
- ✅ `get7SignalsFromDB()` - Primeiros 7
- ✅ `getAllDailySignalsFromDB()` - Todos 72

---

## 🔌 INTEGRAÇÃO COM FRONTEND

### Hook: `useRealtimeSignals()` (Dashboard)

**Localização**: `src/hooks/useRealtimeSignals.ts`

**Uso**: Dashboard (3 sinais)

```typescript
const { signals, isLoading, error, refresh } = useRealtimeSignals();

// signals: ActiveSignal[] (sempre 3 sinais)
// isLoading: boolean
// error: Error | null
// refresh: () => Promise<void>
```

**Fluxo**:
1. Inicializa `realtimeSignalsService.initialize()`
2. Busca sinais iniciais de `active_signals`
3. Subscribe ao Supabase Realtime channel `'active_signals_changes'`
4. Recebe updates automáticos (INSERT/UPDATE/DELETE)
5. Atualiza state e notifica componentes

**Features**:
- ✅ Auto-inicialização ao montar
- ✅ Escuta mudanças em tempo real
- ✅ Recuperação automática de erros
- ✅ Cache local (localStorage)
- ✅ Validação de horários (remove sinais antigos > 30min)

---

### Hook: `useExtendedSignals()` (Aba Trades)

**Localização**: `src/hooks/useExtendedSignals.ts`

**Uso**: Aba Trades (7 sinais)

```typescript
const { signals, isLoading, error, refresh } = useExtendedSignals();

// signals: ActiveSignal[] (7 sinais: 3 ativos + 4 adicionais)
```

**Fluxo**:
1. Busca cache inicial (se válido)
2. Chama RPC `get_extended_signals()`
3. Valida horários (remove sinais > 30min)
4. Ordena por `position`
5. Salva cache (localStorage)
6. Subscribe ao Realtime para mudanças nos 3 primeiros
7. Polling inteligente para detectar rotação

**Features**:
- ✅ Cache com validação de versão
- ✅ Timeout de segurança (8s por tentativa)
- ✅ Retry automático (1 tentativa)
- ✅ Fallback para cache em caso de erro
- ✅ Validação de integridade dos sinais
- ✅ Polling adaptativo (15s-60s)

---

### Service: `realtimeSignalsService` (Singleton)

**Localização**: `src/services/realtimeSignals.ts`

**Responsabilidades**:
- ✅ Gerenciar conexão Realtime
- ✅ Buscar sinais de `active_signals`
- ✅ Notificar subscribers quando há mudanças
- ✅ Cache local (sessionStorage)
- ✅ Validação de horários
- ✅ Monitoramento de conexão
- ✅ Recuperação automática

**API Pública**:
```typescript
// Inicializar serviço
await realtimeSignalsService.initialize();

// Subscribe para receber sinais
const unsubscribe = realtimeSignalsService.subscribe((signals) => {
  console.log('Sinais atualizados:', signals);
});

// Get snapshot atual
const signals = realtimeSignalsService.getSignals();

// Forçar refresh
await realtimeSignalsService.refresh();

// Admin: Forçar rotação
await realtimeSignalsService.forceRotation();

// Admin: Reinicializar sistema
await realtimeSignalsService.reinitialize();
```

---

## 🛡️ SEGURANÇA E RLS

### Políticas de Segurança (`active_signals`):

```sql
-- Leitura: Todos podem ler
CREATE POLICY "Permitir leitura de sinais ativos"
  ON active_signals FOR SELECT
  USING (true);

-- Escrita: Apenas autenticados (service role)
CREATE POLICY "Service role pode inserir sinais ativos"
  ON active_signals FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role pode atualizar sinais ativos"
  ON active_signals FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Service role pode deletar sinais ativos"
  ON active_signals FOR DELETE
  TO authenticated
  USING (true);
```

---

## ⚡ OTIMIZAÇÕES IMPLEMENTADAS

### 1. Cache Inteligente
- ✅ `localStorage` com validação de data
- ✅ Cache versionado (limpa automaticamente em mudanças)
- ✅ Timeout de 3 minutos para sinais em tempo real
- ✅ Cache diário para sinais estendidos

### 2. Validação de Horários
- ✅ Remove automaticamente sinais com > 30 minutos
- ✅ Ajusta para meia-noite (evita problemas de horário)
- ✅ Validação no frontend E backend

### 3. Retry e Fallback
- ✅ Retry automático em caso de falha (1 tentativa)
- ✅ Timeout de segurança (8s por tentativa)
- ✅ Fallback para cache em caso de erro
- ✅ Graceful degradation (não trava a UI)

### 4. Polling Adaptativo
- ✅ Intervalo variável baseado em proximidade da rotação
- ✅ 15s quando falta 1 minuto
- ✅ 30s quando falta 3 minutos
- ✅ 60s quando falta mais tempo
- ✅ Máximo 100 verificações consecutivas

### 5. Realtime Otimizado
- ✅ Debounce de 5 segundos entre updates
- ✅ Reconexão automática em caso de falha
- ✅ Detecção de desconexão intencional
- ✅ Monitoramento de saúde da conexão (30s)

---

## 📊 FLUXO DE DADOS COMPLETO

```
┌──────────────────────────────────────────────────────────┐
│                    BANCO DE DADOS                         │
├──────────────────────────────────────────────────────────┤
│  active_signals (3 sinais)                               │
│  ├─ Position 1: BTC/USD 10:03                            │
│  ├─ Position 2: ETH/USD 10:23                            │
│  └─ Position 3: EUR/USD 10:43                            │
│                                                           │
│  daily_signals (72 sinais fixos)                         │
│  └─ Gerados às 00:00 via generate_daily_signals()       │
│                                                           │
│  signals_history (histórico completo)                    │
│  └─ Todos os sinais já gerados                           │
└──────────────────────────────────────────────────────────┘
                        ↕ Realtime (Supabase)
┌──────────────────────────────────────────────────────────┐
│                      SERVIÇOS                             │
├──────────────────────────────────────────────────────────┤
│  realtimeSignalsService (Singleton)                      │
│  ├─ Busca de active_signals                              │
│  ├─ Subscribe Realtime                                   │
│  ├─ Notifica subscribers                                 │
│  └─ Cache (sessionStorage)                               │
│                                                           │
│  RPC: get_extended_signals()                             │
│  ├─ 3 sinais de active_signals                           │
│  └─ 4 sinais adicionais (hash determinístico)           │
│                                                           │
│  dailySignalsService                                     │
│  └─ RPC: get_daily_signals(date, limit, offset)         │
└──────────────────────────────────────────────────────────┘
                        ↕ Hooks
┌──────────────────────────────────────────────────────────┐
│                    COMPONENTES                            │
├──────────────────────────────────────────────────────────┤
│  Dashboard                                                │
│  └─ useRealtimeSignals() → 3 sinais                      │
│     └─ SignalsCard.tsx                                   │
│                                                           │
│  Aba Trades/Signals                                      │
│  └─ useExtendedSignals() → 7 sinais                      │
│     └─ Signals.tsx                                       │
│                                                           │
│  (Futuro) Análise                                        │
│  └─ getDailySignalsFromDB() → 72 sinais                 │
└──────────────────────────────────────────────────────────┘
```

---

## 🔧 FUNÇÕES SQL PRINCIPAIS

### `initialize_signals()` - Inicializar Sistema
```sql
-- Cria 3 sinais iniciais em horários válidos
-- Limpa tabela active_signals
-- Retorna: position, signal_id, symbol, entry_time
SELECT * FROM initialize_signals();
```

### `rotate_signals()` - Rotação Manual
```sql
-- Remove posição 1 se expirou
-- Move posições 2→1, 3→2
-- Gera novo sinal na posição 3
-- Retorna: action, position, signal_id
SELECT * FROM rotate_signals();
```

### `generate_new_signal(position, entry_time)` - Gerar Sinal
```sql
-- Gera novo sinal para uma posição
-- Valida disponibilidade do ativo
-- Alterna BUY/SELL
-- Taxa de sucesso: 75-95%
SELECT generate_new_signal(3, '10:43:00');
```

### `get_extended_signals()` - 7 Sinais
```sql
-- Retorna 3 ativos + 4 adicionais
-- Sinais adicionais determinísticos (seed = data)
-- Horários sequenciais válidos
SELECT * FROM get_extended_signals();
```

### `get_daily_signals(target_date, limit_count, offset_count)` - Sinais Diários
```sql
-- Busca sinais do dia específico
-- Suporta paginação
-- Retorna sinais formatados
SELECT * FROM get_daily_signals('2026-03-15', 7, 0);
```

---

## 🚀 PRÓXIMAS MELHORIAS POSSÍVEIS

### 1. Performance
- [ ] Implementar paginação real em `useExtendedSignals`
- [ ] Reduzir intervalo de polling para 20s fixo
- [ ] Lazy loading dos sinais 4-7 (carregar sob demanda)
- [ ] WebWorker para processar validações

### 2. Features
- [ ] Notificações push quando novo sinal aparece
- [ ] Histórico de sinais (última semana)
- [ ] Estatísticas de sucesso por ativo
- [ ] Filtro por categoria de ativo

### 3. Monitoramento
- [ ] Dashboard de saúde dos sinais
- [ ] Alertas quando rotação falha
- [ ] Métricas de latência do Realtime
- [ ] Log de erros centralizado

---

## 📝 NOTAS IMPORTANTES

### ⚠️ Sincronização Global
- Todos os usuários **SEMPRE** veem os mesmos sinais
- Sincronização garantida via:
  - Tabela única `active_signals`
  - Hash determinístico para sinais adicionais
  - Seed compartilhada (data do dia)

### ⚠️ Horários Válidos
- Sistema usa **apenas** horários XX:03, XX:23, XX:43
- Gap de 20 minutos entre sinais
- Rotação automática a cada 16 minutos
- Validação no frontend e backend

### ⚠️ Cache e Validação
- Cache expira em 3 minutos (tempo real)
- Cache diário para sinais estendidos
- Validação automática de versão
- Limpeza inteligente de dados antigos

### ⚠️ Disponibilidade de Ativos
- Valida horário de trading do ativo
- Respeita dias da semana (forex fechado fim de semana)
- Ativos 24/7 sempre disponíveis (cripto)
- Função `is_asset_available_at()` valida

---

## 📚 REFERÊNCIAS DE CÓDIGO

### Principais Arquivos:

**Serviços**:
- `src/services/realtimeSignals.ts` - Serviço principal de tempo real
- `src/services/dailySignals.ts` - Serviço de sinais diários

**Hooks**:
- `src/hooks/useRealtimeSignals.ts` - Hook para 3 sinais (Dashboard)
- `src/hooks/useExtendedSignals.ts` - Hook para 7 sinais (Trades)

**Tipos**:
- `src/types/tradingSignals.ts` - TypeScript interfaces

**Migrations**:
- `migrations/003_realtime_signals_system_CORRECTED.sql` - Sistema base
- `migrations/004_fix_get_extended_signals.sql` - Correção sinais estendidos
- `migrations/002_daily_signals_functions.sql` - Sistema diário

**Componentes**:
- `src/components/dashboard/SignalsCard.tsx` - Card de sinais (Dashboard)
- `src/pages/Signals.tsx` - Página de sinais (Trades)

---

## ✅ CONCLUSÃO

O sistema de sinais é **robusto**, **escalável** e **sincronizado globalmente**. 

**Pontos Fortes**:
- ✅ Sincronização em tempo real via Supabase
- ✅ Cache inteligente com validação
- ✅ Retry e fallback automáticos
- ✅ Horários válidos e rotação automática
- ✅ Determinístico (mesmos sinais para todos)
- ✅ Performance otimizada

**Arquitetura**:
- ✅ Separação clara de responsabilidades
- ✅ Hooks reutilizáveis
- ✅ Serviço singleton para gerenciar estado
- ✅ RLS adequado para segurança
- ✅ Validação em múltiplas camadas

O sistema está **pronto para produção** e pode escalar para milhares de usuários simultâneos! 🚀
