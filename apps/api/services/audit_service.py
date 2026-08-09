from datetime import UTC, datetime
from typing import Optional, Dict, Any
from apps.web.lib.db.index import db
from apps.web.lib.db.schema import auditLog
from sqlalchemy import insert

class AuditService:
    @staticmethod
    async def log_event(
        user_id: Optional[str] = None,
        action: str = "",
        entity_type: str = "",
        entity_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        """
        Log an audit event.
        """
        try:
            # Prepare the insert statement
            stmt = insert(auditLog).values(
                userId=user_id,
                action=action,
                entityType=entity_type,
                entityId=entity_id,
                details=details or {},
                createdAt=datetime.now(UTC)
            )

            # Execute the insert
            await db.execute(stmt)
        except Exception as e:
            # In production, we might want to send this to a monitoring service
            # For now, we'll print to console but not raise to avoid breaking the flow
            print(f"Audit logging failed: {e}")