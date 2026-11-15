from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FIELDWISE AI"
    app_version: str = "1.0.0"
    database_url: str = "sqlite:///./fieldwise.db"
    earth_engine_project: str = ""
    google_application_credentials: str = ""
    nasa_power_base_url: str = "https://power.larc.nasa.gov/api/temporal/daily/point"
    ornl_modis_base_url: str = "https://modis.ornl.gov/rst/api/v1"
    earth_search_stac_url: str = "https://earth-search.aws.element84.com/v1"
    open_topo_srtm_url: str = "https://api.opentopodata.org/v1/srtm30m"
    nasa_gibs_wmts_base: str = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"
    observation_cache_ttl_hours: int = 24
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    http_timeout_seconds: float = 25.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_postgres(self) -> bool:
        return self.database_url.startswith("postgresql")


@lru_cache
def get_settings() -> Settings:
    return Settings()

