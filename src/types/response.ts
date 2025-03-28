// 定义接口返回类型
export interface ForecastPeriod {
  name?: string
  temperature?: number
  temperatureUnit?: string
  windSpeed?: string
  windDirection?: string
  shortForecast?: string
}

export interface AlertsResponse {
  features: AlertFeature[]
}

export interface PointsResponse {
  properties: { forecast?: string }
}

export interface ForecastResponse {
  properties: { periods: ForecastPeriod[] }
}

// 定义 NWS 返回的告警数据结构
export interface AlertFeature {
  properties: {
    event?: string
    areaDesc?: string
    severity?: string
    status?: string
    headline?: string
  }
}
