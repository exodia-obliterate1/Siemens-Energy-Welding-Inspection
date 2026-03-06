# React + FastAPI Welding Inspection Dashboard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Streamlit app with a React + FastAPI dashboard that looks professional, eliminates jitter, adds explicit "Run Inspection" flow, and deploys to HuggingFace Spaces in a single Docker container.

**Architecture:** FastAPI backend serves a React static build at `/` and YOLO inference API at `/api/*`. SSE streams real-time processing progress. Single Dockerfile with multi-stage build (Node → Python). Environment detection for HF Spaces vs local mode.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Recharts + Lucide React + React Dropzone | FastAPI + Uvicorn + python-multipart + ultralytics + opencv-python-headless

---

### Task 1: Backend — Core FastAPI App + Model Loading

**Files:**
- Create: `backend/__init__.py`
- Create: `backend/main.py`
- Create: `backend/inference.py`
- Create: `backend/models.py`
- Create: `backend/storage.py`
- Create: `requirements.txt` (overwrite existing)

**Step 1: Create `backend/__init__.py`**

```python
# empty
```

**Step 2: Create `backend/models.py`**

```python
from pydantic import BaseModel

class DefectBox(BaseModel):
    class_id: int
    class_name: str
    confidence: float
    x1: int
    y1: int
    x2: int
    y2: int

class InspectionResult(BaseModel):
    id: str
    image_name: str
    timestamp: str
    defects: list[DefectBox]
    defect_classes: str
    defect_summary: str
    total_defects: int
    has_annotated_image: bool

class BatchSummary(BaseModel):
    total: int
    defective: int
    clean: int
    skipped: int
    results: list[InspectionResult]
    skipped_files: list[dict]

class HistoryResponse(BaseModel):
    items: list[InspectionResult]
    total: int
```

**Step 3: Create `backend/storage.py`**

```python
import os
import re
import pandas as pd
from backend.models import InspectionResult

IS_HF_SPACE = os.environ.get("SPACE_ID") is not None
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if IS_HF_SPACE:
    OUTPUT_DIR = "/tmp/outputs"
else:
    OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")

OUTPUT_IMG_DIR = os.path.join(OUTPUT_DIR, "defective_images")
CSV_PATH = os.path.join(OUTPUT_DIR, "results.csv")
os.makedirs(OUTPUT_IMG_DIR, exist_ok=True)

CSV_COLUMNS = ["id", "timestamp", "image_name", "defect_classes", "defect_summary", "total_defects"]

_inspection_log: list[InspectionResult] = []


def _load_csv():
    global _inspection_log
    if not IS_HF_SPACE and os.path.exists(CSV_PATH) and os.path.getsize(CSV_PATH) > 60:
        try:
            df = pd.read_csv(CSV_PATH)
            for _, row in df.iterrows():
                _inspection_log.append(InspectionResult(
                    id=str(row.get("id", "")),
                    image_name=row["image_name"],
                    timestamp=row["timestamp"],
                    defects=[],
                    defect_classes=str(row.get("defect_classes", "")),
                    defect_summary=str(row.get("defect_summary", "")),
                    total_defects=int(row.get("total_defects", 0)),
                    has_annotated_image=os.path.exists(
                        os.path.join(OUTPUT_IMG_DIR, str(row["image_name"]))
                    ),
                ))
        except Exception:
            _inspection_log = []


_load_csv()


def _persist_csv():
    if IS_HF_SPACE:
        return
    try:
        rows = []
        for r in _inspection_log:
            rows.append({
                "id": r.id,
                "timestamp": r.timestamp,
                "image_name": r.image_name,
                "defect_classes": r.defect_classes,
                "defect_summary": r.defect_summary,
                "total_defects": r.total_defects,
            })
        pd.DataFrame(rows, columns=CSV_COLUMNS).to_csv(CSV_PATH, index=False)
    except PermissionError:
        pass


def add_result(result: InspectionResult):
    _inspection_log.append(result)
    _persist_csv()


def get_history(search: str = "", defect_filter: str = "") -> list[InspectionResult]:
    results = _inspection_log
    if search:
        escaped = re.escape(search.lower())
        results = [r for r in results if re.search(escaped, r.image_name.lower())]
    if defect_filter and defect_filter != "All":
        escaped = re.escape(defect_filter.lower())
        results = [r for r in results if re.search(escaped, r.defect_classes.lower())]
    return results


def clear_history():
    global _inspection_log
    _inspection_log = []
    if not IS_HF_SPACE and os.path.exists(CSV_PATH):
        try:
            os.remove(CSV_PATH)
        except PermissionError:
            pass


def get_image_path(image_name: str) -> str | None:
    path = os.path.join(OUTPUT_IMG_DIR, os.path.basename(image_name))
    return path if os.path.exists(path) else None
```

