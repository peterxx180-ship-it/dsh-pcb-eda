# 接口单线 TVS 保护

外部信号在左、内部电路在右，TVS 从信号主线向下分支接地；参考图左端表示接口侧，器件靠近接口一侧组织。信号主线连续，分支显式标连接点。

仅覆盖两端对地钳位器件。单向器件须核实极性；低电容阵列、带电源钳位脚及差分器件应按其引脚结构另画。额定工作电压、钳位能力、电容和 PCB 回流不能从画法推定。

调用 `interface-tvs.mjs` 的 `place({region,at,parts,references,nets})`，主入口统一 connect。parts.tvs.pins={signal,ground}；references.tvs；nets={signal,ground}。

[代码](../../assets/drawing-patterns/circuits/interface-tvs.mjs) · [参考图 1](../../assets/drawing-patterns/images/interface-tvs.png)

代码使用实际 pin 坐标并核对基本方向。复制时保留 circuits/ 与 shared/ 的相对结构，包含所选脚本实际导入的辅助文件。位号由项目分配，型号、取值与封装来自实际选型；示例图中的占位名称不是可采购型号或推荐参数。reservedBounds 为预留范围，长文字/不同符号需调整坐标、间距与外框，并查看真实局部预览。
