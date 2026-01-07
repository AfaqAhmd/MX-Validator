import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, domains, type MXRecord } from "@/lib/db";
import {
  detectSecurityGateway,
  type GoogleDNSResponse,
  getFaviconUrl,
  isValidDomain,
  parseMXData,
} from "@/lib/utils";

const MAX_DOMAINS = 50_000;
const CONCURRENCY = 50;
const DNS_TIMEOUT = 10_000;
const CACHE_HOURS = 24;

async function fetchMXRecords(domain: string): Promise<{
  hasMx: boolean;
  mxRecords: MXRecord[];
  securityGateway: { name: string; color: string } | null;
}> {
  try {
    const response = await fetch(
      `https://dns.google.com/resolve?name=${encodeURIComponent(domain)}&type=MX`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(DNS_TIMEOUT),
      }
    );

    if (!response.ok) {
      return { hasMx: false, mxRecords: [], securityGateway: null };
    }

    const data: GoogleDNSResponse = await response.json();

    // Status 0 = NOERROR, type 15 = MX
    if (data.Status !== 0 || !data.Answer) {
      return { hasMx: false, mxRecords: [], securityGateway: null };
    }

    const mxRecords: MXRecord[] = [];
    let securityGateway: { name: string; color: string } | null = null;

    for (const answer of data.Answer) {
      if (answer.type === 15) {
        const parsed = parseMXData(answer.data);
        if (parsed) {
          mxRecords.push({
            priority: parsed.priority,
            exchange: parsed.exchange,
            ttl: answer.TTL,
          });

          // Check for security gateway
          if (!securityGateway) {
            securityGateway = detectSecurityGateway(parsed.exchange);
          }
        }
      }
    }

    // Sort by priority (lower = higher priority)
    mxRecords.sort((a, b) => a.priority - b.priority);

    return {
      hasMx: mxRecords.length > 0,
      mxRecords,
      securityGateway,
    };
  } catch {
    // Don't log full error to avoid leaking internal details
    console.error(`MX lookup failed for ${domain}`);
    return { hasMx: false, mxRecords: [], securityGateway: null };
  }
}

interface DomainResult {
  domain: string;
  hasMx: boolean;
  mxRecords: MXRecord[];
  faviconUrl: string;
  securityGatewayName: string | null;
  securityGatewayColor: string | null;
}

async function processDomain(domain: string): Promise<DomainResult> {
  const existing = await db.query.domains.findFirst({
    where: eq(domains.domain, domain),
  });

  // Use cached result if within cache duration
  if (existing?.scannedAt) {
    const hoursSinceScanned =
      (Date.now() - existing.scannedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceScanned < CACHE_HOURS) {
      return {
        domain,
        hasMx: existing.hasMx,
        mxRecords: (existing.mxRecords as MXRecord[]) || [],
        faviconUrl: existing.faviconUrl || getFaviconUrl(domain),
        securityGatewayName: existing.securityGatewayName || null,
        securityGatewayColor: existing.securityGatewayColor || null,
      };
    }
  }

  // Fetch fresh MX records
  const { hasMx, mxRecords, securityGateway } = await fetchMXRecords(domain);
  const faviconUrl = getFaviconUrl(domain);

  // Upsert domain record
  try {
    if (existing) {
      await db
        .update(domains)
        .set({
          hasMx,
          mxRecords,
          faviconUrl,
          securityGatewayName: securityGateway?.name || null,
          securityGatewayColor: securityGateway?.color || null,
          scannedAt: new Date(),
        })
        .where(eq(domains.id, existing.id));
    } else {
      await db.insert(domains).values({
        domain,
        hasMx,
        mxRecords,
        faviconUrl,
        securityGatewayName: securityGateway?.name || null,
        securityGatewayColor: securityGateway?.color || null,
        scannedAt: new Date(),
      });
    }
  } catch {
    console.error(`DB upsert failed for ${domain}`);
  }

  return {
    domain,
    hasMx,
    mxRecords,
    faviconUrl,
    securityGatewayName: securityGateway?.name || null,
    securityGatewayColor: securityGateway?.color || null,
  };
}

