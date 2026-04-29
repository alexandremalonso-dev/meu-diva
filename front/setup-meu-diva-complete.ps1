Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "MEU DIVÃ - SCRIPT MASTER COMPLETO" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📂 Executando na pasta: $PSScriptRoot" -ForegroundColor Gray
Write-Host ""

# =====================================
# 1️⃣ CRIAR ESTRUTURA DE PASTAS
# =====================================
Write-Host "📁 Criando estrutura de pastas..." -ForegroundColor Yellow

$pastas = @(
    "src/app/(app)/wallet",
    "src/app/(app)/profile",
    "src/app/(app)/calendar",
    "src/app/api/wallet",
    "src/app/api/profile",
    "src/app/api/calendar",
    "src/app/api/therapists"
)

foreach ($pasta in $pastas) {
    New-Item -ItemType Directory -Force -Path $pasta | Out-Null
    Write-Host "  ✅ $pasta"
}

# =====================================
# 2️⃣ API - THERAPISTS
# =====================================
Write-Host ""
Write-Host "👥 Criando API /api/therapists..." -ForegroundColor Green

$conteudo = @'
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch("http://localhost:8000/therapists", {
            headers: { Authorization: `Bearer ${token}` }
        })

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("Erro ao buscar terapeutas:", error)
        return NextResponse.json({ error: "Erro interno" }, { status: 500 })
    }
}
'@
Set-Content -Path "src/app/api/therapists/route.ts" -Value $conteudo -Encoding UTF8
Write-Host "  ✅ src/app/api/therapists/route.ts"

# =====================================
# 3️⃣ API - WALLET
# =====================================
Write-Host ""
Write-Host "💰 Criando API de Wallet..." -ForegroundColor Yellow

$conteudo = @'
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
        }

        const saldoRes = await fetch("http://localhost:8000/wallet/balance", {
            headers: { Authorization: `Bearer ${token}` }
        })

        const transacoesRes = await fetch("http://localhost:8000/wallet/transactions", {
            headers: { Authorization: `Bearer ${token}` }
        })

        const saldo = await saldoRes.json()
        const transacoes = await transacoesRes.json()

        return NextResponse.json({
            balance: saldo.balance || 0,
            transactions: Array.isArray(transacoes) ? transacoes : []
        })
    } catch (error) {
        console.error("Erro wallet:", error)
        return NextResponse.json({ error: "Erro interno" }, { status: 500 })
    }
}
'@
Set-Content -Path "src/app/api/wallet/route.ts" -Value $conteudo -Encoding UTF8
Write-Host "  ✅ src/app/api/wallet/route.ts"

# =====================================
# 4️⃣ TELA - WALLET
# =====================================
Write-Host ""
Write-Host "💳 Criando tela Wallet..." -ForegroundColor Yellow

$conteudo = @'
"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"

type Transaction = {
    id: number
    amount: number
    reason: string
    created_at: string
    appointment_id?: number
}

