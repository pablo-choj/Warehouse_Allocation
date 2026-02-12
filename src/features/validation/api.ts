import { env } from '../../lib/env'
import { http } from '../../lib/fetch'
import type { ValidationRequest, ValidationResponse } from './types'

type AzureContentChunk =
  | string
  | {
      type?: string
      text?: string
    }

type AzureMessage = {
  role?: string
  content?: AzureContentChunk[]
}

type AzureResponsePayload = {
  id?: string
  status?: string
  created_at?: string
  output?: AzureMessage[]
  output_text?: string[]
}

const endpoint = env.required('VITE_VALIDATION_ENDPOINT')
const agentName = env.get('VITE_AGENT_NAME') ?? 'Order-to-Cash'
const agentInstruction =
  env.get('VITE_AGENT_INSTRUCTION') ?? 'You are an AI assistant that helps people find information.'
const isChatCompletionEndpoint = endpoint.includes('/chat/completions')
const businessRules = `# Reglas de negocio (obligatorias)
1) El "ticket emergencial" y el de "alocación" son equivalentes: crear un único ticket de alocación y asignarlo al equipo 'Stock Management'.
2) Para cambio de almacén: clasificar la actividad como "Order validation". Tras ejecutar, verificar en SAP que el almacén se actualizó y que existe stock disponible para alocar.
3) SLA objetivo del equipo Stock Management ≈ 2 horas. Debes mencionarlo y proponer monitoreo.
4) Adjuntar archivo de líneas solo con alto volumen.
5) Emergencial diario: si hora_local_chile_actual <= 11:00 marcar el ticket como "Emergencial diario"; si es mayor, justificar el fuera de horario y notificar a planificación.
6) Campos mínimos del ticket: Cliente, Nº de pedido(s) SAP, Comentarios ("Alocar y Planificar" o "Alocar"), Fecha, Hora, Responsable esperado "Stock Management Basket", publicar Nº de ticket en "REUNIÓN OPERATIVA 2024".
7) Tras confirmación de alocación, validar entregas y registrar Nºs asociados.

# Controles/validaciones previas
- Comprobar que cada línea tenga numero_pedido_sap, posicion, sku, qty, almacen_destino_deseado.
- Detectar inconsistencias: qty <= 0, almacén destino igual a origen, SKU inexistente o falta de stock.
- Si hay inconsistencias, no generar ticket y detallar observaciones con correcciones.

Siempre responde en español.`
const outputSchema = `{
  "resumen": "<2-3 líneas con qué se hará y por qué>",
  "instrucciones_SAP": [
     "Paso 1: Revisar órdenes en SAP y confirmar datos (cliente, pedido, disponibilidad).",
     "Paso 2: Ejecutar cambio de almacén en Order Validation para líneas válidas.",
     "Paso 3: Verificar actualización de almacén y disponibilidad de stock.",
     "Paso 4: Solicitar alocación (único ticket de alocación)."
  ],
  "ticket": {
    "tipo": "Alocación (Emergencial si aplica)",
    "asignacion": "Stock Management",
    "sla_respuesta_objetivo_horas": 2,
    "campos": {
      "cliente": "{{cliente}}",
      "pedidos_sap": ["{{sap_order1}}","{{sap_order2}}", "..."],
      "comentarios": "Alocar y Planificar",
      "fecha": "{{YYYY-MM-DD}}",
      "hora": "{{HH:mm}}",
      "responsable_esperado": "Stock Management Basket"
    },
    "adjunto_lineas": {{true|false}},
    "notificaciones": [
      {
        "canal": "Teams",
        "grupo": "REUNIÓN OPERATIVA 2024",
        "mensaje": "Ticket {{numero_ticket}} creado para alocación {{cliente}}; pedidos {{lista}}; est. resp <= 2h."
      }
    ]
  },
  "verificaciones_posteriores": [
     "Confirmar respuesta de Stock Management y Nºs de entrega.",
     "Validar que todas las líneas fueron alocadas correctamente.",
     "Registrar evidencias (capturas y Nºs de entrega)."
  ],
  "observaciones": []
}`

