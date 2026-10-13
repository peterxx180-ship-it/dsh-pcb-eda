# 模块搜索与适用性判断

准确型号调用 `eda_module_precise_search({keyword})`，功能描述调用 `eda_module_rag_search({query})`，已知分类调用 `eda_module_category_search({category})`。多次搜索采用实质不同的词或分类；有合适候选即可停止，避免下载所有命中。

创建 sources/ 后调用 `download_eda_module_schematic({moduleId,targetDir:<design>/sources})`。保留返回的真实 schematicPath、moduleId 与可选 sourceProjectPath。来源 .source.kicad_pro 仅供参考，正式工程使用本 Skill 的 templates/project.kicad_pro。

对需要的候选读取 `get_kicad_module_ports({schematicPath})` 和 `render_kicad_module_preview({schematicPath,outputDir:<design>/previews})`。按非空 rootImagePath 或 pages[].pngPath 读图，核对 revision、pageIndex、pageSchematicPath 与 manifestPath，不能混用旧图片。端口清单只包含层次标签，连接器、全局标签及普通标签须按需读取实际结构。

以真实电路判断用途、输入输出、工作电压、电平、极性、必需外围和负载能力。数据手册按准确型号查需要的章节；缺失章节、图片 URL 或截断文本不算已核实。看图有歧义时按需 list 符号、引脚和导线，不默认导出 XML 或编写解析器。

记录简短模块表：功能、来源、已确认接口、复用/修改/从零决定、修改内容、待确认条件。层次连接表记录子页端口到根网络；平铺连接表记录模块源网络到最终网络及实际接点。相同名称不自动意味着可接，input/output 类型不作为生成阻断条件。
