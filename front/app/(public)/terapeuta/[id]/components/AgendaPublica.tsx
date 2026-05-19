"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ChevronLeft, ChevronRight } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AgendaResumida {
  slots: Array<{
    starts_at: string;
    ends_at: string;
    duration_minutes: number;
  }>;
}

interface AgendaPublicaProps {
  agenda: AgendaResumida | null;
  therapistId: string;
  sessionPrice?: number;
  isLoggedIn?: boolean;
  onAgendar?: () => void;
}

const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  rosaEscuro: "#c02c5e",
  cinzaClaro: "#F9F5FF",
  cinza: "#F3F4F6",
  cinzaTexto: "#374151",
  cinzaBorda: "#E5E7EB",
  branco: "#FFFFFF",
};

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// 🔥 Extrai HH:MM diretamente da string ISO sem converter timezone
const getHorarioStr = (startsAt: string): string => {
  const match = startsAt.match(/T(\d{2}:\d{2})/)
  return match ? match[1] : new Date(startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

// 🔥 Extrai a data local (YYYY-MM-DD) da string ISO sem converter timezone
const getDateStr = (startsAt: string): string => {
  const match = startsAt.match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]
  return new Date(startsAt).toISOString().split('T')[0]
}

export function AgendaPublica({
  agenda: agendaInicial,
  therapistId,
  sessionPrice = 200,
  isLoggedIn = false,
  onAgendar,
}: AgendaPublicaProps) {
  const router = useRouter();

  const [slotsPorDia, setSlotsPorDia] = useState<Record<string, any[]>>({});
  const [dias, setDias] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loadingSlot, setLoadingSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const hoje = new Date();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const DIAS_POR_PAGINA = isMobile ? 3 : 7;

  const processarSlots = useCallback((slots: any[]) => {
    if (!slots || slots.length === 0) {
      setSlotsPorDia({});
      setDias([]);
      setCurrentPage(0);
      return;
    }
    const grupos: Record<string, any[]> = {};
    slots.forEach((slot) => {
      // 🔥 Usa a data local da string ISO sem conversão de timezone
      const dateStr = getDateStr(slot.starts_at)
      if (!grupos[dateStr]) grupos[dateStr] = [];
      grupos[dateStr].push(slot);
    });
    const diasOrdenados = Object.keys(grupos).sort();
    setSlotsPorDia(grupos);
    setDias(diasOrdenados);
    setCurrentPage(0);
  }, []);

  const carregarTodosSlots = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/public/terapeutas/${therapistId}/slots?days=90`);
      if (response.ok) {
        const data = await response.json();
        processarSlots(data.slots || []);
      }
    } catch (error) {
      console.error("Erro ao carregar slots:", error);
    } finally {
      setLoading(false);
    }
  }, [therapistId, processarSlots]);

  useEffect(() => { carregarTodosSlots(); }, [carregarTodosSlots]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('cancel') === 'true') {
        carregarTodosSlots();
      }
    }
  }, []);

  useEffect(() => {
    const handler = () => carregarTodosSlots();
    window.addEventListener("appointmentConfirmed", handler);
    return () => window.removeEventListener("appointmentConfirmed", handler);
  }, [carregarTodosSlots]);

  const totalPaginas = Math.ceil(dias.length / DIAS_POR_PAGINA);
  const diasPaginados = dias.slice(currentPage * DIAS_POR_PAGINA, (currentPage + 1) * DIAS_POR_PAGINA);

  // 🔥 Usa YYYY-MM-DD direto — sem conversão de timezone
  const getDiaSemana = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number)
    return DIAS_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  }

  const getDiaMes = (dateStr: string) => {
    const [, m, d] = dateStr.split("-")
    return `${d}/${m}`
  }

  const isHoje = (dateStr: string) => {
    const hojeStr = hoje.toISOString().split('T')[0]
    return dateStr === hojeStr
  }

  const getHorarios = (slots: any[]) =>
    (slots || [])
      .filter(s => {
        const h = parseInt(getHorarioStr(s.starts_at).split(':')[0])
        return h >= 7 && h <= 22
      })
      .sort((a, b) => getHorarioStr(a.starts_at).localeCompare(getHorarioStr(b.starts_at)))

  const periodoLabel = (() => {
    if (!diasPaginados.length) return "";
    const first = diasPaginados[0]
    const last = diasPaginados[diasPaginados.length - 1]
    const [y1, m1, d1] = first.split("-")
    const [y2, m2, d2] = last.split("-")
    const mesAno = new Date(Date.UTC(parseInt(y2), parseInt(m2) - 1, parseInt(d2)))
      .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    const mesAnoFmt = mesAno.charAt(0).toUpperCase() + mesAno.slice(1)
    return m1 === m2
      ? `${d1} – ${d2}/${m2} · ${mesAnoFmt}`
      : `${d1}/${m1} – ${d2}/${m2} · ${mesAnoFmt}`
  })();

  const handleAgendar = async (slot: any) => {
    if (!isLoggedIn) {
      onAgendar?.();
      return;
    }

    if (loadingSlot === slot.starts_at) return;
    setLoadingSlot(slot.starts_at);

    try {
      await api("/api/users/me");

      const walletData = await api("/api/wallet/balance");
      const balance = walletData.balance || 0;
      const duration = slot.duration_minutes || 50;

      if (balance >= sessionPrice) {
        // SALDO SUFICIENTE: cria appointment e confirma direto pela wallet
        const bookingData = await api("/api/appointments", {
          method: "POST",
          body: JSON.stringify({
            therapist_user_id: Number(therapistId),
            starts_at: slot.starts_at,
            ends_at: slot.ends_at,
            duration_minutes: duration,
          }),
        });

        const appointmentId = bookingData.id;

        await api(`/api/appointments/${appointmentId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: "confirmed" }),
        });

        await carregarTodosSlots();

        const therapistName = encodeURIComponent("Terapeuta");
        const date = encodeURIComponent(getDiaMes(getDateStr(slot.starts_at)));
        const time = encodeURIComponent(getHorarioStr(slot.starts_at));
        const isMobileContext = window.location.pathname.startsWith('/mobile') || sessionStorage.getItem('oauth_from_mobile') === 'true';
        const dashPath = isMobileContext ? '/mobile/dashboard' : '/patient/dashboard';

        router.push(
          `${dashPath}?payment_success=true&appointment_id=${appointmentId}` +
          `&therapist_name=${therapistName}&date=${date}&time=${time}&duration=${duration}&price=${sessionPrice}`
        );
        return;
      }

      // SALDO INSUFICIENTE: cria appointment e redireciona para checkout MP
      const bookingData = await api("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          therapist_user_id: Number(therapistId),
          starts_at: slot.starts_at,
          ends_at: slot.ends_at,
          duration_minutes: duration,
        }),
      });

      router.push(`/checkout?appointment_id=${bookingData.id}`);

    } catch (error: any) {
      console.error("Erro ao agendar:", error);
      if (error.message?.includes("ocupado") || error.message?.includes("conflict")) {
        alert("Este horário já foi ocupado. Por favor, escolha outro horário.");
        await carregarTodosSlots();
      } else {
        alert(error.message || "Erro ao agendar sessão");
      }
    } finally {
      setLoadingSlot(null);
    }
  };

  return (
    <div style={{ backgroundColor: CORES.branco, borderRadius: "16px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", overflow: "hidden" }}>

      <div style={{ backgroundColor: CORES.azul, padding: isMobile ? "16px" : "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h2 style={{ fontSize: isMobile ? "18px" : "24px", fontWeight: "bold", color: CORES.branco, margin: 0 }}>
              Horários disponíveis
            </h2>
            <p style={{ fontSize: "14px", marginTop: "4px", color: "rgba(255,255,255,0.8)" }}>
              Selecione um horário para agendar sua sessão
            </p>
          </div>
          <span style={{ backgroundColor: "rgba(255,255,255,0.2)", padding: "6px 16px", borderRadius: "999px", fontSize: "14px", fontWeight: "600", color: CORES.branco }}>
            R$ {sessionPrice.toFixed(2)} por sessão
          </span>
        </div>
      </div>

      <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${CORES.cinzaBorda}`, backgroundColor: CORES.cinzaClaro }}>
        <button
          onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
          disabled={currentPage === 0}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "7px 12px", borderRadius: "8px", border: "none",
            backgroundColor: currentPage === 0 ? CORES.cinza : CORES.rosa,
            color: CORES.branco, cursor: currentPage === 0 ? "not-allowed" : "pointer",
            opacity: currentPage === 0 ? 0.4 : 1, fontWeight: "500", fontSize: "13px",
          }}
        >
          <ChevronLeft size={16} /> {!isMobile && "Anterior"}
        </button>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: isMobile ? "12px" : "15px", fontWeight: "600", color: CORES.rosa }}>{periodoLabel}</div>
          {totalPaginas > 1 && (
            <div style={{ fontSize: "11px", color: CORES.cinzaTexto, marginTop: "2px" }}>
              {currentPage + 1} de {totalPaginas}
            </div>
          )}
        </div>

        <button
          onClick={() => setCurrentPage(p => Math.min(totalPaginas - 1, p + 1))}
          disabled={currentPage >= totalPaginas - 1}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "7px 12px", borderRadius: "8px", border: "none",
            backgroundColor: currentPage >= totalPaginas - 1 ? CORES.cinza : CORES.rosa,
            color: CORES.branco, cursor: currentPage >= totalPaginas - 1 ? "not-allowed" : "pointer",
            opacity: currentPage >= totalPaginas - 1 ? 0.4 : 1, fontWeight: "500", fontSize: "13px",
          }}
        >
          {!isMobile && "Próximo"} <ChevronRight size={16} />
        </button>
      </div>

      <div style={{ padding: isMobile ? "12px" : "24px", minHeight: "200px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "48px", color: CORES.cinzaTexto }}>
            <p>Carregando horários disponíveis...</p>
          </div>
        ) : dias.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px", color: CORES.cinzaTexto }}>
            <p>Nenhum horário disponível nos próximos 90 dias.</p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : `repeat(${diasPaginados.length}, 1fr)`,
            gap: isMobile ? "8px" : "12px",
          }}>
            {diasPaginados.map((date) => {
              const horarios = getHorarios(slotsPorDia[date]);
              const ehHoje = isHoje(date);
              return (
                <div key={date} style={{
                  borderRadius: "12px", overflow: "hidden",
                  border: `2px solid ${ehHoje ? CORES.rosa : CORES.cinzaBorda}`,
                  boxShadow: ehHoje ? `0 0 0 2px ${CORES.rosa}33` : "none",
                }}>
                  <div style={{
                    textAlign: "center", padding: "8px 4px",
                    backgroundColor: ehHoje ? CORES.rosa : CORES.azul,
                    color: CORES.branco,
                  }}>
                    <div style={{ fontSize: "11px", fontWeight: "500", opacity: 0.85 }}>{getDiaSemana(date)}</div>
                    <div style={{ fontSize: isMobile ? "14px" : "18px", fontWeight: "bold" }}>{getDiaMes(date)}</div>
                  </div>
                  <div style={{
                    padding: "8px 6px", display: "flex", flexDirection: "column", gap: "4px",
                    backgroundColor: ehHoje ? `${CORES.rosa}0D` : CORES.branco,
                  }}>
                    {horarios.length === 0 ? (
                      <p style={{ fontSize: "12px", textAlign: "center", padding: "8px", color: CORES.cinzaTexto }}>–</p>
                    ) : (
                      horarios.map((slot, i) => {
                        const isSlotLoading = loadingSlot === slot.starts_at;
                        return (
                          <button
                            key={i}
                            disabled={!!loadingSlot}
                            onClick={() => handleAgendar(slot)}
                            style={{
                              width: "100%", fontSize: "11px", padding: "6px 4px",
                              borderRadius: "8px",
                              backgroundColor: ehHoje ? `${CORES.rosa}1A` : CORES.cinza,
                              color: ehHoje ? CORES.rosaEscuro : CORES.cinzaTexto,
                              border: ehHoje ? `1px solid ${CORES.rosa}55` : "none",
                              cursor: loadingSlot ? "not-allowed" : "pointer",
                              fontWeight: ehHoje ? "600" : "400",
                              opacity: loadingSlot ? 0.6 : 1,
                              transition: "opacity 0.2s",
                            }}
                          >
                            {isSlotLoading ? "..." : getHorarioStr(slot.starts_at)}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ backgroundColor: CORES.azul, padding: "14px 24px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "20px", fontSize: "12px" }}>
          {[
            { cor: CORES.rosa, label: "Dia atual" },
            { cor: CORES.azul, label: "Dia com horários", border: "1px solid rgba(255,255,255,0.5)" },
            { cor: CORES.cinza, label: "Clique para agendar" },
          ].map(({ cor, label, border }) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: "6px", color: CORES.branco }}>
              <span style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: cor, border: border || "1px solid rgba(255,255,255,0.3)", flexShrink: 0 }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}