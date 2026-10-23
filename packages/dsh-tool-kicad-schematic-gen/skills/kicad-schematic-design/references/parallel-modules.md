# 多模块分批生成

用于多个可独立实现的功能任务，包括首轮绘图，以及继续旧工程时多个模块的实质重画。这里调度的是脚本编写任务，所有电路仍由一个入口生成。单个局部修复直接完成，不为使用子 agent 人为拆任务。

## 触发、能力检查与旧流程迁移

主 agent 在开始或继续任务时先列出剩余工作，按电气归属合并紧邻外围。至少两个可独立实现的任务且上层指令允许时，检查本会话实际可见的子 agent 工具及其参数；可用就实际派发。计划和队列状态不算委派证据，必须取得真实任务 ID 并收集返回结果。工具暂时无空闲槽位时先推进共享准备，等已有任务结束再补派，不把暂时满额当成永久不可用。

在 module-plan.json 顶层附加 `dispatch` 调度记录：`mode` 为 parallel、sequential-subagents 或 sequential-local，`reason` 写本次选择依据，`tool` 写实际工具名（无可用工具时为 null）。这些是审计元数据，队列脚本不验证其含义、不自动选择模式。parallel 受工具和宿主实际槽位限制；只有同步子 agent 时采用 sequential-subagents。仅当上层禁止委派、工具确实不可用，或具体调用失败且无可用替代时采用 sequential-local，记录原因并明确告知用户；不能伪造 runtimeId 或把主 agent 本地编写称为子任务完成。

继续已有单文件脚本时，先停止主 agent 对待委派模块的内部实现修改，冻结当前候选和已确认的位号/网络。将共享数据提取到 shared，将受影响电路整理为 modules 下的独占文件，主入口只负责组合、跨区连接及保存。每个任务接收现有对应代码与具体改动要求，保留已验证模块和电气设计依据。多个模块仍需修复标签小岛、重构内部连接或重排局部拓扑时执行此迁移；已存在 design.mjs 或多轮候选不构成豁免。仅单模块小改或跨模块共享接口修正由主 agent 直接完成。

运行中的会话只有实际重新读取这些规则并执行调度，才算切换流程。修改磁盘文件不会自动迁移已在运行的 agent；没有实际工具调用记录时，不声称已启用并行。

## 划分与冻结

主 agent 先读取完成的方案，核实器件和引脚，建立 `scripts/shared/parts.mjs`、角色位号表、网络名及页面布局。复用模块先确定导入后的位号映射并预留编号。共享表、主入口、库表和正式工程只有主 agent 可以修改。

按电气归属拆功能框：MCU 连同去耦、晶振、复位；USB 连同 CC、ESD；电源连同反馈和滤波。LED 或一对上拉不单独启动 agent。一个任务可以负责几个强相关框，复杂功能也可分成不同文件，但不得把紧邻外围拆到不同任务后只靠标签连接。

在设计目录创建 `module-plan.json`，可从 [示例计划](../assets/modular-design/module-plan.json) 开始。它是调度记录，不替代方案或电气设计，不自动产生连线：

- `maxConcurrent` 默认 3；只有 1–2 个独立任务时使用实际数量。模块再多也排队，不一次全启动；出现并发限流、连续超时或明显首响应变慢时，待已有任务结束再降到 2 或 1，不因模块多增大并发。
- `interfacesFrozen` 由主 agent 核实共享数据后设置为 true；为 false 时不派新任务。
- `modules[].id/files` 指定任务及独占文件，只能位于 `scripts/modules/`；共享辅助函数由主 agent 准备，子 agent 不改同一文件。
- `references/ports/layout` 记录角色位号、已确认的真实 `{reference,pin}` 以及全局 origin/size；不从子 agent 返回的猜测坐标接线。位号按表取用，禁止各自从 R1 开始或另建分配器。
- `dependsOn` 仅列出必须先拿到**生成结果**的任务，例如必须读取另一模块导入返回的映射。该依赖必须无环。
- `usesInterfaces` 列出使用其接口的模块。供电、I²C 等通常只依赖冻结的接口，放在这里而非 dependsOn，所以电源和 MCU 可以同时写代码；此关系允许互相引用。
- `status` 依次 pending → running → generated → verified；失败为 blocked。generated 仅代表完成编写，verified 必须有集成检查证据。

## 队列与实际工具

用 [module-queue.mjs](../scripts/module-queue.mjs) 校验编号、文件归属、依赖与运行数量并获取下一批。以下 PLAN 是计划绝对路径，QUEUE 是当前 skill 的脚本绝对路径：

