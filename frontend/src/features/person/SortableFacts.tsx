import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  type Modifier,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { clsx } from 'clsx'
import { GripVertical } from 'lucide-react'
import { ListCard } from '../../components/ui'
import type { Fact, Id } from '../../domain/model'

interface Props {
  facts: Fact[]
  onReorder: (orderedIds: Id[]) => void
}

/** Rows only move up and down. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/** Sort mode of the knowledge list: drag rows by their handle. */
export function SortableFacts({ facts, onReorder }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const labelOf = (id: unknown) => facts.find((f) => f.id === id)?.label ?? 'Entry'
  const positionOf = (id: unknown) => `position ${facts.findIndex((f) => f.id === id) + 1} of ${facts.length}`

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${labelOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${labelOf(active.id)} moved to ${positionOf(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `${labelOf(active.id)} dropped at ${positionOf(over.id)}.` : undefined),
    onDragCancel: ({ active }) => `Moving ${labelOf(active.id)} was cancelled.`,
  }

  function dragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const ids = facts.map((f) => f.id)
    onReorder(arrayMove(ids, ids.indexOf(active.id as Id), ids.indexOf(over.id as Id)))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[verticalOnly]}
      onDragEnd={dragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: 'To move an entry, press Space, use the arrow keys to move it, and press Space again to drop it.',
        },
      }}
    >
      <SortableContext items={facts.map((f) => f.id)} strategy={verticalListSortingStrategy}>
        {/* Visible overflow, so the dragged row isn't clipped at the card's edge */}
        <ListCard className="overflow-visible!">
          {facts.map((fact) => (
            <SortableFact key={fact.id} fact={fact} />
          ))}
        </ListCard>
      </SortableContext>
    </DndContext>
  )
}

function SortableFact({ fact }: { fact: Fact }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: fact.id,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx(
        'relative flex items-center gap-2 bg-surface py-1.5 pr-1.5 pl-4 first:rounded-t-card last:rounded-b-card',
        isDragging && 'z-10 rounded-card shadow-fab',
      )}
    >
      <span className="flex min-w-0 flex-auto flex-col gap-0.75 py-2">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">{fact.label}</span>
        <span className="text-base font-medium whitespace-pre-line">{fact.value}</span>
      </span>
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={`Move “${fact.label}”`}
        className={clsx(
          'flex size-11 flex-none touch-none items-center justify-center rounded-full text-muted hover:bg-canvas',
          'focus-visible:outline-2 focus-visible:outline-accent',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" size={20} />
      </button>
    </li>
  )
}
