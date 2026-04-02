import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LiveStream } from '@/contexts/LiveStreamContext';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Clock, Video, MessageSquare, Share2, Bookmark, Shield, Lock, Globe, Calendar } from "lucide-react";

// Estendendo a interface LiveStream para incluir propriedades específicas do componente
interface ExtendedLiveStream extends LiveStream {
  scheduledFor?: string | Date;
  accessType?: 'private' | 'public' | 'invite';
}

interface MeetingCardProps {
  stream: ExtendedLiveStream;
  onClick: (stream: ExtendedLiveStream) => void;
  isActive?: boolean;
  isCompact?: boolean;
  showCategory?: boolean;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({
  stream,
  onClick,
  isActive = false,
  isCompact = false,
  showCategory = true
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(Math.floor(Math.random() * 50) + 5);
  
  // Para categorias e cores de temas
  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'technical': return '📊';
      case 'fundamental': return '📈';
      case 'crypto': return '₿';
      case 'forex': return '💱';
      case 'stocks': return '📉';
      case 'education': return '🎓';
      case 'news': return '📰';
      case 'discussion': return '💬';
      default: return '📊';
    }
  };

  const getMeetingType = (type?: string) => {
    switch (type) {
      case 'private':
        return <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">Privada</Badge>;
      case 'public':
        return <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">Pública</Badge>;
      case 'invite':
        return <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30">Por convite</Badge>;
      default:
        return null;
    }
  };

  const getLanguageFlag = (language?: string) => {
    switch (language) {
      case 'pt': return '🇧🇷';
      case 'en': return '🇺🇸';
      case 'es': return '🇪🇸';
      case 'fr': return '🇫🇷';
      case 'de': return '🇩🇪';
      case 'it': return '🇮🇹';
      case 'zh': return '🇨🇳';
      case 'ja': return '🇯🇵';
      case 'ko': return '🇰🇷';
      case 'ru': return '🇷🇺';
      default: return '🌐';
    }
  };

