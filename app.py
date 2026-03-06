import io
import os
import re
import csv
import zipfile
import cv2
import numpy as np
import pandas as pd
from datetime import datetime
from collections import Counter
from PIL import Image
import streamlit as st
import matplotlib.pyplot as plt

# ── ENVIRONMENT DETECTION ──────────────────────────────────────────────────────
IS_HF_SPACE = os.environ.get("SPACE_ID") is not None
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "yolov8_M_ model", "weights", "best.pt")

if IS_HF_SPACE:
    OUTPUT_DIR = "/tmp/outputs"
else:
    OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")

OUTPUT_IMG_DIR = os.path.join(OUTPUT_DIR, "defective_images")
CSV_PATH = os.path.join(OUTPUT_DIR, "results.csv")
os.makedirs(OUTPUT_IMG_DIR, exist_ok=True)

MAX_FILE_SIZE_MB = 10

# ── DEFECT MAPPING ─────────────────────────────────────────────────────────────
CLASSES = {
    0: "Lump defect", 1: "Spatter defect", 2: "Pin hole defect",
    3: "Chips & Burr", 4: "Undercut defect", 5: "Welding protrusion",
}
COLORS = {
    0: (0, 140, 255), 1: (255, 180, 90), 2: (120, 200, 160),
    3: (180, 140, 200), 4: (0, 230, 255), 5: (90, 90, 255),
}


# ── HELPERS ────────────────────────────────────────────────────────────────────
def sanitize_filename(name: str) -> str:
    """Remove path separators and dangerous characters from a filename."""
    name = os.path.basename(name)
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)
    return name or "unnamed"


def _init_session_state():
    if "inspection_log" not in st.session_state:
        if not IS_HF_SPACE and os.path.exists(CSV_PATH) and os.path.getsize(CSV_PATH) > 60:
            try:
                st.session_state.inspection_log = pd.read_csv(CSV_PATH)
            except Exception:
                st.session_state.inspection_log = pd.DataFrame(
                    columns=["timestamp", "image_name", "defect_classes", "defect_summary", "total_defects"]
                )
        else:
            st.session_state.inspection_log = pd.DataFrame(
                columns=["timestamp", "image_name", "defect_classes", "defect_summary", "total_defects"]
            )
    if "processing_done" not in st.session_state:
        st.session_state.processing_done = False
    if "batch_results" not in st.session_state:
        st.session_state.batch_results = []
    if "skipped_files" not in st.session_state:
        st.session_state.skipped_files = []


def _persist_csv():
    """Write session state log to CSV (local mode only)."""
    if not IS_HF_SPACE:
        try:
            st.session_state.inspection_log.to_csv(CSV_PATH, index=False)
        except PermissionError:
            st.warning("Could not save CSV — close results.csv if it is open in another app.")


def _append_log_row(row: dict):
    new_row = pd.DataFrame([row])
    st.session_state.inspection_log = pd.concat(
        [st.session_state.inspection_log, new_row], ignore_index=True
    )


@st.cache_resource
def load_model(path):
    if not os.path.exists(path):
        st.error(f"Model not found at: {path}")
        return None
    try:
        from ultralytics import YOLO
        return YOLO(path)
    except Exception as e:
        st.error(f"Failed to load model: {e}")
        return None


def validate_image(file) -> tuple:
    """Returns (is_valid, error_message, image_array)."""
    size_mb = file.size / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        return False, f"File too large ({size_mb:.1f} MB > {MAX_FILE_SIZE_MB} MB limit)", None
    try:
        file.seek(0)
        file_bytes = np.asarray(bytearray(file.read()), dtype=np.uint8)
        img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        if img is None:
            return False, "Could not decode image (corrupt or unsupported format)", None
        return True, "", img
    except Exception as e:
        return False, f"Error reading image: {e}", None


