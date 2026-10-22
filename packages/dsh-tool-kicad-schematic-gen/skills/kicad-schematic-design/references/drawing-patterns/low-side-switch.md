# NMOS／NPN 低边开关

分别提供 NMOS 与 NPN 生成图。控制从左侧经过串联电阻进入栅极或基极，下拉电阻向下，负载在漏极/集电极上方，源极/发射极接地；属性保持水平。

本例负载为电阻，不是继电器/电机驱动成品方案。感性负载需独立确认续流/钳位；高边、P沟道、PNP 和隔离驱动不适用。MOSFET 的栅极电压与导通能力、NPN 基极驱动、功耗和电流条件需各自计算。

调用 `low-side-switch.mjs` 的 `place({region,at,parts,references,nets,kind})`，主入口统一 connect。显式传 kind:"nmos" 或 "npn"。parts.transistor.pins={control,high,low} 映射实际 G/D/S 或 B/C/E；seriesResistor.pins={left,right}，pulldown/load.pins={top,bottom}；references 同名；nets={control,supply,ground}。

[代码](../../assets/drawing-patterns/circuits/low-side-switch.mjs) · [参考图 1](../../assets/drawing-patterns/images/nmos-low-side.png) · [参考图 2](../../assets/drawing-patterns/images/npn-low-side.png)

代码使用实际 pin 坐标并核对基本方向。复制时保留 circuits/ 与 shared/ 的相对结构，包含所选脚本实际导入的辅助文件。位号由项目分配，型号、取值与封装来自实际选型；示例图中的占位名称不是可采购型号或推荐参数。reservedBounds 为预留范围，长文字/不同符号需调整坐标、间距与外框，并查看真实局部预览。
