from ultralytics import YOLO
import os

# SETTINGS
dataset_yaml = "/Users/surya/Desktop/Siemens Energy/welding YAML File/data.yaml"
device='mps'
model_size = YOLO("yolov8m.pt")     # Medium model 
img_size = 640                
batch_size = 8               
epochs = 50                   
learning_rate = 0.0005        
project_name = "runs/train"
run_name_phase1 = "ppe_yolov8_phase1_frozen"

# CREATE MODEL 
print("Phase 1: Training YOLOv8 with frozen backbone (industry-safe)")

model = YOLO(model_size)

# TRAIN MODEL
model.train(
    data=dataset_yaml,
    imgsz=img_size,
    batch=batch_size,
    epochs=epochs,
    lr0=learning_rate,

    # FREEZE BACKBONE (LOW DATA PROTECTION)
    freeze=[0,1,2,3,4,5,6,7],

    # EARLY STOPPING
    patience=15,

    # CONTROLLED DATA AUGMENTATION
    mosaic=0.5,        
    mixup=0.1,         
    hsv_h=0.015,       
    hsv_s=0.6,
    hsv_v=0.4,
    degrees=5,        
    translate=0.05,
    scale=0.5,
    fliplr=0.5,

    # PROJECT SETTINGS
    project=project_name,
    name=run_name_phase1,
    save=True,
    verbose=True
)

# BEST WEIGHTS PATH
best_weights_phase1 = os.path.join(
    project_name,
    run_name_phase1,
    "weights",
    "best.pt"
)
print(f"Best weights saved at: {best_weights_phase1}")
