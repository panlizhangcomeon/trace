"""
Pydantic models for ItineraryDraftV1 (smart trip LLM output).
"""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator


class TripSummary(BaseModel):
    title_hint: str = Field(..., max_length=200)
    destination_summary: str = Field(..., max_length=500)


class Origin(BaseModel):
    label: str = Field(..., max_length=120)


class SegmentItem(BaseModel):
    city_label: str = Field(..., max_length=120)
    country_hint: Optional[str] = Field(None, max_length=80)
    days: int = Field(..., ge=1, le=30)


class Stop(BaseModel):
    display_name: str = Field(..., max_length=200)
    search_query: Optional[str] = Field(None, max_length=200)
    duration_minutes: Optional[int] = Field(None, ge=0, le=960)
    notes: Optional[str] = Field(None, max_length=2000)
    travel_hint: Optional[str] = Field(None, max_length=500)


class Day(BaseModel):
    day_index: int = Field(..., ge=1)
    city_context: str = Field(..., max_length=120)
    stops: List[Stop] = Field(default_factory=list, max_length=20)


class ItineraryDraftV1(BaseModel):
    schema_version: Literal['1']
    trip_summary: TripSummary
    origin: Origin
    segments: Optional[List[SegmentItem]] = None
    days: List[Day] = Field(..., min_length=1, max_length=60)

    @model_validator(mode='after')
    def consecutive_day_indices(self) -> ItineraryDraftV1:
        days_sorted = sorted(self.days, key=lambda d: d.day_index)
        if len(days_sorted) != len(self.days):
            raise ValueError('days 中存在重复的 day_index')
        expected = list(range(1, len(days_sorted) + 1))
        actual = [d.day_index for d in days_sorted]
        if actual != expected:
            raise ValueError('days[].day_index 必须从 1 起连续递增')
        object.__setattr__(self, 'days', days_sorted)
        return self

    def total_stops(self) -> int:
        return sum(len(d.stops) for d in self.days)