**Step 4: Create `backend/inference.py`**

```python
import os
import re
import uuid
import cv2
import numpy as np
from datetime import datetime
from collections import Counter
from backend.models import DefectBox, InspectionResult
from backend.storage import OUTPUT_IMG_DIR

CLASSES = {
    0: "Lump defect", 1: "Spatter defect", 2: "Pin hole defect",
    3: "Chips & Burr", 4: "Undercut defect", 5: "Welding protrusion",
}
COLORS = {
    0: (0, 140, 255), 1: (255, 180, 90), 2: (120, 200, 160),
    3: (180, 140, 200), 4: (0, 230, 255), 5: (90, 90, 255),
}

MAX_FILE_SIZE_MB = 10
_model = None


def sanitize_filename(name: str) -> str:
    name = os.path.basename(name)
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)
    return name or "unnamed"


def load_model():
    global _model
    if _model is not None:
        return _model
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(base, "yolov8_M_ model", "weights", "best.pt")
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model not found at {path}")
    from ultralytics import YOLO
    _model = YOLO(path)
    return _model


def validate_image(file_bytes: bytes, filename: str) -> tuple[bool, str, np.ndarray | None]:
    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        return False, f"File too large ({size_mb:.1f} MB > {MAX_FILE_SIZE_MB} MB)", None
    try:
        arr = np.asarray(bytearray(file_bytes), dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return False, "Could not decode image (corrupt or unsupported)", None
        return True, "", img
    except Exception as e:
        return False, f"Error reading image: {e}", None


def run_inference(img: np.ndarray, filename: str, confidence: float) -> InspectionResult:
    model = load_model()
    safe_name = sanitize_filename(filename)
    results = model(img, conf=confidence)[0]

    defect_boxes: list[DefectBox] = []
    detected_labels: list[str] = []

    if results.boxes:
        for box in results.boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            label = CLASSES.get(cls_id, "Unknown")
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            defect_boxes.append(DefectBox(
                class_id=cls_id, class_name=label, confidence=conf,
                x1=x1, y1=y1, x2=x2, y2=y2,
            ))
            detected_labels.append(label)

            color = COLORS.get(cls_id, (255, 255, 255))
            cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
            cv2.putText(img, f"{label} {conf:.0%}", (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

    has_annotated = False
    if detected_labels:
        cv2.imwrite(os.path.join(OUTPUT_IMG_DIR, safe_name), img)
        has_annotated = True

    counts = Counter(detected_labels)
    summary = ", ".join(f"{k}({v})" for k, v in counts.items())

    return InspectionResult(
        id=uuid.uuid4().hex[:12],
        image_name=safe_name,
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        defects=defect_boxes,
        defect_classes=", ".join(counts.keys()),
        defect_summary=summary,
        total_defects=sum(counts.values()),
        has_annotated_image=has_annotated,
    )
```

**Step 5: Create `backend/main.py`**

```python
import io
import json
import os
import zipfile
from fastapi import FastAPI, File, UploadFile, Query
from fastapi.responses import FileResponse, StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd

from backend.inference import load_model, validate_image, run_inference, CLASSES
from backend.storage import (
    add_result, get_history, clear_history, get_image_path, OUTPUT_IMG_DIR,
)
from backend.models import HistoryResponse

app = FastAPI(title="Siemens Energy Welding Inspection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model at startup
@app.on_event("startup")
async def startup():
    try:
        load_model()
    except Exception as e:
        print(f"Warning: model failed to load: {e}")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/classes")
async def get_classes():
    return CLASSES


@app.post("/api/inspect")
async def inspect(
    files: list[UploadFile] = File(...),
    confidence: float = Query(0.24, ge=0.05, le=1.0),
):
    """Process images and stream results via SSE."""
    async def event_stream():
        results = []
        skipped = []
        total = len(files)

        for idx, file in enumerate(files):
            file_bytes = await file.read()
            is_valid, error_msg, img = validate_image(file_bytes, file.filename or "unknown")

            if not is_valid:
                skipped.append({"name": file.filename, "reason": error_msg})
                event = {
                    "type": "skip",
                    "index": idx,
                    "total": total,
                    "name": file.filename,
                    "reason": error_msg,
                }
                yield f"data: {json.dumps(event)}\n\n"
                continue

            result = run_inference(img, file.filename or "unknown", confidence)
            add_result(result)
            results.append(result)

            event = {
                "type": "result",
                "index": idx,
                "total": total,
                "result": result.model_dump(),
            }
            yield f"data: {json.dumps(event)}\n\n"

        # Final summary
        defective = sum(1 for r in results if r.total_defects > 0)
        clean = sum(1 for r in results if r.total_defects == 0)
        summary = {
            "type": "done",
            "total": len(results),
            "defective": defective,
            "clean": clean,
            "skipped": len(skipped),
            "skipped_files": skipped,
        }
        yield f"data: {json.dumps(summary)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/history")
async def history(
    search: str = Query(""),
    defect_filter: str = Query(""),
) -> HistoryResponse:
    items = get_history(search, defect_filter)
    return HistoryResponse(items=items, total=len(items))


@app.get("/api/history/{image_name}/image")
async def get_annotated_image(image_name: str):
    path = get_image_path(image_name)
    if path is None:
        return Response(status_code=404)
    return FileResponse(path)


@app.get("/api/export/csv")
async def export_csv(search: str = Query(""), defect_filter: str = Query("")):
    items = get_history(search, defect_filter)
    rows = [
        {
            "timestamp": r.timestamp,
            "image_name": r.image_name,
            "defect_classes": r.defect_classes,
            "defect_summary": r.defect_summary,
            "total_defects": r.total_defects,
        }
        for r in items
    ]
    csv_bytes = pd.DataFrame(rows).to_csv(index=False).encode()
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=welding_report.csv"},
    )


@app.get("/api/export/zip")
async def export_zip():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        if os.path.isdir(OUTPUT_IMG_DIR):
            for fname in os.listdir(OUTPUT_IMG_DIR):
                fpath = os.path.join(OUTPUT_IMG_DIR, fname)
                if os.path.isfile(fpath):
                    zf.write(fpath, fname)
    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=annotated_images.zip"},
    )


@app.delete("/api/history")
async def delete_history():
    clear_history()
    return {"status": "cleared"}


# Serve React frontend — MUST be last
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
```

