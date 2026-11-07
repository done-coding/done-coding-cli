# SNAPSHOT — component

> 文档定位：快照型 · 覆盖更新、只写当前状态。使用说明唯一载体 = `packages/component/README.md`。

## 技术快照

- 版本 0.6.3。`dc-component add / modify / remove / list` ≡ `dc-generator <verb> component`；配置读 `.done-coding/component/`（就近向上，再到 `~/.done-coding/component/`），本包不内置模板。
- 缺配置：退出 1，只输出「缺什么 + `done-coding generator init component`」两行，无调用栈；`--help` 末尾（utils `epilog`）说明配置位置与初始化方式（6zzib5，未发布）。
- 测试：vitest 3 文件（byte-identical 旧产物对照、modify、缺配置 spawn 用例；夹具与 HOME 均为临时目录）。

## 业务快照

- 初始化走 generator 通用骨架（`generator init component`），不是旧 component 业务模板；需要现成模板时从模板仓复制配置。

## UX 快照

无 UI 面（命令行）。
