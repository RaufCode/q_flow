<script setup lang="ts">
import type { Component } from 'vue'
import { Menu, X, LogOut, ChevronUp } from 'lucide-vue-next'

const props = defineProps<{
  navItems: { key: string; label: string; icon: Component }[]
  activePage: string
  userName: string
  userRole: string
  title?: string
}>()

const emit = defineEmits<{ navigate: [key: string]; signOut: [] }>()

const { init: initTheme } = useTheme()

const navOpen = ref(false)
const collapsed = ref(false)
const userMenu = ref(false)
const userMenuEl = ref<HTMLElement | null>(null)

const activeItem = computed(() => props.navItems.find((i) => i.key === props.activePage))
const initials = computed(() =>
  (props.userName || '?')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase(),
)

const today = ref('')

const todayLabel = () =>
  new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })

const handleNav = (key: string) => {
  emit('navigate', key)
  navOpen.value = false
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    navOpen.value = false
    userMenu.value = false
  }
}

const onDocClick = (e: MouseEvent) => {
  if (userMenuEl.value && !userMenuEl.value.contains(e.target as Node)) userMenu.value = false
}

watch(navOpen, (open) => {
  if (import.meta.client) document.body.style.overflow = open ? 'hidden' : ''
})

onMounted(() => {
  initTheme()
  today.value = todayLabel()
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('click', onDocClick)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onDocClick)
  if (import.meta.client) document.body.style.overflow = ''
})
</script>

<template>
  <div class="min-h-screen bg-bg-page text-foreground">
    <!-- Mobile backdrop -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="navOpen"
        class="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
        aria-hidden="true"
        @click="navOpen = false"
      />
    </Transition>

    <!-- Sidebar -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-border bg-sidebar transition-[width,transform] duration-300 ease-out',
        collapsed ? 'lg:w-[80px]' : 'lg:w-[264px]',
        'lg:translate-x-0',
        navOpen ? 'translate-x-0 shadow-pop' : '-translate-x-full',
      ]"
      aria-label="Primary navigation"
    >
      <!-- Brand -->
      <div class="flex h-16 flex-shrink-0 items-center border-b border-white/10 px-3">
        <NuxtLink
          to="/"
          :title="collapsed ? 'QFLOW' : undefined"
          :class="[
            'flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            collapsed ? 'lg:flex-1 lg:justify-center' : 'min-w-0 flex-1',
          ]"
        >
          <span
            :class="[
              'truncate text-[15px] font-extrabold uppercase leading-none tracking-[0.18em] text-gray-400',
              collapsed ? 'lg:block' : 'ml-3',
            ]"
          >
            {{ collapsed ? 'Q' : 'QFLOW' }}
          </span>
        </NuxtLink>
        <button
          type="button"
          class="ml-auto inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
          aria-label="Close navigation"
          @click="navOpen = false"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Nav -->
      <nav class="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <ul class="space-y-1">
          <li v-for="item in navItems" :key="item.key">
            <button
              type="button"
              :title="collapsed ? item.label : undefined"
              :aria-current="activePage === item.key ? 'page' : undefined"
              :class="[
                'group relative flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                collapsed ? 'lg:justify-center lg:px-0' : '',
                activePage === item.key
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-400 hover:bg-white/10 hover:text-white',
              ]"
              @click="handleNav(item.key)"
            >
              <component :is="item.icon" class="h-[18px] w-[18px] flex-shrink-0" />
              <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
            </button>
          </li>
        </ul>
      </nav>

      <!-- User -->
      <div ref="userMenuEl" class="relative flex-shrink-0 border-t border-white/10 p-3">
        <div
          v-if="userMenu"
          class="absolute bottom-full left-2 right-2 z-30 mb-2 overflow-hidden rounded-md border border-white/10 bg-gray-800 shadow-pop"
          role="menu"
          :aria-label="'User menu'"
        >
          <div class="border-b border-white/10 px-4 py-3">
            <p class="truncate text-sm font-bold text-white">{{ userName }}</p>
            <p class="truncate text-xs text-gray-400">{{ userRole }}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            class="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold text-gray-300 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            @click="emit('signOut')"
          >
            <LogOut class="h-4 w-4" />
            Sign Out
          </button>
        </div>

        <button
          type="button"
          :aria-haspopup="'menu'"
          :aria-expanded="userMenu"
          class="group flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          @click="userMenu = !userMenu"
        >
          <span
            class="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold text-white"
            :title="collapsed ? userName : undefined"
          >
            {{ initials }}
          </span>
          <div v-if="!collapsed" class="min-w-0 flex-1">
            <p class="truncate text-sm font-bold text-white">{{ userName }}</p>
            <p class="truncate text-xs text-gray-400">{{ userRole }}</p>
          </div>
          <ChevronUp
            class="ml-auto h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200"
            :class="userMenu ? 'rotate-0' : 'rotate-180'"
          />
        </button>
      </div>
    </aside>

    <!-- Content -->
    <div
      :class="[
        'flex min-h-screen flex-col transition-[padding] duration-300 ease-out',
        collapsed ? 'lg:pl-[80px]' : 'lg:pl-[264px]',
      ]"
    >
      <!-- Topbar -->
      <header class="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-xl">
        <div class="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-3 px-4 sm:px-5 lg:px-5">
          <button
            type="button"
            class="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
            aria-label="Open navigation"
            @click="navOpen = true"
          >
            <Menu class="h-[18px] w-[18px]" />
          </button>

          <div class="min-w-0">
            <h1 class="truncate text-base font-extrabold tracking-tight text-foreground">
              {{ title || activeItem?.label || 'Dashboard' }}
            </h1>
            <p class="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
              <span>{{ userRole }}</span>
              <span class="text-border">•</span>
              <span>{{ today }}</span>
            </p>
          </div>

          <div class="flex-1" />

          <div
            class="hidden items-center gap-2 rounded-full border border-border bg-bg-page px-3 py-1.5 sm:flex"
          >
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span class="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span class="text-xs font-semibold text-muted-foreground">Live</span>
          </div>
        </div>
      </header>

      <main class="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-5 lg:px-5">
        <Transition name="pagefade" mode="out-in">
          <slot />
        </Transition>
      </main>
    </div>
  </div>
</template>