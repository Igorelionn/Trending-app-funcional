import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { shouldShowStartLiveButton } from "@/utils/permissions";
import { format } from "date-fns";
import { useLiveStreamPermission } from "@/components/LiveStreamPermissionProvider";
import { useLiveStream } from "@/contexts/LiveStreamContext";
import { useInAppNotification } from "@/hooks/useInAppNotification";
import { useTrendingNotifications } from "@/contexts/TrendingNotificationContext";
import { MeetingCard as MeetingCardComponent } from "@/components/MeetingCard";
import { StreamerSettingsModal } from "@/components/streaming/StreamerSettingsModal";
import * as followService from "@/services/followService";
import type { StreamerProfile } from "@/services/followService";
import { 
  Play, 
  Calendar, 
  Clock, 
  Video, 
  Users, 
  Eye, 
  Heart,
  MoreVertical, 
  Globe, 
  Link as LinkIcon, 
  Search, 
  Hash, 
  Send, 
  X,
  MessageSquare, 
  Lock,
  Shield,
  ThumbsUp, 
  UserPlus,
  Mic,
  MicOff,
  VideoOff,
  Monitor,
  RefreshCw,
  ScreenShare,
  Square,
  Circle,
  User,
  Presentation, 
  Camera,
  AlertCircle,
  FileCheck,
  Crown,
  Image,
  ArrowRight,
  UploadCloud,
  XIcon,
  CheckIcon,
  XCircle,
  Loader2,
  Info,
  CheckCircle,
  Video as VideoIcon,
  Presentation as PresentationIcon,
  SendHorizonal,
  Tv,
  Trash,
  Settings
} from "lucide-react";
import { useForm } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { supabase } from "@/lib/supabase";

// Adicionar ao início do arquivo, após os imports
declare global {
  interface Window {
    checkStreamStatus?: (streamId: string) => void;
    publisherPeer?: unknown;
    viewerPeer?: unknown;
    localStream?: MediaStream;
  }
}

// Dados simulados para comentários
const mockComments = [
  {
    id: "comment1",
    userId: "user1",
    userName: "Ricardo",
    userAvatar: "https://i.pravatar.cc/150?img=12",
    message: "Excelente análise! Você acha que o BTC vai romper essa resistência?",
    timestamp: new Date(Date.now() - 12 * 60 * 1000), // 12 minutos atrás
    isStreamer: false,
    likes: 0
  },
  {
    id: "comment2",
    userId: "user2",
    userName: "Carla",
    userAvatar: "https://i.pravatar.cc/150?img=20",
    message: "Concordo com sua análise. Os indicadores estão mostrando força.",
    timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutos atrás
    isStreamer: false,
    likes: 0
  },
  {
    id: "comment3",
    userId: "user3",
    userName: "Marcos",
    userAvatar: "https://i.pravatar.cc/150?img=33",
    message: "Qual é o suporte mais próximo caso ocorra um pullback?",
    timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutos atrás
    isStreamer: false,
    likes: 0
  }
];

// Definir interfaces próprias para o componente para evitar conflitos
interface MeetingData {
  id: string;
  title: string;
  description: string;
  tags: string[];
  userId: string;
  status: 'scheduled' | 'live' | 'ended' | 'deleted';
  thumbnail?: string;
  meetingId?: string;  // Identificador da reunião
  hostId?: string;     // ID do anfitrião da reunião
  hostName?: string;   // Nome do anfitrião da reunião
  hostAvatar?: string; // Avatar do anfitrião
  startTime?: Date;    // Horário agendado
  participantCount?: number; // Número de participantes
  recordingId?: string; // ID da gravação
  startedAt?: Date;    // Quando a reunião começou efetivamente
  createdAt?: Date;
  isVerifiedHost?: boolean; // Anfitrião verificado
}

// Adicionado: Interface MeetingModalProps que faltava
interface MeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMeetingCreated: (meeting: MeetingData) => void;
}

