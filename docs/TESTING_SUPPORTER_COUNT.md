# Instruções para Testar o Contador de Apoiadores

## ✅ Migração Aplicada
A migração foi aplicada com sucesso via MCP Supabase!

## Como Testar

### 1. Abrir o Aplicativo
- Acesse http://localhost:8090 (ou a porta configurada)
- Faça login com sua conta

### 2. Configurar o Código de Apoiador

1. Vá em **Configurações** (ícone de engrenagem no menu lateral)
2. Clique na seção **"Apoio ao Trader"**
3. Digite o código: `IGOR`
4. Aguarde a validação (você verá um ✓ verde)

### 3. Verificar os Logs no Console

Abra o Console do Navegador (F12 > Console) e você verá:

```
🔍 Validando código: IGOR
✅ Código válido, registrando uso...
✅ Registrando uso do código: {code: "IGOR", code_id: "...", user_id: "...", trader_id: "..."}
✅ Uso do código registrado com sucesso!
```

### 4. Verificar o Contador no Perfil

1. Vá na página **"Ao Vivo"**
2. Clique no perfil de **Igor Elion**
3. No card do perfil, você deve ver:
   - **0 Seguidores** (ou número atual)
   - **1 Apoiador** (incrementado!)
   - **Ranking Geral**: --

### 5. Verificar no Banco de Dados

Via MCP ou SQL Editor do Supabase:

```sql
-- Ver registros de uso
SELECT 
  scu.*,
  sc.code,
  up_trader.display_name as trader_name,
  up_user.display_name as user_name
FROM supporter_code_usage scu
LEFT JOIN supporter_codes sc ON scu.code_id = sc.id
LEFT JOIN user_profiles up_trader ON scu.trader_id = up_trader.user_id
LEFT JOIN user_profiles up_user ON scu.user_id = up_user.user_id
ORDER BY scu.used_at DESC;
```

Você deve ver um registro com:
- `code`: IGOR
- `trader_name`: Igor Elion
- `user_name`: [seu nome]
- `used_at`: [timestamp atual]

## Possíveis Problemas

### ❌ "Usuário não autenticado"
**Solução**: Faça logout e login novamente

### ❌ "Código não encontrado"
**Solução**: Verifique se o código está em MAIÚSCULAS (IGOR, não igor)

### ❌ "Não pode usar seu próprio código"
**Solução**: Isso é esperado! O trader não pode usar o próprio código. Teste com outro usuário.

### ❌ Contador ainda mostra "0 Apoiadores"
**Solução**: 
1. Verifique os logs no console
2. Force refresh da página (Ctrl+Shift+R)
3. Verifique no banco se o registro foi criado

## Testando com Múltiplos Usuários

1. Use o código com Usuário 1 → Contador = 1
2. Use o código com Usuário 2 → Contador = 2
3. Usuário 1 usa novamente → Contador continua 2 (upsert, não duplica)

## Logs Importantes

Os logs no console mostram exatamente o que está acontecendo:
- 🔍 = Validando
- ✅ = Sucesso
- ❌ = Erro (com detalhes)

Se encontrar problemas, copie os logs do console e compartilhe!
