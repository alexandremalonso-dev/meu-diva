"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type UserProfile = {
  id: number;
  email: string;
  full_name?: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await api("/api/profile");
        setProfile(data);
        setFullName(data.full_name || "");
      } catch (error) {
        console.error("Erro ao carregar perfil:", error);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const updated = await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ full_name: fullName })
      });
      setProfile(updated);
      setFullName(updated.full_name || "");
      setSuccess("Perfil atualizado com sucesso!");
      setEditing(false);
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8">Carregando...</div>;
  }

  if (!profile) {
    return <div className="p-8 text-red-500">Erro ao carregar perfil</div>;
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Meu Perfil</h1>

      <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl">
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

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <p className="text-gray-900 bg-gray-50 p-2 rounded">{profile.email}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
            <p className="text-gray-900 bg-gray-50 p-2 rounded capitalize">{profile.role}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Membro desde</label>
            <p className="text-gray-900 bg-gray-50 p-2 rounded">{formatDate(profile.created_at)}</p>
          </div>

          {editing ? (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-black"
                  placeholder="Seu nome"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
              <div className="flex items-center gap-3">
                <p className="text-gray-900 bg-gray-50 p-2 rounded flex-1">
                  {profile.full_name || "Não informado"}
                </p>
                <button
                  onClick={() => setEditing(true)}
                  className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
                >
                  Editar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}