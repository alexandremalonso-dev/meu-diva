'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Mail, Calendar, DollarSign, MessageSquare, Mail as MailIcon, Lock, Save, Loader2, ArrowLeft, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/contexts/AuthContext';

interface Preferences {
  email_notifications_enabled: boolean;
  email_preferences: {
    appointment_created: boolean;
    appointment_confirmed: boolean;
    appointment_cancelled: boolean;
    appointment_rescheduled: boolean;
    payment_received: boolean;
    invite_received: boolean;
    email_changed: boolean;
    password_reset: boolean;
  };
}

const eventOptions = [
  { id: 'appointment_created', label: 'Novo convite de sessão', icon: MessageSquare, description: 'Quando um terapeuta te convida para uma sessão' },
  { id: 'appointment_confirmed', label: 'Sessão confirmada', icon: CheckCircle, description: 'Quando uma sessão é confirmada pelo paciente' },
  { id: 'appointment_cancelled', label: 'Sessão cancelada', icon: XCircle, description: 'Quando uma sessão é cancelada' },
  { id: 'appointment_rescheduled', label: 'Sessão reagendada', icon: RefreshCw, description: 'Quando uma sessão é reagendada' },
  { id: 'payment_received', label: 'Pagamento confirmado', icon: DollarSign, description: 'Quando um pagamento é processado' },
  { id: 'invite_received', label: 'Convite recebido', icon: Mail, description: 'Quando você recebe um convite' },
  { id: 'email_changed', label: 'Alteração de e-mail', icon: MailIcon, description: 'Quando seu e-mail é alterado' },
  { id: 'password_reset', label: 'Redefinição de senha', icon: Lock, description: 'Quando sua senha é alterada' },
];

export default function PreferencesPage() {
  const { execute: apiCall } = useApi();
  const { user } = useAuth();
  const router = useRouter();
  
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCall({
        url: '/api/notifications/preferences',
        requireAuth: true
      });
      setPreferences(data);
    } catch (error) {
      console.error('Erro ao carregar preferências:', error);
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user, loadPreferences]);

  const updateEmailEnabled = (enabled: boolean) => {
    if (preferences) {
      setPreferences({
        ...preferences,
        email_notifications_enabled: enabled
      });
    }
  };

  const updateEmailPreference = (key: keyof Preferences['email_preferences'], value: boolean) => {
    if (preferences) {
      setPreferences({
        ...preferences,
        email_preferences: {
          ...preferences.email_preferences,
          [key]: value
        }
      });
    }
  };

  const savePreferences = async () => {
    if (!preferences) return;
    
    setSaving(true);
    setSuccess(false);
    
    try {
      await apiCall({
        url: '/api/notifications/preferences',
        method: 'PUT',
        body: {
          email_notifications_enabled: preferences.email_notifications_enabled,
          email_preferences: preferences.email_preferences
        },
        requireAuth: true
      });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
      alert('Erro ao salvar preferências. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Preferências de Notificação</h1>
          <p className="text-sm text-gray-500">
            Gerencie como e quando você recebe notificações
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#E03673]/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-[#E03673]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Notificações no Dashboard</h3>
            <p className="text-sm text-gray-500 mt-1">
              Você sempre receberá notificações no ícone de sino dentro do sistema. 
              Esta opção não pode ser desativada.
            </p>
            <div className="mt-3 inline-flex items-center gap-2 px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">
              <CheckCircle className="w-3 h-3" />
              Sempre ativo
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-[#2F80D3]/5 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#2F80D3]/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#2F80D3]" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Notificações por E-mail</h3>
                <p className="text-sm text-gray-500">
                  Receba notificações também no seu e-mail
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences?.email_notifications_enabled ?? true}
                onChange={(e) => updateEmailEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#E03673]/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E03673]"></div>
              <span className="ms-3 text-sm font-medium text-gray-700">
                {preferences?.email_notifications_enabled ? 'Ativado' : 'Desativado'}
              </span>
            </label>
          </div>
        </div>

        {preferences?.email_notifications_enabled && (
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Selecione quais eventos você deseja receber por e-mail:
            </p>
            <div className="space-y-3">
              {eventOptions.map((option) => {
                const Icon = option.icon;
                const isEnabled = preferences?.email_preferences?.[option.id as keyof typeof preferences.email_preferences] ?? true;
                
                return (
                  <div
                    key={option.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{option.label}</p>
                        <p className="text-xs text-gray-400">{option.description}</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => updateEmailPreference(option.id as keyof typeof preferences.email_preferences, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#E03673]/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#E03673]"></div>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!preferences?.email_notifications_enabled && (
          <div className="p-6 text-center text-gray-400">
            <Mail className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Notificações por e-mail estão desativadas</p>
            <p className="text-xs mt-1">Ative para escolher quais eventos deseja receber</p>
          </div>
        )}
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={savePreferences}
          disabled={saving}
          className="bg-gradient-to-r from-[#E03673] to-[#E03673]/80 hover:from-[#c02c5e] hover:to-[#E03673] text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : 'Salvar preferências'}
        </button>
      </div>

      {success && (
        <div className="fixed bottom-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          Preferências salvas com sucesso!
        </div>
      )}
    </div>
  );
}