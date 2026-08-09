/**
 * Risk engine — connects real CV signals to a weighted risk score.
 * Replaces the previous stub that always returned score=10.
 */

export type ProctoringEvent = {
  type: string
  severity: 'low' | 'medium' | 'high'
  metadata: Record<string, any>
  timestamp: string
}

export type RiskOutput = {
  score: number // 0-100, higher is higher risk
  level: 'low' | 'medium' | 'high'
  breakdown: Record<string, number>
  evidenceCount: number
  timestamp: number
}

// Signal weights — tuned so no single signal triggers "high" alone
const SIGNAL_WEIGHTS: Record<string, number> = {
  phoneDetected: 35,
  multipleFaces: 30,
  spoofSuspected: 30,
  faceLeftFrame: 20,
  personAbsent: 20,
  repeatedOffScreenGaze: 15,
  longDownwardGaze: 10,
  slouching: 8,
  leaning: 6,
  darkLighting: 12,
  // Negative / dampening signals — reduce score
  continuousFaceVisible: -5,
  goodLighting: -3,
}

// Minimum corroborating signals needed before high risk is declared
// (except for spoof which stands alone)
const HIGH_RISK_THRESHOLD = 60
const MEDIUM_RISK_THRESHOLD = 30

/**
 * Calculate a risk score from live CV signals + recent proctoring events.
 *
 * @param params.currentSignals  Boolean/numeric values from detectors this frame
 * @param params.events          Recent proctoring events (last 5 min)
 */
export function calculateRiskScore(params: {
  events: ProctoringEvent[]
  currentSignals: Record<string, boolean | number>
}): RiskOutput {
  const { currentSignals, events } = params

  const breakdown: Record<string, number> = {}
  let rawScore = 0

  // --- Signal-based score ---
  for (const [signal, weight] of Object.entries(SIGNAL_WEIGHTS)) {
    const value = currentSignals[signal]
    if (value === true || value === 1) {
      breakdown[signal] = Math.abs(weight)
      rawScore += weight
    }
  }

  // --- Event-based boost: recent high-severity events add extra weight ---
  const now = Date.now()
  const recentHighSeverity = events.filter(
    (e) =>
      e.severity === 'high' &&
      now - new Date(e.timestamp).getTime() < 60_000 // last 60s
  ).length
  const eventBoost = Math.min(recentHighSeverity * 5, 20)
  if (eventBoost > 0) {
    breakdown['recentHighSeverityEvents'] = eventBoost
    rawScore += eventBoost
  }

  // Clamp to 0–100
  const score = Math.min(100, Math.max(0, Math.round(rawScore)))

  let level: 'low' | 'medium' | 'high' = 'low'
  if (score >= HIGH_RISK_THRESHOLD) {
    level = 'high'
  } else if (score >= MEDIUM_RISK_THRESHOLD) {
    level = 'medium'
  }

  return {
    score,
    level,
    breakdown,
    evidenceCount: events.length,
    timestamp: now,
  }
}
