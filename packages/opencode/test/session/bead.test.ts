import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import path from "path"
import fs from "fs/promises"
import { Bead } from "../../src/session/bead"
import { Log } from "../../src/util/log"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"

Log.init({ print: false })

describe("Bead namespace", () => {
  let testDir: Awaited<ReturnType<typeof tmpdir>>

  beforeEach(async () => {
    testDir = await tmpdir({ git: true })
  })

  afterEach(async () => {
    await testDir[Symbol.asyncDispose]()
  })

  describe("Bead.init()", () => {
    test("creates .beads/ directory when missing", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          const beadsDir = path.join(testDir.path, ".beads")
          const existsBefore = await fs.stat(beadsDir).then(() => true).catch(() => false)
          expect(existsBefore).toBe(false)

          await Bead.init()

          const existsAfter = await fs.stat(beadsDir).then(() => true).catch(() => false)
          expect(existsAfter).toBe(true)

          const files = await fs.readdir(beadsDir)
          expect(files).toContain("beads.db")
        },
      })
    })

    test("does nothing if .beads/ already exists", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          await Bead.init()
          const beadsDir = path.join(testDir.path, ".beads")
          const statBefore = await fs.stat(beadsDir)

          await Bead.init()
          const statAfter = await fs.stat(beadsDir)

          expect(statAfter.ctimeMs).toBe(statBefore.ctimeMs)
        },
      })
    })
  })

  describe("Bead.create()", () => {
    test("creates bead with title only", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          await Bead.init()
          const bead = await Bead.create({ title: "Simple task" })

          expect(bead).toBeDefined()
          expect(bead!.id).toBeDefined()
          expect(bead!.title).toBe("Simple task")
          expect(bead!.status).toBe("open")
        },
      })
    })

    test("creates bead with description", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          await Bead.init()
          const bead = await Bead.create({
            title: "Task with description",
            description: "This is a detailed description",
          })

          expect(bead).toBeDefined()
          expect(bead!.title).toBe("Task with description")
        },
      })
    })

    test("creates bead with priority", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          await Bead.init()
          const bead = await Bead.create({
            title: "High priority task",
            priority: 1,
          })

          expect(bead).toBeDefined()
          expect(bead!.priority).toBe(1)
        },
      })
    })

    test("creates bead with type", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          await Bead.init()
          const bead = await Bead.create({
            title: "Bug fix",
            type: "bug",
          })

          expect(bead).toBeDefined()
          expect(bead!.issue_type).toBe("bug")
        },
      })
    })

    test("creates bead with parent", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          await Bead.init()
          const parent = await Bead.create({ title: "Parent task" })
          expect(parent).toBeDefined()

          const child = await Bead.create({
            title: "Child task",
            parent: parent!.id,
          })

          expect(child).toBeDefined()
          expect(child!.title).toBe("Child task")
        },
      })
    })

    test("creates bead with dependencies", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          await Bead.init()
          const dep1 = await Bead.create({ title: "Dependency 1" })
          expect(dep1).toBeDefined()

          const bead = await Bead.create({
            title: "Task with deps",
            deps: [{ type: "blocks", id: dep1!.id }],
          })

          expect(bead).toBeDefined()
          // bd create doesn't return dependency_count, need to fetch via list
          const beads = await Bead.list()
          const beadFromList = beads.find((b) => b.id === bead!.id)
          expect(beadFromList).toBeDefined()
          expect(beadFromList!.dependency_count).toBeGreaterThanOrEqual(1)
        },
      })
    })
  })

  describe("Bead.list()", () => {
    test("returns empty array when no beads exist", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          await Bead.init()
          const beads = await Bead.list()

          expect(beads).toEqual([])
        },
      })
    })

    test("returns beads with default filter (open only)", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          await Bead.init()
          await Bead.create({ title: "Task 1" })
          await Bead.create({ title: "Task 2" })

          const beads = await Bead.list()

          expect(beads.length).toBe(2)
          expect(beads.map((b) => b.title)).toContain("Task 1")
          expect(beads.map((b) => b.title)).toContain("Task 2")
        },
      })
    })

    test("returns ready beads with ready filter", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          await Bead.init()
          const bead1 = await Bead.create({ title: "Ready task" })
          const bead2 = await Bead.create({ title: "Blocked task" })
          expect(bead1).toBeDefined()
          expect(bead2).toBeDefined()

          await Bead.depAdd(bead2!.id, bead1!.id, "blocks")

          const readyBeads = await Bead.list("ready")

          expect(readyBeads.length).toBe(1)
          expect(readyBeads[0].title).toBe("Ready task")
        },
      })
    })

    test("returns all beads including closed with all filter", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          await Bead.init()
          const bead1 = await Bead.create({ title: "Open task" })
          const bead2 = await Bead.create({ title: "Closed task" })
          expect(bead1).toBeDefined()
          expect(bead2).toBeDefined()

          await Bead.update(bead2!.id, { status: "closed" })

          const allBeads = await Bead.list("all")
          const openBeads = await Bead.list()

          expect(allBeads.length).toBe(2)
          expect(openBeads.length).toBe(1)
          expect(openBeads[0].title).toBe("Open task")
        },
      })
    })
  })

  describe("Bead.get()", () => {
    test("returns bead info for valid ID", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          await Bead.init()
          const created = await Bead.create({ title: "Fetch me" })
          expect(created).toBeDefined()

          const fetched = await Bead.get(created!.id)

          expect(fetched).toBeDefined()
          expect(fetched!.id).toBe(created!.id)
          expect(fetched!.title).toBe("Fetch me")
        },
      })
    })

    test("returns undefined for invalid ID", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          await Bead.init()

          const fetched = await Bead.get("nonexistent-id-12345")

          expect(fetched).toBeUndefined()
        },
      })
    })
  })

  describe("Bead.update()", () => {
    test("updates bead status", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          await Bead.init()
          const bead = await Bead.create({ title: "Status test" })
          expect(bead).toBeDefined()

          await Bead.update(bead!.id, { status: "in_progress" })

          const updated = await Bead.get(bead!.id)
          expect(updated).toBeDefined()
          expect(updated!.status).toBe("in_progress")
        },
      })
    })

    test("updates bead priority", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          await Bead.init()
          const bead = await Bead.create({ title: "Priority test", priority: 3 })
          expect(bead).toBeDefined()

          await Bead.update(bead!.id, { priority: 1 })

          const updated = await Bead.get(bead!.id)
          expect(updated).toBeDefined()
          expect(updated!.priority).toBe(1)
        },
      })
    })

    test("updates bead title", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          await Bead.init()
          const bead = await Bead.create({ title: "Original title" })
          expect(bead).toBeDefined()

          await Bead.update(bead!.id, { title: "Updated title" })

          const updated = await Bead.get(bead!.id)
          expect(updated).toBeDefined()
          expect(updated!.title).toBe("Updated title")
        },
      })
    })

    test("closes bead with special closed status", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          await Bead.init()
          const bead = await Bead.create({ title: "Close me" })
          expect(bead).toBeDefined()

          await Bead.update(bead!.id, { status: "closed" })

          const updated = await Bead.get(bead!.id)
          expect(updated).toBeDefined()
          expect(updated!.status).toBe("closed")
        },
      })
    })
  })

  describe("Bead.depAdd()", () => {
    test("adds dependency between beads", async () => {
      await Instance.provide({
        directory: testDir.path,
        fn: async () => {
          await Bead.init()
          const blocker = await Bead.create({ title: "Blocker" })
          const blocked = await Bead.create({ title: "Blocked" })
          expect(blocker).toBeDefined()
          expect(blocked).toBeDefined()

          await Bead.depAdd(blocked!.id, blocker!.id, "blocks")

          // bd show doesn't return dependency_count, need to fetch via list
          const beads = await Bead.list()
          const updatedBlocked = beads.find((b) => b.id === blocked!.id)
          expect(updatedBlocked).toBeDefined()
          expect(updatedBlocked!.dependency_count).toBeGreaterThanOrEqual(1)
        },
      })
    })
  })
})
