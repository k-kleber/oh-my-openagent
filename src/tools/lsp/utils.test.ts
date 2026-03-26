import { describe, expect, it } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import os from "os"

import { findWorkspaceRoot } from "./lsp-client-wrapper"

describe("lsp utils", () => {
  describe("findWorkspaceRoot", () => {
    it("returns an existing directory even when the file path points to a non-existent nested path", () => {
      const tmp = mkdtempSync(join(os.tmpdir(), "omo-lsp-root-"))
      try {
        // Add a marker so the function can discover the workspace root.
        writeFileSync(join(tmp, "package.json"), "{}")

        const nonExistentFile = join(tmp, "does-not-exist", "deep", "file.ts")
        const root = findWorkspaceRoot(nonExistentFile)

        expect(root).toBe(tmp)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })

    it("prefers the nearest marker directory when markers exist above the file", () => {
      const tmp = mkdtempSync(join(os.tmpdir(), "omo-lsp-marker-"))
      try {
        const repo = join(tmp, "repo")
        const src = join(repo, "src")
        mkdirSync(src, { recursive: true })

        writeFileSync(join(repo, "package.json"), "{}")
        const file = join(src, "index.ts")
        writeFileSync(file, "export {}")

        expect(findWorkspaceRoot(file)).toBe(repo)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })

    it("prefers workspace-level compile_commands.json over package-level CMakeLists.txt", () => {
      const tmp = mkdtempSync(join(os.tmpdir(), "omo-lsp-compile-db-"))
      try {
        const workspace = join(tmp, "workspace")
        const packageDir = join(workspace, "src", "pkg")
        const sourceDir = join(packageDir, "src")
        mkdirSync(sourceDir, { recursive: true })

        writeFileSync(join(workspace, "compile_commands.json"), "[]")
        writeFileSync(join(packageDir, "CMakeLists.txt"), "cmake_minimum_required(VERSION 3.10)")

        const file = join(sourceDir, "main.cpp")
        writeFileSync(file, "int main() { return 0; }")

        expect(findWorkspaceRoot(file)).toBe(workspace)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })

    it("uses .catkin_tools as a high-priority workspace marker", () => {
      const tmp = mkdtempSync(join(os.tmpdir(), "omo-lsp-catkin-"))
      try {
        const workspace = join(tmp, "ws")
        const packageDir = join(workspace, "src", "pkg")
        const sourceDir = join(packageDir, "src")
        mkdirSync(sourceDir, { recursive: true })

        mkdirSync(join(workspace, ".catkin_tools"), { recursive: true })
        writeFileSync(join(packageDir, "CMakeLists.txt"), "cmake_minimum_required(VERSION 3.10)")

        const file = join(sourceDir, "node.cpp")
        writeFileSync(file, "int node() { return 0; }")

        expect(findWorkspaceRoot(file)).toBe(workspace)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })

    it("falls back to nearest CMakeLists.txt when no higher-priority markers exist", () => {
      const tmp = mkdtempSync(join(os.tmpdir(), "omo-lsp-cmake-fallback-"))
      try {
        const packageDir = join(tmp, "mono", "pkg")
        const sourceDir = join(packageDir, "src")
        mkdirSync(sourceDir, { recursive: true })

        writeFileSync(join(packageDir, "CMakeLists.txt"), "cmake_minimum_required(VERSION 3.10)")

        const file = join(sourceDir, "algo.cpp")
        writeFileSync(file, "int algo() { return 0; }")

        expect(findWorkspaceRoot(file)).toBe(packageDir)
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })

    it("does not treat package.xml as a workspace marker", () => {
      const tmp = mkdtempSync(join(os.tmpdir(), "omo-lsp-package-xml-"))
      try {
        const packageDir = join(tmp, "ws", "src", "pkg")
        const sourceDir = join(packageDir, "src")
        mkdirSync(sourceDir, { recursive: true })

        writeFileSync(join(packageDir, "package.xml"), "<package format=\"2\"></package>")

        const file = join(sourceDir, "file.cpp")
        writeFileSync(file, "int file() { return 0; }")

        expect(findWorkspaceRoot(file)).toBe(dirname(file))
      } finally {
        rmSync(tmp, { recursive: true, force: true })
      }
    })
  })
})
