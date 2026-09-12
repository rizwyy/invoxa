import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {PresentationFile,FileBlob} from '@oai/artifact-tool';
const root='/Users/rizwin/Desktop/invoxa/research/iedc-saas';
const skill='/Users/rizwin/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
const ref='/Users/rizwin/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-simple-light-mode/assets/reference.pptx';
const referenceSha256=createHash('sha256').update(await fs.readFile(ref)).digest('hex');
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')));
const p=await PresentationFile.importPptx(await FileBlob.load(ref));
const originals=[...p.slides.items];
const pages=[];
const src={
 P:['Paperless Parts: product and quotation workflow','https://www.paperlessparts.com/facts/'],
 Q:['Paperless Parts: quote preparation example','https://www.paperlessparts.com/wp-content/uploads/quote-setup-solution-brief.pdf'],
 C:['Clearstory: construction change management','https://www.clearstory.build/'],
 W:['Powerplay: construction contract management','https://www.getpowerplay.in/construction-contract-management-software/'],
 X:['XOi: equipment information and guided field workflows','https://xoi.io/the-xoi-data-advantage/jobsite-workflow-management'],
 M:['MaintainX: document-grounded maintenance assistance','https://www.getmaintainx.com/blog/maintainx-assist-ai-assistant-for-maintenance']
};
function write(sh,text,size=26){sh.text=text;sh.text.style={typeface:'Helvetica Neue',fontSize:size,color:'#111111',autoFit:'none'};}
function source(s,keys){if(!keys.length)return; const box=s.shapes.add({geometry:'textbox',position:{left:42,top:613,width:1130,height:40},fill:'none',line:{fill:'none',width:0}});write(box,'Sources: '+keys.map(k=>src[k][0]).join(' / ')+'. Links in speaker notes.',14);}
function page(title,left,right,notes,keys=[]){
 const s=originals[4].duplicate();s.moveTo(p.slides.items.length-1);
 write(s.shapes.items.find(x=>x.id==='533'),title,40);
 write(s.shapes.items.find(x=>x.id==='7'),left,26);
 write(s.shapes.items.find(x=>x.id==='8'),right,26);
 write(s.shapes.items.find(x=>x.id==='532'),String(pages.length+1),12);
 const n=notes+'\n\n'+keys.map(k=>src[k].join('\n')).join('\n\n');
 s.speakerNotes.textFrame.setText(n);source(s,keys);pages.push({s,title,notes:n,left,right});return s;
}
const cover=originals[1].duplicate();cover.moveTo(p.slides.items.length-1);
write(cover.shapes.items.find(x=>x.id==='4'),'Three AI business\nideas worth testing',72);
write(cover.shapes.items.find(x=>x.id==='6'),'',18);write(cover.shapes.items.find(x=>x.id==='8'),'',18);
cover.speakerNotes.textFrame.setText('Opening, 20 seconds: We are exploring three ways AI could do useful work for businesses. These are proposed products. We have researched competitors, but we have not yet validated customer demand or built these capabilities. Today we should choose the idea we can test with real customers.');
pages.push({s:cover,title:'Three AI business ideas worth testing',notes:cover.speakerNotes.textFrame.text??'Opening: three proposed products, customer validation pending.'});
page('Three people. Three expensive problems.',
 'A factory estimator\n\n“Which drawing is current, and what does the customer actually need?”\n\nAI prepares the quotation information.',
 'A contractor and a technician\n\n“Will I get paid for this extra work?”\nAI prepares a change approval request.\n\n“Where is the right repair guidance?”\nAI finds the relevant instructions.',
 '35 seconds. An estimator is the person who prepares the price for a manufacturing job. A contractor performs work such as electrical installation or interiors. A technician inspects and repairs equipment. All examples are illustrative. The common hypothesis is that AI can turn scattered information into a useful draft, which the responsible employee checks.');
