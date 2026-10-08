"use client";

import { useRef, useState, useEffect } from "react";
import { X, RotateCcw, Check, Loader2, PenTool } from "lucide-react";
import { BACKEND_URL } from "@/config";

interface SignaturePadModalProps {
  onClose: () => void;
  onSuccess: (url: string) => void;
  onError?: (message: string) => void;
}

export function SignaturePadModal({ onClose, onSuccess, onError }: SignaturePadModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [saving, setSaving] = useState(false);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // 🔥 Ajusta o canvas pra resolução real da tela (fica nítido em qualquer
  // dispositivo) e configura o traço. Fundo NUNCA é pintado — assim o PNG
  // exportado sai com fundo transparente onde não houver traço.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";
    }
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = getPos(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !lastPointRef.current) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPointRef.current = pos;
    setIsEmpty(false);
  };

  const handlePointerUp = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return;
    setSaving(true);
    try {
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Erro ao gerar imagem da assinatura");

      const file = new File([blob], `signature-${Date.now()}.png`, { type: "image/png" });
      const formData = new FormData();
      formData.append("file", file, file.name);

      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const response = await fetch(`${BACKEND_URL}/api/therapists/me/profile/signature`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Erro ao salvar assinatura");

      onSuccess(data.signature_url);
      onClose();
    } catch (err: any) {
      onError?.(err?.message || "Erro ao salvar assinatura");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PenTool className="w-5 h-5 text-[#E03673]" />
            <h3 className="text-lg font-semibold text-gray-900">Assinatura digital</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-gray-500 mb-3">
            Assine no espaço abaixo com o dedo (celular) ou o mouse (notebook).
          </p>
          <canvas
            ref={canvasRef}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl bg-white"
            style={{ height: 200, touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>

        <div className="flex justify-between items-center gap-3 p-4 bg-gray-50">
          <button
            type="button"
            onClick={handleClear}
            disabled={isEmpty || saving}
            className="px-4 py-2 text-sm bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Limpar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isEmpty || saving}
            className="px-4 py-2 text-sm bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? "Salvando..." : "Salvar assinatura"}
          </button>
        </div>
      </div>
    </div>
  );
}
