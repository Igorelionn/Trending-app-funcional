import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExtendedLiveStream } from '@/types/meeting';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Clock, Video, MessageSquare, Share2, Bookmark, Shield, Lock, Globe, Calendar, Trash2 } from "lucide-react";
import { getSupabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveStream } from '@/contexts/LiveStreamContext';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LiveStreamCardProps {
  stream: ExtendedLiveStream;
  onClick: (stream: ExtendedLiveStream) => void;
  isActive?: boolean;
  isCompact?: boolean;
  showCategory?: boolean;
  onDelete?: () => void; // Callback para atualizar a lista após exclusão
}

export const LiveStreamCard: React.FC<LiveStreamCardProps> = ({
  stream,
  onClick,
  isActive = false,
  isCompact = false,
  showCategory = true,
  onDelete
}) => {
  const { user, isAdmin } = useAuth();
  const { deleteStream } = useLiveStream();
  const [isHovered, setIsHovered] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(Math.floor(Math.random() * 50) + 5);
  const [streamerAvatar, setStreamerAvatar] = useState(stream.streamerAvatar);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Atualizar avatar do streamer em tempo real
  useEffect(() => {
    const supabase = getSupabase();
    
    // Buscar avatar inicial do streamer
    const fetchStreamerAvatar = async () => {
      const { data: profile } = await (supabase as SupabaseClient)
        .from('user_profiles')
        .select('avatar_url')
        .eq('user_id', stream.streamerId)
        .single();
        
      if (profile?.avatar_url) {
        setStreamerAvatar(profile.avatar_url);
      }
    };
    
    fetchStreamerAvatar();
    
    // Escutar por mudanças no avatar do streamer
    const subscription = (supabase as SupabaseClient)
      .channel('public:user_profiles')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'user_profiles',
          filter: `user_id=eq.${stream.streamerId}`
        }, 
        (payload) => {
          if (payload.new.avatar_url) {
            setStreamerAvatar(payload.new.avatar_url);
          }
        }
      )
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
    };
  }, [stream.streamerId]);
  
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
    // Substituindo a cor personalizada por tons escuros
    return {
      gradientFrom: '#121212', // Preto muito escuro
      gradientTo: '#1a1a1a',   // Cinza muito escuro
      borderColor: '#333333',   // Cinza escuro
      hoverColor: '#222222',    // Cinza escuro para hover
      glow: `0 0 15px rgba(0, 0, 0, 0.6), 0 0 5px rgba(0, 0, 0, 0.4)`  // Glow effect escuro
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
  
  const handleDelete = async () => {
    if (!isAdmin) return;
    
    setIsDeleting(true);
    try {
      const success = await deleteStream(stream.id);
      if (success) {
        toast.success('Transmissão excluída com sucesso!');
        if (onDelete) onDelete();
      } else {
        toast.error('Erro ao excluir transmissão');
      }
    } catch {
      toast.error('Erro ao excluir transmissão');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };
  
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  if (isCompact) {
    return (
      <motion.div
        whileHover={{ scale: 1.01, x: 3 }}
        whileTap={{ scale: 0.99 }}
        initial={{ opacity: 0, x: -5 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ 
          type: "spring", 
          stiffness: 400, 
          damping: 20,
          delay: Math.random() * 0.2
        }}
        className={`
          cursor-pointer rounded-lg overflow-hidden shadow-md flex h-full
          ${isActive ? 'ring-2 ring-blue-500/50' : ''}
          transform-gpu
        `}
        style={{ 
          boxShadow: isActive 
            ? `0 4px 15px -3px ${themeStyles.gradientFrom}40, 0 2px 5px -2px ${themeStyles.gradientTo}40`
            : '0 2px 5px rgba(0, 0, 0, 0.1)'
        }}
        onClick={() => onClick(stream)}
      >
        <div className="relative w-32 aspect-video overflow-hidden bg-gray-950 flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-tr from-gray-900 via-transparent to-gray-900 z-10"></div>
          
          {stream.thumbnail ? (
            <img 
              src={stream.thumbnail}
              alt={stream.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center" 
              style={{ background: `linear-gradient(135deg, #121212, #1a1a1a)` }}
            >
              <Video className="h-8 w-8 text-white/30" />
            </div>
          )}
          
          <div className="absolute top-1 left-1 z-20">
            {stream.status === 'live' && (
              <Badge className="bg-red-500 hover:bg-red-600 text-[10px] font-medium px-1.5 flex items-center gap-1">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                </span>
                <span>AO VIVO</span>
              </Badge>
            )}
            
            {stream.status === 'scheduled' && (
              <Badge className="bg-blue-600 hover:bg-blue-700 text-[10px] px-1.5">
                <Calendar className="h-2 w-2 mr-1" />
                Agendada
              </Badge>
            )}
          </div>
        </div>
        
        {/* Conteúdo / Detalhes */}
        <div className="flex-1 p-2 bg-gray-900 flex flex-col justify-between min-w-0">
          {/* Título e criador */}
          <div>
            <h3 className="text-sm font-medium text-white line-clamp-1">
              {stream.title}
            </h3>
            
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-gray-400 line-clamp-1">
                {stream.streamerName}
              </span>
              
              {stream.isPremium && (
                <Badge className="bg-amber-500/80 text-amber-950 text-[10px] px-1">
                  PRO
                </Badge>
              )}
            </div>
          </div>
          
          {/* Stats e ações */}
          <div className="flex items-center justify-between mt-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="flex items-center text-gray-400">
                <Users className="h-3 w-3 mr-1 text-blue-400" />
                <span>{stream.viewerCount || 0}</span>
              </div>
              
              {stream.language && (
                <div className="flex items-center text-gray-400">
                  <span>{getLanguageFlag(stream.language)}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={handleDeleteClick}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                  aria-label="Excluir transmissão"
                  title="Excluir transmissão (Admin)"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
              
              <button
                onClick={handleShare}
                className="text-gray-400 hover:text-blue-400 transition-colors"
                aria-label="Compartilhar transmissão"
              >
                <Share2 className="h-3 w-3" />
              </button>
              
              <button
                onClick={handleFavorite}
                className={`transition-colors ${isFavorited ? 'text-amber-400' : 'text-gray-400 hover:text-amber-400'}`}
                aria-label={isFavorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              >
                <Bookmark className="h-3 w-3" fill={isFavorited ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -5 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        type: "spring", 
        stiffness: 400, 
        damping: 20,
        delay: Math.random() * 0.2
      }}
      className={`
        cursor-pointer rounded-xl overflow-hidden shadow-xl h-full flex flex-col
        ${isActive ? 'ring-2 ring-blue-500/50' : ''}
        transform-gpu
      `}
      style={{ 
        boxShadow: isActive 
          ? `0 10px 25px -5px ${themeStyles.gradientFrom}, 0 5px 10px -5px ${themeStyles.gradientTo}`
          : '0 4px 12px rgba(0, 0, 0, 0.2)'
      }}
      onClick={() => onClick(stream)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative aspect-video overflow-hidden bg-gray-950 flex-shrink-0">
        <div className="absolute inset-0 bg-gradient-to-tr from-gray-900 via-transparent to-gray-900 z-10"></div>
        
        {stream.thumbnail ? (
          <img 
            src={stream.thumbnail}
            alt={stream.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            style={{ 
              transform: isHovered ? 'scale(1.05)' : 'scale(1)'
            }}
          />
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center" 
            style={{ background: `linear-gradient(135deg, #121212, #1a1a1a)` }}
          >
            <Video className="h-12 w-12 text-white/30" />
          </div>
        )}
        
        {/* Informações extras sobre a transmissão */}
        <div className="absolute top-2 left-2 z-20 flex gap-1">
          {stream.status === 'live' && (
            <Badge className="bg-red-500 hover:bg-red-600 text-xs font-medium px-2 flex items-center gap-1">
              <span className="relative inline-flex h-2 w-2 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span>AO VIVO</span>
            </Badge>
          )}
          
          {stream.status === 'scheduled' && (
            <Badge className="bg-blue-600 hover:bg-blue-700 text-xs px-2 flex items-center gap-1">
              <Calendar className="h-3 w-3 mr-1" />
              Agendada
            </Badge>
          )}
          
          {stream.language && (
            <Badge className="bg-gray-800/80 backdrop-blur-sm hover:bg-gray-700 text-xs px-2">
              {getLanguageFlag(stream.language)}
            </Badge>
          )}
        </div>
        
        <div className="absolute bottom-0 inset-x-0 z-20 p-3 bg-gradient-to-t from-gray-900/90 to-transparent">
          <h3 className="text-base md:text-lg font-bold text-white line-clamp-1 text-shadow">
            {stream.title}
          </h3>
          
          <div className="flex items-center gap-1 mt-1 min-w-0">
            <Avatar className="h-8 w-8 border border-white/20 overflow-hidden flex-shrink-0">
              <AvatarImage 
                src={streamerAvatar}
                className="object-cover w-full h-full"
              />
              <AvatarFallback className="bg-black text-white">
                {stream.streamerName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-gray-300 font-medium truncate">
              {stream.streamerName}
            </span>
            
            {stream.isPremium && (
              <Badge className="bg-amber-500/80 text-amber-950 text-xs ml-auto flex-shrink-0">PREMIUM</Badge>
            )}
          </div>
        </div>
      </div>
      
      <div className="p-3 bg-gray-900 border-t border-gray-800/60 flex-grow flex flex-col justify-between min-h-0">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex items-center text-gray-400 flex-shrink-0">
              <Users className="h-4 w-4 mr-1 text-blue-400" />
              <span>{stream.viewerCount || 0}</span>
            </div>
            
            {stream.status === 'live' && (
              <div className="flex items-center text-gray-400 flex-shrink-0">
                <Clock className="h-4 w-4 mr-1 text-red-400" />
                <span>{getMeetingTime(stream)}</span>
              </div>
            )}
            
            {stream.category && showCategory && (
              <div className="flex items-center text-gray-400 min-w-0">
                <span className="mr-1 flex-shrink-0">{getCategoryIcon(stream.category)}</span>
                <span className="capitalize truncate">{stream.category}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleDeleteClick}
                className="text-gray-400 hover:text-red-400 transition-colors"
                title="Excluir transmissão (Admin)"
              >
                <Trash2 className="h-4 w-4" />
              </motion.button>
            )}
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleShare}
              className="text-gray-400 hover:text-blue-400 transition-colors"
            >
              <Share2 className="h-4 w-4" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleFavorite}
              className={`transition-colors ${isFavorited ? 'text-amber-400' : 'text-gray-400 hover:text-amber-400'}`}
            >
              <Bookmark className="h-4 w-4" fill={isFavorited ? 'currentColor' : 'none'} />
            </motion.button>
          </div>
        </div>
        
        {stream.tags && stream.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {stream.tags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="outline" className="text-xs px-2 py-0 bg-gray-800/50 border-gray-700 text-gray-300 truncate max-w-[100px]">
                #{tag}
              </Badge>
            ))}
            {stream.tags.length > 3 && (
              <Badge variant="outline" className="text-xs px-2 py-0 bg-gray-800/50 border-gray-700 text-gray-300 flex-shrink-0">
                +{stream.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
      
      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Excluir transmissão?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir a transmissão "{stream.title}"? Esta ação não pode ser desfeita.
              {stream.status === 'live' && (
                <span className="block mt-2 text-red-400 font-medium">
                  ⚠️ Esta transmissão está AO VIVO no momento!
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="bg-gray-800 text-white hover:bg-gray-700"
              disabled={isDeleting}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default LiveStreamCard; 