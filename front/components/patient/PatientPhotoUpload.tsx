"use client";

import { useState, useRef, useEffect } from 'react';
import { BACKEND_URL } from '@/config';

interface PatientPhotoUploadProps {
  currentPhotoUrl?: string | null;
  patientName: string;
  onUploadSuccess: (fotoUrl: string) => void;
  onUploadError: (error: string) => void;
}

export function PatientPhotoUpload({ 
  currentPhotoUrl, 
  patientName,
  onUploadSuccess,
  onUploadError 
}: PatientPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || null);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPreviewUrl(currentPhotoUrl || null);
    setImageError(false);
  }, [currentPhotoUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onUploadError('Por favor, selecione uma imagem (JPG, PNG, etc)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      onUploadError('A imagem deve ter no máximo 5MB');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setImageError(false);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/patient/profile/photo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Erro ao fazer upload');
      }

      onUploadSuccess(data.foto_url);
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('refreshProfile'));
      }
      
    } catch (error: any) {
      onUploadError(error.message || 'Erro ao fazer upload');
      setPreviewUrl(currentPhotoUrl || null);
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

  const handleImageLoad = () => {
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div 
        ref={containerRef}
        onClick={triggerFileInput}
        className="group relative w-32 h-32 rounded-full overflow-hidden bg-gray-200 cursor-pointer border-2 border-gray-300 hover:border-purple-500 transition-all"
      >
        {imageUrl && !imageError ? (
          <img
            ref={imgRef}
            src={imageUrl}
            alt={patientName}
            className="w-full h-full object-cover"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-600 text-white text-4xl font-bold">
            {patientName.charAt(0).toUpperCase()}
          </div>
        )}
        
        {uploading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        {!uploading && !imageError && (
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
            <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium">
              Alterar
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
        JPG, PNG, WEBP (max. 5MB)
      </p>
    </div>
  );
}