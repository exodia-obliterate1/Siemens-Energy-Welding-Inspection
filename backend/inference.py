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
