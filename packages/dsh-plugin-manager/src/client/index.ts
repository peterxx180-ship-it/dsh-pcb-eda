/** Settings client loaded by the installed HQ Edge browser module loader. */
import type * as ReactTypes from 'react'
import type {PluginRow} from '../controller.ts'
interface ClientContext {
  slots: {
    inject(name: string, callback: () => unknown): unknown
    register(options: { name: string; id: string; order: number; label(): string }, component: () => ReactTypes.ReactElement): unknown
  }
}
interface ClientExports { inject?: string[]; apply?: (ctx: ClientContext) => void }
declare global {
  interface Window {
    __ModuleLoader__: { load(options: { id: string; factory(require: (id: 'react') => typeof ReactTypes): ClientExports }): void }
  }
}
window.__ModuleLoader__.load({
  id: '@local/dsh-plugin-manager',
  factory: (require) => {
    const module: { exports: ClientExports } = { exports: {} }
    const React = require('react')
    const { createElement: h, useCallback, useEffect, useState } = React
    const API = '/api/v1/kicad-local-plugins'

    function Manager() {
      const [plugins, setPlugins] = useState<PluginRow[]>([])
      const [directory,setDirectory]=useState('')
      const [busy, setBusy] = useState('')
      const [message, setMessage] = useState('')
      const [error, setError] = useState('')

      const refresh = useCallback(async () => {
        const response=await fetch(API,{cache:'no-store'})
        const data=await response.json()
        if(!response.ok)throw new Error(data.error||'无法读取插件列表')
        setPlugins(data.plugins);setDirectory(data.directory)

      }, [])

      useEffect(() => {
        refresh().catch((reason) => setError(String(reason)))
      }, [refresh])

      async function toggle(plugin: PluginRow) {
        setBusy(plugin.name)
        setError('')
        setMessage('')
        try {
          const response = await fetch(`${API}/toggle`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: plugin.name, enabled: !plugin.enabled }),
          })
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || '操作失败')
          await refresh()
          if(data.changed)setMessage(data.restartRequired?'已保存。请重启 KiCad 加载插件。':'开关已生效并保存。部分界面能力可能需要重启后同步。')
        } catch (reason) {
          setError(String(reason))
        } finally {
          setBusy('')
        }
      }

      const rowStyle: ReactTypes.CSSProperties = { display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--dsw-alias-border-l4, #ddd)' }
      const switchStyle = (enabled: boolean, disabled: boolean): ReactTypes.CSSProperties => ({
        width: 46,
        height: 26,
        minWidth: 46,
        padding: 3,
        border: 0,
        borderRadius: 13,
        background: enabled ? '#111318' : '#d8dadd',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: enabled ? 'flex-end' : 'flex-start',
      })
      return h('div', { style: { padding: 24, maxWidth: 850 } },
        h('h2', null, 'KiCad 插件'),
        message && h('p', { role: 'status' }, message),
        error && h('p', { role: 'alert', style: { color: '#c33' } }, error),
        h('p', {style:{opacity:.7,fontSize:13}},`目录：${directory}`),
        h('p', {style:{opacity:.7,fontSize:13}},'统一管理目录中的插件；开启尚未注册的插件会自动安装。'),
        ...plugins.map((plugin) => h('div', { key: plugin.name, style: rowStyle },
          h('div', { style: { flex: 1 } },
            h('strong', null, plugin.name),
            h('div', { style: { opacity: 0.7, fontSize: 13 } }, plugin.description || plugin.folder),
            h('div', { style: { opacity: 0.7, fontSize: 12 } }, plugin.protected?'管理器':plugin.restartRequired?'已保存，等待重启':plugin.enabled?'已启用':'已关闭')),
          h('button', {
              type: 'button',
              role: 'switch',
              'aria-checked': plugin.enabled,
              'aria-label': `${plugin.name}：${plugin.enabled ? '已启用' : '已停用'}`,
              title: plugin.protected ? '管理器不能关闭自身' : plugin.enabled ? '关闭插件' : '启用插件',
              style: switchStyle(plugin.enabled, plugin.protected || busy !== ''),
              disabled: plugin.protected || busy !== '',
              onClick: () => { void toggle(plugin) },
            }, h('span', { style: { width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)' } })))),
        plugins.length === 0 && h('p', null, '目录中没有可管理的 DSH 插件。'))
    }

    module.exports.inject = ['slots']
    module.exports.apply = (ctx) => {
      ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
        name: 'settings.plugins.tab',
        id: 'kicad-local',
        order: 20,
        label: () => 'KiCad 插件',
      }, Manager))
    }
    return module.exports
  },
})
