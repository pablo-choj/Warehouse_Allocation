import type { LineaSAP, Solicitud } from '../../types/solicitudes'
import { parseExcelFile } from '../../utils/excel'
import { construirSolicitud, validarLineas, type ResultadoReglas, type LineaValidada } from './upload.rules'
import { http } from '../../lib/fetch'
import { env } from '../../lib/env'

export type SimulacionPayload = {
  cliente: string
  solicitante: string
  horaLocalChile: string
}

const endpoint = env.required('VITE_VALIDATION_ENDPOINT')
const deploymentName = env.get('VITE_VALIDATION_DEPLOYMENT')
const agentInstruction =
  env.get('VITE_AGENT_INSTRUCTION') ?? 'You are an AI assistant that helps people find information.'
const reasoningEffort = env.get('VITE_REASONING_EFFORT')

const businessRules = `Business rules (concise, mandatory):
1) Single allocation ticket; assign to Stock Management.
2) Warehouse change: classify as Order validation; after execution, verify warehouse updated + stock available.
3) SLA target: 2h for Stock Management; mention window and monitoring.
4) Attach line file only if high volume.
5) Daily emergency: if CL time <= 11:00 mark "Daily emergency"; else justify and notify planning.
6) Ticket fields: Customer, SAP order(s), Comments ("Allocate and Plan" or "Allocate"), Date, Time, Expected owner "Stock Management Basket", publish ticket # to "REUNIÓN OPERATIVA 2024".
7) After allocation confirmation: validate deliveries and record delivery numbers.
8) Destination rules:
  - If new_storage_location == "PT11": DO NOT create an approval ticket. Only the single allocation ticket applies.
  - If new_storage_location == "PT15": An approval ticket IS REQUIRED (in addition to the allocation ticket).

Allocation-only rule:
  - If new_storage_location is blank OR equals storage_location: treat as allocation-only (do not reject the line).

Per-line validations: must have order, line_item, sku, qty>0; if inconsistent, exclude the line and return observations.`

export async function parsearExcel(file: File): Promise<LineaSAP[]> {
  const rows = await parseExcelFile(file)
  return filtrarLineasEntrada(rows)
}

export async function simularReglas(
  file: File,
  payload: SimulacionPayload,
): Promise<ResultadoReglas> {
  const lineas = await parsearExcel(file)

  if (lineas.length === 0) {
    return {
      lineasValidadas: [],
      observacionesGlobales: ['No rows matched the upload filter (ZTAN + allowed storage + blank blocks).'],
    }
  }

  const lineasValidadas = validarLineas(lineas)
  const resultado = construirSolicitud(lineasValidadas, payload.horaLocalChile, payload.cliente, payload.solicitante)
  return resultado
}

function isBlank(value: string | undefined) {
  return !value || value.trim() === ''
}

function filtrarLineasEntrada(lineas: LineaSAP[]) {
  const allowedStorage = new Set(['PT11', 'PT15', '1000'])
  return lineas.filter((l) => {
    const itemCategoryOk = (l.itemCategory ?? '').trim() === 'ZTAN'
    const storageOk = allowedStorage.has((l.almacenOrigen ?? '').trim())

    const blocksOk =
      isBlank(l.orderItemBlock) &&
      isBlank(l.reasonForRejection) &&
      isBlank(l.deliveryNote) &&
      isBlank(l.shippingBlock) &&
      isBlank(l.shipmentNumber)

    return itemCategoryOk && storageOk && blocksOk
  })
}

type ChatContentChunk = { type?: string; text?: string | null }
type ChatMessageContent = string | ChatContentChunk[]
type ChatResponse = {
  choices?: Array<{
    message?: {
      content?: ChatMessageContent
    }
  }>
  output_text?: string[]
}

type ClaudeContentBlock = { type?: string; text?: string | null }
type ClaudeResponse = {
  content?: ClaudeContentBlock[]
}

export type AgentLineRecommendation = {
  sales_order: string
  line_item: string
  recommendation: string
  insights: string
}

export type AgentResponse = {
  summary: string
  lines: AgentLineRecommendation[]
}

