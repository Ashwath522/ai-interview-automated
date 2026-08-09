from datetime import UTC, datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

router = APIRouter()

# In-memory storage for demonstration (would be replaced with database in production)
_events_store: dict[str, List[dict]] = {}
_risk_scores_store: dict[str, dict] = {}
_clips_store: dict[str, List[str]] = {}  # session_id -> list of clip URLs


class EventResponse(BaseModel):
    id: str
    event_type: str
    severity: str  # low, medium, high, critical
    timestamp: datetime
    metadata: dict
    snapshot_url: Optional[str] = None
    clip_url: Optional[str] = None


class RiskScoreResponse(BaseModel):
    session_id: str
    timestamp: datetime
    score: float  # 0.0 to 1.0
    level: str  # low, medium, high, critical
    breakdown: dict[str, float]  # individual signal contributions
    evidence_count: int


class HighlightReelRequest(BaseModel):
    session_id: str
    clip_urls: List[str] = Field(..., min_length=1)


class HighlightReelResponse(BaseModel):
    highlight_reel_url: str
    created_at: datetime
    duration_seconds: float
    clip_count: int


@router.get("/events", response_model=List[EventResponse])
async def get_events(
    session_id: str = Query(..., description="Session ID to retrieve events for"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of events to return"),
    offset: int = Query(0, ge=0, description="Number of events to skip")
):
    """
    Get all events for a session ordered by timestamp (newest first).
    Returns events with metadata, snapshot_url, and clip_url.
    """
    if session_id not in _events_store:
        # Return empty list if no events found for session
        return []

    events = _events_store[session_id]
    # Sort by timestamp descending (newest first)
    sorted_events = sorted(events, key=lambda e: e["timestamp"], reverse=True)
    # Apply pagination
    paginated_events = sorted_events[offset:offset + limit]

    return [
        EventResponse(
            id=event["id"],
            event_type=event["event_type"],
            severity=event["severity"],
            timestamp=event["timestamp"],
            metadata=event["metadata"],
            snapshot_url=event.get("snapshot_url"),
            clip_url=event.get("clip_url")
        )
        for event in paginated_events
    ]


@router.get("/risk-score", response_model=RiskScoreResponse)
async def get_risk_score(
    session_id: str = Query(..., description="Session ID to retrieve risk score for")
):
    """
    Get the latest risk score for a session with full breakdown and evidence count.
    """
    if session_id not in _risk_scores_store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No risk score found for session {session_id}"
        )

    risk_data = _risk_scores_store[session_id]
    return RiskScoreResponse(
        session_id=session_id,
        timestamp=risk_data["timestamp"],
        score=risk_data["score"],
        level=risk_data["level"],
        breakdown=risk_data["breakdown"],
        evidence_count=risk_data["evidence_count"]
    )


@router.post("/highlight-reel", response_model=HighlightReelResponse)
async def create_highlight_reel(request: HighlightReelRequest):
    """
    Create a highlight reel by stitching together multiple clip URLs.
    In a production implementation, this would use ffmpeg to combine clips
    and upload to object storage (S3, GCS, etc.).
    """
    # Validate session has clips
    if request.session_id not in _clips_store or not _clips_store[request.session_id]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No clips found for session {request.session_id}"
        )

    # Validate that requested clips belong to the session
    session_clips = set(_clips_store[request.session_id])
    requested_clips = set(request.clip_urls)

    if not requested_clips.issubset(session_clips):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more clip URLs do not belong to the specified session"
        )

    # In a real implementation, we would:
    # 1. Download the clips from URLs
    # 2. Use ffmpeg to stitch them together
    # 3. Upload the result to object storage
    # 4. Return the public/signed URL

    # For now, we'll simulate this by returning a constructed URL
    highlight_reel_url = f"https://storage.example.com/highlight-reels/{request.session_id}_{datetime.now(UTC).timestamp()}.mp4"

    # Store the highlight reel URL (in reality, this would be the stored result)
    if request.session_id not in _clips_store:
        _clips_store[request.session_id] = []
    _clips_store[request.session_id].append(highlight_reel_url)

    return HighlightReelResponse(
        highlight_reel_url=highlight_reel_url,
        created_at=datetime.now(UTC),
        duration_seconds=len(request.clip_urls) * 5.0,  # Simulated 5 seconds per clip
        clip_count=len(request.clip_urls)
    )


# Helper functions for testing/simulation (would be replaced by actual integrations)
def add_event(session_id: str, event: dict):
    """Add an event to the store (for testing/simulation)"""
    if session_id not in _events_store:
        _events_store[session_id] = []
    _events_store[session_id].append(event)


def update_risk_score(session_id: str, score_data: dict):
    """Update the risk score for a session (for testing/simulation)"""
    _risk_scores_store[session_id] = score_data


def add_clip_url(session_id: str, clip_url: str):
    """Add a clip URL to a session's store (for testing/simulation)"""
    if session_id not in _clips_store:
        _clips_store[session_id] = []
    _clips_store[session_id].append(clip_url)


def clear_session_data(session_id: str):
    """Clear all data for a session (for testing/simulation)"""
    _events_store.pop(session_id, None)
    _risk_scores_store.pop(session_id, None)
    _clips_store.pop(session_id, None)