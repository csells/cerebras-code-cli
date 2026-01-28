import SECTION_IDENTITY from "./sections/identity.txt"
import SECTION_TONE from "./sections/tone-and-style.txt"
import SECTION_BEADS from "./sections/beads-workflow.txt"
import SECTION_DOING_TASKS from "./sections/doing-tasks.txt"
import SECTION_TOOL_USAGE from "./sections/tool-usage.txt"
import SECTION_CODE_REFS from "./sections/code-references.txt"

/**
 * Composable prompt system for assembling model-specific prompts from shared sections.
 *
 * This allows us to maintain one copy of common instructions (beads workflow, tone, etc.)
 * while still allowing model-specific customization.
 */
export namespace PromptComposer {
  /**
   * All available prompt sections.
   * These are imported statically to work with Bun's bundler.
   */
  export const sections = {
    identity: SECTION_IDENTITY,
    tone: SECTION_TONE,
    beads: SECTION_BEADS,
    doingTasks: SECTION_DOING_TASKS,
    toolUsage: SECTION_TOOL_USAGE,
    codeRefs: SECTION_CODE_REFS,
  } as const

  export type SectionName = keyof typeof sections

  /**
   * The default section order for composing a full prompt.
   * Models can override this or insert custom sections.
   */
  export const defaultOrder: SectionName[] = [
    "identity",
    "tone",
    "beads",
    "doingTasks",
    "toolUsage",
    "codeRefs",
  ]

  /**
   * Compose a prompt from sections in the specified order.
   *
   * @param order - Array of section names to include, in order
   * @param overrides - Optional map of section names to custom content
   * @returns The composed prompt as a single string
   */
  export function compose(
    order: SectionName[] = defaultOrder,
    overrides: Partial<Record<SectionName, string>> = {},
  ): string {
    return order
      .map((name) => overrides[name] ?? sections[name])
      .filter(Boolean)
      .join("\n\n")
  }

  /**
   * Compose a prompt with a model-specific header prepended.
   *
   * @param modelHeader - Model-specific introduction/behavior instructions
   * @param order - Array of section names to include after the header
   * @param overrides - Optional map of section names to custom content
   * @returns The composed prompt as a single string
   */
  export function composeWithHeader(
    modelHeader: string,
    order: SectionName[] = defaultOrder,
    overrides: Partial<Record<SectionName, string>> = {},
  ): string {
    const body = compose(order, overrides)
    return modelHeader ? `${modelHeader}\n\n${body}` : body
  }

  /**
   * Get the full default prompt (all sections in default order).
   * This is equivalent to the current anthropic.txt/polaris.txt content.
   */
  export function getDefault(): string {
    return compose(defaultOrder)
  }

  /**
   * Get just the sections needed for a minimal prompt.
   * Useful for models with smaller context windows.
   */
  export function getMinimal(): string {
    return compose(["identity", "tone", "beads"])
  }
}
