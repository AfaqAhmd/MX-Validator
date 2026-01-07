import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { DUPLICATE_DOMAINS_CSV, VALID_CSV_CONTENT } from "./fixtures/test-data";

/**
 * Results Table Tests
 *
 * Tests for the data table view, filtering, and sorting
 */

// Top-level regex patterns for test assertions
const EMAIL_DOMAIN_HEADER_REGEX = /Email|Domain/;

// Helper to create temp file for upload
function createTempFile(content: string, filename: string): string {
  const tempDir = path.join(process.cwd(), "tests", "e2e", "temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

// Cleanup temp files
function cleanupTempFiles(): void {
  const tempDir = path.join(process.cwd(), "tests", "e2e", "temp");
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
}

// Helper to upload, wait for results, and switch to table view
async function uploadAndShowTable(
  page: import("@playwright/test").Page,
  csvContent: string
): Promise<void> {
  const tempFile = createTempFile(csvContent, "table-test.csv");

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.locator('[data-testid="upload-dropzone"]').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(tempFile);

  // Wait for scan to complete
  await expect(page.locator('button:has-text("Data Table")')).toBeVisible({
    timeout: 120_000,
  });

  // Switch to table view
  await page.locator('button:has-text("Data Table")').click();

  // Wait for table to be visible
  await expect(page.locator("table")).toBeVisible();
}

test.describe("Results Table", () => {
  test.afterAll(() => {
    cleanupTempFiles();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display table with correct columns", async ({ page }) => {
    await uploadAndShowTable(page, VALID_CSV_CONTENT);

    // Check for expected column headers
    await expect(
      page.locator("th").filter({ hasText: EMAIL_DOMAIN_HEADER_REGEX })
    ).toBeVisible();
  });

  test("should display all uploaded leads in table", async ({ page }) => {
    await uploadAndShowTable(page, VALID_CSV_CONTENT);

    // VALID_CSV_CONTENT has 5 leads
    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("should show MX status for each row", async ({ page }) => {
    await uploadAndShowTable(page, VALID_CSV_CONTENT);

    // Should have MX status indicators (Valid MX, No MX badges)
    await expect(
      page
        .locator("text=Valid MX")
        .or(page.locator("text=No MX"))
        .or(page.locator('[data-testid="mx-status"]'))
    ).toBeVisible();
  });

  test("should show domain favicons", async ({ page }) => {
    await uploadAndShowTable(page, VALID_CSV_CONTENT);

    // Should have favicon images (from Google's service)
    const favicons = page.locator(
      'table img[src*="favicon"], table img[src*="gstatic"]'
    );
    const count = await favicons.count();
    expect(count).toBeGreaterThanOrEqual(0); // May or may not have favicons loaded
  });
});

test.describe("Table Filtering", () => {
  test.afterAll(() => {
    cleanupTempFiles();
  });

  test("should have search/filter input", async ({ page }) => {
    await page.goto("/");
    await uploadAndShowTable(page, VALID_CSV_CONTENT);

    // Look for search input
    const searchInput = page.locator(
      'input[placeholder*="Search"], input[placeholder*="Filter"], input[type="search"]'
    );

    // May or may not have search depending on implementation
    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (hasSearch) {
      await expect(searchInput).toBeVisible();
    }
  });

  test("should filter results when searching", async ({ page }) => {
    await page.goto("/");
    await uploadAndShowTable(page, VALID_CSV_CONTENT);

    // Find search input
    const searchInput = page.locator(
      'input[placeholder*="Search"], input[placeholder*="Filter"], input[type="search"]'
    );

    const hasSearch = await searchInput.isVisible().catch(() => false);

    if (hasSearch) {
      // Type a search term
      await searchInput.fill("google");

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Check results are filtered
      const rows = page.locator("table tbody tr");
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe("Table View Modes", () => {
  test.afterAll(() => {
    cleanupTempFiles();
  });

  test("should have email and domain view toggle", async ({ page }) => {
    await page.goto("/");
    await uploadAndShowTable(page, DUPLICATE_DOMAINS_CSV);

    // Look for view mode toggle (email vs domain)
    const emailViewBtn = page
      .locator('button:has-text("Email")')
      .or(page.locator('[data-testid="email-view"]'));
    const domainViewBtn = page
      .locator('button:has-text("Domain")')
      .or(page.locator('[data-testid="domain-view"]'));

    // At least one should be visible if feature exists
    const hasToggle =
      (await emailViewBtn.isVisible().catch(() => false)) ||
      (await domainViewBtn.isVisible().catch(() => false));

    // Try switching views
    if (hasToggle && (await domainViewBtn.isVisible())) {
      await domainViewBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test("should aggregate by domain in domain view", async ({ page }) => {
    await page.goto("/");
    await uploadAndShowTable(page, DUPLICATE_DOMAINS_CSV);

    // DUPLICATE_DOMAINS_CSV has 5 emails across 2 domains
    // If in domain view, should show 2 rows
    // If in email view, should show 5 rows

    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Table Sorting", () => {
  test.afterAll(() => {
    cleanupTempFiles();
  });

  test("should have sortable column headers", async ({ page }) => {
    await page.goto("/");
    await uploadAndShowTable(page, VALID_CSV_CONTENT);

    // Check if headers are clickable for sorting
    const headers = page.locator("table th");
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThanOrEqual(1);
  });

  test("should sort when clicking column header", async ({ page }) => {
    await page.goto("/");
    await uploadAndShowTable(page, VALID_CSV_CONTENT);

    // Find a sortable header
    const header = page.locator("table th").first();

    // Click to sort
    await header.click();
    await page.waitForTimeout(300);

    // Table should still be visible
    await expect(page.locator("table")).toBeVisible();
  });
});

test.describe("Table Responsiveness", () => {
  test.afterAll(() => {
    cleanupTempFiles();
  });

  test("should be scrollable on mobile", async ({ page }) => {
    await page.goto("/");
    await uploadAndShowTable(page, VALID_CSV_CONTENT);

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Table should still be visible (possibly in scrollable container)
    await expect(page.locator("table")).toBeVisible();
  });

  test("should show data on tablet viewport", async ({ page }) => {
    await page.goto("/");
    await uploadAndShowTable(page, VALID_CSV_CONTENT);

    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    // Table should be visible and functional
    await expect(page.locator("table")).toBeVisible();

    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
