import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { VALID_CSV_CONTENT } from "./fixtures/test-data";

/**
 * CSV Export Tests
 *
 * Tests for exporting results to CSV
 */

// Top-level regex patterns for test assertions
const CSV_FILENAME_REGEX = /mx-scan-results.*\.csv$/;
const MX_STATUS_REGEX = /Yes|No/;
const DATE_FILENAME_REGEX = /mx-scan-results-\d{4}-\d{2}-\d{2}\.csv/;
const CSV_EXT_REGEX = /\.csv$/;

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

// Helper to upload and wait for results
async function uploadAndWaitForResults(
  page: import("@playwright/test").Page,
  csvContent: string
): Promise<void> {
  const tempFile = createTempFile(csvContent, "export-test.csv");

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.locator('[data-testid="upload-dropzone"]').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(tempFile);

  // Wait for scan to complete
  await expect(page.locator('button:has-text("Export CSV")')).toBeVisible({
    timeout: 120_000,
  });
}

test.describe("CSV Export", () => {
  test.afterAll(() => {
    cleanupTempFiles();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should show export button after scan completes", async ({ page }) => {
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Export button should be visible
    await expect(page.locator('button:has-text("Export CSV")')).toBeVisible();
  });

  test("should download CSV when clicking export", async ({ page }) => {
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Set up download listener
    const downloadPromise = page.waitForEvent("download");

    // Click export button
    await page.locator('button:has-text("Export CSV")').click();

    // Wait for download
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(CSV_FILENAME_REGEX);
  });

  test("should include correct columns in exported CSV", async ({ page }) => {
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Set up download listener
    const downloadPromise = page.waitForEvent("download");

    // Click export button
    await page.locator('button:has-text("Export CSV")').click();

    // Wait for download
    const download = await downloadPromise;

    // Read downloaded file
    const filePath = await download.path();
    if (filePath) {
      const content = fs.readFileSync(filePath, "utf-8");

      // Check for expected columns in header
      expect(content).toContain("Email");
      expect(content).toContain("Domain");
      expect(content).toContain("Has MX");
    }
  });

  test("should include MX status in exported data", async ({ page }) => {
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Set up download listener
    const downloadPromise = page.waitForEvent("download");

    // Click export button
    await page.locator('button:has-text("Export CSV")').click();

    // Wait for download
    const download = await downloadPromise;

    // Read downloaded file
    const filePath = await download.path();
    if (filePath) {
      const content = fs.readFileSync(filePath, "utf-8");

      // Should have Yes or No values for MX status
      expect(content).toMatch(MX_STATUS_REGEX);
    }
  });

  test("should include original lead data in export", async ({ page }) => {
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Set up download listener
    const downloadPromise = page.waitForEvent("download");

    // Click export button
    await page.locator('button:has-text("Export CSV")').click();

    // Wait for download
    const download = await downloadPromise;

    // Read downloaded file
    const filePath = await download.path();
    if (filePath) {
      const content = fs.readFileSync(filePath, "utf-8");

      // Check for data from original CSV
      // VALID_CSV_CONTENT has john.smith@google.com, etc.
      expect(content).toContain("google.com");
    }
  });

  test("should include security gateway info if detected", async ({ page }) => {
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Set up download listener
    const downloadPromise = page.waitForEvent("download");

    // Click export button
    await page.locator('button:has-text("Export CSV")').click();

    // Wait for download
    const download = await downloadPromise;

    // Read downloaded file
    const filePath = await download.path();
    if (filePath) {
      const content = fs.readFileSync(filePath, "utf-8");

      // Should have Security Gateway column
      expect(content).toContain("Security Gateway");
    }
  });

  test("should have proper date in filename", async ({ page }) => {
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Set up download listener
    const downloadPromise = page.waitForEvent("download");

    // Click export button
    await page.locator('button:has-text("Export CSV")').click();

    // Wait for download
    const download = await downloadPromise;

    // Check filename format (mx-scan-results-YYYY-MM-DD.csv)
    const filename = download.suggestedFilename();
    expect(filename).toMatch(DATE_FILENAME_REGEX);
  });
});

test.describe("Export from Different Views", () => {
  test.afterAll(() => {
    cleanupTempFiles();
  });

  test("should export from analytics view", async ({ page }) => {
    await page.goto("/");
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Should be on analytics view by default
    await expect(page.locator("text=Email Deliverability")).toBeVisible();

    // Set up download listener
    const downloadPromise = page.waitForEvent("download");

    // Click export button
    await page.locator('button:has-text("Export CSV")').click();

    // Should download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(CSV_EXT_REGEX);
  });

  test("should export from table view", async ({ page }) => {
    await page.goto("/");
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Switch to table view
    await page.locator('button:has-text("Data Table")').click();
    await expect(page.locator("table")).toBeVisible();

    // Set up download listener
    const downloadPromise = page.waitForEvent("download");

    // Click export button
    await page.locator('button:has-text("Export CSV")').click();

    // Should download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(CSV_EXT_REGEX);
  });
});
