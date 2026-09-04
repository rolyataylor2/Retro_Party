import { Application, Assets, BlurFilter, ColorMatrixFilter, Container, Graphics, NoiseFilter, Rectangle, Sprite, Text, TextStyle, Texture } from "/vendor/pixi.mjs";
import { PixiRagdollRenderer } from "./pixi-ragdoll-renderer.js";

export const BOARD_WORLD = Object.freeze({ width: 1000, height: 562.5 });
const COLORS = { blue:0x2f77e0, red:0xe35050, lucky:0xe6c33d, event:0x8751c1, start:0x50bd6e, shop:0xe89d35, duel:0xc84c74, warp:0x55b9df, trap:0x47405f, custom:0x8c65d8 };
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const lerp=(from,to,amount)=>from+(to-from)*amount;
const point=(value={})=>({x:Number(value.x||0)/100*BOARD_WORLD.width,y:Number(value.y||0)/100*BOARD_WORLD.height});
const colorNumber=(value,fallback=0xffffff)=>{if(typeof value==="number")return value;const parsed=Number.parseInt(String(value||"").replace("#",""),16);return Number.isFinite(parsed)?parsed:fallback;};
const patternedLine=(graphics,points,pattern)=>{const dash=pattern==="dotted"?3:18,gap=pattern==="dotted"?10:11;for(let index=1;index<points.length;index++){const from=points[index-1],to=points[index],dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);for(let offset=0;offset<length;offset+=dash+gap){const end=Math.min(offset+dash,length);graphics.moveTo(from.x+dx*offset/length,from.y+dy*offset/length).lineTo(from.x+dx*end/length,from.y+dy*end/length);}}};
const traceSpaceShape=(shape,space,radius)=>{if(space.shape==="diamond")shape.poly([0,-radius,radius,0,0,radius,-radius,0]);else if(space.shape==="hex")shape.poly([[-radius*.85,-radius/2],[0,-radius],[radius*.85,-radius/2],[radius*.85,radius/2],[0,radius],[-radius*.85,radius/2]]);else if(space.shape==="star"){const values=[];for(let i=0;i<10;i++){const angle=-Math.PI/2+i*Math.PI/5,distance=i%2?radius*.45:radius;values.push(Math.cos(angle)*distance,Math.sin(angle)*distance);}shape.poly(values);}else shape.ellipse(0,0,space.shape==="oval"?radius*1.14:radius,space.shape==="oval"?radius*.86:radius);return shape;};

