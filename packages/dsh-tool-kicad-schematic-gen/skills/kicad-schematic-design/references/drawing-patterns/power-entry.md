# 直流电源入口与保护

输入从左到右依次经过保险丝、串联防反接二极管，再进入后级；TVS 与储能电容在受保护电源轨下方并联到地，支路清楚。左端代表电源入口，连接器可由项目另行加入。

只是一种正直流入口拓扑，包含串联压降，不能当作通用保护方案。保险丝与故障能量、二极管电流/压降/反压、TVS 与后级耐压及电容浪涌需协调；该排列不保证所有浪涌下的保护效果。不适用交流市电、双向电源或理想二极管 MOSFET 方案。

调用 `power-entry.mjs` 的 `place({region,at,parts,references,nets})`，主入口统一 connect。parts.fuse.pins={left,right}，diode.pins={anode,cathode}，tvs.pins={signal,ground}，capacitor.pins={top,bottom}；references 同名；nets={input,output,ground}。

[代码](../../assets/drawing-patterns/circuits/power-entry.mjs) · [参考图 1](../../assets/drawing-patterns/images/power-entry.png)

代码使用实际 pin 坐标并核对基本方向。复制时保留 circuits/ 与 shared/ 的相对结构，包含所选脚本实际导入的辅助文件。位号由项目分配，型号、取值与封装来自实际选型；示例图中的占位名称不是可采购型号或推荐参数。reservedBounds 为预留范围，长文字/不同符号需调整坐标、间距与外框，并查看真实局部预览。
