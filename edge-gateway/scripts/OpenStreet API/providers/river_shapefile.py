from pathlib import Path
import os
import math
import pandas as pd
import geopandas as gpd
import networkx as nx
from shapely.geometry import Point
from shapely.ops import nearest_points
from providers.river_lookup import get_nearest_named_river


# Configuration for shapefile reading - ensure .shx files are found

os.environ["SHAPE_RESTORE_SHX"] = "YES"

BASE_PATH = Path(__file__).resolve().parents[3]

WATERWAYS_FILE_PATH = BASE_PATH / "resources" / "gis_osm_waterways_free_1.shp"
GAUGING_STATION_FILE_PATH = BASE_PATH / "resources" / "gauging_stations.csv"

# Sri Lanka UTM Zone
PROJECTED_CRS = "EPSG:32644"


# Load river data
def load_river_data():
    rivers = gpd.read_file(WATERWAYS_FILE_PATH)

    # Keep only rivers
    if "fclass" in rivers.columns:
        rivers = rivers[rivers["fclass"] == "river"]

    rivers = rivers.set_crs("EPSG:4326")
    rivers = rivers.to_crs(PROJECTED_CRS)

    return rivers

# Load gauging station data
def load_gauging_station_data():
    df = pd.read_csv(GAUGING_STATION_FILE_PATH)
    geometry = [
        Point(lon, lat)
        for lon, lat in zip(df["Longitude"], df["Latitude"])
    ]
    

    stations = gpd.GeoDataFrame(
        df,
        geometry=geometry,
        crs="EPSG:4326"
    )

    stations = stations.to_crs(PROJECTED_CRS)

    return stations

# Helper function to build river graph
def build_river_graph(rivers):
    """
    Build directed river graph.
    River flow assumed:
    line.coords[0] ---> line.coords[-1]
    """

    G = nx.DiGraph()

    for _, row in rivers.iterrows():
        geometry = row.geometry

        if geometry.geom_type == "MultiLineString":
            lines = geometry.geoms
        else:
            lines = [geometry]

        for line in lines:
            coords = list(line.coords)

            start_node = tuple(coords[0])
            end_node = tuple(coords[-1])

            length = line.length

            G.add_edge(
                start_node,
                end_node,
                weight=length,
                geometry=line
            )

    return G

# build station graph nodes
def create_user_point(latitude, longitude):
    gdf = gpd.GeoDataFrame(
        geometry=[Point(longitude, latitude)],
        crs="EPSG:4326"
    )

    gdf = gdf.to_crs(PROJECTED_CRS)

    return gdf.geometry.iloc[0]


# Function to find nearest river to user point
def find_nearest_river(user_point, rivers):
    distances = rivers.geometry.distance(user_point)

    nearest_index = distances.idxmin()

    nearest_river = rivers.loc[nearest_index]

    return nearest_river

# Function for snapping a point to a line and finding the closest graph node
def snap_point_to_line(point, line):
    projected_distance = line.project(point)

    snapped_point = line.interpolate(projected_distance)

    return snapped_point

# Function to find closest graph node to a point
def find_closest_graph_node(point, graph_nodes):
    min_distance = float("inf")
    closest_node = None

    px, py = point.x, point.y

    for node in graph_nodes:
        nx_, ny_ = node

        distance = math.sqrt((px - nx_) ** 2 + (py - ny_) ** 2)

        if distance < min_distance:
            min_distance = distance
            closest_node = node

    return closest_node

# Function to get graph nodes for gauging stations
def get_station_graph_nodes(stations, graph_nodes):
    station_node_mapping = {}

    for idx, row in stations.iterrows():
        station_point = row.geometry

        closest_node = find_closest_graph_node(
            station_point,
            graph_nodes
        )

        station_node_mapping[idx] = closest_node

    return station_node_mapping


