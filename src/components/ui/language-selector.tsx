import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogTrigger
} from "@/components/ui/dialog";
import { useLanguage, Language } from "@/contexts/LanguageContext";
import { useTimeZone } from "@/contexts/TimeZoneContext";
import { useAuth } from "@/contexts/AuthContext";
import { Globe, Check, ArrowRight, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
  icon: string;
  flag: string;
  landmark: string;
  greeting: string;
  countryCode: string;
  colors: {
    primary: string;
    secondary: string;
  };
}

const languages: LanguageOption[] = [
  { 
    code: "pt", 
    name: "Português",
    nativeName: "Português",
    icon: "🇧🇷",
    flag: "https://flagcdn.com/br.svg",
    landmark: "https://images.unsplash.com/photo-1516306580123-e6e52b1b7b5f?q=80&w=800&auto=format&fit=crop",
    greeting: "Olá, bem-vindo!",
    countryCode: "BR",
    colors: {
      primary: "from-green-600/20 to-yellow-500/20",
      secondary: "group-hover:from-green-600/30 group-hover:to-yellow-500/30"
    }
  },
  { 
    code: "en", 
    name: "English",
    nativeName: "English",
    icon: "🇺🇸",
    flag: "https://flagcdn.com/us.svg",
    landmark: "https://images.unsplash.com/photo-1492666673288-3c4b4576ad9a?q=80&w=800&auto=format&fit=crop",
    greeting: "Hello, welcome!",
    countryCode: "US",
    colors: {
      primary: "from-blue-600/20 to-red-500/20",
      secondary: "group-hover:from-blue-600/30 group-hover:to-red-500/30"
    }
  },
  { 
    code: "es", 
    name: "Español",
    nativeName: "Español",
    icon: "🇪🇸",
    flag: "https://flagcdn.com/es.svg",
    landmark: "https://images.unsplash.com/photo-1543783207-ec64e4d95325?q=80&w=800&auto=format&fit=crop",
    greeting: "¡Hola, bienvenido!",
    countryCode: "ES",
    colors: {
      primary: "from-red-600/20 to-yellow-500/20",
      secondary: "group-hover:from-red-600/30 group-hover:to-yellow-500/30"
    }
  }
];

export interface LanguageSelectorProps {
  variant?: 'default' | 'minimal' | 'auth' | 'compact';
  showFlag?: boolean;
}

