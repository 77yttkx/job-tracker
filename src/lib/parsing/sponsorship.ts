// Thin re-export. The canonical implementation lives under
// supabase/functions/_shared/parsing/, because the Supabase Edge Function
// bundler only includes files inside supabase/functions/ (an import
// reaching into src/ fails to deploy). This file exists purely so
// frontend code/tests can keep importing '../sponsorship' unchanged.
export { classifySponsorship } from '../../../supabase/functions/_shared/parsing/sponsorship.ts'
