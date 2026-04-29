"use client";

import { useState } from "react";
import { X, Loader2, Mail, Send } from "lucide-react";
import { useApi } from "@/lib/useApi";

interface EmailChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string;
  onSuccess: (newEmail: string) => void;
}

export function EmailChangeModal({ isOpen, onClose, currentEmail, onSuccess }: EmailChangeModalProps) {
  const { execute: apiCall } = useApi();
  const [step, setStep] = useState<"email" | "code">("email");
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!isOpen) return null;

  const handleRequestCode = async () => {
    if (!newEmail) {
      setError("Digite o novo e-mail");
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setError("E-mail inválido");
      return;
    }
    
    if (newEmail === currentEmail) {
      setError("O novo e-mail é igual ao atual");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      await apiCall({
        url: "/api/auth/request-email-change",
        method: "POST",
        body: { new_email: newEmail },
        requireAuth: true
      });
      
      setSuccess(`Código enviado para ${currentEmail}`);
      setStep("code");
    } catch (err: any) {
      setError(err.message || "Erro ao solicitar alteração");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || code.length !== 6) {
      setError("Digite o código de 6 dígitos");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const result = await apiCall({
        url: "/api/auth/verify-email-change",
        method: "POST",
        body: { code },
        requireAuth: true
      });
      
      setSuccess("E-mail alterado com sucesso!");
      setTimeout(() => {
        onSuccess(result.new_email);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Código inválido");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("email");
    setNewEmail("");
    setCode("");
    setError("");
    setSuccess("");
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">
            {step === "email" ? "Alterar E-mail" : "Verificar Código"}
          </h3>
          <button onClick={handleClose} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          {step === "email" ? (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Digite seu novo e-mail. Enviaremos um código de verificação para seu e-mail atual.
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-mail atual
                </label>
                <input
                  type="email"
                  value={currentEmail}
                  disabled
                  className="w-full p-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Novo e-mail <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="novo@email.com"
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                  autoFocus
                />
              </div>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                  {success}
                </div>
              )}
              
              <button
                onClick={handleRequestCode}
                disabled={loading}
                className="w-full py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c72a5f] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {loading ? "Enviando..." : "Enviar código de verificação"}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Enviamos um código de verificação para <strong>{currentEmail}</strong>. 
                Digite o código abaixo para confirmar a alteração para <strong>{newEmail}</strong>.
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
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none text-center text-2xl tracking-widest"
                  maxLength={6}
                  autoFocus
                />
              </div>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                  {success}
                </div>
              )}
              
              <button
                onClick={handleVerifyCode}
                disabled={loading}
                className="w-full py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c72a5f] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {loading ? "Verificando..." : "Confirmar alteração"}
              </button>
              
              <button
                onClick={() => {
                  reset();
                  setStep("email");
                }}
                className="w-full mt-3 py-2 text-gray-500 hover:text-gray-700 text-sm"
              >
                Voltar e digitar outro e-mail
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}