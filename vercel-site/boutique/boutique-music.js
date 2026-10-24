// Original ambient pads synthesised in the browser. No external audio requests.
export function createAmbientMusic({onChange=()=>{}}={}) {
  let context,master,timer,suspendTimer,active=false,volume=.035,nextAt=0;
  const voices=new Set();
  const chords=[[130.8128,164.8138,195.9977,246.9417],[110,130.8128,164.8138,195.9977],[87.3071,130.8128,164.8138,220],[97.9989,123.4708,146.8324,195.9977]];
  let chord=0;
  function schedule(){
    if(!active)return;
    while(nextAt<context.currentTime+9){
      const frequencies=chords[chord++%chords.length];
      frequencies.forEach((frequency,index)=>{
        const oscillator=context.createOscillator(),gain=context.createGain(),filter=context.createBiquadFilter();
        oscillator.type='sine';oscillator.frequency.value=frequency;oscillator.detune.value=(index-1.5)*3;
        filter.type='lowpass';filter.frequency.value=900;
        gain.gain.setValueAtTime(0,nextAt);gain.gain.linearRampToValueAtTime(.12,nextAt+3);gain.gain.linearRampToValueAtTime(0,nextAt+12);
        oscillator.connect(filter);filter.connect(gain);gain.connect(master);oscillator.start(nextAt);oscillator.stop(nextAt+12.1);
        voices.add(oscillator);oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();filter.disconnect();gain.disconnect();};
      });
      nextAt+=8;
    }
    timer=setTimeout(schedule,3000);
  }
  async function toggle(){
    if(active){active=false;clearTimeout(timer);master.gain.setTargetAtTime(0,context.currentTime,.25);suspendTimer=setTimeout(()=>{if(!active)context.suspend();},1000);onChange(false);return false;}
    clearTimeout(suspendTimer);
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)throw Error('Audio is unavailable in this browser.');
    context ||= new Audio();if(!master){master=context.createGain();master.gain.value=0;master.connect(context.destination);}
    await context.resume();voices.forEach(voice=>{try{voice.stop();}catch{}});active=true;nextAt=context.currentTime+.1;master.gain.setTargetAtTime(volume,context.currentTime,.6);nextAt=Math.max(context.currentTime+.1,nextAt);schedule();onChange(true);return true;
  }
  function setVolume(value){volume=Math.max(0,Math.min(.1,Number(value)||0));if(master)master.gain.setTargetAtTime(active?volume:0,context.currentTime,.2);}
  async function suspend(){clearTimeout(timer);if(context?.state==='running')await context.suspend();}
  async function resume(){if(active && context?.state==='suspended'){voices.forEach(voice=>{try{voice.stop();}catch{}});await context.resume();nextAt=context.currentTime+.1;clearTimeout(timer);schedule();}}
  function dispose(){active=false;clearTimeout(timer);clearTimeout(suspendTimer);voices.forEach(v=>{try{v.stop();}catch{}});context?.close();}
  return {toggle,setVolume,suspend,resume,dispose};
}

// A short mechanical door chime. Audio is unlocked only by a visitor action.
export function createDoorBell(){
  let context;const voices=new Set();let lastRing=-Infinity;
  async function unlock(){
    if(typeof navigator!=='undefined'&&navigator.userActivation&&!navigator.userActivation.hasBeenActive)return false;
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
    context ||= new Audio();await context.resume();return true;
  }
  async function ring(){
    if(!await unlock())return false;
    const now=context.currentTime;if(now-lastRing<1)return false;lastRing=now;
    for(const [offset,base] of [[0,1046.5],[.18,830.6]])for(const [harmonic,level]of [[1,.035],[2.76,.008]]){
      const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type='sine';oscillator.frequency.value=base*harmonic;
      gain.gain.setValueAtTime(0,now+offset);gain.gain.linearRampToValueAtTime(level,now+offset+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+offset+1.25);
      oscillator.connect(gain);gain.connect(context.destination);oscillator.start(now+offset);oscillator.stop(now+offset+1.3);voices.add(oscillator);
      oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};
    }return true;
  }
  function dispose(){voices.forEach(v=>{try{v.stop();}catch{}});context?.close();}
  return {ring,unlock,dispose};
}
