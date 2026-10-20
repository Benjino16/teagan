import { describe, expect, it } from 'vitest'
import { countFactLabels, suggestLabels } from './facts'

const facts = (...labels: string[]) => labels.map((label) => ({ label }))

describe('countFactLabels', () => {
  it('counts labels ignoring case and spaces, in the most frequent spelling', () => {
    expect(countFactLabels(facts('Job', 'job ', 'Job', 'Lives in', 'Birthplace', 'Lives in', '  '))).toEqual([
      { label: 'Job', count: 3 },
      { label: 'Lives in', count: 2 },
      { label: 'Birthplace', count: 1 },
    ])
  })

  it('sorts ties alphabetically', () => {
    expect(countFactLabels(facts('Pets', 'Hobbies')).map((l) => l.label)).toEqual(['Hobbies', 'Pets'])
  })
})

describe('suggestLabels', () => {
  const labels = countFactLabels(
    facts('Job', 'Job', 'Job', 'Lives in', 'Lives in', 'Birthplace', 'Dislikes', 'Likes', 'Pets', 'Hobbies', 'Studies'),
  )

  it('shows the most used labels for an empty input', () => {
    expect(suggestLabels(labels, '', [])).toEqual(['Job', 'Lives in', 'Birthplace', 'Dislikes', 'Hobbies', 'Likes'])
  })

  it('hides labels the person already has', () => {
    expect(suggestLabels(labels, '', ['job ', 'Lives in'], 2)).toEqual(['Birthplace', 'Dislikes'])
  })

  it('puts prefix matches before other matches', () => {
    expect(suggestLabels(labels, 'li', [])).toEqual(['Lives in', 'Likes', 'Dislikes'])
  })

  it('does not suggest the label that is already typed', () => {
    expect(suggestLabels(labels, 'job', [])).toEqual([])
  })
})
