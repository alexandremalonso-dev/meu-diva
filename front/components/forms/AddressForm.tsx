"use client";

import { useState } from "react";
import { Home, MapPin, Building2, Navigation, Info } from "lucide-react";
import CepInput from "@/components/ui/CepInput";

interface AddressData {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
}

interface AddressFormProps {
  initialData?: Partial<AddressData>;
  onSubmit?: (data: AddressData) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

export default function AddressForm({ 
  initialData = {}, 
  onSubmit, 
  onCancel,
  disabled = false 
}: AddressFormProps) {
  const [formData, setFormData] = useState<AddressData>({
    cep: initialData.cep || "",
    logradouro: initialData.logradouro || "",
    numero: initialData.numero || "",
    complemento: initialData.complemento || "",
    bairro: initialData.bairro || "",
    localidade: initialData.localidade || "",
    uf: initialData.uf || "",
  });

  const [manualEdit, setManualEdit] = useState({
    logradouro: false,
    bairro: false,
    localidade: false,
    uf: false
  });

  const handleAddressFound = (address: {
    cep: string;
    logradouro: string;
    bairro: string;
    localidade: string;
    uf: string;
  }) => {
    setFormData(prev => ({
      ...prev,
      cep: address.cep,
      logradouro: manualEdit.logradouro ? prev.logradouro : address.logradouro,
      bairro: manualEdit.bairro ? prev.bairro : address.bairro,
      localidade: manualEdit.localidade ? prev.localidade : address.localidade,
      uf: manualEdit.uf ? prev.uf : address.uf,
    }));
  };

  const handleFieldChange = (field: keyof AddressData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Marcar como editado manualmente
    if (field !== "cep" && field !== "numero" && field !== "complemento") {
      setManualEdit(prev => ({ ...prev, [field]: true }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) onSubmit(formData);
  };

  const isFormValid = () => {
    return formData.logradouro && formData.numero && formData.bairro && formData.localidade && formData.uf;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* CEP */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          CEP <span className="text-red-500">*</span>
        </label>
        <CepInput 
          onAddressFound={handleAddressFound}
          initialCep={formData.cep}
          disabled={disabled}
        />
      </div>

      {/* Logradouro */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <div className="flex items-center gap-1">
            <Navigation className="w-3 h-3" />
            Logradouro <span className="text-red-500">*</span>
          </div>
        </label>
        <input
          type="text"
          value={formData.logradouro}
          onChange={(e) => handleFieldChange("logradouro", e.target.value)}
          placeholder="Rua, Avenida, etc."
          disabled={disabled}
          className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#F59E0B] outline-none"
        />
      </div>

      {/* Número e Complemento */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Número <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.numero}
            onChange={(e) => handleFieldChange("numero", e.target.value)}
            placeholder="Número"
            disabled={disabled}
            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#F59E0B] outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Complemento
          </label>
          <input
            type="text"
            value={formData.complemento}
            onChange={(e) => handleFieldChange("complemento", e.target.value)}
            placeholder="Apto, Bloco, etc."
            disabled={disabled}
            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#F59E0B] outline-none"
          />
        </div>
      </div>

      {/* Bairro */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <Building2 className="w-3 h-3 inline mr-1" />
          Bairro <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.bairro}
          onChange={(e) => handleFieldChange("bairro", e.target.value)}
          placeholder="Bairro"
          disabled={disabled}
          className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#F59E0B] outline-none"
        />
      </div>

      {/* Cidade e Estado */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cidade <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.localidade}
            onChange={(e) => handleFieldChange("localidade", e.target.value)}
            placeholder="Cidade"
            disabled={disabled}
            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#F59E0B] outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estado <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.uf}
            onChange={(e) => handleFieldChange("uf", e.target.value)}
            disabled={disabled}
            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#F59E0B] outline-none"
          >
            <option value="">Selecione</option>
            <option value="AC">Acre</option>
            <option value="AL">Alagoas</option>
            <option value="AP">Amapá</option>
            <option value="AM">Amazonas</option>
            <option value="BA">Bahia</option>
            <option value="CE">Ceará</option>
            <option value="DF">Distrito Federal</option>
            <option value="ES">Espírito Santo</option>
            <option value="GO">Goiás</option>
            <option value="MA">Maranhão</option>
            <option value="MT">Mato Grosso</option>
            <option value="MS">Mato Grosso do Sul</option>
            <option value="MG">Minas Gerais</option>
            <option value="PA">Pará</option>
            <option value="PB">Paraíba</option>
            <option value="PR">Paraná</option>
            <option value="PE">Pernambuco</option>
            <option value="PI">Piauí</option>
            <option value="RJ">Rio de Janeiro</option>
            <option value="RN">Rio Grande do Norte</option>
            <option value="RS">Rio Grande do Sul</option>
            <option value="RO">Rondônia</option>
            <option value="RR">Roraima</option>
            <option value="SC">Santa Catarina</option>
            <option value="SP">São Paulo</option>
            <option value="SE">Sergipe</option>
            <option value="TO">Tocantins</option>
          </select>
        </div>
      </div>

      {/* Botões */}
      <div className="flex justify-end gap-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={disabled || !isFormValid()}
          className="px-4 py-2 bg-[#F59E0B] text-white rounded-lg hover:bg-[#d97706] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Salvar Endereço
        </button>
      </div>
    </form>
  );
}