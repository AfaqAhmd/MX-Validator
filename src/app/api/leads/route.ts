import { eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db, leads } from "@/lib/db";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const uploadId = searchParams.get("uploadId");

    if (!uploadId) {
      return NextResponse.json(
        { error: "Upload ID is required" },
        { status: 400 }
      );
    }

    if (!isValidUUID(uploadId)) {
      return NextResponse.json(
        { error: "Invalid upload ID format" },
        { status: 400 }
      );
    }

    const results = await db
      .select({
        domain: leads.domain,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(eq(leads.uploadId, uploadId))
      .groupBy(leads.domain);

    const domainCounts: Record<string, number> = {};
    for (const row of results) {
      domainCounts[row.domain] = row.count;
    }

    const allLeads = await db
      .select({
        id: leads.id,
        email: leads.email,
        firstName: leads.firstName,
        lastName: leads.lastName,
        company: leads.company,
        title: leads.title,
        domain: leads.domain,
      })
      .from(leads)
      .where(eq(leads.uploadId, uploadId));

    return NextResponse.json({
      success: true,
      domainCounts,
      leads: allLeads,
      totalLeads: allLeads.length,
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 }
    );
  }
}
