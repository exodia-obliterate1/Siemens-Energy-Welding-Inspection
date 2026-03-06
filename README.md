---
title: Siemens Energy Welding Inspection
emoji: 🏭
colorFrom: blue
colorTo: green
sdk: docker
app_port: 8501
pinned: false
license: mit
---

# Siemens Energy: Welding Inspection Portal

AI-powered welding defect detection using YOLOv8. Upload welding images to automatically detect and classify 6 types of defects:

- **Lump defect** — Excess material buildup
- **Spatter defect** — Metal droplet splashes
- **Pin hole defect** — Small holes in the weld
- **Chips & Burr** — Rough edges and fragments
- **Undercut defect** — Groove along the weld toe
- **Welding protrusion** — Excess weld metal protruding

## Features

- Batch image upload and live inference
- Adjustable confidence threshold
- Analytics dashboard with defect distribution charts
- Inspection history with image viewer
- CSV report export

## Local Setup

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Model

YOLOv8 Medium trained on welding defect dataset with frozen backbone (layers 0-7), early stopping, and controlled augmentation. See `model_training/` for training scripts.
