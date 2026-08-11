'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import {
  userRole,
  job,
  recruiterProfile,
  interview,
  candidateProfile,
  evaluation,
  user,
  pipeline,
  auditLog,
  evidence,
} from '@/lib/db/schema'
import { eq, and, inArray, or } from 'drizzle-orm'

/**
 * Resolve the current user id from the Better Auth session.
 * Every server action that touches user data MUST go through this helper.
 */
async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function getCurrentRole(): Promise<'admin' | 'recruiter' | 'candidate' | null> {
  try {
    const userId = await getUserId()
    const rows = await db
      .select({ role: userRole.role })
      .from(userRole)
      .where(eq(userRole.userId, userId))
      .limit(1)

    const role = rows[0]?.role
    return role === 'admin' || role === 'recruiter' || role === 'candidate' ? role : null
  } catch {
    return null
  }
}

async function requireRole(role: 'admin' | 'recruiter' | 'candidate') {
  const userId = await getUserId()
  const rows = await db
    .select({ role: userRole.role })
    .from(userRole)
    .where(eq(userRole.userId, userId))
    .limit(1)

  if (rows[0]?.role !== role) throw new Error('Forbidden')
  return userId
}

async function recruiterOwnsJob(recruiterId: string, jobId: number) {
  const rows = await db
    .select({ id: job.id })
    .from(job)
    .where(and(eq(job.id, jobId), eq(job.userId, recruiterId)))
    .limit(1)
  return rows.length > 0
}

async function recruiterOwnsInterview(recruiterId: string, interviewId: number) {
  const rows = await db
    .select({ id: interview.id })
    .from(interview)
    .where(and(eq(interview.id, interviewId), eq(interview.recruiterId, recruiterId)))
    .limit(1)
  return rows.length > 0
}

/**
 * Check if the current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const userId = await getUserId()
    const result = await db
      .select({ role: userRole.role })
      .from(userRole)
      .where(eq(userRole.userId, userId))
      .limit(1)

    return result.length > 0 && result[0].role === 'admin'
  } catch (error) {
    console.error('Failed to check admin role:', error)
    return false
  }
}

/**
 * Get jobs for the current recruiter
 */
export async function getRecruiterJobs(): Promise<
  { id: number; title: string; organizationName: string }[]
> {
  try {
    const userId = await requireRole('recruiter')
    const jobsResult = await db
      .select({
        id: job.id,
        title: job.title,
        organizationName: recruiterProfile.organizationName,
      })
      .from(job)
      .innerJoin(recruiterProfile, eq(job.userId, recruiterProfile.userId))
      .where(eq(recruiterProfile.userId, userId))

    return jobsResult
  } catch (error) {
    console.error('Failed to get recruiter jobs:', error)
    return []
  }
}

/**
 * Get completed interviews for the current recruiter's jobs.
 * Returns serialisable plain objects (no Date instances).
 */
export async function getCompletedInterviews(): Promise<
  {
    id: number
    candidateName: string
    jobTitle: string
    company: string
    scheduledAt: string
    status: 'scheduled' | 'baseline' | 'active' | 'completed' | 'cancelled' | 'missed' | 'rescheduled'
    riskScore: number | null
    interviewScore: number | null
    humanReviewRequired: boolean
  }[]
