import { NextResponse } from "next/server";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  isValidOrganizationSlug,
} from "@/lib/active-organization";

type SwitchOrganizationRouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: SwitchOrganizationRouteContext,
) {
  const { slug } = await params;
  const destination = new URL(`/o/${encodeURIComponent(slug)}`, request.url);
  const response = NextResponse.redirect(destination);

  if (isValidOrganizationSlug(slug)) {
    response.cookies.set({
      name: ACTIVE_ORGANIZATION_COOKIE,
      value: slug,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}
