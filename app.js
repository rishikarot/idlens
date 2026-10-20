/* ID Lens v3.0.0 — browser-local QR + face comparison; not official UIDAI authentication. */
(()=>{'use strict';
const $ = id => document.getElementById(id);
const APP_VERSION = '3.0.0';
const DEFAULTS={success:80,review:72,model:'enhanced'};
const CACHE_PREFIX='id-lens-update-';
let qrStream=null,selfieStream=null,scanTimer=null,qrGeneration=0,session=0;
let currentSource=null,crop=null,pointer=null,zoom=1,panX=0,panY=0,moveImage=false,rotate=0;
let ref='',selfie='',sourceType='',qrReady=false,portraitFound=false,faceModelPromise=null,modelLoaded='';
let lastDistance=null,knownRefSource='none';
const LIMITS={zip:50000,raw:180000};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function info(id,message,kind=''){const el=$(id);el.className='status'+(kind?' '+kind:'');el.textContent=message}
function showResult(title,pct,description,kind=''){
 const el=$('result');el.className='result'+(kind?' '+kind:'');$('resultName').textContent=title;
 $('matchPct').textContent=pct==null?'—':pct+'%';$('matchBar').style.width=pct==null?'0%':pct+'%';$('resultInfo').textContent=description;
}
function settings(){let s={...DEFAULTS};try{const raw=JSON.parse(localStorage.getItem('idlens-v3-settings')||'{}');
 s.success=clamp(Math.round(Number(raw.success)||80),65,95);s.review=clamp(Math.round(Number(raw.review)||72),50,90);
 if(['enhanced','fast','updated'].includes(raw.model))s.model=raw.model;}catch(e){}
 if(s.review>=s.success)s.review=s.success-1;return s;}
let prefs=settings();
function saved(){try{localStorage.setItem('idlens-v3-settings',JSON.stringify(prefs))}catch(e){}}
function updatedPack(){try{return JSON.parse(localStorage.getItem('idlens-v3-pack')||'null')}catch(e){return null}}
function refreshControls(){const enabled=qrReady;$('facePanel').classList.toggle('locked',!enabled);
 $('step1').className='step '+(enabled?'done':'current');$('step2').className='step '+(enabled?'current':'');
 $('faceTag').textContent=!enabled?'Waiting for QR':portraitFound?'QR photo ready':sourceType==='demo'?'Demo ready':'QR photo unavailable';
 $('openSelfie').disabled=!enabled;$('matchButton').disabled=!(enabled&&ref&&selfie&&$('consent').checked);}
function clearPictures(){ref='';selfie='';portraitFound=false;knownRefSource='none';lastDistance=null;
 for(const [img,empty] of [['refImg','refEmpty'],['selfieImg','selfieEmpty']]){$(img).removeAttribute('src');$(img).classList.add('hidden');$(empty).classList.remove('hidden')}
 showResult('Not compared',null,'A QR reference portrait and current selfie are required for a QR-photo comparison.');refreshControls();}
function setPicture(type,url,origin='manual'){
 if(type==='ref'){ref=url;portraitFound=(origin==='qr');knownRefSource=origin;$('refImg').src=url;$('refImg').classList.remove('hidden');$('refEmpty').classList.add('hidden');}
 else{selfie=url;$('selfieImg').src=url;$('selfieImg').classList.remove('hidden');$('selfieEmpty').classList.add('hidden')}
 lastDistance=null;showResult('Ready for comparison',null,'Two photos selected. Results will be labelled as QR-photo or manual-photo tests.');
 photoFallback();refreshControls();
}
function photoFallback(){const yes=!portraitFound&&qrReady;$('fallbackLabel').classList.toggle('hidden',!yes);
 $('refInfo').textContent=portraitFound?'Embedded Aadhaar QR portrait · signature not verified':knownRefSource==='manual'?'Uploaded reference photo · demo only':sourceType==='demo'?'Synthetic details: use test reference photo':'QR photo unavailable; manually uploaded reference is for demo only';}
function finishIdentity(d,demo=false){stopQr();closeSelfie();clearPictures();qrReady=true;sourceType=demo?'demo':'qr';
 $('detailsBlock').classList.remove('hidden');const address=[d.careof,d.house,d.street,d.landmark,d.location,d.vtc,d.postoffice,d.subdistrict,d.district,d.state].filter(Boolean).join(', ');
 for(const [id,value] of Object.entries({dName:d.name||'—',dNumber:d.last4?'XXXX XXXX '+d.last4:'Unavailable',dDob:d.dob||'—',dGender:({M:'Male',F:'Female',T:'Transgender'}[String(d.gender||'').toUpperCase()]||d.gender||'—'),dPin:d.pincode||'—',dAddress:address||'—',dRefDate:d.refDate||'—'}))$(id).textContent=value;
 $('identityTag').textContent=demo?'Sample data':'QR decoded';$('identityTag').className='tag '+(demo?'':'good');$('signatureTag').textContent=demo?'Synthetic only':'UIDAI signature unchecked';
 info('qrStatus',demo?'Synthetic record loaded. Upload two photos for a demo.':'QR demographics extracted. Extracting the embedded JPEG 2000 photograph…','ok');
 info('faceStatus','Provide current selfie and consent; compare locally.');photoFallback();refreshControls();
}
function decimalBytes(str){const s=str.trim();if(!/^\d{50,12000}$/.test(s))throw Error('Expected a long Aadhaar Secure QR numeric value, not the 12-digit Aadhaar number.');
 let hex=BigInt(s).toString(16);if(hex.length%2)hex='0'+hex;if(hex.length/2>LIMITS.zip)throw Error('Secure QR exceeds limit');
 const b=new Uint8Array(hex.length/2);for(let i=0;i<b.length;i++)b[i]=parseInt(hex.slice(i*2,i*2+2),16);return b;}
async function gunzip(bytes){if(!window.DecompressionStream)throw Error('This browser does not support native gzip decompression.');
 const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();let size=0,chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>LIMITS.raw)throw Error('Expanded QR is too large');chunks.push(value)}}finally{try{reader.releaseLock()}catch(e){}}
 const out=new Uint8Array(size);let offset=0;for(const part of chunks){out.set(part,offset);offset+=part.length}return out;}
