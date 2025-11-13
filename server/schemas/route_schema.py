from pydantic import BaseModel
from typing import List, Optional

# ==== Schemas ====
class StopCreate(BaseModel):
    name: str
    lat: float
    lng: float


class DirectionCreate(BaseModel):
    sub_name: Optional[str] = None
    direction: str
    gpx: Optional[str] = None
    stops: List[StopCreate]


class RouteCreate(BaseModel):
    name: str
    directions: List[DirectionCreate]


class StopOut(StopCreate):
    id: int

    class Config:
        orm_mode = True


class DirectionOut(BaseModel):
    id: int
    sub_name: Optional[str]
    direction: str
    gpx: Optional[str]
    stops: List[StopOut]

    class Config:
        orm_mode = True


class RouteOut(BaseModel):
    id: int
    name: str
    directions: List[DirectionOut]

    class Config:
        orm_mode = True
