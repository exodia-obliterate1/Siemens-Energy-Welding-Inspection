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
FRONTEND_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist"
)
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
