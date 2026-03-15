# Instruções para Migração do Banco de Dados

## 📋 Passo a Passo

### 1. Acessar o Supabase Dashboard
- Acesse: https://supabase.com/dashboard
- Faça login na sua conta
- Selecione o projeto "Treding" (bzfrbmdjrjzstljrkppb)

### 2. Executar a Migração SQL
- No menu lateral, clique em **"SQL Editor"**
- Clique em **"New query"**
- Copie todo o conteúdo do arquivo `migrations/create_streamer_posts_and_schedules.sql`
- Cole no editor SQL
- Clique em **"Run"** (ou pressione Ctrl + Enter)

### 3. Verificar a Criação das Tabelas
Após executar, você pode verificar se as tabelas foram criadas corretamente:

```sql
-- Ver as tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('streamer_posts', 'post_reactions', 'stream_schedules');
```

### 4. Funcionalidades Implementadas

#### ✅ Postagens dos Traders
- Traders podem criar postagens em seus perfis
- Usuários podem reagir às postagens (like, love, fire, star)
- Traders podem deletar suas próprias postagens
- Reações em tempo real

#### ✅ Horários de Lives
- Traders podem definir horários regulares por dia da semana
- Visual de calendário minimalista e clean
- Fácil edição clicando no dia
- Remoção de horários

#### ✅ Melhorias no Perfil
- Removido o botão "Editar Perfil"
- Removido os três pontos (MoreVertical)
- Removido "Trader:" do código de apoiador
- Interface mais limpa e profissional

## 🎨 Novo Layout

### Card de Código de Apoiador
```
┌────────────────────────────────────┐
│ Código de Apoiador: [CODIGO123]   │
└────────────────────────────────────┘

  0           |       0        |    --
Seguidores    |  Apoiadores   | Ranking
```

### Tabs
- **Postagens**: Criar e visualizar postagens + reações
- **Sobre**: Informações do trader
- **Horários**: Calendário semanal de lives
- **Ranking**: Rankings (Geral, Mensal, Semanal)

## 🔒 Segurança (RLS)
Todas as tabelas têm Row Level Security habilitado:
- Qualquer um pode **ver** postagens, reações e horários ativos
- Apenas os **donos** podem **criar/editar/deletar** seus próprios conteúdos
- Usuários autenticados podem adicionar reações

## 📝 Tabelas Criadas

### `streamer_posts`
- Armazena as postagens dos traders
- Campos: id, streamer_id, content, media_url, created_at, updated_at

### `post_reactions`
- Armazena as reações às postagens
- Campos: id, post_id, user_id, reaction_type, created_at
- Tipos de reação: 'like', 'love', 'fire', 'star'

### `stream_schedules`
- Armazena os horários regulares de live
- Campos: id, streamer_id, day_of_week (0-6), start_time, end_time, description, is_active
- Um horário por dia da semana por trader

## ✨ Pronto!
Após executar a migração, todas as funcionalidades estarão 100% operacionais!
