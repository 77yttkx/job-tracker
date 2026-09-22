import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'App.tsx'),
  'utf-8',
)

/**
 * V2.6 requirement: "Require authentication before entering the Job
 * Tracker" / "unauthenticated users cannot enter the app". This codebase
 * has no component-rendering test setup (see insightsScope.test.ts for
 * the same source-level pattern used throughout), so this guards the
 * gating logic itself: App.tsx must render the authenticated UI
 * (AppShell/InsightsPage/TablePage/useJobs) only from inside a branch
 * that is reached exclusively when a session exists, and must render the
 * sign-in/sign-up/forgot-password UI otherwise.
 */
describe('App auth gating (source-level regression guard)', () => {
  it('renders AuthenticatedApp (which mounts useJobs/AppShell) only when auth.session is present', () => {
    expect(appSource).toMatch(/if \(!auth\.session\)\s*\{\s*return <UnauthenticatedApp/)
    expect(appSource).toMatch(
      /return <AuthenticatedApp auth=\{auth\} userId=\{auth\.session\.user\.id\}/,
    )
  })

  it('never renders AppShell/InsightsPage/TablePage/useJobs outside the AuthenticatedApp component', () => {
    const authenticatedAppBody = appSource.slice(
      appSource.indexOf('function AuthenticatedApp'),
      appSource.indexOf('function UnauthenticatedApp'),
    )
    // Everything below (the top-level App() export) must not itself
    // reference these - it must only ever delegate to AuthenticatedApp.
    const rest = appSource.slice(appSource.indexOf('export default function App'))
    expect(authenticatedAppBody).toMatch(/useJobs\(userId\)/)
    expect(authenticatedAppBody).toMatch(/<AppShell/)
    expect(rest).not.toMatch(/useJobs\(/)
    expect(rest).not.toMatch(/<AppShell/)
    expect(rest).not.toMatch(/<InsightsPage/)
    expect(rest).not.toMatch(/<TablePage/)
  })

  it('routes unauthenticated visitors only to sign-in/sign-up/forgot-password/reset-password, never to /insights or /table', () => {
    const unauthenticatedAppBody = appSource.slice(
      appSource.indexOf('function UnauthenticatedApp'),
      appSource.indexOf('export default function App'),
    )
    expect(unauthenticatedAppBody).toMatch(/path="\/sign-in"/)
    expect(unauthenticatedAppBody).toMatch(/path="\/sign-up"/)
    expect(unauthenticatedAppBody).toMatch(/path="\/forgot-password"/)
    expect(unauthenticatedAppBody).toMatch(/path="\/reset-password"/)
    expect(unauthenticatedAppBody).not.toMatch(/path="\/insights"/)
    expect(unauthenticatedAppBody).not.toMatch(/path="\/table"/)
  })

  it('shows a loading state before the first session check resolves, rather than defaulting to either app', () => {
    expect(appSource).toMatch(/auth\.loading/)
  })
})
