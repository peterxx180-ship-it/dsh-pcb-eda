"""Deploy a reversible request-only patch to the installed KiCad runtime."""
from pathlib import Path
import json,shutil,datetime,sys,yaml,os,argparse,subprocess

root=Path(__file__).resolve().parents[3]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--runtime',help='Override the installed edge-headless directory')
parser.add_argument('--settings',help='Override the active KiCad settings.yaml')
parser.add_argument('--dsh-cmd',help='Override the installed KiCad dsh launcher')
parser.add_argument('--restore',action='store_true')
parser.add_argument('--check-paths',action='store_true',help='Print discovered paths without modifying files')
args=parser.parse_args()
manifest=root/'.smoke/image-policy-backup.json'
if args.restore:
    records=json.loads(manifest.read_text(encoding='utf-8'))
    for record in records:shutil.copyfile(record['backup'],record['target'])
    print('Restored runtime files and settings. Restart KiCad.');sys.exit(0)
paths={}
if not (args.runtime and args.settings):
    candidates=[args.dsh_cmd,os.environ.get('HQ_KICAD_DSH_CMD')]
    for key in ('CommonProgramW6432','CommonProgramFiles'):
        if os.environ.get(key):candidates.append(str(Path(os.environ[key])/'KiCad/bin/dsh.cmd'))
    candidates.append(shutil.which('dsh'))
    launcher=next((item for item in candidates if item and Path(item).is_file()),None)
    if not launcher:parser.error('KiCad dsh launcher not found; supply --dsh-cmd or both --runtime and --settings')
    env={**os.environ,'HQ_TARGET_HOST':'kicad'};env.pop('DSH_HOME',None)
    command=[launcher,'--hq-paths']
    result=subprocess.run(subprocess.list2cmdline(command) if os.name=='nt' else command,
                          shell=os.name=='nt',env=env,capture_output=True,text=True,check=True)
    paths=json.loads(result.stdout)
    if not str(paths.get('dshHome','')).replace('\\','/').endswith('/dsh-home/kicad'):
        parser.error('Launcher did not resolve the KiCad DSH home')
runtime=Path(args.runtime or paths['installRoot']).resolve()
settings=Path(args.settings or str(Path(paths['dshHome'])/'settings.yaml')).resolve()
if args.check_paths:
    print(json.dumps({'runtime':str(runtime),'settings':str(settings)},ensure_ascii=False));sys.exit(0)
adapter=runtime/'dsh/node_modules/@deepseek-ai/dsh-llm-pi-ai/lib/index.js'
request=runtime/'dsh/node_modules/@earendil-works/pi-ai/dist/api/openai-responses.js'
shared=runtime/'dsh/node_modules/@earendil-works/pi-ai/dist/api/openai-responses-shared.js'
helper=runtime/'bin/kicad-image-policy.mjs'
if manifest.exists():
    records=json.loads(manifest.read_text(encoding='utf-8'))
    if {str(Path(record['target']).resolve()) for record in records}!={str(p.resolve()) for p in [adapter,request,shared,settings]}:
        parser.error('Existing backup belongs to another runtime or profile; preserve/archive it before deploying to this installation')
sources=[adapter,request,shared,settings]
if not manifest.exists():
    directory=root/'.smoke'/('image-policy-backup-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
    directory.mkdir(parents=True)
    records=[]
    for i,target in enumerate(sources):
        backup=directory/(str(i)+'-'+target.name);shutil.copyfile(target,backup)
        records.append({'target':str(target),'backup':str(backup)})
    manifest.write_text(json.dumps(records,indent=2),encoding='utf-8')
texts={p:p.read_text(encoding='utf-8') for p in sources[:3]}
def replace_once(path,old,new):
    if texts[path].count(old)!=1:raise RuntimeError('Unsupported runtime layout: '+str(path))
    texts[path]=texts[path].replace(old,new)
if 'DSH_IMAGE_POLICY_V1' not in texts[adapter]:
    texts[adapter]='// DSH_IMAGE_POLICY_V1\nimport {projectHistoricalImages} from '+json.dumps(helper.as_uri())+';\n'+texts[adapter]
    old='const requestMessages = offloadRequestImagesWithPolicy(split.messages, {'
    replace_once(adapter,old,'const selectedMessages = options.provider === "aihubmix" && options.model === "deepseek-v4.1-flash" ? projectHistoricalImages(split.messages, resolveImageAccess) : split.messages;\n\tconst requestMessages = offloadRequestImagesWithPolicy(selectedMessages, {')
if 'DSH_IMAGE_POLICY_V1' not in texts[request]:
    texts[request]='// DSH_IMAGE_POLICY_V1\nimport {traceRequest} from '+json.dumps(helper.as_uri())+';\n'+texts[request]
    replace_once(request,'            const requestOptions = {','            traceRequest(params, model, output);\n            const requestOptions = {')
if 'DSH_IMAGE_POLICY_V1' not in texts[shared]:
    texts[shared]='// DSH_IMAGE_POLICY_V1\nimport {traceUsage} from '+json.dumps(helper.as_uri())+';\n'+texts[shared]
    replace_once(shared,'        if (response?.usage) {','        if (response?.usage) {\n            traceUsage(response, model, output);')
if 'normalizeToolResultImages(params, model)' not in texts[request]:
    replace_once(request,'import {traceRequest} from ', 'import {traceRequest,normalizeToolResultImages} from ')
    replace_once(request,'            traceRequest(params, model, output);','            params = normalizeToolResultImages(params, model);\n            traceRequest(params, model, output);')
shutil.copyfile(Path(__file__).resolve().parent/'utils/kicad-image-policy.mjs',helper)
for p,text in texts.items():p.write_text(text,encoding='utf-8')
data=yaml.safe_load(settings.read_text(encoding='utf-8'))
provider=data['llm-pi-ai']['providers']['aihubmix']
provider['requestImagePixelBudget']=640000;provider['requestImageMaxBytes']=262144
settings.write_text(yaml.safe_dump(data,allow_unicode=True,sort_keys=False),encoding='utf-8')
print('Image policy deployed: 640000 pixels, 262144-byte encoding target, consumed historical images omitted, redacted request/usage diagnostics. Restart KiCad.')
