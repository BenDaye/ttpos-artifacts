import { useState } from 'react'

/**
 * 只存稳定 id，每次渲染从最新 `items` 按 id 派生「活」选中项，
 * 避免「选中项快照冻结」：把整对象存进 useState 后，弹层内 mutation 触发
 * refetch 得到新对象，但快照仍指向旧对象 → 仍打开的弹层显示过期数据。
 * 派生后 refetch 自动刷新；选中项被删则派生为 null，`Boolean(selected)`
 * 的弹层 open 判定随之关闭，无需手动收尾。
 *
 * @param items 最新列表数据（来自 query，refetch 后会变化）
 * @param getId 从实体取稳定标识
 * @returns `[selected, setSelectedId, selectedId]`
 */
export function useSelectedEntity<T>(
  items: T[],
  getId: (item: T) => string,
): readonly [T | null, (id: string | null) => void, string | null] {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = selectedId == null
    ? null
    : items.find(item => getId(item) === selectedId) ?? null
  return [selected, setSelectedId, selectedId] as const
}
