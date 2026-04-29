"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { PatientProfile } from '@/types/patient';
import { ProfileForm } from '@/components/patient/profile/ProfileForm';
import { User, Loader2, AlertCircle, IdCard, Mail } from 'lucide-react';
import { EmailChangeModal } from '@/components/ui/EmailChangeModal';

type UserData = {
  id: number;
  formatted_id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export default function PatientProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const loadUserData = async () => {
    try {
      const data = await api('/api/users/me');
      setUserData(data);
    } catch (err: any) {
      console.error('Erro ao carregar dados do usuário:', err);
    }
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await api('/api/patient/profile');
      setProfile(data);
      setError(null);
    } catch (err: any) {
      console.error('Erro ao carregar perfil:', err);
      setError(err.message || 'Erro ao carregar perfil');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
    loadProfile();
  }, []);

  const handleSaveProfile = async (profileData: Partial<PatientProfile>) => {
    try {
      const updated = await api('/api/patient/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });
      setProfile(updated);
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao salvar perfil');
    }
  };

  const handleEmailChangeSuccess = (newEmail: string) => {
    setUserData(prev => prev ? { ...prev, email: newEmail } : null);
    loadUserData();
  };

  const formatBirthDate = (birthDate: string | null) => {
    if (!birthDate) return "Não informada";
    return new Date(birthDate).toLocaleDateString('pt-BR');
  };

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-red-50 text-red-700 p-6 rounded-xl border border-red-200">
          <div className="flex items-center gap-3 mb-3">
            <AlertCircle className="w-5 h-5" />
            <p className="font-medium">Erro ao carregar perfil</p>
          </div>
          <p className="text-sm mb-4">{error}</p>
          <button onClick={loadProfile} className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-lg text-sm transition-colors">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const age = profile?.birth_date ? calculateAge(profile.birth_date) : null;

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center gap-2">
          <User className="w-6 h-6 text-[#E03673]" />
          <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
        </div>
        <p className="text-sm text-gray-600 mt-1">Gerencie suas informações pessoais</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {userData && (
          <div className="mb-6 bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <IdCard className="w-4 h-4 text-[#E03673]" />
              <h3 className="text-sm font-medium text-gray-700">Identificação</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">ID do usuário</p>
                <p className="text-sm font-mono font-medium text-gray-900">{userData.formatted_id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Tipo de conta</p>
                <p className="text-sm font-medium text-gray-900 capitalize">{userData.role}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-gray-500">E-mail</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm font-medium text-gray-900 flex-1">{userData.email}</p>
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Mail className="w-3 h-3" />
                    Alterar e-mail
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500">Cadastrado em</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(userData.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>

            {profile && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-xs font-medium text-gray-500 mb-3">Dados pessoais</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-gray-400">CPF</p>
                    <p className="text-sm font-medium text-gray-900">
                      {profile.cpf ? (() => {
                        const numbers = profile.cpf.replace(/\D/g, '');
                        if (numbers.length === 11) return `${numbers.slice(0, 2)}***.***-${numbers.slice(-2)}`;
                        return profile.cpf;
                      })() : "Não informado"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Data de nascimento</p>
                    <p className="text-sm font-medium text-gray-900">{formatBirthDate(profile.birth_date || null)}</p>
                  </div>
                  {age !== null && (
                    <div>
                      <p className="text-xs text-gray-400">Idade</p>
                      <p className="text-sm font-medium text-gray-900">{age} anos</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {profile && (
          <ProfileForm
            initialProfile={profile}
            onSave={handleSaveProfile}
            userEmail={userData?.email || user?.email || ""}
          />
        )}
      </div>

      <EmailChangeModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        currentEmail={userData?.email || user?.email || ""}
        onSuccess={handleEmailChangeSuccess}
      />
    </>
  );
}