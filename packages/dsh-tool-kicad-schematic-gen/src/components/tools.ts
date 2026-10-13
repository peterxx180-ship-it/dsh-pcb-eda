/** KiCad model and datasheet inspection, and Symbol import. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import type { ToolDefinition, JsonSchemaNode } from '@deepseek-ai/dsh-tools'
import { getDatasheet, type DatasheetOptions } from './datasheet.ts'
import { importSymbol } from './import-symbol.ts'
import { getComponentModels } from './models.ts'

import { partIdentity } from './identity.ts'
import { importComponent } from './import-component.ts'

import type { Config } from './config.ts'

const builderCompatibilitySchema = { type: 'object', additionalProperties: false, properties: {
  status: { type: 'string', enum: ['ready', 'unsupported_units'] },
  availableUnits: { type: 'array', items: { type: 'integer' } }, nextAction: { type: 'string' },
  normalization: { type: 'string', enum: ['common_only_to_unit_1'] },
}, required: ['status', 'availableUnits', 'nextAction'] } satisfies JsonSchemaNode

export function createKicadLibraryTools(ctx: Context, config: Config): ToolDefinition[] {
  const datasheetOptions: DatasheetOptions = {
    structuredApiBaseUrl: config.structuredApiBaseUrl,
    requestTimeoutMs: config.datasheetRequestTimeoutMs,
    maxPdfBytes: config.maxPdfBytes,
    maxPdfPages: config.maxPdfPages,
    maxTextChars: config.maxTextChars,
    maxImages: config.maxImages,
    allowedPdfHosts: config.allowedPdfHosts,
  }

  const modelsTool: ToolDefinition = {
    name: 'get_kicad_component_models',
    description: 'Get a parsed, read-only KiCad symbol and footprint summary for an exact manufacturer ID and MPN returned by search_hqsch_parts. Source files are fetched in memory only, not saved. Pin-to-pad compatibility is NOT checked.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        manufacturer_id: { type: 'string', description: 'Manufacturer ID: use manufacturer.id from search_hqsch_parts.' },
        mfgId: { type: 'string', description: 'Legacy alias of manufacturer_id. Prefer manufacturer_id from search_hqsch_parts.' },
        mpn: { type: 'string', description: 'Exact manufacturer part number from the same candidate.' },
      },
      required: ['mpn'],
      anyOf: [{ required: ['manufacturer_id'] }, { required: ['mfgId'] }],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          part: { type: 'string' },
          symbol: {
            type: 'object',
            additionalProperties: false,
            properties: {
              status: { type: 'string', enum: ['missing', 'parsed', 'invalid'] },
              code: { type: 'string', enum: ['MODEL_FORMAT_INVALID', 'MODEL_PARSE_FAILED'] },
              sourceUrl: { type: 'string' }, message: { type: 'string' },
              retryUnchanged: { type: 'boolean', enum: [false] }, nextAction: { type: 'string' },
              name: { type: 'string' },
              subsymbols: { type: 'array', items: { type: 'string' } },
              pinCount: { type: 'number' },
              builderCompatibility: builderCompatibilitySchema,
              pins: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    unit: { type: 'string' },
                    number: { type: 'string' },
                    name: { type: 'string' },
                    type: { type: 'string' },
                  },
                  required: ['unit', 'number', 'name', 'type'],
                },
              },
            },
            required: ['status'],
          },
          footprint: {
            type: 'object',
            additionalProperties: false,
            properties: {
              status: { type: 'string', enum: ['missing', 'parsed', 'invalid'] },
              code: { type: 'string', enum: ['MODEL_FORMAT_INVALID', 'MODEL_PARSE_FAILED'] },
              sourceUrl: { type: 'string' }, message: { type: 'string' },
              retryUnchanged: { type: 'boolean', enum: [false] }, nextAction: { type: 'string' },
              name: { type: 'string' },
              padCount: { type: 'number' },
              pads: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    number: { type: 'string' },
                    type: { type: 'string' },
                  },
                  required: ['number', 'type'],
                },
              },
            },
            required: ['status'],
          },
          validation: {
            type: 'object',
            additionalProperties: false,
            properties: { pinPadMatch: { type: 'string', enum: ['not_checked'] } },
            required: ['pinPadMatch'],
          },
        },
        required: ['part', 'symbol', 'footprint', 'validation'],
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args: unknown, exec) {
      if (typeof args !== 'object' || args === null || Array.isArray(args)) {
        throw new Error('component arguments must be an object')
      }
      const { mfgId, mpn } = partIdentity(args as Record<string, unknown>)
      return getComponentModels(mfgId, mpn.trim(), config, exec.signal)
    },
    presentCall: args => ({ card: 'generic', title: 'Inspect KiCad models', kind: 'read', rawInput: args }),
  }
  const importTool: ToolDefinition = {
    name: 'import_kicad_symbol',
    description: 'Import one selected Huaqiu KiCad Symbol into an existing project directory inside the current session workspace. Creates a dedicated .kicad_sym library and registers it in that project\'s sym-lib-table. Upstream Symbol text is checked for balanced parentheses; when exactly one trailing ")" is extra that single provable shape is repaired and reported as symbolTextRepaired, while any other imbalance is refused. Never overwrites a different existing library. Returns builderCompatibility with availableUnits and nextAction before scripted placement. This is a format check, not a part/pin/package match. Does not import a footprint or modify a schematic.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        manufacturer_id: { type: 'string', description: 'Manufacturer ID: use manufacturer.id from search_hqsch_parts.' },
        mfgId: { type: 'string', description: 'Legacy alias of manufacturer_id.' },
        mpn: { type: 'string', description: 'Exact MPN from the same candidate.' },
        projectDir: { type: 'string', description: 'Existing KiCad project directory inside this session workspace; defaults to the workspace root.' },
      },
      required: ['mpn'],
      anyOf: [{ required: ['manufacturer_id'] }, { required: ['mfgId'] }],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          part: { type: 'string' },
          libId: { type: 'string' },
          libraryPath: { type: 'string' },
          tablePath: { type: 'string' },
          sourceUrl: { type: 'string' },
          sha256: { type: 'string' },
          pinCount: { type: 'number' },
              builderCompatibility: builderCompatibilitySchema,
          symbolTextRepaired: { type: 'boolean' },
          library: { type: 'string', enum: ['created', 'existing'] },
          table: { type: 'string', enum: ['created', 'updated', 'existing'] },
        },
        required: ['part', 'libId', 'libraryPath', 'tablePath', 'sourceUrl', 'sha256', 'pinCount', 'symbolTextRepaired', 'builderCompatibility', 'library', 'table'],
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args: unknown, exec) {
      if (typeof args !== 'object' || args === null || Array.isArray(args)) {
        throw new Error('component arguments must be an object')
      }
      const { mfgId, mpn } = partIdentity(args as Record<string, unknown>)
      const { projectDir } = args as Record<string, unknown>
      if (projectDir !== undefined && (typeof projectDir !== 'string' || projectDir.trim().length === 0)) {
        throw new Error('projectDir must be a non-empty path when supplied')
      }
      const agent = exec.agent
      if (agent === undefined) throw new Error('import_kicad_symbol requires an agent session workspace')
      const workspaceRoot = agent.session.header.cwd
      if (workspaceRoot === undefined) throw new Error('import_kicad_symbol requires an agent session workspace')
      return importSymbol(mfgId, mpn.trim(), projectDir as string | undefined, workspaceRoot,
        config, ctx.fs, ctx.sandboxPolicy.resolve({ session: agent.session }), exec.signal)
    },
    presentCall: args => ({ card: 'generic', title: 'Import KiCad Symbol', kind: 'edit', rawInput: args }),
  }
  const datasheetTool: ToolDefinition = {
    name: 'get_kicad_datasheet',
    description: 'Read datasheet information for one exact IC selected by search_hqsch_parts. Returns bounded structured sections and original HTTPS application-image links; if structured text is absent, returns bounded PDF text. Image links are not image content, and PDF text may omit tables or diagrams. Do not infer unreported electrical parameters.',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        manufacturer_id: { type: 'string', description: 'Manufacturer ID: use manufacturer.id from search_hqsch_parts.' },
        mfgId: { type: 'string', description: 'Legacy alias of manufacturer_id.' },
        mpn: { type: 'string', description: 'Exact MPN from the same component candidate.' },
      },
      required: ['mpn'],
      anyOf: [{ required: ['manufacturer_id'] }, { required: ['mfgId'] }],
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          part: { type: 'string' },
          status: { type: 'string', enum: ['found', 'missing'] },
          source: { type: 'string', enum: ['structured', 'pdf', 'none'] },
          datasheetUrl: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          sections: {
            type: 'array', items: {
              type: 'object', additionalProperties: false,
              properties: {
                contentType: { type: 'number' }, title: { type: 'string' },
                text: { type: 'string' }, imageUrls: { type: 'array', items: { type: 'string' } },
              },
              required: ['contentType', 'title', 'text', 'imageUrls'],
            },
          },
          truncated: { type: 'boolean' },
        },
        required: ['part', 'status', 'source', 'datasheetUrl', 'sections', 'truncated'],
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args: unknown, exec) {
      if (typeof args !== 'object' || args === null || Array.isArray(args)) {
        throw new Error('datasheet arguments must be an object')
      }
      const { mfgId, mpn } = partIdentity(args as Record<string, unknown>)
      return getDatasheet(mfgId, mpn.trim(), datasheetOptions, exec.signal)
    },
    presentCall: args => ({ card: 'generic', title: 'Read IC datasheet', kind: 'read', rawInput: args }),
  }
  const componentTool: ToolDefinition = {
    name: 'import_kicad_component',
    description: 'Download and register BOTH the symbol and footprint for an exact searched component into project-local .kicad_sym and .pretty libraries, sym-lib-table and fp-lib-table. Rejects missing/invalid models, unsupported symbol units, and mismatching unique pin/pad number sets before writing. Search availability flags are not trusted. Returns verified hasSymbol/hasFootprint plus libraryPath, libId and footprintId. Pass footprintId explicitly to addSymbol as footprint. Does not place a symbol or create a PCB; number matching is not electrical or package-dimension validation. Existing different files are not overwritten. Interrupted writes can leave partial files; errors report their location.',
    parameters: importTool.parameters,
    output: {
      schema: {
        type: 'object', additionalProperties: true,
        properties: {
          part: { type: 'string' }, hasSymbol: { type: 'boolean', enum: [true] }, hasFootprint: { type: 'boolean', enum: [true] },
          libId: { type: 'string' }, libraryPath: { type: 'string' }, tablePath: { type: 'string' },
          footprintId: { type: 'string' }, footprintPath: { type: 'string' }, footprintTablePath: { type: 'string' },
          footprintSourceUrl: { type: 'string' }, footprintSha256: { type: 'string' },
          pinCount: { type: 'number' }, padCount: { type: 'number' }, builderCompatibility: builderCompatibilitySchema,
          validation: { type: 'object', additionalProperties: false, properties: {
            pinPadMatch: { type: 'string', enum: ['number_sets_match'] },
            pinNumbers: { type: 'array', items: { type: 'string' } }, padNumbers: { type: 'array', items: { type: 'string' } },
            electricalCompatibility: { type: 'string', enum: ['not_checked'] }, packageDimensions: { type: 'string', enum: ['not_checked'] },
          }, required: ['pinPadMatch', 'pinNumbers', 'padNumbers', 'electricalCompatibility', 'packageDimensions'] },
          nextAction: { type: 'string' },
        },
        required: ['part', 'hasSymbol', 'hasFootprint', 'libId', 'libraryPath', 'footprintId', 'footprintPath', 'footprintTablePath', 'validation', 'builderCompatibility', 'nextAction'],
      },
      render: (_args, result) => [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    },
    async execute(args: unknown, exec) {
      if (typeof args !== 'object' || args === null || Array.isArray(args)) throw new Error('component arguments must be an object')
      const { mfgId, mpn } = partIdentity(args as Record<string, unknown>)
      const { projectDir } = args as Record<string, unknown>
      if (projectDir !== undefined && (typeof projectDir !== 'string' || !projectDir.trim())) throw new Error('projectDir must be a non-empty path when supplied')
      const agent = exec.agent
      const cwd = agent?.session.header.cwd
      if (!agent || !cwd) throw new Error('import_kicad_component requires an agent session workspace')
      return importComponent(mfgId, mpn, projectDir as string | undefined, cwd, config,
        ctx.fs, ctx.sandboxPolicy.resolve({ session: agent.session }), exec.signal)
    },
    presentCall: args => ({ card: 'generic', title: 'Import KiCad component and footprint', kind: 'edit', rawInput: args }),
  }
  return [modelsTool, importTool, datasheetTool, componentTool]
}
