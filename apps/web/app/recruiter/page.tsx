import { RecruiterDashboard } from '@/components/recruiter/recruiter-dashboard'
import { getCurrentRole } from '@/app/actions/core'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function RecruiterPage() {
  const role = await getCurrentRole()
  if (role !== 'recruiter') redirect('/sign-in')
  return <RecruiterDashboard />
}
