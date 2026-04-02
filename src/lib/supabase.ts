import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { PostgrestError, PostgrestFilterBuilder } from '@supabase/postgrest-js';

// Variáveis para armazenar as instâncias singleton com verificação mais robusta
// 🔥 Mudado de const para let para permitir atualização
let _supabaseInstance: SupabaseClient<Database> | null = null;
let _supabaseNoPKCEInstance: SupabaseClient<Database> | null = null;
let _supabaseAdminInstance: SupabaseClient<Database> | null = null;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://arkrjextwpwqhrvcijyr.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFya3JqZXh0d3B3cWhydmNpanlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MDM4OTUsImV4cCI6MjA4NDQ3OTg5NX0.qAmrahULxsyZsmwwSR1FbEclNMwLe-vnUeAvpxDTdkY';

// DEBUG - Configuração Supabase (silenciado)

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key são obrigatórios');
}

// Limpar dados antigos do projeto anterior (trbbmwtiggmkzvrliomr)
if (typeof window !== 'undefined') {
  const oldProjectId = 'trbbmwtiggmkzvrliomr.supabase.co';
  const localKeysToRemove: string[] = [];
  const sessionKeysToRemove: string[] = [];
  
  // Procurar por todas as chaves no localStorage que contenham o ID do projeto antigo
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes(oldProjectId)) {
      localKeysToRemove.push(key);
    }
  }
  
  // Procurar por todas as chaves no sessionStorage que contenham o ID do projeto antigo
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.includes(oldProjectId)) {
      sessionKeysToRemove.push(key);
    }
  }
  
  // Remover as chaves antigas do localStorage
  if (localKeysToRemove.length > 0) {
    console.log(`🧹 Limpando ${localKeysToRemove.length} chaves antigas do localStorage...`);
    localKeysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`   Removido: ${key}`);
    });
  }
  
  // Remover as chaves antigas do sessionStorage
  if (sessionKeysToRemove.length > 0) {
    console.log(`🧹 Limpando ${sessionKeysToRemove.length} chaves antigas do sessionStorage...`);
    sessionKeysToRemove.forEach(key => {
      sessionStorage.removeItem(key);
      console.log(`   Removido: ${key}`);
    });
  }
  
  if (localKeysToRemove.length > 0 || sessionKeysToRemove.length > 0) {
    console.log('✅ Limpeza de dados antigos concluída!');
  }
}

