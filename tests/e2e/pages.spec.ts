import { test, expect, Page } from "@playwright/test";
import fs from "node:fs";

const SHOTS = "test-results/screenshots";
test.beforeAll(() => fs.mkdirSync(SHOTS, { recursive: true }));

async function shot(page: Page, name: string, project: string) {
  await page.screenshot({ path: `${SHOTS}/${name}-${project}.png`, fullPage: true });
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page must not overflow horizontally").toBeLessThanOrEqual(2);
}

test("homepage renders live stats", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Public Geospatial Resources/i })).toBeVisible();
  await expect(page.getByText("Total islands")).toBeVisible();
  // Stats are DB-driven: total islands must be a real number > 0
  const statCard = page.locator("a", { has: page.getByText("Total islands") }).first();
  const stat = (await statCard.innerText()).match(/([\d,]{3,})/)?.[1] ?? "0";
  expect(Number(stat.replace(/,/g, ""))).toBeGreaterThan(100);
  await expect(page.getByText(/Open Data redistributes power/).first()).toBeVisible();
  await noHorizontalOverflow(page);
  await shot(page, "homepage", info.project.name);
});

test("map explorer loads with mobile bottom controls", async ({ page }, info) => {
  await page.goto("/map");
  await page.waitForSelector(".maplibregl-canvas", { timeout: 30_000 });
  if (info.project.name === "desktop") {
    await expect(page.getByRole("heading", { name: "Map Explorer" })).toBeVisible();
    await expect(page.getByText("Overlay layers")).toBeVisible();
  } else {
    // Mobile: filter drawer opens from the floating button
    await page.getByRole("button", { name: "Open filters" }).click();
    await expect(page.getByText("Filters & layers")).toBeVisible();
    await page.getByRole("button", { name: "Close filters" }).click();
  }
  await shot(page, "map-explorer", info.project.name);
});

test("island profile shows source disclosure and tabs", async ({ page }, info) => {
  await page.goto("/islands/k-maafushi");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Source disclosure")).toBeVisible();
  // Tabs present (horizontal pills on mobile)
  for (const tab of ["Overview", "Geography", "Census & Population", "Conflicts", "Sources", "Downloads"]) {
    await expect(page.getByRole("link", { name: tab, exact: false }).first()).toBeVisible();
  }
  // Census tab shows per-source comparison
  await page.getByRole("link", { name: "Census & Population" }).click();
  await expect(page.getByText(/Population records by source|No population records/).first()).toBeVisible();
  await noHorizontalOverflow(page);
  await shot(page, "island-profile", info.project.name);
});

test("atoll profile lists islands with sorting", async ({ page }, info) => {
  await page.goto("/atolls/K");
  await expect(page.getByRole("heading", { name: /Kaafu/ })).toBeVisible();
  await expect(page.getByText("Census 2022 population")).toBeVisible();
  await noHorizontalOverflow(page);
  await shot(page, "atoll-profile", info.project.name);
});

test("downloads catalog exposes snapshot and datasets", async ({ page }, info) => {
  await page.goto("/downloads");
  await expect(page.getByText("Latest full snapshot")).toBeVisible();
  await expect(page.getByText("islands_canonical.csv").first()).toBeVisible();
  await expect(page.getByText("islands_conflicts.csv").first()).toBeVisible();
  await noHorizontalOverflow(page);
  await shot(page, "downloads", info.project.name);
});

test("conflicts dashboard lists unresolved conflicts", async ({ page }, info) => {
  await page.goto("/conflicts");
  await expect(page.getByText("Total conflicts")).toBeVisible();
  await expect(page.getByText("Unresolved").first()).toBeVisible();
  await noHorizontalOverflow(page);
  await shot(page, "conflicts", info.project.name);
});

test("source registry lists all scraped sources", async ({ page }, info) => {
  await page.goto("/sources");
  for (const src of ["OneMap", "Census", "StatsMap", "Atolls of Maldives"]) {
    await expect(page.getByText(src).first()).toBeVisible();
  }
  await noHorizontalOverflow(page);
  await shot(page, "sources", info.project.name);
});

test("admin dashboard shows protected placeholder", async ({ page }, info) => {
  await page.goto("/admin");
  await expect(page.getByText(/Admin access|Administrative Dashboard/)).toBeVisible();
  await shot(page, "admin", info.project.name);
});

test("API endpoints respond", async ({ request }) => {
  const islands = await request.get("/api/islands?limit=2");
  expect(islands.ok()).toBeTruthy();
  expect((await islands.json()).total).toBeGreaterThan(100);

  const search = await request.get("/api/search?q=maafushi");
  expect((await search.json()).results.length).toBeGreaterThan(0);

  const conflicts = await request.get("/api/conflicts?limit=1");
  expect((await conflicts.json()).total).toBeGreaterThan(0);

  const csv = await request.get("/api/downloads/islands.csv");
  expect(csv.headers()["content-type"]).toContain("text/csv");
});
