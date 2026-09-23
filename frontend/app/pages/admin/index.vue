<script setup lang="ts">
import DashboardLayout from '~/layouts/dashboard.vue'
import { LayoutDashboard, Hash, Users, QrCode, Ticket } from 'lucide-vue-next'

definePageMeta({ layout: false })

type AdminPage = 'overview' | 'counters' | 'staff' | 'tickets' | 'qr'
const allPages: AdminPage[] = ['overview', 'counters', 'staff', 'tickets', 'qr']

const route = useRoute()
const router = useRouter()

const pageQuery = route.query.page
const initialPage: AdminPage =
  typeof pageQuery === 'string' && (allPages as string[]).includes(pageQuery)
    ? (pageQuery as AdminPage)
    : 'overview'

const activePage = ref<AdminPage>(initialPage)

const setPage = (page: AdminPage) => {
  activePage.value = page
  const query = { ...route.query }
  if (page === 'overview') {
    delete query.page
  } else {
    query.page = page
  }
  router.replace({ query })
}

const { user, logout } = useAuth()

const navItems = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'counters', label: 'Counters', icon: Hash },
  { key: 'staff', label: 'Staff', icon: Users },
  { key: 'tickets', label: 'Tickets', icon: Ticket },
  { key: 'qr', label: 'QR Codes', icon: QrCode },
]

const { message, visible, tone, showToast } = useToast()
provide('showToast', showToast)

const userName = computed(() => user.value?.fullName || 'Administrator')
const userRole = computed(() => 'Branch Manager')

const handleSignOut = async () => {
  await logout({ unbind: false })
  navigateTo('/')
}
</script>

<template>
  <div>
    <DashboardLayout
      :navItems="navItems"
      :activePage="activePage"
      :userName="userName"
      :userRole="userRole"
      title="Admin Dashboard"
      @navigate="setPage($event as AdminPage)"
      @signOut="handleSignOut"
    >
      <AdminOverview v-if="activePage === 'overview'" />
      <AdminCounters v-else-if="activePage === 'counters'" />
      <AdminStaff v-else-if="activePage === 'staff'" />
      <AdminTickets v-else-if="activePage === 'tickets'" />
      <AdminQR v-else-if="activePage === 'qr'" />
    </DashboardLayout>
    <ToastMessage :message="message" :visible="visible" :tone="tone" />
  </div>
</template>