export async function enviarAlAgente(
  lineas: LineaValidada[],
  contexto: { cliente: string; horaLocalChile: string },
): Promise<{ rawText: string; parsed?: AgentResponse }> {
  const prompt = buildPrompt(lineas, contexto)

  if (isAnthropicEndpoint(endpoint)) {
    const url = toClaudeMessagesUrl(endpoint)
    const body = {
      model: deploymentName ?? 'claude-opus-4-6',
      max_tokens: 1024,
      system:
        `${agentInstruction} Always answer in English. ` +
        `Output must be a single valid json object. Do not output markdown or extra text.`,
      messages: [{ role: 'user', content: prompt }],
    }

    const response = await http.post<ClaudeResponse>(url, body)
    const rawText = extractClaudeText(response) ?? JSON.stringify(response)
    const parsed = tryParseAgentResponse(rawText)
    return { rawText, parsed }
  }

  const body: Record<string, unknown> = {
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text:
              `${agentInstruction} Always answer in English. ` +
              `Output must be a single valid json object. Do not output markdown or extra text.`,
          },
        ],
      },
      { role: 'user', content: [{ type: 'text', text: prompt }] },
    ],
    max_completion_tokens: 1024,
    response_format: { type: 'json_object' },
  }

  if (reasoningEffort) body.reasoning_effort = reasoningEffort

  const response = await http.post<ChatResponse>(endpoint, body)
  const text = extractText(response)
  const rawText = text ?? JSON.stringify(response)
  const parsed = tryParseAgentResponse(rawText)
  return { rawText, parsed }
}

function isAnthropicEndpoint(url: string) {
  try {
    const u = new URL(url)
    return u.pathname.includes('/anthropic') || u.hostname.endsWith('.services.ai.azure.com')
  } catch {
    return url.includes('/anthropic')
  }
}

function toClaudeMessagesUrl(url: string) {
  // Accept either baseURL (..../anthropic) or target URL (..../anthropic/v1/messages)
  if (url.includes('/anthropic/v1/messages')) return url
  if (url.endsWith('/')) return `${url}v1/messages`
  if (url.endsWith('/anthropic')) return `${url}/v1/messages`
  return `${url.replace(/\/+$/, '')}/v1/messages`
}

function extractClaudeText(res: ClaudeResponse) {
  const blocks = res.content ?? []
  const texts = blocks
    .map((b) => (b?.type === 'text' || !b?.type ? b?.text ?? '' : ''))
    .map((t) => t.trim())
    .filter(Boolean)
  if (texts.length) return texts.join('\n')
  return undefined
}

function tryParseAgentResponse(text: string): AgentResponse | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined

  // If the model returned extra text, try to salvage the first JSON object.
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return undefined

  const jsonCandidate = trimmed.slice(start, end + 1)
  try {
    const obj = JSON.parse(jsonCandidate) as Partial<AgentResponse>
    if (!obj || typeof obj !== 'object') return undefined
    if (typeof obj.summary !== 'string') return undefined
    if (!Array.isArray(obj.lines)) return undefined

    const lines: AgentLineRecommendation[] = obj.lines
      .filter((l): l is Partial<AgentLineRecommendation> => !!l && typeof l === 'object')
      .map((l) => ({
        sales_order: String(l.sales_order ?? ''),
        line_item: String(l.line_item ?? ''),
        recommendation: String(l.recommendation ?? ''),
        insights: String(l.insights ?? ''),
      }))
      .filter((l) => l.sales_order && l.line_item)

    return { summary: obj.summary, lines }
  } catch {
    return undefined
  }
}

function extractText(res: ChatResponse) {
  const fromOutput = res.output_text?.find((v) => v && v.trim())
  if (fromOutput) return fromOutput.trim()

  for (const choice of res.choices ?? []) {
    const content = choice.message?.content
    if (!content) continue
    if (typeof content === 'string') {
      const trimmed = content.trim()
      if (trimmed) return trimmed
    } else if (Array.isArray(content)) {
      for (const chunk of content) {
        const trimmed = chunk?.text?.trim()
        if (trimmed) return trimmed
      }
    }
  }
  return undefined
}

function buildPrompt(lineas: LineaValidada[], contexto: { cliente: string; horaLocalChile: string }) {
  const payload = {
    customer: contexto.cliente,
    hora_local_chile: contexto.horaLocalChile,
    lines: lineas.map((l) => ({
      sales_order: l.pedidoSAP,
      line_item: l.posicion,
      material: l.sku,
      storage_location: l.almacenOrigen,
      new_storage_location: l.almacenDestinoDeseado,
      qty: l.cantidad,
    })),
  }

  return [
    'You are validating warehouse change/allocation lines. Apply the business rules and produce recommendations/insights.',
    businessRules,
    'Input payload (json):',
    JSON.stringify(payload),
    'Return a single json object with exactly this shape:',
    '{"summary":"...","lines":[{"sales_order":"...","line_item":"...","recommendation":"...","insights":"..."}]}',
    'Rules: include every input line exactly once; keep values short; no markdown; no surrounding text.',
  ].join('\n\n')
}
