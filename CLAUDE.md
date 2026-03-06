# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Welding defect detection system for Siemens Energy using YOLOv8 (medium variant) and a Streamlit web dashboard. The system detects 6 classes of welding defects from uploaded images and provides analytics.

## Architecture

- **`app.py`** — Streamlit application (main entry point). Handles image upload, live YOLO inference, CSV logging, and an analytics dashboard with filtering, KPI metrics, charts, and image history viewer.
- **`model_traing/model_traing.py`** — YOLOv8m training script with frozen backbone (layers 0-7), early stopping (patience=15), and controlled augmentation. Originally trained on macOS with MPS device.
- **`model_traing/image_testing.py`** — Standalone single-image inference script for quick model testing.
- **`yolov8_M_ model/`** — Training artifacts: best weights (`weights/best.pt`), training curves, confusion matrices, and `args.yaml` with full training config.
- **`outputs/`** — Runtime directory created by app.py containing `defective_images/` (annotated images) and `results.csv` (inspection log).

## Running the App

```bash
streamlit run app.py
```

**Important:** Before running, update `MODEL_PATH` in `app.py` (line 16) to point to the actual model weights file (e.g., `yolov8_M_ model/weights/best.pt`). The placeholder is `"-------"`.

## Defect Classes

| ID | Class |
|----|-------|
| 0 | Lump defect |
| 1 | Spatter defect |
| 2 | Pin hole defect |
| 3 | Chips & Burr |
| 4 | Undercut defect |
| 5 | Welding protrusion |

## Key Dependencies

- `ultralytics` (YOLO)
- `streamlit`
- `opencv-python` (`cv2`)
- `pandas`, `numpy`, `matplotlib`, `Pillow`

## Training Configuration

- Model: YOLOv8m (medium) with frozen backbone layers 0-7
- Image size: 640, Batch: 8, Epochs: 50, LR: 0.0005
- Dataset YAML was at a hardcoded macOS path — must be updated for local use
- Training outputs saved to `runs/train/`

## Conventions

- Defect class mapping (`CLASSES` dict) and color mapping (`COLORS` dict) are defined at the top of `app.py` — keep these in sync with the training data.
- CSV schema: `timestamp, image_name, defect_classes, defect_summary, total_defects`
- The `model_traing/` directory name has a typo ("traing" instead of "training") — this is the existing convention.
