# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Welding defect detection system for Siemens Energy using YOLOv8 (medium) object detection. Detects 6 defect classes in welding images via a Streamlit dashboard.

**Defect classes:** Lump (0), Spatter (1), Pin hole (2), Chips & Burr (3), Undercut (4), Welding protrusion (5)

## Architecture

- **`app.py`** — Streamlit app. Image upload, YOLO inference, bounding box drawing, CSV logging, analytics dashboard with filtering/charts/history.
- **`model_training/train.py`** — YOLOv8m training. Frozen backbone (layers 0-7), early stopping (patience=15), controlled augmentation. 50 epochs, lr=0.0005, batch 8, 640px.
- **`model_training/test.py`** — Standalone inference for testing on individual images.
- **`model/`** — Trained model artifacts: `weights/best.pt`, training curves, confusion matrices, `args.yaml`, `results.csv`.

## Commands

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Key Configuration

- `MODEL_PATH` in `app.py` points to `model/weights/best.pt`.
- Outputs: `outputs/defective_images/` (annotated images), `outputs/results.csv` (results log).
- Default confidence: 0.25 (adjustable via sidebar).
- Training script requires updating `dataset_yaml` and `device` paths before use.

## Dependencies

`ultralytics`, `streamlit`, `opencv-python-headless`, `numpy`, `pandas`, `matplotlib`, `Pillow`
