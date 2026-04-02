import { LiveStream } from "@/types/video";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, Users, Radio, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Badge } from "./badge";
import { useState, useEffect } from "react";

interface LiveStreamCardProps {
  stream: LiveStream;
  variant?: "default" | "featured" | "sidebar";
  className?: string;
}

export const LiveStreamCard = ({
  stream,
  variant = "default",
  className,
}: LiveStreamCardProps) => {
  const navigate = useNavigate();
  const [duration, setDuration] = useState<number>(0);
  const [viewers, setViewers] = useState<number>(stream.viewers_count);
  
  // Atualizar tempo de transmissão
  useEffect(() => {
    if (!stream.started_at) return;
    
    const calcDuration = () => {
      const start = new Date(stream.started_at!);
      const now = new Date();
      const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
      setDuration(diff);
    };
    
    calcDuration();
    const interval = setInterval(calcDuration, 10000);
    
    return () => clearInterval(interval);
  }, [stream.started_at]);
  
  // Simulação de aumento de viewers
  useEffect(() => {
    const interval = setInterval(() => {
      setViewers(prev => {
        const change = Math.floor(Math.random() * 5) - 1;
        return Math.max(1, prev + change);
      });
    }, 15000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Formatar tempo relativo
  const formattedDate = stream.started_at 
    ? formatDistanceToNow(new Date(stream.started_at), { 
        addSuffix: true, 
        locale: ptBR 
      })
    : "";
  
  // Formatar visualizações
  const formatViewers = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)} M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)} mil`;
    } else {
      return `${count}`;
    }
  };
  
  // Formatar duração da transmissão
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };
  
  // Navegar para página da transmissão
  const handleClick = () => {
    navigate(`/live/${stream.id}`);
  };
  
  // Card padrão (similar ao YouTube)
  if (variant === "default") {
    return (
      <div 
        className={cn(
          "group flex flex-col gap-2 cursor-pointer transition-transform hover:scale-[1.02]",
          className
        )}
        onClick={handleClick}
      >
        {/* Thumbnail com indicador de ao vivo */}
        <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
          <img 
            src={stream.thumbnail} 
            alt={stream.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
          
          {/* Etiqueta "AO VIVO" */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-red-600 animate-pulse"></div>
            <span className="text-white text-xs font-medium bg-red-600 px-1.5 py-0.5 rounded">
              AO VIVO
            </span>
          </div>
          
          {/* Contador de espectadores */}
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs py-0.5 px-1.5 rounded flex items-center">
            <Eye className="h-3 w-3 mr-1" />
            {formatViewers(viewers)}
          </div>
          
          {/* Duração da transmissão */}
          <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs py-0.5 px-1.5 rounded flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {formatDuration(duration)}
          </div>
          
          {/* Overlay de hover */}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Radio className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        
        {/* Informações da transmissão */}
        <div className="flex gap-3">
          {/* Avatar do streamer */}
          <Avatar className="h-9 w-9">
            <AvatarImage 
              src={stream.avatar_url}
              className="object-cover w-full h-full"
            />
            <AvatarFallback>{stream.username.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          
          {/* Título e metadados */}
          <div className="flex flex-col">
            <h3 className="font-medium text-base line-clamp-2">{stream.title}</h3>
            
            <div className="flex flex-col text-xs text-muted-foreground">
              <span className="hover:text-foreground">{stream.username}</span>
              <div className="flex items-center gap-1">
                <span className="text-red-500 font-medium">AO VIVO</span>
                <span className="inline-block w-1 h-1 bg-muted-foreground rounded-full mx-1"></span>
                <span>{formatViewers(viewers)} assistindo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Variante em destaque
  if (variant === "featured") {
    return (
      <div 
        className={cn(
          "group cursor-pointer rounded-lg overflow-hidden relative",
          className
        )}
        onClick={handleClick}
      >
        {/* Thumbnail grande */}
        <div className="relative aspect-[21/9] w-full bg-black">
          <img 
            src={stream.thumbnail} 
            alt={stream.title}
            className="w-full h-full object-cover brightness-[0.85]"
          />
          
          {/* Overlay gradiente para legibilidade */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30"></div>
          
          {/* Etiqueta "AO VIVO" */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-600 animate-pulse"></div>
            <span className="text-white text-sm font-medium bg-red-600 px-2 py-1 rounded">
              AO VIVO
            </span>
          </div>
          
          {/* Informações da transmissão */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex gap-4 items-center mb-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={stream.avatar_url} />
                <AvatarFallback>{stream.username.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              
              <div>
                <h2 className="text-white text-xl font-bold line-clamp-1">{stream.title}</h2>
                <span className="text-white/80 text-sm">{stream.username}</span>
              </div>
            </div>
            
            <div className="flex gap-4 items-center text-white text-sm">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{formatViewers(viewers)} assistindo agora</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>Começou {formattedDate}</span>
              </div>
              
              <Badge variant="secondary" className="ml-auto bg-white/20 text-white border-none backdrop-blur-sm">
                {stream.category}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Variante para sidebar
  if (variant === "sidebar") {
    return (
      <div 
        className={cn(
          "group flex gap-3 cursor-pointer p-2 hover:bg-accent/50 rounded-lg transition-colors",
          className
        )}
        onClick={handleClick}
      >
        <div className="relative w-[100px] aspect-video rounded-lg overflow-hidden bg-black flex-shrink-0">
          <img 
            src={stream.thumbnail} 
            alt={stream.title}
            className="w-full h-full object-cover"
          />
          
          <div className="absolute top-1 left-1 flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse"></div>
            <span className="text-white text-[10px] bg-red-600 px-1 py-px rounded">
              AO VIVO
            </span>
          </div>
        </div>
        
        <div className="flex flex-col">
          <h3 className="font-medium text-sm line-clamp-2">{stream.title}</h3>
          <span className="text-xs text-muted-foreground">{stream.username}</span>
          <div className="flex items-center gap-1 text-xs text-red-500 mt-auto">
            <Eye className="h-3 w-3" />
            <span>{formatViewers(viewers)}</span>
          </div>
        </div>
      </div>
    );
  }
  
  return null;
}; 