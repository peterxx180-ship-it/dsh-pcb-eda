# 通用器件方向与网络表达

所有新增平铺电路先选方向、再放置、最后布线。复用电路已经清楚时保留；不为符合示例而重画或更改电气接法。

## 网络表达

先读取 [局部连线与验收](local-circuit-layout.md)：同一局部单元的邻近器件直接连线，标签服务于完整单元的边界和远距离互连。不得对全部器件套用短线加标签，以网表正确代替布局表达。


- 只用于命名的引线默认沿引脚向外短直引出，标签放线上方；FB、片选、使能等不默认向下或绕远。缺少实际障碍不加折点。
- 连接附近外围时优先直接短线；SW、自举、电感、反馈分压等保留清楚的局部拓扑，不为了少线全部改标签。长绕线先检查器件位置和方向。
- 主要输入/输出电源母线优先用电源符号；侧向 VIN、局部供电引用可用短线加准确网络名。GND 默认朝下。参考 [混合电源表达](power-symbols.md) 使用 powerStyle:'mixed' 和 keepLabels；不强制把每个电源标签转换。
- 这种同名局部标签混用以同一平铺页为范围；层次工程须保留原连接作用域，不能用子页局部标签替换全局电源连接。不能自动合并不同电源域或改名。

## 按功能选方向

| 位置/器件 | 默认意图 |
| --- | --- |
| 左侧输入连接器 | 本次处理的引脚朝右，向电路内部 |
| 右侧输出连接器 | 本次处理的引脚朝左，向电路内部 |
| 串联阻抗 | 两端沿信号主路径排列 |
| 上拉/下拉/对地电容/按键 | 对应端点上下排列 |
| 电源指示 LED | 阳极在上、阴极在下；其他驱动按已确认拓扑 |

不要用固定90°或默认0°代替角色检查。`sch.symbolOrientation` / `region.symbolOrientation` 在放置前读取实际选定单元和镜像的引脚位置/方向，返回0/90/180/270：

```js
const angle = region.symbolOrientation(actualConnector, {
  pins: actualSignalPins, facing: 'right', // 输出侧可用 left
});
region.addSymbol({ ...actualConnector, angle, reference:'J1',
  at:region.snap([20,30]) });
```

```js
const angle = region.symbolOrientation(actualLed, {
  from:actualAnodePin, to:actualCathodePin, direction:'down',
});
```

两端角色用 from/to/direction；接头引脚朝向用 pins/facing。后者依据引脚端点向外的真实方向，不按符号原点或编号猜侧边；所选引脚必须能同时满足方向。零长度引脚不能判断朝向，缺失、歧义或无法旋转满足时显式报错，改用经核实的布局，不交换脚号、不自动镜像。unit、mirror、angle 沿用实际 part 信息，优先保留已经满足的角度。复杂芯片不为省几根线任意旋转。

放置完成后用实际 pin 连线。符号旋转不应带着位号/数值竖排，属性保持水平可读并按符号外形留出净空。对齐、格点和方向检查均不代表电气验证通过。
