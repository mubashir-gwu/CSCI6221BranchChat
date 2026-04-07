import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

describe("logger", () => {
  let tmpDir: string;
  let logFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "logger-test-"));
    logFile = path.join(tmpDir, "logs", "app.log");

    // Override process.cwd to point to our temp dir so the logger writes there
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);

    // Reset module cache so logger re-evaluates paths
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    // Clean up temp dir
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes a JSON line to the log file", async () => {
    const { logger } = await import("@/lib/logger");
    logger.info("test message");

    expect(fs.existsSync(logFile)).toBe(true);
    const content = fs.readFileSync(logFile, "utf-8").trim();
    const entry = JSON.parse(content);

    expect(entry.level).toBe("INFO");
    expect(entry.message).toBe("test message");
    expect(entry.timestamp).toBeDefined();
  });

  it("includes context in log entries", async () => {
    const { logger } = await import("@/lib/logger");
    logger.info("with context", { context: { userId: "abc", requestId: "xyz" } });

    const content = fs.readFileSync(logFile, "utf-8").trim();
    const entry = JSON.parse(content);

    expect(entry.context).toEqual({ userId: "abc", requestId: "xyz" });
  });

  it("includes extra fields in log entries", async () => {
    const { logger } = await import("@/lib/logger");
    logger.info("with extra", { status: 200, durationMs: 42 });

    const content = fs.readFileSync(logFile, "utf-8").trim();
    const entry = JSON.parse(content);

    expect(entry.status).toBe(200);
    expect(entry.durationMs).toBe(42);
  });

  it("respects log level filtering", async () => {
    vi.stubEnv("LOG_LEVEL", "ERROR");
    const { logger } = await import("@/lib/logger");

    logger.info("should be suppressed");
    logger.warn("should be suppressed too");
    logger.error("should appear");

    const content = fs.readFileSync(logFile, "utf-8").trim();
    const lines = content.split("\n").filter(Boolean);

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry.level).toBe("ERROR");
    expect(entry.message).toBe("should appear");
  });

  it("creates the logs directory if it does not exist", async () => {
    const logsDir = path.join(tmpDir, "logs");
    expect(fs.existsSync(logsDir)).toBe(false);

    const { logger } = await import("@/lib/logger");
    logger.info("create dir");

    expect(fs.existsSync(logsDir)).toBe(true);
    expect(fs.existsSync(logFile)).toBe(true);
  });

  it("contains timestamp, level, and message fields", async () => {
    const { logger } = await import("@/lib/logger");
    logger.warn("check fields");

    const content = fs.readFileSync(logFile, "utf-8").trim();
    const entry = JSON.parse(content);

    expect(entry).toHaveProperty("timestamp");
    expect(entry).toHaveProperty("level");
    expect(entry).toHaveProperty("message");
    expect(typeof entry.timestamp).toBe("string");
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });

  it("supports all log levels", async () => {
    vi.stubEnv("LOG_LEVEL", "TRACE");
    const { logger } = await import("@/lib/logger");

    logger.trace("t");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    const lines = fs.readFileSync(logFile, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(5);

    const levels = lines.map((l) => JSON.parse(l).level);
    expect(levels).toEqual(["TRACE", "DEBUG", "INFO", "WARN", "ERROR"]);
  });
});