> {
  try {
    const userId = await requireRole('recruiter')

    const jobsResult = await db
      .select({ id: job.id })
      .from(job)
      .innerJoin(recruiterProfile, eq(job.userId, recruiterProfile.userId))
      .where(eq(recruiterProfile.userId, userId))

    const jobIds = jobsResult.map((j) => j.id)

    if (jobIds.length === 0) return []

    const completedResult = await db
      .select({
        interviewId: interview.id,
        candidateName: candidateProfile.fullName,
        jobTitle: job.title,
        company: recruiterProfile.organizationName,
        scheduledAt: interview.scheduledAt,
        status: interview.status,
        riskScore: interview.riskScore,
        evaluationScore: evaluation.score,
        evaluationFeedback: evaluation.feedback,
      })
      .from(interview)
      .innerJoin(candidateProfile, eq(interview.userId, candidateProfile.userId))
      .innerJoin(user, eq(candidateProfile.userId, user.id))
      .innerJoin(pipeline, eq(interview.pipelineId, pipeline.id))
      .innerJoin(job, eq(pipeline.jobId, job.id))
      .innerJoin(recruiterProfile, eq(job.userId, recruiterProfile.userId))
      .leftJoin(evaluation, eq(evaluation.interviewId, interview.id))
      .where(
        and(
          inArray(pipeline.jobId, jobIds),
          or(
            eq(interview.status, 'completed'),
            eq(interview.status, 'missed'),
            eq(interview.status, 'rescheduled'),
          ),
        ),
      )
      .orderBy(interview.scheduledAt)

    return completedResult.map((row) => {
      const humanReviewRequired =
        (row.riskScore !== null && row.riskScore >= 80) ||
        (row.evaluationScore !== null &&
          row.riskScore !== null &&
          Math.abs(row.riskScore - row.evaluationScore) > 30) ||
        (typeof row.evaluationFeedback === 'string' &&
          row.evaluationFeedback.toLowerCase().includes('needs human review'))

      return {
        id: row.interviewId,
        candidateName: row.candidateName ?? '',
        jobTitle: row.jobTitle ?? '',
        company: row.company ?? '',
        // Serialize Date → ISO string so the value is safe across the server/client boundary
        scheduledAt: row.scheduledAt ? new Date(row.scheduledAt).toISOString() : new Date().toISOString(),
        status: (row.status ?? 'completed') as
          | 'scheduled'
          | 'baseline'
          | 'active'
          | 'completed'
          | 'cancelled'
          | 'missed'
          | 'rescheduled',
        riskScore: row.riskScore ?? null,
        interviewScore: row.evaluationScore ?? null,
        humanReviewRequired,
      }
    })
  } catch (error) {
    console.error('Failed to get completed interviews:', error)
    return []
  }
}

/**
 * Get shortlist candidates for the current recruiter's jobs.
 * Returns serialisable plain objects.
 */
export async function getShortlistCandidates(): Promise<
  {
    candidateId: number
    candidateName: string
    jobTitle: string
    company: string
    jobId: number
    interviewId: number | null
    scheduledAt: string | null
    riskScore: number | null
    interviewScore: number | null
    humanReviewRequired: boolean
  }[]
> {
  try {
    const userId = await requireRole('recruiter')

    const jobsResult = await db
      .select({ id: job.id })
      .from(job)
      .innerJoin(recruiterProfile, eq(job.userId, recruiterProfile.userId))
      .where(eq(recruiterProfile.userId, userId))

    const jobIds = jobsResult.map((j) => j.id)

    if (jobIds.length === 0) return []

    const shortlistResult = await db
      .select({
        candidateId: candidateProfile.id,
        candidateName: candidateProfile.fullName,
        jobTitle: job.title,
        company: recruiterProfile.organizationName,
        jobId: job.id,
        interviewId: pipeline.interviewId,
        scheduledAt: interview.scheduledAt,
        riskScore: interview.riskScore,
        interviewScore: evaluation.score,
        evaluationFeedback: evaluation.feedback,
      })
      .from(pipeline)
      .innerJoin(candidateProfile, eq(pipeline.candidateId, candidateProfile.id))
      .innerJoin(job, eq(pipeline.jobId, job.id))
      .innerJoin(recruiterProfile, eq(job.userId, recruiterProfile.userId))
      .leftJoin(interview, eq(pipeline.interviewId, interview.id))
      .leftJoin(evaluation, eq(evaluation.interviewId, interview.id))
      .where(and(inArray(pipeline.jobId, jobIds), eq(pipeline.stage, 'shortlist')))
      .orderBy(pipeline.updatedAt)

    return shortlistResult.map((row) => {
      const humanReviewRequired =
        (row.riskScore !== null && row.riskScore >= 80) ||
        (typeof row.evaluationFeedback === 'string' &&
          row.evaluationFeedback.toLowerCase().includes('needs human review'))

      return {
        candidateId: row.candidateId,
        candidateName: row.candidateName ?? '',
        jobTitle: row.jobTitle ?? '',
        company: row.company ?? '',
        jobId: row.jobId,
        interviewId: row.interviewId ?? null,
        scheduledAt: row.scheduledAt ? new Date(row.scheduledAt).toISOString() : null,
        riskScore: row.riskScore ?? null,
        interviewScore: row.interviewScore ?? null,
        humanReviewRequired,
      }
    })
  } catch (error) {
    console.error('Failed to get shortlist candidates:', error)
    return []
  }
}

/**
 * Move an interview's candidate to the shortlist stage
 */
