from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import route_editer
from db.database import engine, Base

app = FastAPI()

# ✅ Allow requests from your React app
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,         # list of allowed origins
    allow_credentials=True,
    allow_methods=["*"],           # allow all HTTP methods
    allow_headers=["*"],           # allow all headers
)
# ✅ Include routes
app.include_router(route_editer.router)

# ✅ Initialize database tables if they don’t exist
Base.metadata.create_all(bind=engine)
