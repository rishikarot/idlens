const assert=require('node:assert/strict');
const live=require('../liveness-core.js');
const base={ear:.29,yaw:0,pitch:.39,smileSpread:1.50,cornerLift:.01,x:.5,y:.5,size:.34};
let now=1000,st={};
assert.equal(live.action('blink',base,{...base,ear:.17},st,now).stage,'closed');
assert.equal(live.action('blink',base,{...base,ear:.16},st,now+300).stage,'closed');
assert.equal(live.action('blink',base,{...base,ear:.29},st,now+560).done,true);
assert.equal(live.action('blink',base,{...base,ear:.29},st,now+720).done,true,'completion stays latched while UI advances');
// Glasses can compress EAR; relative eye-closure change must still work.
let glasses={...base,ear:.21},g={};
assert.equal(live.action('blink',glasses,{...glasses,ear:.17},g,2000).done,false);
assert.equal(live.action('blink',glasses,{...glasses,ear:.16},g,2250).stage,'closed');
assert.equal(live.action('blink',glasses,{...glasses,ear:.21},g,2500).done,true);
// Single-frame eyelid noise must NOT pass.
let noisy={};
assert.equal(live.action('blink',base,{...base,ear:.18},noisy,3000).done,false);
assert.equal(live.action('blink',base,base,noisy,3350).done,false);
// Neutral open eyes alone are never enough.
let staticEyes={};
for(let t=0;t<4000;t+=300)assert.equal(live.action('blink',base,base,staticEyes,4000+t).done,false);
// Too long a closure resets to waiting, rather than passing.
let held={};live.action('blink',base,{...base,ear:.16},held,9000);
assert.equal(live.action('blink',base,{...base,ear:.16},held,12500).stage,'waiting');
for (const type of ['turn','pitch','smile']) assert.equal(live.action(type,base,base,{},2000).done,false,'neutral should not pass '+type);
assert.equal(live.action('turn',base,{...base,yaw:.27},{},2000).done,true);
assert.equal(live.action('pitch',base,{...base,pitch:.48},{},2000).done,true);
assert.equal(live.action('smile',base,{...base,smileSpread:1.67},{},2000).done,true);
assert.equal(live.action('hold',base,base,{},2000).done,true);
assert.equal(live.action('hold',base,{...base,yaw:.3},{},2000).done,false);
assert.equal(live.continuous(base,{...base,x:.54}),true);
assert.equal(live.continuous(base,{...base,x:.92}),false);
const shuffled=live.shuffle(['blink','turn','pitch','smile'],new Uint8Array([4,1,8,12]));
assert.deepEqual([...shuffled].sort(),['blink','turn','pitch','smile'].sort());
console.log('Liveness geometry and challenge logic tests passed.');