function seek(bytes,sequence,from=0){outer:for(let i=from;i<=bytes.length-sequence.length;i++){for(let j=0;j<sequence.length;j++)if(bytes[i+j]!==sequence[j])continue outer;return i}return -1;}
function secureFields(raw){const names=['flags','refId','name','dob','gender','careof','district','landmark','house','location','pincode','postoffice','state','street','subdistrict','vtc'];
 const details={};const decoder=new TextDecoder('utf-8');let pos=0;
 if(raw[0]===86&&raw[1]>=48&&raw[1]<=57){const end=raw.indexOf(255);if(end<0||end>9)throw Error('Unknown Secure QR version');details.version=decoder.decode(raw.slice(0,end));pos=end+1;}
 for(const name of names){const end=raw.indexOf(255,pos);if(end<0||end-pos>2000)throw Error('QR payload has incomplete demographic fields');details[name]=decoder.decode(raw.slice(pos,end));pos=end+1;}
 if(details.version){const end=raw.indexOf(255,pos);if(end>pos&&end-pos<=4){const v=decoder.decode(raw.slice(pos,end));if(/^\d{1,4}$/.test(v)){details.mobileLast4=v;pos=end+1}}}
 if(!/^\d{4}/.test(details.refId||''))throw Error('QR has invalid reference ID');details.last4=details.refId.slice(0,4);
 if(details.refId.length>=21){const stamp=details.refId.slice(4,21);if(/^20\d{15}$/.test(stamp))details.refDate=stamp.slice(6,8)+'-'+stamp.slice(4,6)+'-'+stamp.slice(0,4)}
 return {details,offset:pos};}
function getPhotoBytes(raw,offset,flags){const skip=(flags==='1'||flags==='3'?32:0)+(flags==='2'||flags==='3'?32:0);
 const endLimit=Math.max(offset,raw.length-256-skip),a=seek(raw,[255,79,255,81],offset),b=seek(raw,[0,0,0,12,106,80,32,32,13,10,135,10],offset);
 let start=-1,suffix='j2k';if(b>=offset&&(a<0||b<a)){start=b;suffix='jp2'}else if(a>=offset)start=a;
 if(start<0)return null;if(start-offset>30)throw Error('Unexpected Aadhaar portrait field format');let end=endLimit;
 if(suffix==='j2k'){const e=seek(raw,[255,217],start+4);if(e>=0)end=Math.min(endLimit,e+2)}if(end-start<35)throw Error('Embedded portrait is incomplete');return{bytes:raw.slice(start,end),suffix};}
async function decodePhoto(obj,token){if(typeof window.openjpeg!=='function')throw Error('Local JPEG 2000 decoder missing. Deploy bundled assets first.');
 const data=window.openjpeg(Array.from(obj.bytes),obj.suffix);if(token!==session)return null;
 if(!data||data.error||!data.width||!data.height)throw Error(data?.error||'Decoder could not read QR portrait');
 const w=data.width,h=data.height,n=w*h;if(n>4000000||!data.data||data.data.length<n*3)throw Error('Unexpected JPEG 2000 image data');
 const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');const pix=ctx.createImageData(w,h);
 for(let i=0;i<n;i++){pix.data[i*4]=data.data[i];pix.data[i*4+1]=data.data[n+i];pix.data[i*4+2]=data.data[n*2+i];pix.data[i*4+3]=255}ctx.putImageData(pix,0,0);return c.toDataURL('image/png');}
async function decodeNumeric(s){const token=++session;info('qrStatus','Decoding Secure QR…');try{
 const packed=decimalBytes(s);if(packed[0]!==31||packed[1]!==139)throw Error('Not a supported gzip Aadhaar Secure QR');
 const raw=await gunzip(packed);if(token!==session)return;const {details,offset}=secureFields(raw);finishIdentity(details,false);
 const jpeg=getPhotoBytes(raw,offset,details.flags);if(!jpeg){info('qrStatus','Details decoded but embedded QR portrait not found; manual reference is demo-only.');return;}
 try{info('qrStatus','Converting QR photograph locally…');const url=await decodePhoto(jpeg,token);if(token!==session||!url)return;setPicture('ref',url,'qr');info('qrStatus','QR demographics and embedded photo extracted. Signature not verified.','ok')}
 catch(e){if(token===session)info('qrStatus','Details decoded, but embedded JPEG 2000 portrait could not be extracted: '+e.message,'error')}
 }catch(e){if(token===session)info('qrStatus',e.message,'error')}}
