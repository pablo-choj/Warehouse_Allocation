import type { DecisionState } from '../../components/DecisionCard'

export type ValidationRequest = {
  orderId: string
  customerId: string
  amount: number
  currency?: string
}

export type ValidationDecision = {
  source: 'foundry' | 'proxy'
  state: DecisionState
  summary: string
  confidence: number
  referenceId?: string
  latencyMs?: number
}

export type ValidationResponse = {
  correlationId: string
  completedAt: string
  allowed: boolean
  reason: string
  authorizationRequired: boolean
  decisions?: ValidationDecision[]
  warnings?: string[]
}
