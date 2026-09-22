// Thin re-export. The canonical implementation lives under
// supabase/functions/_shared/parsing/, because the Supabase Edge Function
// bundler only includes files inside supabase/functions/ (an import
// reaching into src/ fails to deploy). This file exists purely so
// frontend code/tests can keep importing '../parseJobHtml' unchanged, and
// is the same code path exercised in production by the parse-job function.
export * from '../../../supabase/functions/_shared/parsing/parseJobHtml.ts'
