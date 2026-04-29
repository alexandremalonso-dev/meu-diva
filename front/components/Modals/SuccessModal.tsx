"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Calendar, Clock, User, Mail, X, DollarSign, Video } from "lucide-react";

const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  verde: "#10B981",
  cinzaTexto: "#374151",
  cinzaClaro: "#F9F5FF",
};

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  details?: {
    therapistName?: string;
    patientName?: string;
    date?: string;
    time?: string;
    duration?: number;
    price?: number;
  };
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export function SuccessModal({
  isOpen,
  onClose,
  title,
  message,
  details,
  autoClose = true,
  autoCloseDelay = 5000
}: SuccessModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      if (autoClose) {
        const timer = setTimeout(() => {
          setVisible(false);
          setTimeout(onClose, 300);
        }, autoCloseDelay);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose]);

  if (!isOpen && !visible) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      onClick={() => {
        setVisible(false);
        setTimeout(onClose, 300);
      }}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden transform transition-all duration-300 ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho com gradiente rosa */}
        <div className="bg-gradient-to-r from-[#E03673] to-[#E03673]/80 p-4 text-white">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-6 h-6" />
              <h3 className="text-lg font-semibold">{title}</h3>
            </div>
            <button 
              onClick={() => {
                setVisible(false);
                setTimeout(onClose, 300);
              }}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-6">
          {message && (
            <p className="text-gray-600 text-center mb-4">{message}</p>
          )}

          {details && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              {(details.therapistName || details.patientName) && (
                <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
                  <User className="w-5 h-5 text-[#2F80D3]" />
                  <div>
                    <p className="text-xs text-gray-500">Profissional</p>
                    <p className="font-medium text-gray-800">{details.therapistName || details.patientName}</p>
                  </div>
                </div>
              )}

              {details.date && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-[#E03673]" />
                  <div>
                    <p className="text-xs text-gray-500">Data</p>
                    <p className="font-medium text-gray-800">{details.date}</p>
                  </div>
                </div>
              )}

              {details.time && (
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-[#E03673]" />
                  <div>
                    <p className="text-xs text-gray-500">Horário</p>
                    <p className="font-medium text-gray-800">{details.time}</p>
                  </div>
                </div>
              )}

              {details.duration && (
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-[#2F80D3]" />
                  <div>
                    <p className="text-xs text-gray-500">Duração</p>
                    <p className="font-medium text-gray-800">{details.duration} minutos</p>
                  </div>
                </div>
              )}

              {details.price && details.price > 0 && (
                <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                  <DollarSign className="w-5 h-5 text-[#10B981]" />
                  <div>
                    <p className="text-xs text-gray-500">Valor pago</p>
                    <p className="font-medium text-gray-800">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(details.price)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400 text-center mt-4 flex items-center justify-center gap-1">
            <Mail className="w-3 h-3" />
            Um e-mail de confirmação foi enviado para você
          </p>
        </div>

        {/* Botão fechar */}
        <div className="p-4 pt-0">
          <button
            onClick={() => {
              setVisible(false);
              setTimeout(onClose, 300);
            }}
            className="w-full py-2 bg-[#E03673] hover:bg-[#c02c5e] text-white rounded-lg font-medium transition-colors"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}