function scaledCanvas(src,x,y,w,h,max){const c=document.createElement('canvas');const ratio=Math.min(1,max/Math.max(w,h));c.width=Math.max(1,Math.round(w*ratio));c.height=Math.max(1,Math.round(h*ratio));
 c.getContext('2d',{willReadFrequently:true}).drawImage(src,x,y,w,h,0,0,c.width,c.height);return c;}
async function qrFromCanvas(canvas){if('BarcodeDetector' in window){try{const codes=await new BarcodeDetector({formats:['qr_code']}).detect(canvas);if(codes.length&&codes[0].rawValue)return codes[0].rawValue}catch(e){}}
 if(typeof window.jsQR!=='function')throw Error('Offline QR reader not yet installed. Deploy bundled assets.');
 const pixels=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height);
 return window.jsQR(pixels.data,canvas.width,canvas.height,{inversionAttempts:'attemptBoth'})?.data||null;}
async function scanImageRegion(src,x=0,y=0,w=src.width,h=src.height){
 // Scan original image at high resolution first, then a center/corner grid for dense printed QR.
 const cases=[[x,y,w,h,2400]];
 if(w>900&&h>900){const bw=w*.7,bh=h*.7;for(const [dx,dy] of [[0,0],[1,0],[0,1],[1,1],[.5,.5]])cases.push([x+dx*(w-bw),y+dy*(h-bh),bw,bh,1950]);}
 for(const [px,py,pw,ph,max] of cases){const canvas=scaledCanvas(src,px,py,pw,ph,max);let value=await qrFromCanvas(canvas);if(value)return value;
  // local contrast boost for low-quality prints; no original pixels are overwritten.
  if(Math.max(canvas.width,canvas.height)<=2000){const ctx=canvas.getContext('2d',{willReadFrequently:true}),pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
   const d=pixels.data;for(let i=0;i<d.length;i+=4){const gray=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]);const v=clamp((gray-128)*1.55+128,0,255);d[i]=d[i+1]=d[i+2]=v;}ctx.putImageData(pixels,0,0);value=await qrFromCanvas(canvas);if(value)return value;}
  await new Promise(r=>setTimeout(r,0));}
 return null;}
// Crop editor uses coordinates of the ORIGINAL uploaded image; zoom and pan affect only its preview.
function previewSource(src){currentSource=src;crop=null;zoom=1;panX=0;panY=0;moveImage=false;
 $('cropMoveMode').textContent='Move image: OFF';$('sourceWrap').classList.remove('hidden');const c=$('sourceCanvas');const ratio=Math.min(1,900/src.width,620/src.height);
 c.width=Math.max(1,Math.round(src.width*ratio));c.height=Math.max(1,Math.round(src.height*ratio));sizeCropElement();drawPreview();}
function sizeCropElement(){const c=$('sourceCanvas');if(!c.width||!c.height)return;const available=Math.max(200,c.parentElement.clientWidth-4);const k=Math.min(1,available/c.width,530/c.height);c.style.width=Math.round(c.width*k)+'px';c.style.height=Math.round(c.height*k)+'px';}
function transform(){const c=$('sourceCanvas'),s=Math.min(c.width/currentSource.width,c.height/currentSource.height)*zoom;
 return{scale:s,x:(c.width-currentSource.width*s)/2+panX,y:(c.height-currentSource.height*s)/2+panY}}
function pointOnCanvas(e){const c=$('sourceCanvas'),r=c.getBoundingClientRect();return{x:clamp((e.clientX-r.left)*c.width/r.width,0,c.width),y:clamp((e.clientY-r.top)*c.height/r.height,0,c.height)}}
function sourcePoint(p){const t=transform();return{x:clamp((p.x-t.x)/t.scale,0,currentSource.width),y:clamp((p.y-t.y)/t.scale,0,currentSource.height)}}
function displayRect(r){const t=transform();return{x:t.x+r.x*t.scale,y:t.y+r.y*t.scale,w:r.w*t.scale,h:r.h*t.scale}}
function drawPreview(){if(!currentSource)return;const c=$('sourceCanvas'),ctx=c.getContext('2d');const t=transform();ctx.fillStyle='#e5e5e2';ctx.fillRect(0,0,c.width,c.height);
 ctx.drawImage(currentSource,t.x,t.y,currentSource.width*t.scale,currentSource.height*t.scale);
 if(crop&&crop.w>2&&crop.h>2){const r=displayRect(crop);ctx.beginPath();ctx.rect(0,0,c.width,c.height);ctx.rect(r.x,r.y,r.w,r.h);ctx.fillStyle='rgba(12,12,12,.38)';ctx.fill('evenodd');
 ctx.strokeStyle='#0877ed';ctx.lineWidth=2.5;ctx.strokeRect(r.x,r.y,r.w,r.h);
 for(const [cx,cy] of [[r.x,r.y],[r.x+r.w,r.y],[r.x,r.y+r.h],[r.x+r.w,r.y+r.h]]){ctx.fillStyle='#fff';ctx.fillRect(cx-5,cy-5,10,10);ctx.strokeRect(cx-5,cy-5,10,10)}
 }$('cropZoom').textContent=Math.round(zoom*100)+'%';drawCropPreview();}
