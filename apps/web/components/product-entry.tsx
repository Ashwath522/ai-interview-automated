'use client'

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BriefcaseBusinessIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  UserRoundIcon,
} from 'lucide-react'
import { FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Role = 'recruiter' | 'candidate'
type Screen = 'choose' | 'login' | 'demo'

const roles = {
  recruiter: {
    title: 'I’m hiring',
    description: 'Manage interviews, review evidence, and make the final decision.',
    icon: BriefcaseBusinessIcon,
    action: 'Continue as recruiter',
    testId: '101',
  },
  candidate: {
    title: 'I have an interview',
    description: 'Check your invitation, prepare your setup, and join on time.',
    icon: UserRoundIcon,
    action: 'Continue as candidate',
    testId: '102',
  },
} as const

export function ProductEntry() {
  const [selectedRole, setSelectedRole] = useState<Role>('candidate')
  const [screen, setScreen] = useState<Screen>('choose')
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const selected = roles[selectedRole]

  function chooseRole(role: Role) {
    setSelectedRole(role)
    setError('')
  }

  function openLogin() {
    setUserId('')
    setPassword('')
    setError('')
    setScreen('login')
  }

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (userId === selected.testId && password === selected.testId) {
      setError('')
      setScreen('demo')
      return
    }
    setError(`Use ${selected.testId} for both ID and password.`)
  }

  if (screen === 'demo') {
    return (
      <Card>
        <CardHeader>
          <span className="flex size-10 items-center justify-center rounded-lg bg-ok text-ok-foreground">
            <CheckCircle2Icon aria-hidden="true" className="size-5" />
          </span>
          <CardTitle>
            {selectedRole === 'recruiter' ? 'Recruiter workspace' : 'Interview lobby'}
          </CardTitle>
          <CardDescription>
            Signed in to the test experience as {userId}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-xl bg-secondary p-4">
            <CalendarClockIcon aria-hidden="true" className="mt-0.5 size-5 text-primary" />
            <div className="flex flex-col gap-1">
              <p className="font-medium">
                {selectedRole === 'recruiter'
                  ? 'No interviews scheduled yet'
                  : 'Your test interview is ready'}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {selectedRole === 'recruiter'
                  ? 'The next build step will add your interview dashboard.'
                  : 'The next build step will add setup checks and the interview room.'}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setScreen('choose')}>
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Sign out of test
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (screen === 'login') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{selected.title}</CardTitle>
          <CardDescription>
            Test access: use {selected.testId} for both fields.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitLogin} className="flex flex-col gap-5">
            <FieldGroup>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="test-user-id">User ID</FieldLabel>
                <Input
                  id="test-user-id"
                  inputMode="numeric"
                  autoComplete="username"
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                  aria-invalid={Boolean(error)}
                  placeholder={selected.testId}
                  required
                />
              </Field>
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor="test-password">Password</FieldLabel>
                <Input
                  id="test-password"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(error)}
                  placeholder={selected.testId}
                  required
                />
                <FieldError>{error}</FieldError>
              </Field>
            </FieldGroup>
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button type="submit" className="sm:flex-1">
                Enter test
                <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
              </Button>
              <Button type="button" variant="outline" onClick={() => setScreen('choose')}>
                Back
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.entries(roles) as [Role, (typeof roles)[Role]][]).map(
          ([role, details]) => {
            const Icon = details.icon
            const isSelected = selectedRole === role
            return (
              <button
                key={role}
                type="button"
                aria-pressed={isSelected}
                onClick={() => chooseRole(role)}
                className={cn(
                  'flex min-h-32 flex-col items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  isSelected ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/40',
                )}
              >
                <span className={cn('flex size-9 items-center justify-center rounded-lg', isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground')}>
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="font-semibold">{details.title}</span>
                  <span className="text-sm leading-relaxed text-muted-foreground">{details.description}</span>
                </span>
              </button>
            )
          },
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{selected.title}</CardTitle>
          <CardDescription>Use the temporary test credentials to explore this role.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button size="lg" onClick={openLogin} className="w-full">
            {selected.action}
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </Button>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Dummy test only. No account data is stored.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
