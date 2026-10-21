/* ID Lens v3.2.0 — browser-local QR + face comparison; not official UIDAI authentication. */
(()=>{'use strict';
const $ = id => document.getElementById(id);
const APP_VERSION = '3.2.0';
const DEFAULTS={success:80,review:72,model:'enhanced'};
const CACHE_PREFIX='id-lens-update-';
let qrStream=null,selfieStream=null,scanTimer=null,qrGeneration=0,session=0;
let currentSource=null,crop=null,pointer=null,zoom=1,panX=0,panY=0,moveImage=false,rotate=0;
let ref='',selfie='',sourceType='',qrReady=false,portraitFound=false,faceModelPromise=null,modelLoaded='';
let lastDistance=null,knownRefSource='none';
let liveProof=null,liveSeq=0,liveTimer=null,liveState=null,liveModelPromise=null;
const LIVE_ACTIONS=['blink','turn','pitch','smile','hold'];
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
function refreshControls(){const enabled=qrReady,hasReference=enabled&&portraitFound&&knownRefSource==='qr';
 $('facePanel').classList.toggle('locked',!enabled);
 $('step1').className='step '+(enabled?'done':'current');$('step2').className='step '+(enabled?'current':'');
 $('faceTag').textContent=!enabled?'Waiting for QR':!hasReference?'QR portrait required':liveProof?'Live check passed':'Live check required';
 $('openSelfie').disabled=!(hasReference&&$('consent').checked)||!!selfieStream;
 $('matchButton').disabled=!(hasReference&&selfie&&liveProof&&liveProof.session===session&&performance.now()<liveProof.expires&&$('consent').checked);
}
function clearPictures(){invalidateLiveness();matchQualityReview=false;matchDiagnostics='';ref='';selfie='';portraitFound=false;knownRefSource='none';lastDistance=null;
 for(const [img,empty] of [['refImg','refEmpty'],['selfieImg','selfieEmpty']]){$(img).removeAttribute('src');$(img).classList.add('hidden');$(empty).classList.remove('hidden')}
 showResult('Not compared',null,'A QR reference portrait and current selfie are required for a QR-photo comparison.');refreshControls();}
function setPicture(type,url,origin='manual'){
 if(type==='ref'){ref=url;portraitFound=(origin==='qr');knownRefSource=origin;$('refImg').src=url;$('refImg').classList.remove('hidden');$('refEmpty').classList.add('hidden');}
 else{if(origin!=='camera-liveness'||!liveProof)throw Error('Saved photographs are not accepted as live selfies');selfie=url;$('selfieImg').src=url;$('selfieImg').classList.remove('hidden');$('selfieEmpty').classList.add('hidden')}
 lastDistance=null;matchQualityReview=false;matchDiagnostics='';showResult('Ready for comparison',null,'Fresh live camera challenge completed. Aadhaar QR portrait is ready for local face comparison.');
 photoFallback();refreshControls();
}
function photoFallback(){const yes=portraitFound&&knownRefSource==='qr';
 $('refInfo').textContent=yes?'Embedded QR photograph · signature unverified':'QR embedded portrait unavailable: live identity comparison blocked';}
function finishIdentity(d,demo=false){stopQr();closeSelfie();clearPictures();qrReady=true;sourceType=demo?'demo':'qr';
 $('detailsBlock').classList.remove('hidden');const address=[d.careof,d.house,d.street,d.landmark,d.location,d.vtc,d.postoffice,d.subdistrict,d.district,d.state].filter(Boolean).join(', ');
 for(const [id,value] of Object.entries({dName:d.name||'—',dNumber:d.last4?'XXXX XXXX '+d.last4:'Unavailable',dDob:d.dob||'—',dGender:({M:'Male',F:'Female',T:'Transgender'}[String(d.gender||'').toUpperCase()]||d.gender||'—'),dPin:d.pincode||'—',dAddress:address||'—',dRefDate:d.refDate||'—'}))$(id).textContent=value;
 $('identityTag').textContent=demo?'Sample data':'QR decoded';$('identityTag').className='tag '+(demo?'':'good');$('signatureTag').textContent=demo?'Synthetic only':'UIDAI signature unchecked';
 info('qrStatus',demo?'Synthetic record loaded. Upload two photos for a demo.':'QR demographics extracted. Extracting the embedded JPEG 2000 photograph…','ok');
 info('faceStatus','QR photograph required. Consent and complete a live camera challenge to compare.');photoFallback();refreshControls();
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
async function decodePhoto(obj,token){if(typeof window.openjpeg!=='function')throw Error('JPEG 2000 photo decoder is missing. Check installation above.');
 const data=window.openjpeg(Array.from(obj.bytes),obj.suffix);if(token!==session)return null;
 if(!data||data.error||!data.width||!data.height)throw Error(data?.error||'Decoder could not read QR portrait');
 const w=data.width,h=data.height,n=w*h;if(n>4000000||!data.data||data.data.length<n*3)throw Error('Unexpected JPEG 2000 image data');
 const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');const pix=ctx.createImageData(w,h);
 for(let i=0;i<n;i++){pix.data[i*4]=data.data[i];pix.data[i*4+1]=data.data[n+i];pix.data[i*4+2]=data.data[n*2+i];pix.data[i*4+3]=255}ctx.putImageData(pix,0,0);return c.toDataURL('image/png');}
async function decodeNumeric(s){const token=++session;info('qrStatus','Decoding Secure QR…');try{
 const packed=decimalBytes(s);if(packed[0]!==31||packed[1]!==139)throw Error('Not a supported gzip Aadhaar Secure QR');
 const raw=await gunzip(packed);if(token!==session)return;const {details,offset}=secureFields(raw);finishIdentity(details,false);
 const jpeg=getPhotoBytes(raw,offset,details.flags);if(!jpeg){info('qrStatus','Details decoded, but the QR portrait was not found. Live face verification is unavailable for this credential.');return;}
 try{info('qrStatus','Converting QR photograph locally…');const url=await decodePhoto(jpeg,token);if(token!==session||!url)return;setPicture('ref',url,'qr');info('qrStatus','QR demographics and embedded photo extracted. Signature not verified.','ok')}
 catch(e){if(token===session)info('qrStatus','Details decoded, but embedded JPEG 2000 portrait could not be extracted: '+e.message,'error')}
 }catch(e){if(token===session)info('qrStatus',e.message,'error')}}
function scaledCanvas(src,x,y,w,h,max){const c=document.createElement('canvas');const ratio=Math.min(1,max/Math.max(w,h));c.width=Math.max(1,Math.round(w*ratio));c.height=Math.max(1,Math.round(h*ratio));
 c.getContext('2d',{willReadFrequently:true}).drawImage(src,x,y,w,h,0,0,c.width,c.height);return c;}
// All detection happens on-device. Native BarcodeDetector, jsQR and ZXing are
// independent decoders; ZXing is packaged locally with this app, never CDN-loaded.
async function qrFromCanvas(canvas,withZxing=true){
 if('BarcodeDetector' in window){try{const b=new BarcodeDetector({formats:['qr_code']});const codes=await b.detect(canvas);const value=codes.find(r=>r.rawValue)?.rawValue;if(value)return value;}catch(e){}}
 if(typeof window.jsQR!=='function')throw Error('Offline jsQR reader missing — check installation.');
 const ctx=canvas.getContext('2d',{willReadFrequently:true});const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 try{const qr=window.jsQR(pixels.data,canvas.width,canvas.height,{inversionAttempts:'attemptBoth'});if(qr?.data)return qr.data;}catch(e){}
 if(withZxing&&window.ZXing?.BrowserQRCodeReader){
  try{const reader=new ZXing.BrowserQRCodeReader();const code=await reader.decodeFromCanvas(canvas);return code?.getText?.()||code?.text||null;}catch(e){}
 }
 return null;
}
// Edits temporary scan pixels only. Low resolution of the QR cannot be repaired
// from an image that no longer contains enough actual modules/pixels.
function qrContrastCanvas(base,mode){
 const c=document.createElement('canvas');c.width=base.width;c.height=base.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(base,0,0);
 const pix=ctx.getImageData(0,0,c.width,c.height),d=pix.data,hist=new Uint32Array(256);
 for(let i=0;i<d.length;i+=4)hist[Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2])]++;
 const total=d.length/4,cut=total*.015;let lo=0,hi=255,k=0;
 for(let i=0;i<256;i++){k+=hist[i];if(k>=cut){lo=i;break}}k=0;
 for(let i=255;i>=0;i--){k+=hist[i];if(k>=cut){hi=i;break}}
 const range=Math.max(50,hi-lo);
 for(let i=0;i<d.length;i+=4){const v=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]);const normalized=clamp(Math.round((v-lo)*255/range),0,255);
  const out=mode==='threshold'?(normalized>145?255:0):clamp((normalized-128)*1.1+128,0,255);d[i]=d[i+1]=d[i+2]=out;}
 ctx.putImageData(pix,0,0);return c;
}
function scanRegions(w,h,x,y){
 const area=(fx,fy,fw,fh,max,label)=>[x+Math.round(w*fx),y+Math.round(h*fy),Math.round(w*fw),Math.round(h*fh),max,label];
 // Full scan, then common top/bottom locations for both Aadhaar and e-Aadhaar.
 const list=[area(0,0,1,1,2500,'full image')];
 for(const [name,fx,fy] of [['bottom right',.44,.44],['top right',.44,0],['bottom left',0,.44],['top left',0,0]])list.push(area(fx,fy,.56,.56,2100,name));
 // Smaller windows preserve more QR pixels in high-resolution full-card photos.
 for(const [name,fx,fy] of [['bottom right detail',.65,.65],['top right detail',.65,0],['bottom left detail',0,.65],['top left detail',0,0]])list.push(area(fx,fy,.35,.35,1800,name));
 list.push(area(.2,.2,.6,.6,2100,'centre'),area(0,0,1,1,1600,'reduced image'));
 return list;
}
let activeImageScan=0;
async function scanImageRegion(src,x=0,y=0,w=src.width,h=src.height){
 const token=++activeImageScan;
 if(w<30||h<30)return null;
 const cases=scanRegions(w,h,x,y),total=cases.length;
 for(let i=0;i<total;i++){
  if(token!==activeImageScan)throw Error('Scan replaced by a newer image');
  const [px,py,pw,ph,max,label]=cases[i];
  info('qrStatus',`Searching full document QR · ${i+1}/${total} · ${label}…`);
  const canvas=scaledCanvas(src,px,py,pw,ph,max);
  let result=await qrFromCanvas(canvas,i<9);if(result)return result;
  // Escalate to contrast-stretched and binarized copies only for promising tiles.
  if(i<9){
   const contrast=qrContrastCanvas(canvas,'stretch');result=await qrFromCanvas(contrast,true);if(result)return result;
   if(i<5){const threshold=qrContrastCanvas(canvas,'threshold');result=await qrFromCanvas(threshold,false);if(result)return result;}
  }
  // Yield to Safari's event loop so progress renders and the page stays responsive.
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 return null;
}
// Crop editor uses coordinates of the ORIGINAL uploaded image; zoom and pan affect only its preview.
function previewSource(src){currentSource=src;crop=null;zoom=1;panX=0;panY=0;moveImage=false;
 $('cropMoveMode').textContent='Move image: OFF';$('sourceWrap').classList.remove('hidden');const c=$('sourceCanvas');const ratio=Math.min(1,900/src.width,620/src.height);
 c.width=Math.max(1,Math.round(src.width*ratio));c.height=Math.max(1,Math.round(src.height*ratio));sizeCropElement();drawPreview();}
function cropPreset(place){
 if(!currentSource)return;
 const w=currentSource.width,h=currentSource.height;
 const side=.44;
 const pos={br:[1-side,1-side],tr:[1-side,0],bl:[0,1-side],tl:[0,0],centre:[(1-side)/2,(1-side)/2]}[place]||[1-side,1-side];
 crop={x:Math.round(w*pos[0]),y:Math.round(h*pos[1]),w:Math.round(w*side),h:Math.round(h*side)};
 zoom=1;panX=panY=0;moveImage=false;$('cropMoveMode').textContent='Move image: OFF';drawPreview();
 info('qrStatus','Suggested '+place.toUpperCase()+' crop selected. Adjust handles, then tap Scan selected area.');
}
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
async function processCanvas(src,label=''){++activeImageScan;previewSource(src);info('qrStatus',label+'Looking for Secure QR…');
 try{const numeric=await scanImageRegion(src);if(numeric)await decodeNumeric(numeric);else{cropPreset('br');info('qrStatus','QR not decoded automatically. Try the suggested bottom-right crop, or choose another QR location below. Very small or blurry QR codes need a closer photograph.','error');}}
 catch(e){info('qrStatus','QR scan error: '+e.message,'error');checkInstallation()}}
async function readImage(file){const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();if(img.naturalWidth*img.naturalHeight>45000000)throw Error('Image resolution too large');const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);return c}finally{URL.revokeObjectURL(url)}}
async function processFile(file){if(!file)return;stopQr();closeSelfie(false);clearPictures();qrReady=false;$('detailsBlock').classList.add('hidden');++session;refreshControls();try{if(file.size>25*1024*1024)throw Error('File too large (25 MB limit)');
 if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
 if(!window.pdfjsLib)throw Error('PDF reader missing. Check installation above and publish with GitHub Actions');info('qrStatus','Opening PDF…');
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
async function startQr(){stopQr();closeSelfie(false);clearPictures();qrReady=false;$('detailsBlock').classList.add('hidden');++session;refreshControls();try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Browser camera requires HTTPS/localhost');
 qrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});$('qrVideo').srcObject=qrStream;await $('qrVideo').play();
 $('qrPlaceholder').classList.add('hidden');$('qrVideo').classList.remove('hidden');$('stopQr').classList.remove('hidden');$('scanQr').classList.add('hidden');
 const tag=++qrGeneration;info('qrStatus','Rear camera active: hold a high-resolution Aadhaar Secure QR steady.');
 async function loop(){if(!qrStream||tag!==qrGeneration)return;try{const v=$('qrVideo');if(v.videoWidth){const image=scaledCanvas(v,0,0,v.videoWidth,v.videoHeight,1600);const payload=await qrFromCanvas(image);
 if(payload){stopQr();await decodeNumeric(payload);return;}}}catch(e){if(tag===qrGeneration){stopQr();info('qrStatus',e.message,'error')}return}scanTimer=setTimeout(loop,450)}scanTimer=setTimeout(loop,430);
 }catch(e){stopQr();info('qrStatus',e.message+'. Upload the QR image instead.','error')}}
