from typing import Any, Dict, Tuple
from pyproj import Geod
from shapely.geometry import Polygon, MultiPolygon, shape
from shapely.validation import make_valid

GEOD = Geod(ellps="WGS84")


def extract_polygon_geometry(geojson_input: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize GeoJSON FeatureCollection / Feature / Polygon / MultiPolygon into a clean Geometry dict."""
    if not isinstance(geojson_input, dict):
        raise ValueError("Geometry must be a valid GeoJSON object.")

    gtype = geojson_input.get("type")
    if gtype == "FeatureCollection":
        features = geojson_input.get("features") or []
        if not features:
            raise ValueError("GeoJSON FeatureCollection contains no features.")
        return extract_polygon_geometry(features[0])
    if gtype == "Feature":
        geom = geojson_input.get("geometry")
        if not geom:
            raise ValueError("GeoJSON Feature has no geometry.")
        return extract_polygon_geometry(geom)
    if gtype in ("Polygon", "MultiPolygon"):
        geom_obj = shape(geojson_input)
        if not geom_obj.is_valid:
            geom_obj = make_valid(geom_obj)
        if geom_obj.is_empty:
            raise ValueError("Farm boundary geometry is empty.")
        if not isinstance(geom_obj, (Polygon, MultiPolygon)):
            raise ValueError("Farm boundary must resolve to a Polygon or MultiPolygon.")
        # Validate WGS84 coordinate bounds
        minx, miny, maxx, maxy = geom_obj.bounds
        if not (-180 <= minx <= 180 and -180 <= maxx <= 180 and -90 <= miny <= 90 and -90 <= maxy <= 90):
            raise ValueError("Coordinates must be valid WGS84 longitude/latitude degrees.")
        return geom_obj.__geo_interface__
    raise ValueError(f"Unsupported GeoJSON geometry type: {gtype!r}. Expected Polygon, MultiPolygon, Feature, or FeatureCollection.")


def compute_geodesic_metrics(geojson_geom: Dict[str, Any]) -> Tuple[str, float, float, float, float]:
    """Return (wkt, centroid_lat, centroid_lon, area_hectares, perimeter_meters) on WGS84 ellipsoid."""
    geom = shape(geojson_geom)
    area_m2, perimeter_m = GEOD.geometry_area_perimeter(geom)
    area_m2 = abs(float(area_m2))
    area_ha = round(area_m2 / 10000.0, 4)
    perimeter_m = round(abs(float(perimeter_m)), 2)
    centroid = geom.centroid
    return geom.wkt, round(float(centroid.y), 6), round(float(centroid.x), 6), area_ha, perimeter_m

