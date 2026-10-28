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
      .getByRole("link", { name: "Bedrijven", exact: true });
    await prospects.hover();
    await expect
      .poll(() => routes.filter((path) => path.includes("/Directory-")).length)
      .toBe(1);
    expect(routes.some((path) => /\/(Calling|DataCenter)-/.test(path))).toBe(
      false,
    );
    await prospects.click();
    await expect(
      page.getByRole("heading", { name: "Bedrijven", exact: true }),
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

test("bedrijfslogo blijft lokaal, wordt meegenomen in back-up en kan worden verwijderd", async ({
  page,
}) => {
  await importData(page);
  await openCompany(page);
  await page.getByRole("button", { name: "Bewerken", exact: true }).click();
  await page
    .getByLabel("Bedrijfsafbeelding kiezen")
    .setInputFiles("public/icons/icon-192.png");
  await expect(page.locator(".company-image-preview img")).toBeVisible();
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  const logo = page.locator(".detail-header .company-mark img");
  await expect(logo).toBeVisible();
  const data = await logo.getAttribute("src");
  expect(data).toMatch(/^data:image\/(webp|png);base64,/);
  await expect
    .poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  expect(
    await logo.evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeLessThanOrEqual(192);
  await page.reload();
  await expect(logo).toHaveAttribute("src", data!);
  await page.goto("/data");
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Volledige back-up downloaden" })
    .click();
  const file = await pending;
  const { readFile } = await import("node:fs/promises");
  const backup = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(
    backup.prospects.find(
      (p: { companyName: string }) =>
        p.companyName === "Fictief Browsertest BV",
    ).logoDataUrl,
  ).toBe(data);
  await openCompany(page);
  await page.getByRole("button", { name: "Bewerken", exact: true }).click();
  await page.getByLabel("Bedrijfsafbeelding kiezen").setInputFiles({
    name: "niet-toegestaan.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
  });
  await expect(page.getByRole("alert")).toContainText("PNG");
  await expect(page.locator(".company-image-preview img")).toHaveAttribute(
    "src",
    data!,
  );
  await page.getByRole("button", { name: "Afbeelding verwijderen" }).click();
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(page.locator(".detail-header .company-mark img")).toHaveCount(0);
});

test("micro-animaties blijven kort en verminderde beweging houdt alle inhoud toegankelijk", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: "Bedrijf toevoegen",
    exact: true,
  });
  await expect(trigger).toBeVisible();
  const duration = await trigger.evaluate((el) =>
    getComputedStyle(el)
      .transitionDuration.split(",")
      .map((value) => parseFloat(value)),
  );
  expect(Math.max(...duration)).toBeGreaterThan(0);
  expect(Math.max(...duration)).toBeLessThanOrEqual(0.25);
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration)),
  ).toBeLessThanOrEqual(0.25);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  try {
    const reduced = await context.newPage();
    await reduced.goto("/");
    await expect(
      reduced.getByRole("heading", { name: "Overzicht", exact: true }),
    ).toBeVisible();
    await reduced.locator("footer").scrollIntoViewIfNeeded();
    await expect
      .poll(() => reduced.locator("[data-reveal]").count())
      .toBeGreaterThan(0);
    const sections = await reduced
      .locator("[data-reveal]")
      .evaluateAll((elements) =>
        elements.map((el) => ({
          opacity: getComputedStyle(el).opacity,
          animation: getComputedStyle(el).animationName,
          transform: getComputedStyle(el).transform,
        })),
      );
    expect(
      sections.every(
        (section) =>
          section.opacity === "1" &&
          section.animation === "none" &&
          section.transform === "none",
      ),
    ).toBe(true);
    await reduced
      .getByRole("button", { name: "Bedrijf toevoegen", exact: true })
      .click();
    await expect(reduced.getByRole("dialog")).toBeVisible();
    expect(
      await reduced
        .getByRole("dialog")
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
    expect(
      await reduced.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});

test("dagoverzicht prioriteert opvolging, rondt taken af en opent duidelijke statusfilters", async ({
  page,
}) => {
  await importData(page);
  await openCompany(page);
  await page.getByRole("button", { name: "Bewerken", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("INTERESTED");
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await page
    .getByRole("button", { name: "Opvolging plannen", exact: true })
    .last()
    .click();
  await page
    .getByRole("textbox", { name: "Onderwerp", exact: true })
    .fill("Achterstallig testmoment");
  const yesterday = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await page.getByLabel("Datum", { exact: true }).fill(yesterday);
  await page.getByRole("button", { name: "Opvolging opslaan" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/prospects");
  await page.getByRole("link", { name: "Fictief Tweede BV" }).click();
  const phone = page
    .locator(".mobile-sales-bar")
    .getByRole("link", { name: "Bel nu" });
  await phone.evaluate((el) =>
    el.addEventListener("click", (event) => event.preventDefault()),
  );
  await phone.click();
  await expect(
    page.getByRole("heading", { name: "Hoe is het gesprek verlopen?" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Mobiele navigatie" })
    .getByRole("link", { name: "Overzicht", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Uw volgende belactie" })
      .getByRole("heading", { name: "Fictief Browsertest BV", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Achterstallige opvolging", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".pending-call-notice")).toContainText(
    "Fictief Tweede BV",
  );
  await page.getByRole("button", { name: /Te laat/ }).click();
  await page
    .getByRole("button", {
      name: "Opvolging afronden: Achterstallig testmoment",
    })
    .click();
  await expect(page.locator(".overview-task")).toHaveCount(0);
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Uw volgende belactie" })
      .getByRole("heading", { name: "Fictief Tweede BV", exact: true }),
  ).toBeVisible();
  await page
    .locator(".pending-call-notice")
    .getByRole("link", { name: /Uitkomst vastleggen/ })
    .click();
  await page.getByRole("button", { name: "Uitkomst bevestigen" }).click();
  await page.goto("/");
  await expect(page.locator(".pending-call-notice")).toHaveCount(0);
  await expect(page.locator(".overview-progress")).toContainText(
    "Gesprekken bevestigd",
  );
  await page
    .getByRole("navigation", { name: "Mobiele navigatie" })
    .getByRole("link", { name: "Bedrijven", exact: true })
    .click();
  await page.getByRole("button", { name: /Filters/ }).click();
  await page
    .getByRole("combobox", { name: "Plaats", exact: true })
    .selectOption("Amersfoort");
  await expect(
    page.getByRole("link", { name: "Fictief Browsertest BV" }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Mobiele navigatie" })
    .getByRole("link", { name: "Overzicht", exact: true })
    .click();
  await page
    .locator(".status-stages")
    .getByRole("link", { name: /Geïnteresseerd/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bedrijven", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Fictief Browsertest BV" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Fictief Tweede BV" }),
  ).toHaveCount(0);
});

test("mobiele navigatie houdt dagelijkse acties vooraan en beheer bereikbaar via Meer", async ({
  page,
}) => {
  await page.goto("/");
  const mobile = page.getByRole("navigation", { name: "Mobiele navigatie" });
  await expect(mobile.getByRole("link")).toHaveCount(4);
  const more = mobile.getByRole("button", { name: "Meer", exact: true });
  await more.click();
  await page
    .getByRole("dialog", { name: "Meer", exact: true })
    .getByRole("link", { name: /Instellingen/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Instellingen." }),
  ).toBeVisible();
  await expect(more).toHaveAttribute("aria-current", "page");
  await more.click();
  await page
    .getByRole("dialog", { name: "Meer", exact: true })
    .getByRole("link", { name: /Gegevens & back-ups/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Gegevens & back-ups." }),
  ).toBeVisible();
  await more.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(more).toBeFocused();
});

test("de primaire belactie staat op mobiel boven de vaste navigatie zonder scrollen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await importData(page);
  await page.goto("/");
  const call = page
    .locator(".focus-actions")
    .getByRole("link", { name: "Bel nu", exact: true });
  await expect(call).toBeVisible();
  const callRect = await call.boundingBox();
  const navRect = await page
    .getByRole("navigation", { name: "Mobiele navigatie" })
    .boundingBox();
  expect(callRect).not.toBeNull();
  expect(navRect).not.toBeNull();
  expect(callRect!.y + callRect!.height).toBeLessThanOrEqual(navRect!.y);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("bedrijven per branche, vindbare contactgegevens en bewaarde weergave", async ({
  page,
}) => {
  await importData(page);
  await page.goto("/prospects");
  await expect(
    page.getByRole("heading", { name: "Bouw", exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Techniek", exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Techniek 1", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Fictief Browsertest BV", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Fictief Tweede BV", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Groeperen per branche" }).uncheck();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Groeperen per branche" }),
  ).not.toBeChecked();
  await openCompany(page);
  await page.getByRole("button", { name: "Bewerken", exact: true }).click();
  await page
    .getByRole("textbox", { name: "E-mail", exact: true })
    .fill("contact@example.org");
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/prospects");
  await expect(
    page.getByRole("link", {
      name: "Mail Fictief Browsertest BV: contact@example.org",
    }),
  ).toHaveAttribute("href", "mailto:contact@example.org");
  await page
    .getByRole("textbox", { name: "Prospects doorzoeken" })
    .fill("contact@example.org");
  await expect(page.locator(".prospect-card")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "0301234567", exact: true }),
  ).toHaveAttribute("href", "tel:+31301234567");
});

// Public-search responses below are isolated, explicitly fictitious fixtures.
// They verify the workflow without claiming live access to OpenStreetMap.
test("landelijk zoeken bewaart alle provincies, herhaalt fouten en voorkomt duplicaten", async ({
  page,
}) => {
  const { createProspect } = await import("../src/lib/models");
  const { provinceCodes, provinces } =
    await import("../src/lib/companyDiscovery");
  const requested: string[] = [];
  let failDrenthe = true;
  await page.route(
    "**/.netlify/functions/discover-companies?*",
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const code = url.searchParams.get("province") as keyof typeof provinces;
      requested.push(code);
      expect([...url.searchParams.keys()]).toEqual(["province"]);
      expect(request.method()).toBe("GET");
      expect(request.postData()).toBeNull();
      if (code === "NL-DR" && failDrenthe) {
        await route.fulfill({
          status: 502,
          json: { error: "Fictieve bron tijdelijk bezet." },
        });
        return;
      }
      const id = 90001 + provinceCodes.indexOf(code);
      const record = createProspect({
        id: `osm-node-${id}`,
        companyName: `Fictief Landelijk ${provinces[code]}`,
        province: provinces[code],
        city: "Fictieve plaats",
        address: `Teststraat ${id}`,
        phone: `030${id + 1000000}`,
        email: "contact@example.org",
        sector: "Horeca",
        source: "openstreetmap",
        sourceUrl: `https://www.openstreetmap.org/node/${id}`,
        sourceFetchedAt: "2026-10-28T09:00:00.000Z",
        sourceLicense: "© OpenStreetMap-bijdragers · ODbL 1.0",
      });
      await route.fulfill({
        json: { province: code, records: [record], invalid: 0, limited: false },
      });
    },
  );
  await page.goto("/prospects");
  await page
    .getByRole("link", { name: "Bedrijven zoeken", exact: true })
    .click();
  await expect(page.getByRole("combobox", { name: "Zoekgebied" })).toHaveValue(
    "all",
  );
  await page
    .getByRole("button", { name: "Zoeken & opslaan", exact: true })
    .click();
  await expect(
    page.getByText("11 bedrijven opgeslagen.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Zoeken & opslaan", exact: true }),
  ).toBeVisible();
  expect(requested).toEqual(provinceCodes);
  await expect(
    page.getByText("Fictieve bron tijdelijk bezet.", { exact: true }),
  ).toBeVisible();
  failDrenthe = false;
  await page
    .getByRole("button", { name: "Mislukte provincies opnieuw proberen" })
    .click();
  await expect(
    page.getByText("1 bedrijf opgeslagen.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Zoeken & opslaan", exact: true })
    .click();
  await expect(
    page.getByText("12 bestaande of dubbele vermeldingen overgeslagen.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Bedrijven", exact: true })
    .first()
    .click();
  await expect(page.locator(".prospect-card")).toHaveCount(12);
  await page.getByRole("button", { name: /Filters/ }).click();
  await page
    .getByRole("combobox", { name: "Provincie", exact: true })
    .selectOption("Drenthe");
  await expect(page.locator(".prospect-card")).toHaveCount(1);
  await page
    .getByRole("link", { name: "Fictief Landelijk Drenthe", exact: true })
    .click();
  await expect(
    page.getByText("Teststraat 90001", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Bekijk oorspronkelijke bedrijfsvermelding",
    }),
  ).toHaveAttribute("href", "https://www.openstreetmap.org/node/90001");
  await expect(
    page.getByText("© OpenStreetMap-bijdragers · ODbL 1.0", { exact: true }),
  ).toBeVisible();
});

test("stoppen van landelijk zoeken behoudt eerder opgeslagen provincies", async ({
  page,
}) => {
  const { createProspect } = await import("../src/lib/models");
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requested: string[] = [];
  await page.route(
    "**/.netlify/functions/discover-companies?*",
    async (route) => {
      const code = new URL(route.request().url()).searchParams.get("province")!;
      requested.push(code);
      if (code === "NL-FL") await held;
      await route
        .fulfill({
          json: {
            province: code,
            invalid: 0,
            limited: false,
            records: [
              createProspect({
                id: "osm-node-99001",
                companyName: "Fictief Opgeslagen Drenthe",
                province: "Drenthe",
                phone: "0592123456",
                source: "openstreetmap",
                sourceUrl: "https://www.openstreetmap.org/node/99001",
              }),
            ],
          },
        })
        .catch(() => {});
    },
  );
  await page.goto("/data");
  await page
    .getByRole("button", { name: "Zoeken & opslaan", exact: true })
    .click();
  await expect(
    page.getByText("Flevoland ophalen…", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stoppen", exact: true }).click();
  await expect(page.getByText("Gestopt.", { exact: false })).toBeVisible();
  release();
  expect(requested).toEqual(["NL-DR", "NL-FL"]);
  await page.getByRole("link", { name: "Bekijk uw bedrijven" }).click();
  await expect(page.locator(".prospect-card")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Fictief Opgeslagen Drenthe", exact: true }),
  ).toBeVisible();
});

test("grote bedrijvenlijsten renderen per pagina en zoeken over de hele lijst", async ({
  page,
}) => {
  const rows = [
    "Bedrijf;Plaats;Telefoon;Sector;Provincie",
    ...Array.from(
      { length: 61 },
      (_, i) =>
        `Fictief Groot ${String(i + 1).padStart(3, "0")};Utrecht;030${1000000 + i};Techniek;Utrecht`,
    ),
  ];
  await page.goto("/data");
  await page.getByLabel("Prospectbestand importeren").setInputFiles({
    name: "fictieve-grote-lijst.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(rows.join("\n")),
  });
  await page.getByRole("button", { name: "61 prospects importeren" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/prospects");
  await expect(page.locator(".prospect-card")).toHaveCount(60);
  await page.getByRole("button", { name: "Volgende", exact: true }).click();
  await expect(page.locator(".prospect-card")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Fictief Groot 061", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Prospects doorzoeken" })
    .fill("Fictief Groot 061");
  await expect(page.locator(".prospect-card")).toHaveCount(1);
  await expect(
    page.getByRole("navigation", { name: "Bedrijvenpagina’s" }),
  ).toHaveCount(0);
});

test("een ontbrekende ophaaldienst wordt duidelijk gemeld zonder bedrijven op te slaan", async ({
  page,
}) => {
  await page.route("**/.netlify/functions/discover-companies?*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Fictieve statische hosting</title>",
    }),
  );
  await page.goto("/data");
  await page
    .getByRole("combobox", { name: "Zoekgebied" })
    .selectOption("NL-UT");
  await page
    .getByRole("button", { name: "Zoeken & opslaan", exact: true })
    .click();
  await expect(
    page.getByText(
      "Landelijk zoeken is beschikbaar op de Netlify-versie van deze app. Controleer of de nieuwste deployment klaar is.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto("/prospects");
  await expect(page.locator(".prospect-card")).toHaveCount(0);
});
