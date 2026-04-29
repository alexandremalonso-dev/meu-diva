"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Loader2, AlertCircle, Search, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Patient = {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  phone?: string;
  session_count: number;
  last_session?: Date;
  is_frequent: boolean;
  is_blocked: boolean;
  foto_url?: string;
};

export default function TherapistPatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    filterPatients();
  }, [patients, searchTerm]);

  async function loadPatients() {
    try {
      const data = await api("/api/patients");
      const patientsList = Array.isArray(data) ? data : [];
      
      const processedPatients = patientsList.map((p: any) => ({
        ...p,
        session_count: p.session_count || 0,
        is_frequent: (p.session_count || 0) >= 3,
        is_blocked: p.is_blocked || false,
      }));
      
      processedPatients.sort((a: Patient, b: Patient) => b.session_count - a.session_count);
      
      setPatients(processedPatients);
      setFilteredPatients(processedPatients);
    } catch (err) {
      setError("Erro ao carregar pacientes");
    } finally {
      setLoading(false);
    }
  }

  function filterPatients() {
    if (!searchTerm.trim()) {
      setFilteredPatients(patients);
      return;
    }
    
    const term = searchTerm.toLowerCase().trim();
    const filtered = patients.filter(p => 
      p.full_name?.toLowerCase().includes(term) ||
      p.email?.toLowerCase().includes(term) ||
      p.phone?.includes(term)
    );
    setFilteredPatients(filtered);
  }

  async function handleBlockPatient(patientId: number) {
    if (!confirm("Tem certeza que deseja bloquear este paciente?")) return;
    
    setActionLoading(prev => ({ ...prev, [patientId]: true }));
    try {
      await api(`/api/therapist/patients/${patientId}/block`, { method: "POST" });
      
      setPatients(prev => prev.map(p => 
        p.id === patientId ? { ...p, is_blocked: true } : p
      ));
      
    } catch (err) {
      setError("Erro ao bloquear paciente");
      setTimeout(() => setError(""), 3000);
    } finally {
      setActionLoading(prev => ({ ...prev, [patientId]: false }));
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* MENSAGEM DE BOAS-VINDAS */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-[#E03673]" />
            <h1 className="text-2xl font-bold text-gray-900">Meus Pacientes</h1>
          </div>
          <Link
            href="/therapist/dashboard"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao dashboard
          </Link>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Gerencie seus pacientes e histórico de sessões
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Busca */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, email ou telefone..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-2xl font-bold text-gray-900">{patients.length}</p>
            <p className="text-sm text-gray-500">Total de pacientes</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-2xl font-bold text-gray-900">
              {patients.filter(p => p.is_frequent).length}
            </p>
            <p className="text-sm text-gray-500">Pacientes frequentes</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-2xl font-bold text-gray-900">
              {patients.filter(p => p.is_blocked).length}
            </p>
            <p className="text-sm text-gray-500">Pacientes bloqueados</p>
          </div>
        </div>

        {/* Lista de pacientes */}
        {filteredPatients.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhum paciente encontrado</p>
            {searchTerm && (
              <p className="text-sm text-gray-400 mt-1">
                Tente ajustar sua busca
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {filteredPatients.map((patient) => (
                <div key={patient.id} className="p-4 hover:bg-[#F9F5FF] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white font-bold text-sm">
                        {patient.full_name?.charAt(0).toUpperCase() || patient.email?.charAt(0).toUpperCase() || 'P'}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-900">
                            {patient.full_name || patient.email}
                          </p>
                          {patient.is_frequent && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-[#F59E0B] bg-[#FEF3C7] px-1.5 py-0.5 rounded-full">
                              ⭐ Frequente
                            </span>
                          )}
                          {patient.is_blocked && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                              🚫 Bloqueado
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
                          <span>{patient.email}</span>
                          {patient.phone && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span>{patient.phone}</span>
                            </>
                          )}
                          <span className="text-gray-300">•</span>
                          <span>
                            {patient.session_count} {patient.session_count === 1 ? 'sessão' : 'sessões'}
                          </span>
                          {patient.last_session && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span>
                                Última: {new Date(patient.last_session).toLocaleDateString('pt-BR')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {!patient.is_blocked && (
                      <button
                        onClick={() => handleBlockPatient(patient.id)}
                        disabled={actionLoading[patient.id]}
                        className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading[patient.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Bloquear"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}