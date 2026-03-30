"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

type Appointment = {
  id: number;
  therapist_user_id: number;
  patient_user_id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  therapist?: { email: string; full_name?: string };
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState({
    upcoming: 0,
    completed: 0,
    cancelled: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await api("/api/appointments");
        const patientAppointments = data.filter(
          (apt: Appointment) => apt.patient_user_id === user?.id
        );
        setAppointments(patientAppointments);

        const now = new Date();
        const upcoming = patientAppointments.filter(
          (apt: Appointment) => 
            new Date(apt.starts_at) > now && 
            ["scheduled", "confirmed"].includes(apt.status)
        ).length;

        const completed = patientAppointments.filter(
          (apt: Appointment) => apt.status === "completed"
        ).length;

        const cancelled = patientAppointments.filter(
          (apt: Appointment) => apt.status.includes("cancelled")
        ).length;

        setStats({
          upcoming,
          completed,
          cancelled,
          total: patientAppointments.length,
        });
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR") + " às " + date.toLocaleTimeString("pt-BR").slice(0, 5);
  };

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Olá, {user?.full_name || user?.email}!</h1>
      <p className="text-gray-600 mb-6">Bem-vindo ao seu painel</p>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Próximas sessões</p>
          <p className="text-2xl font-bold text-blue-600">{stats.upcoming}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Realizadas</p>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Canceladas</p>
          <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">Total de sessões</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link
          href="/calendar"
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold mb-2">📅 Agendar nova sessão</h3>
          <p className="text-blue-100">Escolha um terapeuta e horário disponível</p>
        </Link>
        <Link
          href="/appointments"
          className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold mb-2">📋 Minhas sessões</h3>
          <p className="text-purple-100">Visualize e gerencie seus agendamentos</p>
        </Link>
      </div>

      {/* Próximas sessões */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Próximas sessões</h2>
        {appointments.length === 0 ? (
          <p className="text-gray-500">Nenhuma sessão agendada.</p>
        ) : (
          <div className="space-y-3">
            {appointments
              .filter((apt) => new Date(apt.starts_at) > new Date())
              .slice(0, 5)
              .map((apt) => (
                <div key={apt.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{formatDate(apt.starts_at)}</p>
                      <p className="text-sm text-gray-600">
                        Terapeuta: {apt.therapist?.full_name || apt.therapist?.email || `ID ${apt.therapist_user_id}`}
                      </p>
                      <p className="text-sm">
                        Status:{" "}
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            apt.status === "scheduled"
                              ? "bg-green-100 text-green-800"
                              : apt.status === "confirmed"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {apt.status === "scheduled"
                            ? "Agendada"
                            : apt.status === "confirmed"
                            ? "Confirmada"
                            : apt.status}
                        </span>
                      </p>
                    </div>
                    {apt.status === "scheduled" && (
                      <Link
                        href={`/appointments?cancel=${apt.id}`}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Cancelar
                      </Link>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}