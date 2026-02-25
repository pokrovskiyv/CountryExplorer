import { useState, useCallback } from "react";
import type { BrandInfo } from "@/contexts/CountryContext";

export interface BrandGroup {
  readonly id: string;
  readonly name: string;
  readonly brands: readonly string[];
  readonly isDefault: boolean;
}

const STORAGE_KEY = "getplace-brand-groups";

function buildDefaultGroups(brands: Record<string, BrandInfo>): readonly BrandGroup[] {
  const allBrandKeys = Object.keys(brands);
  return [
    { id: "all", name: "All Brands", brands: allBrandKeys, isDefault: true },
    { id: "pizza", name: "Pizza", brands: ["Dominos", "PapaJohns"], isDefault: true },
    {
      id: "chicken-burgers",
      name: "Chicken & Burgers",
      brands: ["KFC", "McDonalds", "Nandos"],
      isDefault: true,
    },
  ];
}

function loadGroups(defaults: readonly BrandGroup[]): readonly BrandGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as BrandGroup[];
    return [...defaults, ...parsed.filter((g) => !g.isDefault)];
  } catch {
    return defaults;
  }
}

function saveCustomGroups(groups: readonly BrandGroup[]): void {
  const custom = groups.filter((g) => !g.isDefault);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

export function useBrandGroups(brands: Record<string, BrandInfo>) {
  const [groups, setGroups] = useState<readonly BrandGroup[]>(() =>
    loadGroups(buildDefaultGroups(brands))
  );

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
