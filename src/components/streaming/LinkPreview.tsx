import React, { useState, useEffect } from 'react';
import { Link as LinkIcon, ExternalLink } from 'lucide-react';

interface LinkPreviewProps {
  url: string;
}

interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  domain: string;
}

export const LinkPreview: React.FC<LinkPreviewProps> = ({ url }) => {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  const getDomain = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  useEffect(() => {
    // Buscar metadados Open Graph via API
    const fetchMetadata = async () => {
      try {
        // Usar um serviço simples de preview (pode ajustar para usar seu próprio backend)
        const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (data.status === 'success') {
          setMetadata({
            title: data.data.title,
            description: data.data.description,
            image: data.data.image?.url,
            domain: getDomain(url),
          });
        } else {
          // Fallback para domínio apenas
          setMetadata({
            domain: getDomain(url),
          });
        }
      } catch (error) {
        console.error('Erro ao buscar metadados:', error);
        setMetadata({
          domain: getDomain(url),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [url]);

  if (loading) {
    return (
      <div className="block mb-3 p-3 bg-white/5 border border-white/10 rounded-xl animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/5" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-white/5 rounded w-3/4" />
            <div className="h-3 bg-white/5 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block mb-3 overflow-hidden bg-white/5 border border-white/10 rounded-xl hover:bg-white/[0.07] transition-all"
    >
      {/* Imagem do preview (se houver) */}
      {metadata?.image && (
        <div className="w-full h-48 overflow-hidden bg-white/5">
          <img
            src={metadata.image}
            alt={metadata.title || 'Link preview'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}

      {/* Conteúdo */}
      <div className="p-3">
        <div className="flex items-start gap-3">
          {!metadata?.image && (
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex-shrink-0">
              <LinkIcon className="h-4 w-4 text-zinc-400" />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            {/* Título */}
            {metadata?.title && (
              <div className="text-sm text-white font-medium line-clamp-2 mb-1">
                {metadata.title}
              </div>
            )}

            {/* Descrição */}
            {metadata?.description && (
              <div className="text-xs text-zinc-400 line-clamp-2 mb-2">
                {metadata.description}
              </div>
            )}

            {/* Domínio */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 truncate">
                {metadata?.domain || getDomain(url)}
              </span>
              <ExternalLink className="h-3 w-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </a>
  );
};
