---
name: Pi Provider Manager
description: 灰绿色 Calm Precision 本地配置工作台
colors:
  bg: "#f4f6f3"
  surface: "#ffffff"
  surface-muted: "#e9ede8"
  surface-sidebar: "#eef2ee"
  ink: "#243028"
  muted: "#4a564c"
  border: "#cfd6cf"
  border-strong: "#a8b3a9"
  primary: "#3f654c"
  primary-hover: "#345540"
  primary-soft: "#e6efe8"
  primary-border: "#9bb8a4"
  cat-third: "#2f6b78"
  cat-third-soft: "#e6f1f3"
  danger: "#a8433f"
  danger-soft: "#f7e9e8"
  warning: "#7a5f1c"
  warning-soft: "#f6efdc"
  success: "#2f6b42"
  success-soft: "#e5f2e9"
  info: "#35556c"
  info-soft: "#e8eef3"
  focus: "#3f654c"
  on-primary: "#f7faf7"
  placeholder: "#5c6a60"
typography:
  caption:
    fontFamily: "Source Sans 3, Source Sans 3 Fallback, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "Source Sans 3, Source Sans 3 Fallback, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "Source Sans 3, Source Sans 3 Fallback, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "Source Sans 3, Source Sans 3 Fallback, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
  display:
    fontFamily: "Source Sans 3, Source Sans 3 Fallback, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  mono:
    fontFamily: "IBM Plex Mono, IBM Plex Mono Fallback, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  sm: "4px"
  md: "8px"
  lg: "10px"
spacing:
  2xs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  3xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "#ffffff"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
---

## Overview

**Moss Desk** — 浅灰绿纸面工作台。像整理好的桌面便签与文件夹：留白充足、细边框、单一鼠尾草绿强调色。策略为 Restrained：中性灰绿表面 + 主色不超过 10% 面积。

情绪：安静、可长时间编辑。不是终端，不是赛博仪表盘。

## Colors

策略：**Restrained**。鼠尾草绿主色只用于主操作、选中、焦点；分类与语义色各有独立色相，避免「全是绿」。

| Token | Role |
|-------|------|
| `bg` / `surface` / `surface-sidebar` | 页面底、内容面板、侧栏（侧栏略深苔藓 tint） |
| `ink` / `muted` | 正文与次要文字，同色相低彩度 |
| `primary` | 主按钮、选中项、品牌标题、焦点 |
| `cat-third` | 第三方 Provider 徽章（冷青绿，区别于内建鼠尾草） |
| `success` / `danger` / `warning` / `info` | 保存成功、错误、未保存、提示（info 不再复用 primary） |

OKLCH 源（实现以 CSS 变量为准）：

- primary `oklch(0.46 0.072 150)`
- cat-third `oklch(0.44 0.055 198)`
- success `oklch(0.46 0.09 142)`
- info `oklch(0.46 0.05 210)`

## Typography

单一无衬线家族 **Source Sans 3** 承担标题、正文、标签；**IBM Plex Mono** 仅用于路径、模型 id、JSON、API Key。

固定 rem 字阶（约 1.125–1.2）：

| Token | Size | Role |
|-------|------|------|
| `--text-xs` | 0.75rem | 路径、徽章 |
| `--text-sm` | 0.875rem | 标签、元信息、等宽、小按钮 |
| `--text-base` | 1rem | 正文 |
| `--text-md` | 1.125rem | 面板/弹窗标题、副标题 |
| `--text-lg` | 1.5rem | 品牌标题 |

字重：400 正文 · 500 标签/徽章 · 600 标题。不加载未使用的 700。

## Elevation

扁平分层：靠背景色差与 1px 边框，不用大阴影。模态用轻遮罩 + 细边框面板。侧栏 `sticky`，列表区内滚动。

间距为 4pt 刻度 token（`--space-2xs` … `--space-3xl`）。组内紧（4–8）、字段网格 12、分区 32+底部分隔线、双栏间隙 24（大于面板内边距 16）。

## Components

- **按钮**：主按钮实心鼠尾草绿 + 白字；次按钮白底细边框。
- **面板**：白底、10px 圆角、细边框；侧栏列表选中用浅绿底，不用左侧色条。
- **表单**：白底输入框、清晰 label、焦点环用 primary。
- **徽章**：浅绿底 + 深绿字，小写/常规字重，避免全大写霓虹感。
- **告警**：软色底 + 同色相文字，全边框而非侧条。

## Do's and Don'ts

**Do**

- 保持浅色、低饱和灰绿体系
- 用背景 tint 表达选中/悬停
- 等宽字体只用于数据与代码

**Don't**

- 渐变字、紫蓝霓虹、深色赛博底
- 列表项左侧粗色条装饰
- 过大圆角（>12px）或宽软阴影
- 装饰性页面入场动画