def find_upstream_gauging_station(
    latitude,
    longitude,
    rivers,
    stations,
    graph,
    station_node_mapping
):
    """
    Find nearest upstream gauging station.
    If no upstream station exists,
    return nearest gauging station.
    """

    # Create user point
    user_point = create_user_point(latitude, longitude)

    # Try to get nearest named river from the existing river lookup provider
    try:
        named_river, rl_error = get_nearest_named_river(latitude, longitude)
    except Exception:
        named_river, rl_error = None, {"error": "river lookup failed"}

    nearest_river = None


    # Try to match by name if shapefile has name column and river lookup succeeded
    if named_river and "name" in named_river and "name" in rivers.columns:
        river_name = named_river["name"]
        # Try to find matching river geometries by name in the shapefile
        candidates = rivers[
            rivers["name"].astype(str).str.lower()
            == str(river_name).lower()
        ]

        if len(candidates) > 0:
            # choose the candidate with minimum distance to the user point
            distances = candidates.geometry.distance(user_point)
            nearest_river = candidates.loc[distances.idxmin()]

    # Fallback to spatial nearest if no named match found
    if nearest_river is None:
        nearest_river = find_nearest_river(user_point, rivers)

    river_geometry = nearest_river.geometry
    distance_to_river_meters = float(round(user_point.distance(river_geometry), 2))


    # Snap user to river
    snapped_user_point = snap_point_to_line(
        user_point,
        river_geometry
    )

    # Find closest graph node
    user_node = find_closest_graph_node(
        snapped_user_point,
        graph.nodes
    )

    # Reverse graph - Upstream traversal
    reversed_graph = graph.reverse()
    upstream_nodes = nx.single_source_dijkstra_path_length(
        reversed_graph,
        user_node
    )


    # Filter stations on same river (optional)
    filtered_stations = stations

    station_river_column = "river_name" if "river_name" in stations.columns else "river"

    if station_river_column in stations.columns and "name" in nearest_river.index:
        river_name = nearest_river["name"]

        same_river_stations = stations[
            stations[station_river_column].astype(str).str.lower()
            == str(river_name).lower()
        ]

        if len(same_river_stations) > 0:
            filtered_stations = same_river_stations


    # Find nearest upstream station
    nearest_upstream_station = None
    nearest_upstream_distance = float("inf")

    for station_idx, station in filtered_stations.iterrows():

        station_node = station_node_mapping[station_idx]

        if station_node in upstream_nodes:

            river_distance = upstream_nodes[station_node]

            if river_distance < nearest_upstream_distance:
                nearest_upstream_distance = river_distance
                nearest_upstream_station = station


    # Return upstream station if found
    if nearest_upstream_station is not None:
        station_geometry = nearest_upstream_station.geometry
        distance_to_station_meters = float(round(user_point.distance(station_geometry), 2))

        return {
            "type": "UPSTREAM_STATION",
            "station_name": nearest_upstream_station.get("station_name"),
            "river": nearest_upstream_station.get("river_name") or nearest_upstream_station.get("river"),
            "river_name": nearest_upstream_station.get("river_name") or nearest_upstream_station.get("river"),
            "distance_meters": float(round(nearest_upstream_distance, 2)),
            "distance_to_station_meters": distance_to_station_meters,
            "distance_to_river_meters": distance_to_river_meters,
            "nearest_river_name": nearest_river.get("name"),
            "alert_level": float(nearest_upstream_station.get("alert_level"))
            if pd.notnull(nearest_upstream_station.get("alert_level"))
            else None,
            "minor_flood_level": nearest_upstream_station.get("minor_flood_level") or nearest_upstream_station.get("minor_flood"),
            "major_flood_level": nearest_upstream_station.get("major_flood_level") or nearest_upstream_station.get("major_flood"),
        }



    # Fallback: Find nearest station by direct distance
    stations_copy = stations.copy()

    stations_copy["distance"] = stations_copy.geometry.distance(user_point)

    nearest_station = stations_copy.loc[
        stations_copy["distance"].idxmin()
    ]
    distance_to_station_meters = float(round(nearest_station["distance"], 2))

    return {
        "type": "NEAREST_STATION",
        "station_name": nearest_station["station_name"],
        "river": nearest_station.get("river_name") or nearest_station.get("river"),
        "river_name": nearest_station.get("river_name") or nearest_station.get("river"),
        "distance_meters": distance_to_station_meters,
        "distance_to_station_meters": distance_to_station_meters,
        "distance_to_river_meters": distance_to_river_meters,
        "nearest_river_name": nearest_river.get("name"),
        "alert_level": nearest_station.get("alert_level"),
        "minor_flood_level": nearest_station.get("minor_flood"),
        "major_flood_level": nearest_station.get("major_flood"),
    }



# Execution Function
if __name__ == "__main__":

    # Load datasets
    rivers = load_river_data()
    stations = load_gauging_station_data()

    # Build graph
    river_graph = build_river_graph(rivers)

    # Precompute station graph nodes
    station_graph_nodes = get_station_graph_nodes(
        stations,
        river_graph.nodes
    )

    # Example location
    latitude = 6.9147
    longitude = 79.9733

    # Find station
    result = find_upstream_gauging_station(
        latitude=latitude,
        longitude=longitude,
        rivers=rivers,
        stations=stations,
        graph=river_graph,
        station_node_mapping=station_graph_nodes
    )

    # Output
    print("\n========== RESULT ==========")
    print(result)

