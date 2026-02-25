import { Bell } from "lucide-react"

interface AlertBadgeProps {
  readonly unreadCount: number
  readonly onClick: () => void
}

const AlertBadge = ({ unreadCount, onClick }: AlertBadgeProps) => (
  <button
    onClick={onClick}
    className="relative flex items-center justify-center w-8 h-8 rounded-md bg-surface-1 border border-border text-muted-foreground hover:text-slate-300 hover:border-slate-600 transition-colors"
    aria-label={`Alerts${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
  >
    <Bell className="w-4 h-4" />
    {unreadCount > 0 && (
      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>
    )}
  </button>
)

export default AlertBadge
