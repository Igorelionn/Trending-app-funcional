# Sistema de Variação de Sinais por Código de Apoiador

## 📋 Visão Geral

Este sistema permite que usuários vejam **sinais completamente diferentes** baseados no **código de apoiador** que estão usando, mantendo a consistência entre todos os usuários que usam o mesmo código.

## 🎯 Comportamento

### TODOS os Sinais Variam por Código (Posições 1-7)

#### Sinais Principais (Posições 1-3) - Dashboard e Trades
- **Variam por código de apoiador**
- Usuários com mesmo código veem mesmos sinais
- Usuários sem código (ou com código vazio) veem sinais "DEFAULT"
- Rotação automática a cada 16 minutos

#### Sinais Adicionais (Posições 4-7) - Apenas Aba Trades
- **Também variam por código de apoiador**
- Mesmo comportamento dos sinais principais
- Gerados usando a mesma lógica determinística

### Exemplos de Variação

```
Código "TRADER123":
- Posições 1-3: CAD/JPY, CHF/NOK, USD/JPY
- Posições 4-7: RNDR, ONDO, WTI, MATIC

Código DEFAULT (sem código):
- Posições 1-3: EOS, US30, EUR/AUD
- Posições 4-7: CHF/NOK, RNDR, USD/XOF, TSLA/F

Código "OUTRO_CODIGO":
- Posições 1-3: GRT, USD/NOK, JUP
- Posições 4-7: (diferentes dos outros códigos)
```

## 🔧 Implementação Técnica

### 1. Função de Seed (`get_asset_selection_seed`)

Gera uma seed única baseada em:
- Código de apoiador (ou 'DEFAULT' se vazio)
- Data atual (formato YYYYMMDD)
- Posição do sinal (1-7)

```sql
-- Exemplo:
-- Código "TRADER123", Data 2026-03-15, Posição 4
-- Seed: "TRADER123_20260315_4"

-- Código vazio, Data 2026-03-15, Posição 4
-- Seed: "DEFAULT_20260315_4"
```

### 2. Seleção Determinística de Ativos

A função `generate_new_signal_with_code` e `get_extended_signals_with_code` usam a seed para:

1. **Ordenar ativos**: `ORDER BY md5(symbol || seed)`
2. **Gerar tipo de sinal**: BUY ou SELL baseado em hash
3. **Calcular taxa de sucesso**: 75-95% baseado em hash

Isso garante que:
- Mesma seed = mesmos ativos
- Seed diferente = ativos diferentes (mas de forma controlada)

### 3. Funções SQL Criadas

#### `get_asset_selection_seed(p_supporter_code, p_date, p_position)`
- Retorna seed única para seleção de ativo

#### `get_active_signals_with_code(p_supporter_code)`
- Retorna 3 sinais principais baseados no código
- Usado pelo Dashboard e pela aba Trades
- Substituiu a consulta direta à tabela `active_signals`

#### `get_extended_signals_with_code(p_supporter_code)`
- Retorna 7 sinais (todos baseados no código):
  - Posições 1-3: mesmos que `get_active_signals_with_code`
  - Posições 4-7: sinais adicionais com mesma lógica

#### `generate_new_signal_with_code(p_position, p_entry_time, p_supporter_code)`
- Gera um sinal usando seed do código
- Seleciona ativo de forma determinística

#### `initialize_signals_with_code(p_supporter_code)`
- Inicializa 3 sinais ativos com código
- **Nota**: Pode ser usado para admin resetar sinais

### 4. Integração Frontend

#### Service `realtimeSignals` (Dashboard - 3 sinais)

```typescript
// Busca código do localStorage
const supporterCode = this.getSupporterCode();

// Chama RPC com código
supabase.rpc('get_active_signals_with_code', {
  p_supporter_code: supporterCode
});

// Cache separado por código
const STORAGE_KEY = `realtime_signals_cache_${supporterCode || 'DEFAULT'}`;
```

#### Hook `useExtendedSignals` (Aba Trades - 7 sinais)

```typescript
// Busca código do localStorage
const prefs = localStorage.getItem('trader_preferences');
const supporterCode = prefs?.supporter_code || null;

// Chama RPC com código
supabase.rpc('get_extended_signals_with_code', {
  p_supporter_code: supporterCode
});

// Cache separado por código
const STORAGE_KEY = `extended_signals_cache_${supporterCode || 'DEFAULT'}`;
```

## 📊 Exemplo de Uso

### Usuário sem código (DEFAULT)
```
Dashboard (Posições 1-3): EOS, US30, EUR/AUD
Trades (Posições 1-7): EOS, US30, EUR/AUD, CHF/NOK, RNDR, USD/XOF, TSLA/F
```

### Usuário com código "TRADER123"
```
Dashboard (Posições 1-3): CAD/JPY, CHF/NOK, USD/JPY
Trades (Posições 1-7): CAD/JPY, CHF/NOK, USD/JPY, RNDR, ONDO, WTI, MATIC
```

