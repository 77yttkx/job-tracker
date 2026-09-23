import type { ReactNode } from 'react'
import { InterviewPrepAreaNav } from './InterviewPrepAreaNav'
import { BQTabs } from './BQTabs'

/**
 * Shared page chrome for every Interview Prep page (V3.2): the "Interview
 * Prep" title/subtitle, the area nav (Behavioral (BQ) / Technical
 * Interview), and - only for pages inside the BQ area - BQTabs beneath
 * it. Replaces the V3.1 InterviewPrepPage.tsx now that Interview Prep is
 * a parent category rather than a single flat set of tabs (spec section
 * 1). `showBQTabs` defaults to true since every current page except the
 * Technical Interview "coming soon" placeholder lives under BQ.
 */
export function InterviewPrepShell({ showBQTabs = true, children }: { showBQTabs?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Interview Prep</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Organize your interview preparation - write your own answers, then save, tag, and review them here.
          Completely separate from your job applications, except where you explicitly choose to prepare using one.
        </p>
      </div>
      <InterviewPrepAreaNav />
      {showBQTabs && <BQTabs />}
      {children}
    </div>
  )
}
