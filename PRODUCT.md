# Product

## Register

product

## Platform

web

## Users

本地使用 Pi Agent 的开发者。他们在本机维护 `~/.pi/agent/models.json`，需要频繁增删第三方 Provider、给内建 Provider 追加模型，或改 compat / modelOverrides。场景是桌面旁的配置工作台：打开工具、改几项、保存、回到 Pi 继续用。

## Product Purpose

用可视化表单替代手改 JSON，降低配置错误与心智负担。成功标准是：打开即可看到现有 Provider，几分钟内完成新增/编辑/保存，且落盘结果与 Pi 期望的 schema 一致。

## Positioning

本机 Pi Provider 配置的唯一清晰工作台——表单优先，JSON 兜底。

## Brand Personality

**柔和 · 有序 · 可靠。** 界面像一本整理好的灰绿笔记本：安静、不抢戏，让配置本身成为焦点。语气平实、指令明确，不卖弄。

## Anti-references

- 深色赛博 / 霓虹 / 紫蓝渐变 SaaS 仪表盘
- 高密度终端黑底、等宽字体铺满整页

## Design Principles

1. **配置优先于装饰** — 每个视觉元素都应帮助完成读写 models.json，而不是展示品牌。
2. **有序可扫读** — Provider 列表、表单分区、模型卡片层级清晰，一眼知道身在何处。
3. **柔和但不含糊** — 灰绿色调降低视觉噪音，但状态（错误、未保存、选中）必须明确。
4. **表单是主路径，JSON 是逃生口** — 默认表单编辑；原始 JSON 给需要精确控制的人。
5. **本地工具的信任感** — 路径可见、备份可感知、保存反馈诚实。

## Accessibility & Inclusion

基础可用即可：可读对比度、可见焦点环、尊重 `prefers-reduced-motion`。不强制 WCAG AA/AAA 全量审计。
