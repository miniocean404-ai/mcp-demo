// 引入所需模块
import { Client } from "@modelcontextprotocol/sdk/client/index.js" // MCP 客户端核心类
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js" // 用于通过 stdio 通信的传输层
import readline from "readline/promises" // 用于命令行交互
import dotenv from "@dotenvx/dotenvx"

import { OpenAI } from "openai" // OpenAI 官方 SDK
import { ChatCompletionMessageParam, type ChatCompletionTool } from "openai/resources/chat/completions" // 聊天消息类型

// 加载环境变量
dotenv.config()

// 读取环境变量
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!
const BASE_URL = process.env.BASE_URL || undefined
const MODEL = process.env.MODEL || "Qwen/QwQ-32B"

// 如果未设置 OpenAI API Key，则报错
if (!OPENAI_API_KEY) {
  throw new Error("❌ 请在 .env 文件中设置 OPENAI_API_KEY")
}

// MCP + OpenAI 客户端类
class MCPClient {
  mcp: Client // MCP 客户端实例
  openai: OpenAI // OpenAI 客户端实例
  tools: Array<{ name: string; description: string; input_schema: any }> = [] // 工具列表

  constructor() {
    // 初始化 MCP 客户端
    this.mcp = new Client({ name: "mcp-client-openai", version: "1.0.0" })

    // 初始化 OpenAI 客户端
    this.openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
      baseURL: BASE_URL,
    })
  }

  // 连接 MCP 服务器（支持 .js 或 .py）
  async connectToServer(serverScriptPath: string) {
    const isJs = serverScriptPath.endsWith(".js")
    const isPy = serverScriptPath.endsWith(".py")

    if (!isJs && !isPy) throw new Error("❌ 服务器脚本必须是 .js 或 .py 文件")

    // 判断平台，选择启动命令（Windows 用 python，Unix 用 python3）
    const command = isPy ? (process.platform === "win32" ? "python" : "python3") : process.execPath // 如果是 JS 脚本，则使用 Node 运行

    // 启动服务器脚本，并建立 stdio 通信
    const transport = new StdioClientTransport({
      command,
      args: [serverScriptPath],
    })

    // 使用 MCP 客户端连接服务器
    this.mcp.connect(transport)

    // 获取服务器暴露的工具信息
    const toolsResult = await this.mcp.listTools()

    this.tools = toolsResult.tools.map((tool: any) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }))

    const tools = this.tools.map((t) => t.name)
    console.log("✅ 已连接服务器，支持工具：", tools)
  }

  // 启动命令行对话循环
  async chatLoop() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    console.log("✅ MCP Client 启动完成")
    console.log("💬 输入你的问题，或输入 'quit' 退出")

    while (true) {
      const input = await rl.question("\nQuery: ")
      if (input.toLowerCase() === "quit") break

      const result = await this.processQuery(input)
      console.log("\n🧠 回复：\n" + result)
    }

    rl.close()
  }

  // 关闭 MCP 连接
  async cleanup() {
    await this.mcp.close()
  }

  // 处理用户提问
  async processQuery(query: string): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: "你是一个智能助手。" },
      { role: "user", content: query },
    ]

    // 构造 tools 数组，供 OpenAI 调用
    const tools = this.tools.map<ChatCompletionTool>((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
        strict: false, // Qwen 特有字段，OpenAI 可忽略
      },
    }))

    try {
      // 第一次请求 OpenAI，看是否需要调用工具
      const response = await this.openai.chat.completions.create({
        model: MODEL,
        messages,
        tools,
        tool_choice: "auto", // 让模型自动决定是否调用工具
        max_tokens: 1000,
        temperature: 0.7,
      })

      const message = response.choices[0].message

      // 如果模型返回了工具调用请求
      if (message.tool_calls?.length) {
        const toolCall = message.tool_calls[0]
        const toolName = toolCall.function.name
        const toolArgs = JSON.parse(toolCall.function.arguments)

        console.log(`\n🔧 调用工具：${toolName}`)
        console.log(`📦 参数：${JSON.stringify(toolArgs)}`)

        // 使用 MCP 调用本地工具
        const toolResult: any = await this.mcp.callTool({
          name: toolName,
          arguments: toolArgs,
        })

        // 获取工具的文本返回结果
        const resultText = toolResult?.content?.[0]?.text ?? "[工具无结果返回]"

        // 把调用过程加入对话上下文
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: [toolCall],
        })

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: resultText,
        })

        // 再次向 OpenAI 发送请求，获取基于工具结果的最终回复
        const finalResponse = await this.openai.chat.completions.create({
          model: MODEL,
          messages,
          max_tokens: 1000,
        })

        return finalResponse.choices[0].message?.content || "[无返回内容]"
      }

      // 如果没有工具调用，直接返回模型回复
      return message?.content || "[无返回内容]"
    } catch (err: any) {
      return `❌ OpenAI 请求出错: ${err.message}`
    }
  }
}

// 主函数入口
async function main() {
  // 检查是否提供了服务器脚本路径
  if (process.argv.length < 3) return console.log("用法: node dist/index.js <path_to_server_script>")

  const mcpClient = new MCPClient()

  try {
    // 连接 MCP 工具服务器
    await mcpClient.connectToServer(process.argv[2])
    // 启动交互循环
    await mcpClient.chatLoop()
  } finally {
    // 清理并退出
    await mcpClient.cleanup()
    process.exit(0)
  }
}

// 启动程序
main()
