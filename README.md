# Pi Provider Manager

本地 Web 工具，可视化管理 Pi Agent 的 `~/.pi/agent/models.json` 配置。

## 功能

- 管理第三方 Provider（baseUrl、api、apiKey、compat、models）
- 扩展内建 Provider（追加 models、modelOverrides）
- 模型 CRUD，常用 compat 开关，原始 JSON 编辑
- 保存前自动备份到 `~/.pi/agent/backups/`

## 快速开始

```bash
npm install
npm run dev
```

- 前端：http://localhost:5173
- API：http://localhost:8787

默认 API 端口是 8787。若启动时出现 `EACCES` 或端口被占用，在同一个终端里设置 `PORT` 后再执行 `npm run dev`（例如 PowerShell：`$env:PORT=8788; npm run dev`）。Vite 代理和 API 都会读取这个环境变量，必须在同一次启动里设置，两边才会指向同一端口。

## 生产构建

```bash
npm run build
npm start
```

访问 http://localhost:8787

## 配置路径

默认读写：`%USERPROFILE%\.pi\agent\models.json`（Windows）或 `~/.pi/agent/models.json`

## 示例配置

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        { "id": "llama3.1:8b", "name": "Llama 3.1 8B" }
      ]
    },
    "opencode-go": {
      "models": [
        {
          "id": "glm-5.2",
          "name": "GLM 5.2",
          "reasoning": true,
          "contextWindow": 1000000
        }
      ]
    }
  }
}
```

## 安全说明

- 本工具为纯本地应用，API Key 仅在本地读写
- 请勿将真实 API Key 提交到版本控制
