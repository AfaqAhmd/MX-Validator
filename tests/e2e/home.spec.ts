import { expect, test } from "@playwright/test";

/**
 * Home Page Tests
 *
 * Tests for the main page UI, layout, and initial state
 */

// Top-level regex patterns for test assertions
const PAGE_TITLE_REGEX = /Lead List MX Validator|CYMATE/;
const DARK_BG_REGEX = /rgb\(\d{1,2}, \d{1,2}, \d{1,2}\)/;

test.describe("Home Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display the main heading and branding", async ({ page }) => {
    // Check main title
    await expect(page.locator("h1")).toContainText("Lead List");
    await expect(page.locator("h1")).toContainText("MX Validator");

    // Check branding
    await expect(page.locator("text=CYMATE")).toBeVisible();

    // Check tagline
    await expect(
      page.locator("text=Upload your lead list and instantly verify")
    ).toBeVisible();
  });

  test("should display feature badges", async ({ page }) => {
    await expect(page.locator("text=50x Concurrent Scans")).toBeVisible();
    await expect(page.locator("text=MX Record Verification")).toBeVisible();
    await expect(page.locator("text=Protect Your Sender Rep")).toBeVisible();
  });

  test("should display upload dropzone in idle state", async ({ page }) => {
    // Check dropzone is visible
    const dropzone = page.locator('[data-testid="upload-dropzone"]');
    await expect(dropzone).toBeVisible();

    // Check dropzone text
    await expect(page.locator("text=Drag & drop your CSV")).toBeVisible();
  });

  test("should display footer", async ({ page }) => {
    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Check footer content
    await expect(page.locator("footer").locator("text=CYMATE")).toBeVisible();
    await expect(
      page.locator("text=Your partner in cold email success")
    ).toBeVisible();
  });

  test("should have correct page title", async ({ page }) => {
    await expect(page).toHaveTitle(PAGE_TITLE_REGEX);
  });

  test("should be responsive - mobile view", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check that main content is still visible
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator('[data-testid="upload-dropzone"]')).toBeVisible();
  });

  test("should have dark theme", async ({ page }) => {
    // Check body has dark background
    const body = page.locator("body");
    const bgColor = await body.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    // Should be dark (rgb values close to 0)
    expect(bgColor).toMatch(DARK_BG_REGEX);
  });
});

test.describe("Accessibility", () => {
  test("should have no duplicate IDs", async ({ page }) => {
    await page.goto("/");

    const duplicateIds = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll("[id]")).map(
        (el) => el.id
      );
      const seen = new Set<string>();
      const duplicates: string[] = [];

      for (const id of ids) {
        if (seen.has(id)) {
          duplicates.push(id);
        }
        seen.add(id);
      }

      return duplicates;
    });

    expect(duplicateIds).toHaveLength(0);
  });

  test("should have proper heading hierarchy", async ({ page }) => {
    await page.goto("/");

    const headings = await page.evaluate(() => {
      const h1s = document.querySelectorAll("h1");
      const h2s = document.querySelectorAll("h2");
      const h3s = document.querySelectorAll("h3");
      return {
        h1Count: h1s.length,
        h2Count: h2s.length,
        h3Count: h3s.length,
      };
    });

    // Should have exactly one h1
    expect(headings.h1Count).toBe(1);
  });

  test("should have clickable elements with proper cursor", async ({
    page,
  }) => {
    await page.goto("/");

    const dropzone = page.locator('[data-testid="upload-dropzone"]');
    await expect(dropzone).toBeVisible();

    // Check cursor style
    const cursor = await dropzone.evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toBe("pointer");
  });
});
