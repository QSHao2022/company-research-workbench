# 公司研究纪要工作台

一个部署在 GitHub Pages 的静态网页，用于按照固定四段式模板记录公司调研、业绩会和电话会纪要。

## 固定模板
1. 超出预期，或者修正了我之前判断的地方
2. 低于预期，或者需要打折扣的地方
3. 这次没问到，需要补问的
4. 我的判断有什么变化

## 架构
- 本仓库（Public）：只保存网页代码，通过 GitHub Actions 自动部署到 GitHub Pages。
- `QSHao2022/research-archive`（Private）：保存每条纪要的独立 JSON 文件。
- 网页在浏览器中直接调用 GitHub Contents API；纪要内容不会写入公开网页仓库。
- GitHub Fine-grained PAT 仅保存在当前浏览器会话的 sessionStorage，不写入代码仓库。

## 首次使用
1. 在 GitHub Settings → Pages 中，将 Build and deployment 的 Source 设置为 **GitHub Actions**。
2. 等待 Actions 中的 Deploy workflow 成功，网页入口为 `https://qshao2022.github.io/company-research-workbench/`。
3. 创建 Fine-grained personal access token：
   - Resource owner: `QSHao2022`
   - Repository access: Only select repositories → `research-archive`
   - Repository permissions: Contents → Read and write
4. 打开网页，点击“云端设置”，粘贴 Token 并连接。
5. 纪要保存为 `research-archive/notes/YYYY/MM/YYYY-MM-DD-company-id.json`。

## 安全提示
不要把 Token 发给任何人或提交到仓库。建议只给 Token 授权访问 `research-archive` 一个私有仓库，并设置合理的过期时间。网页是静态客户端，Token 在当前浏览器会话内用于访问 GitHub API。

## AI 整理服务（首次部署一次）

网页已改为直接调用 Cloudflare Worker，GitHub Actions 不再参与 AI 生成；GitHub 私有仓库仍只负责保存正式纪要和历史记录。

1. 登录 Cloudflare Dashboard，进入 **Workers & Pages** → **Create** → **Create Worker**。
2. 创建 Worker，名称可用 `research-minutes-ai`，进入代码编辑器。
3. 将本仓库 `worker/index.js` 的完整内容复制到 Worker 编辑器，部署（Deploy）。
4. 在 Worker 的 **Settings → Variables and Secrets** 中添加 Secret：
   - 名称：`OPENAI_API_KEY`
   - 值：你的 OpenAI API Key（sk-...）
5. 可选添加普通变量 `OPENAI_MODEL`，默认 `gpt-6-luna`；若账户没有该模型权限，可改成账户可用的模型名称。
6. 回到工作台 → 云端设置，把 Worker 的 `https://...workers.dev` 地址填入“AI 整理服务地址”，点击“保存 AI 服务地址”。
7. GitHub Token 仍按原方式连接 `research-archive`。AI 整理完成后，检查结果并点击“保存到云端”。

### 安全与数据流

- OpenAI API Key 只保存在 Cloudflare Worker Secret，不放在网页、浏览器存储或 GitHub 仓库。
- 原始纪要会从浏览器发送到你的 Worker，再由 Worker 转发至 OpenAI API。
- AI 返回结果先显示在网页，人工检查后再由 GitHub Token 保存到私有历史仓库。
- Worker 只允许来自 `https://qshao2022.github.io` 的网页请求。
- 当前单次原文上限为 60,000 字符。长纪要请拆分后整理。
