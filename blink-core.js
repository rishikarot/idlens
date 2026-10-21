/* ID Lens v3.4.0 - bilateral eye blendshape state machine. Not PAD certification. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.IDLensBlink=api})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 function fromResult(result){
  const cats=result?.faceBlendshapes?.[0]?.categories||[];
  const get=(name)=>{const v=cats.find(x=>x.categoryName===name)?.score;return Number.isFinite(v)?v:NaN;};
  return {left:get('eyeBlinkLeft'),right:get('eyeBlinkRight')};
 }
 function valid(x){return x&&Number.isFinite(x.left)&&Number.isFinite(x.right)&&x.left>=0&&x.left<=1&&x.right>=0&&x.right<=1;}
 function step(scores,s,now){
  if(!valid(scores))return {done:false,stage:'unavailable',message:'I cannot see both eyes clearly. Reduce glare and look forward.'};
  if(!s.phase)s.phase='baseline';
  if(s.phase==='complete')return {done:true,stage:'complete',message:'Eyes reopened — blink accepted'};
  if(s.phase==='baseline'){
   if(scores.left<.48&&scores.right<.48){
    s.opens??=[];s.opens.push({left:scores.left,right:scores.right});
    if(s.opens.length>=3){s.base={left:s.opens.reduce((x,y)=>x+y.left,0)/s.opens.length,right:s.opens.reduce((x,y)=>x+y.right,0)/s.opens.length};s.phase='await_closed';}
   }
   return {done:false,stage:'baseline',message:'Look straight ahead with both eyes naturally open.'};
  }
  const b=s.base,closedLeft=Math.max(.45,b.left+.20),closedRight=Math.max(.45,b.right+.20);
  const openLeft=Math.min(.40,b.left+.12),openRight=Math.min(.40,b.right+.12);
  const closed=scores.left>=closedLeft&&scores.right>=closedRight;
  const opened=scores.left<=openLeft&&scores.right<=openRight;
  if(s.phase==='await_closed'){
   if(closed){s.phase='closed';s.closedFrames=1;s.closedAt=now;}
   return {done:false,stage:s.phase==='closed'?'closed':'waiting',message:s.phase==='closed'?'Eyes closed detected — now open both eyes.':'Close both eyes gently for half a second, then open.'};
  }
  if(s.phase==='closed'){
   if(now-s.closedAt>3500){s.phase='await_closed';s.closedFrames=0;return {done:false,stage:'waiting',message:'Let’s try once more. Close your eyes gently, then reopen.'};}
   if(closed){s.closedFrames=(s.closedFrames||0)+1;return {done:false,stage:'closed',message:'Great, eyes closed! Now open both eyes.'};}
   if(opened&&s.closedFrames>=2&&now-s.closedAt>=150){s.phase='opening';s.openFrames=1;return {done:false,stage:'opening',message:'Almost there! Keep your eyes open.'};}
   return {done:false,stage:'closed',message:'Open both eyes and look toward the camera.'};
  }
  if(s.phase==='opening'){
   if(opened){s.openFrames++;if(s.openFrames>=2){s.phase='complete';return {done:true,stage:'complete',message:'Beautiful — eye blink captured!'};}}
   else if(closed){s.phase='closed';s.closedAt=now;s.closedFrames=1;}
   else {s.phase='await_closed';s.closedFrames=0;}
   return {done:false,stage:s.phase==='opening'?'opening':'waiting',message:'Keep your eyes open for just a moment.'};
  }
  return {done:false,stage:'waiting',message:'Blink not completed'};
 }
 function faceBox(landmarks){
  if(!Array.isArray(landmarks)||landmarks.length<468)return null;
  let minX=1,minY=1,maxX=0,maxY=0;
  for(const p of landmarks){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
  const width=maxX-minX,height=maxY-minY;
  if(width<.1||height<.1)return null;
  return {x:clamp((minX+maxX)/2,0,1),y:clamp((minY+maxY)/2,0,1),size:width};
 }
 return {fromResult,step,faceBox};
});
