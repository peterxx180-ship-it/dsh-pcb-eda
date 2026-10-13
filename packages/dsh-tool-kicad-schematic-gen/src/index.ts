/** One installable plugin for module-first KiCad schematic design. */
import type {Context} from '@deepseek-ai/cordis'
import {resolveConfig,type ConfigInput} from './config.ts'
import {apply as registerComponents} from './components/index.ts'
import {registerModules} from './modules/register.ts'
import {apply as registerSchematic} from './schematic/index.ts'
import {apply as registerSkills} from './skills.ts'

export {Config,resolveConfig} from './config.ts'
export const name='@local/dsh-tool-kicad-schematic-gen'
export const inject=['tools','fs','sandboxPolicy','skills','webServer'] as const

export function apply(ctx:Context, input:ConfigInput={}):void {
  const config=resolveConfig(input)
  registerComponents(ctx,config.components)
  registerModules(ctx,config.modules)
  registerSchematic(ctx,config.schematic)
  registerSkills(ctx)
}