function drawCropPreview(){const c=$('croppedCanvas'),ctx=c.getContext('2d');c.width=300;c.height=210;ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
 if(!currentSource||!crop||crop.w<10||crop.h<10)return;const fit=Math.min(c.width/crop.w,c.height/crop.h),rw=crop.w*fit,rh=crop.h*fit;
 ctx.drawImage(currentSource,crop.x,crop.y,crop.w,crop.h,(c.width-rw)/2,(c.height-rh)/2,rw,rh);}
function cropPointerDown(e){if(!currentSource)return;e.preventDefault();const p=pointOnCanvas(e),s=sourcePoint(p),bounds={x:s.x,y:s.y};
 let action='new',corner='';if(moveImage)action='pan';else if(crop){const dr=displayRect(crop);for(const [key,hx,hy] of [['tl',dr.x,dr.y],['tr',dr.x+dr.w,dr.y],['bl',dr.x,dr.y+dr.h],['br',dr.x+dr.w,dr.y+dr.h]]){if(Math.hypot(p.x-hx,p.y-hy)<23){action='resize';corner=key;break}}
 if(action==='new'&&p.x>=dr.x&&p.x<=dr.x+dr.w&&p.y>=dr.y&&p.y<=dr.y+dr.h)action='move';}
 pointer={action,corner,p,bounds,original:crop?{...crop}:null,startPan:{x:panX,y:panY}};
 if(action==='new')crop={x:s.x,y:s.y,w:0,h:0};$('sourceCanvas').setPointerCapture(e.pointerId);drawPreview();}
function cropPointerMove(e){if(!pointer||!currentSource)return;e.preventDefault();const p=pointOnCanvas(e),s=sourcePoint(p),a=pointer;
 if(a.action==='pan'){panX=a.startPan.x+(p.x-a.p.x);panY=a.startPan.y+(p.y-a.p.y)}
 else if(a.action==='new'){crop={x:Math.min(a.bounds.x,s.x),y:Math.min(a.bounds.y,s.y),w:Math.abs(a.bounds.x-s.x),h:Math.abs(a.bounds.y-s.y)}}
 else if(a.action==='move'){const dx=s.x-a.bounds.x,dy=s.y-a.bounds.y;crop={...a.original,x:clamp(a.original.x+dx,0,currentSource.width-a.original.w),y:clamp(a.original.y+dy,0,currentSource.height-a.original.h)}}
 else if(a.action==='resize'){const orig=a.original,x1=a.corner.includes('l')?s.x:orig.x,x2=a.corner.includes('r')?s.x:orig.x+orig.w;
 const y1=a.corner.includes('t')?s.y:orig.y,y2=a.corner.includes('b')?s.y:orig.y+orig.h;
 crop={x:Math.min(x1,x2),y:Math.min(y1,y2),w:Math.abs(x2-x1),h:Math.abs(y2-y1)};}
 drawPreview();}
function cropPointerEnd(){pointer=null;if(crop&&(crop.w<12||crop.h<12))crop=null;drawPreview();}
async function processCanvas(src,label=''){previewSource(src);info('qrStatus',label+'Looking for Secure QR…');
 try{const numeric=await scanImageRegion(src);if(numeric)await decodeNumeric(numeric);else info('qrStatus','QR not found automatically. Use the optional crop editor: select the QR, zoom and press Scan selected area.','error');}
 catch(e){info('qrStatus','QR scan error: '+e.message,'error')}}
async function readImage(file){const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();if(img.naturalWidth*img.naturalHeight>45000000)throw Error('Image resolution too large');const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);return c}finally{URL.revokeObjectURL(url)}}
async function processFile(file){if(!file)return;stopQr();++session;try{if(file.size>25*1024*1024)throw Error('File too large (25 MB limit)');
 if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
 if(!window.pdfjsLib)throw Error('Local PDF reader unavailable; deploy assets first');info('qrStatus','Opening PDF…');
 const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),disableWorker:true}).promise;let last=null;
 for(let i=1;i<=Math.min(pdf.numPages,3);i++){info('qrStatus',`Reading PDF page ${i}…`);const page=await pdf.getPage(i),vp=page.getViewport({scale:3});const c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);
 await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;last=c;const payload=await scanImageRegion(c);
 if(payload){previewSource(c);await decodeNumeric(payload);return;}}
 if(last)previewSource(last);info('qrStatus','QR not found automatically in first 3 PDF pages. Crop the visible QR and rescan.','error');return;}
 if(!file.type.startsWith('image/'))throw Error('Select Aadhaar QR image or PDF');await processCanvas(await readImage(file));
 }catch(e){info('qrStatus','Unable to open document: '+e.message,'error')}}
