"""Deploy a reversible request-only patch to the installed KiCad runtime."""
from pathlib import Path
import json,shutil,datetime,sys,yaml

root=Path(__file__).resolve().parents[3]
runtime=Path('D:/kicad/10.0.0/bin/edge-headless')
settings=Path('C:/Users/msi/.hq-edge/1.8.12/dsh-home/kicad/settings.yaml')
adapter=runtime/'dsh/node_modules/@deepseek-ai/dsh-llm-pi-ai/lib/index.js'
request=runtime/'dsh/node_modules/@earendil-works/pi-ai/dist/api/openai-responses.js'
shared=runtime/'dsh/node_modules/@earendil-works/pi-ai/dist/api/openai-responses-shared.js'
helper=runtime/'bin/kicad-image-policy.mjs'
manifest=root/'.smoke/image-policy-backup.json'
if '--restore' in sys.argv:
    records=json.loads(manifest.read_text(encoding='utf-8'))
    for record in records:shutil.copyfile(record['backup'],record['target'])
    print('Restored runtime files and settings. Restart KiCad.');sys.exit(0)
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
