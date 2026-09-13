import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { X } from 'lucide-react';
import { useEditorStore } from '@/features/editor/store';

export function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  interactionWidth = 24,
}: EdgeProps) {
  const locked = useEditorStore((s) => s.locked);
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={interactionWidth}
        style={{
          ...style,
          strokeWidth: selected ? 3 : ((style?.strokeWidth as number | undefined) ?? 2),
        }}
      />
      {!locked && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={`nodrag nopan workflow-edge-delete-btn${selected ? ' is-selected' : ''}`}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            title="Xóa kết nối"
            aria-label="Xóa kết nối"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              useEditorStore.getState().removeEdge(id);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
