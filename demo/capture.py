# Records the NeonGate demo: a real screen capture of the live app while a MIDI keyboard (Web MIDI port, simulated) plays Am F C G through
# the Offbeat Neon gate, plus the app's own exported WAV of exactly that performance laid under it from the moment Play is pressed.
import asyncio, time, json, base64, sys, os
from playwright.async_api import async_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'https://neongate.vercel.app/'; D=os.path.dirname(os.path.abspath(__file__)); RAW=D+'/raw'; os.makedirs(RAW,exist_ok=True); F="window.__neongate"
MOCK="""(()=>{ const inp={id:'in1',name:'MIDI keyboard',type:'input',state:'connected',onmidimessage:null}; const acc={inputs:new Map([['in1',inp]]),outputs:new Map(),onstatechange:null}; window.__mockIn=inp; navigator.requestMIDIAccess=()=>Promise.resolve(acc); })();"""
CH=[[57,60,64],[57,60,65],[55,60,64],[55,59,62]]
async def main():
  async with async_playwright() as p:
    br=await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx=await br.new_context(viewport={'width':1280,'height':720},record_video_dir=RAW,record_video_size={'width':1280,'height':720}); await ctx.add_init_script(MOCK); t0=time.monotonic(); pg=await ctx.new_page()
    await pg.goto(URL); await pg.evaluate("()=>localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(600)
    await pg.click('#tapBtn'); await pg.wait_for_function(f"{F}.ctx() && {F}.ctx().state==='running'")
    take=[{'s':b*16,'d':15.5,'n':n,'v':0.85} for b in range(8) for n in CH[b%4]]
    await pg.evaluate(f"t=>{{const s={F}.setSetting; s('bpm',100); s('keyRoot',9); s('mode','minor'); s('chordsText','Am F C G'); s('bars',8); s('recipe','offbeat'); s('voice','neonsaw'); {F}.state.take=t;}}",take)
    w=await pg.evaluate(f"""async()=>{{const r=await {F}.exportWavBytes(); let s=''; for(let i=0;i<r.bytes.length;i+=32768) s+=String.fromCharCode.apply(null,r.bytes.subarray(i,i+32768)); return {{name:r.name,b64:btoa(s),frames:r.frames}}}}""")
    open(D+'/'+w['name'],'wb').write(base64.b64decode(w.pop('b64')))
    await pg.evaluate(f"()=>{{ {F}.state.take=[]; }}")  # the keyboard plays it live on screen; the WAV under the video is the app's export of the same notes
    await pg.evaluate("()=>document.querySelector('section.play').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(1200)
    await pg.evaluate(f"""ch=>{{ {F}.start(); const P={F}.play(), sd=60/100/4; const send=d=>window.__mockIn.onmidimessage({{data:new Uint8Array(d)}});
      for(let b=0;b<8;b++){{ const on=P.t0+b*16*sd, off=on+15.5*sd; const wait=t=>Math.max(0,(t-{F}.ctx().currentTime)*1000);
        setTimeout(()=>ch[b%4].forEach(n=>send([0x90,n,108])),wait(on)); setTimeout(()=>ch[b%4].forEach(n=>send([0x80,n,0])),wait(off)); }} }}""",CH)
    m={'play':time.monotonic()-t0+0.1}
    await pg.wait_for_timeout(9600); await pg.evaluate("()=>document.querySelector('section.gate').scrollIntoView({block:'start',behavior:'smooth'})"); await pg.wait_for_timeout(9800)
    m['end']=time.monotonic()-t0; await pg.evaluate(f"()=>{F}.stop()"); await ctx.close(); vp=await pg.video.path(); await br.close()
    m['video']=vp; m['wav']=w['name']; m['frames']=w['frames']; json.dump(m,open(D+'/marks.json','w'),indent=1); print(m)
asyncio.run(main())
