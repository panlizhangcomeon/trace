"""Tests for trip_geo_scope and country_code on ItineraryDraftV1."""
import pytest
from pydantic import ValidationError

from services.itinerary_schema import ItineraryDraftV1


def _minimal_draft(**overrides):
    base = {
        "schema_version": "1",
        "trip_summary": {"title_hint": "t", "destination_summary": "d"},
        "origin": {"label": "o"},
        "days": [
            {
                "day_index": 1,
                "city_context": "Tokyo",
                "country_code": "jp",
                "stops": [{"display_name": "Shibuya", "search_query": "Shibuya Crossing"}],
            }
        ],
    }
    base.update(overrides)
    return base


def test_international_draft_accepts_trip_geo_scope_and_country_code():
    d = ItineraryDraftV1.model_validate(_minimal_draft(trip_geo_scope="international"))
    assert d.trip_geo_scope == "international"
    assert d.days[0].country_code == "jp"


def test_domestic_draft_default_scope_when_omitted():
    payload = _minimal_draft()
    payload.pop("trip_geo_scope", None)
    payload["days"][0].pop("country_code", None)
    payload["days"][0]["city_context"] = "丽江"
    payload["days"][0]["stops"] = [{"display_name": "古城"}]
    d = ItineraryDraftV1.model_validate(payload)
    assert d.trip_geo_scope == "domestic"


def test_invalid_trip_geo_scope_rejected():
    with pytest.raises(ValidationError):
        ItineraryDraftV1.model_validate(_minimal_draft(trip_geo_scope="mars"))


def test_country_code_normalized_uppercase_input():
    d = ItineraryDraftV1.model_validate(_minimal_draft(trip_geo_scope="international", days=[
        {
            "day_index": 1,
            "city_context": "Paris",
            "country_code": "FR",
            "stops": [{"display_name": "Tour Eiffel", "search_query": "Eiffel Tower"}],
        }
    ]))
    assert d.days[0].country_code == "fr"
