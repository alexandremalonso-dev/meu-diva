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

function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).Capacitor?.isNativePlatform?.();
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

  const uploadFile = async (file: File) => {
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
      formData.append("file", file, file.name);

      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

      const url = `${BACKEND_URL}${endpoint}`;

      const response = await fetch(url, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.error || "Erro ao fazer upload");
      }

      const fotoUrl: string = data.foto_url;
      if (!fotoUrl) throw new Error("Backend não retornou foto_url");

      URL.revokeObjectURL(blobUrl);
      blobUrlRef.current = null;
      setPreviewUrl(fotoUrl);

      onSuccess(fotoUrl);
      window.dispatchEvent(new Event("refreshProfile"));
    } catch (err: any) {
      console.error("❌ Erro no upload da foto:", err);
      setPreviewUrl(currentPhotoUrl || null);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      const rawMessage = err?.message || "Erro ao fazer upload da foto";
      onError?.(`${rawMessage} (upload)`);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await uploadFile(file);
  };

  const handleNativePhoto = async () => {
    try {
      const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");

      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        promptLabelHeader: "Foto de perfil",
        promptLabelPhoto: "Escolher da galeria",
        promptLabelPicture: "Tirar foto",
      });

      if (!photo.webPath) {
        onError?.("Nenhuma imagem selecionada");
        return;
      }

      // Lê o arquivo a partir do webPath nativo (file:// ou capacitor://) via fetch,
      // que é o caminho recomendado pelo Capacitor para CameraResultType.Uri.
      // Evita a conversao manual base64 -> Uint8Array, que se mostrou instavel
      // dentro do WKWebView para uploads multipart/form-data.
      let blob: Blob;
      try {
        const fileResponse = await fetch(photo.webPath);
        blob = await fileResponse.blob();
      } catch (readErr: any) {
        console.error("❌ Erro ao ler arquivo da câmera/galeria:", readErr);
        onError?.(`Não foi possível ler a imagem selecionada (leitura: ${readErr?.message || "desconhecido"})`);
        return;
      }

      const ext = photo.format || "jpeg";
      const file = new File([blob], `profile-${Date.now()}.${ext}`, {
        type: blob.type || `image/${ext}`,
      });

      await uploadFile(file);
    } catch (err: any) {
      // Usuário cancelou — não é erro
      if (
        err?.message?.toLowerCase().includes("cancel") ||
        err?.message?.toLowerCase().includes("user cancelled")
      ) {
        return;
      }
      console.error("❌ Erro ao acessar câmera/galeria:", err);
      onError?.(`${err?.message || "Erro ao acessar câmera ou galeria"} (captura)`);
    }
  };

  const handleClick = () => {
    if (isNativeApp()) {
      handleNativePhoto();
    } else {
      fileInputRef.current?.click();
    }
  };

  const showImage = previewUrl && !imageError;

  const imageUrl = previewUrl?.startsWith("blob:")
    ? previewUrl
    : previewUrl?.startsWith("http")
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

      <button
        type="button"
        onClick={handleClick}
        disabled={uploading}
        className={`absolute bottom-0 right-0 p-1.5 rounded-full cursor-pointer transition-colors shadow-md ${
          uploading ? "bg-gray-400 cursor-not-allowed" : "bg-[#E03673] hover:bg-[#c02c5e]"
        }`}
      >
        {uploading ? (
          <Loader2 className="text-white animate-spin" style={{ width: size * 0.18, height: size * 0.18 }} />
        ) : (
          <Camera className="text-white" style={{ width: size * 0.18, height: size * 0.18 }} />
        )}
      </button>

      {!isNativeApp() && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileChange}
          disabled={uploading}
        />
      )}
    </div>
  );
}