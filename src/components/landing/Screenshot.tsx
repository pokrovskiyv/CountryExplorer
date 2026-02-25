import { useState, useEffect, useCallback } from "react"
import { SCREENSHOT_SLIDES } from "./landing-constants"

const Screenshot = () => {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const advance = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % SCREENSHOT_SLIDES.length)
  }, [])

  useEffect(() => {
    if (paused) return
    const timer = setInterval(advance, 5000)
    return () => clearInterval(timer)
  }, [paused, advance])

  const handleTabClick = (index: number) => {
    setActiveIndex(index)
    setPaused(true)
  }

  const activeSlide = SCREENSHOT_SLIDES[activeIndex]

  return (
    <div className="max-w-[1100px] mx-auto -mt-5 px-6">
      <div className="bg-surface-0 border border-border rounded-xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        {/* Window bar with tabs */}
        <div className="h-10 bg-surface-1 border-b border-border flex items-center px-4">
          <div className="flex gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          </div>
          <div className="flex gap-1 ml-auto">
            {SCREENSHOT_SLIDES.map((slide, i) => (
              <button
                key={slide.label}
                onClick={() => handleTabClick(i)}
                aria-pressed={i === activeIndex}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  i === activeIndex
                    ? "bg-blue-600/20 text-blue-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                }`}
              >
                {slide.label}
              </button>
            ))}
          </div>
        </div>

        {/* Screenshot area */}
        <div className="relative w-full aspect-video bg-surface-deep">
          {SCREENSHOT_SLIDES.map((slide, i) => (
            <img
              key={slide.label}
              src={slide.src}
              alt={slide.alt}
              loading={i === 0 ? "eager" : "lazy"}
              className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-500 ${
                i === activeIndex ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Caption */}
      <p aria-live="polite" className="text-center text-sm text-muted-foreground mt-4 transition-opacity duration-300">
        {activeSlide.description}
      </p>
    </div>
  )
}

export default Screenshot
