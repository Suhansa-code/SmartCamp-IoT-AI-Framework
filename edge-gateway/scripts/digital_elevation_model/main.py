from digital_elevation_algorithm import get_elevations_batch


if __name__ == "__main__":
    test_points = [(7.507, 80.945)]
    for item in get_elevations_batch(
        test_points,
        snap_outside_to_nearest=True,
        max_snap_distance_m=500,
        use_api_fallback=True,
    ):
        print(item)