import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.windows import Window
from open_elevation_api import build_api_fallback_result

DEM_FILE = "C:/Users/ASUS/Desktop/SLIIT/Year 4/Research Documents - RM/DataSet Sources/Digital Elavation Model ( DEM )/VaeSSA_precise_DEM_0.5m_SLD99.img"


def _clamp_to_bounds(x, y, bounds):
    clamped_x = min(max(x, bounds.left), bounds.right)
    clamped_y = min(max(y, bounds.bottom), bounds.top)
    return clamped_x, clamped_y


def _find_nearest_valid_pixel(dem, x, y, max_radius=2048, step=64):
    target_row, target_col = dem.index(x, y)
    target_row = min(max(target_row, 0), dem.height - 1)
    target_col = min(max(target_col, 0), dem.width - 1)

    for radius in range(step, max_radius + step, step):
        row_min = max(0, target_row - radius)
        row_max = min(dem.height - 1, target_row + radius)
        col_min = max(0, target_col - radius)
        col_max = min(dem.width - 1, target_col + radius)

        window = Window(col_min, row_min, col_max - col_min + 1, row_max - row_min + 1)
        band = dem.read(1, window=window, masked=True)

        mask = np.ma.getmaskarray(band)
        valid = ~mask
        if dem.nodata is not None:
            valid &= band.data != dem.nodata

        if not valid.any():
            continue

        valid_rows, valid_cols = np.where(valid)
        abs_rows = valid_rows + row_min
        abs_cols = valid_cols + col_min
        dist2 = (abs_rows - target_row) ** 2 + (abs_cols - target_col) ** 2
        nearest_idx = int(np.argmin(dist2))

        nearest_row = int(abs_rows[nearest_idx])
        nearest_col = int(abs_cols[nearest_idx])
        nearest_x, nearest_y = dem.xy(nearest_row, nearest_col)
        nearest_elevation = float(band.data[valid_rows[nearest_idx], valid_cols[nearest_idx]])
        return {
            "elevation": nearest_elevation,
            "x": float(nearest_x),
            "y": float(nearest_y),
        }

    return None


def get_dem_elevations_batch(gps_points, snap_outside_to_nearest=False, max_snap_distance_m=None):
    """
    Reads DEM elevations for many points using one raster open + one CRS transform setup.
    """
    results = []

    with rasterio.open(DEM_FILE) as dem:
        to_dem_transformer = Transformer.from_crs("EPSG:4326", dem.crs, always_xy=True)
        to_wgs84_transformer = Transformer.from_crs(dem.crs, "EPSG:4326", always_xy=True)
        bounds = dem.bounds

        for latitude, longitude in gps_points:
            x, y = to_dem_transformer.transform(longitude, latitude)
            requested_x, requested_y = x, y
            used_x, used_y = x, y
            status_error = None

            is_outside = not (bounds.left <= x <= bounds.right and bounds.bottom <= y <= bounds.top)
            if is_outside:
                if not snap_outside_to_nearest:
                    results.append(
                        {
                            "latitude": latitude,
                            "longitude": longitude,
                            "used_latitude": None,
                            "used_longitude": None,
                            "elevation": None,
                            "snap_distance_m": None,
                            "source": "dem",
                            "error": "outside_dem_bounds",
                        }
                    )
                    continue
                x, y = _clamp_to_bounds(x, y, bounds)
                used_x, used_y = x, y
                status_error = "snapped_to_nearest_pixel"

            elevation = float(next(dem.sample([(x, y)]))[0])
            if dem.nodata is not None and elevation == dem.nodata:
                nearest = _find_nearest_valid_pixel(dem, x, y) if snap_outside_to_nearest else None
                if nearest is None:
                    results.append(
                        {
                            "latitude": latitude,
                            "longitude": longitude,
                            "used_latitude": None,
                            "used_longitude": None,
                            "elevation": None,
                            "snap_distance_m": None,
                            "source": "dem",
                            "error": "nodata_pixel",
                        }
                    )
                    continue

                elevation = nearest["elevation"]
                used_x, used_y = nearest["x"], nearest["y"]
                status_error = "snapped_to_nearest_valid_pixel"

            used_lon, used_lat = to_wgs84_transformer.transform(used_x, used_y)
            snap_distance_m = ((used_x - requested_x) ** 2 + (used_y - requested_y) ** 2) ** 0.5

            if max_snap_distance_m is not None and snap_distance_m > max_snap_distance_m:
                elevation = None
                status_error = "snap_distance_exceeds_threshold"

            results.append(
                {
                    "latitude": latitude,
                    "longitude": longitude,
                    "used_latitude": used_lat,
                    "used_longitude": used_lon,
                    "elevation": elevation,
                    "snap_distance_m": snap_distance_m,
                    "source": "dem",
                    "error": status_error,
                }
            )

    return results


def get_elevations_batch(gps_points, snap_outside_to_nearest=False, max_snap_distance_m=None, use_api_fallback=False):
    dem_results = get_dem_elevations_batch(
        gps_points,
        snap_outside_to_nearest=snap_outside_to_nearest,
        max_snap_distance_m=max_snap_distance_m,
    )

    if not use_api_fallback:
        return dem_results

    merged_results = []
    for item in dem_results:
        if item["elevation"] is not None:
            merged_results.append(item)
            continue
        merged_results.append(build_api_fallback_result(item["latitude"], item["longitude"]))
    return merged_results
