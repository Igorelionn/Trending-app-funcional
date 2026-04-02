import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserStore } from "@/stores/userStore";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resizeImage } from "@/utils/imageUtils";
import { supabase } from "@/lib/supabase";
import type { SupabaseClient } from '@supabase/supabase-js';

export function UserAvatar() {
  const { user, updateUser } = useUserStore();
  const [isUploading, setIsUploading] = useState(false);
  const [displayName, setDisplayName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Efeito para carregar e sincronizar dados do usuário
  useEffect(() => {
    // Função para carregar dados do usuário
    const loadUserData = () => {
      // Verificar o localStorage primeiro (mais atualizado)
      const storedName = localStorage.getItem("user-name");
      const storedAvatar = localStorage.getItem("user-avatar");
      
      // Preferir dados do localStorage se disponíveis
      if (storedName) {
        setDisplayName(storedName);
      } else if (user?.name) {
        setDisplayName(user.name);
      }
      
      if (storedAvatar) {
        setAvatarUrl(storedAvatar);
      } else if (user?.avatar_url) {
        setAvatarUrl(user.avatar_url);
      } else if (user?.photoURL) {
        setAvatarUrl(user.photoURL);
      }
    };
    
    // Carregar dados iniciais
    loadUserData();
    
    // Configurar listeners para atualizações
    const handleNameUpdated = (event: Event) => {
      const { userName } = (event as CustomEvent).detail;
      if (userName) {
        setDisplayName(userName);
      }
    };
    
    const handleAvatarUpdated = (event: Event) => {
      const { avatarUrl: newAvatarUrl } = (event as CustomEvent).detail;
      if (newAvatarUrl) {
        setAvatarUrl(newAvatarUrl);
      }
    };
    
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "user-name" && event.newValue) {
        setDisplayName(event.newValue);
      } else if (event.key === "user-avatar" && event.newValue) {
        setAvatarUrl(event.newValue);
      }
    };
    
    // Adicionar listeners para eventos
    window.addEventListener('username-updated', handleNameUpdated);
    window.addEventListener('avatar-updated', handleAvatarUpdated);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('profile-updated', loadUserData);
    
    return () => {
      // Remover listeners
      window.removeEventListener('username-updated', handleNameUpdated);
      window.removeEventListener('avatar-updated', handleAvatarUpdated);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('profile-updated', loadUserData);
    };
  }, [user]);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    // Validar tamanho (max 10MB para arquivo original)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 10MB');
      return;
    }

    try {
      setIsUploading(true);
      
      // Redimensionar a imagem antes de salvar (300x300 pixels)
      const resizedImageBlob = await resizeImage(file, 300, 300, 0.8);
      
      // Gerar nome de arquivo único com ID do usuário
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;
      
      // Verificar se o usuário está usando Supabase Storage ou armazenamento local
      let newAvatarUrl;
      
      if (supabase) {
        // Criar um objeto File a partir do Blob redimensionado
        const resizedFile = new File([resizedImageBlob], fileName, { 
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        
        // Upload para o Supabase Storage
        const { data, error } = await (supabase as SupabaseClient)
          .storage
          .from('avatars')
          .upload(fileName, resizedFile, {
            cacheControl: '3600',
            upsert: true
          });
          
        if (error) {
          throw error;
        }
        
        // Obter URL pública
        const { data: urlData } = (supabase as SupabaseClient)
          .storage
          .from('avatars')
          .getPublicUrl(data.path);
          
        newAvatarUrl = urlData.publicUrl;
      } else {
        // Fallback: usar URL de objeto local (temporário)
        newAvatarUrl = URL.createObjectURL(resizedImageBlob);
      }
      
      // Atualizar localStorage
      localStorage.setItem('user-avatar', newAvatarUrl);
      
      // Atualizar estado local
      setAvatarUrl(newAvatarUrl);
      
      // Atualizar o estado do usuário com a nova URL
      updateUser({ ...user, avatar_url: newAvatarUrl });
      
      // Disparar evento para notificar outros componentes
      window.dispatchEvent(new CustomEvent('avatar-updated', { 
        detail: { avatarUrl: newAvatarUrl }
      }));
      
      toast.success('Foto de perfil atualizada com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar a foto de perfil');
      console.error('Error updating avatar:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative group">
      <Avatar 
        className="h-8 w-8 cursor-pointer transition-opacity group-hover:opacity-75" 
        onClick={handleImageClick}
      >
        <AvatarImage 
          src={avatarUrl} 
          alt={displayName || "Usuário"} 
        />
        <AvatarFallback>
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            displayName?.charAt(0) || user?.name?.charAt(0) || "U"
          )}
        </AvatarFallback>
        
        {/* Overlay para hover */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
          <Camera className="h-4 w-4 text-white" />
        </div>
      </Avatar>

      {/* Input file oculto */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleImageChange}
        aria-label="Upload de foto de perfil"
      />
    </div>
  );
} 