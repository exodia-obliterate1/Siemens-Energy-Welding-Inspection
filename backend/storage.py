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
