<script setup lang="ts">
import { Check, Ticket } from 'lucide-vue-next'

definePageMeta({ layout: 'customer' })

useHead({ title: 'You left the queue' })

const startOver = () => {
  navigateTo('/ticket-registration')
}
</script>

<template>
  <div>
    <div class="px-5 pt-5 pb-6">
      <QFlowLogo />
    </div>

    <div class="flex flex-col items-center px-6 py-10 text-center">
      <div class="w-16 h-16 rounded-full bg-success-light flex items-center justify-center">
        <Check class="w-8 h-8 text-success" stroke-width="2.5" />
      </div>
      <h1 class="mt-5 text-xl font-bold text-foreground">You've left the queue</h1>
      <p class="mt-2 text-sm text-muted-foreground leading-relaxed">
        Your ticket has been cancelled and your spot has been released.
        <br class="hidden sm:block" />
        Thanks for visiting — we hope to see you again.
      </p>
    </div>

    <div class="px-6 pb-6 space-y-3">
      <button
        class="w-full inline-flex items-center justify-center gap-2 font-semibold rounded-md transition-all duration-150 bg-primary text-white hover:bg-primary-hover active:bg-primary-active px-5 py-3 text-base cursor-pointer"
        @click="startOver"
      >
        <Ticket class="w-4 h-4" />
        Join the Queue Again
      </button>
    </div>
  </div>
</template>