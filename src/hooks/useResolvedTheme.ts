import { useSyncExternalStore } from "react"

function getSnapshot(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function subscribe(callback: () => void): () => void {
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  })
  return () => observer.disconnect()
}

export function useResolvedTheme(): "light" | "dark" {
  return useSyncExternalStore(subscribe, getSnapshot)
}

export function getTileUrls(theme: "light" | "dark") {
  const variant = theme === "dark" ? "dark" : "light"
  return {
    base: `https://{s}.basemaps.cartocdn.com/${variant}_nolabels/{z}/{x}/{y}@2x.png`,
    labels: `https://{s}.basemaps.cartocdn.com/${variant}_only_labels/{z}/{x}/{y}@2x.png`,
  }
}
