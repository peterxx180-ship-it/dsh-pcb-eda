# @local/dsh-plugin-manager

统一管理 D:/kicad/dsh-pcb-eda/packages 中声明 dsh.bundle.patch 的插件。页面不区分内置与用户插件，也不显示普通辅助库；每个插件仅提供开启/关闭，管理器自身不能关闭。

开启未注册且未加载的插件时，调用目标 KiCad DSH CLI 注册，之后提示重启。已加载插件按包身份与 patch 中的加载名称匹配所有条目，开关直接应用到运行状态；某些前端或依赖能力需重启后同步。关闭登录、文件存储、宿主桥接等服务会影响依赖它们的功能，管理器不自动关闭或开启依赖包。

选择统一保存在当前 KiCad profile/kicad-plugin-state.json；启动完成后恢复选择，包括宿主自动注入的条目。已有 builtin-state.json 的停用选择会迁入新状态，之后新状态优先。用户 profile 的 bundle 选择也同步更新；一键 update-bundled-plugins:kicad 保留已有开关。

构建/检查：pnpm --filter @local/dsh-plugin-manager build、pnpm --filter @local/dsh-plugin-manager typecheck、pnpm --filter @local/dsh-plugin-manager test。包保留 @local 名称和 private:true，不参与 npm 发布。扫描目录和 KiCad CLI 路径由 cordis.patch.yml 配置。
