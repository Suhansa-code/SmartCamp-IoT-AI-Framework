from fastapi import FastAPI
from hydrospatial_api.api import router as hydro_router
from gps_module.gps_api import router as gps_router

app = FastAPI(title="Edge Gateway API")

app.include_router(hydro_router, prefix="/hydrospatial")
app.include_router(gps_router, prefix="/api")


@app.get("/")
def root():
    return {"status": "running"}