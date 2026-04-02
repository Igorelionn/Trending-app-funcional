import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronRight, Check, Globe, ArrowRight, BarChart3, LineChart, PieChart, Languages, MessageSquare, Speech } from 'lucide-react';
import { toast } from 'sonner';

// Informações sobre os idiomas disponíveis
const languages = [
  { 
    code: 'pt', 
    name: 'Português do Brasil',
    fullName: 'Português do Brasil',
    nativeName: 'Português',
    flag: '/images/flags/brazil.png',
    description: 'Interface completa em português',
    culturalNote: 'Suporte técnico local',
    color: 'from-blue-700 to-green-600',
    highlightColor: 'bg-green-500/30',
    shadowColor: 'shadow-green-500/30',
    icon: <BarChart3 className="w-4 h-4" />,
    particleColor: 'rgba(34, 197, 94, 0)'
  },
  { 
    code: 'en', 
    name: 'English',
    fullName: 'American English',
    nativeName: 'English',
    flag: '/images/flags/usa.png',
    description: 'Complete interface in English',
    culturalNote: 'International support',
    color: 'from-blue-700 to-red-600',
    highlightColor: 'bg-blue-500/30',
    shadowColor: 'shadow-blue-500/30',
    icon: <LineChart className="w-4 h-4" />,
    particleColor: 'rgba(59, 131, 246, 0)'
  },
  { 
    code: 'es', 
    name: 'Español',
    fullName: 'Español Internacional',
    nativeName: 'Español',
    flag: '/images/flags/spain.png',
    description: 'Interfaz completa en español',
    culturalNote: 'Soporte internacional',
    color: 'from-orange-500 to-red-600',
    highlightColor: 'bg-orange-500/30',
    shadowColor: 'shadow-orange-500/30',
    icon: <PieChart className="w-4 h-4" />,
    particleColor: 'rgba(249, 116, 22, 0)'
  }
];

// Textos para diferentes idiomas
const localizedTexts = {
  title: {
    pt: 'Selecione seu idioma',
    en: 'Select your language',
    es: 'Seleccione su idioma'
  },
  subtitle: {
    pt: 'Escolha o idioma da interface do sistema',
    en: 'Choose the system interface language',
    es: 'Elija el idioma de la interfaz del sistema'
  },
  continue: {
    pt: 'Continuar',
    en: 'Continue',
    es: 'Continuar'
  },
  savePreference: {
    pt: 'Idioma configurado',
    en: 'Language configured',
    es: 'Idioma configurado'
  },
  culture: {
    pt: 'Suporte',
    en: 'Support',
    es: 'Soporte'
  }
};

