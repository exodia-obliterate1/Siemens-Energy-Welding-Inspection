from ultralytics import YOLO
import cv2
import os

# Update these paths before running
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
model_path = os.path.join(BASE_DIR, "model", "weights", "best.pt")
image_path = "path/to/test_image.jpg"  # Path to a test image

model = YOLO(model_path)
results = model(image_path, conf=0.25)

for r in results:
    annotated_frame = r.plot()
    cv2.imshow("YOLO Prediction", annotated_frame)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

results[0].save(filename="output.jpg")
print("Saved annotated result to output.jpg")
