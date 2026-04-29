"use client";

import { useState } from "react";
import { Star, X } from "lucide-react";
import { api } from "@/lib/api";

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  therapistId: number;
  patientId: number;
  sessionId: number;
  therapistName: string;
  onSuccess?: () => void;
}

export function RatingModal({
  isOpen,
  onClose,
  therapistId,
  patientId,
  sessionId,
  therapistName,
  onSuccess
}: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Por favor, selecione uma avaliação");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api("/api/ratings/therapist", {
        method: "POST",
        body: JSON.stringify({
          therapist_id: therapistId,
          patient_id: patientId,
          session_id: sessionId,
          rating: rating,
          comment: comment,
          is_anonymous: isAnonymous
        })
      });

      setSubmitted(true);
      onSuccess?.();
      setTimeout(() => {
        onClose();
        setSubmitted(false);
        setRating(0);
        setComment("");
        setIsAnonymous(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Erro ao enviar avaliação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[#E03673] to-[#E03673]/80">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Avaliar Sessão</h3>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5">
          {submitted ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">✅</span>
              </div>
              <p className="text-green-700 font-medium text-lg">Avaliação enviada!</p>
              <p className="text-sm text-gray-500 mt-1">Obrigado por compartilhar sua experiência</p>
            </div>
          ) : (
            <>
              <p className="text-gray-600 mb-4 text-center">
                Como foi sua sessão com <strong>{therapistName}</strong>?
              </p>

              {/* Estrelas */}
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-10 h-10 ${
                        (hoverRating || rating) >= star
                          ? "fill-[#E03673] text-[#E03673]"
                          : "text-gray-300"
                      } transition-colors`}
                    />
                  </button>
                ))}
              </div>

              {/* Comentário */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deixe um comentário (opcional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Compartilhe sua experiência..."
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none resize-none"
                  rows={3}
                />
              </div>

              {/* Anônimo */}
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="anonymous"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="w-4 h-4 text-[#E03673] rounded focus:ring-[#E03673]"
                />
                <label htmlFor="anonymous" className="text-sm text-gray-600">
                  Avaliar anonimamente (seu nome não será exibido)
                </label>
              </div>

              {/* Erro */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-[#E03673] hover:bg-[#c02c5e] text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? "Enviando..." : "Enviar Avaliação"}
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium transition-colors"
                >
                  Depois
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}