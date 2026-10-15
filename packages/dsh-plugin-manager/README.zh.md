# @local/dsh-plugin-manager

统一管理所在工作区 packages 中声明 dsh.bundle.patch 的插件。扫描目录通过插件实际文件位置自动定位（解析安装链接），不绑定盘符或项目目录。页面不区分内置与用户插件，也不显示普通辅助库；每个插件仅提供开启/关闭，管理器自身不能关闭。

开关逻辑统一由 PluginController 处理；已移除旧版内置插件控制器、固定内置插件名单和仅修改 profile 的旧开关实现。仍保留旧 builtin-state.json 的选择迁移。管理器不查询 EDA 宿主信息，不依赖 KiCad CLI 或 Python；注册插件使用的是 DSH CLI。

开启未注册且未加载的插件时，调用目标 KiCad DSH CLI 注册，之后提示重启。已加载插件按包身份与 patch 中的加载名称匹配所有条目，开关直接应用到运行状态；某些前端或依赖能力需重启后同步。关闭登录、文件存储、宿主桥接等服务会影响依赖它们的功能，管理器不自动关闭或开启依赖包。

选择统一保存在当前 KiCad profile/kicad-plugin-state.json；启动完成后恢复选择，包括宿主自动注入的条目。已有 builtin-state.json 的停用选择会迁入新状态，之后新状态优先。用户 profile 的 bundle 选择也同步更新；一键 update-bundled-plugins:kicad 保留已有开关。

构建/检查：pnpm --filter @local/dsh-plugin-manager build、pnpm --filter @local/dsh-plugin-manager typecheck、pnpm --filter @local/dsh-plugin-manager test。包保留 @local 名称和 private:true，不参与 npm 发布。CLI 自动使用当前 KiCad Node 可执行文件同目录的 dsh-cli.cjs，不绑定 KiCad 版本；只在注册未安装插件时检查 CLI。特殊部署可在 cordis.patch.yml 的 config 中设置 pluginsDir、dshCliPath 绝对路径覆盖默认值；单独安装本包时需将 pluginsDir 指向需要管理的插件目录。一键安装应在目标电脑运行，不应复制另一台电脑的 profile 链接。

一键更新前可执行 `node scripts/update-bundled-plugins-kicad.mjs --check-only`：检查宿主补丁布局、Node 版本、写入权限、开关文件与已构建的插件文件，不进行安装。首次使用不要求 profile 已存在，由 KiCad CLI 初始化。

执行正式更新时建议关闭 KiCad，避免同时修改 profile。脚本先构建，再备份完整 web profile 和相关宿主文件，保留 junction 的目标而不复制目标项目。注册、恢复开关或编译模块导入失败时恢复备份；失败的备份保留在当前 DSH_HOME/plugin-update-backups，日志给出位置和失败阶段。成功后删除临时备份。更新不会恢复源码构建输出或清理全局下载缓存；模块导入检查不等于实际编辑器及所有依赖服务运行验证。
