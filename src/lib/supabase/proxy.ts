import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export async function updateSupabaseSession(request: NextRequest) {
  const config = getSupabasePublicConfig();
  const isPrivateRoute =
    request.nextUrl.pathname === "/dashboard" ||
    request.nextUrl.pathname.startsWith("/dashboard/");

  if (!config) {
    if (isPrivateRoute) {
      return NextResponse.redirect(new URL("/login?error=configuration", request.url));
    }

    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();

  if (isPrivateRoute && !data?.claims?.sub) {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));

    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    for (const headerName of ["cache-control", "expires", "pragma"]) {
      const headerValue = response.headers.get(headerName);

      if (headerValue) {
        redirectResponse.headers.set(headerName, headerValue);
      }
    }

    return redirectResponse;
  }

  return response;
}
