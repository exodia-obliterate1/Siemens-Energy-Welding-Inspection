---
title: Siemens Energy Welding Inspection AI
emoji: "\U0001F3ED"
colorFrom: blue
colorTo: gray
sdk: docker
app_port: 8501
pinned: false
---

# Siemens Energy: Welding Inspection Portal

AI-powered welding defect detection system using YOLOv8m. Upload weld images for automated inspection and analytics.

## Detected Defect Classes

| ID | Defect Type |
|----|-------------|
| 0  | Lump defect |
| 1  | Spatter defect |
| 2  | Pin hole defect |
| 3  | Chips & Burr |
| 4  | Undercut defect |
| 5  | Welding protrusion |

## Features

- **Live inference** on uploaded weld images with bounding box annotations
- **Batch processing** with summary statistics, charts, and ZIP download of annotated images
- **Analytics dashboard** with KPI metrics, defect distribution charts, and image history viewer
- **Configurable sensitivity** via confidence threshold slider
- **Search and filter** inspection history by image name or defect type

## Running Locally

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Model

YOLOv8m (medium) fine-tuned on welding defect data. Backbone layers 0-7 frozen, trained for 50 epochs at image size 640. This is a demo model (mAP50 ~16%) — retrain on a larger dataset for production use.
