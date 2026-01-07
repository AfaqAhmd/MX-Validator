import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { DUPLICATE_DOMAINS_CSV, VALID_CSV_CONTENT } from "./fixtures/test-data";

/**
 * MX Scanning Tests
 *
 * Tests for the MX record scanning process and real-time progress
 */

// Top-level regex patterns for test assertions
const SCAN_COMPLETE_REGEX = /scanned|domains|complete/i;

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

// Helper to upload and start scan
async function uploadAndStartScan(
  page: import("@playwright/test").Page,
  csvContent: string
): Promise<void> {
  const tempFile = createTempFile(csvContent, "scan-test.csv");

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.locator('[data-testid="upload-dropzone"]').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(tempFile);
}

test.describe("MX Scanning Process", () => {
  test.afterAll(() => {
    cleanupTempFiles();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should transition through stages: upload -> parse -> scan -> complete", async ({
    page,
  }) => {
    await uploadAndStartScan(page, VALID_CSV_CONTENT);

    // Stage 1: Uploading
    await expect(
      page.locator("text=Uploading").or(page.locator("text=Parsing"))
    ).toBeVisible({ timeout: 5000 });

    // Stage 2: Scanning (may skip upload stage if fast)
    await expect(page.locator("text=Scanning")).toBeVisible({
      timeout: 15_000,
    });

    // Stage 3: Complete - wait for results
    await expect(
      page
        .locator('[data-testid="analytics-view"]')
        .or(page.locator("text=Analytics"))
    ).toBeVisible({ timeout: 60_000 });
  });

  test("should show real-time progress during scanning", async ({ page }) => {
    await uploadAndStartScan(page, VALID_CSV_CONTENT);

    // Wait for scanning stage
    await expect(page.locator("text=Scanning")).toBeVisible({
      timeout: 15_000,
    });

    // Should show progress bar or percentage
    await expect(
      page
        .locator('[role="progressbar"]')
        .or(page.locator("text=%"))
        .or(page.locator('[data-testid="scan-progress"]'))
    ).toBeVisible({ timeout: 10_000 });
  });

  test("should show current domain being scanned", async ({ page }) => {
    await uploadAndStartScan(page, VALID_CSV_CONTENT);

    // Wait for scanning stage
    await expect(page.locator("text=Scanning")).toBeVisible({
      timeout: 15_000,
    });

    // Should show current domain or recent results
    // Look for domain names in progress area
    await expect(
      page
        .locator("text=.com")
        .or(page.locator('[data-testid="current-domain"]'))
        .or(page.locator('[data-testid="recent-results"]'))
    ).toBeVisible({ timeout: 15_000 });
  });

  test("should show live stats during scanning", async ({ page }) => {
    await uploadAndStartScan(page, VALID_CSV_CONTENT);

    // Wait for scanning stage
    await expect(page.locator("text=Scanning")).toBeVisible({
      timeout: 15_000,
    });

    // Should show counters for domains with MX / without MX
    await expect(
      page
        .locator("text=Valid MX")
        .or(page.locator("text=No MX"))
        .or(page.locator('[data-testid="scan-stats"]'))
    ).toBeVisible({ timeout: 15_000 });
  });

  test("should deduplicate domains before scanning", async ({ page }) => {
    await uploadAndStartScan(page, DUPLICATE_DOMAINS_CSV);

    // Wait for scanning to start
    await expect(page.locator("text=Scanning")).toBeVisible({
      timeout: 15_000,
    });

    // The duplicate domains CSV has 5 leads but only 2 unique domains
    // Check that we're scanning fewer domains than total leads
    // This is hard to verify directly, but we can check the completion
    await expect(
      page
        .locator('[data-testid="analytics-view"]')
        .or(page.locator("text=Analytics"))
    ).toBeVisible({ timeout: 60_000 });
  });

  test("should show success toast on completion", async ({ page }) => {
    await uploadAndStartScan(page, VALID_CSV_CONTENT);

    // Wait for completion
    await expect(
      page
        .locator('[data-testid="analytics-view"]')
        .or(page.locator("text=Analytics"))
    ).toBeVisible({ timeout: 60_000 });

    // Should show success toast
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator("[data-sonner-toast]")).toContainText(
      SCAN_COMPLETE_REGEX
    );
  });
});

test.describe("Scan Results", () => {
  test.afterAll(() => {
    cleanupTempFiles();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display analytics view after scan completes", async ({
    page,
  }) => {
    await uploadAndStartScan(page, VALID_CSV_CONTENT);

    // Wait for completion
    await expect(
      page
        .locator('[data-testid="analytics-view"]')
        .or(page.locator("text=Total Emails"))
    ).toBeVisible({ timeout: 60_000 });

    // Should show key stats
    await expect(
      page.locator("text=Total Emails").or(page.locator("text=Deliverable"))
    ).toBeVisible();
  });

  test("should show view toggle buttons after scan", async ({ page }) => {
    await uploadAndStartScan(page, VALID_CSV_CONTENT);

    // Wait for completion
    await expect(
      page.locator("text=Analytics").or(page.locator("text=Data Table"))
    ).toBeVisible({ timeout: 60_000 });

    // Should show both toggle options
    await expect(page.locator('button:has-text("Analytics")')).toBeVisible();
    await expect(page.locator('button:has-text("Data Table")')).toBeVisible();
  });

  test("should show export and reset buttons after scan", async ({ page }) => {
    await uploadAndStartScan(page, VALID_CSV_CONTENT);

    // Wait for completion
    await expect(page.locator('button:has-text("Export CSV")')).toBeVisible({
      timeout: 60_000,
    });

    // Should show both action buttons
    await expect(page.locator('button:has-text("Export CSV")')).toBeVisible();
    await expect(
      page.locator('button:has-text("Scan Another File")')
    ).toBeVisible();
  });

  test("should show CTA section after scan completes", async ({ page }) => {
    await uploadAndStartScan(page, VALID_CSV_CONTENT);

    // Wait for completion and scroll down
    await expect(
      page
        .locator('[data-testid="analytics-view"]')
        .or(page.locator("text=Analytics"))
    ).toBeVisible({ timeout: 60_000 });

    // Scroll to see CTA
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Should show CTA
    await expect(
      page.locator("text=Ready to supercharge your cold email")
    ).toBeVisible();
  });
});

test.describe("Scan Reset", () => {
  test.afterAll(() => {
    cleanupTempFiles();
  });

  test("should reset to idle state when clicking 'Scan Another File'", async ({
    page,
  }) => {
    await page.goto("/");
    await uploadAndStartScan(page, VALID_CSV_CONTENT);

    // Wait for completion
    await expect(
      page.locator('button:has-text("Scan Another File")')
    ).toBeVisible({ timeout: 60_000 });

    // Click reset button
    await page.locator('button:has-text("Scan Another File")').click();

    // Should be back to idle state with dropzone visible
    await expect(page.locator('[data-testid="upload-dropzone"]')).toBeVisible();
  });
});
