/**
 * Configurações globais da aplicação
 * 
 * NEXT_PUBLIC_BACKEND_URL: URL do backend (pode ser definida no .env.local)
 * Se não definida, usa 'http://localhost:8000' como padrão
 */
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';