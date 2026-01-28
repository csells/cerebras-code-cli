/**
 * Shared analytics utilities for the sidebar.
 * Extracted to reduce duplication and improve testability.
 */

/**
 * Convert percentage (0-100) to block character (8 levels).
 * Used for sparkline visualization.
 */
export function percentToBar(percent: number): string {
  const blocks = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]
  const index = Math.round((percent / 100) * 8)
  return blocks[Math.min(8, Math.max(0, index))]
}

/**
 * Format token count in human-readable form.
 * e.g., 1500000 -> "1.5M", 1500 -> "1.5K"
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
  return tokens.toLocaleString()
}

/**
 * Format duration in human-readable form.
 * e.g., 90000 -> "1m 30s", 3600000 -> "1h 0m"
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

/**
 * Get color key based on percentage remaining.
 * Higher = better (more remaining is good).
 */
export function getRemainingColor(percent: number): "success" | "warning" | "error" {
  if (percent >= 50) return "success"
  if (percent >= 20) return "warning"
  return "error"
}

/**
 * Get color key based on rate percentage.
 * Used for cache hit rate where higher is better.
 */
export function getRateColor(rate: number): "success" | "warning" | "error" {
  if (rate >= 70) return "success"
  if (rate >= 40) return "warning"
  return "error"
}
