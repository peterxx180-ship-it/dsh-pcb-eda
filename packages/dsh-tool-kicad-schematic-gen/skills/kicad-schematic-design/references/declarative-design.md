# 器件连接声明与多页工程

在已核实脚号、网络和器件资料后，可使用 builder 的 `ConnectedSchematic`，减少重复的放置、引线和标签代码。它复用现有 `Schematic`，不负责选型、电气设计、避障或验证；旧接口继续可用。

## 单页声明

此接口的字符串网络会生成独立标签，适合电路边界，不是默认布局器。局部 LDO/去耦/CC/复位/驱动等引脚使用 manual，并用 circuits 的完整画法或明确 wire 连接；不把所有电阻、电容和芯片脚都声明为字符串网络。放置后按 [局部连线与验收](local-circuit-layout.md) 区分视觉连接与电气网络。下面示例仅演示边界接口语法，不能作为外围电路模板。


通过 assets/runtime.mjs 的具名导出获取 `ConnectedSchematic`、`SchematicProject`（安装路径和模板路径仍按运行时设置）。下面的 `part` 应来自实际导入结果，包含 `libraryPath`、`libId`、`footprint`；`templateDir` 为本技能 templates 目录。

```js
const sheet = new ConnectedSchematic({
  projectName: 'sensor', title: 'Sensor interface', paper: 'A4', templateDir,
});
sheet.addComponent({
  ...part, reference: 'U1', key: 'sensor.main',
  at: sheet.snap([50, 50]), value: selectedMpn,
  dnp: false, properties: {MPN: selectedMpn, Notes: 'Verified interface'},
  connections: {
    '1': 'SENSOR_TX',
    '2': {net: 'SENSOR_RX', length: 7.62},
    '3': null,
    '4': {manual: true},
  },
});
// 这里只是四引脚接口示意；必须按实际器件列出当前单元所有引脚。
// manual 引脚使用现有 wire/label/hierarchicalLabel 完成真实连接。
const servicePin = sheet.pin('U1', '4');
const serviceEnd = [servicePin[0] - 7.62, servicePin[1]]; // 按实际方向选通道
sheet.wire(servicePin, serviceEnd);
sheet.label('SERVICE', serviceEnd);
sheet.save(candidateDirectory);
```

所有实际引脚必须出现在 `connections` 中。字符串或 `{net,direction?,length?}` 表示本页局部标签；`null` 明确生成 NC；`{manual:true}` 交给现有布线接口。遗漏、未知脚号、歧义引脚和无效引线参数在添加器件前拒绝。不要用默认 NC 隐藏未知接法。多单元/重叠脚存在歧义时使用低层接口明确处理。

引线方向默认由真实符号引脚角度、实例旋转和镜像计算，默认长度 5.08 mm，也可明确指定 left/right/up/down。不会避障或推断电源；局部反馈、分压、去耦等应保留直接连线，使用 manual 或旧 addSymbol/画法模块。连接声明使用图纸全局毫米坐标；现有 region 的局部接口不变，不混用坐标。

`connect()` 在全部放置后实现待生成的引线、局部标签和 NC；重复调用不重复生成。render/save 自动调用 connect。修改位置通过修改声明后重新构建候选完成，不对已接线对象偷偷移动。`connectionPlan()` 返回独立副本，仅为设计意图，不能宣称已通过实际网表验证。

## 实例属性与身份

原有 `Schematic.addSymbol` 同样支持 `dnp`、`properties` 和可选 `key`。自定义字段为隐藏字符串属性，支持 MPN、Notes、Role 等；Reference/Value/Footprint/Datasheet 使用专用字段，不允许通过 properties 覆盖。未传 dnp 时保持原有默认不 DNP。

同一 projectName 下，相同 key 保持器件实例 UUID，移动或更改位号不改变该 ID；key 必须非空且不重复。未传 key 时保持随机 UUID。根图、导线、框以及层次组装器仍可能生成新 UUID，不承诺整个文件稳定或层次重组后保留这些实例 ID。

## 多页入口

```js
const project = new SchematicProject({
  projectName: 'controller', title: 'Controller', paper: 'A3', templateDir,
});
const power = project.sheet('power', {
  title: 'Power', connections: {SUPPLY: '+3V3'},
});
const mcu = project.sheet('mcu', {
  title: 'MCU', connections: {VDD: '+3V3'},
});
// 各页使用 addComponent 或原有 API 绘制实际电路。
// 在真实接入电路的位置添加端口，例如：
power.hierarchicalLabel('SUPPLY', power.pin('U1', '5'));
mcu.hierarchicalLabel('VDD', mcu.pin('U1', '2'));
const result = project.save(freshCandidateDirectory);
```

sheet 的端口 connections 为“层次端口名 -> 根图网络名”。所有实际层次标签均需映射，或列入 unconnectedPorts；不自动把同名局部标签扩展为跨页网络。端口必须接入真实电路，不能只在空白处添加标签。底层复用现有层次组装器，当前支持 1–9 张子页，并统一重编号；使用 `result.sheets[].references` 获取最终位号，不能继续用子页构建时的位号编写最终 BOM/说明。

save 写出根图、子页、工程配置、项目符号库、sym-lib-table 和带最终位号的 connection-plan.json；目录必须不存在，预检失败不创建输出目录。连接计划标为 intent-only，不是验证报告。封装/3D/外部库仍按现有导入流程准备和注册，复制工程时同步所需 libraries 与 fp-lib-table；此入口不自动下载、复制或核实这些资源。交付预览和实际电路检查仍按主技能执行。
