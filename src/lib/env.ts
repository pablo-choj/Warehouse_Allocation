type EnvShape = Record<string, string | boolean | undefined>

const source = import.meta.env as EnvShape

function normalize(value: string | boolean | undefined) {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') {
      return undefined
    }
    return trimmed
  }
  return undefined
}

function get(key: string, fallback?: string) {
  const raw = normalize(source[key])
  if (raw === undefined) {
    return fallback
  }
  return raw
}

function required(key: string) {
  const value = get(key)
  if (value === undefined) {
    throw new Error(`Missing required env variable ${key}`)
  }
  return value
}

function bool(key: string, fallback = false) {
  const value = get(key)
  if (value === undefined) {
    return fallback
  }
  return ['1', 'true', 'yes'].includes(value.toLowerCase())
}

export const env = {
  get,
  required,
  bool,
}
