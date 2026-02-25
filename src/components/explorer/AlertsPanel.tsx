import { useState } from "react"
import { Trash2, Plus, Bell, ListChecks } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useCountry } from "@/contexts/CountryContext"
import type { AlertRule, AlertEvent, AlertRuleType } from "@/lib/alert-engine"

interface AlertsPanelProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly rules: readonly AlertRule[]
  readonly events: readonly AlertEvent[]
  readonly onAddRule: (rule: Omit<AlertRule, "id">) => void
  readonly onRemoveRule: (id: string) => void
  readonly onMarkAllRead: () => void
}

type Tab = "events" | "rules"

const RULE_TYPES: { value: AlertRuleType; label: string }[] = [
  { value: "threshold", label: "Threshold (count > N)" },
  { value: "change", label: "Brand enters/exits region" },
  { value: "competitor", label: "Competitor opens nearby" },
]

const AlertsPanel = ({
  open,
  onClose,
  rules,
  events,
  onAddRule,
  onRemoveRule,
  onMarkAllRead,
}: AlertsPanelProps) => {
  const { brands, regionCounts } = useCountry()
  const [activeTab, setActiveTab] = useState<Tab>("events")
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [ruleType, setRuleType] = useState<AlertRuleType>("threshold")
  const [ruleBrand, setRuleBrand] = useState(Object.keys(brands)[0])
  const [ruleRegion, setRuleRegion] = useState(Object.keys(regionCounts)[0])
  const [ruleValue, setRuleValue] = useState(10)
  const [ruleRival, setRuleRival] = useState(Object.keys(brands)[1] || "")

  const handleSubmit = () => {
    const labelParts = [`${ruleBrand} in ${ruleRegion}`]
    if (ruleType === "threshold") labelParts.push(`> ${ruleValue}`)
    if (ruleType === "competitor") labelParts.push(`vs ${ruleRival}`)

    onAddRule({
      type: ruleType,
      brand: ruleBrand,
      region: ruleRegion,
      value: ruleType === "threshold" ? ruleValue : undefined,
      rivalBrand: ruleType === "competitor" ? ruleRival : undefined,
      label: labelParts.join(" "),
    })
    setShowForm(false)
  }

  const brandNames = Object.keys(brands)
  const regionNames = Object.keys(regionCounts)

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-[380px] bg-surface-0 border-border text-foreground overflow-y-auto">
        <SheetHeader className="pb-3 border-b border-border">
          <SheetTitle className="text-foreground">Alerts</SheetTitle>
        </SheetHeader>

        {/* Tab selector */}
        <div className="flex gap-1 mt-3 mb-4">
          {([
            { key: "events" as Tab, icon: Bell, label: "Events" },
            { key: "rules" as Tab, icon: ListChecks, label: "Rules" },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors border ${
                activeTab === key
                  ? "bg-blue-600/10 border-blue-600 text-blue-400"
                  : "bg-surface-1 border-border text-muted-foreground hover:text-slate-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === "events" && (
          <div>
            {events.length > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-[11px] text-blue-400 hover:text-blue-300 mb-3 block"
              >
                Mark all as read
              </button>
            )}
            {events.length === 0 ? (
              <p className="text-muted-foreground text-xs py-4">
                No alert events yet. Add rules and advance the timeline to generate alerts.
              </p>
            ) : (
              <div className="space-y-2">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className={`p-2.5 rounded-lg border text-xs ${
                      event.read
                        ? "bg-surface-1 border-border text-muted-foreground"
                        : "bg-surface-1 border-blue-600/30 text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] uppercase font-semibold ${
                        event.type === "threshold" ? "text-amber-400" :
                        event.type === "change" ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {event.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {event.timestamp}
                      </span>
                    </div>
                    <p className="leading-relaxed">{event.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "rules" && (
          <div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-blue-600/10 border border-blue-600 text-blue-400 hover:bg-blue-600/20 transition-colors mb-3"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Rule
            </button>

            {showForm && (
              <div className="bg-surface-1 rounded-lg p-3 mb-3 space-y-2.5 border border-border">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase block mb-1">Type</label>
                  <select
                    value={ruleType}
                    onChange={(e) => setRuleType(e.target.value as AlertRuleType)}
                    className="w-full bg-surface-2 border border-border text-foreground px-2 py-1.5 rounded text-xs"
                  >
                    {RULE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase block mb-1">Brand</label>
                  <select
                    value={ruleBrand}
                    onChange={(e) => setRuleBrand(e.target.value)}
                    className="w-full bg-surface-2 border border-border text-foreground px-2 py-1.5 rounded text-xs"
                  >
                    {brandNames.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase block mb-1">Region</label>
                  <select
                    value={ruleRegion}
                    onChange={(e) => setRuleRegion(e.target.value)}
                    className="w-full bg-surface-2 border border-border text-foreground px-2 py-1.5 rounded text-xs"
                  >
                    {regionNames.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                {ruleType === "threshold" && (
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase block mb-1">Threshold</label>
                    <input
                      type="number"
                      value={ruleValue}
                      onChange={(e) => setRuleValue(Number(e.target.value))}
                      min={1}
                      className="w-full bg-surface-2 border border-border text-foreground px-2 py-1.5 rounded text-xs"
                    />
                  </div>
                )}
                {ruleType === "competitor" && (
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase block mb-1">Rival brand</label>
                    <select
                      value={ruleRival}
                      onChange={(e) => setRuleRival(e.target.value)}
                      className="w-full bg-surface-2 border border-border text-foreground px-2 py-1.5 rounded text-xs"
                    >
                      {brandNames.filter((b) => b !== ruleBrand).map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  onClick={handleSubmit}
                  className="w-full px-3 py-1.5 rounded text-xs bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                >
                  Create Rule
                </button>
              </div>
            )}

            {rules.length === 0 && !showForm ? (
              <p className="text-muted-foreground text-xs py-4">
                No alert rules configured. Add a rule to start receiving notifications.
              </p>
            ) : (
              <div className="space-y-1.5">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-surface-1 border border-border"
                  >
                    <div>
                      <span className={`text-[10px] uppercase font-semibold mr-2 ${
                        rule.type === "threshold" ? "text-amber-400" :
                        rule.type === "change" ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {rule.type}
                      </span>
                      <span className="text-xs text-slate-300">{rule.label}</span>
                    </div>
                    <button
                      onClick={() => onRemoveRule(rule.id)}
                      className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                      aria-label="Delete rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

export default AlertsPanel
