/**
 * Utilitário para garantir que valores passados para toasts sejam strings seguras
 * Este arquivo resolve o erro: "Objects are not valid as a React child"
 */

/**
 * Converte qualquer valor para uma string segura para renderização
 * @param value - Valor a ser convertido para string
 * @returns Uma string segura para renderização
 */
export function toastSafeString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  // Se for um objeto, converter para JSON string
  if (typeof value === 'object') {
    // Se for um objeto com title e description, extrair estas propriedades
    const obj = value as Record<string, unknown>;
    if (obj.title && obj.description) {
      return `${obj.title}: ${obj.description}`;
    }
    
    try {
      return JSON.stringify(value);
    } catch (e) {
      return '[Objeto não serializável]';
    }
  }
  
  return String(value);
}