export class PixiBoardRenderer {
  constructor(host, options={}) {
    this.host=host;this.options=options;this.board=null;this.actors=[];this.destroyed=false;this.objects={spaces:new Map(),paths:new Map(),actors:new Map()};
    this.camera={x:0,y:0,zoom:1,rotation:0,targetX:0,targetY:0,targetZoom:1,targetRotation:0,smoothing:.16};
    this.pointer=null;this.weather={type:"none",intensity:0};this.particles=[];this.pathPulses=[];this.effectSystems=[];
  }
  async init() {
    this.app=new Application();
    await this.app.init({resizeTo:this.host,antialias:true,autoDensity:true,backgroundAlpha:0,preference:"webgl"});
    if(this.destroyed){this.app.destroy(true);return this;}
    this.app.canvas.className="pixi-board-canvas";this.host.prepend(this.app.canvas);
    this.cameraRoot=new Container({isRenderGroup:true});this.world=new Container();this.cameraRoot.addChild(this.world);this.app.stage.addChild(this.cameraRoot);
    this.layers={background:new Container(),underlay:new Container(),paths:new Container(),spaces:new Container(),selection:new Container(),objects:new Container(),actors:new Container(),particles:new Container(),weather:new Container(),overlay:new Container()};
    Object.values(this.layers).forEach(layer=>this.world.addChild(layer));this.layers.spaces.sortableChildren=true;this.layers.actors.sortableChildren=true;
    this.hitPlane=new Graphics().rect(0,0,BOARD_WORLD.width,BOARD_WORLD.height).fill({color:0,alpha:.001});this.hitPlane.eventMode="static";this.hitPlane.cursor=this.options.interactive?"grab":"default";this.layers.underlay.addChild(this.hitPlane);
    this.bindInteraction();this.resizeObserver=new ResizeObserver(()=>this.applyCamera(true));this.resizeObserver.observe(this.host);
    this.tickHandler=ticker=>{this.tick(ticker.deltaMS);this.tickActorAnimations(ticker.deltaMS);this.tickControllerPhysics(ticker.deltaMS);};this.app.ticker.add(this.tickHandler);return this;
  }
  bindInteraction(){if(!this.options.interactive)return;const canvas=this.app.canvas;this.hitPlane.on("pointerdown",event=>{this.pointer={id:event.pointerId,x:event.global.x,y:event.global.y,cameraX:this.camera.targetX,cameraY:this.camera.targetY};this.host.dispatchEvent(new CustomEvent("board-background-down",{detail:{originalEvent:event,world:this.screenToWorld(event.global.x,event.global.y)}}));});this.app.stage.eventMode="static";this.app.stage.hitArea=this.app.screen;this.app.stage.on("globalpointermove",event=>{if(!this.pointer||event.pointerId!==this.pointer.id)return;const dx=event.global.x-this.pointer.x,dy=event.global.y-this.pointer.y;this.setCamera({x:this.pointer.cameraX+dx,y:this.pointer.cameraY+dy});});const end=()=>{this.pointer=null;};this.app.stage.on("pointerup",end);this.app.stage.on("pointerupoutside",end);canvas.addEventListener("wheel",event=>{event.preventDefault();this.zoomAt(event.clientX,event.clientY,event.deltaY<0?1.12:.89);},{passive:false});}
  async setBoard(board, options={}) {this.board=structuredClone(board||{spaces:[],paths:[]});this.options={...this.options,...options};const defaults=this.board.defaults||{};for(const space of this.board.spaces||[]){space.size=Number(space.size??defaults.spaceSize??3);space.type??=defaults.spaceType||"blue";space.shape??=defaults.spaceShape||"oval";space.rotation=Number(space.rotation??defaults.spaceRotation??0);space.borderWidth=Number(space.borderWidth??defaults.spaceBorderWidth??3);space.borderColor??=defaults.spaceBorderColor||"#ffffff";space.borderOpacity=Number(space.borderOpacity??defaults.spaceBorderOpacity??1);space.shadow??=defaults.spaceShadow===true;space.shadowColor??=defaults.spaceShadowColor||"#000000";space.shadowOpacity=Number(space.shadowOpacity??defaults.spaceShadowOpacity??.45);space.shadowBlur=Number(space.shadowBlur??defaults.spaceShadowBlur??8);space.shadowOffset=Number(space.shadowOffset??defaults.spaceShadowOffset??5);}for(const path of this.board.paths||[]){path.render||={};path.render.width=Number(path.render.width??defaults.pathWidth??5);path.render.pattern??=defaults.pathPattern||"solid";path.render.curve??=defaults.pathCurve||"hard";path.render.color??=defaults.pathColor||"#fff0a9";path.render.opacity=Number(path.render.opacity??defaults.pathOpacity??1);path.render.border??=defaults.pathBorder!==false;path.render.hidden??=defaults.pathHidden===true;if(path.oneWay==null){path.oneWay=defaults.pathDirection&&defaults.pathDirection!=="both";path.direction=defaults.pathDirection==="reverse"?"reverse":"forward";}}await this.rebuild();return this;}
  async rebuild(){if(!this.app||this.destroyed)return;Object.values(this.layers).forEach(layer=>{if(layer!==this.layers.underlay&&layer!==this.layers.background)layer.removeChildren().forEach(child=>child.destroy?.({children:true}));});this.objects={spaces:new Map(),paths:new Map(),actors:new Map()};this.pathPulses=[];this.effectSystems=[];this.particles=[];await this.drawBackground();this.drawExtraLayers();this.drawPaths();this.drawSpaces();this.setSelectedSpaces(this.options.selectedSpaces);this.drawBoardObjects();this.drawEffectPlacements();this.setActors(this.actors);await this.drawForeground();this.setEffects(this.board?.effects||{});this.setWeather(this.board?.weather||this.weather);this.applyCamera(true);}
  replaceBackground(view){this.layers.background.removeChildren().forEach(child=>child.destroy?.({children:true}));this.layers.background.addChild(view);}
  async drawBackground(){const image=this.board?.image;if(image){try{const texture=await Assets.load(image);if(this.destroyed)return;const sprite=new Sprite(texture);sprite.width=BOARD_WORLD.width;sprite.height=BOARD_WORLD.height;this.replaceBackground(sprite);}catch{this.drawGrid();}}else this.drawGrid();}
  drawGrid(){const grid=new Graphics().rect(0,0,BOARD_WORLD.width,BOARD_WORLD.height).fill(0x061b0d);for(let x=0;x<=BOARD_WORLD.width;x+=40)grid.moveTo(x,0).lineTo(x,BOARD_WORLD.height);for(let y=0;y<=BOARD_WORLD.height;y+=40)grid.moveTo(0,y).lineTo(0+BOARD_WORLD.width,y);grid.stroke({color:0x6dff98,alpha:.18,width:1});this.replaceBackground(grid);}
  async drawExtraLayers(){for(const definition of this.board?.layers||[]){if(definition.visible===false)continue;const target=definition.position==="under"?this.layers.underlay:this.layers.overlay;if(definition.image){try{const texture=await Assets.load(definition.image),sprite=new Sprite(texture);sprite.width=BOARD_WORLD.width;sprite.height=BOARD_WORLD.height;sprite.alpha=Number(definition.opacity??1);sprite.blendMode=definition.blendMode||"normal";target.addChild(sprite);}catch{}}else if(definition.color){target.addChild(new Graphics().rect(0,0,BOARD_WORLD.width,BOARD_WORLD.height).fill({color:colorNumber(definition.color),alpha:Number(definition.opacity??.25)}));}}}
  async drawForeground(){if(!this.board?.foreground)return;try{const texture=await Assets.load(this.board.foreground);if(this.destroyed)return;const sprite=new Sprite(texture);sprite.width=BOARD_WORLD.width;sprite.height=BOARD_WORLD.height;sprite.eventMode="none";this.layers.overlay.addChild(sprite);}catch{}}
  pathPoints(path){const byId=new Map((this.board.spaces||[]).map(space=>[space.id,space])),from=byId.get(path.from),to=byId.get(path.to);return from&&to?[point(from),...(path.points||[]).map(point),point(to)]:[];}
  refreshPaths(){this.layers.paths.removeChildren().forEach(child=>child.destroy?.({children:true}));this.objects.paths.clear();this.pathPulses=[];this.drawPaths();}
  drawPaths(){for(const path of this.board?.paths||[]){const points=this.pathPoints(path);if(points.length<2)continue;const render=path.render||{},graphics=new Graphics(),draw=()=>{if(["dashed","dotted"].includes(render.pattern)&&render.curve!=="smooth")patternedLine(graphics,points,render.pattern);else{graphics.moveTo(points[0].x,points[0].y);if(render.curve==="smooth"&&points.length>2){for(let i=1;i<points.length-1;i++){const current=points[i],next=points[i+1];graphics.quadraticCurveTo(current.x,current.y,(current.x+next.x)/2,(current.y+next.y)/2);}graphics.lineTo(points.at(-1).x,points.at(-1).y);}else points.slice(1).forEach(value=>graphics.lineTo(value.x,value.y));}};if(render.border!==false){draw();graphics.stroke({color:colorNumber(render.borderColor,0x172340),width:Number(render.width||5)+6,alpha:Number(render.opacity??1)});}draw();graphics.stroke({color:colorNumber(render.color,0xfff0a9),width:Number(render.width||5),alpha:render.hidden?.12:Number(render.opacity??1),pixelLine:false});graphics.eventMode=this.options.editable?"static":"none";graphics.cursor="pointer";graphics.on("pointerdown",event=>this.emitObject("path",path,event));this.layers.paths.addChild(graphics);this.objects.paths.set(path.id,graphics);if(this.options.editable&&(path.oneWay||path.direction)){const pulse=new Graphics().circle(0,0,Math.max(5,Number(render.width||5)*1.15)).fill(0xffffff);pulse.filters=[new BlurFilter({strength:3})];this.layers.paths.addChild(pulse);this.pathPulses.push({view:pulse,points:path.direction==="reverse"?[...points].reverse():points,progress:Math.random(),speed:.00018});}if(this.options.selectedPath===path.id){for(let index=0;index<(path.points||[]).length;index++){const position=point(path.points[index]),handle=new Graphics().circle(position.x,position.y,9).fill(0xfff36e).stroke({color:0x08142f,width:3});handle.eventMode="static";handle.cursor="grab";handle.on("pointerdown",event=>this.emitObject("path-point",{path,index,point:path.points[index]},event));this.layers.paths.addChild(handle);}}}}
  drawSpaces(){const labelStyle=new TextStyle({fontFamily:"Arial",fontSize:12,fontWeight:"bold",fill:0xffffff,stroke:{color:0x061009,width:3}});for(const space of this.board?.spaces||[]){const position=point(space),container=new Container();container.position.set(position.x,position.y);container.rotation=Number(space.rotation||0)*Math.PI/180;container.zIndex=Number(space.depth||2);const radius=5+Number(space.size||3)*3,shape=new Graphics();if(space.shadow){const shadow=traceSpaceShape(new Graphics(),space,radius).fill({color:colorNumber(space.shadowColor,0x000000),alpha:space.shadowOpacity});shadow.position.set(space.shadowOffset,space.shadowOffset);if(space.shadowBlur)shadow.filters=[new BlurFilter({strength:space.shadowBlur})];container.addChild(shadow);}traceSpaceShape(shape,space,radius).fill(COLORS[space.type]||COLORS.custom);if(space.borderWidth>0)shape.stroke({color:colorNumber(space.borderColor,0xffffff),width:space.borderWidth,alpha:space.borderOpacity});container.addChild(shape);if(space.activity?.icon){const icon=new Text({text:space.activity.icon,style:{fontSize:radius,fontFamily:"Arial"}});icon.anchor.set(.5);container.addChild(icon);}if(this.options.showNumbers){const badge=new Graphics().circle(radius*.75,radius*.75,8).fill(0x061009).stroke({color:0xffffff,width:1});container.addChild(badge);const number=new Text({text:String(Number(space.id)+1),style:labelStyle});number.anchor.set(.5);number.position.set(radius*.75,radius*.75);container.addChild(number);}if(this.options.starPosition===space.id){const star=new Graphics().circle(0,0,radius+8).stroke({color:0xffd55a,width:5,alpha:.8});container.addChildAt(star,0);}container.eventMode=this.options.editable?"static":"none";container.cursor="grab";container.on("pointerdown",event=>this.emitObject("space",space,event));this.layers.spaces.addChild(container);this.objects.spaces.set(space.id,container);}}
  emitObject(kind,data,event){event.stopPropagation();this.host.dispatchEvent(new CustomEvent(`board-${kind}-down`,{detail:{data,originalEvent:event,world:this.screenToWorld(event.global.x,event.global.y)}}));}
  setActors(actors=[]){this.actors=actors;this.layers.actors.removeChildren().forEach(child=>child.destroy?.({children:true}));this.objects.actors.clear();for(const [index,actor] of actors.entries()){const space=this.board?.spaces?.find(item=>item.id===(actor.spaceId??actor.position))||this.board?.spaces?.[0];if(!space)continue;const p=point(space),container=new Container();container.position.set(p.x+(index%4-1.5)*10,p.y-22);const body=new Graphics().circle(0,0,22).fill(colorNumber(actor.color,0x55ccff)).stroke({color:0xffffff,width:4});container.addChild(body);const label=new Text({text:actor.icon||actor.name?.slice(0,1)||String(index+1),style:{fontFamily:"Arial",fontSize:18,fontWeight:"bold",fill:0xffffff}});label.anchor.set(.5);container.addChild(label);if(actor.ragdoll?.sections?.length)this.applyRagdollActor(container,body,label,actor).catch(()=>{});else if(actor.spriteSheet)this.applyActorSprite(container,label,actor).catch(()=>{});container.zIndex=100+index;this.layers.actors.addChild(container);this.objects.actors.set(actor.id??index,container);}}
  applyTransitionFrame(view, transition, t, basePos = { x: view.x, y: view.y }) {
    const mode = String(transition.actorAction || transition.op || transition.label || "").toLowerCase();
    const out = mode.includes("despawn") || (transition.actorAction === "despawn");
    const effect = transition.stageEffect || (out ? "smoke-poof" : "fade");
    const progress = out ? 1 - t : t;

    view.visible = true;
    if (effect.includes("fade") || effect.includes("dissolve") || effect === "smoke-poof" || effect === "pixel-dissolve") {
      view.alpha = progress;
    } else if (effect === "lightning-strike") {
      view.alpha = Math.sin(t * 35) > 0 ? 1 : 0.25;
    } else {
      view.alpha = out ? (t >= 1 ? 0 : 1) : (t <= 0 ? 0 : 1);
    }

    const scaleEffect = effect === "shrink-pop" ? progress :
                        effect === "bounce-in" ? (1 + 0.22 * Math.sin(progress * Math.PI)) :
                        effect === "drop-in" ? (0.7 + 0.3 * progress) : 1;
    view.scale.set(scaleEffect);

    view.rotation = effect === "spiral" ? (out ? 1 - progress : progress) * Math.PI * 2 :
                    effect === "glitch" ? Math.sin(t * 70) * 0.18 : 0;

    let posX = basePos.x, posY = basePos.y;
    if (effect === "teleport" || effect === "warp-gate") posY += (out ? 1 : -1) * (1 - progress) * 80;
    else if (effect === "slide-in") posX += (out ? 1 : -1) * (1 - progress) * 120;
    else if (effect === "drop-in") posY += (out ? 1 : -1) * (1 - progress) * 140;
    view.position.set(posX, posY);

    if (out && t >= 1) {
      view.visible = false;
      view.alpha = 0;
    }
  }
  spawnTransitionParticles(view, transition, effect) {
    let particle = transition.particleDump?.effectId && transition.particle ? { ...transition.particle, ...transition.particleDump } : null;
    if (!particle) {
      if (effect === "smoke-poof") {
        particle = { color: "#ffffff", colorEnd: "#888888", size: 9, speed: 65, life: 0.7, shape: "circle", opacity: 0.85, count: 32 };
      } else if (effect === "starburst") {
        particle = { color: "#ffd55a", colorEnd: "#ff8800", size: 8, speed: 90, life: 0.8, shape: "star", opacity: 0.95, count: 28 };
      } else if (effect === "confetti-pop") {
        particle = { color: "#ff477e", colorEnd: "#4da6ff", size: 6, speed: 110, life: 0.9, shape: "square", opacity: 1, count: 36 };
      } else if (effect === "pixel-dissolve") {
        particle = { color: "#4da6ff", colorEnd: "#00f0ff", size: 5, speed: 50, life: 0.75, shape: "square", opacity: 0.9, count: 30 };
      } else if (effect === "warp-gate" || effect === "teleport") {
        particle = { color: "#a855f7", colorEnd: "#38bdf8", size: 6, speed: 75, life: 0.65, shape: "circle", opacity: 0.9, count: 24 };
      } else if (effect === "lightning-strike") {
        particle = { color: "#fef08a", colorEnd: "#67e8f9", size: 4, speed: 120, life: 0.45, shape: "line", opacity: 1, count: 20 };
      }
    }
    if (particle) {
      const count = Math.min(300, Math.max(1, Number(particle.count || transition.particleDump?.count || 24)));
      for (let index = 0; index < count; index++) {
        const angle = index / count * Math.PI * 2, spread = 12 + Math.random() * 36;
        this.addParticle({
          ...particle,
          position: {
            x: (view.x + Math.cos(angle) * spread) / BOARD_WORLD.width * 100,
            y: (view.y + Math.sin(angle) * spread) / BOARD_WORLD.height * 100
          },
          direction: angle * 180 / Math.PI,
          speed: Number(particle.speed || 70) * (0.55 + Math.random() * 0.8)
        });
      }
    }
  }
  setTimelinePreview(state={}){
    this.timelineMode=true;
    this.timelinePlaying=Boolean(state.playing);
    const actors=state.actors||[],signature=actors.map(actor=>`${actor.id}:${actor.sprite||actor.icon||""}`).join("|");
    if(signature!==this.timelineActorSignature){
      this.timelineActorSignature=signature;
      this.setActors(actors);
    }
    const center=state.center||{x:BOARD_WORLD.width/2,y:BOARD_WORLD.height/2},camera=state.camera||{};
    this.setCamera({zoom:camera.zoom??2,x:camera.x??0,y:camera.y??0});

    const despawned = new Set((state.despawnedActorIds || []).map(String));
    const spawnPending = new Set((state.spawnPendingActorIds || []).map(String));
    const activeTransitions = state.transitions || [];
    const activeIds = new Set(activeTransitions.map(item => item.id));
    this.timelineTransitionIds ||= new Set();

    for(const actor of actors){
      const view=this.objects.actors.get(actor.id);
      if(!view)continue;
      const actorIdStr = String(actor.id);
      const isHidden = despawned.has(actorIdStr) || spawnPending.has(actorIdStr) || actor.visible === false;
      const activeTransition = activeTransitions.find(t => String(t.actorId || t.parameters?.actor || "") === actorIdStr);

      const position=actor.stagePosition||{};
      const targetX = center.x + Number(position.x || 0) * 3.2;
      const targetY = center.y + Number(position.y || 0) * 2.2 - 34;

      if (isHidden && !activeTransition) {
        view.visible = false;
        view.alpha = 0;
      } else if (activeTransition) {
        if (!this.timelinePlaying || !view._transitionTweening) {
          const start = Number(activeTransition.start || 0);
          const duration = Math.max(0.01, Number(activeTransition.duration || 1));
          const progress = clamp((state.playhead - start) / duration, 0, 1);
          this.applyTransitionFrame(view, activeTransition, progress, { x: targetX, y: targetY });
        }
      } else {
        view.visible = true;
        view.alpha = 1;
        view.scale.set(1);
        view.rotation = 0;
        view.position.set(targetX, targetY);
      }

      if(view._ragdoll){
        const idleId=actor.idleAnimationId||actor.ragdoll?.idleAnimationId||actor.ragdoll?.activeAnimationId||actor.animationId;
        const targetAnimId=actor.animationId||idleId||view._ragdoll.actor.animationId;
        view._ragdoll.actor.animationId=targetAnimId;
        view._ragdoll.timelineTime=Number(actor.animationTime||0);
        const animation=view._ragdoll.renderer.rig.animations?.find(item=>String(item.id)===String(targetAnimId))||view._ragdoll.renderer.rig.animations?.[0];
        const loopAnim=animation?{...animation,loop:true}:animation;
        view._ragdoll.renderer.setPlayback(loopAnim,view._ragdoll.timelineTime);
      }
    }

    for(const transition of activeTransitions){
      if(!this.timelineTransitionIds.has(transition.id)){
        this.timelineTransitionIds.add(transition.id);
        if(this.timelinePlaying){
          this.playTimelineTransition(transition);
        }
      }
    }
    for(const id of [...this.timelineTransitionIds]){
      if(!activeIds.has(id)) this.timelineTransitionIds.delete(id);
    }

    this.timelinePlayers ||= new Map();
    const seats=state.players||[];
    for(const seat of seats){
      let view=this.timelinePlayers.get(seat.id);
      if(!view){
        view=new Container();
        const body=new Graphics().circle(0,0,18).fill(colorNumber(seat.color,0x4da6ff)).stroke({color:0xffffff,width:3});
        const label=new Text({text:seat.label||seat.id,style:{fontFamily:"Arial",fontSize:11,fontWeight:"bold",fill:0xffffff}});
        label.anchor.set(.5);
        view.addChild(body,label);
        view.zIndex=160;
        this.layers.actors.addChild(view);
        this.timelinePlayers.set(seat.id,view);
      }
      view.visible=seat.visible!==false;
      view.position.set(center.x+Number(seat.stagePosition?.x||0)*3.2,center.y+Number(seat.stagePosition?.y||0)*2.2);
    }
  }
  playTimelineTransition(transition){
    const actorId = transition.actorId || transition.parameters?.actor;
    const view = this.objects.actors.get(actorId) || [...this.objects.actors.values()][0];
    if(!view)return;

    const mode = String(transition.actorAction || transition.op || transition.label || "").toLowerCase();
    const out = mode.includes("despawn") || (transition.actorAction === "despawn");
    const effect = transition.stageEffect || (out ? "smoke-poof" : "fade");
    const duration = Math.max(220, Number(transition.duration || 1) * 1000);
    const started = performance.now();
    const base = { x: view.x, y: view.y, scale: 1, rotation: 0 };

    this.spawnTransitionParticles(view, transition, effect);

    view._transitionTweening = true;
    const tick = () => {
      if (this.destroyed || view.destroyed) return;
      const t = clamp((performance.now() - started) / duration, 0, 1);
      this.applyTransitionFrame(view, transition, t, base);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        view._transitionTweening = false;
        if (out) {
          view.visible = false;
          view.alpha = 0;
        } else {
          view.visible = true;
          view.alpha = 1;
          view.position.set(base.x, base.y);
          view.scale.set(base.scale);
          view.rotation = base.rotation;
        }
      }
    };
    tick();
  }
  async applyRagdollActor(container,body,label,actor){const ragdoll=new PixiRagdollRenderer({parent:container});const idleId=actor.idleAnimationId||actor.ragdoll?.idleAnimationId||actor.ragdoll?.activeAnimationId||actor.animationId;const initialAnim=actor.ragdoll?.animations?.find(a=>String(a.id)===String(idleId))||actor.ragdoll?.animations?.[0];const initialPlayback=initialAnim?{...initialAnim,loop:true}:null;await ragdoll.setActor(actor,initialPlayback);if(this.destroyed||container.destroyed){ragdoll.destroy();return;}body.visible=false;label.visible=false;const scale=48/Math.max(ragdoll.data.w,ragdoll.data.h);ragdoll.setDisplayTransform({x:-ragdoll.data.w*scale/2,y:-ragdoll.data.h*scale/2,scale});container._ragdoll={renderer:ragdoll,actor};}
  async applyActorSprite(container,label,actor){const texture=await Assets.load(actor.spriteSheet);if(this.destroyed||container.destroyed)return;const width=texture.width/3,height=texture.height/2,column=Math.round(Number(actor.spriteX||0)/50),row=Math.round(Number(actor.spriteY||0)/100),frame=new Rectangle(column*width,row*height,width,height),cropped=new Texture({source:texture.source,frame}),sprite=new Sprite(cropped);sprite.anchor.set(.5);sprite.width=38;sprite.height=38;container.addChild(sprite);label.visible=false;}
  moveActor(id,target,{duration=500,easing=value=>1-(1-value)**3}={}){const actor=this.objects.actors.get(id),space=typeof target==="object"?target:this.board?.spaces?.find(item=>item.id===target);if(!actor||!space)return Promise.resolve();const start={x:actor.x,y:actor.y},end=point(space),started=performance.now();return new Promise(resolve=>{const update=()=>{const progress=clamp((performance.now()-started)/duration,0,1),amount=easing(progress);actor.position.set(lerp(start.x,end.x,amount),lerp(start.y,end.y-22,amount));if(progress<1)requestAnimationFrame(update);else resolve();};update();});}
  animateSpaceIn(id,{duration=260}={}){const space=this.objects.spaces.get(id);if(!space)return;const started=performance.now();space.scale.set(.35);space.alpha=.25;const update=()=>{if(this.destroyed||space.destroyed)return;const progress=clamp((performance.now()-started)/duration,0,1),amount=1-(1-progress)**3;space.scale.set(lerp(.35,1,amount));space.alpha=lerp(.25,1,amount);if(progress<1)requestAnimationFrame(update);};update();}
  previewSpaceAt(id,position){const space=this.objects.spaces.get(id);if(space){const p=point(position);space.position.set(p.x,p.y);space.alpha=.72;}}
  setSelectedSpaces(ids=[]){this.layers.selection.removeChildren().forEach(child=>child.destroy?.());for(const id of ids){const definition=this.board?.spaces?.find(space=>space.id===id);if(!definition)continue;const p=point(definition),radius=15+Number(definition.size||3)*3,ring=new Graphics().circle(0,0,radius).stroke({color:0xfff36e,width:4,alpha:.95});ring.position.set(p.x,p.y);this.layers.selection.addChild(ring);}}
  addParticle(config={}){const start=config.position?point(config.position):{x:BOARD_WORLD.width/2,y:BOARD_WORLD.height/2};let emitter=null,best=Infinity;for(const system of this.effectSystems){if(system.definition.type!=="emitter")continue;const distance=Math.hypot(system.position.x-start.x,system.position.y-start.y);if(distance<best){best=distance;emitter=system.definition;}}const source={...config,...(emitter?.particle||{})},scale=Math.max(.1,Number(emitter?.particleScale||1)),random=Math.random()-.5,size=Math.max(1,Number(source.size||4)*scale*(1+random*Number(source.sizeRandomness||0))),particle=new Graphics();if(source.shape==="square")particle.rect(-size,-size,size*2,size*2);else if(source.shape==="line")particle.rect(-1.5,-size,3,size*2);else if(source.shape==="star"){const points=[];for(let i=0;i<10;i++){const angle=-Math.PI/2+i*Math.PI/5,distance=i%2?size*.42:size;points.push(Math.cos(angle)*distance,Math.sin(angle)*distance);}particle.poly(points);}else if(source.shape==="leaf")particle.ellipse(0,0,size*.55,size);else particle.circle(0,0,size);particle.fill(colorNumber(source.color,0xffffff));if(source.type==="smoke"||String(source.name||"").toLowerCase().includes("smoke"))particle.filters=[new BlurFilter({strength:Math.max(1,size*.12)})];particle.position.set(start.x,start.y);particle.alpha=Number(source.opacity??1);particle.rotation=(Number(source.rotation||0)+random*Number(source.rotationRandomStart||0))*Math.PI/180;const direction=(Number(source.direction??source.angle??-90)+random*Number(source.directionStartRandomness||0))*Math.PI/180,speed=Number(source.speed||Math.hypot(Number(config.vx||0),Number(config.vy||-35)))*scale*(1+random*Number(source.speedRandomness||0)),life=Number(source.degradeTime||source.life||2)*1000*scale*(1+random*Number(source.lifetimeRandomness||0));this.layers.particles.addChild(particle);this.particles.push({view:particle,vx:Math.cos(direction)*speed,vy:Math.sin(direction)*speed,life:Math.max(50,life),age:0,gravity:0,drag:Number(source.drag??1),definition:{...source,size:Number(source.size||4)*scale,sizeEnd:Number(source.sizeEnd!=null?source.sizeEnd:(source.size||4))*scale,gravity:Number(source.gravity||0)*scale,degradeTime:Number(source.degradeTime||2)*scale},configured:true,randomPhase:Math.random()*Math.PI*2});return particle;}
  drawBoardObjects(){const definitions=[["objects","♣"],["triggers","⚡"],["regions","▧"],["spawns","★"],["cameras","🎥"]];for(const [key,fallback] of definitions){for(const object of this.board?.[key]||[]){const p=point(object),container=new Container();container.position.set(p.x,p.y);const pin=new Graphics().circle(0,0,13).fill({color:0x132b1b,alpha:.94}).stroke({color:0xfff0a9,width:3});const icon=new Text({text:object.icon||fallback,style:{fontFamily:"Arial",fontSize:16}});icon.anchor.set(.5);container.addChild(pin,icon);this.layers.objects.addChild(container);}}}
  drawEffectPlacements(){this.effectSystems=[];for(const effect of this.board?.effectPlacements||[]){const p=point(effect),container=new Container();container.position.set(p.x,p.y);const radius=Number(effect.radius||effect.lightRadius||45),color=colorNumber(effect.color,0x7dffad),shape=effect.controllerShape||"circle",field=new Graphics();if(shape==="box")field.rect(-radius,-radius*.65,radius*2,radius*1.3);else if(shape==="line")field.rect(-radius,-3,radius*2,6);else if(shape==="cone")field.poly([0,0,-radius*.5,radius,radius*.5,radius]);else field.circle(0,0,radius);if(effect.kind==="lightsource")container.addChild(field.fill({color,alpha:.08*Number(effect.lightIntensity||1)}).stroke({color,width:2,alpha:.3}));else if(effect.type!=="emitter")container.addChild(field.fill({color,alpha:.04}).stroke({color,width:3,alpha:.45}));if(this.options.editable||this.options.showEffectMarkers){const label=new Text({text:effect.icon||"✦",style:{fontFamily:"Arial",fontSize:20,fill:0xffffff,stroke:{color:0x061009,width:3}}});label.anchor.set(.5);container.addChild(label);}this.layers.particles.addChild(container);const definition=effect.type==="emitter"?effect:{...effect,physicsType:effect.type,type:"attractor"};this.effectSystems.push({definition,position:p,elapsed:0});}}
  setEffects(effects={}){const filters=[];if(effects.blur)filters.push(new BlurFilter({strength:Number(effects.blur)}));if(effects.noise)filters.push(new NoiseFilter({noise:Number(effects.noise)}));if(effects.tint||effects.brightness||effects.saturation){const matrix=new ColorMatrixFilter();if(effects.brightness)matrix.brightness(Number(effects.brightness),false);if(effects.saturation)matrix.saturate(Number(effects.saturation),true);if(effects.tint)matrix.tint(colorNumber(effects.tint),true);filters.push(matrix);}this.world.filters=filters;this.world.skew.set(Number(effects.skewX||0),Number(effects.skewY||0));}
  setWeather(weather={}){this.weather=typeof weather==="string"?{type:weather,intensity:1}:{type:"none",intensity:0,...weather};this.layers.weather.removeChildren().forEach(child=>child.destroy?.());if(this.weather.type==="none")return;const count=Math.round(30+90*Number(this.weather.intensity||.5));for(let i=0;i<count;i++){const drop=new Graphics();if(this.weather.type==="snow")drop.circle(0,0,2+Math.random()*3).fill({color:0xffffff,alpha:.8});else drop.moveTo(0,0).lineTo(-4,12).stroke({color:this.weather.type==="sandstorm"?0xd8b16a:0xa9d9ff,width:2,alpha:.55});drop.position.set(Math.random()*BOARD_WORLD.width,Math.random()*BOARD_WORLD.height);drop._weatherSpeed=20+Math.random()*80;this.layers.weather.addChild(drop);}}
  setCamera(next={},immediate=false){if(next.x!=null)this.camera.targetX=Number(next.x);if(next.y!=null)this.camera.targetY=Number(next.y);if(next.zoom!=null)this.camera.targetZoom=clamp(Number(next.zoom),.65,10);if(next.rotation!=null)this.camera.targetRotation=Number(next.rotation);if(immediate){this.camera.x=this.camera.targetX;this.camera.y=this.camera.targetY;this.camera.zoom=this.camera.targetZoom;this.camera.rotation=this.camera.targetRotation;this.applyCamera(true);}}
  panBy(x,y){this.setCamera({x:this.camera.targetX+x,y:this.camera.targetY+y});}zoomBy(factor){this.setCamera({zoom:this.camera.targetZoom*factor});}rotateBy(radians){this.setCamera({rotation:this.camera.targetRotation+radians});}
  zoomAt(clientX,clientY,factor){const rect=this.app.canvas.getBoundingClientRect(),screen={x:clientX-rect.left,y:clientY-rect.top},before=this.screenToWorld(screen.x,screen.y),current={zoom:this.camera.zoom,x:this.camera.x,y:this.camera.y,rotation:this.camera.rotation};this.setCamera({zoom:this.camera.targetZoom*factor});this.camera.zoom=this.camera.targetZoom;this.camera.x=this.camera.targetX;this.camera.y=this.camera.targetY;this.applyCamera(true);const after=this.worldToScreen(before.x,before.y);this.panBy(screen.x-after.x,screen.y-after.y);this.camera.zoom=current.zoom;this.camera.x=current.x;this.camera.y=current.y;this.camera.rotation=current.rotation;this.applyCamera(true);}
  applyCamera(){if(!this.app)return;const width=this.app.renderer.width/this.app.renderer.resolution,height=this.app.renderer.height/this.app.renderer.resolution,fit=Math.min(width/BOARD_WORLD.width,height/BOARD_WORLD.height);this.cameraRoot.position.set(width/2+this.camera.x,height/2+this.camera.y);this.cameraRoot.pivot.set(BOARD_WORLD.width/2,BOARD_WORLD.height/2);this.cameraRoot.scale.set(fit*this.camera.zoom);this.cameraRoot.rotation=this.camera.rotation;this.options.onCameraChange?.({...this.camera});}
  screenToWorld(x,y){return this.cameraRoot?.toLocal({x,y})||{x:0,y:0};}worldToScreen(x,y){return this.cameraRoot?.toGlobal({x,y})||{x:0,y:0};}percentFromScreen(x,y){const p=this.screenToWorld(x,y);return{x:clamp(p.x/BOARD_WORLD.width*100,0,100),y:clamp(p.y/BOARD_WORLD.height*100,0,100)};}
  tick(deltaMS){const amount=1-Math.pow(1-this.camera.smoothing,deltaMS/16.667);this.camera.x=lerp(this.camera.x,this.camera.targetX,amount);this.camera.y=lerp(this.camera.y,this.camera.targetY,amount);this.camera.zoom=lerp(this.camera.zoom,this.camera.targetZoom,amount);this.camera.rotation=lerp(this.camera.rotation,this.camera.targetRotation,amount);this.applyCamera();for(const pulse of this.pathPulses){pulse.progress=(pulse.progress+deltaMS*pulse.speed)%1;const lengths=[],total=pulse.points.slice(1).reduce((sum,next,index)=>{const length=Math.hypot(next.x-pulse.points[index].x,next.y-pulse.points[index].y);lengths.push(length);return sum+length;},0);let target=pulse.progress*total,segment=0;while(segment<lengths.length-1&&target>lengths[segment])target-=lengths[segment++];const from=pulse.points[segment],to=pulse.points[segment+1],part=target/(lengths[segment]||1);pulse.view.position.set(lerp(from.x,to.x,part),lerp(from.y,to.y,part));pulse.view.alpha=.35+.65*Math.sin(pulse.progress*Math.PI);}for(const system of this.effectSystems){const effect=system.definition;if(["attractor","deflector","spotlight","laser"].includes(effect.type))continue;system.elapsed+=deltaMS;const interval=1000/Math.max(1,Number(effect.rate||12));let emitted=0;while(system.elapsed>=interval&&emitted++<5&&this.particles.length<800){system.elapsed-=interval;const spread=Number(effect.spread||90)*Math.PI/180,angle=(Number(effect.angle??-90)*Math.PI/180)+(Math.random()-.5)*spread,speed=Number(effect.speed||60),radius=Number(effect.radius||45),offset=effect.emitterShape==="circle"||effect.emitterShape==="ring"?Math.random()*Math.PI*2:0,distance=effect.emitterShape==="ring"?radius:effect.emitterShape==="circle"?Math.random()*radius:0;this.addParticle({position:{x:(system.position.x+Math.cos(offset)*distance)/BOARD_WORLD.width*100,y:(system.position.y+Math.sin(offset)*distance)/BOARD_WORLD.height*100},color:Math.random()>.5?effect.color:effect.secondaryColor,size:Number(effect.size||5),vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:Number(effect.life||2)*1000,gravity:Number(effect.gravity||0)});}}for(const particle of [...this.particles]){particle.age+=deltaMS;particle.vy+=particle.gravity*deltaMS/1000;particle.view.x+=particle.vx*deltaMS/1000;particle.view.y+=particle.vy*deltaMS/1000;particle.view.alpha=1-particle.age/particle.life;if(particle.age>=particle.life){particle.view.destroy();this.particles.splice(this.particles.indexOf(particle),1);}}for(const drop of this.layers.weather.children){drop.y+=drop._weatherSpeed*deltaMS/1000;if(drop.y>BOARD_WORLD.height+20){drop.y=-20;drop.x=Math.random()*BOARD_WORLD.width;}}}
  tickControllerPhysics(deltaMS){const dt=deltaMS/1000,emitters=this.effectSystems.filter(system=>system.definition.type==="emitter");for(const particle of [...this.particles]){if(!particle.configured){let nearest=null,best=Infinity;for(const emitter of emitters){const distance=Math.hypot(emitter.position.x-particle.view.x,emitter.position.y-particle.view.y);if(distance<best){best=distance;nearest=emitter;}}const definition=nearest?.definition?.particle;if(definition){particle.definition={...definition,...particle.definition};const random=Math.random()-.5,lifeRandom=1+random*Number(definition.lifetimeRandomness||0);particle.life=Math.max(50,Number(definition.degradeTime||2)*1000*lifeRandom);particle.gravity=0;particle.view.rotation=(Number(definition.rotation||0)+random*Number(definition.rotationRandomStart||0))*Math.PI/180;const speedScale=1+random*Number(definition.speedRandomness||0),startDirection=(Number(definition.direction??-90)+random*Number(definition.directionStartRandomness||0))*Math.PI/180,speed=Number(definition.speed||Math.hypot(particle.vx,particle.vy))*speedScale;particle.vx=Math.cos(startDirection)*speed;particle.vy=Math.sin(startDirection)*speed;particle.randomPhase=Math.random()*Math.PI*2;}particle.configured=true;}const definition=particle.definition||{},age=particle.age/1000,progress=clamp(particle.age/Math.max(1,particle.life),0,1),gravityAngle=Number(definition.gravityDirection??90)*Math.PI/180,gravity=Number(definition.gravity||0);particle.vx+=Math.cos(gravityAngle)*gravity*dt;particle.vy+=Math.sin(gravityAngle)*gravity*dt;const speed=Math.max(.001,Math.hypot(particle.vx,particle.vy)),nx=-particle.vy/speed,ny=particle.vx/speed,lateral=Math.sin((particle.randomPhase||0)+age*Number(definition.lateralFrequency||0)*Math.PI*2)*Number(definition.lateralStrength||0);particle.vx+=nx*lateral*dt;particle.vy+=ny*lateral*dt;if(definition.directionChangeStrength&&definition.directionChangeRate){const turn=Math.sin((particle.randomPhase||0)+age*Number(definition.directionChangeRate))*Number(definition.directionChangeStrength)*Math.PI/180*dt,cos=Math.cos(turn),sin=Math.sin(turn),vx=particle.vx;particle.vx=vx*cos-particle.vy*sin;particle.vy=vx*sin+particle.vy*cos;}particle.vx*=Math.pow(Number(definition.drag??1),deltaMS/16.667);particle.vy*=Math.pow(Number(definition.drag??1),deltaMS/16.667);particle.view.rotation+=Number(definition.rotationSpeed||0)*Math.PI/180*dt;particle.view.alpha=lerp(Number(definition.opacity??1),Number(definition.opacityEnd??0),progress);const sizeScale=lerp(1,Number(definition.sizeEnd??(definition.size||1))/Math.max(1,Number(definition.size||1)),progress);particle.view.scale.set(sizeScale);}for(const system of this.effectSystems){const field=system.definition,type=field.physicsType||field.type;if(type==="emitter"||field.kind==="lightsource")continue;const radius=Number(field.radius||55),force=Number(field.force||80),influence=Number(field.distance||radius);for(const particle of [...this.particles]){const dx=system.position.x-particle.view.x,dy=system.position.y-particle.view.y,distance=Math.max(.001,Math.hypot(dx,dy)),nx=dx/distance,ny=dy/distance;if(distance>influence)continue;if(type==="destroyer"&&distance<=radius){particle.view.destroy();this.particles.splice(this.particles.indexOf(particle),1);continue;}if(type==="attractor"){const acceleration=field.forceMode==="gravity"?force/Math.max(1,distance*distance)*1000:force;particle.vx+=nx*acceleration*dt;particle.vy+=ny*acceleration*dt;continue;}if(type==="blocker"&&distance<radius){particle.view.position.set(system.position.x-nx*radius,system.position.y-ny*radius);const inward=particle.vx*nx+particle.vy*ny;if(inward>0){particle.vx-=nx*inward;particle.vy-=ny*inward;}continue;}if(type==="deflector"){if(field.collisionMode==="bounce"&&distance<=radius){const inward=particle.vx*nx+particle.vy*ny;if(inward>0){particle.vx-=2*nx*inward;particle.vy-=2*ny*inward;}}else{const acceleration=field.collisionMode==="anti-gravity"?force/Math.max(1,distance*distance)*1000:force;particle.vx-=nx*acceleration*dt;particle.vy-=ny*acceleration*dt;}}}}}
  tickActorAnimations(deltaMS){if(this.timelineMode)return;this.actorAnimationTime=(this.actorAnimationTime||0)+deltaMS/1000;for(const view of this.objects.actors.values()){const runtime=view._ragdoll;if(!runtime)continue;const idleId=runtime.actor.idleAnimationId||runtime.actor.ragdoll?.idleAnimationId||runtime.actor.animationId||runtime.actor.currentAnimationId||runtime.renderer.rig.idleAnimationId||runtime.renderer.rig.activeAnimationId;const animation=runtime.renderer.rig.animations?.find(item=>String(item.id)===String(idleId))||runtime.renderer.rig.animations?.[0];const loopAnim=animation?{...animation,loop:true}:animation;runtime.renderer.setPlayback(loopAnim,this.actorAnimationTime);}}
  destroy(){this.destroyed=true;this.resizeObserver?.disconnect();if(this.app?.ticker){this.app.ticker.remove(this.tickHandler);this.app.ticker.stop();}this.app?.destroy(true,{children:true,texture:false});this.app=null;}
}


