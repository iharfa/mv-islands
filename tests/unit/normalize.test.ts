import { describe, it, expect } from "vitest";
import {
  normalizeName, parseDms, resolveAtoll, nameSimilarity, slugify, haversineKm,
} from "../../scripts/lib/normalize";

describe("normalizeName", () => {
  it("strips status suffixes and punctuation", () => {
    expect(normalizeName("Vilin'gili (U)")).toBe("vilingili");
    expect(normalizeName("Male’")).toBe("male");
    expect(normalizeName("An'golhitheemu (I)")).toBe("angolhitheemu");
  });
  it("is symmetric for apostrophe variants", () => {
    expect(normalizeName("Male'")).toBe(normalizeName("Male’"));
  });
});

describe("parseDms", () => {
  it("parses DMS with seconds", () => {
    expect(parseDms("6° 50' 55'' N")).toBeCloseTo(6.848611, 4);
    expect(parseDms("73° 9' 7'' E")).toBeCloseTo(73.151944, 4);
  });
  it("parses southern latitudes as negative", () => {
    expect(parseDms("0° 41' 30'' S")).toBeCloseTo(-0.691667, 4);
  });
  it("parses HTML entity degrees and decimal fallback", () => {
    expect(parseDms("6&deg; 30' 0'' N")).toBeCloseTo(6.5, 4);
    expect(parseDms("4.0511")).toBeCloseTo(4.0511, 4);
  });
  it("returns null on garbage", () => {
    expect(parseDms("not a coordinate")).toBeNull();
    expect(parseDms(null)).toBeNull();
  });
});

describe("resolveAtoll", () => {
  it("resolves codes, names and natural names", () => {
    expect(resolveAtoll("HDh")?.code).toBe("HDh");
    expect(resolveAtoll("Haa Dhaalu")?.code).toBe("HDh");
    expect(resolveAtoll("Thiladhunmathi Dhekunuburi")?.code).toBe("HDh");
    expect(resolveAtoll("Kaafu")?.code).toBe("K");
  });
  it("resolves census locality aliases", () => {
    expect(resolveAtoll("North Thiladhunmathi")?.code).toBe("HA");
    expect(resolveAtoll("South Huvadhu Atoll")?.code).toBe("GDh");
  });
  it("resolves AoM page titles with parenthesised atoll", () => {
    expect(resolveAtoll("Thiladhunmathi Uthuruburi (Haa Alifu Atoll)")?.code).toBe("HA");
  });
  it("returns null for unknown", () => {
    expect(resolveAtoll("Atlantis")).toBeNull();
  });
});

describe("nameSimilarity", () => {
  it("scores identical and near names", () => {
    expect(nameSimilarity("Maafushi", "Maafushi")).toBe(1);
    expect(nameSimilarity("Maafushi", "Mafushi")).toBeGreaterThan(0.85);
    expect(nameSimilarity("Maafushi", "Hulhumale")).toBeLessThan(0.5);
  });
});

describe("slugify / haversine", () => {
  it("builds atoll-scoped slugs", () => {
    expect(slugify("Maafushi", "K")).toBe("k-maafushi");
  });
  it("computes plausible distances", () => {
    // Malé to Maafushi ≈ 27 km
    const d = haversineKm(4.1755, 73.5093, 3.9423, 73.4907);
    expect(d).toBeGreaterThan(20);
    expect(d).toBeLessThan(35);
  });
});
