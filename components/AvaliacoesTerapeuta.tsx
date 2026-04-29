"use client";

import { Star } from "lucide-react";

interface Avaliacao {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  patient?: {
    full_name: string;
  };
}

interface AvaliacoesTerapeutaProps {
  avaliacoes: Avaliacao[];
  loading: boolean;
  mediaRating: number;
  totalReviews: number;
}

export function AvaliacoesTerapeuta({ avaliacoes, loading, mediaRating, totalReviews }: AvaliacoesTerapeutaProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mx-auto mb-4"></div>
          <div className="h-20 bg-gray-100 rounded-lg mb-3"></div>
          <div className="h-20 bg-gray-100 rounded-lg mb-3"></div>
        </div>
      </div>
    );
  }

  if (avaliacoes.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-100">
        <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Ainda sem avaliações</h3>
        <p className="text-gray-500 text-sm">Seja o primeiro paciente a avaliar este profissional!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-r from-[#E03673] to-[#2F80D3] px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-xl font-bold">⭐ Avaliações dos pacientes</h2>
          <div className="text-white text-right">
            <div className="text-2xl font-bold">{mediaRating.toFixed(1)}</div>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={16}
                  className={star <= mediaRating ? "fill-[#FBBF24] text-[#FBBF24]" : "text-white/50"}
                />
              ))}
            </div>
            <div className="text-xs opacity-80">{totalReviews} avaliações</div>
          </div>
        </div>
      </div>

      {/* Lista de avaliações */}
      <div className="divide-y divide-gray-100">
        {avaliacoes.filter(avaliacao => avaliacao.comment).map((avaliacao) => (
          <div key={avaliacao.id} className="p-5 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={16}
                    className={star <= avaliacao.rating ? "fill-[#FBBF24] text-[#FBBF24]" : "text-gray-300"}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-400">
                {new Date(avaliacao.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
            {avaliacao.comment && (
              <p className="text-gray-600 text-sm leading-relaxed">{avaliacao.comment}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}