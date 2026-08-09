'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle, Clock, ThumbsUp, ThumbsDown, Flag, MessageSquare } from 'lucide-react'

type Evidence = {
  id: string
  candidateName: string
  jobTitle: string
  status: 'completed' | 'in-progress'
  duration: number
  behavioralScore: number
  riskLevel: 'low' | 'medium' | 'high'
  signals: { type: string; value: number }[]
  transcriptSnippet: string
}

export default function EvidenceReview() {
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
  const [decision, setDecision] = useState<'pass' | 'reject' | null>(null)
  const [notes, setNotes] = useState('')

  const evidence: Evidence[] = [
    {
      id: '1',
      candidateName: 'Alex Johnson',
      jobTitle: 'Senior Frontend Engineer',
      status: 'completed',
      duration: 2400,
      behavioralScore: 82,
      riskLevel: 'low',
      signals: [
        { type: 'Engagement', value: 85 },
        { type: 'Confidence', value: 78 },
        { type: 'Attention', value: 88 },
      ],
      transcriptSnippet: 'I have 5 years of React experience and recently led a team project...',
    },
    {
      id: '2',
      candidateName: 'Sam Kim',
      jobTitle: 'Product Designer',
      status: 'completed',
      duration: 2100,
      behavioralScore: 71,
      riskLevel: 'medium',
      signals: [
        { type: 'Engagement', value: 65 },
        { type: 'Confidence', value: 72 },
        { type: 'Attention', value: 75 },
      ],
      transcriptSnippet: 'My design philosophy centers on user-centered research and accessibility...',
    },
  ]

  const currentEvidence = selectedEvidence || evidence[0]
  if (!currentEvidence) return null

  const riskColor = {
    low: 'text-green-700 bg-green-50 border-green-200',
    medium: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    high: 'text-red-700 bg-red-50 border-red-200',
  }

  const riskLabel = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Evidence List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Completed Interviews</CardTitle>
          <CardDescription>{evidence.length} candidates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {evidence.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelectedEvidence(e)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  selectedEvidence?.id === e.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <p className="font-medium text-sm">{e.candidateName}</p>
                <p className="text-xs text-muted-foreground">{e.jobTitle}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="text-xs font-mono font-bold">{e.behavioralScore}%</div>
                  <div className="h-1 flex-1 rounded-full bg-border">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${e.behavioralScore}%` }}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Evidence Details */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{currentEvidence.candidateName}</CardTitle>
              <CardDescription>{currentEvidence.jobTitle}</CardDescription>
            </div>
            <div className={`rounded-full border px-3 py-1 text-xs font-medium ${riskColor[currentEvidence.riskLevel]}`}>
              {riskLabel[currentEvidence.riskLevel]}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Interview Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-muted p-3">
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="mt-1 font-mono text-sm font-bold">
                {Math.floor(currentEvidence.duration / 60)}:{(currentEvidence.duration % 60).toString().padStart(2, '0')}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted p-3">
              <p className="text-xs text-muted-foreground">Behavioral Score</p>
              <p className="mt-1 font-mono text-sm font-bold">{currentEvidence.behavioralScore}%</p>
            </div>
            <div className="rounded-lg border border-border bg-muted p-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="mt-1 text-sm font-bold capitalize">{currentEvidence.status}</p>
            </div>
          </div>

          {/* Behavioral Signals */}
          <div>
            <p className="text-sm font-medium mb-2">Behavioral Signals</p>
            <div className="space-y-2">
              {currentEvidence.signals.map((signal) => (
                <div key={signal.type} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-20">{signal.type}</span>
                  <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${signal.value}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono w-8 text-right">{signal.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Transcript */}
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-sm font-medium mb-2">Transcript Snippet</p>
            <p className="text-sm text-muted-foreground italic">&quot;{currentEvidence.transcriptSnippet}&quot;</p>
          </div>

          {/* Reviewer Decision */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Your Assessment</p>
            <textarea
              placeholder="Add your notes about the candidate..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-24 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />

            <div className="flex gap-2">
              <Button
                variant={decision === 'pass' ? 'default' : 'outline'}
                onClick={() => setDecision('pass')}
                className="flex-1"
              >
                <ThumbsUp className="mr-2 size-4" />
                Move Forward
              </Button>
              <Button
                variant={decision === 'reject' ? 'destructive' : 'outline'}
                onClick={() => setDecision('reject')}
                className="flex-1"
              >
                <ThumbsDown className="mr-2 size-4" />
                Not a Fit
              </Button>
            </div>

            {decision && (
              <div className={`rounded-lg border p-3 text-xs font-medium ${
                decision === 'pass'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}>
                <div className="flex items-center gap-2">
                  {decision === 'pass' ? (
                    <CheckCircle className="size-4" />
                  ) : (
                    <Flag className="size-4" />
                  )}
                  {decision === 'pass'
                    ? 'Ready to advance to next stage'
                    : 'Will not advance at this time'}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
