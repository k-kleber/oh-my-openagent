import type { PluginContext } from "../../plugin/types"
import { lspManager } from "./client"
import { log } from "../../shared/logger"

type ClientWithTui = {
  tui?: {
    showToast: (opts: {
      body: {
        title: string
        message: string
        variant: "info" | "success" | "warning" | "error"
        duration: number
      }
    }) => Promise<unknown>
  }
}

export function initLspSpawnToastNotifier(ctx: PluginContext): void {
  const client = ctx.client as ClientWithTui

  lspManager.setSpawnNotifier(({ serverId, root }) => {
    if (serverId !== "clangd") {
      return
    }

    if (!client.tui?.showToast) {
      return
    }

    client.tui
      .showToast({
        body: {
          title: "New clangd server",
          message: `Spawned with root:\n${root}`,
          variant: "info",
          duration: 4500,
        },
      })
      .catch((error) => {
        log("[LSP] Failed to show clangd spawn toast", {
          error,
          root,
        })
      })
  })
}
