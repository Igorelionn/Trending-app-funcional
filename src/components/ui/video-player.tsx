import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Eye, EyeOff, Volume1, Plus, Minus, RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Estilos para animações
const animationStyles = `
  @keyframes fadeIn {
    from { 
      opacity: 0;
      transform: translateY(10px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes fadeOut {
    from { 
      opacity: 1;
      transform: translateY(0);
    }
    to { 
      opacity: 0;
      transform: translateY(10px);
    }
  }
  
  @keyframes glowPulse {
    0% {
      box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
    }
    50% {
      box-shadow: 0 0 25px rgba(255, 255, 255, 0.4);
    }
    100% {
      box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
    }
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes slideOut {
    from {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    to {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out forwards;
  }

  .animate-fadeOut {
    animation: fadeOut 0.3s ease-out forwards;
  }

  .animate-glow {
    animation: glowPulse 2s infinite;
  }

  .animate-slideIn {
    animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  .animate-slideOut {
    animation: slideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  /* Prefixos para compatibilidade cross-browser */
  html {
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }

  /* Ordem correta para prefixos de fornecedor */
  .backdrop-blur {
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
  }
`;

interface VideoPlayerProps {
  videoKey: "video.main" | "video.instructions";
  posterKey?: "video.poster.main" | "video.poster.instructions";
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  size?: "small" | "normal";
  canHide?: boolean;
}

