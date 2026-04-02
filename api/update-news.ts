/**
 * VERCEL SERVERLESS FUNCTION - ATUALIZAR NOTÍCIAS NO BANCO
 * 
 * Esta função:
 * 1. Busca notícias da API Finnhub
 * 2. Salva no banco Supabase (compartilhado entre todos)
 * 3. Economiza requisições de API (apenas 1 atualização centralizada)
 * 
 * Endpoint: /api/update-news
 * Método: POST (com secret key para segurança)
 * 
 * Uso via cron (Vercel Cron Jobs):
 * - A cada 5 horas, automaticamente
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas POST é permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    console.log('📰 [Update News] Iniciando atualização de notícias...');

    // Criar cliente Supabase com service_role (bypass RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // ============================================
    // 1. BUSCAR NOTÍCIAS DA API FINNHUB
    // ============================================
    
    const categories = ['general', 'forex', 'crypto', 'merger'];
    let allNews: any[] = [];

    for (const category of categories) {
      try {
        const finnhubUrl = `https://finnhub.io/api/v1/news?category=${category}&token=${FINNHUB_API_KEY}`;
        
        const response = await fetch(finnhubUrl, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          console.error(`❌ Finnhub API erro: ${response.status} para ${category}`);
          continue;
        }

        const data: FinnhubNewsItem[] = await response.json();
        console.log(`✅ Categoria ${category}: ${data?.length || 0} notícias recebidas`);

        // Filtrar apenas notícias com imagens E de fontes específicas
        const allowedSources = ['CNBC', 'CoinDesk'];
        const filteredNews = data.filter(item => {
          if (!item.image || item.image.trim() === '') return false;
          const source = item.source?.toUpperCase() || '';
          return allowedSources.some(allowed => source.includes(allowed.toUpperCase()));
        });

        console.log(`📰 Filtradas ${filteredNews.length} notícias de CNBC/CoinDesk (de ${data.length} totais)`);

        // Converter para o formato do banco
        const convertedNews = filteredNews.map((item) => ({
          id: `finnhub-${item.id}`,
          headline: item.headline || '',
          summary: item.summary || '',
          source: item.source || '',
          url: item.url || '',
          image_url: item.image || '',
          category: item.category || 'business',
          published_at: new Date(item.datetime * 1000).toISOString(),
          related_symbols: item.related ? item.related.split(',').filter(Boolean) : []
        }));

        allNews = [...allNews, ...convertedNews];
      } catch (error) {
        console.warn(`⚠️ Erro ao processar notícias da categoria ${category}:`, error);
      }
    }

    console.log(`📊 Total de ${allNews.length} notícias para salvar no banco`);

    // ============================================
    // 2. SALVAR NO BANCO (UPSERT)
    // ============================================

    if (allNews.length === 0) {
      // Registrar log de atualização (sem notícias)
      await supabase.from('news_update_log').insert({
        news_count: 0,
        status: 'warning',
        error: 'Nenhuma notícia encontrada'
      });

      return res.status(200).json({
        success: true,
        message: 'Nenhuma notícia nova encontrada',
        count: 0
      });
    }

    // Limpar notícias antigas (manter apenas últimas 48 horas)
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { error: deleteError } = await supabase
      .from('market_news')
      .delete()
      .lt('published_at', twoDaysAgo);

    if (deleteError) {
      console.warn('⚠️ Erro ao limpar notícias antigas:', deleteError);
    } else {
      console.log('🧹 Notícias antigas (>48h) removidas');
    }

    // Inserir/atualizar notícias (upsert)
    const { data: insertedNews, error: insertError } = await supabase
      .from('market_news')
      .upsert(allNews, { onConflict: 'id' })
      .select();

    if (insertError) {
      console.error('❌ Erro ao salvar notícias:', insertError);
      
      // Registrar log de erro
      await supabase.from('news_update_log').insert({
        news_count: 0,
        status: 'error',
        error: insertError.message
      });

      return res.status(500).json({
        success: false,
        error: insertError.message
      });
    }

    console.log(`✅ ${insertedNews?.length || 0} notícias salvas no banco`);

    // ============================================
    // 3. REGISTRAR LOG DE SUCESSO
    // ============================================

    await supabase.from('news_update_log').insert({
      news_count: insertedNews?.length || 0,
      status: 'success',
      error: null
    });

    return res.status(200).json({
      success: true,
      message: 'Notícias atualizadas com sucesso',
      count: insertedNews?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [Update News] Erro:', error);
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    });
  }
}
