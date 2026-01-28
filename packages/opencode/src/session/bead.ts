import z from "zod"
import path from "path"
import fs from "fs/promises"
import { Bus } from "../bus"
import { Instance } from "../project/instance"
import { Log } from "../util/log"

export namespace Bead {
  const log = Log.create({ service: "bead" })

  export const Info = z
    .object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      status: z.string(),
      priority: z.number(),
      issue_type: z.string(),
      owner: z.string().optional(),
      created_at: z.string().optional(),
      created_by: z.string().optional(),
      updated_at: z.string().optional(),
      dependency_count: z.number().optional(),
      dependent_count: z.number().optional(),
      closed_at: z.string().optional(),
      close_reason: z.string().optional(),
      // For time tracking
      started_at: z.string().optional(),
      duration_ms: z.number().optional(),
    })
    .meta({ ref: "Bead" })
  export type Info = z.infer<typeof Info>

  // Extended bead info with computed blocking/blocked relationships
  export interface BeadNode extends Info {
    blocks?: string[] // IDs of beads this blocks (they depend on this)
    blockedBy?: string[] // IDs of beads blocking this (this depends on them)
  }

  export const Event = {
    Updated: Bus.event(
      "bead.updated",
      z.object({
        beads: z.array(Info),
      }),
    ),
  }

  const BD = "bd"
  let bdInstalled: boolean | undefined

  /**
   * Check if bd CLI is installed. If not, attempt to install it.
   */
  export async function ensureInstalled(): Promise<boolean> {
    if (bdInstalled !== undefined) return bdInstalled

    // Check if bd is available
    const which = Bun.spawn(["which", BD], {
      stdout: "pipe",
      stderr: "pipe",
    })
    await which.exited
    if (which.exitCode === 0) {
      bdInstalled = true
      return true
    }

    log.info("bd CLI not found, attempting to install...")

    // Try npm install first
    const npm = Bun.spawn(["npm", "install", "-g", "beads"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    await npm.exited
    if (npm.exitCode === 0) {
      log.info("bd CLI installed via npm")
      bdInstalled = true
      return true
    }

    // Try bun as fallback
    const bun = Bun.spawn(["bun", "add", "-g", "beads"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    await bun.exited
    if (bun.exitCode === 0) {
      log.info("bd CLI installed via bun")
      bdInstalled = true
      return true
    }

    log.warn("Failed to install bd CLI. Beads features will be disabled.")
    bdInstalled = false
    return false
  }

  export async function init() {
    // Ensure bd is installed first
    const installed = await ensureInstalled()
    if (!installed) return
    const beadsDir = path.join(Instance.directory, ".beads")
    const exists = await fs.stat(beadsDir).then(() => true).catch(() => false)
    if (exists) return
    const proc = Bun.spawn([BD, "init", "--quiet"], {
      cwd: Instance.directory,
      stdout: "ignore",
      stderr: "pipe",
    })
    await proc.exited
    if (proc.exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text()
      log.warn("beads init failed", { stderr })
    }
  }

  export async function list(filter?: "ready" | "all"): Promise<Info[]> {
    const args =
      filter === "ready"
        ? [BD, "ready", "--json"]
        : filter === "all"
          ? [BD, "list", "--json", "--all"]
          : [BD, "list", "--json"]
    const proc = Bun.spawn(args, {
      cwd: Instance.directory,
      stdout: "pipe",
      stderr: "pipe",
    })
    const output = await new Response(proc.stdout).text()
    await proc.exited
    if (proc.exitCode !== 0) return []
    const parsed = JSON.parse(output.trim())
    return z.array(Info).parse(parsed)
  }

  export async function get(id: string): Promise<Info | undefined> {
    const proc = Bun.spawn([BD, "show", id, "--json"], {
      cwd: Instance.directory,
      stdout: "pipe",
      stderr: "pipe",
    })
    const output = await new Response(proc.stdout).text()
    await proc.exited
    if (proc.exitCode !== 0) return undefined
    const parsed = JSON.parse(output.trim())
    const arr = Array.isArray(parsed) ? parsed : [parsed]
    return arr.length > 0 ? Info.parse(arr[0]) : undefined
  }

  export async function create(input: {
    title: string
    description?: string
    priority?: number
    type?: string
    parent?: string
    deps?: Array<{ type: string; id: string }>
  }): Promise<Info | undefined> {
    const args = [BD, "create", input.title, "--json"]
    if (input.priority !== undefined) args.push("-p", String(input.priority))
    if (input.type) args.push("-t", input.type)
    if (input.description) args.push("-d", input.description)
    if (input.parent) args.push("--parent", input.parent)
    if (input.deps) {
      for (const dep of input.deps) {
        args.push("--deps", `${dep.type}:${dep.id}`)
      }
    }
    const proc = Bun.spawn(args, {
      cwd: Instance.directory,
      stdout: "pipe",
      stderr: "pipe",
    })
    const output = await new Response(proc.stdout).text()
    await proc.exited
    if (proc.exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text()
      log.error("bead create failed", { stderr })
      return undefined
    }
    const lines = output.trim().split("\n")
    const jsonLine = lines.find((l) => l.startsWith("{"))
    if (!jsonLine) return undefined
    return Info.parse(JSON.parse(jsonLine))
  }

  // Local time tracking state (keyed by bead ID)
  const startTimes: Record<string, number> = {}

  export async function update(
    id: string,
    input: {
      status?: string
      priority?: number
      title?: string
    },
  ): Promise<string> {
    // Track time when status changes to in_progress
    if (input.status === "in_progress" && !startTimes[id]) {
      startTimes[id] = Date.now()
      log.info("bead started", { id, startedAt: new Date(startTimes[id]).toISOString() })
    }

    // Calculate duration when closing
    if (input.status === "closed") {
      const startTime = startTimes[id]
      if (startTime) {
        const duration = Date.now() - startTime
        log.info("bead completed", { id, durationMs: duration })
        delete startTimes[id]
      }

      const proc = Bun.spawn([BD, "close", id, "--json"], {
        cwd: Instance.directory,
        stdout: "pipe",
        stderr: "pipe",
      })
      const output = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      await proc.exited
      return output.trim() || stderr.trim()
    }

    const args = [BD, "update", id, "--json"]
    if (input.status) args.push("--status", input.status)
    if (input.priority !== undefined) args.push("--priority", String(input.priority))
    if (input.title) args.push("--title", input.title)
    const proc = Bun.spawn(args, {
      cwd: Instance.directory,
      stdout: "pipe",
      stderr: "pipe",
    })
    const output = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    await proc.exited
    return output.trim() || stderr.trim()
  }

  /**
   * Get the elapsed time in ms for an in-progress bead, or the total duration for a closed bead.
   */
  export function getElapsedTime(id: string): number | undefined {
    const startTime = startTimes[id]
    if (startTime) {
      return Date.now() - startTime
    }
    return undefined
  }


  export async function depAdd(id: string, dependsOn: string, type: string): Promise<string> {
    const proc = Bun.spawn([BD, "dep", "add", id, dependsOn, "--type", type, "--json"], {
      cwd: Instance.directory,
      stdout: "pipe",
      stderr: "pipe",
    })
    const output = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    await proc.exited
    return output.trim() || stderr.trim()
  }

  export async function publishUpdate() {
    const beads = await list("all")
    Bus.publish(Event.Updated, { beads })
  }
}
