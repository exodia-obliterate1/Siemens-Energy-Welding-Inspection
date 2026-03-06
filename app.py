import os
import csv
import cv2
import numpy as np
import pandas as pd
from datetime import datetime
from collections import Counter
from ultralytics import YOLO
from PIL import Image
import streamlit as st
import matplotlib.pyplot as plt

# PATH & CONFIGURATION
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model", "weights", "best.pt")

OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
OUTPUT_IMG_DIR = os.path.join(OUTPUT_DIR, "defective_images")
CSV_PATH = os.path.join(OUTPUT_DIR, "results.csv")

os.makedirs(OUTPUT_IMG_DIR, exist_ok=True)

# Defect Mapping
CLASSES = {
    0: "Lump defect",
    1: "Spatter defect",
    2: "Pin hole defect",
    3: "Chips & Burr",
    4: "Undercut defect",
    5: "Welding protrusion",
}

COLORS = {
    0: (0, 140, 255),
    1: (255, 180, 90),
    2: (120, 200, 160),
    3: (180, 140, 200),
    4: (0, 230, 255),
    5: (90, 90, 255),
}


# CORE FUNCTIONS
@st.cache_resource
def load_model(path):
    if not os.path.exists(path):
        st.error(f"Model not found at: {path}")
        return None
    return YOLO(path)


def init_csv():
    if not os.path.exists(CSV_PATH):
        df = pd.DataFrame(
            columns=[
                "timestamp",
                "image_name",
                "defect_classes",
                "defect_summary",
                "total_defects",
            ]
        )
        df.to_csv(CSV_PATH, index=False)


# PAGE CONFIG
st.set_page_config(
    page_title="Siemens Energy - Welding Inspection",
    page_icon="https://assets.siemens-energy.com/siemens/assets/api/uuid:4248f0df-ff2e-4e0e-8b02-21e45832444a/width:1125/quality:high/siemens-energy-logo-dark.png",
    layout="wide",
)

