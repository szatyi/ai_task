import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("T-001 platform foundation", () => {
  it("has strict TypeScript enabled", () => {
    const tsconfigPath = path.resolve(process.cwd(), "tsconfig.json");
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));

    expect(tsconfig.compilerOptions?.strict).toBe(true);
  });

  it("reflects layer boundaries in src folder structure", () => {
    const requiredLayerDirs = [
      "src/presentation",
      "src/application",
      "src/domain",
      "src/infrastructure",
    ];

    for (const layerDir of requiredLayerDirs) {
      const fullPath = path.resolve(process.cwd(), layerDir);
      expect(existsSync(fullPath), `${layerDir} should exist`).toBe(true);
    }
  });

  it("configures ESLint and Prettier", () => {
    const eslintConfigPath = path.resolve(process.cwd(), "eslint.config.mjs");
    const prettierConfigPath = path.resolve(process.cwd(), ".prettierrc.json");

    expect(existsSync(eslintConfigPath)).toBe(true);
    expect(existsSync(prettierConfigPath)).toBe(true);
  });
});