export async function moveToShortlist(interviewId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const userId = await requireRole('recruiter')
    if (!(await recruiterOwnsInterview(userId, interviewId))) return { ok: false, error: 'Forbidden' }

    // Look up candidateId + jobId from the interview → pipeline chain
    const rows = await db
      .select({ candidateId: pipeline.candidateId, jobId: pipeline.jobId })
      .from(interview)
      .innerJoin(pipeline, eq(interview.pipelineId, pipeline.id))
      .where(eq(interview.id, interviewId))
      .limit(1)

    if (rows.length === 0) return { ok: false, error: 'Interview not found' }

    const { candidateId, jobId } = rows[0]

    await db
      .update(pipeline)
      .set({ stage: 'shortlist', updatedAt: new Date() })
      .where(and(eq(pipeline.candidateId, candidateId), eq(pipeline.jobId, jobId)))

    await db.insert(auditLog).values({
      userId,
      action: 'candidate_shortlisted',
      entityType: 'interview',
      entityId: interviewId,
      details: { candidateId, jobId },
    })

    return { ok: true }
  } catch (error) {
    console.error('moveToShortlist failed:', error)
    return { ok: false, error: String(error) }
  }
}

/**
 * Hire a candidate (set pipeline stage → 'hired')
 */
export async function hireCandidate(
  candidateId: number,
  jobId: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const userId = await requireRole('recruiter')
    if (!(await recruiterOwnsJob(userId, jobId))) return { ok: false, error: 'Forbidden' }
    await db
      .update(pipeline)
      .set({ stage: 'hired', updatedAt: new Date() })
      .where(and(eq(pipeline.candidateId, candidateId), eq(pipeline.jobId, jobId)))
    await db.insert(auditLog).values({
      userId,
      action: 'candidate_hired',
      entityType: 'pipeline',
      entityId: candidateId,
      details: { candidateId, jobId, humanDecision: true },
    })
    return { ok: true }
  } catch (error) {
    console.error('hireCandidate failed:', error)
    return { ok: false, error: String(error) }
  }
}

/**
 * Reject a candidate (set pipeline stage → 'rejected')
 */
export async function rejectCandidate(
  candidateId: number,
  jobId: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const userId = await requireRole('recruiter')
    if (!(await recruiterOwnsJob(userId, jobId))) return { ok: false, error: 'Forbidden' }
    await db
      .update(pipeline)
      .set({ stage: 'rejected', updatedAt: new Date() })
      .where(and(eq(pipeline.candidateId, candidateId), eq(pipeline.jobId, jobId)))
    await db.insert(auditLog).values({
      userId,
      action: 'candidate_rejected',
      entityType: 'pipeline',
      entityId: candidateId,
      details: { candidateId, jobId, humanDecision: true },
    })
    return { ok: true }
  } catch (error) {
    console.error('rejectCandidate failed:', error)
    return { ok: false, error: String(error) }
  }
}

export async function getCandidateInterviews(): Promise<
  {
    id: number
    jobTitle: string
    company: string
    scheduledAt: string
    status: string
    durationMinutes: number
  }[]
> {
  try {
    const userId = await requireRole('candidate')
    const rows = await db
      .select({
        id: interview.id,
        jobTitle: job.title,
        company: recruiterProfile.organizationName,
        scheduledAt: interview.scheduledAt,
        status: interview.status,
        durationMinutes: interview.durationMinutes,
      })
      .from(interview)
      .innerJoin(pipeline, eq(interview.pipelineId, pipeline.id))
      .innerJoin(job, eq(pipeline.jobId, job.id))
      .innerJoin(recruiterProfile, eq(job.userId, recruiterProfile.userId))
      .where(eq(interview.userId, userId))
      .orderBy(interview.scheduledAt)

    return rows.map((row) => ({
      ...row,
      scheduledAt: new Date(row.scheduledAt).toISOString(),
      durationMinutes: row.durationMinutes ?? 30,
    }))
  } catch (error) {
    console.error('Failed to get candidate interviews:', error)
    return []
  }
}

export async function markInterviewStarted(interviewId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const userId = await requireRole('candidate')
    await db
      .update(interview)
      .set({ status: 'active', startedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(interview.id, interviewId), eq(interview.userId, userId)))
    await db.insert(auditLog).values({
      userId,
      action: 'interview_started',
      entityType: 'interview',
      entityId: interviewId,
      details: {},
    })
    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
}

