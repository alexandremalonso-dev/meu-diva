"use client";

import { useState, useEffect } from "react";
import { Loader2, MapPin, CheckCircle, XCircle } from "lucide-react";

interface CepInputProps {
  onAddressFound: (address: {
    cep: string;
    logradouro: string;
    bairro: string;
    localidade: string;
    uf: string;
    numero?: string;
    complemento?: string;
  }) => void;
  initialCep?: string;
  disabled?: boolean;
  className?: string;
}

export default function CepInput({ 
  onAddressFound, 
  initialCep = "", 
  disabled = false,
  className = ""
}: CepInputProps) {
  const [cep, setCep] = useState(initialCep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  // Formatar CEP com máscara
  const formatCep = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 5) return cleaned;
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 8)}`;
  };

  const handleCepChange = async (value: string) => {
    const rawValue = value.replace(/\D/g, "");
    const formattedValue = formatCep(value);
    setCep(formattedValue);
    setError(null);
    setSuccess(false);
    setCepStatus("idle");

    if (rawValue.length === 8) {
      setLoading(true);
      setCepStatus("loading");
      
      try {
        const response = await fetch(`https://viacep.com.br/ws/${rawValue}/json/`);
        const data = await response.json();

        if (data.erro) {
          setError("CEP não encontrado");
          setCepStatus("error");
          onAddressFound({
            cep: formattedValue,
            logradouro: "",
            bairro: "",
            localidade: "",
            uf: ""
          });
        } else {
          setSuccess(true);
          setCepStatus("success");
          onAddressFound({
            cep: data.cep || formattedValue,
            logradouro: data.logradouro || "",
            bairro: data.bairro || "",
            localidade: data.localidade || "",
            uf: data.uf || "",
          });
          
          // Limpar erro após 3 segundos
          setTimeout(() => setSuccess(false), 3000);
        }
      } catch (err) {
        console.error("Erro ao buscar CEP:", err);
        setError("Erro ao buscar CEP. Tente novamente.");
        setCepStatus("error");
        onAddressFound({
          cep: formattedValue,
          logradouro: "",
          bairro: "",
          localidade: "",
          uf: ""
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const getStatusIcon = () => {
    if (cepStatus === "loading") return <Loader2 className="w-4 h-4 animate-spin text-[#F59E0B]" />;
    if (cepStatus === "success") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (cepStatus === "error") return <XCircle className="w-4 h-4 text-red-500" />;
    return <MapPin className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
          {getStatusIcon()}
        </div>
        <input
          type="text"
          value={cep}
          onChange={(e) => handleCepChange(e.target.value)}
          placeholder="Digite seu CEP (ex: 30130-110)"
          disabled={disabled || loading}
          className={`
            w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:outline-none
            ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-[#F59E0B]'}
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          `}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <span className="text-xs text-gray-400">Buscando...</span>
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <XCircle className="w-3 h-3" /> {error}
        </p>
      )}
      
      {success && (
        <p className="text-xs text-green-500 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> CEP encontrado! Endereço preenchido automaticamente.
        </p>
      )}
    </div>
  );
}