**Step 6: Update `requirements.txt`**

```
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
python-multipart>=0.0.6
ultralytics>=8.0.0
opencv-python-headless>=4.8.0
pandas>=2.0.0
numpy>=1.24.0
Pillow>=10.0.0
```

**Step 7: Run backend to verify it starts**

```bash
pip install fastapi uvicorn python-multipart
cd "C:/Users/catsi/Downloads/Siemens Energy-20260306T043217Z-3-001/Siemens Energy"
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8501
# Expected: server starts, hits /api/health → {"status": "ok"}
```

**Step 8: Commit**

```bash
git add backend/ requirements.txt
git commit -m "feat: add FastAPI backend with inference, storage, and API endpoints"
```

---

### Task 2: Frontend — Scaffold React + Vite + Tailwind

**Files:**
- Create: `frontend/` (entire scaffold via Vite)
- Modify: `frontend/package.json` (add deps)
- Create: `frontend/tailwind.config.js`
- Create: `frontend/src/styles/globals.css`

**Step 1: Scaffold Vite + React + TypeScript**

```bash
cd "C:/Users/catsi/Downloads/Siemens Energy-20260306T043217Z-3-001/Siemens Energy"
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

**Step 2: Install dependencies**

```bash
cd frontend
npm install tailwindcss @tailwindcss/vite recharts lucide-react react-dropzone
```

**Step 3: Configure Tailwind in `frontend/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:8501",
    },
  },
});
```

**Step 4: Create `frontend/src/styles/globals.css`**

```css
@import "tailwindcss";

:root {
  --bg-primary: #0f1117;
  --bg-card: #1a1d27;
  --bg-card-hover: #22263a;
  --border: #2a2d3a;
  --border-hover: #3a3d4a;
  --accent: #00b4aa;
  --accent-light: #00d4c8;
  --accent-glow: rgba(0, 180, 170, 0.15);
  --warning: #f59e0b;
  --danger: #ef4444;
  --success: #22c55e;
  --text-primary: #f0f0f0;
  --text-secondary: #8b8fa3;
  --text-muted: #5a5e72;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: "Inter", system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg-primary); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--border-hover); }

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 var(--accent-glow); }
  50% { box-shadow: 0 0 20px 4px var(--accent-glow); }
}

.animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
.animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
```

**Step 5: Update `frontend/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Step 6: Verify dev server starts**

```bash
cd frontend && npm run dev
# Expected: Vite dev server on localhost:5173
```

**Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold React + Vite + Tailwind frontend"
```

---

### Task 3: Frontend — API Client + Types

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/types.ts`

**Step 1: Create `frontend/src/lib/types.ts`**