### Outro usuário com código "TRADER123"
```
Dashboard (Posições 1-3): CAD/JPY, CHF/NOK, USD/JPY (mesmos!)
Trades (Posições 1-7): CAD/JPY, CHF/NOK, USD/JPY, RNDR, ONDO, WTI, MATIC (mesmos!)
```

### Usuário com código "OUTRO_CODIGO"
```
Dashboard (Posições 1-3): GRT, USD/NOK, JUP (diferentes!)
Trades (Posições 1-7): GRT, USD/NOK, JUP, + 4 sinais adicionais (diferentes!)
```

## 🔒 Características Importantes

1. **Determinismo Total**: Mesma seed sempre gera mesmos sinais para TODAS as posições
2. **Variação Sutil**: Apenas ativos e ordem mudam, não horários
3. **Ativos Disponíveis**: Respeitam `is_active` e horários de trading
4. **Sem Repetição**: Dentro de um mesmo conjunto de 7 sinais, ativos não se repetem
5. **Rotação Diária**: Sinais mudam a cada dia (seed inclui data)
6. **Consistência**: Usuários com mesmo código veem exatamente os mesmos sinais
7. **Cache Separado**: Cada código tem seu próprio cache no localStorage

## 🧪 Testando

### Testar função de seed
```sql
SELECT get_asset_selection_seed('TRADER123', CURRENT_DATE, 1);
-- Retorna: TRADER123_20260317_1

SELECT get_asset_selection_seed(NULL, CURRENT_DATE, 1);
-- Retorna: DEFAULT_20260317_1
```

### Testar 3 sinais principais
```sql
SELECT * FROM unnest(get_active_signals_with_code('TRADER123'));
SELECT * FROM unnest(get_active_signals_with_code(NULL)); -- DEFAULT
SELECT * FROM unnest(get_active_signals_with_code('OUTRO_CODIGO'));
```

### Testar 7 sinais (completo)
```sql
SELECT * FROM unnest(get_extended_signals_with_code('TRADER123'));
SELECT * FROM unnest(get_extended_signals_with_code(NULL)); -- DEFAULT
```

### Verificar consistência (primeiros 3 sinais devem ser iguais)
```sql
-- Sinais principais
SELECT symbol FROM unnest(get_active_signals_with_code('TRADER123'));

-- Primeiros 3 sinais da função extendida
SELECT symbol, position 
FROM unnest(get_extended_signals_with_code('TRADER123'))
WHERE position <= 3;

-- Devem retornar os mesmos símbolos na mesma ordem!
```

## 📝 Notas de Implementação

### Por que TODOS os sinais variam agora?
- Solicitação do usuário para que cada código de apoiador tenha sua experiência única
- Todos os usuários com mesmo código veem exatamente os mesmos sinais
- Permite criar "grupos" de usuários por código

### Como funciona o cache?
- Cada código tem seu próprio cache no `localStorage`
- Formato Dashboard: `realtime_signals_cache_${codigo}`
- Formato Trades: `extended_signals_cache_${codigo}`
- Versão do cache: 3.1

### Performance
- Hash MD5 é rápido e determinístico
- Não há consultas adicionais ao banco
- Funciona totalmente no lado do servidor (Postgres)
- RPC retorna JSON já formatado

### Sincronização
- Dashboard e Trades usam a mesma lógica para posições 1-3
- Garante que os sinais sejam consistentes entre as abas
- Realtime subscription funciona independente do código

## 🚀 Próximos Passos

Se necessário expandir:
1. Adicionar mais fatores de variação (horários, tipos)
2. Criar grupos de códigos (VIP, Premium, etc)
3. Implementar algoritmo de "força" de sinal baseado no código
4. Adicionar analytics para rastrear performance por código

## 📚 Arquivos Modificados

- `migrations/009_signals_by_supporter_code.sql` - Novas funções SQL
- `src/services/realtimeSignals.ts` - Service para 3 sinais principais (Dashboard)
- `src/hooks/useExtendedSignals.ts` - Hook para 7 sinais (Trades)
- `docs/SIGNALS_BY_SUPPORTER_CODE.md` - Esta documentação

## 🔄 Fluxo Completo

1. **Usuário define código de apoiador** → Salvo em `localStorage` (`trader_preferences`)
2. **Frontend lê código** → `getSupporterCode()` busca do localStorage
3. **Chama RPC com código** → `get_active_signals_with_code(codigo)` ou `get_extended_signals_with_code(codigo)`
4. **Postgres gera seed** → `get_asset_selection_seed(codigo, data, posicao)`
5. **Seleciona ativos** → `ORDER BY md5(symbol || seed)` (determinístico)
6. **Retorna sinais** → JSON com 3 ou 7 sinais
7. **Frontend cacheia** → Cache separado por código
8. **Realtime updates** → Mesma lógica para todos os códigos
