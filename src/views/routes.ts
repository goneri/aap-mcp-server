import express from "express";
import {
  renderDashboard,
  renderToolsList,
  renderToolDetails,
  renderCategoriesOverview,
  renderCategoryTools,
  renderLogs,
  renderServicesOverview,
  renderServiceTools,
  renderEndpointsOverview,
  type ToolWithSuccessRate,
  type ToolDetailsData,
  type CategoryWithAccess,
  type CategoriesOverviewData,
  type CategoryToolsData,
  type LogsData,
  type ServicesOverviewData,
  type ServiceToolsData,
  type DashboardData,
  type EndpointsOverviewData,
  type EndpointData,
} from "./index.js";
import type { AAPMcpToolDefinition } from "../openapi-loader.js";
import type { LogEntry } from "../logger.js";
import { readFileSync, promises as fs } from "fs";
import { join } from "path";

// Helper function to get timestamps
const getTimestamp = (): string => {
  return new Date().toISOString().split(".")[0] + "Z";
};

// Helper function to read log entries for a tool
const getToolLogEntries = async (toolName: string): Promise<LogEntry[]> => {
  const logFile = join(process.cwd(), "logs", `${toolName}.jsonl`);
  try {
    const content = readFileSync(logFile, "utf8");
    const lines = content
      .trim()
      .split("\n")
      .filter((line) => line);
    return lines.map((line) => JSON.parse(line) as LogEntry);
  } catch (_error) {
    // Log file doesn't exist or can't be read
    return [];
  }
};

// Helper function to read all log entries across all tools
const getAllLogEntries = async (): Promise<
  (LogEntry & { toolName: string })[]
> => {
  const logsDir = join(process.cwd(), "logs");
  const allEntries: (LogEntry & { toolName: string })[] = [];

  try {
    const files = await fs.readdir(logsDir);
    const jsonlFiles = files.filter((file) => file.endsWith(".jsonl"));

    for (const file of jsonlFiles) {
      const toolName = file.replace(".jsonl", "");
      const entries = await getToolLogEntries(toolName);

      // Add toolName to each entry
      const entriesWithToolName = entries.map((entry) => ({
        ...entry,
        toolName,
      }));

      allEntries.push(...entriesWithToolName);
    }

    // Sort by timestamp, most recent first
    allEntries.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return allEntries;
  } catch (error) {
    console.error(`${getTimestamp()} Error reading log files:`, error);
    return [];
  }
};

