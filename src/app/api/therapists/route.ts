import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([
    {
      id: 1,
      user_id: 2,
      bio: "Psicólogo clínico",
      session_price: 150
    },
    {
      id: 2,
      user_id: 3,
      bio: "Psicanalista",
      session_price: 200
    }
  ]);
}