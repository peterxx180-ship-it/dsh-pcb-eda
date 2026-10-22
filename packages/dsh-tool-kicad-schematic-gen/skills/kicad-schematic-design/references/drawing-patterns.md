# 局部电路画法

绘制局部单元前先按 [局部连线与验收](local-circuit-layout.md) 区分直接连接与边界；不得跳过对应画法，仅凭通用 lead() 给全部引脚贴标签。

新增 LED、按键、去耦支路或安排信号标签时，按下表选择已确认拓扑对应的范例。本次设计首次采用某种画法时读取其说明、代码和对应图片各一次；同类复用结论，不加载全部范例或每轮重复读图。复用模块已有清楚布局时保留原图。

| 分类 | 画法 | 适用条件 | 说明与参考代码 | 效果 |
| --- | --- | --- | --- | --- |
| 电源 | 去耦电容组 | 已确定同一电源域各电容并联接地 | [电容组](drawing-patterns/decoupling-bank.md) · [代码](../assets/drawing-patterns/circuits/decoupling-bank.mjs) | [图片](../assets/drawing-patterns/images/decoupling-bank.png) |
| 电源 | 三脚固定输出 LDO | 真实 VIN/VOUT 对侧、GND 向下，无 EN/TAB | [说明](drawing-patterns/ldo-fixed-3pin.md) · [代码](../assets/drawing-patterns/circuits/ldo-fixed-3pin.mjs) | [图片](../assets/drawing-patterns/images/ldo-fixed-3pin.png) |
| 接口 | USB-C 受电 CC 下拉 | 已放置真实连接器，两个 CC 在同侧、分别下拉 | [说明](drawing-patterns/usb-cc-pulldowns.md) · [代码](../assets/drawing-patterns/circuits/usb-cc-pulldowns.mjs) | [图片](../assets/drawing-patterns/images/usb-cc-pulldowns.png) |
| 电源 | LDO 与输入/输出电容 | 已确认固定输出、EN 接 VIN，左右各两个电容 | [LDO](drawing-patterns/ldo-fixed-on.md) · [代码](../assets/drawing-patterns/circuits/ldo-fixed-on.mjs) | [图片](../assets/drawing-patterns/images/ldo-fixed-on.png) |
| 电源 | 直流电源入口与保护 | 先确认对应拓扑、引脚与设计条件 | [说明](drawing-patterns/power-entry.md) · [代码](../assets/drawing-patterns/circuits/power-entry.mjs) | [图片](../assets/drawing-patterns/images/power-entry.png) |
| 电源 | 芯片供电脚旁的去耦 | 已确认对应接法及实际引脚 | [说明](drawing-patterns/chip-decoupling.md) · [代码](../assets/drawing-patterns/circuits/chip-decoupling.mjs) | [图片](../assets/drawing-patterns/images/chip-decoupling.png) |
| 电源 | 异步 BUCK 降压 | 已确认内部开关、外部二极管及反馈分压拓扑 | [说明](drawing-patterns/buck-asynchronous.md) · [代码](../assets/drawing-patterns/circuits/buck-asynchronous.mjs) | [图片](../assets/drawing-patterns/images/buck-asynchronous.png) |
| 电源 | 异步 BOOST 升压 | 已确认内部开关、外部二极管及反馈分压拓扑 | [说明](drawing-patterns/boost-asynchronous.md) · [代码](../assets/drawing-patterns/circuits/boost-asynchronous.mjs) | [图片](../assets/drawing-patterns/images/boost-asynchronous.png) |
| 指示/控制 | 电源指示 LED | 已确定电源经限流电阻、LED 接地 | [LED](drawing-patterns/led-power-indicator.md) · [代码](../assets/drawing-patterns/circuits/led-power-indicator.mjs) | [图片](../assets/drawing-patterns/images/led-power-indicator.png) |
| 指示/控制 | 上拉按键 | 已确定上拉、按下接地的有效低输入 | [按键](drawing-patterns/pullup-button.md) · [代码](../assets/drawing-patterns/circuits/pullup-button.mjs) | [图片](../assets/drawing-patterns/images/pullup-button.png) |
| 指示/控制 | 复位/使能 RC 与启动支路 | 按已确认接法区分带电容复位与普通 BOOT | [说明](drawing-patterns/reset-enable.md) · [代码](../assets/drawing-patterns/circuits/reset-rc.mjs) | [图片](../assets/drawing-patterns/images/reset-rc.png) |
| 驱动 | NMOS／NPN 低边开关 | 先确认对应拓扑、引脚与设计条件 | [说明](drawing-patterns/low-side-switch.md) · [代码](../assets/drawing-patterns/circuits/low-side-switch.mjs) | [图片](../assets/drawing-patterns/images/nmos-low-side.png) |
| 接口 | I²C 上拉 | 先确认对应拓扑、引脚与设计条件 | [说明](drawing-patterns/i2c-pullups.md) · [代码](../assets/drawing-patterns/circuits/i2c-pullups.mjs) | [图片](../assets/drawing-patterns/images/i2c-pullups.png) |
| 接口 | 连接器与串联电阻 | 已确认对应接法及实际引脚 | [说明](drawing-patterns/connector-series.md) · [代码](../assets/drawing-patterns/circuits/connector-series.mjs) | [图片](../assets/drawing-patterns/images/connector-series.png) |
| 接口保护 | 接口单线 TVS 保护 | 先确认对应拓扑、引脚与设计条件 | [说明](drawing-patterns/interface-tvs.md) · [代码](../assets/drawing-patterns/circuits/interface-tvs.mjs) | [图片](../assets/drawing-patterns/images/interface-tvs.png) |
| 模拟采样 | 分压与 ADC 输入 | 已确认对应接法及实际引脚 | [说明](drawing-patterns/adc-divider.md) · [代码](../assets/drawing-patterns/circuits/adc-divider.mjs) | [图片](../assets/drawing-patterns/images/adc-divider.png) |
| 时钟 | 晶振与负载电容 | 先确认对应拓扑、引脚与设计条件 | [说明](drawing-patterns/crystal-load.md) · [代码](../assets/drawing-patterns/circuits/crystal-load.mjs) | [图片](../assets/drawing-patterns/images/crystal-load.png) |

