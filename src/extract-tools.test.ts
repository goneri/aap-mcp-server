import { describe, it, expect } from "vitest";
import {
  extractToolsFromApi,
  AAPOperationObject,
  type AAPMcpToolDefinition,
} from "./extract-tools.js";
import type { OpenAPIV3 } from "openapi-types";

describe("AAPOperationObject", () => {
  it("should initialize with x-ai-description when provided", () => {
    const rawOperation = {
      operationId: "test_operation",
      "x-ai-description": "Test AI description",
      summary: "Test summary",
      description: "Test description",
    };

    const aapOperation = new AAPOperationObject(rawOperation);

    expect(aapOperation["x-ai-description"]).toBe("Test AI description");
    expect(aapOperation.operationId).toBe("test_operation");
    expect(aapOperation.summary).toBe("Test summary");
    expect(aapOperation.description).toBe("Test description");
    expect(aapOperation.deprecated).toBe(false);
  });

  it("should default x-ai-description to empty string when missing", () => {
    const rawOperation = {
      operationId: "test_operation",
      summary: "Test summary",
      description: "Test description",
    };

    const aapOperation = new AAPOperationObject(rawOperation);

    expect(aapOperation["x-ai-description"]).toBe("");
    expect(aapOperation.operationId).toBe("test_operation");
    expect(aapOperation.deprecated).toBe(false);
  });

  it("should default x-ai-description to empty string when null", () => {
    const rawOperation = {
      operationId: "test_operation",
      "x-ai-description": null,
      summary: "Test summary",
    };

    const aapOperation = new AAPOperationObject(rawOperation);

    expect(aapOperation["x-ai-description"]).toBe("");
    expect(aapOperation.operationId).toBe("test_operation");
  });

  it("should default x-ai-description to empty string when undefined", () => {
    const rawOperation = {
      operationId: "test_operation",
      "x-ai-description": undefined,
      summary: "Test summary",
    };

    const aapOperation = new AAPOperationObject(rawOperation);

    expect(aapOperation["x-ai-description"]).toBe("");
    expect(aapOperation.operationId).toBe("test_operation");
  });

  it("should preserve empty string x-ai-description", () => {
    const rawOperation = {
      operationId: "test_operation",
      "x-ai-description": "",
      summary: "Test summary",
    };

    const aapOperation = new AAPOperationObject(rawOperation);

    expect(aapOperation["x-ai-description"]).toBe("");
    expect(aapOperation.operationId).toBe("test_operation");
  });

  it("should always default deprecated to false", () => {
    const rawOperation = {
      operationId: "test_operation",
      "x-ai-description": "Test description",
    };

    const aapOperation = new AAPOperationObject(rawOperation);

    expect(aapOperation.deprecated).toBe(false);
  });

  it("should preserve deprecated value from raw operation", () => {
    const rawOperation = {
      operationId: "test_operation",
      "x-ai-description": "Test description",
      deprecated: true,
    };

    const aapOperation = new AAPOperationObject(rawOperation);

    expect(aapOperation.deprecated).toBe(true);
  });

  it("should preserve deprecated false from raw operation", () => {
    const rawOperation = {
      operationId: "test_operation",
      "x-ai-description": "Test description",
      deprecated: false,
    };

    const aapOperation = new AAPOperationObject(rawOperation);

    expect(aapOperation.deprecated).toBe(false);
  });

  it("should preserve all other OpenAPI operation properties", () => {
    const rawOperation = {
      operationId: "test_operation",
      "x-ai-description": "Test AI description",
      summary: "Test summary",
      description: "Test description",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      requestBody: {
        content: {
          "application/json": {
            schema: { type: "object" },
          },
        },
      },
      security: [{ bearerAuth: [] }],
      responses: {
        "200": {
          description: "Success",
        },
      },
    };

    const aapOperation = new AAPOperationObject(rawOperation);

    expect(aapOperation.operationId).toBe("test_operation");
    expect(aapOperation.summary).toBe("Test summary");
    expect(aapOperation.description).toBe("Test description");
    expect(aapOperation.parameters).toEqual(rawOperation.parameters);
    expect(aapOperation.requestBody).toEqual(rawOperation.requestBody);
    expect(aapOperation.security).toEqual(rawOperation.security);
    expect(aapOperation["x-ai-description"]).toBe("Test AI description");
    expect(aapOperation.deprecated).toBe(false);
  });

  it("should handle empty object input", () => {
    const rawOperation = {};

    const aapOperation = new AAPOperationObject(rawOperation);

    expect(aapOperation["x-ai-description"]).toBe("");
    expect(aapOperation.deprecated).toBe(false);
    expect(aapOperation.operationId).toBeUndefined();
    expect(aapOperation.summary).toBeUndefined();
    expect(aapOperation.description).toBeUndefined();
  });

  it("should handle long x-ai-description values", () => {
    const longDescription = "A".repeat(500);
    const rawOperation = {
      operationId: "test_operation",
      "x-ai-description": longDescription,
    };

    const aapOperation = new AAPOperationObject(rawOperation);

    expect(aapOperation["x-ai-description"]).toBe(longDescription);
    expect(aapOperation["x-ai-description"]).toHaveLength(500);
  });

  it("should implement OpenAPIV3.OperationObject interface", () => {
    const rawOperation = {
      operationId: "test_operation",
      "x-ai-description": "Test description",
      summary: "Test summary",
      responses: {
        "200": {
          description: "Success",
        },
      },
    };

    const aapOperation = new AAPOperationObject(rawOperation);

    // Type check - should be assignable to OpenAPIV3.OperationObject
    const openApiOperation: OpenAPIV3.OperationObject = aapOperation;
    expect(openApiOperation).toBeDefined();
    expect(openApiOperation.operationId).toBe("test_operation");
  });
});

