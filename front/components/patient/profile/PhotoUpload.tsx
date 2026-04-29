"use client";

import { useState, useRef, useEffect } from "react";
import { BACKEND_URL } from "@/config";

interface PhotoUploadButtonProps {
  currentPhotoUrl?: string | null;
  endpoint: string;
  onSuccess: (url: string) => void;
  onError?: (message: string) => void;
  /** Nome para exibir inicial quando não há foto */
  name?: string;
}

export function PhotoUpload({
  currentPhotoUrl,
  endpoint,
  onSuccess,
  onError,
  name = "",
}: PhotoUploadButtonProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || null);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreviewUrl(currentPhotoUrl || null);
    setImageError(false);
  }, [currentPhotoUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onError?.("Selecione uma imagem (JPG, PNG, GIF, WEBP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError?.("A imagem deve ter no máximo 5MB");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setImageError(false);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const url = `${BACKEND_URL}${endpoint}`;

      console.log('📤 Enviando foto para:', url);

      const response = await fetch(url, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      console.log('📥 Status da resposta:', response.status);
      const data = await response.json();
      console.log('📥 Dados recebidos:', data);

      if (!response.ok) {
        throw new Error(data.detail || data.error || "Erro ao fazer upload");
      }

      const fotoUrl: string = data.foto_url;
      if (!fotoUrl) throw new Error("Backend não retornou foto_url");

      URL.revokeObjectURL(objectUrl);
      setPreviewUrl(fotoUrl);
      onSuccess(fotoUrl);
      window.dispatchEvent(new Event('refreshProfile'));

    } catch (err: any) {
      console.error("❌ Erro no upload da foto:", err);
      setPreviewUrl(currentPhotoUrl || null);
      onError?.(err.message || "Erro ao fazer upload da foto");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ✅ Igual ao UploadFoto antigo
  const imageUrl = previewUrl?.startsWith('blob:')
    ? previewUrl
    : previewUrl?.startsWith('http')
      ? previewUrl
      : previewUrl
        ? `${BACKEND_URL}${previewUrl}`
        : null;

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Círculo grande clicável — igual ao UploadFoto antigo */}
      <div
        onClick={() => fileInputRef.current?.click()}
        style={{
          width: '128px',
          height: '128px',
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: '#f3f4f6',
          position: 'relative',
          cursor: 'pointer',
          border: '2px solid #d1d5db',
        }}
      >
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={name || "Foto de perfil"}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onLoad={() => setImageError(false)}
            onError={() => setImageError(true)}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            color: 'white',
            fontSize: '48px',
            fontWeight: 'bold',
          }}>
            {name ? name.charAt(0).toUpperCase() : '?'}
          </div>
        )}

        {uploading && (
          <div style={{
            position: 'absolute', inset: '0',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              border: '2px solid white', borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite',
            }} />
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />

      <p className="text-xs text-gray-500 text-center">
        Clique na foto para alterar<br />
        Formatos: JPG, PNG, WEBP (máx. 5MB)
      </p>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}