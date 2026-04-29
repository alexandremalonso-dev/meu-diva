"use client";

import { useState } from "react";
import { X, Loader2, AlertTriangle, Mail, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

interface AccountDeletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
  userEmail: string;
}

export function AccountDeletionModal({ isOpen, onClose, onDeleted, userEmail }: AccountDeletionModalProps) {
  const [step, setStep] = useState<"confirm" | "code">("confirm");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleRequestDeletion = async () => {
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/request-account-deletion", {
        method: "POST",
        requireAuth: true
      });
      setStep("code");
    } catch (err: any) {
      setError(err.message || "Erro ao solicitar exclusão");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeletion = async () => {
    if (!code || code.length !== 6) {
      setError("Digite o código de 6 dígitos");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await api("/api/auth/confirm-account-deletion", {
        method: "POST",
        body: { code },
        requireAuth: true
      });
      onDeleted();
      onClose();
    } catch (err: any) {
      setError(err.message || "Código inválido");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("confirm");
    setCode("");
    setError("");
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-red-600 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Excluir conta
          </h3>
          <button onClick={handleClose} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {step === "confirm" ? (
            <>
              <div className="mb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <Trash2 className="w-8 h-8 text-red-600" />
                  </div>
                </div>
                <p className="text-center text-gray-700 mb-4">
                  Tem certeza que deseja <strong className="text-red-600">excluir permanentemente</strong> sua conta?
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Esta ação é irreversível! Todos os seus dados serão apagados permanentemente.</span>
                  </p>
                </div>
                <div className="mt-4 text-sm text-gray-500">
                  <p>Serão excluídos:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Seu perfil e informações pessoais</li>
                    <li>Histórico de sessões e prontuários</li>
                    <li>Dados financeiros e recibos</li>
                    <li>Carteira e transações</li>
                  </ul>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRequestDeletion}
                  disabled={loading}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {loading ? "Enviando..." : "Sim, excluir minha conta"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Enviamos um código de verificação para <strong>{userEmail}</strong>.
                Digite o código abaixo para confirmar a exclusão da sua conta.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código de verificação
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-center text-2xl tracking-widest"
                  maxLength={6}
                  autoFocus
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleConfirmDeletion}
                disabled={loading || code.length !== 6}
                className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {loading ? "Verificando..." : "Confirmar exclusão permanente"}
              </button>

              <button
                onClick={() => {
                  reset();
                  setStep("confirm");
                }}
                className="w-full mt-3 py-2 text-gray-500 hover:text-gray-700 text-sm"
              >
                Voltar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}