# ── HELP SECTION ───────────────────────────────────────────────────────────────
def render_help_section():
    with st.expander("Need help? Click here for guidance", expanded=False):
        tab1, tab2, tab3, tab4 = st.tabs(["How to Use", "About the Model", "Understanding Results", "Tips"])

        with tab1:
            st.markdown("""
**Getting Started:**
1. Adjust the **AI Sensitivity** slider in the sidebar (lower = more detections, higher = stricter).
2. Drag and drop one or more weld images into the **Live Image Portal** below.
3. Click **Run Inspection** to start processing.
4. The AI will process each image and annotate any defects it finds.
5. Review results in the **Analytics Dashboard** that appears after processing.

**Batch Processing:**
- Upload multiple images at once for bulk inspection.
- After processing, you'll see a summary with counts, charts, and download options.
""")

        with tab2:
            st.markdown("""
**Model:** YOLOv8m (medium) — a real-time object detection model.

**Training Details:**
- Backbone layers 0-7 were frozen during fine-tuning.
- Image size: 640px, Batch size: 8, Epochs: 50
- Learning rate: 0.0005 with early stopping (patience=15)

**Performance Note:**
This is a demo model (mAP50 ~16%). It demonstrates the detection pipeline
but should be retrained on a larger, more diverse dataset for production use.

**Detected Defect Classes:**
| ID | Defect Type |
|----|-------------|
| 0  | Lump defect |
| 1  | Spatter defect |
| 2  | Pin hole defect |
| 3  | Chips & Burr |
| 4  | Undercut defect |
| 5  | Welding protrusion |
""")

        with tab3:
            st.markdown("""
**Bounding Boxes:** Colored rectangles drawn around detected defects. Each color corresponds to a different defect type.

**Confidence Score:** Shown in the AI Sensitivity slider. A detection is only reported if the model's confidence exceeds this threshold.

**Defect Summary:** Shows the count of each defect type found in an image, e.g. `Lump defect(2), Spatter defect(1)`.

**Analytics Dashboard:** After processing, view:
- **KPI metrics** — total defective images, total defects, average severity
- **Distribution charts** — bar and pie charts of defect types
- **Image history** — select any processed image to review its annotated result
""")

        with tab4:
            st.markdown("""
**For Best Results:**
- Use well-lit, high-resolution images of weld seams.
- Crop images to focus on the weld area when possible.
- Start with a lower confidence threshold (0.15-0.25) and increase if you get too many false positives.
- Supported formats: JPG, JPEG, PNG, WebP.
- Maximum file size: 10 MB per image.

**Troubleshooting:**
- If no defects are detected, try lowering the AI Sensitivity slider.
- If too many false positives appear, raise the slider.
- Blurry or poorly lit images will reduce detection accuracy.
""")


# ── BATCH SUMMARY ─────────────────────────────────────────────────────────────
def render_batch_summary(batch_results: list, skipped_files: list):
    """Render summary after batch processing."""
    st.divider()
    st.subheader("Batch Processing Summary")

    total = len(batch_results) + len(skipped_files)
    defective = sum(1 for r in batch_results if r["total_defects"] > 0)
    clean = sum(1 for r in batch_results if r["total_defects"] == 0)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Processed", len(batch_results))
    c2.metric("Defective", defective)
    c3.metric("Clean", clean)
    c4.metric("Skipped", len(skipped_files))

    # Defect breakdown
    all_defects = []
    for r in batch_results:
        if r["defect_classes"]:
            all_defects.extend(r["defect_classes"].split(", "))

    if all_defects:
        defect_counts = pd.Series(all_defects).value_counts()
        col_table, col_chart = st.columns([1, 2])
        with col_table:
            st.markdown("**Defect Breakdown**")
            st.dataframe(defect_counts.reset_index().rename(columns={"index": "Defect Type", "count": "Count"}),
                         hide_index=True)
        with col_chart:
            fig, ax = plt.subplots(figsize=(5, 3))
            defect_counts.plot(kind="barh", ax=ax, color="#4A90D9")
            ax.set_xlabel("Count")
            ax.set_title("Defects Found in This Batch")
            plt.tight_layout()
            st.pyplot(fig)
            plt.close(fig)

    # Download annotated images as ZIP
    annotated_images = [r for r in batch_results if r.get("annotated_path")]
    if annotated_images:
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for r in annotated_images:
                path = r["annotated_path"]
                if os.path.exists(path):
                    zf.write(path, os.path.basename(path))
        zip_buffer.seek(0)

        dl1, dl2 = st.columns(2)
        dl1.download_button(
            "Download Annotated Images (ZIP)",
            zip_buffer.getvalue(),
            "annotated_images.zip",
            "application/zip",
        )

        # Download batch CSV
        batch_df = pd.DataFrame(batch_results).drop(columns=["annotated_path"], errors="ignore")
        dl2.download_button(
            "Download Batch Report (CSV)",
            batch_df.to_csv(index=False),
            "batch_report.csv",
            "text/csv",
        )

    # Skipped files report
    if skipped_files:
        with st.expander(f"Skipped Files ({len(skipped_files)})", expanded=False):
            for sf in skipped_files:
                st.warning(f"**{sf['name']}** — {sf['reason']}")