// Only an actively running getUserMedia video stream may supply verification images.
function clearLiveUI(title='Camera challenge not started',message='Start the live challenge after scanning your Aadhaar QR portrait.'){
 $('liveTitle').textContent=title;$('liveStep').textContent='0 / 5';$('liveBar').style.width='0%';info('liveInstruction',message);
 for(const el of $('liveChecklist').children){el.classList.remove('ok');el.textContent='○ '+el.textContent.replace(/^[○✓] /,'');}
}
function invalidateLiveness(){liveProof=null;liveState=null;liveSeq++;if(liveTimer){clearTimeout(liveTimer);liveTimer=null;}
 if($('liveTitle'))clearLiveUI();}
function closeSelfie(preserveProof=false){liveSeq++;if(liveTimer)clearTimeout(liveTimer);liveTimer=null;
 if(selfieStream){selfieStream.getTracks().forEach(t=>t.stop());selfieStream=null;}
 $('selfieVideo').srcObject=null;$('selfieVideo').classList.add('hidden');$('closeSelfie').classList.add('hidden');$('openSelfie').classList.remove('hidden');
 if(!preserveProof){liveProof=null;liveState=null;const img=$('selfieImg');img.removeAttribute('src');img.classList.add('hidden');$('selfieEmpty').classList.remove('hidden');selfie='';lastDistance=null;clearLiveUI();}
 refreshControls();}
