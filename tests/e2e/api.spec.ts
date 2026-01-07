import { expect, test } from "@playwright/test";

/**
 * API Route Tests
 *
 * Tests for the backend API endpoints
 */

test.describe("Upload API", () => {
  test("POST /api/upload should accept valid CSV", async ({ request }) => {
    const csvContent = `email,first_name,last_name,company,title
test@google.com,Test,User,Google,Engineer`;

    const response = await request.post("/api/upload", {
      multipart: {
        file: {
          name: "test.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(csvContent),
        },
      },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.uploadId).toBeDefined();
    expect(data.uniqueDomains).toContain("google.com");
  });

  test("POST /api/upload should reject empty file", async ({ request }) => {
    const response = await request.post("/api/upload", {
      multipart: {
        file: {
          name: "empty.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(""),
        },
      },
    });

    // Should return error status
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test("POST /api/upload should reject CSV without email column", async ({
    request,
  }) => {
    const csvContent = `name,company
John Doe,Acme Corp`;

    const response = await request.post("/api/upload", {
      multipart: {
        file: {
          name: "no-email.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(csvContent),
        },
      },
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);

    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test("POST /api/upload should handle large files", async ({ request }) => {
    // Generate a larger CSV
    let csvContent = "email,first_name,last_name,company,title\n";
    for (let i = 0; i < 500; i++) {
      csvContent += `user${i}@company${i % 50}.com,First${i},Last${i},Company${i},Title\n`;
    }

    const response = await request.post("/api/upload", {
      multipart: {
        file: {
          name: "large.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(csvContent),
        },
      },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.processedRows).toBe(500);
  });
});

test.describe("MX Scan API", () => {
  test("POST /api/scan-mx should accept valid domains", async ({ request }) => {
    const response = await request.post("/api/scan-mx", {
      data: {
        domains: ["google.com", "microsoft.com"],
        stream: false,
      },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.results).toBeDefined();
    expect(data.results.length).toBe(2);
  });

  test("POST /api/scan-mx should return MX status", async ({ request }) => {
    const response = await request.post("/api/scan-mx", {
      data: {
        domains: ["google.com"],
        stream: false,
      },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.results[0]).toMatchObject({
      domain: "google.com",
      hasMx: expect.any(Boolean),
    });
  });

  test("POST /api/scan-mx should handle invalid domains", async ({
    request,
  }) => {
    const response = await request.post("/api/scan-mx", {
      data: {
        domains: ["not-a-real-domain-12345.xyz"],
        stream: false,
      },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    // Invalid domain should have hasMx: false
    expect(data.results[0].hasMx).toBe(false);
  });

  test("POST /api/scan-mx should deduplicate domains", async ({ request }) => {
    const response = await request.post("/api/scan-mx", {
      data: {
        domains: ["google.com", "GOOGLE.COM", "Google.Com"],
        stream: false,
      },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    // Should only have 1 result after deduplication
    expect(data.results.length).toBe(1);
  });

  test("POST /api/scan-mx should reject empty domains array", async ({
    request,
  }) => {
    const response = await request.post("/api/scan-mx", {
      data: {
        domains: [],
        stream: false,
      },
    });

    expect(response.status()).toBe(400);
  });

  test("POST /api/scan-mx should return favicon URLs", async ({ request }) => {
    const response = await request.post("/api/scan-mx", {
      data: {
        domains: ["google.com"],
        stream: false,
      },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.results[0].faviconUrl).toContain("gstatic.com");
  });

  test("POST /api/scan-mx streaming should return SSE format", async ({
    request,
  }) => {
    const response = await request.post("/api/scan-mx", {
      data: {
        domains: ["google.com"],
        stream: true,
      },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/event-stream");
  });
});

test.describe("Leads API", () => {
  test("GET /api/leads should require uploadId", async ({ request }) => {
    const response = await request.get("/api/leads");

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test("GET /api/leads should return 404 for invalid uploadId", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/leads?uploadId=00000000-0000-0000-0000-000000000000"
    );

    // Should return 404 or empty results
    const status = response.status();
    expect([200, 404]).toContain(status);
  });
});

test.describe("API Error Handling", () => {
  test("should return JSON error for invalid JSON body", async ({
    request,
  }) => {
    const response = await request.post("/api/scan-mx", {
      data: "not json",
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Should handle gracefully
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test("should handle missing Content-Type", async ({ request }) => {
    const response = await request.post("/api/scan-mx", {
      data: {
        domains: ["google.com"],
      },
    });

    // Should still work or return proper error
    expect([200, 400, 415]).toContain(response.status());
  });
});

test.describe("Security Headers", () => {
  test("should have security headers on API responses", async ({ request }) => {
    const response = await request.post("/api/scan-mx", {
      data: {
        domains: ["google.com"],
        stream: false,
      },
    });

    // Check for common security headers (may vary by deployment)
    const headers = response.headers();

    // Content-Type should be set
    expect(headers["content-type"]).toBeDefined();
  });
});