左右/上下信号标签：[说明与短代码](drawing-patterns/label-alignment.md)。视觉目标使用用户提供的 [左右图](../assets/drawing-patterns/images/reference-label-sides.png) 和 [上下图](../assets/drawing-patterns/images/reference-label-vertical.png)；对应实现效果见 [左右生成图](../assets/drawing-patterns/images/label-sides.png)、[上下生成图](../assets/drawing-patterns/images/label-vertical.png)。同侧按组调用 attachPinLabels，不采用随机长短引线。

所有画法的新增器件使用 region.snap 规划位置，格点规则与非标准符号处理见 [电气格点](electrical-grid.md)。保存后查看 grid 报告；引脚不能单独吸附。

先按 [通用绘图规则](drawing-rules.md) 选方向与网络表达。竖向两端/横向串联范例已使用 symbolOrientation；连接器应按所属输入/输出侧选择 facing。示例维护图中的全符号电源表达不限制项目保留局部电源标签。

## 脚本组织

实现按 [脚本分类与代码约定](script-layout.md) 分为 circuits、shared、maintenance、images。正常设计读取选定画法及必要依赖，不读取整套维护夹具。

## 调用约定

这些是可复用的 ESM 范例，不是新工具或 builder 公共 API。直接 import 所选 circuits 文件，或复制时保留 circuits/ 与 shared/ 的相对目录及 imports；从项目功能模块中调用 place。旧根目录脚本只作兼容转发。

```js
const led = place({ region, at: [10, 12], parts,
  references: { resistor: 'R7', led: 'D1' },
  nets: { supply: '+3V3', ground: 'GND' } });
// 所有单元放置完成后，由主入口统一调用。
led.connect();
```

`parts` 使用实际导入器件的 `{libraryPath,libId,footprint,value,angle,pins}`；footprint 对应导入返回的 footprintId。pins 是经核实、在所选 angle 下成立的角色映射，具体见单元说明。代码使用真实 pin 坐标，并检查竖向排列，不支持的符号方向直接报错；按真实模型调整 angle/位置，不能为套画法互换物理引脚。示例自带的本地符号仅为可复现演示，不替代项目器件搜索、导入与封装交付。

编号由主入口分配。at 是 region 内的局部内容原点，需避开标题。返回 `ports`（reference/pin）、`reservedBounds`（局部预留范围）、`connect()`；预留范围不是测量结果，长型号或不同尺寸符号需增大间距与区域。芯片去耦与连接器串阻先接收已放置实例，不额外放置一次；其参数见各自说明。单元不创建框或保存文件；同一单元 connect 只调用一次。

供电和地先用网络标签交给主入口，再按 mixed 电源策略选择性保留标签或转换符号。内部优先短直接连线，跨单元按实际可读性选导线或标签。避免直接照抄范例中的电阻值、电容值及网络名；LED 驱动方式、复位/启动配置、LDO 使能与稳定性条件需另行确认，特定画法不代表通用电气模板。LDO 优先把输入电容画在 VIN 旁、输出电容画在 VOUT 旁，用母线直接连接；通用去耦组不替代所属器件的外围布局。

## 布局与检查

先在功能模块内组合局部单元，再安排整页；不同单元留出属性和标签空间，不给每个小支路套框。当前 region 仍需预先规划 origin/size，根据 reservedBounds 和真实预览调整，不具备自动装箱能力。直接相接的分支显式标 junction，保持水平文字、统一属性位置和正交线段。器件右侧位号与数值默认左对齐并靠近符号，文字起点保持同列；根据真实符号外形保留净空，长文字向外展开，不按固定10 mm中心偏移推远所有属性。器件旋转后，位号与数值仍水平可读：横放电阻/保险丝优先把文字放在上方，竖放 TVS 的文字放右侧，禁止文字压线或倒置。上下信号网络标签的竖排属于另一种布局，不据此旋转器件属性。

集中修正明确遮挡、越框和无法辨认的问题；轻微不对称不是无限重建的理由。预览只说明表达效果，不代表电气或 PCB 验证。若符号尺寸/拓扑明显不匹配，保留相同可读性原则并定制绘图，不强套范例。

维护参考图时设置运行时提供的 KICAD_SYMBOL_DIR / KICAD_CLI_PATH，先运行 [generate.mjs](../assets/drawing-patterns/maintenance/generate.mjs) 生成唯一输出目录，再运行 [render.mjs](../assets/drawing-patterns/maintenance/render.mjs) 将对应代码的实际图纸导出为 PNG：

```text
node <assets>/drawing-patterns/maintenance/generate.mjs <唯一输出目录>
node <assets>/drawing-patterns/maintenance/render.mjs <唯一输出目录> <assets>/drawing-patterns/images
```

这两个脚本仅供维护参考资源；正常设计继续用现有预览工具，不复制维护渲染器。共享初始化只在维护脚本中，不复制到每个单元。
