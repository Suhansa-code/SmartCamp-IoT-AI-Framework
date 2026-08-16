from fastapi import FastAPI
from hydrospatial_api.api import router as hydro_router

app = FastAPI(title="Edge Gateway API")

app.include_router(hydro_router, prefix="/hydrospatial")


@app.get("/")
def root():
    return {"status": "running"}