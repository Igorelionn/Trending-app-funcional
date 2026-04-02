import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Textarea } from '@/components/ui/textarea';
import * as postsService from '@/services/streamerPostsService';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "O que você está pensando?",
  disabled = false,
  maxLength = 500,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{id: string; nome: string; avatar_url?: string}>>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });

  // Detectar @ para mostrar sugestões de menções
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Verificar se há espaço após @ (se sim, não mostrar sugestões)
      if (!textAfterAt.includes(' ') && textAfterAt.length <= 30) {
        setMentionQuery(textAfterAt);
        setSearchFilter(textAfterAt);
        
        // Calcular posição fixa logo abaixo do textarea (viewport coordinates)
        const rect = textarea.getBoundingClientRect();
        setPopupPosition({
          top: rect.bottom + 8, // Posição no viewport, não segue scroll
          left: rect.left
        });
        
        // Buscar sugestões mesmo com 0 caracteres após @
        const searchQuery = textAfterAt.length > 0 ? textAfterAt : '';
        
        postsService.searchStreamersForMention(searchQuery).then(result => {
          if (result.success && result.streamers && result.streamers.length > 0) {
            setSuggestions(result.streamers);
            setSelectedSuggestionIndex(0);
            setShowMentionSuggestions(true);
          } else {
            setSuggestions([]);
            setShowMentionSuggestions(false);
          }
        }).catch(error => {
          console.error('Erro ao buscar streamers:', error);
          setSuggestions([]);
          setShowMentionSuggestions(false);
        });
      } else {
        setShowMentionSuggestions(false);
        setSuggestions([]);
      }
    } else {
      setShowMentionSuggestions(false);
      setSuggestions([]);
    }
  }, [value]);

  // Filtrar sugestões baseado no filtro de busca
  const filteredSuggestions = suggestions.filter(s => 
    s.nome.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Bloquear scroll da página quando o popup estiver aberto
  useEffect(() => {
    if (showMentionSuggestions) {
      // Salvar posição atual do scroll
      const scrollY = window.scrollY;
      
      // Bloquear scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        // Restaurar scroll
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [showMentionSuggestions]);

  const insertMention = (streamer: {id: string; nome: string}) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    const beforeMention = value.substring(0, lastAtIndex);
    const afterCursor = value.substring(cursorPos);
    
    const newText = `${beforeMention}@${streamer.nome} ${afterCursor}`;
    onChange(newText);
    
    setShowMentionSuggestions(false);
    setSuggestions([]);
    
    setTimeout(() => {
      const newCursorPos = lastAtIndex + streamer.nome.length + 2;
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        insertMention(filteredSuggestions[selectedSuggestionIndex]);
      } else if (e.key === 'Escape') {
        setShowMentionSuggestions(false);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Textarea */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="bg-transparent !border-0 text-white placeholder:text-zinc-500 resize-none min-h-[80px] !ring-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 text-[15px] p-0 !outline-none"
        disabled={disabled}
        maxLength={maxLength}
      />

      {/* Sugestões de menção - Popup minimalista com pesquisa */}
      {showMentionSuggestions && filteredSuggestions.length > 0 && createPortal(
        <div 
          className="fixed z-[99999] w-80"
          style={{
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`
          }}
        >
          <div className="bg-black/95 backdrop-blur-sm border border-white/[0.08] rounded-xl shadow-xl overflow-hidden">
            {/* Barra de pesquisa minimalista */}
            <div className="px-3 py-2 border-b border-white/[0.05]">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => {
                  setSearchFilter(e.target.value);
                  setSelectedSuggestionIndex(0);
                }}
                placeholder="Buscar..."
                className="w-full bg-transparent text-sm text-white placeholder:text-zinc-700 focus:outline-none"
              />
            </div>

            {/* Lista minimalista */}
            <div className="max-h-[240px] overflow-y-auto">
              {filteredSuggestions.map((streamer, index) => {
                const isSelected = index === selectedSuggestionIndex;
                
                return (
                  <button
                    key={streamer.id}
                    onClick={() => insertMention(streamer)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all relative ${
                      isSelected
                        ? 'bg-white/10'
                        : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Faixa lateral para item selecionado */}
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-white" />
                    )}
                    
                    {streamer.avatar_url ? (
                      <img
                        src={streamer.avatar_url}
                        alt={streamer.nome}
                        className={`w-10 h-10 rounded-full object-cover flex-shrink-0 transition-all ${
                          isSelected ? 'ring-2 ring-white/40' : ''
                        }`}
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-full bg-white/[0.05] flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected ? 'bg-white/10 ring-2 ring-white/40' : ''
                      }`}>
                        <span className="text-sm font-medium text-zinc-600">
                          {streamer.nome.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] font-medium truncate transition-colors ${
                        isSelected ? 'text-white font-semibold' : 'text-white/90'
                      }`}>
                        {streamer.nome}
                      </div>
                      <div className={`text-[11px] truncate transition-colors ${
                        isSelected ? 'text-zinc-500' : 'text-zinc-600'
                      }`}>
                        @{streamer.nome.toLowerCase().replace(/\s+/g, '')}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
