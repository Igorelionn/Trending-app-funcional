import Layout from "@/components/Layout";
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  Clock, 
  Target, 
  TrendingUp, 
  BarChart3, 
  ListFilter,
  RefreshCw, 
  ChevronDown,
  ChevronRight,
  CheckCheck,
  Timer,
  Clock4,
  ExternalLink,
  Filter,
  Zap,
  Sparkles,
  Briefcase,
  X
} from "lucide-react";
import { useQuery, useQueryClient, QueryClient } from "@tanstack/react-query";
import { TradingSignal, fetchTradingSignals, getLatestPrices } from "@/services";
import { format, formatDistanceToNow, addMinutes, isAfter, addDays, startOfDay, parse, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useRealtimeSignals } from "@/hooks/useRealtimeSignals";
import { useExtendedSignals } from "@/hooks/useExtendedSignals";
import { Button } from "@/components/ui/button";

import { SignalStrength as SignalStrengthEnum, SignalType } from "@/services/types";
// import { tradingSignalService } from "@/services/TradingSignalService"; // Removido - arquivo n??o existe mais
import { motion, AnimatePresence } from "framer-motion";
import { TimeZoneSelector } from "@/components/dashboard/TimeZoneSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTimeZone } from "@/contexts/TimeZoneContext";
import { useTrendingNotifications } from "@/contexts/TrendingNotificationContext";
import CryptoTickerFooter from "@/components/CryptoTickerFooterFixed";
import { useSignalNotifications } from "@/hooks/useSignalNotifications";
import { traderLinkService } from "@/services/traderLinkService";
import { useTradingSignalsRealtime } from "@/hooks/useSupabaseRealtime";
import { RealtimeStatus } from "@/components/RealtimeStatus";

// Interfaces de tipo para diagn??stico
interface MemoryInfo {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
}

interface BrowserDiagnostics {
  userAgent: string;
  renderingEngine: string;
  screenResolution: string;
  memoryInfo?: MemoryInfo | string;
}

interface BrowserInfo {
  name: string;
  version: string;
  isOperar?: boolean;
}

// Declara????o para auxiliar na depura????o do navegador Operar
declare global {
  interface Window {
    BROWSER_INFO?: BrowserInfo;
    DEBUG_LOGS?: string[];
    dumpDebugLogs?: () => void;
    crashInfo?: Error | Record<string, unknown>;
    lastRenderError?: Error;
    BROWSER_DIAGNOSTICS?: BrowserDiagnostics;
  }
}

// Inicializar vari??veis de diagn??stico
if (typeof window !== 'undefined') {
  try {
    // Detectar navegador para logs espec??ficos
    const ua = navigator.userAgent;
    window.BROWSER_INFO = {
      name: ua.includes('Edge') ? 'Edge' : 
            ua.includes('Chrome') ? 'Chrome' : 
            ua.includes('Firefox') ? 'Firefox' : 
            ua.includes('Safari') ? 'Safari' : 
            ua.includes('Opera') ? 'Opera' : 'Unknown',
      version: (ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/(\d+\.\d+)/)?.[2] || ''),
      isOperar: ua.includes('Opera')
    };
    
    // Capturar informa????es de diagn??stico
    const performanceMemory = (performance as { memory?: MemoryInfo }).memory;
    const navigatorVendor = (navigator as { vendor?: string }).vendor;
    
    window.BROWSER_DIAGNOSTICS = {
      userAgent: navigator.userAgent,
      renderingEngine: navigatorVendor || 'Unknown',
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      memoryInfo: performanceMemory ? 
        { 
          jsHeapSizeLimit: performanceMemory.jsHeapSizeLimit,
          totalJSHeapSize: performanceMemory.totalJSHeapSize,
          usedJSHeapSize: performanceMemory.usedJSHeapSize
        } : 'Not available'
    };
    
    // Array para armazenar logs de diagn??stico
    window.DEBUG_LOGS = [];
    
    window.dumpDebugLogs = () => {};
    
    // Capturar erros globais
    window.addEventListener('error', function(event) {
      window.crashInfo = {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.toString(),
        stack: event.error?.stack,
        time: new Date().toISOString()
      };
      
      // Adicionar ao log
      if (window.DEBUG_LOGS) {
        window.DEBUG_LOGS.push(`??? ERRO GLOBAL: ${event.message} (${event.filename}:${event.lineno}:${event.colno})`);
      }
      
    });
  } catch {
    // ignorar erros de diagnóstico
  }
}

// Cache de sinais para o dia
interface GenericCache {
  signals: PlaceholderSignal[];
  date: string; 
}

let signalCache: GenericCache | null = null;

// ???? SISTEMA DE PERSIST??NCIA NAVEGACIONAL (CAMADAS 3-6)
// Sistema robusto de persist??ncia que mant??m sinais entre navega????es
interface PersistentSignalsNavigation {
  signals: PlaceholderSignal[];
  timestamp: number;
  version: string;
  count: number;
  lastTabSwitch: number;
}

// FUN????O PRESERVATIVA: Salvar sinais automaticamente
const saveSignalsToNavigationCache = (signals: PlaceholderSignal[]): void => {
  try {
    if (!signals || signals.length < 4) {
      return;
    }

    // Salvar para persist??ncia da aba Trades
    const cacheData: PersistentSignalsNavigation = {
      signals,
      timestamp: Date.now(),
      version: '2.1-new-logic', // Nova vers??o para for??ar atualiza????o
      count: signals.length,
      lastTabSwitch: Date.now()
    };
    localStorage.setItem('persistent-signals-navigation', JSON.stringify(cacheData));
    
    // SINCRONIZA????O BIDIRECIONAL REFOR??ADA: Compartilhar os 3 primeiros sinais com a Dashboard
    if (signals.length >= 3) {
      // Garantir que os sinais tenham todas as propriedades necess??rias
      const enrichedSignals = signals.slice(0, 3).map((signal, index) => ({
        ...signal,
        // Propriedades obrigat??rias
        id: signal.id || `trade-signal-${Date.now()}-${index}`,
        symbol: signal.symbol,
        entry_time: signal.entry_time,
        signal: signal.signal || (Math.random() > 0.5 ? 'BUY' : 'SELL'),
        // Propriedades espec??ficas da Dashboard
        isDashboard: true,
        position: index + 1,
        dashboardPosition: index,
        // Garantir que est??o completos
        exchange: signal.exchange || inferExchangeCategory(signal.symbol),
        timeframe: signal.timeframe || '5m',
        expiry: signal.expiry || '5m'
      }));
      
      const dashboardData = {
        signals: enrichedSignals,
        timestamp: Date.now(),
        version: '2.0-enhanced',
        source: 'signals'
      };
      
      // Salvar em m??ltiplos locais para garantir acesso
      localStorage.setItem('tradesSignals', JSON.stringify(dashboardData));
      localStorage.setItem('dashboardSignals', JSON.stringify(dashboardData)); // Atualizar diretamente
      
      // Notificar a dashboard imediatamente via m??ltiplos eventos
      window.dispatchEvent(new CustomEvent('tradesSignalsUpdated', { detail: dashboardData }));
      window.dispatchEvent(new CustomEvent('forceDashboardSync', { detail: dashboardData }));
      
    }
  } catch {
    // ignorar erros de cache
  }
};

// FUN????O PRESERVATIVA: Carregar sinais automaticamente
const loadSignalsFromNavigationCache = (): PlaceholderSignal[] | null => {
  try {
    const cacheData = localStorage.getItem('persistent-signals-navigation');
    if (!cacheData) return null;
    
    const parsed: PersistentSignalsNavigation = JSON.parse(cacheData);
    
    // Verificar se a vers??o ?? compat??vel com a nova l??gica
    if (parsed.version !== '2.1-new-logic') {
      localStorage.removeItem('persistent-signals-navigation');
      return null;
    }
    
    const MAX_CACHE_AGE = 30 * 60 * 1000;
    if (Date.now() - parsed.timestamp > MAX_CACHE_AGE) {
      localStorage.removeItem('persistent-signals-navigation');
      return null;
    }
    
    if (parsed.signals && parsed.signals.length >= 7) {
      return parsed.signals;
    }
    
    return null;
  } catch {
    localStorage.removeItem('persistent-signals-navigation');
    return null;
  }
};

// Fun????o para limpar cache quando sinais da dashboard mudarem
const clearNavigationCacheOnDashboardChange = (): void => {
  try {
    localStorage.removeItem('persistent-signals-navigation');
  } catch {
    // ignorar erros de limpeza de cache
  }
};

// ??????? VERIFICA????O INTELIGENTE DE CACHE (CAMADAS 1-2)
// S?? limpa cache em casos REALMENTE cr??ticos
const shouldClearCacheIntelligent = (currentSignals: PlaceholderSignal[]): boolean => {
  if (!currentSignals) return true;
  
  // CASO CR??TICO 1: Menos de 4 sinais
  if (currentSignals.length < 4) {
    return true;
  }
  
  const hasBinanceSignals = currentSignals.some(signal => 
    signal.symbol?.toLowerCase().includes('binance') ||
    signal.exchange?.toLowerCase().includes('binance')
  );
  
  if (hasBinanceSignals) {
    return true;
  }
  
  const invalidTimeSignals = currentSignals.filter(signal => {
    if (!signal.entry_time) return true;
    const [_, minutes] = signal.entry_time.split(':').map(Number);
    return ![3, 23, 43].includes(minutes);
  });
  
  if (invalidTimeSignals.length > currentSignals.length / 2) {
    return true;
  }
  
  // N??O ?? caso cr??tico - PRESERVAR sinais
  return false;
};

// Declara????es das fun????es preservativas ser??o movidas para depois de generateDailySignals

// Constantes para controle dos tempos dos sinais
const SIGNAL_EXPIRY_TIME = 5; // Tempo de expira????o em minutos (sempre 5 minutos)
const TIME_BETWEEN_SIGNALS = 20; // Tempo entre sinais (padr??o XX:03, XX:23, XX:43)
const RESULT_TIME = 16; // Tempo at?? mostrar o resultado (16 minutos ap??s a entrada)
const FIRST_SIGNAL_TIME = "00:03"; // Hor??rio do primeiro sinal do dia (sempre come??a com XX:03)
const WIN_LOSS_RATIO = 9; // Propor????o de 9 ganhos para 1 perda
// Minutos v??lidos para sinais - seguindo padr??o sequencial XX:03, XX:23, XX:43
const VALID_MINUTES = [3, 23, 43]; // Padr??o sequencial: 03 -> 23 -> 43 -> (hora+1):03

// Lista de ativos dispon??veis com suas categorias
const ATIVOS_CATEGORIAS: Record<string, string> = {
  // A????es
  "AIG": "A????es",
  "Alibaba Group Holding": "A????es",
  "Amazon": "A????es",
  "Amazon/Alibaba": "A????es",
  "Amazon/Ebay": "A????es",
  "Apple": "A????es",
  "Baidu, Inc. ADR": "A????es",
  "Citigroup, Inc": "A????es",
  "Coca-Cola Company": "A????es",
  "Meta": "A????es",
  "Google": "A????es",
  "Alphabet/Microsoft": "A????es",
  "Goldman Sachs Group, Inc.": "A????es",
  "Intel Corporation": "A????es",
  "Intel/IBM": "A????es",
  "JPMorgan Chase E Co.": "A????es",
  "McDonald??s Corporation": "A????es",
  "Meta/Alphabet": "A????es",
  "Morgan Stanley": "A????es",
  "Microsoft Corporation": "A????es",
  "Microsoft/Apple": "A????es",
  "Netflix/Amazon": "A????es",
  "Snap Inc.": "A????es",
  "Tesla": "A????es",
  "Tesla/Ford": "A????es",
  
  // Commodities
  "Crude Oil Brent": "Commodities",
  "Crude Oil WTI": "Commodities",
  "Silver": "Commodities",
  "Ouro/Prata": "Commodities",
  "Gold": "Commodities",
  "G??s Natural": "Commodities",
  
  // ??ndices
  "AUS 200": "??ndices",
  "EU 50": "??ndices",
  "FR 40": "??ndices",
  "GER 30": "??ndices",
  "GER30/UK100": "??ndices",
  "HK 33": "??ndices",
  "JP 225": "??ndices",
  "SP 35": "??ndices",
  "US 500": "??ndices",
  "UK 100": "??ndices",
  "US100/JP225": "??ndices",
  "US2000": "??ndices",
  "US 30": "??ndices",
  "US30/JP225": "??ndices",
  "US500/JP225": "??ndices",
  "US 100": "??ndices",

  // Cripto
  "Arbitrum": "Cripto",
  "Cosmos": "Cripto",
  "Bitcoin Cash": "Cripto",
  "Bonk": "Cripto",
  "Bitcoin": "Cripto",
  "Cardano": "Cripto",
  "Dash": "Cripto",
  "Dogecoin": "Cripto",
  "Polkadot": "Cripto",
  "DYDX": "Cripto",
  "EOS": "Cripto",
  "Ethereum": "Cripto",
  "Fartcoin": "Cripto",
  "Artificial Superintelligence Alliance": "Cripto",
  "Floki": "Cripto",
  "Gala": "Cripto",
  "Graph": "Cripto",
  "Hedera": "Cripto",
  "ICP": "Cripto",
  "Immutable": "Cripto",
  "Injective": "Cripto",
  "IOTA": "Cripto",
  "J??piter": "Cripto",
  "Chainlink": "Cripto",
  "Litecoin": "Cripto",
  "Decentraland": "Cripto",
  "Polygon": "Cripto",
  "MELANIA Coin": "Cripto",
  "NEAR": "Cripto",
  "Ondo": "Cripto",
  "Onyxcoin": "Cripto",
  "ORDI": "Cripto",
  "Pudgy Penguins": "Cripto",
  "Pepe": "Cripto",
  "Pyth": "Cripto",
  "Raydium": "Cripto",
  "Render": "Cripto",
  "Ronin": "Cripto",
  "Sandbox": "Cripto",
  "1000Sats": "Cripto",
  "Sei": "Cripto",
  "Shiba Inu": "Cripto",
  "Solana": "Cripto",
  "Stacks": "Cripto",
  "Sui": "Cripto",
  "Bittensor": "Cripto",
  "Celestia": "Cripto",
  "TON": "Cripto",
  "TRON/USD": "Cripto",
  "TRUMP Coin": "Cripto",
  "Dogwifhat": "Cripto",
  "World Coin": "Cripto",
  "Ripple": "Cripto",

  // Forex
  "AUD/CAD (OTC)": "Forex",
  "AUD/JPY (OTC)": "Forex",
  "AUD/NZD (OTC)": "Forex",
  "AUD/USD (OTC)": "Forex",
  "CAD/CHF (OTC)": "Forex",
  "CAD/JPY (OTC)": "Forex",
  "CHF/JPY": "Forex",
  "CHFNOK": "Forex",
  "Dollar Index": "Forex",
  "EUR/AUD (OTC)": "Forex",
  "EUR/CAD (OTC)": "Forex",
  "EUR/CHF (OTC)": "Forex",
  "EUR/GBP (OTC)": "Forex",
  "EUR/JPY (OTC)": "Forex",
  "EUR/NZD (OTC)": "Forex",
  "EUR/THB (OTC)": "Forex",
  "EUR/USD (OTC)": "Forex",
  "GBP/AUD (OTC)": "Forex",
  "GBP/CAD (OTC)": "Forex",
  "GBP/CHF (OTC)": "Forex",
  "GBP/JPY (OTC)": "Forex",
  "GBP/NZD (OTC)": "Forex",
  "GBP/USD (OTC)": "Forex",
  "JPY/THB (OTC)": "Forex",
  "NOK/JPY (OTC)": "Forex",
  "NZD/CAD (OTC)": "Forex",
  "NZDCHF": "Forex",
  "NZD/JPY (OTC)": "Forex",
  "NZD/USD (OTC)": "Forex",
  "PEN/USD (OTC)": "Forex",
  "USD/BRL (OTC)": "Forex",
  "USD/CAD (OTC)": "Forex",
  "USD/CHF (OTC)": "Forex",
  "USD/COP (OTC)": "Forex",
  "USD/HKD (OTC)": "Forex",
  "USD/INR (OTC)": "Forex",
  "USD/JPY (OTC)": "Forex",
  "USD/MXN (OTC)": "Forex",
  "USD/NOK (OTC)": "Forex",
  "USD/PLN (OTC)": "Forex",
  "USD/SEK (OTC)": "Forex",
  "USD/SGD (OTC)": "Forex",
  "USD/THB (OTC)": "Forex",
  "USD/TRY (OTC)": "Forex",
  "USD/XOF (OTC)": "Forex",
  "USD/ZAR (OTC)": "Forex",
  "Yen Index": "Forex",
  "GBP/CHF": "Forex",
  "GBP/NZD": "Forex",
  "GBP/AUD": "Forex",
  "EUR/AUD": "Forex",
  "EUR/NZD": "Forex",
  "AUD/CHF": "Forex",
  "AUD/USD": "Forex",
  "USD/CAD": "Forex",
  "GBP/USD": "Forex",
  "EUR/GBP": "Forex",
  "GBP/JPY": "Forex",
  "EUR/CAD": "Forex",
  "GBP/CAD": "Forex",
  "CAD/CHF": "Forex",
  "AUD/JPY": "Forex",
  "AUD/CAD": "Forex",
  "USD/CHF": "Forex"
};

// Lista de ativos PERMITIDOS explicitamente (for??ada pela especifica????o do usu??rio)
// Observa????o: Mantemos algumas varia????es com e sem sufixo (OTC) para compatibilidade
const ALLOWED_ASSETS: string[] = [
  // A????es
  "AIG", "Alibaba Group Holding", "Amazon", "Amazon/Alibaba", "Amazon/Ebay", "Apple", 
  "Baidu, Inc. ADR", "Citigroup, Inc", "Coca-Cola Company", "Meta", "Google", 
  "Alphabet/Microsoft", "Goldman Sachs Group, Inc.", "Intel Corporation", "Intel/IBM", 
  "JPMorgan Chase E Co.", "McDonald??s Corporation", "Meta/Alphabet", "Morgan Stanley", 
  "Microsoft Corporation", "Microsoft/Apple", "Netflix/Amazon", "Snap Inc.", "Tesla", "Tesla/Ford",

  // Commodities
  "Crude Oil Brent", "Crude Oil WTI", "Silver", "Ouro/Prata", "Gold", "G??s Natural",

  // ??ndices
  "AUS 200", "EU 50", "FR 40", "GER 30", "GER30/UK100", "HK 33", "JP 225", "SP 35", 
  "US 500", "UK 100", "US100/JP225", "US2000", "US 30", "US30/JP225", "US500/JP225", "US 100",

  // Cripto
  "Arbitrum", "Cosmos", "Bitcoin Cash", "Bonk", "Bitcoin", "Cardano", "Dash", "Dogecoin", 
  "Polkadot", "DYDX", "EOS", "Ethereum", "Fartcoin", "Artificial Superintelligence Alliance", 
  "Floki", "Gala", "Graph", "Hedera", "ICP", "Immutable", "Injective", "IOTA", "J??piter", 
  "Chainlink", "Litecoin", "Decentraland", "Polygon", "MELANIA Coin", "NEAR", "Ondo", 
  "Onyxcoin", "ORDI", "Pudgy Penguins", "Pepe", "Pyth", "Raydium", "Render", "Ronin", 
  "Sandbox", "1000Sats", "Sei", "Shiba Inu", "Solana", "Stacks", "Sui", "Bittensor", 
  "Celestia", "TON", "TRON/USD", "TRUMP Coin", "Dogwifhat", "World Coin", "Ripple",

  // Forex
  "AUD/CAD (OTC)", "AUD/JPY (OTC)", "AUD/NZD (OTC)", "AUD/USD (OTC)", "CAD/CHF (OTC)", 
  "CAD/JPY (OTC)", "CHF/JPY", "CHFNOK", "Dollar Index", "EUR/AUD (OTC)", "EUR/CAD (OTC)", 
  "EUR/CHF (OTC)", "EUR/GBP (OTC)", "EUR/JPY (OTC)", "EUR/NZD (OTC)", "EUR/THB (OTC)", 
  "EUR/USD (OTC)", "GBP/AUD (OTC)", "GBP/CAD (OTC)", "GBP/CHF (OTC)", "GBP/JPY (OTC)", 
  "GBP/NZD (OTC)", "GBP/USD (OTC)", "JPY/THB (OTC)", "NOK/JPY (OTC)", "NZD/CAD (OTC)", 
  "NZDCHF", "NZD/JPY (OTC)", "NZD/USD (OTC)", "PEN/USD (OTC)", "USD/BRL (OTC)", 
  "USD/CAD (OTC)", "USD/CHF (OTC)", "USD/COP (OTC)", "USD/HKD (OTC)", "USD/INR (OTC)", 
  "USD/JPY (OTC)", "USD/MXN (OTC)", "USD/NOK (OTC)", "USD/PLN (OTC)", "USD/SEK (OTC)", 
  "USD/SGD (OTC)", "USD/THB (OTC)", "USD/TRY (OTC)", "USD/XOF (OTC)", "USD/ZAR (OTC)", 
  "Yen Index", "GBP/CHF", "GBP/NZD", "GBP/AUD", "EUR/AUD", "EUR/NZD", "AUD/CHF", 
  "AUD/USD", "USD/CAD", "GBP/USD", "EUR/GBP", "GBP/JPY", "EUR/CAD", "GBP/CAD", 
  "CAD/CHF", "AUD/JPY", "AUD/CAD", "USD/CHF"
];

const ALLOWED_SET = new Set(ALLOWED_ASSETS.map(a => a.trim()));

// Helper: retorna a lista unificada de ativos conhecidos + permitidos
const getAllAssetNames = (): string[] => {
  const base = Object.keys(ATIVOS_CATEGORIAS);
  const merged = new Set<string>([...base, ...ALLOWED_SET]);
  return Array.from(merged);
};

// Infer??ncia de categoria com base no nome do ativo
const inferExchangeCategory = (symbol: string): string => {
  const s = symbol.replace("(OTC)", "").trim();
  const lower = s.toLowerCase();

  // A????es
  const stockKeywords = [
    'aig','alibaba','amazon','apple','baidu','citigroup','coca-cola','meta','google','alphabet','goldman sachs',
    'intel','jpmorgan','mcdonald','morgan stanley','microsoft','netflix','snap','tesla','ford','ibm'
  ];
  if (stockKeywords.some(k => lower.includes(k))) return 'A????es';
  const stockPairs = ['amazon/alibaba','amazon/ebay','alphabet/microsoft','intel/ibm','meta/alphabet','microsoft/apple','netflix/amazon','tesla/ford'];
  if (stockPairs.some(k => lower.includes(k))) return 'A????es';

  // Commodities
  const commodities = ['crude oil brent','crude oil wti','silver','ouro/prata','gold','g??s natural','gold/silver'];
  if (commodities.some(k => lower.includes(k))) return 'Commodities';

  // ??ndices
  const indices = ['aus 200','eu 50','fr 40','ger 30','ger30/uk100','hk 33','jp 225','sp 35','us 500','uk 100','us100/jp225','us2000','us 30','us30/jp225','us500/jp225','us 100'];
  if (indices.some(k => lower.includes(k))) return '??ndices';

  // Cripto
  const cryptos = [
    'arbitrum','cosmos','bitcoin cash','bonk','bitcoin','cardano','dash','dogecoin','polkadot','dydx','eos','ethereum','fartcoin',
    'artificial superintelligence alliance','floki','gala','graph','hedera','icp','immutable','injective','iota','j??piter','jupiter','chainlink',
    'litecoin','decentraland','polygon','melania coin','near','ondo','onyxcoin','ordi','pudgy penguins','pepe','pyth','raydium','render','ronin',
    'sandbox','1000sats','sei','shiba inu','solana','stacks','sui','bittensor','celestia','ton','tron/usd','trump coin','dogwifhat','world coin','ripple'
  ];
  if (cryptos.some(k => lower.includes(k))) return 'Cripto';

  // Forex (pares e ??ndices de moedas)
  const forexKeywords = [
    'aud/cad','aud/jpy','aud/nzd','aud/usd','cad/chf','cad/jpy','chf/jpy','chfnok','dollar index','eur/aud','eur/cad','eur/chf','eur/gbp','eur/jpy','eur/nzd','eur/thb','eur/usd',
    'gbp/aud','gbp/cad','gbp/chf','gbp/jpy','gbp/nzd','gbp/usd','jpy/thb','nok/jpy','nzd/cad','nzdchf','nzd/jpy','nzd/usd','pen/usd',
    'usd/brl','usd/cad','usd/chf','usd/cop','usd/hkd','usd/inr','usd/jpy','usd/mxn','usd/nok','usd/pln','usd/sek','usd/sgd','usd/thb','usd/try','usd/xof','usd/zar',
    'yen index'
  ];
  if (forexKeywords.some(k => lower.includes(k))) return 'Forex';

  // Demais casos: manter categoriza????o existente ou assumir "Cripto" como fallback
  return ATIVOS_CATEGORIAS[symbol] || 'Cripto';
};