```typescript
export interface DefectBox {
  class_id: number;
  class_name: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface InspectionResult {
  id: string;
  image_name: string;
  timestamp: string;
  defects: DefectBox[];
  defect_classes: string;
  defect_summary: string;
  total_defects: number;
  has_annotated_image: boolean;
}

export interface BatchSummary {
  total: number;
  defective: number;
  clean: number;
  skipped: number;
  skipped_files: { name: string; reason: string }[];
}

export interface HistoryResponse {
  items: InspectionResult[];
  total: number;
}

export type SSEEvent =
  | { type: "result"; index: number; total: number; result: InspectionResult }
  | { type: "skip"; index: number; total: number; name: string; reason: string }
  | { type: "done"; total: number; defective: number; clean: number; skipped: number; skipped_files: { name: string; reason: string }[] };

export const DEFECT_CLASSES: Record<number, string> = {
  0: "Lump defect",
  1: "Spatter defect",
  2: "Pin hole defect",
  3: "Chips & Burr",
  4: "Undercut defect",
  5: "Welding protrusion",
};

export const DEFECT_COLORS: Record<string, string> = {
  "Lump defect": "#008CFF",
  "Spatter defect": "#FFB45A",
  "Pin hole defect": "#78C8A0",
  "Chips & Burr": "#B48CC8",
  "Undercut defect": "#00E6FF",
  "Welding protrusion": "#5A5AFF",
};
```

**Step 2: Create `frontend/src/lib/api.ts`**

```typescript
import type { HistoryResponse, SSEEvent } from "./types";

const BASE = "/api";

export async function inspectImages(
  files: File[],
  confidence: number,
  onEvent: (event: SSEEvent) => void
): Promise<void> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));

  const res = await fetch(`${BASE}/inspect?confidence=${confidence}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error(`Inspection failed: ${res.status}`);
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const data = line.replace(/^data: /, "").trim();
      if (data) {
        onEvent(JSON.parse(data));
      }
    }
  }
}

export async function fetchHistory(
  search = "",
  defectFilter = ""
): Promise<HistoryResponse> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (defectFilter && defectFilter !== "All") params.set("defect_filter", defectFilter);
  const res = await fetch(`${BASE}/history?${params}`);
  return res.json();
}

export function getAnnotatedImageUrl(imageName: string): string {
  return `${BASE}/history/${encodeURIComponent(imageName)}/image`;
}

export async function clearHistory(): Promise<void> {
  await fetch(`${BASE}/history`, { method: "DELETE" });
}

export function getExportCsvUrl(search = "", defectFilter = ""): string {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (defectFilter && defectFilter !== "All") params.set("defect_filter", defectFilter);
  return `${BASE}/export/csv?${params}`;
}

export function getExportZipUrl(): string {
  return `${BASE}/export/zip`;
}
```

**Step 3: Commit**

```bash
git add frontend/src/lib/
git commit -m "feat: add API client and TypeScript types"
```

---

### Task 4: Frontend — Reusable UI Components

**Files:**
- Create: `frontend/src/components/ui/Card.tsx`
- Create: `frontend/src/components/ui/Badge.tsx`
- Create: `frontend/src/components/ui/KpiCard.tsx`
- Create: `frontend/src/components/ui/ProgressBar.tsx`
- Create: `frontend/src/components/ui/index.ts`

**Step 1: Create all UI components**

`Card.tsx`:
```tsx
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 transition-all duration-200 hover:border-[var(--border-hover)] ${className}`}
    >
      {children}
    </div>
  );
}
```

`Badge.tsx`:
```tsx
export function Badge({
  label,
  color = "var(--accent)",
}: {
  label: string;
  color?: string;
}) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  );
}
```

`KpiCard.tsx`:
```tsx
import type { ReactNode } from "react";
import { Card } from "./Card";

export function KpiCard({
  title,
  value,
  icon,
  color = "var(--accent)",
}: {
  title: string;
  value: string | number;
  icon: ReactNode;
  color?: string;
}) {
  return (
    <Card className="animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--text-secondary)]">{title}</p>
          <p className="text-2xl font-bold mt-1" style={{ color }}>
            {value}
          </p>
        </div>
        <div
          className="p-3 rounded-lg"
          style={{ backgroundColor: `${color}15` }}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}
```

`ProgressBar.tsx`:
```tsx
export function ProgressBar({
  progress,
  label,
}: {
  progress: number;
  label?: string;
}) {
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-[var(--text-secondary)]">{label}</span>
          <span className="text-[var(--accent)] font-mono">{Math.round(progress)}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, var(--accent), var(--accent-light))",
          }}
        />
      </div>
    </div>
  );
}
```

`index.ts`:
```tsx
export { Card } from "./Card";
export { Badge } from "./Badge";
export { KpiCard } from "./KpiCard";
export { ProgressBar } from "./ProgressBar";
```

**Step 2: Commit**

```bash
git add frontend/src/components/ui/
git commit -m "feat: add reusable UI components (Card, Badge, KpiCard, ProgressBar)"
```

---

### Task 5: Frontend — Navbar Component

**Files:**
- Create: `frontend/src/components/Navbar.tsx`

