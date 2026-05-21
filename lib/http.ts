import { NextResponse } from "next/server";

export function noStoreJson(
  body: unknown,
  init: ResponseInit & { status?: number } = {}
) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");

  return NextResponse.json(body, {
    ...init,
    headers
  });
}