type ChatCompletionResponse = {
  id?: string
  choices?: Array<{
    message?: {
      role?: string
      content?: ChatMessageContent
    }
  }>
}

type ChatMessageContent =
  | string
  | Array<{
      type?: string
      text?: string | null
    }>

export async function validateOrder(payload: ValidationRequest) {
  if (isChatCompletionEndpoint) {
    const chatRequest = buildChatCompletionRequest(payload)
    const chatResponse = await http.post<ChatCompletionResponse>(endpoint, chatRequest)
    return normalizeFromText(extractChatText(chatResponse), chatResponse.id)
  }

  const requestBody = buildAgentRequest(payload)
  const azureResponse = await http.post<AzureResponsePayload>(endpoint, requestBody)
  return normalizeFromText(extractAgentText(azureResponse), azureResponse.id)
}

function buildAgentRequest(payload: ValidationRequest) {
  const serialized = JSON.stringify(payload, null, 2)
  const message = ['Valida el siguiente pedido en modo smoke-test:', serialized].join('\n')

  return {
    input: [
      {
        role: 'user',
        content: message,
      },
    ],
    agent: {
      name: agentName,
      type: 'agent_reference',
    },
  }
}

function buildChatCompletionRequest(payload: ValidationRequest) {
  const serialized = JSON.stringify(payload, null, 2)
  const prompt = [
    'Debes analizar la solicitud, validar controles previos y decidir si procede generar ticket.',
    businessRules,
    'Formato JSON de salida (usa json valido y respeta este esquema):',
    outputSchema,
    'Payload a evaluar:',
    serialized,
  ].join('\n\n')

  return {
    messages: [
      {
        role: 'system',
        content: `${agentInstruction} Responde siempre con un json válido que siga el esquema indicado y aplica estrictamente las reglas de negocio.`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_completion_tokens: 800,
    response_format: { type: 'json_object' },
  }
}

function normalizeFromText(textPayload: string | undefined, sourceId?: string): ValidationResponse {
  const correlationId = sourceId ?? generateCorrelationId()
  const base: ValidationResponse = {
    correlationId,
    completedAt: new Date().toISOString(),
    allowed: true,
    reason: 'El agente respondió correctamente.',
    authorizationRequired: false,
  }

  if (!textPayload) {
    return base
  }

  try {
    const parsed = JSON.parse(textPayload) as Partial<ValidationResponse>
    if (typeof parsed.allowed === 'boolean') {
      return {
        ...base,
        ...parsed,
        correlationId: parsed.correlationId ?? base.correlationId,
        completedAt: parsed.completedAt ?? base.completedAt,
        reason: parsed.reason ?? base.reason,
      }
    }
  } catch {
    // Treat response as plain text when not valid JSON
  }

  return { ...base, reason: textPayload }
}

function extractAgentText(source: AzureResponsePayload) {
  const outputText = source.output_text?.find((value) => value && value.trim())
  if (outputText) {
    return outputText.trim()
  }

  for (const message of source.output ?? []) {
    if (!message?.content) {
      continue
    }
    for (const chunk of message.content) {
      if (typeof chunk === 'string' && chunk.trim()) {
        return chunk.trim()
      }
      if (typeof chunk === 'object' && chunk?.text?.trim()) {
        return chunk.text.trim()
      }
    }
  }

  return undefined
}

function extractChatText(source: ChatCompletionResponse) {
  if (!source.choices) {
    return undefined
  }

  for (const choice of source.choices) {
    const content = choice.message?.content
    if (!content) {
      continue
    }

    if (typeof content === 'string') {
      const trimmed = content.trim()
      if (trimmed) {
        return trimmed
      }
      continue
    }

    if (Array.isArray(content)) {
      for (const chunk of content) {
        if (chunk?.text) {
          const trimmed = chunk.text.trim()
          if (trimmed) {
            return trimmed
          }
        }
      }
    }
  }

  return undefined
}

function generateCorrelationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `validation-${Date.now()}`
}
