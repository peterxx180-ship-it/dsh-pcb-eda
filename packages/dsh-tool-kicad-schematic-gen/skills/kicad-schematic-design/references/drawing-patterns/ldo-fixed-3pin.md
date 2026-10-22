# 三脚固定输出 LDO

仅限已核实 VIN/VOUT/GND 的三脚固定输出符号。按真实脚号选择方向，要求 VIN 在左、VOUT 在右、GND 向下；有 EN、TAB 或其他布局时选择对应变体，不能为了运行范例省略真实引脚。

输入/输出电容分别放在对应引脚旁，通过直接导线接入母线，底部共地；标签只命名单元边界。

[代码](../../assets/drawing-patterns/circuits/ldo-fixed-3pin.mjs) · [效果](../../assets/drawing-patterns/images/ldo-fixed-3pin.png)。维护图的 LDO_FIXED/C_IN/C_OUT 是占位值，不是型号或容值推荐。

`place({region,at,parts,references,nets})`；parts.ldo.pins 为 vin/vout/gnd，两个 capacitor.pins 为 top/bottom；references 为 ldo/inputCapacitor/outputCapacitor，nets 为 input/output/ground。返回 ports、reservedBounds、localConnections 和 connect。主入口统一编号并合并 localConnections，先全部放置再连接；不把每个电容脚替换成标签。复制时保留 circuits/shared 相对结构。