// Implementação de Proxy para lazy loading e melhor handling de erros
function createLazySupabaseClient(type: 'regular' | 'admin' | 'noPKCE') {
  let instance: SupabaseClient<Database> | null = null;
  
  // Criar uma função de handler para o Proxy
  const handler = {
    get(target: Record<string, unknown>, prop: string) {
      // Inicializar instância sob demanda
      if (!instance) {
        // 🔥 VERIFICAR se já existe instância global antes de criar nova
        if (typeof window !== 'undefined') {
          const globalKey = type === 'regular' ? '__supabase_client' : type === 'admin' ? '__supabase_admin' : '__supabase_noPKCE';
          const existingInstance = (window as unknown as Record<string, unknown>)[globalKey] as SupabaseClient<Database> | null;
          
          if (existingInstance) {
            // Reutilizando instância
            instance = existingInstance;
            return instance[prop as keyof SupabaseClient];
          }
        }
        
        // Criando cliente Supabase
        try {
          switch (type) {
            case 'regular': {
              // Extrair o project ref da URL para usar no storageKey
              const projectRef = supabaseUrl.split('//')[1].split('.')[0];
              // Usando storageKey
              
              instance = createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                  storage: window.localStorage,
                  storageKey: `sb-${projectRef}-auth-token`,
                  autoRefreshToken: true,
                  persistSession: true,
                  detectSessionInUrl: true
                },
                global: {
                  headers: {
                    'X-Client-Info': 'supabase-js-web'
                  }
                }
              });
              // Salvar referência global para evitar múltiplas instâncias
              if (typeof window !== 'undefined') {
                (window as unknown as Record<string, unknown>).__supabase_client = instance;
                _supabaseInstance = instance;
              }
              break;
            }
              
            case 'admin': {
              // ⚠️ A service role key NUNCA deve ter fallback hardcoded aqui.
              // Configure VITE_SUPABASE_SERVICE_ROLE_KEY no arquivo .env
              const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
              
              instance = createClient(supabaseUrl, serviceRoleKey, {
                auth: {
                  autoRefreshToken: false,
                  persistSession: false,
                  storageKey: 'supabase-auth-admin'
                },
                global: {
                  headers: {
                    'X-Client-Info': 'supabase-js-admin'
                  }
                }
              });
              // Salvar referência global para evitar múltiplas instâncias
              if (typeof window !== 'undefined') {
                (window as unknown as Record<string, unknown>).__supabase_admin = instance;
                _supabaseAdminInstance = instance;
              }
              break;
            }
              
            case 'noPKCE':
              instance = createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                  persistSession: false,
                  autoRefreshToken: false,
                  detectSessionInUrl: false,
                  flowType: 'implicit',
                  debug: false,
                  storageKey: 'supabase-auth-nopkce'
                },
                global: {
                  headers: {
                    'X-Client-Info': 'supabase-js-nopkce'
                  }
                }
              });
              // Salvar referência global para evitar múltiplas instâncias
              if (typeof window !== 'undefined') {
                (window as unknown as Record<string, unknown>).__supabase_nopkce = instance;
                _supabaseNoPKCEInstance = instance;
              }
              break;
          }
        } catch (error) {
          console.error(`❌ Erro ao criar cliente Supabase (${type}):`, error);
          throw new Error(`Falha ao inicializar cliente Supabase (${type})`);
        }
      }
      
      // Interceptar métodos específicos para adicionar tratamento de erros
      if (prop === 'auth' && instance[prop]) {
        // Proxy para métodos de autenticação
        return new Proxy(instance[prop], {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          get(authTarget: any, authMethod: string) {
            const original = authTarget[authMethod];
            if (typeof original === 'function') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return async (...args: any[]) => {
                try {
                  // Adicionar retry para métodos de autenticação
                  let attempts = 0;
                  const maxAttempts = 3;
                  let lastError = null;
                  
                  while (attempts < maxAttempts) {
                    try {
                      // Tentando auth
                      const result = await original.apply(authTarget, args);
                      // Auth bem-sucedido
                      return result;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } catch (error: any) {
                      lastError = error;
                      attempts++;
                      
                      console.error(`❌ Erro na tentativa ${attempts} de auth.${String(authMethod)}:`, {
                        message: error?.message,
                        status: error?.status,
                        name: error?.name,
                        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
                      });
                      
                      // Verificar se vale a pena tentar novamente
                      const shouldRetry = error?.status >= 500 || // Erros de servidor
                                          error?.status === 429 || // Rate limit
                                          error?.message?.includes('network'); // Erros de rede
                      
                      if (!shouldRetry || attempts >= maxAttempts) {
                        console.error(`⛔ Todas as tentativas falharam para auth.${String(authMethod)}`);
                        break; // Não tenta mais
                      }
                      
                      // Espera exponencial entre tentativas
                      const delay = 1000 * Math.pow(2, attempts - 1);
                      console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
                      await new Promise(r => setTimeout(r, delay));
                    }
                  }
                  
                  // Se chegou aqui, todas as tentativas falharam
                  throw lastError;
                } catch (error) {
                  console.error(`❌ Erro em auth.${String(authMethod)}:`, error);
                  throw error;
                }
              };
            }
            return original;
          }
        });
      }
      
      return instance[prop];
    }
  };
  
  return new Proxy({}, handler);
}

// Usar Proxy para lazy-loading e evitar instanciação prematura
export const getSupabase = (): SupabaseClient<Database> => {
  // Verificar se já temos uma instância global
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__supabase_client) {
    return (window as unknown as Record<string, unknown>).__supabase_client as unknown as SupabaseClient<Database>;
  }

  // Retornar proxy que criará cliente quando necessário
  return createLazySupabaseClient('regular') as unknown as SupabaseClient<Database>;
};

// Cliente admin via proxy - VERSÃO UNIFICADA
export const getSupabaseAdmin = (): SupabaseClient<Database> => {
  // Verificar se já temos uma instância global
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__supabase_admin) {
    return (window as unknown as Record<string, unknown>).__supabase_admin as unknown as SupabaseClient<Database>;
  }

  // Retornar proxy que criará cliente quando necessário
  return createLazySupabaseClient('admin') as unknown as SupabaseClient<Database>;
};

