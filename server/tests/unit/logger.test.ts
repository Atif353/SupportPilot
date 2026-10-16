import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { loggerOptions } from "../../src/config/logger.js";

describe("error logging", () => {
  it("includes the error message and stack instead of an empty object", () => {
    let output = "";
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = pino({ ...loggerOptions, level: "error" }, destination);
    logger.error({ error: new Error("MongoDB is running standalone") }, "Server startup failed");
    const entry = JSON.parse(output);
    expect(entry.error.message).toBe("MongoDB is running standalone");
    expect(entry.error.stack).toContain("logger.test.ts");
    expect(entry.error.type).toBe("Error");
  });
});
