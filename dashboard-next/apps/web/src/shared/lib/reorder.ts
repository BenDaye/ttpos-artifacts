// 按给定的有序 ID 列表对实体数组重排，用于拖拽排序的乐观更新。
// 未出现在 ids 中的项会保持原相对顺序追加到末尾，避免乐观重排时丢项。
export function reorderById<T>(
  items: T[],
  ids: string[],
  getId: (item: T) => string,
): T[] {
  const byId = new Map(items.map(item => [getId(item), item]))
  const ordered: T[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    const item = byId.get(id)
    if (item !== undefined) {
      ordered.push(item)
      seen.add(id)
    }
  }
  for (const item of items) {
    if (!seen.has(getId(item))) {
      ordered.push(item)
    }
  }
  return ordered
}
