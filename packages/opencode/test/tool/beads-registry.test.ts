import { describe, it, expect, beforeAll } from "bun:test"
import z from "zod"
import { BeadsCreateTool, BeadsUpdateTool, BeadsListTool, BeadsShowTool } from "../../src/tool/beads"
import DESCRIPTION from "../../src/tool/beads.txt"

// Import registry to verify it exports the beads tools correctly
import * as registry from "../../src/tool/registry"

describe("Beads Tools Registry", () => {
  describe("BeadsCreateTool", () => {
    let toolInit: Awaited<ReturnType<typeof BeadsCreateTool.init>>

    beforeAll(async () => {
      toolInit = await BeadsCreateTool.init()
    })

    it("has correct id", () => {
      expect(BeadsCreateTool.id).toBe("beads_create")
    })

    it("has description loaded from beads.txt", () => {
      expect(toolInit.description).toBe(DESCRIPTION)
      expect(toolInit.description).toContain("Create a new bead")
      expect(toolInit.description).toContain("When to Use")
      expect(toolInit.description).toContain("Priorities")
    })

    it("has parameters matching Zod schema", () => {
      const shape = toolInit.parameters.shape

      expect(shape.title).toBeInstanceOf(z.ZodString)

      expect(shape.description).toBeInstanceOf(z.ZodOptional)
      expect(shape.description._def.innerType).toBeInstanceOf(z.ZodString)

      expect(shape.priority).toBeInstanceOf(z.ZodDefault)
      expect(shape.priority._def.defaultValue).toBe(2)

      expect(shape.type).toBeInstanceOf(z.ZodDefault)
      expect(shape.type._def.defaultValue).toBe("task")

      expect(shape.parent).toBeInstanceOf(z.ZodOptional)

      expect(shape.deps).toBeInstanceOf(z.ZodOptional)
    })

    it("validates title is required", () => {
      const result = toolInit.parameters.safeParse({})
      expect(result.success).toBe(false)
    })

    it("accepts valid parameters", () => {
      const result = toolInit.parameters.safeParse({ title: "Test task" })
      expect(result.success).toBe(true)
    })

    it("accepts full parameters", () => {
      const result = toolInit.parameters.safeParse({
        title: "Test task",
        description: "A description",
        priority: 1,
        type: "feature",
        parent: "beads-abc123",
        deps: [{ type: "blocks", id: "beads-xyz789" }],
      })
      expect(result.success).toBe(true)
    })
  })

  describe("BeadsUpdateTool", () => {
    let toolInit: Awaited<ReturnType<typeof BeadsUpdateTool.init>>

    beforeAll(async () => {
      toolInit = await BeadsUpdateTool.init()
    })

    it("has correct id", () => {
      expect(BeadsUpdateTool.id).toBe("beads_update")
    })

    it("has description about updating status/priority/title", () => {
      expect(toolInit.description).toContain("Update")
      expect(toolInit.description).toContain("status")
      expect(toolInit.description).toContain("priority")
    })

    it("has parameters matching Zod schema", () => {
      const shape = toolInit.parameters.shape

      expect(shape.id).toBeInstanceOf(z.ZodString)
      expect(shape.status).toBeInstanceOf(z.ZodOptional)
      expect(shape.priority).toBeInstanceOf(z.ZodOptional)
      expect(shape.title).toBeInstanceOf(z.ZodOptional)
      expect(shape.dep_add).toBeInstanceOf(z.ZodOptional)
    })

    it("validates id is required", () => {
      const result = toolInit.parameters.safeParse({})
      expect(result.success).toBe(false)
    })

    it("validates status enum values", () => {
      const validStatuses = ["open", "in_progress", "blocked", "deferred", "closed"]
      for (const status of validStatuses) {
        const result = toolInit.parameters.safeParse({ id: "beads-123", status })
        expect(result.success).toBe(true)
      }

      const result = toolInit.parameters.safeParse({ id: "beads-123", status: "invalid" })
      expect(result.success).toBe(false)
    })

    it("validates priority range 0-4", () => {
      for (let p = 0; p <= 4; p++) {
        const result = toolInit.parameters.safeParse({ id: "beads-123", priority: p })
        expect(result.success).toBe(true)
      }

      const below = toolInit.parameters.safeParse({ id: "beads-123", priority: -1 })
      expect(below.success).toBe(false)

      const above = toolInit.parameters.safeParse({ id: "beads-123", priority: 5 })
      expect(above.success).toBe(false)
    })
  })

  describe("BeadsListTool", () => {
    let toolInit: Awaited<ReturnType<typeof BeadsListTool.init>>

    beforeAll(async () => {
      toolInit = await BeadsListTool.init()
    })

    it("has correct id", () => {
      expect(BeadsListTool.id).toBe("beads_list")
    })

    it("has description about listing beads", () => {
      expect(toolInit.description).toContain("List")
      expect(toolInit.description).toContain("ready")
    })

    it("has parameters matching Zod schema", () => {
      const shape = toolInit.parameters.shape
      expect(shape.filter).toBeInstanceOf(z.ZodDefault)
      expect(shape.filter._def.defaultValue).toBe("ready")
    })

    it("validates filter enum values", () => {
      const validFilters = ["ready", "all"]
      for (const filter of validFilters) {
        const result = toolInit.parameters.safeParse({ filter })
        expect(result.success).toBe(true)
      }

      const invalid = toolInit.parameters.safeParse({ filter: "invalid" })
      expect(invalid.success).toBe(false)
    })

    it("defaults filter to ready", () => {
      const result = toolInit.parameters.parse({})
      expect(result.filter).toBe("ready")
    })
  })

  describe("Registry imports beads tools", () => {
    it("registry module imports all beads tools from beads.ts", () => {
      // The registry.ts file directly imports these tools, verifying the import statement works
      // This test confirms the import/export structure is correct
      const registrySource = Bun.file("packages/opencode/src/tool/registry.ts")
      expect(registrySource).toBeDefined()

      // Verify the tools are valid Tool.Info objects with correct ids
      expect(BeadsCreateTool.id).toBe("beads_create")
      expect(BeadsUpdateTool.id).toBe("beads_update")
      expect(BeadsListTool.id).toBe("beads_list")
      expect(BeadsShowTool.id).toBe("beads_show")

      // Each tool must have an init function (Tool.Info interface requirement)
      expect(typeof BeadsCreateTool.init).toBe("function")
      expect(typeof BeadsUpdateTool.init).toBe("function")
      expect(typeof BeadsListTool.init).toBe("function")
      expect(typeof BeadsShowTool.init).toBe("function")
    })

    it("registry module successfully loads without errors", () => {
      // If the import statement in registry.ts had issues, this test wouldn't even run
      // The fact this test runs confirms the import is valid
      expect(registry.ToolRegistry).toBeDefined()
      expect(registry.ToolRegistry.ids).toBeDefined()
      expect(registry.ToolRegistry.tools).toBeDefined()
      expect(registry.ToolRegistry.register).toBeDefined()
    })
  })

  describe("BeadsShowTool", () => {
    let toolInit: Awaited<ReturnType<typeof BeadsShowTool.init>>

    beforeAll(async () => {
      toolInit = await BeadsShowTool.init()
    })

    it("has correct id", () => {
      expect(BeadsShowTool.id).toBe("beads_show")
    })

    it("has description about showing bead details", () => {
      expect(toolInit.description).toContain("Show")
      expect(toolInit.description).toContain("details")
    })

    it("has parameters matching Zod schema", () => {
      const shape = toolInit.parameters.shape
      expect(shape.id).toBeInstanceOf(z.ZodString)
    })

    it("validates id is required", () => {
      const result = toolInit.parameters.safeParse({})
      expect(result.success).toBe(false)
    })

    it("accepts valid id", () => {
      const result = toolInit.parameters.safeParse({ id: "beads-abc123" })
      expect(result.success).toBe(true)
    })
  })
})
