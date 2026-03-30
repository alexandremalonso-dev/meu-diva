"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type Availability = {
  id: number;
  therapist_profile_id: number;
  weekday: number;
  start_time: string;
  end_time: string;
};

const weekdays = [
  "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"
];

export default function TherapistAvailabilityPage() {
  const { user } = useAuth();
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Availability>>({});
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadAvailabilities();
  }, []);

  async function loadAvailabilities() {
    try {
      const data = await api("/api/therapist/availability");
      setAvailabilities(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar disponibilidades:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveAvailability(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      if (editing.id) {
        await api(`/api/therapist/availability/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(editing)
        });
        setSuccess("Disponibilidade atualizada!");
      } else {
        await api("/api/therapist/availability", {
          method: "POST",
          body: JSON.stringify(editing)
        });
        setSuccess("Disponibilidade criada!");
      }
      setShowForm(false);
      setEditing({});
      loadAvailabilities();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar");
    }
  }

  async function deleteAvailability(id: number) {
    if (!confirm("Remover esta disponibilidade?")) return;
    
    try {
      await api(`/api/therapist/availability/${id}`, {
        method: "DELETE"
      });
      loadAvailabilities();
    } catch (err: any) {
      setError(err.message || "Erro ao remover");
    }
  }

  function addTimeSlot() {
    setEditing({
      weekday: 1,
      start_time: "09:00",
      end_time: "10:00"
    });
    setShowForm(true);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Minha Disponibilidade</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded border border-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded border border-green-200">
          {success}
        </div>
      )}

      <button
        onClick={addTimeSlot}
        className="mb-6 bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
      >
        + Adicionar horário
      </button>

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <div className="space-y-4">
          {availabilities.length === 0 ? (
            <p className="text-gray-500">Nenhuma disponibilidade cadastrada.</p>
          ) : (
            availabilities.map((av) => (
              <div key={av.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
                <div>
                  <p className="font-medium">{weekdays[av.weekday]}</p>
                  <p className="text-sm text-gray-600">
                    {av.start_time.substring(0, 5)} - {av.end_time.substring(0, 5)}
                  </p>
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => {
                      setEditing(av);
                      setShowForm(true);
                    }}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => deleteAvailability(av.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal de edição */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">
              {editing.id ? "Editar" : "Nova"} Disponibilidade
            </h3>
            
            <form onSubmit={saveAvailability} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Dia da semana</label>
                <select
                  value={editing.weekday}
                  onChange={(e) => setEditing({ ...editing, weekday: Number(e.target.value) })}
                  className="w-full p-2 border rounded"
                  required
                >
                  {weekdays.map((day, index) => (
                    <option key={index} value={index}>{day}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Início</label>
                  <input
                    type="time"
                    value={editing.start_time}
                    onChange={(e) => setEditing({ ...editing, start_time: e.target.value })}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fim</label>
                  <input
                    type="time"
                    value={editing.end_time}
                    onChange={(e) => setEditing({ ...editing, end_time: e.target.value })}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}