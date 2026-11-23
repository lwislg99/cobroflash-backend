import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const raiz=process.argv[2];
const {generateInvoicePdf}=await import(pathToFileURL(path.join(raiz,'dist/modules/invoicing/infra/pdf/pdf.service.js')).href);
for (const [tag,due] of [['dic','2026-12-23T12:00:00.000Z'],['sep','2026-09-30T12:00:00.000Z']]){
const {outPath}=await generateInvoicePdf({number:'F-2026-QA1787T-'+tag,invoiceId:1787,merchantId:1787,
merchant:{name:'Oficio Ficticio',legalName:'Oficio Ficticio SL',taxId:'B00000000',address:'Calle Inventada 1, 28000 Ciudad Ficticia'},
customer:{name:'Cliente QA',email:'cliente@ejemplo.invalid'},currency:'EUR',total:'121.00',qrData:'',type:'F1',
createdAt:new Date('2026-11-05T10:00:00.000Z'),lines:[{concept:'Mano de obra',qty:1,price:100,tax:0.21}],
zona:'Europe/Madrid',merchantCriterioCaja:null,dueDate:new Date(due),payMethods:['card','bizum','transfer']});
const dst='C:/Users/Public/tmp-jv-j1ia/1787t-'+tag+'.pdf';fs.copyFileSync(outPath,dst);fs.rmSync(outPath,{force:true});
console.log(dst,fs.statSync(dst).size);}
