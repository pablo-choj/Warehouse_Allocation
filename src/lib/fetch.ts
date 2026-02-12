import { env } from './env'

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  searchParams?: Record<string, string | number>
}

type HttpResponse<T> = {
  data: T
  status: number
}

const fallbackOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
const rawBaseUrl = env.get('VITE_FOUNDRY_API_URL')
const baseUrl = (typeof rawBaseUrl === 'string' ? rawBaseUrl : undefined) ?? fallbackOrigin

const rawProjectKey = env.get('VITE_VALIDATION_API_KEY')
const sharedKey = env.get('VITE_FOUNDRY_API_KEY')
const apiKey =
  (typeof rawProjectKey === 'string' ? rawProjectKey : undefined) ??
  (typeof sharedKey === 'string' ? sharedKey : undefined)

const rawAnthropicVersion = env.get('VITE_ANTHROPIC_VERSION')
const anthropicVersion = (typeof rawAnthropicVersion === 'string' ? rawAnthropicVersion : undefined) ?? '2023-06-01'

async function request<T>(path: string, options: RequestOptions = {}): Promise<HttpResponse<T>> {
  const url = new URL(path, baseUrl)
  const isAnthropic = url.pathname.includes('/anthropic/')
  const isOpenAI = url.pathname.includes('/openai/') || url.hostname.endsWith('.openai.azure.com')

  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, String(value))
    })
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (apiKey) {
    if (isAnthropic) {
      if (!headers['x-api-key']) headers['x-api-key'] = apiKey
      if (!headers['anthropic-version']) headers['anthropic-version'] = anthropicVersion
      // Do not attach Azure OpenAI 'api-key' header to Anthropic endpoints.
    } else if (isOpenAI) {
      if (!headers['api-key']) headers['api-key'] = apiKey
    } else if (!headers['Authorization']) {
      // Fallback: treat as bearer token only when explicitly provided.
      // This avoids accidentally sending API keys as OAuth tokens.
    }
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Request failed with status ${response.status}`)
  }

  const data = (await response.json()) as T
  return { data, status: response.status }
}

function extract<T>(promise: Promise<HttpResponse<T>>) {
  return promise.then((result) => result.data)
}

export const http = {
  get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return extract(request<T>(path, { ...options, method: 'GET' }))
  },
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return extract(request<T>(path, { ...options, method: 'POST', body }))
  },
  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return extract(request<T>(path, { ...options, method: 'PUT', body }))
  },
}