// Cliente sem PKCE via proxy
export const getSupabaseNoPKCE = (): SupabaseClient<Database> => {
  // Verificar se já temos uma instância global
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__supabase_nopkce) {
    return (window as unknown as Record<string, unknown>).__supabase_nopkce as unknown as SupabaseClient<Database>;
  }

  // Retornar proxy que criará cliente quando necessário
  return createLazySupabaseClient('noPKCE') as unknown as SupabaseClient<Database>;
};

// Manter exportação do cliente direto para compatibilidade retroativa
// mas usando proxy sob o capô
export const supabase: SupabaseClient<Database> = getSupabase();


// Função para verificar se uma tabela existe
export const doesTableExist = async (tableName: keyof Database['public']['Tables'] | string): Promise<boolean> => {
  try {
    const supabase = getSupabase();
    
    if (tableName === 'user_profiles') {
      return true;
    }
    
    const { error } = await (supabase as SupabaseClient<Database>)
      .from(tableName as keyof Database['public']['Tables'])
      .select('*', { count: 'exact', head: true })
      .limit(1);

    return !error;
  } catch (error) {
    console.error(`Erro ao verificar tabela ${tableName}:`, error);
    return false;
  }
};

// Função para salvar informações do usuário de forma resiliente
export const saveSafeUserData = async (userId: string, data: Record<string, unknown>): Promise<void> => {
  try {
    // Verifica se a tabela de perfis existe
    const userProfilesExist = await doesTableExist('user_profiles');
    
    if (userProfilesExist) {
      try {
        // Tenta atualizar o perfil do usuário
        // Utilizando o cliente admin para garantir acesso
        const { error: updateError } = await (getSupabaseAdmin() as SupabaseClient<Database>)
          .from('user_profiles')
          .upsert({
            user_id: userId,
            ...data,
            updated_at: new Date().toISOString()
          });
        
        if (updateError) {
          console.warn('Erro ao atualizar perfil do usuário:', updateError);
        }
      } catch (updateError) {
        console.error('Erro ao atualizar perfil:', updateError);
      }
    } else {
      console.warn('Tabela user_profiles não existe. Dados do usuário não serão salvos.');
    }
  } catch (error) {
    console.error('Erro ao salvar dados do usuário:', error);
  }
};

/**
 * Função específica para salvar o avatar do usuário tanto nos metadados da autenticação 
 * quanto na tabela user_profiles para garantir persistência completa
 * 
 * @param userId ID do usuário
 * @param avatarUrl URL do avatar
 * @returns Promise com o resultado da operação
 */
export const saveUserAvatar = async (userId: string, avatarUrl: string): Promise<{success: boolean; error: string | null}> => {
  try {
    if (!userId || !avatarUrl) {
      return { success: false, error: "ID do usuário ou URL do avatar inválidos" };
    }
    
    console.log(`Salvando avatar para usuário ${userId}`);
    
    // ✅ OTIMIZAÇÃO: NÃO atualizar auth.updateUser() aqui para evitar rate limit
    // A atualização dos metadados será feita UMA ÚNICA VEZ no userPersistence.ts
    
    // 1. Atualizar APENAS a tabela user_profiles
    let profileError = null;
    try {
      const { error } = await (getSupabase() as SupabaseClient<Database>).from('user_profiles')
        .upsert({
          user_id: userId,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'user_id' 
        });
      
      profileError = error;
      
      // Se houver erro 401/403, tentar com cliente admin
      if (error && (error.code === '401' || error.code === '403' || error.code === 'PGRST301')) {
        console.warn('Tentando salvar avatar com cliente admin devido a erro de autorização');
        
        const { error: adminError } = await (getSupabaseAdmin() as SupabaseClient<Database>)
          .from('user_profiles')
          .upsert({
            user_id: userId,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
          }, { 
            onConflict: 'user_id' 
          });
        
        profileError = adminError;
      }
    } catch (error) {
      profileError = error;
    }
    
    if (profileError) {
      console.error("Erro ao atualizar avatar na tabela user_profiles:", profileError);
      return { success: false, error: profileError };
    }
    
    // Se chegou aqui, a operação foi bem-sucedida
    return { 
      success: true, 
      error: null 
    };
  } catch (error) {
    console.error("Erro inesperado ao salvar avatar:", error);
    return { success: false, error };
  }
};

/**
 * Função específica para salvar o nome de exibição do usuário
 * 
 * @param userId ID do usuário
 * @param displayName Nome de exibição do usuário
 * @returns Promise com o resultado da operação
 */
