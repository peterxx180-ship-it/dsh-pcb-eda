/** Request-only image retention and redacted diagnostics for the active route. */
import {appendFileSync,existsSync,mkdirSync,renameSync,statSync} from 'node:fs'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
const traces=new WeakMap()
const active=model=>model?.provider==='aihubmix'&&model?.id==='deepseek-v4.1-flash'
/** This gateway route handles vision reliably in user content, not nested tool output. */
export function normalizeToolResultImages(params,model){
 if(!active(model)||!Array.isArray(params.input))return params
 let changed=false;const input=[]
 for(const item of params.input){
  if(item.type!=='function_call_output'||!Array.isArray(item.output)){input.push(item);continue}
  const images=item.output.filter(x=>x.type==='input_image')
  if(!images.length){input.push(item);continue}
  changed=true
  const rest=item.output.filter(x=>x.type!=='input_image')
  input.push({...item,output:rest.length?rest:'Image supplied in the following message.'})
  input.push({role:'user',content:[{type:'input_text',text:`Images returned by tool call ${item.call_id}:`},...images]})
 }
 return changed?{...params,input}:params
}
export function projectHistoricalImages(messages,access=()=>undefined){
 let boundary=-1
 for(let i=0;i<messages.length;i++)if(messages[i].role==='assistant')boundary=i
 function blocks(content,old){return content.map(block=>{
  if(block.type==='tool-result')return {...block,content:blocks(block.content,old)}
  if(block.type!=='image'||!old)return block
  const ref=block.attachment,path=access(ref)?.readonlyPath
  return {type:'text',text:`[Previously supplied image ${ref.name??ref.attachmentId}; ${ref.width}x${ref.height}px. Image bytes omitted from this request. Use the prior inspection conclusions; if they are insufficient, call read_image again${path?` on ${JSON.stringify(path)}`:''}.]`}
 })}
 return messages.map((message,index)=>({...message,content:blocks(message.content,index<=boundary)}))
}
function log(item){
 if(!process.env.DSH_HOME)return
 try{
  const dir=join(process.env.DSH_HOME,'diagnostics');mkdirSync(dir,{recursive:true})
  const path=join(dir,'image-requests.jsonl')
  if(existsSync(path)&&statSync(path).size>8*1024*1024){const previous=path+'.previous';if(existsSync(previous))return;renameSync(path,previous)}
  appendFileSync(path,JSON.stringify({time:new Date().toISOString(),...item})+'\n')
 }catch{/* diagnostics must never fail a model request */}
}
export function summarizePayload(params){
 const images=[];let textCharacters=0,suspiciousTextFields=0,imageStringsOutsideImageFields=0
 function walk(value,path=''){
  if(Array.isArray(value)){value.forEach((x,i)=>walk(x,`${path}[${i}]`));return}
  if(!value||typeof value!=='object')return
  if(value.type==='input_image'){
   const url=value.image_url??''
   images.push({field:path,detail:value.detail,mime:typeof url==='string'?url.match(/^data:([^;]+);base64,/)?.[1]:undefined,encodedCharacters:typeof url==='string'?url.length:0})
  }
  for(const [key,x]of Object.entries(value)){
   if(typeof x==='string'&&key!=='image_url'){
    textCharacters+=x.length
    if(x.includes('data:image/')||x.includes('"input_image"'))imageStringsOutsideImageFields++
    if(x.includes('data:image/')||/[A-Za-z0-9+/]{8192}/.test(x))suspiciousTextFields++
   }else if(typeof x!=='string')walk(x,path+'.'+key)
  }
 }
 walk(params.input,'input')
 return {requestBytes:Buffer.byteLength(JSON.stringify(params)),items:params.input?.length??0,tools:params.tools?.length??0,textCharacters,imageCount:images.length,images,suspiciousTextFields,imageStringsOutsideImageFields}
}
export function traceRequest(params,model,output){
 if(!active(model))return
 const traceId=randomUUID();traces.set(output,traceId)
 log({kind:'request',traceId,provider:model.provider,model:model.id,baseURL:model.baseUrl??model.baseURL,sessionId:params.prompt_cache_key??null,...summarizePayload(params)})
}
export function traceUsage(response,model,output){
 if(!active(model))return
 log({kind:'usage',traceId:traces.get(output)??null,responseId:response.id,status:response.status,model:response.model,usage:response.usage})
}