export function VideoPlayer({
  videoKey,
  posterKey,
  className = "",
  autoPlay = false,
  muted = true,
  loop = false,
  controls = true,
  size = "normal",
  canHide = false,
}: VideoPlayerProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<HTMLDivElement>(null);
  const [volume, setVolume] = useState(50);
  const [lastVolume, setLastVolume] = useState(50); // Guardar último volume usado
  const [isHidden, setIsHidden] = useState(false);

  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(videoKey !== "video.main"); // Nunca iniciar com loading para o vídeo do dashboard
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [showVolumeBar, setShowVolumeBar] = useState(false); // Controlar visibilidade da barra
  const volumeBarRef = useRef<HTMLDivElement>(null);
  const volumeTimerRef = useRef<NodeJS.Timeout | null>(null); // Timer para ocultar barra de volume
  const volumeButtonRef = useRef<HTMLButtonElement>(null);
  const userPausedRef = useRef<boolean>(false); // Nova ref para controlar se o usuário pausou manualmente
  const preventLoadRef = useRef<boolean>(false); // Nova ref para prevenir carregamento automático
  const [currentFrameUrl, setCurrentFrameUrl] = useState<string | null>(null); // Estado para armazenar o frame atual como URL
  const [showingAfterHidden, setShowingAfterHidden] = useState(false);
  
  // Novos estados para controles avançados
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [showProgressPreview, setShowProgressPreview] = useState(false);
  const [progressPreviewTime, setProgressPreviewTime] = useState(0);
  const [progressPreviewPosition, setProgressPreviewPosition] = useState(0);
  const [previewThumbnail, setPreviewThumbnail] = useState<string | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [showControls, setShowControls] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const thumbnailCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const thumbnailTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wasPlayingBeforeSeekRef = useRef<boolean>(false);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastVisibleTimeRef = useRef<number | null>(null); // Nova ref para armazenar a posição do vídeo quando a página fica invisível
  const [isUserSeeking, setIsUserSeeking] = useState(false); // Flag para prevenir updateTime durante seeking
  


  // Obtém o caminho do vídeo e do poster baseado no idioma atual
  const src = t(videoKey);
  // Só usa poster se for fornecido e não for o vídeo do dashboard
  const poster = posterKey && videoKey !== "video.main" ? t(posterKey) : undefined;

  // Verificar se há uma fonte válida de vídeo
  const hasValidSource = src && src !== videoKey && src !== '' && !src.startsWith('video.');
  
  // Se não houver fonte válida, não renderizar o componente
  if (!hasValidSource) {
    console.warn(`⚠️ [VIDEO-PLAYER] Nenhuma fonte válida encontrada para ${videoKey}`);
    return null;
  }

  // Verificar se é o vídeo do dashboard para usar layout diferente
  const isDashboardVideo = videoKey === "video.main";

  // ===== FUNÇÕES AUXILIARES PARA SEEKING TOTALMENTE CORRIGIDO =====
  
  // CORREÇÃO: Detecção ULTRA-SIMPLIFICADA de pause manual
  const isUserPaused = () => {
    // Usar apenas a ref como fonte única de verdade
    return userPausedRef.current;
  };

  // CORREÇÃO: Preservar estado para seeking - SEMPRE preservar o estado atual
  const preservePlayStateForSeeking = () => {
    const video = videoRef.current;
    if (!video) return false;
    
    // CAPTURAR APENAS o estado atual do vídeo (sem verificar se foi pausado manualmente)
    const isActuallyPlaying = !video.paused && !video.ended && video.readyState >= 2;
    wasPlayingBeforeSeekRef.current = isActuallyPlaying;
    
    // Era PAUSADO/TOCANDO (silenciado)
    return isActuallyPlaying;
  };

  // Função SIMPLIFICADA para restaurar estado após seeking
  const restorePlayStateAfterSeeking = () => {
    const video = videoRef.current;
    if (!video) return;
    
    const wasPlayingBefore = wasPlayingBeforeSeekRef.current;
    const isCurrentlyPaused = video.paused;
    
    // SEEK-RESTORE (silenciado)
    
    // REGRA SIMPLES: Restaurar exatamente o estado que estava antes do seeking
    if (wasPlayingBefore && isCurrentlyPaused) {
      // Restaurando reprodução (silenciado)
      video.play()
        .then(() => {
          setIsPlaying(true);
          // Reprodução restaurada (silenciado)
        })
        .catch(err => {
          console.warn('⚠️ [SEEK-RESTORE] Falha ao restaurar:', err);
          setIsPlaying(false);
        });
    } else if (!wasPlayingBefore && !isCurrentlyPaused) {
      // Pausando vídeo (silenciado)
      video.pause();
      setIsPlaying(false);
    } else {
      // Estados já estão corretos, só sincronizar
      setIsPlaying(!isCurrentlyPaused);
      // Estados já sincronizados (silenciado)
    }
  };

  // Função para atualizar o botão de play/pause na tela cheia
  const updateFullscreenPlayButton = (playing: boolean) => {
    const playPauseButton = document.getElementById('fullscreen-play-pause-button');
    if (playPauseButton) {
      playPauseButton.innerHTML = playing 
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><polygon points="5,3 19,12 5,21"></polygon></svg>';
    }
  };



  // Função para tentar reproduzir o vídeo com várias tentativas
  const attemptPlayVideo = async (video: HTMLVideoElement, maxAttempts = 5) => {
    // Verificar se o vídeo foi pausado pelo usuário
    if (video.hasAttribute("data-user-paused")) {
      console.log(`Vídeo ${videoKey} foi pausado manualmente pelo usuário, não tentando reproduzir`);
      return false;
    }
    
    let attempts = 0;
    
    const tryPlay = async () => {
      try {
        setHasError(false);
        await video.play();
        console.log(`Vídeo ${videoKey} iniciado com sucesso após ${attempts + 1} tentativas`);
        setIsPlaying(true);
        return true;
      } catch (err) {
        attempts++;
        console.error(`Tentativa ${attempts} - Erro ao reproduzir vídeo ${videoKey}:`, err);
        
        if (attempts < maxAttempts) {
          console.log(`Tentando novamente em ${attempts * 500}ms...`);
          return new Promise<boolean>(resolve => {
            setTimeout(async () => {
              const result = await tryPlay();
              resolve(result);
            }, attempts * 500);
          });
        } else {
          console.error(`Falha após ${maxAttempts} tentativas para reproduzir o vídeo ${videoKey}`);
          setHasError(true);
          return false;
        }
      }
    };
    
    return tryPlay();
  };

  // Efeito principal para configurar os event listeners do vídeo
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Restaurar estado anterior SIMPLIFICADO
    const wasPreviouslyPaused = localStorage.getItem(`video-paused-${videoKey}`) === 'true';
    const savedPosition = localStorage.getItem(`video-position-${videoKey}`);
    
    if (wasPreviouslyPaused) {
      // Restaurando estado pausado
      userPausedRef.current = true;
      video.setAttribute("data-user-paused", "true");
      setIsPlaying(false);
      
      // Restaurar posição se disponível
      if (savedPosition) {
        const position = parseFloat(savedPosition);
        if (!isNaN(position)) {
          video.currentTime = position;
          // Posição restaurada
        }
      }
    }

    const updateTime = () => {
      // Não atualizar posição da barra durante seeking pelo usuário
      if (!isUserSeeking && !isDraggingProgress) {
        setCurrentTime(video.currentTime);
      }
    };
    
    const updateDuration = () => {
      // Não atualizar a duração se o vídeo estiver pausado pelo usuário
      if (userPausedRef.current || preventLoadRef.current) {
        // Evento bloqueado (silenciado)
        return;
      }
      
      setDuration(video.duration);
      // Duração carregada (silenciado)
    };
    
        const handlePlay = () => {
      // Vídeo iniciou
      setIsPlaying(true);
      setIsLoading(false);
      updateFullscreenPlayButton(true);
    };

    const handlePause = () => {
      // Vídeo pausou (silenciado)
      setIsPlaying(false);
      updateFullscreenPlayButton(false);
    };
    
    const handleLoadStart = () => {
      // Vídeo da dashboard nunca mostra loading
      if (videoKey === "video.main") {
        setIsLoading(false);
        return;
      }
      
      // Se pausado manualmente, não mostrar loading
      if (userPausedRef.current || video.hasAttribute("data-user-paused")) {
        console.log('🚫 [LOAD-START] Ignorado - vídeo pausado manualmente');
        setIsLoading(false);
        return;
      }
      
      console.log('⏳ [LOAD-START] Iniciando carregamento');
      setIsLoading(true);
    };
    
    // Adicionar manipulador para eventos de carregamento específicos do vídeo
    const handleLoadedMetadata = () => {
      if (userPausedRef.current || preventLoadRef.current) {
        // Evento bloqueado (silenciado)
        return;
      }
    };
    
    const handleLoadedData = () => {
      // Nunca mostrar carregamento para o vídeo do dashboard
      if (videoKey === "video.main") {
        setIsLoading(false);
        return;
      }
      
      // Verificar se há uma posição salva anteriormente
      const hasLastPosition = localStorage.getItem(`video-last-position-${videoKey}`) !== null;
      
      if (userPausedRef.current || 
          preventLoadRef.current || 
          videoRef.current?.hasAttribute("data-user-paused") || 
          videoRef.current?.hasAttribute("data-shown-after-hidden") ||
          hasLastPosition) {
        console.log(`Evento loadeddata bloqueado porque o vídeo ${videoKey} foi pausado pelo usuário ou estamos voltando para uma página já visitada`);
        setIsLoading(false);
        
        // Se temos uma posição salva, restaurar para essa posição
        if (hasLastPosition && videoRef.current) {
          const lastPosition = localStorage.getItem(`video-last-position-${videoKey}`);
          if (lastPosition) {
            const position = parseFloat(lastPosition);
            if (!isNaN(position) && isFinite(position)) {
              videoRef.current.currentTime = position;
              setCurrentTime(position);
              console.log(`Restaurando vídeo ${videoKey} para posição salva: ${position}`);
            }
          }
        }
        
        return;
      }
      console.log(`Vídeo ${videoKey} carregado completamente`);
      setIsLoading(false);
    };
    
    const handleCanPlay = () => {
      // Nunca mostrar carregamento para o vídeo do dashboard
      if (videoKey === "video.main") {
        setIsLoading(false);
        return;
      }
      
      // Verificar se há uma posição salva anteriormente
      const hasLastPosition = localStorage.getItem(`video-last-position-${videoKey}`) !== null;
      const wasPlaying = localStorage.getItem(`video-was-playing-${videoKey}`) === 'true';
      
      if (userPausedRef.current || 
          preventLoadRef.current || 
          videoRef.current?.hasAttribute("data-user-paused") || 
          videoRef.current?.hasAttribute("data-shown-after-hidden")) {
        console.log(`Evento canplay ignorado porque o vídeo ${videoKey} foi pausado pelo usuário`);
        setIsLoading(false);
        return;
      }
      
      console.log(`Vídeo ${videoKey} pode ser reproduzido agora`);
      setIsLoading(false);
      
      // Verificar várias condições antes de iniciar a reprodução automática
      const isMainVideo = (videoKey as string) === "video.main";
      if (autoPlay && 
          isMainVideo && 
          !videoRef.current?.hasAttribute("data-autoplay-handled") && 
          !userPausedRef.current && 
          !preventLoadRef.current && 
          !videoRef.current?.hasAttribute("data-user-paused")) {
        
        if (videoRef.current) {
          videoRef.current.setAttribute("data-autoplay-handled", "true");
          attemptPlayVideo(videoRef.current);
        }
      }
      
      // Se estamos voltando para uma página já visitada e o vídeo estava reproduzindo antes
      if (hasLastPosition && wasPlaying && !userPausedRef.current && videoRef.current) {
        // Restaurar posição
        const lastPosition = localStorage.getItem(`video-last-position-${videoKey}`);
        if (lastPosition) {
          const position = parseFloat(lastPosition);
          if (!isNaN(position) && isFinite(position)) {
            videoRef.current.currentTime = position;
            setCurrentTime(position);
            console.log(`Restaurando vídeo ${videoKey} para posição salva: ${position} e continuando reprodução`);
            
            // Continuar reprodução se estava reproduzindo antes
            attemptPlayVideo(videoRef.current);
          }
        }
      }
    };
    
    const handleError = (e: Event) => {
      console.error(`Erro ao carregar o vídeo ${videoKey}:`, video.error);
      console.error('Código do erro:', video.error?.code);
      console.error('Mensagem do erro:', video.error?.message);
      console.error('Caminho do vídeo:', video.src);
      setHasError(true);
      setIsLoading(false);
    };
    
    const handleSeeking = () => {
      // Durante o seeking, verificar se deve preservar estado (se ainda não foi feito)
      if (!wasPlayingBeforeSeekRef.current) {
        preservePlayStateForSeeking();
      }
    };
    
    const handleSeeked = () => {
      // Após terminar o seeking, restaurar reprodução apenas se apropriado
      restorePlayStateAfterSeeking();
    };
    
    const handleFullscreenChange = () => {
      const isNowFullScreen = document.fullscreenElement === playerRef.current;
      setIsFullScreen(isNowFullScreen);
      
      // Se saiu da tela cheia (detecta quando o usuário pressiona ESC)
      if (!isNowFullScreen && videoRef.current) {
        console.log('Saindo da tela cheia via evento (possivelmente tecla ESC)');
        
        // Restaurar para o formato original
        if (videoRef.current) {
          // Limpar todos os estilos inline
          videoRef.current.style.objectFit = '';
          videoRef.current.style.width = '';
          videoRef.current.style.height = '';
          
          // Remover classes adicionadas
          videoRef.current.classList.remove('absolute', 'inset-0');
          
          // Para vídeos do dashboard, garantir as classes corretas
          if (isDashboardVideo) {
            videoRef.current.className = 'w-full h-96 object-cover';
          } else {
            videoRef.current.className = 'w-full h-full object-contain';
          }
          
          console.log('Restaurando para o formato original do aplicativo');
        }
        
        // Restaurar o estilo do container
        if (playerRef.current) {
          playerRef.current.style.backgroundColor = '';
        }
      }
    };
    
    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('seeked', handleSeeked);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      // Salvar o estado de pausa do usuário quando o componente é desmontado
      if (userPausedRef.current) {
        localStorage.setItem(`video-paused-${videoKey}`, 'true');
        
        // Salvar também a posição atual para restaurar quando voltar
        if (video.currentTime > 0) {
          localStorage.setItem(`video-position-${videoKey}`, video.currentTime.toString());
        }
      } else {
        // Se o vídeo não estava pausado pelo usuário, limpar todos os dados
        localStorage.removeItem(`video-paused-${videoKey}`);
        localStorage.removeItem(`video-position-${videoKey}`);
        
        // Salvar o estado atual e posição para restaurar ao navegar de volta
        localStorage.setItem(`video-last-position-${videoKey}`, video.currentTime.toString());
        localStorage.setItem(`video-was-playing-${videoKey}`, (!video.paused).toString());
      }
      
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('seeked', handleSeeked);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [videoKey, autoPlay]);

  // Reset do vídeo quando o src muda (idioma mudou)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    // Para o vídeo do dashboard, nunca mostrar carregamento
    if (videoKey === "video.main") {
      setIsLoading(false);
      return;
    }
    
    // Se o vídeo estava pausado pelo usuário, não redefina o tempo
    if (userPausedRef.current || video.hasAttribute("data-user-paused")) {
      setIsLoading(true);
      setHasError(false);
      return;
    }
    
    // Redefine o tempo atual
    setCurrentTime(0);
    video.currentTime = 0;
    setIsLoading(true);
    setHasError(false);
    
    // Quando src muda, queremos ter certeza que o vídeo será carregado novamente
    video.load();
    
    // Se estava reproduzindo, continua reproduzindo após a mudança de src
    if (isPlaying) {
      attemptPlayVideo(video);
    }
  }, [src, isPlaying]);

  // Efeito para controlar o comportamento de reprodução e volume do vídeo
  useEffect(() => {
    // Define o volume inicial e aplica ao vídeo
    const video = videoRef.current;
    if (!video) return;
    
    // Aplicar volume sem alterar o estado de reprodução
    video.volume = volume / 100;
    
    // CORREÇÃO: Inicialização específica para vídeo da dashboard
    if (isDashboardVideo && autoPlay && !video.hasAttribute("data-initialized")) {
      // Configurando vídeo
      video.loop = true;
      video.muted = true;
      video.setAttribute("data-initialized", "true");
      
      // Só tentar reproduzir se não foi pausado manualmente
      if (!isUserPaused() && video.readyState >= 3) {
        console.log('▶️ [INIT-DASHBOARD] Iniciando reprodução automática');
        attemptPlayVideo(video);
      }
    }
  }, [videoKey, autoPlay, isPlaying]);

  // Efeito separado para controlar apenas o volume
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    // Aplicar apenas o volume sem alterar reprodução
    video.volume = volume / 100;
  }, [volume]);

  // Sobrescrever o método load do elemento de vídeo para evitar recarregamento quando pausado pelo usuário
  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoKey !== "video.main") return;
    
    // Salvar a referência original do método load
    const originalLoad = video.load;
    
    // Sobrescrever o método load
    video.load = function() {
      if (preventLoadRef.current || userPausedRef.current) {
        // Carregamento bloqueado
        
        // Restaurar a posição do vídeo se houver uma salva
        const savedPosition = video.getAttribute("data-pause-position");
        if (savedPosition) {
          const position = parseFloat(savedPosition);
          video.currentTime = position;
        }
        
        return;
      }
      
      // Se não estiver pausado pelo usuário, proceder com carregamento normal
      return originalLoad.apply(this);
    };
    
    return () => {
      // Restaurar o método original ao desmontar
      if (video) {
        video.load = originalLoad;
      }
    };
  }, [videoKey]);

  // Adicionar manipulador para eventos de carregamento específicos do vídeo
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Quando o componente é montado, verificar se havia um estado de pausa salvo anteriormente
    const wasPreviouslyPaused = localStorage.getItem(`video-paused-${videoKey}`);
    if (wasPreviouslyPaused === 'true') {
      userPausedRef.current = true;
      preventLoadRef.current = true;
      video.setAttribute("data-user-paused", "true");
      
      // Restaurar a posição do vídeo se houver uma salva
      const savedPosition = localStorage.getItem(`video-position-${videoKey}`);
      if (savedPosition) {
        const position = parseFloat(savedPosition);
        // Restaurando posição
        video.currentTime = position;
        video.setAttribute("data-pause-position", position.toString());
      }
      
      // Não iniciar reprodução automática se o vídeo estava pausado anteriormente
      setIsPlaying(false);
    }

    const updateTime = () => {
      // Não atualizar posição da barra durante seeking pelo usuário
      if (!isUserSeeking && !isDraggingProgress) {
        setCurrentTime(video.currentTime);
      }
    };
    const updateDuration = () => {
      setDuration(video.duration);
      // Duração carregada (silenciado)
    };
    const handlePlay = () => {
      // Atualizar o estado de reprodução
      setIsPlaying(true);
      // Garantir que não mostre carregamento quando o vídeo está reproduzindo
      setIsLoading(false);
      
      // Quando o vídeo começa a reproduzir, podemos limpar as flags de pausa
      // mas apenas se não tiver sido pausado pelo usuário
      if (!userPausedRef.current && !video.hasAttribute("data-user-paused")) {
        preventLoadRef.current = false;
      }
      
      // Atualizar botão de tela cheia se existir
      updateFullscreenPlayButton(true);
    };
    const handlePause = () => {
      setIsPlaying(false);
      // Quando o vídeo é pausado programaticamente, não consideramos como pausa de usuário
      // O atributo data-user-paused é definido apenas pelo método togglePlay
      
      // Atualizar botão de tela cheia se existir
      updateFullscreenPlayButton(false);
    };
    
    const handleLoadStart = () => {
      // Nunca mostrar carregamento para o vídeo do dashboard
      if (videoKey === "video.main") {
        setIsLoading(false);
        return;
      }
      
      // Verificar se o vídeo foi pausado pelo usuário, está sendo mostrado após estar oculto,
      // ou se estamos voltando para uma página que já foi visitada
      const hasLastPosition = localStorage.getItem(`video-last-position-${videoKey}`) !== null;
      
      if (userPausedRef.current || 
          preventLoadRef.current || 
          showingAfterHidden || 
          videoRef.current?.hasAttribute("data-user-paused") || 
          videoRef.current?.hasAttribute("data-shown-after-hidden") ||
          hasLastPosition) {
        console.log(`Evento loadstart ignorado porque o vídeo ${videoKey} foi pausado pelo usuário, está sendo exibido após estar oculto, ou estamos voltando para uma página já visitada`);
        setIsLoading(false);
        return;
      }
      
      console.log(`Iniciando carregamento do vídeo ${videoKey}`);
      setIsLoading(true);
    };
    const handleCanPlay = () => {
      // Nunca mostrar carregamento para o vídeo do dashboard
      if (videoKey === "video.main") {
        setIsLoading(false);
        return;
      }
      
      // Verificar se há uma posição salva anteriormente
      const hasLastPosition = localStorage.getItem(`video-last-position-${videoKey}`) !== null;
      const wasPlaying = localStorage.getItem(`video-was-playing-${videoKey}`) === 'true';
      
      if (userPausedRef.current || 
          preventLoadRef.current || 
          videoRef.current?.hasAttribute("data-user-paused") || 
          videoRef.current?.hasAttribute("data-shown-after-hidden")) {
        console.log(`Evento canplay ignorado porque o vídeo ${videoKey} foi pausado pelo usuário`);
        setIsLoading(false);
        return;
      }
      
      console.log(`Vídeo ${videoKey} pode ser reproduzido agora`);
      setIsLoading(false);
      
      // Verificar várias condições antes de iniciar a reprodução automática
      const isMainVideo = (videoKey as string) === "video.main";
      if (autoPlay && 
          isMainVideo && 
          !videoRef.current?.hasAttribute("data-autoplay-handled") && 
          !userPausedRef.current && 
          !preventLoadRef.current && 
          !videoRef.current?.hasAttribute("data-user-paused")) {
        
        if (videoRef.current) {
          videoRef.current.setAttribute("data-autoplay-handled", "true");
          attemptPlayVideo(videoRef.current);
        }
      }
      
      // Se estamos voltando para uma página já visitada e o vídeo estava reproduzindo antes
      if (hasLastPosition && wasPlaying && !userPausedRef.current && videoRef.current) {
        // Restaurar posição
        const lastPosition = localStorage.getItem(`video-last-position-${videoKey}`);
        if (lastPosition) {
          const position = parseFloat(lastPosition);
          if (!isNaN(position) && isFinite(position)) {
            videoRef.current.currentTime = position;
            setCurrentTime(position);
            console.log(`Restaurando vídeo ${videoKey} para posição salva: ${position} e continuando reprodução`);
            
            // Continuar reprodução se estava reproduzindo antes
            attemptPlayVideo(videoRef.current);
          }
        }
      }
    };
    const handleError = (e: Event) => {
      console.error(`Erro ao carregar o vídeo ${videoKey}:`, video.error);
      console.error('Código do erro:', video.error?.code);
      console.error('Mensagem do erro:', video.error?.message);
      console.error('Caminho do vídeo:', video.src);
      setHasError(true);
      setIsLoading(false);
    };
    const handleFullscreenChange = () => {
      const isNowFullScreen = document.fullscreenElement === playerRef.current;
      setIsFullScreen(isNowFullScreen);
      
      // Se saiu da tela cheia (detecta quando o usuário pressiona ESC)
      if (!isNowFullScreen && videoRef.current) {
        console.log('Saindo da tela cheia via evento (possivelmente tecla ESC)');
        
        // Restaurar para o formato original
        if (videoRef.current) {
          // Limpar todos os estilos inline
          videoRef.current.style.objectFit = '';
          videoRef.current.style.width = '';
          videoRef.current.style.height = '';
          
          // Remover classes adicionadas
          videoRef.current.classList.remove('absolute', 'inset-0');
          
          // Para vídeos do dashboard, garantir as classes corretas
          if (isDashboardVideo) {
            videoRef.current.className = 'w-full h-96 object-cover';
          } else {
            videoRef.current.className = 'w-full h-full object-contain';
          }
          
          console.log('Restaurando para o formato original do aplicativo');
        }
        
        // Restaurar o estilo do container
        if (playerRef.current) {
          playerRef.current.style.backgroundColor = '';
        }
      }
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      // Salvar o estado de pausa do usuário quando o componente é desmontado
      if (userPausedRef.current) {
        localStorage.setItem(`video-paused-${videoKey}`, 'true');
        
        // Salvar também a posição atual para restaurar quando voltar
        if (video.currentTime > 0) {
          localStorage.setItem(`video-position-${videoKey}`, video.currentTime.toString());
        }
      } else {
        // Se o vídeo não estava pausado pelo usuário, limpar todos os dados
        localStorage.removeItem(`video-paused-${videoKey}`);
        localStorage.removeItem(`video-position-${videoKey}`);
        
        // Salvar o estado atual e posição para restaurar ao navegar de volta
        localStorage.setItem(`video-last-position-${videoKey}`, video.currentTime.toString());
        localStorage.setItem(`video-was-playing-${videoKey}`, (!video.paused).toString());
      }
      
      // Remover todos os event listeners
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [videoKey, autoPlay]);

  // Controle de volume inspirado no YouTube/Spotify
  const handleVolumeChange = (e: React.MouseEvent | MouseEvent) => {
    if (!volumeBarRef.current || !videoRef.current) return;
    
    // Impedir que o evento propague e cause comportamentos indesejados
    e.preventDefault();
    e.stopPropagation();
    
    // Obter posição relativa do clique na barra
    const rect = volumeBarRef.current.getBoundingClientRect();
    // Posição invertida (0 é embaixo, 100 é em cima)
    const clickPosition = (rect.bottom - e.clientY) / rect.height;
    // Limitar entre 0 e 1
    const volumeRatio = Math.max(0, Math.min(1, clickPosition));
    // Converter para porcentagem
    const newVolume = Math.round(volumeRatio * 100);
    
    console.log(`Ajustando volume para: ${newVolume}%`);
    
    // Atualizar o volume do vídeo diretamente sem afetar a reprodução
    if (videoRef.current) {
      // Salvar o estado de reprodução atual
      const wasPlaying = !videoRef.current.paused;
      
      // Ajustar volume sem afetar a reprodução
      videoRef.current.volume = volumeRatio;
      
      // Gerenciar o estado mudo sem afetar a reprodução
      if (newVolume === 0) {
        videoRef.current.muted = true;
        setIsMuted(true);
        // Manter a barra de volume visível mesmo quando mudo
        setShowVolumeBar(true);
      } else {
        // Sempre desmutar quando o volume for > 0, mesmo durante o arrasto
        videoRef.current.muted = false;
        setIsMuted(false);
      }
      
      // Garantir que o estado de reprodução seja mantido
      if (wasPlaying && videoRef.current.paused) {
        videoRef.current.play().catch(() => {
          // Ignorar erros de reprodução aqui para não interromper o ajuste de volume
          console.log("Não foi possível manter a reprodução durante o ajuste de volume");
        });
      }
    }
    
    // Atualizar o estado para refletir a UI
    setVolume(newVolume);
    
    // Guardar o último volume não-zero
    if (newVolume > 0) {
      setLastVolume(newVolume);
    }
  };
  
  // Iniciar o arrasto do controle de volume
  const startVolumeSliderDrag = (e: React.MouseEvent) => {
    if (!volumeBarRef.current || !videoRef.current) return;
    
    // Impedir que o evento propague e pause o vídeo
    e.preventDefault();
    e.stopPropagation();
    
    // Aplicar o volume no clique inicial
    handleVolumeChange(e);
    setIsDraggingVolume(true);
    
    // Limpar qualquer timer existente durante o arrasto
    if (volumeTimerRef.current) {
      clearTimeout(volumeTimerRef.current);
      volumeTimerRef.current = null;
    }
    
    // Função para lidar com movimento do mouse durante o arrasto
    const handleDragMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      handleVolumeChange(moveEvent);
      
      // Limpar qualquer timer durante o movimento
      if (volumeTimerRef.current) {
        clearTimeout(volumeTimerRef.current);
        volumeTimerRef.current = null;
      }
    };
    
    // Função para finalizar o arrasto
    const handleDragEnd = (upEvent: MouseEvent) => {
      upEvent.preventDefault();
      upEvent.stopPropagation();
      setIsDraggingVolume(false);
      
      // Remover os listeners
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      
      // Iniciar o timer apenas após soltar o mouse
      volumeTimerRef.current = setTimeout(() => {
        setShowVolumeBar(false);
      }, 2000);
    };
    
    // Adicionar os listeners ao documento
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };

  // Toggle play/pause ULTRA-SIMPLIFICADO - CORREÇÃO DEFINITIVA
  const togglePlay = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const video = videoRef.current;
    if (!video) return;

    // Verificar se o vídeo tem uma fonte válida
    if (!video.src || video.src === '' || video.src === window.location.href) {
      console.warn('⚠️ [PLAY] Vídeo sem fonte válida. Ignorando play.');
      setIsPlaying(false);
      setIsLoading(false);
      return;
    }

    console.log(`🎬 [TOGGLE] Estado atual: ${video.paused ? 'PAUSADO' : 'TOCANDO'}`);
    
    // LÓGICA ULTRA-SIMPLIFICADA: Se pausado -> tocar, Se tocando -> pausar
    if (video.paused) {
      // DESPAUSAR: Iniciar reprodução
      // Configurar loop apenas para vídeo da dashboard
      if (isDashboardVideo) {
        video.loop = true;
      }
      
      video.play()
        .then(() => {
          console.log('✅ [PLAY] Vídeo iniciado com sucesso');
          setIsPlaying(true);
          setIsLoading(false);
          // Limpar estados de pausa manual
          video.removeAttribute("data-user-paused");
          userPausedRef.current = false;
          localStorage.removeItem(`video-paused-${videoKey}`);
        })
        .catch(err => {
          console.error('❌ [PLAY] Erro ao iniciar vídeo:', err);
          setIsPlaying(false);
          setIsLoading(false);
        });
    } else {
      // PAUSAR: Parar reprodução
      video.pause();
      console.log('⏸️ [PAUSE] Vídeo pausado');
      setIsPlaying(false);
      setIsLoading(false);
      
      // Desativar loop temporariamente quando pausado manualmente
      if (isDashboardVideo) {
        video.loop = false;
      }
      
      // Marcar como pausado manualmente
      video.setAttribute("data-user-paused", "true");
      userPausedRef.current = true;
      
      // Salvar posição e estado
      localStorage.setItem(`video-paused-${videoKey}`, 'true');
      localStorage.setItem(`video-position-${videoKey}`, video.currentTime.toString());
    }
  };

  // CORREÇÃO: Efeito de sincronização estado React <-> HTML Video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncStateWithVideo = () => {
      const videoIsPlaying = !video.paused && !video.ended && video.readyState > 2;
      if (isPlaying !== videoIsPlaying) {
        // Estado dessincronizado - corrigindo
        setIsPlaying(videoIsPlaying);
      }
    };

    // Sincronizar imediatamente
    syncStateWithVideo();

    // Sincronizar a cada 2 segundos para capturar mudanças não detectadas
    const syncInterval = setInterval(syncStateWithVideo, 2000);

    return () => {
      clearInterval(syncInterval);
    };
  }, [isPlaying]);

  // Função para capturar o frame atual do vídeo
  const captureVideoFrame = (video: HTMLVideoElement) => {
    try {
      // Criar um canvas com as dimensões do vídeo
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Desenhar o frame atual do vídeo no canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Converter o canvas para uma URL de dados
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        // Armazenar a URL para uso posterior
        setCurrentFrameUrl(dataUrl);
        console.log('Frame do vídeo capturado com sucesso');
      }
    } catch (err) {
      console.error('Erro ao capturar frame do vídeo:', err);
      setCurrentFrameUrl(null);
    }
  };

  const generateThumbnail = (video: HTMLVideoElement, time: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Usar o canvas ref se disponível, senão criar um novo
      let canvas = thumbnailCanvasRef.current;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        thumbnailCanvasRef.current = canvas;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Não foi possível obter contexto do canvas'));
        return;
      }
      
      // Criar um vídeo temporário para buscar o frame
      const tempVideo = document.createElement('video');
      tempVideo.src = video.src;
      tempVideo.muted = true;
      tempVideo.preload = 'metadata';
      tempVideo.currentTime = time;
      
      const handleSeeked = () => {
        try {
          ctx.drawImage(tempVideo, 0, 0, canvas!.width, canvas!.height);
          const dataURL = canvas!.toDataURL('image/jpeg', 0.7);
          
          tempVideo.removeEventListener('seeked', handleSeeked);
          tempVideo.removeEventListener('error', handleError);
          tempVideo.remove();
          
          resolve(dataURL);
        } catch (error) {
          tempVideo.removeEventListener('seeked', handleSeeked);
          tempVideo.removeEventListener('error', handleError);
          tempVideo.remove();
          reject(error);
        }
      };
      
      const handleError = (error: Event) => {
        tempVideo.removeEventListener('seeked', handleSeeked);
        tempVideo.removeEventListener('error', handleError);
        tempVideo.remove();
        reject(new Error('Erro ao gerar thumbnail'));
      };
      
      tempVideo.addEventListener('seeked', handleSeeked);
      tempVideo.addEventListener('error', handleError);
    });
  };

  // Funções para controles avançados de tempo - TOTALMENTE CORRIGIDAS
  const skipTime = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    // Preservar estado ANTES de qualquer mudança
    const wasPlaying = preservePlayStateForSeeking();
    
    // Calcular novo tempo
    const newTime = Math.max(0, Math.min(video.currentTime + seconds, duration));
    
    console.log(`[SKIP] ⏭️ ${seconds}s: ${video.currentTime.toFixed(2)}→${newTime.toFixed(2)} | era ${wasPlaying ? 'TOCANDO' : 'PAUSADO'}`);
    
    // Mudar posição IMEDIATAMENTE
    video.currentTime = newTime;
    setCurrentTime(newTime);
    
    // Aplicar nova lógica: manter estado original (pausado continua pausado)
    restorePlayStateAfterSeeking();
  };

  const jumpToTime = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    // Preservar estado ANTES de qualquer mudança  
    const wasPlaying = preservePlayStateForSeeking();
    
    // Calcular tempo limitado
    const clampedTime = Math.max(0, Math.min(time, duration));
    
    console.log(`[JUMP] 🎯 Para ${clampedTime.toFixed(2)}s | era ${wasPlaying ? 'TOCANDO' : 'PAUSADO'}`);
    
    // Mudar posição IMEDIATAMENTE
    video.currentTime = clampedTime;
    setCurrentTime(clampedTime);
    
    // Aplicar nova lógica: manter estado original (pausado continua pausado)
    restorePlayStateAfterSeeking();
  };

  // Função auxiliar para seeking direto (clique único) - ULTRA-RESPONSIVA
  const seekToPosition = (clientX: number) => {
    if (!progressBarRef.current || !duration) return;
    
    const video = videoRef.current;
    if (!video) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = percentage * duration;
    
    console.log(`[SEEK] 🎯 Direto para ${newTime.toFixed(2)}s | era ${wasPlayingBeforeSeekRef.current ? 'TOCANDO' : 'PAUSADO'}`);
    
    // Atualizar posição IMEDIATAMENTE
    video.currentTime = newTime;
    setCurrentTime(newTime);
    
    // NÃO restaurar estado aqui - será feito no mouseUp
  };

  // Manipuladores da barra de progresso - MELHORADOS
  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const video = videoRef.current;
    if (!video) return;
    
    // SEMPRE preservar o estado atual antes de qualquer seeking
    preservePlayStateForSeeking();
    
    // Para clique simples: seeking direto e responsivo
    seekToPosition(e.clientX);
    
    // Marcar como arrastando para eventos subsequentes
    setIsDraggingProgress(true);
  };

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const previewTime = percentage * duration;
    
    setProgressPreviewTime(previewTime);
    setProgressPreviewPosition(e.clientX - rect.left);
    setShowProgressPreview(true);
    
    // Debounce suave para geração de thumbnail em tempo real
    if (thumbnailTimeoutRef.current) {
      clearTimeout(thumbnailTimeoutRef.current);
    }
    
    thumbnailTimeoutRef.current = setTimeout(async () => {
      if (videoRef.current) {
        try {
          const thumbnail = await generateThumbnail(videoRef.current, previewTime);
          setPreviewThumbnail(thumbnail);
        } catch (error) {
          console.warn('Erro ao gerar thumbnail:', error);
          setPreviewThumbnail(null);
        }
      }
    }, 100);
    
    // Durante o arrastar, atualizar posição do vídeo SEM log excessivo
    if (isDraggingProgress && videoRef.current) {
      videoRef.current.currentTime = previewTime;
      setCurrentTime(previewTime);
    }
  };

  const handleProgressMouseLeave = () => {
    setShowProgressPreview(false);
    setPreviewThumbnail(null);
    
    // Limpar timeout de thumbnail quando sair da área
    if (thumbnailTimeoutRef.current) {
      clearTimeout(thumbnailTimeoutRef.current);
      thumbnailTimeoutRef.current = null;
    }
  };

  const handleProgressMouseUp = () => {
    console.log(`[PROGRESS] 🏁 Finalizando drag | era ${wasPlayingBeforeSeekRef.current ? 'TOCANDO' : 'PAUSADO'}`);
    
    setIsDraggingProgress(false);
    
    // Restaurar estado IMEDIATAMENTE (sem timeout que causa bugs)
    restorePlayStateAfterSeeking();
  };

  // Auto-hide dos controles
  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    setShowControls(true);
    
    if (isPlaying && !isDashboardVideo) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const handleMouseMove = () => {
    resetControlsTimeout();
  };

  const handleMouseEnter = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
  };



  const handleMouseLeave = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(false);
  };

  // Cleanup dos timeouts
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (thumbnailTimeoutRef.current) {
        clearTimeout(thumbnailTimeoutRef.current);
      }
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
    };
  }, []);

  // Gerenciar visibilidade dos controles
  useEffect(() => {
    if (isPlaying && !isDashboardVideo) {
      resetControlsTimeout();
    } else {
      // Não mostrar controles automaticamente, apenas no hover
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [isPlaying, isDashboardVideo]);

  // Event listeners globais para arrastar - TOTALMENTE CORRIGIDOS
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      console.log(`[GLOBAL] 🌍 Finalizando drag | era ${wasPlayingBeforeSeekRef.current ? 'TOCANDO' : 'PAUSADO'}`);
      
      setIsDraggingProgress(false);
      
      // Restaurar estado IMEDIATAMENTE (sem timeout que causa conflitos)
      restorePlayStateAfterSeeking();
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingProgress && progressBarRef.current && duration) {
        e.preventDefault();
        
        // Durante arrastar: apenas atualizar posição (SEM preservar/restaurar estado)
        const rect = progressBarRef.current.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const newTime = percentage * duration;
        
        const video = videoRef.current;
        if (video) {
          video.currentTime = newTime;
          setCurrentTime(newTime);
        }
      }
    };

    if (isDraggingProgress) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('mousemove', handleGlobalMouseMove);
    }

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [isDraggingProgress, duration]);

  // Mostrar a barra de volume ao passar o mouse sobre o botão de volume
  const handleVolumeHover = () => {
    if (!isMuted) {
      setShowVolumeBar(true);
      // Limpar qualquer timer existente ao passar o mouse
      if (volumeTimerRef.current) {
        clearTimeout(volumeTimerRef.current);
        volumeTimerRef.current = null;
      }
    }
  };
  
  // Iniciar o timer para esconder a barra quando o mouse sair
  const handleVolumeLeave = () => {
    // Só iniciar o timer se não estiver arrastando
    if (!isDraggingVolume) {
      volumeTimerRef.current = setTimeout(() => {
        setShowVolumeBar(false);
      }, 2000);
    }
  };
  
  // Limpar o timer quando o usuário interage com a barra de volume
  const handleVolumeInteraction = () => {
    // Limpar qualquer timer existente
    if (volumeTimerRef.current) {
      clearTimeout(volumeTimerRef.current);
      volumeTimerRef.current = null;
    }
  };

  const changeVolume = (amount: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    const newVolume = Math.max(0, Math.min(100, volume + amount));
    setVolume(newVolume);
    video.volume = newVolume / 100;
    
    // Se o volume estiver em 0, mute o vídeo
    if (newVolume === 0) {
      setIsMuted(true);
      video.muted = true;
    } 
    // Se o volume estiver acima de 0, sempre desmute
    else if (newVolume > 0) {
      setIsMuted(false);
      video.muted = false;
    }
  };

  // Toggle Mute com preservação de volume e do estado de reprodução
  const toggleMute = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const video = videoRef.current;
    if (!video) return;
    
    // Salvar o estado de reprodução
    const wasPlaying = !video.paused;

    if (isMuted) {
      // Ativar o som com o último volume usado (garantir valor mínimo)
      const volumeToSet = Math.max(lastVolume, 10);
      video.muted = false;
      video.volume = volumeToSet / 100;
      setVolume(volumeToSet);
      setIsMuted(false);
      setShowVolumeBar(true); // Mostrar a barra de volume ao ativar o som
    } else {
      // Guardar o volume atual antes de mutar
      if (volume > 0) {
        setLastVolume(volume);
      }
      video.muted = true;
      setIsMuted(true);
      // Manter a barra de volume visível mesmo quando mutado
      setShowVolumeBar(true);
    }
    
    // Restaurar o estado de reprodução se necessário
    if (wasPlaying && video.paused) {
      video.play().catch(() => {
        console.log("Não foi possível restaurar a reprodução após mutar/desmutar");
      });
    }
  };

  // Alternar a visibilidade da barra de volume
  const toggleVolumeBar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isMuted) {
      // Se estiver mudo, ativar o som ao clicar no ícone
      toggleMute();
    } else {
      // Se tiver som, mutar ao clicar no ícone
      toggleMute();
    }
  };

  // Alternar para o modo de tela cheia com estilo de exibição adaptado
  const toggleFullScreen = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!playerRef.current) return;

    console.log(`Tentando ${isFullScreen ? 'sair de' : 'entrar em'} tela cheia`);

    if (!isFullScreen) {
      if (playerRef.current.requestFullscreen) {
        playerRef.current.requestFullscreen()
          .then(() => {
            // Quando entra em tela cheia, ajusta para exibição completa
            if (videoRef.current) {
              // Alterar para conter (não cortar) em tela cheia
              videoRef.current.style.objectFit = 'contain';
              videoRef.current.style.width = '100%';
              videoRef.current.style.height = '100%';
              videoRef.current.classList.add('absolute', 'inset-0');
              
              console.log('Entrando em tela cheia com objectFit: contain e dimensões 100%');
            }
            
            // Ajustar o container também
            if (playerRef.current) {
              playerRef.current.style.backgroundColor = 'black';
            }
            
            // Adicionar container com controles na tela cheia (botão de saída e play/pause)
            const controlsContainer = document.createElement('div');
            controlsContainer.id = 'fullscreen-controls-container';
            controlsContainer.className = 'absolute bottom-6 right-6 flex gap-3 z-50';
            
            // Botão de play/pause
            const playPauseButton = document.createElement('button');
            playPauseButton.id = 'fullscreen-play-pause-button';
            playPauseButton.className = 'p-3 rounded-md bg-black/60 hover:bg-black/80 transition-colors transform hover:scale-110 transition-transform duration-200';
            playPauseButton.innerHTML = isPlaying 
              ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
              : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><polygon points="5,3 19,12 5,21"></polygon></svg>';
            playPauseButton.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              togglePlay();
              // Atualizar o ícone do botão
              playPauseButton.innerHTML = !isPlaying 
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><polygon points="5,3 19,12 5,21"></polygon></svg>';
            };
            
            // Botão de saída da tela cheia
            const exitButton = document.createElement('button');
            exitButton.id = 'exit-fullscreen-button';
            exitButton.className = 'p-3 rounded-md bg-black/60 hover:bg-black/80 transition-colors transform hover:scale-110 transition-transform duration-200';
            exitButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M8 3v3a2 2 0 0 1-2 2H3"></path><path d="M21 8h-3a2 2 0 0 1-2-2V3"></path><path d="M3 16h3a2 2 0 0 1 2 2v3"></path><path d="M16 21v-3a2 2 0 0 1 2-2h3"></path></svg>';
            exitButton.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              document.exitFullscreen();
            };
            
            // Remover container se já existir
            const existingContainer = document.getElementById('fullscreen-controls-container');
            if (existingContainer) {
              existingContainer.remove();
            }
            
            // Adicionar botões ao container
            controlsContainer.appendChild(playPauseButton);
            controlsContainer.appendChild(exitButton);
            
            playerRef.current.appendChild(controlsContainer);
          })
          .catch(err => {
            console.error("Erro ao entrar em tela cheia:", err);
          });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
          .then(() => {
            // Ao sair de tela cheia, restaura o formato original
            if (videoRef.current) {
              // Limpar todos os estilos inline
              videoRef.current.style.objectFit = '';
              videoRef.current.style.width = '';
              videoRef.current.style.height = '';
              
              // Remover classes adicionadas
              videoRef.current.classList.remove('absolute', 'inset-0');
              
              // Para vídeos do dashboard, garantir as classes corretas
              if (isDashboardVideo) {
                videoRef.current.className = 'w-full h-96 object-cover';
              } else {
                videoRef.current.className = 'w-full h-full object-contain';
              }
              
              console.log('Saindo de tela cheia e restaurando para o formato original do aplicativo');
            }
            
            // Restaurar o estilo do container
            if (playerRef.current) {
              playerRef.current.style.backgroundColor = '';
            }
            
            // Remover o container de controles da tela cheia
            const controlsContainer = document.getElementById('fullscreen-controls-container');
            if (controlsContainer) {
              controlsContainer.remove();
            }
          })
          .catch(err => {
            console.error("Erro ao sair de tela cheia:", err);
          });
      }
    }
  };

  // Adicionar um ouvinte para o evento fullscreenchange para garantir que os controles sejam removidos
  useEffect(() => {
    const handleFullScreenChange = () => {
      // Se saiu da tela cheia, remover o container de controles
      if (!document.fullscreenElement) {
        const controlsContainer = document.getElementById('fullscreen-controls-container');
        if (controlsContainer) {
          controlsContainer.remove();
        }
      }
    };
    
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    // Preservar estado antes do seek
    const wasPlaying = preservePlayStateForSeeking();
    
    const newTime = parseFloat(e.target.value);
    
    console.log(`[SEEK] 🎚️ Para ${newTime.toFixed(2)}s | era ${wasPlaying ? 'TOCANDO' : 'PAUSADO'}`);
    
    // Mudar posição IMEDIATAMENTE
    video.currentTime = newTime;
    setCurrentTime(newTime);
    
    // Aplicar nova lógica: manter estado original (pausado continua pausado)
    restorePlayStateAfterSeeking();
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  const toggleHideVideo = () => {
    // Se está mostrando o vídeo depois dele estar oculto
    if (isHidden) {
      setShowingAfterHidden(true);
      
      // Garantir que não mostre o indicador de carregamento
      setIsLoading(false);
      
      // Adicionar atributo para evitar que o indicador de carregamento seja mostrado
      if (videoRef.current) {
        videoRef.current.setAttribute("data-user-paused", "true");
        userPausedRef.current = true;
        preventLoadRef.current = true;
      }
      
      // Resetar o estado após um período maior para garantir que o carregamento não apareça
      setTimeout(() => {
        setShowingAfterHidden(false);
        
        // Só remover os atributos se o vídeo estiver reproduzindo
        const video = videoRef.current;
        if (video && isPlaying && !video.paused) {
          video.removeAttribute("data-user-paused");
          userPausedRef.current = false;
          preventLoadRef.current = false;
        }
      }, 3000);
    }
    
    setIsHidden(!isHidden);
    
    // Quando mostrar o vídeo novamente, não deve mostrar o indicador de carregamento
    if (isHidden) {
      // Garantir que o indicador de carregamento não apareça
      setIsLoading(false);
      
      // Se o vídeo já estava carregado anteriormente, manter seu estado
      const video = videoRef.current;
      if (video) {
        // Remover atributos que possam impedir o carregamento/reprodução normal
        video.removeAttribute("data-prevent-load");
        video.removeAttribute("data-reloading");
        
        // Garantir que o som esteja ativo conforme as configurações
        if (!muted && !isMuted) {
          video.muted = false;
          video.volume = volume / 100;
        }
        
        // Tentar reproduzir o vídeo, ignorando o estado anterior
        if (isPlaying || autoPlay) {
          setTimeout(() => {
            if (video) {
              video.play().catch(() => {
                console.log("Não foi possível reproduzir o vídeo ao mostrar novamente");
              });
            }
          }, 50);
        }
      }
    }
  };

  // Clique no vídeo - ULTRA-SIMPLIFICADO
  const handleVideoClick = () => {
    const video = videoRef.current;
    if (!video) return;
    
    // Verificar se o vídeo tem uma fonte válida
    if (!video.src || video.src === '' || video.src === window.location.href) {
      console.warn('⚠️ [CLICK] Vídeo sem fonte válida. Ignorando clique.');
      return;
    }
    
    console.log('🖱️ [CLICK] Clique no vídeo detectado');
    togglePlay();
  };


  
  const reloadVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    
    // Não mostrar o indicador de carregamento
    setIsLoading(false);
    setHasError(false);
    
    // Se o usuário pausou o vídeo e quer recarregá-lo, precisamos permitir temporariamente o carregamento
    if (userPausedRef.current || preventLoadRef.current) {
      // Permitir o carregamento apenas temporariamente
      const tempPaused = userPausedRef.current;
      const savedPosition = video.getAttribute("data-pause-position");
      let position = 0;
      
      if (savedPosition) {
        position = parseFloat(savedPosition);
      }
      
      userPausedRef.current = false;
      preventLoadRef.current = false;
      
      // Recarregar o vídeo
      video.load();
      
      // Restaurar a posição salva
      if (savedPosition) {
        video.currentTime = position;
      }
      
      // Restaurar o estado de pausa após o carregamento
      userPausedRef.current = tempPaused;
      preventLoadRef.current = tempPaused;
      
      console.log('Vídeo recarregado mas mantendo estado de pausa');
      return;
    }
    
    // Recarregar o vídeo
    video.load();
    
    // Tentar reproduzir novamente
    // Verificar se o usuário pausou manualmente o vídeo
    if ((autoPlay || isPlaying) && !video.hasAttribute("data-user-paused")) {
      attemptPlayVideo(video);
    }
  };

  // Effect para recarregar o vídeo quando o src mudar (por exemplo, quando o idioma é alterado)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    // Fonte alterada
    
    // Definir diretamente o src
    if (video.src !== src) {
      // Salvar o estado de reprodução atual
      const wasPlaying = !video.paused && !video.ended && video.readyState > 2;
      const currentVolume = video.volume;
      const currentMuted = video.muted;
      
      // Atualizar o src
      video.src = src;
      
      // Configurar volume e mudo
      video.volume = currentVolume;
      video.muted = currentMuted;
      
      // Se o indicador de carregamento não deve ser mostrado
      if (showingAfterHidden) {
        setIsLoading(false);
      }
      
      // Garantir que o video seja carregado
      video.load();
      
      // Se estava reproduzindo, continuar a reprodução
      if (wasPlaying || autoPlay) {
        video.play().catch(err => {
          // Erro ao reproduzir vídeo (silenciado)
        });
      }
    }
  }, [src, autoPlay, showingAfterHidden]);

  // Adicionar um atributo personalizado para rastrear quando o vídeo foi mostrado após oculto
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Adicionar um atributo personalizado para rastrear quando o vídeo foi mostrado após oculto
    if (showingAfterHidden) {
      video.setAttribute("data-shown-after-hidden", "true");
      // Garantir que o indicador de carregamento não seja mostrado
      setIsLoading(false);
    }

    // Limpar o atributo após um período
    const cleanupTimer = setTimeout(() => {
      if (video && !userPausedRef.current && !preventLoadRef.current) {
        video.removeAttribute("data-shown-after-hidden");
      }
    }, 5000);

    return () => {
      clearTimeout(cleanupTimer);
    };
  }, [showingAfterHidden]);

  // Novo useEffect para lidar com visibilidade da página
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Função para salvar o estado do vídeo quando o usuário sai da página
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Página está invisível - salvar estado atual
        const isPaused = video.paused;
        const currentPosition = video.currentTime;
        
        // Salvar a posição atual para restaurar quando voltar
        lastVisibleTimeRef.current = currentPosition;
        
        // Salvar no localStorage para persistência entre navegações
        localStorage.setItem(`video-last-position-${videoKey}`, currentPosition.toString());
        localStorage.setItem(`video-was-playing-${videoKey}`, (!isPaused).toString());
        
        console.log(`Página ficou invisível. Vídeo ${videoKey} estava ${isPaused ? 'pausado' : 'reproduzindo'} na posição ${currentPosition}`);
        
        // Se o vídeo estava reproduzindo, pausar para economizar recursos
        if (!isPaused && !isDashboardVideo) {
          video.pause();
        }
      } else {
        // Página está visível novamente - restaurar estado
        const wasPlaying = localStorage.getItem(`video-was-playing-${videoKey}`) === 'true';
        const lastPosition = localStorage.getItem(`video-last-position-${videoKey}`);
        const userPaused = localStorage.getItem(`video-paused-${videoKey}`) === 'true';
        
        // Se o usuário pausou manualmente, não restaurar reprodução
        if (userPaused || userPausedRef.current || video.hasAttribute("data-user-paused")) {
          console.log(`Página visível novamente. Vídeo ${videoKey} permanece pausado por ação do usuário`);
          return;
        }
        
        // Restaurar posição se disponível
        if (lastPosition) {
          const position = parseFloat(lastPosition);
          if (!isNaN(position) && isFinite(position)) {
            video.currentTime = position;
            setCurrentTime(position);
            console.log(`Restaurando vídeo ${videoKey} para posição ${position}`);
          }
        }
        
        // Restaurar estado de reprodução se estava reproduzindo antes
        if (wasPlaying && !userPaused) {
          console.log(`Restaurando reprodução do vídeo ${videoKey}`);
          attemptPlayVideo(video);
        }
      }
    };

    // Registrar o evento de visibilidade
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Verificar se há uma posição salva ao montar o componente
    const lastPosition = localStorage.getItem(`video-last-position-${videoKey}`);
    const userPaused = localStorage.getItem(`video-paused-${videoKey}`) === 'true';
    
    if (lastPosition && !userPaused && !userPausedRef.current) {
      const position = parseFloat(lastPosition);
      if (!isNaN(position) && isFinite(position)) {
        video.currentTime = position;
        setCurrentTime(position);
        // Restaurando vídeo (silenciado)
      }
    }

    // Limpar evento ao desmontar
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [videoKey, isDashboardVideo]);

  // Se o vídeo estiver oculto, mostrar apenas um botão para revelar
  if (isHidden && canHide) {
    return (
      <div className="flex justify-end w-full">
        <style dangerouslySetInnerHTML={{ __html: animationStyles }} />
        <Button 
          variant="outline" 
          size="sm" 
          onClick={toggleHideVideo}
          className="border-white/10 bg-black/40 backdrop-blur-md hover:bg-white/10 flex items-center gap-2 transform hover:scale-105 transition duration-200"
        >
          <Eye className="h-3.5 w-3.5 opacity-80" /> Mostrar Vídeo
        </Button>
      </div>
    );
  }

  // Layout especial para o vídeo do dashboard
  if (isDashboardVideo && controls) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: animationStyles }} />
        <div className="flex items-start gap-3">
          {/* Controles laterais à esquerda */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                togglePlay(e);
              }}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors transform hover:scale-110 transition-transform duration-200"
              aria-label={isPlaying ? "Pausar" : "Reproduzir"}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white" />
              )}
            </button>
            
            <button
              ref={volumeButtonRef}
              onClick={toggleVolumeBar}
              onMouseEnter={handleVolumeHover}
              onMouseLeave={handleVolumeLeave}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors transform hover:scale-110 transition-transform duration-200 relative"
              aria-label={isMuted ? "Ativar som" : "Desativar som"}
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-white animate-pulse" />
              ) : volume < 50 ? (
                <Volume1 className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
              
              {/* A barra de volume aparece abaixo do botão apenas quando showVolumeBar está ativo */}
              {showVolumeBar && (
                <div 
                  className="absolute inset-x-0 top-full mt-2 flex flex-col items-center bg-black/60 backdrop-blur-md p-3 rounded-xl animate-slideIn z-50 shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/5"
                  onClick={(e) => e.stopPropagation()}
                  onMouseEnter={handleVolumeInteraction}
                  onMouseLeave={handleVolumeLeave}
                >
                  <div 
                    ref={volumeBarRef}
                    className="h-24 w-2 bg-zinc-900/20 rounded-full mb-2 relative cursor-pointer group"
                    onClick={(e) => {
                      handleVolumeChange(e);
                      handleVolumeInteraction();
                    }}
                    onMouseDown={(e) => {
                      startVolumeSliderDrag(e);
                      handleVolumeInteraction();
                    }}
                  >
                    {/* Barra de volume com gradiente suave */}
                    <div 
                      className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-300 ease-out"
                      style={{ 
                        height: `${volume}%`,
                        background: 'linear-gradient(to bottom, rgba(255,255,255,0.8), rgba(255,255,255,0.2))',
                        boxShadow: '0 0 10px rgba(255,255,255,0.1)'
                      }}
                    ></div>
                    
                    {/* Controle deslizante minimalista */}
                    <div 
                      className="absolute w-4 h-4 left-1/2 -translate-x-1/2 bg-white rounded-full transform -translate-y-1/2 shadow-[0_0_10px_rgba(255,255,255,0.2)] transition-all duration-300 ease-out group-hover:scale-110"
                      style={{ bottom: `${volume}%` }}
                    >
                      <div className="absolute inset-0 rounded-full border border-white/40"></div>
                    </div>
                  </div>
                  
                  {/* Indicador de volume minimalista */}
                  <div 
                    className="text-xs font-medium tracking-wider transition-all duration-300 ease-out"
                    style={{
                      color: 'rgba(255,255,255,0.8)',
                      textShadow: '0 0 5px rgba(255,255,255,0.2)'
                    }}
                  >
                    {volume}%
                  </div>
                </div>
              )}
            </button>
          </div>
          
          {/* Player de vídeo */}
          <div 
            ref={playerRef}
            className="relative w-full overflow-hidden bg-black/90 rounded-lg flex-1"
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div 
              className="relative w-full h-full cursor-pointer" 
              onClick={handleVideoClick}
            >
              {isLoading && !videoRef.current?.hasAttribute("data-reloading") && 
                !userPausedRef.current && !preventLoadRef.current && 
                !isHidden && !showingAfterHidden && 
                !videoRef.current?.hasAttribute("data-user-paused") && 
                !videoRef.current?.hasAttribute("data-shown-after-hidden") && 
                videoKey !== "video.main" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                  <div className="flex flex-col items-center">
                    <RefreshCw className="h-8 w-8 text-white animate-spin mb-2" />
                    <span className="text-white text-sm font-medium">Carregando vídeo...</span>
                    <span className="text-white/60 text-xs mt-1">Isso pode levar alguns segundos</span>
                  </div>
                </div>
              )}
              
              {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
                  <div className="flex flex-col items-center max-w-md px-6">
                    <Button 
                      variant="outline" 
                      onClick={reloadVideo}
                      className="border-white/20 bg-black/50 text-white hover:bg-white/10 flex items-center gap-2 mb-3"
                    >
                      <RefreshCw className="h-4 w-4" /> Tentar Novamente
                    </Button>
                    <span className="text-white/90 text-sm text-center font-medium mb-1">
                      Não foi possível carregar o vídeo
                    </span>
                    <span className="text-white/60 text-xs text-center">
                      O vídeo pode ser muito grande e estar demorando para carregar. Tente recarregar a página ou aguarde alguns instantes.
                    </span>
                  </div>
                </div>
              )}
              
              {/* Mostrar o frame capturado quando o vídeo estiver pausado */}
              {!isPlaying && currentFrameUrl && (
                <div className="absolute inset-0 z-5">
                  <img 
                    src={currentFrameUrl} 
                    alt="Frame pausado" 
                    className="w-full h-96 object-cover"
                  />
                </div>
              )}
              
              <video
                ref={videoRef}
                src={src}
                poster={poster}
                autoPlay={autoPlay}
                muted={muted}
                loop={loop}
                preload="metadata"
                className="w-full h-96 object-cover"
                playsInline
                onClick={(e) => e.stopPropagation()}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              
              {/* Controles avançados overlay para dashboard */}
              <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                {/* Barra de progresso avançada */}
                <div className="px-4 pt-6 pb-3">
                  {/* Área de hover expandida (invisível) */}
                  <div 
                    className="relative py-4 cursor-pointer"
                    onMouseDown={handleProgressMouseDown}
                    onMouseMove={handleProgressMouseMove}
                    onMouseLeave={handleProgressMouseLeave}
                    onMouseUp={handleProgressMouseUp}
                  >
                    {/* Barra visual */}
                    <div 
                      ref={progressBarRef}
                      className="relative h-2 bg-white/20 rounded-full group hover:h-3 transition-all duration-200"
                    >
                    {/* Barra de progresso preenchida */}
                    <div 
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-white to-white/90 rounded-full transition-all duration-150"
                      style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                    />
                    
                    {/* Thumb da barra de progresso */}
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 -ml-2"
                      style={{ left: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                    />
                    
                      {/* Preview do tempo e thumbnail ao passar o mouse */}
                      {showProgressPreview && (
                        <div 
                          className="absolute bottom-full mb-6 bg-black/90 backdrop-blur-sm text-white text-xs rounded-lg overflow-hidden shadow-xl border border-white/10 transform -translate-x-1/2"
                          style={{ left: `${progressPreviewPosition}px` }}
                        >
                          {/* Thumbnail do vídeo */}
                          {previewThumbnail && (
                            <div className="w-40 h-24 overflow-hidden">
                              <img 
                                src={previewThumbnail} 
                                alt="Preview do vídeo"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          {/* Tempo */}
                          <div className="px-3 py-2 text-center font-mono">
                            {formatTime(progressPreviewTime)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Controles inferiores */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3">
                      {/* Botões de controle de tempo */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          skipTime(-10);
                        }}
                        className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        aria-label="Retroceder 10 segundos"
                      >
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12.5,3C17.15,3 21.08,6.03 22.47,10.22L20.1,11C19.05,7.81 16.04,5.5 12.5,5.5C10.54,5.5 8.77,6.22 7.38,7.38L10,10H3V3L5.6,5.6C7.45,4 9.85,3 12.5,3M10,12V22H8V14H6V12H10M18,14V20C18,21.11 17.11,22 16,22H14A2,2 0 0,1 12,20V14A2,2 0 0,1 14,12H16C17.11,12 18,12.9 18,14M14,14V20H16V14H14Z"/>
                        </svg>
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          skipTime(10);
                        }}
                        className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        aria-label="Avançar 10 segundos"
                      >
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M10,12V22H8V14H6V12H10M18,14V20C18,21.11 17.11,22 16,22H14A2,2 0 0,1 12,20V14A2,2 0 0,1 14,12H16C17.11,12 18,12.9 18,14M14,14V20H16V14H14M11.5,3C14.15,3 16.55,4 18.4,5.6L21,3V10H14L16.62,7.38C15.23,6.22 13.46,5.5 11.5,5.5C7.96,5.5 4.95,7.81 3.9,11L1.53,10.22C2.92,6.03 6.85,3 11.5,3Z"/>
                        </svg>
                      </button>
                      
                      <span className="text-xs text-white/70 font-mono">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Controles laterais à direita */}
          <div className="flex flex-col gap-2 pt-2">
            {canHide && (
              <button
                onClick={toggleHideVideo}
                className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors transform hover:scale-110 transition-transform duration-200"
                aria-label="Ocultar vídeo"
              >
                <EyeOff className="w-5 h-5 text-white" />
              </button>
            )}
            
            <button
              onClick={toggleFullScreen}
              className="p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors transform hover:scale-110 transition-transform duration-200"
              aria-label={isFullScreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
            >
              {isFullScreen ? (
                <Minimize className="w-5 h-5 text-white" />
              ) : (
                <Maximize className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
        
        
      </>
    );
  }

  // Layout padrão para outros vídeos
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />
      <div 
        ref={playerRef}
        className={`relative ${size === "small" ? "w-full max-w-md mx-auto h-40" : "w-full"} overflow-hidden bg-black/90 rounded-lg ${className}`}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div 
          className="relative w-full h-full cursor-pointer" 
          onClick={handleVideoClick}
        >
          {isLoading && !videoRef.current?.hasAttribute("data-reloading") && 
            !userPausedRef.current && !preventLoadRef.current && 
            !isHidden && !showingAfterHidden && 
            !videoRef.current?.hasAttribute("data-user-paused") && 
            !videoRef.current?.hasAttribute("data-shown-after-hidden") && 
            videoKey !== "video.main" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <div className="flex flex-col items-center">
                <RefreshCw className="h-8 w-8 text-white animate-spin mb-2" />
                <span className="text-white text-sm font-medium">Carregando vídeo...</span>
                <span className="text-white/60 text-xs mt-1">Isso pode levar alguns segundos</span>
              </div>
            </div>
          )}
          
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
              <div className="flex flex-col items-center max-w-md px-6">
                <Button 
                  variant="outline" 
                  onClick={reloadVideo}
                  className="border-white/20 bg-black/50 text-white hover:bg-white/10 flex items-center gap-2 mb-3"
                >
                  <RefreshCw className="h-4 w-4" /> Tentar Novamente
                </Button>
                <span className="text-white/90 text-sm text-center font-medium mb-1">
                  Não foi possível carregar o vídeo
                </span>
                <span className="text-white/60 text-xs text-center">
                  O vídeo pode ser muito grande e estar demorando para carregar. Tente recarregar a página ou aguarde alguns instantes.
                </span>
              </div>
            </div>
          )}
          
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            autoPlay={autoPlay}
            muted={muted}
            loop={loop}
            className="w-full h-full object-contain"
            playsInline
            onClick={(e) => e.stopPropagation()}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        </div>
        
        {controls && (
          <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="p-4 space-y-3">
              {/* Barra de progresso avançada */}
              <div className="space-y-2">
                {/* Área de hover expandida (invisível) */}
                <div 
                  className="relative py-4 cursor-pointer"
                  onMouseDown={handleProgressMouseDown}
                  onMouseMove={handleProgressMouseMove}
                  onMouseLeave={handleProgressMouseLeave}
                  onMouseUp={handleProgressMouseUp}
                >
                  {/* Barra visual */}
                  <div 
                    ref={progressBarRef}
                    className="relative h-2 bg-white/20 rounded-full group hover:h-3 transition-all duration-200"
                  >
                  {/* Barra de progresso preenchida */}
                  <div 
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-white to-white/90 rounded-full transition-all duration-150"
                    style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                  />
                  
                  {/* Thumb da barra de progresso */}
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 -ml-2 border-2 border-black/20"
                    style={{ left: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                  />
                  
                    {/* Preview do tempo e thumbnail ao passar o mouse */}
                    {showProgressPreview && (
                      <div 
                        className="absolute bottom-full mb-6 bg-black/90 backdrop-blur-sm text-white text-sm rounded-lg overflow-hidden shadow-xl border border-white/10 transform -translate-x-1/2"
                        style={{ left: `${progressPreviewPosition}px` }}
                      >
                        {/* Thumbnail do vídeo */}
                        {previewThumbnail && (
                          <div className="w-40 h-24 overflow-hidden">
                            <img 
                              src={previewThumbnail} 
                              alt="Preview do vídeo"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        {/* Tempo */}
                        <div className="px-3 py-2 text-center font-mono">
                          {formatTime(progressPreviewTime)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Marcadores de tempo (opcional - para vídeos longos) */}
                {duration > 300 && ( // Só mostra se o vídeo for maior que 5 minutos
                  <div className="flex justify-between text-xs text-white/40">
                    {Array.from({ length: Math.min(6, Math.floor(duration / 60)) }, (_, i) => {
                      const minute = (i + 1) * Math.floor(duration / Math.min(5, Math.floor(duration / 60)));
                      return (
                        <span 
                          key={i} 
                          className="cursor-pointer hover:text-white/60" 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            jumpToTime(minute);
                          }}
                        >
                          {Math.floor(minute / 60)}:{String(Math.floor(minute % 60)).padStart(2, '0')}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Controles principais */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Controles de tempo avançados */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        skipTime(-30);
                      }}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors group"
                      aria-label="Retroceder 30 segundos"
                    >
                      <svg className="w-5 h-5 text-white group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.5,3C17.15,3 21.08,6.03 22.47,10.22L20.1,11C19.05,7.81 16.04,5.5 12.5,5.5C10.54,5.5 8.77,6.22 7.38,7.38L10,10H3V3L5.6,5.6C7.45,4 9.85,3 12.5,3M10,12V22H8V14H6V12H10M18,14V20C18,21.11 17.11,22 16,22H14A2,2 0 0,1 12,20V14A2,2 0 0,1 14,12H16C17.11,12 18,12.9 18,14M14,14V20H16V14H14Z"/>
                      </svg>
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        skipTime(-10);
                      }}
                      className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors group"
                      aria-label="Retroceder 10 segundos"
                    >
                      <svg className="w-4 h-4 text-white group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.5,3C17.15,3 21.08,6.03 22.47,10.22L20.1,11C19.05,7.81 16.04,5.5 12.5,5.5C10.54,5.5 8.77,6.22 7.38,7.38L10,10H3V3L5.6,5.6C7.45,4 9.85,3 12.5,3M10,12V22H8V14H6V12H10M18,14V20C18,21.11 17.11,22 16,22H14A2,2 0 0,1 12,20V14A2,2 0 0,1 14,12H16C17.11,12 18,12.9 18,14M14,14V20H16V14H14Z"/>
                      </svg>
                    </button>
                  </div>
                  
                  {/* Play/Pause */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlay(e);
                    }}
                    className="p-3 rounded-full bg-white/15 hover:bg-white/25 transition-all duration-200 group hover:scale-110"
                    aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 text-white" />
                    ) : (
                      <Play className="w-5 h-5 text-white ml-0.5" />
                    )}
                  </button>
                  
                  {/* Controles de tempo avançados - direita */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        skipTime(10);
                      }}
                      className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors group"
                      aria-label="Avançar 10 segundos"
                    >
                      <svg className="w-4 h-4 text-white group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10,12V22H8V14H6V12H10M18,14V20C18,21.11 17.11,22 16,22H14A2,2 0 0,1 12,20V14A2,2 0 0,1 14,12H16C17.11,12 18,12.9 18,14M14,14V20H16V14H14M11.5,3C14.15,3 16.55,4 18.4,5.6L21,3V10H14L16.62,7.38C15.23,6.22 13.46,5.5 11.5,5.5C7.96,5.5 4.95,7.81 3.9,11L1.53,10.22C2.92,6.03 6.85,3 11.5,3Z"/>
                      </svg>
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        skipTime(30);
                      }}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors group"
                      aria-label="Avançar 30 segundos"
                    >
                      <svg className="w-5 h-5 text-white group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10,12V22H8V14H6V12H10M18,14V20C18,21.11 17.11,22 16,22H14A2,2 0 0,1 12,20V14A2,2 0 0,1 14,12H16C17.11,12 18,12.9 18,14M14,14V20H16V14H14M11.5,3C14.15,3 16.55,4 18.4,5.6L21,3V10H14L16.62,7.38C15.23,6.22 13.46,5.5 11.5,5.5C7.96,5.5 4.95,7.81 3.9,11L1.53,10.22C2.92,6.03 6.85,3 11.5,3Z"/>
                      </svg>
                    </button>
                  </div>
                  
                  {/* Volume */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleVolumeBar(e);
                      }}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                      aria-label={isMuted ? "Ativar som" : "Ajustar volume"}
                    >
                      {isMuted ? (
                        <VolumeX className="w-4 h-4 text-white" />
                      ) : volume < 50 ? (
                        <Volume1 className="w-4 h-4 text-white" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-white" />
                      )}
                    </button>
                    
                    {!isMuted && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            changeVolume(-10);
                          }}
                          className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                          aria-label="Diminuir volume"
                        >
                          <Minus className="w-3 h-3 text-white" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            changeVolume(10);
                          }}
                          className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                          aria-label="Aumentar volume"
                        >
                          <Plus className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Tempo */}
                  <div className="bg-black/40 px-3 py-1 rounded-md">
                    <span className="text-sm text-white/90 font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                  </div>
                </div>
                
                {/* Controles do lado direito */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={reloadVideo}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors group"
                    aria-label="Recarregar vídeo"
                  >
                    <RefreshCw className="w-4 h-4 text-white group-hover:rotate-180 transition-transform duration-500" />
                  </button>
                  
                  {canHide && (
                    <button
                      onClick={toggleHideVideo}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                      aria-label="Ocultar vídeo"
                    >
                      <EyeOff className="w-4 h-4 text-white" />
                    </button>
                  )}
                  
                  <button
                    onClick={toggleFullScreen}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors group"
                    aria-label={isFullScreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
                  >
                    {isFullScreen ? (
                      <Minimize className="w-4 h-4 text-white group-hover:scale-90 transition-transform" />
                    ) : (
                      <Maximize className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      

    </>
  );
}