import { chatCompletion } from '@/lib/llm/openrouter'
import {
  analyzeCandidateStyle,
  styleGuidance,
  type CandidateStyle,
} from '@/lib/candidate-style'

export type InterviewStepAction = 'follow_up' | 'next_base' | 'complete'

export type InterviewStepResult = {
  action: InterviewStepAction
  question?: string
  nextBaseIndex?: number
}

export type DecideNextStepParams = {
  jobTitle: string
  jobDescription: string
  baseQuestions: string[]
  baseQuestionIndex: number
  isFollowUpQuestion: boolean
  currentQuestion: string
  candidateAnswer: string
  priorQA: { question: string; answer: string }[]
}

const SYSTEM_PROMPT = `You are a skilled human interviewer conducting a live spoken interview.

Rules:
- Respond with JSON only: {"action":"follow_up"|"next_base","question":"..."}
- One question only, 1-2 sentences max, natural spoken English
- Professional, warm, concise — like a real hiring manager
- Adapt tone to the candidateStyle and styleGuidance in the payload
- brief candidate → focused example/metric probes
- detailed candidate → sharper tradeoff/decision questions
- hesitant candidate → warmer shorter questions, optional brief transition ("Okay." "Got it." "Let's go one level deeper.")
- confident technical candidate → deeper architecture/scenario probes
- No markdown, bullets, labels, or "as an AI"
- Never mention scoring, proctoring, risk, or evaluation
- Never repeat a prior question verbatim
- Max one follow-up between base questions (caller enforces this)
- Use follow_up only when the answer needs more depth (impact, metrics, tradeoffs, ownership)
- For next_base, return the exact next base question text provided in the payload
- Do not expose chain-of-thought or reasoning`

const TRANSITIONS = ['Okay.', 'Got it.', "Let's go one level deeper."]

function parseStepResponse(raw: string): InterviewStepResult | null {
  try {
    // Try direct parse first
    let parsedObj: Record<string, unknown> | null = null
    try {
      parsedObj = JSON.parse(raw)
    } catch {
      // Attempt to extract first JSON object substring from model output
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          parsedObj = JSON.parse(match[0])
        } catch {
          parsedObj = null
        }
      }
    }
    const parsed = parsedObj as { action?: string; question?: string }
    const question = parsed.question?.trim()
    if (!question || question.length < 8) return null

    if (parsed.action === 'follow_up') {
      return { action: 'follow_up', question: sanitizeQuestion(question) }
    }
    if (parsed.action === 'next_base') {
      return { action: 'next_base', question: sanitizeQuestion(question) }
    }
  } catch {
    // fall through
  }
  return null
}

function sanitizeQuestion(question: string): string {
  return question
    .replace(/^["']|["']$/g, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function referenceFromAnswer(answer: string): string {
  const trimmed = answer.trim()
  if (!trimmed) return 'that'
  const firstSentence = trimmed.split(/[.!?]+/).find((part) => part.trim().length > 0)?.trim() ?? trimmed
  const words = firstSentence.split(/\s+/).filter(Boolean)
  if (words.length <= 8) return firstSentence
  return `${words.slice(0, 8).join(' ')}…`
}

function transitionFor(style: CandidateStyle): string {
  if (style.confidence === 'hesitant' || style.tone === 'stressed') return TRANSITIONS[0]
  if (style.depth === 'technical' || style.confidence === 'confident') return TRANSITIONS[2]
  return TRANSITIONS[1]
}

function heuristicFollowUp(params: DecideNextStepParams, style: CandidateStyle): string {
  const hook = referenceFromAnswer(params.candidateAnswer)
  const lead = transitionFor(style)

  if (style.verbosity === 'brief') {
    return `${lead} You mentioned ${hook} — can you give one concrete example with a measurable result?`
  }
  if (style.verbosity === 'detailed' && style.depth === 'technical') {
    return `${lead} On ${hook}, what tradeoff did you accept and why?`
  }
  if (style.confidence === 'hesitant') {
    return `${lead} Could you walk me through one specific moment from ${hook}?`
  }
  if (style.confidence === 'confident' && style.depth === 'technical') {
    return `${lead} How would you scale or harden the approach behind ${hook}?`
  }
  return `${lead} You mentioned ${hook} — what was the measurable outcome, and what tradeoffs did you navigate?`
}

function heuristicNextStep(params: DecideNextStepParams, style: CandidateStyle): InterviewStepResult {
  const wordCount = params.candidateAnswer.split(/\s+/).filter(Boolean).length
  const isLastBase = params.baseQuestionIndex >= params.baseQuestions.length - 1
  const needsFollowUp =
    !params.isFollowUpQuestion &&
    (wordCount < 22 || (style.verbosity === 'brief' && wordCount < 35) || style.depth === 'high_level')

  if (needsFollowUp) {
    return {
      action: 'follow_up',
      question: heuristicFollowUp(params, style),
    }
  }

  if (isLastBase) {
    return { action: 'complete' }
  }

  const nextIndex = params.baseQuestionIndex + 1
  return {
    action: 'next_base',
    question: params.baseQuestions[nextIndex],
    nextBaseIndex: nextIndex,
  }
}

function buildPriorSummary(priorQA: { question: string; answer: string }[]): string {
  if (!priorQA.length) return 'None yet.'
  return priorQA
    .slice(-4)
    .map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer.slice(0, 320)}`)
    .join('\n\n')
}

export async function decideNextInterviewStep(params: DecideNextStepParams): Promise<InterviewStepResult> {
  const isLastBase = params.baseQuestionIndex >= params.baseQuestions.length - 1
  const nextBaseQuestion = params.baseQuestions[params.baseQuestionIndex + 1]
  const candidateStyle = analyzeCandidateStyle(params.priorQA)

  if (params.isFollowUpQuestion) {
    if (isLastBase) return { action: 'complete' }
    const nextIndex = params.baseQuestionIndex + 1
    return {
      action: 'next_base',
      question: params.baseQuestions[nextIndex],
      nextBaseIndex: nextIndex,
    }
  }

  const userPayload = {
    jobTitle: params.jobTitle,
    jobDescriptionExcerpt: params.jobDescription.slice(0, 800),
    currentBaseQuestion: params.currentQuestion,
    candidateAnswerTranscript: params.candidateAnswer.slice(0, 1400),
    priorQASummary: buildPriorSummary(params.priorQA),
    candidateStyle,
    styleGuidance: styleGuidance(candidateStyle),
    nextBaseQuestion: nextBaseQuestion ?? null,
    isLastBaseQuestion: isLastBase,
    decisionGuide: {
      follow_up:
        'Use when the answer lacks impact, metrics, ownership, or tradeoffs. Reference something specific the candidate said. Match candidateStyle.',
      next_base: 'Use when the answer is sufficient. Set question to nextBaseQuestion exactly.',
    },
  }

  const raw = await chatCompletion([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify(userPayload) },
  ])

  if (raw) {
    const parsed = parseStepResponse(raw)
    if (parsed) {
      if (parsed.action === 'follow_up') {
        return parsed
      }
      if (parsed.action === 'next_base') {
        if (isLastBase) return { action: 'complete' }
        const nextIndex = params.baseQuestionIndex + 1
        return {
          action: 'next_base',
          question: nextBaseQuestion ?? parsed.question,
          nextBaseIndex: nextIndex,
        }
      }
    }
  }

  return heuristicNextStep(params, candidateStyle)
}
