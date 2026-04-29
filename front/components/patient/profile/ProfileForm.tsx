"use client";

import { useState, useEffect } from 'react';
import { PatientProfile } from '@/types/patient';
import { PhotoUpload } from './PhotoUpload';
import { AddressList } from './AddressList';
import { GoalsManager } from './GoalsManager';
import { AccountDeletionModal } from "@/components/ui/AccountDeletionModal";
import { BACKEND_URL } from '@/config';
import { api } from '@/lib/api';
import {
  Calendar, GraduationCap, CheckCircle, XCircle, Loader2,
  Shield, AlertTriangle, Trash2, ChevronDown, ChevronUp
} from 'lucide-react';

const educationLevels = [
  "Ensino Fundamental incompleto",
  "Ensino Fundamental completo",
  "Ensino Médio incompleto",
  "Ensino Médio completo",
  "Ensino Superior incompleto",
  "Ensino Superior completo",
  "Pós-graduação (especialização)",
  "Mestrado",
  "Doutorado"
];

interface ProfileFormProps {
  initialProfile?: PatientProfile;
  onSave: (profile: Partial<PatientProfile>) => Promise<void>;
  userEmail?: string;
}

export function ProfileForm({ initialProfile, onSave, userEmail }: ProfileFormProps) {
  const [formData, setFormData] = useState({
    full_name: initialProfile?.full_name || '',
    phone: initialProfile?.phone || '',
    cpf: initialProfile?.cpf || '',
    birth_date: initialProfile?.birth_date || '',
    education_level: initialProfile?.education_level || '',
    timezone: initialProfile?.timezone || 'America/Sao_Paulo',
    preferred_language: initialProfile?.preferred_language || 'pt-BR',
    lgpd_consent: (initialProfile as any)?.lgpd_consent || false,
  });

  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [activeTab, setActiveTab] = useState<'profile' | 'addresses' | 'goals'>('profile');
  const [showDeletionSection, setShowDeletionSection] = useState(false);
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const [lgpdConsentDate, setLgpdConsentDate] = useState<string | null>((initialProfile as any)?.lgpd_consent_date || null);

  useEffect(() => {
    if (initialProfile) {
      setFormData({
        full_name: initialProfile.full_name || '',
        phone: initialProfile.phone || '',
        cpf: initialProfile.cpf || '',
        birth_date: initialProfile.birth_date || '',
        education_level: initialProfile.education_level || '',
        timezone: initialProfile.timezone || 'America/Sao_Paulo',
        preferred_language: initialProfile.preferred_language || 'pt-BR',
        lgpd_consent: (initialProfile as any)?.lgpd_consent || false,
      });
      setLgpdConsentDate((initialProfile as any)?.lgpd_consent_date || null);
    }
  }, [initialProfile]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
      setToastType('success');
      setToastMessage('✅ Perfil atualizado com sucesso!');
      window.dispatchEvent(new Event('refreshProfile'));
    } catch (error: any) {
      setToastType('error');
      setToastMessage(error.message || '❌ Erro ao atualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoSuccess = (fotoUrl: string) => {
    if (initialProfile) initialProfile.foto_url = fotoUrl;
    setToastType('success');
    setToastMessage('📸 Foto atualizada com sucesso!');
    window.dispatchEvent(new Event('refreshProfile'));
  };

  const handlePhotoError = (error: string) => {
    setToastType('error');
    setToastMessage(error || '❌ Erro ao fazer upload da foto');
  };

  const handleAccountDeleted = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/auth/login';
  };

  const maskCpfForDisplay = (cpf: string) => {
    if (!cpf) return '';
    const numbers = cpf.replace(/\D/g, '');
    if (numbers.length === 11) return `${numbers.slice(0, 2)}***.***-${numbers.slice(-2)}`;
    return cpf;
  };

  if (!initialProfile) {
    return (
      <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#E03673]" />
        Carregando perfil...
      </div>
    );
  }

  const fotoUrlCorrigida = initialProfile.foto_url?.replace('/pages/', '/patients/');
  const photoUrl = fotoUrlCorrigida ? `${BACKEND_URL}${fotoUrlCorrigida}` : undefined;
  const formattedBirthDate = formData.birth_date ? new Date(formData.birth_date).toISOString().split('T')[0] : '';

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Toast */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
          toastType === 'success' ? 'bg-green-600' : 'bg-red-600'
        } text-white`}>
          {toastType === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {(['profile', 'addresses', 'goals'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-[#E03673] text-[#E03673]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'profile' ? 'Perfil' : tab === 'addresses' ? 'Endereços' : 'Objetivos Terapêuticos'}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <PhotoUpload
                  currentPhotoUrl={photoUrl}
                  endpoint="/api/patient/profile/photo"
                  name={initialProfile.full_name}
                  onSuccess={handlePhotoSuccess}
                  onError={handlePhotoError}
                />
              </div>

              <div className="md:col-span-2">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
                    <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} required
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                    <input type="email" value={initialProfile.email} disabled
                      className="w-full p-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed" />
                    <p className="text-xs text-gray-400 mt-1">O e-mail não pode ser alterado aqui</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                      <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="(11) 99999-9999"
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                      <input type="text" name="cpf" value={formData.cpf} onChange={handleChange} placeholder="123.456.789-00"
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none" />
                      <p className="text-xs text-gray-400 mt-1">
                        Aparecerá como: {maskCpfForDisplay(formData.cpf) || "***.***.***-**"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-400" />Data de nascimento
                      </label>
                      <input type="date" name="birth_date" value={formattedBirthDate} onChange={handleChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <GraduationCap className="w-4 h-4 text-gray-400" />Nível de escolaridade
                      </label>
                      <select name="education_level" value={formData.education_level} onChange={handleChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none">
                        <option value="">Selecione...</option>
                        {educationLevels.map(level => <option key={level} value={level}>{level}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fuso horário</label>
                      <select name="timezone" value={formData.timezone} onChange={handleChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none">
                        <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
                        <option value="America/Manaus">Manaus (GMT-4)</option>
                        <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
                        <option value="America/Belem">Belém (GMT-3)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Idioma preferido</label>
                      <select name="preferred_language" value={formData.preferred_language} onChange={handleChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none">
                        <option value="pt-BR">Português (Brasil)</option>
                        <option value="en">English</option>
                        <option value="es">Español</option>
                      </select>
                    </div>
                  </div>

                  {/* Privacidade e LGPD */}
                  <div className="mt-2 p-4 bg-white rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-5 h-5 text-[#E03673]" />
                      <h3 className="text-base font-semibold">Privacidade e LGPD</h3>
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="lgpd_consent"
                        checked={formData.lgpd_consent}
                        onChange={handleChange}
                        className="h-5 w-5 text-[#E03673] rounded mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Autorizo o tratamento dos meus dados pessoais conforme a LGPD</p>
                        <p className="text-xs text-gray-500 mt-1">Seus dados serão utilizados apenas para fins de agendamento e atendimento terapêutico.</p>
                      </div>
                    </label>
                    {lgpdConsentDate && (
                      <p className="text-xs text-gray-400 mt-2">Consentimento registrado em {new Date(lgpdConsentDate).toLocaleDateString('pt-BR')}</p>
                    )}

                    {/* Exclusão de conta — colapsável */}
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setShowDeletionSection(!showDeletionSection)}
                        className="flex items-center justify-between w-full text-left text-sm text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-gray-400" />
                          Exclusão de conta e dados
                        </span>
                        {showDeletionSection
                          ? <ChevronUp className="w-4 h-4 text-gray-400" />
                          : <ChevronDown className="w-4 h-4 text-gray-400" />
                        }
                      </button>

                      {showDeletionSection && (
                        <div className="mt-3 p-4 bg-red-50 rounded-xl border border-red-200">
                          <div className="flex items-start gap-3 mb-4">
                            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-red-800">Esta ação é permanente e irreversível</p>
                              <p className="text-xs text-red-600 mt-1">
                                Ao excluir sua conta, todos os seus dados serão removidos permanentemente — incluindo perfil, histórico de sessões, mensagens e dados pessoais.
                                Registros fiscais podem ser mantidos por até 5 anos conforme a legislação brasileira.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowDeletionModal(true)}
                            className="w-full px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                          >
                            <Trash2 className="w-4 h-4" />
                            Quero excluir minha conta permanentemente
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4">
                    <button type="submit" disabled={saving}
                      className="w-full bg-[#E03673] hover:bg-[#c02c5e] text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : 'Salvar alterações'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>


        </div>
      )}

      {activeTab === 'addresses' && (
        <AddressList
          patientId={initialProfile.id}
          initialAddresses={initialProfile.addresses || []}
        />
      )}

      {activeTab === 'goals' && (
        <GoalsManager
          patientId={initialProfile.id}
          initialGoals={initialProfile.goals || []}
        />
      )}

      <AccountDeletionModal
        isOpen={showDeletionModal}
        onClose={() => setShowDeletionModal(false)}
        onDeleted={handleAccountDeleted}
        userEmail={userEmail || initialProfile.email || ""}
      />
    </div>
  );
}