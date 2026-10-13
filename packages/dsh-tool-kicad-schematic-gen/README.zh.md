# @local/dsh-tool-kicad-schematic-gen

将四个原理图插件统一安装为一个插件，内部继续分为 components、modules、schematic 与设计技能。

| 模块 | 工具 |
| --- | --- |
| 器件模型与文档 | get_kicad_component_models、get_kicad_datasheet、import_kicad_symbol、import_kicad_component |
| 电路模块搜索下载 | eda_module_rag_search、eda_module_category_search、eda_module_precise_search、download_eda_module_schematic |
| 原理图工具 | get_kicad_module_ports、render_kicad_module_preview、create_kicad_hierarchy、edit_kicad_flat_schematic |

同时注册 kicad-schematic-design 技能。元件搜索由KiCad 内置的 @huaqiu/dsh-tool-part-search 提供，调用 search_hqsch_parts。该搜索插件随 KiCad 提供，可在插件管理器中启用；原理图插件本身不注册它的四个查询工具。两者间将搜索结果的 manufacturer.id 映射为 manufacturer_id，mpn 保持不变；旧 mfgId 参数继续兼容。

配置分为 components、modules.search、modules.download、schematic，使用原配置的默认限额。flatTemplateDir 默认指向本包技能模板。Node 22.19+，KiCad 10 CLI 路径可通过 schematic.kicadCliPath 配置。

模块下载按调用时的 HQ Edge 宿主与当前项目校验；没有 HQ Edge 时只让该下载调用失败，其它工具仍注册。符号导入继续使用会话文件系统及沙箱策略。工具不是自动电气验证；模型摘要不检查引脚焊盘匹配，手册文字可能被截断，构建库的放置和布线由设计脚本显式指定。

公开脚本入口是 lib/builder.js 或包的 ./builder 导出。设计技能、资源与模板位于 skills/kicad-schematic-design/。

在工作区根目录执行 pnpm --filter @local/dsh-tool-kicad-schematic-gen build、typecheck 或 test。使用配套 DSH CLI 注册本目录，替换旧四个插件，并重新打开 KiCad AI 助手。历史备份和旧脚本兼容见 [合并说明](../../docs/SCHEMATIC-MERGE.md)。

成套器件导入：`import_kicad_component({manufacturer_id, mpn, projectDir})` 同时下载符号与封装，登记两个项目库表，返回 `footprintId`。放置时传 `footprint: imported.footprintId`。两种实际模型可用且引脚/焊盘编号集合匹配才成功；仍需手册核对尺寸与功能。旧 `mfgId` 参数兼容保留。

电源符号：在构建选项中声明实际共享网络 `requiredPowerSymbols`。`powerLabelCatalog(nets)` 返回本次标签 UUID、网络、坐标和导入模块名，按这些条件定位后生成 placements，不引用上一轮 UUID。`checkPowerSymbols()` 与 render/save 检查声明网络的标准符号和残留标签；未完成时拒绝保存。遮挡提示仍需局部预览确认，详见 [电源符号交付](skills/kicad-schematic-design/references/power-symbols.md)。

`planPowerPlacements({libraryPath, nets})` 在转换前批量规划方向、水平文字与短引出线，返回 placements 和剩余问题诊断；局部预览仍需确认。

含引脚的独立公共单元符号（如 SW-PTB-2_0_1）在项目副本中自动规范为单元 1，保留引脚与图形。模型摘要和导入结果通过 builderCompatibility.normalization=common_only_to_unit_1 报告；继承、空单元、异常命名及仅替代图形的符号不做自动规范。不支持的导入错误包含器件、符号、单元名称及源文件 URL。

最终概览卡片：正式预览传入 `delivery: true` 和包含全部本地库的 `projectDir`，显示页面切换、缩放、ZIP 下载。复用已有 PNG，不重新生成电路，无重新生成/详情按钮。需 KiCad Harness 的 webServer 与前端加载支持；不可用时仍返回本地预览路径。快照保存在插件 `.overview-cache/`，重启后可读取；移除该目录后历史卡片下载将失效。ZIP 为工程目录内相关设计文件与库的快照，不收集脚本、预览或外部库。
