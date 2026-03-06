# Stage 1: Build React frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime
FROM python:3.9-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY ["yolov8_M_ model/", "./yolov8_M_ model/"]
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 8501
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8501"]
