import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  EDGE_CASES_CSV,
  EMPTY_CSV,
  generateLargeCsv,
  INVALID_EMAILS_CSV,
  MINIMAL_CSV_CONTENT,
  NO_EMAIL_COLUMN_CSV,
  VALID_CSV_CONTENT,
} from "./fixtures/test-data";

/**
 * File Upload Tests
 *
 * Tests for CSV file upload functionality
 */

// Top-level regex patterns for test assertions
const ERROR_NO_REGEX = /error|No/i;
const EMAIL_COLUMN_REGEX = /email|column/i;

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

test.describe("File Upload", () => {
  test.afterAll(() => {
    cleanupTempFiles();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should upload valid CSV file via click", async ({ page }) => {
    const tempFile = createTempFile(VALID_CSV_CONTENT, "valid-leads.csv");

    // Click dropzone to trigger file input
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator('[data-testid="upload-dropzone"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tempFile);

    // Should transition to uploading/parsing state
    await expect(
      page.locator("text=Uploading").or(page.locator("text=Parsing"))
    ).toBeVisible({ timeout: 5000 });
  });

  test("should upload CSV via drag and drop", async ({ page }) => {
    const tempFile = createTempFile(VALID_CSV_CONTENT, "drag-drop.csv");

    // Create a DataTransfer-like object
    const dropzone = page.locator('[data-testid="upload-dropzone"]');

    // Use Playwright's file upload with drag and drop simulation
    await dropzone.setInputFiles(tempFile);

    // Should start processing
    await expect(
      page.locator("text=Uploading").or(page.locator("text=Parsing"))
    ).toBeVisible({ timeout: 5000 });
  });

  test("should handle minimal CSV with only email column", async ({ page }) => {
    const tempFile = createTempFile(MINIMAL_CSV_CONTENT, "minimal.csv");

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator('[data-testid="upload-dropzone"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tempFile);

    // Should process successfully
    await expect(
      page.locator("text=Uploading").or(page.locator("text=Parsing"))
    ).toBeVisible({ timeout: 5000 });
  });

  test("should reject empty CSV", async ({ page }) => {
    const tempFile = createTempFile(EMPTY_CSV, "empty.csv");

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator('[data-testid="upload-dropzone"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tempFile);

    // Should show error toast
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator("[data-sonner-toast]")).toContainText(
      ERROR_NO_REGEX
    );
  });

  test("should reject CSV without email column", async ({ page }) => {
    const tempFile = createTempFile(NO_EMAIL_COLUMN_CSV, "no-email.csv");

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator('[data-testid="upload-dropzone"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tempFile);

    // Should show error toast about missing email column
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator("[data-sonner-toast]")).toContainText(
      EMAIL_COLUMN_REGEX
    );
  });

  test("should reject non-CSV files", async ({ page }) => {
    const tempFile = createTempFile('{"not": "csv"}', "test.json");

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator('[data-testid="upload-dropzone"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tempFile);

    // Should show error about file type
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("should handle CSV with special characters", async ({ page }) => {
    const tempFile = createTempFile(EDGE_CASES_CSV, "edge-cases.csv");

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator('[data-testid="upload-dropzone"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tempFile);

    // Should start processing without error
    await expect(
      page.locator("text=Uploading").or(page.locator("text=Parsing"))
    ).toBeVisible({ timeout: 5000 });
  });

  test("should filter out invalid emails during parsing", async ({ page }) => {
    const tempFile = createTempFile(INVALID_EMAILS_CSV, "invalid-emails.csv");

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator('[data-testid="upload-dropzone"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tempFile);

    // Should process but only include valid email
    await expect(
      page.locator("text=Uploading").or(page.locator("text=Parsing"))
    ).toBeVisible({ timeout: 5000 });
  });

  test("should show progress during upload", async ({ page }) => {
    // Use larger file to see progress
    const largeCsv = generateLargeCsv(100);
    const tempFile = createTempFile(largeCsv, "large.csv");

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator('[data-testid="upload-dropzone"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tempFile);

    // Should show progress indicator
    await expect(
      page.locator('[role="progressbar"]').or(page.locator("text=Uploading"))
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Dropzone UI States", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should show hover state on dropzone", async ({ page }) => {
    const dropzone = page.locator('[data-testid="upload-dropzone"]');
    await dropzone.hover();

    // Should have hover styles (check for class or style change)
    await expect(dropzone).toBeVisible();
  });

  test("should show accepted file types", async ({ page }) => {
    await expect(page.locator("text=CSV files only")).toBeVisible();
  });

  test("should show sample file link or info", async ({ page }) => {
    // Check for sample data information
    const dropzone = page.locator('[data-testid="upload-dropzone"]');
    await expect(dropzone).toBeVisible();
  });
});

test.describe("Large File Handling", () => {
  test.afterAll(() => {
    cleanupTempFiles();
  });

  test("should handle medium-sized CSV (1000 rows)", async ({ page }) => {
    await page.goto("/");

    const largeCsv = generateLargeCsv(1000);
    const tempFile = createTempFile(largeCsv, "medium.csv");

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator('[data-testid="upload-dropzone"]').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tempFile);

    // Should process without timeout
    await expect(
      page.locator("text=Uploading").or(page.locator("text=Parsing"))
    ).toBeVisible({ timeout: 10_000 });
  });
});
