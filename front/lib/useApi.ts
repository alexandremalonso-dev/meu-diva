"use client";

import { useState, useCallback } from 'react';
import { api } from './api';

interface UseApiOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  params?: Record<string, string>;
  requireAuth?: boolean;  // ✅ NOVO - indica se a rota precisa de autenticação
  silent?: boolean;       // ✅ NOVO - suprime logs de erro
}

interface UseApiState<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T = any>() {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async ({
    url,
    method = 'GET',
    body,
    params,
    requireAuth = true,  // ✅ NOVO - padrão true para rotas autenticadas
    silent = false,      // ✅ NOVO
  }: UseApiOptions): Promise<T> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let fullUrl = url;
      if (params) {
        const queryString = new URLSearchParams(params).toString();
        fullUrl = `${url}?${queryString}`;
      }

      // ✅ Passa requireAuth e silent para a função api
      const response = await api(fullUrl, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        requireAuth,
        silent,
      });

      setState({
        data: response as T,
        loading: false,
        error: null,
      });

      return response as T;
    } catch (error: any) {
      setState({
        data: null,
        loading: false,
        error: error.message || 'Erro na requisição',
      });
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}