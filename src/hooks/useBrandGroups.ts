import { useState, useCallback } from "react";
import { BRANDS } from "@/data/uk-data";

export interface BrandGroup {
  readonly id: string;
  readonly name: string;
  readonly brands: readonly string[];
  readonly isDefault: boolean;
}

const STORAGE_KEY = "getplace-brand-groups";

const allBrandKeys = Object.keys(BRANDS);

const DEFAULT_GROUPS: readonly BrandGroup[] = [
  { id: "all", name: "All Brands", brands: allBrandKeys, isDefault: true },
  { id: "pizza", name: "Pizza", brands: ["Dominos", "PapaJohns"], isDefault: true },
  {
    id: "chicken-burgers",
    name: "Chicken & Burgers",
    brands: ["KFC", "McDonalds", "Nandos"],
    isDefault: true,
  },
];

function loadGroups(): readonly BrandGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GROUPS;
    const parsed = JSON.parse(raw) as BrandGroup[];
    return [...DEFAULT_GROUPS, ...parsed.filter((g) => !g.isDefault)];
  } catch {
    return DEFAULT_GROUPS;
  }
}

function saveCustomGroups(groups: readonly BrandGroup[]): void {
  const custom = groups.filter((g) => !g.isDefault);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

export function useBrandGroups() {
  const [groups, setGroups] = useState<readonly BrandGroup[]>(loadGroups);

  const createGroup = useCallback((name: string, brands: readonly string[]) => {
    const newGroup: BrandGroup = {
      id: `custom-${Date.now()}`,
      name,
      brands,
      isDefault: false,
    };
    setGroups((prev) => {
      const next = [...prev, newGroup];
      saveCustomGroups(next);
      return next;
    });
    return newGroup;
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setGroups((prev) => {
      const next = prev.filter((g) => g.id !== id || g.isDefault);
      saveCustomGroups(next);
      return next;
    });
  }, []);

  return { groups, createGroup, deleteGroup } as const;
}