# Custom CSS
st.markdown(
    """
    <style>
    .block-container {
        padding-top: 1.5rem;
    }
    [data-testid="stMetric"] {
        background: #f0f2f6;
        border-radius: 8px;
        padding: 12px 16px;
        border-left: 4px solid #009999;
    }
    [data-testid="stMetricValue"] {
        color: #009999;
    }
    .stProgress > div > div > div > div {
        background-color: #009999;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

init_csv()

# HEADER
st.title("Siemens Energy: Welding Inspection Portal")
st.caption("AI-powered weld defect detection using YOLOv8")

model = load_model(MODEL_PATH)

# SIDEBAR
with st.sidebar:
    st.header("Filter & Search")
    search_query = st.text_input("Search Image Name", placeholder="e.g. weld_01.jpg")
    filter_defect = st.selectbox(
        "Filter by Defect Type", ["All"] + list(CLASSES.values())
    )

    st.divider()
    st.header("Settings")
    conf_slider = st.slider("Confidence Threshold", 0.05, 1.0, 0.25, 0.01)

    st.divider()
    if st.button("Reset Inspection Logs", type="secondary"):
        if os.path.exists(CSV_PATH):
            try:
                os.remove(CSV_PATH)
                st.success("History cleared.")
            except PermissionError:
                st.error("Close results.csv in Excel before resetting!")
        init_csv()
        st.rerun()

# UPLOAD PORTAL
st.subheader("Upload Images")
uploaded_files = st.file_uploader(
    "Drag and drop welding images for inspection",
    type=["jpg", "jpeg", "png"],
    accept_multiple_files=True,
)

if uploaded_files and model:
    st.info(f"Processing {len(uploaded_files)} image(s)...")

    live_col_img, live_col_info = st.columns([2, 1])
    current_img_placeholder = live_col_img.empty()
    current_info_placeholder = live_col_info.empty()
    progress_bar = st.progress(0)

    for idx, file in enumerate(uploaded_files):
        file_bytes = np.asarray(bytearray(file.read()), dtype=np.uint8)
        img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

        if img is None:
            current_info_placeholder.warning(f"Could not read {file.name}, skipping.")
            progress_bar.progress((idx + 1) / len(uploaded_files))
            continue

        results = model(img, conf=conf_slider)[0]
        detected_labels = []

        if results.boxes is not None and len(results.boxes):
            for box in results.boxes:
                cls_id = int(box.cls[0])
                label = CLASSES.get(cls_id, "Unknown")
                detected_labels.append(label)

                x1, y1, x2, y2 = map(int, box.xyxy[0])
                color = COLORS.get(cls_id, (255, 255, 255))
                cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
                cv2.putText(
                    img, label, (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2,
                )

        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        current_img_placeholder.image(
            img_rgb,
            caption=f"Inspecting: {file.name}",
            use_container_width=True,
        )

        if detected_labels:
            counts = Counter(detected_labels)
            summary_text = ", ".join([f"{k}({v})" for k, v in counts.items()])
            cv2.imwrite(os.path.join(OUTPUT_IMG_DIR, file.name), img)

            new_row = [
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                file.name,
                ", ".join(counts.keys()),
                summary_text,
                sum(counts.values()),
            ]
            try:
                with open(CSV_PATH, "a", newline="") as f:
                    csv.writer(f).writerow(new_row)
            except PermissionError:
                st.error(
                    f"Could not save {file.name}. Close results.csv if open in another app."
                )

            current_info_placeholder.success(f"Defects: {summary_text}")
        else:
            current_info_placeholder.info(f"{file.name} — No defects detected.")

        progress_bar.progress((idx + 1) / len(uploaded_files))

    st.success("Batch inspection complete.")
elif uploaded_files and not model:
    st.error("Model failed to load. Check MODEL_PATH in app.py.")

# ANALYTICS DASHBOARD
st.divider()
st.subheader("Inspection Analytics")

if os.path.exists(CSV_PATH):
    df = pd.read_csv(CSV_PATH)
    if df.empty:
        st.info(
            "No inspection data yet. Upload images above to start."
        )
    else:
        filtered_df = df.copy()
        if search_query:
            filtered_df = filtered_df[
                filtered_df["image_name"].str.contains(search_query, case=False, na=False)
            ]
        if filter_defect != "All":
            filtered_df = filtered_df[
                filtered_df["defect_classes"].str.contains(filter_defect, case=False, na=False)
            ]

        if not filtered_df.empty:
            m1, m2, m3 = st.columns(3)
            m1.metric("Defective Images", len(filtered_df))
            m2.metric("Total Defects", int(filtered_df["total_defects"].sum()))
            m3.metric("Avg Defects / Image", f"{filtered_df['total_defects'].mean():.1f}")

            # Defect distribution
            st.subheader("Defect Distribution")
            all_labels = []
            for s in filtered_df["defect_summary"].dropna():
                for item in s.split(","):
                    name = item.split("(")[0].strip()
                    if name:
                        all_labels.append(name)

            if all_labels:
                counts = pd.Series(all_labels).value_counts()
                col_chart, col_pie = st.columns([2, 1])
                col_chart.bar_chart(counts)

                fig, ax = plt.subplots(figsize=(4, 4))
                ax.pie(counts, labels=counts.index, autopct="%1.1f%%", startangle=90)
                ax.set_title("")
                col_pie.pyplot(fig)
                plt.close(fig)

            # Inspection history
            st.divider()
            st.subheader("Inspection History")
            image_names = filtered_df["image_name"].unique()
            selected_img = st.selectbox("Select image:", image_names)

            if selected_img:
                img_path = os.path.join(OUTPUT_IMG_DIR, selected_img)
                if os.path.exists(img_path):
                    c1, c2 = st.columns([2, 1])
                    c1.image(img_path, use_container_width=True)
                    c2.dataframe(
                        filtered_df[filtered_df["image_name"] == selected_img],
                        use_container_width=True,
                        hide_index=True,
                    )

            st.download_button(
                "Download Report (CSV)",
                filtered_df.to_csv(index=False),
                "welding_report.csv",
                "text/csv",
            )
        else:
            st.warning("No records match the current filter.")
else:
    st.info("No inspection data yet. Upload images above to start.")