async function scanCrop(useFull=false){if(!currentSource)return info('qrStatus','Upload an image/PDF first.','error');
 const r=!useFull&&crop?crop:{x:0,y:0,w:currentSource.width,h:currentSource.height};info('qrStatus',`Scanning ${Math.round(r.w)}×${Math.round(r.h)} source pixels…`);
 try{const result=await scanImageRegion(currentSource,r.x,r.y,r.w,r.h);if(!result)throw Error('No readable QR in selected pixels. Zoom in, resize selection or use a clearer image.');await decodeNumeric(result)}
 catch(e){info('qrStatus',e.message,'error')}}
function stopQr(){++qrGeneration;if(scanTimer)clearTimeout(scanTimer);scanTimer=null;if(qrStream){qrStream.getTracks().forEach(t=>t.stop());qrStream=null;}
 $('qrVideo').srcObject=null;$('qrVideo').classList.add('hidden');$('qrPlaceholder').classList.remove('hidden');$('stopQr').classList.add('hidden');$('scanQr').classList.remove('hidden')}
async function startQr(){stopQr();closeSelfie();try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Browser camera requires HTTPS/localhost');
 qrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});$('qrVideo').srcObject=qrStream;await $('qrVideo').play();
 $('qrPlaceholder').classList.add('hidden');$('qrVideo').classList.remove('hidden');$('stopQr').classList.remove('hidden');$('scanQr').classList.add('hidden');
 const tag=++qrGeneration;info('qrStatus','Rear camera active: hold a high-resolution Aadhaar Secure QR steady.');
 async function loop(){if(!qrStream||tag!==qrGeneration)return;try{const v=$('qrVideo');if(v.videoWidth){const image=scaledCanvas(v,0,0,v.videoWidth,v.videoHeight,1600);const payload=await qrFromCanvas(image);
 if(payload){stopQr();await decodeNumeric(payload);return;}}}catch(e){if(tag===qrGeneration){stopQr();info('qrStatus',e.message,'error')}return}scanTimer=setTimeout(loop,450)}scanTimer=setTimeout(loop,430);
 }catch(e){stopQr();info('qrStatus',e.message+'. Upload the QR image instead.','error')}}
function closeSelfie(){if(selfieStream){selfieStream.getTracks().forEach(t=>t.stop());selfieStream=null;}$('selfieVideo').srcObject=null;
 $('selfieVideo').classList.add('hidden');$('captureSelfie').classList.add('hidden');$('closeSelfie').classList.add('hidden');$('openSelfie').classList.remove('hidden');}
async function openSelfie(){if(!qrReady)return;closeSelfie();stopQr();try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Front camera unavailable (HTTPS required)');
 selfieStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'},width:{ideal:1280}},audio:false});$('selfieVideo').srcObject=selfieStream;await $('selfieVideo').play();
 $('selfieVideo').classList.remove('hidden');$('captureSelfie').classList.remove('hidden');$('closeSelfie').classList.remove('hidden');$('openSelfie').classList.add('hidden');info('faceStatus','Remove glare, face forward, keep your eyes visible, then capture a selfie.');
 }catch(e){closeSelfie();info('faceStatus',e.message+'. Try Upload / Take selfie.','error')}}
function captureSelfie(){const v=$('selfieVideo');if(!v.videoWidth)return info('faceStatus','Camera not ready','error');const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;
 const ctx=c.getContext('2d');ctx.translate(c.width,0);ctx.scale(-1,1);ctx.drawImage(v,0,0);setPicture('selfie',c.toDataURL('image/jpeg',.93));closeSelfie();$('selfieInfo').textContent='Captured from camera · liveness not checked';info('faceStatus','Selfie captured. Compare after confirming consent.','ok')}
async function readPhoto(file,type){if(!file)return;try{if(!file.type.startsWith('image/'))throw Error('Choose a photo');if(file.size>15*1024*1024)throw Error('Photo exceeds 15 MB');
 const image=await readImage(file);const resized=scaledCanvas(image,0,0,image.width,image.height,1500);setPicture(type,resized.toDataURL('image/jpeg',.94),'manual');
 if(type==='ref')$('refInfo').textContent='Manual reference; NOT the Aadhaar QR portrait. Demo only.';
 else $('selfieInfo').textContent='Uploaded picture, not a live image';info('faceStatus','Photo loaded locally.','ok');}
 catch(e){info('faceStatus','Photo error: '+e.message,'error')}}
function enhancePortrait(img){const w=img.naturalWidth,h=img.naturalHeight;if(Math.min(w,h)>=320)return img;
 const scale=Math.min(5,Math.max(1,Math.ceil(360/Math.min(w,h))));const c=document.createElement('canvas');c.width=w*scale;c.height=h*scale;
 const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,c.width,c.height);return c;}
