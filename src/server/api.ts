// 设置 NWS（美国国家气象局）API 基础信息
export const NWS_API_BASE = "https://api.weather.gov"
const USER_AGENT = "weather-app/1.0"

// 通用请求封装：调用 NWS API 接口并解析 JSON 返回
export async function makeNWSRequest<T>(url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json",
  }

  try {
    const response = await fetch(url, { headers })
    if (!response.ok) throw new Error(`HTTP 错误状态码: ${response.status}`)
    return (await response.json()) as T
  } catch (error) {
    console.error("错误请求美国国家气象局:", error)
    return null
  }
}