export const saveUserDisplayName = async (userId: string, displayName: string): Promise<{success: boolean; error: string | null}> => {
    if (!userId || !displayName) {
    console.error("ID de usuário ou nome de exibição vazios");
    return { success: false, error: "ID de usuário ou nome de exibição vazios" };
  }
  
  // Validar comprimento do nome
  if (displayName.length < 2 || displayName.length > 30) {
    console.error("Nome de exibição deve ter entre 2 e 30 caracteres");
    return { success: false, error: "Nome de exibição deve ter entre 2 e 30 caracteres" };
    }

  try {
    // Verificar se há caracteres inválidos ou problemas de truncamento
    const displayNameToSave = displayName.trim();

    if (import.meta.env.DEV) {
      // Salvando nome (silenciado)
    }
    
    // 1. Atualizar metadados do usuário
    let authError = null;
    try {
      const { error } = await (getSupabase() as SupabaseClient<Database>).auth.updateUser({
        data: { display_name: displayNameToSave }
      });
      authError = error;
    } catch (error) {
      console.error("Erro ao atualizar nome nos metadados:", authError);
    }

    // 2. Atualizar a tabela user_profiles para persistência completa
    let profileError = null;
    try {
      // CORREÇÃO: Usando a sintaxe correta para upsert no Supabase v2
      const { error } = await (getSupabase() as SupabaseClient<Database>)
        .from('user_profiles')
        .upsert({
        user_id: userId,
        display_name: displayNameToSave,
        updated_at: new Date().toISOString()
        }, { 
          onConflict: 'user_id' 
        });

      // Se houver erro 401/403, tentar com cliente admin
      if (error?.code === '401' || error?.code === '403' || error?.code === 'PGRST301') {
        console.warn('Tentando salvar nome com cliente admin devido a erro de autorização');
        // CORREÇÃO: Mesma sintaxe correta para o cliente admin
        const { error: adminError } = await (getSupabaseAdmin() as SupabaseClient<Database>)
          .from('user_profiles')
          .upsert({
          user_id: userId,
          display_name: displayNameToSave,
          updated_at: new Date().toISOString()
          }, { 
            onConflict: 'user_id' 
          });

        profileError = adminError;
      } else {
        profileError = error;
      }
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      profileError = error;
    }

    // Atualizar localStorage e disparar evento mesmo se houver erros parciais
    localStorage.setItem("user-name", displayNameToSave);
    
    try {
      window.dispatchEvent(new CustomEvent('username-updated', { 
        detail: { 
          userName: displayNameToSave, 
          fromSave: true, 
          originalLength: displayNameToSave.length 
        }
      }));
    } catch (eventError) {
      console.warn("Erro ao disparar evento:", eventError);
    }

    // Uma verificação final para garantir que o valor no localStorage permanece consistente
    const finalSavedValue = localStorage.getItem("user-name");
    if (finalSavedValue !== displayNameToSave) {
      console.warn("AVISO: O valor no localStorage foi alterado durante o salvamento!");
      localStorage.setItem("user-name", displayNameToSave);
    }

    return { 
      success: true, 
      error: (authError || profileError) ? "Nome salvo parcialmente" : null
    };
  } catch (error) {
    console.error("Erro inesperado ao salvar nome:", error);
    
    // Mesmo com erro, garantir que o localStorage esteja atualizado
    if (displayName) {
      localStorage.setItem("user-name", displayName);
      
      try {
        window.dispatchEvent(new CustomEvent('username-updated', { 
          detail: { 
            userName: displayName, 
            fromSave: true, 
            originalLength: displayName.length 
          }
        }));
      } catch (eventError) {
        console.warn("Erro ao disparar evento:", eventError);
      }
    }
    
    return { success: false, error };
  }
};

/**
 * Executa SQL diretamente no banco de dados
 * Usa a função exec_sql criada no banco de dados
 */
export const execSQL = async (sql: string): Promise<{ success: boolean; error: string | null }> => {
  try {
    console.log('Executando SQL: ', sql);
    
    const { error } = await (getSupabaseAdmin() as SupabaseClient<Database>).rpc('exec_sql', { sql });
    
    if (error) {
      console.error(`Erro ao executar SQL (${error.code}):`, error);
      return { success: false, error: error.message || 'Erro ao executar SQL' };
    }
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao executar SQL:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao executar SQL' };
  }
};
