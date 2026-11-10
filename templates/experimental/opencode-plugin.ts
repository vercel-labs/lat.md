import { type Plugin, tool } from "@opencode-ai/plugin"
import { execFileSync } from "child_process"

/** Executable and prefix arguments, injected by `lat init`. */
const LAT = __LAT_INVOCATION__

function run(args: string[]): string {
  return execFileSync(LAT.command, [...LAT.args, ...args], {
    cwd: process.cwd(),
    encoding: "utf-8",
    timeout: 30_000,
  })
}

function tryRun(args: string[]): string {
  try {
    return run(args)
  } catch {
    return ""
  }
}

export const LatPlugin: Plugin = async () => {
  return {
    tool: {
      lat_search: tool({
        description:
          "Semantic search across lat.md sections using embeddings. Use before starting any task to find relevant design context.",
        args: {
          query: tool.schema.string("Search query in natural language"),
          limit: tool.schema.optional(
            tool.schema.number("Max results (default 5)"),
          ),
        },
        async execute(args) {
          const cliArgs = ["search", args.query]
          if (args.limit) cliArgs.push("--limit", String(args.limit))
          const output = tryRun(cliArgs)
          return output || "No results found."
        },
      }),

      lat_section: tool({
        description:
          "Show full content of a lat.md section with outgoing/incoming refs",
        args: {
          query: tool.schema.string(
            'Section ID or name (e.g. "cli#init", "Tests#User login")',
          ),
        },
        async execute(args) {
          const output = tryRun(["section", args.query])
          return output || "Section not found."
        },
      }),

      lat_locate: tool({
        description:
          "Find a section by name (exact, subsection tail, or fuzzy match)",
        args: {
          query: tool.schema.string("Section name to locate"),
        },
        async execute(args) {
          const output = tryRun(["locate", args.query])
          return output || "No sections matching query."
        },
      }),

      lat_check: tool({
        description:
          "Run full lat.md validation. Returns errors or 'All checks passed'",
        args: {},
        async execute() {
          try {
            return run(["check"])
          } catch (err: unknown) {
            const e = err as { stdout?: string; stderr?: string }
            return e.stdout || e.stderr || "Check failed"
          }
        },
      }),

      lat_expand: tool({
        description:
          "Expand [[refs]] in text to resolved file locations and context",
        args: {
          text: tool.schema.string("Text containing [[refs]] to expand"),
        },
        async execute(args) {
          const output = tryRun(["expand", args.text])
          return output || args.text
        },
      }),

      lat_refs: tool({
        description:
          "Find what references a given section via wiki links or @lat code comments",
        args: {
          query: tool.schema.string(
            'Section ID (e.g. "cli#init", "file#Section")',
          ),
        },
        async execute(args) {
          const output = tryRun(["refs", args.query])
          return output || "No references found."
        },
      }),
    },

  }
}
