"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Loader2, User } from "lucide-react";
import { BACKEND_URL } from "@/config";

interface PhotoUploadButtonProps {
  currentPhotoUrl?: string | null;
  endpoint: string;
  onSuccess: (url: string) => void;
  onError?: (message: string) => void;
  size?: number;
  name?: string;
  avatarBgClass?: string;
}

export function PhotoUploadButton({
  currentPhotoUrl,
  endpoint,
  onSuccess,
  onError,
  size = 96,
  name,
  avatarBgClass = "bg-gradient-to-br from-[#E03673] to-[#c02c5e]",
}: PhotoUploadButtonProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || null);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentPhotoUrl) {
      setPreviewUrl(currentPhotoUrl);
      setImageError(false);
    }
  }, [currentPhotoUrl]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const getInitials = () => {
    if (!name) return "";
    return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join("");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      onError?.("Selecione uma imagem (JPG, PNG, GIF, WEBP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError?.("A imagem deve ter no máximo 5MB");
      return;
    }

    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const blobUrl = URL.createObjectURL(file);
    blobUrlRef.current = blobUrl;
    setPreviewUrl(blobUrl);
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

      URL.revokeObjectURL(blobUrl);
      blobUrlRef.current = null;
      setPreviewUrl(fotoUrl);

      onSuccess(fotoUrl);
      window.dispatchEvent(new Event('refreshProfile'));

    } catch (err: any) {
      console.error("❌ Erro no upload da foto:", err);
      setPreviewUrl(currentPhotoUrl || null);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      onError?.(err.message || "Erro ao fazer upload da foto");
    } finally {
      setUploading(false);
    }
  };

  const showImage = previewUrl && !imageError;

  // ✅ Igual ao UploadFoto antigo: suporta blob, http completo, e path relativo
  const imageUrl = previewUrl?.startsWith('blob:')
    ? previewUrl
    : previewUrl?.startsWith('http')
      ? previewUrl
      : previewUrl
        ? `${BACKEND_URL}${previewUrl}`
        : null;

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <div
        className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center ${showImage && imageUrl ? "" : avatarBgClass}`}
      >
        {showImage && imageUrl ? (
          <img
            src={imageUrl}
            alt={name || "Foto de perfil"}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : getInitials() ? (
          <span className="text-white font-semibold select-none" style={{ fontSize: size * 0.3 }}>
            {getInitials()}
          </span>
        ) : (
          <User className="text-white" style={{ width: size * 0.42, height: size * 0.42 }} />
        )}
      </div>

      <label
        className={`absolute bottom-0 right-0 p-1.5 rounded-full cursor-pointer transition-colors shadow-md ${
          uploading ? "bg-gray-400 cursor-not-allowed" : "bg-[#E03673] hover:bg-[#c02c5e]"
        }`}
        style={{ pointerEvents: uploading ? "none" : "auto" }}
      >
        {uploading ? (
          <Loader2 className="text-white animate-spin" style={{ width: size * 0.18, height: size * 0.18 }} />
        ) : (
          <Camera className="text-white" style={{ width: size * 0.18, height: size * 0.18 }} />
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileChange}
          disabled={uploading}
        />
      </label>
    </div>
  );
}