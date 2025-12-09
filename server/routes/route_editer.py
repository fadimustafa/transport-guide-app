from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from db.database import get_db
from db.models import Route, Direction, Stop, RouteStop
from db.supabase_client import supabase
from schemas.route_schema import RouteCreate, RouteOut, StopOut, create_stops, StopUpdate, RouteUpdate
import os


router = APIRouter(prefix="/api")

@router.get("/stop", response_model=List[StopOut])
def get_stops(db: Session = Depends(get_db)):
    stops = db.query(Stop).all()
    if not stops:
        raise HTTPException(status_code=404, detail="No stops")
    return stops

@router.post("/stop", response_model=List[StopOut])
def create_stops(data: dict, db: Session = Depends(get_db)):
    stops_data = data.get("stops", [])
    
    new_stops = []
    for stop in stops_data:
        new_stop = Stop(**stop)
        db.add(new_stop)
        new_stops.append(new_stop)

    db.commit()

    for s in new_stops:
        db.refresh(s)

    return new_stops

@router.put("/stop", response_model=StopOut)
def edit_stop(stop_data: StopUpdate, db: Session = Depends(get_db)):
    db_stop = db.query(Stop).filter(Stop.id == stop_data.id).first()

    if not db_stop:
        raise HTTPException(status_code=404, detail="Stop not found")

    db_stop.name = stop_data.name
    db_stop.lat = stop_data.lat
    db_stop.lng = stop_data.lng

    db.commit()
    db.refresh(db_stop)

    return db_stop

@router.delete("/stop/{stop_id}")
def delete_stop(stop_id: int, db: Session = Depends(get_db)):
    stop = db.query(Stop).filter(Stop.id == stop_id).first()
    if not stop:
        raise HTTPException(status_code=404, detail="The stop does not exist!")

    linked = db.query(RouteStop).filter(RouteStop.stop_id == stop_id).first()
    if linked:
        raise HTTPException(
            status_code=400,
            detail="Stop is used in a direction and cannot be deleted."
        )

    db.delete(stop)
    db.commit()

    return {"message": "Stop deleted successfully."}

#edit befor publish--------------------------------------
@router.put("/route/{route_id}/{direction_id}", response_model=RouteOut)
def update_route(route_id: int, direction_id: int, route_data: RouteUpdate, db:Session = Depends(get_db)):

    db_route = db.query(Route).filter(Route.id == route_id).first()
    if not db_route:
        raise HTTPException(status_code=404, detail="Route not found")

    db_route.name = route_data.name
    db_route.bus_type = route_data.bus_type

    dir_data = route_data.directions

    db_direction = (
        db.query(Direction)
        .filter(Direction.id == direction_id, Direction.route_id == route_id)
        .first()
    )
    if not db_direction:
        raise HTTPException(status_code=404, detail="Direction not found")

    file_path = save_gpx_file(
        route_name=db_route.name,
        direction=dir_data.direction,
        sub_name=dir_data.sub_name,
        gpx_content=dir_data.gpx
    )

    db_direction.direction = dir_data.direction
    db_direction.sub_name = dir_data.sub_name
    db_direction.gpx = dir_data.gpx
    db_direction.gpx_path = file_path
    db_direction.tik_price = dir_data.tik_price
    db_direction.distance = dir_data.distance

    db.query(RouteStop).filter(RouteStop.direction_id == direction_id).delete()

    for index, stop in enumerate(dir_data.stops):
        db_route_stop = RouteStop(
            direction_id=direction_id,
            stop_id=stop.id,
            order=index + 1
        )
        db.add(db_route_stop)

    db.commit()
    db.refresh(db_route)
    return db_route

