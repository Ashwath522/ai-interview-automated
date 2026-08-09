from datetime import UTC, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from apps.web.lib.db.index import db
from apps.web.lib.db.schema import auditLog, user
from sqlalchemy import select, and_
from apps.api.routers.interviews import get_current_user  # We'll need to import the auth dependency

# We'll reuse the authentication dependency from the interviews router or create our own.
# For simplicity, we'll assume we have a way to get the current user.
# We'll create a simple dependency that checks the session or token.
# Since we don't have an auth service yet, we'll mimic the pattern from interviews router.
# However, note that the interviews router doesn't have an auth dependency yet.
# We'll need to implement authentication. But for now, we'll assume the user is authenticated via middleware.
# We'll create a placeholder for getting the current user ID.

# Let's create a simple dependency that extracts user ID from the request headers or token.
# In a real app, we would use the same authentication as in the interviews router.
# We'll copy the authentication logic from the interviews router if it exists, or we'll create a simple one.

# Since we don't have time to implement full auth, we'll assume that the user is passed in via a header for now.
# But note: the requirement is to log the user who performed the action, so we need to get the user ID from the context.

# We'll create a function to get the current user ID from the request (to be implemented based on your auth system).
# For now, we'll leave it as a placeholder and in the audit log, we'll set userId to None if we can't get it.

# We'll also need to protect the GET endpoint so that only recruiters and admins can view audit logs.

# We'll create a simple router for now.

router = APIRouter()

class AuditLogResponse(BaseModel):
    id: int
    userId: Optional[str]
    action: str
    entityType: str
    entityId: Optional[int]
    details: Optional[Dict[str, Any]]
    createdAt: datetime

    class Config:
        from_attributes = True

@router.get("/", response_model=List[AuditLogResponse])
async def get_audit_logs(
    interviewId: Optional[int] = Query(None, description="Filter by interview ID"),
    candidateId: Optional[int] = Query(None, description="Filter by candidate ID"),
    jobId: Optional[int] = Query(None, description="Filter by job ID"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user: str = Depends(get_current_user)
):
    """
    Get audit logs with optional filtering.
    Only accessible by recruiters and admins.
    """
    try:
        # Check if user is authenticated and has recruiter or admin role
        # Get user role from database
        user_role_query = select(userRole.c.role).where(userRole.c.userId == current_user)
        user_role_result = await db.fetch_one(user_role_query)
        if not user_role_result:
            raise HTTPException(status_code=401, detail="User not found")
        user_role = user_role_result["role"]
        if user_role not in ("recruiter", "admin"):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Build the query
        query = select(auditLog)

        conditions = []
        if interviewId is not None:
            # We need to join with interview to filter by interviewId?
            # But we are storing the interviewId in entityId when entityType is 'interview'
            conditions.append(and_(
                auditLog.entityType == 'interview',
                auditLog.entityId == interviewId
            ))
        if candidateId is not None:
            conditions.append(and_(
                auditLog.entityType == 'candidate',
                auditLog.entityId == candidateId
            ))
        if jobId is not None:
            conditions.append(and_(
                auditLog.entityType == 'job',
                auditLog.entityId == jobId
            ))

        if conditions:
            # We need to OR the conditions? Actually, we want logs that match any of the filters.
            # But note: a log entry is for one entity type. So we can OR the conditions.
            from sqlalchemy import or_
            query = query.where(or_(*conditions))

        query = query.order_by(auditLog.createdAt.desc()).limit(limit).offset(offset)

        result = await db.fetch_all(query)
        return [dict(row) for row in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))