```text
node QUEUE PLAN status
node QUEUE PLAN start mcu
node QUEUE PLAN bind mcu <工具实际返回的job-id或agent-id>
node QUEUE PLAN generated mcu <本任务结果文件路径>
node QUEUE PLAN verified mcu <集成检查证据文件路径>
node QUEUE PLAN blocked mcu <具体失败原因>
node QUEUE PLAN retry mcu <局部修复原因>
node QUEUE PLAN invalidate mcu <接口变化原因>
```

脚本不创建 agent、不限制宿主全局并发、不执行电路检查；主 agent 是计划的唯一写入者，串行执行状态更新，不同时运行两个队列命令。`ready` 是当前空闲槽位内可派发任务，不是已经创建的 agent。先 start 预占，再调用本会话实际可见的子 agent 工具，成功后立即 bind 工具返回的真实 ID；调用失败时 blocked 释放槽位并记录错误，不能留下假 running。收到结果或失败立即回填状态并补派下一个任务，不必等待整批中最慢者。进入集成前核对实际委派任务都有 runtimeId 和返回结果；sequential-local 单独说明，不能用该核对冒充自动强制校验。

先检查当前工具定义，不照抄另一版本的参数。常见 `subagent` 的 `description/prompt/run_in_background:true` 可启动后台任务：one-shot 返回 job id，使用可见的 `job_output` 获取结果；continuable 返回 agent id，按完成通知收集，可通过可见的 `send_message` 复用原 agent 修复。其他宿主使用本会话实际提供的创建、等待和续接工具。消息送达不代表完成，job id 不冒充 agent id。后台能力不可用时先检查同步子 agent，确无可用委派方式才回退本地顺序执行；不自行调用私有运行时或改宿主配置。

子任务只接收自己的需求摘要、文件归属、相关 parts/位号/nets、ports、布局、必要画法说明/脚本/图片路径，以及 [模块脚本约定](modular-scripts.md)。不用完整历史或整个参考库；相关画法首次实际读取说明、代码和图片，不能把给出图片路径称为已看图。子 agent 不再分派子任务、不重做选型、不发布、不生成正式预览。遇到共享表缺项先返回具体请求，主 agent 更新契约后再继续。

任务提示可用：

```text
生成 <id>，只写 <files绝对路径>。读取 <本模块方案章节及共享数据路径>。
采用给定 references/ports/layout；模块内部用局部坐标和真实 pin。
相邻外围用短正交导线直接连接，标签用于边界，不把器件分成标签小岛。
导出 place({region,parts,references,nets,bounds})，返回 ports/bounds/localConnections/connect。
不得保存独立工程，不改共享文件/主入口，不启动其他 agent。
返回简短结果：修改文件、端口契约差异、关键局部连接、已做检查及未决问题；不重复整份代码。
```

## 集成和定向返修

主入口读取稳定的共享表，按固定模块顺序执行所有 place → layoutReport → 所有 connect → 跨区连接 → localConnectionsReport → 电源处理/保存，参考 [可运行入口](../assets/modular-design/design.mjs)。局部报告只检查导线几何，仍需按连接计划核对最终原生网表的应同网/应隔离关系。子 agent 编码成功或静态语法通过不能称为原理图通过。

首批有可集成结果时即可审查代码，整体候选等所有需要的模块生成完成后集中构建/渲染，避免每个子任务都渲染整图。按区域分配检查，记录版本、问题、实际查看的图片及结论；整图与跨模块网络由主 agent 验收。最终候选完整检查后才发布。

模块内连线或需要重新布局的修复：retry 本任务，仅发送问题清单、实际预览证据和验收条件，优先复用原 agent（宿主支持时）；不支持续接则新派该任务，不重启所有任务。主 agent 直接处理共享接口、跨模块连接及单处坐标/文字小修，不能因集成失败就接管所有模块持续串行重写。同一模块同一时刻只有一个写入者；主 agent 接管前确认子任务已结束或已停止。接口/位号/电压域/边界网络变化：先停止受影响写入，invalidate 会递归重置 dependsOn/usesInterfaces 消费者并解除接口冻结；主 agent 更新共享数据和方案、重新冻结后再派发，只重检受影响的跨区网络。其他已验证模块沿用结论，下一次仍由统一入口重新生成整图，不能称为增量 KiCad 文件构建。

连续两次修复同一问题未改善时按 [减少返工](build-convergence.md) 定位原因；任务失败有明确原因后再 retry，不自动无限重派。保存 startedAt/finishedAt 和返回 runtimeId 用于后续分析，但这些是任务墙钟时间，不代表模型推理时长。
