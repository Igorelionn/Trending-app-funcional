import React, { useEffect, useRef, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/contexts/UserContext";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Lock, Mail, User as UserIcon, Eye, EyeOff, KeyRound, AlertOctagon, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { getSupabase, getSupabaseNoPKCE } from "@/lib/supabase";
import type { SupabaseClient } from '@supabase/supabase-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { User } from "@/types/auth";
import { resizeImage, blobToFile } from "@/utils/imageUtils";
import { updateUserName } from "@/utils/userNameUtils";
import { loadUserSettings, saveUserSettings, updateDisplayName, updateDisplayNameSimple, updateUserAvatar, startUserSettingsSyncService } from "@/utils/userPersistence";
import { userService } from "@/services/userService";
import { useLocation, useNavigate } from "react-router-dom";

export function ProfileSettings() {
  const { user, updateProfile } = useAuth();
  const { t } = useLanguage();
  const { avatarUrl: contextAvatarUrl, refreshUserData, setAvatarUrl: setContextAvatarUrl } = useUser();
  const [userName, setUserName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordUpdateMode, setPasswordUpdateMode] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVerifyPasswordOpen, setIsVerifyPasswordOpen] = useState(false);
  const [verificationPassword, setVerificationPassword] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [actualPassword, setActualPassword] = useState<string>("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [debounceSaveTimeout, setDebounceSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [verificationShowPassword, setVerificationShowPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState<string>("");
  const [authInProgress, setAuthInProgress] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [isResetEmailSentOpen, setIsResetEmailSentOpen] = useState(false);
  const [isEmailConfirmOpen, setIsEmailConfirmOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  
  const lastNameToSaveRef = useRef<string | null>(null);
  
  const syncServiceRef = useRef<(() => void) | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const currentPathRef = useRef<string>(location.pathname);

  // Sistema de limitação de tentativas de senha
  const [passwordAttempts, setPasswordAttempts] = useState<number>(() => {
    // Recuperar tentativas anteriores do localStorage
    const storedAttempts = localStorage.getItem('password-attempts');
    if (storedAttempts) {
      return parseInt(storedAttempts, 10);
    }
    return 0;
  });

  const [isRateLimited, setIsRateLimited] = useState<boolean>(() => {
    // Verificar se há rate limit ativo no localStorage
    const storedRateLimitTime = localStorage.getItem('password-rate-limit-time');
    if (storedRateLimitTime) {
      const limitTime = parseInt(storedRateLimitTime, 10);
      // Se o tempo ainda não expirou, manter o rate limit ativo
      if (Date.now() < limitTime) {
        return true;
      }
    }
    return false;
  });

  const [rateLimitTime, setRateLimitTime] = useState<number>(() => {
    // Recuperar tempo de expiração do rate limit do localStorage
    const storedRateLimitTime = localStorage.getItem('password-rate-limit-time');
    if (storedRateLimitTime) {
      const limitTime = parseInt(storedRateLimitTime, 10);
      // Se o tempo ainda não expirou, usar esse tempo
      if (Date.now() < limitTime) {
        return limitTime;
      }
    }
    return 0;
  });

  // Estado específico para o contador regressivo
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    rateLimitTime > 0 ? Math.ceil((rateLimitTime - Date.now()) / 1000) : 0
  );

  const MAX_PASSWORD_ATTEMPTS = 5; // 5 tentativas
  const RATE_LIMIT_DURATION = 60 * 1000; // 1 minuto em milissegundos
  const rateLimitTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (contextAvatarUrl) {
      setAvatarUrl(contextAvatarUrl);
    }
  }, [contextAvatarUrl]);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true);
        
        const userSettings = loadUserSettings();
        
        if (userSettings.displayName && userSettings.displayName.trim() !== '') {
          setUserName(userSettings.displayName);
          if (import.meta.env.DEV) {
            // Nome carregado (silenciado)
          }
        } else if (user?.user_metadata?.display_name) {
          setUserName(user.user_metadata.display_name as string);
          saveUserSettings({ displayName: user.user_metadata.display_name as string });
          if (import.meta.env.DEV) {
            // Nome carregado (silenciado)
          }
        } else if (user?.user_metadata?.name) {
          setUserName(user.user_metadata.name as string);
          saveUserSettings({ displayName: user.user_metadata.name as string });
          if (import.meta.env.DEV) {
            // Nome carregado (silenciado)
          }
        } else if (user?.email) {
          const emailName = user.email.split('@')[0];
          setUserName(emailName);
          saveUserSettings({ displayName: emailName });
          if (import.meta.env.DEV) {
            console.log("Nome extraído do email e salvo:", emailName);
          }
        }
        
        if (user?.id) {
          try {
            const { data: profileData } = await (getSupabase() as SupabaseClient)
              .from('user_profiles')
              .select('display_name')
              .eq('user_id', user.id)
              .maybeSingle();
              
            if (profileData?.display_name && profileData.display_name.trim() !== '') {
              setUserName(profileData.display_name);
              
              saveUserSettings({ displayName: profileData.display_name });
              if (import.meta.env.DEV) {
                // Nome carregado (silenciado)
              }
            }
          } catch (profileError) {
            console.warn('Erro ao buscar nome da tabela user_profiles:', profileError);
          }
        }

        if (userSettings.avatarUrl) {
          setAvatarUrl(userSettings.avatarUrl);
        } else if (user?.user_metadata?.avatar_url) {
          setAvatarUrl(user.user_metadata.avatar_url as string);
          saveUserSettings({ avatarUrl: user.user_metadata.avatar_url as string });
        }
        
        if (!syncServiceRef.current) {
          syncServiceRef.current = startUserSettingsSyncService();
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Erro ao carregar dados do usuário:", error);
        setLoading(false);
        setError("Falha ao carregar dados do usuário");
      }
    };
    
    loadUserData();
    
    const handleFocus = () => {
      loadUserData();
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      
      if (syncServiceRef.current) {
        syncServiceRef.current();
        syncServiceRef.current = null;
      }
    };
  }, [refreshUserData, user]);

  // Senha nunca é persistida fora do estado React

  useEffect(() => {
    const handleAvatarUpdated = (event: Event) => {
      const { avatarUrl: newAvatarUrl } = (event as CustomEvent).detail;
      if (newAvatarUrl) {
        setAvatarUrl(newAvatarUrl);
      }
    };
    
    window.addEventListener('avatar-updated', handleAvatarUpdated);
    
    return () => {
      window.removeEventListener('avatar-updated', handleAvatarUpdated);
    };
  }, []);

  useEffect(() => {
    const handleUserDataRefreshed = () => {
      const storedAvatar = localStorage.getItem("user-avatar");
      if (storedAvatar) {
        setAvatarUrl(storedAvatar);
      }
      
      const storedName = localStorage.getItem("user-name");
      if (storedName) {
        setUserName(storedName);
      }
    };
    
    window.addEventListener('user-data-refreshed', handleUserDataRefreshed);
    
    return () => {
      window.removeEventListener('user-data-refreshed', handleUserDataRefreshed);
    };
  }, []);
  
  useEffect(() => {
    const handleNameUpdated = (event: Event) => {
      const { userName: newUserName, fromLoad } = (event as CustomEvent).detail;
      
      if (import.meta.env.DEV) {
        // handleNameUpdated (silenciado)
      }
      
      // APENAS atualizar se for um carregamento inicial, NÃO durante digitação
      if (fromLoad && newUserName !== userName) {
        if (import.meta.env.DEV) {
          console.log("Nome atualizado pelo evento de carregamento:", newUserName);
        }
        setUserName(newUserName);
      }
    };
    
    window.addEventListener('username-updated', handleNameUpdated);
    
    return () => {
      window.removeEventListener('username-updated', handleNameUpdated);
    };
  }, [userName]);
  
  // REMOVIDO: useEffect de focus que estava causando loops infinitos
  // O UserContext já gerencia a sincronização de dados adequadamente

  // REMOVIDO: useEffect que restaurava automaticamente o nome do localStorage
  // Isso estava causando atualizações durante a digitação quando o campo ficava vazio

  const uploadAvatar = async (file: File) => {
    if (!file) return;

    try {
      setUploading(true);
      
      const resizedBlob = await resizeImage(file, 500, 500);
      const resizedFile = blobToFile(resizedBlob, file.name, file.type);
      
      const fileExt = file.name.split('.').pop();
      // Usar ID do usuário para garantir que cada usuário tenha seu próprio arquivo
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
      
      const { data, error } = await (getSupabase() as SupabaseClient).storage
        .from('avatars')
        .upload(fileName, resizedFile, {
          upsert: true // Substituir se já existir
        });
      
      if (error) throw error;
      
      const avatarPath = data.path;
      const { data: urlData } = (getSupabase() as SupabaseClient).storage
        .from('avatars')
        .getPublicUrl(avatarPath);
        
      const newAvatarUrl = urlData.publicUrl;
      
      setAvatarUrl(newAvatarUrl);
      
      await updateUserAvatar(newAvatarUrl);
      
      setContextAvatarUrl(newAvatarUrl);
      
      // Remover o toast de sucesso
      // toast.success("Foto de perfil atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar foto:", error);
      // Remover o toast de erro
      // toast.error("Erro ao atualizar foto de perfil. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      // Remover o toast de erro
      // toast.error(t('profile.error.invalidImage') || "Por favor, selecione uma imagem válida.");
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      // Remover o toast de erro
      // toast.error(t('profile.error.imageSize') || "A imagem deve ter menos de 10MB.");
      return;
    }
    
    let objectUrl = '';
    
    try {
      setUploading(true);
      
      objectUrl = URL.createObjectURL(file);
      setAvatarUrl(objectUrl);
      setContextAvatarUrl(objectUrl);
      
      window.dispatchEvent(new CustomEvent('avatar-updated', { 
        detail: { avatarUrl: objectUrl }
      }));
      
      await uploadAvatar(file);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      await handleSave();
      
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Erro ao processar imagem:", error);
      // Remover o toast de erro
      // toast.error(t('profile.error.uploadFailed') || "Falha no upload da imagem. Tente novamente.");
      
      const fallbackUrl = (user?.user_metadata?.avatar_url as string) || null;
      setAvatarUrl(fallbackUrl);
      setContextAvatarUrl(fallbackUrl);
      
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    } finally {
      setUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSave = async () => {
    const nameToSave = lastNameToSaveRef.current || userName || "";
    
    if (nameToSave.trim() === "") {
      return;
    }
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    try {
      setSaving(true);
      console.log("🔄 Salvando nome de exibição:", nameToSave);
      
      // Timeout de segurança aumentado
      saveTimeoutRef.current = setTimeout(() => {
        setSaving(false);
        console.warn("⏰ Timeout de salvamento atingido");
      }, 10000);
      
      // MÉTODO PRINCIPAL: Forçar salvamento no Supabase usando contexto de autenticação
      const forceResult = await forceSaveToSupabase(nameToSave);
      
      if (forceResult.success) {
        console.log("✅ Nome salvo com sucesso no Supabase!");
        
        // Atualizar estado local
        setUserName(nameToSave);
        
        // Salvar também localmente para sincronização
        saveUserSettings({ displayName: nameToSave });
        
        // Disparar evento para atualizar outros componentes
        window.dispatchEvent(new CustomEvent('userNameUpdated', { 
          detail: nameToSave 
        }));
        
      } else {
        console.warn("⚠️ Falha no salvamento forçado, tentando método simplificado");
        
        // Fallback 1: Método simplificado
        const simpleSuccess = await updateDisplayNameSimple(nameToSave);
        
        if (simpleSuccess) {
          console.log("✅ Nome atualizado com sucesso (método simplificado)");
          setUserName(nameToSave);
        } else {
          console.warn("⚠️ Falha no método simplificado, tentando método tradicional");
          
          // Fallback 2: Método tradicional
          const fallbackSuccess = await updateDisplayName(nameToSave);
          if (fallbackSuccess) {
            console.log("✅ Nome salvo usando método tradicional");
          } else {
            console.warn("⚠️ Falha em todos os métodos - dados salvos apenas localmente");
          }
          
          // Atualizar estado local mesmo com falha
          setUserName(nameToSave);
          
          // Disparar evento para manter UI consistente
          window.dispatchEvent(new CustomEvent('userNameUpdated', { 
            detail: nameToSave 
          }));
        }
      }
      
      // Processar avatar se necessário
      if (avatarUrl && avatarUrl !== contextAvatarUrl) {
        await updateUserAvatar(avatarUrl);
        
        try {
          if (typeof setContextAvatarUrl === 'function') {
            setContextAvatarUrl(avatarUrl);
          }
        } catch (error) {
          console.warn("Não foi possível atualizar o contexto global do avatar", error);
        }
      }
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      
    } catch (error) {
      console.error("❌ Erro ao salvar configurações:", error);
      
      // Salvar localmente mesmo com erro para não perder dados
      saveUserSettings({ displayName: nameToSave });
      
      // Disparar evento mesmo com erro para manter UI consistente
      window.dispatchEvent(new CustomEvent('userNameUpdated', { 
        detail: nameToSave 
      }));
      
    } finally {
      setSaving(false);
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
  // Debug senha (silenciado)
  }, [actualPassword, showPassword]);



  useEffect(() => {
    if (showPassword) {
      // Campo visível (silenciado)
    }
  }, [showPassword, actualPassword]);


  // Restaurar estado de exibição da senha ao carregar o componente
  useEffect(() => {
    // Limpar chaves de senha legadas que possam ter ficado de versões anteriores
    localStorage.removeItem('demo_password');
    localStorage.removeItem('password_visible');
  }, []);

  // ❌ DESABILITADO - Esta função estava interferindo na verificação de senha
  // handleSuccessfulAuthentication causava o problema de mostrar senha mesmo com erro
  /*
  const handleSuccessfulAuthentication = (password: string) => {
    console.log("Processando autenticação bem-sucedida");
    
    if (!password || password.length === 0) {
      console.warn("Tentativa de autenticação sem senha válida");
      setAuthInProgress(false);
      setIsAuthenticating(false);
      return;
    }
    
    setTempPassword(password);
    console.log(`Senha temporária definida: ${password.length} caracteres`);
    
    setIsVerifyPasswordOpen(false);
    
    requestAnimationFrame(() => {
      setAuthInProgress(false);
      setIsAuthenticating(false);
      setVerificationPassword("");
      setVerificationShowPassword(false);
      setAuthSuccess(false);
      
      console.log("Atualizando UI para mostrar senha");
      setShowPassword(true);
      
      setTimeout(() => {
        // Estado showPassword (silenciado)
      }, 100);
    });
  };
  */

  // ❌ DESABILITADO - Esta função estava interferindo na verificação de senha
  // monitorAuthState causava falsos positivos de autenticação
  /*
  const monitorAuthState = useCallback(async () => {
    if (!authInProgress) return false;
    
    try {
      console.log("Monitorando estado de autenticação...");
      const { data } = await getSupabase().auth.getSession();
      
      if (data.session) {
        console.log("Sessão ativa detectada durante monitoramento!");
        
        setAuthSuccess(true);
        
        setTimeout(() => {
          handleSuccessfulAuthentication(verificationPassword);
        }, 500);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Erro ao monitorar estado de autenticação:", error);
      return false;
    }
  }, [authInProgress, verificationPassword]);
  */

  // ❌ DESABILITADO - Este useEffect estava interferindo na verificação
  /*
  useEffect(() => {
    if (!authInProgress) return;
    
    setIsAuthenticating(true);
    
    monitorAuthState();
    
    const intervalId = setInterval(() => {
      monitorAuthState().then(success => {
        if (success) {
          clearInterval(intervalId);
        }
      });
    }, 500);
    
    const timeoutId = setTimeout(() => {
      if (authInProgress) {
        setAuthInProgress(false);
        setIsAuthenticating(false);
        clearInterval(intervalId);
        console.log("Timeout de verificação atingido após 10 segundos");
      }
    }, 10000);
    
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [authInProgress, monitorAuthState]);
  */

  // ❌ DESABILITADO - Este listener estava interferindo na verificação
  /*
  useEffect(() => {
    const { data: authListener } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' && authInProgress) {
        console.log("Evento SIGNED_IN detectado durante verificação!");
        
        setAuthSuccess(true);
        
        setTimeout(() => {
          handleSuccessfulAuthentication(verificationPassword);
        }, 500);
      }
    });
    
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [authInProgress, verificationPassword]);
  */

  const verifyPassword = async () => {
    if (!user?.email) return;
    
    // Verificar se está em rate limit
    if (isRateLimited) {
      // Usar o estado remainingSeconds em vez de calcular aqui
      setVerificationError(`Muitas tentativas. Tente novamente em ${remainingSeconds} segundos.`);
      return;
    }
    
    try {
      setAuthInProgress(true);
      setVerificationError("");
      setAuthSuccess(false);
      setIsAuthenticating(true);
      
      const senhaDigitada = verificationPassword;
      console.log(`Iniciando verificação da senha (${senhaDigitada.length} caracteres)...`);
      
      console.log("Verificando credenciais com Supabase (usando cliente sem PKCE)...");
      
      const userEmail = user.email;
      const userPassword = senhaDigitada;
      
      // Salvar o caminho atual antes da verificação
      const pathBeforeVerification = window.location.pathname;
      
      // Usar o cliente supabaseNoPKCE que não cria uma sessão nova
      const { data, error } = await (getSupabaseNoPKCE() as SupabaseClient).auth.signInWithPassword({
        email: userEmail,
        password: userPassword
      });
      
      // Verificar se houve redirecionamento durante a verificação
      if (window.location.pathname !== pathBeforeVerification) {
        console.log('Redirecionamento detectado durante verificação, voltando para a página anterior...');
        navigate(pathBeforeVerification, { replace: true });
      }
      
      if (error) {
        console.log("❌ Senha INCORRETA - Erro na verificação Supabase:", error.message);
        
        // Incrementar tentativas de senha
        const newAttempts = passwordAttempts + 1;
        setPasswordAttempts(newAttempts);
        
        // Persistir tentativas no localStorage
        localStorage.setItem('password-attempts', newAttempts.toString());
        
        // Verificar se excedeu o limite de tentativas
        if (newAttempts >= MAX_PASSWORD_ATTEMPTS) {
          setIsRateLimited(true);
          const limitExpiry = Date.now() + RATE_LIMIT_DURATION;
          setRateLimitTime(limitExpiry);
          
          // Persistir rate limit no localStorage
          localStorage.setItem('password-rate-limit-time', limitExpiry.toString());
          
          // Definir um timer para remover o rate limit
          if (rateLimitTimerRef.current) {
            clearTimeout(rateLimitTimerRef.current);
          }
          
          rateLimitTimerRef.current = setTimeout(() => {
            setIsRateLimited(false);
            setPasswordAttempts(0);
            localStorage.removeItem('password-attempts');
            localStorage.removeItem('password-rate-limit-time');
            setRemainingSeconds(0);
            rateLimitTimerRef.current = null;
          }, RATE_LIMIT_DURATION);
          
          setVerificationError(`Muitas tentativas. Tente novamente em ${Math.ceil(RATE_LIMIT_DURATION / 1000)} segundos.`);
        } else {
          if (error.message.includes("network") || error.status >= 500) {
            setVerificationError("Erro de conexão. Verifique sua internet e tente novamente.");
          } else if (error.message.includes("Invalid login") || error.message.includes("incorrect") || error.message.includes("wrong")) {
            // Substituir a mensagem codificada por mensagem direta em português
            setVerificationError("Senha incorreta. Verifique e tente novamente.");
          } else if (error.message.includes("too many")) {
            setVerificationError("Muitas tentativas. Aguarde um momento e tente novamente.");
          } else {
            setVerificationError("Não foi possível verificar sua senha. Tente novamente.");
          }
        }
        
        setAuthInProgress(false);
        setIsAuthenticating(false);
        
        // ❌ IMPORTANTE: NÃO MOSTRAR A SENHA se a verificação falhou
        // ❌ NÃO FECHAR O MODAL se a verificação falhou
        // ❌ MANTER O MODAL ABERTO com a mensagem de erro
        console.log("❌ Mantendo modal aberto - senha incorreta");
        // Estados após erro (silenciado)
        
        setShowPassword(false);
        setActualPassword("");
        setTempPassword("");
        
        return;
      }
      
      // ✅ Se chegou aqui, a senha está CORRETA e foi VERIFICADA com sucesso no Supabase
      console.log("✅ SUCESSO na verificação via API Supabase! Senha está correta.");
      
      // Resetar contadores de tentativas de senha
      setPasswordAttempts(0);
      localStorage.removeItem('password-attempts');
      localStorage.removeItem('password-rate-limit-time');
      
      // Importante: Não criar uma sessão nova, apenas verificar a senha
      setAuthSuccess(true);
      
      // ✅ MARCAR COMO VERIFICAÇÃO BEM-SUCEDIDA
      const verificationSuccessful = true;
      
      // ✅ APENAS SE A SENHA ESTIVER CORRETA: Fechar modal e mostrar a senha
      setTimeout(() => {
        // ❌ VERIFICAÇÃO ADICIONAL: Só executar se realmente foi sucesso
        if (!verificationSuccessful || error) {
          console.log("❌ Bloqueando execução - verificação não foi bem-sucedida");
          return;
        }
        
        // Verificar novamente se houve redirecionamento
        if (window.location.pathname !== pathBeforeVerification) {
          console.log('Redirecionamento detectado após verificação, voltando para a página anterior...');
          navigate(pathBeforeVerification, { replace: true });
        }
        
        // ✅ Fechar modal de verificação APENAS SE A SENHA ESTIVER CORRETA
        setIsVerifyPasswordOpen(false);
        setVerificationPassword("");
        setVerificationError("");
        setAuthInProgress(false);
        setIsAuthenticating(false);
        setAuthSuccess(false);
        
        // ✅ Mostrar a senha CORRETA (apenas a senha que foi verificada com sucesso no Supabase)
        setShowPassword(true);
        setActualPassword(senhaDigitada); // Esta é realmente a senha correta verificada
      }, 300);
    } catch (error) {
      console.error("❌ Erro geral ao processar verificação:", error);
      
      setVerificationError("Ocorreu um erro inesperado. Tente novamente mais tarde.");
      setAuthInProgress(false);
      setIsAuthenticating(false);
      
      // ❌ IMPORTANTE: NÃO MOSTRAR A SENHA em caso de erro
      return;
    } finally {
      // ❌ IMPORTANTE: Este bloco finally estava causando problemas
      // Não fazer nada aqui que possa interferir na verificação
      console.log("❌ Finally block executado - não fazer alterações de estado aqui");
    }
  };

  const updateUserPassword = async () => {
    if (!user || !newPassword || newPassword !== confirmPassword) return;
    
    try {
      setSaving(true);
      
      const { error: signInError } = await (getSupabaseNoPKCE() as SupabaseClient).auth.signInWithPassword({
        email: user.email!,
        password: currentPassword
      });
      
      if (signInError) {
        setSaving(false);
        return;
      }
      
      const { error } = await (getSupabase() as SupabaseClient).auth.updateUser({
        password: newPassword
      });
      
      if (error) {
        throw error;
      }
      
      setActualPassword(newPassword);
      
      setPasswordUpdateMode(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Erro ao atualizar senha:", error);
    } finally {
      setSaving(false);
    }
  };

  const validateEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleEmailReset = async () => {
    if (!confirmEmail || !validateEmail(confirmEmail)) {
      setEmailError('Por favor, digite um email válido');
      return;
    }

    if (confirmEmail.toLowerCase() !== user?.email?.toLowerCase()) {
      setEmailError('O email deve ser o mesmo da sua conta');
      return;
    }

    try {
      setAuthInProgress(true);
      setEmailError('');

      const { error } = await (getSupabase() as SupabaseClient).auth.resetPasswordForEmail(confirmEmail, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        console.error('Erro ao enviar email de reset:', error);
        setEmailError('Erro ao enviar email. Tente novamente.');
        return;
      }

      // Fechar dialog de confirmação e abrir dialog de sucesso
      setIsEmailConfirmOpen(false);
      // Aguardar um pouco antes de abrir o próximo dialog para suavizar a transição
      setTimeout(() => {
        setIsResetEmailSentOpen(true);
      }, 200);
    } catch (error) {
      console.error('Erro inesperado:', error);
      setEmailError('Erro inesperado. Tente novamente.');
    } finally {
      setAuthInProgress(false);
    }
  };

  const handleForgotPassword = async () => {
    // Fechar o dialog de verificação de senha
    setIsVerifyPasswordOpen(false);
    
    // Aguardar um pouco para suavizar a transição
    setTimeout(() => {
      // Pré-preencher com o email do usuário e abrir o dialog de confirmação
      setConfirmEmail(user?.email || '');
      setEmailError('');
      setIsEmailConfirmOpen(true);
    }, 200);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    
    if (import.meta.env.DEV) {
      console.log('Valor exato digitado no input:', newName);
    }
    
    // Validação de limite máximo de 30 caracteres
    if (newName.length > 30) {
      setNameError('Nome deve ter no máximo 30 caracteres');
      return; // Não permitir que o valor seja definido se exceder o limite
    } else {
      setNameError(null); // Limpar erro se estiver dentro do limite
    }
    
    // APENAS atualizar o estado local - SEM salvar automaticamente
    setUserName(newName);
    lastNameToSaveRef.current = newName;
    
    // Limpar qualquer timeout de salvamento anterior
    if (debounceSaveTimeout) {
      clearTimeout(debounceSaveTimeout);
      setDebounceSaveTimeout(null);
    }
    
    // NÃO disparar eventos durante a digitação para evitar loops
    // Os eventos serão disparados apenas no blur/save
  };

  // Função para lidar com o blur do campo de nome
  const handleNameBlur = () => {
    const currentName = userName || '';
    
    console.log('handleNameBlur: Saindo do campo com valor:', currentName);
    
    // Validações obrigatórias
    if (currentName.trim() === '') {
      setNameError('Nome de exibição é obrigatório');
      // Focar novamente no campo após um pequeno delay
      setTimeout(() => {
        const nameInput = document.getElementById('name') as HTMLInputElement;
        if (nameInput) {
          nameInput.focus();
        }
      }, 100);
      return;
    }
    
    // Validação de mínimo de 2 caracteres
    if (currentName.trim().length < 2) {
      setNameError('Nome deve ter pelo menos 2 caracteres');
      // Focar novamente no campo após um pequeno delay
      setTimeout(() => {
        const nameInput = document.getElementById('name') as HTMLInputElement;
        if (nameInput) {
          nameInput.focus();
        }
      }, 100);
      return;
    }
    
    // Se passou em todas as validações, limpar erro e salvar
    setNameError(null);
    
    // Salvar nas configurações locais
    saveUserSettings({ displayName: currentName });
    
    // Disparar evento para atualizar outros componentes (salvamento final)
    window.dispatchEvent(new CustomEvent('username-updated', { 
      detail: { userName: currentName, fromUpdate: false }
    }));
    
    // Salvar no servidor usando o novo sistema integrado com Supabase
    // O handleSave agora usa userService.updateDisplayNameDirect() que:
    // 1. Valida o nome (2-30 caracteres)
    // 2. Chama a função update_current_user_display_name() no banco
    // 3. Atualiza automaticamente o campo updated_at via trigger
    // 4. Sincroniza com localStorage e dispara eventos
    // 5. Tem fallback para o método anterior se falhar
    handleSave();
  };

  useEffect(() => {
    return () => {
      if (debounceSaveTimeout) {
        clearTimeout(debounceSaveTimeout);
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [debounceSaveTimeout]);

  const handleVerificationPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setVerificationPassword(value);
    console.log("Senha digitada no campo de verificação:", value);
  };

  // Armazenar o caminho atual para evitar redirecionamentos
  useEffect(() => {
    currentPathRef.current = location.pathname;
  }, [location]);

  // Verificar se houve redirecionamento e voltar para a página de configurações
  useEffect(() => {
    const handleRouteChange = () => {
      const currentPath = window.location.pathname;
      
      // Se o caminho mudou para /auth e estávamos na página de configurações
      if (currentPath.includes('/auth') && currentPathRef.current.includes('/settings')) {
        console.log('Detectado redirecionamento indesejado para autenticação, voltando para configurações...');
        // Voltar para a página de configurações
        navigate('/settings/account', { replace: true });
      }
    };

    // Verificar a cada 500ms se houve redirecionamento
    const intervalId = setInterval(handleRouteChange, 500);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [navigate]);

  // Função para forçar salvamento no Supabase usando o contexto de autenticação
  const forceSaveToSupabase = async (displayName: string): Promise<{ success: boolean; error?: unknown }> => {
    try {
      console.log("🔧 Forçando salvamento no Supabase para:", displayName);
      
      // Usar o usuário do contexto de autenticação
      if (!user?.id) {
        console.error("❌ Usuário não encontrado no contexto de autenticação");
        return { success: false, error: "Usuário não autenticado" };
      }
      
      console.log("✅ Usuário encontrado no contexto:", user.id);
      
      // Primeiro tentar usando a nova função RPC que usa userId diretamente
      try {
        console.log("🔧 Tentando nova função RPC com userId...");
        const { data, error } = await (getSupabase() as SupabaseClient).rpc('update_display_name_by_id', {
          p_user_id: user.id,
          p_display_name: displayName.trim()
        });
        
        if (!error && data?.success) {
          console.log("✅ Salvamento via RPC (com userId) bem-sucedido:", data);
          return { success: true };
        } else {
          console.warn("⚠️ RPC com userId falhou:", error || data);
        }
      } catch (rpcError) {
        console.warn("⚠️ Erro na função RPC com userId:", rpcError);
      }
      
      // Fallback: Tentar função RPC original
      try {
        console.log("🔧 Tentando função RPC original...");
        const { data, error } = await (getSupabase() as SupabaseClient).rpc('update_current_user_display_name', {
          p_display_name: displayName.trim()
        });
        
        if (!error && data?.success) {
          console.log("✅ Salvamento via RPC original bem-sucedido:", data);
          return { success: true };
        } else {
          console.warn("⚠️ RPC original falhou:", error || data);
        }
      } catch (rpcError) {
        console.warn("⚠️ Erro na função RPC original:", rpcError);
      }
      
      // Fallback: Atualizar diretamente na tabela user_profiles
      try {
        console.log("🔧 Tentando atualização direta na tabela...");
        const { error: upsertError } = await (getSupabase() as SupabaseClient)
          .from('user_profiles')
          .upsert({
            user_id: user.id,
            display_name: displayName.trim(),
            email: user.email,
            updated_at: new Date().toISOString()
          }, { 
            onConflict: 'user_id' 
          });
        
        if (!upsertError) {
          console.log("✅ Salvamento direto na tabela bem-sucedido");
          return { success: true };
        } else {
          console.error("❌ Erro na atualização direta:", upsertError);
        }
      } catch (directError) {
        console.error("❌ Erro na atualização direta:", directError);
      }
      
      // Último recurso: Usar cliente admin
      try {
        console.log("🔧 Tentando com cliente admin...");
        const { getSupabaseAdmin } = await import('@/lib/supabase');
        
        const { error: adminError } = await (getSupabaseAdmin() as SupabaseClient)
          .from('user_profiles')
          .upsert({
            user_id: user.id,
            display_name: displayName.trim(),
            email: user.email,
            updated_at: new Date().toISOString()
          }, { 
            onConflict: 'user_id' 
          });
        
        if (!adminError) {
          console.log("✅ Salvamento com cliente admin bem-sucedido");
          return { success: true };
        } else {
          console.error("❌ Erro com cliente admin:", adminError);
          return { success: false, error: adminError };
        }
      } catch (adminError) {
        console.error("❌ Erro com cliente admin:", adminError);
        return { success: false, error: adminError };
      }
      
    } catch (error) {
      console.error("❌ Erro inesperado ao forçar salvamento:", error);
      return { success: false, error };
    }
  };

  // Função para atualizar o contador regressivo do rate limit
  useEffect(() => {
    if (isRateLimited && rateLimitTime > 0) {
      // Atualizar o valor inicial
      setRemainingSeconds(Math.ceil((rateLimitTime - Date.now()) / 1000));
      
      const intervalId = setInterval(() => {
        const now = Date.now();
        if (now >= rateLimitTime) {
          setIsRateLimited(false);
          setPasswordAttempts(0);
          localStorage.removeItem('password-attempts');
          localStorage.removeItem('password-rate-limit-time');
          setRemainingSeconds(0);
          clearInterval(intervalId);
        } else {
          // Atualizar apenas o contador regressivo
          const secondsLeft = Math.ceil((rateLimitTime - now) / 1000);
          setRemainingSeconds(secondsLeft);
        }
      }, 500); // Atualizar a cada meio segundo para o contador fluir mais suavemente

      return () => clearInterval(intervalId);
    }
  }, [isRateLimited, rateLimitTime]);

  // Limpar o timer de rate limit quando o componente é desmontado
  useEffect(() => {
    return () => {
      if (rateLimitTimerRef.current) {
        clearTimeout(rateLimitTimerRef.current);
      }
    };
  }, []);

  // Verificar periodicamente se o rate limit no localStorage expirou
  useEffect(() => {
    const checkRateLimitExpiry = () => {
      const storedRateLimitTime = localStorage.getItem('password-rate-limit-time');
      if (storedRateLimitTime) {
        const limitTime = parseInt(storedRateLimitTime, 10);
        if (Date.now() >= limitTime) {
          // Limpar rate limit expirado
          localStorage.removeItem('password-attempts');
          localStorage.removeItem('password-rate-limit-time');
          setIsRateLimited(false);
          setPasswordAttempts(0);
          setRemainingSeconds(0);
        } else if (isRateLimited) {
          // Atualizar o tempo restante se ainda estiver limitado
          setRemainingSeconds(Math.ceil((limitTime - Date.now()) / 1000));
        }
      }
    };

    // Verificar ao montar o componente
    checkRateLimitExpiry();

    // Verificar a cada 5 segundos
    const intervalId = setInterval(checkRateLimitExpiry, 5000);
    return () => clearInterval(intervalId);
  }, [isRateLimited]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="space-y-8"
    >
      <div className="flex flex-col items-center">
        <div className="relative">
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* ✅ Avatar clicável - todo o círculo abre o seletor */}
            <div 
              onClick={triggerFileInput}
              className="cursor-pointer group relative"
              role="button"
              tabIndex={0}
              aria-label="Alterar foto de perfil"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  triggerFileInput();
                }
              }}
            >
              <Avatar className="h-24 w-24 border-[0.5px] border-white/[0.05] relative overflow-hidden bg-black/20 transition-all duration-200 group-hover:border-white/20 group-hover:shadow-lg group-hover:shadow-white/10">
                <AvatarImage
                  src={avatarUrl || undefined}
                  alt={userName || "Usuário"}
                  className="object-cover w-full h-full transition-all duration-200 group-hover:brightness-75"
                  onLoad={() => {
                    setUploading(false);
                  }}
                  style={{
                    opacity: 1,
                    transition: 'opacity 0.2s ease-in-out'
                  }}
                />
                <AvatarFallback className="bg-black/30 text-white/80 text-lg font-light transition-all duration-200 group-hover:bg-black/40">
                  {userName ? userName.charAt(0).toUpperCase() : "U"}
                </AvatarFallback>
              </Avatar>
              
              {/* ✅ Ícone de câmera - mantido para indicação visual */}
              <div className="absolute bottom-0 right-0 rounded-full w-8 h-8 p-0 bg-black/60 group-hover:bg-black/80 border-[0.5px] border-white/10 group-hover:border-white/30 flex items-center justify-center transition-all duration-200 pointer-events-none">
                {uploading ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 text-white/80 group-hover:text-white transition-colors duration-200" />
                )}
              </div>
              
              {/* ✅ Overlay hover para indicar que é clicável */}
              <div className="absolute inset-0 rounded-full bg-white/0 group-hover:bg-white/5 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Camera className="h-8 w-8 text-white/60" />
              </div>
            </div>
          </div>
          
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            ref={fileInputRef}
            onChange={handleImageChange}
            aria-label="Alterar foto de perfil"
          />
        </div>
        
        <span className="text-xs text-white/40 mt-3 tracking-wide font-light">
          {uploading ? t('settings.account.uploading') : t('settings.account.avatar.change')}
        </span>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label 
            htmlFor="name" 
            className="text-xs uppercase text-white/40 tracking-wider font-light flex items-center"
          >
            <UserIcon className="h-3 w-3 mr-1.5 opacity-40" />
            {t('settings.account.displayName')}
          </label>
          
          <div className="relative">
            <Input
              id="name"
              value={userName || ""}
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              maxLength={30}
              className={`bg-black/20 border-[0.5px] ${nameError ? 'border-red-500/50' : 'border-white/[0.06]'} h-10 px-4 pr-16 text-white/70 hover:bg-black/30 transition-all duration-200 ease-out rounded-lg placeholder:text-white/20 focus:border-white/[0.11] focus:border-[1px]`}
              placeholder="Digite seu nome (mín. 2, máx. 30 caracteres)"
              spellCheck="false"
              autoCorrect="off"
              autoCapitalize="off"
              data-lpignore="true"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-white/40">
              {(userName || "").length}/30
            </div>
          </div>
          {nameError && (
            <p className="text-xs text-red-400 mt-1 flex items-center">
              {nameError}
            </p>
          )}
          <p className="text-[10px] text-white/50 flex items-center tracking-wide mt-1">
            {userName && userName.trim() !== '' ? (
              <span className="ml-1">{`${t('settings.account.displayName')}: ${userName}`}</span>
            ) : <span className="text-white/30">{t('profile.name.addHint')}</span>}
            {saving && (
              <span className="ml-2 flex items-center">
                <div className="h-2.5 w-2.5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin mr-1" />
                <span className="text-white/40">{t('common.saving')}</span>
              </span>
            )}
          </p>
        </div>

        <div className="space-y-2">
          <label 
            htmlFor="email" 
            className="text-xs uppercase text-white/40 tracking-wider font-light flex items-center"
          >
            <Mail className="h-3 w-3 mr-1.5 opacity-40" />
            {t('settings.account.email')}
          </label>
          
          <Input
            id="email"
            type="email"
            value={user?.email || ""}
            disabled
            className="bg-black/10 border-[0.5px] border-white/[0.02] h-10 px-4 text-white/30 rounded-lg cursor-not-allowed"
          />
          <p className="text-[10px] text-white/30 flex items-center tracking-wide">
            <Lock className="h-2.5 w-2.5 mr-1 opacity-50" />
            {t('settings.account.emailFixed')}
          </p>
        </div>

        <div className="space-y-2">
          <label 
            htmlFor="password" 
            className="text-xs uppercase text-white/40 tracking-wider font-light flex items-center"
          >
            <KeyRound className="h-3 w-3 mr-1.5 opacity-40" />
            {t('settings.account.password')}
          </label>
          
          <div className="relative">
            <div className={`flex items-center gap-3 ${passwordUpdateMode ? 'mb-4' : ''}`}>
              <div className="relative flex-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={passwordUpdateMode 
                    ? newPassword 
                    : showPassword 
                      ? tempPassword || actualPassword 
                      : "••••••••••"
                  }
                  onChange={passwordUpdateMode ? (e) => setNewPassword(e.target.value) : undefined}
                  readOnly={!passwordUpdateMode}
                  disabled={!passwordUpdateMode}
                  placeholder={passwordUpdateMode ? "Digite sua nova senha" : ""}
                  className={`
                    pr-10 bg-gradient-to-r 
                    ${passwordUpdateMode 
                      ? "from-black/20 to-black/30 border-white/[0.05] text-white/70 focus:outline-none focus:ring-1 focus:ring-white/10" 
                      : showPassword 
                        ? "from-black/10 to-black/15 border-white/[0.02] text-white cursor-not-allowed font-medium" 
                        : "from-black/10 to-black/15 border-white/[0.02] text-white/30 cursor-not-allowed"
                    } 
                    border-[0.5px] h-11 px-4 rounded-lg transition-all duration-300
                    ${showPassword ? "ring-1 ring-green-500/20 border-green-500/30" : ""}
                  `}
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (showPassword) {
                      setShowPassword(false);
                      setTempPassword("");
                      setActualPassword("");
                    } else {
                      setVerificationError("");
                      setVerificationPassword("");
                      setVerificationShowPassword(false);
                      setAuthSuccess(false);
                      setAuthInProgress(false);
                      setIsAuthenticating(false);
                      setShowPassword(false);
                      setActualPassword("");
                      setTempPassword("");
                      requestAnimationFrame(() => {
                        setIsVerifyPasswordOpen(true);
                      });
                    }
                  }}
                  className={`
                    absolute right-0 top-0 h-full px-3 rounded-r-lg
                    bg-transparent hover:bg-black/20 border-none 
                    transition-colors duration-200
                    text-white/50 hover:text-white/70
                  `}
                  disabled={passwordUpdateMode}
                  title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button 
                onClick={() => {
                  if (passwordUpdateMode) {
                    setPasswordUpdateMode(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  } else {
                    // Abrir dialog de confirmação de email para reset
                    setConfirmEmail(user?.email || '');
                    setEmailError('');
                    setIsEmailConfirmOpen(true);
                  }
                }}
                className={`
                  h-11 px-4 rounded-lg transition-all duration-300 group
                  ${passwordUpdateMode
                    ? "bg-gradient-to-r from-black to-black/50 hover:from-black hover:to-black/70 text-white/80 border-[0.5px] border-white/20" 
                    : "bg-black/20 hover:bg-black/30 text-white/70 hover:text-white/90 border-[0.5px] border-white/[0.03]"
                  }
                `}
              >
                <KeyRound className="h-3.5 w-3.5 mr-2 opacity-50 group-hover:opacity-70 transition-opacity" />
                <span className="text-xs tracking-wide">
                  {passwordUpdateMode ? t('common.cancel') : t('settings.account.changePassword')}
                </span>
              </Button>
            </div>
            
            {passwordUpdateMode && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <Input
                  id="currentPassword"
                  type={showPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Digite sua senha atual"
                  className="bg-gradient-to-r from-black/20 to-black/30 border-[0.5px] border-white/[0.05] text-white/70 focus:outline-none focus:ring-1 focus:ring-white/10 h-11 px-4 rounded-lg transition-all duration-300 mt-3"
                />
                
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    
                    const newConfirmPass = e.target.value;
                    if (currentPassword && newPassword && newConfirmPass && newPassword === newConfirmPass && newPassword.length >= 8) {
                      if (debounceSaveTimeout) {
                        clearTimeout(debounceSaveTimeout);
                      }
                      
                      const timeout = setTimeout(() => {
                        updateUserPassword();
                      }, 1000);
                      
                      setDebounceSaveTimeout(timeout);
                    }
                  }}
                  placeholder="Confirme sua nova senha"
                  className="bg-gradient-to-r from-black/20 to-black/30 border-[0.5px] border-white/[0.05] text-white/70 focus:outline-none focus:ring-1 focus:ring-white/10 h-11 px-4 rounded-lg transition-all duration-300"
                />
                
                <div className="rounded-lg bg-gradient-to-r from-black/30 to-black/20 border border-white/[0.03] p-3">
                  <div className="flex items-start space-x-3">
                    <div className="min-w-5 mt-0.5">
                      <div className="h-4 w-4 rounded-full bg-[#006400]/20 flex items-center justify-center">
                        <Lock className="h-2 w-2 text-[#006400]/80" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-white/70">{t('settings.account.passwordRequirements')}:</p>
                      <ul className="text-[11px] text-white/50 space-y-1 list-disc pl-3">
                        <li className={newPassword && newPassword.length >= 8 ? "text-[#006400]/80" : ""}>{t('settings.account.passwordMin8')}</li>
                        <li className={newPassword && /[A-Z]/.test(newPassword) ? "text-[#006400]/80" : ""}>{t('settings.account.passwordUppercase')}</li>
                        <li className={newPassword && /[0-9]/.test(newPassword) ? "text-[#006400]/80" : ""}>{t('settings.account.passwordNumber')}</li>
                        <li className={newPassword && /[^A-Za-z0-9]/.test(newPassword) ? "text-[#006400]/80" : ""}>{t('settings.account.passwordSpecial')}</li>
                        <li className={newPassword && confirmPassword && newPassword === confirmPassword ? "text-[#006400]/80" : ""}>{t('settings.account.passwordMatch')}</li>
                      </ul>
                      {saving && (
                        <p className="text-[11px] flex items-center text-white/60 mt-2">
                          <div className="h-3 w-3 border-2 border-white/30 border-t-white/80 rounded-full animate-spin mr-1.5" />
                          {t('settings.account.savingPassword')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            
            {!passwordUpdateMode && (
              <>
              <p className="text-[10px] text-white/30 flex items-center tracking-wide mt-1">
                <Lock className="h-2.5 w-2.5 mr-1 opacity-50" />
                  {showPassword 
                    ? <span className="text-white/60">{t('settings.account.passwordShown')}</span> 
                    : t('settings.account.passwordProtected')}
              </p>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog 
        open={isVerifyPasswordOpen} 
        onOpenChange={(open) => {
          // ❌ IMPORTANTE: Não permitir fechar o modal durante verificação
          if (authInProgress) {
            return;
          }
          
          // ❌ IMPORTANTE: Só permitir fechar o modal se não houver erro
          // Se houver erro de senha incorreta, manter o modal aberto
          if (!open && verificationError) {
            console.log("❌ Modal não pode ser fechado - senha incorreta");
            return;
          }
          
          if (!open) {
            setVerificationPassword("");
            setVerificationError("");
            setVerificationShowPassword(false);
            setAuthInProgress(false);
            setIsAuthenticating(false);
            setAuthSuccess(false);
          }
          setIsVerifyPasswordOpen(open);
        }}
      >
        <DialogContent 
          className="bg-gradient-to-b from-black/95 to-black/90 border border-white/10 shadow-2xl backdrop-blur-sm w-full max-w-[85vw] sm:max-w-md rounded-xl max-h-[90vh]"
          onEscapeKeyDown={(e) => {
            // ❌ Não permitir fechar com ESC se houver erro de senha
            if (verificationError) {
              e.preventDefault();
              console.log("❌ ESC bloqueado - senha incorreta");
              return;
            }
            
            if (!authInProgress && !authSuccess) {
              setIsVerifyPasswordOpen(false);
            }
          }}
          onPointerDownOutside={(e) => {
            // ❌ Não permitir fechar clicando fora se houver erro de senha
            if (verificationError) {
              e.preventDefault();
              console.log("❌ Clique fora bloqueado - senha incorreta");
              return;
            }
            
            if (!authInProgress && !authSuccess) {
              setIsVerifyPasswordOpen(false);
            }
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`dialog-content-${authSuccess ? 'success' : 'input'}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full overflow-hidden"
            >
              <DialogHeader className="space-y-3 pb-2 w-full overflow-hidden">
                <DialogTitle className="text-white text-xl font-medium flex items-center justify-center text-center w-full">
                  <div className="mr-2 bg-white/10 p-2 rounded-full flex-shrink-0">
                    <Lock className="h-5 w-5 text-white/90" />
                  </div>
                  <span className="truncate">{t('settings.account.verifyPassword')}</span>
                </DialogTitle>
                <DialogDescription className="text-white/70 text-sm mt-2 text-center leading-relaxed px-2 w-full break-words">
                  {t('settings.account.verifyPasswordDesc')}
                </DialogDescription>
              </DialogHeader>
              
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-4 py-3 px-1"
              >
                                  <div className="space-y-3">
                  <label className="text-sm text-white/90 font-medium block text-center">{t('settings.account.enterPassword')}</label>
                  <div className="relative group w-full">
                    <input
                      type={verificationShowPassword ? "text" : "password"}
                      placeholder={t('settings.account.currentPassword')}
                      value={verificationPassword}
                      onChange={handleVerificationPasswordChange}
                      style={{
                        outline: 'none !important',
                        boxShadow: 'none !important',
                        border: authSuccess ? '1px solid rgba(34, 197, 94, 0.4) !important' : '1px solid rgba(255, 255, 255, 0.15) !important',
                        background: 'rgba(0, 0, 0, 0.6)',
                        color: 'rgba(255, 255, 255, 0.9)',
                        height: '48px',
                        paddingLeft: '12px',
                        paddingRight: '48px',
                        fontSize: '14px',
                        width: '100%',
                        borderRadius: '8px',
                        transition: 'all 0.3s ease',
                      }}
                      onFocus={(e) => {
                        if (!authSuccess) {
                          e.target.style.border = '1px solid rgba(255, 255, 255, 0.16)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!authSuccess) {
                          e.target.style.border = '1px solid rgba(255, 255, 255, 0.15)';
                        }
                      }}
                      className="placeholder:text-white/40"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && verificationPassword.length > 0 && !authInProgress) {
                          verifyPassword();
                        }
                      }}
                      disabled={authInProgress || authSuccess}
                      autoFocus
                    />
                    <Button
                      type="button"
                      onClick={() => setVerificationShowPassword(!verificationShowPassword)}
                      style={{ transform: 'none' }}
                      className="absolute right-0 top-0 h-full px-3 rounded-r-lg bg-transparent hover:bg-black/30 border-none text-white/60 hover:text-white/90 transition-colors duration-200 hover:transform-none hover:scale-100"
                      title={verificationShowPassword ? t('settings.account.hidePassword') : t('settings.account.showPassword')}
                      disabled={authInProgress || authSuccess}
                    >
                      {verificationShowPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  
                  <AnimatePresence>
                    {verificationError && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-start text-red-400 text-xs mt-2 bg-red-500/10 p-2 rounded-lg w-full border border-red-500/20"
                        style={{ maxHeight: "60px", overflow: "hidden" }}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-2 flex-shrink-0 mt-0.5" />
                        <div className="overflow-hidden">
                          <p className="break-words line-clamp-2">{verificationError}</p>
                          
                          {/* Contador visual quando estiver com rate limit */}
                          {isRateLimited && (
                            <div className="mt-2">
                              <div className="w-full bg-red-900/20 rounded-full h-1.5">
                                <div 
                                  className="bg-red-600/50 h-1.5 rounded-full transition-all duration-200 ease-out"
                                  style={{ 
                                    width: `${Math.max(0, Math.min(100, (remainingSeconds / (RATE_LIMIT_DURATION / 1000)) * 100))}%` 
                                  }}
                                ></div>
                              </div>
                              <p className="text-[10px] text-red-400/80 mt-1">
                                Aguarde <span className="font-semibold">{remainingSeconds}</span> segundos antes de tentar novamente
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                <div className="bg-black rounded-lg border border-white/10 p-3 w-full overflow-hidden">
                  <div className="flex items-start">
                    <div className="mt-0.5 mr-2 flex-shrink-0">
                      <div className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center">
                        <CheckCircle2 className="h-3 w-3 text-white/80" />
                      </div>
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-xs text-white/80 leading-relaxed break-words">
                        {t('settings.account.afterVerificationMessage')}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
              
              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-2 mt-4 pt-3 border-t border-white/10 w-full relative z-50">
                <Button
                  variant="ghost"
                  onClick={() => {
                    // ✅ Limpar todos os estados antes de fechar
                    setVerificationPassword("");
                    setVerificationError("");
                    setAuthInProgress(false);
                    setIsAuthenticating(false);
                    setAuthSuccess(false);
                    setVerificationShowPassword(false);
                    
                    // ✅ Agora pode fechar o modal
                    setIsVerifyPasswordOpen(false);
                    
                    console.log("✅ Cancelado - modal fechado sem mostrar senha");
                  }}
                  style={{ zIndex: 9999, position: 'relative', transform: 'none' }}
                  className="h-10 bg-transparent hover:bg-white/5 text-white/70 border border-white/10 rounded-lg transition-colors duration-200 w-full sm:w-auto order-2 sm:order-1 text-sm relative z-[9999] hover:transform-none hover:scale-100"
                  disabled={authInProgress}
                >
                  {t('common.cancel')}
                </Button>
                
                <Button
                  onClick={handleForgotPassword}
                  style={{ zIndex: 9999, position: 'relative', transform: 'none' }}
                  className="h-10 bg-transparent hover:bg-white/5 text-white/70 border border-white/10 rounded-lg transition-colors duration-200 w-full sm:w-auto order-3 sm:order-2 text-sm relative z-[9999] hover:transform-none hover:scale-100"
                  disabled={authInProgress}
                >
                  {t('settings.account.forgotPassword') || "Esqueci minha senha"}
                </Button>
                
                <Button
                  onClick={verifyPassword}
                  disabled={verificationPassword.length === 0 || authInProgress}
                  style={{ zIndex: 9999, position: 'relative', transform: 'none' }}
                  className={`
                    h-10 rounded-lg transition-colors duration-300 w-full sm:w-auto order-1 sm:order-3
                    relative overflow-hidden group text-sm font-medium z-[9999]
                    hover:transform-none hover:scale-100
                    ${verificationPassword.length === 0 || authInProgress
                      ? "bg-black/50 text-white/40 border border-white/5 cursor-not-allowed" 
                      : "bg-black border border-white/20 hover:bg-white/5 shadow-sm"
                    }
                  `}
                >
                  <span className="relative flex items-center justify-center" style={{
                    color: verificationPassword.length === 0 || authInProgress ? '' : '#FFFFFFB3'
                  }}>
                    {t('settings.verify')}
                  </span>
                </Button>
              </DialogFooter>
            </motion.div>
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEmailConfirmOpen}
        onOpenChange={(open) => {
          if (!authInProgress) {
            setIsEmailConfirmOpen(open);
            if (!open) {
              setConfirmEmail('');
              setEmailError('');
            }
          }
        }}
      >
        <DialogContent className="bg-gradient-to-b from-black/95 to-black/90 border border-white/10 shadow-2xl backdrop-blur-sm w-full max-w-[85vw] sm:max-w-md rounded-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="space-y-4 py-2"
          >
            <DialogHeader className="space-y-3 pb-2">
              <DialogTitle className="text-white text-xl font-medium flex items-center justify-center text-center">
                <div className="mr-2 bg-white/10 p-2 rounded-full flex-shrink-0">
                  <Mail className="h-5 w-5 text-white/90" />
                </div>
                <span>{t('settings.account.confirmEmail')}</span>
              </DialogTitle>
              <DialogDescription className="text-white/70 text-sm text-center leading-relaxed">
                {t('settings.account.confirmEmailDesc')}
              </DialogDescription>
            </DialogHeader>
            
                          <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-white/90 font-medium block">{t('settings.account.accountEmail')}</label>
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => {
                    setConfirmEmail(e.target.value);
                    setEmailError('');
                  }}
                                    className={`
                    w-full h-12 px-3 rounded-lg text-sm
                    bg-black/20 text-white/90
                    border-[0.5px] ${emailError ? 'border-red-500/50' : 'border-white/[0.03]'}
                    outline-none focus:outline-none focus-visible:outline-none
                    focus:border-white/[0.07] focus:border-[1px]
                    hover:bg-black/30
                    transition-colors duration-200 ease-out
                    placeholder:text-white/40
                    [-webkit-appearance:none]
                    [-webkit-tap-highlight-color:transparent]
                  `}
                  placeholder={t('settings.account.enterYourEmail')}
                  disabled={authInProgress}
                />
                
                {emailError && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-start text-red-400 text-xs bg-red-500/10 p-2 rounded-lg border border-red-500/20"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-2 flex-shrink-0 mt-0.5" />
                    <p>{emailError}</p>
                  </motion.div>
                )}
              </div>
              
              <div className="bg-black rounded-lg border border-white/10 p-3">
                <div className="flex items-start">
                  <div className="mt-0.5 mr-2 flex-shrink-0">
                    <div className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center">
                      <CheckCircle2 className="h-3 w-3 text-white/80" />
                    </div>
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-xs text-white/80 leading-relaxed">
                      {t('settings.account.resetLinkWillBeSent')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4 pt-3 border-t border-white/10">
              <Button
                variant="ghost"
                onClick={() => setIsEmailConfirmOpen(false)}
                className="h-10 bg-transparent hover:bg-white/5 text-white/70 border border-white/10 rounded-lg transition-colors duration-200 w-full sm:w-auto"
                disabled={authInProgress}
              >
                {t('common.cancel')}
              </Button>
              
              <Button
                onClick={handleEmailReset}
                disabled={!confirmEmail || authInProgress}
                style={{ zIndex: 9999, position: 'relative', transform: 'none' }}
                className={`
                  h-10 rounded-lg transition-colors duration-300 w-full sm:w-auto
                  relative group text-sm font-medium hover:transform-none hover:scale-100
                  ${!confirmEmail || authInProgress
                    ? "bg-black/50 text-white/40 border border-white/5 cursor-not-allowed" 
                    : "bg-black border border-white/20 hover:bg-white/5 shadow-sm"
                  }
                `}>
                <span className="relative flex items-center justify-center" style={{
                  color: !confirmEmail || authInProgress ? '' : '#FFFFFFB3'
                }}>
                  {authInProgress ? (
                    <>
                      <span className="h-3.5 w-3.5 mr-2 rounded-full border-2 border-white/30 border-t-white/80 animate-spin"></span>
                      {t('settings.account.sending')}
                    </>
                  ) : (
                    <>
                      <Mail className="h-3.5 w-3.5 mr-2 opacity-80" />
                      {t('settings.account.sendEmail')}
                    </>
                  )}
                </span>
              </Button>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isResetEmailSentOpen}
        onOpenChange={(open) => setIsResetEmailSentOpen(open)}
      >
        <DialogContent className="bg-gradient-to-b from-black/95 to-black/90 border border-white/10 shadow-2xl backdrop-blur-sm sm:max-w-md rounded-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="text-center space-y-4 py-4"
          >
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            
            <DialogTitle className="text-xl font-medium text-white">
              {t('settings.account.emailSentSuccess')}
            </DialogTitle>
            
            <DialogDescription className="text-white/70 text-sm max-w-xs mx-auto">
              {t('settings.account.resetPasswordEmailSent')} {confirmEmail || user?.email}. {t('settings.account.checkYourInbox')}
            </DialogDescription>
            
            <Button
              className="w-full bg-black border border-white/10 hover:bg-white/5 text-white h-11 rounded-lg mt-4"
              onClick={() => {
                const userEmail = confirmEmail || user?.email || "";
                const emailDomain = userEmail.split('@')[1]?.toLowerCase() || "";
                
                let emailServiceUrl = "";
                
                if (emailDomain.includes("gmail") || emailDomain.includes("google")) {
                  emailServiceUrl = "https://mail.google.com";
                } else if (emailDomain.includes("outlook") || emailDomain.includes("hotmail") || emailDomain.includes("live")) {
                  emailServiceUrl = "https://outlook.live.com/mail";
                } else if (emailDomain.includes("yahoo")) {
                  emailServiceUrl = "https://mail.yahoo.com";
                } else if (emailDomain.includes("proton") || emailDomain.includes("pm.me")) {
                  emailServiceUrl = "https://mail.proton.me";
                } else if (emailDomain.includes("zoho")) {
                  emailServiceUrl = "https://mail.zoho.com";
                } else if (emailDomain.includes("icloud") || emailDomain.includes("me.com") || emailDomain.includes("mac.com")) {
                  emailServiceUrl = "https://www.icloud.com/mail";
                } else if (emailDomain.includes("aol")) {
                  emailServiceUrl = "https://mail.aol.com";
                } else if (emailDomain.includes("mail.ru")) {
                  emailServiceUrl = "https://mail.ru";
                } else if (emailDomain.includes("yandex")) {
                  emailServiceUrl = "https://mail.yandex.com";
                } else if (emailDomain.includes("gmx")) {
                  emailServiceUrl = "https://www.gmx.com";
                } else if (emailDomain.includes("uol")) {
                  emailServiceUrl = "https://mail.uol.com.br";
                } else if (emailDomain.includes("terra")) {
                  emailServiceUrl = "https://mail.terra.com.br";
                } else if (emailDomain.includes("bol")) {
                  emailServiceUrl = "https://email.bol.uol.com.br";
                } else if (emailDomain.includes("globo")) {
                  emailServiceUrl = "https://mail.globo.com";
                } else {
                  emailServiceUrl = "https://mail.google.com";
                }
                
                window.open(emailServiceUrl, '_blank', 'noopener,noreferrer');
              }}
            >
              <Mail className="h-4 w-4 mr-2 opacity-80" />
              {t('settings.account.openMyEmail')}
            </Button>
            
            <Button
              variant="ghost"
              className="w-full bg-transparent hover:bg-white/5 text-white/60 border border-white/5 h-10 rounded-lg"
              onClick={() => setIsResetEmailSentOpen(false)}
            >
              {t('settings.close')}
            </Button>
          </motion.div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}