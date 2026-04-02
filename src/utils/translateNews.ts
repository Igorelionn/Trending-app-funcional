/**
 * Tradução de títulos de notícias usando Google Translate público.
 * Resultado em cache via sessionStorage para evitar chamadas repetidas.
 */

const CACHE_KEY = 'news_translations_v3';

function getCache(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, string>) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

async function translateSingle(text: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(text.slice(0, 5000))}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
    if (!res.ok) return null;
    const data = await res.json();
    const translated = data[0]?.map((item: [string, string]) => item[0]).join('') || null;
    return translated;
  } catch {
    return null;
  }
}

/**
 * Traduz um array de títulos para pt-BR.
 * Usa cache e Google Translate público (mesmo endpoint da página News).
 */
export async function translateNewsTitles(titles: string[]): Promise<string[]> {
  const cache = getCache();

  const toTranslate: { index: number; text: string }[] = [];
  titles.forEach((t, i) => {
    if (t && t.length > 5 && !cache[t]) {
      toTranslate.push({ index: i, text: t });
    }
  });

  if (toTranslate.length > 0) {
    const BATCH_SIZE = 5;
    for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
      const batch = toTranslate.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async ({ text }) => {
          const translated = await translateSingle(text);
          return { text, translated };
        })
      );
      results.forEach(({ text, translated }) => {
        if (translated && translated.toLowerCase() !== text.toLowerCase()) {
          cache[text] = translated;
        }
      });
    }
    saveCache(cache);
  }

  return titles.map((t) => cache[t] || t);
}
