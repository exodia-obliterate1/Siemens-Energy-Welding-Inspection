from ultralytics import YOLO
import os

# SETTINGS — Update these paths before running
dataset_yaml = "path/to/data.yaml"  # Path to your YOLO-format dataset YAML
device = "cpu"  # Use "cuda" for NVIDIA GPU, "mps" for Apple Silicon, "cpu" otherwise

model = YOLO("yolov8m.pt")  # YOLOv8 Medium pretrained model

img_size = 640
batch_size = 8
epochs = 50
learning_rate = 0.0005
project_name = "runs/train"
run_name = "welding_yolov8m_frozen"

print("Training YOLOv8m with frozen backbone layers 0-7")

model.train(
    data=dataset_yaml,
    device=device,
    imgsz=img_size,
    batch=batch_size,
    epochs=epochs,
    lr0=learning_rate,
    freeze=[0, 1, 2, 3, 4, 5, 6, 7],
    patience=15,
    mosaic=0.5,
    mixup=0.1,
    hsv_h=0.015,
    hsv_s=0.6,
    hsv_v=0.4,
    degrees=5,
    translate=0.05,
    scale=0.5,
    fliplr=0.5,
    project=project_name,
    name=run_name,
    save=True,
    verbose=True,
)

best_weights = os.path.join(project_name, run_name, "weights", "best.pt")
print(f"Best weights saved at: {best_weights}")