page('Idea 1: the factory quotation assistant',
 'An example customer request\n\n“Please make 500 metal brackets.”\n\nThe drawing is in a PDF. Quantities are in Excel. A later email changes the material.',
 'The expensive mistake\n\nThe estimator uses the old material specification and sends the wrong price.\n\nProposed buyer: a small fabrication company handling frequent quotations.',
 '45 seconds. Explain that a quotation is the price a business offers before accepting an order. We are proposing to start with one process, such as sheet-metal fabrication. The scenario is hypothetical, not an observed customer case. We need actual past quotation packages to determine how often revision mistakes happen and what they cost.');
page('What the factory AI would produce',
 'Information it receives\n\nDrawing + quantities + customer email + previous quotations.\n\nIt reads the files, compares revisions and flags conflicting details.',
 'Illustrative output\n\n500 brackets. Latest drawing: version 3.\nMaterial grade: missing.\nDelivery date: 20 October.\n\n“Confirm the grade before pricing.”\nThe estimator checks every detail.',
 '45 seconds. Proposed capability, not a functioning demonstration. AI document reading extracts information from text and images. Search over approved past jobs finds useful comparisons. Every important field should link to its source. Begin with explicitly stated fields; interpreting complex tolerances and geometry requires separate validation. A human sets the final price.');
page('Factory idea: business and first test',
 'Why a factory might pay\n\nLess time preparing quotations and fewer missed specifications.\n\nTest offer: ₹5,000 for a small pilot.\nThis price is a hypothesis.',
 'The test\n\nReview 20 past requests with one estimator. Compare time and missed details.\n\nPaperless Parts already serves this market. We need a specific reason for a local shop to choose us.',
 '45 seconds. Existing products establish the category, not our right to win. Paperless Parts describes manufacturing quotation and preparation workflows [sources below]. Recruit through fabrication-shop owners or industrial suppliers. A paid pilot should cover a capped number of documents. Proceed only if customers share usable data, preparation gets faster without critical omissions, and at least two shops pay. Do not build a pricing engine, full ERP or CAD cost estimator initially. Processing and onboarding costs must be measured.', ['P','Q']);
page('Idea 2: the construction change assistant',
 'The original agreement\n\nAn electrician agrees to install 50 lights.\n\nAt the site, the customer requests 10 more lights and five moved sockets.',
 'The payment problem\n\nThe team finishes the extra work. Later, the customer disputes the added bill.\n\nProposed buyer: an electrical or interior contractor running several sites.',
 '45 seconds. This is an illustrative scenario. Extra work means a change from the original agreed scope. A photo can show that work happened, but it does not by itself prove a customer approved the price. That distinction is the core of the proposed product. Ask contractors to show recent changes and their actual approval process.');
page('What the construction AI would produce',
 'Information it receives\n\nOriginal quotation + site voice note + messages + photographs.\n\nIt compares the request with the agreement and flags a possible change.',
 'Illustrative output\n\n“10 additional lights may be outside the agreed scope.”\n\nIt drafts a change request with evidence. The contractor adds the price and seeks approval before work starts.',
 '45 seconds. Voice recognition turns the supervisor’s description into text. AI compares that text with the quoted scope and organizes the supporting records. It should say possible extra work when the agreement is ambiguous. Photos cannot reliably prove exact quantities or authorization. The customer approves the scope and price, and the contractor reviews the record. No automatic claim of legal enforceability or guaranteed payment.');
page('Construction idea: business and first test',
 'Why a contractor might pay\n\nFewer forgotten changes and clearer approval records.\n\nTest offer: ₹3,000 for one project pilot.\nThis price is a hypothesis.',
 'The test\n\nReview 10 past changes. Try the approval process on one active site.\n\nClearstory and Powerplay already serve related work. Customer acceptance is the biggest unknown.',
 '45 seconds. Clearstory offers dedicated change-order workflows, and Powerplay covers construction contract management. Neither absence of competition nor a new market has been established. The proposed wedge is easier capture from everyday site communications for a narrow contractor segment. First test whether the person paying for the construction work will actually accept the approval record. Stop if refusal to approve dominates or an existing product solves it easily. Exclude a full construction platform.', ['C','W']);
