import { describe, it, expect } from "vitest"
import {
  evaluateAlerts,
  type AlertRule,
  type Snapshot,
} from "@/lib/alert-engine"

describe("alert-engine", () => {
  const thresholdRule: AlertRule = {
    id: "r1",
    type: "threshold",
    brand: "Subway",
    region: "London",
    value: 10,
    label: "Subway in London > 10",
  }

  const changeRule: AlertRule = {
    id: "r2",
    type: "change",
    brand: "Nandos",
    region: "Wales",
    label: "Nandos enters/exits Wales",
  }

  const competitorRule: AlertRule = {
    id: "r3",
    type: "competitor",
    brand: "Subway",
    region: "London",
    rivalBrand: "KFC",
    label: "Subway in London vs KFC",
  }

  describe("threshold alerts", () => {
    it("fires when count crosses threshold", () => {
      const prev: Snapshot = { London: { Subway: 10 } }
      const next: Snapshot = { London: { Subway: 11 } }
      const events = evaluateAlerts([thresholdRule], prev, next, "2020-06")
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe("threshold")
      expect(events[0].message).toContain("exceeded 10")
      expect(events[0].message).toContain("now 11")
    })

    it("does not fire if already above threshold", () => {
      const prev: Snapshot = { London: { Subway: 12 } }
      const next: Snapshot = { London: { Subway: 15 } }
      const events = evaluateAlerts([thresholdRule], prev, next, "2020-06")
      expect(events).toHaveLength(0)
    })

    it("does not fire if count stays below threshold", () => {
      const prev: Snapshot = { London: { Subway: 5 } }
      const next: Snapshot = { London: { Subway: 8 } }
      const events = evaluateAlerts([thresholdRule], prev, next, "2020-06")
      expect(events).toHaveLength(0)
    })
  })

  describe("change alerts", () => {
    it("fires on brand entry (0 → N)", () => {
      const prev: Snapshot = { Wales: {} }
      const next: Snapshot = { Wales: { Nandos: 3 } }
      const events = evaluateAlerts([changeRule], prev, next, "2021-01")
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe("change")
      expect(events[0].message).toContain("entered Wales")
    })

    it("fires on brand exit (N → 0)", () => {
      const prev: Snapshot = { Wales: { Nandos: 2 } }
      const next: Snapshot = { Wales: { Nandos: 0 } }
      const events = evaluateAlerts([changeRule], prev, next, "2021-01")
      expect(events).toHaveLength(1)
      expect(events[0].message).toContain("exited Wales")
    })

    it("does not fire when brand already present", () => {
      const prev: Snapshot = { Wales: { Nandos: 2 } }
      const next: Snapshot = { Wales: { Nandos: 5 } }
      const events = evaluateAlerts([changeRule], prev, next, "2021-01")
      expect(events).toHaveLength(0)
    })
  })

  describe("competitor alerts", () => {
    it("fires when rival enters region where brand exists", () => {
      const prev: Snapshot = { London: { Subway: 5 } }
      const next: Snapshot = { London: { Subway: 5, KFC: 1 } }
      const events = evaluateAlerts([competitorRule], prev, next, "2022-03")
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe("competitor")
      expect(events[0].message).toContain("KFC")
    })

    it("does not fire if rival was already present", () => {
      const prev: Snapshot = { London: { Subway: 5, KFC: 3 } }
      const next: Snapshot = { London: { Subway: 5, KFC: 5 } }
      const events = evaluateAlerts([competitorRule], prev, next, "2022-03")
      expect(events).toHaveLength(0)
    })
  })

  describe("edge cases", () => {
    it("returns no events with empty rules", () => {
      const prev: Snapshot = { London: { Subway: 5 } }
      const next: Snapshot = { London: { Subway: 20 } }
      const events = evaluateAlerts([], prev, next, "2020-01")
      expect(events).toHaveLength(0)
    })

    it("handles missing regions gracefully", () => {
      const prev: Snapshot = {}
      const next: Snapshot = {}
      const events = evaluateAlerts([thresholdRule], prev, next, "2020-01")
      expect(events).toHaveLength(0)
    })

    it("generates unique event IDs", () => {
      const prev: Snapshot = { London: { Subway: 10 } }
      const next: Snapshot = { London: { Subway: 11 } }
      const events = evaluateAlerts([thresholdRule], prev, next, "2020-06")
      expect(events[0].id).toContain("r1")
      expect(events[0].id).toContain("2020-06")
    })
  })
})
