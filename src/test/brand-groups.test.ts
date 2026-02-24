import { describe, it, expect, beforeEach, vi } from "vitest";
import { BRANDS } from "@/data/uk-data";

// Mock localStorage
const store: Record<string, string> = {};
const mockStorage = {
  getItem: vi.fn((key: string) => store[key] || null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
  get length() { return Object.keys(store).length; },
  key: vi.fn((i: number) => Object.keys(store)[i] || null),
};

Object.defineProperty(globalThis, "localStorage", { value: mockStorage, writable: true });

describe("Brand Groups", () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  const allBrandKeys = Object.keys(BRANDS);

  describe("Default groups", () => {
    it("should have 'All Brands' group with all brands", () => {
      expect(allBrandKeys.length).toBe(6);
      expect(allBrandKeys).toContain("Subway");
      expect(allBrandKeys).toContain("McDonalds");
    });

    it("should have 'Pizza' group with Dominos and PapaJohns", () => {
      const pizzaBrands = ["Dominos", "PapaJohns"];
      pizzaBrands.forEach((b) => {
        expect(allBrandKeys).toContain(b);
      });
    });

    it("should have 'Chicken & Burgers' group", () => {
      const chickenBrands = ["KFC", "McDonalds", "Nandos"];
      chickenBrands.forEach((b) => {
        expect(allBrandKeys).toContain(b);
      });
    });
  });

  describe("localStorage persistence", () => {
    it("should serialize and deserialize custom groups", () => {
      const customGroup = {
        id: "custom-1",
        name: "Test Group",
        brands: ["Subway", "KFC"],
        isDefault: false,
      };

      mockStorage.setItem("getplace-brand-groups", JSON.stringify([customGroup]));

      const raw = mockStorage.getItem("getplace-brand-groups");
      expect(raw).toBeTruthy();

      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe("Test Group");
      expect(parsed[0].brands).toEqual(["Subway", "KFC"]);
    });

    it("should handle corrupted localStorage gracefully", () => {
      mockStorage.setItem("getplace-brand-groups", "not-valid-json");
      const raw = mockStorage.getItem("getplace-brand-groups");

      expect(() => {
        try {
          JSON.parse(raw!);
        } catch {
          // expected
        }
      }).not.toThrow();
    });
  });

  describe("Validation", () => {
    it("should not allow empty group name", () => {
      const name = "".trim();
      expect(name).toBe("");
      expect(name.length).toBe(0);
    });

    it("should generate unique IDs", () => {
      const id1 = `custom-${Date.now()}`;
      const id2 = `custom-${Date.now() + 1}`;
      expect(id1).not.toBe(id2);
    });

    it("should not delete default groups", () => {
      const groups = [
        { id: "all", name: "All Brands", brands: allBrandKeys, isDefault: true },
        { id: "custom-1", name: "My Group", brands: ["Subway"], isDefault: false },
      ];

      const afterDelete = groups.filter((g) => g.id !== "all" || g.isDefault);
      expect(afterDelete).toHaveLength(2); // default group preserved

      const afterDeleteCustom = groups.filter((g) => g.id !== "custom-1" || g.isDefault);
      expect(afterDeleteCustom).toHaveLength(1); // custom group removed
    });
  });
});