async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  concurrency: number,
  onProgress: (completed: number, total: number, result: R) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let completed = 0;
  let currentIndex = 0;

  const processNext = async (): Promise<void> => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];
      const result = await processor(item, index);
      results[index] = result;
      completed++;
      onProgress(completed, items.length, result);
    }
  };

  // Start concurrent workers
  const workers = new Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => processNext());

  await Promise.all(workers);
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domains: domainList, stream = false } = body as {
      domains: string[];
      stream?: boolean;
    };

    // Validate input
    if (!Array.isArray(domainList)) {
      return new Response(
        JSON.stringify({ error: "Invalid request: domains must be an array" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (domainList.length === 0) {
      return new Response(JSON.stringify({ error: "No domains provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (domainList.length > MAX_DOMAINS) {
      return new Response(
        JSON.stringify({
          error: `Too many domains. Maximum is ${MAX_DOMAINS.toLocaleString()}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Dedupe, validate, and filter domains
    const uniqueDomains = [
      ...new Set(
        domainList
          .filter(Boolean)
          .map((d) => String(d).toLowerCase().trim())
          .filter(isValidDomain)
      ),
    ];

    if (uniqueDomains.length === 0) {
      return new Response(JSON.stringify({ error: "No valid domains found" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (stream) {
      // Server-Sent Events for real-time progress
      const encoder = new TextEncoder();

      const readable = new ReadableStream({
        async start(controller) {
          const results: DomainResult[] = [];
          let domainsWithMx = 0;
          let domainsWithoutMx = 0;
          let domainsWithGateway = 0;

          try {
            await processWithConcurrency(
              uniqueDomains,
              async (domain) => processDomain(domain),
              CONCURRENCY,
              (completed, total, result) => {
                results.push(result);
                if (result.hasMx) domainsWithMx++;
                else domainsWithoutMx++;
                if (result.securityGatewayName) domainsWithGateway++;

                // Send progress update
                const progressData = {
                  type: "progress",
                  completed,
                  total,
                  percent: Math.round((completed / total) * 100),
                  currentDomain: result.domain,
                  hasMx: result.hasMx,
                  domainsWithMx,
                  domainsWithoutMx,
                  domainsWithGateway,
                  securityGateway: result.securityGatewayName,
                };
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(progressData)}\n\n`)
                );
              }
            );

            // Sort results: domains with MX first, then alphabetically
            results.sort((a, b) => {
              if (a.hasMx !== b.hasMx) return b.hasMx ? 1 : -1;
              return a.domain.localeCompare(b.domain);
            });

            // Compute gateway statistics
            const gatewayStats: Record<string, number> = {};
            for (const result of results) {
              if (result.securityGatewayName) {
                gatewayStats[result.securityGatewayName] =
                  (gatewayStats[result.securityGatewayName] || 0) + 1;
              }
            }

            // Send final results
            const finalData = {
              type: "complete",
              success: true,
              totalDomains: results.length,
              domainsWithMx,
              domainsWithoutMx,
              domainsWithGateway,
              gatewayStats,
              results,
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`)
            );
          } catch {
            const errorData = {
              type: "error",
              error: "Failed to scan MX records",
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`)
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Non-streaming batch response
    const results: DomainResult[] = [];
    let domainsWithGateway = 0;

    await processWithConcurrency(
      uniqueDomains,
      async (domain) => processDomain(domain),
      CONCURRENCY,
      (_completed, _total, result) => {
        results.push(result);
        if (result.securityGatewayName) domainsWithGateway++;
      }
    );

    // Sort results
    results.sort((a, b) => {
      if (a.hasMx !== b.hasMx) return b.hasMx ? 1 : -1;
      return a.domain.localeCompare(b.domain);
    });

    return Response.json({
      success: true,
      totalDomains: results.length,
      domainsWithMx: results.filter((r) => r.hasMx).length,
      domainsWithoutMx: results.filter((r) => !r.hasMx).length,
      domainsWithGateway,
      results,
    });
  } catch (err) {
    console.error("MX scan error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to scan MX records" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
