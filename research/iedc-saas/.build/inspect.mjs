import fs from 'node:fs/promises';
import {PresentationFile,FileBlob} from '@oai/artifact-tool';
const ref='/Users/rizwin/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-simple-light-mode/assets/reference.pptx';
const p=await PresentationFile.importPptx(await FileBlob.load(ref));
await fs.writeFile('inspect.ndjson',(await p.inspect({kind:'slide,textbox,shape,table,layout',maxChars:2000000})).ndjson);
console.log('slides',p.slides.items.length,'collection',Object.getOwnPropertyNames(Object.getPrototypeOf(p.slides)));
for(let i=0;i<p.slides.items.length;i++){
 const s=p.slides.items[i]; const b=await s.export({format:'png',scale:0.5});await fs.writeFile(`ref-${i+1}.png`,new Uint8Array(await b.arrayBuffer()));
 if([1,4,5,13,16].includes(i))console.log('SLIDE',i+1,s.id,s.frame, 'methods',Object.getOwnPropertyNames(Object.getPrototypeOf(s)), 'shapes',s.shapes.items.map(x=>({id:x.id,text:x.text.toString(),pos:x.position,style:x.text.style})))
}
