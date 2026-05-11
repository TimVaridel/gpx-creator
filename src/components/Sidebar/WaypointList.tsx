import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Waypoint } from '../../types/route.types';

// ── Item draggable ───────────────────────────────────────────
interface SortableItemProps {
  waypoint: Waypoint;
  index: number;
  total: number;
  onRemove: (id: string) => void;
}

const SortableItem = ({ waypoint, index, total, onRemove }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: waypoint.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  const dotColor =
    index === 0
      ? 'bg-green-500'
      : index === total - 1
        ? 'bg-red-500'
        : 'bg-blue-400';

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between bg-gray-50
                 border border-gray-200 rounded-lg px-3 py-2
                 hover:bg-gray-100 transition-colors select-none"
    >
      {/* Poignée de drag */}
      <button
        {...attributes}
        {...listeners}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing
                   mr-2 text-lg leading-none flex-shrink-0"
        title="Déplacer"
      >
        ⠿
      </button>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className={`
          w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
          text-xs font-bold text-white ${dotColor}
        `}>
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-700 truncate">
            {waypoint.name}
          </p>
          <p className="text-xs text-gray-400">
            {waypoint.lat.toFixed(5)}, {waypoint.lng.toFixed(5)}
          </p>
        </div>
      </div>

      <button
        onClick={() => onRemove(waypoint.id)}
        className="text-gray-400 hover:text-red-500 transition-colors ml-2 text-lg leading-none flex-shrink-0"
        title="Supprimer ce point"
      >
        ×
      </button>
    </li>
  );
};

// ── Liste principale ─────────────────────────────────────────
interface WaypointListProps {
  waypoints: Waypoint[];
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

const WaypointList = ({ waypoints, onRemove, onReorder }: WaypointListProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // évite le drag accidentel
    })
  );

  if (waypoints.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        <p className="text-4xl mb-2">🗺️</p>
        <p className="text-sm">Clique sur la carte pour</p>
        <p className="text-sm">ajouter des points</p>
      </div>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIndex = waypoints.findIndex(wp => wp.id === active.id);
    const toIndex = waypoints.findIndex(wp => wp.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      onReorder(fromIndex, toIndex);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={waypoints.map(wp => wp.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="space-y-2">
          {waypoints.map((wp, index) => (
            <SortableItem
              key={wp.id}
              waypoint={wp}
              index={index}
              total={waypoints.length}
              onRemove={onRemove}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
};

export default WaypointList;
