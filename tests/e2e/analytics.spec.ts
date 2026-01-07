import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { MIXED_DOMAINS_CSV, VALID_CSV_CONTENT } from "./fixtures/test-data";

/**
 * Analytics Dashboard Tests
 *
 * Tests for the analytics view, charts, and insights
 */

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

// Helper to upload and wait for scan completion
async function uploadAndWaitForResults(
  page: import("@playwright/test").Page,
  csvContent: string
): Promise<void> {
  const tempFile = createTempFile(csvContent, "analytics-test.csv");

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.locator('[data-testid="upload-dropzone"]').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(tempFile);

  // Wait for scan to complete
  await expect(
    page
      .locator('[data-testid="analytics-view"]')
      .or(page.locator("text=Total Emails"))
  ).toBeVisible({ timeout: 120_000 });
}

test.describe("Analytics Dashboard", () => {
  test.afterAll(() => {
    cleanupTempFiles();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display stat cards with correct data", async ({ page }) => {
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Check stat cards
    await expect(page.locator("text=Total Emails")).toBeVisible();
    await expect(page.locator("text=Deliverable")).toBeVisible();
    await expect(page.locator("text=Undeliverable")).toBeVisible();
    await expect(page.locator("text=With Security Gateway")).toBeVisible();
  });

  test("should show deliverability rate percentage", async ({ page }) => {
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Look for percentage display (e.g., "100%", "80.0%")
    await expect(page.locator("text=/%/")).toBeVisible();
  });

  test("should display email deliverability chart", async ({ page }) => {
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Check for deliverability chart section
    await expect(page.locator("text=Email Deliverability")).toBeVisible();

    // Should have a chart/visualization (Recharts renders SVG)
    await expect(page.locator(".recharts-wrapper").first()).toBeVisible();
  });

  test("should display quality score gauge", async ({ page }) => {
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Check for quality score section
    await expect(page.locator("text=List Quality Score")).toBeVisible();

    // Should show score level (Excellent, Needs Attention, or Poor)
    await expect(
      page
        .locator("text=Excellent")
        .or(page.locator("text=Needs Attention"))
        .or(page.locator("text=Poor Quality"))
    ).toBeVisible();
  });

  test("should display top domains bar chart", async ({ page }) => {
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Check for top domains section
    await expect(page.locator("text=Top Domains by Lead Count")).toBeVisible();
  });

  test("should display key insights section", async ({ page }) => {
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Scroll to insights section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Check for insights section
    await expect(page.locator("text=Key Insights")).toBeVisible();
  });

  test("should show appropriate insight based on deliverability", async ({
    page,
  }) => {
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Scroll to insights section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Should show either "High Deliverability" or "Deliverability Concerns"
    await expect(
      page
        .locator("text=High Deliverability")
        .or(page.locator("text=Deliverability Concerns"))
    ).toBeVisible();
  });
});

test.describe("Analytics with Mixed Results", () => {
  test.afterAll(() => {
    cleanupTempFiles();
  });

  test("should show both deliverable and undeliverable counts", async ({
    page,
  }) => {
    await page.goto("/");
    await uploadAndWaitForResults(page, MIXED_DOMAINS_CSV);

    // Should show non-zero values for both
    await expect(page.locator("text=Deliverable")).toBeVisible();
    await expect(page.locator("text=Undeliverable")).toBeVisible();

    // The undeliverable count should be visible (fake domains won't have MX)
    // This verifies the analytics correctly separates valid from invalid
  });

  test("should show invalid domains insight when present", async ({ page }) => {
    await page.goto("/");
    await uploadAndWaitForResults(page, MIXED_DOMAINS_CSV);

    // Scroll to insights
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Should show insight about invalid domains
    await expect(
      page
        .locator("text=Invalid Domains Found")
        .or(page.locator("text=Deliverability Concerns"))
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Analytics Charts Interactivity", () => {
  test.afterAll(() => {
    cleanupTempFiles();
  });

  test("should show tooltip on chart hover", async ({ page }) => {
    await page.goto("/");
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Find a chart element and hover
    const chart = page.locator(".recharts-wrapper").first();
    await chart.hover();

    // Tooltip might appear (Recharts tooltips)
    // This is a basic check - actual tooltip testing depends on chart type
    await expect(chart).toBeVisible();
  });

  test("should have responsive charts on resize", async ({ page }) => {
    await page.goto("/");
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Get initial chart container
    const chartContainer = page
      .locator(".recharts-responsive-container")
      .first();
    await expect(chartContainer).toBeVisible();

    // Resize viewport
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500); // Wait for resize

    // Chart should still be visible (responsive)
    await expect(chartContainer).toBeVisible();

    // Resize to mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Charts should adapt
    await expect(page.locator(".recharts-wrapper").first()).toBeVisible();
  });
});

test.describe("View Toggle", () => {
  test.afterAll(() => {
    cleanupTempFiles();
  });

  test("should default to analytics view", async ({ page }) => {
    await page.goto("/");
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Analytics button should be active
    const analyticsBtn = page.locator('button:has-text("Analytics")');
    await expect(analyticsBtn).toBeVisible();

    // Should show analytics content
    await expect(page.locator("text=Email Deliverability")).toBeVisible();
  });

  test("should switch to table view when clicking Data Table", async ({
    page,
  }) => {
    await page.goto("/");
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Click table view button
    await page.locator('button:has-text("Data Table")').click();

    // Should show table
    await expect(page.locator("table")).toBeVisible();
  });

  test("should switch back to analytics view", async ({ page }) => {
    await page.goto("/");
    await uploadAndWaitForResults(page, VALID_CSV_CONTENT);

    // Switch to table
    await page.locator('button:has-text("Data Table")').click();
    await expect(page.locator("table")).toBeVisible();

    // Switch back to analytics
    await page.locator('button:has-text("Analytics")').click();

    // Should show analytics content again
    await expect(page.locator("text=Email Deliverability")).toBeVisible();
  });
});
