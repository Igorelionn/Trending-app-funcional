/**
 * VERCEL SERVERLESS FUNCTION - PROXY FINNHUB NEWS
 * 
 * Esta função faz proxy das requisições para a API Finnhub,
 * resolvendo problemas de CORS ao chamar diretamente do navegador.
 * 
 * Endpoint: /api/finnhub-news?category=general
 * Categorias: general, forex, crypto, merger
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';

// Interface para os dados retornados pela API Finnhub
interface FinnhubNewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas GET é permitido
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { category = 'general', minId = '0' } = req.query;

    // Validar categoria
    const validCategories = ['general', 'forex', 'crypto', 'merger'];
    const categoryStr = Array.isArray(category) ? category[0] : category;
    
    if (!validCategories.includes(categoryStr)) {
      return res.status(400).json({ 
        error: 'Categoria inválida',
        validCategories 
      });
    }

    console.log(`📰 [Finnhub Proxy] Buscando notícias: ${categoryStr}`);

    // Fazer requisição para Finnhub
    const finnhubUrl = `https://finnhub.io/api/v1/news?category=${categoryStr}&minId=${minId}&token=${FINNHUB_API_KEY}`;
    
    const response = await fetch(finnhubUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`❌ Finnhub API erro: ${response.status}`);
      return res.status(response.status).json({ 
        error: `Erro Finnhub: ${response.statusText}` 
      });
    }

    const data: FinnhubNewsItem[] = await response.json();

    console.log(`✅ [Finnhub Proxy] ${data?.length || 0} notícias recebidas`);

    // Filtrar apenas notícias com imagens E de fontes específicas
    const allowedSources = ['CNBC', 'CoinDesk'];
    const filteredNews = data.filter(item => {
      // Deve ter imagem
      if (!item.image || item.image.trim() === '') return false;
      
      // Deve ser de fonte permitida (case-insensitive)
      const source = item.source?.toUpperCase() || '';
      return allowedSources.some(allowed => source.includes(allowed.toUpperCase()));
    });

    console.log(`📰 Filtradas ${filteredNews.length} notícias de CNBC/CoinDesk (de ${data.length} totais)`);

    // Converter para o formato esperado pelo frontend
    const convertedNews = filteredNews.map((item) => ({
      id: `finnhub-${item.id || Date.now()}`,
      title: item.headline || '',
      headline: item.headline || '',
      description: item.summary || '',
      summary: item.summary || '',
      content: item.summary || '',
      source: item.source || '',
      url: item.url || '',
      publishedAt: item.datetime * 1000, // Finnhub usa segundos, convertemos para ms
      datetime: item.datetime * 1000,
      imageUrl: item.image || '',
      image: item.image || '',
      category: item.category || 'business',
      relatedSymbols: item.related ? item.related.split(',').filter(Boolean) : []
    }));

    // Cache por 3 minutos
    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate');

    return res.status(200).json({
      success: true,
      category: categoryStr,
      total: convertedNews.length,
      news: convertedNews,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [Finnhub Proxy] Erro:', error);
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    });
  }
}