describe("Extract Tools - x-ai-description functionality", () => {
  it("should use x-ai-description when available", () => {
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/test": {
          get: {
            operationId: "test_operation",
            "x-ai-description": "AI-optimized description for this operation",
            description: "Regular description",
            summary: "Operation summary",
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(mockSpec);

    expect(tools).toHaveLength(1);
    expect(tools[0].description).toBe(
      "AI-optimized description for this operation",
    );

    // Should not have error about missing x-ai-description
    expect(tools[0].logs).not.toContainEqual({
      severity: "ERR",
      msg: "no `x-ai-description` field",
    });
  });

  it("should log error when x-ai-description is not available", () => {
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/test": {
          get: {
            operationId: "test_operation",
            description: "Regular description",
            summary: "Operation summary",
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(mockSpec);

    expect(tools).toHaveLength(1);

    // Should log error about missing x-ai-description
    expect(tools[0].logs).toContainEqual({
      severity: "ERR",
      msg: "no `x-ai-description` field",
    });
  });

  it("should log error when only summary is available (no x-ai-description)", () => {
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/test": {
          get: {
            operationId: "test_operation",
            summary: "Operation summary",
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(mockSpec);

    expect(tools).toHaveLength(1);

    // Should log error about missing x-ai-description
    expect(tools[0].logs).toContainEqual({
      severity: "ERR",
      msg: "no `x-ai-description` field",
    });
  });

  it("should use x-ai-description even when description and summary are available", () => {
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/test": {
          get: {
            operationId: "test_operation",
            "x-ai-description": "AI-optimized description",
            description: "Regular description",
            summary: "Operation summary",
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(mockSpec);

    expect(tools).toHaveLength(1);
    expect(tools[0].description).toBe("AI-optimized description");

    // Should not have error about missing x-ai-description
    expect(tools[0].logs).not.toContainEqual({
      severity: "ERR",
      msg: "no `x-ai-description` field",
    });
  });

  it("should log error for empty x-ai-description and fallback to summary", () => {
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/test": {
          get: {
            operationId: "test_operation",
            "x-ai-description": "",
            description: "Regular description",
            summary: "Operation summary",
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(mockSpec);

    expect(tools).toHaveLength(1);
    expect(tools[0].description).toBe("Operation summary");

    // Should log error for empty x-ai-description
    expect(tools[0].logs).toContainEqual({
      severity: "ERR",
      msg: "no `x-ai-description` field",
    });
  });

  it("should accept x-ai-description with whitespace-only content", () => {
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/test": {
          get: {
            operationId: "test_operation",
            "x-ai-description": "   ",
            description: "Regular description",
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(mockSpec);

    expect(tools).toHaveLength(1);
    expect(tools[0].description).toBe("   ");

    // Should not log error for whitespace-only x-ai-description (it's present)
    expect(tools[0].logs).not.toContainEqual({
      severity: "ERR",
      msg: "no `x-ai-description` field",
    });
  });

  it("should work with multiple operations having x-ai-description", () => {
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/test1": {
          get: {
            operationId: "test_operation_1",
            "x-ai-description": "AI description for operation 1",
            description: "Regular description 1",
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
        "/test2": {
          post: {
            operationId: "test_operation_2",
            "x-ai-description": "AI description for operation 2",
            description: "Regular description 2",
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(mockSpec);

    expect(tools).toHaveLength(2);

    expect(tools[0].description).toBe("AI description for operation 1");
    expect(tools[0].logs).not.toContainEqual({
      severity: "ERR",
      msg: "no `x-ai-description` field",
    });

    expect(tools[1].description).toBe("AI description for operation 2");
    expect(tools[1].logs).not.toContainEqual({
      severity: "ERR",
      msg: "no `x-ai-description` field",
    });
  });

  it("should log error when operations lack x-ai-description", () => {
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/test1": {
          get: {
            operationId: "test_operation_1",
            description: "Regular description 1",
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
        "/test2": {
          post: {
            operationId: "test_operation_2",
            "x-ai-description": "AI description for operation 2",
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(mockSpec);

    expect(tools).toHaveLength(2);

    // First operation should have error log
    expect(tools[0].logs).toContainEqual({
      severity: "ERR",
      msg: "no `x-ai-description` field",
    });

    // Second operation should not have error log
    expect(tools[1].logs).not.toContainEqual({
      severity: "ERR",
      msg: "no `x-ai-description` field",
    });
    expect(tools[1].description).toBe("AI description for operation 2");
  });

  it("should log error when x-ai-description is too long", () => {
    const longDescription = "A".repeat(350); // 350 characters, over the 300 limit
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/test": {
          get: {
            operationId: "test_operation",
            "x-ai-description": longDescription,
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(mockSpec);

    expect(tools).toHaveLength(1);
    expect(tools[0].description).toBe(longDescription);

    // Should log error for x-ai-description being too long
    expect(tools[0].logs).toContainEqual({
      severity: "ERR",
      msg: "x-ai-description is too long (>300 chars)",
    });
  });

  it("should not log error when x-ai-description is exactly 300 characters", () => {
    const exactDescription = "A".repeat(300); // Exactly 300 characters
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/test": {
          get: {
            operationId: "test_operation",
            "x-ai-description": exactDescription,
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(mockSpec);

    expect(tools).toHaveLength(1);
    expect(tools[0].description).toBe(exactDescription);

    // Should not log error for x-ai-description at exactly 300 chars
    expect(tools[0].logs).not.toContainEqual({
      severity: "ERR",
      msg: "x-ai-description is too long (>300 chars)",
    });
  });

  it("should not log error when x-ai-description is just under 300 characters", () => {
    const shortDescription = "A".repeat(299); // 299 characters
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/test": {
          get: {
            operationId: "test_operation",
            "x-ai-description": shortDescription,
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(mockSpec);

    expect(tools).toHaveLength(1);
    expect(tools[0].description).toBe(shortDescription);

    // Should not log error for x-ai-description under 300 chars
    expect(tools[0].logs).not.toContainEqual({
      severity: "ERR",
      msg: "x-ai-description is too long (>300 chars)",
    });
  });

  it("should log error when x-ai-description is just over 300 characters", () => {
    const slightlyLongDescription = "A".repeat(301); // 301 characters
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/test": {
          get: {
            operationId: "test_operation",
            "x-ai-description": slightlyLongDescription,
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(mockSpec);

    expect(tools).toHaveLength(1);
    expect(tools[0].description).toBe(slightlyLongDescription);

    // Should log error for x-ai-description over 300 chars
    expect(tools[0].logs).toContainEqual({
      severity: "ERR",
      msg: "x-ai-description is too long (>300 chars)",
    });
  });

  it("should log both missing and too long errors for operations", () => {
    const longDescription = "A".repeat(350); // Over 300 characters
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/test1": {
          get: {
            operationId: "test_operation_1",
            "x-ai-description": "", // Empty description
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
        "/test2": {
          post: {
            operationId: "test_operation_2",
            "x-ai-description": longDescription, // Too long description
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(mockSpec);

    expect(tools).toHaveLength(2);

    // First operation should have error for empty x-ai-description
    expect(tools[0].logs).toContainEqual({
      severity: "ERR",
      msg: "no `x-ai-description` field",
    });

    // Second operation should have error for too long x-ai-description
    expect(tools[1].logs).toContainEqual({
      severity: "ERR",
      msg: "x-ai-description is too long (>300 chars)",
    });
  });

  it("should fallback to description when both x-ai-description and summary are missing", () => {
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/test": {
          get: {
            operationId: "test_operation",
            description: "Regular description",
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(mockSpec);

    expect(tools).toHaveLength(1);
    expect(tools[0].description).toBe("Regular description");

    // Should log error for missing x-ai-description
    expect(tools[0].logs).toContainEqual({
      severity: "ERR",
      msg: "no `x-ai-description` field",
    });
  });

  it("should fallback to empty string when x-ai-description, summary, and description are all missing", () => {
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/test": {
          get: {
            operationId: "test_operation",
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(mockSpec);

    expect(tools).toHaveLength(1);
    expect(tools[0].description).toBe("");

    // Should log error for missing x-ai-description
    expect(tools[0].logs).toContainEqual({
      severity: "ERR",
      msg: "no `x-ai-description` field",
    });
  });

  it("should prefer summary over description when x-ai-description is empty", () => {
    const mockSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/test": {
          get: {
            operationId: "test_operation",
            "x-ai-description": "",
            summary: "Operation summary",
            description: "Regular description",
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
      },
    };

    const tools = extractToolsFromApi(mockSpec);

    expect(tools).toHaveLength(1);
    expect(tools[0].description).toBe("Operation summary");

    // Should log error for empty x-ai-description
    expect(tools[0].logs).toContainEqual({
      severity: "ERR",
      msg: "no `x-ai-description` field",
    });
  });
});
