import { Application, Assets, Container, Graphics, MeshPlane, Text, Texture } from "/vendor/pixi.mjs";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (name, t) => {
  if (name === "ease-in") return t * t;
  if (name === "ease-out") return 1 - (1 - t) ** 2;
  if (name === "ease-in-out") return t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  if (name === "jump") return Math.sin(t * Math.PI);
  if (name === "rubberband") return 1 - Math.cos(t * Math.PI * 4) * (1 - t);
  return t;
};
const baseCorners = () => [{x:-60,y:-75},{x:60,y:-75},{x:-60,y:75},{x:60,y:75}];
export function defaultActorAnimation(name="Standing") { return {id:`animation-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,name,duration:1.5,loop:true,keyframes:[{time:0,effect:"ease-in-out",corners:baseCorners(),anchor:{x:0,y:0}},{time:1,effect:"ease-in-out",corners:baseCorners(),anchor:{x:0,y:0}}]}; }
export function ensureActorAnimations(actor) {
  if (!Array.isArray(actor.animations)) actor.animations=[];
  if (!actor.animations.length) actor.animations.push(defaultActorAnimation("Standing"));
  actor.animations.forEach((animation,index)=>{animation.id ||= `animation-${Date.now()}-${index}`;animation.name ||= index===0?"Standing":"Untitled";animation.duration=Math.max(.1,Number(animation.duration)||1.5);animation.loop=animation.loop!==false;if(!Array.isArray(animation.keyframes)||!animation.keyframes.length)animation.keyframes=defaultActorAnimation().keyframes;});
  actor.animations[0].name ||= "Standing";actor.animationId ||= actor.animations[0].id;return actor.animations;
}
export function sampleActorAnimation(animation,seconds){const frames=[...(animation?.keyframes||[])].sort((a,b)=>a.time-b.time);if(!frames.length)return {time:0,effect:"linear",corners:baseCorners(),anchor:{x:0,y:0}};const duration=Math.max(.1,Number(animation.duration)||1),position=clamp(seconds/duration,0,1),nextIndex=frames.findIndex(f=>Number(f.time)>=position),b=frames[nextIndex<0?frames.length-1:nextIndex],a=frames[Math.max(0,(nextIndex<0?frames.length:nextIndex)-1)]||b;if(a===b)return structuredClone(a);const span=Math.max(.001,b.time-a.time),t=ease(b.effect||a.effect,(position-a.time)/span);return {time:position,effect:b.effect,corners:a.corners.map((c,i)=>({x:lerp(c.x,b.corners[i].x,t),y:lerp(c.y,b.corners[i].y,t)})),anchor:{x:lerp(a.anchor.x,b.anchor.x,t),y:lerp(a.anchor.y,b.anchor.y,t)}};}

export class ActorAnimationRenderer {
  constructor(host,{editable=false,onKeyframe=null,onPreviewFrame=null,onPause=null}={}) { this.host=host;this.editable=editable;this.onKeyframe=onKeyframe;this.onPreviewFrame=onPreviewFrame;this.onPause=onPause;this.playing=true;this.time=0;this.drag=null; }
  async init() { this.app=new Application();await this.app.init({resizeTo:this.host,antialias:true,autoDensity:true,backgroundAlpha:0,preference:"webgl"});if(this.destroyed){this.app.destroy(true,{children:true,texture:false});return this;}this.app.canvas.className="pixi-actor-canvas";this.host.replaceChildren(this.app.canvas);this.stage=new Container();this.app.stage.addChild(this.stage);this.tickHandler=t=>this.tick(t.deltaMS);this.app.ticker.add(this.tickHandler);this.resizeObserver=new ResizeObserver(()=>this.layout());this.resizeObserver.observe(this.host);return this; }
  async setActor(actor,animation,time=this.time) { this.actor=actor;this.animation=animation||ensureActorAnimations(actor)[0];this.time=Number(time)||0;this.stage.removeChildren().forEach(c=>c.destroy?.({children:true}));this.handles=[];let visual;if(actor.sprite){const texture=await Assets.load(actor.sprite);if(this.destroyed)return;visual=new MeshPlane({texture,verticesX:2,verticesY:2});visual.autoResize=false;this.mesh=visual;}else{visual=new Text({text:actor.icon||"👤",style:{fontFamily:"Arial",fontSize:112,align:"center"}});visual.anchor.set(.5);this.mesh=null;}this.visual=visual;this.stage.addChild(visual);this.anchorHandle=new Graphics().circle(0,0,8).fill(0xffe47a).stroke({color:0x080d20,width:3});this.anchorHandle.eventMode=this.editable?"static":"none";this.anchorHandle.cursor="move";this.stage.addChild(this.anchorHandle);for(let i=0;i<4;i++){const handle=new Graphics().circle(0,0,7).fill(0x54d682).stroke({color:0x080d20,width:3});handle.eventMode=this.editable?"static":"none";handle.cursor="move";handle.on("pointerdown",e=>this.beginDrag(e,"corner",i));this.stage.addChild(handle);this.handles.push(handle);}this.anchorHandle.on("pointerdown",e=>this.beginDrag(e,"anchor",0));this.app.stage.eventMode="static";this.app.stage.hitArea=this.app.screen;this.app.stage.on("globalpointermove",e=>this.moveDrag(e));this.app.stage.on("pointerup",()=>this.endDrag());this.app.stage.on("pointerupoutside",()=>this.endDrag());this.layout();this.applyFrame(); }
  layout(){if(!this.app)return;this.stage.position.set(this.app.screen.width/2,this.app.screen.height/2);}
  beginDrag(event,type,index){event.stopPropagation();this.playing=false;this.onPause?.();this.drag={type,index};}
  moveDrag(event){if(!this.drag)return;const p=this.stage.toLocal(event.global),frame=this.previewFrame||this.frameAt(this.time),corners=frame.corners.map(c=>({...c})),anchor={...frame.anchor};if(this.drag.type==="corner")corners[this.drag.index]={x:clamp(p.x,-150,150),y:clamp(p.y,-130,130)};else Object.assign(anchor,{x:clamp(p.x,-100,100),y:clamp(p.y,-100,100)});this.previewFrame={...frame,corners,anchor};this.applyFrame(this.previewFrame);this.onPreviewFrame?.(this.previewFrame);}
  endDrag(){if(!this.drag)return;this.drag=null;const frame=this.previewFrame;this.previewFrame=null;if(frame)this.onKeyframe?.({...frame,time:clamp(this.time/Math.max(.1,Number(this.animation.duration)||1),0,1)});}
  frameAt(seconds){return sampleActorAnimation(this.animation,seconds);}
  applyFrame(frame=this.frameAt(this.time)){if(!this.visual)return;const corners=frame.corners||baseCorners(),anchor=frame.anchor||{x:0,y:0};if(this.mesh){const data=this.mesh.geometry.buffers[0].data;for(let i=0;i<4;i++){data[i*2]=corners[i].x-anchor.x;data[i*2+1]=corners[i].y-anchor.y;}this.mesh.geometry.buffers[0].update();this.mesh.position.set(anchor.x,anchor.y);}else{const width=Math.max(20,((corners[1].x-corners[0].x)+(corners[3].x-corners[2].x))/2),height=Math.max(20,((corners[2].y-corners[0].y)+(corners[3].y-corners[1].y))/2);this.visual.position.set(anchor.x,anchor.y);this.visual.scale.set(width/120,height/150);this.visual.skew.set((corners[1].y-corners[0].y)/240,(corners[2].x-corners[0].x)/300);}this.anchorHandle.position.set(anchor.x,anchor.y);this.anchorHandle.visible=this.editable;this.handles.forEach((h,i)=>{h.position.set(corners[i].x,corners[i].y);h.visible=this.editable;});}
  tick(delta){if(!this.playing||!this.animation)return;const duration=Math.max(.1,Number(this.animation.duration)||1);this.time+=delta/1000;if(this.time>duration)this.time=this.animation.loop===false?duration:this.time%duration;this.applyFrame();this.onTime?.(this.time,duration);this.onTick?.(this.time,duration);}
  seek(seconds){this.time=Number(seconds)||0;this.applyFrame();}
  toggle(){this.playing=!this.playing;return this.playing;}
  destroy(){this.destroyed=true;this.resizeObserver?.disconnect();if(this.app?.ticker){this.app.ticker.remove(this.tickHandler);this.app.ticker.stop();}this.app?.destroy(true,{children:true,texture:false});this.app=null;}
}
