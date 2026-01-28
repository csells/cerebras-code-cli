import { createMemo, For } from "solid-js"
import { useTheme } from "../../../context/theme"
import { formatDuration } from "./analytics"
import { Bead } from "@/session/bead"

/**
 * Enhanced beads DAG visualization component.
 * Shows beads as a tree with status indicators and elapsed time.
 */

interface BeadInfo {
  id: string
  title: string
  status: string
  priority: number
  issue_type?: string
  dependency_count?: number
  dependent_count?: number
}

interface BeadNode {
  bead: BeadInfo
  children: BeadNode[]
}

/**
 * Status icon for a bead based on its status.
 */
function statusIcon(status: string): string {
  switch (status) {
    case "closed":
      return "✓ " // Checkmark for completed
    case "in_progress":
      return "● " // Filled circle for in progress
    case "blocked":
      return "◌ " // Dotted circle for blocked
    default:
      return "○ " // Hollow circle for open/ready
  }
}

/**
 * Priority indicator (P0-P4).
 */
function priorityLabel(priority: number): string {
  return `P${priority}`
}

export function BeadNodeView(props: { node: BeadNode; depth: number }) {
  const { theme } = useTheme()

  // Indentation using tree characters
  const indent = createMemo(() => {
    if (props.depth === 0) return ""
    return "│ ".repeat(props.depth - 1) + "├─"
  })

  // Status-based color
  const statusColor = createMemo(() => {
    switch (props.node.bead.status) {
      case "closed":
        return theme.textMuted
      case "in_progress":
        return theme.success
      case "blocked":
        return theme.warning
      default:
        return theme.textMuted
    }
  })

  // Get elapsed time for in-progress beads
  const elapsedTime = createMemo(() => {
    if (props.node.bead.status !== "in_progress") return undefined
    const elapsed = Bead.getElapsedTime(props.node.bead.id)
    if (!elapsed) return undefined
    return formatDuration(elapsed)
  })

  // Dependency indicator
  const depIndicator = createMemo(() => {
    const deps = props.node.bead.dependency_count ?? 0
    const dependents = props.node.bead.dependent_count ?? 0
    if (deps === 0 && dependents === 0) return ""
    if (props.node.bead.status === "blocked" && deps > 0) {
      return ` [blocked by ${deps}]`
    }
    return ""
  })

  return (
    <box>
      <text style={{ fg: statusColor() }}>
        {indent()}
        {statusIcon(props.node.bead.status)}
        {props.node.bead.title}
        {elapsedTime() && <span style={{ fg: theme.textMuted }}> ({elapsedTime()})</span>}
        {depIndicator() && <span style={{ fg: theme.warning }}>{depIndicator()}</span>}
      </text>
      <For each={props.node.children}>
        {(child) => <BeadNodeView node={child} depth={props.depth + 1} />}
      </For>
    </box>
  )
}

/**
 * Build a tree structure from a flat list of beads.
 * Beads with IDs like "1.1.2" are children of "1.1".
 */
export function buildBeadTree(beads: BeadInfo[]): BeadNode[] {
  const idSet = new Set(beads.map((b) => b.id))
  const childMap = new Map<string, BeadInfo[]>()

  // Group children under their direct parents
  for (const bead of beads) {
    const dotIndex = bead.id.lastIndexOf(".")
    const parentId = dotIndex > 0 ? bead.id.slice(0, dotIndex) : null
    if (parentId && idSet.has(parentId)) {
      const children = childMap.get(parentId) ?? []
      children.push(bead)
      childMap.set(parentId, children)
    }
  }

  // Recursively build node tree
  function buildNode(bead: BeadInfo): BeadNode {
    const directChildren = childMap.get(bead.id) ?? []
    return { bead, children: directChildren.map(buildNode) }
  }

  // Build roots: non-closed items that aren't children of another bead
  const roots: BeadNode[] = []
  for (const bead of beads) {
    const dotIndex = bead.id.lastIndexOf(".")
    const parentId = dotIndex > 0 ? bead.id.slice(0, dotIndex) : null
    const isChild = parentId && idSet.has(parentId)
    if (isChild) continue
    if (bead.status === "closed") continue
    roots.push(buildNode(bead))
  }
  return roots
}

/**
 * Count total nodes in the tree.
 */
export function countNodes(nodes: BeadNode[]): number {
  return nodes.reduce((n, node) => n + 1 + countNodes(node.children), 0)
}
