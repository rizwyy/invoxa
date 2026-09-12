import fs from 'node:fs/promises';
import {PresentationFile,FileBlob} from '@oai/artifact-tool';
const root='/Users/rizwin/Desktop/invoxa/research/iedc-saas';
const p=await PresentationFile.importPptx(await FileBlob.load(root+'/output/AI-business-ideas-peer-presentation.pptx'));
await fs.mkdir(root+'/.build/final-previews',{recursive:true});
for(let i=0;i<p.slides.items.length;i++){
 const b=await p.slides.items[i].export({format:'png',scale:1});
 await fs.writeFile(root+`/.build/final-previews/slide-${i+1}.png`,new Uint8Array(await b.arrayBuffer()));
}
console.log('Rendered '+p.slides.items.length+' final slides');
