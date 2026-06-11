import { describe, it, expect } from "vitest";
import { parseP5, parseP3 } from "../../scripts/scrape/mbs";
import { parseIslandPage } from "../../scripts/scrape/atolls";
import { extractGeoJson } from "../../scripts/scrape/statsmap";

describe("census table parsers", () => {
  it("parses P5 island rows, tracking the current atoll", () => {
    const rows = [
      [null, "Atoll Abr", "Island", "Population"],
      [null, "", "Admin islands", 236747, 109471, 127276],
      [null, "HA", "Baarah", 1141, 591, 550, 1039, 579, 460, 102, 12, 90, 79.45],
      [null, "HA", "Dhidhdhoo", 3408, 1768, 1640, 3134, 1724, 1410, 274, 44, 230, 81.79],
      [null, "", "Republic", 515122],
    ];
    const out = parseP5(rows as never);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ atollAbr: "HA", island: "Baarah", total: 1141, female: 591, male: 550 });
  });

  it("skips aggregate rows", () => {
    const rows = [[null, "", "Atolls", 302984], [null, "", "Maale", 212138]];
    expect(parseP5(rows as never)).toHaveLength(0);
  });

  it("parses P3 with 2014 comparison", () => {
    const rows = [["HA", "Baarah", 1141, 1039, 102, 1039]];
    const out = parseP3(rows as never);
    expect(out[0].total2014).toBe(1039);
  });
});

describe("Atolls of Maldives island page parser", () => {
  const html = `
    <div class="block-title"><h1>Alidhoo (R) - [ Thiladhunmathi Uthuruburi (Haa Alifu Atoll) ]</h1></div>
    <div class="form_container"><h3>General Information</h3>
      <table>
        <tr><td>DMS Latitude</td><td>6&deg; 50' 55'' N</td></tr>
        <tr><td>Area (ha)</td><td>17.20</td></tr>
      </table>
    </div>
    <div class="form_container"><h3>Historical Data</h3><p>Old fishing village.</p></div>
    <a class="lightbox" href="/files/island1.jpg">img</a>`;
  it("extracts name, status, atoll, fields, sections and images", () => {
    const out = parseIslandPage(html, "http://www.atollsofmaldives.gov.mv/atolls/x/Alidhoo-%28R%29/10");
    expect(out.name).toBe("Alidhoo");
    expect(out.statusCode).toBe("R");
    expect(out.atollName).toContain("Thiladhunmathi Uthuruburi");
    expect(out.fields["General Information :: Area (ha)"]).toBe("17.20");
    expect(out.sections["Historical Data"]).toEqual(["Old fishing village."]);
    expect(out.images[0]).toContain("/files/island1.jpg");
  });
});

describe("StatsMap layer extraction", () => {
  it("unwraps the qgis2web JS assignment", () => {
    const js = `var json_Test_1 = {"type":"FeatureCollection","features":[{"type":"Feature","properties":{"a":1},"geometry":null}]};`;
    const fc = extractGeoJson(js) as { features: unknown[] };
    expect(fc.features).toHaveLength(1);
  });
  it("throws on non-JS input", () => {
    expect(() => extractGeoJson("<html>error page</html>")).toThrow();
  });
});
