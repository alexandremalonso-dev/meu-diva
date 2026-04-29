Write-Host "====================================="
Write-Host "MEU DIVA - FRONT MASTER SETUP"
Write-Host "====================================="

# Garantir estrutura
$dirs = @(
  "src/lib",
  "src/contexts",
  "src/app/api/me",
  "src/app/api/auth/login",
  "src/app/api/auth/logout",
  "src/app/api/appointments",
  "src/app/api/appointments/create",
  "src/app/api/appointments/[id]/status",
  "src/app/api/appointments/[id]/reschedule",
  "src/app/(app)/dashboard",
  "src/app/(app)/appointments"
)

foreach ($d in $dirs) {
  New-Item -ItemType Directory -Force -Path $d | Out-Null
}

# =====================================
# src/lib/api.ts
# =====================================
@'
export async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(data?.detail || data?.error || "Erro na requisição")
  }

  return data
}
'@ | Set-Content "src/lib/api.ts"

# =====================================
# src/app/api/auth/login/route.ts
# =====================================
@'
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const response = await fetch("http://localhost:8000/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || "Credenciais inválidas" },
        { status: response.status }
      )
    }

    const res = NextResponse.json({ success: true })

    res.cookies.set("token", data.access_token, {
      httpOnly: true,
      secure: false,
      path: "/",
      sameSite: "lax",
    })

    return res
  } catch (error) {
    console.error("Erro no login:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
'@ | Set-Content "src/app/api/auth/login/route.ts"

# =====================================
# src/app/api/auth/logout/route.ts
# =====================================
@'
import { NextResponse } from "next/server"

export async function POST() {
  const response = NextResponse.json({ success: true })

  response.cookies.set("token", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
    sameSite: "lax",
  })

  return response
}
'@ | Set-Content "src/app/api/auth/logout/route.ts"

# =====================================
# src/app/api/me/route.ts
# Não depende de /users/me no backend
# Decodifica o payload do JWT do cookie
# =====================================
@'
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

function decodeJwtPayload(token: string) {
  try {
    const parts = token.split(".")
    if (parts.length < 2) return null

    const base64 = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=")

    const json = Buffer.from(base64, "base64").toString("utf-8")
    return JSON.parse(json)
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const payload = decodeJwtPayload(token)

    if (!payload) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 })
    }

    return NextResponse.json({
      id: Number(payload.sub),
      email: payload.email || "",
      role: payload.role || "patient",
    })
  } catch (error) {
    console.error("Erro em /api/me:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
'@ | Set-Content "src/app/api/me/route.ts"

# =====================================
# src/app/api/appointments/route.ts
# =====================================
@'
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
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Erro appointments:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
'@ | Set-Content "src/app/api/appointments/route.ts"

# =====================================
# src/app/api/appointments/create/route.ts
# Busca primeiro terapeuta disponível e cria appointment
# payload real: therapist_user_id + starts_at + duration_minutes
# =====================================
@'
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
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Erro create appointment:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
'@ | Set-Content "src/app/api/appointments/create/route.ts"

# =====================================
# src/app/api/appointments/[id]/status/route.ts
# =====================================
@'
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const body = await req.json()

    const response = await fetch(`http://localhost:8000/appointments/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Erro update status:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
'@ | Set-Content "src/app/api/appointments/[id]/status/route.ts"

# =====================================
# src/app/api/appointments/[id]/reschedule/route.ts
# =====================================
@'
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const body = await req.json()

    const response = await fetch(`http://localhost:8000/appointments/${id}/reschedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Erro reschedule:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
'@ | Set-Content "src/app/api/appointments/[id]/reschedule/route.ts"

# =====================================
# src/contexts/AuthContext.tsx
# =====================================
@'
"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type User = {
  id: number
  email: string
  role: string
}

type AuthContextType = {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  async function loadMe() {
    try {
      const res = await fetch("/api/me")
      if (!res.ok) {
        setUser(null)
        return
      }
      const data = await res.json()
      setUser(data)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMe()
  }, [])

  async function login(email: string, password: string) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(data?.error || "Credenciais inválidas")
    }

    await loadMe()
    router.push("/dashboard")
    router.refresh()
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    setUser(null)
    router.push("/login")
    router.refresh()
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
'@ | Set-Content "src/contexts/AuthContext.tsx"

# =====================================
# src/app/(app)/dashboard/page.tsx
# Alinhado aos status reais do backend
# =====================================
@'
"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"

type Appointment = {
  id: number
  starts_at: string
  ends_at: string
  status: string
}

const CANCELLED_STATUSES = [
  "cancelled_by_patient",
  "cancelled_by_therapist",
  "cancelled_by_admin",
]

export default function DashboardPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])

  useEffect(() => {
    api("/api/appointments")
      .then((data) => {
        if (Array.isArray(data)) setAppointments(data)
        else setAppointments([])
      })
      .catch(() => setAppointments([]))
  }, [])

  const total = appointments.length
  const active = appointments.filter((a) =>
    ["scheduled", "confirmed", "proposed"].includes(a.status)
  ).length
  const cancelled = appointments.filter((a) =>
    CANCELLED_STATUSES.includes(a.status)
  ).length

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Total de Sessões" value={total} />
        <Card title="Ativas" value={active} />
        <Card title="Canceladas" value={cancelled} />
      </div>

      <div className="mt-8 bg-white rounded shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Próximas sessões</h2>

        {appointments.length === 0 ? (
          <p className="text-gray-500">Nenhuma sessão encontrada.</p>
        ) : (
          <div className="space-y-3">
            {appointments.slice(0, 5).map((a) => (
              <div key={a.id} className="border rounded p-3">
                <div><strong>Início:</strong> {new Date(a.starts_at).toLocaleString()}</div>
                <div><strong>Fim:</strong> {new Date(a.ends_at).toLocaleString()}</div>
                <div><strong>Status:</strong> {a.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white p-6 rounded shadow">
      <div>{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}
'@ | Set-Content "src/app/(app)/dashboard/page.tsx"

# =====================================
# src/app/(app)/appointments/page.tsx
# Alinhado ao backend real:
# create => therapist_user_id + starts_at + duration_minutes
# cancel => status real por role
# reschedule => therapist_user_id + starts_at + duration_minutes
# =====================================
@'
"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"

type Appointment = {
  id: number
  therapist_user_id: number
  starts_at: string
  ends_at: string
  status: string
}

type Therapist = {
  id: number
  email?: string
  full_name?: string
  role?: string
}

const ACTIVE_STATUSES = ["scheduled", "confirmed", "proposed"]

export default function AppointmentsPage() {
  const { user } = useAuth()

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [therapistId, setTherapistId] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [duration, setDuration] = useState("50")
  const [rescheduleDate, setRescheduleDate] = useState<Record<number, string>>({})
  const [rescheduleDuration, setRescheduleDuration] = useState<Record<number, string>>({})
  const [error, setError] = useState("")

  async function loadAppointments() {
    try {
      const data = await api("/api/appointments")
      if (Array.isArray(data)) setAppointments(data)
      else setAppointments([])
    } catch {
      setAppointments([])
    }
  }

  async function loadTherapists() {
    try {
      const res = await fetch("http://localhost:8000/therapists")
      const data = await res.json()
      if (Array.isArray(data)) setTherapists(data)
      else setTherapists([])
    } catch {
      setTherapists([])
    }
  }

  useEffect(() => {
    loadAppointments()
    loadTherapists()
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    try {
      await api("/api/appointments/create", {
        method: "POST",
        body: JSON.stringify({
          therapist_user_id: Number(therapistId),
          starts_at: new Date(startsAt).toISOString(),
          duration_minutes: Number(duration),
        }),
      })

      setStartsAt("")
      setDuration("50")
      loadAppointments()
    } catch (err: any) {
      setError(err.message || "Erro ao criar sessão")
    }
  }

  function getCancelStatus() {
    if (user?.role === "admin") return "cancelled_by_admin"
    if (user?.role === "therapist") return "cancelled_by_therapist"
    return "cancelled_by_patient"
  }

  async function cancelAppointment(id: number) {
    setError("")

    try {
      await api(`/api/appointments/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: getCancelStatus(),
        }),
      })

      loadAppointments()
    } catch (err: any) {
      setError(err.message || "Erro ao cancelar sessão")
    }
  }

  async function rescheduleAppointment(appt: Appointment) {
    setError("")
    const newDate = rescheduleDate[appt.id]
    const newDuration = rescheduleDuration[appt.id] || "50"

    if (!newDate) {
      setError("Informe a nova data para reagendamento")
      return
    }

    try {
      await api(`/api/appointments/${appt.id}/reschedule`, {
        method: "POST",
        body: JSON.stringify({
          therapist_user_id: appt.therapist_user_id,
          starts_at: new Date(newDate).toISOString(),
          duration_minutes: Number(newDuration),
        }),
      })

      setRescheduleDate((prev) => ({ ...prev, [appt.id]: "" }))
      setRescheduleDuration((prev) => ({ ...prev, [appt.id]: "50" }))
      loadAppointments()
    } catch (err: any) {
      setError(err.message || "Erro ao reagendar sessão")
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Sessões</h1>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={create} className="bg-white p-4 rounded shadow mb-6 space-y-4">
        <h2 className="font-semibold">Criar sessão</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={therapistId}
            onChange={(e) => setTherapistId(e.target.value)}
            className="border p-2 rounded"
            required
          >
            <option value="">Selecione o terapeuta</option>
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name || t.email || `Terapeuta ${t.id}`}
              </option>
            ))}
          </select>

          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="border p-2 rounded"
            required
          />

          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="30">30 minutos</option>
            <option value="50">50 minutos</option>
          </select>
        </div>

        <button className="bg-black text-white px-4 py-2 rounded">
          Criar sessão
        </button>
      </form>

      <div className="space-y-4">
        {appointments.length === 0 ? (
          <div className="bg-white p-4 rounded shadow text-gray-500">
            Nenhuma sessão encontrada.
          </div>
        ) : (
          appointments.map((a) => (
            <div key={a.id} className="bg-white p-4 rounded shadow space-y-3">
              <div>
                <div><strong>Início:</strong> {new Date(a.starts_at).toLocaleString()}</div>
                <div><strong>Fim:</strong> {new Date(a.ends_at).toLocaleString()}</div>
                <div><strong>Status:</strong> {a.status}</div>
              </div>

              {ACTIVE_STATUSES.includes(a.status) && (
                <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                  <button
                    onClick={() => cancelAppointment(a.id)}
                    className="bg-red-500 text-white px-3 py-2 rounded"
                  >
                    Cancelar
                  </button>

                  <input
                    type="datetime-local"
                    value={rescheduleDate[a.id] || ""}
                    onChange={(e) =>
                      setRescheduleDate((prev) => ({ ...prev, [a.id]: e.target.value }))
                    }
                    className="border p-2 rounded"
                  />

                  <select
                    value={rescheduleDuration[a.id] || "50"}
                    onChange={(e) =>
                      setRescheduleDuration((prev) => ({ ...prev, [a.id]: e.target.value }))
                    }
                    className="border p-2 rounded"
                  >
                    <option value="30">30 minutos</option>
                    <option value="50">50 minutos</option>
                  </select>

                  <button
                    onClick={() => rescheduleAppointment(a)}
                    className="bg-blue-600 text-white px-3 py-2 rounded"
                  >
                    Reagendar
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
'@ | Set-Content "src/app/(app)/appointments/page.tsx"

Write-Host ""
Write-Host "Setup concluido."
Write-Host "Agora rode:"
Write-Host "cd C:\meu-diva\front"
Write-Host "rmdir .next -Recurse -Force"
Write-Host "npm run dev"