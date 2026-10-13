/** HTTP settings endpoints for installed KiCad plugins. */
import type { Loader } from './builtins.ts'
/** Paths supplied by the installed profile. */
export interface Config { pluginsDir: string; dshCliPath: string }
/** Services used from the installed KiCad DSH runtime. */
export interface ManagerContext {
  loader: Loader
  effect(callback: () => (() => void)): unknown
  get(name: 'appReady'): { onReady(callback: () => void): () => void } | undefined
  logger: { error(error: unknown): void }
  connection: { fetch: { register(route: {
    path: string; methods: string[]; requestBody: 'buffered'
    fetch(request: Request): Promise<Response>
  }): () => void } }
}
import { join, isAbsolute } from 'node:path'
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import {PluginController} from './controller.ts'

export const name = 'dsh-plugin-manager'
export const inject = ['connection', 'loader']
const ROUTE = '/api/v1/kicad-local-plugins'
const runFile = promisify(execFile)

function send(status: number, data: unknown): Response {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } })
}

/** Register the manager's HTTP endpoints and startup reconciliation.
 * @param ctx - installed runtime services.
 * @param config - local catalog and bundled CLI paths.
 */
export function apply(ctx: ManagerContext, config: Config): void {
  if (typeof config?.pluginsDir !== 'string' || !isAbsolute(config.pluginsDir)) {
    throw new Error('dsh-plugin-manager: pluginsDir must be absolute')
  }
  if (typeof config.dshCliPath !== 'string' || !isAbsolute(config.dshCliPath) || !existsSync(config.dshCliPath)) {
    throw new Error('dsh-plugin-manager: dshCliPath must name the bundled CLI')
  }
  if (!process.env.DSH_HOME) throw new Error('dsh-plugin-manager: DSH_HOME is required')
  const profileDir = join(process.env.DSH_HOME, 'profiles', 'web')
  const controller = new PluginController(ctx.loader,config.pluginsDir,profileDir,async folder=>{
    await runFile(process.execPath,[config.dshCliPath,'plugin','--profile','web','add',folder],{
      timeout:120_000,maxBuffer:1_000_000,windowsHide:true,env:{...process.env,HQ_TARGET_HOST:'kicad',DSH_HOME:process.env.DSH_HOME!},
    })
  },fileURLToPath(new URL('../builtin-state.json',import.meta.url)))
  const ready=ctx.get('appReady')
  if(!ready)throw new Error('dsh-plugin-manager: appReady is required')
  ctx.effect(()=>ready.onReady(()=>{void controller.reconcile().catch(error=>ctx.logger.error(error))}))
  ctx.effect(()=>ctx.connection.fetch.register({path:ROUTE,methods:['GET'],requestBody:'buffered',fetch:async()=>{
    try{return send(200,{directory:config.pluginsDir,plugins:await controller.list()})}
    catch(error){return send(400,{error:error instanceof Error?error.message:String(error)})}
  }}))
  ctx.effect(()=>ctx.connection.fetch.register({path:`${ROUTE}/toggle`,methods:['POST'],requestBody:'buffered',fetch:async request=>{
    try{
      if(!request.headers.get('content-type')?.startsWith('application/json'))return send(415,{error:'JSON request required'})
      const input=await request.json() as {name:unknown;enabled:unknown}
      return send(200,await controller.setEnabled(input.name,input.enabled))
    }catch(error){return send(400,{error:error instanceof Error?error.message:String(error)})}
  }}))
}
