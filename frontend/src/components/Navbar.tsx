import { useState, useRef, useEffect } from "react";
import { Factory, HelpCircle, Settings, RotateCcw, X, Zap } from "lucide-react";
import { clearHistory } from "../lib/api";

export function Navbar({
  confidence,
  onConfidenceChange,
  onReset,
}: {
  confidence: number;
  onConfidenceChange: (v: number) => void;
  onReset: () => void;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    }
    if (showSettings) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSettings]);

  return (
    <>
      <nav className="sticky top-0 z-50 glass-strong">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="relative p-2 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dim)]">
              <Factory size={20} className="text-white" />
              <div className="absolute inset-0 rounded-xl bg-[var(--accent)] opacity-20 blur-md" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                Siemens Energy
              </h1>
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--accent)]">
                Welding Inspection AI
              </p>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1">
            {/* Inline confidence display */}
            <div className="hidden md:flex items-center gap-2 mr-2 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)]/50">
              <Zap size={12} className="text-[var(--accent)]" />
              <span className="text-[11px] text-[var(--text-muted)]">Sensitivity</span>
              <span className="text-xs font-mono font-medium text-[var(--accent)]">
                {confidence.toFixed(2)}
              </span>
            </div>

            <button
              onClick={() => setShowHelp(true)}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              title="Help & Guide"
            >
              <HelpCircle size={18} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]" />
            </button>

            <div ref={settingsRef} className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-lg transition-colors ${
                  showSettings ? "bg-white/5 text-[var(--accent)]" : "hover:bg-white/5 text-[var(--text-muted)]"
                }`}
                title="Settings"
              >
                <Settings size={18} />
              </button>

              {showSettings && (
                <div className="absolute right-0 top-12 w-80 glass-strong rounded-2xl p-5 shadow-2xl shadow-black/40 animate-slide-down">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Settings</h3>
                    <button onClick={() => setShowSettings(false)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                      <X size={14} />
                    </button>
                  </div>

                  <label className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] block mb-3">
                    AI Sensitivity (Confidence)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0.05"
                      max="1"
                      step="0.01"
                      value={confidence}
                      onChange={(e) => onConfidenceChange(parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono font-bold text-[var(--accent)] w-12 text-right">
                      {confidence.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-2">
                    Lower = more detections. Higher = stricter.
                  </p>

                  <div className="glow-line my-4" />

                  <button
                    onClick={async () => {
                      await clearHistory();
                      onReset();
                      setShowSettings(false);
                    }}
                    className="flex items-center gap-2 text-sm text-[var(--danger)] hover:bg-[var(--danger)]/10 w-full p-2.5 rounded-xl transition-colors"
                  >
                    <RotateCcw size={14} />
                    Reset All Inspection Logs
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="glow-line" />
      </nav>

      {/* Help slide-over */}
      {showHelp && (
        <div className="fixed inset-0 z-[60] flex justify-end" onClick={() => setShowHelp(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md glass-strong h-full overflow-y-auto p-6 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-lg font-bold">Help & Guide</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Learn how to use this tool</p>
              </div>
              <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                <X size={18} className="text-[var(--text-secondary)]" />
              </button>
            </div>

            <section className="mb-8">
              <h3 className="text-sm font-semibold gradient-text mb-3">How to Use</h3>
              <ol className="text-sm text-[var(--text-secondary)] space-y-2.5">
                {[
                  "Adjust AI Sensitivity in Settings (gear icon).",
                  "Drag and drop weld images into the upload zone.",
                  'Review staged files, then click "Run Inspection".',
                  "Watch real-time processing with live annotations.",
                  "Review results in the analytics dashboard below.",
                ].map((text, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{text}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="mb-8">
              <h3 className="text-sm font-semibold gradient-text mb-3">About the Model</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                YOLOv8m (medium) fine-tuned on welding defect data. Backbone layers 0-7 frozen,
                trained for 50 epochs at 640px. This is a demo model (mAP50 ~16%) —
                retrain on larger data for production use.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-sm font-semibold gradient-text mb-3">Defect Classes</h3>
              <div className="space-y-2">
                {[
                  "Lump defect", "Spatter defect", "Pin hole defect",
                  "Chips & Burr", "Undercut defect", "Welding protrusion",
                ].map((cls, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                    <span className="w-5 h-5 rounded bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-bold flex items-center justify-center">
                      {i}
                    </span>
                    {cls}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold gradient-text mb-3">Tips</h3>
              <ul className="text-sm text-[var(--text-secondary)] space-y-2">
                <li className="flex gap-2"><span className="text-[var(--accent)]">-</span> Use well-lit, high-resolution images of weld seams.</li>
                <li className="flex gap-2"><span className="text-[var(--accent)]">-</span> Start with confidence 0.15-0.25, increase if too many false positives.</li>
                <li className="flex gap-2"><span className="text-[var(--accent)]">-</span> Supported: JPG, PNG, WebP. Max 10 MB each.</li>
              </ul>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
