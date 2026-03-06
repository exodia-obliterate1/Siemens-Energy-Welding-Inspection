import { useState } from "react";
import { Factory, HelpCircle, Settings, RotateCcw } from "lucide-react";
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

  return (
    <>
      <nav className="sticky top-0 z-50 bg-[var(--bg-card)]/80 backdrop-blur-xl border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--accent)]/15">
              <Factory size={22} color="var(--accent)" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Siemens Energy
              </h1>
              <p className="text-xs text-[var(--text-muted)] -mt-0.5">
                Welding Inspection AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 rounded-lg hover:bg-[var(--border)] transition-colors"
              title="Help"
            >
              <HelpCircle size={20} className="text-[var(--text-secondary)]" />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-lg hover:bg-[var(--border)] transition-colors"
                title="Settings"
              >
                <Settings size={20} className="text-[var(--text-secondary)]" />
              </button>

              {showSettings && (
                <div className="absolute right-0 top-12 w-72 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 shadow-2xl animate-fade-in">
                  <label className="text-sm text-[var(--text-secondary)] block mb-2">
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
                      className="flex-1 accent-[var(--accent)]"
                    />
                    <span className="text-sm font-mono text-[var(--accent)] w-12 text-right">
                      {confidence.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    Lower = more detections. Higher = stricter.
                  </p>

                  <hr className="border-[var(--border)] my-3" />

                  <button
                    onClick={async () => {
                      await clearHistory();
                      onReset();
                      setShowSettings(false);
                    }}
                    className="flex items-center gap-2 text-sm text-[var(--danger)] hover:bg-[var(--danger)]/10 w-full p-2 rounded-lg transition-colors"
                  >
                    <RotateCcw size={14} />
                    Reset Inspection Logs
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {showHelp && (
        <div className="fixed inset-0 z-[60] flex justify-end" onClick={() => setShowHelp(false)}>
          <div
            className="w-full max-w-lg bg-[var(--bg-card)] border-l border-[var(--border)] h-full overflow-y-auto p-6 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Help & Guide</h2>
              <button onClick={() => setShowHelp(false)} className="text-[var(--text-secondary)] hover:text-white text-2xl">
                &times;
              </button>
            </div>

            <section className="mb-6">
              <h3 className="text-[var(--accent)] font-medium mb-2">How to Use</h3>
              <ol className="text-sm text-[var(--text-secondary)] space-y-2 list-decimal list-inside">
                <li>Adjust AI Sensitivity in Settings (gear icon).</li>
                <li>Drag and drop weld images into the upload zone.</li>
                <li>Review staged files, then click <strong className="text-white">Run Inspection</strong>.</li>
                <li>Watch real-time processing with live annotations.</li>
                <li>Review results in the analytics dashboard below.</li>
              </ol>
            </section>

            <section className="mb-6">
              <h3 className="text-[var(--accent)] font-medium mb-2">About the Model</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                YOLOv8m (medium) fine-tuned on welding defect data. Backbone layers 0-7 frozen,
                trained for 50 epochs at 640px image size. This is a demo model (mAP50 ~16%) —
                retrain on larger data for production use.
              </p>
            </section>

            <section className="mb-6">
              <h3 className="text-[var(--accent)] font-medium mb-2">Defect Classes</h3>
              <div className="text-sm text-[var(--text-secondary)] space-y-1">
                <p>0 — Lump defect</p>
                <p>1 — Spatter defect</p>
                <p>2 — Pin hole defect</p>
                <p>3 — Chips & Burr</p>
                <p>4 — Undercut defect</p>
                <p>5 — Welding protrusion</p>
              </div>
            </section>

            <section>
              <h3 className="text-[var(--accent)] font-medium mb-2">Tips</h3>
              <ul className="text-sm text-[var(--text-secondary)] space-y-2 list-disc list-inside">
                <li>Use well-lit, high-resolution images of weld seams.</li>
                <li>Start with confidence 0.15-0.25, increase if too many false positives.</li>
                <li>Supported formats: JPG, PNG, WebP. Max 10 MB each.</li>
              </ul>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
