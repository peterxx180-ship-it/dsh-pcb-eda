# 分压与 ADC 输入

输入从上方经过上臂电阻，采样节点居中向右引出，下臂电阻向下接地；滤波电容放节点右下方，与下臂并联。两侧属性水平并留白。

本例为已确认需要对地滤波的被动分压，不具备过压钳位或隔离。分压比、误差、输入范围、源阻抗与 ADC 采样建立时间需按实际器件设计；不要照抄阻值或电容值。无需滤波时按相同结构定制，不为套模板新增电容。

调用 `adc-divider.mjs` 的 `place({region,at,parts,references,nets})`，返回 ports、reservedBounds 和 connect，由主入口统一执行 connect。parts.upperResistor/lowerResistor/capacitor 都提供 pins:{top,bottom}；references 使用同名字段；nets:{input,adc,ground}。

[代码](../../assets/drawing-patterns/circuits/adc-divider.mjs) · [参考图](../../assets/drawing-patterns/images/adc-divider.png)

复制代码时保留 circuits/ 与 shared/ 的相对结构及实际依赖。器件及引脚映射来自实际选型，位号由主入口分配；示例值为占位文字。采用1.27 mm主网格，真实引脚不单独吸附；检查 save.grid。reservedBounds 仅是预留范围，长型号、不同符号尺寸和方向需适配并查看局部预览。
