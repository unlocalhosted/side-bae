import { describe, expect, it } from 'vitest'
import { main } from './index.js'

describe('main', () => {
  it('runs without error', () => {
    expect(() => main()).not.toThrow()
  })
})
