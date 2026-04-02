import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { AccountLoginSection } from "@/components/settings/AccountLoginSection";
import TraderSupportSettings from "@/components/settings/TraderSupportSettings";

import { motion, AnimatePresence } from "framer-motion";
import { 
  Settings as SettingsIcon, 
  User, 
  Palette, 
  Shield, 
  HelpCircle, 
  Info, 
  Save, 
  CheckCircle2,
  Sliders,
  Wrench,
  CreditCard,
  Wallet,
  Laptop,
  Lock,
  Database,
  Mail,
  Globe,
  Clock,
  Users,
  Video,
  X,
  Music,
  Volume2,
  AlertCircle,
  DownloadCloud,
  CheckCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { LanguageSelector } from "@/components/ui/language-selector";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// Animação para cada seção
const tabVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.5,
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  },
  exit: { 
    opacity: 0, 
    y: -20,
    transition: { 
      duration: 0.3
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3 }
  }
};

// Configuração de cores para cada aba
const tabColors = {
  perfil: {
    accent: "indigo",
    bgActive: "bg-indigo-600/10",
    textActive: "text-indigo-100",
    iconColor: "text-indigo-400",
    gradientFrom: "from-indigo-500/20",
    gradientTo: "to-indigo-800/20"
  }
};

const Settings = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("perfil");
  const [showTermsModal, setShowTermsModal] = useState(false);
  
  // 🔥 Detectar aba da URL
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);
  
  // Configurações gerais
  const [autoBackup, setAutoBackup] = useState<boolean>(false);
  const [dataExport, setDataExport] = useState<boolean>(false);
  const [twoFactorAuth, setTwoFactorAuth] = useState<boolean>(false);
  const [emailAuth, setEmailAuth] = useState<boolean>(false);
  const [priceAlerts, setPriceAlerts] = useState<boolean>(false);
  
  // Carregar configurações salvas
  useEffect(() => {
    // Carregar configurações do localStorage
    try {
      const savedSettings = localStorage.getItem('app-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        
        // Atualizar estados com valores salvos
        if (settings.autoBackup !== undefined) setAutoBackup(settings.autoBackup);
        if (settings.dataExport !== undefined) setDataExport(settings.dataExport);
        if (settings.twoFactorAuth !== undefined) setTwoFactorAuth(settings.twoFactorAuth);
        if (settings.emailAuth !== undefined) setEmailAuth(settings.emailAuth);
        if (settings.priceAlerts !== undefined) setPriceAlerts(settings.priceAlerts);
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      toast.error("Erro ao carregar configurações");
    }
  }, []);
  
  // Função para salvar configurações automaticamente quando alteradas
  const handleSettingChange = (setting: string, value: boolean) => {
    try {
      // Atualizar o estado correspondente
      switch(setting) {
        case 'autoBackup':
          setAutoBackup(value);
          break;
        case 'dataExport':
          setDataExport(value);
          break;
        case 'twoFactorAuth':
          setTwoFactorAuth(value);
          break;
        case 'emailAuth':
          setEmailAuth(value);
          break;
        case 'priceAlerts':
          setPriceAlerts(value);
          break;
      }
      
      // Criar objeto com todas as configurações atualizadas
      const settings = {
        autoBackup: setting === 'autoBackup' ? value : autoBackup,
        dataExport: setting === 'dataExport' ? value : dataExport,
        twoFactorAuth: setting === 'twoFactorAuth' ? value : twoFactorAuth,
        emailAuth: setting === 'emailAuth' ? value : emailAuth,
        priceAlerts: setting === 'priceAlerts' ? value : priceAlerts
      };
      
      // Salvar no localStorage
      localStorage.setItem('app-settings', JSON.stringify(settings));
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
    }
  };
  
  const handleTabChange = (tabValue: string) => {
    setActiveTab(tabValue);
  };

  // Obter as cores da aba ativa
  const activeTabColors = tabColors[activeTab as keyof typeof tabColors];

  return (
    <Layout>
      {/* Background com gradiente mais escuro e efeitos */}
      <div className="fixed inset-0 bg-black z-[-1]">
        {/* Gradiente de fundo */}
        <div className="absolute inset-0 bg-gradient-to-bl from-slate-950 via-black to-slate-950"></div>
        
        {/* Efeito de grid */}
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] bg-center opacity-[0.02]"></div>
        
        {/* Círculos de destaque com base na aba ativa */}
        <motion.div 
          className={cn(
            "absolute top-20 left-1/4 w-[400px] h-[400px] rounded-full blur-[120px] opacity-10",
            activeTabColors?.gradientFrom || "from-indigo-600/10"
          )}
          animate={{ 
            opacity: [0.05, 0.15, 0.05],
            scale: [1, 1.1, 1],
          }}
          transition={{ 
            duration: 8, 
            repeat: Infinity,
            repeatType: "reverse" 
          }}
        />
        
        <motion.div 
          className={cn(
            "absolute bottom-10 right-1/4 w-[300px] h-[300px] rounded-full blur-[100px] opacity-10",
            activeTabColors?.gradientTo || "to-indigo-900/10"
          )}
          animate={{ 
            opacity: [0.05, 0.1, 0.05],
            scale: [1, 1.05, 1],
          }}
          transition={{ 
            duration: 6, 
            repeat: Infinity,
            repeatType: "reverse",
            delay: 1 
          }}
        />
      </div>

      {/* Container principal com sombra */}
      <div className="relative z-10 min-h-screen">
        {/* Container para o conteúdo */}
        <div className="container mx-auto px-4 py-8 space-y-8">
          {/* Cabeçalho com título animado */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col space-y-3"
          >
            <div className="relative">
              <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              {t('settings.title') || "Configurações"}
            </h1>
              <div className="absolute -bottom-1 left-0 h-[1px] w-20 bg-gradient-to-r from-indigo-500 to-indigo-500/0"></div>
          </div>
            <p className="text-slate-400 max-w-2xl">
              {t('settings.subtitle') || "Personalize sua experiência com a plataforma ajustando suas preferências e configurações"}
            </p>
          </motion.div>
          
          {/* Tabs de configurações */}
          <Tabs 
            defaultValue="perfil" 
            className="space-y-8"
            value={activeTab}
            onValueChange={(value) => handleTabChange(value)}
          >
            {/* Lista de abas com estilo mais escuro e detalhes de destaque */}
            <div className="relative w-full max-w-4xl mx-auto">
              {/* Linha destacada embaixo da lista de abas */}
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900"></div>
              
              {/* Lista de abas */}
              <TabsList className="grid grid-cols-1 w-full bg-black/20 border border-slate-800 rounded-lg p-1 h-auto">
              <TabsTrigger 
                value="perfil" 
                onClick={() => setActiveTab("perfil")}
                  className={cn(
                    "py-3 h-auto flex flex-row items-center justify-center gap-2 rounded-md transition-all",
                    "hover:bg-slate-800/30 hover:text-slate-100",
                    "data-[state=active]:shadow-sm",
                    "data-[state=active]:" + tabColors.perfil.bgActive,
                    "data-[state=active]:" + tabColors.perfil.textActive
                  )}
              >
                  <User className={cn("w-4 h-4", activeTab === "perfil" ? tabColors.perfil.iconColor : "text-slate-400")} />
                  <span className="text-sm font-medium">{t('settings.profile')}</span>
              </TabsTrigger>
            </TabsList>
            </div>

            {/* Conteúdo das tabs com animação de transição */}
            <AnimatePresence mode="wait">
              <TabsContent 
                value="perfil" 
                className="space-y-4 p-0 border-none focus-visible:outline-none focus-visible:ring-0"
                key="perfil"
              >
                  <motion.div
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                    variants={tabVariants}
                  className="space-y-6"
                >
                  <ProfileSettings />
                  
                  {/* Notificações do Trending */}
  
                  
                  {/* Seletor de idioma com design minimalista */}
                  <SettingsSection
                    title={t('settings.language')}
                    description={t('settings.language.description')}
                    icon={<Globe className="h-4 w-4 text-white/60" />}
                    minimal={true}
                  >
                    <div className="pt-1">
                      <LanguageSelector />
                    </div>
                  </SettingsSection>
                  
                  {/* Apoio ao Trader Favorito */}
                  <TraderSupportSettings />
                
                </motion.div>
              </TabsContent>
            </AnimatePresence>
          </Tabs>
          </div>
      </div>
      
      {/* Modal para termos e políticas com design mais escuro */}
      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="bg-slate-950/95 border-slate-800 backdrop-blur-xl max-w-2xl max-h-[80vh] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/5 to-black/90 z-0"></div>
          
          <DialogHeader className="relative z-10">
            <DialogTitle className="text-2xl font-light text-white/90">{t('settings.terms.title') || "Termos de Uso"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {t('settings.terms.lastUpdate') || "Última atualização: 10/10/2023"}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="mt-4 max-h-[60vh] relative z-10">
            <div className="space-y-4 text-sm text-slate-300 p-1">
              <p>
                {t('settings.terms.intro1') || "Estes termos e condições (\"Termos\") regem o uso do serviço ProfEyes (\"Serviço\") operado pela nossa empresa."}
              </p>
              <p>
                {t('settings.terms.intro2') || "Ao acessar ou usar o Serviço, você concorda em estar vinculado a estes Termos. Se você discordar de qualquer parte dos termos, você não poderá acessar o Serviço."}
              </p>
              <h4 className="text-white/90 font-medium text-base mt-6 mb-2">{t('settings.terms.section1.title') || "1. Contas"}</h4>
              <p>
                {t('settings.terms.section1.content') || "Quando você cria uma conta conosco, você garante que as informações fornecidas são precisas, completas e atualizadas. Informações imprecisas, incompletas ou desatualizadas podem resultar no encerramento imediato da sua conta no Serviço."}
              </p>
              <h4 className="text-white/90 font-medium text-base mt-6 mb-2">{t('settings.terms.section2.title') || "2. Privacidade e Proteção de Dados"}</h4>
              <p>
                {t('settings.terms.section2.content') || "Nossa Política de Privacidade explica como coletamos, usamos e protegemos as informações que você fornece ao usar nosso Serviço. Ao usar nosso Serviço, você concorda com a coleta e uso de informações de acordo com esta política."}
              </p>
              <h4 className="text-white/90 font-medium text-base mt-6 mb-2">{t('settings.terms.section2_5.title') || "2.5. Isenção de Responsabilidade"}</h4>
              <p>
                {t('settings.terms.section2_5.content') || "Trending fornece seus serviços exclusivamente nos territórios em que é licenciada. Trending não está autorizada pela Comissão de Valores Mobiliários (CVM) a oferecer diretamente serviços de distribuição de valores mobiliários a investidores residentes, domiciliados ou incorporados na República Federativa do Brasil. Nada neste site deve ser entendido como uma oferta direta de serviços endereçados a esses investidores."}
              </p>
              <h4 className="text-white/90 font-medium text-base mt-6 mb-2">{t('settings.terms.section3.title') || "3. Segurança"}</h4>
              <p>
                {t('settings.terms.section3.content') || "A segurança de sua conta é importante para nós, mas lembre-se de que nenhum método de transmissão pela Internet ou método de armazenamento eletrônico é 100% seguro. Enquanto nos esforçamos para usar meios comercialmente aceitáveis para proteger suas informações pessoais, não podemos garantir sua segurança absoluta."}
              </p>
              <h4 className="text-white/90 font-medium text-base mt-6 mb-2">{t('settings.terms.section4.title') || "4. Limitação de Responsabilidade"}</h4>
              <p>
                {t('settings.terms.section4.content') || "Em nenhum caso nossa empresa, nossos diretores, executivos, funcionários, afiliados, agentes, contratados, estagiários, fornecedores, prestadores de serviços ou licenciadores serão responsáveis por quaisquer danos diretos, indiretos, incidentais, especiais, consequenciais ou punitivos, incluindo, mas não se limitando a, perda de lucros, dados, uso, boa vontade, ou outras perdas intangíveis, resultantes do uso ou da incapacidade de usar o serviço."}
              </p>
              <h4 className="text-white/90 font-medium text-base mt-6 mb-2">{t('settings.terms.section5.title') || "5. Alterações"}</h4>
              <p>
                {t('settings.terms.section5.content') || "Reservamo-nos o direito, a nosso exclusivo critério, de modificar ou substituir estes Termos a qualquer momento. Se uma revisão for material, tentaremos fornecer um aviso com pelo menos 30 dias de antecedência antes que quaisquer novos termos entrem em vigor."}
              </p>
              <h4 className="text-white/90 font-medium text-base mt-6 mb-2">{t('settings.terms.section6.title') || "6. Contato"}</h4>
              <p>
                {t('settings.terms.section6.content') || "Se você tiver alguma dúvida sobre estes Termos, entre em contato conosco através do e-mail suporte@profeyes.com."}
              </p>
            </div>
          </ScrollArea>
          
          <div className="flex justify-end mt-4 relative z-10">
            <Button 
              onClick={() => setShowTermsModal(false)} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white border-none"
            >
              {t('settings.close') || "Fechar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Settings;