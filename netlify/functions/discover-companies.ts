import {
  companyQuery,
  isProvince,
  normalizeCompanies,
  PublicCompanySchema,
} from "../../src/lib/companyDiscovery";

const endpoint = "https://overpass-api.de/api/interpreter";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control":
        status === 200 ? "public, max-age=0, s-maxage=3600" : "no-store",
    },
  });

export async function handleDiscovery(
  request: Request,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Gebruik GET." }, 405);
  const province = new URL(request.url).searchParams.get("province") || "";
  if (!isProvince(province))
    return json({ error: "Kies een Nederlandse provincie." }, 400);
  try {
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "AmoceanProspectOS/1.0 (public business listings; OpenStreetMap attribution included)",
      },
      body: new URLSearchParams({ data: companyQuery(province) }),
      signal: AbortSignal.timeout(26000),
    });
    if (!response.ok)
      return json(
        {
          error:
            "De openbare bron is tijdelijk bezet of niet bereikbaar. Probeer deze provincie later opnieuw.",
        },
        response.status === 429 ? 429 : 502,
      );
    const result = normalizeCompanies(await response.json(), province);
    const records = [];
    let bytes = 1024;
    for (const record of result.records) {
      const contact = PublicCompanySchema.parse(record);
      bytes += new TextEncoder().encode(JSON.stringify(contact)).byteLength + 1;
      // Stay below the host response-size limit, even for unusually long tags.
      if (bytes > 4_000_000) break;
      records.push(contact);
    }
    return json({
      province,
      records,
      invalid: result.invalid,
      limited: result.limited || records.length < result.records.length,
    });
  } catch {
    return json(
      {
        error:
          "Deze provincie kon niet volledig worden opgehaald. Eerder opgeslagen bedrijven blijven behouden. Probeer het later opnieuw.",
      },
      502,
    );
  }
}

export default (request: Request) => handleDiscovery(request);
