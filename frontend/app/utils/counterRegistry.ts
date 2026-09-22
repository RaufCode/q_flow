export interface CounterRegistryEntry {
  id: string
  counterName: string
}

export type CounterRegistry = Record<number, CounterRegistryEntry>

const KEY = 'qflow_counter_registry'

const FALLBACK_COUNTER_IDS: Record<number, string> = {
  1: '43c0e590-f0f0-4aad-a850-68d4f5610852',
  2: '0a40ee62-e96d-448d-aefc-f8b6bf331e31',
  3: 'f4278904-2cfa-437a-9596-5adbf87325b5',
  4: '76892afd-b685-4db3-89f1-3233bc6c743a',
  5: 'fa08ef29-ad6a-4d8a-85fe-95cf52eabca5',
  6: '192ef936-6eb7-4abf-81ba-cf0f402e0e88',
}

export function getCounterIdFallback(counterNumber: number): string {
  return FALLBACK_COUNTER_IDS[counterNumber] || ''
}

export function getCounterRegistry(): CounterRegistry {
  if (!import.meta.client) return {}
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as CounterRegistry) : {}
  } catch {
    return {}
  }
}

export function setCounterRegistryEntry(counterNumber: number, entry: CounterRegistryEntry) {
  if (!import.meta.client) return
  try {
    const registry = getCounterRegistry()
    registry[counterNumber] = entry
    localStorage.setItem(KEY, JSON.stringify(registry))
  } catch {
    // Storage unavailable — the manual Counter ID fallback remains available.
  }
}

export function setCounterRegistry(entries: CounterRegistryEntry[]) {
  if (!import.meta.client) return
  try {
    const registry: CounterRegistry = {}
    for (const entry of entries) {
      if (entry?.id) registry[entry.counterNumber] = entry
    }
    localStorage.setItem(KEY, JSON.stringify(registry))
  } catch {
    // Storage unavailable — the manual Counter ID fallback remains available.
  }
}