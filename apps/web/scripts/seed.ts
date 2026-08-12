import { auth } from '../lib/auth'
import { db } from '../lib/db'
import {
  user,
  userRole,
  recruiterProfile,
  candidateProfile,
  job,
  pipeline,
} from '../lib/db/schema'
import { and, eq } from 'drizzle-orm'

const PASSWORD = 'password123'

async function ensureUser(params: {
  email: string
  name: string
  role: 'admin' | 'recruiter' | 'candidate'
}) {
  const normalizedEmail = params.email.toLowerCase()
  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, normalizedEmail)).limit(1)

  let userId = existing[0]?.id
  if (!userId) {
    const response = await auth.api.signUpEmail({
      body: {
        email: normalizedEmail,
        password: PASSWORD,
        name: params.name,
      },
    })
    userId = response.user.id
  }

  const roleRows = await db
    .select({ role: userRole.role })
    .from(userRole)
    .where(eq(userRole.userId, userId))
    .limit(1)

  if (!roleRows.length) {
    await db.insert(userRole).values({ userId, role: params.role })
  }

  if (params.role === 'recruiter') {
    const profileRows = await db
      .select({ id: recruiterProfile.id })
      .from(recruiterProfile)
      .where(eq(recruiterProfile.userId, userId))
      .limit(1)

    if (!profileRows.length) {
      await db.insert(recruiterProfile).values({
        userId,
        organizationName: 'CoreLink Demo Co.',
      })
    }

    const jobRows = await db.select({ id: job.id }).from(job).where(eq(job.userId, userId)).limit(1)
    if (!jobRows.length) {
      await db.insert(job).values({
        userId,
        title: 'Senior Frontend Engineer',
        description: 'Default opening for scheduling interviews.',
        status: 'active',
      })
    }
  }

  if (params.role === 'candidate') {
    const profileRows = await db
      .select({ id: candidateProfile.id })
      .from(candidateProfile)
      .where(eq(candidateProfile.userId, userId))
      .limit(1)

    if (!profileRows.length) {
      await db.insert(candidateProfile).values({
        userId,
        fullName: params.name,
      })
    }
  }

  return userId
}

async function main() {
  const recruiterId = await ensureUser({
    email: 'recruiter@corelink.test',
    name: 'Demo Recruiter',
    role: 'recruiter',
  })
  await ensureUser({
    email: 'admin@corelink.test',
    name: 'Demo Admin',
    role: 'admin',
  })

  const candidateIds = []
  for (const candidate of [
    { email: 'candidate1@corelink.test', name: 'Alex Johnson' },
    { email: 'candidate2@corelink.test', name: 'Sam Kim' },
  ]) {
    candidateIds.push(
      await ensureUser({
        email: candidate.email,
        name: candidate.name,
        role: 'candidate',
      }),
    )
  }

  const jobRows = await db.select({ id: job.id }).from(job).where(eq(job.userId, recruiterId)).limit(1)
  const jobId = jobRows[0]?.id
  if (!jobId) throw new Error('Recruiter job missing after seed')

  for (const candidateUserId of candidateIds) {
    const profileRows = await db
      .select({ id: candidateProfile.id })
      .from(candidateProfile)
      .where(eq(candidateProfile.userId, candidateUserId))
      .limit(1)

    const candidateProfileId = profileRows[0]?.id
    if (!candidateProfileId) continue

    const pipelineRows = await db
      .select({ id: pipeline.id })
      .from(pipeline)
      .where(and(eq(pipeline.jobId, jobId), eq(pipeline.candidateId, candidateProfileId)))
      .limit(1)

    if (!pipelineRows.length) {
      await db.insert(pipeline).values({
        userId: recruiterId,
        jobId,
        candidateId: candidateProfileId,
        stage: 'screening',
      })
    }
  }

  console.log('Seed complete.')
  console.log('Recruiter: recruiter@corelink.test / password123')
  console.log('Candidates: candidate1@corelink.test, candidate2@corelink.test / password123')
  console.log('Admin: admin@corelink.test / password123')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    process.exit(0)
  })
