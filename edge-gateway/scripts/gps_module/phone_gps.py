import requests

def get_phone_gps(url):
    try:
        response = requests.get(url)
        data = response.json()

        return {
            "latitude": data.get("lat"),
            "longitude": data.get("lon"),
            "altitude": data.get("alt")
        }

    except Exception as e:
        print("Error fetching phone GPS:", e)
        return None