// Generate dynamic color for category based on name
const getCategoryColor = (categoryName: string): string => {
  const colors = [
    "#6c757d",
    "#28a745",
    "#dc3545",
    "#17a2b8",
    "#007acc",
    "#ff9800",
    "#9c27b0",
    "#4caf50",
  ];
  const hash = categoryName
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// Filter tools based on category
const filterToolsByCategory = (
  tools: AAPMcpToolDefinition[],
  category: string[],
): AAPMcpToolDefinition[] => {
  return tools.filter((tool) => category.includes(tool.name));
};

// Configure web UI routes
export const configureWebUIRoutes = (
  app: express.Application,
  allTools: AAPMcpToolDefinition[],
  allCategories: Record<string, string[]>,
  recordApiQueries: boolean,
  allowWriteOperations: boolean,
  logEntriesSizeLimit: number,
): void => {
  // Tool list HTML endpoint
  app.get("/tools", async (req, res) => {
    try {
      // Calculate success rates for all tools
      const toolsWithSuccessRates: ToolWithSuccessRate[] = await Promise.all(
        allTools.map(async (tool) => {
          const logEntries = await getToolLogEntries(tool.name);
          let successRate = "N/A";

          if (logEntries.length > 0) {
            const successCount = logEntries.filter(
              (entry) => entry.return_code >= 200 && entry.return_code < 300,
            ).length;
            const successPercentage = (successCount / logEntries.length) * 100;
            successRate = `${successPercentage.toFixed(1)}%`;
          }

          return {
            ...tool,
            successRate,
            logCount: logEntries.length,
          };
        }),
      );

      // Use the view function to render the HTML
      const htmlContent = renderToolsList({ tools: toolsWithSuccessRates });

      res.setHeader("Content-Type", "text/html");
      res.send(htmlContent);
    } catch (error) {
      console.error(
        `${getTimestamp()} Error generating HTML tool list:`,
        error,
      );
      res.status(500).json({
        error: "Failed to generate tool list HTML",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Individual tool details endpoint
  app.get("/tools/:name", async (req, res) => {
    try {
      const toolName = req.params.name;

      // Find the tool
      const tool = allTools.find((t) => t.name === toolName);
      if (!tool) {
        return res.status(404).json({
          error: "Tool not found",
          message: `Tool '${toolName}' does not exist`,
        });
      }

      // Get log entries for this tool
      const logEntries = await getToolLogEntries(toolName);
      const last10Calls = logEntries.slice(-10).reverse(); // Get last 10, most recent first

      // Calculate error code summary
      const errorCodeSummary = logEntries.reduce(
        (acc, entry) => {
          const code = entry.return_code;
          acc[code] = (acc[code] || 0) + 1;
          return acc;
        },
        {} as Record<number, number>,
      );

      // Calculate success vs error statistics for pie chart
      const chartData = logEntries.reduce(
        (acc, entry) => {
          const code = entry.return_code;
          if (code >= 200 && code < 300) {
            acc.success += 1;
          } else {
            acc.error += 1;
          }
          return acc;
        },
        { success: 0, error: 0 },
      );

      // Check which categories have access to this tool
      const categoriesWithAccess: CategoryWithAccess[] = [];
      for (const [categoryName, categoryTools] of Object.entries(
        allCategories,
      )) {
        if (categoryTools.includes(toolName)) {
          categoriesWithAccess.push({
            name: categoryName,
            displayName:
              categoryName.charAt(0).toUpperCase() + categoryName.slice(1),
            color: getCategoryColor(categoryName),
          });
        }
      }

      // Prepare data for the view
      const toolDetailsData: ToolDetailsData = {
        tool,
        logEntries,
        last10Calls,
        errorCodeSummary,
        chartData,
        categoriesWithAccess,
      };

      // Use the view function to render the HTML
      const htmlContent = renderToolDetails(toolDetailsData);

      res.setHeader("Content-Type", "text/html");
      res.send(htmlContent);
    } catch (error) {
      console.error(`${getTimestamp()} Error generating tool details:`, error);
      res.status(500).json({
        error: "Failed to generate tool details",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Tool list CSV endpoint
  app.get("/export/tools/csv", (req, res) => {
    try {
      // Generate CSV content
      const csvHeader =
        "Tool name,size (characters),description,path template,service\n";
      const csvRows = allTools
        .map(
          (tool) =>
            `${tool.name},${tool.size},"${tool.description?.replace(/"/g, '""') || ""}",${tool.pathTemplate},${tool.service || "unknown"}`,
        )
        .join("\n");
      const csvContent = csvHeader + csvRows;

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="tool_list.csv"',
      );
      res.send(csvContent);
    } catch (error) {
      console.error(`${getTimestamp()} Error generating CSV tool list:`, error);
      res.status(500).json({
        error: "Failed to generate tool list CSV",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Category overview endpoint
  app.get("/category", (req, res) => {
    try {
      // Calculate stats for each category
      const categories = Object.entries(allCategories).map(
        ([categoryName, categoryTools]) => ({
          name: categoryName,
          displayName:
            categoryName.charAt(0).toUpperCase() + categoryName.slice(1),
          description: `${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} category with specific tool access`,
          tools: filterToolsByCategory(allTools, categoryTools),
          color: getCategoryColor(categoryName),
          toolCount: 0, // Will be calculated below
          totalSize: 0, // Will be calculated below
        }),
      );

      // Calculate sizes and add to category data
      const categoryStats = categories.map((category) => ({
        ...category,
        toolCount: category.tools.length,
        totalSize: category.tools.reduce(
          (sum, tool) => sum + (tool.size || 0),
          0,
        ),
      }));

      // Prepare data for the view
      const categoriesOverviewData: CategoriesOverviewData = {
        categories: categoryStats,
        allTools,
      };

      // Use the view function to render the HTML
      const htmlContent = renderCategoriesOverview(categoriesOverviewData);

      res.setHeader("Content-Type", "text/html");
      res.send(htmlContent);
    } catch (error) {
      console.error(
        `${getTimestamp()} Error generating category overview:`,
        error,
      );
      res.status(500).json({
        error: "Failed to generate category overview",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Category tools endpoint
  app.get("/category/:name", (req, res) => {
    try {
      const categoryName = req.params.name.toLowerCase();

      // Get the category based on the name
      const category = allCategories[categoryName];
      if (!category) {
        const availableCategories = Object.keys(allCategories).join(", ");
        return res.status(404).json({
          error: "Category not found",
          message: `Category '${req.params.name}' does not exist. Available categories: ${availableCategories}`,
        });
      }

      const displayName =
        categoryName.charAt(0).toUpperCase() + categoryName.slice(1);

      // Filter tools based on category
      const filteredTools = filterToolsByCategory(allTools, category);

      // Calculate total size
      const totalSize = filteredTools.reduce(
        (sum, tool) => sum + (tool.size || 0),
        0,
      );

      // Prepare data for the view
      const categoryToolsData: CategoryToolsData = {
        categoryName,
        displayName,
        filteredTools,
        totalSize,
        allCategories,
      };

      // Use the view function to render the HTML
      const htmlContent = renderCategoryTools(categoryToolsData);

      res.setHeader("Content-Type", "text/html");
      res.send(htmlContent);
    } catch (error) {
      console.error(
        `${getTimestamp()} Error generating category tool list:`,
        error,
      );
      res.status(500).json({
        error: "Failed to generate category tool list",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Logs overview endpoint
  app.get("/logs", async (req, res) => {
    try {
      if (!recordApiQueries) {
        return res.status(404).json({
          error: "Logging disabled",
          message:
            "API query recording is disabled. Enable it in aap-mcp.yaml to view logs.",
        });
      }

      // Get all log entries
      const allEntries = await getAllLogEntries();
      let lastEntries = allEntries.slice(0, logEntriesSizeLimit);

      // Apply status code filter if provided
      const statusCodeFilter = req.query.status_code as string;
      if (statusCodeFilter) {
        const filterCode = parseInt(statusCodeFilter, 10);
        if (!isNaN(filterCode)) {
          lastEntries = lastEntries.filter(
            (entry) => entry.return_code === filterCode,
          );
        }
      }

      // Apply tool filter if provided
      const toolFilter = req.query.tool as string;
      if (toolFilter) {
        lastEntries = lastEntries.filter(
          (entry) => entry.toolName === toolFilter,
        );
      }

      // Apply user-agent filter if provided
      const userAgentFilter = req.query.user_agent as string;
      if (userAgentFilter) {
        lastEntries = lastEntries.filter((entry) => {
          const entryUserAgent = entry.payload?.userAgent || "unknown";
          return entryUserAgent
            .toLowerCase()
            .includes(userAgentFilter.toLowerCase());
        });
      }

      const totalRequests = allEntries.length;
      const statusCodeSummary = lastEntries.reduce(
        (acc, entry) => {
          const code = entry.return_code;
          acc[code] = (acc[code] || 0) + 1;
          return acc;
        },
        {} as Record<number, number>,
      );

      const toolSummary = lastEntries.reduce(
        (acc, entry) => {
          acc[entry.toolName] = (acc[entry.toolName] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      const userAgentSummary = lastEntries.reduce(
        (acc, entry) => {
          const userAgent = entry.payload?.userAgent || "unknown";
          acc[userAgent] = (acc[userAgent] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      // Transform log entries to match the view interface
      const transformedEntries = lastEntries.map((entry) => ({
        timestamp: entry.timestamp,
        toolName: entry.toolName,
        return_code: entry.return_code,
        endpoint: entry.endpoint,
        payload: entry.payload,
        userAgent: entry.payload?.userAgent || "unknown",
      }));

      // Prepare data for the view
      const logsData: LogsData = {
        lastEntries: transformedEntries,
        totalRequests,
        statusCodeFilter,
        toolFilter,
        userAgentFilter,
        statusCodeSummary,
        toolSummary,
        userAgentSummary,
        logEntriesSizeLimit,
      };

      // Use the view function to render the HTML
      const htmlContent = renderLogs(logsData);

      res.setHeader("Content-Type", "text/html");
      res.send(htmlContent);
    } catch (error) {
      console.error(`${getTimestamp()} Error generating logs overview:`, error);
      res.status(500).json({
        error: "Failed to generate logs overview",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Services overview endpoint
  app.get("/services", (req, res) => {
    try {
      // Group tools by service
      const serviceGroups = allTools.reduce(
        (acc, tool) => {
          const service = tool.service || "unknown";
          if (!acc[service]) {
            acc[service] = [];
          }
          acc[service].push(tool);
          return acc;
        },
        {} as Record<string, AAPMcpToolDefinition[]>,
      );

      // Prepare service data for the view
      const services = Object.entries(serviceGroups).map(
        ([serviceName, tools]) => ({
          name: serviceName,
          displayName:
            serviceName.charAt(0).toUpperCase() + serviceName.slice(1),
          toolCount: tools.length,
          totalSize: tools.reduce((sum, tool) => sum + (tool.size || 0), 0),
          logCount: tools.reduce(
            (sum, tool) => sum + (tool.logs?.length || 0),
            0,
          ),
          description: `${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)} service providing ${tools.length} tools for automation and management tasks.`,
        }),
      );

      // Prepare data for the view
      const servicesOverviewData: ServicesOverviewData = {
        services,
        allTools,
      };

      // Use the view function to render the HTML
      const htmlContent = renderServicesOverview(servicesOverviewData);

      res.setHeader("Content-Type", "text/html");
      res.send(htmlContent);
    } catch (error) {
      console.error(
        `${getTimestamp()} Error generating services overview:`,
        error,
      );
      res.status(500).json({
        error: "Failed to generate services overview",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get("/services/:name", (req, res) => {
    try {
      const serviceName = req.params.name.toLowerCase();

      // Filter tools by service
      const serviceTools = allTools.filter(
        (tool) => (tool.service || "unknown") === serviceName,
      );

      if (serviceTools.length === 0) {
        return res.status(404).json({
          error: "Service not found",
          message: `Service '${req.params.name}' does not exist or has no tools`,
        });
      }

      const displayName =
        serviceName.charAt(0).toUpperCase() + serviceName.slice(1);
      const totalSize = serviceTools.reduce(
        (sum, tool) => sum + (tool.size || 0),
        0,
      );
      const methods = [...new Set(serviceTools.map((tool) => tool.method))];

      // Prepare data for the view
      const serviceToolsData: ServiceToolsData = {
        serviceName,
        displayName,
        serviceTools,
        totalSize,
        methods,
      };

      // Use the view function to render the HTML
      const htmlContent = renderServiceTools(serviceToolsData);

      res.setHeader("Content-Type", "text/html");
      res.send(htmlContent);
    } catch (error) {
      console.error(
        `${getTimestamp()} Error generating service tools list:`,
        error,
      );
      res.status(500).json({
        error: "Failed to generate service tools list",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // API endpoints overview
  app.get("/endpoints", (req, res) => {
    try {
      // Get category filter from query parameter
      const categoryFilter = req.query.category as string | undefined;

      // Filter tools by category if specified
      let toolsToDisplay = allTools;
      if (categoryFilter && allCategories[categoryFilter]) {
        toolsToDisplay = filterToolsByCategory(
          allTools,
          allCategories[categoryFilter],
        );
      }

      // Helper function to find categories for a tool
      const getCategoriesForTool = (toolName: string): string[] => {
        const categories: string[] = [];
        for (const [categoryName, categoryTools] of Object.entries(
          allCategories,
        )) {
          if (categoryTools.includes(toolName)) {
            categories.push(categoryName);
          }
        }
        return categories;
      };

      // Group endpoints by service
      const endpointsByService = toolsToDisplay.reduce(
        (acc, tool) => {
          const service = tool.service || "unknown";
          if (!acc[service]) {
            acc[service] = [];
          }

          const categories = getCategoriesForTool(tool.name);

          acc[service].push({
            path: tool.pathTemplate,
            method: tool.method.toUpperCase(),
            name: tool.name,
            description: tool.description,
            toolName: tool.name,
            categories,
            logs: tool.logs || [],
          });

          return acc;
        },
        {} as Record<string, EndpointData[]>,
      );

      // Sort endpoints within each service by path
      Object.keys(endpointsByService).forEach((service) => {
        endpointsByService[service].sort((a, b) =>
          a.path.localeCompare(b.path),
        );
      });

      // Prepare data for the view
      const endpointsOverviewData: EndpointsOverviewData = {
        allTools: toolsToDisplay,
        endpointsByService,
        allCategories,
        selectedCategory: categoryFilter,
      };

      // Use the view function to render the HTML
      const htmlContent = renderEndpointsOverview(endpointsOverviewData);

      res.setHeader("Content-Type", "text/html");
      res.send(htmlContent);
    } catch (error) {
      console.error(
        `${getTimestamp()} Error generating endpoints overview:`,
        error,
      );
      res.status(500).json({
        error: "Failed to generate endpoints overview",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Root endpoint - dashboard
  app.get("/", async (req, res) => {
    try {
      // Prepare data for the dashboard view
      const dashboardData: DashboardData = {
        allTools,
        allCategories,
        recordApiQueries,
        allowWriteOperations,
      };

      // Use the view function to render the HTML
      const htmlContent = renderDashboard(dashboardData);

      res.setHeader("Content-Type", "text/html");
      res.send(htmlContent);
    } catch (error) {
      console.error(`${getTimestamp()} Error generating dashboard:`, error);
      res.status(500).json({
        error: "Failed to generate dashboard",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
};
