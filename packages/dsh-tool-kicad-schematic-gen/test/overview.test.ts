import assert from 'node:assert/strict'
import {test} from 'node:test'
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
import {createServer} from 'node:http'
import {unzipSync} from 'fflate'
import {createOverview,overviewHandler,OVERVIEW_ROUTE} from '../src/schematic/overview.ts'
import {parseCard} from '../src/client/overview-result.ts'

test('delivery snapshots include local paired libraries, exclude scripts, survive replay and reject arbitrary paths',async()=>{
 const root=await mkdtemp(join(tmpdir(),'kicad-overview-')),project=join(root,'project'),store=join(root,'store')
 await mkdir(join(project,'parts.pretty'),{recursive:true});await mkdir(join(project,'scripts'));await mkdir(join(project,'previews'))
 const source=join(project,'design.kicad_sch'),png=join(project,'previews','design.png')
 await writeFile(source,'schematic-v1');await writeFile(join(project,'design.kicad_pro'),'{}')
 await writeFile(join(project,'parts.kicad_sym'),'symbols');await writeFile(join(project,'parts.pretty','part.kicad_mod'),'footprint')
 await writeFile(join(project,'fp-lib-table'),'footprint table');await writeFile(join(project,'sym-lib-table'),'symbol table')
 await writeFile(join(project,'scripts','secret.mjs'),'not exported');await writeFile(png,'png-v1')
 const input={workspace:root,projectDir:project,schematicPath:source,revision:'v1',pages:[{exportedPageName:'root',pngPath:png}],sources:[{schematicPath:source,sha256:createHash('sha256').update('schematic-v1').digest('hex')}]}
 const card=await createOverview(input,store)
 assert.equal(card.fileCount,6)
 await writeFile(source,'schematic-v2');await writeFile(png,'png-v2')
 const server=createServer(overviewHandler(store));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
 try{
  const address=server.address() as {port:number},base=`http://127.0.0.1:${address.port}`
  const image=await fetch(base+card.pages[0]!.imageUrl);assert.equal(await image.text(),'png-v1')
  const archive=await fetch(base+card.downloadUrl);assert.equal(archive.headers.get('content-type'),'application/zip')
  const files=unzipSync(new Uint8Array(await archive.arrayBuffer()))
  assert.equal(Buffer.from(files['design.kicad_sch']!).toString(),'schematic-v1')
  assert.ok(files['parts.pretty/part.kicad_mod']);assert.ok(!files['scripts/secret.mjs'])
  const placement=await (await fetch(base+card.downloadUrl.replace('project.zip','placement.json'))).json() as any
  assert.equal(placement.type,'schematic');assert.equal(placement.root,'design.kicad_sch')
  const {fileURLToPath}=await import('node:url')
  assert.equal(Buffer.from(unzipSync(await readFile(fileURLToPath(placement.artifactUri)))['design.kicad_sch']!).toString(),'schematic-v1')
  assert.equal((await fetch(base+OVERVIEW_ROUTE+'/../package.json')).status,404)
  assert.equal((await fetch(base+card.downloadUrl,{method:'POST'})).status,405)
  await assert.rejects(createOverview(input,store),/Project changed/)
  await assert.rejects(createOverview({...input,workspace:join(root,'store')},store),/inside the workspace/)
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()))}
})

test('card distinguishes review, delivery and failure and rejects nonlocal asset URLs',()=>{
 const block=(o:unknown)=>({content:[{type:'text',text:JSON.stringify(o)}]})
 assert.equal(parseCard(undefined).kind,'running')
 assert.equal(parseCard(block({status:'ok',overview:null})).kind,'review')
 const id='12345678-1234-1234-1234-123456789abc'
 const overview={title:'design',filename:'design.zip',size:1024,fileCount:4,downloadUrl:`${OVERVIEW_ROUTE}/${id}/project.zip`,pages:[{name:'root',imageUrl:`${OVERVIEW_ROUTE}/${id}/page-0.png`}]}
 assert.equal(parseCard(block({status:'partial',overview})).result?.status,'partial')
 assert.equal(parseCard(block({overview:{...overview,downloadUrl:'https://external.example/file'}})).kind,'error')
 assert.equal(parseCard(block({overviewError:'archive unavailable'})).kind,'error')
})

test('built browser module registers the preview tool card without regeneration or detail actions',async()=>{
 const {runInNewContext}=await import('node:vm')
 let module:any,view:any
 const react={createElement:(type:unknown,props:unknown,...children:unknown[])=>({type,props,children}),useState:(value:unknown)=>[value,()=>{}],useEffect:()=>{}}
 const script=await readFile(new URL('../lib/client.js',import.meta.url),'utf8')
 runInNewContext(script,{window:{__ModuleLoader__:{load:(options:any)=>{module=options.factory(()=>react)}}}})
 module.apply({get:()=>({context:{getEditorType:()=> 'sch'},placeArtifact:async()=>({ok:true})}),slots:{inject:(_name:string,fn:()=>unknown)=>fn(),register:(spec:any,component:any)=>{assert.equal(spec.key,'render_kicad_module_preview');view=component;return()=>{}}},effect:(fn:()=>unknown)=>fn()})
 const id='12345678-1234-1234-1234-123456789abc'
 const block={content:[{type:'text',text:JSON.stringify({status:'ok',overview:{title:'demo',filename:'demo.zip',size:2048,fileCount:3,downloadUrl:`${OVERVIEW_ROUTE}/${id}/project.zip`,pages:[{name:'root',imageUrl:`${OVERVIEW_ROUTE}/${id}/page-0.png`}]}})}]}
 const tree=JSON.stringify(view({block}))
 assert.match(tree,/原理图概览/);assert.match(tree,/下载工程 ZIP/);assert.match(tree,/放置到编辑器/);assert.ok(!tree.includes('重新生成'));assert.ok(!tree.includes('详情'))
})
