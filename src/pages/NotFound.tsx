import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 relative overflow-hidden">
      {/* Texto de erro no fundo como carrossel animado */}
      <div className="absolute inset-0 flex justify-around pointer-events-none select-none">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="text-[60px] font-bold text-white/[0.01] leading-tight tracking-tighter whitespace-nowrap animate-scroll-vertical"
            style={{ 
              writingMode: 'vertical-rl', 
              textOrientation: 'mixed',
              animationDelay: `${i * 0.2}s`
            }}
          >
            ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR ERROR
          </div>
        ))}
      </div>

      {/* Conteúdo principal */}
      <div className="max-w-md w-full relative z-10">
        {/* Código 404 e título alinhados verticalmente */}
        <div className="mb-8">
          <h1 className="text-[120px] font-light text-white/5 leading-none tracking-tighter mb-2">
            404
          </h1>
        </div>

        {/* Mensagem com alusões a trading */}
        <div className="space-y-4 mb-12">
          <h2 className="text-2xl font-light text-white">
            Stop loss ativado
          </h2>
          <p className="text-zinc-600 text-sm leading-relaxed">
            Você tentou abrir uma posição que não existe no mercado. Esta página foi liquidada ou nunca esteve disponível.
          </p>
        </div>

        {/* Ação única */}
        <button
          onClick={() => navigate('/')}
          className="group flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retornar ao dashboard</span>
        </button>
      </div>

      {/* Estilos de animação */}
      <style>{`
        @keyframes scroll-vertical {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(-50%);
          }
        }
        
        .animate-scroll-vertical {
          animation: scroll-vertical 15s linear infinite;
        }
      `}</style>
    </div>
  );
}
