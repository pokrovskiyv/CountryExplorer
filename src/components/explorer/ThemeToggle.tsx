import { Sun, Moon } from "lucide-react"
import { useTheme } from "@/hooks/useTheme"

export default function ThemeToggle() {
  const { resolved, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      className="flex items-center justify-center w-8 h-8 rounded-md bg-surface-1 border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
      title={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {resolved === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}