**Step 1: Create Navbar**

```tsx
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

      {/* Help slide-out panel */}
      {showHelp && (
        <div className="fixed inset-0 z-[60] flex justify-end" onClick={() => setShowHelp(false)}>
          <div
            className="w-full max-w-lg bg-[var(--bg-card)] border-l border-[var(--border)] h-full overflow-y-auto p-6 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Help & Guide</h2>
              <button onClick={() => setShowHelp(false)} className="text-[var(--text-secondary)] hover:text-white">
                &times;
              </button>
            </div>

            <section className="mb-6">
              <h3 className="text-[var(--accent)] font-medium mb-2">How to Use</h3>
              <ol className="text-sm text-[var(--text-secondary)] space-y-2 list-decimal list-inside">
                <li>Adjust AI Sensitivity in Settings (gear icon).</li>
                <li>Drag and drop weld images into the upload zone.</li>
                <li>Review staged files, then click <strong>Run Inspection</strong>.</li>
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
                <li>Start with confidence 0.15–0.25, increase if too many false positives.</li>
                <li>Supported formats: JPG, PNG, WebP. Max 10 MB each.</li>
              </ul>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/Navbar.tsx
git commit -m "feat: add Navbar with settings dropdown and help panel"
```

---

### Task 6: Frontend — UploadZone Component

**Files:**
- Create: `frontend/src/components/UploadZone.tsx`

**Step 1: Create UploadZone**

```tsx
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Play, Image as ImageIcon } from "lucide-react";

const ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

export function UploadZone({
  files,
  onFilesChange,
  onRun,
  isProcessing,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onRun: () => void;
  isProcessing: boolean;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      onFilesChange([...files, ...accepted]);
    },
    [files, onFilesChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    disabled: isProcessing,
  });

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? "border-[var(--accent)] bg-[var(--accent)]/5"
            : "border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-card)]"
        } ${isProcessing ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input {...getInputProps()} />
        <Upload
          size={40}
          className="mx-auto mb-3 text-[var(--text-muted)]"
        />
        <p className="text-[var(--text-secondary)]">
          {isDragActive
            ? "Drop images here..."
            : "Drag & drop weld images here, or click to browse"}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          JPG, PNG, WebP — Max 10 MB each
        </p>
      </div>

      {files.length > 0 && (
        <>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">
                <ImageIcon size={14} className="inline mr-1.5 -mt-0.5" />
                {files.length} image{files.length > 1 ? "s" : ""} staged
              </span>
              <button
                onClick={() => onFilesChange([])}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
              >
                Clear all
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-[var(--border)]">
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="px-4 py-2 flex items-center justify-between text-sm hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  <span className="text-[var(--text-secondary)] truncate flex-1 mr-4">
                    {f.name}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] mr-3">
                    {(f.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <button
                    onClick={() => removeFile(i)}
                    className="text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onRun}
            disabled={isProcessing}
            className="w-full py-3 rounded-xl font-medium text-white transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, var(--accent), var(--accent-light))",
            }}
          >
            <Play size={18} />
            {isProcessing ? "Processing..." : "Run Inspection"}
          </button>
        </>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/UploadZone.tsx
git commit -m "feat: add UploadZone with drag-and-drop and file staging"
```

---

### Task 7: Frontend — ProcessingView Component

**Files:**
- Create: `frontend/src/components/ProcessingView.tsx`

**Step 1: Create ProcessingView**

```tsx
import { Shield, ShieldAlert, ShieldX } from "lucide-react";
import { Card, ProgressBar } from "./ui";
import { getAnnotatedImageUrl } from "../lib/api";
import type { InspectionResult } from "../lib/types";

export function ProcessingView({
  currentResult,
  processed,
  total,
  defective,
  clean,
  skippedCount,
}: {
  currentResult: InspectionResult | null;
  processed: number;
  total: number;
  defective: number;
  clean: number;
  skippedCount: number;
}) {
  const progress = total > 0 ? (processed / total) * 100 : 0;

  return (
    <Card className="animate-pulse-glow">
      <h2 className="text-lg font-semibold mb-4">Processing Inspection</h2>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
        {/* Current image */}
        <div className="bg-[var(--bg-primary)] rounded-lg overflow-hidden min-h-[300px] flex items-center justify-center">
          {currentResult?.has_annotated_image ? (
            <img
              src={getAnnotatedImageUrl(currentResult.image_name)}
              alt={currentResult.image_name}
              className="w-full h-auto object-contain max-h-[400px]"
            />
          ) : currentResult ? (
            <p className="text-[var(--text-muted)]">
              No defects — {currentResult.image_name} is clean
            </p>
          ) : (
            <p className="text-[var(--text-muted)]">Waiting for first image...</p>
          )}
        </div>

        {/* Real-time stats */}
        <div className="space-y-4">
          <div className="text-sm text-[var(--text-secondary)]">
            {currentResult && (
              <p className="mb-3 truncate">
                Inspecting: <strong className="text-white">{currentResult.image_name}</strong>
              </p>
            )}
          </div>

          <div className="space-y-3">
            <StatRow icon={<Shield size={16} />} label="Processed" value={processed} total={total} color="var(--accent)" />
            <StatRow icon={<ShieldAlert size={16} />} label="Defective" value={defective} color="var(--danger)" />
            <StatRow icon={<Shield size={16} />} label="Clean" value={clean} color="var(--success)" />
            {skippedCount > 0 && (
              <StatRow icon={<ShieldX size={16} />} label="Skipped" value={skippedCount} color="var(--warning)" />
            )}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <ProgressBar progress={progress} label={`${processed} / ${total} images`} />
      </div>
    </Card>
  );
}

function StatRow({
  icon,
  label,
  value,
  total,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  total?: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <span className="text-sm font-mono font-medium" style={{ color }}>
        {value}{total !== undefined ? ` / ${total}` : ""}
      </span>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/ProcessingView.tsx
git commit -m "feat: add ProcessingView with live stats and image preview"
```

