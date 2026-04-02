/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import * as childProcess from "node:child_process"
import { resolveMemoryProjectIdentity } from "./project-identity"

describe("resolveMemoryProjectIdentity", () => {
  let execFileSyncSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    execFileSyncSpy = spyOn(childProcess, "execFileSync").mockImplementation(
      ((_file: string, _args: string[]) => "") as typeof childProcess.execFileSync,
    )
  })

  afterEach(() => {
    execFileSyncSpy.mockRestore()
  })

  test("#given github ssh remote #when resolving identity #then uses canonical github owner repo", () => {
    execFileSyncSpy.mockImplementation(((_file: string, args: string[]) => {
      if (args[0] === "remote" && args[1] === "get-url" && args[2] === "origin") {
        return "git@github.com:acme/my-repo.git\n"
      }
      return ""
    }) as typeof childProcess.execFileSync)

    const identity = resolveMemoryProjectIdentity("/repo/path", "local-name")

    expect(identity).toEqual({
      projectKey: "github:acme/my-repo",
      projectLabel: "acme/my-repo",
    })
  })

  test("#given github https remote #when resolving identity #then uses canonical github owner repo", () => {
    execFileSyncSpy.mockImplementation(((_file: string, args: string[]) => {
      if (args[0] === "remote" && args[1] === "get-url" && args[2] === "origin") {
        return "https://github.com/acme/platform\n"
      }
      return ""
    }) as typeof childProcess.execFileSync)

    const identity = resolveMemoryProjectIdentity("/repo/path", "local-name")

    expect(identity).toEqual({
      projectKey: "github:acme/platform",
      projectLabel: "acme/platform",
    })
  })

  test("#given non-github origin and github upstream #when resolving identity #then falls back to first github remote", () => {
    execFileSyncSpy.mockImplementation(((_file: string, args: string[]) => {
      if (args[0] === "remote" && args.length === 1) {
        return "origin\nupstream\n"
      }
      if (args[0] === "remote" && args[1] === "get-url" && args[2] === "origin") {
        return "git@gitlab.com:acme/internal.git\n"
      }
      if (args[0] === "remote" && args[1] === "get-url" && args[2] === "upstream") {
        return "https://github.com/acme/shared-core.git\n"
      }
      return ""
    }) as typeof childProcess.execFileSync)

    const identity = resolveMemoryProjectIdentity("/repo/path", "local-name")

    expect(identity).toEqual({
      projectKey: "github:acme/shared-core",
      projectLabel: "acme/shared-core",
    })
  })

  test("#given no github remote #when resolving identity #then uses fallback local project name", () => {
    execFileSyncSpy.mockImplementation(((_file: string, args: string[]) => {
      if (args[0] === "remote" && args.length === 1) {
        return "origin\n"
      }
      if (args[0] === "remote" && args[1] === "get-url" && args[2] === "origin") {
        return "ssh://git@gitlab.company.net/dev/tools.git\n"
      }
      return ""
    }) as typeof childProcess.execFileSync)

    const identity = resolveMemoryProjectIdentity("/repo/path", "local-name")

    expect(identity).toEqual({
      projectKey: "local-name",
      projectLabel: "local-name",
    })
  })
})
