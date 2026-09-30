# Analyze Opportunities

Analyze station-area QSR expansion opportunities using the existing station export. This command covers station anchors only; it does not regenerate junction or MSOA analysis.

## Instructions

You are a QSR (Quick Service Restaurant) expansion strategist analyzing UK station-area opportunities. Your job is to turn scored data into actionable business recommendations.

### Step 1: Export fresh data

Run the export script to get computed opportunity data:

```bash
npx tsx --tsconfig tsconfig.app.json scripts/export-opportunities.ts > /tmp/opportunities.json
```

Then read the output file to get the structured data.

### Step 2: Analyze and generate recommendations

For each of the top 30 stations in the data, generate:

1. **actionTier** — classify as one of:
   - `"act-now"` — compositeScore 80+, matching the current Smart Map score tier. Treat it as a priority for investigation; qualify missing data, confidence and site risks in the recommendation.
   - `"evaluate"` — compositeScore 60-79, matching the current Smart Map score tier. Explain what site visit or additional evidence is needed.
   - `"monitor"` — compositeScore below 60, matching the current Smart Map score tier. Confidence and missing data remain separate qualifications.

2. **recommendation** — 2-3 sentences of strategic advice in business language. NOT data description ("score is 84"), but business meaning ("this is the most underserved transit hub in the London Crossrail corridor — opening here captures commuter traffic from both DLR and Elizabeth line"). Reference specific data points from the analysis but frame them as business implications.

3. **whyThisStation** — 1 sentence explaining what makes THIS station uniquely valuable compared to alternatives. What's the single strongest reason to prioritize it?

4. **brandRecommendations** — For each absent brand, 1 sentence explaining why this specific brand should or shouldn't consider this location, based on brand positioning (premium/value/neutral) and the demographic fit.

5. **riskMitigation** — 1-2 sentences on what to verify before acting. Be specific: "verify weekend vs weekday traffic split" not just "do more research."

### Step 3: Generate executive summary

Write 5 sections of strategic analysis:

1. **overview** — 2-3 sentences summarizing the expansion landscape. What's the big picture? How many real opportunities exist vs noise?

2. **topPicks** — The top 3 "act now" stations with 1-2 sentences each explaining why they stand out. Be specific about what makes each unique.

3. **brandStrategy** — Which brand has the most expansion opportunity and where? Which brand is best positioned for which type of location? Cross-reference brand positioning (premium/value/neutral) with geographic and demographic data.

4. **geographicClusters** — Are there geographic patterns? Regions or corridors where multiple opportunities cluster? Name specific areas and explain why they matter.

5. **driveThruOpportunities** — Analyze the road traffic signal data. Which stations near high-volume roads have drive-thru potential? Treat road traffic as a site-screening proxy; it does not establish demand or a competitor advantage.

### Step 4: Write results

Write the analysis to `src/data/ai-opportunity-analysis.ts` with this exact format:

```typescript
// AI-generated strategic analysis of top station opportunities
// Record the actual generation date, model and export inputs used
// Numbers are from deterministic scoring engine; insights are AI-generated

import type { ActionTier, StationAIAnalysis, AIExecutiveSummary } from "@/lib/opportunity-scoring"

export const AI_STATION_ANALYSIS: Readonly<Record<string, StationAIAnalysis>> = {
  "Station Name": {
    actionTier: "act-now",
    recommendation: "...",
    whyThisStation: "...",
    brandRecommendations: {
      BrandName: "...",
    },
    riskMitigation: "...",
  },
  // ... all 30 stations
}

export const AI_EXECUTIVE_SUMMARY: AIExecutiveSummary = {
  overview: "...",
  topPicks: "...",
  brandStrategy: "...",
  geographicClusters: "...",
  driveThruOpportunities: "...",
}
```

### Important rules

- NEVER invent numbers. All quantitative data comes from the export. You add strategic interpretation only.
- Separate observed data from inference. Brand absence, passengers and nearby competitors are screening proxies; they do not prove sales demand, profitability or site availability.
- Keep actionTier aligned with Smart Map score thresholds (80/60); do not silently alter runtime tier rules in generated copy.
- Reference specific data points when making claims: "9.8M passengers/year" not "high traffic."
- Be honest about limitations: if demographic data is missing (Scotland), say so.
- Think like a consultant presenting to a restaurant chain CEO — direct, actionable, evidence-based.
- Each recommendation should pass the "so what" test: if the reader asks "so what should I do?", the answer should be obvious from your text.
