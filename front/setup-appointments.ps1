Write-Host "Integrando Appointments ao Front..."

# Criar proxy
New-Item -ItemType Directory -Force -Path "src/app/api/appointments" | Out-Null

@'
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const cookie = request.headers.get("cookie")

  const res = await fetch("http://localhost:8000/appointments/me", {
    headers: { cookie: cookie ?? "" },
  })

  if (!res.ok) {
    return NextResponse.json({ error: "Erro ao buscar sessões" }, { status: 500 })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
'@ | Set-Content src/app/api/appointments/route.ts

Write-Host "Proxy criado"

# Dashboard atualizado
@'
"use client"

import { useEffect, useState } from "react"

type Appointment = {
  id: number
  starts_at: string
  ends_at: string
  status: string
}

export default function DashboardPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/appointments")
      .then(res => res.json())
      .then(data => setAppointments(data))
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false))
  }, [])

  const upcoming = appointments.filter(a => a.status === "scheduled")

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

      {loading && <p>Carregando...</p>}

      {!loading && (
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-500">Próximas Sessões</p>
            <h2 className="text-2xl font-bold">{upcoming.length}</h2>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-500">Total de Sessões</p>
            <h2 className="text-2xl font-bold">{appointments.length}</h2>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-500">Ativas</p>
            <h2 className="text-2xl font-bold">
              {appointments.filter(a => a.status !== "cancelled").length}
            </h2>
          </div>
        </div>
      )}
    </div>
  )
}
'@ | Set-Content "src/app/(app)/dashboard/page.tsx"

Write-Host "Dashboard atualizado"

# Página Appointments
@'
"use client"

import { useEffect, useState } from "react"

type Appointment = {
  id: number
  starts_at: string
  ends_at: string
  status: string
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/appointments")
      .then(res => res.json())
      .then(data => setAppointments(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Carregando sessões...</p>

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Minhas Sessões</h1>

      {appointments.length === 0 && (
        <p className="text-gray-500">Nenhuma sessão encontrada.</p>
      )}

      <div className="space-y-4">
        {appointments.map(appt => (
          <div key={appt.id} className="bg-white p-4 rounded shadow">
            <p><strong>Status:</strong> {appt.status}</p>
            <p><strong>Início:</strong> {new Date(appt.starts_at).toLocaleString()}</p>
            <p><strong>Fim:</strong> {new Date(appt.ends_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
'@ | Set-Content "src/app/(app)/appointments/page.tsx"

Write-Host "Integração concluída com sucesso!"