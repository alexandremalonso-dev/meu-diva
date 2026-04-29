"use client";

import { useState, useEffect } from 'react';
import { Plus, Home, MapPin, Star, Edit, Trash2, Loader2 } from 'lucide-react';
import { PatientAddress } from '@/types/patient';
import { useApi } from '@/lib/useApi';
import CepInput from '@/components/ui/CepInput'; // 🔥 NOVA IMPORTAÇÃO

interface AddressListProps {
  patientId: number;
  initialAddresses: PatientAddress[];
  onAddressChange?: () => void;
}

export function AddressList({ patientId, initialAddresses, onAddressChange }: AddressListProps) {
  const { execute: apiCall } = useApi();
  const [addresses, setAddresses] = useState<PatientAddress[]>(initialAddresses);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAddresses(initialAddresses);
  }, [initialAddresses]);

  const [formData, setFormData] = useState({
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zipcode: '',
    country: 'Brasil',
    address_type: 'residential',
    is_default: false
  });

  const resetForm = () => {
    setFormData({
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zipcode: '',
      country: 'Brasil',
      address_type: 'residential',
      is_default: false
    });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleEdit = (address: PatientAddress) => {
    setFormData({
      street: address.street,
      number: address.number || '',
      complement: address.complement || '',
      neighborhood: address.neighborhood || '',
      city: address.city,
      state: address.state,
      zipcode: address.zipcode,
      country: address.country,
      address_type: address.address_type || 'residential',
      is_default: address.is_default
    });
    setEditingId(address.id);
    setShowForm(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  // 🔥 NOVA FUNÇÃO: Preencher endereço via CEP
  const handleAddressFound = (address: {
    cep: string;
    logradouro: string;
    bairro: string;
    localidade: string;
    uf: string;
  }) => {
    setFormData(prev => ({
      ...prev,
      zipcode: address.cep,
      street: address.logradouro,
      neighborhood: address.bairro,
      city: address.localidade,
      state: address.uf,
    }));
  };

  const loadAddresses = async () => {
    try {
      const data = await apiCall({
        url: '/api/patient/profile/address',
        requireAuth: true
      });
      setAddresses(data);
      if (onAddressChange) onAddressChange();
    } catch (err) {
      console.error('Erro ao recarregar endereços', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.street.trim()) {
      setError('Rua é obrigatória');
      setLoading(false);
      return;
    }
    if (!formData.neighborhood.trim()) {
      setError('Bairro é obrigatório');
      setLoading(false);
      return;
    }
    if (!formData.city.trim()) {
      setError('Cidade é obrigatória');
      setLoading(false);
      return;
    }
    if (!formData.state.trim()) {
      setError('Estado é obrigatório');
      setLoading(false);
      return;
    }
    if (!formData.zipcode.trim()) {
      setError('CEP é obrigatório');
      setLoading(false);
      return;
    }

    try {
      if (editingId) {
        await apiCall({
          url: `/api/patient/profile/address/${editingId}`,
          method: 'PUT',
          body: formData,
          requireAuth: true
        });
      } else {
        await apiCall({
          url: '/api/patient/profile/address',
          method: 'POST',
          body: formData,
          requireAuth: true
        });
      }

      await loadAddresses();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar endereço');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja remover este endereço?')) return;

    try {
      await apiCall({
        url: `/api/patient/profile/address/${id}`,
        method: 'DELETE',
        requireAuth: true
      });
      await loadAddresses();
    } catch (err: any) {
      setError(err.message || 'Erro ao remover endereço');
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await apiCall({
        url: `/api/patient/profile/address/${id}`,
        method: 'PUT',
        body: { is_default: true },
        requireAuth: true
      });
      await loadAddresses();
    } catch (err: any) {
      setError(err.message || 'Erro ao definir endereço padrão');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Home className="w-5 h-5 text-[#E03673]" />
          Endereços
        </h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#E03673] hover:bg-[#c02c5e] text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4" />
            Novo Endereço
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4 mb-6 p-5 bg-gray-50 rounded-xl border border-gray-200">
          {/* 🔥 CEP NO TOPO COM AUTOPREENCHIMENTO */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CEP <span className="text-red-500">*</span>
            </label>
            <CepInput 
              onAddressFound={handleAddressFound}
              initialCep={formData.zipcode}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rua *</label>
              <input
                type="text"
                name="street"
                value={formData.street}
                onChange={handleChange}
                required
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
              <input
                type="text"
                name="number"
                value={formData.number}
                onChange={handleChange}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
              <input
                type="text"
                name="complement"
                value={formData.complement}
                onChange={handleChange}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bairro *</label>
              <input
                type="text"
                name="neighborhood"
                value={formData.neighborhood}
                onChange={handleChange}
                required
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cidade *</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                required
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado (UF) *</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                maxLength={2}
                required
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none uppercase transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none transition-all"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_default"
                checked={formData.is_default}
                onChange={handleChange}
                className="w-4 h-4 text-[#E03673] rounded focus:ring-[#E03673] mr-2"
              />
              <label className="text-sm text-gray-700">Definir como endereço padrão</label>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-5">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#E03673] hover:bg-[#c02c5e] text-white rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {editingId ? 'Atualizar' : 'Salvar'}
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {addresses.length === 0 ? (
        <div className="text-center py-12">
          <Home className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nenhum endereço cadastrado.</p>
          <p className="text-sm text-gray-400 mt-1">Clique em "Novo Endereço" para adicionar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <div
              key={address.id}
              className={`p-4 rounded-xl border transition-all ${
                address.is_default
                  ? 'border-[#E03673] bg-[#FCE4EC] shadow-sm'
                  : 'border-gray-200 bg-white hover:shadow-md'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">
                    {address.street}, {address.number}
                    {address.complement && ` - ${address.complement}`}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {address.neighborhood && `${address.neighborhood} - `}
                    {address.city} - {address.state}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">CEP: {address.zipcode}</p>
                  {address.is_default && (
                    <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-[#E03673] text-white text-xs rounded-full">
                      <Star className="w-3 h-3" />
                      Padrão
                    </span>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  {!address.is_default && (
                    <button
                      onClick={() => handleSetDefault(address.id)}
                      className="p-1.5 text-gray-400 hover:text-[#E03673] hover:bg-[#FCE4EC] rounded-lg transition-colors"
                      title="Definir como padrão"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(address)}
                    className="p-1.5 text-gray-400 hover:text-[#2F80D3] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(address.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}