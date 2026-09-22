import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appShellSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'AppShell.tsx'),
  'utf-8',
)

/**
 * V2.5.1 #3: on desktop/tablet the sidebar must stay fixed to the viewport
 * while the main column scrolls a long Table list, with Add Job / Dark
 * mode pinned at its bottom, and the existing mobile bottom nav must be
 * untouched. This is a layout/CSS fact a pure unit test can't otherwise
 * observe (no component-rendering test setup in this codebase - see
 * insightsScope.test.ts for the same pattern), so it's guarded at the
 * source level instead.
 */
describe('AppShell desktop sidebar layout (source-level regression guard)', () => {
  it('pins the desktop <aside> to the viewport height via sticky + h-screen', () => {
    const asideMatch = /<aside className="([^"]*)"/.exec(appShellSource)
    expect(asideMatch).not.toBeNull()
    const asideClasses = asideMatch![1]
    expect(asideClasses).toMatch(/md:sticky/)
    expect(asideClasses).toMatch(/md:top-0/)
    expect(asideClasses).toMatch(/md:h-screen/)
  })

  it('never uses a fixed desktop sidebar (would break the left offset of scrolling content)', () => {
    const asideMatch = /<aside className="([^"]*)"/.exec(appShellSource)
    expect(asideMatch![1]).not.toMatch(/md:fixed/)
  })

  it('keeps the mobile bottom nav fixed and unaffected by the desktop-only sidebar change', () => {
    const navMatch = /<nav\s+aria-label="Primary"\s+className="([^"]*)"/.exec(appShellSource)
    expect(navMatch).not.toBeNull()
    expect(navMatch![1]).toMatch(/fixed inset-x-0 bottom-0/)
    expect(navMatch![1]).toMatch(/md:hidden/)
  })

  it('keeps Add Job and the theme toggle inside the sidebar, after the scrollable nav', () => {
    const asideBody = appShellSource.slice(
      appShellSource.indexOf('<aside'),
      appShellSource.indexOf('</aside>'),
    )
    const navIdx = asideBody.indexOf('<nav')
    const addJobIdx = asideBody.indexOf('Add Job')
    const themeToggleIdx = asideBody.indexOf('<ThemeToggle')
    expect(navIdx).toBeGreaterThan(-1)
    expect(addJobIdx).toBeGreaterThan(navIdx)
    expect(themeToggleIdx).toBeGreaterThan(navIdx)
  })
})

/**
 * V2.6: every signed-in view must show whose workspace this is and offer
 * a way out. Source-level guard (no component-rendering setup in this
 * codebase - see insightsScope.test.ts for the same pattern).
 */
describe('AppShell auth affordances (source-level regression guard)', () => {
  it('accepts userEmail and onSignOut props and renders the email and a sign-out control', () => {
    expect(appShellSource).toMatch(/userEmail:\s*string/)
    expect(appShellSource).toMatch(/onSignOut:\s*\(\)\s*=>\s*void/)
    expect(appShellSource).toMatch(/\{userEmail\}/)
    expect(appShellSource).toMatch(/onClick=\{onSignOut\}/)
  })

  it('shows the sign-out control in both the desktop sidebar and the mobile header', () => {
    const signOutOccurrences = appShellSource.split('onClick={onSignOut}').length - 1
    expect(signOutOccurrences).toBe(2)
  })
})
