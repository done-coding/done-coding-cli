---
id: cjf54l
title: dc-harness 引用闸（Python）：pytest 同级测试模块跨目录引用漏检；字符串里的 import 行被当作引用
created: 2026-11-16
from: done-creating-ledger
---

## 现象

done-creating-ledger 用 `feat/harness-mechanical-gates` 49cd746 的引用闸收后端边界（批次 4uk8s8），Python 解析有两处与实际运行不符：

ⓐ **pytest 按测试文件目录加入 `sys.path` 的同级模块，从别的目录引用时看不到。** ledger 的测试按领域分目录（`tests/fact-view/` 等，无 `__init__.py`，pytest 缺省 prepend 导入模式），测试之间用 `from test_view_postgres import insert` 共享辅助。把 `tests/fact-view/test_data_app_id_postgres.py` 移到服务根 `tests/` 后，它仍 `from test_view_postgres import …`（运行时能导入，因为 pytest 先收集 fact-view 目录时把它加进了 `sys.path`）。引用闸「绝对导入从引用方目录逐级向上找首段包」，在 `tests/` 及其上级找不到 `test_view_postgres.py`，当作第三方跳过，没有报「服务测试引领域内部」。这类跨目录的测试辅助引用全部漏检，而且运行时能否导入还取决于收集顺序。

ⓑ **字符串字面量里的 import 行也被当作引用。** `tests/fact-record/test_postgres.py` 用 `subprocess.run([sys.executable, "-c", script])` 起子进程模拟服务重启，`script` 是三引号字符串，内含 `from app.main import create_app`。引用闸按行把它解析成领域测试引装配内部并报错。这一条在 ledger 恰好是真实的运行时引用（ledger 改为子进程也经服务测试公开件 `support` 构造服务），但同样的扫描会把文档字符串、示例代码里的 import 行误报。

## 复现

ⓐ 任一用 pytest 缺省导入模式、测试分目录且无 `__init__.py` 的仓：在 `tests/a/test_x.py` 定义辅助，`tests/test_y.py` 里 `from test_x import helper`，`dc-harness check` 不报（`tests/a/` 属领域、`tests/` 属骨架时应报）。
ⓑ 在领域测试里写 `script = """\nfrom app.main import create_app\n"""`，`check` 报引用越界。

## 期望

ⓐ 解析 Python 绝对导入时，把与 pytest 一致的搜索路径（各测试文件所在目录、`pythonpath` 配置）也算进去；至少在找不到时把「未解析的本仓同名文件」列为警告，而不是静默跳过。
ⓑ 只解析语句级的 import（例如用 Python 的 `ast`），字符串里的不算；或在 README 写明按行扫描、字符串也会命中。
