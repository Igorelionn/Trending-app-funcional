import { supabase, doesTableExist, getSupabaseAdmin } from '@/lib/supabase';
import type { UserProfile, Session, Provider } from '@/types/auth';
import { v4 as uuidv4 } from 'uuid';
import { initDatabase, syncUserEmail } from '@/lib/db-helpers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Serviço para gerenciar usuários no PostgreSQL via Supabase
export const userService = {
  /**
   * Verificar e inicializar tabelas necessárias
   */
  initialized: false,
  
  async init() {
    if (this.initialized) return;
    
    try {
      // Inicializar o banco de dados garantindo todas as colunas necessárias
      await initDatabase();
      
      // Definir como inicializado para não repetir a verificação
      this.initialized = true;
    } catch (error) {
      console.error('Erro ao inicializar serviço de usuários:', error);
    }
  },

  /**
   * Gerar e obter identificação única do dispositivo
   */
  getDeviceIdentifier(): string {
    let deviceId = localStorage.getItem('device-id');
    
    if (!deviceId) {
      // Gerar um ID único para o dispositivo se não existir
      deviceId = uuidv4();
      localStorage.setItem('device-id', deviceId);
    }
    
    return deviceId;
  },
  
  /**
   * Obter IP do dispositivo através de um serviço externo
   */
  async getDeviceIP(): Promise<string> {
    try {
      // Verificar se temos o IP em cache
      const cachedIP = localStorage.getItem('device-ip');
      const lastIPCheck = localStorage.getItem('last-ip-check');
      const now = Date.now();
      
      // Se temos um IP em cache e foi atualizado nas últimas 24 horas, usá-lo
      if (cachedIP && lastIPCheck && (now - parseInt(lastIPCheck)) < 24 * 60 * 60 * 1000) {
        return cachedIP;
      }
      
      // Obter o IP atual
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      
      if (data && data.ip) {
        // Salvar o IP no cache
        localStorage.setItem('device-ip', data.ip);
        localStorage.setItem('last-ip-check', now.toString());
        return data.ip;
      }
      
      // Se não conseguir obter o IP, usar o que temos em cache
      return cachedIP || 'unknown';
    } catch (error) {
      console.error('Erro ao obter IP do dispositivo:', error);
      // Em caso de erro, usar o IP em cache ou marcá-lo como desconhecido
      return localStorage.getItem('device-ip') || 'unknown';
    }
  },
  
  /**
   * Verificar se o dispositivo atual está autorizado para o usuário
   */
  async isAuthorizedDevice(userId: string): Promise<boolean> {
    try {
      // Obter identificadores do dispositivo atual
      const deviceId = this.getDeviceIdentifier();
      const deviceIP = await this.getDeviceIP();
      
      // Verificar se temos dados sobre dispositivos autorizados
      const authorizedDevices = localStorage.getItem(`auth-devices-${userId}`);
      if (!authorizedDevices) return false;
      
      // Analisar os dispositivos autorizados
      const devices = JSON.parse(authorizedDevices);
      
      // Verificar se o dispositivo atual está na lista
      return devices.some((device: Record<string, unknown>) => 
        device.deviceId === deviceId || 
        device.ip === deviceIP
      );
    } catch (error) {
      console.error('Erro ao verificar autorização do dispositivo:', error);
      return false;
    }
  },
  
  /**
   * Salvar o dispositivo como autorizado para o usuário
   */
  async saveAuthorizedDevice(userId: string): Promise<void> {
    try {
      // Obter identificadores do dispositivo atual
      const deviceId = this.getDeviceIdentifier();
      
      // 🔥 OTIMIZAÇÃO: getDeviceIP com timeout de 2s para não bloquear login
      let deviceIP = 'unknown';
      try {
        const ipPromise = this.getDeviceIP();
        const timeoutPromise = new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('IP timeout')), 2000)
        );
        deviceIP = await Promise.race([ipPromise, timeoutPromise]);
      } catch (ipError) {
        console.warn('⚠️ Timeout ao buscar IP, usando cached ou unknown:', ipError);
        deviceIP = localStorage.getItem('device-ip') || 'unknown';
      }
      
      // Obter lista de dispositivos autorizados
      const authorizedDevicesStr = localStorage.getItem(`auth-devices-${userId}`);
      const devices = authorizedDevicesStr ? JSON.parse(authorizedDevicesStr) : [];
      
      // Verificar se este dispositivo já está autorizado
      const deviceExists = devices.some((device: Record<string, unknown>) => 
        device.deviceId === deviceId || device.ip === deviceIP
      );
      
      if (!deviceExists) {
        // Adicionar o dispositivo à lista
        devices.push({
          deviceId,
          ip: deviceIP,
          name: navigator.userAgent,
          lastUsed: new Date().toISOString(),
          authorized: true
        });
        
        // Salvar a lista atualizada
        localStorage.setItem(`auth-devices-${userId}`, JSON.stringify(devices));
        // Dispositivo adicionado (silenciado)
      } else {
        // Atualizar a data de último uso
        const updatedDevices = devices.map((device: Record<string, unknown>) => {
          if (device.deviceId === deviceId || device.ip === deviceIP) {
            return {
              ...device,
              lastUsed: new Date().toISOString(),
              authorized: true
            };
          }
          return device;
        });
        
        localStorage.setItem(`auth-devices-${userId}`, JSON.stringify(updatedDevices));
        // Dispositivo atualizado (silenciado)
      }
    } catch (error) {
      console.error('Erro ao salvar dispositivo autorizado:', error);
    }
  },
  
  /**
   * Remover autorização de dispositivo para o usuário
   */
  async removeAuthorizedDevice(userId: string, deviceId?: string): Promise<void> {
    try {
      if (!deviceId) {
        // Se não for especificado um ID, remover todos os dispositivos
        localStorage.removeItem(`auth-devices-${userId}`);
        // Todos os dispositivos removidos (silenciado)
        return;
      }
      
      // Obter lista de dispositivos autorizados
      const authorizedDevicesStr = localStorage.getItem(`auth-devices-${userId}`);
      if (!authorizedDevicesStr) return;
      
      const devices = JSON.parse(authorizedDevicesStr);
      
      // Filtrar o dispositivo a ser removido
      const updatedDevices = devices.filter((device: Record<string, unknown>) => device.deviceId !== deviceId);
      
      // Salvar a lista atualizada
      localStorage.setItem(`auth-devices-${userId}`, JSON.stringify(updatedDevices));
      // Dispositivo removido (silenciado)
    } catch (error) {
      console.error('Erro ao remover dispositivo autorizado:', error);
    }
  },

  /**
   * Autenticação com Email/Senha
   */
  async signInWithEmail(email: string, password: string, remember: boolean = true): Promise<{ data: Session | null; error: Record<string, unknown> }> {
    // 🔥 NÃO BLOQUEAR LOGIN: Init em background
    this.init().catch(err => console.warn('Init em background falhou:', err));
    
    try {
      // Validações mais rigorosas
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return { 
          data: null, 
          error: { message: 'Email inválido' } 
        };
      }

      if (!password || typeof password !== 'string' || password.length < 6) {
        return { 
          data: null, 
          error: { message: 'Senha inválida' } 
        };
      }

      // Tentando login (silenciado)

      // Tentar fazer login
      const { data, error } = await (supabase as SupabaseClient<Database>).auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      // loginTime (silenciado)

      if (error) {
        
        // Tratamento específico para diferentes tipos de erro
        if (error.message.includes('Invalid login credentials')) {
          return { 
            data: null, 
            error: { message: 'Email ou senha incorretos' } 
          };
        }
        if (error.message.includes('Email not confirmed')) {
          return {
            data: null,
            error: { message: 'Email não confirmado. Verifique sua caixa de entrada.' }
          };
        }
        throw error;
      }

      // Verificar se temos dados válidos
      if (!data?.session) {
        console.warn('Login bem-sucedido, mas sem sessão retornada. Resposta:', data);
        return {
          data: null,
          error: { message: 'Falha ao criar sessão' }
        };
      }

      // Sempre persistir o login
      localStorage.setItem('remember-user', 'true');
      
      // Sempre guardar este dispositivo
      if (data.user) {
        await this.saveAuthorizedDevice(data.user.id);
        
        // O Supabase já salva a sessão automaticamente no localStorage
        // Sessão criada (silenciado)
        
      }
      return { data: data.session, error: null };
    } catch (error) {
      console.error('Erro não tratado ao fazer login:', error);
      return { 
        data: null, 
        error: { 
          message: error instanceof Error ? error.message : 'Erro ao fazer login. Tente novamente.' 
        } 
      };
    }
  },

  /**
   * Cadastro de usuário
   */
  async signUp(email: string, password: string, name: string): Promise<{ user: Record<string, unknown> | null; error: Error | null }> {
    try {
      await this.init();
      
      // Validar entradas
      if (!email || !password) {
        console.error('Email e senha são obrigatórios');
        return {
          user: null,
          error: new Error('Email e senha são obrigatórios')
        };
      }

      // Verificar força da senha
      if (password.length < 6) {
        console.error('A senha deve ter pelo menos 6 caracteres');
        return {
          user: null,
          error: new Error('A senha deve ter pelo menos 6 caracteres')
        };
      }

      console.log(`Iniciando registro para: ${email}`);
      
      // Verificar se o email já existe
      const emailCheck = await this.checkEmailExists(email);
      console.log(`Resultado da verificação de email:`, emailCheck);
      
      // Bloquear cadastro apenas se o email estiver confirmado
      if (emailCheck.inAuth && emailCheck.isConfirmed) {
        console.error('Email já está registrado e confirmado.');
        return {
          user: null, 
          error: new Error('Este email já está registrado. Faça login ou use a recuperação de senha se necessário.')
        };
      }
      
      // Se o email existe mas não está confirmado, permitimos novo registro
      if (emailCheck.inAuth && !emailCheck.isConfirmed) {
        console.log('Email existe mas não está confirmado. Permitindo novo registro.');
      }

      // Registrar o usuário
      console.log('Registrando novo usuário...');
      const { data, error } = await (supabase as SupabaseClient<Database>).auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) {
        console.error('Erro no registro:', error);
        return { user: null, error };
      }

      console.log('Usuário registrado com sucesso:', data);
      return { user: data.user as unknown as Record<string, unknown>, error: null };
    } catch (error) {
      console.error('Erro ao cadastrar usuário:', error);
      return {
        user: null,
        error: new Error('Ocorreu um erro durante o cadastro. Tente novamente.')
      };
    }
  },

  /**
   * Login com provedor OAuth (Google, GitHub, etc.)
   */
  async signInWithProvider(provider: Provider): Promise<{ data: Record<string, unknown>; error: Record<string, unknown> }> {
    try {
      const { data, error } = await (supabase as SupabaseClient<Database>).auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error(`Erro ao fazer login com ${provider}:`, error);
      return { data: null, error };
    }
  },

  /**
   * Logout
   */
  async signOut(): Promise<{ error: Record<string, unknown> }> {
    try {
      // Remover a flag de "lembrar usuário"
      localStorage.removeItem('remember-user');
      
      // Remover autorização do dispositivo atual
      try {
        const { data } = await (supabase as SupabaseClient<Database>).auth.getUser();
        if (data.user?.id) {
          const deviceId = this.getDeviceIdentifier();
          await this.removeAuthorizedDevice(data.user.id, deviceId);
        }
      } catch (e) {
        console.warn('Erro ao remover autorização do dispositivo:', e);
      }
      
      const { error } = await (supabase as SupabaseClient<Database>).auth.signOut();
      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      return { error };
    }
  },

  /**
   * Recuperação de senha
   */
  async resetPassword(email: string): Promise<{ data: Record<string, unknown>; error: Record<string, unknown> }> {
    try {
      const { data, error } = await (supabase as SupabaseClient<Database>).auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      // Registra a ação
      await this.logUserAction({
        action: 'reset_password',
        details: { email },
      });

      return { data, error: null };
    } catch (error) {
      console.error('Erro ao solicitar redefinição de senha:', error);
      return { data: null, error };
    }
  },

  /**
   * Verificação de email
   */
  async verifyEmail(email: string): Promise<{ data: Record<string, unknown>; error: Record<string, unknown> }> {
    try {
      console.log(`Iniciando verificação de email para: ${email}`);
      
      // Verificar primeiro se o email já existe na autenticação
      try {
        // Tentativa de login com senha incorreta para verificar se o email existe
        const { error: authCheckError } = await (supabase as SupabaseClient<Database>).auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: "senha-incorreta-para-verificacao"
        });
        
        // Se o erro for diferente de "Invalid login credentials", o email provavelmente não existe
        if (!authCheckError || !authCheckError.message.includes('Invalid login credentials')) {
          console.warn(`Email ${email} não parece estar cadastrado na autenticação do Supabase`);
        } else {
          console.log(`Email ${email} parece estar cadastrado na autenticação do Supabase`);
        }
      } catch (checkError) {
        console.warn('Erro ao verificar existência do email na autenticação:', checkError);
      }
      
      // Implementação dependente do fluxo de verificação do Supabase
      console.log(`Enviando solicitação de reenvio para o email: ${email}`);
      const { data, error } = await (supabase as SupabaseClient<Database>).auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });

      if (error) {
        console.error('Erro ao reenviar verificação de email:', error);
        throw error;
      }

      console.log('Verificação de email enviada com sucesso:', data);
      
      // Registra a ação
      await this.logUserAction({
        action: 'verify_email',
        details: { email },
      });

      return { data, error: null };
    } catch (error) {
      console.error('Erro ao verificar email:', error);
      return { data: null, error };
    }
  },

  /**
   * Obter perfil de usuário
   */
  async getUserProfile(userId?: string): Promise<{ data: UserProfile | null; error: Record<string, unknown> }> {
    try {
      // Obter usuário autenticado atual
      const { data: { user }, error: authError } = await (supabase as SupabaseClient<Database>).auth.getUser();
      
      if (authError || !user) {
        return { data: null, error: { message: 'Usuário não autenticado' } };
      }
      
      // Se userId foi fornecido e é diferente do usuário atual, tentar buscar da tabela user_profiles
      if (userId && userId !== user.id) {
        try {
          const { data: profile, error: profileError } = await (supabase as SupabaseClient<Database>)
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
          
          if (!profileError && profile) {
            return { data: profile as UserProfile, error: null };
          }
        } catch (err) {
          console.warn('Erro ao buscar perfil de outro usuário:', err);
        }
        
        // Se não encontrou na tabela, retornar erro
        return { data: null, error: { message: 'Perfil não encontrado' } };
      }
      
      // Criar um perfil básico a partir dos dados de autenticação do usuário atual
      const basicProfile: UserProfile = {
        id: '',
        user_id: user.id,
        created_at: user.created_at || new Date().toISOString(),
        updated_at: user.updated_at || new Date().toISOString(),
        display_name: user.user_metadata?.full_name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        language: null,
        timezone: null,
        // @ts-expect-error - risk_level não definido no schema

        risk_level: null,
        default_currency: null,
        phone_number: null,
        address: null,
        birthdate: null,
        verified_email: false,
        verified_phone: false,
        is_admin: false,
        status: 'active'
      };
      
      return { data: basicProfile, error: null };
    } catch (error) {
      console.error('Erro ao obter perfil do usuário:', error);
      return { data: null, error };
    }
  },

  /**
   * Atualizar perfil de usuário
   */
  async updateUserProfile(profile: Partial<UserProfile>): Promise<{ data: UserProfile | null; error: Record<string, unknown> }> {
    try {
      const { data: user } = await (supabase as SupabaseClient<Database>).auth.updateUser({
        data: {
          full_name: profile.display_name,
          avatar_url: profile.avatar_url
        }
      });
      
      if (!user.user) {
        throw new Error('Falha ao atualizar dados do usuário');
      }
      
      // Retorna perfil básico
      const basicProfile: UserProfile = {
        id: '',
        user_id: user.user.id,
        created_at: user.user.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        display_name: user.user.user_metadata?.full_name || profile.display_name || null,
        avatar_url: user.user.user_metadata?.avatar_url || profile.avatar_url || null,
        language: null,
        timezone: null,
        // @ts-expect-error - risk_level não definido no schema

        risk_level: null,
        default_currency: null,
        phone_number: null,
        address: null,
        birthdate: null,
        verified_email: false,
        verified_phone: false,
        is_admin: false,
        status: 'active'
      };
      
      return { data: basicProfile, error: null };
    } catch (error) {
      console.error('Erro ao atualizar perfil do usuário:', error);
      return { data: null, error };
    }
  },

  /**
   * Obter configurações de notificação
   */
  async getNotificationSettings(userId?: string): Promise<{ data: Record<string, unknown>; error: Record<string, unknown> }> {
    try {
      // Retornar configurações padrão já que não temos tabela
      const defaultSettings = {
        email_notifications: true,
        push_notifications: false,
        sms_notifications: false
      };
      
      return { data: defaultSettings, error: null };
    } catch (error) {
      console.error('Erro ao obter configurações de notificação:', error);
      return { data: null, error };
    }
  },

  /**
   * Atualizar configurações de notificação
   */
  async updateNotificationSettings(settings: Record<string, unknown>): Promise<{ data: Record<string, unknown>; error: Record<string, unknown> }> {
    try {
      // Simular sucesso já que não temos tabela
      return { data: settings, error: null };
    } catch (error) {
      console.error('Erro ao atualizar configurações de notificação:', error);
      return { data: null, error };
    }
  },

  /**
   * Obter preferências de trading
   */
  async getTradingPreferences(userId?: string): Promise<{ data: Record<string, unknown>; error: Record<string, unknown> }> {
    try {
      const defaultPreferences: Record<string, unknown> = {
        preferred_markets: ['crypto', 'stocks'],
        auto_trade: false,
        preferred_trader_link: '',
        preferred_broker: 'avalon'
      };

      // Ler preferências do trader salvas no localStorage
      try {
        const stored = localStorage.getItem('trader_preferences');
        if (stored) {
          const parsed = JSON.parse(stored);
          Object.assign(defaultPreferences, parsed);
        }
      } catch { /* ignorar erros de parse */ }

      return { data: defaultPreferences, error: null };
    } catch (error) {
      return { data: null, error: error as Record<string, unknown> };
    }
  },

  /**
   * Atualizar preferências de trading
   */
  async updateTradingPreferences(preferences: Record<string, unknown>): Promise<{ data: Record<string, unknown>; error: Record<string, unknown> }> {
    try {
      // Simular sucesso já que não temos tabela
      return { data: preferences, error: null };
    } catch (error) {
      console.error('Erro ao atualizar preferências de trading:', error);
      return { data: null, error };
    }
  },

  /**
   * Verificar se o usuário é administrador
   */
  async isAdmin(): Promise<boolean> {
    try {
      const { data: { user } } = await (supabase as SupabaseClient<Database>).auth.getUser();
      if (!user) {
        console.log('[userService.isAdmin] No user found');
        return false;
      }
      const { data, error } = await (supabase as SupabaseClient<Database>)
        .from('user_profiles')
        .select('is_admin')
        .eq('user_id', user.id)
        .single();
      console.log('[userService.isAdmin] Query result:', { data, error: error?.message, userId: user.id?.substring(0, 8) });
      if (error || !data) return false;
      return !!data.is_admin;
    } catch (err) {
      console.error('[userService.isAdmin] Exception:', err);
      return false;
    }
  },

  /**
   * Listar todos os usuários (apenas para admins)
   */
  async listUsers(): Promise<{ data: Record<string, unknown>[]; error: Record<string, unknown> }> {
    try {
      // Como não temos tabela de perfis, considerar que não é possível listar usuários
      throw new Error('Funcionalidade não disponível');
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      return { data: [], error };
    }
  },

  /**
   * Excluir usuário (apenas admin)
   */
  async deleteUser(userId: string): Promise<{ success: boolean; error: Record<string, unknown> }> {
    try {
      // Como não temos tabela de perfis, considerar que não é possível excluir usuários
      throw new Error('Funcionalidade não disponível');
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      return { success: false, error };
    }
  },

  /**
   * Registrar ação do usuário
   */
  async logUserAction(data: Record<string, unknown>): Promise<void> {
    // Não faz nada, apenas retorna para não quebrar o código existente
    return Promise.resolve();
  },

  /**
   * Verificar força da senha
   */
  isStrongPassword(password: string): { isStrong: boolean; message: string } {
    // Regras de validação de senha
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

    if (password.length < minLength) {
      return { isStrong: false, message: `A senha deve ter no mínimo ${minLength} caracteres.` };
    }

    if (!hasUppercase) {
      return { isStrong: false, message: 'A senha deve conter pelo menos uma letra maiúscula.' };
    }

    if (!hasLowercase) {
      return { isStrong: false, message: 'A senha deve conter pelo menos uma letra minúscula.' };
    }

    if (!hasNumber) {
      return { isStrong: false, message: 'A senha deve conter pelo menos um número.' };
    }

    if (!hasSpecialChar) {
      return { isStrong: false, message: 'A senha deve conter pelo menos um caractere especial.' };
    }

    return { isStrong: true, message: 'Senha forte' };
  },

  /**
   * Obtém a sessão atual do usuário
   */
  async getCurrentSession(): Promise<Session | null> {
    // Criar um ID único para o timer desta instância
    const timerId = `getCurrentSession_${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      console.log(`Iniciando verificação de sessão [${timerId}]`);
      
      // Verificar se o usuário escolheu "Permanecer conectado"
      const rememberUser = localStorage.getItem('remember-user') === 'true';
      console.log(`Verificando sessão (Permanecer conectado: ${rememberUser ? 'Sim' : 'Não'})`);
      
      // O Supabase gerencia automaticamente a sessão
      // Apenas verificamos se o usuário quer permanecer conectado
      if (!rememberUser) {
        console.log('Usuário não escolheu permanecer conectado');
        // O Supabase já limpa a sessão ao fazer signOut
      } else {
        // Tentar obter sessão armazenada do Supabase
        const cachedSession = localStorage.getItem('supabase.auth.session');
        if (cachedSession) {
          try {
            // Analisar a sessão em cache
            const parsed = JSON.parse(cachedSession);
            const parsedSession = parsed?.session as Session | null;
            
            // Verificar se a sessão em cache é válida e contém um ID de usuário
            if (parsedSession?.user?.id) {
              // Verificar se o dispositivo atual está autorizado para este usuário
              const isAuthorized = await this.isAuthorizedDevice(parsedSession.user.id);
              
              if (isAuthorized) {
                console.log('Sessão em cache válida e dispositivo autorizado');
                
                // Verificar se a sessão não expirou
                const expiresAt = parsedSession.expires_at;
                const now = Math.floor(Date.now() / 1000);
                
                if (!expiresAt || expiresAt > now) {
                  console.log('Sessão ainda não expirou, retornando do cache');
                  
                  // Atualizar automaticamente a data de último uso do dispositivo
                  this.saveAuthorizedDevice(parsedSession.user.id).catch(e => 
                    console.warn('Erro ao atualizar registro de dispositivo:', e)
                  );
                  
                  console.log(`Verificação de sessão concluída com sucesso (cache) [${timerId}]`);
                  return parsedSession;
                } else {
                  console.log('Sessão em cache expirou, será necessário fazer login novamente');
                }
              } else {
                console.log('Dispositivo não autorizado para este usuário, fazendo logout');
                await (supabase as SupabaseClient<Database>).auth.signOut();
              }
            }
          } catch (e) {
            console.warn('Erro ao parsear sessão em cache:', e);
          }
        }
      }
      
      // Buscar a sessão se não houver cache válido ou não for para lembrar o usuário
      const { data, error } = await (supabase as SupabaseClient<Database>).auth.getSession();
      if (error) {
        console.error('Erro ao obter sessão:', error);
        return null;
      }
      
      // Se tiver sessão e for para lembrar o usuário, salvar a flag e registrar o dispositivo
      if (data?.session && rememberUser && data.session.user?.id) {
        localStorage.setItem('remember-user', 'true');
        await this.saveAuthorizedDevice(data.session.user.id);
      }
      
      console.log(`Verificação de sessão concluída com sucesso [${timerId}]`);
      return data?.session ? (data.session as unknown as Session) : null;
    } catch (e) {
      console.error(`Erro não tratado ao obter sessão [${timerId}]:`, e);
      return null;
    }
  },

  /**
   * Obter usuário atual
   */
  async getCurrentUser() {
    try {
      const { data } = await (supabase as SupabaseClient<Database>).auth.getUser();
      return data.user;
    } catch (error) {
      console.error('Erro ao obter usuário atual:', error);
      return null;
    }
  },

  /**
   * Função de debug para criar usuário de teste (remova em produção)
   */
  async createTestUser(): Promise<{ success: boolean; error: Record<string, unknown> }> {
    try {
      const testEmail = `teste${Date.now()}@example.com`;
      const testPassword = 'Teste123!';
      
      console.log('Tentando criar usuário de teste:', testEmail);
      
      const { data, error } = await (supabase as SupabaseClient<Database>).auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      });
      
      if (error) {
        console.error('Erro ao criar usuário de teste:', error);
        return { success: false, error: error as unknown as Record<string, unknown> };
      }
      
      console.log('Usuário de teste criado com sucesso:', {
        email: testEmail,
        password: testPassword,
        userId: data.user?.id
      });
      
      return { success: true, error: null };
    } catch (error) {
      console.error('Exceção ao criar usuário de teste:', error);
      return { success: false, error };
    }
  },

  /**
   * Verifica se um email existe e está confirmado no Supabase Auth
   * e na tabela de perfis de usuário.
   * Usa apenas tentativa de login com senha inválida (sem enviar emails ao usuário).
   */
  async checkEmailExists(email: string): Promise<{
    inAuth: boolean;
    inProfiles: boolean;
    isConfirmed: boolean;
  }> {
    try {
      await this.init();
      
      if (!supabase) {
        console.error('Cliente Supabase não inicializado');
        return { inAuth: false, inProfiles: false, isConfirmed: false };
      }
      
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        console.error('Formato de email inválido');
        return { inAuth: false, inProfiles: false, isConfirmed: false };
      }
      
      const normalizedEmail = email.trim().toLowerCase();
      
      const result = {
        inAuth: false,
        inProfiles: false,
        isConfirmed: false
      };

      // Verificar via tentativa de login com senha inválida (não envia emails)
      try {
        const { error } = await (supabase as SupabaseClient<Database>).auth.signInWithPassword({
          email: normalizedEmail,
          password: 'SENHA_INVALIDA_VERIFICACAO_EXISTENCIA_!@#$%'
        });

        if (error) {
          if (error.message.includes('Invalid login credentials') || 
              error.message.includes('credenciais inválidas')) {
            result.inAuth = true;
            result.isConfirmed = true;
          } 
          else if (error.message.includes('Email not confirmed') || 
                  error.message.includes('email não confirmado')) {
            result.inAuth = true;
            result.isConfirmed = false;
          }
          else if (error.message.includes('User not found') || 
                  error.message.includes('usuário não encontrado')) {
            result.inAuth = false;
            result.isConfirmed = false;
          }
        }
      } catch (loginError) {
        console.error('Erro ao verificar existência de email:', loginError);
      }

      // Verificar também na tabela de perfis
      try {
        const { data } = await (supabase as SupabaseClient<Database>)
          .from('user_profiles')
          .select('user_id')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (data) {
          result.inProfiles = true;
        }
      } catch (dbError) {
        console.error('Erro ao verificar email na tabela de perfis:', dbError);
      }

      return result;
    } catch (error) {
      console.error('Erro geral ao verificar existência de email:', error);
      return { inAuth: false, inProfiles: false, isConfirmed: false };
    }
  },

  /**
   * Verifica se uma tabela existe no banco de dados
   * @param tableName Nome da tabela para verificar
   * @returns Promise<boolean> - true se a tabela existir
   */
  async doesTableExist(tableName: string): Promise<boolean> {
    try {
      await this.init();
      
      if (!supabase) {
        console.error('Cliente Supabase não inicializado');
        return false;
      }
      
      // Verificar existência da tabela através de uma consulta
      const { error } = await (supabase as SupabaseClient<Database>)
        .from(tableName as never)
        .select('count(*)')
        .limit(1);
      
      // Se não houver erro, a tabela existe
      if (!error) {
        return true;
      }
      
      // Se o erro for relacionado à tabela não existir
      if (error.message?.includes('does not exist') || 
          error.code === '42P01' || 
          error.message?.includes('não existe')) {
        return false;
      }
      
      // Para outros erros, assumimos que a tabela existe
      // mas ocorreu um problema diferente (como permissões)
      console.warn(`Erro ao verificar tabela ${tableName}:`, error);
      return true;
    } catch (error) {
      console.error(`Erro ao verificar se tabela ${tableName} existe:`, error);
      return false;
    }
  },
  
  /**
   * Atualizar o idioma do usuário no banco de dados
   */
  async updateUserLanguage(userId: string, language: 'pt' | 'en' | 'es'): Promise<void> {
    try {
      // Atualizar na tabela user_profiles
      const { error } = await (supabase as SupabaseClient<Database>)
        .from('user_profiles')
        .update({ 
          language,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (error) {
        console.error('❌ [userService] Erro ao atualizar idioma:', error);
        throw error;
      }
    } catch (error) {
      console.error('❌ [userService] Erro ao atualizar idioma do usuário:', error);
      throw error;
    }
  },
  
  /**
   * Obter o idioma do usuário do banco de dados
   */
  async getUserLanguage(userId: string): Promise<{ language: 'pt' | 'en' | 'es' }> {
    try {
      const { data, error } = await (supabase as SupabaseClient<Database>)
        .from('user_profiles')
        .select('language')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.warn('⚠️ [userService] Erro ao buscar idioma:', error);
        return { language: 'pt' }; // Fallback para português
      }
      
      const language = data?.language as 'pt' | 'en' | 'es' || 'pt';
      
      return { language };
    } catch (error) {
      console.error('❌ [userService] Erro ao obter idioma do usuário:', error);
      return { language: 'pt' }; // Fallback para português
    }
  },

  /**
   * Atualizar preferências do trader (link e broker)
   */
  async updateTraderPreferences(preferences: {
    preferred_trader_link?: string;
    preferred_broker?: string;
    supporter_code?: string;
  }): Promise<{ success: boolean; error: Error | null }> {
    try {
      const existing: Record<string, unknown> = {};
      try {
        const stored = localStorage.getItem('trader_preferences');
        if (stored) Object.assign(existing, JSON.parse(stored));
      } catch { /* ignorar */ }

      const updated: Record<string, unknown> = {
        ...existing,
        ...(preferences.preferred_trader_link !== undefined && { preferred_trader_link: preferences.preferred_trader_link }),
        ...(preferences.preferred_broker !== undefined && { preferred_broker: preferences.preferred_broker }),
        ...(preferences.supporter_code !== undefined && { supporter_code: preferences.supporter_code }),
      };

      // Salvar/limpar data de ativação do código de apoiador (expira em 30 dias)
      if (preferences.supporter_code !== undefined) {
        if (preferences.supporter_code && preferences.supporter_code.trim()) {
          updated.supporter_code_set_at = new Date().toISOString();
        } else {
          delete updated.supporter_code_set_at;
        }
      }

      localStorage.setItem('trader_preferences', JSON.stringify(updated));
      
      // 🔥 Disparar evento customizado quando código de apoiador muda
      if (preferences.supporter_code !== undefined) {
        window.dispatchEvent(new CustomEvent('supporter-code-changed', {
          detail: { code: preferences.supporter_code }
        }));
      }
      
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  },
};

// Inicializar o serviço
userService.init(); 