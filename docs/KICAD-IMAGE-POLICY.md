# KiCad 图片请求优化与诊断

本次修改作用于已安装的 KiCad 10.0.0 Harness 请求层，目标为
`aihubmix / deepseek-v4.1-flash`，并非只修改原理图插件的图片预览。

- 活跃 provider 的图片像素预算设为 640000，编码大小目标为 262144 字节。
  保留本地原图与前端概览；缩小只作用于发送给模型的图像。编码大小是
  适配器的目标，不能直接等同于 token 上限。
- 已有后续 assistant 消息的历史图片在请求副本中改为短提示。
  最新工具结果中的图片仍发送；再次调用 read_image 可重新检查。
  会话持久记录不变，避免后续每一步都重复携带已检查图片。
- 当前网关路线把 function_call_output 里的图片移到紧随其后的 user
  图像消息，保留工具调用 ID、文字结果和图片关联说明。
  测试中同一份缩小后的 JPEG（977x655、82249 字节），嵌套工具图片曾报告
  76165 输入 token；正式补丁实测独立 user 图片为 584，正确识别 AMS1117-3.3，
  下一步没有图片为 163。另一轮独立图片为 576；也存在超时，因此不能
  把这些差值当成所有请求的保证。没有证据说明本地把 base64 写成了普通文本；
  当前结果指向网关对图片所在消息位置的兼容性问题。
  此兼容转换只作用于上面的 provider/model，不影响其他模型路线。
- skill 要求先查结构化信息，按问题区域读取预览，避免重复读取全部整图。
- SDK 发出请求时记录体积、图片数量、图片编码字符数与可疑文本字段数量；
  结束响应时记录服务端原始 usage。通过 traceId 对应。
  日志不保存密钥、提示词、图片内容或完整请求。

部署脚本依赖 Python 的 PyYAML，当前机器已具备。运行：

```powershell
cd D:\kicad\dsh-pcb-eda
pnpm test:kicad-image-policy
python packages/dsh-tool-kicad-schematic-gen/scripts/patch-kicad-image-policy.py
```

然后重启 KiCad，使请求层补丁和配置生效。首次部署备份位于
`.smoke/image-policy-backup.json` 指向的目录；已部署过的同版补丁可重复运行。
升级 KiCad / Harness 后可能覆盖运行时补丁，重新应用时脚本会检查已知代码位置，
遇到不兼容版本会停止而不是猜测修改。

回退命令：`python packages/dsh-tool-kicad-schematic-gen/scripts/patch-kicad-image-policy.py --restore`，然后重启 KiCad。
回退恢复首次备份的三个运行时文件与 settings.yaml；若之后编辑过配置，先保留这些新改动。

诊断文件：
`C:\Users\msi\.hq-edge\1.8.12\dsh-home\kicad\diagnostics\image-requests.jsonl`。
单文件超过 8 MiB 时保留一份 previous；两份均占用时停止追加，避免无限增长。

复测使用一个新会话：读取一张预览，接着进行不读取图片的操作。
第一轮 request 应有 imageCount=1，后续应为 0；比对对应 usage.input_tokens。
检查图片错位进入文本看 suspiciousTextFields / imageStringsOutsideImageFields。
若没有错位、图像已缩小但 input_tokens 仍远超正常值，保留对应 traceId、responseId
和 usage，再检查网关计量与上下文压缩策略，不能仅凭图片编码长度确定原因。

图片变小并不能保证特定 token 降幅；需要服务端 usage 实测。
细字不清晰时读取相关区域图，保留对电气连接的结构化检查。
