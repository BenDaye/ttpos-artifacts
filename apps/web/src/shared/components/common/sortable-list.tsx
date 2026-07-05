import type {
  DragEndEvent,
} from '@dnd-kit/core'
import type {
  SortingStrategy,
} from '@dnd-kit/sortable'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@ttpos/ui/lib/utils'

// 拖拽手柄需要附加到具体元素上的属性集合，由 dnd-kit 提供
export type SortableHandleProps = HTMLAttributes<HTMLElement> & {
  ref: (element: HTMLElement | null) => void
}

export interface SortableItemRenderProps {
  // 包裹整个可排序项的容器，负责定位变换
  setNodeRef: (element: HTMLElement | null) => void
  style: CSSProperties
  // 拖拽中状态，便于消费方淡化展示
  isDragging: boolean
  // 仅绑定到拖拽手柄上的属性（监听器 + 无障碍属性 + ref）
  handleProps: SortableHandleProps
}

interface SortableItemProps {
  id: string
  disabled?: boolean
  children: (props: SortableItemRenderProps) => ReactNode
}

function SortableItem({ id, disabled, children }: SortableItemProps) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  const style: CSSProperties = {
    // dnd-kit 的位置变换属于功能性内联样式，非设计 token，按官方用法处理
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <>
      {children({
        setNodeRef,
        style,
        isDragging,
        handleProps: {
          ref: setActivatorNodeRef,
          ...attributes,
          ...listeners,
        },
      })}
    </>
  )
}

export interface SortableListProps {
  // 当前完整有序的 ID 列表
  ids: string[]
  // 拖拽完成后回调，返回重排后的完整有序 ID 列表
  onReorder: (ids: string[]) => void
  // 渲染单个可排序项；消费方拿到 sortable 能力后自行组装 UI
  renderItem: (id: string, sortable: SortableItemRenderProps) => ReactNode
  // 排序策略：网格用 rectSortingStrategy，纵向列表用 verticalListSortingStrategy
  strategy?: SortingStrategy
  // 禁用拖拽（如搜索过滤激活时）
  disabled?: boolean
  className?: string
}

export function SortableList({
  ids,
  onReorder,
  renderItem,
  strategy = rectSortingStrategy,
  disabled = false,
  className,
}: SortableListProps) {
  const sensors = useSensors(
    // distance 约束避免点击手柄/按钮时误触发拖拽，也兼容行点击场景
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) {
      return
    }
    onReorder(arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={strategy} disabled={disabled}>
        <div className={cn(className)}>
          {ids.map(id => (
            <SortableItem key={id} id={id} disabled={disabled}>
              {sortable => renderItem(id, sortable)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