async function faceModels(){if(faceModelPromise)return faceModelPromise;
 faceModelPromise=(async()=>{if(!window.faceapi)throw Error('face-api.js bundle not found. GitHub Actions must deploy ./assets/vendor/face-api.min.js');
 const m=prefs.model==='updated'&&updatedPack()?updatedPack():null;
 if(prefs.model==='updated'&&!m){prefs.model='enhanced';saved()}
 const base=m?'./model-updates/'+m.id:'./assets/models';
 if(m&&!navigator.serviceWorker?.controller)throw Error('Updated model requires active offline service worker. Reload the page.');
 if(prefs.model==='fast')await Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri(base),faceapi.nets.faceLandmark68TinyNet.loadFromUri(base),faceapi.nets.faceRecognitionNet.loadFromUri(base)]);
 else await Promise.all([faceapi.nets.ssdMobilenetv1.loadFromUri(base),faceapi.nets.faceLandmark68Net.loadFromUri(base),faceapi.nets.faceRecognitionNet.loadFromUri(base)]);
 modelLoaded=m?`Updated ${m.version}`:prefs.model==='fast'?'Bundled fast':'Bundled enhanced';$('activeModelLabel').textContent=modelLoaded+' · recognition model ResNet-34-like (128D)';
 })().catch(e=>{faceModelPromise=null;throw e});return faceModelPromise;}
function similarityIndex(distance){return clamp(Math.round((1.3-distance)*100),0,100)}
function labelFor(distance){const p=similarityIndex(distance);return p>=prefs.success?'match':p>=prefs.review?'review':'fail'}
function renderDistance(distance){const score=similarityIndex(distance),state=labelFor(distance);
 const isQR=knownRefSource==='qr';let title=state==='match'?(isQR?'FACE MATCH · SUCCESS':'PHOTO TEST · MATCH'):state==='review'?'REVIEW REQUIRED':'FACE MATCH · FAILURE';
 const description=`Distance ${distance.toFixed(3)}. Similarity index ${score}% (not identity probability). `+
 `Current rules: success ≥${prefs.success}%, review ${prefs.review}–${prefs.success-1}%, failure <${prefs.review}%. `+
 (isQR?'Reference originated in the QR; UIDAI signature unchecked.':'Reference was uploaded manually: demo only.')+
 ' No liveness detection.';
 showResult(title,score,description,state==='match'?'success':state==='review'?'review':'fail');}
async function compare(){if(!qrReady||!ref||!selfie||!$('consent').checked)return info('faceStatus','Scan QR, provide a reference and selfie, and confirm consent.','error');
 $('matchButton').disabled=true;$('matchButton').textContent='Preparing offline face model…';info('faceStatus','Loading local face model. First load can take several seconds, especially on phones.');
 try{await faceModels();await Promise.all([$('refImg').decode(),$('selfieImg').decode()]);$('matchButton').textContent='Comparing facial features…';
 const src=enhancePortrait($('refImg'));
 const detectOptions=prefs.model==='fast'?new faceapi.TinyFaceDetectorOptions({inputSize:608,scoreThreshold:.22}):new faceapi.SsdMobilenetv1Options({minConfidence:.35,maxResults:5});
 // Sequential inference helps limit RAM pressure on older iPhones.
 const a=await faceapi.detectAllFaces(src,detectOptions).withFaceLandmarks(prefs.model==='fast').withFaceDescriptors();
 const b=await faceapi.detectAllFaces($('selfieImg'),detectOptions).withFaceLandmarks(prefs.model==='fast').withFaceDescriptors();
 if(a.length!==1||b.length!==1)throw Error(`Exactly one face required in each photo (found reference ${a.length}, selfie ${b.length}). Improve lighting/angle or recapture.`);
 if(a[0].detection.score<.40||b[0].detection.score<.40)throw Error('One photo has low face detection confidence; use a clearer photo');
 lastDistance=faceapi.euclideanDistance(a[0].descriptor,b[0].descriptor);renderDistance(lastDistance);
 info('faceStatus','Face embeddings compared locally. Spectacles, glare and low-resolution QR photos can affect the score.','ok');}
 catch(e){lastDistance=null;showResult('Comparison unavailable',null,e.message);info('faceStatus',e.message,'error')}
 finally{$('matchButton').textContent='◎ Compare face & show result';refreshControls()}}
function reset(){++session;stopQr();closeSelfie();qrReady=false;sourceType='';currentSource=null;crop=null;clearPictures();$('sourceWrap').classList.add('hidden');$('detailsBlock').classList.add('hidden');
 $('identityTag').textContent='Not scanned';$('identityTag').className='tag';for(const id of ['cardFile','qrFile','refFile','selfieFile','qrRaw'])$(id).value='';
 $('consent').checked=false;info('qrStatus','Ready to scan. Offline libraries are served with this app.');info('faceStatus','Step 2 becomes available after QR/demo data is loaded.');refreshControls();}
// Accuracy display is an adjustable decision aid, NOT biometric probability or measured classification accuracy.
function syncThresholdUI(){if(prefs.review>=prefs.success)prefs.review=prefs.success-1;
 $('successThreshold').value=prefs.success;$('reviewThreshold').value=prefs.review;$('successValue').textContent=prefs.success+'%';$('reviewValue').textContent=prefs.review+'%';
 $('logicText').textContent=`Model computes two 128-dimensional face embeddings. Euclidean distance d (lower means closer). Displayed similarity index = clamp(round((1.30 − d) × 100), 0, 100). Success ≥ ${prefs.success}%; manual review ${prefs.review}%–${prefs.success-1}%; failure below ${prefs.review}%. Example: d = 0.55 → 75% index. Threshold adjustments change the decision, NOT the neural-network output or measured accuracy. Looser thresholds increase false-acceptance risk. No biometric validation has been performed.`;
 saved();if(lastDistance!==null)renderDistance(lastDistance);}