export default function WalletPage() {
    const [balance, setBalance] = useState<number>(0)
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadWallet() {
            try {
                const data = await api("/api/wallet")
                setBalance(data.balance)
                setTransactions(data.transactions || [])
            } catch (error) {
                console.error("Erro ao carregar wallet:", error)
            } finally {
                setLoading(false)
            }
        }
        loadWallet()
    }, [])

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString("pt-BR")
    }

    const formatCurrency = (value: number) => {
        return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    }

    if (loading) {
        return <div className="p-8">Carregando...</div>
    }

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Minha Carteira</h1>

            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <p className="text-gray-600 text-sm">Saldo atual</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(balance)}</p>
            </div>

            <h2 className="text-xl font-semibold mb-4">Histórico de Transações</h2>

            {transactions.length === 0 ? (
                <p className="text-gray-500">Nenhuma transação encontrada.</p>
            ) : (
                <div className="space-y-3">
                    {transactions.map((tx) => (
                        <div key={tx.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
                            <div>
                                <p className="font-medium">{tx.reason}</p>
                                <p className="text-sm text-gray-500">{formatDate(tx.created_at)}</p>
                                {tx.appointment_id && (
                                    <p className="text-xs text-gray-400">Sessão #{tx.appointment_id}</p>
                                )}
                            </div>
                            <p className={tx.amount > 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                                {tx.amount > 0 ? "+" : ""}{formatCurrency(tx.amount)}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
'@
Set-Content -Path "src/app/(app)/wallet/page.tsx" -Value $conteudo -Encoding UTF8
Write-Host "  ✅ src/app/(app)/wallet/page.tsx"

# =====================================
# 5️⃣ API - PROFILE
# =====================================
Write-Host ""
Write-Host "👤 Criando API de Profile..." -ForegroundColor Yellow

$conteudo = @'
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch("http://localhost:8000/users/me", {
            headers: { Authorization: `Bearer ${token}` }
        })

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("Erro profile:", error)
        return NextResponse.json({ error: "Erro interno" }, { status: 500 })
    }
}

export async function PATCH(req: Request) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value
        const body = await req.json()

        if (!token) {
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch("http://localhost:8000/users/me", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(body)
        })

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("Erro update profile:", error)
        return NextResponse.json({ error: "Erro interno" }, { status: 500 })
    }
}
'@
Set-Content -Path "src/app/api/profile/route.ts" -Value $conteudo -Encoding UTF8
Write-Host "  ✅ src/app/api/profile/route.ts"

# =====================================
# 6️⃣ TELA - PROFILE
# =====================================
Write-Host ""
Write-Host "👤 Criando tela Profile..." -ForegroundColor Yellow

$conteudo = @'
"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"

type UserProfile = {
    id: number
    email: string
    full_name?: string
    role: string
    is_active: boolean
    created_at: string
}

export default function ProfilePage() {
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [fullName, setFullName] = useState("")
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")

    useEffect(() => {
        async function loadProfile() {
            try {
                const data = await api("/api/profile")
                setProfile(data)
                setFullName(data.full_name || "")
            } catch (error) {
                console.error("Erro ao carregar perfil:", error)
            } finally {
                setLoading(false)
            }
        }
        loadProfile()
    }, [])

    async function handleUpdate(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setError("")
        setSuccess("")

        try {
            const updated = await api("/api/profile", {
                method: "PATCH",
                body: JSON.stringify({ full_name: fullName })
            })
            setProfile(updated)
            setFullName(updated.full_name || "")
            setSuccess("Perfil atualizado com sucesso!")
            setEditing(false)
        } catch (err: any) {
            setError(err.message || "Erro ao atualizar perfil")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <div className="p-8">Carregando...</div>
    }

    if (!profile) {
        return <div className="p-8 text-red-500">Erro ao carregar perfil</div>
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("pt-BR")
    }

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
    )
}
'@
Set-Content -Path "src/app/(app)/profile/page.tsx" -Value $conteudo -Encoding UTF8
Write-Host "  ✅ src/app/(app)/profile/page.tsx"

# =====================================
# 7️⃣ API - CALENDAR
# =====================================
Write-Host ""
Write-Host "📅 Criando API de Calendar..." -ForegroundColor Yellow

$conteudo = @'
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const therapistId = searchParams.get("therapistId")
        const days = searchParams.get("days") || "14"

        if (!therapistId) {
            return NextResponse.json({ error: "therapistId é obrigatório" }, { status: 400 })
        }

        const cookieStore = await cookies()
        const token = cookieStore.get("token")?.value

        if (!token) {
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
        }

        const response = await fetch(
            `http://localhost:8000/therapists/${therapistId}/available-slots?days=${days}`,
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        )

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("Erro calendar:", error)
        return NextResponse.json({ error: "Erro interno" }, { status: 500 })
    }
}
'@
Set-Content -Path "src/app/api/calendar/route.ts" -Value $conteudo -Encoding UTF8
Write-Host "  ✅ src/app/api/calendar/route.ts"

# =====================================
# 8️⃣ TELA - CALENDAR
# =====================================
Write-Host ""
Write-Host "📅 Criando tela Calendar..." -ForegroundColor Yellow

$conteudo = @'
"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"

type Therapist = {
    id: number
    user_id: number
    bio?: string
    session_price?: number
    user?: { full_name?: string; email: string }
}

type Slot = {
    starts_at: string
    ends_at: string
    duration_minutes: number
}

export default function CalendarPage() {
    const [therapists, setTherapists] = useState<Therapist[]>([])
    const [selectedTherapist, setSelectedTherapist] = useState<string>("")
    const [slots, setSlots] = useState<Slot[]>([])
    const [loading, setLoading] = useState(false)
    const [creating, setCreating] = useState(false)
    const [selectedDate, setSelectedDate] = useState("")
    const [selectedTime, setSelectedTime] = useState("")
    const [duration, setDuration] = useState("50")
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")

    useEffect(() => {
        async function loadTherapists() {
            try {
                const data = await api("/api/therapists")
                setTherapists(Array.isArray(data) ? data : [])
            } catch (error) {
                console.error("Erro ao carregar terapeutas:", error)
            }
        }
        loadTherapists()
    }, [])

    async function loadSlots() {
        if (!selectedTherapist) return

        setLoading(true)
        setError("")
        try {
            const data = await api(`/api/calendar?therapistId=${selectedTherapist}&days=30`)
            setSlots(data.slots || [])
        } catch (error: any) {
            setError(error.message || "Erro ao carregar horários")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (selectedTherapist) {
            loadSlots()
        }
    }, [selectedTherapist])

    async function createAppointment(e: React.FormEvent) {
        e.preventDefault()
        setCreating(true)
        setError("")
        setSuccess("")

        try {
            const dateTimeStr = `${selectedDate}T${selectedTime}:00`
            const startsAt = new Date(dateTimeStr).toISOString()

            await api("/api/appointments/create", {
                method: "POST",
                body: JSON.stringify({
                    therapist_user_id: Number(selectedTherapist),
                    starts_at: startsAt,
                    duration_minutes: Number(duration)
                })
            })

            setSuccess("Sessão agendada com sucesso!")
            setSelectedDate("")
            setSelectedTime("")
            loadSlots()
        } catch (error: any) {
            setError(error.message || "Erro ao agendar sessão")
        } finally {
            setCreating(false)
        }
    }

    const formatSlotDate = (isoString: string) => {
        const date = new Date(isoString)
        return date.toLocaleDateString("pt-BR")
    }

    const formatSlotTime = (isoString: string) => {
        const date = new Date(isoString)
        return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    }

    const slotsByDate: Record<string, Slot[]> = {}
    slots.forEach(slot => {
        const dateKey = formatSlotDate(slot.starts_at)
        if (!slotsByDate[dateKey]) {
            slotsByDate[dateKey] = []
        }
        slotsByDate[dateKey].push(slot)
    })

    const sortedDates = Object.keys(slotsByDate).sort()

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Agendar Sessão</h1>

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

            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Selecione o terapeuta
                    </label>
                    <select
                        value={selectedTherapist}
                        onChange={(e) => setSelectedTherapist(e.target.value)}
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-black"
                    >
                        <option value="">Escolha um terapeuta</option>
                        {therapists.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.user?.full_name || t.user?.email || `Terapeuta ${t.id}`}
                            </option>
                        ))}
                    </select>
                </div>

                {selectedTherapist && (
                    <form onSubmit={createAppointment} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="w-full p-2 border rounded"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Horário</label>
                                <input
                                    type="time"
                                    value={selectedTime}
                                    onChange={(e) => setSelectedTime(e.target.value)}
                                    className="w-full p-2 border rounded"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Duração</label>
                                <select
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    className="w-full p-2 border rounded"
                                >
                                    <option value="30">30 minutos</option>
                                    <option value="50">50 minutos</option>
                                </select>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={creating}
                            className="bg-black text-white px-6 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
                        >
                            {creating ? "Agendando..." : "Confirmar Agendamento"}
                        </button>
                    </form>
                )}
            </div>

            {selectedTherapist && (
                <div>
                    <h2 className="text-xl font-semibold mb-4">Horários Disponíveis</h2>

                    {loading && <p className="text-gray-500">Carregando horários...</p>}

                    {!loading && slots.length === 0 && (
                        <p className="text-gray-500">Nenhum horário disponível no momento.</p>
                    )}

                    <div className="space-y-6">
                        {sortedDates.map((date) => (
                            <div key={date} className="bg-white p-4 rounded-lg shadow">
                                <h3 className="font-medium text-lg mb-3">{date}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {slotsByDate[date].map((slot, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                const slotDate = new Date(slot.starts_at)
                                                const year = slotDate.getFullYear()
                                                const month = String(slotDate.getMonth() + 1).padStart(2, "0")
                                                const day = String(slotDate.getDate()).padStart(2, "0")
                                                const hours = String(slotDate.getHours()).padStart(2, "0")
                                                const minutes = String(slotDate.getMinutes()).padStart(2, "0")

                                                setSelectedDate(`${year}-${month}-${day}`)
                                                setSelectedTime(`${hours}:${minutes}`)
                                                setDuration(String(slot.duration_minutes))
                                            }}
                                            className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded text-sm"
                                        >
                                            {formatSlotTime(slot.starts_at)} ({slot.duration_minutes}min)
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
'@
Set-Content -Path "src/app/(app)/calendar/page.tsx" -Value $conteudo -Encoding UTF8
Write-Host "  ✅ src/app/(app)/calendar/page.tsx"

# =====================================
# 9️⃣ ATUALIZAR SIDEBAR
# =====================================
Write-Host ""
Write-Host "🎨 Atualizando Sidebar..." -ForegroundColor Yellow

$conteudo = @'
import Link from "next/link"

export default function Sidebar() {
    return (
        <aside className="w-64 bg-white border-r shadow-sm h-full">
            <div className="p-6 text-xl font-bold border-b">Meu Divã</div>
            <nav className="p-4 space-y-2">
                <Link href="/dashboard" className="block p-2 rounded hover:bg-gray-100">
                    Dashboard
                </Link>
                <Link href="/appointments" className="block p-2 rounded hover:bg-gray-100">
                    Sessões
                </Link>
                <Link href="/calendar" className="block p-2 rounded hover:bg-gray-100">
                    Agendar
                </Link>
                <Link href="/wallet" className="block p-2 rounded hover:bg-gray-100">
                    Carteira
                </Link>
                <Link href="/profile" className="block p-2 rounded hover:bg-gray-100">
                    Perfil
                </Link>
            </nav>
        </aside>
    )
}
'@
Set-Content -Path "src/components/layout/Sidebar.tsx" -Value $conteudo -Encoding UTF8
Write-Host "  ✅ src/components/layout/Sidebar.tsx"

# =====================================
# FINALIZAÇÃO
# =====================================
Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "✅ SCRIPT MASTER CONCLUÍDO COM SUCESSO!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "📌 Novas telas criadas:" -ForegroundColor Cyan
Write-Host "  - /wallet → Carteira com saldo e extrato"
Write-Host "  - /profile → Perfil do usuário"
Write-Host "  - /calendar → Calendário para agendar sessões"
Write-Host ""
Write-Host "🚀 Agora reinicie o servidor:" -ForegroundColor Yellow
Write-Host "  npm run dev"
Write-Host ""
Write-Host "🌐 Acesse:" -ForegroundColor Yellow
Write-Host "  http://localhost:3000/appointments  (agora com terapeutas!)"
Write-Host "  http://localhost:3000/calendar"
Write-Host "  http://localhost:3000/wallet"
Write-Host "  http://localhost:3000/profile"