const LanguageSelectPage = () => {
  const navigate = useNavigate();
  const { language, setLanguage, updateUserLanguage } = useLanguage();
  const { user } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState<'pt' | 'en' | 'es'>(language);
  const [isPageVisible, setIsPageVisible] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [titleKey, setTitleKey] = useState(0); // Chave para forçar animação do título
  const [particles, setParticles] = useState<Array<{x: number, y: number, size: number, speed: number, color: string}>>([]);
  const [currentIconIndex, setCurrentIconIndex] = useState(0);
  const [isRedirecting, setIsRedirecting] = useState(false); // Novo estado para controlar redirecionamento
  
  const languageIcons = [
    <Globe className={`w-8 h-8 transition-colors duration-700`} key="globe" />,
    <Languages className="w-8 h-8" key="languages" />,
    <MessageSquare className="w-8 h-8" key="message" />,
    <Speech className="w-8 h-8" key="speech" />
  ];

  // Efeito para animar a entrada da página
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageVisible(true);
    }, 300);

    return () => clearTimeout(timer);
  }, []);
  
  // Alternar ícones a cada 2 segundos
  useEffect(() => {
    const iconTimer = setInterval(() => {
      setCurrentIconIndex((prevIndex) => (prevIndex + 1) % languageIcons.length);
    }, 2000);
    
    return () => clearInterval(iconTimer);
  }, []);

  // Gerar partículas luminosas
  useEffect(() => {
    const selectedLang = languages.find(l => l.code === selectedLanguage);
    const color = selectedLang?.particleColor || 'rgba(255, 255, 255, 0.5)';
    
    // Gerar partículas aleatórias
    const newParticles = Array.from({ length: 50 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 0.2 + 0.1,
      color
    }));
    
    setParticles(newParticles);
    
    // Animar partículas
    const interval = setInterval(() => {
      setParticles(prevParticles => 
        prevParticles.map(p => ({
          ...p,
          y: (p.y - p.speed) % 100, // Mover para cima e voltar quando sair da tela
          x: p.x + (Math.random() - 0.5) * 0.2, // Pequeno movimento horizontal aleatório
        }))
      );
    }, 50);
    
    return () => clearInterval(interval);
  }, [selectedLanguage]);

  const handleLanguageSelect = (lang: 'pt' | 'en' | 'es') => {
    if (lang !== selectedLanguage) {
      setSelectedLanguage(lang);
      setTitleKey(prev => prev + 1); // Mudar a chave para acionar a animação
    }
  };

  const handleContinue = () => {
    // Evitar múltiplos cliques
    if (isRedirecting) return;
    setIsRedirecting(true);
    
    // Atualizar o idioma global
    setLanguage(selectedLanguage);
    
    // Salvar o idioma associado à conta do usuário se estiver logado
    if (user && user.id) {
      // Salvar o idioma associado à conta do usuário
      updateUserLanguage(user.id, selectedLanguage);
      
      // Marcar explicitamente que este usuário já selecionou um idioma
      localStorage.setItem(`user-language-${user.id}`, selectedLanguage);
      localStorage.setItem('app-language', selectedLanguage);
      
      // Também salvar no sessionStorage para garantir persistência durante o redirecionamento
      sessionStorage.setItem(`user-selected-language`, selectedLanguage);
      
      // Flag crítica para evitar loops de redirecionamento
      sessionStorage.setItem('language-selection-completed', 'true');
      sessionStorage.setItem('redirecting-from-language-select', 'true');

      // Log para debug
      console.log('Redirecionando após seleção de idioma', { 
        usuário: user.id,
        idioma: selectedLanguage, 
        tempoDeRedirecionamento: new Date().toISOString()
      });
      
      // Usar navigate para redirecionamento sem delay
        navigate('/', { replace: true });
    } else {
      // Se não estiver logado, salvar apenas no localStorage
      localStorage.setItem('app-language', selectedLanguage);
      
      // Redirecionar para a página de autenticação sem delay
        navigate('/auth', { replace: true });
    }
  };

  // Variantes de animação para o título
  const textVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: 20, transition: { duration: 0.3 } }
  };

  // Cor de fundo baseada no idioma selecionado
  const getBackgroundStyle = () => {
    const lang = languages.find(l => l.code === selectedLanguage);
    return `bg-gradient-to-br ${lang?.color} opacity-5`;
  };

  // Obter o idioma selecionado
  const selectedLang = languages.find(l => l.code === selectedLanguage);

  return (
    <div className="fixed inset-0 flex flex-col bg-black backdrop-blur-sm">
      {/* Partículas de fundo */}
      <div className="absolute inset-0 overflow-hidden">
        {particles.map((particle, i) => (
          <div 
            key={i} 
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              backgroundColor: particle.color,
              boxShadow: `0 0 ${particle.size * 3}px ${particle.color}`,
              opacity: Math.random() * 0.5 + 0.3
            }}
          />
        ))}
      </div>
      
      {/* Efeito de fundo dinâmico baseado no idioma selecionado */}
      <div className={`absolute inset-0 transition-opacity duration-700 ${getBackgroundStyle()}`} />
      
      {/* Efeito de reflexo na parte superior */}
      <div className={`absolute top-0 left-0 right-0 h-32 ${selectedLang?.highlightColor || 'bg-slate-800/10'} blur-3xl transform -translate-y-1/2 transition-all duration-700`} />

      {/* Conteúdo principal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isPageVisible ? 1 : 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col h-full z-10"
      >
        {/* Cabeçalho */}
        <header className="pt-8 pb-4 px-6 md:px-10 flex flex-col items-center">
          <div className="flex items-center justify-center mb-6">
            <div className={`flex items-center justify-center w-16 h-16 rounded-full bg-opacity-20 
              ring-4 ${selectedLang?.shadowColor || 'shadow-indigo-500/20'} transition-all duration-700
              ${selectedLanguage === 'pt' ? 'bg-green-500/20 ring-green-500/30' : 
                selectedLanguage === 'en' ? 'bg-blue-500/20 ring-blue-500/30' : 
                'bg-orange-500/20 ring-orange-500/30'}`}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIconIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className={`${selectedLanguage === 'pt' ? 'text-green-400' : 
                    selectedLanguage === 'en' ? 'text-blue-400' : 
                    'text-orange-400'} 
                  transition-colors duration-700`}
                >
                  {languageIcons[currentIconIndex]}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          
          <AnimatePresence mode="sync">
            <motion.h1 
              key={`title-${titleKey}`}
              className="text-3xl md:text-4xl font-bold text-center text-white mb-3"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={textVariants}
            >
              {localizedTexts.title[selectedLanguage]}
            </motion.h1>
          </AnimatePresence>
          
          <AnimatePresence mode="sync">
            <motion.p 
              key={`subtitle-${titleKey}`}
              className="text-center text-white/60 max-w-md mx-auto text-lg"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={textVariants}
            >
              {localizedTexts.subtitle[selectedLanguage]}
            </motion.p>
          </AnimatePresence>
        </header>
        
        {/* Conteúdo central com as opções de idioma */}
        <div className="flex-1 overflow-hidden flex items-center justify-center px-4 py-6 z-10">
          <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {languages.map((lang, idx) => (
              <motion.div
                key={lang.code}
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: isPageVisible ? 1 : 0, 
                  y: isPageVisible ? 0 : 20,
                  scale: selectedLanguage === lang.code ? 1.05 : 1
                }}
                transition={{ 
                  duration: 0.5, 
                  delay: idx * 0.1,
                  ease: "easeOut"
                }}
                className="relative"
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                <motion.div
                  onClick={() => handleLanguageSelect(lang.code as 'pt' | 'en' | 'es')}
                  className={`w-full rounded-xl overflow-hidden transition-all duration-300 cursor-pointer h-full backdrop-blur-sm
                    ${selectedLanguage === lang.code 
                      ? `ring-4 ${lang.code === 'pt' ? 'ring-green-500' : lang.code === 'en' ? 'ring-blue-500' : 'ring-orange-500'} 
                         ${lang.shadowColor} bg-black/40` 
                      : 'ring-1 ring-white/10 bg-black/30 hover:bg-black/40'}`}
                  whileHover={{ y: -5 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Fundo gradiente dinâmico */}
                  <div className={`absolute inset-0 opacity-10 transition-opacity duration-300
                    ${selectedLanguage === lang.code ? 'opacity-20' : hoverIdx === idx ? 'opacity-15' : 'opacity-5'}
                    bg-gradient-to-br ${lang.color}`}
                  />
                  
                  {/* Imagem de bandeira */}
                  <div className="relative w-full aspect-video overflow-hidden">
                    <img 
                      src={lang.flag} 
                      alt={lang.name} 
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Overlay com gradiente */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    
                    {/* Efeito de brilho no topo da bandeira quando selecionada */}
                    {selectedLanguage === lang.code && (
                      <motion.div 
                        className={`absolute inset-x-0 top-0 h-16 ${lang.highlightColor} blur-md`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
                      />
                    )}
                    
                    {/* Ícone de seleção */}
                    {selectedLanguage === lang.code && (
                      <motion.div 
                        className={`absolute top-3 right-3 w-8 h-8 
                          ${lang.code === 'pt' ? 'bg-green-600' : 
                            lang.code === 'en' ? 'bg-blue-600' : 
                            'bg-orange-600'} 
                          rounded-full flex items-center justify-center 
                          ${lang.code === 'pt' ? 'shadow-lg shadow-green-600/50' : 
                            lang.code === 'en' ? 'shadow-lg shadow-blue-600/50' : 
                            'shadow-lg shadow-orange-600/50'}`}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      >
                        <Check className="w-5 h-5 text-white" />
                      </motion.div>
                    )}
                  </div>
                  
                  {/* Informações do idioma */}
                  <div className="p-4">
                    <h3 className="text-xl font-semibold text-white mb-1">
                      {lang.name}
                    </h3>
                    <p className="text-sm text-white/70 mb-2">
                      {lang.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs text-white/50">
                      <span className="px-2 py-1 bg-white/5 rounded-full border border-white/10 flex items-center gap-1.5">
                        {typeof lang.icon === 'string' ? lang.icon : lang.icon} 
                        <span>{lang.culturalNote}</span>
                      </span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
        
        {/* Rodapé com botão de continuar */}
        <footer className="py-6 px-4 md:px-10 z-10">
          <div className="w-full max-w-4xl mx-auto">
            <motion.button
              onClick={handleContinue}
              className={`w-full py-4 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-all
                shadow-lg border backdrop-blur-sm
                ${selectedLanguage === 'pt' 
                  ? 'bg-gradient-to-r from-green-600/80 to-yellow-600/80 hover:from-green-500/80 hover:to-yellow-500/80 shadow-green-600/20 border-green-500/50' 
                  : selectedLanguage === 'en'
                  ? 'bg-gradient-to-r from-blue-600/80 to-indigo-600/80 hover:from-blue-500/80 hover:to-indigo-500/80 shadow-blue-600/20 border-blue-500/50'
                  : 'bg-gradient-to-r from-orange-600/80 to-amber-600/80 hover:from-orange-500/80 hover:to-amber-500/80 shadow-orange-600/20 border-orange-500/50'
                }`}
              whileHover={{ 
                scale: 1.02,
                boxShadow: `0 0 25px ${
                  selectedLanguage === 'pt' ? 'rgba(22, 163, 74, 0.4)' : 
                  selectedLanguage === 'en' ? 'rgba(37, 99, 235, 0.4)' : 
                  'rgba(234, 88, 12, 0.4)'
                }`
              }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-lg">{localizedTexts.continue[selectedLanguage]}</span>
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>
        </footer>
      </motion.div>
    </div>
  );
};

export default LanguageSelectPage; 