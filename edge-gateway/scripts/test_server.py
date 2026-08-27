from fastapi import FastAPI, Request

app = FastAPI()

@app.post("/api/rainfall")
async def receive_rainfall(request: Request):
    data = await request.json()

    print("\n=== RAINFALL DATA RECEIVED ===")
    print(data)

    return {
        "success": True,
        "message": "Rainfall data received",
        "data": data
    }