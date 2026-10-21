/* ID Lens v3: same-origin cache only. No personal data, images or QR payloads are cached. */
const VERSION='idlens-v3.3.1-static';
const STATIC=['./','./index.html','./app.js','./liveness-core.js','./sw.js','./manifest.webmanifest','./updates/channel.json',
 './asset-manifest.json','./assets/vendor/face-api.min.js','./assets/vendor/jsQR.js','./assets/vendor/zxing.min.js','./assets/vendor/openjpeg.js','./assets/vendor/pdf.min.js',
 './assets/models/ssd_mobilenetv1_model-weights_manifest.json','./assets/models/ssd_mobilenetv1_model-shard1','./assets/models/ssd_mobilenetv1_model-shard2',
 './assets/models/face_landmark_68_model-weights_manifest.json','./assets/models/face_landmark_68_model-shard1',
 './assets/models/face_recognition_model-weights_manifest.json','./assets/models/face_recognition_model-shard1','./assets/models/face_recognition_model-shard2',
 './assets/models/tiny_face_detector_model-weights_manifest.json','./assets/models/tiny_face_detector_model-shard1',
 './assets/models/face_landmark_68_tiny_model-weights_manifest.json','./assets/models/face_landmark_68_tiny_model-shard1'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(VERSION);
 // Do not activate an offline cache that is missing critical application files.
 for(let i=0;i<STATIC.length;i+=4){
   await Promise.all(STATIC.slice(i,i+4).map(async asset=>{
    const request=new Request(new URL(asset,self.registration.scope),{cache:'reload'});
    const r=await fetch(request);
    if(!r.ok)throw new Error('Missing offline asset: '+asset+' (HTTP '+r.status+')');
    await cache.put(request,r);
   }));
 }await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const names=await caches.keys();await Promise.all(names.filter(n=>n.startsWith('idlens-v')&&n.endsWith('-static')&&n!==VERSION).map(n=>caches.delete(n)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);if(url.origin!==self.location.origin)return;
 event.respondWith((async()=>{
 const stored=await caches.match(request);
 // Both bundled assets and optional updated packs load from local CacheStorage first.
 if(stored)return stored;
 try{const response=await fetch(request);
  if(response.ok&&url.pathname.startsWith(new URL('./assets/',self.registration.scope).pathname)){
   const cache=await caches.open(VERSION);await cache.put(request,response.clone());}
  return response;
 }catch(e){
  if(request.mode==='navigate'){
   const home=await caches.match(new URL('./index.html',self.registration.scope));if(home)return home;
  }
  return new Response('Offline resource unavailable. Run deployment asset preparation.',{status:503,headers:{'Content-Type':'text/plain'}});
 }
 })());
});
