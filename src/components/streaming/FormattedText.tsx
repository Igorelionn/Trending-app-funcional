import React from 'react';
import { useNavigate } from 'react-router-dom';

interface FormattedTextProps {
  text: string;
  className?: string;
  mentions?: Array<{ id: string; nome: string; avatar_url?: string }>;
}

export const FormattedText: React.FC<FormattedTextProps> = ({ text, className = '', mentions = [] }) => {
  const navigate = useNavigate();

  // Criar mapa de menções para acesso rápido
  const mentionsMap = new Map(mentions.map(m => [m.nome.toLowerCase().replace(/\s+/g, ''), m]));

  const parseText = (content: string) => {
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    // Regex para: **negrito**, *itálico*, @menção
    const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(@[\wÀ-ÿ]+(?:\s+[\wÀ-ÿ]+)*)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Adicionar texto antes do match
      if (match.index > lastIndex) {
        elements.push(content.substring(lastIndex, match.index));
      }

      if (match[1]) {
        // **Negrito**
        elements.push(
          <strong key={match.index} className="font-semibold">
            {match[2]}
          </strong>
        );
      } else if (match[3]) {
        // *Itálico*
        elements.push(
          <em key={match.index} className="italic">
            {match[4]}
          </em>
        );
      } else if (match[5]) {
        // @Menção
        const mentionText = match[5]; // @Nome Completo
        const mentionName = mentionText.substring(1).trim(); // Remove @ e trim
        const mentionKey = mentionName.toLowerCase().replace(/\s+/g, '');
        const mentionData = mentionsMap.get(mentionKey);

        if (mentionData) {
          // Renderizar menção como chip visual com foto
          elements.push(
            <button
              key={match.index}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${mentionData.id}`);
              }}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-0.5 bg-white/10 hover:bg-white/15 border border-white/20 rounded-full transition-colors align-middle"
            >
              {mentionData.avatar_url ? (
                <img
                  src={mentionData.avatar_url}
                  alt={mentionData.nome}
                  className="w-4 h-4 rounded-full object-cover"
                />
              ) : (
                <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center">
                  <span className="text-[8px] font-medium text-white">
                    {mentionData.nome.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-xs font-medium text-white">
                {mentionData.nome}
              </span>
            </button>
          );
        } else {
          // Se não encontrou a menção nos dados reais, renderizar como texto normal (não azul)
          elements.push(
            <span key={match.index}>
              {mentionText}
            </span>
          );
        }
      }

      lastIndex = match.index + match[0].length;
    }

    // Adicionar texto restante
    if (lastIndex < content.length) {
      elements.push(content.substring(lastIndex));
    }

    return elements;
  };

  // Processar quebras de linha e listas
  const lines = text.split('\n');
  const processedLines = lines.map((line, lineIndex) => {
    // Lista não ordenada
    if (line.trim().startsWith('- ')) {
      return (
        <li key={lineIndex} className="ml-4">
          {parseText(line.trim().substring(2))}
        </li>
      );
    }
    
    // Lista ordenada
    const numberedMatch = line.trim().match(/^(\d+)\.\s(.+)$/);
    if (numberedMatch) {
      return (
        <li key={lineIndex} className="ml-4" style={{ listStyleType: 'decimal' }}>
          {parseText(numberedMatch[2])}
        </li>
      );
    }

    // Linha normal
    return (
      <React.Fragment key={lineIndex}>
        {parseText(line)}
        {lineIndex < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });

  return (
    <div className={className}>
      {processedLines}
    </div>
  );
};
