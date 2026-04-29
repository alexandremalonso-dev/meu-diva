Write-Host "====================================="
Write-Host "MEU DIVÃ - FRONT SAAS SETUP MASTER"
Write-Host "====================================="

$base = "src/app"

# -------------------------------
# API CLIENT
# -------------------------------

New-Item -ItemType Directory -Force -Path "src/lib" | Out-Null

@"
export async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    credentials: "include"
  })

  if (!res.ok) {
    throw new Error("Erro na API")
  }

  return res.json()
}
"@ | Set-Content "src/lib/api.ts"

Write-Host "API client criado"

# -------------------------------
# DASHBOARD
# -------------------------------

$dash = "$base/(app)/dashboard/page.tsx"

@"
"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"

export default function DashboardPage() {

  const [appointments,setAppointments] = useState([])

  useEffect(()=>{

    api("/api/appointments")
      .then(setAppointments)
      .catch(()=>setAppointments([]))

  },[])

  const total = appointments.length

  const active = appointments.filter(a=>a.status==="scheduled").length

  const cancelled = appointments.filter(a=>a.status==="cancelled").length

  return(

    <div>

      <h1 className="text-xl font-semibold mb-6">
        Dashboard
      </h1>

      <div className="grid grid-cols-3 gap-6">

        <Card title="Total de Sessões" value={total}/>
        <Card title="Ativas" value={active}/>
        <Card title="Canceladas" value={cancelled}/>

      </div>

    </div>

  )
}

function Card({title,value}){

  return(

    <div className="bg-white p-6 rounded shadow">

      <div>{title}</div>

      <div className="text-2xl font-bold">
        {value}
      </div>

    </div>

  )

}
"@ | Set-Content $dash

Write-Host "Dashboard atualizado"

# -------------------------------
# APPOINTMENTS PAGE
# -------------------------------

$app = "$base/(app)/appointments/page.tsx"

@"
"use client"

import { useEffect,useState } from "react"
import { api } from "@/lib/api"

export default function AppointmentsPage(){

  const [appointments,setAppointments] = useState([])
  const [date,setDate] = useState("")

  function load(){

    api("/api/appointments")
      .then(setAppointments)

  }

  useEffect(()=>{

    load()

  },[])

  async function create(e){

    e.preventDefault()

    await api("/api/appointments/create",{

      method:"POST",

      headers:{
        "Content-Type":"application/json"
      },

      body:JSON.stringify({

        scheduled_at:date

      })

    })

    setDate("")

    load()

  }

  async function cancel(id){

    await api(`/api/appointments/\${id}/cancel`,{

      method:"PATCH"

    })

    load()

  }

  return(

    <div>

      <h1 className="text-xl font-semibold mb-6">
        Sessões
      </h1>

      <form onSubmit={create} className="flex gap-4 mb-6">

        <input
          type="datetime-local"
          value={date}
          onChange={e=>setDate(e.target.value)}
          className="border p-2 rounded"
        />

        <button className="bg-black text-white px-4 py-2 rounded">
          Criar Sessão
        </button>

      </form>

      <div className="space-y-3">

        {appointments.map(a=>(

          <div key={a.id} className="bg-white p-4 rounded shadow flex justify-between">

            <div>

              <div>
                {new Date(a.scheduled_at).toLocaleString()}
              </div>

              <div>Status: {a.status}</div>

            </div>

            {a.status==="scheduled" && (

              <button
                onClick={()=>cancel(a.id)}
                className="bg-red-500 text-white px-3 py-1 rounded"
              >
                Cancelar
              </button>

            )}

          </div>

        ))}

      </div>

    </div>

  )

}
"@ | Set-Content $app

Write-Host "Appointments completo"

Write-Host ""
Write-Host "FRONT SAAS CONFIGURADO"
Write-Host "Reinicie o servidor:"
Write-Host "npm run dev"