page('Idea 3: the technician knowledge assistant',
 'A junior technician is on site\n\nThe machine displays an unfamiliar error. The technician searches PDFs and phones a senior colleague.\n\nProposed buyer: an equipment service company.',
 'The first useful product\n\nIdentify the exact model and find the relevant manufacturer instructions.\n\nBegin with one equipment family and a technician-reviewed set of manuals.',
 '40 seconds. This is a proposed workflow. The first product is information retrieval and documentation support. Reliable diagnosis from arbitrary sounds and videos is a much harder research task. We should not promise that capability before collecting labeled examples and testing it with qualified technicians.');
page('What the technician AI would produce',
 'Information it receives\n\nModel label + error-code photo + symptoms + approved manual.\n\nIt finds the matching instructions and asks for missing information.',
 'Illustrative output\n\n“Confirm this model number. The relevant error-code table is on page 42.”\n\nIt shows the source and drafts a service report. A qualified technician decides the next action.',
 '45 seconds. The page number here is hypothetical. No real repair advice is being provided. Recognizing a model label and retrieving the correct manual is a bounded starting task. Never treat a fluent answer as a correct diagnosis. Escalate when the model or applicable instructions are uncertain. Sound-based fault classification and video interpretation are possible later experiments, not initial promised features.');
page('Technician idea: business and first test',
 'Why a service company might pay\n\nFaster access to the right information and clearer service reports.\n\nPilot price: to test with the company after observing its workflow.',
 'The test\n\nFive technicians try 20 historical questions. A senior technician checks every answer.\n\nXOi and MaintainX already offer related tools. Domain expertise is essential.',
 '45 seconds. XOi advertises equipment identification, manuals and guided workflows. MaintainX describes assistance grounded in uploaded maintenance documents. This directly weakens any claim that a manual-search assistant is new. Recruit a service-company partner with permission to use manuals and historical records. Compare retrieval time and source correctness. A paid follow-on pilot is necessary to assess willingness to pay. Stop if expert review remains too costly or the correct manuals cannot be accessed.', ['X','M']);
const comp=originals[13].duplicate();comp.moveTo(p.slides.items.length-1);
write(comp.shapes.items.find(x=>x.id==='533'),'Which idea fits us best?',40);
write(comp.shapes.items.find(x=>x.id==='14'),'Demand is unvalidated. *Technician scope: manual lookup, not automated diagnosis.',24);
const vals=[['Decision','Factory','Construction','Technician','What matters'],['Customer','Fabrication shop','Trade contractor','Service company','Actual buyer access'],['Useful output','Quote checklist','Approval request','Sourced guidance','Work completed'],['First AI task','Read and compare','Read and compare','Find and explain','Human verification'],['Demo clarity','Good','Very good','Good','Simple example'],['Build difficulty','Medium–high','Medium','Medium*','Narrow scope'],['Main obstacle','Drawing accuracy','Approval adoption','Correct guidance','Real-world test'],['Our judgment','Strong candidate','Best first demo','Needs expert partner','Access can reorder'],['Next commitment','Past RFQ files','Active site pilot','Approved manuals','Paid pilot']];
const table=comp.tables.items[0];
for(let r=0;r<9;r++)for(let c=0;c<5;c++){table.cells.set(r,c,vals[r][c]);table.getCell(r,c).text.style={typeface:'Helvetica Neue',fontSize:19,color:'#111111',bold:r===0};}
write(comp.shapes.items.find(x=>x.id==='532'),String(pages.length+1),12);
const cn='60 seconds. *Technician difficulty refers to manual retrieval only. Diagnosis from sound or video is high difficulty and excluded from the initial pilot. We withdrew earlier numerical scores because no interviews, paid commitments or benchmark results justify that level of precision. Construction has the clearest demonstration, but our business selection should follow customer access and payment evidence. No market size, revenue or traction is claimed.';
comp.speakerNotes.textFrame.setText(cn);pages.push({s:comp,title:'Which idea fits us best?',notes:cn});
page('A two-week experiment before building',
 'Week 1: real examples\n\nChoose the idea with the easiest buyer access.\nInterview five businesses.\nCollect permissioned examples.\nFind out what they do and pay today.',
 'Week 2: useful work\n\nPrepare the result manually with AI assistance. Have the expert check it.\n\nAsk for two paid pilots. Record time, errors and willingness to continue.',
 '45 seconds. These are targets, not completed milestones. Interviews should ask about the last real incident, existing alternatives, frequency, financial impact and who controls the budget. Avoid asking only whether the idea sounds good. Pass criteria: two buyers pay, the pilot measurably improves the agreed workflow, and delivery costs leave a plausible margin. Modify or stop when access, repeat use or willingness to pay is absent. No automatic outreach or data collection has occurred.');
