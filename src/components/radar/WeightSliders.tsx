import { ChevronDown, RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { OpportunityWeights } from "@/lib/expansion-scoring";

interface WeightSlidersProps {
  readonly weights: OpportunityWeights;
  readonly onChange: (weights: OpportunityWeights) => void;
  readonly onReset: () => void;
}

const SLIDER_CONFIG: { key: keyof OpportunityWeights; label: string; color: string }[] = [
  { key: "penetrationGap", label: "Penetration Gap", color: "#ec4899" },
  { key: "competitorPresence", label: "Competitor Presence", color: "#3b82f6" },
  { key: "populationScore", label: "Population Size", color: "#22c55e" },
  { key: "densityHeadroom", label: "Density Headroom", color: "#f59e0b" },
];

const WeightSliders = ({ weights, onChange, onReset }: WeightSlidersProps) => (
  <Collapsible>
    <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors group">
      <span className="uppercase tracking-wide font-medium">Adjust weights</span>
      <ChevronDown className="w-3.5 h-3.5 transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="space-y-3 pt-1 pb-2">
        {SLIDER_CONFIG.map(({ key, label, color }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">{label}</span>
              <span className="text-[11px] tabular-nums font-medium" style={{ color }}>
                {weights[key]}%
              </span>
            </div>
            <Slider
              value={[weights[key]]}
              min={0}
              max={100}
              step={5}
              onValueChange={([val]) => onChange({ ...weights, [key]: val })}
              className="[&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5 [&_[role=slider]]:border-0"
              style={{ "--slider-color": color } as React.CSSProperties}
            />
          </div>
        ))}
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-1"
        >
          <RotateCcw className="w-3 h-3" />
          Reset to defaults
        </button>
      </div>
    </CollapsibleContent>
  </Collapsible>
);

export default WeightSliders;