# ══════════════════════════════════════════════════════════════════════════════
# STREAMLIT APP
# ══════════════════════════════════════════════════════════════════════════════
st.set_page_config(page_title="Siemens Energy Welding AI", layout="wide")

# Inject CSS to stabilize layout and prevent jitter
st.markdown("""
<style>
    /* Prevent iframe/element resize jitter */
    .stImage, .stPlotlyChart, .stPyplot {
        min-height: 50px;
    }
    /* Stabilize metric cards */
    [data-testid="stMetric"] {
        min-height: 80px;
    }
    /* Stabilize columns during processing */
    [data-testid="stHorizontalBlock"] {
        min-height: 0;
        align-items: flex-start;
    }
    /* Prevent progress bar from causing reflow */
    .stProgress {
        min-height: 30px;
    }
    /* Keep the main content area stable */
    [data-testid="stMainBlockContainer"] {
        overflow-anchor: auto;
    }
</style>
""", unsafe_allow_html=True)

_init_session_state()

st.title("Siemens Energy: Welding Inspection Portal")

# ── SIDEBAR ────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.header("Filter & Search")
    search_query = st.text_input(
        "Search Image Name",
        placeholder="e.g. weld_01.jpg",
        help="Filter the analytics dashboard by image filename. Supports partial matches.",
    )
    filter_defect = st.selectbox(
        "Filter by Defect Type",
        ["All"] + list(CLASSES.values()),
        help="Show only images that contain the selected defect type.",
    )

    st.divider()
    st.header("Settings")
    conf_slider = st.slider(
        "AI Sensitivity (Confidence)",
        0.05, 1.0, 0.24,
        help="Lower values detect more defects (but may include false positives). "
             "Higher values are stricter (fewer false positives, but may miss real defects).",
    )

    if st.button("Reset Inspection Logs"):
        st.session_state.inspection_log = pd.DataFrame(
            columns=["timestamp", "image_name", "defect_classes", "defect_summary", "total_defects"]
        )
        st.session_state.processing_done = False
        st.session_state.batch_results = []
        st.session_state.skipped_files = []
        if not IS_HF_SPACE and os.path.exists(CSV_PATH):
            try:
                os.remove(CSV_PATH)
            except PermissionError:
                st.error("Close results.csv in Excel before resetting!")
        st.success("History cleared.")
        st.rerun()

model = load_model(MODEL_PATH)

# ── HELP SECTION ───────────────────────────────────────────────────────────────
render_help_section()

# ── LIVE IMAGE PORTAL ──────────────────────────────────────────────────────────
st.subheader("Live Image Portal")
uploaded_files = st.file_uploader(
    "Drag and drop your images here",
    type=["jpg", "jpeg", "png", "webp"],
    accept_multiple_files=True,
    help="Upload one or more weld images for AI inspection. Supported: JPG, PNG, WebP. Max 10 MB each.",
)