async function livenessModels(){if(!liveModelPromise)liveModelPromise=(async()=>{
 if(!window.faceapi||!window.IDLensMotion)throw Error('Bundled face/landmark code missing. Check installation');
 await Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri('./assets/models'),faceapi.nets.faceLandmark68TinyNet.loadFromUri('./assets/models')]);
 })().catch(e=>{liveModelPromise=null;throw e;});return liveModelPromise;}
const LIVE_LABELS={blink:'Blink once (close → open)',turn:'Turn your head left or right',pitch:'Look up or down',smile:'Smile clearly',hold:'Face forward and hold steady'};
function secureShuffleActions(){const b=new Uint8Array(8);crypto.getRandomValues(b);return [...IDLensMotion.shuffle(['blink','turn','pitch','smile'],b),'hold'];}
function captureLiveFrame(){const v=$('selfieVideo'),c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;
 if(!c.width||!c.height)throw Error('Camera image unavailable');c.getContext('2d').drawImage(v,0,0);return c;}
function failLive(reason){info('faceStatus','Liveness NOT passed. '+reason,'error');
 closeSelfie(false);clearLiveUI('Liveness failed — restart required',reason+' Select Start live challenge to retry.');
 showResult('NOT VERIFIED',null,'Live challenge did not complete. No face comparison was performed.','fail');}
