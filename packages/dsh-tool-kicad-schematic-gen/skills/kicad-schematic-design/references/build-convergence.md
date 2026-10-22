# 减少生成返工

首次编写多功能框、混合复用或遇到反复布局修正时读取本页。目标是每轮修复有依据；不通过忽略电气错误或遮挡来减少轮数。

## 首次构建前

- 主入口导入来源后，保存返回的 references 映射与角色编号表。模块共用该表，文档和 BOM 按同一映射更新；不要到交付时逐处猜测位号。
- 先放全部器件、注册来源 autoBounds 框和新增 region，再调用 `sch.layoutReport()`。它解析全部框，报告 FRAME_OVERLAP / FRAME_OUTSIDE_PAGE 和双方范围，不要求已经转换电源标签。非刻意嵌套的框相交时先调整布局表，再布线；不额外写 probe.mjs 或重复构建只为打印坐标。
- 自动框取自真实对象（含文字），新增区域留出标题、说明和属性空间；layoutReport 只检查框与页面，不检查框内所有文字。intentional 嵌套可保留并说明，不为清零提示任意移动电路。
- 区域内部的 addSymbol、pin、wire、label、referenceAt/valueAt 统一使用局部毫米坐标。全局 pinCatalog 只供确认方向/脚号，不把其中全局 at 抄成局部常量。`region.at()` 只在跨区主入口需要全局坐标时使用。
- 折点从当前 `region.pin()` 推导，例如 `const corner = [target[0], source[1]]`。二维点偏移复用 drawing-patterns/shared/geometry.mjs 的 `shift(point,dx,dy)`，不要传 `point[0]`，也不要另写不校验输入的替代函数。
- 复用匹配的 circuits 和 shared 辅助；器件方向用真实引脚角色确定。手写 referenceAt/valueAt 时同时设置 fieldAngle 和 fieldJustify；需在预览中水平显示的文字按已有范例处理旋转（范例使用 `fieldAngle: angle % 180`），不能只挪文字锚点。
- 电源母线入口使用电源符号，密集接口和局部引脚可保留精确同名标签。先选择 mixed 的 keepLabels，再规划其余符号；不要生成后把所有标签转换成符号再逐个回退。

## 每轮检查与修改

使用 run-design.mjs 的 summary.diagnostics：frames 是框/页面问题，power 是保守的电源碰撞提示，unresolvedPower 是仍无无冲突放置方案的位置。每组最多显示六项，完整记录在报告中；只有需要时读取剩余部分。

先列本轮问题（模块、器件、原因、拟改字段、验收结果），再集中修改。按“运行错误 → 坐标/框范围 → 器件与电源表达 → 文字可读性”处理；改变角色引脚、极性或网络时同步连接计划。仅调整布局不重查选型、手册或整份方案。

电源警告的 otherReference/otherName 与双方 bounds 可直接定位器件。measurement=conservative-object-bounds 表示器件本体、引脚文字和属性的合并估计，不能仅凭矩形相交断言真实遮挡，也不能因此忽略警告。查看受影响局部，区分本体、属性文字和空白包围范围。同一问题连续两次没有改善时，先查实际器件方向、字段角度、文字范围和局部/全局坐标，停止左右搬移试错；根据原因修复后继续。

每轮汇总相关区域后集中修改，不必重复读取所有区域。通过后检查整图。最后稳定版本用 analyze_kicad_module 复用一次 summary，并按连接计划查询关键电源、复位、启动及接口网络；结果未覆盖的范围明确列出，预览和格点检查不充当电气验证。纯文字坐标修正不触发重新选型或全套分析；实际改动网络则重新核验受影响网络。

## 发布与清理

发布前确认入口导入的 modules/、shared/ 和来源工作副本仍存在，保持可重建。位号/BOM/文档按最终映射集中同步，只读修改章节。

清理限定为本轮明确列出的 `.candidate/<run-id>` 和临时预览/报告；逐个解析绝对路径，确认位于设计的临时目录内再删除。不按整个设计目录递归匹配扩展名；scripts、modules、shared、sources、work 中被入口引用的修订原理图和本地库均为源文件，不能作为临时文件删除。清理不能改变生成脚本和正式工程。

新增功能框不能只以外框和文字合格验收；先按 [局部连线](local-circuit-layout.md) 检查外围归属和直接通路，再批量处理属性。长来源说明移入方案后才收紧 autoBounds，不为冗余文字放大纸张。
