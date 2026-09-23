<script setup lang="ts">
import { QrCode, Download, Loader2 } from 'lucide-vue-next'
import QRCode from 'qrcode'
import { apiRequest } from '~/utils/api'
import { trim, isValidUrl } from '~/utils/validate'

const showToast = inject<(msg: string) => void>('showToast', () => {})

const DEFAULT_SITE = 'QFlow'
const URL_KEY = 'qflow_checkin_url'

interface QrAssets {
  targetUrl: string
  pngDataUrl: string
  svgString?: string
}

const urlInput = ref('')
const urlError = ref('')
const urlTouched = ref(false)
const generating = ref(false)
const qr = ref<QrAssets | null>(null)

const validateUrl = () => {
  const v = trim(urlInput.value)
  if (!v) urlError.value = 'Check-in URL is required.'
  else if (!isValidUrl(v)) urlError.value = 'Enter a full link starting with http:// or https:// (no spaces).'
  else urlError.value = ''
  return !urlError.value
}

const validateUrlField = () => {
  urlTouched.value = true
  validateUrl()
}

const origin = import.meta.client ? window.location.origin : ''

const defaultUrl = () => `${origin}/ticket-registration?site=${encodeURIComponent(DEFAULT_SITE)}`

const targetUrl = computed(() => trim(urlInput.value) || defaultUrl())

const generate = async () => {
  if (!validateUrl()) {
    urlTouched.value = true
    showToast(urlError.value)
    return
  }
  generating.value = true
  try {
    let assets: QrAssets
    try {
      const res = await apiRequest<{ message: string; data: QrAssets }>('/admin/qr-code', {
        method: 'GET',
        body: { checkInUrl: targetUrl.value },
      })
      assets = res.data
    } catch {
      // Backend generation unavailable — fall back to in-browser generation.
      const pngDataUrl = await QRCode.toDataURL(targetUrl.value, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 1024,
      })
      assets = { targetUrl: targetUrl.value, pngDataUrl }
    }
    qr.value = assets
  } catch {
    showToast('Failed to generate QR code')
  } finally {
    generating.value = false
  }
}

let generateTimer: ReturnType<typeof setTimeout> | null = null

const scheduleRegenerate = () => {
  if (generateTimer) clearTimeout(generateTimer)
  generateTimer = setTimeout(() => {
    if (qr.value) generate()
  }, 500)
}

onMounted(() => {
  urlInput.value = localStorage.getItem(URL_KEY) || defaultUrl()
})

onUnmounted(() => {
  if (generateTimer) clearTimeout(generateTimer)
})

watch(urlInput, (val) => {
  localStorage.setItem(URL_KEY, val)
  if (qr.value) scheduleRegenerate()
})

const downloadName = () => `${DEFAULT_SITE.toLowerCase()}-check-in-qr.png`
</script>

<template>
  <div class="mx-auto w-full max-w-lg">
    <div class="card p-6 text-center shadow-sm sm:p-8">
      <!-- Header -->
      <span class="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary-light text-primary-dark-text">
        <QrCode class="h-7 w-7" />
      </span>
      <h2 class="text-xl font-extrabold tracking-tight text-foreground">QR Code Generator</h2>
      <p class="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Create a check-in QR code for your customers.
      </p>

      <!-- URL form -->
      <div class="mt-6 space-y-2 text-left">
        <label class="label" for="checkin-url">Check-in URL</label>
        <input
          id="checkin-url"
          v-model="urlInput"
          type="url"
          inputmode="url"
          spellcheck="false"
          class="input font-mono"
          :class="urlTouched && urlError ? 'border-danger' : ''"
          placeholder="https://your-site.com/ticket-registration?site=QFlow"
          @blur="validateUrlField"
          @input="urlTouched && validateUrl()"
        />
        <p v-if="urlTouched && urlError" class="text-xs text-danger">{{ urlError }}</p>
      </div>

      <button
        :disabled="generating"
        class="btn btn-md btn-primary mt-4 w-full justify-center"
        @click="generate"
      >
        <Loader2 v-if="generating" class="h-4 w-4 animate-spin" />
        <QrCode v-else class="h-4 w-4" />
        {{ qr ? 'Regenerate QR Code' : 'Generate QR Code' }}
      </button>

      <!-- Result -->
      <div v-if="qr" class="mt-6 flex flex-col items-center gap-4">
        <div class="relative w-full max-w-[240px] overflow-hidden rounded-xl border border-border bg-white p-4 shadow-sm">
          <div
            v-if="generating"
            class="absolute inset-0 z-10 grid animate-pulse place-items-center bg-muted/60"
          >
            <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
          <img
            :src="qr.pngDataUrl"
            :alt="`${DEFAULT_SITE} check-in QR code`"
            class="mx-auto w-full"
            style="image-rendering: pixelated"
          />
        </div>

        <p class="max-w-full truncate rounded-md bg-input-bg px-3 py-2 font-mono text-[11px] text-muted-foreground" :title="qr.targetUrl">
          {{ qr.targetUrl }}
        </p>

        <a
          :href="qr.pngDataUrl"
          :download="downloadName()"
          class="btn btn-md btn-primary w-full justify-center"
        >
          <Download class="h-4 w-4" />
          Download QR Code
        </a>
      </div>
    </div>
  </div>
</template>