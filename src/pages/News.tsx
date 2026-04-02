import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMarketNews } from "@/services/news";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { format, formatDistance } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Newspaper, AlertTriangle, Clock, Filter } from "lucide-react";
import { MarketNews as BaseMarketNews } from "@/services/types";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

// Definir categorias de filtro agrupadas com traduções - função auxiliar
const getNewsCategories = (t: (key: string) => string) => [
  {
    id: 'all',
    label: t('news.filter.all') || 'Todas',
    keywords: []
  },
  {
    id: 'markets',
    label: t('news.filter.markets') || 'Mercados & Trading',
    keywords: ['stock', 'market', 'trading', 'investment', 'investor', 'finance', 'financial', 'earnings', 'revenue', 'profit', 'loss', 'ipo', 'dividend', 'portfolio', 'fund', 'etf', 'bond', 'yield', 'nasdaq', 'dow jones', 's&p', 'wall street', 'nyse', 'mercado', 'financeiro', 'investimento', 'negócios', 'ações', 'bolsa', 'bovespa', 'ação', 'fundo', 'dividendo', 'lucro', 'receita', 'prejuízo', 'carteira', 'rendimento', 'stocks', 'acciones', 'inversión', 'bolsa de valores', 'mercados financieros']
  },
  {
    id: 'economy',
    label: t('news.filter.economy') || 'Economia & Política',
    keywords: ['economy', 'economic', 'gdp', 'inflation', 'recession', 'growth', 'bank', 'banking', 'federal reserve', 'fed', 'interest rate', 'macroeconomics', 'macroeconomia', 'macro', 'pib', 'juros', 'selic', 'monetary policy', 'política monetária', 'central bank', 'banco central', 'economia', 'econômico', 'regulation', 'regulamentação', 'compliance', 'legislation', 'lei', 'inflação', 'recessão', 'crescimento', 'banco', 'bancário', 'taxa de juros', 'legislação', 'economía', 'inflación', 'recesión', 'crecimiento', 'política económica']
  },
  {
    id: 'tech',
    label: t('news.filter.tech') || 'Tecnologia & Inovação',
    keywords: ['ai', 'artificial intelligence', 'cloud', 'nuvem', 'cybersecurity', 'cyber', 'segurança cibernética', 'technology', 'tech', 'fintech', 'digital bank', 'banco digital', 'open banking', 'startup', 'start-up', 'venture capital', 'vc', 'fundraising', 'inteligência artificial', 'tecnologia', 'segurança digital', 'banco aberto', 'capital de risco', 'captação de recursos', 'inovação', 'software', 'aplicativo', 'plataforma digital', 'tecnología', 'innovación', 'inteligencia artificial', 'tecnología digital', 'ciberseguridad']
  },
  {
    id: 'commodities',
    label: t('news.filter.commodities') || 'Commodities & ESG',
    keywords: ['commodities', 'commodity', 'oil', 'petróleo', 'gold', 'ouro', 'agricultural', 'soja', 'corn', 'milho', 'sustainability', 'sustentabilidade', 'esg', 'environmental', 'social', 'governance', 'carbon', 'emission', 'renewable', 'energia renovável', 'solar', 'wind', 'eólica', 'energy transition', 'transition', 'real estate', 'imobiliário', 'construction', 'construção', 'meio ambiente', 'ambiental', 'governança', 'carbono', 'emissão', 'renovável', 'transição energética', 'mercado imobiliário', 'materias primas', 'sostenibilidad', 'energía renovable', 'transición energética']
  },
  {
    id: 'global',
    label: t('news.filter.global') || 'Global & Geopolítica',
    keywords: ['war', 'conflict', 'military', 'sanctions', 'trade war', 'geopolitical', 'geopolitics', 'geopolítica', 'ukraine', 'russia', 'china', 'taiwan', 'supply chain', 'guerra', 'conflito', 'sanções', 'export', 'import', 'trade', 'tariff', 'currency', 'dollar', 'euro', 'yen', 'pound', 'exportação', 'importação', 'comércio', 'moeda', 'healthcare', 'health', 'biotech', 'biotecnologia', 'pharma', 'pharmaceutical', 'e-commerce', 'commerce', 'consumption', 'consumo', 'militar', 'guerra comercial', 'cadeia de suprimentos', 'tarifa', 'dólar', 'saúde', 'farmacêutico', 'comércio eletrônico', 'geopolítica', 'conflicto', 'sanciones', 'guerra comercial', 'cadena de suministro']
  }
];