// Estrutura para armazenar os hor??rios de disponibilidade de cada ativo
// Formato: [hora_inicio, minuto_inicio, hora_fim, minuto_fim]
// Se um ativo n??o estiver listado, assume-se que est?? dispon??vel 24/7
const HORARIOS_DISPONIBILIDADE: Record<string, Array<[number, number, number, number]>> = {
  // Exemplo de formato: "Ativo": [[8, 0, 16, 30]] - dispon??vel das 8:00 ??s 16:30
  // M??ltiplos intervalos s??o permitidos: [[8, 0, 12, 0], [13, 0, 17, 0]]
  // Se um ativo n??o estiver listado aqui, assume-se que est?? dispon??vel 24/7
  
  // A????es
  // AIG - Mesmo padr??o para todos os dias
  "AIG": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // Alibaba Group Holding - Mesmo padr??o para todos os dias
  "Alibaba Group Holding": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // Amazon - Padr??o para dias com interrup????o (seg, qua, sex)
  "Amazon": [[0, 0, 15, 30], [16, 0, 23, 59]],
  
  // Amazon/Alibaba - Mesmo padr??o para todos os dias
  "Amazon/Alibaba": [[0, 0, 6, 30], [7, 0, 23, 59]],
  
  // Amazon/Ebay - Mesmo padr??o para todos os dias
  "Amazon/Ebay": [[0, 0, 6, 30], [7, 0, 23, 59]],
  
  // Apple - Padr??o para dias com interrup????o (seg, qua, sex)
  "Apple": [[0, 0, 15, 30], [16, 0, 23, 59]],
  
  // Baidu, Inc. ADR - Mesmo padr??o para todos os dias
  "Baidu, Inc. ADR": [[0, 0, 5, 0], [5, 30, 23, 59]],
  
  // Citigroup, Inc - Mesmo padr??o para todos os dias
  "Citigroup, Inc": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // Coca-Cola Company - Mesmo padr??o para todos os dias
  "Coca-Cola Company": [[0, 0, 5, 0], [5, 30, 23, 59]],
  
  // Meta - Padr??o para dias com interrup????o (seg, qua, sex)
  "Meta": [[0, 0, 15, 30], [16, 35, 23, 59]],
  
  // Google - Padr??o para dias com interrup????o (seg, qua, sex)
  "Google": [[0, 0, 15, 30], [16, 35, 23, 59]],
  
  // Alphabet/Microsoft - Mesmo padr??o para todos os dias
  "Alphabet/Microsoft": [[0, 0, 6, 30], [7, 0, 23, 59]],
  
  // Goldman Sachs Group, Inc. - Mesmo padr??o para todos os dias
  "Goldman Sachs Group, Inc.": [[0, 0, 5, 0], [5, 30, 23, 59]],
  
  // Intel Corporation - Mesmo padr??o para todos os dias
  "Intel Corporation": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // Intel/IBM - Mesmo padr??o para todos os dias
  "Intel/IBM": [[0, 0, 6, 30], [7, 0, 23, 59]],
  
  // JPMorgan Chase E Co. - Mesmo padr??o para todos os dias
  "JPMorgan Chase E Co.": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // McDonald??s Corporation - Mesmo padr??o para todos os dias
  "McDonald??s Corporation": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // Meta/Alphabet - Mesmo padr??o para todos os dias
  "Meta/Alphabet": [[0, 0, 6, 30], [7, 40, 23, 59]],
  
  // Morgan Stanley - Mesmo padr??o para todos os dias
  "Morgan Stanley": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // Microsoft Corporation - Mesmo padr??o para todos os dias
  "Microsoft Corporation": [[0, 0, 5, 0], [5, 30, 23, 59]],
  
  // Microsoft/Apple - Mesmo padr??o para todos os dias
  "Microsoft/Apple": [[0, 0, 6, 30], [7, 40, 23, 59]],
  
  // Netflix/Amazon - Mesmo padr??o para todos os dias
  "Netflix/Amazon": [[0, 0, 6, 30], [7, 0, 23, 59]],
  
  // Snap Inc. - Mesmo padr??o para todos os dias
  "Snap Inc.": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // Tesla - Padr??o para dias com interrup????o (seg, qua, sex)
  "Tesla": [[0, 0, 15, 30], [16, 0, 23, 59]],
  
  // Tesla/Ford - Mesmo padr??o para todos os dias
  "Tesla/Ford": [[0, 0, 6, 30], [7, 0, 23, 59]],
  
  // Commodities
  // Crude Oil Brent - Padr??o para dias com interrup????o (seg, qui)
  "Crude Oil Brent": [[0, 0, 6, 0], [7, 5, 23, 59]],
  
  // Crude Oil WTI - Padr??o para dias com interrup????o (seg, qui)
  "Crude Oil WTI": [[0, 0, 6, 0], [7, 5, 23, 59]],
  
  // Silver - Padr??o para dias com interrup????o (seg, qui)
  "Silver": [[0, 0, 6, 0], [7, 5, 23, 59]],
  
  // Ouro/Prata - Mesmo padr??o para todos os dias
  "Ouro/Prata": [[0, 0, 6, 30], [7, 40, 23, 59]],
  
  // Gold - Padr??o para dias com interrup????o (seg, qui)
  "Gold": [[0, 0, 6, 0], [7, 5, 23, 59]],
  
  // G??s Natural - Padr??o para dias com interrup????o (seg, qui)
  "G??s Natural": [[0, 0, 6, 0], [7, 5, 23, 59]],
  
  // ??ndices
  // AUS 200 - Mesmo padr??o para todos os dias
  "AUS 200": [[0, 0, 22, 0], [22, 30, 23, 59]],
  
  // EU 50 - Mesmo padr??o para todos os dias
  "EU 50": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // FR 40 - Mesmo padr??o para todos os dias
  "FR 40": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // GER 30 - Mesmo padr??o para todos os dias
  "GER 30": [[0, 0, 5, 0], [5, 30, 23, 59]],
  
  // GER30/UK100 - Mesmo padr??o para todos os dias
  "GER30/UK100": [[0, 0, 6, 30], [7, 0, 23, 59]],
  
  // HK 33 - Padr??o diferente para dias ??teis e fins de semana
  "HK 33": [[0, 0, 15, 0], [15, 30, 23, 59]],
  
  // JP 225 - Mesmo padr??o para todos os dias
  "JP 225": [[0, 0, 22, 0], [23, 5, 23, 59]],
  
  // SP 35 - Mesmo padr??o para todos os dias
  "SP 35": [[0, 0, 5, 0], [5, 30, 23, 59]],
  
  // US 500 - Padr??o para dias ??teis, fechado nos fins de semana
  "US 500": [[11, 35, 17, 55]],
  
  // UK 100 - Mesmo padr??o para todos os dias
  "UK 100": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // US100/JP225 - Mesmo padr??o para todos os dias
  "US100/JP225": [[0, 0, 6, 30], [7, 40, 23, 59]],
  
  // US2000 - Mesmo padr??o para todos os dias
  "US2000": [[0, 0, 5, 0], [5, 30, 23, 59]],
  
  // US 30 - Padr??o diferente para dias ??teis e fins de semana
  "US 30": [[0, 0, 15, 0], [16, 10, 23, 59]],
  
  // US30/JP225 - Mesmo padr??o para todos os dias
  "US30/JP225": [[0, 0, 6, 30], [7, 40, 23, 59]],
  
  // US500/JP225 - Mesmo padr??o para todos os dias
  "US500/JP225": [[0, 0, 6, 30], [7, 0, 23, 59]],
  
  // US 100 - Padr??o diferente para dias ??teis e fins de semana
  "US 100": [[0, 0, 15, 0], [16, 10, 23, 59]],
  
  // Cripto
  // Arbitrum - Mesmo padr??o para todos os dias
  "Arbitrum": [[0, 0, 12, 0], [12, 30, 23, 59]],
  
  // Cosmos - Mesmo padr??o para todos os dias
  "Cosmos": [[0, 0, 12, 0], [13, 10, 23, 59]],
  
  // Bitcoin Cash - Mesmo padr??o para todos os dias
  "Bitcoin Cash": [[0, 0, 17, 45], [18, 15, 23, 59]],
  
  // Bonk - Mesmo padr??o para todos os dias
  "Bonk": [[0, 0, 17, 40], [18, 50, 23, 59]],
  
  // Bitcoin - Mesmo padr??o para todos os dias
  "Bitcoin": [[0, 0, 12, 0], [12, 30, 23, 59]],
  
  // Cardano - Mesmo padr??o para todos os dias
  "Cardano": [[0, 0, 17, 45], [18, 15, 23, 59]],
  
  // Dash - Mesmo padr??o para todos os dias
  "Dash": [[0, 0, 17, 45], [18, 15, 23, 59]],
  
  // Dogecoin - Mesmo padr??o para todos os dias
  "Dogecoin": [[0, 0, 17, 45], [18, 55, 23, 59]],
  
  // Polkadot - Mesmo padr??o para todos os dias
  "Polkadot": [[0, 0, 17, 45], [18, 15, 23, 59]],
  
  // DYDX - Mesmo padr??o para todos os dias
  "DYDX": [[0, 0, 17, 40], [18, 50, 23, 59]],
  
  // EOS - Mesmo padr??o para todos os dias
  "EOS": [[0, 0, 22, 0], [22, 30, 23, 59]],
  
  // Ethereum - Mesmo padr??o para todos os dias
  "Ethereum": [[0, 0, 12, 0], [13, 10, 23, 59]],
  
  // Fartcoin - Mesmo padr??o para todos os dias
  "Fartcoin": [[0, 0, 17, 45], [18, 15, 23, 59]],
  
  // Artificial Superintelligence Alliance - Mesmo padr??o para todos os dias
  "Artificial Superintelligence Alliance": [[0, 0, 17, 40], [18, 50, 23, 59]],
  
  // Floki - Mesmo padr??o para todos os dias
  "Floki": [[0, 0, 17, 40], [18, 50, 23, 59]],
  
  // Gala - Mesmo padr??o para todos os dias
  "Gala": [[0, 0, 17, 40], [18, 50, 23, 59]],
  
  // Graph - Mesmo padr??o para todos os dias
  "Graph": [[0, 0, 17, 45], [18, 15, 23, 59]],
  
  // Hedera - Mesmo padr??o para todos os dias
  "Hedera": [[0, 0, 17, 40], [18, 50, 23, 59]],
  
  // ICP - Mesmo padr??o para todos os dias
  "ICP": [[0, 0, 17, 40], [18, 50, 23, 59]],
  
  // Immutable - Mesmo padr??o para todos os dias
  "Immutable": [[0, 0, 17, 40], [18, 50, 23, 59]],
  
  // Injective - Mesmo padr??o para todos os dias
  "Injective": [[0, 0, 17, 45], [18, 15, 23, 59]],
  
  // IOTA - Mesmo padr??o para todos os dias
  "IOTA": [[0, 0, 17, 45], [18, 15, 23, 59]],
  
  // J??piter - Mesmo padr??o para todos os dias
  "J??piter": [[0, 0, 17, 40], [18, 50, 23, 59]],
  
  // Chainlink - Mesmo padr??o para todos os dias
  "Chainlink": [[0, 0, 17, 45], [18, 15, 23, 59]],
  
  // Litecoin - Mesmo padr??o para todos os dias
  "Litecoin": [[0, 0, 22, 0], [23, 5, 23, 59]],
  
  // Decentraland - Mesmo padr??o para todos os dias
  "Decentraland": [[0, 0, 17, 40], [18, 50, 23, 59]],
  
  // Polygon - Mesmo padr??o para todos os dias
  "Polygon": [[0, 0, 17, 45], [18, 15, 23, 59]],
  
  // MELANIA Coin - Mesmo padr??o para todos os dias
  "MELANIA Coin": [[0, 0, 17, 45], [18, 15, 23, 59]],
  
  // NEAR - Mesmo padr??o para todos os dias
  "NEAR": [[0, 0, 17, 40], [18, 50, 23, 59]],
  
  // Ondo - Mesmo padr??o para todos os dias
  "Ondo": [[0, 0, 12, 0], [13, 10, 23, 59]],
  
  // Onyxcoin - Mesmo padr??o para todos os dias
  "Onyxcoin": [[0, 0, 12, 0], [12, 30, 23, 59]],
  
  // ORDI - Mesmo padr??o para todos os dias
  "ORDI": [[0, 0, 12, 0], [12, 30, 23, 59]],
  
  // Pudgy Penguins - Mesmo padr??o para todos os dias
  "Pudgy Penguins": [[0, 0, 12, 0], [13, 10, 23, 59]],
  
  // Pepe - Mesmo padr??o para todos os dias
  "Pepe": [[0, 0, 12, 0], [13, 10, 23, 59]],
  
  // Pyth - Mesmo padr??o para todos os dias
  "Pyth": [[0, 0, 12, 0], [13, 10, 23, 59]],
  
  // Raydium - Mesmo padr??o para todos os dias
  "Raydium": [[0, 0, 12, 0], [13, 10, 23, 59]],
  
  // Render - Mesmo padr??o para todos os dias
  "Render": [[0, 0, 12, 0], [12, 30, 23, 59]],
  
  // Ronin - Mesmo padr??o para todos os dias
  "Ronin": [[0, 0, 12, 0], [12, 30, 23, 59]],
  
  // Sandbox - Mesmo padr??o para todos os dias
  "Sandbox": [[0, 0, 12, 0], [12, 30, 23, 59]],
  
  // 1000Sats - Mesmo padr??o para todos os dias
  "1000Sats": [[0, 0, 12, 0], [12, 30, 23, 59]],
  
  // Sei - Mesmo padr??o para todos os dias
  "Sei": [[0, 0, 12, 0], [12, 30, 23, 59]],
  
  // Shiba Inu - Mesmo padr??o para todos os dias
  "Shiba Inu": [[0, 0, 17, 45], [18, 15, 23, 59]],
  
  // Solana - Mesmo padr??o para todos os dias
  "Solana": [[0, 0, 17, 45], [18, 15, 23, 59]],
  
  // Stacks - Mesmo padr??o para todos os dias
  "Stacks": [[0, 0, 12, 0], [13, 10, 23, 59]],
  
  // Sui - Mesmo padr??o para todos os dias
  "Sui": [[0, 0, 12, 0], [12, 30, 23, 59]],
  
  // Bittensor - Mesmo padr??o para todos os dias
  "Bittensor": [[0, 0, 12, 0], [13, 10, 23, 59]],
  
  // Celestia - Mesmo padr??o para todos os dias
  "Celestia": [[0, 0, 12, 0], [12, 30, 23, 59]],
  
  // TON - Mesmo padr??o para todos os dias
  "TON": [[0, 0, 12, 0], [13, 10, 23, 59]],
  
  // TRON/USD - Mesmo padr??o para todos os dias
  "TRON/USD": [[0, 0, 17, 45], [18, 55, 23, 59]],
  
  // TRUMP Coin - Mesmo padr??o para todos os dias
  "TRUMP Coin": [[0, 0, 12, 0], [13, 10, 23, 59]],
  
  // Dogwifhat - Mesmo padr??o para todos os dias
  "Dogwifhat": [[0, 0, 17, 45], [18, 15, 23, 59]],
  
  // World Coin - Mesmo padr??o para todos os dias
  "World Coin": [[0, 0, 17, 45], [18, 15, 23, 59]],
  
  // Ripple - Mesmo padr??o para todos os dias
  "Ripple": [[0, 0, 22, 0], [22, 30, 23, 59]],
  
  // Forex
  // AUD/CAD (OTC) - Considerando o padr??o para dias com interrup????o (seg, qua, sex)
  "AUD/CAD (OTC)": [[0, 0, 1, 0], [2, 10, 23, 59]],
  
  // AUD/CAD - Padr??o para dias ??teis
  "AUD/CAD": [[8, 0, 13, 0]],
  
  // AUD/JPY (OTC) - Mesmo padr??o para todos os dias
  "AUD/JPY (OTC)": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // AUD/JPY - Padr??o para dias ??teis
  "AUD/JPY": [[7, 0, 12, 0]],
  
  // AUD/NZD (OTC) - Mesmo padr??o para todos os dias
  "AUD/NZD (OTC)": [[0, 0, 22, 0], [22, 30, 23, 59]],
  
  // AUD/USD (OTC) - Mesmo padr??o para todos os dias
  "AUD/USD (OTC)": [[0, 0, 22, 0], [22, 30, 23, 59]],
  
  // AUD/USD - Padr??o para dias ??teis com intervalos espec??ficos
  "AUD/USD": [[2, 0, 6, 0], [9, 30, 15, 0]],
  
  // AUD/CHF - Padr??o para dias ??teis (seg-sex)
  "AUD/CHF": [[0, 0, 16, 0]],
  
  // CAD/CHF (OTC) - Padr??o para dias ??teis e s??bado
  "CAD/CHF (OTC)": [[0, 0, 5, 0], [5, 30, 23, 59]],
  
  // CAD/CHF - Padr??o para dias ??teis
  "CAD/CHF": [[4, 0, 16, 0]],
  
  // CAD/JPY (OTC) - Mesmo padr??o para todos os dias
  "CAD/JPY (OTC)": [[0, 0, 22, 0], [22, 30, 23, 59]],
  
  // CHF/JPY - Mesmo padr??o para todos os dias
  "CHF/JPY": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // CHFNOK - Padr??o para dias ??teis e s??bado
  "CHFNOK": [[0, 0, 5, 0], [5, 30, 23, 59]],
  
  // Dollar Index - Padr??o para dias ??teis (seg-qui)
  "Dollar Index": [[0, 0, 10, 0], [11, 10, 22, 0], [23, 10, 23, 59]],
  
  // EUR/AUD (OTC) - Mesmo padr??o para todos os dias
  "EUR/AUD (OTC)": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // EUR/AUD - Padr??o para dias ??teis (seg-sex)
  "EUR/AUD": [[0, 0, 16, 0]],
  
  // EUR/CAD (OTC) - Padr??o para dias ??teis e s??bado
  "EUR/CAD (OTC)": [[0, 0, 5, 0], [5, 30, 23, 59]],
  
  // EUR/CAD - Padr??o para dias ??teis
  "EUR/CAD": [[4, 0, 16, 0]],
  
  // EUR/CHF (OTC) - Mesmo padr??o para todos os dias
  "EUR/CHF (OTC)": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // EUR/GBP (OTC) - Considerando o padr??o para dias com interrup????o (seg, qua, sex)
  "EUR/GBP (OTC)": [[0, 0, 1, 0], [2, 10, 23, 59]],
  
  // EUR/GBP - Padr??o para dias ??teis
  "EUR/GBP": [[3, 0, 13, 0]],
  
  // EUR/JPY (OTC) - Considerando o padr??o para dias com interrup????o (seg, qua, sex)
  "EUR/JPY (OTC)": [[0, 0, 1, 0], [1, 30, 23, 59]],
  
  // EUR/NZD (OTC) - Mesmo padr??o para todos os dias
  "EUR/NZD (OTC)": [[0, 0, 22, 0], [23, 5, 23, 59]],
  
  // EUR/NZD - Padr??o para dias ??teis (seg-sex)
  "EUR/NZD": [[0, 0, 16, 0]],
  
  // EUR/THB (OTC) - Mesmo padr??o para todos os dias
  "EUR/THB (OTC)": [[0, 0, 22, 0], [23, 5, 23, 59]],
  
  // EUR/USD (OTC) - Considerando o padr??o para dias com interrup????o (seg, qua, sex)
  "EUR/USD (OTC)": [[0, 0, 1, 0], [1, 30, 23, 59]],
  
  // GBP/AUD (OTC) - Padr??o para dias ??teis e s??bado
  "GBP/AUD (OTC)": [[0, 0, 5, 0], [5, 30, 23, 59]],
  
  // GBP/AUD - Padr??o para dias ??teis (seg-sex)
  "GBP/AUD": [[0, 0, 16, 0]],
  
  // GBP/CAD (OTC) - Padr??o para dias ??teis e s??bado
  "GBP/CAD (OTC)": [[0, 0, 5, 0], [5, 30, 23, 59]],
  
  // GBP/CAD - Padr??o para dias ??teis
  "GBP/CAD": [[4, 0, 15, 0]],
  
  // GBP/CHF (OTC) - Padr??o para dias ??teis e s??bado
  "GBP/CHF (OTC)": [[0, 0, 5, 0], [5, 30, 23, 59]],
  
  // GBP/CHF - Padr??o para dias ??teis (seg-sex)
  "GBP/CHF": [[0, 0, 16, 0]],
  
  // GBP/JPY (OTC) - Considerando o padr??o para dias com interrup????o (ter, qui)
  "GBP/JPY (OTC)": [[0, 0, 1, 0], [2, 10, 23, 59]],
  
  // GBP/JPY - Padr??o para dias ??teis (seg-qui at?? 17:00, sex at?? 15:30)
  "GBP/JPY": [[3, 0, 17, 0]],
  
  // GBP/NZD (OTC) - Mesmo padr??o para todos os dias
  "GBP/NZD (OTC)": [[0, 0, 22, 0], [23, 5, 23, 59]],
  
  // GBP/NZD - Padr??o para dias ??teis (seg-sex)
  "GBP/NZD": [[0, 0, 16, 0]],
  
  // GBP/USD (OTC) - Considerando o padr??o para dias com interrup????o (ter, qui)
  "GBP/USD (OTC)": [[0, 0, 1, 0], [1, 30, 23, 59]],
  
  // GBP/USD - Padr??o para dias ??teis (seg-qui at?? 17:00, sex at?? 15:30)
  "GBP/USD": [[3, 0, 17, 0]],
  
  // JPY/THB (OTC) - Mesmo padr??o para todos os dias
  "JPY/THB (OTC)": [[0, 0, 22, 0], [22, 30, 23, 59]],
  
  // NOK/JPY (OTC) - Mesmo padr??o para todos os dias
  "NOK/JPY (OTC)": [[0, 0, 22, 0], [23, 5, 23, 59]],
  
  // NZD/CAD (OTC) - Mesmo padr??o para todos os dias
  "NZD/CAD (OTC)": [[0, 0, 22, 0], [23, 5, 23, 59]],
  
  // NZDCHF - Mesmo padr??o para todos os dias
  "NZDCHF": [[0, 0, 22, 0], [23, 5, 23, 59]],
  
  // NZD/JPY (OTC) - Mesmo padr??o para todos os dias
  "NZD/JPY (OTC)": [[0, 0, 22, 0], [23, 5, 23, 59]],
  
  // NZD/USD (OTC) - Considerando o padr??o para dias com interrup????o (ter, qui)
  "NZD/USD (OTC)": [[0, 0, 1, 0], [1, 30, 23, 59]],
  
  // PEN/USD (OTC) - Considerando o padr??o para dias com interrup????o (ter)
  "PEN/USD (OTC)": [[0, 0, 0, 45], [1, 15, 23, 59]],
  
  // USD/BRL (OTC) - Considerando o padr??o para dias com interrup????o (ter)
  "USD/BRL (OTC)": [[0, 0, 0, 50], [2, 20, 23, 59]],
  
  // USD/CAD (OTC) - Mesmo padr??o para todos os dias
  "USD/CAD (OTC)": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // USD/CAD - Padr??o para dias ??teis
  "USD/CAD": [[3, 0, 15, 0]],
  
  // USD/CHF (OTC) - Considerando o padr??o para dias com interrup????o (ter, qui)
  "USD/CHF (OTC)": [[0, 0, 1, 0], [1, 30, 23, 59]],
  
  // USD/CHF - Padr??o para dias ??teis
  "USD/CHF": [[10, 0, 14, 0]],
  
  // USD/COP (OTC) - Considerando o padr??o para dias com interrup????o (ter)
  "USD/COP (OTC)": [[0, 0, 0, 45], [1, 15, 23, 59]],
  
  // USD/HKD (OTC) - Mesmo padr??o para todos os dias
  "USD/HKD (OTC)": [[0, 0, 22, 0], [22, 30, 23, 59]],
  
  // USD/INR (OTC) - Considerando o padr??o para dias com interrup????o (ter, qui)
  "USD/INR (OTC)": [[0, 0, 1, 0], [1, 30, 23, 59]],
  
  // USD/JPY (OTC) - Considerando o padr??o para dias com interrup????o (ter, qui)
  "USD/JPY (OTC)": [[0, 0, 1, 0], [2, 10, 23, 59]],
  
  // USD/MXN (OTC) - Considerando o padr??o para dias com interrup????o (ter)
  "USD/MXN (OTC)": [[0, 0, 0, 50], [2, 20, 23, 59]],
  
  // USD/NOK (OTC) - Mesmo padr??o para todos os dias
  "USD/NOK (OTC)": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // USD/PLN (OTC) - Padr??o para dias ??teis e s??bado
  "USD/PLN (OTC)": [[0, 0, 5, 0], [5, 30, 23, 59]],
  
  // USD/SEK (OTC) - Padr??o para dias ??teis e s??bado
  "USD/SEK (OTC)": [[0, 0, 5, 0], [5, 30, 23, 59]],
  
  // USD/SGD (OTC) - Mesmo padr??o para todos os dias
  "USD/SGD (OTC)": [[0, 0, 22, 0], [23, 5, 23, 59]],
  
  // USD/THB (OTC) - Mesmo padr??o para todos os dias
  "USD/THB (OTC)": [[0, 0, 22, 0], [23, 5, 23, 59]],
  
  // USD/TRY (OTC) - Mesmo padr??o para todos os dias
  "USD/TRY (OTC)": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // USD/XOF (OTC) - Considerando o padr??o para dias com interrup????o (ter, qui)
  "USD/XOF (OTC)": [[0, 0, 1, 0], [1, 30, 23, 59]],
  
  // USD/ZAR (OTC) - Mesmo padr??o para todos os dias
  "USD/ZAR (OTC)": [[0, 0, 5, 0], [6, 10, 23, 59]],
  
  // Yen Index - Padr??o para dias ??teis (seg-qui)
  "Yen Index": [[0, 0, 10, 0], [10, 30, 22, 0], [22, 30, 23, 59]]
};

