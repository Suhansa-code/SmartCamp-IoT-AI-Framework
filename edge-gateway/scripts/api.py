from fastapi import FastAPI
from hydrospatial_api.api import router as hydro_router
from gps_module.gps_api import router as gps_router
from dht11_module.dht11_api import router as dht11_router

app = FastAPI(title="Edge Gateway API")

app.include_router(hydro_router, prefix="/hydrospatial")
app.include_router(gps_router, prefix="/api")
app.include_router(dht11_router, prefix="/api")


@app.get("/")
def root():
    return {"status": "running"}