# Show staged file count and Run button (don't auto-process)
if uploaded_files and model:
    st.caption(f"{len(uploaded_files)} image(s) staged for inspection.")
    run_clicked = st.button(
        "Run Inspection",
        type="primary",
        use_container_width=True,
    )

    if run_clicked:
        # Create a fixed-size container for the processing view to prevent jitter
        processing_container = st.container()
        with processing_container:
            progress_bar = st.progress(0, text="Starting inspection...")
            live_col_img, live_col_info = st.columns([2, 1])
            img_slot = live_col_img.empty()
            info_slot = live_col_info.empty()

        batch_results = []
        skipped_files = []

        for idx, file in enumerate(uploaded_files):
            safe_name = sanitize_filename(file.name)

            # Validate image
            is_valid, error_msg, img = validate_image(file)
            if not is_valid:
                skipped_files.append({"name": file.name, "reason": error_msg})
                progress_bar.progress(
                    (idx + 1) / len(uploaded_files),
                    text=f"Skipped: {file.name} ({error_msg})"
                )
                continue

            # YOLO inference
            results = model(img, conf=conf_slider)[0]
            detected_labels = []

            if results.boxes:
                for box in results.boxes:
                    cls_id = int(box.cls[0])
                    label = CLASSES.get(cls_id, "Unknown")
                    detected_labels.append(label)

                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    color = COLORS.get(cls_id, (255, 255, 255))
                    cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
                    cv2.putText(img, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

            # Live preview — update placeholders in-place (no layout shift)
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            img_slot.image(img_rgb, caption=f"Inspecting: {safe_name}", use_container_width=True)

            annotated_path = ""
            if detected_labels:
                counts = Counter(detected_labels)
                summary_text = ", ".join([f"{k}({v})" for k, v in counts.items()])
                annotated_path = os.path.join(OUTPUT_IMG_DIR, safe_name)
                cv2.imwrite(annotated_path, img)

                row = {
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "image_name": safe_name,
                    "defect_classes": ", ".join(counts.keys()),
                    "defect_summary": summary_text,
                    "total_defects": sum(counts.values()),
                }
                _append_log_row(row)
                info_slot.success(f"Defects Found: {summary_text}")
            else:
                counts = Counter()
                summary_text = ""
                info_slot.info(f"Unit {safe_name} is clean.")

            batch_results.append({
                "image_name": safe_name,
                "defect_classes": ", ".join(counts.keys()) if counts else "",
                "defect_summary": summary_text,
                "total_defects": sum(counts.values()) if counts else 0,
                "annotated_path": annotated_path,
            })

            progress_bar.progress(
                (idx + 1) / len(uploaded_files),
                text=f"Processing {idx + 1}/{len(uploaded_files)}: {safe_name}"
            )

        _persist_csv()
        progress_bar.progress(1.0, text="Inspection complete!")

        # Store results in session state so they persist across reruns
        st.session_state.processing_done = True
        st.session_state.batch_results = batch_results
        st.session_state.skipped_files = skipped_files

elif uploaded_files and not model:
    st.error("Cannot process images — model failed to load. Check the model path.")

# Show batch summary from session state (persists without jitter on rerun)
if st.session_state.processing_done and st.session_state.batch_results:
    render_batch_summary(st.session_state.batch_results, st.session_state.skipped_files)

# ── ANALYTICS DASHBOARD ────────────────────────────────────────────────────────
st.divider()
st.subheader("Inspection Analytics Dashboard")

df = st.session_state.inspection_log

if not df.empty:
    filtered_df = df.copy()

    if search_query:
        escaped = re.escape(search_query)
        filtered_df = filtered_df[
            filtered_df["image_name"].str.contains(escaped, case=False, na=False)
        ]
    if filter_defect != "All":
        escaped = re.escape(filter_defect)
        filtered_df = filtered_df[
            filtered_df["defect_classes"].str.contains(escaped, case=False, na=False)
        ]

    if not filtered_df.empty:
        # KPI row
        m1, m2, m3 = st.columns(3)
        m1.metric("Defective Images", len(filtered_df))
        m2.metric("Total Defects Found", int(filtered_df["total_defects"].sum()))
        m3.metric("Avg Severity", f"{filtered_df['total_defects'].mean():.1f}")

        # Defect distribution charts
        st.subheader("Defect Type Distribution")
        all_labels = []
        for s in filtered_df["defect_summary"].dropna():
            for item in str(s).split(","):
                label = item.split("(")[0].strip()
                if label:
                    all_labels.append(label)

        if all_labels:
            label_counts = pd.Series(all_labels).value_counts()
            col_chart, col_pie = st.columns([2, 1])
            col_chart.bar_chart(label_counts)

            fig, ax = plt.subplots(figsize=(4, 4))
            ax.pie(label_counts, labels=label_counts.index, autopct="%1.1f%%", startangle=90)
            col_pie.pyplot(fig)
            plt.close(fig)

        # Image history viewer
        st.divider()
        st.subheader("Detailed Visual Inspection")
        selected_img = st.selectbox("Select Image from History:", filtered_df["image_name"].unique())

        if selected_img:
            img_path = os.path.join(OUTPUT_IMG_DIR, selected_img)
            if os.path.exists(img_path):
                c1, c2 = st.columns([2, 1])
                c1.image(img_path, use_container_width=True)
                c2.table(filtered_df[filtered_df["image_name"] == selected_img])

        st.download_button(
            "Download Full Report (CSV)",
            filtered_df.to_csv(index=False),
            "welding_report.csv",
            "text/csv",
        )
    else:
        st.warning("No records found for the current search/filter.")
else:
    st.info("Welcome! Drag and drop images into the portal above to generate your inspection dashboard.")
