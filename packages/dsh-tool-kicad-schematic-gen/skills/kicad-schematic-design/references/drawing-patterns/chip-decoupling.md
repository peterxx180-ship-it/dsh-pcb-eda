# 芯片供电脚旁的去耦

先放芯片，再读取指定供电脚和地脚位置；电容在芯片左侧，与真实供电/地脚通过短母线直接连接。高频去耦在内侧、储能电容在外侧；这是原理图归属表达，不代表 PCB 距离。

本例只覆盖一组已确认同域供电，要求所选电源脚在上、地脚在下且同列。其他朝向、多个电压域和专用模拟供电按实际器件另行布局；不能把所有电源脚合并。电容数量、容量、耐压和实际 PCB 放置由芯片要求决定。

调用 `chip-decoupling.mjs` 的 `place({region,parts,references,nets})`，返回 ports、reservedBounds 和 connect，由主入口统一执行 connect。parts.chip.pins:{supply,ground}，bulkCapacitor/highFrequencyCapacitor.pins:{top,bottom}；references:{chip,bulkCapacitor,highFrequencyCapacitor}；nets:{supply,ground}。

本函数不重复放置芯片/连接器，调用前实例必须已存在于同一 region；所有坐标由 region.pin 返回的局部坐标计算。维护预览中的符号只演示形状与接口，不作为项目选型；芯片图展示的是电源单元，正式工程仍需处理其他单元。

[代码](../../assets/drawing-patterns/circuits/chip-decoupling.mjs) · [参考图](../../assets/drawing-patterns/images/chip-decoupling.png)

复制代码时保留 circuits/ 与 shared/ 的相对结构及实际依赖。器件及引脚映射来自实际选型，位号由主入口分配；示例值为占位文字。采用1.27 mm主网格，真实引脚不单独吸附；检查 save.grid。reservedBounds 仅是预留范围，长型号、不同符号尺寸和方向需适配并查看局部预览。
