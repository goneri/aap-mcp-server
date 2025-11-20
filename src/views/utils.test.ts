import { describe, it, expect } from "vitest";
import { getLogIcon } from "./utils.js";

describe("View Utils", () => {
  describe("getLogIcon", () => {
    it("should return info icon for info severity", () => {
      expect(getLogIcon("info")).toBe("ℹ️");
      expect(getLogIcon("INFO")).toBe("ℹ️");
      expect(getLogIcon("Info")).toBe("ℹ️");
    });

    it("should return warning icon for warn severity", () => {
      expect(getLogIcon("warn")).toBe("⚠️");
      expect(getLogIcon("WARN")).toBe("⚠️");
      expect(getLogIcon("Warn")).toBe("⚠️");
    });

    it("should return error icon for err severity", () => {
      expect(getLogIcon("err")).toBe("❌");
      expect(getLogIcon("ERR")).toBe("❌");
      expect(getLogIcon("Err")).toBe("❌");
    });

    it("should return default icon for unknown severity", () => {
      expect(getLogIcon("unknown")).toBe("📝");
      expect(getLogIcon("debug")).toBe("📝");
      expect(getLogIcon("")).toBe("📝");
      expect(getLogIcon("   ")).toBe("📝");
    });

    it("should handle special characters and numbers", () => {
      expect(getLogIcon("123")).toBe("📝");
      expect(getLogIcon("!@#")).toBe("📝");
      expect(getLogIcon("err123")).toBe("📝");
    });

    it("should not trim whitespace in severity", () => {
      expect(getLogIcon(" info ")).toBe("📝");
      expect(getLogIcon(" warn ")).toBe("📝");
      expect(getLogIcon(" err ")).toBe("📝");
    });
  });
});
