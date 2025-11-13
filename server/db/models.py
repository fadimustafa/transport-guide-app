from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from db.database import Base


class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # e.g. "Line 5 - Main Street"

    # 🧭 One route can have multiple directions
    directions = relationship("Direction", back_populates="route", cascade="all, delete")


class Direction(Base):
    __tablename__ = "directions"

    id = Column(Integer, primary_key=True, index=True)
    direction = Column(String, nullable=False)  # e.g. "Go", "Return", "Airport Branch"
    gpx = Column(Text)                     # Optional: GPX file for this direction
    sub_name = Column(String, nullable=True)  # Optional: e.g. "via Station A"
    route_id = Column(Integer, ForeignKey("routes.id"))

    route = relationship("Route", back_populates="directions")
    stops = relationship("Stop", back_populates="direction", cascade="all, delete")


class Stop(Base):
    __tablename__ = "stops"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    direction_id = Column(Integer, ForeignKey("directions.id"))

    direction = relationship("Direction", back_populates="stops")
