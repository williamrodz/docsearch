import { createBrowserClient } from '@supabase/ssr'

// Note: Using untyped client for now. Generate proper types with:
// supabase gen types typescript --project-id snpxshfkrmaogbfcnaec > src/lib/types/database.ts

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
