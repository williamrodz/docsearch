// Run with: npx tsx scripts/check-db.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function checkDatabase() {
  console.log('Checking Supabase connection...\n')
  console.log('URL:', supabaseUrl)

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Check if tables exist
  const tables = ['users', 'groups', 'images', 'people', 'inspections']

  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1)

    if (error) {
      console.log(`❌ Table "${table}": ${error.message}`)
    } else {
      console.log(`✅ Table "${table}": exists`)
    }
  }

  // Check storage bucket
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()

  if (bucketError) {
    console.log(`\n❌ Storage: ${bucketError.message}`)
  } else {
    const docBucket = buckets?.find(b => b.name === 'document-images')
    if (docBucket) {
      console.log(`\n✅ Storage bucket "document-images": exists`)
    } else {
      console.log(`\n❌ Storage bucket "document-images": not found`)
      console.log('   Available buckets:', buckets?.map(b => b.name).join(', ') || 'none')
    }
  }
}

checkDatabase().catch(console.error)
