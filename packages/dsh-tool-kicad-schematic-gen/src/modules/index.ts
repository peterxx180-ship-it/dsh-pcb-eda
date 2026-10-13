/** Combined HQ module search and download provider for KiCad DSH. */
import type { KiCadContext } from './kicad-download.ts'
import { apply as applySearch } from './tools.ts'
import { apply as applyDownload } from './kicad-download.ts'
import type { Config } from './config.ts'

export { Config } from './config.ts'

export const name = 'hq-eda-module-library'
export const inject = ['tools', 'fs', 'sandboxPolicy', 'hqEdge']

/** Register three read-only searches and one project-scoped download under one plugin effect scope.
 * @param ctx - harness services with the HQ Edge project extension.
 * @param config - search and download service settings.
 */
export function apply(ctx: KiCadContext, config: Config): void {
  if (ctx.hqEdge?.context?.getTargetHost() !== 'kicad') {
    throw new Error('hq-eda-module-library combined provider requires a KiCad HQ Edge host')
  }
  applyDownload(ctx, config.download)
  applySearch({ tools: { register: tool => ctx.effect(() => ctx.tools.register(tool)) } }, config.search)
}
