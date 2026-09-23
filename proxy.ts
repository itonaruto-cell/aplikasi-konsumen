import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const auth = req.headers.get("authorization");

  if (auth && auth.startsWith("Basic ")) {
    const decoded = atob(auth.slice(6));
    const sep = decoded.indexOf(":");
    const user = decoded.slice(0, sep);
    const pass = decoded.slice(sep + 1);

    if (
      process.env.APP_USER &&
      process.env.APP_PASSWORD &&
      user === process.env.APP_USER &&
      pass === process.env.APP_PASSWORD
    ) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Login diperlukan", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Cari Konsumen"' },
  });
}

export const config = {
  matcher: [
    "/((?!manifest.json|icon-|.well-known|_next/static|_next/image|favicon.ico).*)",
  ],
};
