# 晶振与负载电容

默认采用紧凑排版：两个电容列间距 27.94 mm，晶体主线至电容中心 11.43 mm；这是示例布局尺寸，不是电气或 PCB 距离要求。保留属性空间，长型号或大符号按实际预览扩展，避免用长导线撑大功能框。

两端无源晶体水平居中，两个负载电容分别在其左右节点下方，地线位于底部。两条振荡网络保留各自名称，不与系统时钟输出混用。

仅覆盖已确认需要两个外部负载电容的两端无源晶体。四脚有源振荡器、内部已集成负载的器件不套用。频率、负载电容、寄生、起振条件由选定芯片与晶体决定；本图不替代 PCB 靠近与回流要求。

调用 `crystal-load.mjs` 的 `place({region,at,parts,references,nets})`，主入口统一 connect。parts.crystal.pins={left,right}；leftCapacitor/rightCapacitor.pins={top,bottom}；references 同名；nets={left,right,ground}。

[代码](../../assets/drawing-patterns/circuits/crystal-load.mjs) · [参考图 1](../../assets/drawing-patterns/images/crystal-load.png)

代码使用实际 pin 坐标并核对基本方向。复制时保留 circuits/ 与 shared/ 的相对结构，包含所选脚本实际导入的辅助文件。位号由项目分配，型号、取值与封装来自实际选型；示例图中的占位名称不是可采购型号或推荐参数。reservedBounds 为预留范围，长文字/不同符号需调整坐标、间距与外框，并查看真实局部预览。
