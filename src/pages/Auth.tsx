import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, UserPlus, KeyRound, Loader2, CheckCircle2, LogIn, AlertCircle, Mail, CheckCheck, Eye, EyeOff, ExternalLink, ArrowLeft, Heart, Link as LinkIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { InvestorTypeSelector } from "@/components/ui/investor-type-selector";
import { useLanguage, Language } from "@/contexts/LanguageContext";
import { termsAndConditionsService, type TermsAndConditions } from "@/services/termsAndConditionsService";
import { LanguageSelector } from "@/components/ui/language-selector";
import { getAuthTranslations } from "@/utils/authTranslations";

// Estilo global para barras de rolagem elegantes
const GlobalScrollbarStyle = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    /* Estilização para navegadores WebKit (Chrome, Safari, etc.) */
    ::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    
    ::-webkit-scrollbar-track {
      background: transparent;
      margin: 3px;
    }
    
    ::-webkit-scrollbar-thumb {
      background-color: rgba(255, 255, 255, 0.05);
      border-radius: 20px;
      border: none;
      transition: background-color 0.3s ease;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background-color: rgba(255, 255, 255, 0.15);
    }
    
    /* Estilização específica para o modal de termos e condições */
    .terms-modal-content::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    .terms-modal-content::-webkit-scrollbar-track {
      margin: 4px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 10px;
    }
    
    .terms-modal-content::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, rgba(161, 161, 170, 0.3) 0%, rgba(82, 82, 91, 0.2) 100%);
      box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.3);
      border-radius: 10px;
      min-height: 40px;
      max-height: 100px;
      border: 2px solid rgba(0, 0, 0, 0.2);
    }
    
    .terms-modal-content::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(180deg, rgba(161, 161, 170, 0.4) 0%, rgba(82, 82, 91, 0.3) 100%);
    }
    
    /* Animações para o modal */
    .terms-modal-content h3 {
      position: relative;
      padding-left: 15px;
      margin-top: 1.5rem;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    }
    
    .terms-modal-content h3::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      width: 3px;
      background: linear-gradient(180deg, rgba(161, 161, 170, 0.2) 0%, rgba(82, 82, 91, 0.1) 100%);
      border-radius: 2px;
    }
    
    .terms-modal-content p strong {
      color: rgba(212, 212, 216, 0.9);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }
    
    .terms-modal-highlight {
      background: linear-gradient(90deg, rgba(82, 82, 91, 0.05) 0%, transparent 100%);
      border-left: 3px solid rgb(82, 82, 91);
      padding: 0.75rem 1rem;
      margin: 1rem 0;
      border-radius: 0 4px 4px 0;
      transition: all 0.3s ease;
    }
    
    .terms-modal-highlight:hover {
      background: linear-gradient(90deg, rgba(82, 82, 91, 0.08) 0%, transparent 100%);
      transform: translateX(2px);
    }
  `}} />
);

// Componente ErrorMessage movido para fora para evitar re-criação a cada render
const ErrorMessage = ({ message }: { message: string }) => (
  <motion.div 
    initial={{ opacity: 0, height: 0 }}
    animate={{ opacity: 1, height: 'auto' }}
    exit={{ opacity: 0, height: 0 }}
    transition={{ duration: 0.2 }}
    className="flex items-center text-rose-400/80 text-xs mt-1.5"
  >
    <AlertCircle className="h-3 w-3 mr-1.5 flex-shrink-0" />
    <span>{message}</span>
  </motion.div>
);

// Função de debounce para melhorar a fluidez da digitação
const debounce = <T extends unknown[]>(func: (...args: T) => void, delay: number) => {
  let timer: NodeJS.Timeout;
  return (...args: T) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

// Utilitário cn do shadcn-ui
const cn = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter(Boolean).join(' ');
};

export default function Auth() {
  const { t, language, changeLanguage } = useLanguage();
  
  // Obter traduções específicas para autenticação
  const authT = getAuthTranslations(language);
  
  // Estado para os termos e condições específicos por país
  const [termsAndConditions, setTermsAndConditions] = useState<TermsAndConditions | null>(null);
  
  // Estado para controle das abas
  const [activeTab, setActiveTab] = useState("login");
  
  // Estado para signupSuccess - DEVE ser declarado antes dos useEffects que o utilizam
  const [signupSuccess, setSignupSuccess] = useState(() => {
    // Verificar se acabou de se cadastrar ao inicializar o estado
    const justRegistered = sessionStorage.getItem('just-registered') === 'true';
    if (justRegistered) {
      // Usuário acabou de se cadastrar
    }
    return justRegistered;
  });

  // Função para carregar termos específicos do país e idioma
  const loadTermsForCountry = useCallback(async (targetLanguage?: string) => {
    try {
            const terms = await termsAndConditionsService.getTermsForUserCountry(targetLanguage as 'pt' | 'en' | 'es');
            setTermsAndConditions(terms);
    } catch (error) {
      console.error('🏛️ [Auth] Erro ao carregar termos:', error);
    }
  }, []);

  // Carregar termos e condições específicos do país e idioma atual
  useEffect(() => {
        loadTermsForCountry(language);
  }, [loadTermsForCountry, language]);
    
  // Monitorar flag just-registered para garantir que tela de sucesso seja mantida
  useEffect(() => {
    const checkJustRegistered = () => {
      const justRegistered = sessionStorage.getItem('just-registered') === 'true';
      const preventAuthRedirect = sessionStorage.getItem('prevent_auth_redirect') === 'true';
      const preventDashboardRedirect = localStorage.getItem('prevent_dashboard_redirect') === 'true';
      const registeredEmail = sessionStorage.getItem('registered-email');
      
      // Verificar expiração da flag prevent_dashboard_redirect
      let preventDashboardRedirectValid = preventDashboardRedirect;
      if (preventDashboardRedirect) {
        const expirationTime = localStorage.getItem('prevent_dashboard_redirect_expiration');
        if (expirationTime && parseInt(expirationTime) < Date.now()) {
                    localStorage.removeItem('prevent_dashboard_redirect');
          localStorage.removeItem('prevent_dashboard_redirect_expiration');
          preventDashboardRedirectValid = false;
        }
      }
      
      const cadastroConcluido = justRegistered || preventAuthRedirect || preventDashboardRedirectValid;
      
      if (cadastroConcluido && !signupSuccess) {
                        
        setSignupSuccess(true);
        
        // Se temos o email armazenado, usar ele
        if (registeredEmail) {
          setRegisteredEmail(registeredEmail);
          setVerifyEmailAddress(registeredEmail);
        }
      }
    };
    
    // Verificar imediatamente
    checkJustRegistered();
    
    // Verificar periodicamente (caso a flag seja definida depois)
    const interval = setInterval(checkJustRegistered, 500);
    
    return () => clearInterval(interval);
  }, [signupSuccess]);

  // Escutar mudanças de idioma e recarregar termos
  useEffect(() => {
    const handleLanguageChange = (event: CustomEvent) => {
      const { language: newLanguage } = event.detail;
            
      // Recarregar termos para o novo idioma
      loadTermsForCountry(newLanguage);
    };

    // Adicionar listener para evento de mudança de idioma
    window.addEventListener('languageChanged', handleLanguageChange as EventListener);

    // Cleanup: remover listener quando componente desmontar
    return () => {
      window.removeEventListener('languageChanged', handleLanguageChange as EventListener);
    };
  }, [loadTermsForCountry]);

  // Adicione este estilo global para corrigir o preenchimento automático
  useEffect(() => {
    // Criar um estilo global para corrigir o preenchimento automático
    const style = document.createElement('style');
    style.textContent = `
      /* SOLUÇÃO ULTRA-AGRESSIVA PARA REMOVER CONTORNOS ADICIONAIS */
      input[type="email"],
      input[type="password"], 
      input[type="text"] {
        /* Reset completo de todas as propriedades relacionadas a rings/outlines */
        outline: none !important;
        box-shadow: none !important;
        --tw-ring-offset-shadow: 0 0 #0000 !important;
        --tw-ring-shadow: 0 0 #0000 !important;
        --tw-ring-inset: initial !important;
        --tw-ring-offset-width: 0px !important;
        --tw-ring-offset-color: transparent !important;
        --tw-ring-color: transparent !important;
        --tw-ring-opacity: 0 !important;
        border-style: solid !important;
      }
      
      /* Estado normal */
      input[type="email"]:not(:focus),
      input[type="password"]:not(:focus),
      input[type="text"]:not(:focus) {
        border-width: 0.5px !important;
        box-shadow: none !important;
        outline: none !important;
      }
      
      /* Estado de focus - APENAS mudança de cor da borda */
      input[type="email"]:focus,
      input[type="password"]:focus,
      input[type="text"]:focus {
        border-color: rgba(255, 255, 255, 0.1) !important;
        background-color: rgba(0, 0, 0, 0.25) !important;
        border-width: 0.5px !important;
        outline: none !important;
        box-shadow: none !important;
        --tw-ring-offset-shadow: 0 0 #0000 !important;
        --tw-ring-shadow: 0 0 #0000 !important;
      }
      
      /* Remover TODOS os tipos de ring/outline possíveis */
      input[type="email"]:focus-visible,
      input[type="password"]:focus-visible,
      input[type="text"]:focus-visible,
      input[type="email"]:focus-within,
      input[type="password"]:focus-within,
      input[type="text"]:focus-within,
      input[type="email"]:active,
      input[type="password"]:active,
      input[type="text"]:active {
        outline: none !important;
        box-shadow: none !important;
        --tw-ring-offset-shadow: 0 0 #0000 !important;
        --tw-ring-shadow: 0 0 #0000 !important;
        border-width: 0.5px !important;
      }
      
      /* Sobrescrever autofill */
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      input:-webkit-autofill:active {
        -webkit-box-shadow: 0 0 0 30px rgba(0, 0, 0, 0.2) inset !important;
        -webkit-text-fill-color: rgba(255, 255, 255, 0.7) !important;
        caret-color: rgba(255, 255, 255, 0.7) !important;
        transition: background-color 5000s ease-in-out 0s;
        background-color: rgba(0, 0, 0, 0.2) !important;
        outline: none !important;
        box-shadow: 0 0 0 30px rgba(0, 0, 0, 0.2) inset !important;
      }
      
      /* Seleção de texto */
      input::selection {
        background-color: rgba(255, 255, 255, 0.1) !important;
      }
      
      /* Força remoção global de qualquer ring/outline via CSS */
      * {
        --tw-ring-offset-shadow: 0 0 #0000 !important;
        --tw-ring-shadow: 0 0 #0000 !important;
      }
    `;
    document.head.appendChild(style);
    
    // Aplicar CSS diretamente via JavaScript para garantir funcionamento
    const applyInputStyles = () => {
      const inputs = document.querySelectorAll('input[type="email"], input[type="password"], input[type="text"]');
      inputs.forEach((input) => {
        const el = input as HTMLInputElement;
        // Verificar se já foi processado para evitar múltiplos listeners
        if (el.hasAttribute('data-styled')) return;
        el.setAttribute('data-styled', 'true');
        
        // Aplicar estilos base
        el.style.outline = 'none';
        el.style.boxShadow = 'none';
        el.style.setProperty('--tw-ring-offset-shadow', '0 0 #0000', 'important');
        el.style.setProperty('--tw-ring-shadow', '0 0 #0000', 'important');
        
        // Event listeners para focus e blur
        const handleFocus = (e: FocusEvent) => {
          const target = e.target as HTMLInputElement;
          target.style.outline = 'none';
          target.style.boxShadow = 'none';
          target.style.borderWidth = '0.5px';
          target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          target.style.backgroundColor = 'rgba(0, 0, 0, 0.25)';
        };
        
        const handleBlur = (e: FocusEvent) => {
          const target = e.target as HTMLInputElement;
          target.style.outline = 'none';
          target.style.boxShadow = 'none';
          target.style.borderWidth = '0.5px';
          target.style.borderColor = 'rgba(255, 255, 255, 0.03)';
          target.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
        };
        
        // Adicionar listeners sem interferir com os existentes
        el.addEventListener('focus', handleFocus, { passive: true });
        el.addEventListener('blur', handleBlur, { passive: true });
        
        // Garantir que clicks fora desselecionem
        document.addEventListener('click', (e: MouseEvent) => {
          const target = e.target as Node;
          if (!el.contains(target) && target !== el) {
            el.blur();
          }
        }, { passive: true });
      });
    };
    
    // Aplicar estilos imediatamente e após mudanças no DOM
    applyInputStyles();
    const observer = new MutationObserver(applyInputStyles);
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Limpar quando o componente for desmontado
    return () => {
      document.head.removeChild(style);
      observer.disconnect();
    };
  }, []);

  // Verificar se o usuário chegou via link de redefinição de senha
  useEffect(() => {
    const url = new URL(window.location.href);
    const type = url.searchParams.get('type');
    const code = url.searchParams.get('code');
    const forgot = url.searchParams.get('forgot');
    const urlPath = window.location.pathname;
    
    // Verificando URL
    
    // Se o parâmetro forgot=true, ativar o estado de esqueci a senha
    if (forgot === 'true') {
      // Ativando tela de recuperação (silenciado)
      setForgotPasswordState(true);
      // Limpar a URL dos parâmetros
      const cleanUrl = `${window.location.origin}/auth`;
      window.history.replaceState({}, document.title, cleanUrl);
      return;
    }
    
    // Verificar se o código está na URL como parte do caminho (/:code)
    const pathMatch = urlPath.match(/\/reset-password\/(.+)$/) || urlPath.match(/\/auth\/reset-password\/(.+)$/);
    const pathCode = pathMatch ? pathMatch[1] : null;
    
    // Se tivermos um código em qualquer lugar (parâmetro ou caminho), processar a redefinição
    const resetCode = code || pathCode;
    
    // Código de redefinição
    
    // Se tiver o código de recuperação na URL, mostrar o formulário de redefinição
    if (resetCode) {
      // Ativar o estado de "esqueci a senha"
      setForgotPasswordState(true);
      
      // Capturar o email da URL, se estiver presente
      const recoveryEmail = url.searchParams.get('email');
      if (recoveryEmail) {
        // Email de recuperação encontrado (silenciado)
        setForgotPasswordEmail(recoveryEmail);
        setEmail(recoveryEmail);
      }
      
      // Armazenar o código para uso posterior
      localStorage.setItem('passwordResetCode', resetCode);
      
      // Código de redefinição (silenciado)
    }
    // Se for redefinição de senha pelo tipo recovery, mostrar o formulário apropriado
    else if (type === 'recovery') {
      // Tipo recovery detectado (silenciado)
      setForgotPasswordState(true);
      
      // Capturar o email da URL, se estiver presente
      const recoveryEmail = url.searchParams.get('email');
      if (recoveryEmail) {
        // Email de recuperação encontrado (silenciado)
        setForgotPasswordEmail(recoveryEmail);
        setEmail(recoveryEmail);
      }
    }
  }, []);

  // Verificar se o usuário chegou via callback de confirmação de email
  useEffect(() => {
    const url = new URL(window.location.href);
    const type = url.searchParams.get('type');
    const accessToken = url.searchParams.get('access_token');
    const refreshToken = url.searchParams.get('refresh_token');
    const urlPath = window.location.pathname;
    
    // Verificando callback
    
    // Se for um callback de confirmação de email (rota /auth/callback ou parâmetros específicos)
    if ((urlPath.includes('/auth/callback') || type === 'signup') && accessToken && refreshToken) {
      // Callback de confirmação (silenciado)
      
      // Processar o callback automaticamente
      (supabase as SupabaseClient<Database>).auth.getSession().then(({ data: sessionData, error: sessionError }) => {
        if (sessionError) {
          console.error("Erro ao obter sessão após callback:", sessionError);
          console.error('Erro ao confirmar email: Houve um problema ao processar a confirmação.');
          return;
        }
        
        if (sessionData?.session?.user) {
          // Sessão obtida (silenciado)
          
          // Mostrar mensagem de sucesso
          setEmailVerified(true);
          
          // Limpar a URL dos parâmetros
          const cleanUrl = `${window.location.origin}/auth`;
          window.history.replaceState({}, document.title, cleanUrl);
          
          // Email confirmado com sucesso
          // Email confirmado (silenciado)
          
          // Redirecionar para a aba de login após 3 segundos
          setTimeout(() => {
            setEmailVerified(false);
            // Se estivermos em uma aba diferente, mudar para login
            const loginTab = document.querySelector('[data-value="login"]') as HTMLElement;
            if (loginTab) {
              loginTab.click();
            }
          }, 3000);
        } else {
          // Nenhuma sessão (silenciado)
          // Mesmo sem sessão, mostrar sucesso pois o email foi confirmado
          setEmailVerified(true);
          
          // Limpar a URL dos parâmetros
          const cleanUrl = `${window.location.origin}/auth`;
          window.history.replaceState({}, document.title, cleanUrl);
          
          // Email confirmado (silenciado)
          
          setTimeout(() => {
            setEmailVerified(false);
            const loginTab = document.querySelector('[data-value="login"]') as HTMLElement;
            if (loginTab) {
              loginTab.click();
            }
          }, 3000);
        }
      });
    }
    // Verificar outros tipos de callback
    else if (type === 'recovery' && accessToken) {
      console.log("Callback de recuperação de senha detectado");
      // Lógica para recuperação de senha já existe no useEffect anterior
    }
  }, []);

  const { signInWithEmail, signUp, verifyEmail, isStrongPassword, resetPassword, loading: authLoading } = useAuth();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [birthdateError, setBirthdateError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [verifyEmailState, setVerifyEmailState] = useState(false);
  const [verifyEmailAddress, setVerifyEmailAddress] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [loggedInEmail, setLoggedInEmail] = useState("");
  const [error, setError] = useState<{field: string, message: string} | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<{isStrong: boolean, message: string} | null>(null);

  const [showPasswordMatch, setShowPasswordMatch] = useState(false);
  const [passwordsMatch, setPasswordsMatch] = useState<{isMatch: boolean, message: string} | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);
  const [forgotPasswordState, setForgotPasswordState] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const verifyEmailRef = useRef<HTMLInputElement>(null);
  const birthdateRef = useRef<HTMLInputElement>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  // Adicionar estado para tipo de investidor
  const [investorType, setInvestorType] = useState("");

  // Novos estados para trader favorito
  const [showTraderSupport, setShowTraderSupport] = useState<boolean>(false);
  const [preferredTraderLink, setPreferredTraderLink] = useState<string>("");
 
  const traderLinkRef = useRef<HTMLInputElement>(null);

  // Limpar erro quando o usuário digita em qualquer campo
  const clearError = useCallback(() => {
    if (error) setError(null);
    if (displayNameError) setDisplayNameError(null);
  }, [error, displayNameError]);

  // Validar nome de exibição
  const validateDisplayName = (name: string): boolean => {
    // Se o campo estiver vazio, não é válido para cadastro
    if (name.trim() === '') {
      setDisplayNameError('Nome de exibição é obrigatório');
      return false;
    }
    
    // Validação de mínimo de 2 caracteres
    if (name.trim().length < 2) {
      setDisplayNameError('Nome deve ter pelo menos 2 caracteres');
      return false;
    }
    
    if (name.trim().length > 30) {
      setDisplayNameError('Nome deve ter no máximo 30 caracteres');
      return false;
    }
    
    // Verificar se contém apenas letras, números, espaços e alguns caracteres especiais
    const nameRegex = /^[a-zA-ZÀ-ÿ0-9\s\-_.]*$/;
    if (!nameRegex.test(name.trim())) {
      setDisplayNameError('Nome contém caracteres inválidos');
      return false;
    }
    
    setDisplayNameError(null);
    return true;
  };

  // Função para lidar com o blur do campo de nome de exibição
  const handleDisplayNameBlur = () => {
    // Apenas limpar erro se houver um, mas não validar durante navegação entre campos
    if (displayNameError) {
      setDisplayNameError(null);
    }
  };

  // Validar campos de login
  const validateLoginFields = () => {
    clearError();
    
    if (!email) {
      setError({ field: 'email', message: 'Por favor, informe seu email.' });
      emailRef.current?.focus();
      return false;
    }

    if (!password) {
      setError({ field: 'password', message: 'Por favor, informe sua senha.' });
      passwordRef.current?.focus();
      return false;
    }
    
    return true;
  };

  // Função para validar se o usuário tem pelo menos 18 anos
  const validateAge = (date: string): boolean => {
    if (date.length !== 8) return false;
    
    const day = parseInt(date.substring(0, 2));
    const month = parseInt(date.substring(2, 4));
    const year = parseInt(date.substring(4, 8));
    
    // Verificar se o ano é futuro
    const currentYear = new Date().getFullYear();
    if (year > currentYear) {
      setBirthdateError("Ano de nascimento não pode ser no futuro.");
      return false;
    }
    
    // Verificar se o ano é muito antigo (limite realista para idade humana)
    const minRealisticYear = currentYear - 120; // Assumindo 120 anos como idade máxima realista
    if (year < minRealisticYear) {
      setBirthdateError(authT.yearValidation);
      return false;
    }
    
    // Verificar se o dia é válido (entre 1 e 31)
    if (day < 1 || day > 31) {
      setBirthdateError("Dia inválido. Deve estar entre 1 e 31.");
      return false;
    }
    
    // Verificar se o mês é válido (entre 1 e 12)
    if (month < 1 || month > 12) {
      setBirthdateError("Mês inválido. Deve estar entre 1 e 12.");
      return false;
    }
    
    // Verificar se a data é válida (considerando meses com menos de 31 dias)
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) {
      setBirthdateError(`Data inválida. O mês ${month} tem apenas ${daysInMonth} dias.`);
      return false;
    }
    
    // Criar data de nascimento
    const birthDate = new Date(year, month - 1, day);
    
    // Verificar se a data é válida (não permitir datas inválidas)
    if (isNaN(birthDate.getTime())) {
      setBirthdateError("Data de nascimento inválida. Por favor, verifique o formato (DD/MM/AAAA).");
      return false;
    }
    
    // Calcular idade
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // Ajustar idade se ainda não fez aniversário este ano
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    if (age < 18) {
      setBirthdateError(authT.ageRestriction);
      return false;
    }
    
    return age >= 18;
  };
  
  // Formatar o input de data de nascimento
  const formatBirthdate = (value: string): string => {
    // Remover qualquer caractere não numérico
    const numbers = value.replace(/\D/g, '');
    
    // Limitar a 8 dígitos (DDMMAAAA)
    const birthdate = numbers.substring(0, 8);
    
    // Formatar conforme o usuário digita
    if (birthdate.length > 0) {
      // Se tiver pelo menos 2 dígitos, separar o dia
      if (birthdate.length >= 2) {
        // Se tiver pelo menos 4 dígitos, separar o mês
        if (birthdate.length >= 4) {
          return `${birthdate.substring(0, 2)}/${birthdate.substring(2, 4)}/${birthdate.substring(4, 8)}`;
        }
        return `${birthdate.substring(0, 2)}/${birthdate.substring(2, 4)}`;
      }
      return birthdate;
    }
    
    return '';
  };
  
  // Função para lidar com a mudança no campo de data de nascimento
  const handleBirthdateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, selectionStart } = e.target;
    const cursorPosition = selectionStart || 0;
    
    // Resetar erro
    setBirthdateError(null);
    
    // Verificar se estamos apagando algo
    if (value.length < birthdate.length) {
      // Verificar se estamos apagando um dígito imediatamente antes de uma barra
      // Isso ocorre em duas posições: dígito antes da primeira barra (posição 2) e dígito antes da segunda barra (posição 5)
      if ((cursorPosition === 2 && birthdate[2] === '/') || (cursorPosition === 5 && birthdate[5] === '/')) {
        // Estamos apagando o último dígito antes de uma barra - devemos remover ambos (o dígito e a barra)
        
        // Obter apenas os dígitos
        const digitsOnly = birthdate.replace(/\D/g, '');
        
        // Determinar qual dígito estamos apagando (0-indexado nos dígitos)
        let digitIndex = cursorPosition;
        // Ajustar índice para corresponder à posição nos dígitos (sem barras)
        if (cursorPosition > 2) digitIndex--;
        if (cursorPosition > 5) digitIndex--;
        
        // Remover o dígito que o usuário está apagando
        const newDigits = digitsOnly.substring(0, digitIndex-1) + digitsOnly.substring(digitIndex);
        const formattedValue = formatBirthdate(newDigits);
        setBirthdate(formattedValue);
        
        // Ajustar a posição do cursor para antes da posição onde estava a barra
        setTimeout(() => {
          const input = e.target as HTMLInputElement;
          input.setSelectionRange(cursorPosition-1, cursorPosition-1);
        }, 0);
        
        return;
      }
      
      // Verificar se apagamos um número que causaria a remoção de uma barra
      // Por exemplo, se temos "12/3" e apagamos o "3", devemos remover a barra também
      const oldFormatted = birthdate;
      const newDigits = value.replace(/\D/g, '');
      const newFormatted = formatBirthdate(newDigits);
      
      // Se a formatação nova tem menos barras que a antiga, significa que devemos ajustar o cursor
      const oldSlashCount = (oldFormatted.match(/\//g) || []).length;
      const newSlashCount = (newFormatted.match(/\//g) || []).length;
      
      if (oldSlashCount > newSlashCount) {
        // Perdemos uma barra na formatação
        setBirthdate(newFormatted);
        
        // Ajustar a posição do cursor
        setTimeout(() => {
          const input = e.target as HTMLInputElement;
          // Manter o cursor na mesma posição após remover a barra automaticamente
          input.setSelectionRange(cursorPosition, cursorPosition);
        }, 0);
        
        return;
      }
    }
    
    // Comportamento normal para outros casos
    const digitsOnly = value.replace(/\D/g, '');
    const formattedValue = formatBirthdate(digitsOnly);
    setBirthdate(formattedValue);
    
    // Ajustar o cursor para a posição correta
    setTimeout(() => {
      const input = e.target as HTMLInputElement;
      let newCursorPos = cursorPosition;
      
      // Se adicionamos uma barra automaticamente, avançar o cursor
      if (formattedValue.length > value.length) {
        newCursorPos += formattedValue.length - value.length;
      }
      
      // Garantir que a posição do cursor é válida
      newCursorPos = Math.min(newCursorPos, formattedValue.length);
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
    
    // Validar idade se tiver 8 dígitos
    if (digitsOnly.length === 8) {
      validateAge(digitsOnly);
    }
  };

  // Validar campos e focalizar o primeiro campo vazio
  const validateFields = (isLogin: boolean) => {
    if (isLogin) {
      // Validação para login
      if (!email) {
        setError({ field: 'email', message: authT.emailRequired });
        return false;
      }
      
      if (!password) {
        setError({ field: 'password', message: authT.passwordRequired });
        return false;
      }
      
      return true;
    } else {
      // Validação para cadastro
      if (!email) {
        setError({ field: 'email', message: authT.emailRequired });
        return false;
      }
      
      if (!displayName.trim()) {
        setError({ field: 'displayName', message: authT.displayNameRequired });
        return false;
      }
      
      if (!validateDisplayName(displayName)) {
        setError({ field: 'displayName', message: displayNameError || authT.displayNameTooShort });
        return false;
      }
      
      if (!birthdate || birthdate.length < 10) {
        setError({ field: 'birthdate', message: authT.birthdateIncomplete });
        return false;
      }
      
      // Validar se a data de nascimento é válida
      const rawBirthdate = birthdate.replace(/\D/g, '');
      if (rawBirthdate.length === 8) {
        const isValidAge = validateAge(rawBirthdate);
        if (!isValidAge) {
          if (birthdateError) {
            setError({ field: 'birthdate', message: birthdateError });
          } else {
            setError({ field: 'birthdate', message: authT.birthdateInvalid });
          }
          return false;
        }
      } else {
        setError({ field: 'birthdate', message: authT.birthdateIncomplete });
        return false;
      }
      
      if (!password) {
        setError({ field: 'password', message: authT.passwordRequired });
        return false;
      }
      
      if (password !== confirmPassword) {
        setError({ field: 'confirmPassword', message: authT.passwordsNotMatch });
        return false;
      }
      
      if (!termsAccepted) {
        setShowTermsError(true);
        return false;
      }
      
      return true;
    }
  };
  
  // Validar força da senha durante a digitação
  const validatePasswordStrength = (password: string) => {
    if (password.length > 0) {
      const strength = isStrongPassword(password);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength(null);
    }
  };

  // Validar se as senhas correspondem
  const validatePasswordMatch = () => {
    if (password && confirmPassword) {
      if (password === confirmPassword) {
        setPasswordsMatch({ isMatch: true, message: authT.passwordsMatch });
      } else {
        setPasswordsMatch({ isMatch: false, message: authT.passwordsNoMatch });
      }
    } else {
      setPasswordsMatch(null);
    }
  };

  // Função de login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // handleLogin iniciado (silenciado)

    // Validar campos
    if (!validateLoginFields()) {
      console.warn('⚠️ [AUTH] Validação de campos falhou');
      return;
    }

    // Campos validados (silenciado)
    setLoadingAction('login');
    
    try {
      // Chamando signInWithEmail (silenciado)
      const { error } = await signInWithEmail(email, password, true);
      
      if (error) {
        
        // Verificar se é uma chave de tradução
        if ('isTranslationKey' in error && (error as Record<string, unknown>).isTranslationKey) {
          setError({
            field: 'email',
            message: authT[error.message as keyof typeof authT] || error.message
          });
        } else {
        setError({
          field: 'email',
          message: error.message || 'Erro ao fazer login. Tente novamente.'
        });
        }
      }
    } catch (error) {
      console.error('Erro não tratado no login:', error);
      setError({
        field: 'email',
        message: 'Ocorreu um erro inesperado. Tente novamente mais tarde.'
      });
    }
    
    setLoadingAction(null);
  };
  
  // Função para lidar com o cadastro
  const handleSignUp = async () => {
    setError(null);
    
    // 1. Verificar se todos os campos necessários foram preenchidos
    if (!email) {
      setError({ field: 'email', message: authT.emailRequired });
      emailRef.current?.focus();
      return;
    }

    // 2. Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError({ field: 'email', message: authT.emailInvalid });
      emailRef.current?.focus();
      return;
    }

    if (!displayName.trim()) {
      setError({ field: 'displayName', message: authT.displayNameRequired });
      displayNameRef.current?.focus();
      return;
    }

    if (!validateDisplayName(displayName)) {
      setError({ field: 'displayName', message: displayNameError || authT.displayNameTooShort });
      displayNameRef.current?.focus();
      return;
    }

    if (!investorType) {
      setError({ field: 'investorType', message: authT.investorTypeRequired });
      return;
    }

    if (!birthdate) {
      setError({ field: 'birthdate', message: authT.birthdateRequired });
      birthdateRef.current?.focus();
      return;
    }

    // 3. Validar data de nascimento e idade
    const birthdateNumbers = birthdate.replace(/\D/g, '');
    if (birthdateNumbers.length !== 8) {
      setError({ field: 'birthdate', message: authT.birthdateIncomplete });
      birthdateRef.current?.focus();
      return;
    }

    if (!validateAge(birthdateNumbers)) {
      setError({ field: 'birthdate', message: birthdateError || authT.birthdateInvalid });
      birthdateRef.current?.focus();
      return;
    }
    
    if (!password) {
      setError({ field: 'password', message: authT.passwordRequired });
      passwordRef.current?.focus();
      return;
    }

    // 4. Validar força da senha
    const passwordValidation = isStrongPassword(password);
    if (!passwordValidation.isStrong) {
      setError({ field: 'password', message: passwordValidation.message });
      passwordRef.current?.focus();
      return;
    }
    
    if (password !== confirmPassword) {
      setError({ field: 'confirmPassword', message: authT.passwordsNotMatch });
      confirmPasswordRef.current?.focus();
      return;
    }
    
    if (!termsAccepted) {
      setError({ field: 'terms', message: authT.termsRequired });
      return;
    }
    
    // Validar URL do trader favorito, se preenchido
    if (preferredTraderLink && !validateUrl(preferredTraderLink)) {
      setError({ field: 'preferredTraderLink', message: 'Por favor, informe um link válido' });
      traderLinkRef.current?.focus();
      return;
    }
    
    // Iniciar indicador de carregamento
    setLoadingAction('signup');
    
    // Processando cadastro
    console.log('Iniciando processo de cadastro...');
    
    try {
      // Realizar o cadastro através do contexto de autenticação
      console.log('Iniciando processo de cadastro para:', email);
      
      const signUpResult = await signUp(
        email, 
        password, 
        birthdate, 
        displayName.trim(), 
        investorType
      );
      
      // Verificação de segurança para garantir que signUpResult existe
      if (!signUpResult) {
        console.error('ERRO CRÍTICO: signUp retornou undefined');
        setError({ field: 'email', message: 'Erro interno do sistema. Tente novamente.' });
        emailRef.current?.focus();
        animateErrorField();
        return;
      }
      
      const { error: authError } = signUpResult;
      
      if (authError) {
        console.error('Erro no cadastro:', authError);
        
        // Verificar se é uma chave de tradução
        if ('isTranslationKey' in authError && (authError as Record<string, unknown>).isTranslationKey) {
          setError({
            field: 'email',
            message: authT[authError.message as keyof typeof authT] || authError.message
          });
        } else {
          setError({
            field: 'email',
            message: authError.message || 'Ocorreu um erro durante o cadastro. Tente novamente.'
          });
        }
        
          emailRef.current?.focus();
          animateErrorField();
          return;
      }
      
      console.log('Cadastro processado com sucesso');
      
      // Cadastro bem-sucedido
      console.log('Cadastro realizado! Verifique seu email para ativar sua conta.');
      
      // Armazena o email registrado para exibir na mensagem de sucesso
      // Recuperar email da sessão (caso tenha sido salvo no userService)
      const savedEmail = sessionStorage.getItem('registered-email') || email;
      setRegisteredEmail(savedEmail);
      
      // Ativa o estado de sucesso
      setSignupSuccess(true);
      
      // Mostrar a opção de verificar email
      setVerifyEmailAddress(savedEmail);
      
      // Limpar as flags automaticamente após 5 minutos para evitar problemas futuros
      setTimeout(() => {
        sessionStorage.removeItem('just-registered');
        sessionStorage.removeItem('registered-email');
              }, 5 * 60 * 1000);
      
      // Limpa os campos
      setEmail("");
      setDisplayName("");
      setBirthdate("");
      setPassword("");
      setConfirmPassword("");
      setPasswordStrength(null);
      setTermsAccepted(false);
      
    } catch (error: unknown) {
      console.error('Erro ao criar conta (try/catch):', error);
      
      const err = error as { name?: string; message?: string };
      // Evitar exibir múltiplos erros se for de email já cadastrado
      if (!err.message?.includes('já está cadastrado') && 
          err.name !== 'UserExists' &&
          !err.message?.includes('already registered') &&
          !err.message?.includes('already exists') &&
          !err.message?.includes('email taken') &&
          !err.message?.includes('duplicate key') &&
          !err.message?.includes('unique constraint') &&
          !err.message?.includes('uniqueness violation')) {
        // Apenas exibir erro genérico para erros diferentes do email já cadastrado
        console.error('Falha no cadastro: Ocorreu um erro durante o cadastro. Tente novamente.');
        animateErrorField();
      }
    } finally {
      setLoadingAction(null);
    }
  };
  
  // Função para abrir o Gmail em uma nova aba
  const openGmail = () => {
    window.open('https://mail.google.com', '_blank');
  };

  // Função para verificar email
  const handleVerifyEmail = async () => {
    if (!verifyEmailAddress) {
      setError({ field: 'verifyEmail', message: 'Por favor, informe seu email' });
      verifyEmailRef.current?.focus();
      return;
    }
    
    try {
      setLoadingAction('verify');
      const { error: authError } = await verifyEmail(verifyEmailAddress);
      
      if (authError) {
        setError({ field: 'verifyEmail', message: authError.message });
        throw authError;
      }
      
      // Sucesso na verificação
      console.log("Email verificado com sucesso! Agora você pode fazer login na sua conta.");
      
      // Abrir o Gmail em uma nova aba
      openGmail();
      
      // Voltar para a tela de login
      setVerifyEmailState(false);
      setVerifyEmailAddress("");
      
      // Se estamos na tela de sucesso do cadastro, redirecionar para login
      if (signupSuccess) {
        setTimeout(() => {
          setSignupSuccess(false);
        }, 2000);
      }
      
    } catch (error: unknown) {
      console.error('Erro ao verificar email:', error);
      animateErrorField();
    } finally {
      setLoadingAction(null);
    }
  };

  // Animar o campo com erro
  const animateErrorField = () => {
    // A animação é controlada pelo CSS e framer-motion
  };

  // Componente para exibir os termos e condições
  const TermsAndConditionsModal = ({ showTerms, setShowTerms }: { showTerms: boolean, setShowTerms: (show: boolean) => void }) => (
    <Dialog 
      open={showTerms} 
      onOpenChange={(open) => {
        // Permitir que o modal feche ao clicar no X, sem marcar como aceito
        setShowTerms(open);
      }}
      // Adicionando classe personalizada para o overlay do Dialog
      // Removendo a propriedade className que não é suportada pelo Dialog
    >
      <style dangerouslySetInnerHTML={{
        __html: `
        .terms-dialog .fixed.inset-0.z-50.bg-background/80.backdrop-blur-sm.data-[state=open]:animate-in.data-[state=closed]:animate-out.data-[state=closed]:fade-out-0.data-[state=open]:fade-in-0 {
          background-color: rgba(0, 0, 0, 0.25);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }
      `}} />
      <DialogContent 
        className="bg-black/70 border border-neutral-800 text-neutral-200 p-6 rounded-xl max-w-5xl max-h-[85vh] overflow-y-auto terms-modal-content shadow-2xl"
        style={{
          scrollbarGutter: 'stable',
          scrollBehavior: 'smooth',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          paddingRight: '20px',
          backgroundColor: 'rgba(0, 0, 0, 0.65)'
        }}
      >
        <DialogHeader className="border-b border-neutral-800 pb-4 mb-6">
          <DialogTitle className="text-xl font-light tracking-wider text-white uppercase">
            {termsAndConditions?.title || 'Termos e Condições'}
          </DialogTitle>
          <DialogDescription className="text-neutral-400 text-sm mt-2">
            {termsAndConditions?.language === 'pt' ? 'Leia atentamente os termos antes de prosseguir' :
             termsAndConditions?.language === 'en' ? 'Please read the terms carefully before proceeding' :
             termsAndConditions?.language === 'es' ? 'Lea atentamente los términos antes de continuar' :
             'Leia atentamente os termos antes de prosseguir'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm text-neutral-300 pt-4">
          {termsAndConditions ? (
            <>
              <div className="bg-black/60 border border-neutral-800 p-4 rounded-lg">
                <p className="text-neutral-100 font-medium text-center">
                  {termsAndConditions.content.legalWarning}
                </p>
              </div>
              
              <p className="text-neutral-200">
                {termsAndConditions.content.introduction}
              </p>
              
              <p className="text-neutral-400 text-xs border-b border-neutral-800 pb-2 mb-2">
                {termsAndConditions.language === 'pt' ? 'Última atualização:' :
                 termsAndConditions.language === 'en' ? 'Last updated:' :
                 termsAndConditions.language === 'es' ? 'Última actualización:' :
                 'Última atualização:'} {termsAndConditions.lastUpdated}
              </p>
              
              {/* Renderizar seções dinamicamente */}
              {termsAndConditions.content.sections.map((section, index) => (
                <div key={index}>
                  <h3 className="text-white/90 font-medium mt-6 mb-4">{section.title}</h3>
                  <div dangerouslySetInnerHTML={{ __html: section.content }} />
                </div>
              ))}
              
              {/* Seção de aceitação */}
              <div className="mt-8">
                <h3 className="text-white/90 font-medium mb-4">{termsAndConditions.content.acceptance.title}</h3>
                <ol className="list-decimal list-inside space-y-2 text-neutral-300">
                  {termsAndConditions.content.acceptance.items.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ol>
                <p className="text-neutral-400 mt-4 text-center italic">
                  {termsAndConditions.content.acceptance.footer}
                </p>
              </div>
            </>
          ) : (
            <div className="bg-black/60 border border-neutral-800 p-4 rounded-lg">
              <p className="text-neutral-100 font-medium text-center">
                {language === 'pt' ? 'Carregando termos...' :
                 language === 'en' ? 'Loading terms...' :
                 language === 'es' ? 'Cargando términos...' :
                 'Carregando termos...'}
              </p>
            </div>
          )}
          
          <style dangerouslySetInnerHTML={{ __html: `
            .terms-modal-content {
              background-color: rgba(0, 0, 0, 0.65);
              backdrop-filter: blur(16px);
              -webkit-backdrop-filter: blur(16px);
            }
            
            .terms-modal-content h3 {
              position: relative;
              padding-left: 12px;
              margin-top: 2rem;
              margin-bottom: 1rem;
              font-size: 0.95rem;
              color: #ffffff;
              letter-spacing: 0.03em;
              text-transform: uppercase;
              font-weight: 400;
              text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
            }
            
            .terms-modal-content h3::before {
              content: '';
              position: absolute;
              left: 0;
              top: 50%;
              transform: translateY(-50%);
              height: 70%;
              width: 2px;
              background: #4b5563;
            }
            
            .terms-modal-content p {
              line-height: 1.7;
              color: #d1d5db;
              font-size: 0.875rem;
              margin-bottom: 1rem;
              text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
            }
            
            .terms-modal-content p strong {
              color: #ffffff;
              font-weight: 500;
              letter-spacing: 0.02em;
              text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
            }
            
            .terms-modal-content ol {
              margin: 1.5rem 0;
            }
            
            .terms-modal-content ol li {
              margin-bottom: 0.75rem;
              line-height: 1.6;
              color: #d1d5db;
              text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
            }
            
            .terms-modal-content .bg-black/60 {
              background-color: rgba(0, 0, 0, 0.7);
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .terms-modal-content::-webkit-scrollbar {
              width: 8px;
              height: 8px;
            }
            
            .terms-modal-content::-webkit-scrollbar-track {
              background: rgba(10, 10, 10, 0.5);
              border-radius: 8px;
              margin: 8px 0;
            }
            
            .terms-modal-content::-webkit-scrollbar-thumb {
              background: rgba(75, 85, 99, 0.6);
              border-radius: 8px;
              border: 2px solid rgba(0, 0, 0, 0.2);
              min-height: 50px;
            }
            
            .terms-modal-content::-webkit-scrollbar-thumb:hover {
              background: rgba(107, 114, 128, 0.7);
              cursor: pointer;
            }
          `}} />
          

          

          

          

        </div>
        <DialogFooter className="mt-8 flex flex-col sm:flex-row gap-3 pt-4 border-t border-neutral-800">
          <Button 
            variant="destructive" 
            onClick={() => setShowTerms(false)}
            className="bg-neutral-900 hover:bg-neutral-800 text-neutral-200 transition-all duration-300 px-6 py-2 h-10 text-sm tracking-wide"
          >
            {termsAndConditions?.language === 'pt' ? 'Recusar' :
             termsAndConditions?.language === 'en' ? 'Decline' :
             termsAndConditions?.language === 'es' ? 'Rechazar' :
             'Recusar'}
          </Button>
          <Button 
            onClick={() => {
              setTermsAccepted(true);
              setShowTerms(false);
              setError(null);
              clearError();
            }}
            className="bg-white hover:bg-neutral-200 text-black transition-all duration-300 px-6 py-2 h-10 text-sm tracking-wide font-medium"
          >
            {termsAndConditions?.language === 'pt' ? 'Li e aceito' :
             termsAndConditions?.language === 'en' ? 'I have read and accept' :
             termsAndConditions?.language === 'es' ? 'He leído y acepto' :
             'Li e aceito'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Componente para a tela de verificação de email
  const VerifyEmailContent = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="text-center space-y-2">
        <Mail className="w-12 h-12 text-white/40 mx-auto mb-2" />
        <h2 className="text-xl font-light text-white/90">Verifique seu Email</h2>
        <p className="text-sm text-white/50">
          Enviamos um link de verificação para seu email. Por favor, confira sua caixa de entrada.
        </p>
      </div>

      <div className="space-y-3">
        <Button 
          className="w-full bg-black/30 hover:bg-black/50 text-white/80 hover:text-white/90 border-[0.5px] border-white/[0.05] h-11 rounded-xl transition-all duration-300 group"
          onClick={openGmail}
        >
          <CheckCheck className="h-4 w-4 mr-2 opacity-70 group-hover:opacity-90 transition-opacity" />
          <span className="text-sm tracking-wide">Conferir Email</span>
        </Button>

        <Button 
          variant="ghost" 
          className="w-full text-white/40 hover:text-white/60 hover:bg-white/5"
          onClick={() => setVerifyEmailState(false)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span className="text-xs">Voltar</span>
        </Button>
      </div>
    </motion.div>
  );

  // Conteúdo de sucesso do cadastro
  const SignupSuccessContent = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-8 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ 
          type: "spring", 
          stiffness: 260, 
          damping: 20,
          delay: 0.2 
        }}
        className="mb-6 relative"
      >
        <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-md"></div>
        <div className="relative">
          <CheckCircle2 className="h-20 w-20 text-emerald-400/80" strokeWidth={1.5} />
        </div>
      </motion.div>
      
      <motion.h2 
        className="text-xl font-light text-white/90 mb-3"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        Cadastro Concluído!
      </motion.h2>
      
      <motion.p 
        className="text-white/50 text-sm mb-6 max-w-md"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Enviamos um email para <span className="text-white/80 font-medium">{registeredEmail}</span> com um link de verificação. Por favor, verifique seu email para ativar sua conta.
      </motion.p>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex flex-col space-y-3 w-full"
      >
        <Button 
          className="bg-black/30 hover:bg-black/50 text-white/80 hover:text-white/90 border-[0.5px] border-white/[0.05] h-11 rounded-xl transition-all duration-300 group"
          onClick={() => {
            openGmail();
            // Limpar as flags após um pequeno delay para permitir que o usuário veja a tela por alguns segundos
            setTimeout(() => {
              // Limpar TODAS as flags de proteção
              sessionStorage.removeItem('just-registered');
              sessionStorage.removeItem('registered-email');
              sessionStorage.removeItem('prevent_auth_redirect');
              localStorage.removeItem('prevent_dashboard_redirect');
                          }, 3000);
          }}
        >
          <CheckCheck className="h-4 w-4 mr-2 opacity-70 group-hover:opacity-90 transition-opacity" />
          <span className="text-sm tracking-wide">Conferir Email</span>
        </Button>
        
        <Button 
          variant="ghost" 
          className="text-white/40 hover:text-white/60 hover:bg-white/5"
          onClick={() => {
            // Limpar TODAS as flags de proteção para permitir redirecionamento normal
            sessionStorage.removeItem('just-registered');
            sessionStorage.removeItem('registered-email');
            sessionStorage.removeItem('prevent_auth_redirect');
            localStorage.removeItem('prevent_dashboard_redirect');
                        
            // Configurar o componente para mostrar formulário de login
            setSignupSuccess(false);
            setEmail("");
            setPassword("");
            setConfirmPassword("");
            
            // Forçar a seleção da aba de login diretamente no estado
                        setActiveTab("login");
          }}
        >
          <span className="text-xs">Voltar para Login</span>
        </Button>
      </motion.div>
    </motion.div>
  );

  // Conteúdo de sucesso do login
  const LoginSuccessContent = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-8 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ 
          type: "spring", 
          stiffness: 260, 
          damping: 20,
          delay: 0.2 
        }}
        className="mb-6 relative"
      >
        <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-md"></div>
        <div className="relative">
          <CheckCircle2 className="h-20 w-20 text-emerald-400/80" strokeWidth={1.5} />
        </div>
      </motion.div>
      
      <motion.h2 
        className="text-xl font-light text-white/90 mb-3"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        Login Bem-sucedido!
      </motion.h2>
      
      <motion.p 
        className="text-white/50 text-sm mb-6"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Bem-vindo de volta, <span className="text-white/80 font-medium">{loggedInEmail}</span>. Você será redirecionado em instantes...
      </motion.p>
      
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="w-full"
      >
        <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
        <motion.div 
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
            transition={{ duration: 3, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </motion.div>
  );

  // Conteúdo de email verificado com sucesso
  const EmailVerifiedContent = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-8 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
          transition={{ 
          type: "spring", 
          stiffness: 260, 
          damping: 20,
          delay: 0.2 
        }}
        className="mb-6 relative"
      >
        <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-md"></div>
        <div className="relative">
          <CheckCircle2 className="h-20 w-20 text-emerald-400/80" strokeWidth={1.5} />
        </div>
      </motion.div>
      
      <motion.h2 
        className="text-xl font-light text-white/90 mb-3"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        Email Confirmado!
      </motion.h2>
      
      <motion.p 
        className="text-white/50 text-sm mb-6 max-w-md"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Sua conta foi ativada com sucesso. Agora você pode fazer login com suas credenciais.
      </motion.p>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="w-full"
      >
        <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, ease: "easeInOut" }}
        />
        </div>
        <p className="text-white/40 text-xs mt-2">Redirecionando para login...</p>
      </motion.div>
    </motion.div>
  );

  // Componente de mensagem de erro
  // Componente de indicador de força de senha memorizado para evitar re-renders
  const PasswordStrengthIndicator = useMemo(() => {
    // Só renderizar se há uma senha para validar
    if (!password) return null;
    
    // Identificar requisitos baseados na senha atual
    const requirements = [
      { id: 'length', label: authT.passwordMinLength, met: password.length >= 8 },
      { id: 'lowercase', label: authT.passwordLowercase, met: /[a-z]/.test(password) },
      { id: 'uppercase', label: authT.passwordUppercase, met: /[A-Z]/.test(password) },
      { id: 'number', label: authT.passwordNumber, met: /[0-9]/.test(password) },
      { id: 'special', label: authT.passwordSpecial, met: /[^A-Za-z0-9]/.test(password) },
    ];

    // Requisitos atendidos
    const metRequirements = requirements.filter(req => req.met);

    return (
      <motion.div 
        key="password-strength" // Key fixa para evitar recriação desnecessária
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-black/20 border-[0.5px] border-white/[0.03] p-3 rounded-lg mt-2 space-y-2"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center text-white/50 text-xs">
            <AlertCircle className="h-3 w-3 mr-1.5 opacity-70" />
            {authT.passwordRequirements}
          </div>
          <div className="text-[10px] text-white/30">
            {metRequirements.length}/{requirements.length} {authT.passwordRequirementsMet}
          </div>
        </div>
        
        <div className="space-y-1.5">
          {requirements.map((req) => (
            <div key={req.id} className="flex items-center text-[10px]">
              {req.met ? (
                <div className="h-3 w-3 rounded-full flex items-center justify-center mr-2 bg-emerald-500/10 text-emerald-400/70">
                  <CheckCircle2 className="h-2 w-2" />
                </div>
              ) : (
                <div className="h-3 w-3 rounded-full flex items-center justify-center mr-2 bg-white/5 text-white/30">
                  <div className="h-1 w-1 bg-white/30 rounded-full"></div>
                </div>
              )}
              <span className={req.met ? "text-white/50" : "text-white/30"}>
                {req.label}
              </span>
            </div>
          ))}
        </div>
        
        {/* Barra de progresso */}
        <div className="w-full h-1 bg-black/30 rounded-full overflow-hidden mt-1">
          <motion.div 
            className="h-full bg-gradient-to-r from-white/20 to-emerald-400/50"
            initial={{ width: 0 }}
            animate={{ 
              width: `${(metRequirements.length / requirements.length) * 100}%` 
            }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </motion.div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]); // Memorizar baseado apenas na senha, authT é estável via useLanguage

  // Componente de indicador de correspondência de senhas
  const PasswordMatchIndicator = ({ match }: { match: { isMatch: boolean; message: string } }) => (
    <motion.div 
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-black/20 border-[0.5px] border-white/[0.03] p-3 rounded-lg mt-2"
    >
      <div className="flex items-center text-xs">
        {match.isMatch ? (
          <>
            <div className="h-3.5 w-3.5 rounded-full flex items-center justify-center mr-2 bg-emerald-500/10">
              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400/70" />
            </div>
            <span className="text-white/50">
              {match.message}
            </span>
          </>
        ) : (
          <>
            <div className="h-3.5 w-3.5 rounded-full flex items-center justify-center mr-2 bg-rose-500/10">
              <AlertCircle className="h-2.5 w-2.5 text-rose-400/70" />
            </div>
            <span className="text-rose-400/70">
              {match.message}
            </span>
          </>
        )}
      </div>
    </motion.div>
  );

  // Função para atualizar a senha quando o usuário acessa o link de redefinição
  const handleUpdatePassword = async () => {
    clearError();
    
    // Validar campos
    if (!password) {
      setError({ field: 'password', message: authT.newPasswordRequired });
      return;
    }
    
    if (password !== confirmPassword) {
      setError({ field: 'confirmPassword', message: 'As senhas não coincidem' });
      return;
    }
    
    // Verificar força da senha
    const strength = isStrongPassword(password);
    if (!strength.isStrong) {
      setError({ field: 'password', message: strength.message });
      return;
    }
    
    try {
      setLoadingAction('update-password');
      
      // Obter o código de redefinição de senha do localStorage
      const resetCode = localStorage.getItem('passwordResetCode');
      
      if (!resetCode) {
        setError({ field: 'password', message: 'Código de redefinição de senha inválido. Tente novamente.' });
        return;
      }
      
      // Atualizar a senha usando o Supabase
      const { error } = await (supabase as SupabaseClient<Database>).auth.updateUser({
        password: password
      });
      
      if (error) {
        setError({ field: 'password', message: error.message });
        return;
      }
      
      // Sucesso - remover o código de redefinição e mostrar mensagem
      localStorage.removeItem('passwordResetCode');
      
      // Senha atualizada com sucesso
      console.log('Senha atualizada com sucesso! Você já pode fazer login.');
      
      // Redirecionar para login após um pequeno delay
      setTimeout(() => {
        setForgotPasswordState(false);
        setPassword('');
        setConfirmPassword('');
      }, 2000);
      
    } catch (error: unknown) {
      console.error('Erro ao atualizar senha:', error);
      setError({ field: 'password', message: authT.passwordUpdateError });
    } finally {
      setLoadingAction(null);
    }
  };

  // Função para lidar com a recuperação de senha
  const handleResetPassword = async () => {
    clearError();
    
    if (!email) {
      setError({ field: 'email', message: authT.emailRequired });
      emailRef.current?.focus();
      return;
    }

    try {
      setLoadingAction('reset');
      const { error: resetError } = await resetPassword(email);
      
      if (resetError) {
        setError({ field: 'email', message: resetError.message });
        return;
      }
      
      setPasswordResetSent(true);
      console.log('Email de recuperação enviado com sucesso!');
    } catch (error: unknown) {
      console.error('Erro ao enviar email de recuperação:', error);
      setError({ field: 'email', message: authT.resetEmailError });
    } finally {
      setLoadingAction(null);
    }
  };

  // Handlers estáveis para o email input
  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    clearError();
  }, [clearError]);

  // Componente para a tela de recuperação de senha
  const ForgotPasswordContent = useMemo(() => {
    // Verificar se temos um código de redefinição de senha armazenado
    const resetCode = localStorage.getItem('passwordResetCode');
    
    return (
    <motion.div 
      className="space-y-5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5 }}
    >
      {passwordResetSent ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
          <h2 className="text-xl text-white/90">{authT.emailSentTitle}</h2>
          <p className="text-white/60 text-sm">
            {authT.emailSentMessage}
          </p>
          <Button 
            onClick={() => {
              setForgotPasswordState(false);
              setPasswordResetSent(false);
            }}
            className="mt-4 bg-black/30 hover:bg-black/50 text-white/80 hover:text-white/90 border-[0.5px] border-white/[0.05] h-11 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4 mr-2 opacity-70 group-hover:opacity-90 transition-opacity" />
            <span className="text-sm tracking-wide">{authT.backToLoginButton}</span>
          </Button>
        </motion.div>
      ) : resetCode ? (
        // Formulário para definir nova senha quando acessado pelo link
        <>
          <div>
            <h2 className="text-xl text-white/90 mb-2">{authT.resetPasswordTitle}</h2>
            <p className="text-white/60 text-sm">
              {authT.newPasswordDesc}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-xs uppercase text-white/40 tracking-wider font-light flex items-center">
              <KeyRound className="h-3 w-3 mr-1.5 opacity-40" />
              {authT.newPassword}
            </Label>
            <div className="relative group">
              <Input 
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  validatePasswordStrength(e.target.value);
                  validatePasswordMatch();
                  clearError();
                }}
                placeholder="••••••••"
                className={`bg-black/20 border-[0.5px] border-white/[0.03] h-11 px-4 text-white/70 focus:outline-none focus:border-white/10 hover:bg-black/30 transition-all duration-300 rounded-xl placeholder:text-white/20 ${error?.field === 'password' ? 'border-rose-500/50 animate-shake' : ''}`}
                disabled={loadingAction !== null}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </button>
            </div>
            <AnimatePresence mode="wait">
              {error?.field === 'password' && (
                passwordStrength && !passwordStrength.isStrong ? (
                  PasswordStrengthIndicator
                ) : (
                  <ErrorMessage message={error.message} />
                )
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-new-password" className="text-xs uppercase text-white/40 tracking-wider font-light flex items-center">
              <KeyRound className="h-3 w-3 mr-1.5 opacity-40" />
              {authT.confirmNewPassword}
            </Label>
            <div className="relative group">
              <Input 
                id="confirm-new-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  validatePasswordMatch();
                  clearError();
                }}
                placeholder="••••••••"
                className={`bg-black/20 border-[0.5px] border-white/[0.03] h-11 px-4 text-white/70 focus:outline-none focus:border-white/10 hover:bg-black/30 transition-all duration-300 rounded-xl placeholder:text-white/20 ${error?.field === 'confirmPassword' ? 'border-rose-500/50 animate-shake' : ''}`}
                disabled={loadingAction !== null}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </button>
            </div>
            <AnimatePresence mode="wait">
              {error?.field === 'confirmPassword' ? (
                <ErrorMessage message={error.message} />
              ) : (
                showPasswordMatch && password && confirmPassword && passwordsMatch && (
                  <PasswordMatchIndicator match={passwordsMatch} />
                )
              )}
            </AnimatePresence>
          </div>

          <div className="flex space-x-3">
            <Button 
              onClick={() => {
                localStorage.removeItem('passwordResetCode');
                setForgotPasswordState(false);
              }}
              className="flex-1 bg-black/30 hover:bg-black/50 text-white/80 hover:text-white/90 border-[0.5px] border-white/[0.05] h-11 rounded-xl transition-all duration-300"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {authT.cancelButton}
            </Button>
            <Button 
              onClick={handleUpdatePassword}
              className="flex-1 bg-black/30 hover:bg-black/50 text-white/80 hover:text-white/90 border-[0.5px] border-white/[0.05] h-11 rounded-xl transition-all duration-300"
              disabled={loadingAction !== null}
            >
              {loadingAction === 'update-password' ? (
                <div className="flex items-center justify-center space-x-3">
                  <div className="h-4 w-4 relative">
                    <div className="absolute inset-0 border-2 border-white/10 rounded-full"></div>
                    <div className="absolute inset-0 border-2 border-t-white/40 rounded-full animate-spin"></div>
                  </div>
                  <span className="text-sm tracking-wide text-white/50">{authT.updatingPassword}</span>
                </div>
              ) : (
                <>
                  <KeyRound className="h-4 w-4 mr-2" />
                  {authT.updatePassword}
                </>
              )}
            </Button>
          </div>
        </>
      ) : (
        // Formulário para solicitar redefinição de senha
        <>
          <div>
            <h2 className="text-xl text-white/90 mb-2">{authT.forgotPasswordTitle}</h2>
            <p className="text-white/60 text-sm">
              {authT.forgotPasswordDesc}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reset-email" className="text-xs uppercase text-white/40 tracking-wider font-light flex items-center">
              <Mail className="h-3 w-3 mr-1.5 opacity-40" />
              {authT.email}
            </Label>
            <Input 
              id="reset-email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="seu@email.com"
              className={`bg-black/20 border-[0.5px] border-white/[0.03] h-11 px-4 text-white/70 focus:outline-none focus:border-white/10 hover:bg-black/30 transition-all duration-300 rounded-xl placeholder:text-white/20 ${error?.field === 'email' ? 'border-rose-500/50 animate-shake' : ''}`}
              disabled={loadingAction !== null}
              ref={emailRef}
            />
            <AnimatePresence>
              {error?.field === 'email' && <ErrorMessage message={error.message} />}
            </AnimatePresence>
          </div>

          <div className="flex space-x-3">
            <Button 
              onClick={() => setForgotPasswordState(false)}
              className="flex-1 bg-black/30 hover:bg-black/50 text-white/80 hover:text-white/90 border-[0.5px] border-white/[0.05] h-11 rounded-xl transition-all duration-300"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {authT.backButton}
            </Button>
            <Button 
              onClick={handleResetPassword}
              className="flex-1 bg-black/30 hover:bg-black/50 text-white/80 hover:text-white/90 border-[0.5px] border-white/[0.05] h-11 rounded-xl transition-all duration-300"
              disabled={loadingAction !== null}
            >
              {loadingAction === 'reset' ? (
                <div className="flex items-center justify-center space-x-3">
                  <div className="h-4 w-4 relative">
                    <div className="absolute inset-0 border-2 border-white/10 rounded-full"></div>
                    <div className="absolute inset-0 border-2 border-t-white/40 rounded-full animate-spin"></div>
                  </div>
                  <span className="text-sm tracking-wide text-white/50">{authT.sendingEmail}</span>
                </div>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  {authT.sendEmailButton}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </motion.div>
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    passwordResetSent,
    showPassword,
    password,

    passwordStrength,
    showConfirmPassword,
    confirmPassword,
    showPasswordMatch,
    passwordsMatch,
    loadingAction,
    error?.field,
    error?.message,
    email,
    handleEmailChange
  ]); // Outras dependências (authT, clearError, funções) são estáveis ou causariam re-renders desnecessários

  // Limpar erros quando mudar de aba
  useEffect(() => {
    const handleTabChange = (event: CustomEvent) => {
      const { value } = event.detail;
      console.log('Mudança de aba detectada:', value);
      
      // Limpar erros ao mudar de aba
      setError({ field: '', message: '' });
      setPasswordStrength({ isStrong: false, message: '' });
      setPasswordsMatch({ isMatch: false, message: '' });
    };
    
    // Adicionar listener para mudanças de aba
    document.addEventListener('tabsValueChange', handleTabChange as EventListener);
    
    // Limpar listener ao desmontar
    return () => {
      document.removeEventListener('tabsValueChange', handleTabChange as EventListener);
    };
  }, []);
  
  // Adicionar listener para detectar cliques nas abas
  useEffect(() => {
    const handleTabClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.getAttribute('data-value') === 'login' || 
          target.closest('[data-value="login"]') || 
          target.getAttribute('data-value') === 'signup' || 
          target.closest('[data-value="signup"]')) {
        
        // Limpar erros ao clicar em uma aba
        setError({ field: '', message: '' });
        setPasswordStrength({ isStrong: false, message: '' });
        setPasswordsMatch({ isMatch: false, message: '' });
      }
    };
    
    // Adicionar listener para cliques
    document.addEventListener('click', handleTabClick);
    
    // Limpar listener ao desmontar
    return () => {
      document.removeEventListener('click', handleTabClick);
    };
  }, []);

  // Função para validar formato de URL
  const validateUrl = (url: string): boolean => {
    // Verificar se a URL está em branco (é opcional)
    if (!url.trim()) return true;
    
    // Verificar formato básico de URL
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900/30 via-black to-black p-4 relative overflow-hidden">
      {/* Adiciona o estilo global para barras de rolagem */}
      <GlobalScrollbarStyle />
      
      {/* Efeitos de fundo sutis */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/[0.01] to-transparent opacity-30"></div>
        <motion.div 
          className="absolute -top-40 -right-40 w-80 h-80 bg-white/[0.01] rounded-full blur-3xl"
          animate={{ 
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ 
            duration: 8, 
            repeat: Infinity,
            repeatType: "reverse" 
          }}
        />
        <motion.div 
          className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/[0.01] rounded-full blur-3xl"
          animate={{ 
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ 
            duration: 10, 
            repeat: Infinity,
            repeatType: "reverse",
            delay: 2
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="w-full max-w-xl relative"
      >
        {/* Cartão principal com efeito de vidro */}
        <div className="p-8 bg-black/40 backdrop-blur-xl rounded-2xl border-[0.5px] border-white/[0.05] shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-center mb-8"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="flex justify-center mb-5"
            >
              <img 
                src="/profeyes-logo-removebg-preview.png" 
                alt="Trending Logo" 
                className="w-24 h-auto [filter:drop-shadow(0_0_10px_rgba(255,255,255,0.1))]"
              />
            </motion.div>
            <motion.h1 
              className="text-xl bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent mb-2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              style={{
                fontFamily: 'Mollen, sans-serif',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                textShadow: '0 0 15px rgba(255, 255, 255, 0.2)'
              }}
            >
              {authT.loginSignupTitle}
            </motion.h1>
          </motion.div>

          <AnimatePresence mode="wait">
            {verifyEmailState ? (
              <VerifyEmailContent />
            ) : forgotPasswordState ? (
              ForgotPasswordContent
            ) : emailVerified ? (
              <EmailVerifiedContent />
            ) : (
              <>
                {/* Seletor de idioma - círculo com bandeira no canto superior direito */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="absolute top-4 right-4 z-20"
                >
                  <LanguageSelector 
                    variant="compact"
                    showFlag={true}
                  />
                </motion.div>
                
                <Tabs 
                  defaultValue="login" 
                  className="w-full" 
                  id="auth-tabs"
                  value={activeTab}
                  onValueChange={(value) => setActiveTab(value)}>
                <TabsList className="grid w-full grid-cols-2 mb-8 bg-black/20 p-1 rounded-xl border-[0.5px] border-white/[0.03]">
                  <TabsTrigger 
                    value="login" 
                    className="rounded-lg data-[state=active]:bg-black/40 data-[state=active]:text-white/90 data-[state=active]:shadow-sm text-white/50 transition-all duration-300"
                  >
                    <User className="h-3.5 w-3.5 mr-2 opacity-70" />
                    {authT.loginTab}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="signup" 
                    className="rounded-lg data-[state=active]:bg-black/40 data-[state=active]:text-white/90 data-[state=active]:shadow-sm text-white/50 transition-all duration-300"
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-2 opacity-70" />
                    {authT.signupTab}
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="login" className="space-y-6">
                  <AnimatePresence mode="wait">
                    {loginSuccess ? (
                      <LoginSuccessContent />
                    ) : (
                      <motion.div 
                        className="space-y-5"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.5 }}
                        key="login-form"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-xs uppercase text-white/40 tracking-wider font-light flex items-center">
                            <Mail className="h-3 w-3 mr-1.5 opacity-40" />
                            {authT.email}
                          </Label>
                          <div className="relative group">
                            <Input 
                              id="email" 
                              type="email" 
                              value={email}
                              onChange={(e) => {
                                setEmail(e.target.value);
                                clearError();
                              }}
                              placeholder={authT.emailPlaceholder}
                              className={`bg-black/20 border-[0.5px] border-white/[0.03] h-11 px-4 text-white/70 focus:outline-none focus:border-white/10 hover:bg-black/30 transition-all duration-300 rounded-xl placeholder:text-white/20 ${error?.field === 'email' ? 'border-rose-500/50 animate-shake' : ''}`}
                              disabled={loadingAction !== null}
                              ref={emailRef}
                              style={{
                                backgroundColor: "rgba(0, 0, 0, 0.2)",
                                color: "rgba(255, 255, 255, 0.7)",
                                caretColor: "rgba(255, 255, 255, 0.7)"
                              }}
                            />
                          </div>
                          <AnimatePresence>
                            {error?.field === 'email' && <ErrorMessage message={error.message} />}
                          </AnimatePresence>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="password" className="text-xs uppercase text-white/40 tracking-wider font-light flex items-center">
                            <KeyRound className="h-3 w-3 mr-1.5 opacity-40" />
                            {authT.password}
                          </Label>
                          <div className="relative group">
                            <Input 
                              id="password" 
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                clearError();
                              }}
                              placeholder="••••••••"
                              className={`bg-black/20 border-[0.5px] border-white/[0.03] h-11 px-4 text-white/70 focus:outline-none focus:border-white/10 hover:bg-black/30 transition-all duration-300 rounded-xl placeholder:text-white/20 ${error?.field === 'password' ? 'border-rose-500/50 animate-shake' : ''}`}
                              disabled={loadingAction !== null}
                              onKeyDown={(e) => e.key === 'Enter' && handleLogin(e)}
                              ref={passwordRef}
                              style={{
                                backgroundColor: "rgba(0, 0, 0, 0.2)",
                                color: "rgba(255, 255, 255, 0.7)",
                                caretColor: "rgba(255, 255, 255, 0.7)"
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                              tabIndex={-1}
                            >
                              {showPassword ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <AnimatePresence>
                            {error?.field === 'password' && <ErrorMessage message={error.message} />}
                          </AnimatePresence>
                          
                          {/* Linha apenas com "Esqueceu a senha?" */}
                          <div className="flex items-center justify-end mt-2">
                            <button
                              onClick={() => setForgotPasswordState(true)}
                              className="text-xs text-white/40 hover:text-white/60 transition-colors"
                            >
                              {authT.forgotPassword}
                            </button>
                          </div>
                        </div>
                        
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2, duration: 0.5 }}
                          className="pt-2"
                        >
                          <Button 
                            className="w-full bg-black/30 hover:bg-black/50 text-white/80 hover:text-white/90 border-[0.5px] border-white/[0.05] h-11 rounded-xl transition-all duration-300 group"
                            onClick={handleLogin}
                            disabled={loadingAction !== null}
                          >
                            {loadingAction === 'login' ? (
                              <div className="flex items-center justify-center space-x-3">
                                <div className="h-4 w-4 relative">
                                  <div className="absolute inset-0 border-2 border-white/10 rounded-full"></div>
                                  <div className="absolute inset-0 border-2 border-t-white/40 rounded-full animate-spin"></div>
                                </div>
                                <span className="text-sm tracking-wide text-white/50">{authT.loading}</span>
                              </div>
                            ) : (
                              <>
                                <LogIn className="h-4 w-4 mr-2 opacity-70 group-hover:opacity-90 transition-opacity" />
                                <span className="text-sm tracking-wide">{authT.loginButton}</span>
                              </>
                            )}
                          </Button>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </TabsContent>
                
                <TabsContent value="signup" className="space-y-6">
                  <AnimatePresence mode="wait">
                    {signupSuccess ? (
                      <SignupSuccessContent />
                    ) : (
                      <motion.div 
                        className="space-y-5"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.5 }}
                        key="signup-form"
                      >
                        {/* Email */}
                        <div className="space-y-2">
                          <Label htmlFor="signup-email" className="text-xs uppercase text-white/40 tracking-wider font-light flex items-center">
                            <Mail className="h-3 w-3 mr-1.5 opacity-40" />
                            {authT.email}
                          </Label>
                          <div className="relative group">
                            <Input 
                              id="signup-email" 
                              type="email" 
                              value={email}
                              onChange={(e) => {
                                setEmail(e.target.value);
                                clearError();
                              }}
                              placeholder={authT.emailPlaceholder}
                              className={`bg-black/20 border-[0.5px] border-white/[0.03] h-11 px-4 text-white/70 focus:outline-none focus:border-white/10 hover:bg-black/30 transition-all duration-300 rounded-xl placeholder:text-white/20 ${error?.field === 'email' ? 'border-rose-500/50 animate-shake' : ''}`}
                              disabled={loadingAction !== null}
                              ref={emailRef}
                              style={{
                                backgroundColor: "rgba(0, 0, 0, 0.2)",
                                color: "rgba(255, 255, 255, 0.7)",
                                caretColor: "rgba(255, 255, 255, 0.7)"
                              }}
                            />
                          </div>
                          <AnimatePresence>
                            {error?.field === 'email' && <ErrorMessage message={error.message} />}
                          </AnimatePresence>
                        </div>
                        
                        {/* Nome de Exibição */}
                        <div className="space-y-2">
                          <Label htmlFor="signup-displayname" className="text-xs uppercase text-white/40 tracking-wider font-light flex items-center">
                            <User className="h-3 w-3 mr-1.5 opacity-40" />
                            {authT.displayName}
                          </Label>
                          <div className="relative group">
                            <Input 
                              id="signup-displayname" 
                              type="text" 
                              value={displayName}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                // Permitir apagar todos os caracteres, mas validar apenas o limite máximo
                                if (newValue.length <= 30) {
                                  setDisplayName(newValue);
                                  clearError();
                                  // Limpar erro apenas se excedeu o limite, não se estiver vazio
                                  if (displayNameError && displayNameError.includes('máximo')) {
                                    setDisplayNameError(null);
                                  }
                                }
                              }}
                              onBlur={handleDisplayNameBlur}
                              placeholder={authT.displayNamePlaceholder}
                              maxLength={30}
                              className={`bg-black/20 border-[0.5px] ${displayNameError ? 'border-red-500/50' : 'border-white/[0.03]'} h-11 px-4 pr-16 text-white/70 focus:outline-none focus:border-white/10 focus:bg-black/25 hover:bg-black/30 transition-all duration-300 rounded-xl placeholder:text-white/20 ${error?.field === 'displayName' ? 'border-rose-500/50 animate-shake' : ''}`}
                              disabled={loadingAction !== null}
                              ref={displayNameRef}
                              style={{
                                backgroundColor: "rgba(0, 0, 0, 0.2)",
                                color: "rgba(255, 255, 255, 0.7)",
                                caretColor: "rgba(255, 255, 255, 0.7)"
                              }}
                            />
                            <div className="absolute top-0 right-0 bottom-0 flex items-center pr-3 pointer-events-none">
                              <p className="text-xs text-white/40">
                                {displayName.length}{authT.characterCount}
                              </p>
                            </div>
                          </div>
                          <AnimatePresence>
                            {(error?.field === 'displayName' && <ErrorMessage message={error.message} />) ||
                             (displayNameError && <ErrorMessage message={displayNameError} />)}
                          </AnimatePresence>
                        </div>
                        

                        
                        {/* Senha */}
                        <div className="space-y-2">
                          <Label htmlFor="signup-password" className="text-xs uppercase text-white/40 tracking-wider font-light flex items-center">
                            <KeyRound className="h-3 w-3 mr-1.5 opacity-40" />
                            {authT.password}
                          </Label>
                          <div className="relative group">
                            <Input 
                              id="signup-password" 
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                validatePasswordStrength(e.target.value);
                                validatePasswordMatch();
                                clearError();
                              }}
                              placeholder={authT.passwordPlaceholder}
                              className={`bg-black/20 border-[0.5px] border-white/[0.03] h-11 px-4 text-white/70 focus:outline-none focus:border-white/10 hover:bg-black/30 transition-all duration-300 rounded-xl placeholder:text-white/20 ${error?.field === 'password' ? 'border-rose-500/50 animate-shake' : ''}`}
                              disabled={loadingAction !== null}
                              ref={passwordRef}
                              style={{
                                backgroundColor: "rgba(0, 0, 0, 0.2)",
                                color: "rgba(255, 255, 255, 0.7)",
                                caretColor: "rgba(255, 255, 255, 0.7)"
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                              tabIndex={-1}
                            >
                              {showPassword ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <AnimatePresence mode="wait">
                            {error?.field === 'password' && (
                              passwordStrength && !passwordStrength.isStrong ? (
                                PasswordStrengthIndicator
                              ) : (
                                <ErrorMessage message={error.message} />
                              )
                            )}
                          </AnimatePresence>
                        </div>
                        
                        {/* Confirmar Senha */}
                        <div className="space-y-2">
                          <Label htmlFor="confirm-password" className="text-xs uppercase text-white/40 tracking-wider font-light flex items-center">
                            <KeyRound className="h-3 w-3 mr-1.5 opacity-40" />
                            {authT.confirmPassword}
                          </Label>
                          <div className="relative group">
                            <Input 
                              id="confirm-password" 
                              type={showConfirmPassword ? "text" : "password"}
                              value={confirmPassword}
                              onChange={(e) => {
                                setConfirmPassword(e.target.value);
                                validatePasswordMatch();
                                clearError();
                              }}
                              placeholder={authT.confirmPasswordPlaceholder}
                              className={`bg-black/20 border-[0.5px] border-white/[0.03] h-11 px-4 text-white/70 focus:outline-none focus:border-white/10 hover:bg-black/30 transition-all duration-300 rounded-xl placeholder:text-white/20 ${error?.field === 'confirmPassword' ? 'border-rose-500/50 animate-shake' : ''}`}
                              disabled={loadingAction !== null}
                              onKeyDown={(e) => e.key === 'Enter' && handleSignUp()}
                              ref={confirmPasswordRef}
                              style={{
                                backgroundColor: "rgba(0, 0, 0, 0.2)",
                                color: "rgba(255, 255, 255, 0.7)",
                                caretColor: "rgba(255, 255, 255, 0.7)"
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                              tabIndex={-1}
                            >
                              {showConfirmPassword ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <AnimatePresence mode="wait">
                            {error?.field === 'confirmPassword' ? (
                              <ErrorMessage message={error.message} />
                            ) : (
                              showPasswordMatch && password && confirmPassword && passwordsMatch && (
                                <PasswordMatchIndicator match={passwordsMatch} />
                              )
                            )}
                          </AnimatePresence>
                        </div>
                        
                        {/* Data de Nascimento */}
                        <div className="space-y-2">
                          <Label htmlFor="birthdate" className="text-xs uppercase text-white/40 tracking-wider font-light flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 mr-1.5 opacity-40">
                              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                              <line x1="16" x2="16" y1="2" y2="6" />
                              <line x1="8" x2="8" y1="2" y2="6" />
                              <line x1="3" x2="21" y1="10" y2="10" />
                            </svg>
                            {authT.birthdate}
                          </Label>
                          <div className="relative">
                            <Input 
                              id="birthdate" 
                              type="text"
                              value={birthdate}
                              onChange={handleBirthdateChange}
                              placeholder={authT.birthdatePlaceholder}
                              maxLength={10}
                              ref={birthdateRef}
                              className={`bg-black/20 border-[0.5px] border-white/[0.03] h-11 px-4 text-white/70 focus:outline-none focus:border-white/10 hover:bg-black/30 transition-all duration-300 rounded-xl placeholder:text-white/20 ${error?.field === 'birthdate' ? 'border-rose-500/50 animate-shake' : ''}`}
                              disabled={loadingAction !== null}
                              style={{
                                backgroundColor: "rgba(0, 0, 0, 0.2)",
                                color: "rgba(255, 255, 255, 0.7)",
                                caretColor: "rgba(255, 255, 255, 0.7)"
                              }}
                            />
                            <div className="absolute top-0 right-0 bottom-0 flex items-center pr-3 pointer-events-none">
                              <p className="text-xs text-white/20">
                                {birthdate.length < 2 ? authT.dayPlaceholder : 
                                 birthdate.length < 5 ? "Mês" : 
                                 birthdate.length < 10 ? "Ano" : ""}
                              </p>
                            </div>
                          </div>
                          <AnimatePresence>
                            {(error?.field === 'birthdate' && <ErrorMessage message={error.message} />) || 
                             (birthdateError && <ErrorMessage message={birthdateError} />)}
                          </AnimatePresence>
                          <p className="text-xs text-white/40 mt-1">{authT.ageRestriction}</p>
                        </div>
                        
                        {/* Tipo de Investidor */}
                        <div className="space-y-2">
                          <Label className="text-xs uppercase text-white/40 tracking-wider font-light flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 mr-1.5 opacity-40">
                              <path d="M3 3v18h18" />
                              <path d="m19 9-5 5-4-4-3 3" />
                            </svg>
                            {authT.investorType}
                          </Label>
                          <InvestorTypeSelector
                            value={investorType}
                            onChange={(value) => {
                              setInvestorType(value);
                              clearError();
                            }}
                            error={error?.field === 'investorType' ? error.message : undefined}
                          />
                        </div>
                        
                        {/* Apoie seu trader favorito (OPCIONAL) */}
                        <div className="space-y-2 pt-2 relative">
                          <div 
                            className="flex items-center justify-between cursor-pointer p-3 border border-white/5 rounded-lg bg-black/30 shadow-sm h-11"
                            onClick={() => setShowTraderSupport(!showTraderSupport)}
                          >
                            <Label className="text-xs uppercase text-white/40 tracking-wider font-light flex items-center cursor-pointer">
                                                                    <Heart className="h-3 w-3 mr-1.5 text-purple-600" />
                              {t('trader.support.optional')}
                            </Label>
                            <button
                              type="button"
                              title={showTraderSupport ? "Ocultar suporte do trader" : "Mostrar suporte do trader"}
                              aria-label={showTraderSupport ? "Ocultar suporte do trader" : "Mostrar suporte do trader"}
                              className={`w-6 h-6 rounded-full bg-black/40 flex items-center justify-center border border-white/[0.03] transition-transform duration-300 ${showTraderSupport ? 'rotate-180' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowTraderSupport(!showTraderSupport);
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                                <path d="m6 9 6 6 6-6"/>
                              </svg>
                            </button>
                          </div>
                          
                          <AnimatePresence>
                            {showTraderSupport && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4 pt-1 overflow-hidden"
                              >
                                <div className="space-y-3 bg-gradient-to-br from-black/40 via-black/20 to-black/30 p-4 rounded-xl border border-white/[0.08] shadow-inner">
                                  <div className="flex items-start space-x-2.5">
                                    <div className="mt-0.5 relative">
                                      <div className="absolute -inset-1.5 bg-gradient-to-br from-purple-800/20 via-purple-700/10 to-purple-600/20 rounded-full blur-sm"></div>
                                      <div className="relative p-1 bg-black/30 border border-purple-700/20 rounded-full">
                                        <Heart className="h-3 w-3 text-purple-600" />
                                      </div>
                                    </div>
                                    <p className="text-xs text-white/70 leading-relaxed">
                                      {t('trader.support.add')}
                                    </p>
                                  </div>
                                  
                                  
                                  {/* Link do trader */}
                                  <div className="space-y-1.5 pt-1">
                                    <Label htmlFor="trader-link" className="text-xs text-white/60 flex items-center">
                                      <LinkIcon className="h-3 w-3 mr-1.5 text-purple-600/80" />
                                      {t('trader.support.link')}
                                    </Label>
                                    <div className="relative">
                                      <div className={`absolute inset-0 bg-gradient-to-r from-white/5 via-white/3 to-white/5 rounded-lg blur transition-opacity duration-300 pointer-events-none ${preferredTraderLink ? 'opacity-20' : 'opacity-0'}`}></div>
                                    <Input
                                      id="trader-link"
                                      type="url"
                                      value={preferredTraderLink}
                                      onChange={(e) => {
                                        setPreferredTraderLink(e.target.value);
                                        clearError();
                                      }}
                                        placeholder={t('trader.support.link.placeholder')}
                                        className={`bg-black/20 border-[0.5px] border-white/[0.08] h-9 px-3 text-xs text-white/70 focus:outline-none focus:bg-black/40 focus:border-white/15 hover:bg-black/30 transition-all duration-300 rounded-lg placeholder:text-white/20 ${error?.field === 'preferredTraderLink' ? 'border-rose-500/50 animate-shake' : ''}`}
                                      ref={traderLinkRef}
                                    />

                                    </div>
                                    <AnimatePresence>
                                      {error?.field === 'preferredTraderLink' && <ErrorMessage message={error.message} />}
                                    </AnimatePresence>
                                    <p className="text-[9px] text-white/30 pt-0.5">
                                      Este campo não é obrigatório para prosseguir.
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        
                        {/* Termos e Condições */}
                        <div className="space-y-2 pt-2">
                          <div className="flex items-start space-x-2">
                            <Checkbox 
                              id="terms" 
                              checked={termsAccepted}
                              onCheckedChange={(checked) => {
                                if (checked === true) {
                                  setShowTerms(true);
                                } else {
                                  setTermsAccepted(false);
                                }
                                clearError();
                              }}
                              className={`mt-1 relative ${
                                termsAccepted 
                                  ? 'bg-emerald-500/20 border-emerald-500/50 data-[state=checked]:bg-emerald-500/20 data-[state=checked]:border-emerald-400/50 data-[state=checked]:text-emerald-400'
                                  : 'bg-black/20 border-white/10 data-[state=checked]:bg-white/20 data-[state=checked]:border-white/30 data-[state=checked]:text-white'
                              } transition-all duration-300`}
                            />
                            {termsAccepted && (
                              <div className="absolute mt-1 ml-0.5 pointer-events-none">
                                <div className="absolute inset-0 rounded-sm bg-emerald-400/20 blur-[2px] scale-110"></div>
                                <div className="absolute inset-0 rounded-sm bg-emerald-400/10 blur-[4px] scale-150"></div>
                              </div>
                            )}
                            <Label 
                              htmlFor="terms" 
                              className={`text-xs ${termsAccepted ? 'text-emerald-400/90' : 'text-white/60'} leading-relaxed cursor-pointer transition-colors duration-300 mt-1`}
                            >
                              {authT.acceptTerms} <button 
                                type="button" 
                                onClick={() => setShowTerms(true)}
                                className={`${termsAccepted ? 'text-emerald-400 hover:text-emerald-300' : 'text-white/80 hover:text-white'} underline underline-offset-2 focus:outline-none transition-colors duration-300`}
                              >
                                {authT.viewTerms}
                              </button>
                            </Label>
                          </div>
                          <AnimatePresence>
                            {(error?.field === 'terms' || showTermsError && !termsAccepted) && (
                              <ErrorMessage message={authT.termsRequired} />
                            )}
                          </AnimatePresence>
                        </div>
                        
                        {/* Botão de Cadastro */}
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2, duration: 0.5 }}
                          className="pt-2"
                        >
                          <Button 
                            className="w-full bg-black/30 hover:bg-black/50 text-white/80 hover:text-white/90 border-[0.5px] border-white/[0.05] h-11 rounded-xl transition-all duration-300 group"
                            onClick={handleSignUp}
                            disabled={loadingAction !== null}
                          >
                            {loadingAction === 'signup' ? (
                              <div className="flex items-center justify-center space-x-3">
                                <div className="h-4 w-4 relative">
                                  <div className="absolute inset-0 border-2 border-white/10 rounded-full"></div>
                                  <div className="absolute inset-0 border-2 border-t-white/40 rounded-full animate-spin"></div>
                                </div>
                                <span className="text-sm tracking-wide text-white/50">{authT.loading}</span>
                              </div>
                            ) : (
                              <>
                                <UserPlus className="h-4 w-4 mr-2 opacity-70 group-hover:opacity-90 transition-opacity" />
                                <span className="text-sm tracking-wide">{authT.signupButton}</span>
                              </>
                            )}
                          </Button>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </TabsContent>
              </Tabs>
              </>
            )}
          </AnimatePresence>
        </div>
        
        {/* Reflexo sutil na parte inferior */}
        <div className="absolute -bottom-10 left-0 right-0 h-20 bg-gradient-to-b from-white/[0.01] to-transparent blur-xl rounded-full mx-auto w-4/5 opacity-30"></div>
        <TermsAndConditionsModal showTerms={showTerms} setShowTerms={setShowTerms} />
      </motion.div>
    </div>
  );
} 