import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ success: true });
  
  // Limpar cookies
  res.cookies.delete("access_token");
  res.cookies.delete("refresh_token");
  
  return res;
}