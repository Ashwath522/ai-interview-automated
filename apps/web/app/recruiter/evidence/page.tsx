'use client'

import { useState } from 'react'
import EvidenceReview from '@/components/recruiter/evidence-review'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react'

export default function RecruiterEvidencePage() {
  const [activeTab, setActiveTab] = useState('review')

  const stats = {
    pending: 2,
    reviewed: 5,
    approved: 3,
    rejected: 2,
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Interview Evidence</h1>
            <p className="mt-2 text-muted-foreground">Review candidate interviews and make hiring decisions</p>
          </div>
          <Button variant="outline">← Back to Dashboard</Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end gap-2">
              <Clock className="size-5 text-yellow-600" />
              <span className="text-2xl font-bold">{stats.pending}</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Reviewed</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end gap-2">
              <CheckCircle2 className="size-5 text-blue-600" />
              <span className="text-2xl font-bold">{stats.reviewed}</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end gap-2">
              <CheckCircle2 className="size-5 text-green-600" />
              <span className="text-2xl font-bold">{stats.approved}</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Not a Fit</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end gap-2">
              <AlertCircle className="size-5 text-red-600" />
              <span className="text-2xl font-bold">{stats.rejected}</span>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="review">Review Evidence</TabsTrigger>
            <TabsTrigger value="decisions">Your Decisions</TabsTrigger>
          </TabsList>

          <TabsContent value="review" className="mt-6">
            <EvidenceReview />
          </TabsContent>

          <TabsContent value="decisions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Candidate Decisions</CardTitle>
                <CardDescription>Your hiring assessments and notes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Alex Johnson</p>
                      <p className="text-sm text-muted-foreground">Senior Frontend Engineer</p>
                      <p className="mt-2 text-sm">Excellent technical skills, strong communication</p>
                    </div>
                    <div className="rounded-lg bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                      Approved
                    </div>
                  </div>

                  <div className="flex items-start justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">Sam Kim</p>
                      <p className="text-sm text-muted-foreground">Product Designer</p>
                      <p className="mt-2 text-sm">Need clarification on design process</p>
                    </div>
                    <div className="rounded-lg bg-yellow-50 px-3 py-1 text-sm font-medium text-yellow-700">
                      Reviewing
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
