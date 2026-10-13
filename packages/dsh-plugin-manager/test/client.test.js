import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {runInNewContext} from 'node:vm'
test('one directory-based list uses switches for registered and unregistered plugins',async()=>{
 let view,index=0
 const rows=[{name:'@huaqiu/dsh-auth',description:'登录',folder:'dsh-auth',enabled:true,installed:true,active:true,protected:false,restartRequired:false},{name:'@local/new',folder:'new',enabled:false,installed:false,active:false,protected:false,restartRequired:false}]
 const values=[rows,'D:/workspace/packages','','','']
 const react={createElement:(type,props,...children)=>({type,props,children}),useState:()=>[values[index++],()=>{}],useEffect:()=>{},useCallback:fn=>fn}
 runInNewContext(await readFile(new URL('../lib/client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:options=>options.factory(()=>react).apply({slots:{inject:(name,fn)=>fn(),register:(options,component)=>{view=component}}})}}})
 const tree=JSON.stringify(view());assert.match(tree,/D:\/workspace\/packages/);assert.match(tree,/@huaqiu\/dsh-auth/);assert.match(tree,/@local\/new/)
 assert.equal((tree.match(/"role":"switch"/g)||[]).length,2)
 assert.ok(!tree.includes('KiCad 内置插件'));assert.ok(!tree.includes('用户插件'));assert.ok(!tree.includes('D:\\\\kicad\\\\plugins'))
})
