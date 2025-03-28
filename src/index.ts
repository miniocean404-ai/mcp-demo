// 引入 MCP Server 和 Stdio 传输模块
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import "./server/tool"
import { server } from "./server/tool"
import dotenv from "@dotenvx/dotenvx"

// 加载环境变量，也可以使用命令 dotenvx run -- node xxx 运行，就不用加下面代码
dotenv.config()

// 主函数：通过 stdio 启动 MCP 服务器
async function main() {
  // 终端输入输入传送给 MCP 服务器
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.log("天气服务运行在终端")
}

main()