---

### Task 8: Frontend — BatchSummary Component

**Files:**
- Create: `frontend/src/components/BatchSummary.tsx`

**Step 1: Create BatchSummary**

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Download, ShieldCheck, ShieldAlert, ShieldX, FileStack } from "lucide-react";
import { KpiCard, Card } from "./ui";
import { getExportCsvUrl, getExportZipUrl } from "../lib/api";
import type { InspectionResult, BatchSummary as BatchSummaryType } from "../lib/types";
import { DEFECT_COLORS } from "../lib/types";

export function BatchSummary({
  summary,
  results,
}: {
  summary: BatchSummaryType;
  results: InspectionResult[];
}) {
  // Build defect breakdown
  const defectMap: Record<string, number> = {};
  for (const r of results) {
    if (!r.defect_classes) continue;
    for (const cls of r.defect_classes.split(", ")) {
      defectMap[cls] = (defectMap[cls] || 0) + 1;
    }
  }
  const chartData = Object.entries(defectMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-lg font-semibold">Batch Summary</h2>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Total Processed" value={summary.total} icon={<FileStack size={20} />} color="var(--accent)" />
        <KpiCard title="Defective" value={summary.defective} icon={<ShieldAlert size={20} />} color="var(--danger)" />
        <KpiCard title="Clean" value={summary.clean} icon={<ShieldCheck size={20} />} color="var(--success)" />
        <KpiCard title="Skipped" value={summary.skipped} icon={<ShieldX size={20} />} color="var(--warning)" />
      </div>

      {/* Chart + downloads */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4">
          <Card>
            <h3 className="text-sm text-[var(--text-secondary)] mb-4">Defect Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={{ fill: "#8b8fa3", fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#8b8fa3", fontSize: 12 }} width={130} />
                <Tooltip
                  contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }}
                  labelStyle={{ color: "#f0f0f0" }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={DEFECT_COLORS[entry.name] || "var(--accent)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <div className="space-y-3">
            <a
              href={getExportZipUrl()}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition-colors"
            >
              <Download size={16} className="text-[var(--accent)]" />
              Download Annotated (ZIP)
            </a>
            <a
              href={getExportCsvUrl()}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition-colors"
            >
              <Download size={16} className="text-[var(--accent)]" />
              Download Report (CSV)
            </a>
          </div>
        </div>
      )}

      {/* Skipped files */}
      {summary.skipped_files.length > 0 && (
        <Card>
          <h3 className="text-sm text-[var(--warning)] mb-2">
            Skipped Files ({summary.skipped_files.length})
          </h3>
          <div className="space-y-1 text-sm">
            {summary.skipped_files.map((sf, i) => (
              <p key={i} className="text-[var(--text-secondary)]">
                <strong>{sf.name}</strong> — {sf.reason}
              </p>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/BatchSummary.tsx
git commit -m "feat: add BatchSummary with KPI cards, chart, and downloads"
```

---

### Task 9: Frontend — Dashboard + ImageDetailModal Components

**Files:**
- Create: `frontend/src/components/Dashboard.tsx`
- Create: `frontend/src/components/ImageDetailModal.tsx`

**Step 1: Create `ImageDetailModal.tsx`**

```tsx
import { X } from "lucide-react";
import { Badge } from "./ui";
import { getAnnotatedImageUrl } from "../lib/api";
import type { InspectionResult } from "../lib/types";
import { DEFECT_COLORS } from "../lib/types";

export function ImageDetailModal({
  result,
  onClose,
}: {
  result: InspectionResult;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div>
            <h3 className="font-semibold">{result.image_name}</h3>
            <p className="text-xs text-[var(--text-muted)]">{result.timestamp}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--border)] rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px]">
          {/* Image */}
          <div className="p-4 bg-[var(--bg-primary)] flex items-center justify-center min-h-[400px]">
            {result.has_annotated_image ? (
              <img
                src={getAnnotatedImageUrl(result.image_name)}
                alt={result.image_name}
                className="max-w-full max-h-[70vh] object-contain"
              />
            ) : (
              <p className="text-[var(--text-muted)]">No annotated image available</p>
            )}
          </div>

          {/* Details */}
          <div className="p-4 border-l border-[var(--border)]">
            <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
              Defects Found: {result.total_defects}
            </h4>

            {result.defects.length > 0 ? (
              <div className="space-y-2">
                {result.defects.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-primary)] text-sm"
                  >
                    <Badge label={d.class_name} color={DEFECT_COLORS[d.class_name] || "var(--accent)"} />
                    <span className="text-[var(--text-muted)] font-mono">
                      {(d.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--success)]">No defects detected — clean weld</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create `Dashboard.tsx`**

```tsx
import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import { Search, Filter, ShieldAlert, Bug, TrendingUp, Image as ImageIcon } from "lucide-react";
import { KpiCard, Card, Badge } from "./ui";
import { fetchHistory, getAnnotatedImageUrl, getExportCsvUrl } from "../lib/api";
import { ImageDetailModal } from "./ImageDetailModal";
import type { InspectionResult } from "../lib/types";
import { DEFECT_COLORS, DEFECT_CLASSES } from "../lib/types";

export function Dashboard({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<InspectionResult[]>([]);
  const [search, setSearch] = useState("");
  const [defectFilter, setDefectFilter] = useState("All");
  const [selectedResult, setSelectedResult] = useState<InspectionResult | null>(null);

  useEffect(() => {
    fetchHistory(search, defectFilter).then((res) => setItems(res.items));
  }, [search, defectFilter, refreshKey]);

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--text-muted)]">
        <ImageIcon size={48} className="mx-auto mb-4 opacity-40" />
        <p>No inspection data yet. Upload images and run an inspection to see analytics.</p>
      </div>
    );
  }

  // Aggregate stats
  const totalDefects = items.reduce((s, r) => s + r.total_defects, 0);
  const avgSeverity = totalDefects / items.length;

  // Defect distribution
  const defectMap: Record<string, number> = {};
  for (const r of items) {
    if (!r.defect_summary) continue;
    for (const chunk of r.defect_summary.split(", ")) {
      const name = chunk.split("(")[0].trim();
      const count = parseInt(chunk.match(/\((\d+)\)/)?.[1] || "1");
      if (name) defectMap[name] = (defectMap[name] || 0) + count;
    }
  }
  const barData = Object.entries(defectMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const pieData = barData.map((d) => ({ ...d, fill: DEFECT_COLORS[d.name] || "#8b8fa3" }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Analytics Dashboard</h2>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search image name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-56 pl-9 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <select
              value={defectFilter}
              onChange={(e) => setDefectFilter(e.target.value)}
              className="pl-9 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors appearance-none cursor-pointer"
            >
              <option value="All">All Defects</option>
              {Object.values(DEFECT_CLASSES).map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Inspected Images" value={items.length} icon={<ImageIcon size={20} />} color="var(--accent)" />
        <KpiCard title="Total Defects" value={totalDefects} icon={<Bug size={20} />} color="var(--danger)" />
        <KpiCard title="Avg Severity" value={avgSeverity.toFixed(1)} icon={<TrendingUp size={20} />} color="var(--warning)" />
        <KpiCard title="Defect Types" value={Object.keys(defectMap).length} icon={<ShieldAlert size={20} />} color="#a78bfa" />
      </div>

      {/* Charts */}
      {barData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
          <Card>
            <h3 className="text-sm text-[var(--text-secondary)] mb-4">Defect Type Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <XAxis dataKey="name" tick={{ fill: "#8b8fa3", fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fill: "#8b8fa3", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {barData.map((entry) => (
                    <Cell key={entry.name} fill={DEFECT_COLORS[entry.name] || "var(--accent)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 className="text-sm text-[var(--text-secondary)] mb-4">Proportion</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  innerRadius={50}
                  strokeWidth={0}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a1d27", border: "1px solid #2a2d3a", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* History table */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm text-[var(--text-secondary)]">Inspection History</h3>
          <a
            href={getExportCsvUrl(search, defectFilter)}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            Export CSV
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <th className="text-left py-2 pr-4 font-medium">Image</th>
                <th className="text-left py-2 pr-4 font-medium">Defects</th>
                <th className="text-left py-2 pr-4 font-medium">Count</th>
                <th className="text-left py-2 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-card-hover)] cursor-pointer transition-colors"
                  onClick={() => setSelectedResult(r)}
                >
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      {r.has_annotated_image && (
                        <img
                          src={getAnnotatedImageUrl(r.image_name)}
                          alt=""
                          className="w-8 h-8 rounded object-cover"
                        />
                      )}
                      <span className="truncate max-w-[200px]">{r.image_name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {r.defect_classes
                        ? r.defect_classes.split(", ").map((cls) => (
                            <Badge key={cls} label={cls} color={DEFECT_COLORS[cls] || "var(--accent)"} />
                          ))
                        : <span className="text-[var(--success)] text-xs">Clean</span>}
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 font-mono">{r.total_defects}</td>
                  <td className="py-2.5 text-[var(--text-muted)]">{r.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal */}
      {selectedResult && (
        <ImageDetailModal result={selectedResult} onClose={() => setSelectedResult(null)} />
      )}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add frontend/src/components/Dashboard.tsx frontend/src/components/ImageDetailModal.tsx
git commit -m "feat: add Dashboard with charts, history table, and image detail modal"
```

---

### Task 10: Frontend — App.tsx (Main Orchestrator)

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: Write App.tsx**

```tsx
import { useState } from "react";
import { Navbar } from "./components/Navbar";
import { UploadZone } from "./components/UploadZone";
import { ProcessingView } from "./components/ProcessingView";
import { BatchSummary } from "./components/BatchSummary";
import { Dashboard } from "./components/Dashboard";
import { inspectImages } from "./lib/api";
import type { InspectionResult, BatchSummary as BatchSummaryType, SSEEvent } from "./lib/types";

function App() {
  const [confidence, setConfidence] = useState(0.24);
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Processing state
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
            results: [],
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
    <div className="min-h-screen">
      <Navbar
        confidence={confidence}
        onConfidenceChange={setConfidence}
        onReset={handleReset}
      />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Upload section */}
        <section>
          <UploadZone
            files={files}
            onFilesChange={setFiles}
            onRun={handleRun}
            isProcessing={isProcessing}
          />
        </section>

        {/* Processing view — shown during inspection */}
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

        {/* Batch summary — shown after inspection */}
        {batchSummary && !isProcessing && (
          <section>
            <BatchSummary summary={batchSummary} results={batchResults} />
          </section>
        )}

        {/* Analytics dashboard — always shown */}
        <section>
          <hr className="border-[var(--border)] mb-8" />
          <Dashboard refreshKey={refreshKey} />
        </section>
      </main>
    </div>
  );
}

export default App;
```

**Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add App.tsx orchestrator connecting all components"
```

---

### Task 11: Dockerfile + Deployment Config

**Files:**
- Overwrite: `Dockerfile`
- Overwrite: `README.md` (frontmatter only)
- Delete: `app.py` (old Streamlit app)
- Delete: `.streamlit/config.toml`

**Step 1: Write multi-stage `Dockerfile`**

```dockerfile
# Stage 1: Build React frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime
FROM python:3.9-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY yolov8_M_\ model/ ./yolov8_M_\ model/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 8501
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8501"]
```

**Step 2: Keep `README.md` frontmatter compatible**

Ensure the frontmatter still has:
```yaml
---
title: Siemens Energy Welding Inspection AI
emoji: "\U0001F3ED"
colorFrom: blue
colorTo: gray
sdk: docker
app_port: 8501
pinned: false
---
```

**Step 3: Remove old Streamlit files**

```bash
rm app.py .streamlit/config.toml
rmdir .streamlit
```

**Step 4: Commit**

```bash
git add Dockerfile README.md
git rm app.py .streamlit/config.toml
git commit -m "feat: multi-stage Dockerfile, remove old Streamlit app"
```

---

### Task 12: Build, Test, Deploy

**Step 1: Build frontend**

```bash
cd frontend && npm run build
```

**Step 2: Install backend deps and start locally**

```bash
pip install fastapi uvicorn python-multipart
cd "C:/Users/catsi/Downloads/Siemens Energy-20260306T043217Z-3-001/Siemens Energy"
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8501
```

**Step 3: Verify in browser**

- Open http://localhost:8501 — React app loads
- Open http://localhost:8501/api/health — `{"status": "ok"}`
- Upload test images, click "Run Inspection", verify SSE progress and results
- Check analytics dashboard updates
- Test search/filter, image detail modal, CSV/ZIP download

**Step 4: Final commit and push**

```bash
git add -A
git commit -m "feat: complete React + FastAPI welding inspection dashboard"
git push origin master
git push hf master:main --force
```
