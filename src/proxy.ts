import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const path = request.nextUrl.pathname;

  // Rotas públicas
  if (path === "/login") {
    return NextResponse.next();
  }

  // Proteger todas as outras rotas
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirecionamentos baseados em role serão feitos no frontend
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};