import { PixiRagdollRenderer } from "./pixi-ragdoll-renderer.js";

const COLORS=["#ff4f6d","#42d77d","#49a8ff","#ffd24a","#b66cff","#ff8b3d","#35d5d0","#f57bd8","#a8e063","#8b9cff"];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const uid=()=>`part-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
const artworkCache=new Map();
export function ensureRagdoll(actor){
  actor.ragdoll ||= {version:1,sections:[],strokes:[],stack:[],underdrawing:"",showRig:true,animations:[]};
  if(!actor.ragdoll.sections.length)actor.ragdoll.sections.push({id:uid(),name:"Section 1",color:COLORS[0],visible:true,pivot:{x:.5,y:.5},handle:{x:.65,y:.5}});
  actor.ragdoll.animations ||= [];
  if(!actor.ragdoll.animations.length){
    actor.ragdoll.animations.push({id:uid(),name:"Animation 1",duration:2.0,loop:false,snapshots:[]});
  }
  actor.ragdoll.activeAnimationId ||= actor.ragdoll.animations[0]?.id;
  actor.ragdoll.idleAnimationId ||= actor.idleAnimationId || actor.ragdoll.activeAnimationId;
  actor.idleAnimationId ||= actor.ragdoll.idleAnimationId;
  return actor.ragdoll;
}
function circlePixels(owner,w,h,x,y,r,value,expected=null){const minX=Math.max(0,Math.floor(x-r)),maxX=Math.min(w-1,Math.ceil(x+r)),minY=Math.max(0,Math.floor(y-r)),maxY=Math.min(h-1,Math.ceil(y+r)),rr=r*r;for(let py=minY;py<=maxY;py++)for(let px=minX;px<=maxX;px++)if((px-x)**2+(py-y)**2<=rr&&(expected==null||owner[py*w+px]===expected))owner[py*w+px]=value;}
function rebuildMasks(rig,w,h){const masks=rig.sections.map(()=>new Uint8Array(w*h));for(const stroke of rig.strokes||[]){const section=rig.sections.findIndex(s=>s.id===stroke.sectionId);if(section<0)continue;for(const p of stroke.points)circlePixels(masks[section],w,h,p.x*w,p.y*h,stroke.size*w,stroke.erase?0:1);}return masks;}
function ownerFromMasks(masks,w,h){const owner=new Int16Array(w*h);owner.fill(-1);for(let section=0;section<masks.length;section++)for(let i=0;i<w*h;i++)if(masks[section][i])owner[i]=section;return owner;}
function imageSource(actor){return actor.sprite||null;}
async function loadArtwork(actor){const source=imageSource(actor);if(source){if(!artworkCache.has(source)){const image=new Image();image.src=source;artworkCache.set(source,image.decode().then(()=>image).catch(error=>{artworkCache.delete(source);throw error;}));}return artworkCache.get(source);}const key=`icon:${actor.icon||"👤"}`;if(!artworkCache.has(key)){const canvas=document.createElement("canvas");canvas.width=192;canvas.height=192;const ctx=canvas.getContext("2d");ctx.font="130px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(actor.icon||"👤",96,102);artworkCache.set(key,Promise.resolve(canvas));}return artworkCache.get(key);}
function maskCanvas(mask,w,h){const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const data=canvas.getContext("2d").createImageData(w,h);for(let i=0;i<mask.length;i++)data.data[i*4+3]=mask[i]?255:0;canvas.getContext("2d").putImageData(data,0,0);return canvas;}
function renderPiece(art,section,mask,w,h){const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d");ctx.imageSmoothingEnabled=false;ctx.drawImage(art,0,0,w,h);ctx.globalCompositeOperation="destination-in";ctx.drawImage(maskCanvas(mask,w,h),0,0);ctx.globalCompositeOperation="source-over";for(const op of section.infill||[]){ctx.save();ctx.globalAlpha=clamp(Number(op.opacity??1),0,1);if(op.type==="brush"){for(const point of op.points||[]){const radius=Math.max(.5,Number(op.size||.02)*w),soft=clamp(Number(op.softness||0),0,1),gradient=ctx.createRadialGradient(point.x*w,point.y*h,radius*(1-soft),point.x*w,point.y*h,radius);gradient.addColorStop(0,op.color||"#ffffff");gradient.addColorStop(1,soft?`${op.color||"#ffffff"}00`:op.color||"#ffffff");ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(point.x*w,point.y*h,radius,0,Math.PI*2);ctx.fill();}}else if(op.type==="stamp"){const radius=Math.max(1,Number(op.size||.05)*w),sx=op.source.x*w-radius,sy=op.source.y*h-radius,tx=op.target.x*w-radius,ty=op.target.y*h-radius,snapshot=document.createElement("canvas");snapshot.width=radius*2;snapshot.height=radius*2;snapshot.getContext("2d").drawImage(canvas,sx,sy,radius*2,radius*2,0,0,radius*2,radius*2);ctx.beginPath();ctx.arc(op.target.x*w,op.target.y*h,radius,0,Math.PI*2);ctx.clip();ctx.drawImage(snapshot,tx,ty);}ctx.restore();ctx.globalCompositeOperation="destination-in";ctx.drawImage(maskCanvas(mask,w,h),0,0);ctx.globalCompositeOperation="source-over";}return canvas;}
function makePieces(art,rig,w,h,masks){return rig.sections.map((section,index)=>renderPiece(art,section,masks[index],w,h));}
function makeUnderdrawing(art,w,h,masks){const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(art,0,0,w,h);const data=ctx.getImageData(0,0,w,h),out=new Uint8ClampedArray(data.data),holes=new Uint8Array(w*h);for(let i=0;i<w*h;i++)if(masks.some(mask=>mask[i])){holes[i]=1;out[i*4+3]=0;}for(let pass=0;pass<Math.max(w,h);pass++){let changed=0;const next=new Uint8ClampedArray(out);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!holes[i]||out[i*4+3])continue;for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(nx<0||ny<0||nx>=w||ny>=h)continue;const n=ny*w+nx;if(out[n*4+3]){for(let c=0;c<4;c++)next[i*4+c]=out[n*4+c];changed++;break;}}}out.set(next);if(!changed)break;}ctx.putImageData(new ImageData(out,w,h),0,0);return canvas;}
function connections(rig,masks,w,h){
  const result=[];
  rig.sections.forEach((section,a)=>{
    const x=clamp(Math.round(section.pivot.x*w),0,w-1),y=clamp(Math.round(section.pivot.y*h),0,h-1);
    let bestB=-1,minDepthDist=Infinity;
    for(let b=0;b<rig.sections.length;b++){
      if(b===a)continue;
      if(masks[b]&&masks[b][y*w+x]){
        const dist=Math.abs(b-a);
        if(dist<minDepthDist||(dist===minDepthDist&&b>a)){
          minDepthDist=dist;
          bestB=b;
        }
      }
    }
    if(bestB>=0){
      result.push({a,b:bestB,x:section.pivot.x*w,y:section.pivot.y*h});
    }
  });
  return result;
}

export async function buildRagdollRenderData(actor){
  const rig=ensureRagdoll(actor),art=await loadArtwork(actor),max=256,scale=Math.min(1,max/Math.max(art.width,art.height)),w=Math.max(1,Math.round(art.width*scale)),h=Math.max(1,Math.round(art.height*scale)),masks=rebuildMasks(rig,w,h);
  return {rig,w,h,pieces:makePieces(art,rig,w,h,masks),under:makeUnderdrawing(art,w,h,masks)};
}
export function sampleRagdollPose(rig,animation,time=0,blockDuration=null){
  const rest=rig.sections.map(()=>({x:0,y:0,r:0})),snapshots=animation?.snapshots||[];
  if(!snapshots.length)return rest;
  if(snapshots.length===1)return rig.sections.map((_,i)=>({...rest[i],...(snapshots[0].pose?.[i]||{})}));
  const animationDuration=Math.max(.1,Number(animation.duration||2)),playbackDuration=Math.max(.1,Number(blockDuration||animationDuration));
  let progress=Number(time||0)/playbackDuration;progress=animation.loop?((progress%1)+1)%1:clamp(progress,0,1);
  const count=snapshots.length,val=progress*(animation.loop?count:count-1),a=Math.min(count-1,Math.floor(val)),b=animation.loop?(a+1)%count:Math.min(count-1,a+1),t=0.5-0.5*Math.cos(clamp(val-Math.floor(val),0,1)*Math.PI);
  return rig.sections.map((_,i)=>{const from=snapshots[a].pose?.[i]||rest[i],to=snapshots[b].pose?.[i]||from;let rotation=(Number(to.r||0)-Number(from.r||0))%(Math.PI*2);if(rotation>Math.PI)rotation-=Math.PI*2;if(rotation<-Math.PI)rotation+=Math.PI*2;return{x:Number(from.x||0)+(Number(to.x||0)-Number(from.x||0))*t,y:Number(from.y||0)+(Number(to.y||0)-Number(from.y||0))*t,r:Number(from.r||0)+rotation*t};});
}

export class RagdollEditor{
  constructor(host,actor,{mode="paint",onChange=()=>{},isCurrent=()=>true}={}){
    this.host=host;
    this.host._ragdollEditor=this;
    this.actor=actor;
    this.rig=ensureRagdoll(actor);
    this.mode=mode;
    this.onChange=onChange;
    this.isCurrent=()=>isCurrent()&&this.host._ragdollEditor===this;
    this.tool=mode==="infill"?"brush":"paint";
    this.brush=.018;
    this.infillColor="#ffffff";
    this.infillSoftness=0;
    this.infillOpacity=1;
    this.stampSource=null;
    this.hoverPoint=null;
    this.zoom=1;
    this.pan={x:0,y:0};
    this.selected=this.rig.sections[0]?.id;
    this.activeAnimationId=this.rig.activeAnimationId||this.rig.animations[0]?.id;
    this.idleAnimationId=this.rig.idleAnimationId||this.actor.idleAnimationId||this.rig.animations[0]?.id;
    this.rig.idleAnimationId=this.idleAnimationId;
    this.actor.idleAnimationId=this.idleAnimationId;
    this.isPlaying=false;
    this.playhead=0;
    this.animRaf=null;
    this.lastTime=0;
    this.selectedSnapshotIndex=null;
    this.undo=[];
    this.redo=[];
    this.drag=null;
    this.destroyed=false;
  }
  async init(){
    this.art=await loadArtwork(this.actor);
    if(this.destroyed||!this.isCurrent())return;
    const max=256,scale=Math.min(1,max/Math.max(this.art.width,this.art.height));
    this.w=Math.max(1,Math.round(this.art.width*scale));
    this.h=Math.max(1,Math.round(this.art.height*scale));
    this.rebuildMasks();
    this.renderShell();
    this.bind();
    if(this.mode==="test"||this.mode==="animations")this.prepareTest();
    this.draw();
    return this;
  }
  activeAnimation(){
    ensureRagdoll(this.actor);
    return this.rig.animations.find(a=>a.id===this.activeAnimationId)||this.rig.animations[0];
  }
  rebuildMasks(){this.masks=rebuildMasks(this.rig,this.w,this.h);this.owner=ownerFromMasks(this.masks,this.w,this.h);}
  snapshot(){this.dirty=true;this.undo.push(structuredClone({sections:this.rig.sections,strokes:this.rig.strokes}));this.undo=this.undo.slice(-40);this.redo=[];}
  restore(value){if(!value)return;this.rig.sections=value.sections;this.rig.strokes=value.strokes;this.selected=this.rig.sections[0]?.id;this.rebuildMasks();if(this.mode==="test"||this.mode==="animations")this.prepareTest();this.renderShell();this.bind();this.draw();this.changed();}
  changed(){this.dirty=true;clearTimeout(this.changeTimer);this.changeTimer=setTimeout(()=>{this.dirty=false;this.onChange(this.rig);},120);}
  renderShell(){
    this.runtimeRenderer?.destroy();
    this.runtimeRenderer=null;
    const selected=this.rig.sections.find(s=>s.id===this.selected)||this.rig.sections[0];
    this.selected=selected?.id;
    const paint=this.mode==="paint",infill=this.mode==="infill",animMode=this.mode==="animations";
    const activeAnim=this.activeAnimation();
    if(activeAnim)this.activeAnimationId=activeAnim.id;
    const currentIdleId=this.rig.idleAnimationId||this.actor.idleAnimationId||this.rig.animations[0]?.id;

    let tools="";
    if(paint){
      tools=`<button data-rag-tool="paint" class="${this.tool==="paint"?"active":""}">✎ PAINT</button><button data-rag-tool="erase" class="${this.tool==="erase"?"active":""}">⌫ ERASE</button><label>BRUSH <input data-rag-brush type="range" min=".003" max=".08" step=".002" value="${this.brush}"></label><button data-rag-undo ${this.undo.length?"":"disabled"}>↶</button><button data-rag-redo ${this.redo.length?"":"disabled"}>↷</button>`;
    }else if(infill){
      tools=`<button data-rag-tool="brush" class="${this.tool==="brush"?"active":""}">● BRUSH</button><button data-rag-tool="dropper" class="${this.tool==="dropper"?"active":""}">⌾ DROPPER</button><button data-rag-tool="stamp" class="${this.tool==="stamp"?"active":""}">◉ STAMP</button><label>COLOR <input data-rag-infill-color type="color" value="${this.infillColor}"></label><label>SIZE <input data-rag-brush type="range" min=".003" max=".12" step=".002" value="${this.brush}"></label><label>SOFT <input data-rag-softness type="range" min="0" max="1" step=".05" value="${this.infillSoftness}"></label><label>ALPHA <input data-rag-opacity type="range" min=".05" max="1" step=".05" value="${this.infillOpacity}"></label><button data-rag-reset-infill ${selected?.infill?.length?"":"disabled"}>RESET LAYER</button><button data-rag-undo ${this.undo.length?"":"disabled"}>↶</button><button data-rag-redo ${this.redo.length?"":"disabled"}>↷</button>`;
    }else{
      tools=`<button data-rag-reset>↺ RESET POSE</button><label><input data-rag-debug type="checkbox" ${this.rig.showRig!==false?"checked":""}> SHOW RIG</label>`;
    }

    const asideContent = animMode ? `
      <header><b>RAGDOLL ANIMATIONS</b><button data-rag-add-anim title="Add new animation">＋</button></header>
      <div class="rag-anim-list">
        ${(this.rig.animations||[]).map((anim)=>{
          const isIdle = anim.id === currentIdleId;
          return `
          <div data-rag-anim-select="${anim.id}" class="rag-anim-card ${anim.id===this.activeAnimationId?"active":""} ${isIdle?"is-idle-anim":""}">
            <div class="rag-anim-item-header">
              <span>${isIdle?"⭐":"🎬"}</span>
              <input data-rag-anim-name="${anim.id}" value="${anim.name||"Untitled"}" onclick="event.stopPropagation()">
              <button type="button" data-rag-set-idle="${anim.id}" class="rag-idle-btn ${isIdle?"is-idle":""}" title="${isIdle?"Default Idle Animation (Plays on loop when idle & visible)":"Set as Default Idle Animation"}" onclick="event.stopPropagation()">
                ${isIdle?"⭐ IDLE":"☆ IDLE"}
              </button>
              <em data-rag-anim-delete="${anim.id}" title="Delete animation" onclick="event.stopPropagation()">×</em>
            </div>
            <small>${isIdle?`<b style="color:#ffd24a;">⭐ DEFAULT IDLE</b> · `:""}${anim.snapshots?.length||0} poses · ${(Number(anim.duration)||2).toFixed(1)}s ${anim.loop?"· 🔁 Loop":""}</small>
          </div>
        `;}).join("")}
      </div>
      <small class="rag-layer-help">SELECT ANIMATION TO RECORD POSES · SET ⭐ IDLE FOR DEFAULT LOOP</small>
    ` : `
      <header><b>RIGID SECTIONS</b>${paint?`<button data-rag-add title="Add rigid section">＋</button>`:""}</header>
      <div class="rag-section-list">${this.rig.sections.map((s,i)=>`<button draggable="${paint}" data-rag-section="${s.id}" class="${s.id===this.selected?"active":""}"><i style="--part:${s.color}"></i><span><b>${s.name}</b><small>${i===0?"FRONT":"LAYER "+(i+1)}</small></span><em data-rag-visible="${s.id}" title="Show/hide overlay">${s.visible===false?"○":"◉"}</em></button>`).join("")}</div>
      ${paint?`<small class="rag-layer-help">DRAG TO REORDER · TOP IS FRONT</small><button data-rag-clear>⌫ CLEAR SELECTED</button>`:""}
    `;

    const isCurrentActiveIdle = activeAnim && activeAnim.id === currentIdleId;
    const transportAndSnapshots = animMode && activeAnim ? `
      <div class="rag-transport-bar">
        <button data-rag-anim-play class="rag-play-btn ${this.isPlaying?"active":""}">${this.isPlaying?"⏸ PAUSE":"▶ PLAY"}</button>
        <button data-rag-anim-rewind class="rag-transport-btn" title="Rewind to start">⏮</button>
        <input data-rag-anim-scrub type="range" min="0" max="${Math.max(0.1,Number(activeAnim.duration||2))}" step="0.01" value="${this.playhead.toFixed(2)}">
        <time class="rag-time-readout">${this.playhead.toFixed(2)}s / ${Math.max(0.1,Number(activeAnim.duration||2)).toFixed(2)}s</time>
        <label>DURATION <input data-rag-anim-duration type="number" min="0.2" max="30" step="0.1" value="${Number(activeAnim.duration||2).toFixed(1)}">s</label>
        <label class="rag-loop-check"><input data-rag-anim-loop type="checkbox" ${activeAnim.loop?"checked":""}> LOOP</label>
        <button type="button" data-rag-set-idle="${activeAnim.id}" class="rag-set-idle-btn ${isCurrentActiveIdle?"is-idle":""}" title="${isCurrentActiveIdle?"This animation is set as the default idle animation (plays on loop when idle)":"Make this animation the default idle animation"}">
          ${isCurrentActiveIdle?"⭐ IDLE ANIMATION":"☆ SET AS IDLE"}
        </button>
      </div>
      <div class="rag-snapshot-bar-container">
        <div class="rag-snapshot-scroll">
          ${(activeAnim.snapshots||[]).map((snap,idx)=>`
            <div class="rag-snapshot-card ${this.selectedSnapshotIndex===idx?"selected":""}" data-rag-snapshot-select="${idx}" title="${this.selectedSnapshotIndex===idx?`Pose ${idx+1} loaded · Click again to update & overwrite with current pose`:`Click to load Pose ${idx+1} into model`}">
              <div class="rag-snapshot-thumb">
                ${snap.thumb?`<img src="${snap.thumb}" alt="Pose ${idx+1}">`:`<span>👤</span>`}
                <button data-rag-snapshot-delete="${idx}" title="Delete pose snapshot" onclick="event.stopPropagation()">×</button>
              </div>
              <span class="rag-snapshot-label">Pose ${idx+1}${this.selectedSnapshotIndex===idx?" ✓":""}</span>
            </div>
          `).join("")}
          <button data-rag-save-pose class="rag-save-pose-btn" title="Save current pose to timeline">
            <span>📷</span>
            <b>＋ SAVE POSE</b>
          </button>
        </div>
      </div>
    ` : "";

    this.host.innerHTML=`
      <div class="ragdoll-editor mode-${this.mode}">
        <aside>${asideContent}</aside>
        <main>
          <div class="rag-toolbar">
            ${tools}
            <button data-rag-zoom="-.2">−</button>
            <b>${Math.round(this.zoom*100)}%</b>
            <button data-rag-zoom=".2">＋</button>
            <button data-rag-center>⌂</button>
          </div>
          <div class="rag-stage">
            <canvas class="rag-editor-overlay"></canvas>
            <div class="rag-help">
              ${paint?"Paint pixels · drag pivot/handle markers · middle-drag or Space-drag to pan":infill?(this.tool==="stamp"?(this.stampSource?"Move the copy, then click to place it":"Click artwork to choose a stamp source"):"Edits are clipped to this layer’s painted pixels"):animMode?"Pose the ragdoll model above · click ＋ SAVE POSE to add keyframes · press ▶ PLAY to preview smoothly":"Grab a joint or piece to move · drag yellow handle to rotate"}
            </div>
          </div>
          ${transportAndSnapshots}
          ${paint&&selected?`<div class="rag-part-settings"><label>SECTION NAME<input data-rag-name value="${selected.name}"></label><span><i class="pivot-key"></i> PIVOT / JOINT</span><span><i class="handle-key"></i> HANDLE / DIRECTION</span><small>Pivots automatically connect when they fall inside another painted color.</small></div>`:""}
        </main>
      </div>
    `;

    this.canvas=this.host.querySelector(".rag-editor-overlay");
    this.ctx=this.canvas?.getContext("2d");
    this.stage=this.host.querySelector(".rag-stage");
    if(this.mode==="test"||this.mode==="animations")this.mountPixiRuntime();
  }
  async mountPixiRuntime(){
    const renderer=new PixiRagdollRenderer({host:this.stage,replaceHostContents:false,autoTick:false,padding:1});
    this.runtimeRenderer=renderer;
    try{
      await renderer.init();
      await renderer.setActor(this.actor,this.activeAnimation(),this.playhead);
      if(this.destroyed||this.runtimeRenderer!==renderer){renderer.destroy();return;}
      this.draw();
    }catch(error){
      if(this.runtimeRenderer===renderer){renderer.destroy();this.runtimeRenderer=null;}
      console.warn("Pixi ragdoll editor preview could not start",error);
    }
  }
  bind(){
    this.host.onclick=e=>{
      const setIdle=e.target.closest("[data-rag-set-idle]");
      if(setIdle){
        const id=setIdle.dataset.ragSetIdle;
        this.rig.idleAnimationId=id;
        this.actor.idleAnimationId=id;
        if(this.actor.ragdoll)this.actor.ragdoll.idleAnimationId=id;
        this.renderShell();
        this.bind();
        this.draw();
        this.changed();
        return;
      }
      if(e.target.closest("[data-rag-add-anim]")){
        const n=(this.rig.animations||[]).length;
        const newAnim={id:uid(),name:`Animation ${n+1}`,duration:2.0,loop:false,snapshots:[]};
        this.rig.animations.push(newAnim);
        this.activeAnimationId=newAnim.id;
        this.rig.activeAnimationId=newAnim.id;
        this.pauseAnimation();
        this.playhead=0;
        this.selectedSnapshotIndex=null;
        this.renderShell();
        this.bind();
        this.draw();
        this.changed();
        return;
      }
      const animSelect=e.target.closest("[data-rag-anim-select]");
      if(animSelect&&!e.target.closest("[data-rag-anim-delete]")&&!e.target.closest("[data-rag-set-idle]")&&!e.target.closest("input")){
        const id=animSelect.dataset.ragAnimSelect;
        this.activeAnimationId=id;
        this.rig.activeAnimationId=id;
        this.pauseAnimation();
        this.playhead=0;
        this.selectedSnapshotIndex=null;
        const anim=this.activeAnimation();
        if(anim?.snapshots?.length){
          this.pose=anim.snapshots[0].pose.map(p=>({...p}));
          this.selectedSnapshotIndex=0;
        }else{
          this.resetPose();
        }
        this.renderShell();
        this.bind();
        this.draw();
        return;
      }
      const animDelete=e.target.closest("[data-rag-anim-delete]");
      if(animDelete){
        const id=animDelete.dataset.ragAnimDelete;
        if(this.rig.animations.length>1){
          this.pauseAnimation();
          this.rig.animations=this.rig.animations.filter(a=>a.id!==id);
          if(this.rig.idleAnimationId===id||this.actor.idleAnimationId===id){
            this.rig.idleAnimationId=this.rig.animations[0].id;
            this.actor.idleAnimationId=this.rig.idleAnimationId;
            if(this.actor.ragdoll)this.actor.ragdoll.idleAnimationId=this.rig.idleAnimationId;
          }
          this.activeAnimationId=this.rig.animations[0].id;
          this.rig.activeAnimationId=this.activeAnimationId;
          this.renderShell();
          this.bind();
          this.draw();
          this.changed();
        }
        return;
      }
      if(e.target.closest("[data-rag-save-pose]")){
        this.savePoseSnapshot();
        return;
      }
      const snapSelect=e.target.closest("[data-rag-snapshot-select]");
      if(snapSelect&&!e.target.closest("[data-rag-snapshot-delete]")){
        const idx=Number(snapSelect.dataset.ragSnapshotSelect);
        const anim=this.activeAnimation();
        if(anim?.snapshots?.[idx]){
          this.pauseAnimation();
          if(this.selectedSnapshotIndex===idx){
            // Clicked again on currently selected pose -> update with current model pose & re-capture thumbnail
            const clonedPose=this.pose.map(p=>({x:Math.round(p.x*10)/10,y:Math.round(p.y*10)/10,r:Math.round(p.r*1000)/1000}));
            const thumb=this.captureThumbnail(clonedPose);
            anim.snapshots[idx].pose=clonedPose;
            anim.snapshots[idx].thumb=thumb;
            this.changed();
            this.renderShell();
            this.bind();
            this.draw();
            return;
          }
          // First click -> load saved pose into model
          this.pose=anim.snapshots[idx].pose.map(p=>({...p}));
          this.selectedSnapshotIndex=idx;
          const totalKeys=anim.snapshots.length-(anim.loop?0:1);
          this.playhead=totalKeys>0?idx*(Number(anim.duration||2)/totalKeys):0;
          this.updateTransportUI();
          this.draw();
          this.renderShell();
          this.bind();
        }
        return;
      }
      const snapDelete=e.target.closest("[data-rag-snapshot-delete]");
      if(snapDelete){
        const idx=Number(snapDelete.dataset.ragSnapshotDelete);
        const anim=this.activeAnimation();
        if(anim?.snapshots?.[idx]){
          this.pauseAnimation();
          anim.snapshots.splice(idx,1);
          this.selectedSnapshotIndex=null;
          this.renderShell();
          this.bind();
          this.draw();
          this.changed();
        }
        return;
      }
      if(e.target.closest("[data-rag-anim-play]")){
        this.togglePlay();
        return;
      }
      if(e.target.closest("[data-rag-anim-rewind]")){
        this.pauseAnimation();
        this.playhead=0;
        const anim=this.activeAnimation();
        if(anim)this.sampleAndApplyPose(anim,0);
        this.updateTransportUI();
        this.draw();
        return;
      }
      const section=e.target.closest("[data-rag-section]");
      if(section&&!e.target.closest("[data-rag-visible]")){
        this.selected=section.dataset.ragSection;
        this.stampSource=null;
        this.renderShell();
        this.bind();
        this.draw();
        return;
      }
      const visible=e.target.closest("[data-rag-visible]");
      if(visible){
        const s=this.rig.sections.find(x=>x.id===visible.dataset.ragVisible);
        s.visible=s.visible===false;
        this.renderShell();
        this.bind();
        this.draw();
        this.changed();
        return;
      }
      if(e.target.closest("[data-rag-add]")){
        this.snapshot();
        const n=this.rig.sections.length,s={id:uid(),name:`Section ${n+1}`,color:COLORS[n%COLORS.length],visible:true,pivot:{x:.5,y:.5},handle:{x:.65,y:.5}};
        this.rig.sections.push(s);
        this.selected=s.id;
        this.rebuildMasks();
        this.renderShell();
        this.bind();
        this.draw();
        this.changed();
        return;
      }
      const tool=e.target.closest("[data-rag-tool]");
      if(tool){
        this.tool=tool.dataset.ragTool;
        this.stampSource=null;
        this.renderShell();
        this.bind();
        this.draw();
        return;
      }
      if(e.target.closest("[data-rag-reset-infill]")){
        const s=this.rig.sections.find(x=>x.id===this.selected);
        if(s?.infill?.length){
          this.snapshot();
          s.infill=[];
          this.renderShell();
          this.bind();
          this.draw();
          this.changed();
        }
        return;
      }
      if(e.target.closest("[data-rag-clear]")){
        this.snapshot();
        this.rig.strokes=this.rig.strokes.filter(s=>s.sectionId!==this.selected);
        this.rebuildMasks();
        this.draw();
        this.changed();
        return;
      }
      if(e.target.closest("[data-rag-undo]")){
        const value=this.undo.pop();
        if(value){
          this.redo.push(structuredClone({sections:this.rig.sections,strokes:this.rig.strokes}));
          this.restore(value);
        }
        return;
      }
      if(e.target.closest("[data-rag-redo]")){
        const value=this.redo.pop();
        if(value){
          this.undo.push(structuredClone({sections:this.rig.sections,strokes:this.rig.strokes}));
          this.restore(value);
        }
        return;
      }
      const zoom=e.target.closest("[data-rag-zoom]");
      if(zoom){
        this.zoom=clamp(this.zoom+Number(zoom.dataset.ragZoom),.4,8);
        this.draw();
        return;
      }
      if(e.target.closest("[data-rag-center]")){
        this.zoom=1;
        this.pan={x:0,y:0};
        this.draw();
        return;
      }
      if(e.target.closest("[data-rag-reset]")){
        this.resetPose();
        return;
      }
    };
    this.host.ondragstart=e=>{
      const row=e.target.closest("[data-rag-section]");
      if(this.mode!=="paint"||!row)return;
      this.layerDragId=row.dataset.ragSection;
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed="move";
      e.dataTransfer.setData("text/x-ragdoll-section",this.layerDragId);
    };
    this.host.ondragover=e=>{
      const row=e.target.closest("[data-rag-section]");
      if(!row||!this.layerDragId||row.dataset.ragSection===this.layerDragId)return;
      e.preventDefault();
      e.dataTransfer.dropEffect="move";
      this.host.querySelectorAll(".drop-before,.drop-after").forEach(item=>item.classList.remove("drop-before","drop-after"));
      const rect=row.getBoundingClientRect();
      row.classList.add(e.clientY<rect.top+rect.height/2?"drop-before":"drop-after");
    };
    this.host.ondrop=e=>{
      const row=e.target.closest("[data-rag-section]"),id=e.dataTransfer.getData("text/x-ragdoll-section")||this.layerDragId;
      if(!row||!id||row.dataset.ragSection===id)return;
      e.preventDefault();
      this.snapshot();
      const from=this.rig.sections.findIndex(section=>section.id===id),target=this.rig.sections.findIndex(section=>section.id===row.dataset.ragSection),after=row.classList.contains("drop-after");
      if(from>=0&&target>=0){
        const [moved]=this.rig.sections.splice(from,1),adjusted=target-(from<target?1:0)+(after?1:0);
        this.rig.sections.splice(clamp(adjusted,0,this.rig.sections.length),0,moved);
        this.rebuildMasks();
        this.renderShell();
        this.bind();
        this.draw();
        this.changed();
      }
    };
    this.host.ondragend=()=>{
      this.layerDragId=null;
      this.host.querySelectorAll(".dragging,.drop-before,.drop-after").forEach(item=>item.classList.remove("dragging","drop-before","drop-after"));
    };
    this.host.oninput=e=>{
      if(e.target.matches("[data-rag-brush]"))this.brush=Number(e.target.value);
      if(e.target.matches("[data-rag-infill-color]"))this.infillColor=e.target.value;
      if(e.target.matches("[data-rag-softness]"))this.infillSoftness=Number(e.target.value);
      if(e.target.matches("[data-rag-opacity]"))this.infillOpacity=Number(e.target.value);
      if(e.target.matches("[data-rag-name]")){
        const s=this.rig.sections.find(x=>x.id===this.selected);
        if(s){s.name=e.target.value;this.changed();}
      }
      if(e.target.matches("[data-rag-debug]")){
        this.rig.showRig=e.target.checked;
        this.draw();
        this.changed();
      }
      if(e.target.matches("[data-rag-anim-name]")){
        const id=e.target.dataset.ragAnimName,anim=this.rig.animations.find(a=>a.id===id);
        if(anim){anim.name=e.target.value;this.changed();}
      }
      if(e.target.matches("[data-rag-anim-duration]")){
        const anim=this.activeAnimation();
        if(anim){
          anim.duration=Math.max(0.1,Number(e.target.value)||2);
          const scrub=this.host.querySelector("[data-rag-anim-scrub]");
          if(scrub)scrub.max=String(anim.duration);
          this.updateTransportUI();
          this.changed();
        }
      }
      if(e.target.matches("[data-rag-anim-loop]")){
        const anim=this.activeAnimation();
        if(anim){
          anim.loop=e.target.checked;
          this.changed();
        }
      }
      if(e.target.matches("[data-rag-anim-scrub]")){
        this.pauseAnimation();
        this.playhead=Number(e.target.value);
        const anim=this.activeAnimation();
        if(anim)this.sampleAndApplyPose(anim,this.playhead);
        this.updateTransportUI();
        this.draw();
      }
    };
    if(this.canvas){
      this.canvas.onpointerdown=e=>this.down(e);
      this.canvas.onpointermove=e=>this.move(e);
      this.canvas.onpointerup=e=>this.up(e);
      this.canvas.onpointercancel=e=>this.up(e);
      this.canvas.onwheel=e=>{
        e.preventDefault();
        this.zoom=clamp(this.zoom*(e.deltaY<0?1.15:.87),.4,8);
        this.draw();
      };
    }
  }
  point(e){const r=this.canvas.getBoundingClientRect(),fit=Math.min(this.canvas.width/this.w,this.canvas.height/this.h)*this.zoom,ox=this.canvas.width/2-this.w*fit/2+this.pan.x,oy=this.canvas.height/2-this.h*fit/2+this.pan.y;return{x:(e.clientX-r.left-ox)/fit,y:(e.clientY-r.top-oy)/fit,fit,ox,oy};}
  down(e){
    if(this.mode==="animations")this.pauseAnimation();
    const p=this.point(e),section=this.rig.sections.find(s=>s.id===this.selected);
    if(!section)return;
    this.canvas.setPointerCapture(e.pointerId);
    if(e.button===1||e.shiftKey){this.drag={kind:"pan",x:e.clientX,y:e.clientY,pan:{...this.pan}};return;}
    if(this.mode==="infill"){
      const index=this.rig.sections.indexOf(section),inside=p.x>=0&&p.y>=0&&p.x<this.w&&p.y<this.h&&this.masks[index]?.[Math.floor(p.y)*this.w+Math.floor(p.x)];
      if(!inside)return;
      if(this.tool==="dropper"){
        const pixel=renderPiece(this.art,section,this.masks[index],this.w,this.h).getContext("2d").getImageData(Math.floor(p.x),Math.floor(p.y),1,1).data;
        this.infillColor=`#${[pixel[0],pixel[1],pixel[2]].map(value=>value.toString(16).padStart(2,"0")).join("")}`;
        this.renderShell();
        this.bind();
        this.draw();
        return;
      }
      if(this.tool==="stamp"){
        if(!this.stampSource){
          this.stampSource={x:p.x/this.w,y:p.y/this.h};
          this.hoverPoint=p;
          this.renderShell();
          this.bind();
          this.draw();
          return;
        }
        this.snapshot();
        section.infill ||= [];
        section.infill.push({type:"stamp",source:{...this.stampSource},target:{x:p.x/this.w,y:p.y/this.h},size:this.brush,opacity:this.infillOpacity});
        this.stampSource=null;
        this.renderShell();
        this.bind();
        this.draw();
        this.changed();
        return;
      }
      this.snapshot();
      section.infill ||= [];
      const op={type:"brush",color:this.infillColor,size:this.brush,softness:this.infillSoftness,opacity:this.infillOpacity,points:[]};
      section.infill.push(op);
      this.drag={kind:"infill",op};
      this.infillPoint(p);
      return;
    }
    const distance=(a,b)=>Math.hypot(a.x*this.w-p.x,a.y*this.h-p.y);
    if(this.mode==="paint"&&distance(section.pivot,p)<12/this.zoom){this.snapshot();this.drag={kind:"pivot",section};return;}
    if(this.mode==="paint"&&distance(section.handle,p)<12/this.zoom){this.snapshot();this.drag={kind:"handle",section};return;}
    if(this.mode==="paint"){
      this.snapshot();
      const stroke={sectionId:this.selected,erase:this.tool==="erase",size:this.brush,points:[]};
      this.rig.strokes.push(stroke);
      this.drag={kind:"paint",stroke};
      this.paintPoint(p);
    }else{
      this.beginTestDrag(p);
    }
  }
  paintPoint(p){this.drag.stroke.points.push({x:clamp(p.x/this.w,0,1),y:clamp(p.y/this.h,0,1)});this.rebuildMasks();this.draw();}
  infillPoint(p){this.drag.op.points.push({x:clamp(p.x/this.w,0,1),y:clamp(p.y/this.h,0,1)});this.draw();}
  move(e){const p=this.point(e);this.hoverPoint=p;if(!this.drag){if(this.mode==="infill")this.draw();return;}if(this.drag.kind==="paint")this.paintPoint(p);else if(this.drag.kind==="infill")this.infillPoint(p);else if(this.drag.kind==="pivot"||this.drag.kind==="handle"){this.drag.section[this.drag.kind]={x:clamp(p.x/this.w,-.25,1.25),y:clamp(p.y/this.h,-.25,1.25)};this.draw();}else if(this.drag.kind==="pan"){this.pan.x=this.drag.pan.x+e.clientX-this.drag.x;this.pan.y=this.drag.pan.y+e.clientY-this.drag.y;this.draw();}else this.solveDrag(p);}
  up(){if(!this.drag)return;this.drag=null;if(this.mode!=="animations")this.changed();}
  prepareTest(){this.rebuildMasks();this.pieces=makePieces(this.art,this.rig,this.w,this.h,this.masks);this.under=makeUnderdrawing(this.art,this.w,this.h,this.masks);this.links=connections(this.rig,this.masks,this.w,this.h);this.resetPose();}
  resetPose(){this.pose=this.rig.sections.map(()=>({x:0,y:0,r:0}));this.draw();}
  updateConnectedPieces(startIndex){
    const visited=new Set([startIndex]),queue=[startIndex];
    while(queue.length>0){
      const parent=queue.shift();
      for(const link of this.links){
        if(link.b===parent&&!visited.has(link.a)){
          visited.add(link.a);
          const child=link.a,jointWorld=this.transformPoint(parent,link.x,link.y),childSection=this.rig.sections[child],px=childSection.pivot.x*this.w,py=childSection.pivot.y*this.h;
          this.pose[child].x=jointWorld.x-px;
          this.pose[child].y=jointWorld.y-py;
          queue.push(child);
        }
      }
    }
  }
  beginTestDrag(p){
    if(!this.pose)this.prepareTest();
    for(let i=0;i<this.rig.sections.length;i++){
      const s=this.rig.sections[i],hPos=this.transformPoint(i,s.handle.x*this.w,s.handle.y*this.h);
      if(Math.hypot(hPos.x-p.x,hPos.y-p.y)<14/this.zoom){
        this.selected=s.id;
        const pivotWorld={x:s.pivot.x*this.w+this.pose[i].x,y:s.pivot.y*this.h+this.pose[i].y},startAngle=Math.atan2(p.y-pivotWorld.y,p.x-pivotWorld.x);
        this.drag={kind:"rotate",index:i,start:p,startAngle,startR:this.pose[i].r,startPose:this.pose.map(v=>({...v}))};
        this.draw();
        return;
      }
    }
    for(let i=0;i<this.rig.sections.length;i++){
      const s=this.rig.sections[i],pPos=this.transformPoint(i,s.pivot.x*this.w,s.pivot.y*this.h);
      if(Math.hypot(pPos.x-p.x,pPos.y-p.y)<14/this.zoom){
        this.selected=s.id;
        this.drag={kind:"joint",index:i,start:p,startPose:this.pose.map(v=>({...v}))};
        this.draw();
        return;
      }
    }
    for(let i=0;i<this.rig.sections.length;i++){
      const s=this.rig.sections[i],pose=this.pose[i],px=s.pivot.x*this.w,py=s.pivot.y*this.h,pivotWorld={x:px+pose.x,y:py+pose.y},dx=p.x-pivotWorld.x,dy=p.y-pivotWorld.y,cos=Math.cos(-pose.r),sin=Math.sin(-pose.r),lx=px+dx*cos-dy*sin,ly=py+dx*sin+dy*cos,ix=Math.floor(lx),iy=Math.floor(ly);
      if(ix>=0&&iy>=0&&ix<this.w&&iy<this.h&&this.masks[i]?.[iy*this.w+ix]){
        this.selected=s.id;
        this.drag={kind:"body",index:i,start:p,startPose:this.pose.map(v=>({...v}))};
        this.draw();
        return;
      }
    }
  }
  transformPoint(index,x,y){const pose=this.pose[index],section=this.rig.sections[index],px=section.pivot.x*this.w,py=section.pivot.y*this.h,cos=Math.cos(pose.r),sin=Math.sin(pose.r),dx=x-px,dy=y-py;return{x:px+pose.x+dx*cos-dy*sin,y:py+pose.y+dx*sin+dy*cos};}
  solveDrag(p){
    const d=this.drag;
    if(!d||d.index==null)return;
    const s=this.rig.sections[d.index];
    if(!s)return;
    if(d.kind==="rotate"){
      const pivotWorld={x:s.pivot.x*this.w+d.startPose[d.index].x,y:s.pivot.y*this.h+d.startPose[d.index].y},currentAngle=Math.atan2(p.y-pivotWorld.y,p.x-pivotWorld.x);
      this.pose[d.index].r=d.startR+(currentAngle-d.startAngle);
      this.updateConnectedPieces(d.index);
    }else if(d.kind==="joint"||d.kind==="body"){
      const dx=p.x-d.start.x,dy=p.y-d.start.y;
      this.pose[d.index].x=d.startPose[d.index].x+dx;
      this.pose[d.index].y=d.startPose[d.index].y+dy;
      this.updateConnectedPieces(d.index);
    }
    this.draw();
  }
  draw(){
    if(!this.canvas)return;
    const rect=this.stage?.getBoundingClientRect();
    if(rect){
      this.canvas.width=Math.max(320,Math.round(rect.width));
      this.canvas.height=Math.max(280,Math.round(rect.height));
    }
    const ctx=this.ctx;
    if(!ctx)return;
    const fit=Math.min(this.canvas.width/this.w,this.canvas.height/this.h)*this.zoom,ox=this.canvas.width/2-this.w*fit/2+this.pan.x,oy=this.canvas.height/2-this.h*fit/2+this.pan.y;
    ctx.imageSmoothingEnabled=false;
    ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    ctx.save();
    ctx.translate(ox,oy);
    ctx.scale(fit,fit);
    if(this.mode==="infill"){
      const index=this.rig.sections.findIndex(s=>s.id===this.selected),section=this.rig.sections[index],piece=section&&renderPiece(this.art,section,this.masks[index],this.w,this.h);
      if(piece)ctx.drawImage(piece,0,0);
      if(this.hoverPoint){
        const radius=this.brush*this.w;
        if(this.tool==="stamp"&&this.stampSource){
          ctx.save();
          ctx.globalAlpha=.72;
          ctx.beginPath();
          ctx.arc(this.hoverPoint.x,this.hoverPoint.y,radius,0,Math.PI*2);
          ctx.clip();
          ctx.drawImage(piece,this.stampSource.x*this.w-radius,this.stampSource.y*this.h-radius,radius*2,radius*2,this.hoverPoint.x-radius,this.hoverPoint.y-radius,radius*2,radius*2);
          ctx.restore();
        }
        ctx.strokeStyle="#ffffff";
        ctx.lineWidth=1.5/fit;
        ctx.setLineDash(this.tool==="stamp"&&!this.stampSource?[4/fit,3/fit]:[]);
        ctx.beginPath();
        ctx.arc(this.hoverPoint.x,this.hoverPoint.y,radius,0,Math.PI*2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
      return;
    }
    if(this.mode==="paint"){
      ctx.drawImage(this.art,0,0,this.w,this.h);
      const overlay=ctx.createImageData(this.w,this.h),counts=new Uint8Array(this.w*this.h);
      this.rig.sections.forEach((s,index)=>{
        if(s.visible===false)return;
        const color=parseInt(s.color.slice(1),16),r=color>>16,g=(color>>8)&255,b=color&255;
        for(let i=0;i<this.masks[index].length;i++)if(this.masks[index][i]){
          const n=counts[i]++;
          overlay.data[i*4]=(overlay.data[i*4]*n+r)/(n+1);
          overlay.data[i*4+1]=(overlay.data[i*4+1]*n+g)/(n+1);
          overlay.data[i*4+2]=(overlay.data[i*4+2]*n+b)/(n+1);
          overlay.data[i*4+3]=n?155:105;
        }
      });
      const mask=document.createElement("canvas");
      mask.width=this.w;
      mask.height=this.h;
      mask.getContext("2d").putImageData(overlay,0,0);
      ctx.drawImage(mask,0,0);
      this.drawRig(ctx,fit);
    }else{
      if(!this.pose)this.prepareTest();
      if(this.runtimeRenderer){
        this.runtimeRenderer.setDisplayTransform({x:ox,y:oy,scale:fit});
        this.runtimeRenderer.applyPose(this.pose);
      }else{
        if(this.under)ctx.drawImage(this.under,0,0);
        for(let i=this.rig.sections.length-1;i>=0;i--){
          const s=this.rig.sections[i],pose=this.pose[i],px=s.pivot.x*this.w,py=s.pivot.y*this.h;
          ctx.save();
          ctx.translate(px+pose.x,py+pose.y);
          ctx.rotate(pose.r);
          ctx.translate(-px,-py);
          if(this.pieces?.[i])ctx.drawImage(this.pieces[i],0,0);
          ctx.restore();
        }
      }
      if(this.rig.showRig!==false)this.drawRig(ctx,fit,true);
    }
    ctx.restore();
  }
  drawRig(ctx,fit,test=false){
    const links=connections(this.rig,this.masks,this.w,this.h);
    ctx.lineWidth=2/fit;
    for(const link of links){
      const point=test&&this.pose?this.transformPoint(link.b,link.x,link.y):{x:link.x,y:link.y};
      ctx.strokeStyle="#ffffff";
      ctx.setLineDash([4/fit,3/fit]);
      ctx.beginPath();
      ctx.arc(point.x,point.y,8/fit,0,Math.PI*2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    this.rig.sections.forEach((s,i)=>{
      let pivot={x:s.pivot.x*this.w,y:s.pivot.y*this.h},handle={x:s.handle.x*this.w,y:s.handle.y*this.h};
      if(test&&this.pose){
        pivot=this.transformPoint(i,pivot.x,pivot.y);
        handle=this.transformPoint(i,handle.x,handle.y);
      }
      ctx.strokeStyle=s.color;
      ctx.lineWidth=2/fit;
      ctx.beginPath();
      ctx.moveTo(pivot.x,pivot.y);
      ctx.lineTo(handle.x,handle.y);
      ctx.stroke();
      ctx.fillStyle=links.some(l=>l.a===i)?"#ffffff":s.color;
      ctx.beginPath();
      ctx.arc(pivot.x,pivot.y,6/fit,0,Math.PI*2);
      ctx.fill();
      ctx.fillStyle="#ffe45c";
      ctx.fillRect(handle.x-5/fit,handle.y-5/fit,10/fit,10/fit);
    });
  }

  // --- Animation Mode: Snapshots & Playback Engine ---
  captureThumbnail(pose){
    const size=72;
    const canvas=document.createElement("canvas");
    canvas.width=size;
    canvas.height=size;
    const ctx=canvas.getContext("2d");
    ctx.imageSmoothingEnabled=false;
    const fit=Math.min(size/this.w,size/this.h)*0.85;
    const ox=size/2-this.w*fit/2;
    const oy=size/2-this.h*fit/2;
    ctx.save();
    ctx.translate(ox,oy);
    ctx.scale(fit,fit);
    if(this.under)ctx.drawImage(this.under,0,0);
    for(let i=this.rig.sections.length-1;i>=0;i--){
      const s=this.rig.sections[i],p=pose[i]||{x:0,y:0,r:0};
      const px=s.pivot.x*this.w,py=s.pivot.y*this.h;
      ctx.save();
      ctx.translate(px+p.x,py+p.y);
      ctx.rotate(p.r);
      ctx.translate(-px,-py);
      if(this.pieces?.[i])ctx.drawImage(this.pieces[i],0,0);
      ctx.restore();
    }
    ctx.restore();
    return canvas.toDataURL("image/png");
  }

  savePoseSnapshot(){
    if(!this.pose)this.prepareTest();
    const anim=this.activeAnimation();
    if(!anim)return;
    const clonedPose=this.pose.map(p=>({x:Math.round(p.x*10)/10,y:Math.round(p.y*10)/10,r:Math.round(p.r*1000)/1000}));
    const thumb=this.captureThumbnail(clonedPose);
    anim.snapshots ||= [];
    anim.snapshots.push({
      id:uid(),
      pose:clonedPose,
      thumb
    });
    this.selectedSnapshotIndex=anim.snapshots.length-1;
    this.changed();
    this.renderShell();
    this.bind();
    this.draw();
  }

  togglePlay(){
    if(this.isPlaying)this.pauseAnimation();
    else this.playAnimation();
  }

  playAnimation(){
    const anim=this.activeAnimation();
    if(!anim)return;
    const count=anim.snapshots?.length||0;
    if(count===0)return;
    this.isPlaying=true;
    if(this.playhead>=anim.duration||this.playhead<=0){
      this.playhead=0;
    }
    this.lastTime=performance.now();
    const playBtn=this.host.querySelector("[data-rag-anim-play]");
    if(playBtn){
      playBtn.textContent="⏸ PAUSE";
      playBtn.classList.add("active");
    }
    cancelAnimationFrame(this.animRaf);
    this.animRaf=requestAnimationFrame(now=>this.stepAnimation(now));
  }

  pauseAnimation(){
    this.isPlaying=false;
    cancelAnimationFrame(this.animRaf);
    const playBtn=this.host.querySelector("[data-rag-anim-play]");
    if(playBtn){
      playBtn.textContent="▶ PLAY";
      playBtn.classList.remove("active");
    }
  }

  stepAnimation(now){
    if(!this.isPlaying)return;
    const anim=this.activeAnimation();
    if(!anim||!anim.snapshots?.length){
      this.pauseAnimation();
      return;
    }
    const dt=(now-this.lastTime)/1000;
    this.lastTime=now;
    this.playhead+=dt;

    const duration=Math.max(0.1,Number(anim.duration||2));
    if(this.playhead>=duration){
      if(anim.loop){
        this.playhead=this.playhead%duration;
      }else{
        this.playhead=duration;
        this.sampleAndApplyPose(anim,this.playhead);
        this.updateTransportUI();
        this.draw();
        this.pauseAnimation();
        return;
      }
    }

    this.sampleAndApplyPose(anim,this.playhead);
    this.updateTransportUI();
    this.draw();
    this.animRaf=requestAnimationFrame(n=>this.stepAnimation(n));
  }

  sampleAndApplyPose(anim,time){
    const snapshots=anim.snapshots||[];
    if(!snapshots.length)return;
    if(!this.pose)this.prepareTest();
    if(snapshots.length===1){
      this.pose=snapshots[0].pose.map(p=>({...p}));
      return;
    }
    const duration=Math.max(0.1,Number(anim.duration||2));
    const N=snapshots.length;
    let idxA=0,idxB=1,easeT=0;

    if(anim.loop){
      const progress=(time/duration)%1;
      const val=((progress<0?progress+1:progress)*N);
      idxA=Math.floor(val)%N;
      idxB=(idxA+1)%N;
      const t=val-Math.floor(val);
      easeT=0.5-0.5*Math.cos(t*Math.PI);
    }else{
      const progress=clamp(time/duration,0,1);
      const val=progress*(N-1);
      idxA=Math.min(N-2,Math.max(0,Math.floor(val)));
      idxB=idxA+1;
      const t=clamp(val-idxA,0,1);
      easeT=0.5-0.5*Math.cos(t*Math.PI);
    }

    const poseA=snapshots[idxA].pose,poseB=snapshots[idxB].pose;
    for(let k=0;k<this.rig.sections.length;k++){
      const a=poseA[k]||{x:0,y:0,r:0},b=poseB[k]||{x:0,y:0,r:0};
      const x=a.x+(b.x-a.x)*easeT;
      const y=a.y+(b.y-a.y)*easeT;
      let diff=(b.r-a.r)%(Math.PI*2);
      if(diff>Math.PI)diff-=Math.PI*2;
      if(diff<-Math.PI)diff+=Math.PI*2;
      const r=a.r+diff*easeT;
      this.pose[k]={x,y,r};
    }
  }

  updateTransportUI(){
    const scrub=this.host.querySelector("[data-rag-anim-scrub]");
    if(scrub)scrub.value=String(this.playhead.toFixed(2));
    const readout=this.host.querySelector(".rag-time-readout");
    const anim=this.activeAnimation();
    if(readout&&anim){
      readout.textContent=`${this.playhead.toFixed(2)}s / ${Math.max(0.1,Number(anim.duration||2)).toFixed(2)}s`;
    }
  }

  flush(){clearTimeout(this.changeTimer);this.dirty=false;this.onChange(this.rig);return this.rig;}
  destroy(){
    this.pauseAnimation();
    if(this.dirty)this.flush();
    this.destroyed=true;
    this.runtimeRenderer?.destroy();
    this.runtimeRenderer=null;
    clearTimeout(this.changeTimer);
    this.host.onclick=null;
    this.host.oninput=null;
  }
}
