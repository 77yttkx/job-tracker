import { Code2 } from 'lucide-react'
import { InterviewPrepShell } from '../../components/interviewPrep/InterviewPrepShell'

/**
 * Placeholder for the future "Technical Interview" sub-area (V3.2 spec
 * section 1): visible in navigation, with a real route, but no form or
 * feature yet - deliberately not a broken/blank page. No data hook, no
 * Supabase call, nothing to test beyond "this route renders this
 * message" (see interviewPrepNavigationAndIndependence.test.ts).
 */
export function TechnicalComingSoonPage() {
  return (
    <InterviewPrepShell showBQTabs={false}>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-16 text-center dark:border-slate-700">
        <Code2 className="h-8 w-8 text-slate-400" aria-hidden="true" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Technical Interview - coming soon</p>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          A dedicated space for preparing technical interview answers is planned for a future update. For now,
          Behavioral (BQ) is fully available.
        </p>
      </div>
    </InterviewPrepShell>
  )
}
