import { useCallback, useRef } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";

interface UserWithPhoto {
  id?: number;
  user_id?: number;
  foto_url?: string | null;
}

export function useUserPhotos() {
  const { user } = useAuth();
  const { execute: apiCall } = useApi();
  const fotoCacheRef = useRef<Map<number, string>>(new Map());
  const loadingPromiseRef = useRef<Promise<void> | null>(null);

  const loadPhotoCache = useCallback(async () => {
    if (loadingPromiseRef.current) return loadingPromiseRef.current;
    if (fotoCacheRef.current.size > 0) return Promise.resolve();
    
    loadingPromiseRef.current = (async () => {
      try {
        const isAdmin = user?.role === "admin";
        const isEmpresa = user?.role === "empresa";
        
        const newCache = new Map<number, string>();
        
        // Se for empresa, buscar apenas colaboradores
        if (isEmpresa) {
          const colaboradoresData = await apiCall({ 
            url: "/api/empresa/colaboradores", 
            requireAuth: true 
          }).catch(() => []);
          
          if (Array.isArray(colaboradoresData)) {
            colaboradoresData.forEach((c: any) => {
              if (c.user_id && c.foto_url) newCache.set(c.user_id, c.foto_url);
              if (c.id && c.foto_url && !newCache.has(c.id)) newCache.set(c.id, c.foto_url);
            });
          }
        }
        
        // Se for admin, buscar terapeutas, pacientes e EMPRESAS
        if (isAdmin) {
          const [therapistsData, patientsData, empresasData] = await Promise.allSettled([
            apiCall({ url: "/api/therapists", requireAuth: true }),
            apiCall({ url: "/api/patients", requireAuth: true }),
            apiCall({ url: "/api/admin/empresas", requireAuth: true }).catch(() => []), // 🔥 NOVO: busca empresas
          ]);
          
          if (therapistsData.status === "fulfilled" && Array.isArray(therapistsData.value)) {
            therapistsData.value.forEach((t: any) => {
              if (t.user_id && t.foto_url) newCache.set(t.user_id, t.foto_url);
              if (t.id && t.foto_url && !newCache.has(t.id)) newCache.set(t.id, t.foto_url);
            });
          }
          
          if (patientsData.status === "fulfilled" && Array.isArray(patientsData.value)) {
            patientsData.value.forEach((p: any) => {
              if (p.user_id && p.foto_url) newCache.set(p.user_id, p.foto_url);
              if (p.id && p.foto_url && !newCache.has(p.id)) newCache.set(p.id, p.foto_url);
            });
          }
          
          // 🔥 NOVO: adiciona empresas ao cache
          if (empresasData.status === "fulfilled" && Array.isArray(empresasData.value)) {
            empresasData.value.forEach((e: any) => {
              if (e.user_id && e.foto_url) newCache.set(e.user_id, e.foto_url);
              if (e.id && e.foto_url && !newCache.has(e.id)) newCache.set(e.id, e.foto_url);
            });
          }
        }
        
        fotoCacheRef.current = newCache;
      } catch (err) {
        console.error("Erro ao carregar cache de fotos:", err);
      } finally {
        loadingPromiseRef.current = null;
      }
    })();
    
    return loadingPromiseRef.current;
  }, [apiCall, user?.role]);

  const enrichWithPhotos = useCallback(async <T extends UserWithPhoto>(items: T | T[]): Promise<T | T[]> => {
    await loadPhotoCache();
    const enrichItem = (item: T): T => {
      const userId = item.user_id || item.id;
      if (!userId) return item;
      const fotoUrl = fotoCacheRef.current.get(userId);
      if (fotoUrl && !item.foto_url) return { ...item, foto_url: fotoUrl };
      return item;
    };
    return Array.isArray(items) ? items.map(enrichItem) : enrichItem(items);
  }, [loadPhotoCache]);

  const getPhotoByUserId = useCallback(async (userId: number): Promise<string | null> => {
    await loadPhotoCache();
    return fotoCacheRef.current.get(userId) || null;
  }, [loadPhotoCache]);

  const clearCache = useCallback(() => {
    fotoCacheRef.current.clear();
    loadingPromiseRef.current = null;
  }, []);

  return { enrichWithPhotos, getPhotoByUserId, clearCache, cacheSize: fotoCacheRef.current.size };
}