export async function completeInterview(
  interviewId: number,
  answers: { question: string; answer: string; score: number; feedback: string }[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const userId = await requireRole('candidate')
    const owned = await db
      .select({ recruiterId: interview.recruiterId })
      .from(interview)
      .where(and(eq(interview.id, interviewId), eq(interview.userId, userId)))
      .limit(1)
    if (!owned.length) return { ok: false, error: 'Interview not found' }

    const avgScore =
      answers.length > 0
        ? Math.round(answers.reduce((sum, item) => sum + item.score, 0) / answers.length)
        : 0
    const needsReview = answers.some((item) => item.score < 45)

    await db
      .update(interview)
      .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
      .where(eq(interview.id, interviewId))
    await db
      .update(pipeline)
      .set({ stage: 'evaluation', updatedAt: new Date() })
      .where(eq(pipeline.interviewId, interviewId))
    await db.insert(evaluation).values({
      userId: owned[0].recruiterId,
      interviewId,
      score: avgScore,
      decision: needsReview ? 'maybe' : 'pass',
      feedback: `${needsReview ? 'Needs human review. ' : ''}${answers.map((a, i) => `Q${i + 1}: ${a.feedback}`).join(' ')}`,
      submittedAt: new Date(),
    })
    await db.insert(evidence).values({
      userId,
      interviewId,
      evidenceType: 'transcript',
      pathname: `interviews/${interviewId}/transcript.json`,
      metadata: { answers },
    })
    await db.insert(auditLog).values({
      userId,
      action: 'interview_completed',
      entityType: 'interview',
      entityId: interviewId,
      details: { answerCount: answers.length, score: avgScore },
    })
    return { ok: true }
  } catch (error) {
    console.error('completeInterview failed:', error)
    return { ok: false, error: String(error) }
  }
}

export async function scheduleInterviewBatch(params: {
  jobId: number
  candidateIds: number[]
  scheduledAt: string
  durationMinutes: number
}): Promise<{ ok: boolean; interviewIds?: number[]; error?: string }> {
  try {
    const userId = await requireRole('recruiter')
    const candidateIds = [...new Set(params.candidateIds)].slice(0, 5)
    if (candidateIds.length === 0) return { ok: false, error: 'Select at least one candidate' }
    if (!(await recruiterOwnsJob(userId, params.jobId))) return { ok: false, error: 'Forbidden' }

    const created: number[] = []
    for (const candidateId of candidateIds) {
      const pipelineRows = await db
        .insert(pipeline)
        .values({
          userId,
          jobId: params.jobId,
          candidateId,
          stage: 'interview',
        })
        .returning({ id: pipeline.id })

      const candidateRows = await db
        .select({ userId: candidateProfile.userId })
        .from(candidateProfile)
        .where(eq(candidateProfile.id, candidateId))
        .limit(1)
      if (!candidateRows.length) continue

      const interviewRows = await db
        .insert(interview)
        .values({
          userId: candidateRows[0].userId,
          recruiterId: userId,
          pipelineId: pipelineRows[0].id,
          scheduledAt: new Date(params.scheduledAt),
          durationMinutes: params.durationMinutes,
          status: 'scheduled',
          roomUrl: `/candidate?interview=${pipelineRows[0].id}`,
        })
        .returning({ id: interview.id })

      await db
        .update(pipeline)
        .set({ interviewId: interviewRows[0].id, updatedAt: new Date() })
        .where(eq(pipeline.id, pipelineRows[0].id))
      created.push(interviewRows[0].id)
    }

    await db.insert(auditLog).values({
      userId,
      action: 'interview_batch_scheduled',
      entityType: 'job',
      entityId: params.jobId,
      details: { interviewIds: created, candidateCount: created.length, scheduledAt: params.scheduledAt },
    })
    return { ok: true, interviewIds: created }
  } catch (error) {
    console.error('scheduleInterviewBatch failed:', error)
    return { ok: false, error: String(error) }
  }
}

export async function getRecruiterPipelineCandidates(): Promise<
  { candidateId: number; candidateName: string; jobId: number; jobTitle: string; stage: string }[]
> {
  try {
    const userId = await requireRole('recruiter')
    const rows = await db
      .select({
        candidateId: candidateProfile.id,
        candidateName: candidateProfile.fullName,
        jobId: job.id,
        jobTitle: job.title,
        stage: pipeline.stage,
      })
      .from(pipeline)
      .innerJoin(candidateProfile, eq(pipeline.candidateId, candidateProfile.id))
      .innerJoin(job, eq(pipeline.jobId, job.id))
      .where(and(eq(pipeline.userId, userId), or(eq(pipeline.stage, 'applied'), eq(pipeline.stage, 'screening'))))
      .orderBy(pipeline.updatedAt)

    return rows
  } catch (error) {
    console.error('Failed to get pipeline candidates:', error)
    return []
  }
}
