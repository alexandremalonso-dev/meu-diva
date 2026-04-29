"use client";

import { useState, useEffect } from "react";
import { MapPin, Loader2, CheckCircle, XCircle, Search } from "lucide-react";

interface Endereco {
  id?: number;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  is_primary: boolean;
}

interface EmpresaAddressFormProps {
  endereco?: Endereco;
  onSave: (endereco: Endereco) => void;
  onCancel: () => void;
}

export function EmpresaAddressForm({ endereco, onSave, onCancel }: EmpresaAddressFormProps) {
  const [formData, setFormData] = useState<Endereco>({
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    is_primary: false,
    ...endereco
  });
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepError, setCepError] = useState("");
  const [cepSuccess, setCepSuccess] = useState(false);

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
  };

  const buscarCep = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      setCepError("CEP deve ter 8 dígitos");
      return;
    }

    setLoadingCep(true);
    setCepError("");
    setCepSuccess(false);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();

      if (data.erro) {
        setCepError("CEP não encontrado");
        return;
      }

      setFormData(prev => ({
        ...prev,
        logradouro: data.logradouro || "",
        bairro: data.bairro || "",
        cidade: data.localidade || "",
        uf: data.uf || ""
      }));
      setCepSuccess(true);
      setTimeout(() => setCepSuccess(false), 3000);
    } catch (error) {
      setCepError("Erro ao buscar CEP");
    } finally {
      setLoadingCep(false);
    }
  };

  const handleCepBlur = () => {
    if (formData.cep.replace(/\D/g, '').length === 8) {
      buscarCep(formData.cep);
    }
  };

  const handleChange = (field: keyof Endereco, value: string | boolean) => {
    if (field === "cep") {
      value = formatCep(value as string);
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.logradouro || !formData.cidade || !formData.uf) {
      setCepError("Preencha o CEP primeiro ou complete os campos manualmente");
      return;
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
          <div className="relative">
            <input
              type="text"
              value={formData.cep}
              onChange={(e) => handleChange("cep", e.target.value)}
              onBlur={handleCepBlur}
              className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none ${
                cepError ? "border-red-500" : cepSuccess ? "border-green-500" : "border-gray-200"
              }`}
              placeholder="00000-000"
            />
            {loadingCep && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
            )}
            {cepSuccess && !loadingCep && (
              <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
            )}
          </div>
          {cepError && <p className="text-xs text-red-500 mt-1">{cepError}</p>}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Logradouro</label>
          <input
            type="text"
            value={formData.logradouro}
            onChange={(e) => handleChange("logradouro", e.target.value)}
            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
          <input
            type="text"
            value={formData.numero}
            onChange={(e) => handleChange("numero", e.target.value)}
            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
            placeholder="S/N"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
          <input
            type="text"
            value={formData.complemento}
            onChange={(e) => handleChange("complemento", e.target.value)}
            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
            placeholder="Sala, Bloco, Andar"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
          <input
            type="text"
            value={formData.bairro}
            onChange={(e) => handleChange("bairro", e.target.value)}
            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
            <input
              type="text"
              value={formData.cidade}
              onChange={(e) => handleChange("cidade", e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">UF</label>
            <select
              value={formData.uf}
              onChange={(e) => handleChange("uf", e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
              required
            >
              <option value="">Selecione</option>
              <option value="AC">AC</option><option value="AL">AL</option><option value="AP">AP</option>
              <option value="AM">AM</option><option value="BA">BA</option><option value="CE">CE</option>
              <option value="DF">DF</option><option value="ES">ES</option><option value="GO">GO</option>
              <option value="MA">MA</option><option value="MT">MT</option><option value="MS">MS</option>
              <option value="MG">MG</option><option value="PA">PA</option><option value="PB">PB</option>
              <option value="PR">PR</option><option value="PE">PE</option><option value="PI">PI</option>
              <option value="RJ">RJ</option><option value="RN">RN</option><option value="RS">RS</option>
              <option value="RO">RO</option><option value="RR">RR</option><option value="SC">SC</option>
              <option value="SP">SP</option><option value="SE">SE</option><option value="TO">TO</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_primary"
          checked={formData.is_primary}
          onChange={(e) => handleChange("is_primary", e.target.checked)}
          className="h-4 w-4 text-[#E03673] rounded"
        />
        <label htmlFor="is_primary" className="text-sm text-gray-700">Endereço principal</label>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors flex items-center gap-2"
        >
          <MapPin className="w-4 h-4" />
          Salvar Endereço
        </button>
      </div>
    </form>
  );
}