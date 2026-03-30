import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const therapistId = searchParams.get("therapistId");
    const days = searchParams.get("days") || "14";

    console.log("📅 API Calendar - Parâmetros:", { therapistId, days });

    if (!therapistId) {
      return NextResponse.json({ error: "therapistId é obrigatório" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const url = `http://localhost:8000/therapists/${therapistId}/available-slots?days=${days}&duration_minutes=50&tz_offset=-03%3A00`;
    console.log("🌐 Chamando backend:", url);

    const response = await fetch(url, {
      headers: { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Erro no backend:", response.status, errorText);
      return NextResponse.json(
        { error: `Erro ${response.status} ao buscar slots` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Filtrar slots para mostrar apenas :00 e :30
    if (data.slots && Array.isArray(data.slots)) {
      data.slots = data.slots.filter((slot: any) => {
        const startTime = new Date(slot.starts_at);
        const minutes = startTime.getMinutes();
        return minutes === 0 || minutes === 30;
      });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("❌ Erro calendar:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}