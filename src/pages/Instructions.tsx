import { useEffect, useState, useRef, useCallback } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  ChevronRight, 
  PlayCircle, 
  BarChart3, 
  Briefcase, 
  Clock, 
  ArrowDownRight, 
  ArrowUpRight,
  BookOpen,
  Timer,
  Zap,
  ExternalLink,
  Compass
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { VideoPlayer } from "@/components/ui/video-player";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from '@/contexts/LanguageContext';
import { traderLinkService } from "@/services/traderLinkService";
import { saveClickEvent } from "@/lib/admin-api";

const Instructions = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const scrollPositionRef = useRef<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const finalSectionRef = useRef<HTMLDivElement>(null);
  const { language, t } = useLanguage();
  const { t: translatedT } = useTranslation();
  const [traderLink, setTraderLink] = useState<string>('');

  // Scroll para o topo quando a página for carregada
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Carregar o link do trader no início
  useEffect(() => {
    const loadTraderLink = async () => {
      try {
        const link = await traderLinkService.getCurrentTraderLink();
        // Link do trader (silenciado)
        setTraderLink(link);
      } catch (error) {
        console.error('❌ Instructions - Erro ao carregar link do trader:', error);
        // Em caso de erro, manter o link padrão
        setTraderLink('https://trade.avalonbroker.io/register?aff=385853&aff_model=revenue&afftrack=mesnagensfree');
      }
    };
    
    loadTraderLink();
  }, []);

  // Substituir a função existente ou criar nova para abrir o link do trader
  const openTraderLink = useCallback(() => {
    saveClickEvent('instructions');
    if (!traderLink) {
      window.open('https://trade.avalonbroker.io/register?aff=385853&aff_model=revenue&afftrack=mesnagensfree', '_blank');
      return;
    }
    window.open(traderLink, '_blank');
  }, [traderLink]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { 
      y: 0, 
      opacity: 1,
      transition: {
        type: "spring",
        damping: 15
      }
    }
  };

  // Variantes para animação de transição entre seções - modificadas para serem mais suaves
  const sectionVariants = {
    hidden: { 
      opacity: 0, 
      x: 10,
      height: "auto"
    },
    visible: { 
      opacity: 1, 
      x: 0,
      height: "auto",
      transition: { 
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1]
      }
    },
    exit: { 
      opacity: 0, 
      x: -10,
      height: "auto",
      transition: { 
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  };

  // Função para alternar entre seções, com smooth scroll
  const toggleSection = (section: string) => {
    // Se já está ativa, fechar (toggle)
    if (activeSection === section) {
      setActiveSection(null);
      return;
    }
    
    // Salvar a posição atual de scroll
    scrollPositionRef.current = window.scrollY;
    
    // Ativar a seção
      setActiveSection(section);
      
    // Scroll suave para o conteúdo após um breve delay para permitir a renderização
      setTimeout(() => {
      if (contentRef.current) {
        const rect = contentRef.current.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetY = rect.top + scrollTop - 100; // 100px de offset para melhor visualização
        
        window.scrollTo({
          top: targetY,
          behavior: "smooth"
        });
      }
      }, 50);
  };

  // Função para scroll suave para a seção final
  const scrollToFinalSection = () => {
    console.log('Tentando fazer scroll para seção final...');
    
    setTimeout(() => {
      let targetElement: HTMLElement | null = finalSectionRef.current;
      
      // Fallback usando getElementById se a ref não funcionar
      if (!targetElement) {
        targetElement = document.getElementById('final-section');
        console.log('Usando fallback getElementById');
      }
      
      if (targetElement) {
        console.log('Elemento encontrado, fazendo scroll...');
        const rect = targetElement.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetY = rect.top + scrollTop - 80; // 80px de offset para melhor visualização
        
        console.log('Posição atual:', scrollTop, 'Posição alvo:', targetY);
        
        window.scrollTo({
          top: targetY,
          behavior: "smooth"
        });
      } else {
        console.log('Elemento não encontrado nem por ref nem por ID!');
      }
    }, 100); // Pequeno delay para garantir renderização
  };

  return (
    <Layout>
      {/* Elementos visuais sutis de fundo */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] right-[10%] w-[35vw] h-[35vw] rounded-full bg-gradient-to-br from-blue-600/5 to-indigo-900/5 blur-[120px]" />
        <div className="absolute bottom-[20%] left-[5%] w-[25vw] h-[25vw] rounded-full bg-gradient-to-br from-sky-500/5 to-emerald-600/5 blur-[100px]" />
        <div className="absolute top-[40%] left-[35%] w-[15vw] h-[15vw] rounded-full bg-gradient-to-br from-amber-500/5 to-red-500/5 blur-[80px]" />
        </div>
        
      <div className="max-w-screen-lg mx-auto px-4 pb-20 relative z-1 overflow-visible">
        {/* Cabeçalho */}
        <motion.div 
          className="flex justify-between items-center mb-6 pt-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('instructions.title')}</h1>
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="text-white/70 hover:text-white hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> 
            {t('instructions.back')}
          </Button>
        </motion.div>

        {/* Vídeo Principal */}
        <motion.div 
          className="mb-12 rounded-xl shadow-[0_5px_30px_rgba(0,0,0,0.25)] overflow-visible"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="relative pb-4 overflow-visible">
            <div className="overflow-visible">
              <VideoPlayer
                videoKey="video.main"
                posterKey="video.poster.instructions"
                className="w-full"
                controls={true}
              />
            </div>
          </div>
        </motion.div>

        {/* Menu de navegação */}
        <motion.div 
          className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-4"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.button
            className={`group flex items-center p-5 rounded-xl ${activeSection === 'intro' ? 'bg-gradient-to-br from-slate-900/30 to-slate-800/10' : 'bg-white/5 hover:bg-white/10'} border border-white/10 backdrop-blur-sm transition-all duration-300`}
            variants={item}
            onClick={() => toggleSection('intro')}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-300">
              <BookOpen className="h-5 w-5 text-white/70" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-medium text-white">{t('instructions.intro.title')}</h3>
              <p className="text-sm text-white/60">{t('instructions.intro.subtitle')}</p>
            </div>
          </motion.button>

          <motion.button
            className={`group flex items-center p-5 rounded-xl ${activeSection === 'operation' ? 'bg-gradient-to-br from-emerald-950/40 to-emerald-900/20' : 'bg-white/5 hover:bg-white/10'} border border-white/10 backdrop-blur-sm transition-all duration-300`}
            variants={item}
            onClick={() => toggleSection('operation')}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-300">
              <BarChart3 className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-medium text-white">{t('instructions.operation.title')}</h3>
              <p className="text-sm text-white/60">{t('instructions.operation.subtitle')}</p>
            </div>
          </motion.button>

          <motion.button
            className={`group flex items-center p-5 rounded-xl ${activeSection === 'strategy' ? 'bg-gradient-to-br from-blue-950/25 to-slate-900/15' : 'bg-white/5 hover:bg-white/10'} border border-white/10 backdrop-blur-sm transition-all duration-300`}
            variants={item}
            onClick={() => toggleSection('strategy')}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/15 to-slate-600/10 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-300">
              <Zap className="h-5 w-5 text-blue-300/80" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-medium text-white">{t('instructions.gale.title')}</h3>
              <p className="text-sm text-white/60">{t('instructions.gale.subtitle')}</p>
            </div>
          </motion.button>
        </motion.div>

        {/* Conteúdo das seções */}
        <div className="space-y-6" ref={contentRef}>
          {/* Usando AnimatePresence para animações entre seções */}
          <AnimatePresence mode="wait">
            {/* Seção Introdução */}
            {activeSection === 'intro' && (
              <motion.div
                className="rounded-xl overflow-hidden bg-gradient-to-br from-slate-900/30 to-slate-800/10 border border-white/10 backdrop-blur-sm"
                key="intro-section"
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="p-6 md:p-8 space-y-6">
                  {/* Cabeçalho da seção */}
                  <div className="flex flex-col md:flex-row md:items-center gap-6 border-b border-white/10 pb-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-white/5 rounded-full blur-xl"></div>
                      <div className="w-16 h-16 relative rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center flex-shrink-0 border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                        <BookOpen className="h-7 w-7 text-white/70" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-white pb-1">{t('instructions.welcome.title')}</h2>
                      <p className="text-white/60">{t('instructions.welcome.subtitle')}</p>
                    </div>
                  </div>

                  {/* Descrição principal */}
                  <div className="bg-gradient-to-br from-slate-800/20 to-slate-700/5 backdrop-blur-sm p-5 rounded-lg border border-white/10">
                    <p className="text-white/70 leading-relaxed">
                      {t('instructions.intro.text1')}
                    </p>
                    <p className="text-white/70 leading-relaxed mt-4">
                      {t('instructions.intro.text2')}
                    </p>
                    <p className="text-white/70 leading-relaxed mt-4">
                      {t('instructions.intro.text3')}
                    </p>
                  </div>

                  {/* Cards com detalhes */}
                  <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <motion.div 
                      className="group"
                      whileHover={{ y: -5 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    >
                      <div className="h-full bg-gradient-to-br from-slate-800/30 via-slate-800/20 to-slate-700/10 backdrop-blur-md p-6 rounded-lg border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.12)] relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        
                        <div className="relative flex flex-col">
                          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 mb-5 border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.05)] group-hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all duration-300">
                            <Clock className="h-6 w-6 text-white/70 group-hover:text-white/80 transition-colors duration-300" />
                          </div>

                          <h3 className="text-xl font-semibold text-white/80 mb-3 group-hover:text-white transition-colors duration-300">{t('instructions.operations.3hours')}</h3>
                          
                          <p className="text-white/60 leading-relaxed group-hover:text-white/70 transition-colors duration-300">
                            {t('instructions.operations.3hours.desc')}
                          </p>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div 
                      className="group"
                      whileHover={{ y: -5 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    >
                      <div className="h-full bg-gradient-to-br from-slate-800/30 via-slate-800/20 to-slate-700/10 backdrop-blur-md p-6 rounded-lg border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.12)] relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        
                        <div className="relative flex flex-col">
                          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 mb-5 border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.05)] group-hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all duration-300">
                            <BarChart3 className="h-6 w-6 text-white/70 group-hover:text-white/80 transition-colors duration-300" />
                          </div>

                          <h3 className="text-xl font-semibold text-white/80 mb-3 group-hover:text-white transition-colors duration-300">{t('instructions.realtime.analysis')}</h3>
                          
                          <p className="text-white/60 leading-relaxed group-hover:text-white/70 transition-colors duration-300">
                            {t('instructions.realtime.analysis.desc')}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Seção Como Operar */}
            {activeSection === 'operation' && (
              <motion.div
                className="rounded-xl overflow-hidden bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border border-emerald-500/10 backdrop-blur-sm"
                key="operation-section"
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="p-6 md:p-8 space-y-6">
                  {/* Cabeçalho da seção */}
                  <div className="flex flex-col md:flex-row md:items-center gap-6 border-b border-white/10 pb-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-xl"></div>
                      <div className="w-16 h-16 relative rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 flex items-center justify-center flex-shrink-0 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                        <BarChart3 className="h-7 w-7 text-emerald-300" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-emerald-100 pb-1">{t('instructions.dominate.operations')}</h2>
                      <p className="text-white/70">{t('instructions.dominate.operations.desc')}</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {/* Primeiros passos */}
                    <div className="relative">
                      <div className="relative bg-gradient-to-br from-emerald-900/30 to-emerald-800/5 backdrop-blur-sm p-6 rounded-lg border border-emerald-500/20">
                        <h3 className="text-xl font-semibold text-emerald-200 mb-5 flex items-center">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center mr-3 border border-emerald-500/30">
                            <span className="text-sm text-emerald-300 font-medium">1</span>
                          </div>
                          {t('instructions.first.steps')}
                        </h3>
                        
                        <div className="space-y-4 ml-11">
                          <motion.div 
                            className="flex items-start gap-4 group"
                            whileHover={{ x: 5 }}
                            transition={{ type: "spring", stiffness: 200, damping: 25, duration: 0.5 }}
                          >
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center border border-emerald-500/30 mt-0.5 group-hover:shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-shadow duration-300">
                              <span className="text-sm text-emerald-400 font-medium">1</span>
                            </div>
                            <p 
                              className="text-white/80 group-hover:text-white transition-colors duration-300 cursor-pointer" 
                              onClick={() => {
                                const translation = t('instructions.register.broker');
                                if (translation && typeof translation === 'object') {
                                  const obj = translation as Record<string, unknown>;
                                  if ('link' in obj && obj.link) {
                                    window.open(String(obj.link), '_blank');
                                  }
                                }
                              }}
                            >
                              {(() => {
                                const translation = t('instructions.register.broker');
                                if (translation && typeof translation === 'object') {
                                  const obj = translation as Record<string, unknown>;
                                  if ('text' in obj) {
                                    return String(obj.text);
                                  }
                                }
                                return String(translation || '');
                              })()}
                            </p>
                          </motion.div>

                          <motion.div 
                            className="flex items-start gap-4 group"
                            whileHover={{ x: 5 }}
                            transition={{ type: "spring", stiffness: 200, damping: 25, duration: 0.5 }}
                          >
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center border border-emerald-500/30 mt-0.5 group-hover:shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-shadow duration-300">
                              <span className="text-sm text-emerald-400 font-medium">2</span>
                            </div>
                            <p className="text-white/80 group-hover:text-white transition-colors duration-300">{t('instructions.demo.account')}</p>
                          </motion.div>

                          <motion.div 
                            className="flex items-start gap-4 group"
                            whileHover={{ x: 5 }}
                            transition={{ type: "spring", stiffness: 200, damping: 25, duration: 0.5 }}
                          >
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center border border-emerald-500/30 mt-0.5 group-hover:shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-shadow duration-300">
                              <span className="text-sm text-emerald-400 font-medium">3</span>
                            </div>
                            <p className="text-white/80 group-hover:text-white transition-colors duration-300">{t('instructions.real.money')}</p>
                          </motion.div>

                          <motion.div 
                            className="flex items-start gap-4 group"
                            whileHover={{ x: 5 }}
                            transition={{ type: "spring", stiffness: 200, damping: 25, duration: 0.5 }}
                          >
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center border border-emerald-500/30 mt-0.5 group-hover:shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-shadow duration-300">
                              <span className="text-sm text-emerald-400 font-medium">4</span>
                            </div>
                            <p className="text-white/80 group-hover:text-white transition-colors duration-300">{t('instructions.chart.config')}</p>
                          </motion.div>
                        </div>
                      </div>
                    </div>

                    {/* Executando operações */}
                    <div className="relative">
                      <div className="relative bg-gradient-to-br from-emerald-900/30 to-emerald-800/5 backdrop-blur-sm p-6 rounded-lg border border-emerald-500/20">
                        <h3 className="text-xl font-semibold text-emerald-200 mb-5 flex items-center">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center mr-3 border border-emerald-500/30">
                            <span className="text-sm text-emerald-300 font-medium">2</span>
                          </div>
                          {t('instructions.executing.operations')}
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                          <motion.div 
                            className="group"
                            whileHover={{ y: -5 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15 }}
                          >
                            <div className="h-full bg-gradient-to-br from-emerald-800/40 to-emerald-900/20 p-5 rounded-lg border border-emerald-500/30 relative overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              
                              <div className="flex flex-col items-center text-center relative">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center mb-4 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-shadow duration-300">
                                  <ArrowUpRight className="h-6 w-6 text-emerald-400 group-hover:text-emerald-300 transition-colors duration-300" />
                                </div>
                                <h4 className="text-white font-medium mb-2 group-hover:text-emerald-200 transition-colors duration-300">{t('instructions.market.up')}</h4>
                                <p className="text-white/70 text-sm group-hover:text-white/80 transition-colors duration-300">{t('instructions.click.buy')}</p>
                              </div>
                            </div>
                          </motion.div>

                          <motion.div 
                            className="group"
                            whileHover={{ y: -5 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15 }}
                          >
                            <div className="h-full bg-gradient-to-br from-emerald-800/40 to-emerald-900/20 p-5 rounded-lg border border-emerald-500/30 relative overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              
                              <div className="flex flex-col items-center text-center relative">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center mb-4 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-shadow duration-300">
                                  <ArrowDownRight className="h-6 w-6 text-emerald-400 group-hover:text-emerald-300 transition-colors duration-300" />
                                </div>
                                <h4 className="text-white font-medium mb-2 group-hover:text-emerald-200 transition-colors duration-300">{t('instructions.market.down')}</h4>
                                <p className="text-white/70 text-sm group-hover:text-white/80 transition-colors duration-300">{t('instructions.click.sell')}</p>
                              </div>
                            </div>
                          </motion.div>

                          <motion.div 
                            className="group"
                            whileHover={{ y: -5 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15 }}
                          >
                            <div className="h-full bg-gradient-to-br from-emerald-800/40 to-emerald-900/20 p-5 rounded-lg border border-emerald-500/30 relative overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              
                              <div className="flex flex-col items-center text-center relative">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center mb-4 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-shadow duration-300">
                                  <Timer className="h-6 w-6 text-emerald-400 group-hover:text-emerald-300 transition-colors duration-300" />
                                </div>
                                <h4 className="text-white font-medium mb-2 group-hover:text-emerald-200 transition-colors duration-300">{t('instructions.expiration.time')}</h4>
                                <p className="text-white/70 text-sm group-hover:text-white/80 transition-colors duration-300">{t('instructions.config.candle')}</p>
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      </div>
                    </div>

                    {/* Dica profissional */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-teal-500/2 to-teal-500/5 rounded-xl blur-xl"></div>
                      <div className="relative bg-gradient-to-br from-black/40 to-black/20 rounded-xl p-6 border border-teal-500/10 backdrop-blur-sm overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500/0 via-teal-500/30 to-teal-500/0"></div>
                        
                        <div className="flex flex-col sm:flex-row items-start gap-5">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500/20 to-emerald-600/10 flex items-center justify-center flex-shrink-0 border border-teal-500/30 shadow-[0_0_10px_rgba(20,184,166,0.1)]">
                            <PlayCircle className="h-5 w-5 text-teal-400" />
                          </div>
                          
                          <div>
                            <h4 className="text-lg font-medium text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-teal-100 mb-2">{t('instructions.important.tip')}</h4>
                            <p className="text-white/70 leading-relaxed">
                              {t('instructions.follow.signals')}
                            </p>
                            
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="flex items-center gap-2 text-teal-200/60 text-sm">
                                <div className="w-1 h-1 rounded-full bg-teal-400"></div>
                                <span>{t('instructions.operate.indicated')}</span>
                              </div>
                              <div className="flex items-center gap-2 text-teal-200/60 text-sm">
                                <div className="w-1 h-1 rounded-full bg-teal-400"></div>
                                <span>{t('instructions.keep.records')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Seção Estratégia de Gale */}
            {activeSection === 'strategy' && (
              <motion.div
                className="rounded-xl overflow-hidden bg-gradient-to-br from-blue-950/25 to-slate-900/15 border border-blue-500/10 backdrop-blur-sm"
                key="strategy-section"
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="p-6 md:p-8 space-y-6">
                  {/* Cabeçalho da seção */}
                  <div className="flex flex-col md:flex-row md:items-center gap-6 border-b border-white/10 pb-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-blue-500/8 rounded-full blur-xl"></div>
                      <div className="w-16 h-16 relative rounded-full bg-gradient-to-br from-blue-500/20 to-slate-600/15 flex items-center justify-center flex-shrink-0 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.08)]">
                        <Zap className="h-7 w-7 text-blue-300/80" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-slate-200 pb-1">{t('instructions.gale.strategy.title')}</h2>
                      <p className="text-white/60">{t('instructions.gale.strategy.subtitle')}</p>
                    </div>
                  </div>

                  {/* Descrição principal */}
                  <div className="bg-gradient-to-br from-blue-900/20 to-slate-800/10 backdrop-blur-sm p-5 rounded-lg border border-blue-500/15">
                    <p className="text-white/70 leading-relaxed">
                      {t('instructions.gale.strategy.desc')}
                    </p>
                  </div>

                  {/* Representação visual do Gale */}
                  <div className="relative py-10">
                    <div className="absolute inset-0 flex items-center justify-center opacity-10">
                      <svg width="400" height="150" viewBox="0 0 400 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
                        <path d="M30,75 L120,120 L200,30 L280,120 L370,75" stroke="url(#gradientPath)" strokeWidth="3" strokeLinecap="round" fill="none"/>
                        <defs>
                          <linearGradient id="gradientPath" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3B82F6" />
                            <stop offset="50%" stopColor="#64748B" />
                            <stop offset="100%" stopColor="#3B82F6" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-1">
                      <motion.div 
                        className="group"
                        whileHover={{ y: -8 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      >
                        <div className="h-full bg-gradient-to-br from-blue-900/25 via-blue-900/15 to-slate-800/10 backdrop-blur-md p-6 rounded-lg border border-blue-500/15 shadow-[0_8px_30px_rgba(0,0,0,0.12)] relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          
                          <div className="relative flex flex-col items-center md:items-start text-center md:text-left">
                            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/15 to-slate-600/10 mb-5 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.08)] group-hover:shadow-[0_0_15px_rgba(59,130,246,0.12)] transition-all duration-300">
                              <span className="text-lg font-semibold text-blue-300/80 group-hover:text-blue-200/90 transition-colors duration-300">G1</span>
                            </div>
                            
                            <h3 className="text-xl font-semibold text-blue-200/80 mb-3 group-hover:text-white transition-colors duration-300">{t('instructions.gale1')}</h3>
                            
                            <div className="w-10 h-1 bg-gradient-to-r from-blue-500/30 to-slate-500/20 rounded-full mb-4 md:hidden"></div>
                            
                            <p className="text-white/70 leading-relaxed">
                              {t('instructions.gale1.desc')}
                            </p>

                            <div className="mt-4 pt-4 border-t border-blue-500/10 w-full">
                              <div className="flex items-center text-white/50 text-sm">
                                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400/70 to-emerald-500/70 mr-2"></div>
                                <span>{t('instructions.double.initial')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                      
                      <motion.div 
                        className="group"
                        whileHover={{ y: -8 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      >
                        <div className="h-full bg-gradient-to-br from-slate-800/25 via-blue-900/15 to-slate-700/10 backdrop-blur-md p-6 rounded-lg border border-blue-500/15 shadow-[0_8px_30px_rgba(0,0,0,0.12)] relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          
                          <div className="relative flex flex-col items-center md:items-start text-center md:text-left">
                            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-600/15 to-blue-500/10 mb-5 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.08)] group-hover:shadow-[0_0_15px_rgba(59,130,246,0.12)] transition-all duration-300">
                              <span className="text-lg font-semibold text-slate-300/80 group-hover:text-slate-200/90 transition-colors duration-300">G2</span>
                            </div>
                            
                            <h3 className="text-xl font-semibold text-slate-200/80 mb-3 group-hover:text-white transition-colors duration-300">{t('instructions.gale2')}</h3>
                            
                            <div className="w-10 h-1 bg-gradient-to-r from-slate-500/30 to-blue-500/20 rounded-full mb-4 md:hidden"></div>
                            
                            <p className="text-white/70 leading-relaxed">
                              {t('instructions.gale2.desc')}
                            </p>

                            <div className="mt-4 pt-4 border-t border-blue-500/10 w-full">
                              <div className="flex items-center text-white/50 text-sm">
                                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-amber-400/70 to-red-500/70 mr-2"></div>
                                <span>{t('instructions.double.gale1')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>

                  {/* Dica profissional com design sofisticado */}
                  <div className="mt-4 relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-slate-500/3 to-blue-500/5 rounded-xl blur-xl"></div>
                    <div className="relative bg-gradient-to-br from-black/40 to-black/20 rounded-xl p-6 border border-blue-500/10 backdrop-blur-sm overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/0 via-blue-500/20 to-blue-500/0"></div>
                      
                      <div className="flex flex-col sm:flex-row items-start gap-5">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/15 to-slate-600/10 flex items-center justify-center flex-shrink-0 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.05)]">
                          <PlayCircle className="h-5 w-5 text-blue-300/80" />
                        </div>
                        
                        <div>
                          <h4 className="text-lg font-medium text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-slate-200 mb-2">{t('instructions.risk.warning')}</h4>
                          <p className="text-white/60 leading-relaxed">
                            {t('instructions.risk.warning.desc')}
                          </p>
                          
                          <div className="mt-4 flex items-center text-white/50 text-sm">
                            <div className="w-1 h-1 rounded-full bg-blue-400/60 mr-2"></div>
                            <span>{t('instructions.trending.indicates')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Chamada para ação quando nenhuma seção está selecionada */}
          {!activeSection && (
            <motion.div 
              className="text-center py-16 px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/10 border border-white/10 mb-6"
              >
                <Compass className="h-10 w-10 text-white/40" />
              </motion.div>
              <h3 className="text-xl font-medium text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-purple-300 to-emerald-300 mb-3">{t('instructions.select.section')}</h3>
              <p className="text-white/60 max-w-md mx-auto leading-relaxed mb-8">
                {t('instructions.select.description')}
              </p>
              
              {/* Ícone para scroll para seção final */}
              <motion.button
                onClick={scrollToFinalSection}
                className="group w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 flex items-center justify-center transition-all duration-300 backdrop-blur-sm mx-auto"
                whileHover={{ y: -2, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <motion.div
                  animate={{ y: [0, 3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ChevronRight className="h-5 w-5 text-white/60 group-hover:text-white/80 rotate-90 transition-colors duration-300" />
                </motion.div>
              </motion.button>
            </motion.div>
          )}
        </div>

        {/* Informações adicionais ao final */}
        <motion.div 
          id="final-section"
          ref={finalSectionRef}
          className="mt-16 border-t border-white/10 pt-8 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <h3 className="text-xl font-semibold text-white mb-3">{t('instructions.start.now')}</h3>
          <p className="text-white/60 max-w-xl mx-auto">
            {t('instructions.platform.description')}
          </p>
          <Button 
            className="mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-6 h-auto text-lg rounded-xl shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40 transition-all duration-300"
            onClick={openTraderLink}  
          >
            {t('instructions.open.broker')}
            <ExternalLink className="h-5 w-5 ml-2" />
          </Button>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Instructions; 