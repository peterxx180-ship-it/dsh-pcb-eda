# USB-C 受电 CC 下拉

已确认是 USB-C 受电端且 CC1/CC2 分别下拉时使用；电阻规格来自方案。CC 引脚与各自电阻直接连接，电阻下端共地，不靠两组 CC 标签跳接。数据线、VBUS、SBU、屏蔽和其他触点仍须独立落实。

[代码](../../assets/drawing-patterns/circuits/usb-cc-pulldowns.mjs) · [效果](../../assets/drawing-patterns/images/usb-cc-pulldowns.png)。图中的两脚 CC_ROLES_ONLY 只用于维护展示，并非完整 USB-C 器件，不可作为正式连接器。

在已有 region 内放置真实 USB 口后，调用 `place({region,at,parts,references,nets,connector,direction})`。connector={reference,pins:{cc1,cc2}}；parts.resistor.pins={top,bottom}，references={cc1,cc2}，nets={ground}。direction 选实际 CC 所在的 left/right，at 为外侧较远电阻中心，必须在两个 CC 引脚下方；若实际符号的 CC 分处不同侧则定制局部连线，不强套该画法。

返回 connect、reservedBounds、localConnections；主入口统一调用 connect 后核验这两对局部通路，见 [局部连线与验收](../local-circuit-layout.md)。复制时保留 circuits/shared 相对结构。
