/**
 * Test Fixtures Index
 *
 * Extended Playwright test fixtures with custom utilities
 */

import fs from "node:fs";
import path from "node:path";
import { test as base, expect, type Page } from "@playwright/test";

/**
 * Custom test fixtures extending Playwright's base
 */
export const test = base.extend<{
  /** Upload a CSV file to the dropzone */
  uploadCsv: (content: string, filename?: string) => Promise<void>;
  /** Wait for scan to complete */
  waitForScanComplete: () => Promise<void>;
  /** Get current stage from UI */
  getCurrentStage: () => Promise<string>;
}>({
  uploadCsv: async ({ page }, use) => {
    const uploadCsv = async (content: string, filename = "test-leads.csv") => {
      // Create a temporary file
      const tempDir = path.join(process.cwd(), "tests", "e2e", "temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempFile = path.join(tempDir, filename);
      fs.writeFileSync(tempFile, content);

      // Set up file chooser handler
      const fileChooserPromise = page.waitForEvent("filechooser");

      // Click the dropzone to trigger file input
      await page.locator('[data-testid="upload-dropzone"]').click();

      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(tempFile);

      // Clean up temp file
      fs.unlinkSync(tempFile);
    };

    await use(uploadCsv);
  },

  waitForScanComplete: async ({ page }, use) => {
    const waitForScanComplete = async () => {
      // Wait for either analytics view or table view to appear
      await page.waitForSelector(
        '[data-testid="analytics-view"], [data-testid="results-table"]',
        { timeout: 120_000 }
      );
    };

    await use(waitForScanComplete);
  },

  getCurrentStage: async ({ page }, use) => {
    const getCurrentStage = async (): Promise<string> => {
      // Check for various UI states
      if (await page.locator('[data-testid="upload-dropzone"]').isVisible()) {
        return "idle";
      }
      if (
        await page.locator('[data-testid="progress-uploading"]').isVisible()
      ) {
        return "uploading";
      }
      if (await page.locator('[data-testid="progress-parsing"]').isVisible()) {
        return "parsing";
      }
      if (await page.locator('[data-testid="progress-scanning"]').isVisible()) {
        return "scanning";
      }
      if (await page.locator('[data-testid="analytics-view"]').isVisible()) {
        return "complete";
      }
      if (await page.locator('[data-testid="results-table"]').isVisible()) {
        return "complete";
      }
      return "unknown";
    };

    await use(getCurrentStage);
  },
});

export { expect };

/**
 * Helper to wait for toast notification
 */
export async function waitForToast(
  page: Page,
  textMatch: string | RegExp
): Promise<void> {
  await page.waitForSelector("[data-sonner-toast]", { timeout: 10_000 });
  const toast = page.locator("[data-sonner-toast]");
  await expect(toast).toContainText(textMatch);
}

/**
 * Helper to check if element has specific class
 */
export async function hasClass(
  page: Page,
  selector: string,
  className: string
): Promise<boolean> {
  const element = page.locator(selector);
  const classes = await element.getAttribute("class");
  return classes?.includes(className) ?? false;
}

/**
 * Helper to download and read exported CSV
 */
export async function downloadAndReadCsv(page: Page): Promise<string> {
  const downloadPromise = page.waitForEvent("download");
  await page.locator('button:has-text("Export CSV")').click();
  const download = await downloadPromise;

  const filePath = await download.path();
  if (!filePath) throw new Error("Download failed");

  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Helper to count table rows
 */
export async function countTableRows(page: Page): Promise<number> {
  const rows = page.locator("table tbody tr");
  return await rows.count();
}

/**
 * Cleanup temp files after tests
 */
export function cleanupTempFiles(): void {
  const tempDir = path.join(process.cwd(), "tests", "e2e", "temp");
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
}
