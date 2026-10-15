import { NextResponse, type NextRequest } from "next/server";
// One password for the whole site, using the browser's built-in login prompt. Username can be anything.
export function middleware(req: NextRequest) {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) return new NextResponse("Set DASHBOARD_PASSWORD in your environment variables", { status: 503 }); // fail closed
  if (req.nextUrl.pathname === "/api/cron") return NextResponse.next(); // protected by CRON_SECRET instead
  const h = req.headers.get("authorization") ?? "";
  if (h.startsWith("Basic ")) {
    const s = atob(h.slice(6)); const given = s.slice(s.indexOf(":") + 1);
    let diff = given.length ^ pw.length; for (let i = 0; i < pw.length; i++) diff |= (given.charCodeAt(i) || 0) ^ pw.charCodeAt(i);
    if (diff === 0) return NextResponse.next();
  }
  return new NextResponse("Password required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Funding Monitor"' } });
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
