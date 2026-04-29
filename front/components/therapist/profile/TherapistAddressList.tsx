"use client";

import { useState, useEffect } from 'react';
import { Home, MapPin, Star, Edit, Trash2, Loader2, Plus } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import CepInput from '@/components/ui/CepInput';

interface Address {
  id?: number;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  is_default: boolean;
}

interface TherapistAddressListProps {
  therapistId: number;
  onAddressChange: () => void;
}

export function TherapistAddressList({ onAddressChange }: TherapistAddressListProps) {
  const { execute: apiCall } = useApi();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    country: 'Brasil',
    is_default: false
  });

  const resetForm = () => {
    setFormData({
      cep: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      country: 'Brasil',
      is_default: false
    });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleEdit = (address: Address) => {
    setFormData({
      cep: address.cep || '',
      street: address.street,
      number: address.number || '',
      complement: address.complement || '',
      neighborhood: address.neighborhood || '',
      city: address.city,
      state: address.state,
      country: address.country,
      is_default: address.is_default
    });
    setEditingId(address.id);
    setShowForm(true);
  };

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
      street: address.logradouro,
      neighborhood: address.bairro,
      city: address.localidade,
      state: address.uf,
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const loadAddresses = async () => {
    try {
      console.log("📥 Carregando endereços do terapeuta...");
      const data = await apiCall({
        url: '/api/therapists/me/address',
        requireAuth: true
      });
      console.log("✅ Endereços carregados:", data);
      setAddresses(data || []);
      if (onAddressChange) onAddressChange();
    } catch (err) {
      console.error('❌ Erro ao carregar endereços', err);
      setAddresses([]);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const handleSubmit = async () => {
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

    try {
      const payload = {
        cep: formData.cep,
        street: formData.street,
        number: formData.number,
        complement: formData.complement,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        is_default: formData.is_default
      };

      if (editingId) {
        await apiCall({
          url: `/api/therapists/me/address/${editingId}`,
          method: 'PUT',
          body: payload,
          requireAuth: true
        });
      } else {
        await apiCall({
          url: '/api/therapists/me/address',
          method: 'POST',
          body: payload,
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
        url: `/api/therapists/me/address/${id}`,
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
        url: `/api/therapists/me/address/${id}/default`,
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
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#E03673]" />
          <h3 className="font-medium text-gray-900">Endereços cadastrados</h3>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#E03673] text-white rounded-lg hover:bg-[#c72a5f] transition-colors"
          >
            <Plus className="w-3 h-3" />
            Novo endereço
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {showForm && (
        <div className="space-y-4 mb-6 p-5 bg-gray-50 rounded-xl border border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CEP <span className="text-red-500">*</span>
            </label>
            <CepInput 
              onAddressFound={handleAddressFound}
              initialCep={formData.cep}
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
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
              <input
                type="text"
                name="number"
                value={formData.number}
                onChange={handleChange}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
              <input
                type="text"
                name="complement"
                value={formData.complement}
                onChange={handleChange}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
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
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
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
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
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
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none uppercase"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_default"
              checked={formData.is_default}
              onChange={handleChange}
              className="h-4 w-4 text-[#E03673] rounded"
            />
            <label className="text-sm text-gray-700">Definir como endereço padrão</label>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c72a5f] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {editingId ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {addresses.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Home className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum endereço cadastrado</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 text-sm text-[#E03673] hover:underline"
          >
            Adicionar endereço
          </button>
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
                  {address.is_default && (
                    <span className="inline-flex items-center gap-1 mb-2 px-2 py-1 bg-[#E03673] text-white text-xs rounded-full">
                      <Star className="w-3 h-3" />
                      Padrão
                    </span>
                  )}
                  <p className="text-sm font-medium text-gray-800">
                    {address.street}, {address.number}
                    {address.complement && ` - ${address.complement}`}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {address.neighborhood} - {address.city}/{address.state}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">CEP: {address.cep}</p>
                </div>
                <div className="flex gap-2 ml-4">
                  {!address.is_default && (
                    <button
                      onClick={() => handleSetDefault(address.id!)}
                      className="p-1.5 text-gray-400 hover:text-[#E03673] hover:bg-[#FCE4EC] rounded-lg transition-colors"
                      title="Definir como padrão"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(address)}
                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {!address.is_default && (
                    <button
                      onClick={() => handleDelete(address.id!)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}