"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type TherapistProfile = {
  id: number;
  user_id: number;
  bio: string | null;
  specialties: string | null;
  session_price: number | null;
  user?: {
    full_name: string;
    email: string;
  };
};

export default function TherapistProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<TherapistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [formData, setFormData] = useState({
    full_name: "",
    bio: "",
    specialties: "",
    session_price: ""
  });

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await api("/api/therapists/me/profile");
        setProfile(data);
        setFormData({
          full_name: data.user?.full_name || user?.full_name || "",
          bio: data.bio || "",
          specialties: data.specialties || "",
          session_price: data.session_price?.toString() || ""
        });
      } catch (error) {
        console.error("Erro ao carregar perfil:", error);
        setError("Erro ao carregar perfil");
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (formData.full_name !== user?.full_name) {
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name: formData.full_name })
        });
      }

      const response = await fetch("/api/therapists/me/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: formData.bio,
          specialties: formData.specialties,
          session_price: formData.session_price ? Number(formData.session_price) : null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.detail || "Erro ao salvar perfil");
      }

      setSuccess("Perfil atualizado com sucesso!");
      setProfile(data);
      
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      setError(err.message || "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Perfil Profissional</h1>

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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Informações Básicas</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome completo
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-black"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ""}
                className="w-full p-2 border rounded bg-gray-50"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">O email não pode ser alterado</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Perfil Profissional</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bio / Descrição
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={4}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-black"
                placeholder="Conte um pouco sobre sua formação, abordagem, experiência..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Especialidades
              </label>
              <input
                type="text"
                value={formData.specialties}
                onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-black"
                placeholder="Ex: Psicanálise, TCC, Terapia de Casal (separar por vírgula)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preço da sessão (R$)
              </label>
              <input
                type="number"
                value={formData.session_price}
                onChange={(e) => setFormData({ ...formData, session_price: e.target.value })}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-black"
                placeholder="150"
                min="0"
                step="10"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-6 py-2 border rounded hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}