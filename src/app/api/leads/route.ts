import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const source = searchParams.get("source");
  const minScore = searchParams.get("minScore");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  let query = supabase.from("leads").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (status) query = query.eq("status", status);
  if (source) query = query.eq("source", source);
  if (minScore) query = query.gte("score", parseInt(minScore));

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data, total: count });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabase.from("leads").insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