function setPreset(success,review){prefs.success=success;prefs.review=review;syncThresholdUI()}
function activeModelStatus(){const pack=updatedPack();$('modelChoice').querySelector('option[value="updated"]').disabled=!pack;
 if(prefs.model==='updated'&&!pack){prefs.model='enhanced';saved()}
 $('modelChoice').value=prefs.model;$('modelStatusBadge').textContent=pack?'Optional update saved':'Bundled default';
 $('activeModelLabel').textContent=prefs.model==='fast'?'Bundled Tiny detector + tiny landmark + recognition':prefs.model==='updated'?`Updated model: ${pack?.version||'—'}`:'Bundled SSD detector + full landmark + recognition';}
async function checkUpdateChannel(){info('modelManagerStatus','Checking update channel (requires internet)…');try{
 const response=await fetch('./updates/channel.json',{cache:'no-store'});if(!response.ok)throw Error('Update channel unavailable');const data=await response.json();
 if(typeof data.latest!=='string'||!data.latest){info('modelManagerStatus','No newer compatible model published for this app. You can still enter your own verified manifest URL.');return;}
 $('modelManifestUrl').value=data.latest;info('modelManagerStatus','Compatible model URL found. Tap Download & install update to fetch it.','ok');
 }catch(e){info('modelManagerStatus',e.message,'error')}}
function hexHash(buf){return crypto.subtle.digest('SHA-256',buf).then(raw=>Array.from(new Uint8Array(raw)).map(x=>x.toString(16).padStart(2,'0')).join(''))}
async function installUpdate(){const btn=$('installModel');btn.disabled=true;try{
 const u=new URL($('modelManifestUrl').value.trim());if(u.protocol!=='https:')throw Error('Model update manifest must use HTTPS');
 if(!('caches' in window)||!crypto.subtle||!('serviceWorker' in navigator))throw Error('Model updates need HTTPS and a browser with CacheStorage + Service Worker support');
 info('modelManagerStatus','Reading compatible pack manifest…');const res=await fetch(u.href,{cache:'no-store'});if(!res.ok)throw Error('Manifest request failed: '+res.status);
 const body=await res.json();if(body.engine!=='face-api.js@0.22.2'||!Array.isArray(body.files)||body.files.length<6||body.files.length>30)throw Error('Pack must declare face-api.js@0.22.2 and list model files with SHA-256');
 const id=String(body.id||'').toLowerCase();if(!/^[a-z0-9-]{4,48}$/.test(id)||id==='default')throw Error('Invalid pack ID');
 const names=new Set(),need=['ssd_mobilenetv1_model-weights_manifest.json','face_landmark_68_model-weights_manifest.json','face_recognition_model-weights_manifest.json'];
 for(const f of body.files){if(!/^[a-z0-9_-]+(?:\.json)?$/i.test(f.name)||!/^([a-f0-9]{64})$/.test(f.sha256)||names.has(f.name))throw Error('Invalid file name, SHA-256 or duplicate in pack');names.add(f.name)}
 if(need.some(n=>!names.has(n)))throw Error('Missing enhanced pipeline model manifests');
 const cacheName=CACHE_PREFIX+id;await caches.delete(cacheName);const cache=await caches.open(cacheName);let total=0;
 try{for(let i=0;i<body.files.length;i++){const f=body.files[i];const fileUrl=new URL(f.url||f.name,u.href);if(fileUrl.protocol!=='https:')throw Error('Update files must use HTTPS');
 info('modelManagerStatus',`Downloading and validating model files ${i+1}/${body.files.length}: ${f.name}`);
 const response=await fetch(fileUrl.href,{cache:'no-store'});if(!response.ok)throw Error('Download error for '+f.name+': '+response.status);
 const bytes=await response.arrayBuffer();total+=bytes.byteLength;if(bytes.byteLength>25e6||total>90e6)throw Error('Model pack exceeds size limit');
 if(await hexHash(bytes)!==f.sha256)throw Error('SHA-256 mismatch: '+f.name);const mime=f.name.endsWith('.json')?'application/json':'application/octet-stream';
 const req=new Request(new URL('./model-updates/'+id+'/'+f.name,location.href));await cache.put(req,new Response(bytes,{headers:{'Content-Type':mime}}));
 }}catch(e){await caches.delete(cacheName);throw e}
 // Check that every model manifest lists shard files that were actually downloaded.
 for(const manifestName of need){const v=await cache.match(new URL('./model-updates/'+id+'/'+manifestName,location.href));const w=await v.json();
 const paths=w.flatMap(part=>part.paths||[]);if(!paths.length||paths.some(name=>!names.has(name))) {await caches.delete(cacheName);throw Error('Model manifest references absent shards: '+manifestName)}}
 const meta={id,version:String(body.version||id).slice(0,70),installed:new Date().toISOString()};
 localStorage.setItem('idlens-v3-pack',JSON.stringify(meta));prefs.model='updated';saved();activeModelStatus();
 info('modelManagerStatus',`Update ${meta.version} installed in this browser (${(total/1024/1024).toFixed(1)} MB). Reloading to activate it…`,'ok');
 setTimeout(()=>location.reload(),1000);
 }catch(e){info('modelManagerStatus','Update not installed: '+e.message,'error')}finally{btn.disabled=false}}
