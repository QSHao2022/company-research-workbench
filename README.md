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