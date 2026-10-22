# 异步 BOOST 升压

输入经电感进入 SW 节点，二极管阳极接 SW、阴极接输出；内部低边开关控制器放在 SW 下方，输出电容在右侧。输入电容靠输入支路。反馈分压放输出侧，FB 线从下方返回，不与 SW 网络合并。位号、数值保持水平并靠近器件，使用1.27 mm主网格。

仅用于内部低边开关、外部整流二极管、外接反馈分压的正输出升压拓扑。不能当作同步 BOOST、反相或 BUCK-BOOST 接法。参考图控制器是维护脚本生成的四脚示意符号，不是可采购器件，不能导入正式项目替代真实芯片；实际型号须来自项目选型。

[代码](../../assets/drawing-patterns/circuits/boost-asynchronous.mjs) · [参考图](../../assets/drawing-patterns/images/boost-asynchronous.png)。复制时保留 circuits/ 与 shared/ 的相对结构，包含 shared/dcdc-feedback.mjs、pattern-ops.mjs、geometry.mjs。

调用 `place({region,at,parts,references,nets})`，返回 ports.input/output、reservedBounds、connect。parts 与 references 使用以下同名字段：

| 字段 | 真实引脚角色 |
| --- | --- |
| controller | pins: vin / sw / fb / ground |
| inputCapacitor、outputCapacitor | pins: top / bottom |
| inductor | pins: left / right |
| diode | pins: anode / cathode |
| upperResistor、lowerResistor | pins: top / bottom |

nets 为 input/output/ground。位置与方向是有边界的绘图示例：实际符号尺寸、VIN/SW/FB 位置不匹配时需按真实 pin 调整，不能交换脚号套图。其他控制器引脚必须按选定器件补齐，EN、自举、软启动、补偿、频率设置及散热焊盘等不能因简图省略就视为不需要。

器件值是占位说明，不固定电感、电容、二极管或分压参数。输入范围、开关与二极管应力、电感饱和/纹波、电容条件、反馈参考和环路稳定性由具体芯片设计确定；固定输出版本不自动套分压。SW 的短线只是原理图表达，PCB 热回路、反馈采样、接地和散热仍需独立落实。此图和网表检查不代表电源设计已通过验证。
