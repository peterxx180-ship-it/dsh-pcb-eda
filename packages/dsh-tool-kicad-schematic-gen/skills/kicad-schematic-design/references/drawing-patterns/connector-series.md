# 连接器与串联电阻

先放连接器，读取需要处理的信号脚；电阻沿该脚右侧水平排列，内部网络从电阻另一端继续向右引出。电阻位号和值位于上方，不用标签代替这段实际串联关系。

本例只覆盖一个已核实右向、在主网格上的信号脚，不能按接口名称假定所有引脚方向。串阻作用、阻值、放在源端还是接收端及信号完整性需由具体接口决定；图中位置不代替 PCB 端接位置。其他引脚由主模块另行连接，不自动接地或标 NC。

调用 `connector-series.mjs` 的 `place({region,parts,references,nets})`，返回 ports、reservedBounds 和 connect，由主入口统一执行 connect。parts.connector.pins:{signal}、resistor.pins:{left,right}；references:{connector,resistor}；nets:{internal}。

本函数不重复放置芯片/连接器，调用前实例必须已存在于同一 region；所有坐标由 region.pin 返回的局部坐标计算。维护预览中的符号只演示形状与接口，不作为项目选型；芯片图展示的是电源单元，正式工程仍需处理其他单元。

[代码](../../assets/drawing-patterns/circuits/connector-series.mjs) · [参考图](../../assets/drawing-patterns/images/connector-series.png)

复制代码时保留 circuits/ 与 shared/ 的相对结构及实际依赖。器件及引脚映射来自实际选型，位号由主入口分配；示例值为占位文字。采用1.27 mm主网格，真实引脚不单独吸附；检查 save.grid。reservedBounds 仅是预留范围，长型号、不同符号尺寸和方向需适配并查看局部预览。
