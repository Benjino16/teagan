import { MOOD_LEVELS } from '../../domain/activities'
import type { Mood } from '../../domain/model'
import { ImpactDots } from './ImpactDots'
import { moodStyles } from './styles'

interface Props {
  value: Mood
  /** Screen reader text, default “Mood: Good”. */
  label?: string
  className?: string
}

/** Mood as dots in its color (●●●●○ for “Good”). */
export function MoodDots({ value, label, className }: Props) {
  return (
    <ImpactDots
      value={value}
      label={label ?? `Mood: ${MOOD_LEVELS[value].label}`}
      fill={moodStyles[value].fill}
      className={className}
    />
  )
}
