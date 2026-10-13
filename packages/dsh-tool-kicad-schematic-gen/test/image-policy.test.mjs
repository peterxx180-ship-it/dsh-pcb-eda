import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {projectHistoricalImages,normalizeToolResultImages,summarizePayload,traceRequest,traceUsage} from '../scripts/utils/kicad-image-policy.mjs'
const image={type:'image',attachment:{attachmentId:'sha256:abc',name:'page.png',width:1200,height:800}}
const result=image=>({role:'user',content:[{type:'tool-result',toolCallId:'read1',content:[{type:'text',text:'read result'},image]}]})
test('normalize gateway tool images into adjacent user vision content while preserving tool calls and options',()=>{
 const model={provider:'aihubmix',id:'deepseek-v4.1-flash'}
 const img={type:'input_image',image_url:'data:image/png;base64,abc',detail:'auto'}
 const text={type:'input_text',text:'file metadata'}
 const params={reasoning:{effort:'none'},tools:[{name:'read_image'}],input:[{type:'function_call',call_id:'a'},{type:'function_call_output',call_id:'a',output:[text,img,img]},{type:'function_call_output',call_id:'b',output:[img]}]}
 const before=JSON.stringify(params),normalized=normalizeToolResultImages(params,model)
 assert.equal(JSON.stringify(params),before)
 assert.equal(normalized.input.length,5)
 assert.deepEqual(normalized.input[1].output,[text])
 assert.deepEqual(normalized.input[2].content.slice(1),[img,img])
 assert.equal(typeof normalized.input[3].output,'string')
 assert.equal(normalized.reasoning,params.reasoning)
 assert.equal(summarizePayload(normalized).imageCount,3)
 assert.equal(normalizeToolResultImages(normalized,model),normalized)
 assert.equal(normalizeToolResultImages(params,{...model,provider:'other'}),params)
})
test('omit only images already passed to an assistant; keep newest batch and durable data intact',()=>{
 const messages=[result(image),{role:'assistant',content:[{type:'text',text:'I inspected page one.'}]},result(image),result(image)]
 const before=JSON.stringify(messages),projected=projectHistoricalImages(messages,()=>({readonlyPath:'D:/project/page.png'}))
 assert.equal(projected[0].content[0].content[1].type,'text');assert.match(projected[0].content[0].content[1].text,/read_image again/)
 assert.equal(projected[2].content[0].content[1].type,'image');assert.equal(projected[3].content[0].content[1].type,'image')
 assert.equal(JSON.stringify(messages),before)
 const next=projectHistoricalImages([...messages,{role:'assistant',content:[{type:'text',text:'I inspected the latest batch.'}]}])
 assert.ok(next.filter(x=>x.role==='user').every(x=>x.content[0].content[1].type==='text'))
 assert.equal(projectHistoricalImages([result(image)])[0].content[0].content[1].type,'image')
})
test('wire diagnostics detect misplaced image data without leaking content or credentials',async()=>{
 const home=await mkdtemp(join(tmpdir(),'image-trace-')),original=process.env.DSH_HOME;process.env.DSH_HOME=home
 try{
  const model={provider:'aihubmix',id:'deepseek-v4.1-flash',baseUrl:'https://api.inferera.com/v1'},output={}
  const params={api_key:'DO-NOT-LOG',input:[{type:'function_call_output',output:[{type:'input_image',image_url:'data:image/png;base64,SECRETIMAGE',detail:'auto'},{type:'input_text',text:'PRIVATE-PROMPT'}]}]}
  assert.equal(summarizePayload(params).imageCount,1)
  assert.equal(summarizePayload({input:[{type:'input_text',text:JSON.stringify(params.input)}]}).imageStringsOutsideImageFields,1)
  traceRequest(params,model,output);traceUsage({id:'test',model:model.id,status:'completed',usage:{input_tokens:1100}},model,output)
  const log=await readFile(join(home,'diagnostics/image-requests.jsonl'),'utf8')
  for(const secret of ['DO-NOT-LOG','SECRETIMAGE','PRIVATE-PROMPT'])assert.ok(!log.includes(secret))
  const lines=log.trim().split('\n').map(JSON.parse);assert.equal(lines[0].traceId,lines[1].traceId);assert.equal(lines[1].usage.input_tokens,1100)
 }finally{if(original===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=original}
})