// Modal para criar uma reunião
const MeetingModal: React.FC<MeetingModalProps> = ({ open, onOpenChange, onMeetingCreated }) => {
  // Definição local de texts para resolver referências no componente
  const texts = {
    modalTitle: "Nova Transmissão",
    modalDescription: "Configure sua transmissão e compartilhe seus conhecimentos ao vivo",
    allCategories: "Todas categorias"
  };

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [streamPreview, setStreamPreview] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [language, setLanguage] = useState("pt");
  
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const { user } = useAuth();
  const { createStream, generateStreamKey } = useLiveStream();
  const navigate = useNavigate();
  const { canStartLive } = useLiveStreamPermission();
  const { notify } = useInAppNotification();
  
  // Iniciar visualização da câmera
  const startPreview = async () => {
    setIsConfiguring(true);
    setError(null);
    
    // Declarar as variáveis no escopo da função para evitar problemas de escopo
    let hasCamera = false;
    let hasMicrophone = false;
    
    try {
      // Verificar dispositivos disponíveis primeiro
      const devices = await navigator.mediaDevices.enumerateDevices();
      hasCamera = devices.some(device => device.kind === 'videoinput');
      hasMicrophone = devices.some(device => device.kind === 'audioinput');
      
      if (!hasCamera && !hasMicrophone) {
        throw new Error('Nenhuma câmera ou microfone foi encontrado no seu dispositivo');
      }
      
      // Configurar restrições baseadas em dispositivos disponíveis
      const constraints = {
        video: hasCamera ? {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        } : false,
        audio: hasMicrophone
      };
      
      console.log('Tentando acessar mídia com restrições:', constraints);
      
      // Solicitar acesso à câmera e/ou microfone
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setMediaStream(stream);
      setStreamPreview(true);
      
      // Importante: utilizamos setTimeout para garantir que o DOM seja atualizado antes de configurar o vídeo
      setTimeout(() => {
        // Associar o stream ao elemento de vídeo
        if (videoPreviewRef.current) {
          console.log('Configurando vídeo preview');
          videoPreviewRef.current.srcObject = stream;
          
          // Garantir que o vídeo seja reproduzido imediatamente
          videoPreviewRef.current.play().catch(e => {
            console.error('Erro ao iniciar reprodução do vídeo:', e);
          });
        } else {
          console.warn('Elemento de vídeo não encontrado');
        }
      }, 100);
    } catch (err: unknown) {
      console.error('Erro ao acessar dispositivos de mídia:', err);
      
      // Mensagens de erro mais amigáveis baseadas no tipo de erro
      let mensagemErro = 'Verifique as permissões do navegador';
      
      if (err instanceof Error) {
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        mensagemErro = 'Nenhum dispositivo de mídia encontrado. Conecte uma câmera ou microfone e tente novamente.';
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        mensagemErro = 'Permissão para acessar câmera/microfone negada. Verifique as configurações do seu navegador.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        mensagemErro = 'Não foi possível acessar a câmera/microfone. O dispositivo pode estar sendo usado por outro aplicativo.';
      } else if (err.name === 'OverconstrainedError') {
        mensagemErro = 'As configurações solicitadas não são suportadas pelo seu dispositivo.';
      } else if (err.name === 'TypeError') {
        mensagemErro = 'Configuração inválida para acesso aos dispositivos.';
        }
      }
      
      setError(`Erro ao acessar câmera/microfone: ${mensagemErro}`);
    } finally {
      setIsConfiguring(false);
    }
  };
  
  // Parar a visualização da câmera
  const stopPreview = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    
    // Limpar o elemento de vídeo se existir
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    
    setMediaStream(null);
    setStreamPreview(false);
    setIsConfiguring(false);
    
    // Não limpar a thumbnail aqui para manter a imagem se já tiver sido configurada
  };

  // Função para lidar com o submit do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('O título é obrigatório');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      console.log('Iniciando criação de transmissão...');
      
      // Processar as tags
      const processedTags = tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      // Criar dados básicos da transmissão
      const streamData = {
        title,
        description,
        thumbnailUrl: thumbnail || '',
        tags: processedTags,
        language,
        category,
        streamSettings: {
          webcamEnabled: !!mediaStream?.getVideoTracks().length,
          screenShareEnabled: false,
          chatEnabled: true,
          hostName: user?.user_metadata?.name || user?.email || 'Anfitrião',
          hostAvatar: user?.user_metadata?.avatar_url || '',
        }
      };
      
      console.log('Dados da transmissão:', streamData);
      
      // Criar a transmissão
      const newStream = await createStream(streamData);
      
      if (!newStream) {
        throw new Error('Falha ao criar transmissão');
      }
      
      console.log('Transmissão criada:', newStream);
        
      // Converter para o formato esperado
        const meetingData: MeetingData = {
          id: newStream.id,
          title: newStream.title || '',
          description: newStream.description || '',
          tags: Array.isArray(newStream.tags) ? newStream.tags : [],
          userId: newStream.userId || '',
          status: (newStream.status || 'scheduled') as 'scheduled' | 'live' | 'ended' | 'deleted',
          thumbnail: newStream.thumbnailUrl || '',
          meetingId: newStream.id,
          hostId: newStream.userId || '',
          hostName: String(streamData.streamSettings?.hostName || 'Anfitrião'),
          hostAvatar: String(streamData.streamSettings?.hostAvatar || ''),
          participantCount: 0,
          startedAt: newStream.startedAt ? new Date(newStream.startedAt) : undefined,
          startTime: newStream.scheduledStart ? new Date(newStream.scheduledStart) : undefined,
          createdAt: newStream.createdAt ? new Date(newStream.createdAt) : new Date(),
          isVerifiedHost: true
        };
        
      // Parar o preview de mídia antes de fechar o modal
      stopPreview();
      
      // Notificar sucesso
      onMeetingCreated(meetingData);
      onOpenChange(false);
      // Mostrar mensagem de sucesso
      console.log("Transmissão criada com sucesso");
      
      // Redirecionar para a página do streamer
      navigate(`/streamer/${newStream.id}`);
      
    } catch (err: unknown) {
      console.error('Erro ao criar transmissão:', err);
      
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar transmissão';
      setError(errorMessage);
      
      // Mostrar mensagem de erro
      console.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remover a função capturePhoto e substituir por uma função de upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Verificar se é uma imagem
    if (!file.type.match('image.*')) {
      notify({
        title: "Erro",
        description: "O arquivo deve ser uma imagem",
        type: "error",
        variant: "destructive"
      });
      return;
    }
    
    // Verificar tamanho do arquivo (limite de 2MB)
    if (file.size > 2 * 1024 * 1024) {
      notify({
        title: "Erro",
        description: "A imagem deve ter no máximo 2MB",
        type: "error",
        variant: "destructive"
      });
      return;
    }
    
    // Carregar a imagem como data URL
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      if (loadEvent.target?.result) {
        setThumbnail(loadEvent.target.result as string);
        notify({
          title: "Sucesso",
          description: "Thumbnail carregada com sucesso!",
          type: "live"
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Funções para lidar com drag and drop de imagens
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-blue-500');
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-blue-500');
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-blue-500');
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      
      // Verificar se é uma imagem
      if (!file.type.match('image.*')) {
        notify({
          title: "Erro",
          description: "O arquivo deve ser uma imagem",
          type: "error",
          variant: "destructive"
        });
        return;
      }
    
      // Carregar a imagem como data URL
    const reader = new FileReader();
      reader.onload = (loadEvent) => {
        if (loadEvent.target?.result) {
          setThumbnail(loadEvent.target.result as string);
          notify({
            title: "Sucesso",
            description: "Thumbnail carregada com sucesso!",
            type: "live"
          });
      }
    };
    reader.readAsDataURL(file);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0a0b] border border-zinc-900/50 text-white max-w-5xl rounded-2xl shadow-2xl p-0 overflow-hidden max-h-[85vh]">
        {/* Header compacto com efeito de luz sutil */}
        <div className="relative p-4 border-b border-zinc-900/40 bg-gradient-to-br from-[#0a0a0b] to-zinc-950">
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-600/[0.02] via-transparent to-zinc-600/[0.02]" />
          <div className="relative">
            <DialogTitle className="text-white text-lg font-semibold flex items-center gap-2.5">
              <div className="p-1.5 bg-zinc-900/60 rounded-lg">
                <Video className="h-4 w-4 text-zinc-400" />
              </div>
              {texts.modalTitle}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-xs mt-1.5">
              {texts.modalDescription}
            </DialogDescription>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto max-h-[calc(85vh-80px)]">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-4">
            {/* Coluna esquerda - Preview da câmera GRANDE */}
            <div className="space-y-3">
              {/* Preview da câmera - GRANDE */}
              <div className="bg-zinc-950/40 p-3 rounded-lg border border-zinc-900/40">
                <h3 className="font-medium text-zinc-300 mb-2 flex items-center gap-2 text-xs">
                  <Camera className="h-3.5 w-3.5 text-zinc-500" />
                  Câmera
                </h3>
                
                {streamPreview ? (
                  <div className="relative">
                    {mediaStream && mediaStream.getVideoTracks().length > 0 ? (
                      <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden group">
                        <video
                          ref={videoPreviewRef}
                          autoPlay
                          playsInline
                          muted
                          controls={false}
                          className={`w-full h-full object-cover ${isMirrored ? '-scale-x-100' : ''}`}
                        />
                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-[10px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Ativa
                        </div>
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 bg-black/70 hover:bg-black/90 border-zinc-800/50 text-white"
                            onClick={() => setIsMirrored(!isMirrored)}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 bg-black/70 hover:bg-black/90 border-zinc-800/50 text-red-400"
                            onClick={stopPreview}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full aspect-video bg-black rounded-md flex items-center justify-center border border-zinc-900/40">
                        <div className="text-center">
                          <VideoOff className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                          <p className="text-xs text-zinc-500">Apenas áudio</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div 
                    className="group w-full aspect-video border border-dashed border-zinc-900/50 bg-zinc-950/20 hover:bg-zinc-950/30 rounded-md flex flex-col items-center justify-center gap-2 transition-all cursor-pointer"
                    onClick={() => !isConfiguring && startPreview()}
                  >
                    {isConfiguring ? (
                      <>
                        <RefreshCw className="h-8 w-8 animate-spin text-zinc-600" />
                        <p className="text-zinc-500 text-xs">Configurando câmera...</p>
                      </>
                    ) : (
                      <>
                        <Camera className="h-8 w-8 text-zinc-700 group-hover:text-zinc-500" />
                        <p className="text-zinc-500 text-xs">Clique para ativar a câmera</p>
                        <p className="text-zinc-600 text-[10px]">Visualize sua transmissão antes de iniciar</p>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              {/* Thumbnail - proporção 16:9 real */}
              <div className="bg-zinc-950/40 p-3 rounded-lg border border-zinc-900/40">
                <h3 className="font-medium text-zinc-300 mb-2 flex items-center gap-2 text-xs">
                  <Image className="h-3.5 w-3.5 text-zinc-500" />
                  Thumbnail
                </h3>
                
                {thumbnail ? (
                  <div 
                    className="relative border border-zinc-900/30 rounded-md overflow-hidden aspect-video"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <img src={thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] bg-black/70 border-zinc-800/50 text-red-400"
                        onClick={() => setThumbnail('')}
                      >
                        <Trash className="h-3 w-3 mr-1" />
                        Remover
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="group w-full aspect-video border border-dashed border-zinc-900/50 bg-zinc-950/20 hover:bg-zinc-950/30 rounded-md flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('thumbnail-upload')?.click()}
                  >
                    <UploadCloud className="h-6 w-6 text-zinc-700 group-hover:text-zinc-500" />
                    <p className="text-zinc-500 text-xs">Clique ou arraste imagem</p>
                    <p className="text-zinc-600 text-[10px]">16:9 • Max 2MB</p>
                    <input
                      type="file"
                      id="thumbnail-upload"
                      accept="image/*"
                      onChange={handleFileUpload}
                      aria-label="Carregar imagem de thumbnail"
                      className="hidden"
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Coluna direita */}
            <div className="space-y-3">
              {/* Detalhes */}
              <div className="bg-zinc-950/40 p-3 rounded-lg border border-zinc-900/40 space-y-2">
                <div>
                  <Label htmlFor="title" className="text-zinc-500 text-[11px]">Título <span className="text-red-500">*</span></Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Análise do Bitcoin"
                    className="bg-zinc-950/50 border-zinc-900/50 text-zinc-300 h-7 text-xs mt-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="description" className="text-zinc-500 text-[11px]">Descrição</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva sua transmissão..."
                    className="bg-zinc-950/50 border-zinc-900/50 text-zinc-300 text-xs min-h-[60px] resize-none mt-1"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="category" className="text-zinc-500 text-[11px]">Categoria</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="bg-zinc-950/50 border-zinc-900/50 text-zinc-300 h-7 text-xs mt-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0a0b] border-zinc-900/50">
                        <SelectItem value="all" className="text-zinc-400 text-xs">Todas</SelectItem>
                        <SelectItem value="crypto" className="text-zinc-400 text-xs">Cripto</SelectItem>
                        <SelectItem value="stocks" className="text-zinc-400 text-xs">Ações</SelectItem>
                        <SelectItem value="forex" className="text-zinc-400 text-xs">Forex</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="language" className="text-zinc-500 text-[11px]">Idioma</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="bg-zinc-950/50 border-zinc-900/50 text-zinc-300 h-7 text-xs mt-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0a0b] border-zinc-900/50">
                        <SelectItem value="pt" className="text-zinc-400 text-xs">Português</SelectItem>
                        <SelectItem value="en" className="text-zinc-400 text-xs">Inglês</SelectItem>
                        <SelectItem value="es" className="text-zinc-400 text-xs">Espanhol</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="tags" className="text-zinc-500 text-[11px]">Tags (separadas por vírgula)</Label>
                  <Input
                    id="tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="Ex: bitcoin, trader"
                    className="bg-zinc-950/50 border-zinc-900/50 text-zinc-300 h-7 text-xs mt-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-950/10 text-red-400 text-[11px] px-3 py-2 rounded-md border border-red-900/20 flex items-start gap-2 mt-3">
              <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          
          <div className="mt-4 pt-3 border-t border-zinc-900/40 flex justify-end gap-2">
            <Button 
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs bg-transparent border-zinc-800/50 text-zinc-400 hover:bg-zinc-900/40"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="bg-gradient-to-r from-zinc-800 to-zinc-700 hover:from-zinc-700 hover:to-zinc-600 text-white h-8 text-xs px-4 border-0"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Tv className="mr-1.5 h-3 w-3" />
                  Criar transmissão
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Definindo interfaces necessárias
interface StreamComment {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userAvatar: string;
  timestamp: Date;
  likes: number;
  isLiked: boolean;
  isHost: boolean;
}

interface LiveStream {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  status: 'scheduled' | 'live' | 'ended' | 'deleted';
  thumbnail?: string;
  meetingId?: string;
  hostId?: string;
  hostName?: string;
  hostAvatar?: string;
  startedAt?: string;
  participantCount?: number;
  recordingId?: string;
}

// Componente de Reunião
const MeetingComponent: React.FC<{ stream: MeetingData }> = ({ stream }) => {
  const [isStreaming, setIsStreaming] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [viewerCount, setViewerCount] = useState(0);
  const [streamTime, setStreamTime] = useState(0);
  const [streamIntervalId, setStreamIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [participantList, setParticipantList] = useState<{id: string, name: string, avatar: string}[]>([]);
  const [chatOpen, setChatOpen] = useState(true); // Chat já aberto por padrão
  // Estado para foto do perfil atual
  const [currentHostAvatar, setCurrentHostAvatar] = useState<string>('');
  const [currentHostName, setCurrentHostName] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notify } = useInAppNotification();
  
  // Definir as funções antes de usá-las no useEffect
  const initializeVideoConnection = async () => {
    try {
      setConnectionStatus('connecting');
      
      // Aqui seria implementada a lógica real de conexão WebRTC
      // Usando biblioteca como simple-peer ou Twilio
      
      // Simulação para desenvolvimento
      setTimeout(() => {
        setConnectionStatus('connected');
        setIsStreaming(true);
        setViewerCount(Math.floor(Math.random() * 10) + 1);
      }, 500); // Reduzido para carregar mais rápido
      
    } catch (error) {
      console.error("Erro ao inicializar conexão de vídeo:", error);
      setConnectionStatus('error');
      notify({
        title: "Erro na conexão",
        description: "Não foi possível estabelecer a conexão de vídeo",
        type: "error",
        variant: "destructive"
      });
    }
  };

  const endMeeting = () => {
    // Lógica para finalizar a reunião
    if (window.localStream) {
      window.localStream.getTracks().forEach(track => track.stop());
    }
    
    setIsStreaming(false);
    setConnectionStatus('disconnected');
    
    if (streamIntervalId) {
      clearInterval(streamIntervalId);
    }
    
    // Redirecionar para a página principal após finalizar
    navigate('/');
    
    notify({
      title: "Reunião finalizada",
      description: "Sua reunião foi encerrada com sucesso",
      type: "live"
    });
  };
  
  // useEffect para atualizar foto e nome do perfil em tempo real
  useEffect(() => {
    const updateUserProfile = () => {
      if (user) {
        // Atualizar foto do perfil (várias fontes possíveis)
        const userRecord = user as unknown as Record<string, unknown>;
        const avatarUrl = String(user.user_metadata?.avatar_url || 
                         userRecord.avatar_url || 
                         user.user_metadata?.avatar || 
                         user.user_metadata?.picture ||
                         '');
        
        // Atualizar nome do usuário (várias fontes possíveis) 
        const userName = String(user.user_metadata?.name ||
                        user.user_metadata?.full_name ||
                        user.user_metadata?.display_name ||
                        (typeof user.email === 'string' ? user.email.split('@')[0] : null) ||
                        'Usuário');
                        
        setCurrentHostAvatar(avatarUrl);
        setCurrentHostName(userName);
        
        console.log('✅ Perfil atualizado em tempo real:', {
          avatarUrl,
          userName,
          userMetadata: user.user_metadata
        });
      }
    };
    
    // Atualizar perfil imediatamente
    updateUserProfile();
    
    // Configurar intervalo para atualizar a cada 5 segundos
    const profileUpdateInterval = setInterval(updateUserProfile, 5000);
    
    return () => {
      clearInterval(profileUpdateInterval);
    };
  }, [user]);
  
  useEffect(() => {
    if (stream) {
      // Inicializar a conexão de vídeo automaticamente
      initializeVideoConnection();
      
      // Configurar contador de tempo de reunião
      const interval = setInterval(() => {
        setStreamTime(prev => prev + 1);
      }, 1000);
      
      setStreamIntervalId(interval);
      
      // Simular alguns participantes iniciais (apenas para demonstração)
      setParticipantList([
        { id: "1", name: "Maria Silva", avatar: "/avatars/avatar-1.png" },
        { id: "2", name: "João Santos", avatar: "/avatars/avatar-2.png" },
        { id: "3", name: "Ana Oliveira", avatar: "/avatars/avatar-3.png" }
      ]);
      
      return () => {
        clearInterval(interval);
        endMeeting();
      };
    }
  }, [stream, navigate]); // Só incluímos navigate como dependência, pois as outras funções são definidas no componente

  const toggleMute = () => {
    if (window.localStream) {
      const audioTracks = window.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (window.localStream) {
      const videoTracks = window.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        if (screenShareRef.current) {
          screenShareRef.current.srcObject = screenStream;
          screenShareRef.current.play();
        }
        
        // Aqui implementaria a lógica para enviar o stream de compartilhamento
        // para os outros participantes
        
        setIsScreenSharing(true);
        } else {
        // Parar o compartilhamento
        if (screenShareRef.current && screenShareRef.current.srcObject) {
          const tracks = (screenShareRef.current.srcObject as MediaStream).getTracks();
          tracks.forEach(track => track.stop());
          screenShareRef.current.srcObject = null;
        }
        
        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error("Erro ao compartilhar tela:", error);
      notify({
        title: "Erro no compartilhamento",
        description: "Não foi possível compartilhar sua tela",
        type: "error",
        variant: "destructive"
      });
    }
  };

  const toggleRecording = () => {
    // Implementação simplificada para interface
    setIsRecording(!isRecording);
    
    if (!isRecording) {
      notify({
        title: "Gravação iniciada",
        description: "Sua reunião está sendo gravada",
        type: "live"
      });
      } else {
      notify({
        title: "Gravação finalizada",
        description: "A gravação da reunião foi salva",
        type: "live"
      });
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [
      h.toString().padStart(2, '0'),
      m.toString().padStart(2, '0'),
      s.toString().padStart(2, '0')
    ].join(':');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between bg-black p-4 border-b border-zinc-800/50">
        <div className="flex items-center space-x-3">
          <div className="bg-red-600 w-2 h-2 rounded-full animate-pulse" />
          <span className="text-white font-medium">Ao vivo</span>
          <span className="text-white/60 text-sm">({formatTime(streamTime)})</span>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <Users className="h-4 w-4 text-white/60" />
            <span className="text-white/80 text-sm">{viewerCount}</span>
          </div>
          
          <Button
            variant="destructive" 
            size="sm"
            onClick={endMeeting}
            className="text-xs bg-red-600 hover:bg-red-700"
          >
            Encerrar
          </Button>
        </div>
      </div>
      
      <div className="flex flex-1 h-full">
        {/* Área principal da reunião */}
        <div className="flex-1 bg-black relative">
          {connectionStatus === 'connecting' ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center">
                <RefreshCw className="h-8 w-8 text-white/80 animate-spin mb-4" />
                <p className="text-white/80">Conectando à reunião...</p>
              </div>
            </div>
          ) : connectionStatus === 'error' ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <p className="text-white/80 mb-2">Erro ao conectar à reunião</p>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={initializeVideoConnection}
                  className="border-white/20 text-white/80 hover:bg-white/10"
                >
                  Tentar novamente
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 p-4 h-full">
              <div className="bg-zinc-900 rounded-lg overflow-hidden relative">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  muted 
                  className="w-full h-full object-cover"
                />
                {isCameraOff && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                    {currentHostAvatar ? (
                      <img 
                        src={currentHostAvatar} 
                        alt={currentHostName}
                        className="w-16 h-16 rounded-full object-cover border-2 border-white/20"
                      />
                    ) : (
                    <User className="h-16 w-16 text-white/20" />
                    )}
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-white text-xs flex items-center space-x-2">
                  {currentHostAvatar && (
                    <img 
                      src={currentHostAvatar} 
                      alt={currentHostName}
                      className="w-4 h-4 rounded-full object-cover"
                    />
                  )}
                  <span>{currentHostName} (Anfitrião)</span>
                </div>
              </div>
            
              {isScreenSharing && (
                <div className="bg-zinc-900 rounded-lg overflow-hidden relative">
                  <video 
                    ref={screenShareRef} 
                    autoPlay 
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-xs">
                    Compartilhamento de tela
                  </div>
                </div>
              )}
              
              {participantList.map((participant) => (
                <div key={participant.id} className="bg-zinc-900 rounded-lg overflow-hidden relative">
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
                    <User className="h-16 w-16 text-white/20" />
                  </div>
                  <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-xs">
                    {participant.name}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Controles da reunião simplificados */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-4 bg-zinc-900/90 rounded-full px-4 py-2">
            <Button
              size="icon"
              variant={isMuted ? "destructive" : "secondary"}
              onClick={toggleMute}
              className={isMuted ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            
            <Button 
              size="icon" 
              variant={isCameraOff ? "destructive" : "secondary"}
              onClick={toggleCamera}
              className={isCameraOff ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </Button>
            
            <Button 
              size="icon" 
              variant={isScreenSharing ? "destructive" : "secondary"}
              onClick={toggleScreenShare}
              className={isScreenSharing ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              <ScreenShare className="h-5 w-5" />
            </Button>
          </div>
        </div>
            
        {/* Painel de chat inspirado em YouTube/Twitch */}
        <div className="w-80 2xl:w-96 bg-[#0f0f0f] border-l border-zinc-800/50 flex flex-col shadow-2xl">
          {/* Header do chat */}
          <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between bg-[#181818]/80 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-zinc-400" />
              <h3 className="text-white font-semibold text-sm">Chat ao vivo</h3>
            </div>
            <div className="flex items-center gap-1">
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Users className="h-3.5 w-3.5" />
                {viewerCount}
              </span>
            </div>
          </div>
            
          {/* Mensagens do chat com scroll suave */}
          <ScrollArea className="flex-1 px-3 py-2 bg-[#0f0f0f] custom-scrollbar">
            <div className="space-y-3">
              {/* Mensagem de boas-vindas do sistema */}
              <div className="flex items-center justify-center py-2">
                <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/50 rounded-full px-3 py-1.5">
                  <p className="text-[11px] text-zinc-500 font-medium">Bem-vindo ao chat!</p>
                </div>
              </div>

              {/* Mensagem do Host */}
              <div className="group hover:bg-zinc-900/30 rounded-lg p-2 -mx-2 transition-colors duration-150 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-start gap-2.5">
                  <Avatar className="h-8 w-8 ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/20">
                    <AvatarImage 
                      src={currentHostAvatar || "/avatars/avatar-1.png"} 
                      alt={currentHostName || "Anfitrião"} 
                    />
                    <AvatarFallback className="bg-gradient-to-br from-purple-600 to-purple-800 text-white text-xs font-bold">
                      {currentHostName ? currentHostName.charAt(0).toUpperCase() : 'A'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-bold text-white truncate max-w-[120px]">
                        {currentHostName || 'Anfitrião'}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                          Host
                        </span>
                        <Shield className="h-3 w-3 text-purple-400" />
                      </div>
                      <span className="text-[10px] text-zinc-600 ml-auto">12:45</span>
                    </div>
                    <p className="text-[13px] text-zinc-200 leading-relaxed break-words">
                      Olá pessoal! Bem-vindos à minha transmissão! 🎉
                    </p>
                  </div>
                </div>
              </div>

              {/* Mensagem de usuário comum */}
              <div className="group hover:bg-zinc-900/30 rounded-lg p-2 -mx-2 transition-colors duration-150 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-start gap-2.5">
                  <Avatar className="h-8 w-8 ring-1 ring-zinc-700/50">
                    <AvatarImage src="https://i.pravatar.cc/150?img=12" alt="João" />
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-800 text-white text-xs font-bold">
                      JS
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-semibold text-zinc-300 truncate max-w-[140px]">
                        João Santos
                      </span>
                      <span className="text-[10px] text-zinc-600 ml-auto">12:47</span>
                    </div>
                    <p className="text-[13px] text-zinc-200 leading-relaxed break-words">
                      Olá! Obrigado pela transmissão! 👍
                    </p>
                  </div>
                </div>
              </div>

              {/* Mensagem com badge de membro */}
              <div className="group hover:bg-zinc-900/30 rounded-lg p-2 -mx-2 transition-colors duration-150 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-start gap-2.5">
                  <Avatar className="h-8 w-8 ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/20">
                    <AvatarImage src="https://i.pravatar.cc/150?img=20" alt="Maria" />
                    <AvatarFallback className="bg-gradient-to-br from-amber-600 to-amber-800 text-white text-xs font-bold">
                      MC
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-semibold text-zinc-300 truncate max-w-[110px]">
                        Maria Clara
                      </span>
                      <Crown className="h-3 w-3 text-amber-400" />
                      <span className="text-[10px] text-zinc-600 ml-auto">12:48</span>
                    </div>
                    <p className="text-[13px] text-zinc-200 leading-relaxed break-words">
                      Excelente análise como sempre! 💎
                    </p>
                  </div>
                </div>
              </div>

              {/* Mensagem simples */}
              <div className="group hover:bg-zinc-900/30 rounded-lg p-2 -mx-2 transition-colors duration-150 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-start gap-2.5">
                  <Avatar className="h-8 w-8 ring-1 ring-zinc-700/50">
                    <AvatarImage src="https://i.pravatar.cc/150?img=33" alt="Carlos" />
                    <AvatarFallback className="bg-gradient-to-br from-green-600 to-green-800 text-white text-xs font-bold">
                      CF
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-semibold text-zinc-300 truncate max-w-[140px]">
                        Carlos Freitas
                      </span>
                      <span className="text-[10px] text-zinc-600 ml-auto">12:50</span>
                    </div>
                    <p className="text-[13px] text-zinc-200 leading-relaxed break-words">
                      Qual timeframe você recomenda? 📊
                    </p>
                  </div>
                </div>
              </div>

              {/* Mensagem de novo seguidor */}
              <div className="flex items-center justify-center py-1.5 my-2">
                <div className="bg-gradient-to-r from-pink-900/20 via-pink-800/30 to-pink-900/20 backdrop-blur-sm border border-pink-700/30 rounded-lg px-3 py-1.5 flex items-center gap-2">
                  <Heart className="h-3.5 w-3.5 text-pink-400 fill-pink-400" />
                  <p className="text-[11px] text-pink-300 font-semibold">
                    Ana Silva começou a seguir
                  </p>
                </div>
              </div>

              {/* Mais mensagens para demonstrar scroll */}
              <div className="group hover:bg-zinc-900/30 rounded-lg p-2 -mx-2 transition-colors duration-150 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-start gap-2.5">
                  <Avatar className="h-8 w-8 ring-1 ring-zinc-700/50">
                    <AvatarImage src="https://i.pravatar.cc/150?img=45" alt="Pedro" />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white text-xs font-bold">
                      PS
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-semibold text-zinc-300 truncate max-w-[140px]">
                        Pedro Silva
                      </span>
                      <span className="text-[10px] text-zinc-600 ml-auto">12:52</span>
                    </div>
                    <p className="text-[13px] text-zinc-200 leading-relaxed break-words">
                      Quanto de capital você sugere para começar?
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        
          {/* Input de mensagem estilizado */}
          <div className="p-3 border-t border-zinc-800/50 bg-[#181818]/80 backdrop-blur-sm">
            <div className="relative group">
              <Input 
                placeholder="Enviar mensagem..." 
                className="bg-zinc-900/80 border-zinc-800/50 text-zinc-200 placeholder:text-zinc-600 pr-12 h-10 text-sm rounded-full focus:bg-zinc-900 focus:border-zinc-700 focus:ring-2 focus:ring-zinc-700/50 transition-all duration-200"
              />
              <Button
                size="icon" 
                variant="ghost"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 text-zinc-500 hover:text-white hover:bg-blue-600/80 rounded-full transition-all duration-200 group-hover:text-zinc-400"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Info do chat */}
            <div className="mt-2 flex items-center justify-center">
              <p className="text-[10px] text-zinc-600 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Seja respeitoso com todos no chat
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Funções mock para corrigir erros do linter (a serem implementadas adequadamente)
const checkStreamPermission = async (userId: string) => {
  // Implementação provisória
  return true;
};

const getActiveStreams = async () => {
  // Implementação provisória
  return [];
};

const getStreamComments = async (streamId: string) => {
  // Implementação provisória
  return [];
};

const incrementViewerCount = async (streamId: string) => {
  // Implementação provisória
  return;
};

const sendStreamComment = async (streamId: string, userId: string, userName: string, userAvatar: string, comment: string, isHost: boolean) => {
  // Implementação provisória
  return null;
};

const likeStreamComment = async (commentId: string) => {
  // Implementação provisória
  return;
};

// Card de transmissão
const MeetingCard: React.FC<{ meeting: MeetingData; onClick: () => void }> = ({ meeting, onClick }) => {
  const { status, title, hostName, thumbnail, participantCount, startedAt, startTime, createdAt } = meeting;
  const { canStartLive } = useLiveStreamPermission();
  
  // Corrigido: Verificar se o usuário pode iniciar transmissão ao vivo
  const isHost = canStartLive;
  
  // Função para formatar tempo relativo
  const formatRelativeTime = (date?: Date) => {
    if (!date) return '';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Se for no futuro (agendada)
    if (diff < 0) {
      const days = Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
      if (days > 0) return `Em ${days} dia${days > 1 ? 's' : ''}`;
      
      const hours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
      if (hours > 0) return `Em ${hours} hora${hours > 1 ? 's' : ''}`;
      
      const minutes = Math.floor(Math.abs(diff) / (1000 * 60));
      return `Em ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    }
    
    // Se for no passado
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `Há ${days} dia${days > 1 ? 's' : ''}`;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 0) return `Há ${hours} hora${hours > 1 ? 's' : ''}`;
    
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes > 0) return `Há ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    
    return 'Agora mesmo';
  };
  
  // Função para formatar data em formato amigável
  const formatDate = (date?: Date) => {
    if (!date) return '';
    
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  const getStatusInfo = () => {
    switch (status) {
      case 'live':
    return {
          badgeText: 'AO VIVO',
          badgeClass: 'bg-gradient-to-r from-red-700 to-red-600',
          iconComponent: <Video className="h-3.5 w-3.5 text-red-300" />
        };
      case 'scheduled':
        return {
          badgeText: 'AGENDADA',
          badgeClass: 'bg-gradient-to-r from-amber-700 to-amber-600',
          iconComponent: <Calendar className="h-3.5 w-3.5 text-amber-300" />
        };
      case 'ended':
        return {
          badgeText: 'FINALIZADA',
          badgeClass: 'bg-gradient-to-r from-gray-700 to-gray-600',
          iconComponent: <FileCheck className="h-3.5 w-3.5 text-gray-300" />
        };
      default:
        return {
          badgeText: 'INDISPONÍVEL',
          badgeClass: 'bg-gradient-to-r from-gray-700 to-gray-600',
          iconComponent: <XCircle className="h-3.5 w-3.5 text-gray-300" />
        };
    }
  };
  
  const { badgeText, badgeClass, iconComponent } = getStatusInfo();
  const timeText = status === 'live' 
    ? formatRelativeTime(startedAt || createdAt)
    : status === 'scheduled'
      ? formatDate(startTime) 
      : formatRelativeTime(startedAt || createdAt);

  return (
    <div 
      className="group flex flex-col overflow-hidden bg-gradient-to-br from-gray-950 to-black rounded-xl border border-gray-800/30 hover:border-gray-700/50 shadow-lg shadow-black/60 transition-all duration-500 cursor-pointer transform hover:-translate-y-1"
      onClick={onClick}
    >
      {/* Thumbnail com overlay e efeitos */}
      <div className="relative aspect-video overflow-hidden bg-gray-950">
        {thumbnail ? (
          <img 
            src={thumbnail} 
            alt={title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
            <div className="p-4 rounded-full bg-gray-800/50 group-hover:bg-gray-700/50 transition-colors duration-300">
              <Video className="h-12 w-12 text-gray-600 group-hover:text-gray-400 transition-colors duration-300" />
            </div>
          </div>
        )}
        
        {/* Overlay gradiente aprimorado */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>
        
        {/* Badge de status com design aprimorado */}
        <div className={`absolute top-2 left-2 ${badgeClass} px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg shadow-black/30 backdrop-blur-sm`}>
          {status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-red-300 animate-pulse"></span>}
          {iconComponent}
          <span className="text-white">{badgeText}</span>
        </div>
            
        {/* Badge de anfitrião se for o próprio usuário */}
        {isHost && (
          <div className="absolute top-2 right-2 bg-gradient-to-r from-indigo-700 to-indigo-600 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg shadow-black/30 backdrop-blur-sm">
            <Crown className="h-3.5 w-3.5 text-indigo-300" />
            <span className="text-white">SEU CANAL</span>
          </div>
        )}
        
        {/* Contador de participantes para lives */}
        {status === 'live' && (
          <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 border border-white/5">
            <Users className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-white">{participantCount || 0} <span className="text-white/70">participante{participantCount !== 1 ? 's' : ''}</span></span>
          </div>
        )}
        
        {/* Tempo com design aprimorado */}
        <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 border border-white/5">
          <Clock className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-white">{timeText}</span>
        </div>
      </div>
      
      {/* Conteúdo do card */}
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-white font-medium line-clamp-2 transition-colors mb-1">{title}</h3>
        
        {/* Descrição */}
        {meeting.description && (
          <p className="text-gray-400 text-sm line-clamp-2 mb-2 leading-relaxed">
            {meeting.description}
          </p>
        )}
        
        {/* Tags, se existirem */}
        {meeting.tags && meeting.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
            {(() => {
              // Verificar se tags é um array ou string
              const tagsArray = Array.isArray(meeting.tags) 
                ? meeting.tags 
                : (typeof meeting.tags === 'string' 
                    ? (meeting.tags as string).split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
                    : []
                  );
              
              return tagsArray.slice(0, 3).map((tag, index) => (
              <div key={index} className="px-1.5 py-0.5 bg-gray-800/50 rounded-md text-[10px] text-gray-400">
                #{tag}
              </div>
              ));
            })()}
            {(() => {
              const tagsArray = Array.isArray(meeting.tags) 
                ? meeting.tags 
                : (typeof meeting.tags === 'string' 
                    ? (meeting.tags as string).split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
                    : []
                  );
              
              return tagsArray.length > 3 && (
              <div className="px-1.5 py-0.5 bg-gray-800/50 rounded-md text-[10px] text-gray-400">
                  +{tagsArray.length - 3}
              </div>
              );
            })()}
          </div>
        )}
        
        <div className="mt-auto pt-3 flex items-center">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-700 to-indigo-900 overflow-hidden flex-shrink-0 mr-2.5 ring-2 ring-black">
            {meeting.hostAvatar ? (
              <img src={meeting.hostAvatar} alt={hostName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-indigo-600 text-white text-xs">
                {hostName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
          </div>
          <div className="flex-grow">
            <p className="text-sm text-white/90 font-medium line-clamp-1 flex items-center">
              {hostName || 'Anônimo'}
              {meeting.isVerifiedHost && (
                <span className="ml-1.5 bg-blue-500 p-0.5 rounded-full flex items-center justify-center">
                  <CheckIcon className="h-2.5 w-2.5 text-white" />
                </span>
              )}
            </p>
            
            {/* Status adicional */}
            {status === 'live' && (
              <p className="text-[11px] text-indigo-400 flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                Transmitindo agora
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente principal da página Live
export default function Live() {
  const auth = useAuth();
  const { language } = useLanguage();
  const [meetings, setMeetings] = useState<MeetingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingData | null>(null);
  const [showEndedMeetings, setShowEndedMeetings] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [streamers, setStreamers] = useState<StreamerProfile[]>([]);
  const [loadingStreamers, setLoadingStreamers] = useState(false);
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { canStartLive } = useLiveStreamPermission();
  const { fetchStreams, createStream } = useLiveStream();
  const { sendLiveNotification } = useTrendingNotifications();
  const { notify } = useInAppNotification();
  
  const fetchStreamsRef = useRef(fetchStreams);
  useEffect(() => { fetchStreamsRef.current = fetchStreams; }, [fetchStreams]);
  
  // Função para obter textos traduzidos baseado no idioma atual
  const getTexts = () => {
    switch (language) {
      case 'en':
        return {
          title: 'Live Broadcasts',
          description: 'Share your knowledge, interact in real time and learn from financial market experts.',
          tabLive: 'Live',
          tabStreamers: 'Streamers',
          allCategories: 'All categories',
          searchPlaceholder: 'Search broadcasts',
          loadingTitle: 'Loading broadcasts',
          loadingMessage: 'Please wait while we fetch available broadcasts...',
          noLiveTitle: 'No live broadcasts',
          noLiveMessage: 'There are no broadcasts happening at the moment.',
          startStreaming: 'Start Streaming',
          modalTitle: 'New Broadcast',
          modalDescription: 'Configure your broadcast and share your knowledge live'
        };
      case 'es':
        return {
          title: 'Transmisiones en Vivo',
          description: 'Comparte tu conocimiento, interactúa en tiempo real y aprende de expertos del mercado financiero.',
          tabLive: 'En Vivo',
          tabStreamers: 'Streamers',
          allCategories: 'Todas las categorías',
          searchPlaceholder: 'Buscar transmisiones',
          loadingTitle: 'Cargando transmisiones',
          loadingMessage: 'Espera mientras buscamos las transmisiones disponibles...',
          noLiveTitle: 'No hay transmisiones en vivo',
          noLiveMessage: 'En este momento no hay transmisiones en curso.',
          startStreaming: 'Iniciar Transmisión',
          modalTitle: 'Nueva Transmisión',
          modalDescription: 'Configure su transmisión y comparta sus conocimientos en vivo'
        };
      default: // 'pt'
        return {
          title: 'Transmissões ao vivo',
          description: 'Compartilhe seu conhecimento, interaja em tempo real e aprenda com especialistas do mercado financeiro.',
          tabLive: 'Ao Vivo',
          tabStreamers: 'Streamers',
          allCategories: 'Todas categorias',
          searchPlaceholder: 'Pesquisar transmissões',
          loadingTitle: 'Carregando transmissões',
          loadingMessage: 'Aguarde enquanto buscamos as transmissões disponíveis...',
          noLiveTitle: 'Nenhuma transmissão ao vivo',
          noLiveMessage: 'No momento não há transmissões acontecendo.',
          startStreaming: 'Iniciar Transmissão',
          modalTitle: 'Nova Transmissão',
          modalDescription: 'Configure sua transmissão e compartilhe seus conhecimentos ao vivo'
        };
    }
  };

  const texts = getTexts();
  
  const loadMeetings = useCallback(async () => {
    console.log('[Live] loadMeetings called, auth state:', { 
      userId: auth.user?.id?.substring(0, 8), 
      authLoading: auth.loading 
    });
    setIsLoading(true);
    
    try {
      const streams = await fetchStreamsRef.current();
      console.log('[Live] fetchStreams returned:', streams?.length, 'streams');
      
      if (streams && Array.isArray(streams)) {
        // Converter streams para o formato MeetingData
        const meetingsData: MeetingData[] = streams.map(stream => ({
          id: stream.id,
          title: stream.title,
          description: stream.description || '',
          tags: Array.isArray(stream.tags) 
            ? stream.tags 
            : (typeof stream.tags === 'string' 
                ? (stream.tags as string).split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0)
                : []
              ),
          userId: stream.userId,
          status: stream.status as 'scheduled' | 'live' | 'ended' | 'deleted',
          thumbnail: stream.thumbnailUrl || '',
          meetingId: stream.id,
          hostId: stream.userId,
          hostName: String(stream.streamSettings?.hostName || 'Streamer'),
          hostAvatar: String(stream.streamSettings?.hostAvatar || ''),
          participantCount: stream.viewerCount || 0,
          startedAt: stream.startedAt ? new Date(stream.startedAt) : undefined,
          startTime: stream.scheduledStart ? new Date(stream.scheduledStart) : undefined,
          createdAt: new Date(stream.createdAt),
          isVerifiedHost: true
        }));
        
        setMeetings(meetingsData);
        // Transmissões carregadas (silenciado)
      }
    } catch (error) {
      console.error('Erro ao carregar transmissões:', error);
      notify({
        title: "Erro",
        description: "Erro ao carregar transmissões. Tente novamente mais tarde.",
        type: "error",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setLoadingTimeout(true);
    }
  }, []);
  
  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) return;
    
    loadMeetings();
    
    const timeoutId = setTimeout(() => {
      setLoadingTimeout(true);
    }, 5000);
    
    const intervalId = setInterval(() => {
      loadMeetings();
    }, 10000);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadMeetings();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [auth.loading, auth.user?.id, loadMeetings]);
  
  // Função para carregar lista de streamers
  const loadStreamers = useCallback(async () => {
    setLoadingStreamers(true);
    try {
      const allStreamers = await followService.getAllStreamers(auth.user?.id);
      setStreamers(allStreamers);
    } catch (error) {
      console.error('Erro ao carregar streamers:', error);
    } finally {
      setLoadingStreamers(false);
    }
  }, [auth.user?.id]);

  // Carregar streamers quando a aba streamers for acessada
  useEffect(() => {
    if (auth.user) {
      loadStreamers();
    }
  }, [auth.user, loadStreamers]);

  // Função para seguir/deixar de seguir
  const handleToggleFollow = async (streamerId: string, currentlyFollowing: boolean) => {
    if (!auth.user) {
      notify({
        title: "Autenticação necessária",
        description: "Faça login para seguir streamers",
        type: "error"
      });
      return;
    }

    setFollowingInProgress(prev => new Set(prev).add(streamerId));

    try {
      if (currentlyFollowing) {
        const result = await followService.unfollowStreamer(auth.user.id, streamerId);
        if (result.success) {
          notify({
            title: "Sucesso",
            description: "Você deixou de seguir este streamer",
            type: "success"
          });
          // Atualizar estado local
          setStreamers(prev => prev.map(s => 
            s.id === streamerId 
              ? { ...s, is_following: false, followers_count: Math.max(0, s.followers_count - 1) }
              : s
          ));
        }
      } else {
        const result = await followService.followStreamer(auth.user.id, streamerId);
        if (result.success) {
          notify({
            title: "Sucesso",
            description: "Agora você está seguindo este streamer",
            type: "success"
          });
          // Atualizar estado local
          setStreamers(prev => prev.map(s => 
            s.id === streamerId 
              ? { ...s, is_following: true, followers_count: s.followers_count + 1 }
              : s
          ));
        }
      }
    } catch (error) {
      console.error('Erro ao seguir/deixar de seguir:', error);
      notify({
        title: "Erro",
        description: "Erro ao atualizar. Tente novamente.",
        type: "error"
      });
    } finally {
      setFollowingInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(streamerId);
        return newSet;
      });
    }
  };
  
  // Função para lidar com a criação de uma nova reunião
  const handleMeetingCreated = (meeting: MeetingData) => {
    setMeetings(prev => [meeting, ...prev]);
    
    // Enviar notificação quando a live for criada e estiver ao vivo
    if (meeting.status === 'live') {
      sendLiveNotification({
        id: meeting.id,
        title: meeting.title,
        streamerName: meeting.hostName || 'Streamer',
        startedAt: new Date()
      });
    }
    
    notify({
      title: "Sucesso!",
      description: "Sua transmissão foi criada com sucesso",
      type: "live"
    });
  };
  
  // Função para selecionar uma reunião
  const handleSelectMeeting = (meeting: MeetingData) => {
    if (meeting.status === 'live') {
      // Verificar se o usuário é o dono da transmissão
      if (meeting.userId === auth.user?.id) {
        // Se for o dono, vai para o dashboard do streamer
        navigate(`/streamer/${meeting.id}`);
      } else {
        // Se não for o dono, vai para a página de visualização
        navigate(`/watch/${meeting.id}`);
      }
    } else {
      setSelectedMeeting(meeting);
      // Exibir detalhes da reunião agendada
    }
  };

  // Função helper para verificar permissões
  const hasPermission = (): boolean => {
    return canStartLive;
  };

  return (
    <Layout>
      <div className="container max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8">
        {/* Hero section com design escuro premium */}
        <div className="rounded-2xl overflow-hidden bg-black border border-gray-900/30 p-8 md:p-10 relative backdrop-blur-md">
          <div className="absolute inset-0 bg-grid-white/[0.005] [mask-image:linear-gradient(0deg,transparent,#000)]"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950/40 via-black to-gray-950/40"></div>
          
          {/* Efeitos de iluminação sutil */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/3 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-purple-500/3 rounded-full blur-3xl"></div>
          
          <div className="relative z-10 max-w-3xl">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
              {texts.title}
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 mb-6">
              {texts.description}
            </p>
            
            {/* Status de permissão do usuário - só mostra se tem permissão */}
            {hasPermission() && (
              <div className="mb-6 p-4 bg-gray-950/60 backdrop-blur-sm border border-gray-800/30 rounded-xl">
                <p className="text-gray-400 flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2 text-gray-500" />
                  <span>Você tem permissão para iniciar transmissões ao vivo</span>
                </p>
              </div>
            )}
            
            {/* Botão de iniciar transmissão deve aparecer apenas para usuários autorizados */}
            <div className="flex items-center gap-3">
              {hasPermission() && (
                <>
                  {/* Botão de Configurações - Só para streamers */}
                  <Button
                    onClick={() => setShowSettingsModal(true)}
                    size="lg"
                    variant="outline"
                    className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.08] hover:border-white/[0.15] text-white/80 hover:text-white/95 rounded-xl transition-all duration-200"
                    title="Configurações de Live"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>

                  {/* Botão de Iniciar Transmissão */}
                  <Dialog open={openModal} onOpenChange={setOpenModal}>
                    <DialogTrigger asChild>
                      <Button size="lg" className="bg-gradient-to-r from-gray-900 to-black hover:from-gray-800 hover:to-gray-900 text-white border border-gray-700/50 rounded-xl shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-3xl backdrop-blur-sm">
                        <Video className="h-5 w-5 mr-2" />
                        {texts.startStreaming}
                      </Button>
                    </DialogTrigger>
                    
                    <MeetingModal 
                      open={openModal}
                      onOpenChange={setOpenModal}
                      onMeetingCreated={handleMeetingCreated}
                    />
                  </Dialog>
                </>
              )}
            </div>
          </div>
        
          {/* Elementos decorativos sutis */}
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-gray-900/10 rounded-full blur-3xl"></div>
          <div className="absolute top-10 right-10 w-24 h-24 bg-gray-900/8 rounded-full blur-2xl"></div>
          <div className="absolute top-1/2 -left-4 w-16 h-16 bg-gray-900/5 rounded-full blur-xl"></div>
          
          {/* Borda com gradiente sutil */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-gray-600/5 via-transparent to-gray-600/5 p-px">
            <div className="w-full h-full bg-transparent rounded-2xl"></div>
          </div>
        </div>
                  
        {/* Abas para as transmissões */}
        <Tabs defaultValue="live" className="w-full">
          <div className="flex justify-between items-center mb-4">
            <TabsList className="bg-black/60 border border-gray-900/30 p-1 rounded-xl backdrop-blur-sm">
              <TabsTrigger value="live" className="rounded-lg data-[state=active]:bg-black/80 data-[state=active]:text-gray-200 text-gray-500 hover:text-gray-300 px-4 py-2 transition-all duration-200">
                <Video className="h-4 w-4 mr-2" />
                <span>{texts.tabLive}</span>
              </TabsTrigger>
              <TabsTrigger value="streamers" className="rounded-lg data-[state=active]:bg-black/80 data-[state=active]:text-gray-200 text-gray-500 hover:text-gray-300 px-4 py-2 transition-all duration-200">
                <Users className="h-4 w-4 mr-2" />
                <span>{texts.tabStreamers}</span>
              </TabsTrigger>
            </TabsList>
            
            <div className="hidden sm:flex items-center gap-2">
              <Select defaultValue="all">
                <SelectTrigger className="w-[180px] bg-black/20 border-white/10 focus:border-white/10 focus:ring-0 focus:ring-offset-0 focus:outline-none focus:shadow-none">
                  <SelectValue placeholder="Filtrar por categoria" />
                </SelectTrigger>
                <SelectContent className="bg-black/90 backdrop-blur-md border-white/5 shadow-2xl">
                  <SelectItem value="all" className="text-white/80 hover:bg-white/5 focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-transparent focus:shadow-none">{texts.allCategories}</SelectItem>
                  <SelectItem value="crypto" className="text-white/80 hover:bg-white/5 focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-transparent focus:shadow-none">Criptomoedas</SelectItem>
                  <SelectItem value="stocks" className="text-white/80 hover:bg-white/5 focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-transparent focus:shadow-none">Ações</SelectItem>
                  <SelectItem value="forex" className="text-white/80 hover:bg-white/5 focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-transparent focus:shadow-none">Forex</SelectItem>
                  <SelectItem value="education" className="text-white/80 hover:bg-white/5 focus:outline-none focus:ring-0 focus:ring-offset-0 focus:border-transparent focus:shadow-none">Educacional</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder={texts.searchPlaceholder} 
                  className="pl-9 bg-black/20 border-white/10 w-[220px] focus:border-zinc-700/60 focus:ring-1 focus:ring-zinc-700/50 focus:outline-none" 
                />
              </div>
            </div>
          </div>
          
          {isLoading && !loadingTimeout ? (
            <div className="relative flex flex-col items-center justify-center py-24 px-12 text-center bg-black rounded-2xl border border-gray-900/30 backdrop-blur-md overflow-hidden min-h-80">
              {/* Efeitos de iluminação de fundo */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-950/40 via-black to-gray-950/40"></div>
              <div className="absolute top-0 left-1/4 w-72 h-72 bg-gray-500/3 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gray-600/3 rounded-full blur-3xl"></div>
              
              {/* Grade sutil de fundo */}
              <div className="absolute inset-0 bg-grid-white/[0.005] [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
              
              <div className="relative z-10 flex flex-col items-center">
                {/* Spinner simples */}
                <div className="relative mb-8">
                  <div className="animate-spin w-12 h-12 border-4 border-gray-800/40 border-t-gray-500 rounded-full"></div>
                </div>
                
                {/* Texto de carregamento */}
                <h3 className="text-2xl font-semibold mb-4 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                  {texts.loadingTitle}
                </h3>
                <p className="text-gray-500 text-base">
                  {texts.loadingMessage}
                </p>
              </div>
              
              {/* Borda com gradiente sutil */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-gray-600/5 via-transparent to-gray-600/5 p-px">
                <div className="w-full h-full bg-black/10 rounded-2xl"></div>
              </div>
            </div>
          ) : (
            <>
              <TabsContent value="live" className="space-y-4">
                {meetings.filter(m => m.status === 'live').length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {meetings
                      .filter(meeting => meeting.status === 'live')
                      .map(meeting => (
                        <MeetingCard
                          key={meeting.id}
                          meeting={meeting}
                          onClick={() => handleSelectMeeting(meeting)}
                        />
                      ))}
                    </div>
                  ) : (
                  <div className="relative flex flex-col items-center justify-center py-24 px-12 text-center bg-black rounded-2xl border border-gray-900/30 backdrop-blur-md overflow-hidden min-h-80">
                    {/* Efeitos de iluminação de fundo */}
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-950/40 via-black to-gray-950/40"></div>
                    <div className="absolute top-0 left-1/4 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>
                    <div className="absolute top-1/2 left-0 w-48 h-48 bg-blue-500/3 rounded-full blur-2xl"></div>
                    <div className="absolute top-1/2 right-0 w-64 h-64 bg-violet-500/3 rounded-full blur-2xl"></div>
                                        
                    {/* Grade sutil de fundo */}
                    <div className="absolute inset-0 bg-grid-white/[0.005] [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
                    
                    <div className="relative z-10 flex flex-col items-center">
                      {/* Ícone sem glow */}
                      <div className="relative mb-8">
                        <div className="relative bg-gradient-to-br from-gray-900 to-black p-8 rounded-full border border-gray-800/50 shadow-2xl">
                          <Video className="h-16 w-16 text-gray-600" />
                        </div>
                      </div>
                      
                      {/* Título com gradiente */}
                      <h3 className="text-4xl font-bold mb-6 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                        {texts.noLiveTitle}
                      </h3>
                      
                      {/* Descrição */}
                      <p className="text-gray-400 text-lg max-w-lg leading-relaxed mb-8">
                        {texts.noLiveMessage}
                      </p>
                      
                      {/* Usando a nova função helper */}
                      {hasPermission() && (
                        <Dialog open={openModal} onOpenChange={setOpenModal}>
                          <DialogTrigger asChild>
                            <Button className="mt-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl border border-indigo-500/30">
                              <Video className="h-5 w-5 mr-2" />
                              {texts.startStreaming}
                            </Button>
                          </DialogTrigger>
                        </Dialog>
                      )}
                    </div>
                    
                    {/* Borda com gradiente sutil */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-600/5 via-transparent to-purple-600/5 p-px">
                      <div className="w-full h-full bg-black/10 rounded-2xl"></div>
                    </div>
                  </div>
              )}
              </TabsContent>
              
              <TabsContent value="streamers" className="space-y-4">
                {loadingStreamers ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                  </div>
                ) : streamers.length > 0 ? (
                  <div className="space-y-3">
                    {streamers.map(streamer => (
                      <div
                        key={streamer.id}
                        onClick={() => navigate(`/streamer/${streamer.id}`)}
                        className="bg-black/20 border border-gray-900/30 rounded-lg p-4 cursor-pointer hover:bg-black/30 hover:border-gray-800/50 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          {/* Avatar */}
                          <Avatar className="h-12 w-12 ring-1 ring-gray-800/50">
                            <AvatarImage src={streamer.avatar_url || undefined} />
                            <AvatarFallback className="bg-gray-900/50 text-gray-400 text-sm font-light">
                              {streamer.display_name[0]?.toUpperCase() || 'S'}
                            </AvatarFallback>
                          </Avatar>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-normal text-gray-200 truncate">
                                {streamer.display_name}
                              </h3>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-gray-900/50 text-gray-500 border-gray-800/50 hover:bg-gray-900/50 cursor-default">
                                Streamer
                              </Badge>
                            </div>
                            
                            {/* Stats em linha */}
                            <div className="flex items-center gap-4 text-[11px] text-gray-500">
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span>{streamer.followers_count}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Heart className="h-3 w-3" />
                                <span>{streamer.supporters_count}</span>
                              </div>
                            </div>
                          </div>

                          {/* Botão Seguir */}
                          {streamer.id !== auth.user?.id && (
                            <button
                              onClick={() => handleToggleFollow(streamer.id, streamer.is_following || false)}
                              disabled={followingInProgress.has(streamer.id)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-normal transition-colors ${
                                streamer.is_following
                                  ? 'bg-gray-900/50 text-gray-400 border border-gray-800/50'
                                  : 'bg-white/5 text-gray-300 border border-gray-800/30 hover:bg-white/10'
                              } ${followingInProgress.has(streamer.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {followingInProgress.has(streamer.id) ? (
                                <Loader2 className="h-3 w-3 animate-spin mx-auto" />
                              ) : streamer.is_following ? (
                                'Seguindo'
                              ) : (
                                'Seguir'
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 space-y-2">
                    <Users className="h-10 w-10 text-gray-700" strokeWidth={1.5} />
                    <p className="text-sm text-gray-500 font-light">Nenhum streamer encontrado</p>
                  </div>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>

        {/* Modal de Configurações do Streamer */}
        {auth?.user && (
          <StreamerSettingsModal
            isOpen={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
            streamerId={auth.user.id}
          />
        )}
      </div>
    </Layout>
  );
}