page('Recommendation for our peer discussion',
 'Start with construction\n\nIt gives us a clear story and a small demonstration: original quote, site request, AI draft and customer review.\n\nThis is a proposed experiment.',
 'Choose by access\n\nIf we can reach factory owners more easily, test the factory idea first.\n\nWhich customer can our group introduce this week?\nWho will share a real example?',
 '45 seconds. Suggested closing: We propose testing an assistant that turns site requests into clear extra-work approval drafts. Our next goal is two paid pilots, not a large platform. If our strongest contacts are in manufacturing, we will instead test quotation preparation. We want peers to help identify a reachable customer and challenge the hardest assumption. This is an idea-selection presentation, not an investor deck claiming traction.');
page('Research references',
 'Manufacturing and construction\n\nPaperless Parts: product overview and quote-preparation brief.\n\nClearstory: change-order management.\n\nPowerplay: contract management.',
 'Technician support\n\nXOi: jobsite workflows and equipment information.\n\nMaintainX: maintenance assistance using uploaded documents.\n\nFull clickable URLs are in the notes and companion guide.',
 'Sources reviewed during this research. Access date: 10 September 2026. Vendor pages establish advertised capabilities, not independent proof of effectiveness or demand for our proposed product. All price suggestions and examples in this deck are hypotheses or illustrations.\n\n'+Object.values(src).map(x=>x.join('\n')).join('\n\n'));
for(const s of originals)s.delete();
await fs.mkdir(path.join(root,'.build/peer-previews'),{recursive:true});
for(let i=0;i<pages.length;i++){
 const b=await pages[i].s.export({format:'png',scale:1});
 await fs.writeFile(path.join(root,`.build/peer-previews/slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await b.arrayBuffer()));
}
const draft=path.join(root,'.build/peer-draft.pptx');
await(await PresentationFile.exportPptx(p)).save(draft);
const result=await finalizePresentation({workspaceDir:root,candidatePath:draft,finalPath:path.join(root,'output/AI-business-ideas-peer-presentation.pptx'),pythonExecutable:'/Users/rizwin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit','--require-native-table-slide','12'],requiredNativeTableOwnerSlides:[12],fontPolicy:{basis:'reference',families:['Helvetica Neue'],referencePath:ref,referenceSha256},verifyArtifactToolImport:true,receiptPath:path.join(root,'.build/peer-validation.json')});
console.log(JSON.stringify(result));
await fs.writeFile(path.join(root,'output/Presenter-guide.md'),'# Three AI business ideas worth testing\n\nSuggested delivery: 8–10 minutes, followed by peer discussion. The slides compare proposed products. No customer validation or working capabilities are claimed.\n\n'+pages.map((x,i)=>`## Slide ${i+1}: ${x.title}\n\n${x.notes}`).join('\n\n'));