export function LanguageSelector({ variant = 'default', showFlag = true }: LanguageSelectorProps) {
  const { language, changeLanguage, updateUserLanguage } = useLanguage();
  const { setAvailableTimeZones, getTimeZonesForLanguage, setTimeZone, getDefaultTimeZone } = useTimeZone();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [hoveredLanguage, setHoveredLanguage] = useState<Language | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<Language>(language);
  
  // Atualizar a pré-visualização quando o idioma mudar
  useEffect(() => {
    setSelectedPreview(language);
  }, [language]);
  
  // Encontrar o idioma atual
  const currentLanguage = languages.find(lang => lang.code === language) || languages[0];
  
  // Função para alterar o idioma e atualizar fusos horários
  const handleLanguageChange = async (lang: Language) => {
    // Alterar o idioma usando a função do contexto
    changeLanguage(lang);
    
    // Atualizar os fusos horários disponíveis com base no novo idioma
    const updatedTimeZones = getTimeZonesForLanguage(lang);
    setAvailableTimeZones(updatedTimeZones);
    
    // Verificar se o fuso atual está disponível no novo idioma, caso não esteja, mudar para o padrão
    const defaultTimeZone = getDefaultTimeZone(lang);
    setTimeZone(defaultTimeZone);
    
    // Se o usuário estiver logado, atualizar suas preferências
    if (user && user.id) {
      try {
        // Salvar idioma no banco de dados usando a função correta do contexto
        await updateUserLanguage(user.id, lang);
        
        // Também salvar no sessionStorage para garantir persistência durante navegação
        sessionStorage.setItem('user-selected-language', lang);
        sessionStorage.setItem('language-selection-completed', 'true');
        
        console.log(`✅ Idioma ${lang} atualizado nas configurações para usuário ${user.id}`);
        
        // Idioma alterado com sucesso
        console.log('Idioma alterado com sucesso!');
      } catch (error) {
        console.error('Erro ao salvar idioma:', error);
        toast.error('Erro ao salvar idioma. Tente novamente.');
      }
    } else {
      // Se não estiver logado, salvar apenas no localStorage
      localStorage.setItem('app-language', lang);
      console.log('Idioma alterado com sucesso!');
    }
    
    // Salvar todas as configurações automaticamente
    try {
      // Criar objeto com todas as configurações
      const settings = {
        autoBackup: localStorage.getItem('autoBackup') === 'true',
        dataExport: localStorage.getItem('dataExport') === 'true',
        twoFactorAuth: localStorage.getItem('twoFactorAuth') === 'true',
        emailAuth: localStorage.getItem('emailAuth') === 'true',
        priceAlerts: localStorage.getItem('priceAlerts') === 'true',
        language: lang
      };
      
      // Salvar no localStorage
      localStorage.setItem('app-settings', JSON.stringify(settings));
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
    }
    
    // Disparar evento customizado para notificar mudança de idioma (para página de autenticação)
    window.dispatchEvent(new CustomEvent('languageChanged', { 
      detail: { 
        language: lang,
        timestamp: Date.now()
      } 
    }));
    
    // Fechar diálogo sem mostrar toast
    setOpen(false);
  };
  
  // Função para obter o texto traduzido de "Idioma"
  const getLanguageText = (lang: Language) => {
    switch (lang) {
      case 'pt':
        return 'Idioma';
      case 'en':
        return 'Language';
      case 'es':
        return 'Idioma';
      default:
        return 'Language';
    }
  };

  if (variant === 'auth') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <motion.button
            className="group relative h-6 w-6 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/30 border border-white/[0.03] hover:border-white/[0.12] transition-all duration-300 backdrop-blur-sm shadow-sm hover:shadow-md"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            <motion.div
              className="relative"
              initial={false}
              animate={{ rotate: 0 }}
              whileHover={{ rotate: 12 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {showFlag && currentLanguage ? (
                <motion.span 
                  className="text-[10px] leading-none block"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.2 }}
                >
                  {currentLanguage.icon}
                </motion.span>
              ) : (
                <Globe className="w-3 h-3 text-white/50 group-hover:text-white/75 transition-colors duration-300" />
              )}
            </motion.div>
            
            {/* Indicador sutil de dropdown */}
            <motion.div
              className="absolute -bottom-0.5 -right-0.5 w-1 h-1 bg-white/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              initial={{ scale: 0 }}
              whileHover={{ scale: 1 }}
              transition={{ delay: 0.15, duration: 0.2 }}
            />
          </motion.button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent 
          align="end" 
          className="bg-black/97 border-white/[0.06] backdrop-blur-xl rounded-lg min-w-[140px] p-0.5 shadow-xl"
          sideOffset={6}
        >
          {languages.map((language, index) => (
            <DropdownMenuItem
              key={language.code}
              onClick={() => handleLanguageChange(language.code)}
              className="group relative p-0"
              asChild
            >
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03, duration: 0.2, ease: "easeOut" }}
                className={`
                  flex items-center space-x-2 px-2.5 py-1.5 cursor-pointer rounded-md
                  hover:bg-white/[0.06] transition-all duration-200
                  ${language.code === currentLanguage.code ? 'bg-white/[0.04] text-white' 
                    : 'text-neutral-400 hover:text-white'
                  }
                `}
              >
                {/* Flag com animação sutil */}
                <motion.span 
                  className="text-xs leading-none flex-shrink-0"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.15 }}
                >
                  {language.icon}
                </motion.span>
                
                {/* Nome do idioma compacto */}
                <span className="text-xs font-medium tracking-normal flex-1">{language.nativeName}</span>
                
                {/* Indicador de selecionado minimalista */}
                <AnimatePresence>
                  {language.code === currentLanguage.code && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="w-1 h-1 bg-green-400 rounded-full flex-shrink-0"
                    />
                  )}
                </AnimatePresence>
                
                {/* Hover effect ultra-sutil */}
                <motion.div
                  className="absolute inset-0 rounded-md bg-gradient-to-r from-white/[0.01] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  layoutId={`hover-${language.code}`}
                />
              </motion.div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (variant === 'compact') {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <motion.button
            className="group relative h-9 w-9 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/40 border border-white/[0.05] hover:border-white/[0.15] transition-all duration-300 backdrop-blur-sm shadow-lg hover:shadow-xl cursor-pointer"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            <motion.span 
              className="text-lg leading-none block"
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.2 }}
            >
              {currentLanguage.icon}
            </motion.span>
            
            {/* Efeito de brilho sutil ao passar o mouse */}
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              initial={{ scale: 0.8 }}
              whileHover={{ scale: 1 }}
            />
          </motion.button>
        </DialogTrigger>
        
        <DialogContent className="max-w-3xl p-0 bg-black/80 backdrop-blur-xl border border-white/5 shadow-2xl rounded-xl overflow-hidden">
          <div className="grid grid-cols-5 h-[500px]">
            {/* Área de pré-visualização à esquerda */}
            <div className="col-span-2 relative overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedPreview}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0"
                >
                  {/* Imagem do marco do país */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/70 to-black/95 z-10" />
                  <motion.img 
                    initial={{ scale: 1.05 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 1.5 }}
                    src={languages.find(l => l.code === selectedPreview)?.landmark}
                    alt={languages.find(l => l.code === selectedPreview)?.name}
                    className="w-full h-full object-cover object-center filter brightness-75"
                  />
                  
                  {/* Informações do idioma destacado */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="relative overflow-hidden rounded-md shadow-lg border border-white/10 h-10">
                        <img 
                          src={languages.find(l => l.code === selectedPreview)?.flag} 
                          alt={languages.find(l => l.code === selectedPreview)?.name}
                          className="h-full w-auto object-cover"
                        />
                      </div>
                      <h3 className="text-xl font-semibold text-white/90">
                        {languages.find(l => l.code === selectedPreview)?.name}
                      </h3>
                    </div>
                    <p className="text-white/70 text-sm mb-4">
                      {languages.find(l => l.code === selectedPreview)?.greeting}
                    </p>
                    
                    {/* Botão para selecionar idioma */}
                    {selectedPreview !== language && (
                      <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        <Button 
                          className="bg-black/50 hover:bg-black/70 text-white/90 border border-white/10 backdrop-blur-sm"
                          onClick={() => handleLanguageChange(selectedPreview)}
                        >
                          {selectedPreview === 'pt' ? 'Selecionar' : 
                           selectedPreview === 'en' ? 'Select' : 
                           selectedPreview === 'es' ? 'Seleccionar' : 'Select'} {languages.find(l => l.code === selectedPreview)?.name}
                        </Button>
                      </motion.div>
                    )}
                    
                    {/* Indicador de selecionado */}
                    {selectedPreview === language && (
                      <div className="flex items-center gap-2 bg-black/50 text-green-400/90 py-2 px-3 rounded-lg border border-green-500/20 backdrop-blur-sm">
                        <Check className="h-4 w-4" />
                        <span className="text-sm">
                          {language === 'pt' ? 'Idioma atual' : 
                           language === 'en' ? 'Current language' : 
                           language === 'es' ? 'Idioma actual' : 'Current language'}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            
            {/* Lista de idiomas à direita */}
            <div className="col-span-3 p-6 overflow-auto bg-black/30 backdrop-blur-sm">
              <h2 className="text-base font-medium text-white/90 mb-6 flex items-center gap-2 border-b border-white/10 pb-3">
                <span>{getLanguageText(language)}</span>
              </h2>
              
              <div className="grid grid-cols-1 gap-3">
                {languages.map((lang) => (
                  <motion.div
                    key={lang.code}
                    whileHover={{ borderColor: "rgba(255,255,255,0.2)" }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "group cursor-pointer rounded-lg overflow-hidden border border-transparent",
                      language === lang.code ? "ring-1 ring-white/10" : ""
                    )}
                    onClick={() => handleLanguageChange(lang.code)}
                    onMouseEnter={() => {
                      setHoveredLanguage(lang.code);
                      setSelectedPreview(lang.code);
                    }}
                    onMouseLeave={() => {
                      setHoveredLanguage(null);
                    }}
                  >
                    <div className={cn(
                      "relative p-4 transition-all duration-300",
                      "bg-black/60 hover:bg-black/80"
                    )}>
                      <div className="flex items-center gap-4 relative z-10">
                        {/* Flag com sombra sutil */}
                        <div className="relative w-16 h-12 overflow-hidden rounded shadow-md transition-shadow duration-300 group-hover:shadow-lg flex-shrink-0">
                          <img 
                            src={lang.flag} 
                            alt={lang.name} 
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 border border-white/5 group-hover:border-white/10 transition-all duration-300"></div>
                        </div>
                        
                        {/* Informações do idioma */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-white/90 group-hover:text-white transition-colors duration-300">
                              {lang.name}
                            </h3>
                            {language === lang.code && (
                              <div className="flex items-center gap-1 bg-black/50 text-green-400/90 px-2 py-0.5 rounded-full text-xs">
                                <Check className="h-3 w-3" />
                                <span>
                                  {language === 'pt' ? 'Atual' : 
                                   language === 'en' ? 'Current' : 
                                   language === 'es' ? 'Actual' : 'Current'}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors duration-300">
                              {lang.nativeName}
                            </span>
                          </div>
                        </div>
                        
                        {/* Indicador de seleção */}
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0",
                          hoveredLanguage === lang.code || language === lang.code
                            ? "bg-black/70" : "bg-black/50"
                        )}>
                          {language === lang.code ? (
                            <Check className="h-4 w-4 text-white/90" />
                          ) : (
                            <ArrowRight className={cn(
                              "h-4 w-4 transition-transform duration-300",
                              hoveredLanguage === lang.code ? "translate-x-0.5 text-white/90" : "text-white/50"
                            )} />
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full p-0 h-auto bg-black border border-white/5 hover:bg-black/90 hover:border-white/10 hover:scale-[1.02] transition-all duration-300 group shadow-sm rounded-md overflow-hidden"
        >
          <div className="w-full relative rounded-md">
            <div className="flex items-center p-2.5 gap-3 relative z-10">
              {/* Ícone minimalista */}
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-black shadow-inner"></div>
                <span className="text-lg">{currentLanguage.icon}</span>
              </div>
              
              {/* Informações do idioma simplificadas */}
              <div className="flex flex-col items-start text-left flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-white">{currentLanguage.name}</span>
                  <span className="bg-black/50 text-white/70 text-xs px-1.5 py-0.5 rounded-full border border-white/5">
                    {currentLanguage.countryCode}
                  </span>
                </div>
              </div>
              
              {/* Seta à direita */}
              <div className="h-6 w-6 rounded-full flex items-center justify-center">
                <ArrowRight className="h-3.5 w-3.5 text-white/60 group-hover:text-white transition-all duration-300" />
              </div>
            </div>
          </div>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-3xl p-0 bg-black/80 backdrop-blur-xl border border-white/5 shadow-2xl rounded-xl overflow-hidden">
        <div className="grid grid-cols-5 h-[500px]">
          {/* Área de pré-visualização à esquerda */}
          <div className="col-span-2 relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedPreview}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0"
              >
                {/* Imagem do marco do país */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/70 to-black/95 z-10" />
                <motion.img 
                  initial={{ scale: 1.05 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 1.5 }}
                  src={languages.find(l => l.code === selectedPreview)?.landmark}
                  alt={languages.find(l => l.code === selectedPreview)?.name}
                  className="w-full h-full object-cover object-center filter brightness-75"
                />
                
                {/* Informações do idioma destacado */}
                <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative overflow-hidden rounded-md shadow-lg border border-white/10 h-10">
                      <img 
                        src={languages.find(l => l.code === selectedPreview)?.flag} 
                        alt={languages.find(l => l.code === selectedPreview)?.name}
                        className="h-full w-auto object-cover"
                      />
                    </div>
                    <h3 className="text-xl font-semibold text-white/90">
                      {languages.find(l => l.code === selectedPreview)?.name}
                    </h3>
                  </div>
                  <p className="text-white/70 text-sm mb-4">
                    {languages.find(l => l.code === selectedPreview)?.greeting}
                  </p>
                  
                  {/* Botão para selecionar idioma */}
                  {selectedPreview !== language && (
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Button 
                        className="bg-black/50 hover:bg-black/70 text-white/90 border border-white/10 backdrop-blur-sm"
                        onClick={() => handleLanguageChange(selectedPreview)}
                      >
                        {selectedPreview === 'pt' ? 'Selecionar' : 
                         selectedPreview === 'en' ? 'Select' : 
                         selectedPreview === 'es' ? 'Seleccionar' : 'Select'} {languages.find(l => l.code === selectedPreview)?.name}
                      </Button>
                    </motion.div>
                  )}
                  
                  {/* Indicador de selecionado */}
                  {selectedPreview === language && (
                    <div className="flex items-center gap-2 bg-black/50 text-green-400/90 py-2 px-3 rounded-lg border border-green-500/20 backdrop-blur-sm">
                      <Check className="h-4 w-4" />
                      <span className="text-sm">
                        {language === 'pt' ? 'Idioma atual' : 
                         language === 'en' ? 'Current language' : 
                         language === 'es' ? 'Idioma actual' : 'Current language'}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          
          {/* Lista de idiomas à direita */}
          <div className="col-span-3 p-6 overflow-auto bg-black/30 backdrop-blur-sm">
            <h2 className="text-base font-medium text-white/90 mb-6 flex items-center gap-2 border-b border-white/10 pb-3">
              <span>{getLanguageText(language)}</span>
            </h2>
            
            <div className="grid grid-cols-1 gap-3">
              {languages.map((lang) => (
                <motion.div
                  key={lang.code}
                  whileHover={{ borderColor: "rgba(255,255,255,0.2)" }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "group cursor-pointer rounded-lg overflow-hidden border border-transparent",
                    language === lang.code ? "ring-1 ring-white/10" : ""
                  )}
                  onClick={() => handleLanguageChange(lang.code)}
                  onMouseEnter={() => {
                    setHoveredLanguage(lang.code);
                    setSelectedPreview(lang.code);
                  }}
                  onMouseLeave={() => {
                    setHoveredLanguage(null);
                  }}
                >
                  <div className={cn(
                    "relative p-4 transition-all duration-300",
                    "bg-black/60 hover:bg-black/80"
                  )}>
                    <div className="flex items-center gap-4 relative z-10">
                      {/* Flag com sombra sutil */}
                      <div className="relative w-16 h-12 overflow-hidden rounded shadow-md transition-shadow duration-300 group-hover:shadow-lg flex-shrink-0">
                        <img 
                          src={lang.flag} 
                          alt={lang.name} 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 border border-white/5 group-hover:border-white/10 transition-all duration-300"></div>
                      </div>
                      
                      {/* Informações do idioma */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-white/90 group-hover:text-white transition-colors duration-300">
                            {lang.name}
                          </h3>
                          {language === lang.code && (
                            <div className="flex items-center gap-1 bg-black/50 text-green-400/90 px-2 py-0.5 rounded-full text-xs">
                              <Check className="h-3 w-3" />
                              <span>
                                {language === 'pt' ? 'Atual' : 
                                 language === 'en' ? 'Current' : 
                                 language === 'es' ? 'Actual' : 'Current'}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors duration-300">
                            {lang.nativeName}
                          </span>
                        </div>
                      </div>
                      
                      {/* Indicador de seleção */}
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0",
                        hoveredLanguage === lang.code || language === lang.code
                          ? "bg-black/70" : "bg-black/50"
                      )}>
                        {language === lang.code ? (
                          <Check className="h-4 w-4 text-white/90" />
                        ) : (
                          <ArrowRight className={cn(
                            "h-4 w-4 transition-transform duration-300",
                            hoveredLanguage === lang.code ? "translate-x-0.5 text-white/90" : "text-white/50"
                          )} />
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 