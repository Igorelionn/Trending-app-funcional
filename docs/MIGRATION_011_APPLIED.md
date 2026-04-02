# Migração Aplicada com Sucesso via MCP Supabase

## Migração: `011_fix_supporter_code_usage_policies`

### Status: ✅ Concluída

### Data de Aplicação: 2026-03-17

### O que foi alterado:

1. **Removida política antiga**:
   - `"Qualquer um pode registrar uso de código"` (permitia usuários anônimos)

2. **Criadas novas políticas**:
   - `"Usuários autenticados podem registrar e atualizar uso de código"` (INSERT)
     - Apenas usuários autenticados
     - Verifica `user_id = auth.uid()`
   
   - `"Usuários podem atualizar seu próprio uso de código"` (UPDATE)
     - Permite upsert de registros existentes
     - Usuário só pode atualizar seus próprios registros

3. **Políticas mantidas**:
   - `"Traders podem ver seus apoiadores"` (SELECT)
   - `"Admins podem ver tudo"` (ALL)

### Verificação das Políticas

Executado via MCP:
```sql
SELECT * FROM pg_policies WHERE tablename = 'supporter_code_usage';
```

Resultado: 4 políticas ativas
- ✅ Admins podem ver tudo (ALL)
- ✅ Traders podem ver seus apoiadores (SELECT)
- ✅ Usuários autenticados podem registrar e atualizar uso de código (INSERT)
- ✅ Usuários podem atualizar seu próprio uso de código (UPDATE)

### Estado Atual do Banco

**Códigos de Apoiador Ativos**: 6 códigos
- IGOR (vinculado a Igor Elion - user_id: 5e4e6dcf-0ce5-49ac-9b1b-a5b4f89e2473)
- GIOBRANDI
- HURUS
- ASTRO
- BO
- PAIDOGAREL

**Registros de Uso**: 0 (tabela vazia, esperado antes dos testes)

### Próximos Passos

1. Testar o registro de uso do código pelo frontend
2. Verificar se o contador de apoiadores atualiza corretamente
3. Validar os logs no console do navegador

### Comando MCP Utilizado

```typescript
CallMcpTool({
  server: "user-supabase",
  toolName: "apply_migration",
  arguments: {
    project_id: "arkrjextwpwqhrvcijyr",
    name: "fix_supporter_code_usage_policies",
    query: "..." // SQL completo
  }
})
```

### Resultado
```json
{"success": true}
```