async function openSelfie(){if(!qrReady||!portraitFound||knownRefSource!=='qr')return info('faceStatus','Read the QR and extract its embedded photograph first. Demo or manually supplied photos cannot verify.','error');
 if(!$('consent').checked)return info('faceStatus','Please confirm consent before enabling your camera.','error');
 closeSelfie(false);stopQr();const sequence=++liveSeq;
 try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Front camera unavailable (HTTPS required)');
  info('faceStatus','Starting front camera and loading offline landmark detector…');
  selfieStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'},width:{ideal:960},height:{ideal:720},frameRate:{ideal:20}},audio:false});
  if(sequence!==liveSeq){selfieStream?.getTracks().forEach(x=>x.stop());return;}
  $('selfieVideo').srcObject=selfieStream;await $('selfieVideo').play();
  $('selfieVideo').classList.remove('hidden');$('closeSelfie').classList.remove('hidden');$('openSelfie').classList.add('hidden');
  await livenessModels();if(sequence!==liveSeq)return;
  liveState={phase:'calibrate',started:performance.now(),stepStart:0,lastVideo:-1,stalled:0,lost:0,frames:0,
   baseline:null,samples:[],previous:null,ordered:secureShuffleActions(),index:0,actionMemory:{},holdCount:0,done:[],session};
  $('liveTitle').textContent='Calibrating your neutral face';
  info('liveInstruction','Face camera straight-on, eyes open and mouth relaxed. Keep one face within the frame.');
  info('faceStatus','Camera-only check active. Follow prompts shown below. All frames processed locally.');
  liveTimer=setTimeout(()=>stepLive(sequence),130);
 }catch(e){if(sequence!==liveSeq)return;failLive(e.message);}
}
async function stepLive(sequence){if(sequence!==liveSeq||!selfieStream||!liveState)return;const st=liveState,video=$('selfieVideo');
 try{
  if(document.hidden)throw Error('Screen/app became hidden');
  if(!selfieStream.getVideoTracks().some(t=>t.readyState==='live'&&!t.muted))throw Error('Camera stopped or paused');
  const now=performance.now();if(now-st.started>75000)throw Error('Live session timed out');
  if(st.phase==='calibrate'&&now-st.started>18000)throw Error('Unable to calibrate one clear, front-facing face');
  if(st.phase==='challenge'&&now-st.stepStart>12000)throw Error('Action timed out: '+LIVE_LABELS[st.ordered[st.index]]);
  if(video.videoWidth&&video.readyState>=2){
   if(video.currentTime<=st.lastVideo+.025){if(++st.stalled>12)throw Error('Camera frames appear frozen');}
   else{
    st.lastVideo=video.currentTime;st.stalled=0;
    const opts=new faceapi.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:.33});
    const detections=await faceapi.detectAllFaces(video,opts).withFaceLandmarks(true);
    if(sequence!==liveSeq||!selfieStream)return;
    if(detections.length!==1){if(detections.length>1)throw Error('Multiple faces detected — restart required');if(++st.lost>3)throw Error('Face lost; remain in camera view');}
    else{
     const m=IDLensMotion.metrics(detections[0],video.videoWidth,video.videoHeight);st.frames++;
     if(m.confidence<.35){if(++st.lost>4)throw Error('Face detection confidence too low');}
     else if(!IDLensMotion.continuous(st.previous,m))throw Error('Continuous face tracking interrupted');
     else{
      st.lost=0;st.previous=m;
      if(st.phase==='calibrate'){
       if(m.ear>.16&&m.size>.17&&m.size<.8&&Math.abs(m.x-.5)<.28&&Math.abs(m.y-.5)<.30)st.samples.push(m);
       else st.samples=[];
       $('liveTitle').textContent='Calibrating neutral face ('+Math.min(7,st.samples.length)+'/7)';
       if(st.samples.length>=7){st.baseline=IDLensMotion.mean(st.samples);st.phase='challenge';st.stepStart=now;st.samples=[];displayAction(st);}
      }else if(st.phase==='challenge'){
       // Prevent substitution of a different face without interrupting the track.
       if(Math.hypot(m.x-st.baseline.x,m.y-st.baseline.y)>.32||m.size/st.baseline.size<.54||m.size/st.baseline.size>1.8)throw Error('Face moved out of the allowed tracking region');
       const act=st.ordered[st.index],r=IDLensMotion.action(act,st.baseline,m,st.actionMemory,now);
       if(r.done){st.holdCount++;if(st.holdCount>= (act==='hold'?4:2)){
        st.done.push(act);st.index++;st.holdCount=0;st.actionMemory={};st.stepStart=now;
        if(st.index>=st.ordered.length){await finishLive(st,sequence);return;}displayAction(st);
       }}else st.holdCount=0;
      }
     }
    }
   }
  }
 }catch(e){if(sequence===liveSeq)failLive(e.message);return;}
 if(sequence===liveSeq&&selfieStream)liveTimer=setTimeout(()=>stepLive(sequence),140);
}
function displayAction(st){const act=st.ordered[st.index];$('liveTitle').textContent='Action '+(st.index+1)+' / 5 · '+LIVE_LABELS[act];
 $('liveStep').textContent=(st.index)+' / 5';$('liveBar').style.width=st.index*20+'%';
 info('liveInstruction',LIVE_LABELS[act]+'. You have 12 seconds. Keep your face in view.');
 const rows=$('liveChecklist').children;
 for(let i=0;i<rows.length;i++){const key=['blink','turn','pitch','smile','hold'][i];const done=st.done.includes(key);rows[i].classList.toggle('ok',done);rows[i].textContent=(done?'✓ ':'○ ')+({blink:'Blink',turn:'Turn left/right',pitch:'Look up/down',smile:'Smile',hold:'Face stability'})[key];}}
