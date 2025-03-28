import type { AlertsResponse, ForecastPeriod, ForecastResponse, PointsResponse } from "../types/response"
import { z } from "zod" // 用于参数校验的库
import { makeNWSRequest, NWS_API_BASE } from "./api"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

// 创建 MCP 服务器实例
export const server = new McpServer({
  name: "weather", // 工具服务名称
  version: "1.0.0", // 版本
  capabilities: {
    resources: {}, // 无资源
    tools: {}, // 工具将在后续注册
  },
})

// 工具 1️⃣：根据州名获取天气警报
server.tool(
  "get-alerts",
  "Get weather alerts for a state",
  {
    state: z.string().length(2).describe("Two-letter state code (e.g. CA, NY)"),
  },
  async ({ state }) => {
    const stateCode = state.toUpperCase()
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`
    const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl)

    if (!alertsData) return { content: [{ type: "text", text: "Failed to retrieve alerts data" }] }

    const features = alertsData.features || []

    if (features.length === 0) return { content: [{ type: "text", text: `No active alerts for ${stateCode}` }] }

    // 格式化单条警报内容为字符串
    const formattedAlerts = features.map((feature) => {
      const props = feature.properties
      return [
        `Event: ${props.event || "Unknown"}`,
        `Area: ${props.areaDesc || "Unknown"}`,
        `Severity: ${props.severity || "Unknown"}`,
        `Status: ${props.status || "Unknown"}`,
        `Headline: ${props.headline || "No headline"}`,
        "---",
      ].join("\n")
    })

    return { content: [{ type: "text", text: `Active alerts for ${stateCode}:\n\n${formattedAlerts.join("\n")}` }] }
  },
)

// 工具 2️⃣：根据经纬度获取天气预报
server.tool(
  "get-forecast",
  "Get weather forecast for a location",
  {
    latitude: z.number().min(-90).max(90).describe("Latitude of the location"),
    longitude: z.number().min(-180).max(180).describe("Longitude of the location"),
  },
  async ({ latitude, longitude }) => {
    // 先获取当前坐标所对应的 forecast URL
    const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`
    const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl)

    if (!pointsData) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`,
          },
        ],
      }
    }

    const forecastUrl = pointsData.properties?.forecast
    if (!forecastUrl) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to get forecast URL from grid point data",
          },
        ],
      }
    }

    // 请求天气预报数据
    const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl)
    if (!forecastData) {
      return {
        content: [{ type: "text", text: "Failed to retrieve forecast data" }],
      }
    }

    const periods = forecastData.properties?.periods || []
    if (periods.length === 0) return { content: [{ type: "text", text: "No forecast periods available" }] }

    // 格式化天气预报信息
    const formattedForecast = periods.map((period: ForecastPeriod) =>
      [
        `${period.name || "Unknown"}:`,
        `Temperature: ${period.temperature || "Unknown"}°${period.temperatureUnit || "F"}`,
        `Wind: ${period.windSpeed || "Unknown"} ${period.windDirection || ""}`,
        `${period.shortForecast || "No forecast available"}`,
        "---",
      ].join("\n"),
    )

    return {
      content: [{ type: "text", text: `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join("\n")}` }],
    }
  },
)
