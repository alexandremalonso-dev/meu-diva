"use client";

import { useState, useRef, useEffect } from 'react';
import { BACKEND_URL } from '@/config';

interface UploadFotoProps {
  fotoUrl?: string | null;
  onUploadComplete: (url: string) => void;
}

export function UploadFoto({ fotoUrl, onUploadComplete }: UploadFotoProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(fotoUrl || null);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ✅ Força atualização do preview quando fotoUrl muda (ex: após upload)
  useEffect(() => {
    console.log('🖼️ fotoUrl mudou:', fotoUrl);
    setPreviewUrl(fotoUrl || null);
    setImageError(false);
  }, [fotoUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem (JPG, PNG, etc)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setImageError(false);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

      console.log('📤 Enviando foto para:', `${BACKEND_URL}/api/therapists/me/profile/photo`);

      const response = await fetch(`${BACKEND_URL}/api/therapists/me/profile/photo`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      console.log('📥 Status da resposta:', response.status);

      const data = await response.json();
      console.log('📥 Dados recebidos:', data);

      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Erro ao fazer upload');
      }

      // ✅ Limpa o preview do blob
      URL.revokeObjectURL(objectUrl);
      
      // ✅ Atualiza o preview com a URL real do Cloud Storage
      setPreviewUrl(data.foto_url);
      
      // ✅ Notifica o componente pai
      onUploadComplete(data.foto_url);

      // ✅ Dispara evento global
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('refreshProfile'));
      }

    } catch (error: any) {
      console.error('❌ Erro no upload:', error);
      alert(error.message || 'Erro ao fazer upload');
      setPreviewUrl(fotoUrl || null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const imageUrl = previewUrl?.startsWith('blob:')
    ? previewUrl
    : previewUrl?.startsWith('http')
      ? previewUrl
      : previewUrl
        ? `${BACKEND_URL}${previewUrl}`
        : null;

  const handleImageLoad = () => setImageError(false);
  const handleImageError = () => setImageError(true);

  return (
    <div className="flex flex-col items-center space-y-4">
      <div
        ref={containerRef}
        onClick={triggerFileInput}
        className="group"
        style={{
          width: '128px',
          height: '128px',
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: '#f3f4f6',
          position: 'relative',
          cursor: 'pointer',
          border: '2px solid #d1d5db'
        }}
      >
        {imageUrl && !imageError ? (
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Foto de perfil"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onLoad={handleImageLoad}
            onError={handleImageError}
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
            fontWeight: 'bold'
          }}>
            ?
          </div>
        )}

        {uploading && (
          <div style={{
            position: 'absolute',
            inset: '0',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '2px solid white',
              borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite'
            }} />
          </div>
        )}

        {!uploading && !imageError && (
          <div
            style={{
              position: 'absolute',
              inset: '0',
              backgroundColor: 'rgba(0,0,0,0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              opacity: 0
            }}
            className="group-hover:opacity-100 group-hover:bg-opacity-30"
          >
            <span style={{ color: 'white' }} className="opacity-0 group-hover:opacity-100">
              Alterar foto
            </span>
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
        Formatos: JPG, PNG, WEBP (max. 5MB)
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