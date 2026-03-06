from __future__ import annotations

from pydantic import BaseModel


class DefectBox(BaseModel):
    class_id: int
    class_name: str
    confidence: float
    x1: int
    y1: int
    x2: int
    y2: int


class InspectionResult(BaseModel):
    id: str
    image_name: str
    timestamp: str
    defects: list[DefectBox]
    defect_classes: str
    defect_summary: str
    total_defects: int
    has_annotated_image: bool


class BatchSummary(BaseModel):
    total: int
    defective: int
    clean: int
    skipped: int
    results: list[InspectionResult]
    skipped_files: list[dict]


class HistoryResponse(BaseModel):
    items: list[InspectionResult]
    total: int
