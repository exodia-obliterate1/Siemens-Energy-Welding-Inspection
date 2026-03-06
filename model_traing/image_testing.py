from ultralytics import YOLO
import cv2

# Load trained model
model = YOLO("--------")   # path to your trained weights

# Path to test image
image_path = '--------'      #image path

# Run inference
results = model(image_path, conf=0.25)

# Show result
for r in results:
    annotated_frame = r.plot()
    cv2.imshow("YOLO Prediction", annotated_frame)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

# Save output image
results[0].save(filename="output.jpg")