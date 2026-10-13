# 拼见圣经 · Bible Story Puzzle

一个面向成人的离线 iOS 故事拼图。玩家可以查看完整原图，把乱序碎片拖到按难度划分的网格中；所有格子都以同样方式吸附，摆放时不提示对错，只有主动提交时才给出整体结果。通过后可以回答人物问题、阅读故事并收藏。

项目也支持“我的故事集”：批量导入 JPEG、PNG 或 WebP，裁切为 4:3 或用中性边框保留完整画面，编辑标题／故事／出处／可选三选一问题，排序、选封面，试玩 12／24／48 块并保存草稿。内容、图片版本、进度和收藏都只在当前设备保存，不上传服务器。

## 目录

- `web/`：可离线运行的共享游戏页面。设计检查可使用 `index.html?prototype=1`；默认入口是移动 App 视图。
- `ios/`：SwiftUI + WKWebView 原生工程、系统图片选择器、固定本机资源服务、动态颜色、音效和触感桥接。
- `docs/`：页面流程、素材制作、网格与自建故事集规格、验收记录及设计系统契约。
- `scripts/`：生成 Xcode 项目、同步 App 资源和运行验证的脚本。
- `tests/`：网页流程、网格、裁切、移动视图与原生桥接的 Playwright 检查。

## 本机运行网页

```powershell
npm install
npm start
# 打开 http://127.0.0.1:8766/index.html
```

`npm test` 会启动本机服务，检查官方闭环、12／24／48 格、拖拽与提交规则、预览和滚动位置、自建故事集、裁切／完整保留、移动宽度、暗色系统色及共享原生导入桥。浏览器检查不会替代 iPhone 真机的 VoiceOver、照片授权和性能验收。

## iOS 构建

需要 macOS、Xcode 15 或更新版本。资源同步和 Xcode 项目可重建：

```sh
python3 scripts/prepare-ios.py
python3 scripts/generate-project.py
xcodebuild -project ios/BibleStoryPuzzle.xcodeproj -scheme BibleStoryPuzzle \
  -sdk iphoneos -configuration Release -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
```

GitHub Actions 使用同样的命令，在 macOS runner 上归档 `BibleStoryPuzzle.app`，将 `Payload/BibleStoryPuzzle.app` 打包为 `BibleStoryPuzzle-unsigned.ipa` 并上传为构建产物。未签名 IPA 不能直接安装到普通 iPhone；安装前需要用开发者证书、配置文件或合适的签名工具签名。仓库不保存任何签名凭据。

## 项目身份和隐私

仓库：[github.com/iszkq/bible-story-puzzle](https://github.com/iszkq/bible-story-puzzle)

显示名：**拼见圣经**；英文名：**Bible Story Puzzle**。初始六幅故事图、欢迎图和图标来自用户提供的素材；本仓库没有调用 API 生成新图片。详见 `docs/素材需求与精美制作流程.md` 与 `web/assets/asset-manifest.json`。

原生应用只允许访问自己的 `127.0.0.1:18765` 资源服务和用户主动选择的图片。没有账号、广告、分析、云同步或远程图片上传。删除 App 或清除网站数据会删除本地故事集与进度。
