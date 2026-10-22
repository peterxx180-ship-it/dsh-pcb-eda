# 参考脚本的分类与读法

按 [画法索引](drawing-patterns.md) 选择本次所需电路，不扫描整个目录。

```text
assets/drawing-patterns/
├─ circuits/       可复用画法：放置器件，返回接点与 connect
├─ shared/         共用几何、属性位置、方向检查与 DC/DC 反馈布线
├─ maintenance/    生成参考工程、示例器件夹具、导出参考图
└─ images/         实际生成的预览及用户提供的视觉参考
```

根目录旧 `.mjs` 只作兼容转发，历史图片保留原链接；新引用统一使用上述分类路径，不同时读取兼容入口和实现。项目脚本仍按 [模块脚本组织](modular-scripts.md) 划分功能框，不为每个参考单元新建工程。

## 正常项目读取范围

1. 读取所选画法的短说明，再读取对应 `circuits/*.mjs`。
2. 理解调用约定即可复用；仅缺少辅助函数语义时读取它实际导入的 `shared` 文件。
3. `maintenance` 的具体型号、占位参数和抽象控制器仅用于维护参考图，不是项目选型或生产模板。正常设计不读取整个夹具生成器。

可从当前插件安装路径直接 import 选定画法；复制到项目时保留目录关系，例如 `scripts/patterns/circuits/adc-divider.mjs` 与 `scripts/patterns/shared/{pattern-ops,geometry}.mjs`。保留源文件顶部的实际 imports，不把辅助文件扁平复制到任意位置。label-alignment 额外依赖技能的 runtime.mjs；复制时应将该 import 改为项目已配置的 runtime 路径。

## 统一代码约定

- 文件顶部用短注释说明画法和适用边界；不重复整份器件手册。
- `place({region,at?,parts,references,nets,...})`：参数使用描述性名字，坐标单位为毫米、相对 region；位号和真实引脚映射来自项目。
- 在 place 阶段选方向、放置并验证几何，返回 `{ports,reservedBounds,connect}`。芯片去耦和连接器串阻接收已放置实例，不再次放置。
- connect 只负责本单元连接、分支点和标签，由主入口在所有器件放置完成后统一执行一次；供电标签可交给主入口按 mixed 策略保留或转换。
- 两空格缩进；同一行不堆多个布线调用，器件声明分开写；注释解释支路目的、真实引脚和坐标限制，不逐行翻译函数名。
- `reservedBounds` 是预留范围，不是精确测量；先保留真实 pin 连接，不能靠吸附端点伪造上网格。

## 维护参考图

修改实现后，在新输出目录生成真实图纸，再渲染到 images，并核对有变化的连接及格点：

```text
node <assets>/drawing-patterns/maintenance/generate.mjs <唯一输出目录>
node <assets>/drawing-patterns/maintenance/render.mjs <唯一输出目录> <assets>/drawing-patterns/images
```

目录分类和注释不应改变电路、器件值或网表。仅重排代码时，比较新旧示例网表，避免把排版整理混成电气修改。
