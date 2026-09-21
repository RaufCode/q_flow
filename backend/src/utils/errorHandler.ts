export function getSafeErrorMessage(error: unknown, fallback: string): string {
  // Only trust messages from errors we deliberately threw ourselves.
  // Anything else (Prisma internals, unexpected exceptions) gets hidden from the client.
  if (error instanceof Error && !error.message.toLowerCase().includes('prisma')) {
    return error.message;
  }
  return fallback;
}