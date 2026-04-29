Write-Host "Iniciando Setup Completo de Sessions SaaS..."

$basePath = "src/app"

# ===============================
# 1️⃣ PROXY GET APPOINTMENTS
# ===============================
$appointmentsApiPath = "$basePath/api/appointments"
New-Item -ItemType Directory -Force -Path $appointmentsApiPath | Out-Null

@"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const response = await fetch("http://localhost:8000/appointments/me", {
      headers: { Authorization: `Bearer ${token}` }
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })

  } catch (error) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
"@ | Set-Content "$appointmentsApiPath/route.ts"

Write-Host "Proxy GET criado"

# ===============================
# 2️⃣ PROXY CREATE APPOINTMENT
# ===============================
$createPath = "$basePath/api/appointments/create"
New-Item -ItemType Directory -Force -Path $createPath | Out-Null

@"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const body = await req.json()

    const response = await fetch("http://localhost:8000/appointments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })

  } catch (error) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
"@ | Set-Content "$createPath/route.ts"

Write-Host "Proxy CREATE criado"

# ===============================
# 3️⃣ PAGE APPOINTMENTS COMPLETA
# ===============================
$appointmentsPage = "$basePath/(app)/appointments/page.tsx"

@"
"use client"

import { useEffect, useState } from "react"

type Appointment = {
  id: number
  scheduled_at: string
  status: string
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [date, setDate] = useState("")
  const [loading, setLoading] = useState(false)

  async function loadAppointments() {
    const res = await fetch("/api/appointments")
    const data = await res.json()
    if (Array.isArray(data)) setAppointments(data)
  }

  async function createAppointment(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    await fetch("/api/appointments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduled_at: date })
    })

    setDate("")
    setLoading(false)
    loadAppointments()
  }

  useEffect(() => {
    loadAppointments()
  }, [])

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Sessões</h1>

      <form onSubmit={createAppointment} className="mb-6 flex gap-4">
        <input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded"
        >
          {loading ? "Criando..." : "Criar Sessão"}
        </button>
      </form>

      <div className="space-y-3">
        {appointments.map(a => (
          <div key={a.id} className="p-4 bg-white rounded shadow">
            <div>Data: {new Date(a.scheduled_at).toLocaleString()}</div>
            <div>Status: {a.status}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
"@ | Set-Content $appointmentsPage

Write-Host "Página Appointments criada"

# ===============================
# 4️⃣ DASHBOARD REAL
# ===============================
$dashboardPath = "$basePath/(app)/dashboard/page.tsx"

@"
"use client"

import { useEffect, useState } from "react"

type Appointment = {
  id: number
  status: string
}

export default function DashboardPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])

  useEffect(() => {
    fetch("/api/appointments")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAppointments(data)
      })
  }, [])

  const total = appointments.length
  const active = appointments.filter(a => a.status === "scheduled").length

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Dashboard</h1>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded shadow">
          <div>Total de Sessões</div>
          <div className="text-2xl font-bold">{total}</div>
        </div>

        <div className="bg-white p-6 rounded shadow">
          <div>Ativas</div>
          <div className="text-2xl font-bold">{active}</div>
        </div>

        <div className="bg-white p-6 rounded shadow">
          <div>Canceladas</div>
          <div className="text-2xl font-bold">
            {appointments.filter(a => a.status === "cancelled").length}
          </div>
        </div>
      </div>
    </div>
  )
}
"@ | Set-Content $dashboardPath

Write-Host "Dashboard atualizado"

Write-Host "Setup COMPLETO finalizado com sucesso."