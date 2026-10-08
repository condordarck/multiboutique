import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, SESSION_COOKIE } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = await getUserFromRequest(
    request.cookies.get(SESSION_COOKIE)?.value
  );

  const isAuthApi = pathname.startsWith("/api/auth");
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/client") ||
    (pathname.startsWith("/api") && !isAuthApi);

  // Routes protégées → connexion requise
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // L'administrateur ne doit pas accéder aux données commerciales
  if (pathname.startsWith("/dashboard") && user?.role === "administrateur") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  // Les directeurs (siège) n'ont pas accès à l'administration
  if (
    pathname.startsWith("/admin") &&
    (user?.role === "directeur_groupe" ||
      user?.role === "directeur_region")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/consolidation";
    return NextResponse.redirect(url);
  }

  // Utilisateur connecté sur /login → son espace
  if (pathname === "/login" && user) {
    const url = request.nextUrl.clone();
    if (user.role === "administrateur") {
      url.pathname = "/admin";
    } else if (user.role === "client") {
      url.pathname = "/client";
    } else if (
      user.role === "directeur_groupe" ||
      user.role === "directeur_region"
    ) {
      url.pathname = "/dashboard/consolidation";
    } else if (user.role === "proprietaire") {
      url.pathname = "/dashboard";
    } else if (user.boutique_ids && user.boutique_ids.length > 0) {
      url.pathname = `/dashboard/${user.boutique_ids[0]}`;
    } else {
      url.pathname = "/dashboard";
    }
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};