async function finishLive(st,sequence){if(sequence!==liveSeq||!selfieStream)return;
 try{const frame=captureLiveFrame(),q=photoQuality(frame);if(q.focusScore<6||q.brightness<36||q.brightness>230)throw Error('Final selfie is too dark, bright or blurry; retake the live challenge');
  const image=frame.toDataURL('image/jpeg',.93);
  liveProof={session,created:performance.now(),expires:performance.now()+60000,frames:st.frames,order:[...st.ordered]};
  setPicture('selfie',image,'camera-liveness');closeSelfie(true);
  $('liveTitle').textContent='Live challenge completed';$('liveStep').textContent='5 / 5';$('liveBar').style.width='100%';
  info('liveInstruction','All 5 actions passed in one uninterrupted camera session. Now compare within 60 seconds.','ok');
  const rows=$('liveChecklist').children;for(let i=0;i<rows.length;i++){rows[i].classList.add('ok');rows[i].textContent=rows[i].textContent.replace(/^○ /,'✓ ');}
  $('selfieInfo').textContent='Fresh camera image · '+st.frames+' observed frames · prototype liveness passed';
  info('faceStatus','Prototype live-motion challenge passed. Run face comparison within 60 seconds. Not certified anti-spoofing.','ok');refreshControls();
 }catch(e){failLive(e.message);}}