#edit befor publish--------------------------------------
@router.post("/route", response_model=RouteOut)
def create_route(route_data: RouteCreate, db: Session = Depends(get_db)):
    db_route = db.query(Route).filter(Route.name == route_data.name).first()
    dir_data = route_data.directions

    if db_route:
        db_direction = (
            db.query(Direction)
            .filter(
                Direction.route_id == db_route.id,
                Direction.direction == dir_data.direction,
                Direction.sub_name == dir_data.sub_name,
            )
            .first()
        )

        if db_direction:
            raise HTTPException(status_code=400, detail="Route direction already exists")
    else:
        db_route = Route(
            name=route_data.name,
            bus_type=route_data.bus_type
        )
        db.add(db_route)
        db.commit()
        db.refresh(db_route)

    # 2️⃣ Create the new direction (for new or existing route)   edit befor publish
    file_path = save_gpx_file(
        route_name=db_route.name,
        direction=dir_data.direction,
        sub_name=dir_data.sub_name,
        gpx_content=dir_data.gpx
    )

    db_direction = Direction(
        direction=dir_data.direction,
        sub_name=dir_data.sub_name,
        gpx=dir_data.gpx,
        gpx_path=file_path,
        tik_price=dir_data.tik_price,
        distance=dir_data.distance,
        route_id=db_route.id
    )

    db.add(db_direction)
    db.commit()
    db.refresh(db_direction)

    # 3️⃣ Insert ordered stops
    for index, stop in enumerate(dir_data.stops):
        db_route_stop = RouteStop(
            direction_id=db_direction.id,
            stop_id=stop.id,
            order=index + 1
        )
        db.add(db_route_stop)

    db.commit()
    db.refresh(db_route)

    return db_route

    # 🔰 Supabase Sync
    # try:
    #     supabase.table("routes").upsert({"id": db_route.id, "name": db_route.name}).execute()

    #     for direction in db_route.directions:
    #         supabase.table("directions").upsert({
    #             "id": direction.id,
    #             "route_id": db_route.id,
    #             "direction": direction.direction,
    #             "sub_name": direction.sub_name,
    #             "gpx": direction.gpx
    #         }).execute()

    #         # Get ordered route stops
    #         for rs in direction.route_stops:
    #             supabase.table("route_stops").upsert({
    #                 "id": rs.id,
    #                 "direction_id": direction.id,
    #                 "stop_id": rs.stop_id,
    #                 "order": rs.order
    #             }).execute()
    #     print("☁️ Route synced to Supabase")

    # except Exception as e:
    #     print(f"⚠️ Supabase sync failed: {e}")

    return db_route

@router.get("/route", response_model=List[RouteOut])
def get_routes(db: Session = Depends(get_db)):
    routes = (
        db.query(Route)
        .options(
            joinedload(Route.directions)
            .joinedload(Direction.route_stops)
            .joinedload(RouteStop.stop)
        )
        .all()
    )
    return routes
@router.delete("/route/{route_id}/{direction_id}")
def delete_direction(route_id: int, direction_id: int, db: Session = Depends(get_db)):
    # Get route (must use .first())
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="The route does not exist!")

    # Get direction
    direction = db.query(Direction).filter(Direction.id == direction_id, Direction.route_id == route_id).first()
    if not direction:
        raise HTTPException(status_code=404, detail="Direction not found")

    # Delete associated GPX file
    if direction.gpx_path:
        try:
            if os.path.exists(direction.gpx_path):
                os.remove(direction.gpx_path)
                print(f"🗑️ Deleted GPX file: {direction.gpx_path}")
        except Exception as e:
            print(f"⚠️ GPX delete error: {e}")

    # Delete direction
    db.delete(direction)
    db.commit()
    print(f"🗑️ Deleted direction: {direction.direction}")

    # Now check if route has any directions left
    remaining_directions = db.query(Direction).filter(Direction.route_id == route_id).all()

    if len(remaining_directions) == 0:
        # No directions left → delete the route
        db.delete(route)
        db.commit()
        print(f"🗑️ Route '{route.name}' deleted because it has no more directions.")

        return {"message": "Direction deleted, and route deleted (no directions left)."}

    return {"message": "Direction deleted successfully."}



    # Supabase delete
    # try:
    #     supabase.table("route_stops").delete().eq("direction_id", route_id).execute()
    #     supabase.table("directions").delete().eq("route_id", route_id).execute()
    #     supabase.table("routes").delete().eq("id", route_id).execute()
    #     print("☁️ Deleted from Supabase")
    # except:
    #     print("⚠️ Supabase delete failed")

    return {"message": f"Route '{route.name}' deleted successfully"}

@router.get("/route/{route_id}", response_model=RouteOut)
def get_route(route_id: int, db: Session = Depends(get_db)):
    route = (
        db.query(Route)
        .options(
            joinedload(Route.directions)
            .joinedload(Direction.route_stops)
            .joinedload(RouteStop.stop)
        )
        .filter(Route.id == route_id)
        .first()
    )

    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    return route


import os

# Use os.path.join for cross-platform compatibility
GPX_FOLDER = os.path.join("gpx-files")
os.makedirs(GPX_FOLDER, exist_ok=True)

def save_gpx_file(route_name: str, direction: str, sub_name: str, gpx_content: str):
    if not gpx_content:
        return None

    # Sanitize names for safe filenames
    safe_route = route_name.replace(" ", "_")
    safe_dir = direction.replace(" ", "_")
    safe_sub = (sub_name or "").replace(" ", "_")

    # Create filename
    file_name = f"{safe_route}__{safe_dir}__{safe_sub}.gpx"
    file_path = os.path.join(GPX_FOLDER, file_name)

    # Write the GPX content to file
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(gpx_content)

    print(f"📁 Saved GPX file → {file_path}")
    return file_path
