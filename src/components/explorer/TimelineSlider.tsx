import { Play, Pause } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { format } from "date-fns"

interface TimelineSliderProps {
  readonly currentMonth: number
  readonly currentDate: Date
  readonly isPlaying: boolean
  readonly onMonthChange: (month: number) => void
  readonly onTogglePlay: () => void
}

const MIN_MONTH = 0    // Jan 2015
const MAX_MONTH = 131  // Dec 2025

const TimelineSlider = ({
  currentMonth,
  currentDate,
  isPlaying,
  onMonthChange,
  onTogglePlay,
}: TimelineSliderProps) => (
  <div className="h-10 bg-[hsl(230,25%,10%)] border-b border-border flex items-center px-5 gap-3 shrink-0">
    <button
      onClick={onTogglePlay}
      className="flex items-center justify-center w-7 h-7 rounded-md bg-[hsl(230,25%,15%)] border border-border text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
      aria-label={isPlaying ? "Pause" : "Play"}
    >
      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
    </button>
    <span className="text-xs text-blue-400 font-medium w-[72px] tabular-nums">
      {format(currentDate, "MMM yyyy")}
    </span>
    <Slider
      min={MIN_MONTH}
      max={MAX_MONTH}
      step={1}
      value={[currentMonth]}
      onValueChange={([v]) => onMonthChange(v)}
      className="flex-1"
    />
    <span className="text-[10px] text-muted-foreground w-16 text-right">2015–2025</span>
  </div>
)

export default TimelineSlider
