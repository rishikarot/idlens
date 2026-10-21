/* ID Lens v3.3.1 — purely geometric, locally executed challenge features.
 * Heuristic active liveness only; not a presentation-attack detector or biometric certification.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.IDLensMotion=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const D=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const avg=(...p)=>({x:p.reduce((s,v)=>s+v.x,0)/p.length,y:p.reduce((s,v)=>s+v.y,0)/p.length});
 const clamp=(v,a,b)=>Math.max(a,Math.min(v,b));
 function ear(p,offset){const [a,b,c,d,e,f]=p.slice(offset,offset+6);return (D(b,f)+D(c,e))/(2*Math.max(1,D(a,d)));}
 function metrics(face,w,h){const p=face?.landmarks?.positions||face?.positions;if(!p||p.length<68)throw Error('Facial landmarks unavailable');
  const box=face.detection?.box||face.box;if(!box||!box.width||!box.height)throw Error('Face bounding box unavailable');
  const eyes=avg(p[36],p[39],p[42],p[45]),eyeGap=Math.max(1,D(avg(p[36],p[39]),avg(p[42],p[45]))),mouthCenter=avg(p[48],p[54]);
  const topM=avg(p[51],p[62]),bottomM=avg(p[57],p[66]);
  // Ratios are orientation cues, not calibrated head angles. Translation cancels by normalization.
  const jawY=(p[8].y-eyes.y)||1;
  const yaw=(p[30].x-eyes.x)/eyeGap;
  const pitch=(p[30].y-eyes.y)/Math.max(1,jawY);
  const smileSpread=D(p[48],p[54])/eyeGap;
  const cornerLift=(mouthCenter.y-(p[51].y+p[57].y)/2)/eyeGap;
  return {ear:(ear(p,36)+ear(p,42))/2,yaw,pitch,smileSpread,cornerLift,mouthOpen:D(topM,bottomM)/eyeGap,
   x:(box.x+box.width/2)/w,y:(box.y+box.height/2)/h,size:box.width/w,confidence:face.detection?.score??1};
 }
 function mean(samples){const keys=['ear','yaw','pitch','smileSpread','cornerLift','mouthOpen','x','y','size'];const out={};for(const k of keys)out[k]=samples.reduce((s,x)=>s+x[k],0)/samples.length;return out;}
 function continuous(previous,current){if(!previous)return true;return Math.hypot(previous.x-current.x,previous.y-current.y)<.25 && current.size/Math.max(.01,previous.size)>.58 && current.size/Math.max(.01,previous.size)<1.75;}
 function action(type,baseline,current,state,now){const s=state||{};
  if(type==='blink'){
   // Deliberate eyes-closed challenge rather than a sub-200 ms natural blink:
   // frame-based face landmark inference on phones can miss a quick blink entirely.
   // Calibrated with the neutral (eyes-open) EAR. Hysteresis prevents boundary flicker.
   const open=Math.max(.01,baseline.ear);
   const closedLimit=Math.max(.12,Math.min(open*.84,open-.025));
   const openedLimit=Math.max(closedLimit+.023,open*.91);
   if(s.completed)return {done:true,stage:'complete',description:'Eye movement recognized'};
   if(!s.phase)s.phase='await_closed';
   if(s.phase==='await_closed'){
    if(current.ear<closedLimit){s.phase='closed';s.closedAt=now;s.closedFrames=1;}
    return {done:false,stage:s.phase==='closed'?'closed':'waiting',description:'Close both eyes gently and hold for about one second'};
   }
   if(s.phase==='closed'){
    if(now-s.closedAt>3200){s.phase='await_closed';s.closedFrames=0;return {done:false,stage:'waiting',description:'Let’s try that again. Close and then open your eyes'};}
    if(current.ear<closedLimit){s.closedFrames++;return {done:false,stage:'closed',description:'Eyes closed detected — now open your eyes'};}
    if(current.ear>openedLimit){
     // Need observations of closed eyelids, not just a single landmark fluctuation.
     if(s.closedFrames>=2&&now-s.closedAt>=220){s.completed=true;return {done:true,stage:'complete',description:'Eyes open again — great!'};}
     s.phase='await_closed';s.closedFrames=0;
     return {done:false,stage:'waiting',description:'Please hold your eyes closed a little longer, then open'};
    }
    return {done:false,stage:'closed',description:'Hold your eyes closed briefly, then open'};
   }
   return {done:false,stage:'waiting',description:'Close your eyes gently and then reopen'};
  }
  if(type==='turn')return {done:Math.abs(current.yaw-baseline.yaw)>.23,description:'Turn your head to one side'};
  if(type==='pitch')return {done:Math.abs(current.pitch-baseline.pitch)>.075,description:'Look up or down (move head, not just eyes)'};
  if(type==='smile')return {done:current.smileSpread-baseline.smileSpread>.10 || (current.smileSpread-baseline.smileSpread>.065 && current.cornerLift-baseline.cornerLift>.045),description:'Give a clear smile'};
  if(type==='hold')return {done:Math.abs(current.yaw-baseline.yaw)<.12&&Math.abs(current.pitch-baseline.pitch)<.055&&current.ear>baseline.ear*.82,description:'Face forward and hold still'};
  throw Error('Unsupported challenge');
 }
 function shuffle(input,bytes){const arr=[...input];for(let i=arr.length-1;i>0;i--){const j=bytes[i]% (i+1);[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
 return {metrics,mean,continuous,action,shuffle};
});
