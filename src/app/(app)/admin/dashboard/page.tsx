"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

type User = {
  id: number;
  email: string;
  role: string;
  full_name?: string;
  is_active: boolean;
  created_at: string;
};

type Appointment = {
  id: number;
  patient_user_id: number;
  therapist_user_id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  session_price?: number;
};

type Stats = {
  totalUsers: number;
  totalTherapists: number;
  totalPatients: number;
  totalAppointments: number;
  scheduledAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  revenue: number;
  activeUsers: number;
};

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalTherapists: 0,
    totalPatients: 0,
    totalAppointments: 0,
    scheduledAppointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    revenue: 0,
    activeUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [usersData, appointmentsData] = await Promise.all([
          api("/api/users"),
          api("/api/appointments"),
        ]);

        setUsers(usersData);
        setAppointments(appointmentsData);

        const therapists = usersData.filter((u: User) => u.role === "therapist").length;
        const patients = usersData.filter((u: User) => u.role === "patient").length;
        const active = usersData.filter((u: User) => u.is_active).length;

        const scheduled = appointmentsData.filter(
          (apt: Appointment) => apt.status === "scheduled"
        ).length;
        
        const completed = appointmentsData.filter(
          (apt: Appointment) => apt.status === "completed"
        ).length;
        
        const cancelled = appointmentsData.filter(
          (apt: Appointment) => apt.status.includes("cancelled")
        ).length;

        const revenue = appointmentsData
          .filter((apt: Appointment) => 
            ["scheduled", "confirmed", "completed"].includes(apt.status)
          )
          .reduce((sum, apt) => sum + (apt.session_price || 150), 0);

        setStats({
          totalUsers: usersData.length,
          totalTherapists: therapists,
          totalPatients: patients,
          totalAppointments: appointmentsData.length,
          scheduledAppointments: scheduled,
          completedAppointments: completed,
          cancelledAppointments: cancelled,
          revenue,
          activeUsers: active,
        });
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        setError("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Olá, {user?.full_name || user?.email}!</h1>
        <p className="text-gray-600">Painel Administrativo</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Total de usuários</p>
          <p className="text-3xl font-bold text-blue-600">{stats.totalUsers}</p>
          <p className="text-xs text-gray-400 mt-1">{stats.activeUsers} ativos</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Terapeutas</p>
          <p className="text-3xl font-bold text-green-600">{stats.totalTherapists}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Pacientes</p>
          <p className="text-3xl font-bold text-purple-600">{stats.totalPatients}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Total de sessões</p>
          <p className="text-3xl font-bold text-gray-800">{stats.totalAppointments}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Agendadas</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.scheduledAppointments}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Realizadas</p>
          <p className="text-2xl font-bold text-green-600">{stats.completedAppointments}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Canceladas</p>
          <p className="text-2xl font-bold text-red-600">{stats.cancelledAppointments}</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-6 rounded-lg shadow mb-8">
        <p className="text-sm opacity-90">Receita total</p>
        <p className="text-4xl font-bold">R$ {stats.revenue.toFixed(2)}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link
          href="/admin/users"
          className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow border-l-4 border-blue-500"
        >
          <h3 className="text-lg font-semibold mb-2">👥 Gerenciar usuários</h3>
          <p className="text-sm text-gray-600">Visualize, edite e gerencie todos os usuários</p>
        </Link>
        
        <Link
          href="/admin/sessions"
          className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow border-l-4 border-green-500"
        >
          <h3 className="text-lg font-semibold mb-2">📋 Todas as sessões</h3>
          <p className="text-sm text-gray-600">Acompanhe todos os agendamentos do sistema</p>
        </Link>
        
        <Link
          href="/admin/reports"
          className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow border-l-4 border-purple-500"
        >
          <h3 className="text-lg font-semibold mb-2">📊 Relatórios</h3>
          <p className="text-sm text-gray-600">Métricas e análises detalhadas</p>
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Últimos usuários cadastrados</h2>
          <Link href="/admin/users" className="text-sm text-blue-600 hover:text-blue-800">
            Ver todos
          </Link>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Perfil</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.slice(0, 5).map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.full_name || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.role === "admin" ? "bg-purple-100 text-purple-800" :
                      user.role === "therapist" ? "bg-green-100 text-green-800" :
                      "bg-blue-100 text-blue-800"
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}>
                      {user.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}