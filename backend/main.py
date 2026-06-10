import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from database import Base, engine, run_migrations
from routers import analysis, auth, capture, performance, upload


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialise database tables, then apply incremental column migrations
    Base.metadata.create_all(bind=engine)
    run_migrations()
    # Ensure uploads directory exists
    os.makedirs(
        os.path.join(os.path.dirname(__file__), "uploads"), exist_ok=True
    )
    yield


app = FastAPI(
    title="Traffic Classifier API",
    description="AI-Based Encrypted Mobile Traffic Classification — FYP Backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.1.123",  # Allow mobile app connections
        "https://hadi-fyp.vercel.app",
        "https://hadi-fyp-wnq9.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(analysis.router)
app.include_router(performance.router)
app.include_router(capture.router)


@app.get("/")
def root():
    return {"message": "Traffic Classifier API is running", "docs": "/docs"}
