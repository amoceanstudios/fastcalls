import { test, expect, type Page } from "@playwright/test";
const csv =
  "Nr;Bedrijf;Plaats;Telefoon;Website;Sector / Type;Wat Amocean kan betekenen\n1;Fictief Browsertest BV;Utrecht;0301234567;https://example.org;Techniek;Een klantenportaal voor werkbonnen\n2;Fictief Tweede BV;Amersfoort;0612345678;;Bouw;Digitale planning";
async function importData(page: Page) {
  await page.goto("/data");
  await page.getByLabel("Prospectbestand importeren").setInputFiles({
    name: "fictieve-testbedrijven.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "2 prospects importeren" }).click();
  await expect(
    page.getByText("2 prospects geïmporteerd.", { exact: false }),
  ).toBeVisible();
}
async function openCompany(page: Page) {
  await page.goto("/prospects");
  await page.getByRole("link", { name: "Fictief Browsertest BV" }).click();
  await expect(
    page.getByRole("heading", { name: "Fictief Browsertest BV", exact: true }),
  ).toBeVisible();
}
test("mobiele import, notities, status, opvolging, e-mail, back-up en offline herladen", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await importData(page);
  await openCompany(page);
  await page
    .getByLabel("Notitie toevoegen", { exact: true })
    .fill("Gesproken met eigenaar, graag een demo.");
  await page.getByRole("button", { name: "Notitie opslaan" }).click();
  await expect(
    page.getByText("Gesproken met eigenaar, graag een demo.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Gesproken met eigenaar, graag een demo.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Notitie bewerken" }).click();
  await page
    .getByRole("textbox", { name: "Notitie", exact: true })
    .fill("Bewerkte notitie");
  await page.getByRole("button", { name: "Wijzigingen opslaan" }).click();
  await expect(
    page.getByText("Bewerkte notitie", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bewerken", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("INTERESTED");
  await page
    .getByRole("textbox", { name: "Tags (komma gescheiden)" })
    .pressSequentially("Demo gewenst, Eigenaar gesproken");
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(
    page.locator(".detail-header").getByText("Geïnteresseerd", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Opvolging plannen", exact: true })
    .last()
    .click();
  await page.getByLabel("Onderwerp", { exact: true }).fill("Demo bespreken");
  await page.getByRole("button", { name: "Opvolging opslaan" }).click();
  await page.getByRole("tab", { name: /Opvolging/ }).click();
  await expect(page.getByText("Demo bespreken", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "E-mail genereren", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Bericht", exact: true }),
  ).toHaveValue(/Een klantenportaal voor werkbonnen/);
  await page
    .getByRole("textbox", { name: "Bericht", exact: true })
    .fill("Handmatig aangepast concept");
  await page.getByRole("button", { name: "Concept opslaan" }).click();
  await page.getByRole("button", { name: "Sluiten", exact: true }).click();
  await page
    .getByRole("button", { name: "E-mail genereren", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Bericht", exact: true }),
  ).toHaveValue("Handmatig aangepast concept");
  await page.getByRole("button", { name: "Sluiten", exact: true }).click();
  await page.goto("/followups");
  await page.getByRole("button", { name: "Opvolging afronden" }).click();
  await expect(page.getByRole("heading", { name: /Afgerond/ })).toBeVisible();
  await page.goto("/data");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Volledige back-up downloaden" })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/amocean-backup.*json/);
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Overzicht", exact: true }),
  ).toBeVisible();
  await page.goto("/prospects");
  await expect(
    page.getByRole("link", { name: "Fictief Browsertest BV" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Fictief Browsertest BV" }).click();
  await page
    .getByLabel("Notitie toevoegen", { exact: true })
    .fill("Offline vastgelegd");
  await page.getByRole("button", { name: "Notitie opslaan" }).click();
  await page.reload();
  await expect(
    page.getByText("Offline vastgelegd", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("belmodus registreert uitsluitend een belactie en bewaart positie", async ({
  page,
}) => {
  await importData(page);
  await page.goto("/calling");
  await expect(
    page.getByRole("heading", { name: "Fictief Browsertest BV", exact: true }),
  ).toBeVisible();
  const call = page
    .locator(".mobile-sales-bar")
    .getByRole("link", { name: "Bel nu" });
  await expect(call).toHaveAttribute("href", "tel:+31301234567");
  await call.evaluate((el) =>
    el.addEventListener("click", (e) => e.preventDefault()),
  );
  await call.click();
  await expect(
    page.getByRole("heading", { name: "Hoe is het gesprek verlopen?" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Belhistorie/ }).click();
  await expect(
    page.getByText("Belactie gestart · uitkomst onbekend", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Overslaan \/ volgende/ }).click();
  await expect(
    page.getByRole("heading", { name: "Fictief Tweede BV", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Fictief Tweede BV", exact: true }),
  ).toBeVisible();
});
test("back-up export en herstel in een nieuwe browsercontext", async ({
  page,
  browser,
}) => {
  await importData(page);
  await openCompany(page);
  await page
    .getByLabel("Notitie toevoegen", { exact: true })
    .fill("Herstel deze notitie");
  await page.getByRole("button", { name: "Notitie opslaan" }).click();
  await expect(
    page.getByText("Herstel deze notitie", { exact: true }),
  ).toBeVisible();
  await page.goto("/data");
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Volledige back-up downloaden" })
    .click();
  const dl = await event;
  const path = await dl.path();
  const context = await browser.newContext();
  const fresh = await context.newPage();
  await fresh.goto("http://127.0.0.1:4173/data");
  await fresh.getByLabel("JSON-back-up kiezen").setInputFiles(path!);
  await fresh.getByRole("button", { name: "Herstel bevestigen" }).click();
  await expect(fresh.getByText(/Back-up hersteld/)).toBeVisible();
  await openCompany(fresh);
  await expect(
    fresh.getByText("Herstel deze notitie", { exact: true }),
  ).toBeVisible();
  await context.close();
});

test("zoeken, statusfilter, thema en bewerken/verwijderen van notities", async ({
  page,
}) => {
  await importData(page);
  await page.goto("/prospects");
  await page
    .getByRole("combobox", { name: "Status van Fictief Browsertest BV" })
    .selectOption("INTERESTED");
  await page.getByLabel("Prospects doorzoeken").fill("Amersfoort");
  await expect(
    page.getByRole("link", { name: "Fictief Tweede BV" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Fictief Browsertest BV" }),
  ).toHaveCount(0);
  await page.getByLabel("Prospects doorzoeken").fill("");
  await page.getByRole("button", { name: /Filters/ }).click();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("INTERESTED");
  await expect(
    page.getByRole("link", { name: "Fictief Tweede BV" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Fictief Browsertest BV" }).click();
  await page
    .getByLabel("Notitie toevoegen", { exact: true })
    .fill("Nog niet opgeslagen invoer");
  await page.getByRole("tab", { name: /Activiteit/ }).click();
  await page.getByRole("tab", { name: /Notities/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Notitie toevoegen", exact: true }),
  ).toHaveValue("Nog niet opgeslagen invoer");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Notitie toevoegen", exact: true }),
  ).toHaveValue("Nog niet opgeslagen invoer");
  await page.getByRole("button", { name: "Notitie opslaan" }).click();
  await page.getByRole("button", { name: "Notitie verwijderen" }).click();
  await page.getByRole("button", { name: "Bevestigen" }).click();
  await expect(
    page.getByText("Nog niet opgeslagen invoer", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/settings");
  await page.getByRole("combobox", { name: "Kleurthema" }).selectOption("dark");
  await page.getByRole("button", { name: "Instellingen opslaan" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("Excel-export heeft gescheiden werkbladen en behoudt notities", async ({
  page,
}) => {
  await importData(page);
  await openCompany(page);
  await page
    .getByLabel("Notitie toevoegen", { exact: true })
    .fill("Notitie voor Excel");
  await page.getByRole("button", { name: "Notitie opslaan" }).click();
  await expect(
    page.getByText("Notitie voor Excel", { exact: true }),
  ).toBeVisible();
  await page.goto("/data");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel", exact: true }).click();
  const dl = await pending;
  const path = await dl.path();
  const { default: read } = await import("read-excel-file/node");
  const prospects = await read(path!, { sheet: "Prospects" });
  const notes = await read(path!, { sheet: "Notities" });
  expect(prospects).toHaveLength(3);
  expect(notes.flat()).toContain("Notitie voor Excel");
});

test("PWA-manifest, cacheprivacy en een nieuwe appversie met behoud van gegevens", async ({
  page,
}) => {
  const { readFile, writeFile } = await import("node:fs/promises");
  const { createHash } = await import("node:crypto");
  await importData(page);
  await openCompany(page);
  await page
    .getByLabel("Notitie toevoegen", { exact: true })
    .fill("Blijft na versie-update");
  await page.getByRole("button", { name: "Notitie opslaan" }).click();
  await expect(
    page.getByText("Blijft na versie-update", { exact: true }),
  ).toBeVisible();
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.lang).toBe("nl");
  for (const icon of manifest.icons) {
    const response = await page.request.get(icon.src);
    expect(response.ok()).toBe(true);
    expect((await response.body()).subarray(0, 8).toString("hex")).toBe(
      "89504e470d0a1a0a",
    );
  }
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  const cached = await page.evaluate(async () => {
    const all = await Promise.all(
      (await caches.keys()).map(async (key) =>
        (await (await caches.open(key)).keys()).map((r) => r.url),
      ),
    );
    return all.flat();
  });
  expect(cached.some((url) => url.includes("index.html"))).toBe(true);
  expect(cached.some((url) => /backup|prospect-/.test(url))).toBe(false);
  const originalIndex = await readFile("dist/index.html", "utf8");
  const originalSW = await readFile("dist/sw.js", "utf8");
  const updatedIndex = originalIndex.replace(
    /<title>.*?<\/title>/s,
    "<title>Amocean Updatecontrole</title>",
  );
  const revision = createHash("md5").update(updatedIndex).digest("hex");
  const updatedSW = originalSW.replace(
    /(url:"index.html",revision:")[^"]+/,
    `$1${revision}`,
  );
  expect(updatedSW).not.toBe(originalSW);
  try {
    await writeFile("dist/index.html", updatedIndex);
    await writeFile("dist/sw.js", updatedSW);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    });
    await expect(
      page.getByRole("button", { name: "Nu bijwerken" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Nu bijwerken" }).click();
    await expect(page).toHaveTitle("Amocean Updatecontrole");
    await expect(
      page.getByText("Blijft na versie-update", { exact: true }),
    ).toBeVisible();
  } finally {
    await writeFile("dist/index.html", originalIndex);
    await writeFile("dist/sw.js", originalSW);
  }
});

test("toegankelijkheid van mobiel overzicht, detail en een dialoog", async ({
  page,
}) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await page.goto("/");
  let scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    scan.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await importData(page);
  await openCompany(page);
  scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    scan.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await page.getByRole("button", { name: "Bewerken", exact: true }).click();
  scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    scan.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
});

test("contrast in de resterende schermen en de desktopzijbalk", async ({
  page,
}) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await importData(page);
  for (const path of [
    "/prospects",
    "/calling",
    "/followups",
    "/data",
    "/settings",
  ]) {
    await page.goto(path);
    await expect.soft(page.getByRole("heading", { level: 1 })).toBeVisible();
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect
      .soft(
        scan.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
        path,
      )
      .toEqual([]);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  let scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect
    .soft(
      scan.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    )
    .toEqual([]);
  await page.goto("/settings");
  await page
    .getByRole("combobox", { name: "Kleurthema" })
    .selectOption("light");
  await page.getByRole("button", { name: "Instellingen opslaan" }).click();
  await expect
    .soft(page.locator("html"))
    .toHaveAttribute("data-theme", "light");
  await page.goto("/");
  scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect
    .soft(
      scan.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    )
    .toEqual([]);
});

test("routenavigatie laadt alleen de bedoelde route alvast en hergebruikt die", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: "block",
  });
  try {
    const page = await context.newPage();
    const routes: string[] = [];
    const errors: string[] = [];
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (/\/(Directory|Calling|DataCenter)-.*\.js$/.test(url.pathname))
        routes.push(url.pathname);
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Overzicht", exact: true }),
    ).toBeVisible();
    expect(routes).toEqual([]);
    const prospects = page
      .getByRole("navigation", { name: "Hoofdnavigatie" })
      .getByRole("link", { name: "Prospects", exact: true });
    await prospects.hover();
    await expect
      .poll(() => routes.filter((path) => path.includes("/Directory-")).length)
      .toBe(1);
    expect(routes.some((path) => /\/(Calling|DataCenter)-/.test(path))).toBe(
      false,
    );
    await prospects.click();
    await expect(
      page.getByRole("heading", { name: "Uw prospects." }),
    ).toBeVisible();
    expect(routes.filter((path) => path.includes("/Directory-"))).toHaveLength(
      1,
    );
    await page.goBack();
    await expect(
      page.getByRole("heading", { name: "Overzicht", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    await importData(page);
    await page
      .getByRole("button", { name: "Snel zoeken", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Snel zoeken", exact: true })
      .fill("Fictief Browsertest");
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "Fictief Browsertest BV" })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Fictief Browsertest BV",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.keyboard.press("Control+k");
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "Fictief Browsertest BV" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally {
    await context.close();
  }
});
