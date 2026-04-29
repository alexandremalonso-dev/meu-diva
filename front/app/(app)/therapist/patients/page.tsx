"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { getFotoSrc } from '@/lib/utils';
import Link from "next/link";
import { 
  Users, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  DollarSign, 
  Star, 
  Search, 
  Filter, 
  XCircle, 
  CheckCircle,
  Loader2,
  AlertCircle,
  Eye,
  Lock,
  Unlock,
  ArrowLeft,
  TrendingUp
} from "lucide-react";

// 🔥 CONSTANTE BACKEND_URL PARA FOTOS
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Patient {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  phone?: string;
  session_count: number;
  last_session?: Date;
  is_blocked: boolean;
  total_spent?: number;
  foto_url?: string;
}

interface Session {
  id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  session_price: number;
}

export default function TherapistPatientsPage() {
  const { user } = useAuth();
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSessions, setPatientSessions] = useState<Session[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [blockLoading, setBlockLoading] = useState<Record<number, boolean>>({});

  // ESTADOS PARA FILTROS
  const [filterName, setFilterName] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "blocked">("all");
  const [filterMinSessions, setFilterMinSessions] = useState("");
  const [filterMaxSessions, setFilterMaxSessions] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allPatients, filterName, filterStatus, filterMinSessions, filterMaxSessions, filterDateFrom, filterDateTo]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      
      console.log('📥 Carregando appointments...');
      const appointmentsData = await api("/api/appointments/me/details");
      console.log('📥 Appointments carregados:', appointmentsData.length);
      
      console.log('📥 Carregando pacientes...');
      const patientsData = await api("/api/patients");
      console.log('📥 Pacientes carregados:', patientsData.length);
      
      const patientMap = new Map<number, Patient>();
      
      patientsData.forEach((p: any) => {
        patientMap.set(p.id, {
          id: p.id,
          user_id: p.id,
          full_name: p.full_name || p.email,
          email: p.email,
          phone: p.phone,
          session_count: 0,
          total_spent: 0,
          is_blocked: false,
          foto_url: p.foto_url
        });
      });
      
      console.log('📋 Mapa de pacientes criado com IDs:', Array.from(patientMap.keys()));
      console.log('👤 Usuário logado (terapeuta):', user?.id, user?.email);
      
      const validStatuses = ['confirmed', 'completed'];
      
      appointmentsData.forEach((apt: any) => {
        if (apt.therapist_user_id === user?.id) {
          if (validStatuses.includes(apt.status)) {
            const patientId = apt.patient_user_id;
            const patient = patientMap.get(patientId);
            
            if (patient) {
              patient.session_count++;
              patient.total_spent = (patient.total_spent || 0) + (apt.session_price || 0);
              
              const aptDate = new Date(apt.starts_at);
              if (!patient.last_session || aptDate > patient.last_session) {
                patient.last_session = aptDate;
              }
            }
          }
        }
      });
      
      const patientsList = Array.from(patientMap.values())
        .filter(p => p.session_count > 0)
        .sort((a, b) => b.session_count - a.session_count);
      
      console.log(`✅ ${patientsList.length} pacientes com sessões confirmadas encontrados`);
      
      setAllPatients(patientsList);
      setFilteredPatients(patientsList);
      
    } catch (err: any) {
      console.error("Erro ao carregar pacientes:", err);
      setError(err.message || "Erro ao carregar pacientes");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allPatients];

    if (filterName.trim()) {
      const searchTerm = filterName.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.full_name.toLowerCase().includes(searchTerm) ||
        p.email.toLowerCase().includes(searchTerm)
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter(p => 
        filterStatus === "active" ? !p.is_blocked : p.is_blocked
      );
    }

    if (filterMinSessions) {
      const min = parseInt(filterMinSessions);
      filtered = filtered.filter(p => p.session_count >= min);
    }

    if (filterMaxSessions) {
      const max = parseInt(filterMaxSessions);
      filtered = filtered.filter(p => p.session_count <= max);
    }

    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(p => p.last_session && new Date(p.last_session) >= fromDate);
    }

    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(p => p.last_session && new Date(p.last_session) <= toDate);
    }

    setFilteredPatients(filtered);
  };

  const clearFilters = () => {
    setFilterName("");
    setFilterStatus("all");
    setFilterMinSessions("");
    setFilterMaxSessions("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const loadPatientSessions = async (patientId: number) => {
    try {
      const appointmentsData = await api("/api/appointments/me/details");
      
      const sessions = appointmentsData
        .filter((apt: any) => 
          apt.therapist_user_id === user?.id && 
          apt.patient_user_id === patientId
        )
        .sort((a: any, b: any) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
      
      setPatientSessions(sessions);
    } catch (err: any) {
      console.error("Erro ao carregar sessões do paciente:", err);
    }
  };

  const handlePatientClick = async (patient: Patient) => {
    setSelectedPatient(patient);
    await loadPatientSessions(patient.id);
    setShowSessions(true);
  };

  const handleBlockPatient = async (patientId: number) => {
    if (!confirm("Tem certeza que deseja bloquear este paciente?")) return;
    
    setBlockLoading(prev => ({ ...prev, [patientId]: true }));
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setAllPatients(prev => prev.map(p => p.id === patientId ? { ...p, is_blocked: true } : p));
      setSuccess("Paciente bloqueado com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Erro ao bloquear paciente");
    } finally {
      setBlockLoading(prev => ({ ...prev, [patientId]: false }));
    }
  };

  const handleUnblockPatient = async (patientId: number) => {
    if (!confirm("Tem certeza que deseja desbloquear este paciente?")) return;
    
    setBlockLoading(prev => ({ ...prev, [patientId]: true }));
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setAllPatients(prev => prev.map(p => p.id === patientId ? { ...p, is_blocked: false } : p));
      setSuccess("Paciente desbloqueado com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Erro ao desbloquear paciente");
    } finally {
      setBlockLoading(prev => ({ ...prev, [patientId]: false }));
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR") + " às " + date.toLocaleTimeString("pt-BR").slice(0, 5);
  };

  const formatCurrency = (value: number) => {
    if (value === null || value === undefined || isNaN(value)) {
      return "R$ 0,00";
    }
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getStatusText = (status: string) => {
    if (status === "scheduled") return "Agendada";
    if (status === "confirmed") return "Confirmada";
    if (status === "completed") return "Realizada";
    if (status.includes("cancelled")) return "Cancelada";
    if (status === "rescheduled") return "Reagendada";
    return status;
  };

  // 🔥 CORREÇÃO: REMOVER MAINLAYOUT
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
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {filteredPatients.length} pacientes
            </span>
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
        
        {success && (
          <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}

        {/* SEÇÃO DE FILTROS */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                <Search className="w-3 h-3" />
                Buscar paciente
              </label>
              <input
                type="text"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="Nome ou email..."
                className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent"
              />
            </div>

            <div className="w-32">
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673]"
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="blocked">Bloqueados</option>
              </select>
            </div>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-4 py-2 text-sm rounded-lg flex items-center gap-2 transition-colors ${
                showAdvancedFilters || filterMinSessions || filterMaxSessions || filterDateFrom || filterDateTo
                  ? 'bg-[#E03673]/10 text-[#E03673] border border-[#E03673]/30'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-3 h-3" />
              Avançado
            </button>

            {(filterName || filterStatus !== "all" || filterMinSessions || filterMaxSessions || filterDateFrom || filterDateTo) && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
                title="Limpar todos os filtros"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {showAdvancedFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mín. sessões</label>
                <input
                  type="number"
                  value={filterMinSessions}
                  onChange={(e) => setFilterMinSessions(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full p-2 text-sm border border-gray-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Máx. sessões</label>
                <input
                  type="number"
                  value={filterMaxSessions}
                  onChange={(e) => setFilterMaxSessions(e.target.value)}
                  placeholder="100"
                  min="0"
                  className="w-full p-2 text-sm border border-gray-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Última sessão de</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full p-2 text-sm border border-gray-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Última sessão até</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  min={filterDateFrom}
                  className="w-full p-2 text-sm border border-gray-200 rounded-lg"
                />
              </div>
            </div>
          )}
        </div>

        {/* Lista de pacientes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paciente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Contato</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sessões</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Total gasto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Última sessão</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      Nenhum paciente com sessões confirmadas encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white font-bold">
                            {patient.foto_url ? (
                              <img 
                                src={getFotoSrc(patient.foto_url) ?? ""} 
                                alt={patient.full_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5" />
                            )}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{patient.full_name}</div>
                            <div className="text-xs text-gray-500">ID: {patient.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Mail className="w-3 h-3 text-gray-400" />
                          {patient.email}
                        </div>
                        {patient.phone && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                            <Phone className="w-3 h-3 text-gray-400" />
                            {patient.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          <Star className="w-3 h-3" />
                          {patient.session_count} sessões
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-gray-400" />
                          {formatCurrency(patient.total_spent || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                        {patient.last_session ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            {formatDate(patient.last_session.toString())}
                          </div>
                        ) : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {patient.is_blocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            <Lock className="w-3 h-3" />
                            Bloqueado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3" />
                            Ativo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => handlePatientClick(patient)} 
                          className="text-[#2F80D3] hover:text-[#236bb3] mr-3 transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          Ver sessões
                        </button>
                        {patient.is_blocked ? (
                          <button 
                            onClick={() => handleUnblockPatient(patient.id)} 
                            disabled={blockLoading[patient.id]} 
                            className="text-green-600 hover:text-green-700 disabled:opacity-50 transition-colors inline-flex items-center gap-1"
                          >
                            {blockLoading[patient.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                            Desbloquear
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleBlockPatient(patient.id)} 
                            disabled={blockLoading[patient.id]} 
                            className="text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors inline-flex items-center gap-1"
                          >
                            {blockLoading[patient.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                            Bloquear
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de histórico de sessões */}
        {showSessions && selectedPatient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-xl">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">{selectedPatient.full_name}</h2>
                      <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500" />
                          {selectedPatient.session_count} sessões
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {formatCurrency(selectedPatient.total_spent || 0)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowSessions(false)} 
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
                {patientSessions.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Nenhuma sessão encontrada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {patientSessions.map((session) => (
                      <div key={session.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">{formatDate(session.starts_at)}</span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            session.status === "completed" ? "bg-green-100 text-green-800" :
                            session.status.includes("cancelled") ? "bg-red-100 text-red-800" :
                            session.status === "confirmed" ? "bg-blue-100 text-blue-800" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {getStatusText(session.status)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <DollarSign className="w-3 h-3 text-gray-400" />
                          Valor: {formatCurrency(session.session_price)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t border-gray-100 bg-gray-50">
                <button 
                  onClick={() => setShowSessions(false)} 
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}