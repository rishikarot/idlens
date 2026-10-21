const assert=require('node:assert/strict');const B=require('../blink-core.js');
function run(left,right,t,s){return B.step({left,right},s,t)}
let st={};
for(let i=0;i<3;i++)run(.11,.12,i*80,st);
assert.equal(st.phase,'await_closed');
assert.equal(run(.68,.72,320,st).done,false);
assert.equal(run(.74,.76,420,st).stage,'closed');
assert.equal(run(.12,.11,530,st).stage,'opening');
assert.equal(run(.12,.10,630,st).done,true);
st={};for(let i=0;i<3;i++)run(.15,.13,i*80,st);
assert.equal(run(.85,.17,300,st).stage,'waiting'); // one eye is not enough
assert.equal(run(.16,.12,430,st).done,false);
assert.equal(B.fromResult({faceBlendshapes:[{categories:[{categoryName:'eyeBlinkLeft',score:.75},{categoryName:'eyeBlinkRight',score:.8}]}]}).left,.75);
assert.equal(B.faceBox([{x:0,y:0}]),null);
console.log('Blink blendshape hysteresis tests passed');