// Rough image-quality heuristics: not an accuracy probability and not liveness.
function photoQuality(src){
 const c=scaledCanvas(src,0,0,src.naturalWidth||src.width,src.naturalHeight||src.height,160);
 const p=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data;
 const w=c.width,h=c.height,g=new Float32Array(w*h);let sum=0,sum2=0;
 for(let i=0;i<g.length;i++){const k=i*4,v=.299*p[k]+.587*p[k+1]+.114*p[k+2];g[i]=v;sum+=v;sum2+=v*v}
 const brightness=sum/g.length,contrast=Math.sqrt(Math.max(0,sum2/g.length-brightness*brightness));
 let lap=0,n=0;
 for(let y=2;y<h-2;y+=2)for(let x=2;x<w-2;x+=2){const i=y*w+x;const d=4*g[i]-g[i-1]-g[i+1]-g[i-w]-g[i+w];lap+=Math.abs(d);n++}
 return {brightness,contrast,focusScore:lap/Math.max(1,n),width:src.naturalWidth||src.width,height:src.naturalHeight||src.height};
}
function qualityIssues(q){const issues=[];
 if(q.brightness<65)issues.push('low lighting');if(q.brightness>208)issues.push('very bright image');
 if(q.contrast<27)issues.push('low contrast');if(q.focusScore<10)issues.push('soft / blurry image');
 if(Math.min(q.width,q.height)<180)issues.push('small photo');return issues;
}
function enhancePortrait(img){
 const w=img.naturalWidth,h=img.naturalHeight,scale=Math.min(5,Math.max(1,Math.ceil(460/Math.min(w,h))));
 if(scale<=1)return img;
 const c=document.createElement('canvas');c.width=w*scale;c.height=h*scale;
 const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,c.width,c.height);return c;
}
function normalizeSelfie(src){
 const w=src.naturalWidth||src.width,h=src.naturalHeight||src.height;
 const fit=Math.min(3,Math.max(1,500/Math.min(w,h)),1500/Math.max(w,h));
 const c=document.createElement('canvas');c.width=Math.round(w*fit);c.height=Math.round(h*fit);
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingQuality='high';ctx.drawImage(src,0,0,c.width,c.height);
 const q=photoQuality(src),p=ctx.getImageData(0,0,c.width,c.height),d=p.data;
 // Conservative tone correction; cannot recreate occluded eyes or missing face detail.
 const gamma=q.brightness<95?.78:q.brightness>195?1.12:1;
 const gain=q.contrast<42?1.14:1.05;
 for(let i=0;i<d.length;i+=4){for(let j=0;j<3;j++){
   const base=255*Math.pow(d[i+j]/255,gamma);
   d[i+j]=clamp(Math.round((base-128)*gain+128),0,255);
 }}ctx.putImageData(p,0,0);return c;
}
function qualityLine(refQ,selfQ){
 const a=qualityIssues(refQ),b=qualityIssues(selfQ);
 return `Reference: ${a.join(', ')||'basic checks OK'} · Selfie: ${b.join(', ')||'basic checks OK'}. `+
 'Quality checks are indicative, not biometric accuracy or spoof protection.';
}
async function faceModels(){if(faceModelPromise)return faceModelPromise;
 faceModelPromise=(async()=>{if(!window.faceapi)throw Error('Face recognition library missing. Check installation above and publish with GitHub Actions.');
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
 if(!liveProof||liveProof.session!==session||performance.now()>liveProof.expires||knownRefSource!=='qr')return showResult('NOT VERIFIED',null,'A fresh, completed camera challenge and embedded QR portrait are required.','fail');
 const isQR=knownRefSource==='qr'&&!!liveProof&&liveProof.session===session&&performance.now()<liveProof.expires;let title=state==='match'?(isQR?'FACE MATCH · SUCCESS':'PHOTO TEST · MATCH'):state==='review'?'REVIEW REQUIRED':'FACE MATCH · FAILURE';
 const description=`Distance ${distance.toFixed(3)}. Similarity index ${score}% (not identity probability). `+
 `Current rules: success ≥${prefs.success}%, review ${prefs.review}–${prefs.success-1}%, failure <${prefs.review}%. `+
 (isQR?'Reference originated in the QR; UIDAI signature unchecked.':'Reference was uploaded manually: demo only.')+
 ' Camera-only prototype liveness: '+(liveProof?'passed':'not passed')+'. Not certified against replay/virtual-camera attacks.';
 if(matchQualityReview&&state==='match')showResult('REVIEW · IMAGE QUALITY',score,description+' '+matchDiagnostics+' Automatic success withheld due to low image quality.','review');
 else showResult(title,score,description+' '+matchDiagnostics,state==='match'?'success':state==='review'?'review':'fail');}
async function detectOne(source,options){
 const faces=await faceapi.detectAllFaces(source,options).withFaceLandmarks(prefs.model==='fast').withFaceDescriptors();
 if(faces.length!==1)throw Error(`Expected one face, detected ${faces.length}`);
 return faces[0];
}
let matchDiagnostics='',matchQualityReview=false;
async function compare(){
 if(!qrReady||!portraitFound||knownRefSource!=='qr'||!ref||!selfie||!liveProof||liveProof.session!==session||performance.now()>liveProof.expires||!$('consent').checked)return info('faceStatus','Verification requires QR embedded portrait, fresh completed camera liveness (within 60s), and consent. Saved photos/videos are not permitted.','error');
 const verificationSession=session,proof=liveProof;
 $('matchButton').disabled=true;$('matchButton').textContent='Preparing local face model…';info('faceStatus','Preparing local model and checking image quality…');
 try{
  await faceModels();await Promise.all([$('refImg').decode(),$('selfieImg').decode()]);
  if(session!==verificationSession||liveProof!==proof||performance.now()>proof.expires)throw Error('Live challenge has expired or identity changed; restart the camera check');
  const refImg=$('refImg'),selfImg=$('selfieImg');const refQuality=photoQuality(refImg),selfQuality=photoQuality(selfImg);
  const reference=enhancePortrait(refImg);
  const opts=prefs.model==='fast'?new faceapi.TinyFaceDetectorOptions({inputSize:608,scoreThreshold:.20}):new faceapi.SsdMobilenetv1Options({minConfidence:.25,maxResults:5});
  $('matchButton').textContent='Analysing Aadhaar portrait…';
  const a=await detectOne(reference,opts).catch(e=>{throw Error('Reference photo: '+e.message+'. Try a sharper image or re-scan the QR.');});
  $('matchButton').textContent='Analysing selfie…';
  let b=null,d1=null,d2=null,enhanced=null,origError='';
  try{b=await detectOne(selfImg,opts);d1=faceapi.euclideanDistance(a.descriptor,b.descriptor);}catch(e){origError=e.message;}
  if($('qualityRescue').checked){
   info('faceStatus','Running conservative low-light and low-resolution selfie correction…');
   enhanced=normalizeSelfie(selfImg);
   try{const c=await detectOne(enhanced,opts);d2=faceapi.euclideanDistance(a.descriptor,c.descriptor);
    if(!b)b=c;
   }catch(e){/* The unmodified selfie still works when the enhanced version fails. */}
  }
  if(!b||(d1===null&&d2===null))throw Error('Could not locate one face in selfie. '+origError+'. Reduce glasses glare and try retaking.');
  // Two deterministic embeddings, not best-of-many cherry-picking: average distance
  // and penalize disagreement. Looser acceptance would increase false accepts.
  const distance=d1!==null&&d2!==null?(.5*(d1+d2)+.2*Math.abs(d1-d2)):(d1??d2);
  const disagreement=d1!==null&&d2!==null?Math.abs(d1-d2):0;
  const lowConfidence=a.detection.score<.4||b.detection.score<.4;
  const severeQuality=qualityIssues(selfQuality).length>=3||qualityIssues(refQuality).length>=3;
  const uncertain=lowConfidence||disagreement>.12||severeQuality;matchQualityReview=uncertain;
  lastDistance=distance;matchDiagnostics=qualityLine(refQuality,selfQuality)+(d1!==null&&d2!==null?` Original/enhanced distances: ${d1.toFixed(3)} / ${d2.toFixed(3)}. `:'')+(disagreement>.12?'Enhancement results disagree. ':'');
  renderDistance(lastDistance);
  
  info('faceStatus',matchDiagnostics+(uncertain?' Review suggested due to image quality.':''),'ok');
 }catch(e){lastDistance=null;matchDiagnostics='';matchQualityReview=false;showResult('Comparison unavailable',null,e.message);info('faceStatus',e.message,'error')}
 finally{$('matchButton').textContent='◎ Compare face & show result';refreshControls()}
}
function reset(){++activeImageScan;++session;stopQr();closeSelfie();qrReady=false;sourceType='';currentSource=null;crop=null;clearPictures();$('sourceWrap').classList.add('hidden');$('detailsBlock').classList.add('hidden');
 $('identityTag').textContent='Not scanned';$('identityTag').className='tag';for(const id of ['cardFile','qrFile','qrRaw'])$(id).value='';
 $('consent').checked=false;info('qrStatus','Ready to scan. Offline libraries are served with this app.');info('faceStatus','Step 2 becomes available after QR/demo data is loaded.');refreshControls();}
// Accuracy display is an adjustable decision aid, NOT biometric probability or measured classification accuracy.
function syncThresholdUI(){if(prefs.review>=prefs.success)prefs.review=prefs.success-1;
 $('successThreshold').value=prefs.success;$('reviewThreshold').value=prefs.review;$('successValue').textContent=prefs.success+'%';$('reviewValue').textContent=prefs.review+'%';
 $('logicText').textContent=`Model computes two 128-dimensional face embeddings. Euclidean distance d (lower means closer). Displayed similarity index = clamp(round((1.30 − d) × 100), 0, 100). Success ≥ ${prefs.success}%; manual review ${prefs.review}%–${prefs.success-1}%; failure below ${prefs.review}%. Example: d = 0.55 → 75% index. Threshold adjustments change the decision, NOT the neural-network output or measured accuracy. Looser thresholds increase false-acceptance risk. No biometric validation has been performed.`;
 saved();if(lastDistance!==null&&liveProof&&liveProof.session===session&&performance.now()<liveProof.expires)renderDistance(lastDistance);}
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
// GitHub Pages provisioning diagnostics. Never reads or stores biometric images.
const HEALTH_ASSETS=[
 ['./asset-manifest.json','Build manifest','build'],
 ['./liveness-core.js','Live action detection logic','live'],
 ['./assets/vendor/jsQR.js','QR decoder · jsQR','jsqr'],
  ['./assets/vendor/zxing.min.js','QR decoder · ZXing','zxing'],
 ['./assets/vendor/openjpeg.js','JPEG 2000 decoder','jpeg2000'],
 ['./assets/vendor/pdf.min.js','PDF decoder','pdf'],
 ['./assets/vendor/face-api.min.js','Face AI code','face'],
 ['./assets/models/ssd_mobilenetv1_model-weights_manifest.json','Face detector model','model'],
 ['./assets/models/face_landmark_68_model-weights_manifest.json','Facial landmarks model','model'],
 ['./assets/models/face_recognition_model-weights_manifest.json','Face recognition model','model'],
 ['./assets/models/face_recognition_model-shard1','Face recognition weights 1','weights'],
 ['./assets/models/face_recognition_model-shard2','Face recognition weights 2','weights'],
 ['./assets/models/ssd_mobilenetv1_model-shard1','Face detector weights 1','weights'],
 ['./assets/models/ssd_mobilenetv1_model-shard2','Face detector weights 2','weights'],
 ['./assets/models/face_landmark_68_model-shard1','Facial landmark weights','weights'],
 ['./assets/models/tiny_face_detector_model-weights_manifest.json','Live face detector model','model'],
 ['./assets/models/tiny_face_detector_model-shard1','Live face detector weights','weights'],
 ['./assets/models/face_landmark_68_tiny_model-weights_manifest.json','Live facial landmark model','model'],
 ['./assets/models/face_landmark_68_tiny_model-shard1','Live landmark weights','weights']
];
let healthBusy=false;
async function probe(path,label,type){
 try{
  // Cache bypass stops a stale service worker from masquerading as a new deployment.
  const url=new URL(path,location.href);
  const response=await fetch(url.href,{method:'HEAD',cache:'no-store'});
  if(!response.ok)return {label,type,ok:false,why:'HTTP '+response.status,path};
  const ct=response.headers.get('content-type')||'';
  if(type==='build'){
    const r=await fetch(url.href,{cache:'no-store'});
    const text=await r.text();
    try{const data=JSON.parse(text);if(data.built!==true||data.version!=='3.2.0'||!Array.isArray(data.files))throw Error('Invalid build manifest');
      return {label,type,ok:true,path,size:JSON.stringify(data.files).length};
    }catch(e){return {label,type,ok:false,why:'Not a v3.2.0 asset build',path};}
  }
  const length=Number(response.headers.get('content-length'));
  if(ct.includes('text/html'))return {label,type,ok:false,why:'HTML returned instead of asset',path};
  // Missing assets on Pages often return HTML with HTTP 200 on SPA fallbacks.
  if(Number.isFinite(length)&&length>0&&length<(type==='weights'?4000:type==='model'?50:400))return {label,type,ok:false,why:'Asset suspiciously small ('+length+' bytes)',path};
  return {label,type,ok:true,path};
 }catch(e){
   // HEAD cannot be answered by the GET-only service worker while fully offline.
   // An already-cached app remains usable without any network.
   try{
     if('caches' in window){const saved=await caches.match(new URL(path,location.href));
       if(saved&&saved.ok){if(type==='build'){const d=await saved.clone().json();if(d.built!==true||d.version!=='3.2.0')throw Error('Outdated build manifest')}
         return {label,type,ok:true,path,cached:true};}}
   }catch(ignore){}
   return {label,type,ok:false,why:e.message,path};
 }
}
async function checkInstallation(){
 if(healthBusy)return;healthBusy=true;
 $('installHeadline').textContent='Checking deployed libraries and weights…';$('installationHealth').className='health';$('checkInstallation').disabled=true;
 try{
  const results=await Promise.all(HEALTH_ASSETS.map(row=>probe(...row)));
  const bad=results.filter(r=>!r.ok);
  const requiredLoaded=typeof window.jsQR==='function'&&!!window.ZXing?.BrowserQRCodeReader&&typeof window.openjpeg==='function'&&!!window.pdfjsLib&&!!window.faceapi&&!!window.IDLensMotion;
  const details=results.map(r=>(r.ok?'✓ ':'✗ ')+r.label+' · '+r.path+(r.ok?'':' ('+r.why+')'));
  if(!requiredLoaded){const miss=[typeof window.jsQR==='function'?null:'jsQR',window.ZXing?.BrowserQRCodeReader?null:'ZXing',typeof window.openjpeg==='function'?null:'openjpeg',window.pdfjsLib?null:'pdfjs',window.faceapi?null:'face-api',window.IDLensMotion?null:'liveness-core'].filter(Boolean);details.push('Loaded JS globals missing: '+miss.join(', '));}
  $('installDetails').textContent=details.join('\n');
  if(bad.length||!requiredLoaded){
    $('installationHealth').className='health bad';$('installHeadline').textContent='Installation incomplete · '+bad.length+' missing / invalid files';
    $('installSummary').textContent='QR or face functions may fail. The source ZIP does not contain downloaded model binaries. In GitHub Settings → Pages select GitHub Actions, then run “Publish ID Lens (offline assets)” and verify the build succeeds. If you use branch deployment, run scripts/fetch_assets.sh and commit assets/vendor and assets/models before publishing.';
    $('siteStatus').textContent='Setup incomplete · Demo only';
  }else{
    $('installationHealth').className='health good';$('installHeadline').textContent='Runtime files installed ('+results.length+'/'+results.length+')';
    $('installSummary').textContent='Bundled QR, PDF, photo and recognition assets are hosted on this origin. First visit needs internet; offline use works after they have been cached.';
    $('siteStatus').textContent='Local assets ready · Demo only';
  }
 }catch(e){$('installHeadline').textContent='Installation check failed';$('installSummary').textContent=e.message;}
 finally{healthBusy=false;$('checkInstallation').disabled=false;}
}
async function repairInstallation(){
 if(!confirm('Remove only ID Lens offline caches and reload? Personal images are not cached. Model update downloads will be retained.'))return;
 info('qrStatus','Removing old ID Lens runtime cache…');
 try{
  if('caches' in window){for(const key of await caches.keys()){if(key.startsWith('idlens-v')&&key.endsWith('-static'))await caches.delete(key)}}
  if('serviceWorker' in navigator){const r=await navigator.serviceWorker.getRegistration('./');if(r)await r.update();}
  location.reload();
 }catch(e){$('installSummary').textContent='Cache refresh failed: '+e.message}
}
$('checkInstallation').addEventListener('click',checkInstallation);
$('repairInstallation').addEventListener('click',repairInstallation);
// UI events
$('sourceCanvas').addEventListener('pointerdown',cropPointerDown);$('sourceCanvas').addEventListener('pointermove',cropPointerMove);
for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('sourceCanvas').addEventListener(ev,cropPointerEnd);
$('zoomIn').addEventListener('click',()=>{zoom=clamp(zoom*1.3,1,7);drawPreview()});$('zoomOut').addEventListener('click',()=>{zoom=clamp(zoom/1.3,1,7);if(zoom===1){panX=0;panY=0}drawPreview()});
$('cropMoveMode').addEventListener('click',()=>{moveImage=!moveImage;$('cropMoveMode').textContent='Move image: '+(moveImage?'ON':'OFF');$('sourceCanvas').style.cursor=moveImage?'grab':'crosshair'});
$('resetView').addEventListener('click',()=>{zoom=1;panX=panY=0;moveImage=false;$('cropMoveMode').textContent='Move image: OFF';drawPreview()});
$('rotateSource').addEventListener('click',()=>{if(!currentSource)return;const old=currentSource,c=document.createElement('canvas');c.width=old.height;c.height=old.width;const ctx=c.getContext('2d');ctx.translate(c.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(old,0,0);rotate=(rotate+90)%360;previewSource(c)});
for(const [id,pos] of [['cropBR','br'],['cropBL','bl'],['cropTR','tr'],['cropTL','tl'],['cropCentre','centre']])$(id).addEventListener('click',()=>cropPreset(pos));
$('clearCrop').addEventListener('click',()=>{crop=null;drawPreview()});$('scanCrop').addEventListener('click',()=>scanCrop(false));$('scanWhole').addEventListener('click',()=>scanCrop(true));
$('scanQr').addEventListener('click',startQr);$('stopQr').addEventListener('click',stopQr);
$('cardFile').addEventListener('change',e=>processFile(e.target.files[0]));$('qrFile').addEventListener('change',e=>processFile(e.target.files[0]));
$('decodeRaw').addEventListener('click',()=>decodeNumeric($('qrRaw').value));
$('demo').addEventListener('click',()=>{++session;finishIdentity({name:'Demo Resident (Synthetic)',last4:'4321',dob:'01-01-1992',gender:'F',house:'Example House',street:'Sample Road',vtc:'Kochi',district:'Ernakulam',state:'Kerala',pincode:'682001'},true)});
$('openSelfie').addEventListener('click',openSelfie);$('closeSelfie').addEventListener('click',()=>closeSelfie(false));
$('consent').addEventListener('change',()=>{if(!$('consent').checked)closeSelfie(false);refreshControls()});$('matchButton').addEventListener('click',compare);$('resetAll').addEventListener('click',reset);
$('successThreshold').addEventListener('input',e=>{prefs.success=+e.target.value;if(prefs.review>=prefs.success)prefs.review=prefs.success-1;syncThresholdUI()});
$('reviewThreshold').addEventListener('input',e=>{prefs.review=+e.target.value;if(prefs.review>=prefs.success)prefs.success=prefs.review+1;syncThresholdUI()});
$('balancedPreset').addEventListener('click',()=>setPreset(80,72));$('strictPreset').addEventListener('click',()=>setPreset(85,78));$('lenientPreset').addEventListener('click',()=>setPreset(75,68));
$('modelChoice').addEventListener('change',e=>{const m=e.target.value;if(m==='updated'&&!updatedPack()){activeModelStatus();return;}if(m===prefs.model)return;prefs.model=m;saved();info('modelManagerStatus','Model selection saved. Reloading to load the selected local model…','ok');setTimeout(()=>location.reload(),650)});
$('installModel').addEventListener('click',installUpdate);$('checkUpdate').addEventListener('click',checkUpdateChannel);$('restoreModel').addEventListener('click',restoreDefault);
window.addEventListener('pagehide',()=>{stopQr();closeSelfie(false)});document.addEventListener('visibilitychange',()=>{if(document.hidden&&selfieStream)failLive('Verification interrupted when browser became hidden')});window.addEventListener('resize',()=>{if(currentSource)sizeCropElement()});
async function initSW(){if(!('serviceWorker' in navigator)||!location.protocol.startsWith('http'))return;
 try{await navigator.serviceWorker.register('./sw.js',{scope:'./'});const reg=await navigator.serviceWorker.ready;
 if(reg&&navigator.serviceWorker.controller){$('modelManagerStatus').textContent='Default models load locally; offline cache is active. Optional updates require a compatible manifest.'}
 }catch(e){info('modelManagerStatus','Offline cache unavailable: '+e.message,'error')}}
syncThresholdUI();activeModelStatus();refreshControls();initSW();setTimeout(checkInstallation,100);
})();
