"use client";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function Sidebar() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <aside className="w-64 bg-white border-r shadow-sm h-full flex flex-col">
      <div className="p-6 text-xl font-bold border-b">Meu Divã</div>
      
      <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
        {/* PACIENTE */}
        {user.role === "patient" && (
          <>
            <Link 
              href="/dashboard" 
              className="block p-2 rounded hover:bg-gray-100 transition-colors font-medium bg-gray-50"
            >
              📊 Dashboard
            </Link>
            <Link 
              href="/calendar" 
              className="block p-2 rounded hover:bg-gray-100 transition-colors"
            >
              📅 Agendar
            </Link>
            <Link 
              href="/wallet" 
              className="block p-2 rounded hover:bg-gray-100 transition-colors"
            >
              💰 Carteira
            </Link>
            <Link 
              href="/profile" 
              className="block p-2 rounded hover:bg-gray-100 transition-colors"
            >
              👤 Perfil
            </Link>
          </>
        )}

        {/* TERAPEUTA */}
        {user.role === "therapist" && (
          <>
            <Link 
              href="/therapist/dashboard" 
              className="block p-2 rounded hover:bg-gray-100 transition-colors font-medium bg-gray-50"
            >
              📊 Meu Dashboard
            </Link>
            
            <div className="border-t my-3"></div>
            <p className="text-xs text-gray-500 uppercase px-2 mb-1">Agenda</p>
            
            <Link 
              href="/therapist/availability" 
              className="block p-2 rounded hover:bg-gray-100 transition-colors pl-4"
            >
              ⚙️ Minha Disponibilidade
            </Link>
            <Link 
              href="/calendar" 
              className="block p-2 rounded hover:bg-gray-100 transition-colors pl-4"
            >
              📆 Agendar para paciente
            </Link>
            
            <div className="border-t my-3"></div>
            <p className="text-xs text-gray-500 uppercase px-2 mb-1">Perfil</p>
            
            <Link 
              href="/therapist/profile" 
              className="block p-2 rounded hover:bg-gray-100 transition-colors pl-4"
            >
              🏥 Perfil Profissional
            </Link>
            <Link 
              href="/profile" 
              className="block p-2 rounded hover:bg-gray-100 transition-colors pl-4"
            >
              👤 Dados Pessoais
            </Link>
            
            <div className="border-t my-3"></div>
            <p className="text-xs text-gray-500 uppercase px-2 mb-1">Financeiro</p>
            
            <Link 
              href="/wallet" 
              className="block p-2 rounded hover:bg-gray-100 transition-colors pl-4"
            >
              💰 Minha Carteira
            </Link>
          </>
        )}

        {/* ADMIN */}
        {user.role === "admin" && (
          <>
            <Link 
              href="/admin/dashboard" 
              className="block p-2 rounded hover:bg-gray-100 transition-colors font-medium bg-gray-50"
            >
              📊 Dashboard Admin
            </Link>
            
            <div className="border-t my-3"></div>
            <p className="text-xs text-gray-500 uppercase px-2 mb-1">Administração</p>
            
            <Link 
              href="/admin/users" 
              className="block p-2 rounded hover:bg-gray-100 transition-colors pl-4"
            >
              👥 Usuários
            </Link>
            <Link 
              href="/admin/sessions" 
              className="block p-2 rounded hover:bg-gray-100 transition-colors pl-4"
            >
              📋 Todas as Sessões
            </Link>
            <Link 
              href="/admin/reports" 
              className="block p-2 rounded hover:bg-gray-100 transition-colors pl-4"
            >
              📊 Relatórios
            </Link>
          </>
        )}
      </nav>

      <div className="p-4 border-t text-xs text-gray-500">
        <p>Logado como:</p>
        <p className="font-medium text-gray-700 truncate">{user?.email}</p>
        <p className="capitalize">
          {user?.role === "patient" ? "Paciente" : 
           user?.role === "therapist" ? "Terapeuta" : 
           user?.role === "admin" ? "Administrador" : user?.role}
        </p>
      </div>
    </aside>
  );
}