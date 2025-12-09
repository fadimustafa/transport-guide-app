from pydantic import BaseModel
from typing import List, Optional


# ====== Input Schemas ======
class create_stops(BaseModel):
    id: int
    name: str
    lat: float
    lng: float

class StopUpdate(BaseModel):
    id: int
    name: str
    lat: float
    lng: float


class DirectionCreate(BaseModel):
    direction: str
    sub_name: Optional[str] = None
    gpx: Optional[str] = None
    stops: List[create_stops]
    tik_price: Optional[str] = None
    distance: Optional[str] = None


class RouteCreate(BaseModel):
    name: str
    bus_type: str
    directions: DirectionCreate


# ====== Output Schemas ======
class StopOut(BaseModel):
    id: int
    name: str
    lat: float
    lng: float

    class Config:
        orm_mode = True


class DirectionOut(BaseModel):
    id: int
    direction: str
    sub_name: Optional[str]
    gpx: Optional[str]
    stops: List[StopOut]
    distance: Optional[str]
    tik_price: Optional[str]


    class Config:
        orm_mode = True


class RouteOut(BaseModel):
    id: int
    name: str
    bus_type: str
    directions: List[DirectionOut]

    class Config:
        orm_mode = True

class DirectionUpdate(BaseModel):
    id: int
    direction: str
    sub_name: str | None = None
    gpx: str
    stops: list[StopUpdate]
    tik_price: str
    distance: str

class RouteUpdate(BaseModel):
    name: str
    bus_type: str
    directions: DirectionUpdate