async function restoreDefault(){const packs=await caches.keys();for(const key of packs){if(key.startsWith(CACHE_PREFIX))await caches.delete(key)}
 localStorage.removeItem('idlens-v3-pack');prefs.model='enhanced';saved();activeModelStatus();info('modelManagerStatus','Bundled default restored. Reloading…','ok');setTimeout(()=>location.reload(),700)}
// UI events
$('sourceCanvas').addEventListener('pointerdown',cropPointerDown);$('sourceCanvas').addEventListener('pointermove',cropPointerMove);
for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('sourceCanvas').addEventListener(ev,cropPointerEnd);
$('zoomIn').addEventListener('click',()=>{zoom=clamp(zoom*1.3,1,7);drawPreview()});$('zoomOut').addEventListener('click',()=>{zoom=clamp(zoom/1.3,1,7);if(zoom===1){panX=0;panY=0}drawPreview()});
$('cropMoveMode').addEventListener('click',()=>{moveImage=!moveImage;$('cropMoveMode').textContent='Move image: '+(moveImage?'ON':'OFF');$('sourceCanvas').style.cursor=moveImage?'grab':'crosshair'});
$('resetView').addEventListener('click',()=>{zoom=1;panX=panY=0;moveImage=false;$('cropMoveMode').textContent='Move image: OFF';drawPreview()});
$('rotateSource').addEventListener('click',()=>{if(!currentSource)return;const old=currentSource,c=document.createElement('canvas');c.width=old.height;c.height=old.width;const ctx=c.getContext('2d');ctx.translate(c.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(old,0,0);rotate=(rotate+90)%360;previewSource(c)});
$('clearCrop').addEventListener('click',()=>{crop=null;drawPreview()});$('scanCrop').addEventListener('click',()=>scanCrop(false));$('scanWhole').addEventListener('click',()=>scanCrop(true));
$('scanQr').addEventListener('click',startQr);$('stopQr').addEventListener('click',stopQr);
$('cardFile').addEventListener('change',e=>processFile(e.target.files[0]));$('qrFile').addEventListener('change',e=>processFile(e.target.files[0]));
$('decodeRaw').addEventListener('click',()=>decodeNumeric($('qrRaw').value));
$('demo').addEventListener('click',()=>{++session;finishIdentity({name:'Demo Resident (Synthetic)',last4:'4321',dob:'01-01-1992',gender:'F',house:'Example House',street:'Sample Road',vtc:'Kochi',district:'Ernakulam',state:'Kerala',pincode:'682001'},true)});
$('refFile').addEventListener('change',e=>readPhoto(e.target.files[0],'ref'));
$('selfieFile').addEventListener('change',e=>readPhoto(e.target.files[0],'selfie'));
$('openSelfie').addEventListener('click',openSelfie);$('closeSelfie').addEventListener('click',closeSelfie);$('captureSelfie').addEventListener('click',captureSelfie);
$('consent').addEventListener('change',refreshControls);$('matchButton').addEventListener('click',compare);$('resetAll').addEventListener('click',reset);
$('successThreshold').addEventListener('input',e=>{prefs.success=+e.target.value;if(prefs.review>=prefs.success)prefs.review=prefs.success-1;syncThresholdUI()});
$('reviewThreshold').addEventListener('input',e=>{prefs.review=+e.target.value;if(prefs.review>=prefs.success)prefs.success=prefs.review+1;syncThresholdUI()});
$('balancedPreset').addEventListener('click',()=>setPreset(80,72));$('strictPreset').addEventListener('click',()=>setPreset(85,78));$('lenientPreset').addEventListener('click',()=>setPreset(75,68));
$('modelChoice').addEventListener('change',e=>{const m=e.target.value;if(m==='updated'&&!updatedPack()){activeModelStatus();return;}if(m===prefs.model)return;prefs.model=m;saved();info('modelManagerStatus','Model selection saved. Reloading to load the selected local model…','ok');setTimeout(()=>location.reload(),650)});
$('installModel').addEventListener('click',installUpdate);$('checkUpdate').addEventListener('click',checkUpdateChannel);$('restoreModel').addEventListener('click',restoreDefault);
window.addEventListener('pagehide',()=>{stopQr();closeSelfie()});window.addEventListener('resize',()=>{if(currentSource)sizeCropElement()});
async function initSW(){if(!('serviceWorker' in navigator)||!location.protocol.startsWith('http'))return;
 try{await navigator.serviceWorker.register('./sw.js',{scope:'./'});const reg=await navigator.serviceWorker.ready;
 if(reg&&navigator.serviceWorker.controller){$('modelManagerStatus').textContent='Default models load locally; offline cache is active. Optional updates require a compatible manifest.'}
 }catch(e){info('modelManagerStatus','Offline cache unavailable: '+e.message,'error')}}
syncThresholdUI();activeModelStatus();refreshControls();initSW();
})();