// Declaração global para logs
declare global {
  interface Window {
    __lastNewsTimerLog?: number;
  }
}

// Definir uma interface para o formato dos dados retornados pela API Finnhub
interface FinnhubNewsItem {
  id: string | number;
  title?: string;
  headline?: string;
  description?: string;
  summary?: string;
  content?: string;
  source?: string;
  url?: string;
  publishedAt?: number;
  datetime?: number;
  imageUrl?: string;
  image?: string;
  relatedSymbols?: string[];
}

// Estendendo a interface MarketNews para adicionar propriedades específicas desta página
interface MarketNews extends BaseMarketNews {
  id: string;
  headline?: string;
  image?: string;
  isTemporaryImage?: boolean;
  relatedSymbols?: string[];
  category?: string;
}

// Estilo para animação de carregamento de notícias
const newsLoadingStyles = `
  @keyframes newsLoadingPulse {
    0% {
      opacity: 0.7;
      transform: scale(0.99);
    }
    50% {
      opacity: 0.9;
      transform: scale(1);
    }
    100% {
      opacity: 0.7;
      transform: scale(0.99);
    }
  }
  
  @keyframes newsIconSpin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
  
  .news-loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    animation: newsLoadingPulse 1.5s infinite ease-in-out;
  }
  
  .news-loading-icon {
    margin-bottom: 0.75rem;
    animation: newsIconSpin 2s infinite linear;
  }
  
  .news-loading-text {
    font-size: 0.95rem;
    font-weight: 500;
    text-align: center;
  }
  
  @keyframes fade-in {
    from { 
      opacity: 0; 
      transform: translateY(10px);
    }
    to { 
      opacity: 1; 
      transform: translateY(0);
    }
  }
  
  .animate-fade-in {
    animation: fade-in 0.4s ease-out;
  }
`;

// Função para calcular o tempo relativo da publicação
const getRelativeTime = (datetime: number | string): string => {
  try {
    // Converter para um timestamp numérico (em milissegundos)
    let timestamp: number;
    
    if (typeof datetime === 'string') {
      // Se for uma string ISO, converter para Date
      timestamp = new Date(datetime).getTime();
    } else if (typeof datetime === 'number') {
      // Se já for um número, verificar se está em segundos (Finnhub) ou milissegundos
      timestamp = datetime < 10000000000 ? datetime * 1000 : datetime;
    } else {
      // Se não for string nem número, usar data atual (fallback)
      // Formato inválido (silenciado)
      return '';
    }
    
    // Verificar se o timestamp é válido e não é no futuro
    const now = new Date().getTime();
    if (isNaN(timestamp) || timestamp > now) {
      // Timestamp inválido (silenciado)
      return '';
    }
    
    // Se o timestamp for mais de 1 ano atrás, pode ser um erro
    // (algumas APIs têm bugs que retornam datas muito antigas)
    const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
    if (timestamp < oneYearAgo) {
      // Timestamp muito antigo (silenciado)
      // Usar um valor mais recente como fallback
      return 'recentemente';
    }
    
    // Calcular o tempo relativo em português
    return formatDistance(new Date(timestamp), new Date(), { 
      addSuffix: true,
      locale: ptBR 
    });
  } catch (error) {
    console.error('Erro ao calcular tempo relativo:', error);
    return 'recentemente'; // Fallback seguro em caso de erro
  }
};