  // Calcular tempo até o início da reunião ou duração se já estiver ativa
  const getMeetingTime = (stream: ExtendedLiveStream) => {
    if (stream.status === 'live') {
      // Reunião em andamento - mostrar duração
      const startDate = new Date(stream.startedAt);
      const minutes = Math.floor((Date.now() - startDate.getTime()) / 60000);
      
      if (minutes < 60) {
        return `${minutes} min`;
      }
      
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h${remainingMinutes > 0 ? ` ${remainingMinutes}min` : ''}`;
    } else if (stream.scheduledFor) {
      // Reunião agendada - mostrar tempo até o início
      const scheduledDate = new Date(stream.scheduledFor);
      const now = new Date();
      const diffMs = scheduledDate.getTime() - now.getTime();
      
      if (diffMs < 0) {
        return 'Atrasada';
      }
      
      const diffMin = Math.round(diffMs / 60000);
      
      if (diffMin < 60) {
        return `Em ${diffMin} min`;
      }
      
      const diffHours = Math.floor(diffMin / 60);
      
      if (diffHours < 24) {
        return `Em ${diffHours}h`;
      }
      
      const diffDays = Math.floor(diffHours / 24);
      return `Em ${diffDays} dias`;
    }
    
    return 'Não iniciada';
  };

  // Estilo baseado no tema da stream
  const getThemeStyles = () => {
    const themeColor = stream.themeColor || '#1e40af';
    
    return {
      gradientFrom: `${themeColor}33`, // 20% opacity
      gradientTo: `${themeColor}66`,   // 40% opacity
      borderColor: `${themeColor}99`,   // 60% opacity
      hoverColor: `${themeColor}22`,    // 13% opacity
      glow: `0 0 15px ${themeColor}66, 0 0 5px ${themeColor}33`  // Glow effect
    };
  };

  const themeStyles = getThemeStyles();
  
  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFavorited(!isFavorited);
    setFavoriteCount(prev => isFavorited ? prev - 1 : prev + 1);
  };
  
  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Adicionar função de compartilhamento real aqui
    const shareText = `Participe da reunião "${stream.title}" por ${stream.streamerName}`;
    if (navigator.share) {
      navigator.share({
        title: stream.title,
        text: shareText,
        url: window.location.href
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href)
        .then(() => alert('Link copiado para a área de transferência!'))
        .catch(console.error);
    }
  };

  if (isCompact) {
    // Versão compacta do card (para sidebar)
    return (
      <motion.div
        whileHover={{ scale: 0.98, y: -2 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ 
          type: "spring", 
          stiffness: 400, 
          damping: 17,
          delay: Math.random() * 0.2
        }}
        className={`
          cursor-pointer rounded-lg overflow-hidden group
          ${isActive ? 'ring-2 ring-offset-2 ring-offset-black' : ''}
        `}
        style={{ 
          boxShadow: isActive ? themeStyles.glow : 'none'
        }}
        onClick={() => onClick(stream)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div 
          className={`p-2 border transition-all duration-300 relative
          ${isActive ? 'bg-black/40 border-white/20' : 'bg-black/20 border-white/10'}
          ${isHovered ? 'bg-black/30' : ''}
          group-hover:border-white/30`}
          style={{ 
            background: isActive 
              ? `linear-gradient(to right, ${themeStyles.gradientFrom}, ${themeStyles.gradientTo})`
              : isHovered
                ? `linear-gradient(45deg, rgba(0,0,0,0.3), ${themeStyles.gradientFrom})`
                : undefined
          }}
        >
          {/* Efeito de partículas (simulado com pseudo-elementos e animações CSS) */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-0 group-hover:opacity-70 transition-opacity duration-700">
            <div className="particle-1"></div>
            <div className="particle-2"></div>
            <div className="particle-3"></div>
          </div>
          
          <div className="flex items-center gap-2 relative z-10">
            <div className="relative">
              <Avatar className="h-8 w-8 rounded-full border border-white/20 group-hover:border-white/40 transition-all duration-300">
                <AvatarImage 
                  src={stream.streamerAvatar}
                  className="object-cover w-full h-full"
                />
                <AvatarFallback className="bg-black text-white">
                  {stream.streamerName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              {/* Indicador de reunião em andamento */}
              {stream.status === 'live' && (
                <motion.div 
                  initial={false}
                  animate={{ scale: isActive || isHovered ? 1 : 0 }}
                  className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center border border-green-900"
                >
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                </motion.div>
              )}
              
              {/* Indicador de reunião agendada */}
              {stream.scheduledFor && stream.status !== 'live' && (
                <motion.div 
                  initial={false}
                  animate={{ scale: isActive || isHovered ? 1 : 0 }}
                  className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center border border-blue-900"
                >
                </motion.div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <motion.h3 
                className="text-sm font-medium text-white truncate"
                animate={{ 
                  textShadow: isHovered ? '0 0 8px rgba(255,255,255,0.5)' : 'none',
                }}
                transition={{ duration: 0.3 }}
              >
                {stream.title}
              </motion.h3>
              <div className="flex items-center text-xs text-white/60 gap-2">
                <span className="truncate">{stream.streamerName}</span>
                <span className="inline-flex items-center">
                  <Users className="h-3 w-3 mr-1" />
                  <motion.span
                    animate={{ 
                      scale: [1, 1.2, 1],
                    }}
                    transition={{ 
                      duration: 0.5, 
                      repeat: isHovered ? Infinity : 0,
                      repeatType: "reverse",
                      repeatDelay: 1
                    }}
                  >
                    {stream.viewerCount || 0}
                  </motion.span>
                </span>
              </div>
            </div>
            
            <div className="flex flex-col items-end justify-between">
              <div className="flex items-center gap-1">
                <span className="text-xs">{getLanguageFlag(stream.language)}</span>
                {stream.accessType === 'private' && (
                  <motion.span 
                    className="text-red-500 text-xs"
                    animate={{ 
                      rotate: isHovered ? [0, 10, -10, 0] : 0,
                      scale: isHovered ? [1, 1.2, 1] : 1,
                    }}
                    transition={{ 
                      duration: 0.5, 
                      ease: "easeInOut", 
                      repeat: isHovered ? 1 : 0 
                    }}
                  >
                    <Lock className="h-3 w-3" />
                  </motion.span>
                )}
              </div>
              <motion.span 
                className="text-xs text-white/40 mt-1 inline-flex items-center"
                animate={{ 
                  color: isHovered ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)'
                }}
              >
                <Clock className="h-3 w-3 mr-1 inline" />
                {getMeetingTime(stream)}
              </motion.span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Versão completa do card (para grade)
  return (
    <motion.div
      whileHover={{ scale: 0.98, y: -5 }}
      whileTap={{ scale: 0.95 }}
      transition={{ 
        type: "spring", 
        stiffness: 400, 
        damping: 15,
        delay: 0.05 
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onClick(stream)}
      className="cursor-pointer relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowDetails(false);
      }}
      onTouchStart={() => setShowDetails(true)}
      onTouchEnd={() => setShowDetails(false)}
    >
      <Card className="overflow-hidden border-white/10 bg-black/30 backdrop-blur-lg transition-all duration-300 shadow-lg
        group-hover:shadow-xl group-hover:border-white/30"
        style={{ 
          boxShadow: isHovered ? themeStyles.glow : undefined
        }}
      >
        <div className="relative">
          {/* Thumbnail com gradiente personalizado baseado no tema */}
          <div 
            className="aspect-video w-full relative overflow-hidden"
            style={{
              background: stream.thumbnail 
                ? `url(${stream.thumbnail}) center/cover no-repeat` 
                : `linear-gradient(135deg, ${themeStyles.gradientFrom}, ${themeStyles.gradientTo})`
            }}
          >
            {/* Ripple effect on hover */}
            <AnimatePresence>
              {isHovered && (
                <motion.div 
                  initial={{ scale: 0, opacity: 0.7 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full bg-white/30 m-auto w-12 h-12"
                  style={{ left: 0, right: 0, top: 0, bottom: 0 }}
                />
              )}
            </AnimatePresence>
            
            {/* Overlay com gradiente */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
            
            {/* Ícone de entrar na reunião */}
            <motion.div 
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div 
                className="bg-white/10 backdrop-blur-sm w-16 h-16 rounded-full flex items-center justify-center border border-white/20"
                animate={{ 
                  scale: isHovered ? [1, 1.1, 1] : 1,
                  boxShadow: isHovered ? [
                    "0 0 0 0 rgba(255,255,255,0)",
                    "0 0 0 10px rgba(255,255,255,0.1)",
                    "0 0 0 0 rgba(255,255,255,0)"
                  ] : "0 0 0 0 rgba(255,255,255,0)" 
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  repeatType: "loop" 
                }}
              >
                <Video className="h-8 w-8 text-white" />
              </motion.div>
            </motion.div>
            
            {/* Indicadores (STATUS) */}
            <div className="absolute top-2 left-2 flex flex-wrap gap-1">
              {stream.status === 'live' ? (
                <Badge className="bg-green-500 text-white border-0 shadow-lg flex items-center gap-1">
                  <span className="relative flex h-2 w-2 mr-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                  </span>
                  EM ANDAMENTO
                </Badge>
              ) : stream.scheduledFor ? (
                <Badge className="bg-blue-500 text-white border-0 shadow-lg flex items-center gap-1">
                  <Calendar className="h-3 w-3 mr-1" />
                  AGENDADA
                </Badge>
              ) : (
                <Badge className="bg-gray-500 text-white border-0 shadow-lg">
                  NÃO INICIADA
                </Badge>
              )}
              
              {/* Indicador de tipo de acesso */}
              {stream.accessType === 'private' && (
                <motion.div
                  animate={{ 
                    y: [0, -2, 0],
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity,
                    repeatType: "loop" 
                  }}
                >
                  <Badge className="bg-red-500/80 text-white border-0 shadow-lg">
                    <Lock className="h-3 w-3 mr-1" />
                    Privada
                  </Badge>
                </motion.div>
              )}
              
              {stream.accessType === 'invite' && (
                <Badge className="bg-amber-500/80 text-white border-0 shadow-lg">
                  <Shield className="h-3 w-3 mr-1" />
                  Por convite
                </Badge>
              )}
              
              {stream.accessType === 'public' && (
                <Badge className="bg-green-500/80 text-white border-0 shadow-lg">
                  <Globe className="h-3 w-3 mr-1" />
                  Pública
                </Badge>
              )}
            </div>
            
            {/* Tempo até o início ou duração */}
            <div className="absolute bottom-2 left-2 flex items-center text-white/80 text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {getMeetingTime(stream)}
            </div>
            
            {/* Participantes */}
            <div className="absolute bottom-2 right-2 flex items-center text-white/80 text-xs">
              <Users className="h-3 w-3 mr-1" />
              {stream.viewerCount || 0}
            </div>
          </div>
          
          <CardContent className="p-3 relative">
            <div className="flex items-start justify-between gap-2 mb-2">
              <motion.div
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Avatar className="h-10 w-10 rounded-full border-2 border-white/20 shadow-lg">
                  <AvatarImage 
                    src={stream.streamerAvatar}
                    className="object-cover w-full h-full"
                  />
                  <AvatarFallback className="bg-black text-white">
                    {stream.streamerName ? stream.streamerName.substring(0, 2).toUpperCase() : 'UN'}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white text-sm truncate group-hover:text-blue-400 transition-colors duration-300">
                  {stream.title}
                </h3>
                <p className="text-white/60 text-xs truncate">
                  {stream.streamerName}
                </p>
              </div>
              
              {/* Badge de idioma */}
              <div className="flex items-center">
                <motion.div
                  whileHover={{ scale: 1.1, y: -2 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <Badge 
                    variant="outline" 
                    className="bg-white/5 border-white/10 text-white px-1.5 backdrop-blur-md shadow-sm"
                  >
                    {getLanguageFlag(stream.language)} {stream.language?.toUpperCase()}
                  </Badge>
                </motion.div>
              </div>
            </div>
            
            {/* Data da reunião (se agendada) */}
            {stream.scheduledFor && stream.status !== 'live' && (
              <motion.div 
                className="flex items-center justify-between mt-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ 
                  opacity: 1, 
                  height: 'auto',
                  transition: { delay: 0.1 }
                }}
              >
                <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30 text-blue-400">
                  <Calendar className="h-3 w-3 mr-1" />
                  {format(new Date(stream.scheduledFor), "dd 'de' MMMM, HH:mm", { locale: ptBR })}
                </Badge>
              </motion.div>
            )}
            
            {(showCategory && stream.category) && (
              <motion.div 
                className="flex items-center justify-between mt-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ 
                  opacity: 1, 
                  height: 'auto',
                  transition: { delay: 0.1 }
                }}
              >
                <Badge variant="outline" className="bg-white/5 border-white/10 text-white/80">
                  {getCategoryIcon(stream.category)} {stream.category}
                </Badge>
                
                {getMeetingType(stream.accessType)}
              </motion.div>
            )}
            
            {/* Tags */}
            {stream.tags && stream.tags.length > 0 && (
              <motion.div 
                className="flex flex-wrap gap-1 mt-2"
                initial={{ opacity: 0, y: 5 }}
                animate={{ 
                  opacity: 1, 
                  y: 0,
                  transition: { delay: 0.2 }
                }}
              >
                {stream.tags.slice(0, 3).map((tag, index) => (
                  <motion.span 
                    key={index}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="text-xs text-white/60 bg-white/5 px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors"
                  >
                    #{tag}
                  </motion.span>
                ))}
              </motion.div>
            )}
            
            {/* Ações */}
            <motion.div
              className="flex items-center justify-between mt-3 pt-2 border-t border-white/10"
              initial={{ opacity: 0, y: 10 }}
              animate={{ 
                opacity: showDetails || isHovered ? 1 : 0,
                y: showDetails || isHovered ? 0 : 10,
              }}
              transition={{ duration: 0.2 }}
            >
              <button 
                className="flex items-center text-white/60 hover:text-blue-400 transition-colors text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  // Adicionar à agenda/calendário
                }}
              >
                <Calendar className="h-4 w-4 mr-1" />
                <span>Agendar</span>
              </button>
              
              <button className="flex items-center text-white/60 hover:text-blue-400 transition-colors text-xs">
                <MessageSquare className="h-4 w-4 mr-1" />
                <span>{Math.floor(Math.random() * 30)}</span>
              </button>
              
              <button 
                className="flex items-center text-white/60 hover:text-green-400 transition-colors text-xs"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4 mr-1" />
                <span>Compartilhar</span>
              </button>
              
              <button 
                className="flex items-center text-white/60 hover:text-yellow-400 transition-colors text-xs"
                aria-label="Salvar reunião"
              >
                <Bookmark className={`h-4 w-4`} />
              </button>
            </motion.div>
          </CardContent>
        </div>
      </Card>
      
      {/* Pulsação de glow na borda */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0.3, 0.8, 0.3],
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              repeatType: "loop"
            }}
            className="absolute inset-0 -z-10 rounded-lg"
            style={{ 
              background: `linear-gradient(45deg, ${themeStyles.gradientFrom}, ${themeStyles.gradientTo})`,
              filter: 'blur(10px)'
            }}
          />
        )}
      </AnimatePresence>
      
      {/* CSS para efeitos de partículas */}
      <style dangerouslySetInnerHTML={{__html: `
        .particle-1, .particle-2, .particle-3 {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.5);
          animation: float-up 5s infinite linear;
        }
        
        .particle-1 {
          left: 10%;
          animation-duration: 3s;
          animation-delay: 0.2s;
        }
        
        .particle-2 {
          left: 50%;
          width: 4px;
          height: 4px;
          animation-duration: 4s;
          animation-delay: 1s;
        }
        
        .particle-3 {
          left: 80%;
          width: 5px;
          height: 5px;
          animation-duration: 5s;
          animation-delay: 0.5s;
        }
        
        @keyframes float-up {
          0% {
            transform: translateY(100%);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 0.7;
          }
          100% {
            transform: translateY(-100%);
            opacity: 0;
          }
        }
      `}} />
    </motion.div>
  );
};

export default MeetingCard; 