'use client';

import { useState, type ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props<T extends { id: number }> {
  items: T[];
  // Used for the grip's accessible name and the screen-reader announcements,
  // so a keyboard drag says "Picked up Fix the auth loop" rather than an id.
  labelOf: (item: T) => string;
  onReorder: (orderedIds: number[]) => void | Promise<void>;
  className?: string;
  rowClassName?: string;
  children: (item: T) => ReactNode;
}

function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((id) => set.has(id));
}

export default function SortableRows<T extends { id: number }>({
  items,
  labelOf,
  onReorder,
  className,
  rowClassName,
  children,
}: Props<T>) {
  // The order the caller is about to persist. Reordering round-trips through
  // the API and a full refresh, so without this the dropped row snaps back to
  // where it came from for as long as that takes. Cleared once the caller's
  // handler resolves, by which point props carry the new order.
  const [pendingOrder, setPendingOrder] = useState<number[] | null>(null);

  const ids = items.map((item) => item.id);
  // A pending order that no longer covers the same items is stale -- something
  // was pinned or unpinned while the reorder was in flight. Props win.
  const order = pendingOrder && sameSet(pendingOrder, ids) ? pendingOrder : ids;
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = order.map((id) => byId.get(id)).filter((item): item is T => item !== undefined);

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so clicking the grip (or a
    // control next to it) never registers as a reorder.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function describe(id: UniqueIdentifier): string {
    const item = byId.get(Number(id));
    return item ? labelOf(item) : 'item';
  }

  function positionOf(id: UniqueIdentifier): string {
    return `position ${order.indexOf(Number(id)) + 1} of ${order.length}`;
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${describe(active.id)}, ${positionOf(active.id)}.`,
    // dnd-kit fires a drag-over against the lifted row itself the moment it is
    // picked up. Announcing that would talk over "Picked up ..." with a
    // position that has not changed, so only real moves are announced.
    onDragOver: ({ active, over }) =>
      over && over.id !== active.id ? `${describe(active.id)} moved to ${positionOf(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${describe(active.id)} dropped at ${positionOf(over.id)}.`
        : `${describe(active.id)} dropped.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${describe(active.id)} returned to ${positionOf(active.id)}.`,
  };

  async function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = order.indexOf(Number(active.id));
    const to = order.indexOf(Number(over.id));
    if (from === -1 || to === -1) return;
    const next = arrayMove(order, from, to);
    setPendingOrder(next);
    try {
      await onReorder(next);
    } finally {
      setPendingOrder(null);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements }}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {ordered.map((item) => (
            <SortableRow key={item.id} id={item.id} label={labelOf(item)} className={rowClassName}>
              {children(item)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface RowProps {
  id: number;
  label: string;
  className?: string;
  children: ReactNode;
}

function SortableRow({ id, label, className, children }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    // Vertical only -- zeroing x is cheaper than pulling in @dnd-kit/modifiers
    // for a single axis restriction.
    transform: transform ? CSS.Translate.toString({ ...transform, x: 0 }) : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(className, isDragging && 'relative z-10 rounded-md bg-background shadow-lg')}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${label}`}
        className={cn(
          'shrink-0 cursor-grab touch-none rounded text-muted-foreground',
          'hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          isDragging && 'cursor-grabbing text-foreground',
        )}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}
