// Isolated, repeatable model review plus rig checks. Run with Vite serving.
// node scripts/character-model-check.mjs [output-directory]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const out = process.argv[2] || 'review/chibi-rebuild';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 760 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => errors.push('failed ' + r.url()));
  await page.route('**/__character-review', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body style="margin:0"><script type="module">
    import * as THREE from '/node_modules/three/build/three.module.js';
    import { createCharacter, loadChibi } from '/src/character.js';
    await loadChibi();
    import { ink, InkRenderer, tagOutlines } from '/src/ink.js';
    const renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(640,760); renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(-2,4,5); light.castShadow = true;
    light.shadow.mapSize.set(2048,2048); light.shadow.bias = -0.0002;
    light.shadow.camera.left = light.shadow.camera.bottom = -2;
    light.shadow.camera.right = light.shadow.camera.top = 2;
    scene.add(light, new THREE.AmbientLight(0xffffff,0.7));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200,200),ink({tone:1,hatch:0,facing:0}));
    floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; floor.position.y = -0.008; scene.add(floor);
    const hero = createCharacter(); scene.add(hero.root); tagOutlines(scene);
    const camera = new THREE.PerspectiveCamera(32,640/760,0.05,100);
    const inkR = new InkRenderer(renderer); inkR.setSize(640,760);
    inkR.post.uniforms.uWobble.value = 0.35;
    function draw(angle = 0) { const center = new THREE.Box3().setFromObject(hero.root).getCenter(new THREE.Vector3()); camera.position.set(center.x+Math.sin(angle)*2.6,center.y+0.36,center.z+Math.cos(angle)*2.6);camera.lookAt(center);inkR.render(scene,camera); }
    hero.update(1/60,1,{speed:0}); draw();
    window.review = {hero,scene,draw};
  </script></body></html>` }));
  await page.goto((process.env.URL || 'http://localhost:5173') + '/__character-review');
  await page.waitForFunction(() => !!window.review, null, { timeout: 30000 }).catch(e => { throw new Error('review page failed: ' + JSON.stringify(errors)); });
  const shots = [];
  for (const [label, angle] of [['Front',0],['Three quarter',0.65],['Side',Math.PI/2],['Back three quarter',2.45],['Back',Math.PI]]) {
    await page.evaluate(a => window.review.draw(a),angle);
    const name = label.toLowerCase().replaceAll(' ','_');
    const buf = await page.screenshot({path: `${out}/${name}.png`});
    shots.push({label,buf});
  }
  for (const [pose, speed] of [['stand',1.4],['sit',0],['lie',0]]) {
    await page.evaluate(({pose,speed}) => {
      const {hero,draw} = window.review; hero.setPose(pose);
      for(let i=0;i<150;i++)hero.update(1/60,2+i/60,{speed});
      draw(0.85);
    },{pose,speed});
    await page.screenshot({path:`${out}/${pose === 'stand' ? 'walking' : pose}.png`});
  }
  const checks = await page.evaluate(() => {
    const {hero,scene,draw} = window.review;
    const checks = [];
    for (const pose of ['stand','sit','lie']) {
      hero.setPose(pose);
      for (let i=0;i<180;i++) hero.update(1/60, i/60+2, {speed:pose==='stand'?1.4:0,turn:0.6});
      let finite = true;
      scene.updateMatrixWorld(true);
      hero.root.traverse(o => { if (!o.matrixWorld.elements.every(Number.isFinite)) finite=false;
        if(o.isMesh && !o.geometry.attributes.position.array.every(Number.isFinite)) finite=false; });
      checks.push({pose,finite,hairOffset:hero.hairOffset});
    }
    hero.setPose('stand');hero.setBackpack(false);hero.reach();hero.pickup();
    for(let i=0;i<120;i++)hero.update(1/60,5+i/60,{speed:0});
    hero.setBackpack(true);
    for(let i=0;i<120;i++)hero.update(1/60,7+i/60,{speed:0});
    draw(0.65);return checks;
  });
  if(errors.length || checks.some(c=>!c.finite)) throw new Error(JSON.stringify({errors,checks}));
  await page.setViewportSize({width:1600,height:430});
  await page.setContent(`<body style="margin:0;background:#e9e3d6;display:flex">${shots.map(s=>`<div style="width:320px;text-align:center;font:18px Georgia;color:#302b26"><img width="320" src="data:image/png;base64,${s.buf.toString('base64')}">${s.label}</div>`).join('')}</body>`);
  await page.screenshot({path:`${out}/turnaround.png`,fullPage:true});
  fs.writeFileSync(`${out}/checks.json`,JSON.stringify({errors,checks},null,2));
  console.log(JSON.stringify({out,errors,checks}));
} finally { await browser.close(); }
