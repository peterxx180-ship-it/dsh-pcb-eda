# 电气格点与连接

新增电路默认使用 1.27 mm（50 mil）主网格，间距采用其整数倍；器件型号、数值等显示属性可使用更细排版，不作为电气锚点处理。编辑器也选择对应的网格显示/吸附，不能仅靠背景点判断实际连接。

```js
const sch = new Schematic({ projectName, title, paper:'A4', templateDir, gridStep:1.27 });
const region = sch.region({ name:'Control', description:'',
  origin:sch.snap([25,25]), size:[76.2,76.2] });
region.addSymbol({ ...actualPart, reference:'U1', at:region.snap([20,20]) });
// 器件放置后，再从真实引脚出线；不要对 pin 的结果调用 snap。
const p = region.pin('U1', actualPin);
region.wire(p, [p[0] + 5.08, p[1]]);
const result = sch.save(uniqueCandidateDirectory);
// result.grid: step / total / counts / issues / truncated
```

`sch.snap` 返回全局格点坐标；`region.snap` 将局部点转换到全局吸附后再返回局部坐标。仅用于尚未连线的器件放置、功能区原点和独立走线通道规划；不自动改动图纸。runtime / builder 也导出 `snapPoint(point,step=1.27)`，用于已知全局坐标或原点已上网格的相对布局。

保存默认返回只读格点报告，也可提前调用 `sch.gridReport()`。检查器件原点、真实引脚、导线两端、标签、junction 与 no_connect；issues 最多返回60项并提供总数、分类统计、对象UUID、位号/脚号、实际位置及最近格点。最近格点只是诊断建议，不能机械地应用到导线或引脚。gridStep 必须为正有限数；按实际符号需要可显式选择0.635 mm等兼容网格，不为消除警告随意把网格缩小。

处理顺序：先让功能区全局原点及器件放置上格点，再核实符号内部引脚是否兼容，最后依据实际 pin 重建导线与标签。引脚间距不兼容时记录具体对象，调整合法放置偏移、采用经核实的兼容符号，或保留准确连接并说明限制；不私改符号内部图形/引脚。

复用模块使用整个模块的平移，不能分别吸附内部器件与导线；原模块已有偏移无法靠平移消除时保留并报告。同页网格以全局原点为准，局部坐标是整数倍不保证全局上网格。整齐的背景格点不等于网络验证通过，修复后仍需核对有变化的连接。