// Objeto para uso mais f??cil no c??digo
const SignalStrength = {
  STRONG: 'STRONG' as SignalStrengthEnum,
  MODERATE: 'MODERATE' as SignalStrengthEnum,
  WEAK: 'WEAK' as SignalStrengthEnum,
  VERY_STRONG: 'VERY_STRONG' as SignalStrengthEnum
};

// Estilos para as anima????es
const styles = `
  @keyframes pulse {
    0%, 100% { opacity: 0.6; transform: scale(0.98); }
    50% { opacity: 1; transform: scale(1); }
  }
  
  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 0 8px rgba(0, 0, 0, 0.2); }
    50% { box-shadow: 0 0 18px rgba(0, 0, 0, 0.25); }
  }
  
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  
  @keyframes rotateGlow {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes slowFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }
  
  @keyframes subtleBreathing {
    0%, 100% { opacity: 0.85; }
    50% { opacity: 1; }
  }
  
  /* Anima????es para sinais completados */
  @keyframes winPulse {
    0% { background-color: rgba(34, 197, 94, 0.05); box-shadow: 0 0 15px rgba(34, 197, 94, 0.1); }
    50% { background-color: rgba(34, 197, 94, 0.1); box-shadow: 0 0 25px rgba(34, 197, 94, 0.15); }
    100% { background-color: rgba(34, 197, 94, 0.05); box-shadow: 0 0 15px rgba(34, 197, 94, 0.1); }
  }
  
  @keyframes lossPulse {
    0% { background-color: rgba(220, 38, 38, 0.1); box-shadow: 0 0 15px rgba(220, 38, 38, 0.15); }
    50% { background-color: rgba(220, 38, 38, 0.15); box-shadow: 0 0 25px rgba(220, 38, 38, 0.2); }
    100% { background-color: rgba(220, 38, 38, 0.1); box-shadow: 0 0 15px rgba(220, 38, 38, 0.15); }
  }
  
  @keyframes winConfetti {
    0% { opacity: 0; transform: translateY(0) rotate(0); }
    10% { opacity: 1; }
    100% { opacity: 0; transform: translateY(-100px) rotate(720deg); }
  }
  
  .signal-completed-win {
    animation: winPulse 1.5s ease-in-out infinite;
    background-color: rgba(34, 197, 94, 0.05) !important;
    border: 1px solid rgba(34, 197, 94, 0.1) !important;
    position: relative;
    overflow: hidden;
    z-index: 1;
  }
  
  .signal-completed-win::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(to bottom, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.02));
    z-index: -1;
  }
  
  .signal-completed-loss {
    animation: lossPulse 1.5s ease-in-out infinite;
    background-color: rgba(220, 38, 38, 0.1) !important;
    border: 1px solid rgba(220, 38, 38, 0.15) !important;
    position: relative;
    overflow: hidden;
    z-index: 1;
  }
  
  .signal-completed-loss::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(to bottom, rgba(220, 38, 38, 0.1), rgba(220, 38, 38, 0.02));
    z-index: -1;
  }
  
  .confetti {
    position: absolute;
    width: 10px;
    height: 10px;
    background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(34,197,94,0.7) 100%);
    border-radius: 50%;
    animation: winConfetti 2s ease-out forwards;
  }
  
  /* Anima????es para os ??cones de resultado */
  @keyframes iconScaleIn {
    0% { transform: scale(0); opacity: 0; }
    40% { transform: scale(1.2); opacity: 1; }
    60% { transform: scale(0.9); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  
  @keyframes winIconRotate {
    0% { transform: scale(1) rotate(0deg); }
    25% { transform: scale(1.2) rotate(-10deg); }
    50% { transform: scale(1.2) rotate(10deg); }
    75% { transform: scale(1.1) rotate(-5deg); }
    100% { transform: scale(1) rotate(0deg); }
  }
  
  @keyframes lossIconShake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-10px); }
    40% { transform: translateX(10px); }
    60% { transform: translateX(-5px); }
    80% { transform: translateX(5px); }
  }
  
  .result-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    animation: iconScaleIn 0.5s ease-out forwards;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(5px);
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.4);
    border: 2px solid;
  }
  
  .win-icon {
    border-color: rgba(34, 197, 94, 0.3);
    animation: iconScaleIn 0.5s ease-out forwards, winIconRotate 2s ease-in-out 0.5s infinite;
  }
  
  .loss-icon {
    border-color: rgba(255, 80, 80, 0.3);
    animation: iconScaleIn 0.5s ease-out forwards, lossIconShake 1s ease-in-out 0.5s infinite;
  }
  
  .result-text {
    font-size: 24px;
    font-weight: bold;
    text-align: center;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    animation: iconScaleIn 0.5s ease-out forwards;
    margin-top: 10px;
  }
  
  /* Classe espec??fica para a p??gina de sinais - n??o afeta o Dashboard */
  .signals-page-dark-gradient {
    background: #000000;
  }
  
  .gradient-text {
    background: linear-gradient(90deg, #ffffff, #aaaaaa, #ffffff);
    background-size: 200% auto;
    color: transparent;
    background-clip: text;
    -webkit-background-clip: text;
    animation: gradientShift 3s ease infinite;
  }

  @keyframes goldenShimmer {
    0% { background-position: -100% 0; opacity: 0.7; }
    50% { opacity: 1; }
    100% { background-position: 200% 0; opacity: 0.7; }
  }
  
  .golden-button {
    position: relative;
    overflow: hidden;
  }
  
  .golden-button::after {
    content: '';
    position: absolute;
    top: -100%;
    left: -100%;
    width: 300%;
    height: 300%;
    background: linear-gradient(
      60deg,
      rgba(255, 215, 0, 0) 0%,
      rgba(255, 215, 0, 0) 30%,
      rgba(255, 215, 0, 0.15) 45%,
      rgba(255, 215, 0, 0.2) 50%,
      rgba(255, 215, 0, 0.15) 55%,
      rgba(255, 215, 0, 0) 70%,
      rgba(255, 215, 0, 0) 100%
    );
    transform: rotate(25deg);
    animation: goldenShimmer 8s ease-in-out infinite;
    z-index: 1;
    pointer-events: none;
  }
  
  .golden-shadow {
    box-shadow: 0 5px 15px rgba(212, 175, 55, 0.2);
    transition: all 0.4s ease;
  }
  
  .golden-shadow:hover {
    box-shadow: 0 5px 20px rgba(212, 175, 55, 0.3), 0 0 5px rgba(255, 215, 0, 0.25);
    transform: translateY(-1px);
  }

  /* Estilo unificado para todos os cards de sinais */
  .signal-card {
    border: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(15px);
    transition: all 0.3s ease;
    overflow: hidden;
    max-width: 100%;
    word-wrap: break-word;
  }
  
  .signal-card:hover {
    border-color: rgba(255, 255, 255, 0.08);
    background: rgba(5, 5, 10, 0.65);
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.08);
    transform: translateY(-3px);
  }
  
  @media (max-width: 639px) {
    .signal-card {
      max-width: 100%;
    }
    
    .signal-card:hover {
      transform: translateY(-2px);
    }
  }

  /* Estilo unificado para todos os divisores */
  .signal-divider {
    border-color: rgba(255, 255, 255, 0.05);
  }

  /* Estilo para tags/badges */
  .signal-badge {
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.8);
  }

  /* Estilo para as caixas de informação */
  .signal-info-box {
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    flex-wrap: nowrap;
  }
  
  @media (max-width: 639px) {
    .signal-info-box {
      min-height: 44px !important;
      padding: 0.5rem !important;
    }
    
    .signal-info-box p {
      font-size: 0.75rem;
    }
  }
  
  /* Classes espec??ficas para a p??gina de sinais */
  .signals-page-light-accent {
    position: absolute;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.01) 0%, rgba(0,0,0,0) 70%);
    animation: subtleBreathing 4s infinite ease-in-out;
    z-index: 0;
  }
  
  .signals-page-color-accent {
    position: absolute;
    width: 350px;
    height: 350px;
    border-radius: 50%;
    filter: blur(100px);
    opacity: 0.03;
    z-index: 0;
    animation: subtleBreathing 7s infinite ease-in-out alternate;
  }
  
  .floating-element {
    animation: slowFloat 5s ease-in-out infinite;
  }
  
  /* Classe espec??fica para os cart??es da p??gina de sinais */
  .signals-page-card-glass {
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(15px);
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.3s ease;
  }
  
  .signals-page-card-glass:hover {
    background: rgba(5, 5, 10, 0.65);
    border-color: rgba(255, 255, 255, 0.08);
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.05);
  }
  
  .shimmer-effect {
    overflow: hidden;
    position: relative;
  }
  
  .shimmer-effect::before {
    content: '';
    position: absolute;
    top: 0;
    left: -150%;
    width: 150%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.04), transparent);
    animation: shimmer 3s infinite;
    transform: skewX(-20deg);
    z-index: 1;
  }
  
  @keyframes shimmer {
    0% { left: -150%; }
    100% { left: 150%; }
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.5rem;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 1rem;
    backdrop-filter: blur(15px);
    border: 1px solid rgba(255, 255, 255, 0.03);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    animation: glowPulse 3s ease-in-out infinite;
  }
  
  @media (min-width: 640px) {
    .loading-container {
      padding: 5rem 2rem;
    }
  }

  /* Estilo para o t??tulo principal da p??gina */
  .signals-title {
    position: relative;
    display: inline-block;
    font-weight: 600;
    letter-spacing: 0.025em;
    color: #ffffff;
    text-shadow: 
      0 1px 2px rgba(0, 0, 0, 0.9),
      0 2px 4px rgba(0, 0, 0, 0.7),
      0 4px 8px rgba(0, 0, 0, 0.5),
      0 8px 16px rgba(0, 0, 0, 0.3);
  }
  
  .signals-title::before {
    content: attr(data-text);
    position: absolute;
    top: 0;
    left: 0;
    z-index: -1;
    color: rgba(0, 0, 0, 0.4);
    filter: blur(1px);
    transform: translate(1px, 1px);
  }
  
  .signals-title::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    opacity: 0.6;
  }
`;

// Interface para sinais de placeholder compat??vel com TradingSignal
interface PlaceholderSignal extends TradingSignal {
  id: string;
  symbol: string;
  exchange: string;
  signal: 'BUY' | 'SELL';
  entry_time: string;
  timeframe: string;
  expiry_time_str: string;
  gale1_time: string;
  gale2_time: string;
  result?: 'win' | 'loss' | null;
  completedTime?: number;
  resultDetermined?: boolean;  // Flag para indicar se o resultado j?? foi determinado
  showResult?: boolean;       // Flag para indicar se deve mostrar o resultado
  resultTimestamp?: number;   // Timestamp de quando o resultado foi determinado
  isAnimatingResult?: boolean; // Flag para controlar anima????o do resultado
}

// Interface para sinais estendidos com propriedades de anima????o e processamento
interface ExtendedSignal extends PlaceholderSignal {
  isAnimating?: boolean;
  processed?: boolean;
  isDashboard?: boolean;
}

// Adicionar a propriedade para o TypeScript no n??vel superior do arquivo
// Nota: A interface Window._cacheDailySignals j?? est?? definida em SignalsCard.tsx como any[]
// para manter compatibilidade com outros componentes

// Fun????o para verificar se um ativo est?? dispon??vel em determinado hor??rio
const isAssetAvailable = (asset: string, date: Date = new Date()): boolean => {
  // Verifica????o especial para USD Currency Index com hor??rios espec??ficos por dia da semana
  if (asset === "USD Currency Index (OTC)") {
    const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = S??bado
    const hora = date.getHours();
    const minuto = date.getMinutes();
    const currentTimeInMinutes = hora * 60 + minuto;
    
    // S??bado: Mercado fechado
    if (dayOfWeek === 6) {
      return false;
    }
    
    // Domingo: 19:00 ??? 23:59
    if (dayOfWeek === 0) {
      return currentTimeInMinutes >= (19 * 60) && currentTimeInMinutes <= (23 * 60 + 59);
    }
    
    // Segunda a Quinta: 00:00-10:00, 11:10-22:00, 23:10-23:59
    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
      return (currentTimeInMinutes >= 0 && currentTimeInMinutes <= (10 * 60)) ||
             (currentTimeInMinutes >= (11 * 60 + 10) && currentTimeInMinutes <= (22 * 60)) ||
             (currentTimeInMinutes >= (23 * 60 + 10) && currentTimeInMinutes <= (23 * 60 + 59));
    }
    
    // Sexta: 00:00-10:00, 11:10-21:00
    if (dayOfWeek === 5) {
      return (currentTimeInMinutes >= 0 && currentTimeInMinutes <= (10 * 60)) ||
             (currentTimeInMinutes >= (11 * 60 + 10) && currentTimeInMinutes <= (21 * 60));
    }
    
    return false;
  }
  
  // Se o ativo n??o estiver na lista de hor??rios, assume-se que est?? dispon??vel 24/7
  if (!HORARIOS_DISPONIBILIDADE[asset]) {
    return true;
  }
  
  const hora = date.getHours();
  const minuto = date.getMinutes();
  
  // Verificar se o hor??rio atual est?? dentro de algum dos intervalos de disponibilidade
  const isAvailable = HORARIOS_DISPONIBILIDADE[asset].some(([horaInicio, minutoInicio, horaFim, minutoFim]) => {
    const inicioEmMinutos = horaInicio * 60 + minutoInicio;
    const fimEmMinutos = horaFim * 60 + minutoFim;
    const atualEmMinutos = hora * 60 + minuto;
    
    return atualEmMinutos >= inicioEmMinutos && atualEmMinutos <= fimEmMinutos;
  });
  
  return isAvailable;
};

// Fun????o FLEXIBILIZADA para verificar se um ativo estar?? dispon??vel por pelo menos 30 minutos
// Esta fun????o substitui a verifica????o rigorosa para permitir mais sinais serem gerados
const isAssetAvailableForSignal = (asset: string, entryDate: Date = new Date()): boolean => {
  // Verifica????o especial para USD Currency Index com hor??rios espec??ficos por dia da semana
  if (asset === "USD Currency Index (OTC)") {
    const dayOfWeek = entryDate.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = S??bado
    const hora = entryDate.getHours();
    const minuto = entryDate.getMinutes();
    const entryTimeMinutes = hora * 60 + minuto;
    
    // S??bado: Mercado fechado
    if (dayOfWeek === 6) {
      return false;
    }
    
    // Domingo: 19:00 ??? 23:59
    if (dayOfWeek === 0) {
      const isInRange = entryTimeMinutes >= (19 * 60) && entryTimeMinutes <= (23 * 60 + 59);
      const timeRemaining = (23 * 60 + 59) - entryTimeMinutes;
      return isInRange && timeRemaining >= 30;
    }
    
    // Segunda a Quinta: 00:00-10:00, 11:10-22:00, 23:10-23:59
    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
      // Primeiro intervalo: 00:00-10:00
      if (entryTimeMinutes >= 0 && entryTimeMinutes <= (10 * 60)) {
        const timeRemaining = (10 * 60) - entryTimeMinutes;
        return timeRemaining >= 30;
      }
      // Segundo intervalo: 11:10-22:00
      if (entryTimeMinutes >= (11 * 60 + 10) && entryTimeMinutes <= (22 * 60)) {
        const timeRemaining = (22 * 60) - entryTimeMinutes;
        return timeRemaining >= 30;
      }
      // Terceiro intervalo: 23:10-23:59
      if (entryTimeMinutes >= (23 * 60 + 10) && entryTimeMinutes <= (23 * 60 + 59)) {
        const timeRemaining = (23 * 60 + 59) - entryTimeMinutes;
        return timeRemaining >= 30;
      }
      return false;
    }
    
    // Sexta: 00:00-10:00, 11:10-21:00
    if (dayOfWeek === 5) {
      // Primeiro intervalo: 00:00-10:00
      if (entryTimeMinutes >= 0 && entryTimeMinutes <= (10 * 60)) {
        const timeRemaining = (10 * 60) - entryTimeMinutes;
        return timeRemaining >= 30;
      }
      // Segundo intervalo: 11:10-21:00
      if (entryTimeMinutes >= (11 * 60 + 10) && entryTimeMinutes <= (21 * 60)) {
        const timeRemaining = (21 * 60) - entryTimeMinutes;
        return timeRemaining >= 30;
      }
      return false;
    }
    
    return false;
  }
  
  // Se o ativo n??o estiver na lista de hor??rios, assume-se que est?? dispon??vel 24/7
  if (!HORARIOS_DISPONIBILIDADE[asset]) {
    return true;
  }
  
  const hora = entryDate.getHours();
  const minuto = entryDate.getMinutes();
  const entryTimeMinutes = hora * 60 + minuto;
  
  // Verificar se o ativo estar?? dispon??vel por pelo menos 3 horas a partir do hor??rio de entrada
  const requiredEndTime = entryTimeMinutes + 180; // 180 minutos (3 horas) ap??s a entrada
  
  const isAvailable = HORARIOS_DISPONIBILIDADE[asset].some(([horaInicio, minutoInicio, horaFim, minutoFim]) => {
    const inicioEmMinutos = horaInicio * 60 + minutoInicio;
    const fimEmMinutos = horaFim * 60 + minutoFim;
    
    // Verifica se o hor??rio de entrada est?? dentro do intervalo
    // E se h?? pelo menos 3 horas de disponibilidade restante
    const entryInRange = entryTimeMinutes >= inicioEmMinutos && entryTimeMinutes <= fimEmMinutos;
    const availableTimeRemaining = fimEmMinutos - entryTimeMinutes; // Tempo restante de disponibilidade
    const hasEnoughTime = availableTimeRemaining >= 180; // Pelo menos 180 minutos (3 horas) restantes
    
    return entryInRange && hasEnoughTime;
  });
  
  return isAvailable;
};

