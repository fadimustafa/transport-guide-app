from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from db.database import get_db
from db.models import Route, Direction, Stop
from db.supabase_client import supabase
from schemas.route_schema import  RouteCreate, RouteOut

router = APIRouter(prefix="/routes")

# ==== ROUTES ====
@router.post("/", response_model=RouteOut)
def create_or_update_route(route_data: RouteCreate, db: Session = Depends(get_db)):
    print(f"🚍 Processing route: {route_data.name}")

    # 1️⃣ Check if route exists
    db_route = db.query(Route).filter(Route.name == route_data.name).first()
    if not db_route:
        db_route = Route(name=route_data.name)
        db.add(db_route)
        db.commit()
        db.refresh(db_route)
        print(f"✅ Created new route: {db_route.name}")
    else:
        print(f"ℹ️ Route '{db_route.name}' already exists")

    # 2️⃣ Loop through directions
    for dir_data in route_data.directions:
        print(f"➡️ Direction: {dir_data.direction} | Sub: {dir_data.sub_name}")

        # Check for existing direction + sub_name
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
            # 🔁 Update existing direction
            db_direction.gpx = dir_data.gpx
            db.query(Stop).filter(Stop.direction_id == db_direction.id).delete()
            print(f"🔄 Updated direction '{dir_data.direction}' (sub: {dir_data.sub_name}) for route '{db_route.name}'")
        else:
            # ➕ Create new direction
            db_direction = Direction(
                sub_name=dir_data.sub_name,
                direction=dir_data.direction,
                gpx=dir_data.gpx,
                route=db_route,
            )
            db.add(db_direction)
            db.commit()
            db.refresh(db_direction)
            print(f"🆕 Added new direction '{dir_data.direction}' (sub: {dir_data.sub_name}) to route '{db_route.name}'")

        # 3️⃣ Add stops
        for stop in dir_data.stops:
            db_stop = Stop(
                name=stop.name,
                lat=stop.lat,
                lng=stop.lng,
                direction=db_direction,
            )
            db.add(db_stop)
        print(f"📍 Added {len(dir_data.stops)} stops for direction '{dir_data.direction}'")

    # 4️⃣ Finalize
    db.commit()
    db.refresh(db_route)
    print(f"✅ Finished processing route '{db_route.name}'")

    # add remotly (subapase)
    try:
        # Upsert route
        supabase.table("routes").upsert({"id": db_route.id, "name": db_route.name}).execute()

        for direction in db_route.directions:
            supabase.table("directions").upsert({
                "id": direction.id,
                "route_id": db_route.id,
                "sub_name": direction.sub_name,
                "direction": direction.direction,
                "gpx": direction.gpx
            }).execute()

            for stop in direction.stops:
                supabase.table("stops").upsert({
                    "id": stop.id,
                    "direction_id": direction.id,
                    "name": stop.name,
                    "lat": stop.lat,
                    "lng": stop.lng
                }).execute()
        print(f"☁️ Synced route '{db_route.name}' to Supabase")
    except Exception as e:
        print(f"⚠️ Supabase sync failed: {e}")  
    

    return db_route



@router.get("/", response_model=List[RouteOut])
def get_routes(db: Session = Depends(get_db)):
    routes = (
        db.query(Route)
        .options(joinedload(Route.directions).joinedload(Direction.stops))
        .all()
    )
    return routes


@router.get("/{route_id}", response_model=RouteOut)
def get_route(route_id: int, db: Session = Depends(get_db)):
    route = (
        db.query(Route)
        .options(joinedload(Route.directions).joinedload(Direction.stops))
        .filter(Route.id == route_id)
        .first()
    )
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route


@router.delete("/{route_id}")
def delete_route(route_id: int, db: Session = Depends(get_db)):
    # 1️⃣ Check if the route exists locally
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    # 2️⃣ Delete locally (SQLite)
    db.delete(route)
    db.commit()
    print(f"🗑️ Deleted route '{route.name}' locally")

    # 3️⃣ Try to delete remotely (Supabase)
    try:
        # First delete all stops under its directions
        directions_res = supabase.table("directions").select("id").eq("route_id", route_id).execute()
        if directions_res.data:
            for d in directions_res.data:
                supabase.table("stops").delete().eq("direction_id", d["id"]).execute()

        # Then delete the directions
        supabase.table("directions").delete().eq("route_id", route_id).execute()

        # Finally delete the route
        supabase.table("routes").delete().eq("id", route_id).execute()

        print(f"☁️ Deleted route '{route.name}' from Supabase")

    except Exception as e:
        print(f"⚠️ Supabase delete failed: {e}")

    return {"message": f"Route '{route.name}' deleted successfully"}


# it delete all dirction on update!!
# #update rout
# @router.put("/{route_id}", response_model=RouteOut)
# def update_route(route_id: int, route_data: RouteCreate, db: Session = Depends(get_db)):
#     # 1️⃣ Fetch route
#     db_route = db.query(Route).filter(Route.id == route_id).first()
#     if not db_route:
#         raise HTTPException(status_code=404, detail="Route not found")

#     # 2️⃣ Update name
#     db_route.name = route_data.name

#     # 3️⃣ Remove old directions & stops
#     for direction in db_route.directions:
#         db.query(Stop).filter(Stop.direction_id == direction.id).delete()
#     db.query(Direction).filter(Direction.route_id == db_route.id).delete()

#     db.commit()

#     # 4️⃣ Add new directions
#     for dir_data in route_data.directions:
#         db_direction = Direction(
#             sub_name=dir_data.sub_name,
#             direction=dir_data.direction,
#             gpx=dir_data.gpx,
#             route=db_route,
#         )
#         db.add(db_direction)
#         db.commit()
#         db.refresh(db_direction)

#         # 5️⃣ Add stops
#         for stop in dir_data.stops:
#             db_stop = Stop(
#                 name=stop.name,
#                 lat=stop.lat,
#                 lng=stop.lng,
#                 direction=db_direction,
#             )
#             db.add(db_stop)

#     # 6️⃣ Save all changes
#     db.commit()
#     db.refresh(db_route)
    
#     return db_route