const mounted=new Map();
let timelinePreviewRenderer=null;
export async function mountBoardRenderer(host,board,options={}){if(!host)return null;mounted.get(host)?.destroy();const renderer=new PixiBoardRenderer(host,options);mounted.set(host,renderer);await renderer.init();await renderer.setBoard(board,options);return renderer;}
export async function mountTimelinePreviewRenderer(host,board,state={}){if(!host)return null;if(timelinePreviewRenderer&&!timelinePreviewRenderer.destroyed){if(timelinePreviewRenderer.host!==host){timelinePreviewRenderer.resizeObserver?.disconnect();timelinePreviewRenderer.host=host;host.replaceChildren(timelinePreviewRenderer.app.canvas);timelinePreviewRenderer.resizeObserver=new ResizeObserver(()=>timelinePreviewRenderer.applyCamera(true));timelinePreviewRenderer.resizeObserver.observe(host);timelinePreviewRenderer.applyCamera(true);}timelinePreviewRenderer.setTimelinePreview(state);return timelinePreviewRenderer;}const renderer=new PixiBoardRenderer(host,{interactive:false});timelinePreviewRenderer=renderer;await renderer.init();await renderer.setBoard(board,{interactive:false});renderer.setTimelinePreview(state);return renderer;}
export function destroyTimelinePreviewRenderer(){timelinePreviewRenderer?.destroy();timelinePreviewRenderer=null;}
export function destroyBoardRenderers(root=document){for(const [host,renderer] of mounted){if(root===document||root.contains(host)){renderer.destroy();mounted.delete(host);}}}
