import { Application, Container, Sprite, Texture } from "/vendor/pixi.mjs";
import { buildRagdollRenderData, sampleRagdollPose } from "./ragdoll-editor.js";

// A single Pixi display object for authored ragdolls. It can either own a canvas
// (for editor/timeline previews) or be attached to an existing Pixi scene.
export class PixiRagdollRenderer {
  constructor({host=null,parent=null,className="pixi-ragdoll-canvas",padding=.92,replaceHostContents=true,autoTick=true}={}) {
    this.host=host;
    this.parent=parent;
    this.className=className;
    this.padding=padding;
    this.replaceHostContents=replaceHostContents;
    this.autoTick=autoTick;
    this.view=new Container();
    this.content=new Container();
    this.view.addChild(this.content);
    if(parent)parent.addChild(this.view);
  }

  async init() {
    if(!this.host||this.app)return this;
    this.app=new Application();
    await this.app.init({resizeTo:this.host,antialias:true,autoDensity:true,backgroundAlpha:0,preference:"webgl"});
    if(this.destroyed){this.app.destroy(true,{children:true,texture:false});return this;}
    this.app.canvas.className=this.className;
    if(this.replaceHostContents)this.host.replaceChildren(this.app.canvas);
    else this.host.prepend(this.app.canvas);
    this.app.stage.addChild(this.view);
    this.resizeObserver=new ResizeObserver(()=>this.layout());
    this.resizeObserver.observe(this.host);
    if(this.autoTick){this.tickHandler=ticker=>this.tick(ticker.deltaMS);this.app.ticker.add(this.tickHandler);}
    this.layout();
    return this;
  }

  async setActor(actor,animation,time=0,blockDuration=null) {
    this.actor=actor;
    this.data=await buildRagdollRenderData(actor);
    if(this.destroyed)return this;
    this.rig=this.data.rig;
    this.animation=animation||this.rig.animations?.[0];
    this.rebuildDisplay();
    this.seek(time,blockDuration);
    this.layout();
    return this;
  }

  rebuildDisplay() {
    this.content.removeChildren().forEach(child=>child.destroy?.({children:true,texture:false}));
    const under=new Sprite(Texture.from(this.data.under));
    this.content.addChild(under);
    this.parts=new Array(this.rig.sections.length);
    // Later sections are behind earlier sections, matching the editor and the
    // previous board renderer exactly.
    for(let index=this.rig.sections.length-1;index>=0;index--) {
      const section=this.rig.sections[index];
      const part=new Container();
      const sprite=new Sprite(Texture.from(this.data.pieces[index]));
      const px=section.pivot.x*this.data.w,py=section.pivot.y*this.data.h;
      part.pivot.set(px,py);
      part.position.set(px,py);
      part.addChild(sprite);
      this.content.addChild(part);
      this.parts[index]=part;
    }
  }

  sample(time,blockDuration=null) { return sampleRagdollPose(this.rig,this.animation,time,blockDuration); }
  seek(time=0,blockDuration=null) { this.time=Number(time)||0;this.blockDuration=blockDuration;this.applyPose(this.sample(this.time,blockDuration));return this; }
  setPlayback(animation,time=0,blockDuration=null) { this.animation=animation||this.animation;return this.seek(time,blockDuration); }
  applyPose(pose=[]) {
    if(!this.parts)return;
    this.pose=pose;
    this.parts.forEach((part,index)=>{
      const section=this.rig.sections[index],value=pose[index]||{x:0,y:0,r:0};
      const px=section.pivot.x*this.data.w,py=section.pivot.y*this.data.h;
      part.position.set(px+Number(value.x||0),py+Number(value.y||0));
      part.rotation=Number(value.r||0);
    });
  }
  tick(deltaMS) {
    if(!this.app||!this.animation)return;
    const duration=Math.max(.1,Number(this.blockDuration||this.animation.duration||2));
    this.time+=deltaMS/1000;
    if(this.animation.loop===false&&this.time>duration)this.time=duration;
    else if(this.animation.loop)this.time%=duration;
    this.applyPose(this.sample(this.time,this.blockDuration));
  }
  layout() {
    if(!this.app||!this.data)return;
    const width=this.app.renderer.width/this.app.renderer.resolution,height=this.app.renderer.height/this.app.renderer.resolution;
    const fit=Math.min(width/this.data.w,height/this.data.h)*this.padding;
    this.view.position.set(width/2-this.data.w*fit/2,height/2-this.data.h*fit/2);
    this.view.scale.set(fit);
  }
  // Use this when embedding the same renderer in another Pixi scene.
  setDisplayTransform({x=0,y=0,scale=1}={}) { this.view.position.set(x,y);this.view.scale.set(scale);return this; }
  destroy() {
    this.destroyed=true;
    this.resizeObserver?.disconnect();
    if(this.app?.ticker)this.app.ticker.remove(this.tickHandler);
    if(this.app)this.app.destroy(true,{children:true,texture:false});
    else this.view.destroy({children:true,texture:false});
    this.app=null;
  }
}
