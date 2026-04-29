"use client";

import { useState } from "react";
import { Star, X } from "lucide-react";
import { api } from "@/lib/api";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: number;
  therapistName: string;
  onSuccess: () => void;
}

export function ReviewModal({ isOpen, onClose, appointmentId, therapistName, onSuccess }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Selecione uma avaliação de 1 a 5 estrelas");
      return;
    }
    
    setSubmitting(true);
    setError("");
    
    try {
      await api("/api/reviews/create", {
        method: "POST",
        body: JSON.stringify({ 
          appointment_id: appointmentId, 
          rating, 
          comment: comment || null 
        })
      });
      onSuccess();
      onClose();
      setRating(0);
      setComment("");
    } catch (err: any) {
      console.error("Erro ao salvar avaliação:", err);
      setError(err.message || "Erro ao enviar avaliação");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setRating(0);
    setComment("");
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-[#2F80D3]">Avaliar sessão</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <p className="text-gray-600 mb-4">
          Como foi sua sessão com <strong className="text-[#E03673]">{therapistName}</strong>?
        </p>
        
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="focus:outline-none transition-transform hover:scale-110"
            >
              <Star
                size={44}
                className={`transition-all ${
                  (hoverRating || rating) >= star
                    ? "fill-[#FBBF24] text-[#FBBF24]"
                    : "text-gray-300"
                }`}
              />
            </button>
          ))}
        </div>
        
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Compartilhe sua experiência (opcional)"
          className="w-full p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#E03673] focus:border-transparent"
          rows={4}
        />
        
        {error && (
          <p className="text-red-500 text-sm mt-2">{error}</p>
        )}
        
        <button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className="w-full mt-4 py-3 bg-[#E03673] text-white rounded-lg font-medium hover:bg-[#c02c5e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Enviando..." : "Enviar avaliação"}
        </button>
        
        <p className="text-xs text-gray-400 text-center mt-3">
          Sua avaliação ajuda outros pacientes a escolherem profissionais
        </p>
      </div>
    </div>
  );
}