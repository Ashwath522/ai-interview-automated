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
    const userId = await getUserId()
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
    const userId = await getUserId()

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
    const userId = await getUserId()

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
    await getUserId() // auth check

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
      .set({ stage: 'shortlist' })
      .where(and(eq(pipeline.candidateId, candidateId), eq(pipeline.jobId, jobId)))

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
    await getUserId()
    await db
      .update(pipeline)
      .set({ stage: 'hired' })
      .where(and(eq(pipeline.candidateId, candidateId), eq(pipeline.jobId, jobId)))
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
    await getUserId()
    await db
      .update(pipeline)
      .set({ stage: 'rejected' })
      .where(and(eq(pipeline.candidateId, candidateId), eq(pipeline.jobId, jobId)))
    return { ok: true }
  } catch (error) {
    console.error('rejectCandidate failed:', error)
    return { ok: false, error: String(error) }
  }
}
