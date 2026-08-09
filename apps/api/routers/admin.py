from datetime import UTC, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from apps.web.lib.db.index import db
from apps.web.lib.db.schema import interview, userRole, evaluation, evidence, auditLog
from sqlalchemy import select, update, and_, or_, func, delete
from apps.api.routers.interviews import get_current_user

router = APIRouter()

class AdminStatsResponse(BaseModel):
    active_interviews: int
    total_storage_mb: float  # Approximate storage used by proctoring media
    recent_errors: int  # Failed jobs count (we'll approximate with failed evaluations or similar)
    average_risk_score: Optional[float]
    high_risk_count: int  # riskScore >= 80
    review_recommended_count: int  # |riskScore - evaluationScore| > 30
    human_review_flags: int  # interviews with humanReviewRequired = True

class RetentionSettingsResponse(BaseModel):
    retention_days: int
    last_run: Optional[datetime]
    last_run_deleted_count: Optional[int]

class RetentionRunResponse(BaseModel):
    deleted_count: int
    retained_count: int
    run_at: datetime

class UpdateRetentionRequest(BaseModel):
    retention_days: int

# Helper to get current user and check admin role
async def get_current_admin_user(x_user_id: str = None) -> str:
    """Get current user ID and verify admin role"""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Get user role from database
    user_role_query = select(userRole.c.role).where(userRole.c.userId == x_user_id)
    user_role_result = await db.fetch_one(user_role_query)
    if not user_role_result:
        raise HTTPException(status_code=401, detail="User not found")

    user_role = user_role_result["role"]
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    return x_user_id

