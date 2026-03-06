# Design: React + FastAPI Welding Inspection Dashboard

**Date:** 2026-03-06
**Status:** Approved

## Context

The Streamlit-based app has fundamental UX limitations: auto-processing on upload breaks batch workflows, page re-renders cause dashboard jitter, and styling control is too limited for a professional industrial dashboard. Rewriting with React + FastAPI gives full UI control while keeping single-container HuggingFace Spaces deployment.

## Architecture

Single Docker container serving both frontend and backend on port 8501.

- **FastAPI** serves the React production build as static files at `/`
- **API routes** under `/api/` handle inference, history, exports
- **SSE (Server-Sent Events)** stream real-time processing progress to the frontend
- **HF Spaces** deployment unchanged: `sdk: docker`, `app_port: 8501`

```
Docker Container (port 8501)
├── FastAPI
│   ├── /api/inspect      POST  — batch upload + inference
│   ├── /api/history      GET   — paginated, filterable history
│   ├── /api/history/{id}/image  GET — annotated image
│   ├── /api/export/csv   GET   — CSV download
│   ├── /api/export/zip   GET   — ZIP download
│   ├── /api/history      DELETE — clear logs
│   └── /api/health       GET   — health check
└── Static files (React build) served at /
```

## Project Structure

```
├── backend/
│   ├── main.py           # FastAPI app, static serving, CORS
│   ├── inference.py      # YOLO model loading + inference
│   ├── models.py         # Pydantic schemas
│   └── storage.py        # In-memory store + optional CSV persistence
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Navbar.tsx
│   │   │   ├── UploadZone.tsx
│   │   │   ├── ProcessingView.tsx
│   │   │   ├── BatchSummary.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ImageDetailModal.tsx
│   │   │   ├── HelpPanel.tsx
│   │   │   └── ui/          # Card, Badge, Chart, ProgressBar
│   │   ├── hooks/
│   │   │   └── useInspection.ts
│   │   ├── styles/
│   │   │   └── globals.css
│   │   └── lib/
│   │       └── api.ts
│   └── package.json
├── yolov8_M_ model/        # Unchanged
├── model_traing/            # Unchanged
├── Dockerfile               # Multi-stage: Node build + Python runtime
├── requirements.txt
└── README.md
```

## Visual Design — "Industrial Clarity"

Hybrid style: dark industrial theme + clean modern layout + vibrant data visualizations.

- **Background:** Dark charcoal `#0f1117` with subtle noise texture
- **Cards:** `#1a1d27` with 1px border `#2a2d3a`, subtle shadow, rounded-lg
- **Primary accent:** Siemens teal `#00b4aa` (buttons, active states, chart highlights)
- **Secondary accent:** Warm amber `#f59e0b` (warnings, defect counts)
- **Text:** White `#f0f0f0` primary, muted gray `#8b8fa3` secondary
- **Charts:** Gradient teal-to-cyan fills via Recharts
- **Transitions:** 200ms ease on all interactive elements, fade-in on cards
- **Typography:** Inter font

## Page Sections (single page, top-to-bottom)

1. **Navbar** — Logo, title, help `?` button, settings gear dropdown (confidence slider, reset)
2. **Upload Zone** — Drag-and-drop with file preview list, confidence slider, "Run Inspection" button
3. **Processing View** — Live image with annotation overlay, real-time stats counter, progress bar (SSE-driven)
4. **Batch Summary** — KPI cards (total/defective/clean/skipped), defect breakdown chart + table, download buttons
5. **Analytics Dashboard** — Search + filter controls, KPI cards, bar + pie charts, history table with thumbnails
6. **Image Detail Modal** — Full-size annotated image + defect table with confidence scores
7. **Help Panel** — Slide-out from right, triggered by navbar `?` button

## Frontend Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- Recharts (charts)
- Lucide React (icons)
- React Dropzone (file upload)
- No state management library — useState + custom hooks

## Key UX Decisions

- **Explicit "Run Inspection" button** — files staged with previews, nothing processes until clicked
- **SSE for progress** — no page reloads, no jitter, real-time updates
- **Modal for image detail** — click history row to inspect, keeps context
- **Client-side filtering** — instant search/filter on history data
- **Settings in navbar dropdown** — no sidebar, cleaner layout

## Dockerfile (Multi-stage)

```
Stage 1: node:18-alpine — npm install, npm run build
Stage 2: python:3.9-slim — system libs, pip install, copy React build + backend + model
CMD: uvicorn backend.main:app --host 0.0.0.0 --port 8501
```

## Environment Detection

Same pattern as before: `IS_HF_SPACE = os.environ.get("SPACE_ID") is not None`
- HF Spaces: `/tmp` for output images, in-memory only storage
- Local: `outputs/` directory, CSV persistence
