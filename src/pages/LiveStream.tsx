import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveStream } from '@/contexts/LiveStreamContext';
import { useLiveStreamPermission } from '@/components/LiveStreamPermissionProvider';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import LiveStreamCard from '@/components/LiveStreamCard';
import { PlusCircle, Calendar, Video, Users, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import { type LiveStream } from '@/contexts/LiveStreamContext';
import { type ExtendedLiveStream } from '@/types/meeting';

const LiveStreamPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canStartLive, isAdmin, isLoading } = useLiveStreamPermission();
  const { 
    streams, 
    fetchStreams, 
    createStream,
    isLoadingStreams,
    verificarTabelas 
  } = useLiveStream();

  // Estados do componente
  const [activeTab, setActiveTab] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [currentStream, setCurrentStream] = useState<ExtendedLiveStream | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Estados do formulário de criação
  const [newStreamTitle, setNewStreamTitle] = useState('');
  const [newStreamDescription, setNewStreamDescription] = useState('');
  const [newStreamCategory, setNewStreamCategory] = useState('crypto');
  const [newStreamTags, setNewStreamTags] = useState('');
  const [newStreamLanguage, setNewStreamLanguage] = useState('pt');

  const isDebugUser = isAdmin;
  
  // Carregar transmissões ao iniciar o componente
  useEffect(() => {
    loadStreams();
    // Verificar se as tabelas existem
    verificarTabelas().then(result => {
      if (!result.success) {
        console.error('Erro ao verificar tabelas:', result.error);
        toast.error('Erro ao conectar com o banco de dados');
      }
    });
  }, []);
  
  // Função para carregar as transmissões
  const loadStreams = async () => {
    try {
      setIsRefreshing(true);
      await fetchStreams();
      } catch (error) {
      console.error('Erro ao carregar transmissões:', error);
      toast.error('Erro ao carregar transmissões');
      } finally {
      setIsRefreshing(false);
    }
  };
  
  // Função para criar uma nova transmissão
  const handleCreateStream = async () => {
    if (!newStreamTitle.trim()) {
      toast.error('O título é obrigatório');
      return;
    }
    
    // Timeout de segurança para garantir que o estado seja resetado
    const safetyTimeout = setTimeout(() => {
      console.warn('Timeout de segurança ativado - resetando estado de criação');
      setIsCreating(false);
    }, 30000); // 30 segundos
    
    try {
      setIsCreating(true);
      
      // Preparar dados da nova transmissão
      const newStreamData = {
        title: newStreamTitle,
        description: newStreamDescription,
        category: newStreamCategory,
        tags: newStreamTags.split(',').map(tag => tag.trim()).filter(Boolean),
        language: newStreamLanguage,
        status: "scheduled" as "scheduled" | "live" | "ended",
        // Usar propriedades compatíveis com o tipo do contexto
        webcamEnabled: true,
        screenShareEnabled: false,
        streamSettings: {
          hostName: user?.user_metadata?.full_name || user?.email || "",
          hostAvatar: user?.user_metadata?.avatar_url,
          chatEnabled: true
        }
      };
      
      console.log('Criando nova transmissão:', newStreamData);
      
      // Criar transmissão
      const newStream = await createStream(newStreamData);
      
      if (newStream) {
        toast.success('Transmissão criada com sucesso!');
        setShowCreateDialog(false);
        resetCreateForm();
        
        // Perguntar se deseja iniciar a transmissão agora
        const startNow = window.confirm('Deseja iniciar a transmissão agora?');
        if (startNow) {
          // Redirecionar para o dashboard do streamer
          navigate(`/profile/${newStream.id}`);
        }
      } else {
        toast.error('Erro ao criar transmissão');
      }
    } catch (error) {
      console.error('Erro ao criar transmissão:', error);
      toast.error('Erro ao criar transmissão');
    } finally {
      clearTimeout(safetyTimeout);
      setIsCreating(false);
    }
  };
  
  // Resetar formulário de criação
  const resetCreateForm = () => {
    setNewStreamTitle('');
    setNewStreamDescription('');
    setNewStreamCategory('crypto');
    setNewStreamTags('');
    setNewStreamLanguage('pt');
  };
  
  // Abrir uma transmissão
  const handleOpenStream = (stream: ExtendedLiveStream) => {
    setCurrentStream(stream);
    navigate(`/meeting/${stream.id}`);
  };
  
  // Filtrar streams com base na aba ativa
  const filteredStreams = streams.filter(stream => {
    if (activeTab === 'all') return true;
    if (activeTab === 'live') return stream.status === 'live';
    if (activeTab === 'scheduled') return stream.status === 'scheduled';
    if (activeTab === 'ended') return stream.status === 'ended';
    if (activeTab === 'my') return stream.userId === user?.id;
        return true;
  });

  return (
    <Layout>
      {/* Hero section com fundo gradiente e animações */}
      <div className="relative overflow-hidden bg-black border-b border-gray-900 min-h-[40vh] flex items-center">
        {/* Animação de partículas de fundo */}
        <div className="absolute inset-0">
          <div className="particle-lg particle-1"></div>
          <div className="particle-lg particle-2"></div>
          <div className="particle-lg particle-3"></div>
        </div>
        
        {/* Overlay de textura */}
        <div className="absolute inset-0 opacity-5 z-0" style={{ 
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` 
        }}></div>
        
        {/* Conteúdo do Hero */}
        <div className="container mx-auto px-4 py-16 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="max-w-3xl"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white leading-tight">
              Transmissões <span className="relative inline-block">
                ao Vivo
                <span className="absolute -bottom-1 left-0 w-full h-1 bg-gray-800 rounded-full"></span>
              </span>
            </h1>
            <p className="text-gray-400 text-lg md:text-xl mb-8 leading-relaxed max-w-2xl">
              Compartilhe seu conhecimento, interaja em tempo real e aprenda com especialistas do mercado financeiro em um ambiente imersivo.
            </p>
            
            <div className="flex flex-wrap gap-4">
              {(canStartLive || isAdmin) && (
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button 
                    onClick={() => setShowCreateDialog(true)}
                    size="lg"
                    className="bg-black hover:bg-gray-900 border border-gray-800 shadow-lg hover:shadow-gray-900/20 transition-all duration-300 text-white"
                  >
                    <PlusCircle className="h-5 w-5 mr-2" />
                    Criar Transmissão
                  </Button>
                </motion.div>
              )}
              
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  variant="outline" 
                  size="lg"
                  onClick={loadStreams}
                  disabled={isRefreshing}
                  className="bg-black border-gray-800 text-gray-300 hover:bg-gray-900 hover:text-white hover:border-gray-700"
                >
                  <RefreshCw className={`h-5 w-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Atualizar Lista
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
        
        {/* Elementos decorativos */}
        <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-black to-transparent"></div>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-gray-900/10 rounded-full blur-3xl"></div>
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-gray-900/10 rounded-full blur-3xl"></div>
      </div>
      
      <div className="bg-black min-h-screen pb-20">
        <div className="container mx-auto px-4 pt-10">
          {/* Painel de Debug para usuário específico */}
          {isDebugUser && (
            <div className="mb-8 p-4 bg-red-900 border border-red-700 rounded-lg">
              <h3 className="text-red-200 font-bold mb-2">🔧 DEBUG - Informações de Permissão</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-red-300">Usuário ID: {user?.id}</p>
                  <p className="text-red-300">Email: {user?.email}</p>
                  <p className="text-red-300">Carregando: {isLoading ? 'SIM' : 'NÃO'}</p>
                </div>
                <div>
                  <p className="text-red-300">Pode Iniciar Live: <span className={canStartLive ? 'text-green-400' : 'text-red-400'}>{canStartLive ? 'SIM' : 'NÃO'}</span></p>
                  <p className="text-red-300">É Admin: <span className={isAdmin ? 'text-green-400' : 'text-red-400'}>{isAdmin ? 'SIM' : 'NÃO'}</span></p>
                  <p className="text-red-300">Metadados: {JSON.stringify(user?.user_metadata || {})}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button 
                  onClick={() => window.location.reload()}
                  className="px-3 py-1 bg-red-700 text-red-200 rounded text-xs hover:bg-red-600"
                >
                  🔄 Recarregar Página
                </button>
                <button 
                  onClick={() => {
                    console.log('DEBUG Permissões:', { canStartLive, isAdmin, isLoading, userId: user?.id, email: user?.email });
                    alert(`Debug Permissões:\nPode criar live: ${canStartLive}\nÉ admin: ${isAdmin}\nCarregando: ${isLoading}\nID: ${user?.id}\nEmail: ${user?.email}`);
                  }}
                  className="px-3 py-1 bg-red-700 text-red-200 rounded text-xs hover:bg-red-600"
                >
                  📋 Ver Debug Atual
                </button>
              </div>
            </div>
          )}
          
          <Tabs 
            defaultValue="all" 
            value={activeTab} 
            onValueChange={setActiveTab} 
            className="mb-8"
          >
            <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="bg-black p-1.5 rounded-xl backdrop-blur-sm border border-gray-900 shadow-xl">
                <TabsList className="bg-black/90 backdrop-blur-md p-1 rounded-lg">
                  <TabsTrigger 
                    value="all"
                    className="data-[state=active]:bg-gray-900 data-[state=active]:text-white text-gray-400 rounded-md transition-all duration-200 px-4"
                  >
                    Todas
                  </TabsTrigger>
                  <TabsTrigger 
                    value="live"
                    className="data-[state=active]:bg-gray-900 data-[state=active]:text-white text-gray-400 rounded-md transition-all duration-200 px-4"
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Ao Vivo
                  </TabsTrigger>
                  <TabsTrigger 
                    value="scheduled"
                    className="data-[state=active]:bg-gray-900 data-[state=active]:text-white text-gray-400 rounded-md transition-all duration-200 px-4"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Agendadas
                  </TabsTrigger>
                  <TabsTrigger 
                    value="ended"
                    className="data-[state=active]:bg-gray-900 data-[state=active]:text-white text-gray-400 rounded-md transition-all duration-200 px-4"
                  >
                    Encerradas
                  </TabsTrigger>
                  <TabsTrigger 
                    value="my"
                    className="data-[state=active]:bg-gray-900 data-[state=active]:text-white text-gray-400 rounded-md transition-all duration-200 px-4"
                  >
                    Minhas
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <div className="md:flex gap-2 hidden">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadStreams}
                  disabled={isRefreshing}
                  className="bg-black border-gray-800 text-gray-300 hover:bg-gray-900 hover:text-white hover:border-gray-700"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              
                {(canStartLive || isAdmin) && (
                  <Button 
                    onClick={() => setShowCreateDialog(true)}
                    size="sm"
                    className="bg-black hover:bg-gray-900 border border-gray-800 text-white"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Nova Transmissão
                  </Button>
                )}
              </div>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-black backdrop-blur-md border border-gray-900 rounded-xl p-6 shadow-xl"
            >
              <TabsContent value="all" className="mt-4">
                <h2 className="text-xl font-medium mb-6 text-gray-200 flex items-center">
                  <span className="inline-block w-1 h-5 bg-gray-800 mr-3 rounded-full"></span>
                  Todas as Transmissões
                </h2>
                {renderStreamsList(filteredStreams as unknown as ExtendedLiveStream[], isLoadingStreams)}
              </TabsContent>
              
              <TabsContent value="live" className="mt-4">
                <h2 className="text-xl font-medium mb-6 text-gray-200 flex items-center">
                  <span className="inline-block w-1 h-5 bg-gray-800 mr-3 rounded-full"></span>
                  Transmissões ao Vivo
                </h2>
                {renderStreamsList(filteredStreams as unknown as ExtendedLiveStream[], isLoadingStreams)}
              </TabsContent>
              
              <TabsContent value="scheduled" className="mt-4">
                <h2 className="text-xl font-medium mb-6 text-gray-200 flex items-center">
                  <span className="inline-block w-1 h-5 bg-gray-800 mr-3 rounded-full"></span>
                  Transmissões Agendadas
                </h2>
                {renderStreamsList(filteredStreams as unknown as ExtendedLiveStream[], isLoadingStreams)}
              </TabsContent>
              
              <TabsContent value="ended" className="mt-4">
                <h2 className="text-xl font-medium mb-6 text-gray-200 flex items-center">
                  <span className="inline-block w-1 h-5 bg-gray-800 mr-3 rounded-full"></span>
                  Transmissões Encerradas
                </h2>
                {renderStreamsList(filteredStreams as unknown as ExtendedLiveStream[], isLoadingStreams)}
              </TabsContent>
              
              <TabsContent value="my" className="mt-4">
                <h2 className="text-xl font-medium mb-6 text-gray-200 flex items-center">
                  <span className="inline-block w-1 h-5 bg-gray-800 mr-3 rounded-full"></span>
                  Minhas Transmissões
                </h2>
                {renderStreamsList(filteredStreams as unknown as ExtendedLiveStream[], isLoadingStreams)}
              </TabsContent>
            </motion.div>
          </Tabs>
        </div>
      </div>

      {/* Dialog de criação de transmissão */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-black border border-gray-900 shadow-2xl">
          <DialogHeader className="border-b border-gray-900 pb-4">
            <div className="relative">
              <div className="absolute -top-10 -left-10 w-32 h-32 bg-gradient-to-br from-blue-600/20 to-indigo-700/20 rounded-full opacity-80 blur-xl"></div>
              <DialogTitle className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-gray-400 relative z-10">
                Criar Nova Transmissão
              </DialogTitle>
              <p className="text-gray-400 mt-2 text-sm">
                Preencha os detalhes abaixo para configurar sua transmissão ao vivo
              </p>
            </div>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
            {/* Coluna principal com formulário */}
            <div className="space-y-5">
              <div className="space-y-3">
                <Label htmlFor="title" className="text-base font-medium text-gray-300">Título da transmissão</Label>
                <Input
                  id="title"
                  value={newStreamTitle}
                  onChange={(e) => setNewStreamTitle(e.target.value)}
                  placeholder="Ex: Análise de mercado diária"
                  className="h-11 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-gray-400/30"
                />
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="description" className="text-base font-medium text-gray-300">Descrição detalhada</Label>
                <Textarea
                  id="description"
                  value={newStreamDescription}
                  onChange={(e) => setNewStreamDescription(e.target.value)}
                  placeholder="Descreva o conteúdo da sua transmissão, tópicos que serão abordados, etc."
                  rows={4}
                  className="resize-none bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-gray-400/30"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label htmlFor="category" className="text-base font-medium text-gray-300">Categoria</Label>
                  <Select value={newStreamCategory} onValueChange={setNewStreamCategory}>
                    <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white focus:ring-gray-400/30">
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      <SelectItem value="crypto" className="focus:bg-gray-700">📊 Criptomoedas</SelectItem>
                      <SelectItem value="stocks" className="focus:bg-gray-700">📈 Ações</SelectItem>
                      <SelectItem value="forex" className="focus:bg-gray-700">💱 Forex</SelectItem>
                      <SelectItem value="technical" className="focus:bg-gray-700">📉 Análise Técnica</SelectItem>
                      <SelectItem value="fundamental" className="focus:bg-gray-700">🔍 Análise Fundamental</SelectItem>
                      <SelectItem value="education" className="focus:bg-gray-700">🎓 Educacional</SelectItem>
                      <SelectItem value="news" className="focus:bg-gray-700">📰 Notícias</SelectItem>
                      <SelectItem value="discussion" className="focus:bg-gray-700">💬 Discussão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-3">
                  <Label htmlFor="language" className="text-base font-medium text-gray-300">Idioma</Label>
                  <Select value={newStreamLanguage} onValueChange={setNewStreamLanguage}>
                    <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white focus:ring-gray-400/30">
                      <SelectValue placeholder="Selecione um idioma" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      <SelectItem value="pt" className="focus:bg-gray-700">🇧🇷 Português</SelectItem>
                      <SelectItem value="en" className="focus:bg-gray-700">🇺🇸 Inglês</SelectItem>
                      <SelectItem value="es" className="focus:bg-gray-700">🇪🇸 Espanhol</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="tags" className="text-base font-medium text-gray-300">Tags</Label>
                <Input
                  id="tags"
                  value={newStreamTags}
                  onChange={(e) => setNewStreamTags(e.target.value)}
                  placeholder="cripto, bitcoin, análise (separadas por vírgula)"
                  className="h-11 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-gray-400/30"
                />
                <p className="text-xs text-gray-500">Tags ajudam as pessoas a encontrar sua transmissão mais facilmente</p>
              </div>
            </div>
            
            {/* Coluna de visualização prévia */}
            <div className="space-y-5 border-l border-gray-800 pl-6 md:block hidden">
              <h3 className="font-medium text-lg text-gray-200">Visualização da transmissão</h3>
              
              <div className="rounded-lg overflow-hidden border border-gray-800 bg-black/40 shadow-xl">
                <div className="aspect-video bg-gradient-to-tr from-gray-900 to-gray-800 relative">
                  {/* Efeito de partículas animadas */}
                  <div className="absolute inset-0 overflow-hidden opacity-30">
                    <div className="particle particle-1"></div>
                    <div className="particle particle-2"></div>
                    <div className="particle particle-3"></div>
                  </div>
                  
                  {/* Miniaturas de câmera ou placeholder */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {newStreamTitle ? (
                      <motion.div 
                        className="text-center px-6"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <h3 className="text-xl font-bold text-white">{newStreamTitle}</h3>
                        {newStreamDescription && (
                          <p className="text-sm text-white/70 mt-2 line-clamp-2">{newStreamDescription}</p>
                        )}
                      </motion.div>
                    ) : (
                      <div className="text-center">
                        <Video className="h-12 w-12 mx-auto text-white/20 animate-pulse" />
                        <p className="text-white/40 mt-2">Preview da transmissão</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Tag de categoria */}
                  {newStreamCategory && (
                    <div className="absolute top-3 left-3">
                      <Badge 
                        className="bg-black/50 hover:bg-black/50 text-white border-0"
                      >
                        {getCategoryIcon(newStreamCategory)} {newStreamCategory}
                      </Badge>
                    </div>
                  )}
                  
                  {/* Tag de idioma */}
                  {newStreamLanguage && (
                    <div className="absolute top-3 right-3">
                      <Badge 
                        className="bg-black/50 hover:bg-black/50 text-white border-0"
                      >
                        {getLanguageFlag(newStreamLanguage)} {newStreamLanguage.toUpperCase()}
                      </Badge>
                    </div>
                  )}
                </div>
                
                <div className="p-3 bg-black/50">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-gray-700">
                      <AvatarImage src={String(user?.user_metadata?.avatar_url || '')} />
                      <AvatarFallback className="bg-gradient-to-br from-gray-800 to-gray-700">{user?.email?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate">
                        {newStreamTitle || "Título da transmissão"}
                      </h3>
                      <p className="text-sm text-white/60 truncate">
                        {String(user?.user_metadata?.full_name || user?.email || "Seu nome")}
                      </p>
                    </div>
                  </div>
                  
                  {/* Tags */}
                  {newStreamTags && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {newStreamTags.split(',').map((tag, index) => 
                        tag.trim() && (
                          <span 
                            key={index}
                            className="text-xs bg-white/10 text-white/80 px-2 py-0.5 rounded"
                          >
                            #{tag.trim()}
                          </span>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="rounded-lg border border-gray-800 p-4 bg-black/20">
                <h4 className="font-medium mb-3 text-gray-300">Dicas para uma boa transmissão</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">✓</span>
                    <span className="text-gray-400">Use um título claro e descritivo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">✓</span>
                    <span className="text-gray-400">Adicione tags relevantes para melhorar a descoberta</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">✓</span>
                    <span className="text-gray-400">Certifique-se de ter uma boa conexão com a internet</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">✓</span>
                    <span className="text-gray-400">Teste seu áudio e vídeo antes de iniciar</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          <DialogFooter className="border-t border-gray-800 pt-4 flex justify-between">
            <Button 
              variant="outline" 
              onClick={() => setShowCreateDialog(false)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancelar
            </Button>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={resetCreateForm}
                disabled={isCreating}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Limpar
              </Button>
              
              <Button 
                onClick={handleCreateStream} 
                disabled={isCreating || !newStreamTitle.trim()}
                className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 border-none relative overflow-hidden group text-white"
              >
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0"></span>
                {isCreating ? (
                  <div className="relative z-10 flex items-center">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    <span>Criando...</span>
                  </div>
                ) : (
                  <div className="relative z-10 flex items-center">
                    <Video className="h-4 w-4 mr-2" />
                    <span>Criar Transmissão</span>
                  </div>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Estilos para animações */}
      <style>
        {`
        /* Animação de partículas grandes para o hero */
        @keyframes float-up-lg {
          0% {
            transform: translateY(100%) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.3;
          }
          90% {
            opacity: 0.2;
          }
          100% {
            transform: translateY(-100vh) rotate(360deg);
            opacity: 0;
          }
        }

        /* Animação de partículas menores para cards */
        @keyframes float-up {
          0% {
            transform: translateY(100%) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 0.5;
          }
          100% {
            transform: translateY(-100%) rotate(360deg);
            opacity: 0;
          }
        }
        
        /* Partículas grandes */
        .particle-lg {
          position: absolute;
          width: 15px;
          height: 15px;
          background-color: rgba(59, 130, 246, 0.15);
          border-radius: 50%;
          animation: float-up-lg 15s infinite linear;
        }
        
        .particle-lg.particle-1 {
          left: 10%;
          width: 20px;
          height: 20px;
          animation-duration: 25s;
          animation-delay: 0s;
        }
        
        .particle-lg.particle-2 {
          left: 50%;
          width: 25px;
          height: 25px;
          background-color: rgba(99, 102, 241, 0.15);
          animation-duration: 30s;
          animation-delay: 5s;
        }
        
        .particle-lg.particle-3 {
          left: 80%;
          width: 15px;
          height: 15px;
          background-color: rgba(79, 70, 229, 0.15);
          animation-duration: 20s;
          animation-delay: 2s;
        }
        
        /* Partículas menores */
        .particle {
          position: absolute;
          width: 5px;
          height: 5px;
          background-color: rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          animation: float-up 8s infinite linear;
        }
        
        .particle-1 {
          left: 20%;
          animation-duration: 8s;
          animation-delay: 0s;
        }
        
        .particle-2 {
          left: 50%;
          width: 7px;
          height: 7px;
          animation-duration: 10s;
          animation-delay: 2s;
        }
        
        .particle-3 {
          left: 80%;
          width: 4px;
          height: 4px;
          animation-duration: 6s;
          animation-delay: 1s;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
        
        /* Sombra para texto */
        .text-shadow {
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        `}
      </style>
    </Layout>
  );
  
  // Função auxiliar para renderizar a lista de transmissões
  function renderStreamsList(streams: ExtendedLiveStream[], isLoading: boolean) {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Card key={item} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <CardContent className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-1/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }
    
    if (streams.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Nenhuma transmissão encontrada</p>
          {(canStartLive || isAdmin) && (
            <Button onClick={() => setShowCreateDialog(true)} className="text-white bg-black hover:bg-gray-900 border border-gray-800">
              <PlusCircle className="h-4 w-4 mr-2" />
              Criar Transmissão
            </Button>
          )}
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {streams.map((stream) => (
          <LiveStreamCard
            key={stream.id}
            stream={stream as unknown as ExtendedLiveStream}
            onClick={handleOpenStream}
            isActive={currentStream?.id === stream.id}
          />
        ))}
      </div>
    );
  }

  // Funções auxiliares para ícones
  function getCategoryIcon(category: string) {
    switch (category) {
      case 'crypto': return '📊';
      case 'stocks': return '📈';
      case 'forex': return '💱';
      case 'technical': return '📉';
      case 'fundamental': return '🔍';
      case 'education': return '🎓';
      case 'news': return '📰';
      case 'discussion': return '💬';
      default: return '📊';
    }
  }

  function getLanguageFlag(language: string) {
    switch (language) {
      case 'pt': return '🇧🇷';
      case 'en': return '🇺🇸';
      case 'es': return '🇪🇸';
      default: return '🌐';
    }
  }
};

export default LiveStreamPage; 