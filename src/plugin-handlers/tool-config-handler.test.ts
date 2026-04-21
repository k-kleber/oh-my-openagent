import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { applyToolConfig } from "./tool-config-handler"
import type { OhMyOpenCodeConfig } from "../config"

function createParams(overrides: {
  taskSystem?: boolean
  agents?: string[]
  disabledTools?: string[]
}) {
  const agentResult: Record<string, { permission?: Record<string, unknown> }> = {}
  for (const agent of overrides.agents ?? []) {
    agentResult[agent] = { permission: {} }
  }

  return {
    config: { tools: {}, permission: {} } as Record<string, unknown>,
    pluginConfig: {
      experimental: { task_system: overrides.taskSystem ?? false },
      disabled_tools: overrides.disabledTools,
    } as OhMyOpenCodeConfig,
    agentResult: agentResult as Record<string, unknown>,
  }
}

describe("applyToolConfig", () => {
  describe("#given config permission sets webfetch and external_directory", () => {
    describe("#when applying tool config", () => {
      it("#then should preserve explicit deny over OmO defaults", () => {
        const params = createParams({})
        params.config.permission = {
          webfetch: "deny",
          external_directory: "deny",
        }

        applyToolConfig(params)

        const permission = params.config.permission as Record<string, unknown>
        expect(permission.webfetch).toBe("deny")
        expect(permission.external_directory).toBe("deny")
        expect(permission.task).toBe("deny")
      })

      it("#then should allow webfetch and external_directory by default", () => {
        const params = createParams({})

        applyToolConfig(params)

        const permission = params.config.permission as Record<string, unknown>
        expect(permission.webfetch).toBe("allow")
        expect(permission.external_directory).toBe("allow")
        expect(permission.task).toBe("deny")
      })
    })
  })

  describe("#given task_system is enabled", () => {
    describe("#when applying tool config", () => {
      it("#then should deny todowrite and todoread globally", () => {
        const params = createParams({ taskSystem: true })

        applyToolConfig(params)

        const tools = params.config.tools as Record<string, unknown>
        expect(tools.todowrite).toBe(false)
        expect(tools.todoread).toBe(false)
      })

      it.each([
        "atlas",
        "sisyphus",
        "brainstormer",
        "researcher",
        "writer",
        "hephaestus",
        "prometheus",
        "sisyphus-junior",
      ])("#then should deny todo tools for %s agent", (agentName) => {
        const params = createParams({
          taskSystem: true,
          agents: [agentName],
        })

        applyToolConfig(params)

        const agent = params.agentResult[agentName] as {
          permission: Record<string, unknown>
        }
        expect(agent.permission.todowrite).toBe("deny")
        expect(agent.permission.todoread).toBe("deny")
      })
    })
  })

  describe("#given OPENCODE_CONFIG_CONTENT has question set to deny", () => {
    let originalConfigContent: string | undefined
    let originalCliRunMode: string | undefined

    beforeEach(() => {
      originalConfigContent = process.env.OPENCODE_CONFIG_CONTENT
      originalCliRunMode = process.env.OPENCODE_CLI_RUN_MODE
    })

    afterEach(() => {
      if (originalConfigContent === undefined) {
        delete process.env.OPENCODE_CONFIG_CONTENT
      } else {
        process.env.OPENCODE_CONFIG_CONTENT = originalConfigContent
      }
      if (originalCliRunMode === undefined) {
        delete process.env.OPENCODE_CLI_RUN_MODE
      } else {
        process.env.OPENCODE_CLI_RUN_MODE = originalCliRunMode
      }
    })

    describe("#when config explicitly denies question permission", () => {
      it.each(["sisyphus", "brainstormer", "researcher", "writer", "hephaestus", "debugger", "prometheus"])(
        "#then should deny question for %s even without CLI_RUN_MODE",
        (agentName) => {
          process.env.OPENCODE_CONFIG_CONTENT = JSON.stringify({
            permission: { question: "deny" },
          })
          delete process.env.OPENCODE_CLI_RUN_MODE
          const params = createParams({ agents: [agentName] })

          applyToolConfig(params)

          const agent = params.agentResult[agentName] as {
            permission: Record<string, unknown>
          }
          expect(agent.permission.question).toBe("deny")
        },
      )
    })

    describe("#when config does not deny question permission", () => {
      it.each(["sisyphus", "brainstormer", "researcher", "writer", "hephaestus", "debugger", "prometheus"])(
        "#then should allow question for %s in interactive mode",
        (agentName) => {
          process.env.OPENCODE_CONFIG_CONTENT = JSON.stringify({
            permission: { question: "allow" },
          })
          delete process.env.OPENCODE_CLI_RUN_MODE
          const params = createParams({ agents: [agentName] })

          applyToolConfig(params)

          const agent = params.agentResult[agentName] as {
            permission: Record<string, unknown>
          }
          expect(agent.permission.question).toBe("allow")
        },
      )
    })

    describe("#when CLI_RUN_MODE is true and config does not deny", () => {
      it.each(["sisyphus", "brainstormer", "researcher", "writer", "hephaestus", "debugger", "prometheus"])(
        "#then should deny question for %s via CLI_RUN_MODE",
        (agentName) => {
          process.env.OPENCODE_CONFIG_CONTENT = JSON.stringify({
            permission: {},
          })
          process.env.OPENCODE_CLI_RUN_MODE = "true"
          const params = createParams({ agents: [agentName] })

          applyToolConfig(params)

          const agent = params.agentResult[agentName] as {
            permission: Record<string, unknown>
          }
          expect(agent.permission.question).toBe("deny")
        },
      )
    })

    describe("#when config deny overrides CLI_RUN_MODE allow", () => {
      it.each(["sisyphus", "brainstormer", "researcher", "writer", "hephaestus", "debugger", "prometheus"])(
        "#then should deny question for %s when config says deny regardless of CLI_RUN_MODE",
        (agentName) => {
          process.env.OPENCODE_CONFIG_CONTENT = JSON.stringify({
            permission: { question: "deny" },
          })
          process.env.OPENCODE_CLI_RUN_MODE = "false"
          const params = createParams({ agents: [agentName] })

          applyToolConfig(params)

          const agent = params.agentResult[agentName] as {
            permission: Record<string, unknown>
          }
          expect(agent.permission.question).toBe("deny")
        },
      )
    })
  })

  describe("#given task_system is disabled", () => {
    describe("#when applying tool config", () => {
      it.each([
        "atlas",
        "sisyphus",
        "brainstormer",
        "researcher",
        "writer",
        "hephaestus",
        "prometheus",
        "sisyphus-junior",
      ])("#then should NOT deny todo tools for %s agent", (agentName) => {
        const params = createParams({
          taskSystem: false,
          agents: [agentName],
        })

        applyToolConfig(params)

        const agent = params.agentResult[agentName] as {
          permission: Record<string, unknown>
        }
        expect(agent.permission.todowrite).toBeUndefined()
        expect(agent.permission.todoread).toBeUndefined()
      })
    })
  })

  describe("#given disabled_tools includes 'question'", () => {
    let originalConfigContent: string | undefined
    let originalCliRunMode: string | undefined

    beforeEach(() => {
      originalConfigContent = process.env.OPENCODE_CONFIG_CONTENT
      originalCliRunMode = process.env.OPENCODE_CLI_RUN_MODE
      delete process.env.OPENCODE_CONFIG_CONTENT
      delete process.env.OPENCODE_CLI_RUN_MODE
    })

    afterEach(() => {
      if (originalConfigContent === undefined) {
        delete process.env.OPENCODE_CONFIG_CONTENT
      } else {
        process.env.OPENCODE_CONFIG_CONTENT = originalConfigContent
      }
      if (originalCliRunMode === undefined) {
        delete process.env.OPENCODE_CLI_RUN_MODE
      } else {
        process.env.OPENCODE_CLI_RUN_MODE = originalCliRunMode
      }
    })

    describe("#when question is in disabled_tools", () => {
      it.each(["sisyphus", "brainstormer", "researcher", "writer", "hephaestus", "debugger", "prometheus"])(
        "#then should deny question for %s agent",
        (agentName) => {
          const params = createParams({
            agents: [agentName],
            disabledTools: ["question"],
          })

          applyToolConfig(params)

          const agent = params.agentResult[agentName] as {
            permission: Record<string, unknown>
          }
          expect(agent.permission.question).toBe("deny")
        },
      )
    })

    describe("#when question is in disabled_tools alongside other tools", () => {
      it.each(["sisyphus", "brainstormer", "researcher", "writer", "hephaestus", "debugger", "prometheus"])(
        "#then should deny question for %s agent",
        (agentName) => {
          const params = createParams({
            agents: [agentName],
            disabledTools: ["todowrite", "question", "interactive_bash"],
          })

          applyToolConfig(params)

          const agent = params.agentResult[agentName] as {
            permission: Record<string, unknown>
          }
          expect(agent.permission.question).toBe("deny")
        },
      )
    })

    describe("#when disabled_tools does not include question", () => {
      it.each(["sisyphus", "brainstormer", "researcher", "writer", "hephaestus", "debugger", "prometheus"])(
        "#then should allow question for %s agent",
        (agentName) => {
          const params = createParams({
            agents: [agentName],
            disabledTools: ["todowrite", "interactive_bash"],
          })

          applyToolConfig(params)

          const agent = params.agentResult[agentName] as {
            permission: Record<string, unknown>
          }
          expect(agent.permission.question).toBe("allow")
        },
      )
    })
  })

  describe("#given brainstormer agent", () => {
    describe("#when applying tool config", () => {
      it("#then should enforce brainstormer write-limited permissions", () => {
        const params = createParams({ agents: ["brainstormer"] })

        applyToolConfig(params)

        const agent = params.agentResult.brainstormer as {
          permission: Record<string, unknown>
        }

        expect(agent.permission.write).toBe("allow")
        expect(agent.permission.edit).toBe("deny")
        expect(agent.permission.task).toBe("allow")
        expect(agent.permission.bash).toBe("deny")
        expect(agent.permission.interactive_bash).toBe("deny")
        expect(agent.permission.apply_patch).toBe("deny")
        expect(agent.permission.serena_read_memory).toBe("deny")
        expect(agent.permission.serena_list_memories).toBe("deny")
        expect(agent.permission.serena_create_text_file).toBe("deny")
        expect(agent.permission.serena_replace_content).toBe("deny")
        expect(agent.permission.serena_replace_symbol_body).toBe("deny")
        expect(agent.permission.serena_insert_after_symbol).toBe("deny")
        expect(agent.permission.serena_insert_before_symbol).toBe("deny")
        expect(agent.permission.serena_rename_symbol).toBe("deny")
        expect(agent.permission.serena_delete_memory).toBe("deny")
        expect(agent.permission.serena_edit_memory).toBe("deny")
        expect(agent.permission.serena_write_memory).toBe("deny")
        expect(agent.permission.serena_execute_shell_command).toBe("deny")
        expect(agent.permission.call_omo_agent).toBe("deny")
      })
    })
  })

  describe("#given debugger agent", () => {
    describe("#when applying tool config", () => {
      it("#then should enforce read-only debugger permissions", () => {
        const params = createParams({ agents: ["debugger"] })

        applyToolConfig(params)

        const agent = params.agentResult.debugger as {
          permission: Record<string, unknown>
        }

        expect(agent.permission.write).toBe("deny")
        expect(agent.permission.edit).toBe("deny")
        expect(agent.permission.apply_patch).toBe("deny")
        expect(agent.permission.patch).toBe("deny")
        expect(agent.permission.bash).toBe("deny")
        expect(agent.permission.interactive_bash).toBe("deny")
        expect(agent.permission.task).toBe("allow")
        expect(agent.permission.call_omo_agent).toBe("deny")
        expect(agent.permission.serena_read_memory).toBe("deny")
        expect(agent.permission.serena_list_memories).toBe("deny")
        expect(agent.permission.serena_delete_memory).toBe("deny")
        expect(agent.permission.serena_edit_memory).toBe("deny")
        expect(agent.permission.serena_write_memory).toBe("deny")
      })
    })
  })

  describe("#given exploration agents", () => {
    describe("#when applying tool config", () => {
      it.each(["explore", "deep-explorer", "librarian"])(
        "#then should not deny Serena or Graphify discovery tools for %s",
        (agentName) => {
          const params = createParams({ agents: [agentName] })

          applyToolConfig(params)

          const agent = params.agentResult[agentName] as {
            permission: Record<string, unknown>
          }

          expect(agent.permission.serena_activate_project).toBeUndefined()
          expect(agent.permission.serena_get_symbols_overview).toBeUndefined()
          expect(agent.permission.serena_find_symbol).toBeUndefined()
          expect(agent.permission.serena_find_referencing_symbols).toBeUndefined()
          expect(agent.permission.serena_read_file).toBeUndefined()
          expect(agent.permission.serena_search_for_pattern).toBeUndefined()
          expect(agent.permission.query_graph).toBeUndefined()
          expect(agent.permission.god_nodes).toBeUndefined()
          expect(agent.permission.graph_stats).toBeUndefined()
          expect(agent.permission.get_community).toBeUndefined()
          expect(agent.permission.get_node).toBeUndefined()
          expect(agent.permission.get_neighbors).toBeUndefined()
          expect(agent.permission.shortest_path).toBeUndefined()
        },
      )
    })
  })

  describe("#given tester agent", () => {
    describe("#when applying tool config", () => {
      it("#then should enforce tester execution-only permissions", () => {
        const params = createParams({ agents: ["tester"] })

        applyToolConfig(params)

        const agent = params.agentResult.tester as {
          permission: Record<string, unknown>
        }

        expect(agent.permission.write).toBe("deny")
        expect(agent.permission.edit).toBe("deny")
        expect(agent.permission.apply_patch).toBe("deny")
        expect(agent.permission.task).toBe("deny")
        expect(agent.permission.call_omo_agent).toBe("deny")
        expect(agent.permission.question).toBe("deny")
        expect(agent.permission.interactive_bash).toBe("deny")
        expect(agent.permission.serena_read_memory).toBe("deny")
        expect(agent.permission.serena_list_memories).toBe("deny")
        expect(agent.permission.serena_execute_shell_command).toBe("deny")
      })
    })
  })

  describe("#given primary agents with task access", () => {
    describe("#when applying tool config", () => {
      it.each(["sisyphus", "hephaestus", "prometheus", "researcher", "writer"])(
        "#then should deny Serena memory tools for %s agent",
        (agentName) => {
          const params = createParams({ agents: [agentName] })

          applyToolConfig(params)

          const agent = params.agentResult[agentName] as {
            permission: Record<string, unknown>
          }

          expect(agent.permission.serena_read_memory).toBe("deny")
          expect(agent.permission.serena_list_memories).toBe("deny")
          expect(agent.permission.serena_delete_memory).toBe("deny")
          expect(agent.permission.serena_edit_memory).toBe("deny")
          expect(agent.permission.serena_write_memory).toBe("deny")
        },
      )
    })
  })
})