@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(current_user: str = Depends(get_current_admin_user)):
    """Get admin dashboard statistics"""
    try:
        # Active interviews count (not completed, cancelled, missed, rescheduled)
        active_interviews_query = select(func.count()).select_from(interview).where(
            interview.c.status.in_(['scheduled', 'baseline', 'active'])
        )
        active_interviews_result = await db.fetch_one(active_interviews_query)
        active_interviews = active_interviews_result[0] if active_interviews_result else 0

        # Approximate storage used by proctoring media
        # We'll estimate based on evidence table - each evidence item ~5MB on average
        evidence_count_query = select(func.count()).select_from(evidence)
        evidence_count_result = await db.fetch_one(evidence_count_query)
        evidence_count = evidence_count_result[0] if evidence_count_result else 0
        total_storage_mb = evidence_count * 5.0  # Rough estimate: 5MB per evidence item

        # Recent errors/failed jobs - we'll count evaluations with errors or failed interviews
        # For now, let's count interviews with error status or evaluations with null scores when they shouldn't be
        recent_errors_query = select(func.count()).select_from(interview).where(
            interview.c.status == 'cancelled'  # Using cancelled as a proxy for errors
        )
        recent_errors_result = await db.fetch_one(recent_errors_query)
        recent_errors = recent_errors_result[0] if recent_errors_result else 0

        # Average risk score across recent interviews (last 30 days)
        thirty_days_ago = datetime.now(UTC) - timedelta(days=30)
        avg_risk_query = select(func.avg(interview.c.riskScore)).select_from(interview).where(
            and_(
                interview.c.riskScore.is_not(None),
                interview.c.scheduledAt >= thirty_days_ago
            )
        )
        avg_risk_result = await db.fetch_one(avg_risk_query)
        average_risk_score = float(avg_risk_result[0]) if avg_risk_result and avg_risk_result[0] is not None else None

        # High risk count (riskScore >= 80)
        high_risk_query = select(func.count()).select_from(interview).where(
            and_(
                interview.c.riskScore.is_not(None),
                interview.c.riskScore >= 80
            )
        )
        high_risk_result = await db.fetch_one(high_risk_query)
        high_risk_count = high_risk_result[0] if high_risk_result else 0

        # Review recommended count (|riskScore - evaluationScore| > 30)
        # We need to join with evaluation table
        review_recommended_query = select(func.count()).select_from(
            interview.join(evaluation, interview.c.id == evaluation.c.interviewId, isouter=True)
        ).where(
            and_(
                interview.c.riskScore.is_not(None),
                evaluation.c.score.is_not(None),
                func.abs(interview.c.riskScore - evaluation.c.score) > 30
            )
        )
        review_recommended_result = await db.fetch_one(review_recommended_query)
        review_recommended_count = review_recommended_result[0] if review_recommended_result else 0

        # Human review flags (computed logic)
        # This is complex to compute in SQL directly, so we'll approximate
        # We'll count interviews that meet ANY of the human review criteria
        human_review_query = select(func.count()).select_from(interview).where(
            or_(
                interview.c.riskScore >= 80,  # High risk
                # We'll need to join with evaluation for the score diff check
                # For now, let's approximate with a subquery or we'll compute in Python later
                # Let's do a simpler approach: we'll get the count from a join
            )
        )
        # Let's do a proper join for human review flags
        human_review_query = select(func.count()).select_from(
            interview.join(evaluation, interview.c.id == evaluation.c.interviewId, isouter=True)
        ).where(
            or_(
                interview.c.riskScore >= 80,  # High risk threshold
                func.abs(interview.c.riskScore - evaluation.c.score) > 30,  # High score variance
                # For feedback containing "needs human review", we'd need to check the feedback field
                # We'll skip this for now as it requires text search which is more complex
                evaluation.c.feedback.ilike('%needs human review%')  # Case-insensitive search
            )
        )
        human_review_result = await db.fetch_one(human_review_query)
        human_review_flags = human_review_result[0] if human_review_result else 0

        return AdminStatsResponse(
            active_interviews=active_interviews,
            total_storage_mb=total_storage_mb,
            recent_errors=recent_errors,
            average_risk_score=average_risk_score,
            high_risk_count=high_risk_count,
            review_recommended_count=review_recommended_count,
            human_review_flags=human_review_flags
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/retention", response_model=RetentionSettingsResponse)
async def get_retention_settings(current_user: str = Depends(get_current_admin_user)):
    """Get current retention settings"""
    try:
        # For now, we'll use a default retention period of 30 days
        # In a production system, this would be stored in a settings table or environment variable
        # We'll check if there's a retention setting in audit log or we'll use a default

        # Let's look for the most recent retention run in audit log
        last_run_query = select(auditLog).where(
            auditLog.c.action == 'retention_run'
        ).order_by(auditLog.c.createdAt.desc()).limit(1)

        last_run_result = await db.fetch_one(last_run_query)
        last_run = None
        last_run_deleted_count = None

        if last_run_result:
            last_run = last_run_result['createdAt']
            # Extract deleted count from details if available
            details = last_run_result['details']
            if details and isinstance(details, dict):
                last_run_deleted_count = details.get('deleted_count')

        # Default retention days - we'll store this in a simple way for now
        # In production, you'd want a proper settings table
        retention_days = 30  # Default

        # Try to get from environment or a settings mechanism
        # For now, we'll just use the default

        return RetentionSettingsResponse(
            retention_days=retention_days,
            last_run=last_run,
            last_run_deleted_count=last_run_deleted_count
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/retention/run", response_model=RetentionRunResponse)
async def run_retention_job(current_user: str = Depends(get_current_admin_user)):
    """Run the retention job to delete old proctoring media"""
    try:
        # Get retention period (default 30 days)
        retention_days = 30  # TODO: Make this configurable
        cutoff_date = datetime.now(UTC) - timedelta(days=retention_days)

        # First, find evidence that is safe to delete:
        # 1. Older than retention period
        # 2. Not referenced by interviews that are still active or need human review

        # Get interviews that we should keep evidence for:
        # - Interviews that are not completed/cancelled/missed/rescheduled (still in process)
        # - Interviews that have human review required
        protected_interviews_query = select(interview.c.id).where(
            or_(
                interview.c.status.in_(['scheduled', 'baseline', 'active']),  # Still in progress
                # Interviews that need human review (we'll approximate)
                and_(
                    interview.c.riskScore.is_not(None),
                    interview.c.riskScore >= 80
                )
            )
        )
        protected_interviews_result = await db.fetch_all(protected_interviews_query)
        protected_interview_ids = [row['id'] for row in protected_interviews_result] if protected_interviews_result else []

        # Also protect evidence linked to evaluations where score variance is high
        # (these might need human review even if interview is completed)
        protected_via_evaluation_query = select(evidence.c.id).select_from(
            evidence.join(interview, evidence.c.interviewId == interview.c.id)
            .join(evaluation, interview.c.id == evaluation.c.interviewId, isouter=True)
        ).where(
            or_(
                interview.c.status.in_(['scheduled', 'baseline', 'active']),
                and_(
                    interview.c.riskScore.is_not(None),
                    evaluation.c.score.is_not(None),
                    func.abs(interview.c.riskScore - evaluation.c.score) > 30
                ),
                evaluation.c.feedback.ilike('%needs human review%')
            )
        )
        protected_via_evaluation_result = await db.fetch_all(protected_via_evaluation_query)
        protected_via_evaluation_ids = [row['id'] for row in protected_via_evaluation_result] if protected_via_evaluation_result else []

        # Combine all protected evidence IDs
        protected_evidence_ids = list(set(protected_interview_ids + protected_via_evaluation_ids))

        # Find evidence to delete: older than cutoff and not protected
        evidence_to_delete_query = select(evidence.c.id).where(
            and_(
                evidence.c.createdAt < cutoff_date,
                # Not protected by interview status
                ~evidence.c.interviewId.in_(protected_evidence_ids) if protected_evidence_ids else True
            )
        )

        # For safety, if we have no protected IDs, we'll still delete old evidence
        # but we'll add an extra check to not delete too much at once
        evidence_to_delete_result = await db.fetch_all(evidence_to_delete_query)
        evidence_to_delete_ids = [row['id'] for row in evidence_to_delete_result] if evidence_to_delete_result else []

        # Limit deletion to prevent accidental mass deletion (safety feature)
        MAX_DELETE_PER_RUN = 1000
        if len(evidence_to_delete_ids) > MAX_DELETE_PER_RUN:
            evidence_to_delete_ids = evidence_to_delete_ids[:MAX_DELETE_PER_RUN]

        deleted_count = 0
        if evidence_to_delete_ids:
            # Delete the evidence records
            delete_query = delete(evidence).where(evidence.c.id.in_(evidence_to_delete_ids))
            delete_result = await db.execute(delete_query)
            deleted_count = delete_result.rowcount if hasattr(delete_result, 'rowcount') else len(evidence_to_delete_ids)

            # Log the retention run
            await db.execute(
                auditLog.insert().values(
                    userId=current_user,
                    action='retention_run',
                    entityType='system',
                    entityId=None,
                    details={
                        'retention_days': retention_days,
                        'cutoff_date': cutoff_date.isoformat(),
                        'deleted_count': deleted_count,
                        'protected_count': len(protected_evidence_ids),
                        'total_evidence_considered': len(evidence_to_delete_ids) + len([e for e in evidence_to_delete_result]) if evidence_to_delete_result else 0
                    }
                )
            )

        # Count retained evidence (for reporting)
        retained_count_query = select(func.count()).select_from(evidence).where(
            evidence.c.createdAt >= cutoff_date
        )
        retained_count_result = await db.fetch_one(retained_count_query)
        retained_count = retained_count_result[0] if retained_count_result else 0

        return RetentionRunResponse(
            deleted_count=deleted_count,
            retained_count=retained_count,
            run_at=datetime.now(UTC)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/retention", response_model=RetentionSettingsResponse)
async def update_retention_settings(
    request: UpdateRetentionRequest,
    current_user: str = Depends(get_current_admin_user)
):
    """Update retention period settings"""
    try:
        # Validate retention days
        if request.retention_days < 1 or request.retention_days > 365:
            raise HTTPException(
                status_code=400,
                detail="Retention period must be between 1 and 365 days"
            )

        # In a real system, we'd store this in a settings table
        # For now, we'll just log the change and return the new setting
        # The actual retention period will be used in the run endpoint

        # Log the settings change
        await db.execute(
            auditLog.insert().values(
                userId=current_user,
                action='retention_settings_updated',
                entityType='system',
                entityId=None,
                details={
                    'old_retention_days': 30,  # We don't have a way to get the old value yet
                    'new_retention_days': request.retention_days
                }
            )
        )

        # Return updated settings
        return RetentionSettingsResponse(
            retention_days=request.retention_days,
            last_run=None,  # We don't have easy access to last run without querying
            last_run_deleted_count=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Placeholder for model/config endpoint
@router.get("/config")
async def get_model_config(current_user: str = Depends(get_current_admin_user)):
    """Get current model/configuration (placeholder)"""
    return {
        "risk_weights": {
            "behavioral": 0.4,
            "engagement": 0.3,
            "concerns": 0.2,
            "consistency": 0.1
        },
        "feature_flags": {
            "DEBUG_CV": False,
            "ENABLE_AUDIT_LOG": True,
            "RETENTION_ENABLED": True
        },
        "note": "Configuration is showing default values. In production, these would be configurable via environment variables or admin settings."
    }