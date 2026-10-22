# I²C 上拉

SCL、SDA 分两条水平主线，两个上拉电阻竖放并对齐，共用上方已确认的上拉电源。SDA 电阻支路穿过 SCL 线但不加连接点；只在所属信号节点加 junction。

仅适用同一已确认电压域的开漏总线；不表示具备电平转换。上拉阻值、总线电容、速率和现有重复上拉由设计确定。

调用 `i2c-pullups.mjs` 的 `place({region,at,parts,references,nets})`，主入口统一 connect。parts.sclResistor/sdaResistor.pins={top,bottom}；references 同名；nets={supply,scl,sda}。

[代码](../../assets/drawing-patterns/circuits/i2c-pullups.mjs) · [参考图 1](../../assets/drawing-patterns/images/i2c-pullups.png)

代码使用实际 pin 坐标并核对基本方向。复制时保留 circuits/ 与 shared/ 的相对结构，包含所选脚本实际导入的辅助文件。位号由项目分配，型号、取值与封装来自实际选型；示例图中的占位名称不是可采购型号或推荐参数。reservedBounds 为预留范围，长文字/不同符号需调整坐标、间距与外框，并查看真实局部预览。
