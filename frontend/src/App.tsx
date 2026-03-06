import { useState } from "react";
import { Navbar } from "./components/Navbar";
import { UploadZone } from "./components/UploadZone";
import { ProcessingView } from "./components/ProcessingView";
import { BatchSummary } from "./components/BatchSummary";
import { Dashboard } from "./components/Dashboard";
import { inspectImages } from "./lib/api";
import type {
  InspectionResult,
  BatchSummary as BatchSummaryType,
  SSEEvent,
} from "./lib/types";

function App() {
  const [confidence, setConfidence] = useState(0.24);
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [currentResult, setCurrentResult] = useState<InspectionResult | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [defectiveCount, setDefectiveCount] = useState(0);
  const [cleanCount, setCleanCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [batchResults, setBatchResults] = useState<InspectionResult[]>([]);
  const [batchSummary, setBatchSummary] = useState<BatchSummaryType | null>(null);

  const handleRun = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProcessedCount(0);
    setDefectiveCount(0);
    setCleanCount(0);
    setSkippedCount(0);
    setBatchResults([]);
    setBatchSummary(null);
    setCurrentResult(null);

    const results: InspectionResult[] = [];

    try {
      await inspectImages(files, confidence, (event: SSEEvent) => {
        if (event.type === "result") {
          results.push(event.result);
          setBatchResults([...results]);
          setCurrentResult(event.result);
          setProcessedCount(event.index + 1);
          if (event.result.total_defects > 0) {
            setDefectiveCount((c) => c + 1);
          } else {
            setCleanCount((c) => c + 1);
          }
        } else if (event.type === "skip") {
          setSkippedCount((c) => c + 1);
          setProcessedCount(event.index + 1);
        } else if (event.type === "done") {
          setBatchSummary({
            total: event.total,
            defective: event.defective,
            clean: event.clean,
            skipped: event.skipped,
            skipped_files: event.skipped_files,
          });
        }
      });
    } catch (err) {
      console.error("Inspection failed:", err);
    }

    setIsProcessing(false);
    setFiles([]);
    setRefreshKey((k) => k + 1);
  };

  const handleReset = () => {
    setFiles([]);
    setBatchResults([]);
    setBatchSummary(null);
    setCurrentResult(null);
    setProcessedCount(0);
    setDefectiveCount(0);
    setCleanCount(0);
    setSkippedCount(0);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        confidence={confidence}
        onConfidenceChange={setConfidence}
        onReset={handleReset}
      />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8 space-y-8">
        {/* Upload section */}
        <section className="max-w-2xl mx-auto animate-fade-in-up">
          <UploadZone
            files={files}
            onFilesChange={setFiles}
            onRun={handleRun}
            isProcessing={isProcessing}
          />
        </section>

        {/* Processing view */}
        {isProcessing && (
          <section>
            <ProcessingView
              currentResult={currentResult}
              processed={processedCount}
              total={files.length || processedCount}
              defective={defectiveCount}
              clean={cleanCount}
              skippedCount={skippedCount}
            />
          </section>
        )}

        {/* Batch summary */}
        {batchSummary && !isProcessing && (
          <section>
            <BatchSummary summary={batchSummary} results={batchResults} />
          </section>
        )}

        {/* Dashboard */}
        <section>
          <div className="glow-line mb-8" />
          <Dashboard refreshKey={refreshKey} />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] mt-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <p className="text-xs text-[var(--text-muted)]">
            Siemens Energy Welding Inspection AI
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            YOLOv8m &middot; Demo Model
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
