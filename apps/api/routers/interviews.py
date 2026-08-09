from datetime import UTC, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status, Header
from pydantic import BaseModel
from apps.web.lib.db.index import db
from apps.web.lib.db.schema import interview, candidateProfile, recruiterProfile, job, pipeline, user
from apps.web.lib.db.schema import userRole
from sqlalchemy import select, update, and_, or_
from apps.api.services.email_service import EmailService
from apps.api.services.audit_service import AuditService

router = APIRouter()


async def get_current_user(x_user_id: str = Header(None)) -> str:
    """Get current user ID from header"""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return x_user_id


class InterviewResponse(BaseModel):
    id: int
    candidateId: int
    recruiterId: int
    pipelineId: int
    status: str
    scheduledAt: datetime
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    durationMinutes: Optional[int] = None
    roomUrl: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime
    humanReviewRequired: bool


class InterviewCreateRequest(BaseModel):
    candidateId: int
    jobId: int
    scheduledAt: datetime
    durationMinutes: int = 30  # Default 30 minutes


class InterviewUpdateRequest(BaseModel):
    status: Optional[str] = None
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None


@router.get("/", response_model=List[InterviewResponse])
async def get_interviews(
    recruiterId: Optional[int] = Query(None, description="Filter by recruiter ID"),
    candidateId: Optional[int] = Query(None, description="Filter by candidate ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    """Get interviews with optional filtering"""
    try:
        query = select(
            interview,
            evaluation.c.score.label('evaluationScore'),
            evaluation.c.feedback.label('evaluationFeedback')
        ).select_from(
            interview.join(
                evaluation, interview.c.id == evaluation.c.interviewId, isouter=True
            )
        )

        conditions = []
        if recruiterId is not None:
            conditions.append(interview.c.recruiterId == recruiterId)
        if candidateId is not None:
            conditions.append(interview.c.userId == candidateId)
        if status is not None:
            conditions.append(interview.c.status == status)

        if conditions:
            query = query.where(and_(*conditions))

        query = query.limit(limit).offset(offset)

        result = await db.fetch_all(query)

        interviews = []
        for row in result:
            interview_dict = dict(row)

            # Compute humanReviewRequired
            risk_score = interview_dict.get('riskScore')
            eval_score = interview_dict.get('evaluationScore')
            eval_feedback = interview_dict.get('evaluationFeedback')

            human_review = False
            if risk_score is not None and risk_score >= 80:
                human_review = True
            elif eval_score is not None and risk_score is not None:
                if abs(risk_score - eval_score) > 30:
                    human_review = True
            elif eval_feedback is not None and isinstance(eval_feedback, str):
                if 'needs human review' in eval_feedback.lower():
                    human_review = True

            interview_dict['humanReviewRequired'] = human_review
            interviews.append(interview_dict)

        return interviews
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=InterviewResponse)
async def create_interview(request: InterviewCreateRequest):
    """Schedule a new interview"""
    try:
        # Get candidate and job info for email
        candidate_query = select(
            candidateProfile,
            user.c.email
        ).select_from(
            candidateProfile.join(
                user, candidateProfile.c.userId == user.c.id
            )
        ).where(
            candidateProfile.c.id == request.candidateId
        )
        job_query = select(
            job,
            recruiterProfile.c.organizationName
        ).select_from(
            job.join(
                recruiterProfile, job.c.userId == recruiterProfile.c.userId
            )
        ).where(
            job.c.id == request.jobId
        )

        candidate_result = await db.fetch_one(candidate_query)
        job_result = await db.fetch_one(job_query)

        if not candidate_result:
            raise HTTPException(status_code=404, detail="Candidate not found")
        if not job_result:
            raise HTTPException(status_code=404, detail="Job not found")

        # Get recruiter ID from job
        recruiter_id = job_result['userId']

        # Create pipeline entry first
        pipeline_insert = pipeline.insert().values(
            userId=recruiter_id,  # recruiter userId
            jobId=request.jobId,
            candidateId=request.candidateId,
            stage='interview'
        )
        pipeline_result = await db.execute(pipeline_insert)
        pipeline_id = pipeline_result.lastrowid

        # Create interview
        insert_query = interview.insert().values(
            userId=request.candidateId,
            recruiterId=recruiter_id,
            pipelineId=pipeline_id,
            status='scheduled',
            scheduledAt=request.scheduledAt,
            durationMinutes=request.durationMinutes
        )

        result = await db.execute(insert_query)
        interview_id = result.lastrowid

        # Fetch the created interview
        select_query = select(interview).where(interview.c.id == interview_id)
        created_interview = await db.fetch_one(select_query)

        # Send email notification
        interview_data = {
            'jobTitle': job_result['title'],
            'company': job_result['organizationName'],
            'scheduledAt': request.scheduledAt.strftime('%Y-%m-%d %H:%M UTC'),
            'candidateEmail': candidate_result['email']
        }

        await EmailService.send_interview_scheduled(
            candidate_email=candidate_result['email'],
            interview_data=interview_data
        )

        # Schedule reminder emails (would use a background job queue in production)
        # await EmailService.send_interview_reminder(..., hours_before=24)
        # await EmailService.send_interview_reminder(..., hours_before=1)

        # Audit log for interview scheduled
        await AuditService.log_event(
            user_id=str(recruiter_id),
            action="interview_scheduled",
            entityType="interview",
            entityId=interview_id,
            details={
                "candidateId": request.candidateId,
                "jobId": request.jobId,
                "scheduledAt": request.scheduledAt.isoformat(),
                "durationMinutes": request.durationMinutes
            }
        )

        return dict(created_interview)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{interview_id}", response_model=InterviewResponse)
async def get_interview(interview_id: int):
    """Get a specific interview by ID"""
    try:
        query = select(
            interview,
            evaluation.c.score.label('evaluationScore'),
            evaluation.c.feedback.label('evaluationFeedback')
        ).select_from(
            interview.join(
                evaluation, interview.c.id == evaluation.c.interviewId, isouter=True
            )
        ).where(interview.c.id == interview_id)

        result = await db.fetch_one(query)

        if not result:
            raise HTTPException(status_code=404, detail="Interview not found")

        # Convert to dict
        interview_dict = dict(result)

        # Compute humanReviewRequired
        risk_score = interview_dict.get('riskScore')
        eval_score = interview_dict.get('evaluationScore')
        eval_feedback = interview_dict.get('evaluationFeedback')

        human_review = False
        if risk_score is not None and risk_score >= 80:
            human_review = True
        elif eval_score is not None and risk_score is not None:
            if abs(risk_score - eval_score) > 30:
                human_review = True
        elif eval_feedback is not None and isinstance(eval_feedback, str):
            if 'needs human review' in eval_feedback.lower():
                human_review = True

        interview_dict['humanReviewRequired'] = human_review

        return interview_dict
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{interview_id}", response_model=InterviewResponse)
async def update_interview(interview_id: int, request: InterviewUpdateRequest):
    """Update an interview (e.g., mark as started, completed, missed)"""
    try:
        # Check if interview exists
        select_query = select(interview).where(interview.c.id == interview_id)
        existing = await db.fetch_one(select_query)

        if not existing:
            raise HTTPException(status_code=404, detail="Interview not found")

        # Prepare update data
        update_data = {"updatedAt": datetime.now(UTC)}
        changes = {}

        if request.status is not None:
            update_data["status"] = request.status
            changes["status"] = request.status
        if request.startedAt is not None:
            update_data["startedAt"] = request.startedAt
            changes["startedAt"] = request.startedAt.isoformat()
        if request.completedAt is not None:
            update_data["completedAt"] = request.completedAt
            changes["completedAt"] = request.completedAt.isoformat()

        if changes:
            # Update interview
            update_query = (
                update(interview)
                .where(interview.c.id == interview_id)
                .values(**update_data)
            )

            await db.execute(update_query)

            # Fetch updated interview
            select_query = select(interview).where(interview.c.id == interview_id)
            updated_interview = await db.fetch_one(select_query)

            # If interview was marked as missed, send email notification
            if request.status == "missed":
                # Fetch candidate email and job details
                candidate_query = select(
                    candidateProfile,
                    user.c.email
                ).select_from(
                    candidateProfile.join(
                        user, candidateProfile.c.userId == user.c.id
                    )
                ).where(
                    candidateProfile.c.id == existing['candidateId']
                )
                job_query = select(
                    job,
                    recruiterProfile.c.organizationName
                ).select_from(
                    job.join(
                        recruiterProfile, job.c.userId == recruiterProfile.c.userId
                    )
                ).where(
                    job.c.id == existing['jobId']
                )

                candidate_result = await db.fetch_one(candidate_query)
                job_result = await db.fetch_one(job_query)

                if candidate_result and job_result:
                    interview_data = {
                        'jobTitle': job_result['title'],
                        'company': job_result['organizationName'],
                        'scheduledAt': existing['scheduledAt'].strftime('%Y-%m-%d %H:%M UTC') if existing['scheduledAt'] else 'Unknown',
                        'candidateEmail': candidate_result['email']
                    }
                    await EmailService.send_interview_missed(
                        candidate_email=candidate_result['email'],
                        interview_data=interview_data
                    )
                else:
                    # Fallback if data not found
                    await EmailService.send_interview_missed(
                        candidate_email="candidate@example.com",
                        interview_data={
                            'jobTitle': 'Unknown Job',
                            'scheduledAt': existing['scheduledAt'].strftime('%Y-%m-%d %H:%M UTC') if existing['scheduledAt'] else 'Unknown'
                        }
                    )

            # Audit log for interview update
            await AuditService.log_event(
                user_id=str(existing['recruiterId']),
                action="interview_updated",
                entityType="interview",
                entityId=interview_id,
                details={
                    "changes": changes,
                    "oldStatus": existing['status'],
                    "newStatus": updated_interview['status'] if updated_interview else None
                }
            )
        else:
            # If no changes, just fetch the existing interview to return
            select_query = select(interview).where(interview.c.id == interview_id)
            updated_interview = await db.fetch_one(select_query)

        return dict(updated_interview)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{interview_id}/start")
async def start_interview(interview_id: int):
    """Mark interview as started (in progress)"""
    try:
        update_query = (
            update(interview)
            .where(interview.c.id == interview_id)
            .values(
                status='active',
                startedAt=datetime.now(UTC),
                updatedAt=datetime.now(UTC)
            )
        )

        result = await db.execute(update_query)

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Interview not found")

        # Fetch updated interview
        select_query = select(interview).where(interview.c.id == interview_id)
        updated_interview = await db.fetch_one(select_query)

        # Audit log for interview started
        await AuditService.log_event(
            user_id=str(updated_interview['recruiterId']),
            action="interview_started",
            entityType="interview",
            entityId=interview_id,
            details={
                "startedAt": updated_interview['startedAt'].isoformat() if updated_interview['startedAt'] else None
            }
        )

        return dict(updated_interview)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{interview_id}/complete")
async def complete_interview(interview_id: int):
    """Mark interview as completed"""
    try:
        update_query = (
            update(interview)
            .where(interview.c.id == interview_id)
            .values(
                status='completed',
                completedAt=datetime.now(UTC),
                updatedAt=datetime.now(UTC)
            )
        )

        result = await db.execute(update_query)

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Interview not found")

        # Fetch updated interview
        select_query = select(interview).where(interview.c.id == interview_id)
        updated_interview = await db.fetch_one(select_query)

        # Audit log for interview completed
        await AuditService.log_event(
            user_id=str(updated_interview['recruiterId']),
            action="interview_completed",
            entityType="interview",
            entityId=interview_id,
            details={
                "completedAt": updated_interview['completedAt'].isoformat() if updated_interview['completedAt'] else None
            }
        )

        return dict(updated_interview)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{interview_id}/missed")
async def mark_interview_missed(interview_id: int):
    """Mark interview as missed (no-show)"""
    try:
        # Check if interview exists
        select_query = select(interview).where(interview.c.id == interview_id)
        existing_interview = await db.fetch_one(select_query)

        if not existing_interview:
            raise HTTPException(status_code=404, detail="Interview not found")

        # Update interview
        update_query = (
            update(interview)
            .where(interview.c.id == interview_id)
            .values(
                status='missed',
                updatedAt=datetime.now(UTC)
            )
        )

        result = await db.execute(update_query)

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Interview not found")

        # Fetch updated interview
        select_query = select(interview).where(interview.c.id == interview_id)
        updated_interview = await db.fetch_one(select_query)

        # Send email notification for missed interview
        # Fetch candidate email and job details
        candidate_query = select(
            candidateProfile,
            user.c.email
        ).select_from(
            candidateProfile.join(
                user, candidateProfile.c.userId == user.c.id
            )
        ).where(
            candidateProfile.c.id == existing_interview['candidateId']
        )
        # Get job via pipeline: interview -> pipeline -> job
        pipeline_query = select(
            pipeline,
            job.c.title,
            recruiterProfile.c.organizationName
        ).select_from(
            pipeline.join(
                job, pipeline.c.jobId == job.c.id
            ).join(
                recruiterProfile, job.c.userId == recruiterProfile.c.userId
            )
        ).where(
            pipeline.c.id == existing_interview['pipelineId']
        )

        candidate_result = await db.fetch_one(candidate_query)
        job_result = await db.fetch_one(pipeline_query)

        if candidate_result and job_result:
            interview_data = {
                'jobTitle': job_result['title'],
                'company': job_result['organizationName'],
                'scheduledAt': existing_interview['scheduledAt'].strftime('%Y-%m-%d %H:%M UTC') if existing_interview['scheduledAt'] else 'Unknown',
                'candidateEmail': candidate_result['email']
            }
            await EmailService.send_interview_missed(
                candidate_email=candidate_result['email'],
                interview_data=interview_data
            )
        else:
            # Fallback if data not found
            await EmailService.send_interview_missed(
                candidate_email="candidate@example.com",
                interview_data={
                    'jobTitle': 'Unknown Job',
                    'scheduledAt': existing_interview['scheduledAt'].strftime('%Y-%m-%d %H:%M UTC') if existing_interview['scheduledAt'] else 'Unknown'
                }
            )

        # Audit log for interview marked as missed
        await AuditService.log_event(
            user_id=str(updated_interview['recruiterId']),
            action="interview_missed",
            entityType="interview",
            entityId=interview_id,
            details={
                "missedAt": updated_interview['updatedAt'].isoformat() if updated_interview['updatedAt'] else None,
                "scheduledAt": existing_interview['scheduledAt'].isoformat() if existing_interview['scheduledAt'] else None
            }
        )

        return dict(updated_interview)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{interview_id}/reschedule")
async def reschedule_interview(interview_id: int, request: InterviewCreateRequest):
    """Reschedule a missed interview"""
    try:
        # Check if interview exists and is missed
        select_query = select(interview).where(interview.c.id == interview_id)
        existing = await db.fetch_one(select_query)

        if not existing:
            raise HTTPException(status_code=404, detail="Interview not found")

        if existing['status'] != 'missed':
            raise HTTPException(status_code=400, detail="Only missed interviews can be rescheduled")

        # Update interview with new time
        update_query = (
            update(interview)
            .where(interview.c.id == interview_id)
            .values(
                status='rescheduled',
                scheduledAt=request.scheduledAt,
                durationMinutes=request.durationMinutes,
                updatedAt=datetime.now(UTC)
            )
        )

        await db.execute(update_query)

        # Fetch updated interview
        select_query = select(interview).where(interview.c.id == interview_id)
        updated_interview = await db.fetch_one(select_query)

        # Send email notification for rescheduled interview
        # Fetch candidate email and job details
        candidate_query = select(
            candidateProfile,
            user.c.email
        ).select_from(
            candidateProfile.join(
                user, candidateProfile.c.userId == user.c.id
            )
        ).where(
            candidateProfile.c.id == existing['candidateId']
        )
        # Get job via pipeline: interview -> pipeline -> job
        pipeline_query = select(
            pipeline,
            job.c.title,
            recruiterProfile.c.organizationName
        ).select_from(
            pipeline.join(
                job, pipeline.c.jobId == job.c.id
            ).join(
                recruiterProfile, job.c.userId == recruiterProfile.c.userId
            )
        ).where(
            pipeline.c.id == existing['pipelineId']
        )

        candidate_result = await db.fetch_one(candidate_query)
        job_result = await db.fetch_one(pipeline_query)

        if candidate_result and job_result:
            interview_data = {
                'jobTitle': job_result['title'],
                'company': job_result['organizationName'],
                'scheduledAt': request.scheduledAt.strftime('%Y-%m-%d %H:%M UTC'),
                'candidateEmail': candidate_result['email']
            }
            await EmailService.send_interview_scheduled(
                candidate_email=candidate_result['email'],
                interview_data=interview_data
            )
        else:
            # Fallback if data not found
            await EmailService.send_interview_scheduled(
                candidate_email="candidate@example.com",
                interview_data={
                    'jobTitle': 'Unknown Job',
                    'scheduledAt': request.scheduledAt.strftime('%Y-%m-%d %H:%M UTC')
                }
            )

        # Audit log for interview rescheduled
        await AuditService.log_event(
            user_id=str(updated_interview['recruiterId']),
            action="interview_rescheduled",
            entityType="interview",
            entityId=interview_id,
            details={
                "oldScheduledAt": existing['scheduledAt'].isoformat() if existing['scheduledAt'] else None,
                "newScheduledAt": request.scheduledAt.isoformat(),
                "durationMinutes": request.durationMinutes
            }
        )

        return dict(updated_interview)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Background task to check for no-shows (would be run periodically)
async def check_for_no_shows():
    """Check for interviews that should be marked as missed (no-show)"""
    try:
        now = datetime.now(UTC)

        # Find interviews that are scheduled but past their grace period
        # Window: 15 minutes before start until end of scheduled duration + 5 minute grace
        query = select(interview).where(
            and_(
                interview.c.status == 'scheduled',
                interview.c.scheduledAt <= now,  # Past scheduled start time
                # Calculate end time: scheduledAt + durationMinutes + 5 minute grace
                interview.c.scheduledAt +
                (interview.c.durationMinutes * 60) +  # Convert minutes to seconds
                (5 * 60)  # 5 minute grace period
                <= now  # Past end time + grace
            )
        )

        result = await db.fetch_all(query)

        for row in result:
            interview_id = row['id']

            # Mark as missed
            update_query = (
                update(interview)
                .where(interview.c.id == interview_id)
                .values(
                    status='missed',
                    updatedAt=now
                )
            )

            await db.execute(update_query)

            # Fetch updated interview to get the recruiterId for the audit log
            # We'll fetch the interview again to get the updated recruiterId (though it shouldn't change)
            select_query = select(interview).where(interview.c.id == interview_id)
            updated_interview = await db.fetch_one(select_query)

            # Send email notification
            # Fetch candidate email and job details
            candidate_query = select(
                candidateProfile,
                user.c.email
            ).select_from(
                candidateProfile.join(
                    user, candidateProfile.c.userId == user.c.id
                )
            ).where(
                candidateProfile.c.id == row['candidateId']
            )
            # Get job via pipeline: interview -> pipeline -> job
            pipeline_query = select(
                pipeline,
                job.c.title,
                recruiterProfile.c.organizationName
            ).select_from(
                pipeline.join(
                    job, pipeline.c.jobId == job.c.id
                ).join(
                    recruiterProfile, job.c.userId == recruiterProfile.c.userId
                )
            ).where(
                pipeline.c.id == row['pipelineId']
            )

            candidate_result = await db.fetch_one(candidate_query)
            job_result = await db.fetch_one(pipeline_query)

            if candidate_result and job_result:
                interview_data = {
                    'jobTitle': job_result['title'],
                    'company': job_result['organizationName'],
                    'scheduledAt': row['scheduledAt'].strftime('%Y-%m-%d %H:%M UTC') if row['scheduledAt'] else 'Unknown',
                    'candidateEmail': candidate_result['email']
                }
                await EmailService.send_interview_missed(
                    candidate_email=candidate_result['email'],
                    interview_data=interview_data
                )
            else:
                # Fallback if data not found
                await EmailService.send_interview_missed(
                    candidate_email="candidate@example.com",
                    interview_data={
                        'jobTitle': 'Unknown Job',
                        'scheduledAt': row['scheduledAt'].strftime('%Y-%m-%d %H:%M UTC') if row['scheduledAt'] else 'Unknown'
                    }
                )

            # Audit log for interview marked as missed (no-show)
            await AuditService.log_event(
                user_id=str(updated_interview['recruiterId']) if updated_interview and updated_interview['recruiterId'] else None,
                action="interview_missed",
                entityType="interview",
                entityId=interview_id,
                details={
                    "missedAt": now.isoformat(),
                    "scheduledAt": row['scheduledAt'].isoformat() if row['scheduledAt'] else None
                }
            )

    except Exception as e:
        print(f"Error checking for no-shows: {e}")