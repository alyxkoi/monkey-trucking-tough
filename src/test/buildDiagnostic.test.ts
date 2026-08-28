// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('Control Center build diagnostic', () => {
  it('shows build identity in the live Printing and System settings screen', () => {
    const app = read('src/App.tsx')
    const settings = read('src/control-center/approved/screens/settings/index.tsx')
    const vite = read('vite.config.ts')

    expect(app).toContain('default: module.SettingsPrinting')
    expect(settings).toContain('label="Application build"')
    expect(settings).toContain('BUILD_INFO.id')
    expect(vite).toContain('__APP_BUILD_ID__')
    expect(vite).toContain('GITHUB_SHA')
    expect(vite).toContain('git", ["rev-parse"')
  })
})