const Signals = () => {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { convertTimeToSelected, adjustTime } = useTimeZone();
  const { scheduleSignalNotification, requestPermission, hasPermission } = useTrendingNotifications();
  const [filterType, setFilterType] = useState<SignalType | 'ALL'>('ALL');
  const [currentPrices, setCurrentPrices] = useState<Record<string, string>>({});
  const [previousPrices, setPreviousPrices] = useState<Record<string, string>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showExpiredSignals, setShowExpiredSignals] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [signalsPerPage] = useState(7);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [completedSignals, setCompletedSignals] = useState<Record<string, 'win' | 'loss'>>({});
  const [signalsToRemove, setSignalsToRemove] = useState<string[]>([]);
  const [signalCompletionCount, setSignalCompletionCount] = useState<{wins: number, losses: number}>({wins: 0, losses: 0});
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [winCount, setWinCount] = useState<number>(0); // Contador de ganhos consecutivos
  const [totalCount, setTotalCount] = useState<number>(0); // Contador total de resultados
  const [dashboardSignals, setDashboardSignals] = useState<TradingSignal[]>([]);
  const [resultCounter, setResultCounter] = useState(0);
  const [winLossCounter, setWinLossCounter] = useState(0); // Contador de ganhos e perdas consecutivos
  const [resultAnimation, setResultAnimation] = useState<Record<string, boolean>>({});
  const resultTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const rotateTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  

  
  // Refer??ncias para controle de estado sem re-renderiza????o
  const rotateSignalsLock = useRef(false);
  const lastRotationTime = useRef(0);
  const stateRef = useRef({
    lastCheckTime: Date.now(),
    lastPriceUpdate: Date.now(),
    isUpdating: false
  });
  const updateLockRef = useRef({
    isUpdating: false,
    lastUpdateTime: Date.now()
  });
  
  // ===== SUPABASE REALTIME INTEGRATION =====
  // Handler para mudan??as em tempo real nos sinais
  const handleRealtimeSignalChange = useCallback((signal: TradingSignal) => {
    void signal;
    
    // Invalidar cache do React Query para recarregar sinais
    queryClient.invalidateQueries({ queryKey: ['tradingSignals'] });
    
    // Opcional: Mostrar notifica????o visual
    // toast.info('Novo sinal dispon??vel');
  }, [queryClient]);

  // Conectar ao realtime do Supabase
  const { status: realtimeStatus } = useTradingSignalsRealtime(
    handleRealtimeSignalChange,
    true // enabled
  );

  // ===== FIM SUPABASE REALTIME INTEGRATION =====

  
  // Usar a fun????o `adjustTime` fornecida pelo contexto `useTimeZone`

  // Fun????o para converter o tempo de string para Date
  const convertTimeStringToDate = useCallback((timeString: string): Date => {
    if (!timeString) return new Date();
    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      const now = new Date();
      now.setHours(hours, minutes, 0, 0);
      return adjustTime(now);
    } catch {
      return new Date();
    }
  }, [adjustTime]);
  
  // Fun????o para calcular o pr??ximo hor??rio com base em um hor??rio inicial e um intervalo em minutos
  const calculateNextTime = useCallback((timeStr: string, minutesToAdd: number): string => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + minutesToAdd;
    
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMinutes = totalMinutes % 60;
    
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
  }, []);
  
  // Converter PlaceholderSignal para TradingSignal (compat??vel com notifica????es)
  const convertToTradingSignal = useCallback((signal: PlaceholderSignal): TradingSignal => ({
    ...signal,
    id: signal.id,
    symbol: signal.symbol,
    pair: signal.pair,
    type: SignalType.TECHNICAL,
    signal: signal.signal,
    reason: signal.reason || 'An??lise algor??tmica',
    strength: SignalStrength.STRONG,
    timestamp: signal.timestamp || Date.now(),
    price: signal.price || signal.entry_price || 0,
    entry_price: typeof signal.entry_price === 'number' ? signal.entry_price : parseFloat(String(signal.entry_price || 0)),
    stop_loss: signal.stop_loss || 0,
    target_price: signal.target_price || 0,
    success_rate: signal.success_rate || 0.85,
    timeframe: signal.timeframe,
    expiry: signal.expiry,
    risk_reward: signal.risk_reward || '1.5:1',
    status: signal.status || 'active',
    entry_time: signal.entry_time
  }), []);

  // Agendar notifica????es para novos sinais
  const scheduleNotificationsForSignals = useCallback((signals: PlaceholderSignal[]) => {
    signals.forEach(signal => {
      if (signal.entry_time) {
        const tradingSignal = convertToTradingSignal(signal);
        // Compatibilidade: O contexto aceita TradingSignal com entry_price flex??vel
        // O tipo importado usa number, mas o contexto aceita ambos
        scheduleSignalNotification(tradingSignal as unknown as Parameters<typeof scheduleSignalNotification>[0]);
      }
    });
  }, [scheduleSignalNotification, convertToTradingSignal]);

  // Helper para comparar arrays de sinais (IDs e entry_time) para evitar setState desnecess??rio
  const areSignalsEqual = (a?: TradingSignal[] | null, b?: TradingSignal[] | null) => {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const sa = a[i];
      const sb = b[i];
      if (!sa || !sb) return false;
      if ((sa.id || '') !== (sb.id || '')) return false;
      if ((sa.entry_time || '') !== (sb.entry_time || '')) return false;
    }
    return true;
  };

  // Fun????o segura para atualizar o cache do React Query somente se houver mudan??a real
  const safeSetTradingSignals = useCallback((newSignals: TradingSignal[] | null | undefined) => {
    try {
      const existing = queryClient.getQueryData<TradingSignal[]>(['tradingSignals']) || [];
      if (!newSignals) return;
      if (areSignalsEqual(existing, newSignals)) {
        // N??o atualiza se for id??ntico
        return;
      }
      queryClient.setQueryData(['tradingSignals'], newSignals);
    } catch {
      // ignorar erros de atualização de sinais
    }
  }, [queryClient]);

  // Fun????o para obter um ativo aleat??rio dispon??vel no momento atual com disponibilidade de 30 minutos
  const getRandomAsset = useCallback((entryDate?: Date): string => {
    const checkDate = entryDate || new Date();
    
    // Filtrar RIGOROSAMENTE qualquer ativo que contenha "binance" (mai??sculo ou min??sculo)
    const availableAssets = getAllAssetNames().filter(asset => {
      const assetLower = asset.toLowerCase();
      const categoryLower = (ATIVOS_CATEGORIAS[asset] || '').toLowerCase();
      
      return (
        ALLOWED_SET.has(asset) &&
        isAssetAvailableForSignal(asset, checkDate) &&
        !assetLower.includes('binance') && 
        !categoryLower.includes('binance')
      );
    });
    
    // Log para debug - apenas se houver problemas
    
    // Se n??o houver ativos dispon??veis, usar ativos padr??o que s??o sempre seguros
    if (availableAssets.length === 0) {
      const safeAssets = [
        "Bitcoin", 
        "Ethereum", 
        "Ouro/Prata",
        "USD/CAD (OTC)",
        "EUR/JPY (OTC)"
      ];
      const randomIndex = Math.floor(Math.random() * safeAssets.length);
      return safeAssets[randomIndex];
    }
    
    // Lista de ativos priorit??rios para maior varia????o (todos OTC e sem binance)
    const priorityAssets = [
      "GER 30 (OTC)", "USD/ZAR (OTC)", "MELANIA Coin (OTC)", 
      "Hamster Kombat (OTC)", "Worldcoin (OTC)", "TRUMP Coin (OTC)", "GBP/CAD (OTC)",
      "Ouro/Prata", "Ethereum", "1000Sats", "Pepe",
      "Bitcoin", "USD/CAD (OTC)", "EUR/JPY (OTC)", "GBP/AUD (OTC)"
    ].filter(asset => 
      availableAssets.includes(asset) && ALLOWED_SET.has(asset) &&
      !asset.toLowerCase().includes('binance')
    );
    
    // Se temos ativos priorit??rios dispon??veis, escolher entre eles
    if (priorityAssets.length > 0) {
      const randomIndex = Math.floor(Math.random() * priorityAssets.length);
      const selectedAsset = priorityAssets[randomIndex];
      
      // Verifica????o adicional de seguran??a
      if (!selectedAsset.toLowerCase().includes('binance')) {
        return selectedAsset;
      }
    }
    
    // Caso contr??rio, retornar um ativo aleat??rio da lista completa de dispon??veis
    const filteredAvailableAssets = availableAssets.filter(asset => ALLOWED_SET.has(asset) && !asset.toLowerCase().includes('binance'));
    
    if (filteredAvailableAssets.length > 0) {
      const randomIndex = Math.floor(Math.random() * filteredAvailableAssets.length);
      return filteredAvailableAssets[randomIndex];
    }
    
    // ??ltimo recurso - retornar um ativo absolutamente seguro
    return "Bitcoin";
  }, []);

  // Fun????o para criar dados base para um sinal placeholder
  // NOTA: Precisa estar aqui antes de generateDailySignals que a utiliza
  const createBasePlaceholderData = useCallback((override: Partial<PlaceholderSignal> = {}): PlaceholderSignal => ({
    id: `signal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    symbol: 'Bitcoin',
    exchange: inferExchangeCategory('Bitcoin'),
    signal: 'BUY',
    entry_time: '12:00',
    timeframe: '5m',
    expiry_time_str: '12:05',
    gale1_time: '12:05',
    gale2_time: '12:10',
    status: 'active',
    strength: SignalStrength.MODERATE,
    type: SignalType.TECHNICAL,
    reason: 'An??lise algor??tmica',
    timestamp: Date.now(),
    success_rate: 0.85,
    price: 100 + Math.random() * 900,
    entry_price: 100 + Math.random() * 900,
    stop_loss: 90 + Math.random() * 800,
    target_price: 110 + Math.random() * 1000,
    risk_reward: '1.5:1',
    expiry: '5m',
    ...override
  }), []);

  // Fun????o para gerar a sequ??ncia de sinais para o dia todo, come??ando ?? meia-noite
  // NOTA: Precisa estar aqui antes de createRandomPlaceholderSignal que a utiliza
  const generateDailySignals = useCallback((): PlaceholderSignal[] => {
    // Verificar se j?? temos sinais gerados em cache de mem??ria
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}`;
    
    if (signalCache && signalCache.signals.length > 0 && signalCache.date === todayStr) {
      return signalCache.signals;
    }
    const dailySignals: PlaceholderSignal[] = [];
    
    // Usar semente para gera????o aleat??ria baseada no dia atual
    // Isso garante que os sinais ser??o os mesmos para o dia todo
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const seededRandom = (max: number) => {
      const x = Math.sin(seed + dailySignals.length) * 10000;
      return Math.floor((x - Math.floor(x)) * max);
    };
    
    // Criar um conjunto para rastrear combina????es de ativos e hor??rios j?? usados
    const usedAssetTimeCombo = new Set<string>();
    
    // Gerar hor??rios seguindo a sequ??ncia correta: 00:03, 00:23, 00:43, 01:03, 01:23, 01:43, 02:03...
    let currentHour = 0;
    let currentMinute = 3; // Come??ar sempre com :03
    
    // Gerar sinais para 24 horas (72 sinais no total: 3 por hora x 24 horas)
    for (let i = 0; i < 72; i++) {
        // Formatar o hor??rio de entrada
      const entryTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
        
        // Calcular os hor??rios de expira????o e reentradas
        const expiryTime = calculateNextTime(entryTime, SIGNAL_EXPIRY_TIME); // Expira????o = entrada + 5 min
        const gale1Time = expiryTime; // Reentrada 1 ?? igual ao hor??rio de expira????o
        const gale2Time = calculateNextTime(gale1Time, SIGNAL_EXPIRY_TIME); // Reentrada 2 = reentrada 1 + 5 min
        
        // Criar uma data simulada para este hor??rio espec??fico
        const signalDate = new Date();
      signalDate.setHours(currentHour, currentMinute, 0, 0);
        
        // Obter todos os ativos dispon??veis neste hor??rio espec??fico (com 3 horas de disponibilidade)
        const availableAssets = getAllAssetNames().filter(asset => 
          ALLOWED_SET.has(asset) && isAssetAvailableForSignal(asset, signalDate)
        );
        
        // Se n??o houver ativos dispon??veis neste hor??rio, usar ativos da lista permitida
        const assetsToUse = availableAssets.length > 0 ? availableAssets : ALLOWED_ASSETS.slice(0, 3);
        
        // Se ainda n??o temos ativos dispon??veis, pular este hor??rio
      if (assetsToUse.length === 0) {
        // Avan??ar para o pr??ximo hor??rio na sequ??ncia
        if (currentMinute === 3) {
          currentMinute = 23;
        } else if (currentMinute === 23) {
          currentMinute = 43;
        } else if (currentMinute === 43) {
          currentMinute = 3;
          currentHour = (currentHour + 1) % 24;
        }
        continue;
      }
        
        // Selecionar um ativo aleat??rio n??o usado no hor??rio anterior
        let symbol;
        let attempts = 0;
        
        do {
          const randomIndex = seededRandom(assetsToUse.length);
          symbol = assetsToUse[randomIndex];
          attempts++;
      } while (usedAssetTimeCombo.has(`${symbol}-${currentHour}${currentMinute}`) && attempts < 10);
        
        // Marcar esta combina????o como usada
      usedAssetTimeCombo.add(`${symbol}-${currentHour}${currentMinute}`);
        
        // Criar um ID est??vel baseado no hor??rio e no asset, n??o em timestamp aleat??rio
        const stableId = `signal_${entryTime.replace(':', '')}_${symbol.replace(/[^a-zA-Z0-9]/g, '_')}_${seed}`;
        
        // Gerar taxas de sucesso entre 80% e 93.4%
        const successRate = 0.80 + (seededRandom(100) / 100) * (0.934 - 0.80);
        
        // Determinar for??a do sinal com base na taxa de sucesso
        let strength;
        if (successRate >= 0.90) {
          strength = SignalStrength.VERY_STRONG; // Alt??ssima expectativa (??? 90%)
        } else if (successRate >= 0.85) {
          strength = SignalStrength.STRONG; // Alta expectativa (??? 85%)
        } else {
          strength = SignalStrength.MODERATE; // M??dia expectativa (< 85%)
        }
        
        // Adicionar este sinal ao conjunto
        const signal = createBasePlaceholderData({
          id: stableId,
          symbol,
          exchange: ATIVOS_CATEGORIAS[symbol] || inferExchangeCategory(symbol),
          signal: seededRandom(100) > 50 ? 'BUY' : 'SELL',
          strength,
          entry_time: entryTime,
          timeframe: "5m", // Sempre 5 minutos
          expiry_time_str: expiryTime,
          gale1_time: gale1Time,
          gale2_time: gale2Time,
          success_rate: successRate
        });
        
        dailySignals.push(signal);
      
      // Avan??ar para o pr??ximo hor??rio na sequ??ncia correta
      if (currentMinute === 3) {
        currentMinute = 23; // 03 -> 23 (mesma hora)
      } else if (currentMinute === 23) {
        currentMinute = 43; // 23 -> 43 (mesma hora)
      } else if (currentMinute === 43) {
        currentMinute = 3; // 43 -> 03 (pr??xima hora)
        currentHour = (currentHour + 1) % 24;
      }
    }
    
    // Armazenar em cache de mem??ria
    signalCache = {
      signals: dailySignals,
      date: todayStr
    };
    
    return dailySignals;
  }, [calculateNextTime, createBasePlaceholderData]);

  // Fun????o para criar um novo sinal aleat??rio (baseado no ciclo definido)
  // NOTA: Precisa estar aqui antes de rotateSignals que a utiliza
  const createRandomPlaceholderSignal = useCallback((): PlaceholderSignal => {
    // Obter os sinais di??rios
    const dailySignals = generateDailySignals();
    
    // Obter o hor??rio atual
    const now = new Date();
    
    // Encontrar o pr??ximo sinal baseado no hor??rio atual
    let nextSignal = dailySignals[0];
    
    for (const signal of dailySignals) {
      const entryTime = convertTimeStringToDate(signal.entry_time);
      
      // Se encontrarmos um sinal com hor??rio de entrada futuro, usamos ele
      if (entryTime > now) {
        nextSignal = signal;
        break;
      }
    }
    
    // Se n??o encontramos nenhum sinal futuro, usar o primeiro do dia seguinte
    if (!nextSignal) {
      nextSignal = dailySignals[0];
    }
    
    // Garantir que o ID seja ??nico
    return {
      ...nextSignal,
      id: 'placeholder-' + Math.random().toString(36).substring(2, 9),
    };
  }, [convertTimeStringToDate, generateDailySignals]);

  // Fun????o para rotacionar os sinais com lock para evitar m??ltiplas chamadas r??pidas
  const rotateSignals = useCallback((currentSignals: TradingSignal[]): TradingSignal[] => {
    // Verificar se j?? rotacionamos recentemente (dentro dos ??ltimos 5 minutos)
    const now = Date.now();
    if (now - lastRotationTime.current < 5 * 60 * 1000) {
      return currentSignals;
    }
    
    if (rotateSignalsLock.current) {
      return currentSignals;
    }
    
    // Ativar lock de rota????o para evitar rota????es simult??neas
    rotateSignalsLock.current = true;
    
    try {
      if (!currentSignals || currentSignals.length < 7) {
        return currentSignals;
      }
      
      const firstSignal = currentSignals[0];
      if (!firstSignal || !firstSignal.entry_time) {
        return currentSignals;
      }
      
      // Verificar se j?? se passaram 20 minutos desde a entrada do primeiro sinal
      const [entryHour, entryMin] = String(firstSignal.entry_time).split(':').map(Number);
      
      // Sinais sao sempre no horario de Brasilia (GMT-3). Converter BRT -> UTC: UTC = BRT + 3
      const currentTime = new Date();
      const entryTime = new Date(Date.UTC(
        currentTime.getUTCFullYear(),
        currentTime.getUTCMonth(),
        currentTime.getUTCDate(),
        entryHour + 3,
        entryMin,
        0,
        0
      ));
      if (entryTime.getTime() - currentTime.getTime() > 12 * 60 * 60 * 1000) {
        entryTime.setUTCDate(entryTime.getUTCDate() - 1);
      }
      
      // Calcular diferen??a em minutos desde a entrada
      const timeDiffMs = currentTime.getTime() - entryTime.getTime();
      const minutesSinceEntry = Math.floor(timeDiffMs / (1000 * 60));
        
      // Verificar se j?? se passaram 20 minutos
      if (minutesSinceEntry < 20) {
        return currentSignals;
      }
      
      // Obter o ??ltimo sinal atual para determinar o pr??ximo hor??rio v??lido
      const lastSignal = currentSignals[currentSignals.length - 1];
      
      // Calcular o pr??ximo hor??rio v??lido baseado no padr??o 03???23???43???03
      const lastEntryTime = String(lastSignal.entry_time);
      const [lastHour, lastMinute] = lastEntryTime.split(':').map(Number);
        
      // Determinar o pr??ximo hor??rio seguindo o padr??o
      let nextHour = lastHour;
      let nextMinute = lastMinute;
      
      // Avan??ar para o pr??ximo hor??rio v??lido
      if (lastMinute === 3) {
        nextMinute = 23; // 03 ??? 23
      } else if (lastMinute === 23) {
        nextMinute = 43; // 23 ??? 43
      } else if (lastMinute === 43) {
        nextMinute = 3; // 43 ??? 03 (pr??xima hora)
        nextHour = (lastHour + 1) % 24;
      } else {
        if (lastMinute < 3) {
          nextMinute = 3;
        } else if (lastMinute < 23) {
          nextMinute = 23;
        } else if (lastMinute < 43) {
          nextMinute = 43;
        } else {
          nextMinute = 3;
          nextHour = (lastHour + 1) % 24;
        }
      }
      
      const nextEntryTime = `${nextHour.toString().padStart(2, '0')}:${nextMinute.toString().padStart(2, '0')}`;
      
      
      // Gerar um novo sinal para a posi????o 7
      const newSignal = createBasePlaceholderData({
        entry_time: nextEntryTime,
        expiry_time_str: calculateNextTime(nextEntryTime, SIGNAL_EXPIRY_TIME),
        gale1_time: calculateNextTime(nextEntryTime, SIGNAL_EXPIRY_TIME),
        gale2_time: calculateNextTime(nextEntryTime, SIGNAL_EXPIRY_TIME * 2)
      });
      
      // Criar a nova lista de sinais: remover o primeiro e adicionar o novo no final
      const rotatedSignals = [...currentSignals.slice(1), newSignal];
      
      
      // Atualizar o timestamp da ??ltima rota????o
      lastRotationTime.current = now;
      
      // Salvar no cache de navega????o para persist??ncia entre trocas de aba
      saveSignalsToNavigationCache(rotatedSignals as PlaceholderSignal[]);
      
      // Retornar a lista atualizada
      return rotatedSignals;
    } finally {
      // Liberar o lock ap??s 10 segundos para garantir que tudo acabou
      setTimeout(() => {
        rotateSignalsLock.current = false;
      }, 10000);
    }
  }, [calculateNextTime, createBasePlaceholderData]);

  // REMOVIDO: Sistema de rota????o pr??pria da p??gina Signals
  // A p??gina Signals agora APENAS SINCRONIZA com a dashboard
  // A rota????o ?? feita EXCLUSIVAMENTE pela dashboard

  // Adicionar fun????o para reiniciar contadores quando a p??gina ?? carregada
  useEffect(() => {
    setSignalCompletionCount({wins: 0, losses: 0});
    
    // Definir filtros padr??o: mostrar todos os tipos e n??o mostrar expirados
    setFilterType('ALL');
    setShowExpiredSignals(false);
  }, []);
  
  // Efeito para subscrever ??s atualiza????es de sinais - DESATIVADO (arquivo removido)
  useEffect(() => {
    // const unsubscribe = tradingSignalService.subscribe(() => {
    //   queryClient.invalidateQueries({ queryKey: ['tradingSignals'] });
    // });
    
    // return () => {
    //   unsubscribe();
    // };
    
    // Funcionalidade desativada - TradingSignalService removido
  }, [queryClient]);
  
  // Processar sinais que precisam ser removidos
  useEffect(() => {
    // Este c??digo foi substitu??do pela fun????o rotateSignals
    // que gerencia toda a l??gica de rota????o de sinais
  }, [createRandomPlaceholderSignal]);
  
  // ??? FUN????O PRESERVATIVA: Completar sinais faltantes SEM alterar existentes (CAMADA 9)
  const generateMinimumSevenSignals = useCallback((existingSignals: PlaceholderSignal[]): PlaceholderSignal[] => {
    if (!existingSignals || existingSignals.length === 0) {
      // Se n??o h?? sinais, gerar os 7 do zero
      return generateDailySignals().slice(0, 7);
    }
    
    if (existingSignals.length >= 7) {
      return existingSignals.slice(0, 7);
    }
    
    const needed = 7 - existingSignals.length;
    
    // Gerar sinais extras baseados na hora atual
    const allDailySignals = generateDailySignals();
    const existingIds = new Set(existingSignals.map(s => s.id));
    const existingSymbols = new Set(existingSignals.map(s => s.symbol));
    
    // Encontrar sinais que n??o existem ainda
    const availableSignals = allDailySignals.filter(signal => 
      !existingIds.has(signal.id) && 
      !existingSymbols.has(signal.symbol) &&
      !signal.symbol?.toLowerCase().includes('binance')
    );
    
    // Pegar os sinais necess??rios
    const additionalSignals = availableSignals.slice(0, needed);
    
    // Combinar preservando os existentes
    return [...existingSignals, ...additionalSignals];
  }, [generateDailySignals]);

  // ??????? FUN????O SUPER PRESERVATIVA: Garantir 7 sinais preservando existentes (CAMADA 8)
  const ensureSevenSignalsPreservative = useCallback((inputSignals: PlaceholderSignal[]): PlaceholderSignal[] => {
    if (inputSignals && inputSignals.length === 7) {
      const allValid = inputSignals.every(signal => 
        signal.symbol && 
        !signal.symbol.toLowerCase().includes('binance') &&
        signal.entry_time &&
        signal.id
      );
      
      if (allValid) {
        return inputSignals;
      }
    }
    
    // Filtrar sinais v??lidos primeiro
    const validSignals = (inputSignals || []).filter(signal => 
      signal.symbol && 
      !signal.symbol.toLowerCase().includes('binance') &&
      !signal.exchange?.toLowerCase().includes('binance') &&
      signal.entry_time &&
      signal.id
    );
    
    // Usar fun????o para completar at?? 7
    return generateMinimumSevenSignals(validSignals);
  }, [generateMinimumSevenSignals]);

  // ???? HANDLE VISIBILITY CHANGE ULTRA CONSERVATIVO (CAMADA 7)
// NUNCA substitui sinais existentes - apenas recupera se perdidos
const handleVisibilityChangeConservative = useCallback((
  queryClient: QueryClient, 
  currentSignals: PlaceholderSignal[]
): void => {
  const cachedSignals = loadSignalsFromNavigationCache();
  if (cachedSignals && cachedSignals.length >= 7) {
    safeSetTradingSignals(cachedSignals);
    return;
  }
  
  if (currentSignals && currentSignals.length >= 7) {
    saveSignalsToNavigationCache(currentSignals);
    return;
  }
  
  if (currentSignals && currentSignals.length >= 4) {
    const completedSignals = ensureSevenSignalsPreservative(currentSignals);
    safeSetTradingSignals(completedSignals);
    saveSignalsToNavigationCache(completedSignals);
    return;
  }
  
  try {
    const dashboardData = localStorage.getItem('dashboardSignals');
    if (dashboardData) {
      const { signals: dashboardSignals } = JSON.parse(dashboardData);
      if (dashboardSignals && dashboardSignals.length >= 3) {
        const regeneratedSignals = ensureSevenSignalsPreservative(dashboardSignals.slice(0, 3));
        safeSetTradingSignals(regeneratedSignals);
        saveSignalsToNavigationCache(regeneratedSignals);
        return;
      }
    }
  } catch {
    // ignorar erros de recuperação de sinais
  }
  
  // ??ltimo recurso absoluto: gerar novos sinais
  const newSignals = generateDailySignals().slice(0, 7);
  safeSetTradingSignals(newSignals);
  saveSignalsToNavigationCache(newSignals);
}, [generateDailySignals, ensureSevenSignalsPreservative, safeSetTradingSignals]);
  
  // Filtrar os sinais mais relevantes para o hor??rio atual
  const filterRelevantSignals = useCallback((allSignals: PlaceholderSignal[]): PlaceholderSignal[] => {
    try {
      // Verifica????o de seguran??a
      if (!allSignals || !Array.isArray(allSignals)) {
        return [];
      }
    if (!allSignals || allSignals.length === 0) return [];
    
    // Obter a hora atual
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Para seguir o padr??o correto: XX:03, XX:23, XX:43, (XX+1):03, (XX+1):23, (XX+1):43, etc.
    // Sequ??ncia correta: 03 -> 23 -> 43 -> pr??xima hora com 03, etc.
    
    // Determinar o pr??ximo hor??rio v??lido
    let nextMinute, nextHour;
    
    // Se estamos antes de XX:23, o pr??ximo hor??rio ?? XX:23
    if (currentMinute < 23) {
      nextMinute = 23;
      nextHour = currentHour;
    }
    // Se estamos entre XX:23 e XX:43, o pr??ximo hor??rio ?? XX:43
    else if (currentMinute < 43) {
      nextMinute = 43;
      nextHour = currentHour;
    }
    // Se estamos ap??s XX:43, o pr??ximo hor??rio ?? (XX+1):03
    else {
      nextMinute = 3;
      nextHour = (currentHour + 1) % 24;
    }
    
    // Gerar os pr??ximos 7 hor??rios seguindo a sequ??ncia correta: XX:03, XX:23, XX:43
    const relevantTimes = [];
    let hour = nextHour;
    let minute = nextMinute;
    
    for (let i = 0; i < 7; i++) {
      // Adicionar o hor??rio atual
      relevantTimes.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      
      // Avan??ar para o pr??ximo hor??rio na sequ??ncia correta
      if (minute === 3) {
        minute = 23; // 03 -> 23 (mesma hora)
      } else if (minute === 23) {
        minute = 43; // 23 -> 43 (mesma hora)
      } else if (minute === 43) {
        minute = 3; // 43 -> 03 (pr??xima hora)
        hour = (hour + 1) % 24;
      }
    }
    
    
    // Filtrar os sinais que correspondem aos hor??rios relevantes
    // E tamb??m verificar se o ativo estar?? dispon??vel por 30 minutos no hor??rio do sinal
    const filteredSignals = allSignals.filter(signal => {
      // Verificar se o hor??rio corresponde a um dos relevantes
      if (!relevantTimes.includes(signal.entry_time)) {
        return false;
      }
      
      // Verificar se o ativo estar?? dispon??vel por pelo menos 30 minutos no hor??rio do sinal
      const [hour, minute] = signal.entry_time.split(':').map(Number);
      const signalDate = new Date();
      signalDate.setHours(hour, minute, 0, 0);
      return isAssetAvailableForSignal(signal.symbol, signalDate);
    });
    
    // Se n??o encontramos 7 sinais, completar com os mais pr??ximos
    if (filteredSignals.length < 7) {
      // Ordenar todos os sinais por proximidade ao hor??rio atual
      // Considerando apenas sinais com ativos dispon??veis por 30 minutos
      const sortedByTime = [...allSignals]
        .filter(signal => {
          // Verificar se o ativo estar?? dispon??vel por pelo menos 30 minutos no hor??rio do sinal
          const [hour, minute] = signal.entry_time.split(':').map(Number);
          const signalDate = new Date();
          signalDate.setHours(hour, minute, 0, 0);
          return isAssetAvailableForSignal(signal.symbol, signalDate);
        })
        .sort((a, b) => {
          const timeA = convertTimeStringToDate(a.entry_time);
          const timeB = convertTimeStringToDate(b.entry_time);
          
          // Priorizar sinais que ainda n??o aconteceram
          const aInFuture = timeA.getTime() > now.getTime();
          const bInFuture = timeB.getTime() > now.getTime();
          
          if (aInFuture && !bInFuture) return -1;
          if (!aInFuture && bInFuture) return 1;
          
          // Se ambos s??o futuros ou ambos j?? passaram, pegar o mais pr??ximo
          return Math.abs(timeA.getTime() - now.getTime()) - Math.abs(timeB.getTime() - now.getTime());
        });
      
      // Adicionar sinais at?? completar 7
      let index = 0;
      while (filteredSignals.length < 7 && index < sortedByTime.length) {
        const signal = sortedByTime[index++];
        if (!filteredSignals.some(s => s.id === signal.id)) {
          filteredSignals.push(signal);
        }
      }
    }
    
    // Ordenar os sinais filtrados por hor??rio de entrada
    // ? CORRE??O: Ordenar por POSITION (n?o por entry_time)
    filteredSignals.sort((a, b) => {
      const posA = (a as PlaceholderSignal & { position?: number }).position || 0;
      const posB = (b as PlaceholderSignal & { position?: number }).position || 0;
      return posA - posB;
    });
    
    return filteredSignals.slice(0, 7);
    } catch {
      return [];
    }
  }, [convertTimeStringToDate]);

  // Mover a defini????o duplicada de createBasePlaceholderData daqui
  // (Movida para antes de generateMinimumSevenSignals)

  // REMOVIDO: Fun????o executeCorrectRotation n??o ?? mais necess??ria
  // A rota????o ?? feita exclusivamente pela dashboard

  // Fun????o para pegar os sinais di??rios com base na hora atual
  const getDailySignalsForCurrentTime = useCallback((): PlaceholderSignal[] => {
    try {
    let dashboardSignalsData = null;
    try {
      dashboardSignalsData = localStorage.getItem('dashboardSignals');
    } catch {
      // ignorar erros de localStorage
    }
    if (dashboardSignalsData) {
      
      try {
        const { signals: dashboardSignals } = JSON.parse(dashboardSignalsData);
        if (dashboardSignals && Array.isArray(dashboardSignals) && dashboardSignals.length >= 3) {
          
          // REGRA 1: Os 3 primeiros sinais s??o ID??NTICOS aos da dashboard
          const firstThreeSignals = dashboardSignals
            .filter(signal => 
              !signal.symbol?.toLowerCase().includes('binance') &&
              !signal.exchange?.toLowerCase().includes('binance') &&
              signal.symbol && signal.symbol.trim() !== ''
            )
            .slice(0, 3) // Garantir exatamente 3 sinais
            .map((signal, index) => ({
              ...signal,
              id: signal.id || `dashboard-${index}-${Math.random().toString(36).substring(2, 9)}`,
              status: 'active',
              exchange: inferExchangeCategory(signal.symbol),
              success_rate: Math.min(signal.success_rate || 0.85, 0.934), // Limitar a 93.4%
              isDashboard: true, // Marcar como sinal da dashboard
              dashboardPosition: index // Posi????o na dashboard (0, 1, 2)
            }));
          
          if (firstThreeSignals.length < 3) {
            return [];
          }
          
          // REGRA 2: O 4?? sinal tem entrada EXATAMENTE 20 minutos ap??s o 3?? sinal da dashboard
          const thirdSignal = firstThreeSignals[2]; // Terceiro sinal (??ndice 2)
          const thirdSignalEntryTime = thirdSignal.entry_time;
          
          const fourthSignalTime = calculateNextTime(thirdSignalEntryTime, 20);
          
          // REGRA 3: Sinais 5, 6, 7 seguem sequ??ncia 03???23???43???03 a partir do 4?? sinal
          const calculateNextPatternTime = (previousTime: string): string => {
            const [hour, minute] = previousTime.split(':').map(Number);
            let nextHour = hour;
            let nextMinute: number;
            
            if (minute < 3 || minute === 3) {
              nextMinute = 23;
            } else if (minute < 23 || minute === 23) {
              nextMinute = 43;
            } else {
              // minute >= 43, pr??ximo ?? XX+1:03
              nextHour = (hour + 1) % 24;
              nextMinute = 3;
            }
            
            return `${nextHour.toString().padStart(2, '0')}:${nextMinute.toString().padStart(2, '0')}`;
          };
          
          // Calcular hor??rios dos sinais 4, 5, 6, 7
          const additionalSignalTimes: string[] = [];
          
          // 4?? sinal: 20 minutos ap??s o 3??
          additionalSignalTimes.push(fourthSignalTime);
          
          // 5?? sinal: seguindo padr??o baseado no 4??
          const fifthSignalTime = calculateNextPatternTime(fourthSignalTime);
          additionalSignalTimes.push(fifthSignalTime);
          
          // 6?? sinal: seguindo padr??o baseado no 5??
          const sixthSignalTime = calculateNextPatternTime(fifthSignalTime);
          additionalSignalTimes.push(sixthSignalTime);
          
          // 7?? sinal: seguindo padr??o baseado no 6??
          const seventhSignalTime = calculateNextPatternTime(sixthSignalTime);
          additionalSignalTimes.push(seventhSignalTime);
          
          // REGRA 4: Gerar os 4 sinais adicionais com ativos ??nicos
          const usedSymbols = new Set(firstThreeSignals.map(s => s.symbol));
          const additionalSignals: PlaceholderSignal[] = [];
          
          for (let i = 0; i < 4; i++) {
            const entryTime = additionalSignalTimes[i];
            const expiryTime = calculateNextTime(entryTime, SIGNAL_EXPIRY_TIME);
            const gale1Time = expiryTime;
            const gale2Time = calculateNextTime(gale1Time, SIGNAL_EXPIRY_TIME);
            
            // Obter um ativo dispon??vel que n??o foi usado ainda
            let symbol = getRandomAsset();
            let attempts = 0;
            while (usedSymbols.has(symbol) && attempts < 20) {
              symbol = getRandomAsset();
              attempts++;
            }
            
            // Se n??o conseguimos um ativo ??nico, usar lista de backup
            if (usedSymbols.has(symbol)) {
              const backupAssets = [
                "Ethereum", "Litecoin", "Dash", "Bitcoin Cash",
                "USD/CAD (OTC)", "EUR/JPY (OTC)", "GBP/AUD (OTC)", "AUD/CHF (OTC)",
                "USD/ZAR (OTC)", "World Coin", "Pepe", "1000Sats"
              ].filter(asset => !usedSymbols.has(asset) && !asset.toLowerCase().includes('binance'));
              
              if (backupAssets.length > 0) {
                symbol = backupAssets[Math.floor(Math.random() * backupAssets.length)];
              }
            }
            
            usedSymbols.add(symbol);
            
            const additionalSignal = createBasePlaceholderData({
              id: `additional-${i+4}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              symbol: symbol,
              exchange: ATIVOS_CATEGORIAS[symbol] || inferExchangeCategory(symbol),
              signal: Math.random() > 0.5 ? 'BUY' : 'SELL',
              entry_time: entryTime,
              timeframe: "5m",
              expiry_time_str: expiryTime,
              gale1_time: gale1Time,
              gale2_time: gale2Time,
              success_rate: 0.8 + Math.random() * 0.15,
              isDashboard: false, // Marcar como sinal adicional
              signalPosition: i + 4 // Posi????o 4, 5, 6, 7
            });
            
            additionalSignals.push(additionalSignal);
          }
          
          // COMBINAR: 3 sinais da dashboard + 4 sinais adicionais = 7 sinais totais
          const finalSignals = [...firstThreeSignals, ...additionalSignals];
          
          // VERIFICA????O DA DIFEREN??A DE 20 MINUTOS
          const thirdTime = finalSignals[2].entry_time;
          const fourthTime = finalSignals[3].entry_time;
          const [h3, m3] = thirdTime.split(':').map(Number);
          const [h4, m4] = fourthTime.split(':').map(Number);
          const diff = (h4 * 60 + m4) - (h3 * 60 + m3);
          void diff;
          
          // Verificar duplicatas de ativos (n??o deve haver)
          const assetCounts = new Map();
          finalSignals.forEach(signal => {
            const count = assetCounts.get(signal.symbol) || 0;
            assetCounts.set(signal.symbol, count + 1);
          });
          
          const duplicates = Array.from(assetCounts.entries()).filter(([_, count]) => count > 1);
          void duplicates;
          
          return finalSignals;
        }
      } catch {
        // ignorar erros de processamento de sinais
      }
    }
    
    // Se n??o conseguimos usar os sinais da dashboard, seguir com o fluxo normal
    const allDailySignals = generateDailySignals();
    
    // Salvar em cache
    const today = new Date();
    localStorage.setItem('dailyTradingSignals', JSON.stringify(allDailySignals));
    localStorage.setItem('dailyTradingSignalsDate', today.toISOString());
    
    // Filtrar os sinais para mostrar apenas os relevantes no momento atual
    return filterRelevantSignals(allDailySignals);
    } catch {
      // Retornar um array vazio como fallback para evitar tela preta
      return [];
    }
  }, [filterRelevantSignals, generateDailySignals, calculateNextTime, getRandomAsset, createBasePlaceholderData]);

  // =============================================
  // NOVO SISTEMA: SINAIS EM TEMPO REAL
  // =============================================
  // Nota: Sistema agora mostra 3 sinais ativos em tempo real
  // TODO: Implementar hist??rico para mostrar mais sinais no futuro
  const { 
    signals: realtimeSignals, 
    isLoading, 
    error: realtimeError,
    refresh: refetch 
  } = useExtendedSignals(); // ? Busca 7 sinais (3 ativos + 4 adicionais)
  
  // Retry automático: se auth resolveu mas sinais vieram vazio, re-tentar
  const retryCountRef = useRef(0);
  useEffect(() => {
    if (!isLoading && (!realtimeSignals || realtimeSignals.length === 0) && retryCountRef.current < 3) {
      const retryDelay = (retryCountRef.current + 1) * 2000;
      const retryTimer = setTimeout(() => {
        retryCountRef.current += 1;
        refetch();
      }, retryDelay);
      return () => clearTimeout(retryTimer);
    }
    if (realtimeSignals && realtimeSignals.length > 0) {
      retryCountRef.current = 0;
    }
  }, [isLoading, realtimeSignals, refetch]);
  
  // Converter sinais do Realtime para o formato esperado pela p??gina
  const signals = useMemo(() => {
    if (!realtimeSignals || realtimeSignals.length === 0) {
      return [];
    }


    // Converter para o formato TradingSignal esperado pela p??gina
    const converted = realtimeSignals.map((signal) => ({
      id: signal.id,
      symbol: signal.symbol,
      display_name: signal.display_name, // ? Nome completo do ativo
      entry_time: signal.entry_time,
      signal: signal.signal_type,
      strength: (signal.strength as SignalStrengthEnum) || SignalStrengthEnum.STRONG,
      success_rate: signal.success_rate,
      exchange: signal.category,
      timeframe: '5m',
      timestamp: new Date(signal.created_at).getTime(),
      entry_price: 0,
      expiry_time_str: signal.expiry_time,
      gale1_time: signal.gale1_time,
      gale2_time: signal.gale2_time,
      position: signal.position,
      // Propriedades adicionais necess??rias para TradingSignal
      type: SignalType.TECHNICAL,
      reason: 'Technical Analysis',
      price: 0,
      stop_loss: 0,
      target_price: 0,
      qualityScore: Math.round(signal.success_rate * 100),
      processed: false,
      status: 'active' as const,
      expiry: '5m',
      risk_reward: '2:1'
    }));

    // Salvar em localStorage para compatibilidade
    localStorage.setItem('tradesSignals', JSON.stringify({
      signals: converted,
      timestamp: Date.now(),
      source: 'realtime'
    }));

    return converted;
  }, [realtimeSignals]);

  const queryError = realtimeError;


  // Agendar notifica????es quando os sinais mudarem
  useEffect(() => {
    if (signals && signals.length > 0) {
      // Converter TradingSignal[] para PlaceholderSignal[] de forma segura
      const placeholderSignals = signals.map(signal => ({
        ...signal,
        entry_price: typeof signal.entry_price === 'number' ? signal.entry_price : parseFloat(signal.entry_price || '0')
      })) as PlaceholderSignal[];
      scheduleNotificationsForSignals(placeholderSignals);
    }
  }, [signals, scheduleNotificationsForSignals]);



  // Efeito para atualizar os sinais relevantes com intervalo muito grande
  useEffect(() => {
    // Manter controle do estado interno sem causar renderiza????es
    const internalState = {
      lastUpdateTimestamp: 0,
      lastSignalIDs: ""
    };
    
    // Fun????o otimizada para atualizar sinais apenas quando realmente necess??rio
    const silentUpdateSignalsIfNeeded = async () => {
      const now = new Date();
      const currentTimestamp = now.getTime();
      
      // Verificar se j?? se passou pelo menos 15 minutos desde a ??ltima atualiza????o
      // Intervalo MUITO maior para eliminar completamente piscadas
      if (currentTimestamp - internalState.lastUpdateTimestamp < 15 * 60 * 1000) {
        return;
      }
      
      // Verificar se estamos em um minuto espec??fico que justifique a atualiza????o
      // Reduzir para apenas minutos espec??ficos para evitar atualiza????es constantes
      const currentMinute = now.getMinutes();
      const isRelevantMinute = (
        currentMinute === 3 ||
        currentMinute === 23 || 
        currentMinute === 43
      );
      
      // S?? continuar se estivermos em um minuto realmente relevante
      if (!isRelevantMinute) return;
      
      // Obter sinais atuais do cache
      const existingSignals = queryClient.getQueryData<TradingSignal[]>(['tradingSignals']) || [];
      
      // Verificar se temos sinais em processamento ou anima????o
      const hasActiveSignals = existingSignals.some(signal => {
        const extSignal = signal as ExtendedSignal;
        return extSignal.isAnimating || 
          (extSignal.processed && Date.now() - (extSignal.completedTime || 0) < 30000);
      });
      
      // Se temos sinais ativos, n??o atualizar agora
      if (hasActiveSignals) {
        return;
      }
      
      // Verificar se temos sinais n??o processados que j?? expiraram
      const hasExpiredUnprocessed = existingSignals.some(signal => {
        if (signal.processed || !signal.entry_time) return false;
        
        const [entryHour, entryMin] = String(signal.entry_time).split(':').map(Number);
        const expiryDate = new Date();
        expiryDate.setHours(entryHour, entryMin + 16, 0, 0);
        return now > expiryDate;
      });
      
      // Se n??o temos sinais expirados, tentar atualizar s?? a cada 20 minutos
      if (!hasExpiredUnprocessed && 
          currentTimestamp - internalState.lastUpdateTimestamp < 20 * 60 * 1000) {
          return;
      }
      
      // Atualizar timestamp interno
      internalState.lastUpdateTimestamp = currentTimestamp;
      
      try {
        // Tentar obter novos sinais relevantes
        const currentSignals = await getDailySignalsForCurrentTime();
      
        // Verificar se s??o realmente diferentes antes de atualizar a UI
        const newSignalIDs = currentSignals.map(s => s.id).join(',');
        
        if (newSignalIDs === internalState.lastSignalIDs) {
          return;
        }
        
        // Salvar IDs para pr??xima compara????o
        internalState.lastSignalIDs = newSignalIDs;
        
        // Verificar se algum dos sinais atuais est?? em processo de anima????o
        const processingSignals = existingSignals.filter(s => {
          const extSignal = s as ExtendedSignal;
          return extSignal.isAnimating || (extSignal.processed && Date.now() - (extSignal.completedTime || 0) < 30000);
        });
        
        // Se temos sinais sendo animados/processados, n??o atualizar agora
        if (processingSignals.length > 0) {
          return;
        }
        
        setTimeout(() => {
          safeSetTradingSignals(currentSignals);
        }, 500);
      } catch {
        // ignorar erros de atualização
      }
    };
    
    // Intervalo muito mais longo (a cada 5 minutos) para reduzir drasticamente atualiza????es
    const intervalId = setInterval(silentUpdateSignalsIfNeeded, 5 * 60 * 1000);
    
    // Primeira verifica????o ap??s 60 segundos da montagem (dar tempo para UI inicializar)
    const initialTimeoutId = setTimeout(silentUpdateSignalsIfNeeded, 60000);
    
    return () => {
      clearInterval(intervalId);
      clearTimeout(initialTimeoutId);
    };
  }, [getDailySignalsForCurrentTime, queryClient, safeSetTradingSignals]);

  // Atualizar o horário atual a cada minuto — sem currentTime nas deps para não recriar interval
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(prev => {
        const sameMinute =
          prev.getHours() === now.getHours() &&
          prev.getMinutes() === now.getMinutes();
        return sameMinute ? prev : now;
      });
    };

    const timeInterval = setInterval(updateTime, 60000);
    updateTime();

    return () => clearInterval(timeInterval);
  }, []); // sem deps: interval estável durante toda a vida do componente

  // Dados para sinais quando n??o h?? dados suficientes dispon??veis
  const placeholderSignals: PlaceholderSignal[] = useMemo(() => {
    // Gerar sinais di??rios para o dia todo e pegar os 3 primeiros
    const dailySignals = generateDailySignals();
    const now = new Date();
    
    // Ordenar por hor??rio de entrada
    dailySignals.sort((a, b) => {
      const timeA = convertTimeStringToDate(a.entry_time);
      const timeB = convertTimeStringToDate(b.entry_time);
      
      // Priorizar sinais que ainda n??o aconteceram
      const aInFuture = timeA.getTime() > now.getTime();
      const bInFuture = timeB.getTime() > now.getTime();
      
      if (aInFuture && !bInFuture) return -1;
      if (!aInFuture && bInFuture) return 1;
      
      // Se ambos s??o futuros ou ambos j?? passaram, pegar o mais pr??ximo
      return Math.abs(timeA.getTime() - now.getTime()) - Math.abs(timeB.getTime() - now.getTime());
    });
    
    // Retornar no m??ximo 3 sinais
    return dailySignals.slice(0, 3) as PlaceholderSignal[];
  }, [generateDailySignals, convertTimeStringToDate]);

  // Ref para comparação sem colocar dashboardSignals nas deps (evita recriar interval)
  const dashboardSignalsRef = useRef(dashboardSignals);
  useEffect(() => { dashboardSignalsRef.current = dashboardSignals; }, [dashboardSignals]);

  // Buscar os sinais da dashboard — interval estável, sem dashboardSignals nas deps
  useEffect(() => {
    const fetchDashboardSignals = () => {
      try {
        const cachedSignalsData = localStorage.getItem('dashboardSignals');
        if (cachedSignalsData) {
          const { signals } = JSON.parse(cachedSignalsData);
          if (signals && Array.isArray(signals) && signals.length > 0) {
            const limitedSignals = signals.slice(0, 3);
            const formattedSignals = limitedSignals.map(signal => ({
              ...signal,
              id: signal.id || 'dashboard-' + Math.random().toString(36).substring(2, 9),
              status: 'active',
              success_rate: Math.min(signal.success_rate || 0.85, 0.934),
              isDashboard: true
            }));

            const current = dashboardSignalsRef.current;
            const hasChanged = !current ||
              current.length !== formattedSignals.length ||
              formattedSignals.some((signal, index) => {
                const c = current[index];
                return !c || c.id !== signal.id || c.entry_time !== signal.entry_time || c.symbol !== signal.symbol;
              });

            if (hasChanged) {
              setDashboardSignals(formattedSignals);
            }
            return;
          }
        }

        // Se não há dados no localStorage mas já temos dados no state, manter o state
        // Não limpar agressivamente - esperar dados frescos
      } catch {
        // Manter estado atual em caso de erro de parse
      }
    };

    fetchDashboardSignals();
    const initTimeout = setTimeout(fetchDashboardSignals, 1000);
    const interval = setInterval(fetchDashboardSignals, 5000);

    return () => {
      clearTimeout(initTimeout);
      clearInterval(interval);
    };
  }, [queryClient]); // interval estável: não recria quando dashboardSignals muda

  // Fun????o para verificar e evitar sinais com hor??rios duplicados
  const validateUniqueEntryTimes = useCallback((signals: TradingSignal[]): TradingSignal[] => {
    if (!signals || signals.length < 2) return signals;
    
    // Filtrar os sinais que n??o cont??m "binance" no nome
    const filteredSignals = signals.filter(signal => 
      !signal.symbol.toLowerCase().includes('binance') &&
      !String(signal.exchange || '').toLowerCase().includes('binance')
    );
    
    // Separar os sinais da dashboard (os primeiros 3) e garantir que mantemos seus hor??rios originais
    const dashboardSignals = filteredSignals
      .filter(s => (s as ExtendedSignal).isDashboard === true)
      .filter(s => !s.symbol.toLowerCase().includes('binance'))
      .slice(0, 3); // Limitar a exatamente 3
    
    // Se n??o temos sinais da dashboard suficientes, retornar os sinais como est??o
    if (dashboardSignals.length < 3) {
      return filteredSignals.slice(0, 7);
    }
    
      
    // Obter o terceiro sinal da dashboard para calcular os hor??rios dos sinais complementares
    const thirdDashboardSignal = dashboardSignals[2];
    const thirdSignalEntryTime = thirdDashboardSignal.entry_time;
    
    
    // Fun????o para calcular pr??ximo hor??rio seguindo padr??o 03,23,43
    const calculateNextPatternTime = (previousTime: string): string => {
      const [hour, minute] = previousTime.split(':').map(Number);
      let nextHour = hour;
      let nextMinute: number;
      
      if (minute < 3 || minute === 3) {
        nextMinute = 23;
      } else if (minute < 23 || minute === 23) {
        nextMinute = 43;
    } else {
        // minute >= 43, pr??ximo ?? XX+1:03
        nextHour = (hour + 1) % 24;
        nextMinute = 3;
      }
      
      return `${nextHour.toString().padStart(2, '0')}:${nextMinute.toString().padStart(2, '0')}`;
    };
    
    // Calcular hor??rios dos 4 sinais complementares
    const complementaryTimes: string[] = [];
    
    // 4?? sinal: 20 minutos ap??s o 3?? da dashboard
    const fourthSignalTime = calculateNextTime(String(thirdSignalEntryTime), 20);
    complementaryTimes.push(fourthSignalTime);
    
    // 5?? sinal: seguindo padr??o baseado no 4??
    const fifthSignalTime = calculateNextPatternTime(fourthSignalTime);
    complementaryTimes.push(fifthSignalTime);
    
    // 6?? sinal: seguindo padr??o baseado no 5??
    const sixthSignalTime = calculateNextPatternTime(fifthSignalTime);
    complementaryTimes.push(sixthSignalTime);
    
    // 7?? sinal: seguindo padr??o baseado no 6??
    const seventhSignalTime = calculateNextPatternTime(sixthSignalTime);
    complementaryTimes.push(seventhSignalTime);
    
    
    // Criar conjunto de s??mbolos j?? usados para evitar duplicatas
    const usedSymbols = new Set(dashboardSignals.map(s => s.symbol));
    
    // Coletar sinais n??o-dashboard ??nicos para os sinais complementares
    const additionalSignals: TradingSignal[] = [];
    const nonDashboardSignals = filteredSignals
      .filter(s => (s as ExtendedSignal).isDashboard !== true)
      .filter(s => !usedSymbols.has(s.symbol) && !s.symbol.toLowerCase().includes('binance'));
    
    // Adicionar sinais ??nicos at?? ter 4 sinais complementares
    for (const signal of nonDashboardSignals) {
      if (additionalSignals.length >= 4) break;
      if (!usedSymbols.has(signal.symbol)) {
        additionalSignals.push(signal);
        usedSymbols.add(signal.symbol);
      }
    }
    
    // Se ainda n??o temos sinais suficientes, gerar novos com ativos ??nicos
    if (additionalSignals.length < 4) {
      const availableAssetNames = getAllAssetNames()
        .filter(asset => 
          ALLOWED_SET.has(asset) &&
          !asset.toLowerCase().includes('binance') && 
          isAssetAvailableForSignal(asset) && 
          !usedSymbols.has(asset) &&
          true
        );
      
      // Embaralhar a lista para variedade
      const shuffledAssets = availableAssetNames.sort(() => Math.random() - 0.5);
      
      // Adicionar novos sinais at?? completar 4 sinais complementares
      for (let i = additionalSignals.length; i < 4 && shuffledAssets.length > 0; i++) {
        const assetName = shuffledAssets.shift()!;
        
        const newSignal = createBasePlaceholderData({
          id: `complementary-signal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          symbol: assetName,
          exchange: ATIVOS_CATEGORIAS[assetName] || inferExchangeCategory(assetName),
          signal: Math.random() > 0.5 ? 'BUY' : 'SELL'
        });
        
        additionalSignals.push(newSignal);
        usedSymbols.add(assetName);
      }
    }
    
    // Aplicar os hor??rios calculados aos sinais complementares
    const fixedComplementarySignals: TradingSignal[] = [];
    
    for (let i = 0; i < Math.min(additionalSignals.length, 4); i++) {
      const signal = additionalSignals[i];
      const entryTime = complementaryTimes[i];
      
      // Calcular os hor??rios de expira????o e reentradas
      const expiryTime = calculateNextTime(entryTime, SIGNAL_EXPIRY_TIME);
      const gale1Time = expiryTime;
      const gale2Time = calculateNextTime(gale1Time, SIGNAL_EXPIRY_TIME);
      
      // Criar o sinal com os hor??rios corretos
      const updatedSignal = {
        ...signal,
        id: signal.id || `complementary-signal-${i}-${Date.now()}`,
        entry_time: entryTime,
        expiry_time_str: expiryTime,
        gale1_time: gale1Time,
        gale2_time: gale2Time,
        exchange: ATIVOS_CATEGORIAS[signal.symbol] || inferExchangeCategory(signal.symbol)
      };
      
      fixedComplementarySignals.push(updatedSignal);
    }
    
    // Combinar sinais da dashboard (mantendo hor??rios originais) + sinais complementares (com novos hor??rios)
    const finalSignals = [...dashboardSignals, ...fixedComplementarySignals].slice(0, 7);
    
    // Log para depura????o
    
    // Verificar se n??o h?? duplicatas de ativos
    const assetOccurrences = new Map();
    finalSignals.forEach((signal, idx) => {
      const asset = signal.symbol;
      assetOccurrences.set(asset, (assetOccurrences.get(asset) || 0) + 1);
    });
    
    const duplicatedAssets = Array.from(assetOccurrences.entries()).filter(([_, count]) => count > 1);
    
    if (duplicatedAssets.length > 0) {
      // Ativos duplicados detectados, mas continuando processamento
    } else {
      // Nenhuma duplicação encontrada
    }
    
    return finalSignals;
  }, [calculateNextTime, createBasePlaceholderData]);

  // Cache local para os 4 ??ltimos sinais
  const lastFourSignalsCache = useRef<{
    signals: TradingSignal[],
    timestamp: number,
    isValid: boolean
  }>({
    signals: [],
    timestamp: 0,
    isValid: false
  });

  // Fun????o auxiliar para calcular o pr??ximo hor??rio seguindo o padr??o XX:03, XX:23, XX:43
  const calculateNextTimeInPattern = useCallback((currentTime: string): string => {
    const [hours, minutes] = currentTime.split(':').map(Number);
    let newHours = hours;
    let newMinutes = minutes;
    
    // Avan??ar para o pr??ximo hor??rio na sequ??ncia correta
    if (newMinutes === 3) {
      newMinutes = 23; // 03 -> 23 (mesma hora)
    } else if (newMinutes === 23) {
      newMinutes = 43; // 23 -> 43 (mesma hora)
    } else if (newMinutes === 43) {
      newMinutes = 3; // 43 -> 03 (pr??xima hora)
      newHours = (newHours + 1) % 24;
    }
    
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
  }, []);

  // Fun????o para ajustar hor??rio para seguir o padr??o 19:23, 19:43, 20:03, etc.
  const adjustToTimePattern = useCallback((timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    let newHours = hours;
    
    // O primeiro hor??rio ?? sempre 19:23, seguido por incrementos de 20 minutos
    // Encontrar qual o hor??rio base mais pr??ximo do atual 
    // Padr??o: XX:03, XX:23, XX:43 (minutos 3, 23, 43)
    let baseMinute = 3;
    
    if (minutes > 3) {
      if (minutes > 23) {
        if (minutes > 43) {
          // Se j?? passamos de 43, avan??o para 03 da pr??xima hora
          baseMinute = 3;
          newHours = (hours + 1) % 24;
        } else {
          baseMinute = 43;
        }
      } else {
        baseMinute = 23;
      }
    }
    
    return `${newHours.toString().padStart(2, '0')}:${baseMinute.toString().padStart(2, '0')}`;
  }, []);

  // ??????? FUN????O PRESERVATIVA: Garantir 7 sinais preservando os existentes
  const ensureSevenSignals = useCallback((inputSignals: TradingSignal[]): TradingSignal[] => {
    return ensureSevenSignalsPreservative(inputSignals as PlaceholderSignal[]);
  }, [ensureSevenSignalsPreservative]);

  // Memorizar os IDs dos sinais para evitar recria????o quando apenas a ordem muda
  const signalIds = useMemo(() => {
    return signals ? signals.map(s => s.id).join('|') : '';
  }, [signals]);
  
  // Filtragem de sinais por tipo
  const filteredSignals = useMemo(() => {
    if (!signals) return ensureSevenSignals([]);
    
// ? FAST PATH: Se temos 7 sinais v?lidos do useExtendedSignals, apenas ordenar por position e retornar
    if (signals.length === 7) {
      const allValid = signals.every(s => s.symbol && s.entry_time && s.id);
      if (allValid) {
        const ordered = [...signals].sort((a, b) => {
          const posA = (a as PlaceholderSignal & { position?: number }).position || 0;
          const posB = (b as PlaceholderSignal & { position?: number }).position || 0;
          return posA - posB;
        });
        return ordered;
      }
    }
    

    // FILTRO GLOBAL DE SEGURAN??A: Remover QUALQUER sinal com "binance" ou hor??rios incorretos
    const safeSignals = signals.filter(signal => {
      // Verificar se cont??m "binance" (case insensitive)
      const symbolLower = (signal.symbol || '').toLowerCase();
      const exchangeLower = (signal.exchange || '').toLowerCase();
      
      if (symbolLower.includes('binance') || exchangeLower.includes('binance')) {
        return false;
      }
      
      // Verificar se o hor??rio segue o padr??o correto (XX:03, XX:23, XX:43)
      const entryTime = signal.entry_time || '';
      if (entryTime) {
        const [_, minutes] = entryTime.split(':').map(Number);
        const validMinutes = [3, 23, 43];
        
        if (!validMinutes.includes(minutes)) {
          return false;
        }
      }
      
      return true;
    });
    
    // VERIFICA????O DE DUPLICATAS: Detectar hor??rios ou ativos repetidos
    const timeCount = new Map();
    const assetCount = new Map();
    
    safeSignals.forEach(signal => {
      const time = signal.entry_time;
      const asset = signal.symbol;
      
      timeCount.set(time, (timeCount.get(time) || 0) + 1);
      assetCount.set(asset, (assetCount.get(asset) || 0) + 1);
    });
    
    const hasDuplicateTime = Array.from(timeCount.values()).some(count => count > 1);
    const hasDuplicateAsset = Array.from(assetCount.values()).some(count => count > 1);
    
    if (hasDuplicateTime || hasDuplicateAsset) {
      
      // For??ar regenera????o com sinais ??nicos
      return ensureSevenSignals(safeSignals);
    }
    
    
    // Usar a fun????o ensureSevenSignals para garantir:
    // 1. Os 3 primeiros sinais ser??o sempre da dashboard
    // 2. Os 4 sinais restantes ter??o hor??rios no padr??o XX:03, XX:23, XX:43
    // 3. Os sinais ser??o organizados em ordem crescente de hor??rio de entrada
    // 4. N??o haver?? sinais repetidos com o mesmo hor??rio
    // 5. Haver?? exatamente 7 sinais no total
    
    // Verificar se temos exatamente 3 sinais da dashboard
    if (dashboardSignals.length < 3) {
      // Menos de 3 sinais da dashboard, mas continuando
    } else if (dashboardSignals.length > 3) {
      // Mais de 3 sinais da dashboard, serão limitados
    }
    
    // For??ar o uso expl??cito dos sinais da dashboard como os 3 primeiros, limitando a exatamente 3
    let originalSignals = safeSignals as TradingSignal[];
    
    // Se temos sinais da dashboard, garantir que sejam exatamente os 3 primeiros
    if (dashboardSignals.length > 0) {
             // Limitar a dashboard para exatamente 3 sinais e aplicar filtros de seguran??a
       const limitedDashboardSignals = dashboardSignals
         .filter(signal => {
           const symbolLower = (signal.symbol || '').toLowerCase();
           const exchangeLower = String(signal.exchange || '').toLowerCase();
           return !symbolLower.includes('binance') && !exchangeLower.includes('binance');
         })
         .slice(0, 3)
         .map(signal => {
           // Garantir que o sinal tenha todas as propriedades necess??rias
           const safeCopy = { ...signal } as ExtendedSignal;
           safeCopy.exchange = inferExchangeCategory(signal.symbol); // Usar categoria correta
           safeCopy.isDashboard = true; // Marcar explicitamente como sinal da dashboard
           return safeCopy;
         });
      
      // Remover da lista original quaisquer sinais que tenham os mesmos IDs dos da dashboard
      const dashboardIds = new Set(limitedDashboardSignals.map(s => String(s.id)));
      originalSignals = originalSignals.filter(s => !dashboardIds.has(String(s.id)));
      
      // Adicionar os sinais da dashboard (limitados a 3) no in??cio da lista
      originalSignals = [...limitedDashboardSignals, ...originalSignals];
      
    }
    
    const finalSignals = ensureSevenSignals(originalSignals);
    
    // Garantir que todos os sinais tenham propriedades consistentes e exchange correto
    const processedSignals: TradingSignal[] = finalSignals.map((signal, idx) => {
      return {
        ...signal,
        status: signal.status || 'active',
        id: signal.id || `signal-${idx}`,
        exchange: inferExchangeCategory(signal.symbol)
      } as TradingSignal;
    });
    
    return processedSignals;
  }, [signals, dashboardSignals, ensureSevenSignals]);

  // Salvar cache FORA do useMemo (nunca chamar side-effects durante render)
  useEffect(() => {
    if (filteredSignals && filteredSignals.length >= 4) {
      saveSignalsToNavigationCache(filteredSignals as PlaceholderSignal[]);
    }
  }, [filteredSignals]);

  // Memoizar array para evitar novo objeto a cada render
  const signalsForNotifications = useMemo<TradingSignal[]>(() =>
    (filteredSignals ?? []).map(signal => ({
      ...signal,
      timestamp: typeof signal.timestamp === 'string' ? new Date(signal.timestamp).getTime() : Date.now(),
      pair: signal.symbol || signal.pair || signal.symbol,
      symbol: signal.symbol || signal.pair,
      entry_time: signal.entry_time || '00:00'
    })) as TradingSignal[],
    [filteredSignals]
  );

  const { upcomingSignals, notificationsEnabled } = useSignalNotifications(
    signalsForNotifications,
    {
      notifyMinutesBefore: 5,
      enabled: true,
      notificationType: 'signals'
    }
  );

  // Pagina????o
  const indexOfLastSignal = activePage * signalsPerPage;
  const indexOfFirstSignal = indexOfLastSignal - signalsPerPage;
  const paginatedSignals = filteredSignals.slice(indexOfFirstSignal, indexOfLastSignal);
  const totalPages = Math.ceil(filteredSignals.length / signalsPerPage);

  // Fun????o para lidar com a atualiza????o de dados de forma segura
  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    try {
      // Verificar se h?? uma sess??o ativa antes de atualizar
      const supabaseSession = localStorage.getItem('supabase.auth.token');
      if (!supabaseSession) {
        return;
      }
      
      setIsRefreshing(true);
      
      // Verificar se temos sinais atuais antes de atualizar
      const currentSignals = queryClient.getQueryData<TradingSignal[]>(['tradingSignals']);
      if (!currentSignals || currentSignals.length === 0) {
        
        // Gerar sinais localmente em vez de buscar do servidor
        const newSignals = generateDailySignals().slice(0, 7);
        safeSetTradingSignals(newSignals);
      } else {
        // Se temos sinais atuais, atualizar normalmente
        await refetch();
      }
      
      // Sempre atualizar pre??os
      await updatePrices();
    } catch (error) {
      // Erro ao atualizar, ignorar silenciosamente
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  // Fun????o para atualizar pre??os
  const updatePrices = useCallback(async () => {
    try {
      const currentSignals = queryClient.getQueryData<TradingSignal[]>(['tradingSignals']);
      
      if (!currentSignals || currentSignals.length === 0) return;
      
      // Extrair s??mbolos ??nicos para os quais precisamos de pre??os
      const symbols = [...new Set(currentSignals.map(s => s.symbol))];
      
      // Buscar pre??os atualizados
      const prices = await getLatestPrices(symbols);
      
      if (!prices || prices.length === 0) return;
      
      // Atualizar pre??os nos sinais
      const updatedSignals = currentSignals.map(signal => {
        const price = prices.find(p => p.symbol === signal.symbol)?.price;
        
        if (price) {
          // Garantir coer??ncia de tipos: TradingSignal espera `price` como number
          const normalizedPrice = typeof price === 'number' ? price : parseFloat(String(price));
          return {
            ...signal,
            currentPrice: String(normalizedPrice),
            price: normalizedPrice
          } as TradingSignal;
        }
        
        return signal;
      });
      
      // Atualizar no cache
      safeSetTradingSignals(updatedSignals);
      
      // Atualizar pre??os anteriores
      setPreviousPrices(prev => {
        const newPrices: Record<string, string> = {...prev};
        
      prices.forEach(price => {
        if (price.symbol && price.price) {
            newPrices[price.symbol] = price.price.toString();
        }
      });
      
        return newPrices;
      });
    } catch (error) {
      // Erro ao atualizar preços, ignorar silenciosamente
    }
  }, [queryClient, safeSetTradingSignals]);

  // Fun????es auxiliares para exibir informa????es do sinal
  const getPriceChange = (symbol: string): 'up' | 'down' | 'equal' => {
    if (!previousPrices[symbol] || !currentPrices[symbol]) return 'equal';
    
    const prev = parseFloat(previousPrices[symbol]);
    const curr = parseFloat(currentPrices[symbol]);
    
    if (curr > prev) return 'up';
    if (curr < prev) return 'down';
    return 'equal';
  };

  const isExpiringSignal = (signal: TradingSignal): boolean => {
    const expiry = new Date(signal.expiry);
    const now = new Date();
    const timeLeft = expiry.getTime() - now.getTime();
    return timeLeft > 0 && timeLeft < 10 * 60 * 1000; // Menos de 10 minutos
  };

  const formatExpiry = (expiry: string): string => {
    try {
      const now = new Date();
      const expiryDate = parse(expiry, "HH:mm", new Date());
      
      // Se expira em menos de 24 horas
      if (expiryDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000) {
        return `${t('signals.expires')} ${formatDistanceToNow(expiryDate, { addSuffix: true, locale: ptBR })}`;
      }
      
      // Se expira em mais de 24 horas
      return `${t('signals.expires')} ${format(expiryDate, "dd 'de' MMM", { locale: ptBR })}`;
    } catch (error) {
      return t('signals.invalid.date') || "Data inv??lida";
    }
  };

  const getStrengthColor = (strength: SignalStrengthEnum) => {
    switch (strength) {
      case SignalStrength.VERY_STRONG:
        return "text-green-200";
      case SignalStrength.STRONG:
        return "text-blue-200";
      case SignalStrength.MODERATE:
        return "text-yellow-200";
      case SignalStrength.WEAK:
        return "text-yellow-200"; // Mesmo para WEAK, usar a cor de MODERATE
      default:
        return "text-yellow-200";
    }
  };

  const getStrengthText = (strength: SignalStrengthEnum) => {
    switch (strength) {
      case SignalStrength.VERY_STRONG:
        return t('signals.strength.very_strong');
      case SignalStrength.STRONG:
        return t('signals.strength.strong');
      case SignalStrength.MODERATE:
        return t('signals.strength.moderate');
      case SignalStrength.WEAK:
        return t('signals.strength.weak');
      default:
        return t('signals.strength.moderate');
    }
  };

  // Substituir a verifica????o de sinal expirando pelo formato da taxa de sucesso
  const formatSuccessRate = (rate: number): string => {
    // Garantir que a taxa est?? entre 77% e 100%
    const validRate = Math.min(Math.max(rate || 0.77, 0.77), 1.0);
    // Formata????o com uma casa decimal
    return `${(validRate * 100).toFixed(1)}%`;
  };

  // Efeito para limpar cache antigo na inicializa????o
  useEffect(() => {
    // Verificar se h?? sinais em cache e se est??o desatualizados
    const cachedSignalsData = localStorage.getItem('dailyTradingSignals');
    const cachedDate = localStorage.getItem('dailyTradingSignalsDate');
    
    if (cachedSignalsData && cachedDate) {
      const cacheTime = new Date(cachedDate).getTime();
      const now = new Date().getTime();
      const cacheAgeHours = (now - cacheTime) / (1000 * 60 * 60);
      
      // Se o cache for mais antigo que 1 hora, limpar
      if (cacheAgeHours > 1) {
        localStorage.removeItem('dailyTradingSignals');
        localStorage.removeItem('dailyTradingSignalsDate');
      }
    }
    
    // Tamb??m limpar localStorage do dashboard se estiver desatualizado
    const dashboardData = localStorage.getItem('dashboardSignals');
    if (dashboardData) {
      try {
        const { timestamp } = JSON.parse(dashboardData);
        const age = (Date.now() - timestamp) / (1000 * 60 * 60);
        
        if (age > 1) {
          localStorage.removeItem('dashboardSignals');
        }
      } catch (e) {
        // Em caso de erro ao analisar, melhor limpar
        localStorage.removeItem('dashboardSignals');
      }
    }
  }, [resultCounter]);
  
  // Fun????o para gerar resultado seguindo a propor????o 4:1 (agora com implementa????o fixada)
  const generateResultWithRatio = useCallback((): 'win' | 'loss' => {
    // Incrementar contador e retornar 'loss' a cada 5 sinais (no 5?? sinal)
    const nextCounter = (resultCounter + 1) % WIN_LOSS_RATIO;
    setResultCounter(nextCounter);
    return nextCounter === 0 ? 'loss' : 'win';
  }, [resultCounter]);
  
  // Fun????o que verifica sinais expirados - Movida antes de sua utiliza????o
  const checkExpiredSignals = useCallback(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();
    
    // Formato de hora atual para compara????es precisas
    const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:${currentSecond.toString().padStart(2, '0')}`;
    
          // Verificando sinais expirados
    
    // Verificar os sinais atuais
    queryClient.getQueryData<TradingSignal[]>(['tradingSignals'])?.forEach(signal => {
      const typedSignal = signal as PlaceholderSignal;
      
      // Se o sinal j?? foi processado ou n??o tem entrada, ignorar
      if (typedSignal.processed || !typedSignal.entry_time) return;
      
      // Extrair hor??rio de entrada
      const [entryHour, entryMin] = typedSignal.entry_time.split(':').map(Number);
      
      // Calcular hor??rio de anima????o (exatamente 16 minutos ap??s a entrada)
      let animationHour = entryHour;
      let animationMinute = entryMin + 16;
      
      // Ajustar para hora seguinte se necess??rio
      if (animationMinute >= 60) {
        animationHour = (animationHour + 1) % 24;
        animationMinute = animationMinute - 60;
      }
      
      // Formatar o hor??rio de anima????o
      const animationTime = `${animationHour.toString().padStart(2, '0')}:${animationMinute.toString().padStart(2, '0')}`;
      
      // Verificar se o hor??rio atual ?? igual ou posterior ao hor??rio de anima????o
      const isAnimationTime = 
        (currentHour > animationHour) || 
        (currentHour === animationHour && currentMinute >= animationMinute);
      
      if (isAnimationTime && !typedSignal.isAnimating && !typedSignal.processed) {
        // Sinal atingiu o tempo para anima????o
       
        // Gerar resultado (4 ganhos para 1 perda)
        setWinLossCounter(prev => (prev + 1) % 5);
        const result = winLossCounter === 4 ? 'failure' : 'success';
        
        // Buscar todos os sinais atuais
        const currentSignals = queryClient.getQueryData<TradingSignal[]>(['tradingSignals']);
        if (!currentSignals) return;
        
        // Atualizar o sinal com isAnimating=true e result
        const updatedSignals = currentSignals.map(s => {
          if (s.id === typedSignal.id) {
            return {
              ...s,
              isAnimating: true,
              result,
            };
          }
          return s;
        });
        
        // Atualizar o cache com os sinais atualizados
        safeSetTradingSignals(updatedSignals);
        
        // Ap??s 3 segundos, remover a anima????o e processar o sinal
        setTimeout(() => {
          const signalsWithoutAnimation = queryClient.getQueryData<TradingSignal[]>(['tradingSignals'])?.map(s => {
            if (s.id === typedSignal.id) {
              return {
                ...s,
                isAnimating: false,
                processed: true,
              };
            }
            return s;
          });
          
          if (signalsWithoutAnimation) {
            safeSetTradingSignals(signalsWithoutAnimation);
           
           // Ap??s 1 segundo, rotacionar os sinais
           setTimeout(() => {
                           // Rotacionando sinais ap??s anima????o
            
            // Rotacionar sinais
            const signalsAfterRotation = rotateSignals(signalsWithoutAnimation);
            
            // Atualizar o cache com os sinais rotacionados
            safeSetTradingSignals(signalsAfterRotation);
           }, 1000);
          }
        }, 3000);
      }
    });
  }, [queryClient, rotateSignals, winLossCounter, setWinLossCounter, safeSetTradingSignals]);
  
  // Atualiza????o peri??dica MUITO menos frequente, apenas quando realmente necess??rio
  useEffect(() => {
    // Fun????o de verifica????o interna sem atualiza????o visual
    const silentBackgroundCheck = () => {
      try {
        // Verificar se h?? uma sess??o ativa antes de fazer qualquer verifica????o
        const supabaseSession = localStorage.getItem('supabase.auth.token');
        if (!supabaseSession) {
          return;
        }
        
        const now = Date.now();
        const state = stateRef.current;
        
        // Evitar atualiza????es sobrepostas - IMPORTANTE
        if (state.isUpdating) return;
        
        // Verificar sinais expirados a cada 15 minutos (aumento do intervalo para reduzir atualiza????es)
        if (now - state.lastCheckTime > 15 * 60 * 1000) {
          // Verificar em sil??ncio
          state.lastCheckTime = now;
          
          // S?? verificar se houver sinais n??o processados
          const currentSignals = queryClient.getQueryData<TradingSignal[]>(['tradingSignals']) || [];
          
          // Se n??o temos sinais, n??o fazer nada
          if (!currentSignals || currentSignals.length === 0) {
            return;
          }
          
          // Verificar se temos algum sinal que precisa ser verificado
          const hasUnprocessedSignals = currentSignals.some(signal => 
            !signal.processed && signal.entry_time);
          
          if (hasUnprocessedSignals) {
            // Usar um lock para evitar atualiza????es simult??neas
            state.isUpdating = true;
            
            // S?? verificar quando realmente necess??rio
            checkExpiredSignals();
            
            // Liberar o lock ap??s 10 segundos (tempo seguro para completar opera????es)
            setTimeout(() => {
              state.isUpdating = false;
            }, 10000);
          }
        }
        
        // Atualizar pre??os muito menos frequentemente (a cada 20 minutos)
        if (now - state.lastPriceUpdate > 20 * 60 * 1000) {
          state.lastPriceUpdate = now;
          
          // Verificar se temos sinais antes de atualizar pre??os
          const currentSignals = queryClient.getQueryData<TradingSignal[]>(['tradingSignals']) || [];
          if (currentSignals && currentSignals.length > 0) {
            updatePrices();
          }
        }
      } catch (error) {
        // Erro na verificação silenciosa, ignorar
      }
    };
    
    // Verificar silenciosamente com frequ??ncia muito reduzida (10 minutos) 
    const autoUpdateInterval = setInterval(silentBackgroundCheck, 10 * 60 * 1000);
    
    // Limpar intervalo ao desmontar componente
    return () => clearInterval(autoUpdateInterval);
  }, [queryClient, resultCounter, checkExpiredSignals, updatePrices]);
  
  // Configurar atualiza????o completa de dados a cada 20 minutos em vez de 5 minutos
  useEffect(() => {
    // Fun????o para buscar e atualizar sinais completos com prote????o contra updates simult??neos e redirecionamentos
    const fetchAndUpdateSignals = async () => {
      try {
        // Verificar se h?? uma sess??o ativa antes de atualizar
        const supabaseSession = localStorage.getItem('supabase.auth.token');
        if (!supabaseSession) {
          return;
        }
        
        // Evitar atualiza????es sobrepostas
        if (updateLockRef.current.isUpdating) {
          return;
        }
        
        // Evitar atualiza????es muito frequentes (m??nimo 45 minutos entre updates)
        const now = Date.now();
        const timeSinceLastUpdate = now - updateLockRef.current.lastUpdateTime;
        if (timeSinceLastUpdate < 45 * 60 * 1000) {
          return;
        }
        
        // Verificar se a p??gina est?? vis??vel - se estiver minimizada, n??o atualizar
        if (document.hidden) {
          return;
        }
        
        // Obter sinais atuais
        const currentSignals = queryClient.getQueryData<TradingSignal[]>(['tradingSignals']) || [];
        
        // Se n??o temos sinais atuais, gerar localmente em vez de buscar do servidor
        if (!currentSignals || currentSignals.length === 0) {
          
          // Gerar sinais localmente
          const newSignals = generateDailySignals().slice(0, 7);
          safeSetTradingSignals(newSignals);
          return;
        }
        
        // Verificar se temos algum sinal em processamento/anima????o
        const hasActiveSignals = currentSignals.some(signal => {
          const extSignal = signal as ExtendedSignal;
          return extSignal.isAnimating === true || 
            (extSignal.processed && Date.now() - (extSignal.completedTime || 0) < 30000);
        });
        
        // Se temos anima????es ou processamentos ativos, adiar a atualiza????o
        if (hasActiveSignals) {
          return;
        }
        
        // Ativar lock
        updateLockRef.current.isUpdating = true;
        updateLockRef.current.lastUpdateTime = now;
        
        try {
          
          // Verificar se os sinais atuais t??m hor??rios v??lidos
          const hasValidTimes = currentSignals.every(signal => {
            if (!signal.entry_time) return false;
            
            // Verificar se o hor??rio segue o padr??o XX:23, XX:43, XX:03, etc.
            const [_, minutes] = String(signal.entry_time).split(':').map(Number);
            const validMinutes = [3, 23, 43];
            return validMinutes.includes(minutes);
          });
          
          // Se os sinais atuais t??m hor??rios v??lidos, apenas reorganizar e atualizar
          if (hasValidTimes && currentSignals.length === 7) {
            
            // Aplicar fun????o validateUniqueEntryTimes para garantir hor??rios corretos
            const reorganizedSignals = validateUniqueEntryTimes(currentSignals);
            
            // Atualizar cache do React Query com um pequeno delay
            setTimeout(() => {
              safeSetTradingSignals(reorganizedSignals);
            }, 500);
            return;
          }
          
          // Se chegamos aqui, precisamos gerar novos sinais
          
          // Gerar novos sinais com hor??rios corretos
          const newSignals = validateUniqueEntryTimes(generateDailySignals());
          
          // Preservar IDs est??veis sempre que poss??vel
          const preservedSignals = newSignals.map(signal => {
            const matchingSignal = currentSignals.find(s => s.symbol === signal.symbol);
            if (matchingSignal) {
              return {
                ...signal,
                id: matchingSignal.id
              };
            }
            return signal;
          });
          
          // Atualizar cache do React Query com um pequeno delay
          setTimeout(() => {
            safeSetTradingSignals(preservedSignals);
          }, 500);
        } catch (error) {
          // Erro ao atualizar sinais, ignorar
        } finally {
          // Liberar o lock ap??s um delay para garantir que a opera????o foi conclu??da
          setTimeout(() => {
            updateLockRef.current.isUpdating = false;
          }, 5000);
        }
      } catch (error) {
        // Garantir que o lock seja liberado mesmo em caso de erro
        setTimeout(() => {
          if (updateLockRef.current) {
            updateLockRef.current.isUpdating = false;
          }
        }, 5000);
      }
    };
    
    // S?? executar atualiza????o autom??tica se auto-refresh estiver habilitado
    if (!autoRefresh) return;
    
    // Definir intervalo extremamente longo (45 minutos) para atualiza????o autom??tica
    const autoUpdateInterval = setInterval(fetchAndUpdateSignals, 45 * 60 * 1000);
    
    // Primeira execu????o ap??s 5 minutos (dar tempo para interface se estabilizar completamente)
    const initialTimeoutId = setTimeout(fetchAndUpdateSignals, 5 * 60 * 1000);
    
    // Limpar intervalos quando o componente for desmontado
    return () => {
      clearInterval(autoUpdateInterval);
      clearTimeout(initialTimeoutId);
    };
  }, [autoRefresh, queryClient, ensureSevenSignals, generateDailySignals, safeSetTradingSignals, validateUniqueEntryTimes]);

  // ??????? SISTEMA CONSERVATIVO DE NAVEGA????O - S?? atua em casos cr??ticos
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        try {
          // Obter sinais atuais SEM for??ar invalida????o
          const currentSignals = queryClient.getQueryData<TradingSignal[]>(['tradingSignals']) as PlaceholderSignal[];
          
          // Usar sistema conservativo que PRESERVA sinais v??lidos
          handleVisibilityChangeConservative(queryClient, currentSignals);
          
        } catch (error) {
          // Erro ao processar mudança de visibilidade, ignorar
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient, handleVisibilityChangeConservative]);

  // Coment??rio removido pois a fun????o foi movida para antes da ensureSevenSignals

  // Fun????o de rota????o para a p??gina principal de sinais (remove o primeiro e adiciona novo no final)
  const rotateSignalsPage = (currentSignals: TradingSignal[]): TradingSignal[] => {
    // Simplesmente retornar os sinais atuais, sem rota????o
    return currentSignals;
  };
  
  // Fun????o de rota????o para a dashboard (move tudo para cima e adiciona novo no final)
  const rotateDashboardSignals = (currentSignals: TradingSignal[]): TradingSignal[] => {
    // Simplesmente retornar os sinais atuais, sem rota????o
    return currentSignals;
  };

  // Verificar se h?? sinais que expiraram e devem mostrar resultado
  useEffect(() => {
    const checkExpiredSignals = () => {
      // Fun????o desativada conforme solicita????o do cliente
      // N??o mostramos mais os ??cones de resultado (ganho/perda) nos sinais
      return;
    };
    
    // Verificar apenas a cada 5 minutos
    const intervalId = setInterval(checkExpiredSignals, 5 * 60 * 1000);
    // Verificar imediatamente ao montar
    checkExpiredSignals();
    
    return () => clearInterval(intervalId);
  }, [signals, queryClient]);

  // Sistema de verifica????o para rota????o autom??tica a cada 60 segundos
  useEffect(() => {
    
    // Fun????o que verifica se ?? hora de rotacionar os sinais
    const checkSignalRotation = () => {
      try {
        // Obter sinais atuais
        const currentSignals = queryClient.getQueryData<TradingSignal[]>(['tradingSignals']);
        if (!currentSignals || currentSignals.length < 7) {
          return;
        }
        
        // Verificar se o primeiro sinal existe e tem hor??rio de entrada
        const firstSignal = currentSignals[0];
        if (!firstSignal || !firstSignal.entry_time) {
          return;
        }
        
        // Verificar se j?? se passaram 20 minutos desde a entrada do primeiro sinal
        const [entryHour, entryMin] = String(firstSignal.entry_time).split(':').map(Number);
        
        // Sinais sao sempre no horario de Brasilia (GMT-3). Converter BRT -> UTC: UTC = BRT + 3
        const currentTime = new Date();
        const entryTime = new Date(Date.UTC(
          currentTime.getUTCFullYear(),
          currentTime.getUTCMonth(),
          currentTime.getUTCDate(),
          entryHour + 3,
          entryMin,
          0,
          0
        ));
        if (entryTime.getTime() - currentTime.getTime() > 12 * 60 * 60 * 1000) {
          entryTime.setUTCDate(entryTime.getUTCDate() - 1);
        }
        
        // Calcular diferen??a em minutos desde a entrada
        const timeDiffMs = currentTime.getTime() - entryTime.getTime();
        const minutesSinceEntry = Math.floor(timeDiffMs / (1000 * 60));
        
        // Verificar se j?? se passaram 20 minutos
        if (minutesSinceEntry >= 20) {
          
          // Executar a rota????o
          const rotatedSignals = rotateSignals(currentSignals);
          
          // Atualizar os sinais no cache do React Query
          safeSetTradingSignals(rotatedSignals);
        } else {
          // Não é hora de rotacionar ainda
        }
      } catch (error) {
        // Erro na rotação, ignorar
      }
    };
    
    // Verificar a cada 60 segundos
    const rotationCheckInterval = setInterval(checkSignalRotation, 60 * 1000);
    
    // Verificar uma vez na inicializa????o (ap??s 5 segundos para dar tempo de carregar os sinais)
    const initialCheckTimeout = setTimeout(checkSignalRotation, 5 * 1000);
    
    // Limpar intervalo e timeout ao desmontar componente
    return () => {
      clearInterval(rotationCheckInterval);
      clearTimeout(initialCheckTimeout);
    };
  }, [queryClient, rotateSignals, safeSetTradingSignals]);

  // Efeito para limpar cache na inicializa????o se houver hor??rios inconsistentes
  useEffect(() => {
    // Verificar a hora atual para validar sinais em cache
    const now = new Date();
    const currentHour = now.getHours();
    
    // Verificar o localStorage diretamente para problemas
    const cachedSignals = localStorage.getItem('trading-signals-cache');
    const cachedDailySignals = localStorage.getItem('daily-signals-cache');
    
    // Verificar sinais comuns
    if (cachedSignals) {
      try {
        const cachedData = JSON.parse(cachedSignals);
        if (cachedData && cachedData.signals && Array.isArray(cachedData.signals)) {
          // Verificar se h?? sinais com hor??rios inconsistentes
          const hasInvalidTimes = cachedData.signals.some(signal => {
            if (!signal.entry_time) return false;
            
            const [hours] = signal.entry_time.split(':').map(Number);
            const hourDiff = Math.abs(hours - currentHour);
            
            // Se a diferen??a for mais de 2 horas (exceto para sinais programados futuros)
            return hourDiff > 2 && hourDiff < 22; // Considerando ciclo de 24h
          });
          
          // Verificar se h?? n??mero inv??lido de sinais
          const hasInvalidCount = cachedData.signals.length !== 7;
          
          if (hasInvalidTimes || hasInvalidCount) {
            
            // Limpar todos os caches relacionados
            localStorage.removeItem('trading-signals-cache');
            localStorage.removeItem('signals-lastUpdated');
            localStorage.removeItem('daily-signals-cache');
            localStorage.removeItem('dashboard-signals-cache');
            localStorage.removeItem('dashboard-signals-lastUpdated');
            localStorage.removeItem('dashboardSignals');
          }
        }
      } catch (e) {
        // Em caso de erro, limpar cache por seguran??a
        localStorage.removeItem('trading-signals-cache');
        localStorage.removeItem('signals-lastUpdated');
      }
    }
  }, []);

  // ???? SISTEMA AUTOM??TICO DE SALVAMENTO (substituindo limpeza de cache)
  useEffect(() => {
    
    // Tentar recuperar sinais salvos da navega????o anterior
    const savedSignals = loadSignalsFromNavigationCache();
    if (savedSignals && savedSignals.length >= 4) {
      safeSetTradingSignals(savedSignals);
      return;
    }
    
    // Se n??o h?? sinais salvos, sincronizar com dashboard sem limpar cache
    refetch();
  }, [refetch, queryClient, safeSetTradingSignals]);

  // ???? SALVAMENTO IMEDIATO sempre que os sinais mudarem
  useEffect(() => {
    if (filteredSignals && filteredSignals.length >= 7) {
      saveSignalsToNavigationCache(filteredSignals as PlaceholderSignal[]);
    }
  }, [filteredSignals]);

  // Solicitar permiss??o para notifica????es quando a p??gina carregar
  useEffect(() => {
    if (!hasPermission) {
      // Aguardar 2 segundos antes de solicitar permiss??o para n??o ser muito intrusivo
      const timeoutId = setTimeout(() => {
        requestPermission().then(granted => {
          if (granted) {
            // Permissão concedida
          } else {
            // Permissão negada
          }
        });
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
  }, [hasPermission, requestPermission]);

  // SISTEMA DE SINCRONIZA????O DEFINITIVO: 3 sinais da dashboard + 4 sinais adicionais
  useEffect(() => {
    const handleDashboardUpdate = (event: CustomEvent<{ signals: PlaceholderSignal[]; timestamp?: number }>) => {
      
      // VALIDA????O DOS DADOS DO EVENTO
      let eventData = event.detail;
      
      if (!eventData || !eventData.signals || !Array.isArray(eventData.signals)) {
        
        // Fallback para localStorage se evento n??o tem dados v??lidos
        try {
          const dashboardData = localStorage.getItem('dashboardSignals');
          if (dashboardData) {
            const { signals: dashboardSignals } = JSON.parse(dashboardData);
            if (dashboardSignals && dashboardSignals.length >= 3) {
                eventData = { signals: dashboardSignals.slice(0, 3) };
              } else {
                return;
              }
            } else {
              return;
            }
          } catch (error) {
            return;
          }
        }
        
        // Garantir que temos exatamente 3 sinais da dashboard
        const dashboardSignals = eventData.signals.slice(0, 3);
        if (dashboardSignals.length !== 3) {
          return;
        }
        
        // DIAGN??STICO: Verificar os sinais da dashboard
        dashboardSignals.forEach((signal, idx) => {
        });
        
        // NOVA IMPLEMENTA????O DA SINCRONIZA????O COM DASHBOARD
        try {
          
          // Obter sinais atuais
          const currentSignals = queryClient.getQueryData<TradingSignal[]>(['tradingSignals']) || [];
          
          // Verificar se j?? temos sinais e se eles est??o na quantidade correta (7)
          if (currentSignals && currentSignals.length === 7) {
            
            // VERIFICA????O MELHORADA: Comparar s??mbolos e hor??rios para verificar sincroniza????o
            const currentSymbols = currentSignals.slice(0, 3).map(s => s.symbol);
            const newSymbols = dashboardSignals.map(s => s.symbol);
            
            // Verificar se os s??mbolos s??o os mesmos
            const symbolsMatch = currentSymbols.every((symbol, idx) => 
              symbol === newSymbols[idx]
            );
            
            if (symbolsMatch) {
              
              // Verificar se os hor??rios tamb??m s??o id??nticos
              const currentTimes = currentSignals.slice(0, 3).map(s => s.entry_time);
              const newTimes = dashboardSignals.map(s => s.entry_time);
              
              const timesMatch = currentTimes.every((time, idx) => 
                time === newTimes[idx]
              );
              
              if (timesMatch) {
                return; // N??o precisa sincronizar se tudo j?? est?? igual
              }
            }
            
            // Se chegou aqui, ?? porque precisamos sincronizar
            
            // Substituir apenas os 3 primeiros sinais pelos da dashboard
            const updatedSignals = [...currentSignals];
            dashboardSignals.forEach((signal, index) => {
              if (index < 3) {
                updatedSignals[index] = {
                  ...signal,
                  isDashboard: true,
                  dashboardPosition: index
                };
              }
            });
            
            // Salvar sinais atualizados
            safeSetTradingSignals(updatedSignals);
            saveSignalsToNavigationCache(updatedSignals as PlaceholderSignal[]);
            
            // Log detalhado dos sinais sincronizados
            dashboardSignals.forEach((signal, idx) => {
            });
            return;
          }
          
          // Se n??o temos sinais ou quantidade errada, gerar conjunto completo
          
          // 1. Os 3 primeiros sinais s??o IGUAIS aos da dashboard
          const firstThreeSignals = dashboardSignals.map((signal, index) => ({
            ...signal,
            isDashboard: true,
            dashboardPosition: index
          }));
          
          // 2. Gerar 4 sinais adicionais
          // O primeiro dos 4 deve ter 20 minutos de diferen??a do terceiro sinal da dashboard
          const thirdDashboardSignal = dashboardSignals[2];
          if (!thirdDashboardSignal || !thirdDashboardSignal.entry_time) {
            return;
          }
          
          const [hours, minutes] = thirdDashboardSignal.entry_time.split(':').map(Number);
          
          // Calcular hor??rio base: terceiro sinal + 20 minutos
          let baseHour = hours;
          let baseMinute = minutes + 20;
          
          if (baseMinute >= 60) {
            baseMinute -= 60;
            baseHour = (baseHour + 1) % 24;
          }
          
          // Usar fun????o getNextValidTime para garantir hor??rio v??lido (03, 23, 43)
          const baseTime = `${baseHour.toString().padStart(2, '0')}:${baseMinute.toString().padStart(2, '0')}`;
          
          // CORRE????O: Calcular pr??ximo hor??rio v??lido com base no padr??o 03???23???43???03
          let firstAdditionalTime = "";
          if (minutes === 3) {
            // Se o terceiro sinal ?? XX:03, o quarto deve ser XX:23 + 20min = XX+1:43
            firstAdditionalTime = `${((hours + 1) % 24).toString().padStart(2, '0')}:43`;
          } else if (minutes === 23) {
            // Se o terceiro sinal ?? XX:23, o quarto deve ser XX:43 + 20min = XX+1:03
            firstAdditionalTime = `${((hours + 1) % 24).toString().padStart(2, '0')}:03`;
          } else if (minutes === 43) {
            // Se o terceiro sinal ?? XX:43, o quarto deve ser XX+1:03 + 20min = XX+1:23
            firstAdditionalTime = `${((hours + 1) % 24).toString().padStart(2, '0')}:23`;
          } else {
            // Fallback - usar base calculada anteriormente
            firstAdditionalTime = adjustToTimePattern(baseTime);
          }
          
          
          // Gerar os 4 sinais adicionais seguindo padr??o 03???23???43???03
          const additionalSignals: PlaceholderSignal[] = [];
          let currentTime = firstAdditionalTime;
          
          for (let i = 0; i < 4; i++) {
            const expiryTime = calculateNextTime(currentTime, 5);
            const gale1Time = expiryTime;
            const gale2Time = calculateNextTime(expiryTime, 5);
            
            // Usar ativos diferentes dos j?? usados
            const usedSymbols = [...firstThreeSignals, ...additionalSignals].map(s => s.symbol);
            let symbol = getRandomAsset();
            let attempts = 0;
            while (usedSymbols.includes(symbol) && attempts < 10) {
              symbol = getRandomAsset();
              attempts++;
            }
            
            const additionalSignal: PlaceholderSignal = {
              id: `signal-additional-${Date.now()}-${i}`,
              entry_time: currentTime,
              type: SignalType.TECHNICAL,
              strength: SignalStrength.STRONG,
              timestamp: Date.now(),
              qualityScore: 90,
              symbol: symbol,
              exchange: inferExchangeCategory(symbol),
              processed: false,
              status: 'active' as const,
              signal: Math.random() > 0.5 ? 'BUY' as const : 'SELL' as const,
              reason: 'Technical Analysis',
              price: 0,
              entry_price: 0,
              target_price: 0,
              stop_loss: 0,
              expiry_time_str: expiryTime,
              gale1_time: gale1Time,
              gale2_time: gale2Time,
              success_rate: 0.85 + Math.random() * 0.1,
              expired: false,
              timeframe: '5m',
              expiry: '5m',
              risk_reward: '2:1',
              isDashboard: false
            };
            
            additionalSignals.push(additionalSignal);
            
            // Calcular pr??ximo hor??rio v??lido (seguindo padr??o 03???23???43???03)
            const [currentHour, currentMinute] = currentTime.split(':').map(Number);
            if (currentMinute === 3) {
              currentTime = `${currentHour.toString().padStart(2, '0')}:23`;
            } else if (currentMinute === 23) {
              currentTime = `${currentHour.toString().padStart(2, '0')}:43`;
            } else if (currentMinute === 43) {
              const nextHour = (currentHour + 1) % 24;
              currentTime = `${nextHour.toString().padStart(2, '0')}:03`;
            }
          }
          
          // 3. Combinar: 3 da dashboard + 4 adicionais = 7 sinais totais
          const allSevenSignals = [...firstThreeSignals, ...additionalSignals];
          
          // Verificar que temos exatamente 7 sinais
          if (allSevenSignals.length !== 7) {
            return;
          }
          
          // 4. Limpar caches e atualizar estado
          clearNavigationCacheOnDashboardChange();
          localStorage.removeItem('dailyTradingSignals');
          localStorage.removeItem('dailyTradingSignalsDate');
          
          // 5. Atualizar estado da dashboard
          setDashboardSignals(firstThreeSignals);
          
          // 6. Salvar no cache de navega????o
          saveSignalsToNavigationCache(allSevenSignals);
          
          // 7. Aplicar no React Query
          safeSetTradingSignals(allSevenSignals);
          
          
          // Log detalhado de todos os 7 sinais
          firstThreeSignals.forEach((signal, idx) => {
          });
          additionalSignals.forEach((signal, idx) => {
          });
          
        } catch (error) {
          
          // Fallback: for??ar refetch como ??ltima op????o
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['tradingSignals'] });
            refetch();
          }, 100);
        }
    };

    // Listener para evento de for??a de sincroniza????o (backup)
    const handleForceDashboardSync = (event: CustomEvent<{ signals: PlaceholderSignal[]; timestamp?: number }>) => {
      handleDashboardUpdate(event); // Reutilizar a mesma l??gica
    };

    // Adicionar ambos os listeners
    window.addEventListener('dashboardSignalsUpdated', handleDashboardUpdate as EventListener);
    window.addEventListener('forceDashboardSync', handleForceDashboardSync as EventListener);
    
    // VERIFICA????O PERI??DICA adicional para garantir sincroniza????o
    const syncInterval = setInterval(() => {
      try {
        // Tentar obter dados mais recentes da dashboard
        const dashboardData = localStorage.getItem('dashboardSignals');
        if (dashboardData) {
          const { signals, timestamp } = JSON.parse(dashboardData);
          
          // Verificar se dados s??o v??lidos e recentes (menos de 5 minutos)
          const isRecent = (Date.now() - (timestamp || 0)) < 5 * 60 * 1000;
          
          if (isRecent && signals && Array.isArray(signals) && signals.length >= 3) {
            // Verificar se os sinais atuais est??o sincronizados com a dashboard
            const currentSignals = queryClient.getQueryData<TradingSignal[]>(['tradingSignals']);
            if (currentSignals && currentSignals.length >= 3) {
              // Verificar se os 3 primeiros sinais s??o diferentes
              const firstThreeCurrentSignals = currentSignals.slice(0, 3);
              const firstThreeDashboardSignals = signals.slice(0, 3);
              
              // Comparar s??mbolos e hor??rios
              let needsSync = false;
              for (let i = 0; i < 3; i++) {
                if (
                  firstThreeCurrentSignals[i]?.symbol !== firstThreeDashboardSignals[i]?.symbol ||
                  firstThreeCurrentSignals[i]?.entry_time !== firstThreeDashboardSignals[i]?.entry_time
                ) {
                  needsSync = true;
                  break;
                }
              }
              
              // Se precisa sincronizar, for??ar atualiza????o
              if (needsSync) {
                handleDashboardUpdate(new CustomEvent('forceDashboardSync', { detail: { signals } }));
              }
            }
          }
        }
      } catch (error) {
        // Erro na verificação periódica, ignorar
      }
    }, 30 * 1000); // Verificar a cada 30 segundos
    
    return () => {
      // Remover ambos os listeners ao desmontar
      window.removeEventListener('dashboardSignalsUpdated', handleDashboardUpdate as EventListener);
      window.removeEventListener('forceDashboardSync', handleForceDashboardSync as EventListener);
      clearInterval(syncInterval);
    };
  }, [queryClient, refetch, setDashboardSignals, calculateNextTime, getRandomAsset, adjustToTimePattern, safeSetTradingSignals]);

  // SINCRONIZA????O ULTRA-MELHORADA com Dashboard: Reage a mudan??as nos sinais da dashboard
  useEffect(() => {
    
    // Vari??veis para evitar loops infinitos
    let isProcessingEvent = false;
    let lastProcessedTimestamp = 0;

    const handleDashboardSignalsUpdate = (event: CustomEvent<{ signals: PlaceholderSignal[]; timestamp?: number }>)=> {
      // Evitar processamento recursivo
      if (isProcessingEvent) {
        return;
      }
      
      // Evitar processamentos muito frequentes do mesmo evento/dados
      const now = Date.now();
      const timestamp = event?.detail?.timestamp || now;
      
      if ((now - lastProcessedTimestamp) < 500 && timestamp <= lastProcessedTimestamp) {
        return;
      }
      
      lastProcessedTimestamp = timestamp;
      isProcessingEvent = true;
      
      try {
        // Verificar se os dados s??o v??lidos
        const { signals: dashboardSignals, timestamp } = event.detail;
        
        if (!dashboardSignals || !Array.isArray(dashboardSignals) || dashboardSignals.length < 3) {
          return;
        }
        
        dashboardSignals.forEach((signal, idx) => {
        });
        
        // Obter sinais atuais
        const currentSignals = queryClient.getQueryData<TradingSignal[]>(['tradingSignals']) || [];
        
        // SINCRONIZA????O PRIORIT??RIA: Sempre garantir que os 3 primeiros sinais s??o id??nticos
        // Fazer c??pia profunda dos sinais para evitar problemas de refer??ncia
        const updatedSignals = [...currentSignals];
        
        // Garantir que temos pelo menos 7 sinais
        while (updatedSignals.length < 7) {
          updatedSignals.push({} as TradingSignal);
        }
        
        // Substituir APENAS os 3 primeiros sinais, mantendo os outros intactos
        for (let i = 0; i < 3; i++) {
          if (i < dashboardSignals.length) {
            // Preservar apenas os metadados do sinal atual (como processamento)
            const currentMetadata = updatedSignals[i] || {} as {
              processed?: boolean;
              isAnimating?: boolean;
            };
            
            // Criar nova refer??ncia para evitar problemas
            updatedSignals[i] = {
              ...dashboardSignals[i],
              // Marcar como vindo da dashboard
              isDashboard: true,
              dashboardPosition: i,
              // Preservar metadata importante
              processed: currentMetadata.processed,
              isAnimating: currentMetadata.isAnimating,
              // Timestamp para diagn??stico
              syncTimestamp: Date.now()
            };
          }
        }
        
        // Garantir que temos 7 sinais no total
        if (updatedSignals.length !== 7) {
          
          if (updatedSignals.length < 7) {
            // Completar com sinais do getDailySignalsForCurrentTime
            const newSignals = getDailySignalsForCurrentTime();
            
            // Adicionar apenas os sinais faltantes
            for (let i = updatedSignals.length; i < 7; i++) {
              if (newSignals && newSignals.length > i) {
                updatedSignals.push(newSignals[i]);
              } else {
                // Fallback
                updatedSignals.push(createBasePlaceholderData());
              }
            }
          } else if (updatedSignals.length > 7) {
            // Limitar para exatamente 7 sinais
            updatedSignals.splice(7);
          }
        }
        
        // Atualizar no React Query
        safeSetTradingSignals(updatedSignals);
        
        // Salvar no cache de navega????o
        saveSignalsToNavigationCache(updatedSignals as PlaceholderSignal[]);
        
        // Verificar se conseguimos sincronizar com sucesso
      } catch (error) {
        // Erro ao processar evento, ignorar
      } finally {
        // Garantir que a flag seja resetada
        isProcessingEvent = false;
      }
    };

    const handleForceDashboardSync = (event: CustomEvent<{ signals: PlaceholderSignal[]; timestamp?: number }>) => {
      handleDashboardSignalsUpdate(event); // Reutilizar a mesma l??gica
    };

    // Adicionar listeners para eventos da dashboard
    window.addEventListener('dashboardSignalsUpdated', handleDashboardSignalsUpdate);
    window.addEventListener('forceDashboardSync', handleForceDashboardSync);

    // Verificar a situa????o atual do localStorage e sincronizar se necess??rio
    const checkLocalStorageAndSync = () => {
      try {
        const dashboardSignalsData = localStorage.getItem('dashboardSignals');
        if (dashboardSignalsData) {
          const data = JSON.parse(dashboardSignalsData);
          
          if (data && data.signals && Array.isArray(data.signals) && data.signals.length >= 3) {
            handleDashboardSignalsUpdate(new CustomEvent('dashboardSignalsUpdated', { detail: data }));
          }
        }
      } catch (error) {
        // Erro ao verificar localStorage, ignorar
      }
    };
    
    // Verificar localStorage ap??s 3 segundos (dar tempo para componente montar)
    const initialSyncTimeout = setTimeout(checkLocalStorageAndSync, 3000);

    // Verificar mudan??as no localStorage a cada 10 segundos (mais frequente)
    const syncInterval = setInterval(() => {
      const dashboardSignalsData = localStorage.getItem('dashboardSignals');
      if (dashboardSignalsData) {
        try {
          const { signals: dashboardSignals, timestamp } = JSON.parse(dashboardSignalsData);
          
          // Verificar se os sinais s??o recentes (menos de 1 minuto)
          const isRecent = (Date.now() - (timestamp || 0)) < 60 * 1000;
          
          if (isRecent && dashboardSignals && Array.isArray(dashboardSignals) && dashboardSignals.length >= 3) {
            // Comparar s??mbolos dos 3 primeiros sinais
            const currentSignals = queryClient.getQueryData<TradingSignal[]>(['tradingSignals']);
            if (!currentSignals || currentSignals.length < 3) {
              handleDashboardSignalsUpdate(new CustomEvent('dashboardSignalsUpdated', { 
                detail: { signals: dashboardSignals, timestamp } 
              }));
              return;
            }
            
            // Verificar se os 3 primeiros sinais s??o diferentes
            const currentSymbols = currentSignals.slice(0, 3).map(s => s.symbol);
            const dashboardSymbols = dashboardSignals.slice(0, 3).map(s => s.symbol);
            
            // Verificar se algum s??mbolo ?? diferente
            let needsSync = false;
            for (let i = 0; i < 3; i++) {
              if (currentSymbols[i] !== dashboardSymbols[i]) {
                needsSync = true;
                break;
              }
            }
            
            if (needsSync) {
              handleDashboardSignalsUpdate(new CustomEvent('dashboardSignalsUpdated', { 
                detail: { signals: dashboardSignals, timestamp } 
              }));
            }
          }
          // Verificar se os dados s??o recentes (menos de 30 minutos)
          const isRecentExtended = Date.now() - timestamp < 30 * 60 * 1000;
          
          // Verificar se h?? sinais da dashboard e se s??o diferentes dos atuais
          if (isRecentExtended && dashboardSignals && Array.isArray(dashboardSignals) && dashboardSignals.length >= 3 && signals && signals.length >= 3) {
            // Verificar os 3 primeiros sinais
            const firstThreeCurrent = signals.slice(0, 3);
            const firstThreeDashboard = dashboardSignals.slice(0, 3);
            
            // Comparar IDs, s??mbolos e hor??rios
            let needsSync = false;
            for (let i = 0; i < 3; i++) {
              // Se qualquer um dos principais atributos for diferente, precisa sincronizar
              if (
                firstThreeCurrent[i]?.id !== firstThreeDashboard[i]?.id ||
                firstThreeCurrent[i]?.symbol !== firstThreeDashboard[i]?.symbol ||
                firstThreeCurrent[i]?.entry_time !== firstThreeDashboard[i]?.entry_time
              ) {
                needsSync = true;
                break;
              }
            }
            
            // Se precisa sincronizar, disparar evento
            if (needsSync) {
              
              // Criar evento com dados atualizados
              const event = new CustomEvent('forceDashboardSync', { 
                detail: { signals: dashboardSignals, timestamp }
              });
              
              // Processar o evento
              handleForceDashboardSync(event);
            }
          }
        } catch (error) {
          // Erro na verificação de sincronização, ignorar
        }
      }
    }, 30 * 1000); // Verificar a cada 30 segundos

    // Cleanup
    return () => {
      window.removeEventListener('dashboardSignalsUpdated', handleDashboardSignalsUpdate);
      window.removeEventListener('forceDashboardSync', handleForceDashboardSync);
      clearInterval(syncInterval);
      clearTimeout(initialSyncTimeout);
    };
  }, [getDailySignalsForCurrentTime, queryClient, safeSetTradingSignals, signals, createBasePlaceholderData]);

  const [traderLink, setTraderLink] = useState<string>('');
  
  // Carregar o link do trader no in??cio
  useEffect(() => {
    const loadTraderLink = async () => {
      try {
      const link = await traderLinkService.getCurrentTraderLink();
      setTraderLink(link);
      } catch (error) {
        // Em caso de erro, manter o link padr??o
        setTraderLink('https://trade.avalonbroker.io/register?aff=385853&aff_model=revenue&afftrack=mesnagensfree');
      }
    };
    
    loadTraderLink();
  }, []);
  
  // Fun????o para abrir o link do trader
  const openTraderLink = useCallback(() => {
    if (!traderLink) {
      // Fallback para o link padr??o caso o traderLink ainda n??o tenha sido carregado
      window.open('https://trade.avalonbroker.io/register?aff=385853&aff_model=revenue&afftrack=mesnagensfree', '_blank');
      return;
    }
    window.open(traderLink, '_blank');
  }, [traderLink]);

  // Fun????o para diagn??stico do localStorage (DESATIVADA - removida para limpar console)
  const diagnosticoLocalStorage = () => {
    // Diagn??stico desativado para evitar polui????o do console
    return;
  };
  
  // Executar diagn??stico (DESATIVADO)
  // diagnosticoLocalStorage();

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="space-y-6 relative p-4 rounded-xl min-h-screen -mx-4 -my-4"
      >
        {/* Cabe??alho da p??gina */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex flex-col gap-3 sm:gap-4 mb-6 sm:mb-8"
        >
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-medium text-white">
              {t('nav.signals.title')}
            </h1>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap mt-2">
              <p className="text-white/50 font-light text-xs sm:text-sm tracking-wide">
                {t('signals.subtitle')}
              </p>
              
              <div className="flex items-center gap-1.5 sm:gap-2">
                <TimeZoneSelector variant="compact" />
                
                {/* Bot??o de diagn??stico - vis??vel apenas no navegador Operar para ajudar na depura????o */}
                {(window.BROWSER_INFO?.isOperar || navigator.userAgent.includes('Opera')) && (
                  <Button
                    onClick={() => {
                      if (window.dumpDebugLogs) {
                        window.dumpDebugLogs();
                        alert('Diagn??stico completo exibido no console. Abra as ferramentas de desenvolvedor (F12) para verificar.');
                      } else {
                        alert('Ferramenta de diagn??stico n??o dispon??vel.');
                      }
                    }}
                    size="sm"
                    variant="outline"
                    className="ml-2 bg-amber-900/20 border-amber-500/30 text-amber-400"
                  >
                    <span className="mr-2">????</span>
                    Diagn??stico
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Injetar estilos CSS */}
        <style>{styles}</style>

        {/* Conte??do principal com os sinais */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="grid gap-6"
        >
          {isLoading ? (
            <div className="loading-container">
              <div className="flex items-center justify-center mb-6">
                <div className="relative">
                  <div className="w-16 h-16 border-2 border-black/90 border-t-gray-600/30 rounded-full animate-spin"></div>
                  <div className="w-12 h-12 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-black/90 border-b-gray-600/30 rounded-full animate-spin"></div>
              </div>
              </div>
              <h3 className="gradient-text font-medium text-lg mb-2">{t('signals.analyzing.market')}</h3>
              <p className="text-sm text-white/50 text-center max-w-xs">
                {t('signals.processing')}
              </p>
            </div>
          ) : (filteredSignals && Array.isArray(filteredSignals) && filteredSignals.length > 0) ? (
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-5">
              {(() => {
                try {
                  if (!Array.isArray(paginatedSignals)) {
                    return <div className="col-span-full text-center py-4">Erro ao processar sinais. Tente atualizar a p??gina.</div>;
                  }
                  
                  if (paginatedSignals.length === 0) {
                    return <div className="col-span-full text-center py-4">Nenhum sinal dispon??vel no momento.</div>;
                  }
                  
                  return paginatedSignals.map((signal: PlaceholderSignal, index) => {
                    if (!signal || !signal.entry_time) {
                      return null;
                    }
                    try {
                  // Converter hor??rios para o fuso hor??rio selecionado
                  const entryTime = convertTimeToSelected(signal.entry_time || '00:00');
                  const expiryTime = convertTimeToSelected(signal.expiry_time_str || '00:00');
                  const gale1Time = convertTimeToSelected(signal.gale1_time || '00:00');
                  const gale2Time = convertTimeToSelected(signal.gale2_time || '00:00');
                
                  return (
                    <motion.div 
                      key={`${signal.id}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="flex flex-col rounded-xl signal-card h-full"
                      data-signal-number={index + 1}
                    >
                    <div className="relative p-3 sm:p-4 border-b signal-divider backdrop-blur-md bg-black/70">
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base sm:text-lg font-semibold text-white leading-tight overflow-hidden text-ellipsis line-clamp-2 break-words">
                            {String(signal.display_name || signal.symbol)}
                          </h3>
                          <div className="flex items-center text-xs sm:text-sm text-white/70 mt-1 min-w-0">
                            <span className="truncate">{signal.exchange || 'Corretora'}</span>
                          </div>
                        </div>
                      
                        <span className={`text-xs sm:text-sm py-1 px-2 rounded-md flex-shrink-0 h-fit font-medium border border-white/10 whitespace-nowrap ${
                          signal.signal === 'BUY' 
                            ? 'text-green-500' 
                            : 'text-red-500'
                          }`}
                        >
                          {signal.signal === 'BUY' ? t('signals.buy') || "COMPRA" : t('signals.sell') || "VENDA"}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-3 sm:p-4 flex-grow relative backdrop-blur-md bg-black/70 min-h-0">
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4 min-h-[28px] items-center">
                        <span className="text-[10px] sm:text-xs h-5 sm:h-6 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-emerald-900/30 text-emerald-300/80 border border-white/5 flex items-center whitespace-nowrap flex-shrink-0">
                                <CheckCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1 flex-shrink-0" />
                                {formatSuccessRate(signal.success_rate || 0.77)}
                                </span>
                        <span className={`text-[10px] sm:text-xs h-5 sm:h-6 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full flex items-center text-teal-300/70 bg-teal-900/30 border border-white/5 whitespace-nowrap flex-shrink-0`}>
                          <CheckCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1 flex-shrink-0" />
                          {getStrengthText(signal.strength)}
                            </span>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-2 sm:gap-3 mb-3 sm:mb-4">
                        <div className="flex flex-col space-y-2 sm:space-y-3">
                          <div className="flex items-center justify-between bg-black/80 backdrop-blur-md rounded-lg p-2 sm:p-3 border border-white/5 shadow-inner min-h-[44px] sm:min-h-[50px] signal-info-box gap-2">
                            <div>
                              <p className="text-xs sm:text-sm font-medium text-white/70 whitespace-nowrap">{t('dashboard.signals.entry') || "Entrada"}</p>
                            </div>
                            <p className="text-sm sm:text-base font-semibold text-white/80">{entryTime || "00:00"}</p>
                          </div>
                          
                          <div className="flex items-center justify-between bg-black/80 backdrop-blur-md rounded-lg p-2 sm:p-3 border border-white/5 shadow-inner min-h-[44px] sm:min-h-[50px] signal-info-box gap-2">
                            <div>
                              <p className="text-xs sm:text-sm font-medium text-white/70 whitespace-nowrap">{t('dashboard.signals.expiration') || "Expiração"}</p>
                            </div>
                            <div className="flex items-center gap-1 text-sm sm:text-base font-semibold text-white/80">
                              <span>5m</span>
                              <span className="text-[10px] sm:text-xs text-white/50">({expiryTime})</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col space-y-2 sm:space-y-3">
                          <div className="flex items-center justify-between bg-black/80 backdrop-blur-md rounded-lg p-2 sm:p-3 border border-white/5 shadow-inner min-h-[44px] sm:min-h-[50px] signal-info-box gap-2">
                            <div>
                              <p className="text-xs sm:text-sm font-medium text-white/70 whitespace-nowrap">{t('dashboard.signals.reentry1') || "Reentrada 1"}</p>
                            </div>
                            <p className="text-sm sm:text-base font-semibold text-white/80">{gale1Time || "00:29"}</p>
                          </div>
                          
                          <div className="flex items-center justify-between bg-black/80 backdrop-blur-md rounded-lg p-2 sm:p-3 border border-white/5 shadow-inner min-h-[44px] sm:min-h-[50px] signal-info-box gap-2">
                            <div>
                              <p className="text-xs sm:text-sm font-medium text-white/70 whitespace-nowrap">{t('dashboard.signals.reentry2') || "Reentrada 2"}</p>
                            </div>
                            <p className="text-sm sm:text-base font-semibold text-white/80">{gale2Time || "00:30"}</p>
                          </div>
                        </div>
                      </div>
                      
                    {/* Bot??o de a????o */}
                    <div className="p-3 sm:p-4 border-t signal-divider bg-black/80">
                      <button
                        className="w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg bg-gradient-to-r from-amber-700/80 via-yellow-600/70 to-amber-600/90 hover:from-amber-800/80 hover:via-yellow-700/70 hover:to-amber-700/90 text-amber-50 text-sm sm:text-base font-medium transition-all duration-300 flex items-center justify-center relative overflow-hidden shadow-lg backdrop-blur-sm border border-amber-500/20 group golden-button golden-shadow"
                        onClick={openTraderLink}
                      >
                        <span className="absolute inset-0 w-full h-full bg-black opacity-30 group-hover:opacity-20 transition-opacity duration-300"></span>
                        <span className="absolute inset-0 w-full h-full bg-gradient-to-tr from-amber-500/20 via-yellow-400/10 to-amber-300/20"></span>
                        <span className="relative z-10 flex items-center whitespace-nowrap">
                          {t('dashboard.signals.trade') || "Realizar Trade"}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1.5 sm:ml-2 relative z-10 text-amber-100 flex-shrink-0" />
                      </button>
                    </div>
                    </div>
                    </motion.div>
                  );
                } catch (error) {
                  return null;
                }
                                });
                } catch (renderError) {
                  if (window.DEBUG_LOGS) {
                    window.DEBUG_LOGS.push(`??? ERRO DE RENDERIZA????O: ${renderError.message}`);
                    window.DEBUG_LOGS.push(`Stack: ${renderError.stack?.slice(0, 500)}`);
                  }
                  window.lastRenderError = renderError;
                  return <div className="col-span-full p-4 text-center">
                    <p className="mb-3 text-red-400">Erro ao processar sinais</p>
                    <button 
                      onClick={() => window.location.reload()}
                      className="px-3 py-1 bg-white/10 rounded text-sm hover:bg-white/20"
                    >
                      Recarregar p??gina
                    </button>
                  </div>;
                }
              })()}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 sm:p-10 signals-page-card-glass rounded-xl">
              <div className="bg-black/60 p-3 sm:p-4 rounded-full mb-4">
                <ListFilter className="w-8 h-8 sm:w-10 sm:h-10 text-white/30" />
              </div>
              <h3 className="text-lg sm:text-xl font-medium mb-2">
                Nenhum sinal encontrado
              </h3>
              <p className="text-white/60 text-center max-w-md mb-6 text-sm sm:text-base px-4">
                {filterType !== 'ALL' 
                  ? `Não encontramos sinais do tipo ${filterType} com os filtros atuais.` 
                  : 'Não encontramos sinais de trading ativos no momento.'}
              </p>
              <button
                onClick={() => {
                  setFilterType('ALL');
                  setShowExpiredSignals(true);
                }}
                className="px-4 py-2 rounded-lg bg-black/70 hover:bg-gray-900/80 text-white/80 hover:text-white transition-all"
              >
                Mostrar todos os sinais
              </button>
            </div>
          )}
          
          {/* Pagina????o */}
          {totalPages > 1 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="flex justify-center items-center mt-6 sm:mt-8 gap-1.5 sm:gap-2"
            >
              <button 
                onClick={() => setActivePage(prev => Math.max(1, prev - 1))}
                disabled={activePage === 1}
                className="p-1.5 sm:p-2 rounded-lg bg-black/80 hover:bg-gray-900/80 disabled:opacity-50 disabled:pointer-events-none transition-all"
                aria-label="P??gina anterior"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 rotate-180" />
              </button>
              
              <div className="flex gap-1">
                {Array.from({ length: totalPages }).map((_, index) => {
                  // Mostrar apenas 5 bot??es de p??gina no total
                  if (totalPages <= 5 || 
                      index === 0 || 
                      index === totalPages - 1 || 
                      (index >= activePage - 2 && index <= activePage)) {
                    return (
                  <button 
                    key={`page-${index + 1}`}
                    onClick={() => setActivePage(index + 1)}
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-all text-sm sm:text-base ${
                      activePage === index + 1 
                            ? 'bg-gray-900/90 text-white font-medium border border-gray-800/30 shimmer-effect' 
                            : 'bg-black/80 hover:bg-gray-900/70 text-white/70'
                    }`}
                  >
                    {index + 1}
                  </button>
                    );
                  } else if (index === 1 && activePage > 3) {
                    return <span key="ellipsis-start" className="px-0.5 sm:px-1 self-end text-white/50 text-sm">...</span>;
                  } else if (index === totalPages - 2 && activePage < totalPages - 2) {
                    return <span key="ellipsis-end" className="px-0.5 sm:px-1 self-end text-white/50 text-sm">...</span>;
                  }
                  return null;
                })}
              </div>
              
              <button 
                onClick={() => setActivePage(prev => Math.min(totalPages, prev + 1))}
                disabled={activePage === totalPages}
                className="p-1.5 sm:p-2 rounded-lg bg-black/80 hover:bg-gray-900/80 disabled:opacity-50 disabled:pointer-events-none transition-all"
                aria-label="Pr??xima p??gina"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </motion.div>
          )}
        </motion.div>
        
        {/* Rodap?? com ticker de criptomoedas */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <CryptoTickerFooter />
        </motion.div>
      </motion.div>
    </Layout>
  );
};

export default Signals;

