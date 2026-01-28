import z from "zod"
import { Tool } from "./tool"
import { Bead } from "../session/bead"
import DESCRIPTION from "./beads.txt"

export const BeadsCreateTool = Tool.define("beads_create", {
  description: DESCRIPTION,
  parameters: z.object({
    title: z.string().describe("Title of the bead/task"),
    description: z.string().optional().describe("Description explaining why this task exists and what needs to be done"),
    priority: z
      .number()
      .int()
      .min(0)
      .max(4)
      .default(2)
      .describe("Priority: 0=Critical, 1=High, 2=Medium, 3=Low, 4=Backlog"),
    type: z
      .enum(["task", "epic", "bug", "feature", "chore"])
      .default("task")
      .describe("Issue type. Use 'epic' for parent items that contain sub-tasks"),
    parent: z.string().optional().describe("Parent bead ID to create this as a child of (e.g. for epic sub-tasks)"),
    deps: z
      .array(
        z.object({
          type: z.enum(["blocks", "related"]).describe("Dependency type"),
          id: z.string().describe("ID of the bead this depends on"),
        }),
      )
      .optional()
      .describe("Dependencies to add on creation"),
  }),
  async execute(params) {
    const bead = await Bead.create(params)
    if (!bead) return { title: "Failed to create bead", output: "Error creating bead", metadata: { bead: undefined } }
    await Bead.publishUpdate()
    return {
      title: `Created ${bead.id}`,
      output: JSON.stringify(bead, null, 2),
      metadata: { bead: bead as Bead.Info | undefined },
    }
  },
})

export const BeadsUpdateTool = Tool.define("beads_update", {
  description:
    "Update a bead's status, priority, or title. Use status 'in_progress' when starting work, 'closed' when done, 'blocked' when waiting on dependencies.",
  parameters: z.object({
    id: z.string().describe("Bead ID to update"),
    status: z
      .enum(["open", "in_progress", "blocked", "deferred", "closed"])
      .optional()
      .describe("New status. Use 'closed' to mark as done"),
    priority: z.number().int().min(0).max(4).optional().describe("New priority (0-4)"),
    title: z.string().optional().describe("New title"),
    dep_add: z
      .array(
        z.object({
          type: z.enum(["blocks", "related"]),
          id: z.string(),
        }),
      )
      .optional()
      .describe("Dependencies to add"),
  }),
  async execute(params) {
    const results: string[] = []

    if (params.status || params.priority !== undefined || params.title) {
      const result = await Bead.update(params.id, {
        status: params.status,
        priority: params.priority,
        title: params.title,
      })
      results.push(result)
    }

    if (params.dep_add) {
      for (const dep of params.dep_add) {
        const result = await Bead.depAdd(params.id, dep.id, dep.type)
        results.push(result)
      }
    }

    await Bead.publishUpdate()
    const output = results.join("\n")
    return {
      title: `Updated ${params.id}`,
      output,
      metadata: {},
    }
  },
})

export const BeadsListTool = Tool.define("beads_list", {
  description:
    "List active beads. Use filter 'ready' to see only unblocked work items (highest priority first). Default shows all non-closed beads.",
  parameters: z.object({
    filter: z
      .enum(["ready", "all"])
      .default("ready")
      .describe("'ready' shows unblocked items only, 'all' shows all non-closed beads"),
  }),
  async execute(params) {
    const beads = await Bead.list(params.filter)
    await Bead.publishUpdate()
    return {
      title: `${beads.length} beads`,
      output: JSON.stringify(beads, null, 2),
      metadata: { beads },
    }
  },
})

export const BeadsShowTool = Tool.define("beads_show", {
  description: "Show full details for a specific bead including its dependency information and audit trail.",
  parameters: z.object({
    id: z.string().describe("Bead ID to show"),
  }),
  async execute(params) {
    const bead = await Bead.get(params.id)
    if (!bead) return { title: "Not found", output: `Bead ${params.id} not found`, metadata: { bead: undefined } }
    return {
      title: bead.title,
      output: JSON.stringify(bead, null, 2),
      metadata: { bead: bead as Bead.Info | undefined },
    }
  },
})
