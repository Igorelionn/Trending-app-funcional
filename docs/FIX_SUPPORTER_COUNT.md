# Problema: Contador de Apoiadores Não Contabilizando

## Descrição do Problema
O contador de apoiadores na página de perfil do streamer estava sempre mostrando "0 Apoiadores", mesmo quando usuários configuravam o código de apoiador.

## Causa Raiz
Havia múltiplos problemas:

1. **Falta de Registro no Banco**: Quando um usuário configurava um código de apoiador, isso era salvo apenas no `localStorage`, mas não era registrado na tabela `supporter_code_usage` do banco de dados.

2. **Função Usando Admin Client Incorreto**: A função `registerSupporterCodeUsage` estava usando `adminClient()` ao invés do client normal do Supabase, o que causava problemas de autenticação.

3. **Políticas RLS Incompletas**: A tabela `supporter_code_usage` tinha políticas RLS que permitiam INSERT, mas não UPDATE. Como estávamos usando `upsert`, a atualização de registros existentes falhava.

4. **Falta de Validação de Usuário Próprio**: Não havia validação para impedir que um trader usasse seu próprio código de apoiador.

## Solução Implementada

### 1. Criada Função de Registro (`src/lib/admin-api.ts`)
```typescript
export const registerSupporterCodeUsage = async (code: string)
```

Esta função:
- Valida se o usuário está autenticado
- Busca o código e o trader_id no banco
- Verifica se o trader não está usando seu próprio código
- Registra o uso na tabela `supporter_code_usage` usando `upsert`
- Adiciona logs detalhados para debugging

### 2. Integração no Componente (`TraderSupportSettings.tsx`)
A função é chamada automaticamente em dois momentos:
- Quando o usuário digita e valida um código novo
- Quando as preferências são carregadas (ao abrir a página de configurações)

### 3. Migração de Banco de Dados
Criado arquivo: `migrations/011_fix_supporter_code_usage_policies_EXECUTAR_NO_SUPABASE.sql`

Esta migração:
- Remove a política antiga de INSERT que permitia usuários anônimos
- Cria política de INSERT apenas para usuários autenticados
- Adiciona política de UPDATE para permitir `upsert`
- Garante que usuários só possam atualizar seus próprios registros

### 4. Correção do Contador no Perfil
Corrigido em `src/pages/StreamerProfile.tsx`:
```typescript
supporters_count: boostedSupporters  // Antes estava: 0
```

## Como Testar

1. **Executar a migração**:
   - Acesse o Supabase Dashboard
   - Vá em SQL Editor
   - Execute o script `migrations/011_fix_supporter_code_usage_policies_EXECUTAR_NO_SUPABASE.sql`

2. **Testar o fluxo**:
   - Faça login como um usuário
   - Vá em Configurações > Apoio ao Trader
   - Digite um código de apoiador válido (ex: IGOR)
   - Verifique no console do navegador os logs de sucesso
   - Acesse o perfil do trader dono do código
   - O contador de apoiadores deve mostrar "1 Apoiador"

3. **Verificar no banco**:
   ```sql
   SELECT * FROM supporter_code_usage;
   ```

## Logs de Debug
A solução inclui logs detalhados no console:
- `🔍 Validando código: IGOR`
- `✅ Código válido, registrando uso...`
- `✅ Uso do código registrado com sucesso!`
- `❌ Erro ao registrar uso: [mensagem de erro]`

## Estrutura da Tabela
```sql
supporter_code_usage
├── id (UUID)
├── code_id (UUID) -> supporter_codes.id
├── user_id (UUID) -> auth.users.id (quem está usando o código)
├── trader_id (UUID) -> auth.users.id (dono do código)
├── used_at (TIMESTAMP)
└── CONSTRAINT unique_user_code UNIQUE(user_id, code_id)
```

## Próximos Passos
- Testar com múltiplos usuários
- Verificar se o contador atualiza em tempo real
- Considerar adicionar um webhook para notificar traders quando recebem novos apoiadores