const News = () => {
  
  // ✅ CORREÇÃO: Carregar timestamp do localStorage ou usar atual
  const getLastUpdateTimestamp = (): number => {
    try {
      const stored = localStorage.getItem('news_last_update_timestamp');
      if (stored) {
        const timestamp = parseInt(stored, 10);
        // Timestamp carregado (silenciado)
        return timestamp;
      }
    } catch (e) {
      // Erro ao carregar timestamp (silenciado)
    }
    // Primeira vez (silenciado)
    return Date.now();
  };
  
  // Referência para armazenar o timestamp da última atualização bem-sucedida
  const lastSuccessfulUpdate = useRef<number>(getLastUpdateTimestamp());
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  
  // ✅ CACHE DE TRADUÇÃO para melhorar performance
  const translationCache = useRef<Record<string, string>>({});
  
  // Função para gerar chave de cache
  const getCacheKey = (text: string, targetLang: string): string => {
    return `translation_${targetLang}_${text.substring(0, 100)}`;
  };
  
  // Carregar cache do localStorage ao montar
  useEffect(() => {
    try {
      const cached = localStorage.getItem('translation_cache_google');
      if (cached) {
        const parsed = JSON.parse(cached);
        translationCache.current = parsed;
        // Cache carregado (silenciado)
      }
    } catch (e) {
      // Erro ao carregar cache (silenciado)
    }
  }, []);
  
  // Função para salvar cache no localStorage
  const saveTranslationCache = () => {
    try {
      localStorage.setItem('translation_cache_google', JSON.stringify(translationCache.current));
    } catch (e) {
      // Erro ao salvar cache (silenciado)
    }
  };
  
  // ✅ Função para traduzir texto usando Google Translate (GRATUITA E ILIMITADA)
  const translateTextLocal = async (text: string, targetLang: string): Promise<string> => {
    if (!text || text.trim() === '') {
      return text;
    }
    
    // ✅ Verificar cache primeiro
    const cacheKey = getCacheKey(text, targetLang);
    if (translationCache.current[cacheKey]) {
      return translationCache.current[cacheKey];
    }
    
    try {
      // ✅ Usar Google Translate público (gratuito, ilimitado e sem API key)
      // Usar endpoint público do Google Translate
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text.slice(0, 5000))}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        // Erro na API (silenciado)
        return text;
      }
      
      const data = await response.json();
      
      // Google Translate retorna array com estrutura: [[[texto_traduzido, texto_original, ...]]]
      const translated = data[0]?.map((item: [string, string]) => item[0]).join('') || text;
      
      // ✅ Salvar no cache
      translationCache.current[cacheKey] = translated;
      saveTranslationCache();
      
      return translated;
      
    } catch (error) {
      // Erro ao traduzir (silenciado)
      // ✅ Fallback: retornar texto original
      return text;
    }
  };
  
  // Estado para filtro de categoria
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Definir categorias de filtro agrupadas com traduções
  const NEWS_CATEGORIES = useMemo(() => getNewsCategories(t), [t]);
  
  // Função para verificar se uma notícia pertence a uma categoria
  const newsMatchesCategory = useCallback((newsItem: MarketNews, categoryId: string): boolean => {
    if (categoryId === 'all') return true;
    
    const category = NEWS_CATEGORIES.find(cat => cat.id === categoryId);
    if (!category || category.keywords.length === 0) return true;
    
    // Combinar todos os textos da notícia para busca mais abrangente
    const title = (newsItem.title || '').toLowerCase();
    const summary = (newsItem.summary || '').toLowerCase();
    const content = (newsItem.content || '').toLowerCase();
    const source = (newsItem.source || '').toLowerCase();
    const relatedSymbols = (newsItem.relatedSymbols || []).join(' ').toLowerCase();
    
    // Verificar primeiro se o título contém palavras proibidas - REDUZIR RESTRIÇÕES
    const strictTitleBanWords = [
      'celebrity gossip', 'dating rumors', 'wedding photos', 'breakup news',
      'vacation spots', 'travel tips', 'restaurant review', 'movie review',
      'sports game', 'weather forecast', 'horoscope', 'zodiac'
    ];
    
    // Rejeitar apenas se o título contiver palavras muito específicas de exclusão
    for (const banWord of strictTitleBanWords) {
      if (title.includes(banWord)) {
        return false;
      }
    }
    
    // Texto combinado para busca
    const searchText = `${title} ${summary} ${content} ${source} ${relatedSymbols}`;
    
    // Verificar se alguma palavra-chave da categoria está presente
    const matches = category.keywords.some(keyword => {
      const keywordLower = keyword.toLowerCase().trim();
      // Buscar por palavra exata ou como parte de palavra (para siglas como BTC, ETH)
      const exactMatch = searchText.includes(keywordLower);
      // Para siglas de 3-4 caracteres, também verificar como palavra isolada
      const wordMatch = keywordLower.length <= 4 ? 
        new RegExp(`\\b${keywordLower}\\b`, 'i').test(searchText) : false;
      
      return exactMatch || wordMatch;
    });
    
    // REDUZIR palavras-chave de exclusão para ser menos restritivo
    const excludeKeywords = [
      'celebrity gossip', 'dating rumors', 'wedding photos', 'movie review',
      'sports score', 'weather report', 'horoscope', 'zodiac sign'
    ];
    
    const containsExcludeKeyword = excludeKeywords.some(keyword => 
      searchText.includes(keyword.toLowerCase())
    );
    
    // Se contém palavras de exclusão mas tem correspondência com a categoria, aceitar
    if (containsExcludeKeyword && matches) {
      return true; // Priorizar matches da categoria sobre exclusões
    }
    
    // Se não contém palavras de exclusão e tem match, aceitar
    if (!containsExcludeKeyword && matches) {
      return true;
    }
    
    // Log para debug (silenciado)
    
    return matches && !containsExcludeKeyword;
  }, [NEWS_CATEGORIES]);
  
  // Buscar notícias com React Query
  const { data: news, isLoading, error, isFetching } = useQuery({
    queryKey: ['allMarketNews', language],
    queryFn: async () => {
      try {
        const result = await fetchMarketNews({ language, limit: 100 });
        
        const sortedResult = result.sort((a, b) => {
          const aIsCNBC = a.source?.toUpperCase().includes('CNBC') ? 1 : 0;
          const bIsCNBC = b.source?.toUpperCase().includes('CNBC') ? 1 : 0;
          if (aIsCNBC !== bIsCNBC) return bIsCNBC - aIsCNBC;
          const dateA = new Date(a.publishedAt || a.datetime || 0).getTime();
          const dateB = new Date(b.publishedAt || b.datetime || 0).getTime();
          return dateB - dateA;
        });
        
        const targetLang = language === 'pt' ? 'pt' : 
                          language === 'es' ? 'es' : 
                          language === 'en' ? 'en' : 'pt';
        
        const updateTimestamp = Date.now();
        lastSuccessfulUpdate.current = updateTimestamp;
        localStorage.setItem('news_last_update_timestamp', updateTimestamp.toString());
        
        if (targetLang === 'en') return sortedResult;
        
        const translatedNews = await Promise.all(
          sortedResult.map(async (item) => {
            try {
              const translatedTitle = await translateTextLocal(item.headline || item.title || '', targetLang);
              const translatedSummary = await translateTextLocal(item.summary || item.content || '', targetLang);
              return {
                ...item,
                title: translatedTitle || item.title,
                headline: translatedTitle || item.headline,
                summary: translatedSummary || item.summary,
                content: translatedSummary || item.content,
              };
            } catch (err) {
              console.warn('Erro ao traduzir notícia:', err);
              return item;
            }
          })
        );
        
        return translatedNews;
      } catch (e) {
        console.error('[News Page] Erro ao buscar notícias:', e);
        return [];
      }
    },
    enabled: true,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    refetchIntervalInBackground: true,
    retry: 2,
    retryDelay: 3000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  // useMemo em vez de useEffect+setState para evitar loop infinito de re-renders
  const newsWithImages = useMemo(() => {
    if (!news || !Array.isArray(news) || news.length === 0) return [];

    const categories = getNewsCategories(t);

    const classify = (newsItem: MarketNews): string => {
      const title = (newsItem.title || '').toLowerCase();
      const summary = (newsItem.summary || '').toLowerCase();
      const content = (newsItem.content || '').toLowerCase();
      const source = (newsItem.source || '').toLowerCase();
      const relatedSymbols = (newsItem.relatedSymbols || []).join(' ').toLowerCase();
      const searchText = `${title} ${summary} ${content} ${source} ${relatedSymbols}`;

      if (newsItem.category) {
        if (newsItem.category === 'crypto') return 'tech';
        if (newsItem.category === 'forex') return 'global';
        if (newsItem.category === 'merger') return 'markets';
        if (newsItem.category === 'general') {
          for (const cat of categories.slice(1)) {
            if (cat.keywords.some(kw => {
              const k = kw.toLowerCase().trim();
              return searchText.includes(k) || (k.length <= 4 && new RegExp(`\\b${k}\\b`, 'i').test(searchText));
            })) return cat.id;
          }
        }
      }

      for (const cat of categories.slice(1)) {
        if (cat.keywords.some(kw => {
          const k = kw.toLowerCase().trim();
          return searchText.includes(k) || (k.length <= 4 && new RegExp(`\\b${k}\\b`, 'i').test(searchText));
        })) return cat.id;
      }

      return 'global';
    };

    const processedNews = news.map((item: Record<string, unknown>) => {
      const publishedAt = item.published_at || item.publishedAt;
      const processedDatetime = Number(item.datetime) || (publishedAt ? new Date(String(publishedAt)).getTime() : Date.now());

      const newsItem: MarketNews = {
        id: item.id ? String(item.id) : String(Date.now()),
        title: item.title ? String(item.title) : '',
        headline: item.headline ? String(item.headline) : (item.title ? String(item.title) : ''),
        published_at: publishedAt ? String(publishedAt) : new Date(processedDatetime).toISOString(),
        content: item.content ? String(item.content) : (item.summary ? String(item.summary) : ''),
        summary: item.summary ? String(item.summary) : '',
        source: item.source ? String(item.source) : '',
        url: item.url ? String(item.url) : '',
        imageUrl: item.imageUrl ? String(item.imageUrl) : (item.image ? String(item.image) : ''),
        sentiment: 0,
        symbols: Array.isArray(item.symbols) ? (item.symbols as string[]) : [],
        datetime: processedDatetime,
        relatedSymbols: Array.isArray(item.relatedSymbols) ? (item.relatedSymbols as string[]) : [],
        category: item.category ? String(item.category) : ''
      };

      if (!newsItem.category || newsItem.category === 'business') {
        newsItem.category = classify(newsItem);
      }

      return newsItem;
    });

    return processedNews
      .filter(item => item.imageUrl && item.imageUrl.trim() !== '')
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
  }, [news, t]);

  // Filtrar notícias baseado na categoria selecionada
  const filteredNews = useMemo(() => {
    if (!newsWithImages || newsWithImages.length === 0) return [];
    const filtered = newsWithImages.filter(newsItem => newsMatchesCategory(newsItem, selectedCategory));
    
    // Log para debug (silenciado)
    
    return filtered;
  }, [newsWithImages, selectedCategory, newsMatchesCategory]);
  
  // ✅ LISTENER: Forçar atualização quando voltar do background
  useEffect(() => {
    const handleForceUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const timeInBackground = customEvent.detail?.timeInBackground || 0;
      
      // Invalidar e forçar refetch da query de notícias
      queryClient.invalidateQueries({ queryKey: ['allMarketNews'] });
    };

    const handleForceRefresh = () => {
      // Invalidar e forçar refetch
      queryClient.invalidateQueries({ queryKey: ['allMarketNews'] });
    };

    window.addEventListener('force-update-after-background', handleForceUpdate);
    window.addEventListener('force-refresh-signals', handleForceRefresh);

    return () => {
      window.removeEventListener('force-update-after-background', handleForceUpdate);
      window.removeEventListener('force-refresh-signals', handleForceRefresh);
    };
  }, [queryClient]);
  
  // ✅ LISTENER: Invalidar cache quando o idioma mudar
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['allMarketNews'] });
  }, [language, queryClient]);
  
  // Adicionar o estilo de animação ao documento
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = newsLoadingStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  useEffect(() => {
    if (error) {
      console.error("❌ [News Page] Erro ao buscar notícias:", error);
    }
    
    // O React Query já gerencia a atualização automática via refetchInterval
    // Não é necessário criar intervalos manuais
  }, [error]);

  // Estado para próxima atualização
  const [nextUpdateTime, setNextUpdateTime] = useState<string>('');
  const [timeUntilUpdate, setTimeUntilUpdate] = useState<string>('');
  
  // Calcular próxima atualização (5 horas após a última)
  useEffect(() => {
    const updateInterval = 5 * 60 * 60 * 1000; // 5 horas em ms
    
    const updateCountdown = () => {
      const now = Date.now();
      const nextUpdate = lastSuccessfulUpdate.current + updateInterval;
      const timeRemaining = nextUpdate - now;
      
      // Log detalhado para debug (apenas na primeira execução ou a cada minuto)
      const shouldLog = !window.__lastNewsTimerLog || (now - window.__lastNewsTimerLog > 60000);
      if (shouldLog) {
        window.__lastNewsTimerLog = now;
        // News Timer (silenciado)
      }
      
      if (timeRemaining > 0) {
        // Calcular horas, minutos e segundos restantes
        const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
        const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((timeRemaining % (60 * 1000)) / 1000);
        
        // Formato: "às HH:MM" no timezone de Brasília
        const nextUpdateDate = new Date(nextUpdate);
        const timeStr = nextUpdateDate.toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo' // ✅ Forçar timezone Brasília
        });
        
        setNextUpdateTime(timeStr);
        
        // Formato de contagem regressiva com segundos
        if (hours > 0) {
          setTimeUntilUpdate(`${hours}h ${minutes}min ${seconds}s`);
        } else if (minutes > 0) {
          setTimeUntilUpdate(`${minutes}min ${seconds}s`);
        } else {
          setTimeUntilUpdate(`${seconds}s`);
        }
      } else {
        setNextUpdateTime('em breve');
        setTimeUntilUpdate('em breve');
      }
    };
    
    // Atualizar a cada segundo para mostrar contagem regressiva em tempo real
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [news]); // ✅ Reagir quando news mudar (nova atualização)

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('nav.news.title')}</h1>
            <p className="text-muted-foreground">
              {t('news.subtitle')}
            </p>
            {/* Indicador de próxima atualização */}
            {nextUpdateTime && (
              <div className="flex items-center gap-2 mt-2 text-sm text-white/60">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Próxima atualização às <span className="font-semibold text-white/80">{nextUpdateTime}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Filtros de categoria - Design ultra transparente preto */}
        <div className="flex flex-wrap gap-3 items-center p-5 bg-black/20 backdrop-blur-xl rounded-xl border border-white/5 shadow-2xl shadow-black/40">
          <div className="flex items-center gap-2 mr-4">
            <Filter className="h-4 w-4 text-white/60" />
            <span className="text-sm font-medium text-white/70">{t('news.filter.label')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {NEWS_CATEGORIES.map((category, index) => {
              const colors = [
                'from-black/60 to-gray-900/60 border-white/20 text-white/90', // Todas
                'from-emerald-500/20 to-emerald-600/20 border-emerald-400/30 text-emerald-200', // Mercados
                'from-blue-500/20 to-blue-600/20 border-blue-400/30 text-blue-200', // Economia
                'from-orange-500/20 to-orange-600/20 border-orange-400/30 text-orange-200', // Crypto
                'from-purple-500/20 to-purple-600/20 border-purple-400/30 text-purple-200', // Tech
                'from-green-500/20 to-green-600/20 border-green-400/30 text-green-200', // Commodities
                'from-red-500/20 to-red-600/20 border-red-400/30 text-red-200' // Global
              ];
              
              const isActive = selectedCategory === category.id;
              const colorClass = colors[index] || colors[0];
              
              return (
                <Button
                  key={category.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className={cn(
                    "relative px-4 py-2.5 rounded-lg transition-all duration-200 ease-out backdrop-blur-md",
                    isActive 
                      ? `bg-gradient-to-r ${colorClass} shadow-lg shadow-black/30 font-semibold` 
                      : "bg-black/10 text-white/60 hover:bg-black/20 hover:text-white/80"
                  )}
                >
                  <span className="relative z-10 text-xs font-medium">
                    {category.label}
                  </span>
                  {isActive && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent rounded-lg"></div>
                      <span className="ml-2 text-xs opacity-70 font-normal">
                        ({filteredNews.length})
                      </span>
                    </>
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Grid de notícias */}
        <div className="grid gap-6" key={selectedCategory}>
          {isLoading ? (
            <Card className="animate-pulse">
              <CardContent className="p-6">
                <div className="news-loading-container">
                  <div className="news-loading-icon">
                    <Newspaper size={32} />
                  </div>
                  <p className="news-loading-text">{t('news.loading')}</p>
                </div>
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                  <p className="text-lg font-medium">{t('news.error.loading')}</p>
                  <p className="text-muted-foreground mb-4">{t('news.error.tryAgain')}</p>
                  <p className="text-sm text-red-500 mt-2 max-w-full overflow-hidden text-ellipsis">{String(error)}</p>
                </div>
              </CardContent>
            </Card>
          ) : !filteredNews || filteredNews.length === 0 ? (
                          <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center">
                    <Newspaper className="h-12 w-12 text-muted-foreground mb-4" />
                    <p>
                      {selectedCategory === 'all' 
                        ? t('news.none') 
                        : `${t('news.filter.noResults')} "${NEWS_CATEGORIES.find(cat => cat.id === selectedCategory)?.label}".`
                      }
                    </p>
                    {selectedCategory !== 'all' && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {t('news.filter.totalAvailable')} {newsWithImages.length} {t('news.filter.news')}
                      </p>
                    )}
                                          <Button 
                        variant="outline" 
                        onClick={() => setSelectedCategory('all')}
                        className="mt-4"
                      >
                        {selectedCategory === 'all' ? t('news.tryAgain') : t('news.filter.viewAll')}
                      </Button>
                  </div>
                </CardContent>
              </Card>
          ) :
            filteredNews?.map((item, index) => (
              <Card 
                key={item.id} 
                className="hover:bg-white/5 transition-all duration-200 cursor-pointer animate-fade-in opacity-0"
                style={{
                  animationDelay: `${index * 50}ms`,
                  animationFillMode: 'forwards'
                }}
                onClick={() => window.open(item.url, '_blank')}
              >
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-[300px,1fr] gap-6">
                    {item.imageUrl ? (
                      // Exibir imagem apenas se existir imageUrl
                      <div className="h-48 overflow-hidden rounded-lg">
                      <img 
                          src={item.imageUrl} 
                        alt={item.headline || item.title || "Notícia"}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          fetchpriority="high"
                          decoding="async"
                        onError={(e) => {
                            // Se a imagem falhar, esconder o elemento
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      // Espaço para notícias sem imagem
                      <div className="h-48 bg-gradient-to-r from-gray-700 to-gray-900 rounded-lg flex items-center justify-center">
                        <Newspaper size={48} className="text-gray-400 opacity-50" />
                        </div>
                      )}
                    <div className="space-y-4">
                      <h2 className="text-2xl font-semibold">{item.headline || item.title || "Notícia sem título"}</h2>
                      <p className="text-muted-foreground line-clamp-3">{item.summary || item.content}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <p className="text-sm text-muted-foreground">
                            {item.source === "CNBC" ? "CNBC" : item.source}
                          </p>
                          {item.category && item.source !== "CNBC" && item.category !== "CNBC" && (
                            <span className="ml-2 text-xs bg-white/10 px-2 py-0.5 rounded-full">
                              {item.category}
                            </span>
                          )}
                        </div>
                        {(item.datetime || item.published_at) && (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="mr-1 h-3 w-3" />
                            <span>{getRelativeTime(item.published_at || item.datetime)}</span>
                          </div>
                        )}
                      </div>
                      {item.relatedSymbols && item.relatedSymbols.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {item.relatedSymbols.map((symbol) => (
                            <span key={symbol} className="px-2 py-1 bg-white/10 rounded-md text-xs">
                              {symbol}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          }
        </div>
      </div>
    </Layout>
  );
};

export default News;
