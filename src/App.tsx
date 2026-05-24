import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Play, Pause, Volume2, Save, ChevronDown, Check, X } from 'lucide-react';
import { MAP_LOW_FREQS, MAP_HIGH_BOOST_FREQS, MAP_HIGH_ATTEN_FREQS } from './constants';
import type { EQState } from './types';
import { PRESETS, DEFAULT_STATE } from './presets';

// --- Audio Processing Logic ---
class WebAudioEQ {
  ctx: AudioContext | null = null;
  source: MediaElementAudioSourceNode | null = null;
  lowBoostFilter: BiquadFilterNode | null = null;
  lowAttenFilter: BiquadFilterNode | null = null;
  highBoostFilter: BiquadFilterNode | null = null;
  highAttenFilter: BiquadFilterNode | null = null;
  gainNode: GainNode | null = null;
  isInitialized = false;

  init(audioElement: HTMLAudioElement) {
    if (this.isInitialized) return;
    
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();

    this.source = this.ctx.createMediaElementSource(audioElement);
    
    // Low Shelf (Boost)
    this.lowBoostFilter = this.ctx.createBiquadFilter();
    this.lowBoostFilter.type = 'lowshelf';
    
    // Low Shelf (Atten)
    this.lowAttenFilter = this.ctx.createBiquadFilter();
    this.lowAttenFilter.type = 'lowshelf';

    // Peaking (High Boost)
    this.highBoostFilter = this.ctx.createBiquadFilter();
    this.highBoostFilter.type = 'peaking';

    // High Shelf (High Atten)
    this.highAttenFilter = this.ctx.createBiquadFilter();
    this.highAttenFilter.type = 'highshelf';

    this.gainNode = this.ctx.createGain();

    // Route sequentially
    this.source.connect(this.lowBoostFilter);
    this.lowBoostFilter.connect(this.lowAttenFilter);
    this.lowAttenFilter.connect(this.highBoostFilter);
    this.highBoostFilter.connect(this.highAttenFilter);
    this.highAttenFilter.connect(this.gainNode);
    this.gainNode.connect(this.ctx.destination);

    this.isInitialized = true;
  }

  updateParams(state: EQState) {
    if (!this.ctx || !this.isInitialized) return;
    
    // Master Power Gain (Mute if powered off)
    this.gainNode!.gain.setTargetAtTime(state.power ? 1 : 0, this.ctx.currentTime, 0.05);

    const lowFreq = MAP_LOW_FREQS[state.lowFreqIndex];
    const highBoostFreq = MAP_HIGH_BOOST_FREQS[state.highBoostFreqIndex] * 1000;
    const highAttenFreq = MAP_HIGH_ATTEN_FREQS[state.highAttenFreqIndex] * 1000;

    // Apply bypass by setting all EQ gains to 0 when bypass is true
    const l_boost = state.bypassEQ ? 0 : state.lowBoost;
    const l_atten = state.bypassEQ ? 0 : state.lowAtten;
    const h_boost = state.bypassEQ ? 0 : state.highBoost;
    const h_atten = state.bypassEQ ? 0 : state.highAtten;

    if (this.lowBoostFilter && this.lowAttenFilter) {
      this.lowBoostFilter.frequency.setTargetAtTime(lowFreq, this.ctx.currentTime, 0.1);
      this.lowAttenFilter.frequency.setTargetAtTime(lowFreq, this.ctx.currentTime, 0.1);
      this.lowBoostFilter.gain.setTargetAtTime((l_boost / 100) * 15, this.ctx.currentTime, 0.1);
      this.lowAttenFilter.gain.setTargetAtTime(-(l_atten / 100) * 15, this.ctx.currentTime, 0.1);
    }

    if (this.highBoostFilter) {
      this.highBoostFilter.frequency.setTargetAtTime(highBoostFreq, this.ctx.currentTime, 0.1);
      this.highBoostFilter.gain.setTargetAtTime((h_boost / 100) * 15, this.ctx.currentTime, 0.1);
      
      // Bandwidth Knob (0 = Sharp/High Q, 100 = Broad/Low Q)
      const qValue = 10 - (state.bandwidth / 100) * 9.5;
      this.highBoostFilter.Q.setTargetAtTime(Math.max(0.1, qValue), this.ctx.currentTime, 0.1);
    }

    if (this.highAttenFilter) {
      this.highAttenFilter.frequency.setTargetAtTime(highAttenFreq, this.ctx.currentTime, 0.1);
      this.highAttenFilter.gain.setTargetAtTime(-(h_atten / 100) * 15, this.ctx.currentTime, 0.1);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
}

const audioEngine = new WebAudioEQ();

// --- UI Subcomponents ---

const renderKnobNumbers = (radiusOffset = 0) => {
  return [0,1,2,3,4,5,6,7,8,9,10].map(n => {
    const ang = -135 + (n/10) * 270;
    const rad = (ang - 90) * (Math.PI / 180);
    const radius = 42 + radiusOffset; 
    const x = Math.cos(rad) * radius;
    const y = Math.sin(rad) * radius;
    return (
      <div 
        key={n} 
        style={{position:'absolute', left: 40 + x, top: 40 + y, transform: 'translate(-50%, -50%)'}} 
        className="w-[3px] h-[3px] rounded-full bg-[#888] shadow-[0_0_2px_rgba(0,0,0,0.8)] select-none pointer-events-none"
      />
    );
  });
};

const BlackKnob = ({ value, onChange, label, subLabel }: { value: number, onChange: (v: number) => void, label?: React.ReactNode, subLabel?: React.ReactNode }) => {
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startValue = value;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = startY - moveEvent.clientY;
      let newValue = startValue + deltaY * 0.5;
      newValue = Math.max(0, Math.min(100, newValue));
      onChange(newValue);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const angle = -135 + (value / 100) * 270;

  return (
    <div className="flex flex-col items-center relative z-10 touch-none w-24">
      <div className="text-center h-8 flex flex-col justify-end mb-4">
        {label && <div className="text-[#d8d8d8] font-semibold text-[11px] uppercase tracking-widest">{label}</div>}
      </div>
      <div className="relative w-20 h-20 flex items-center justify-center">
        {renderKnobNumbers(2)}
        <div 
          className="relative w-16 h-16 rounded-full cursor-ns-resize shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
          onPointerDown={handlePointerDown}
        >
          <motion.div 
            className="absolute inset-0 rounded-full bg-gradient-to-b from-[#222] to-[#0a0a0a] border border-[#050505]"
            animate={{ rotate: angle }}
            transition={{ type: 'spring', bounce: 0, duration: 0 }}
          >
            {/* Subtle top reflection */}
            <div className="absolute inset-x-[15%] top-[5%] h-[20%] bg-gradient-to-b from-white/10 to-transparent rounded-full pointer-events-none" />
            {/* Indicator Dot */}
            <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[4px] h-[4px] bg-[#d0d0d0] shadow-[0_0_4px_rgba(255,255,255,0.4)] rounded-full opacity-90" />
            <div className="absolute inset-[30%] rounded-full bg-gradient-to-tr from-[#0a0a0a] to-[#151515] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]" />
          </motion.div>
        </div>
      </div>
      <div className="w-full text-center h-8 mt-4 flex items-start justify-center relative">
        {subLabel && <div className="text-[#a0a0a0] text-[8px] uppercase font-bold tracking-[0.2em]">{subLabel}</div>}
      </div>
    </div>
  );
};

const ChickenHeadKnob = ({ index, options, onChange, label, subLabel }: { index: number, options: (number|string)[], onChange: (i: number) => void, label?: React.ReactNode, subLabel?: React.ReactNode }) => {
  const angleRange = options.length > 1 ? 140 : 0; 
  const step = options.length > 1 ? angleRange / (options.length - 1) : 0;
  const startAngle = options.length > 1 ? -angleRange / 2 : 0;
  
  const currentAngle = startAngle + step * index;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startIndex = index;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const stepsToMove = Math.round(deltaY / 20);
      let newIndex = startIndex + stepsToMove;
      newIndex = Math.max(0, Math.min(options.length - 1, newIndex));
      onChange(newIndex);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div className="flex flex-col items-center relative z-10 touch-none w-24">
      <div className="text-center h-8 flex flex-col justify-end mb-4">
        {label && <div className="text-[#d8d8d8] font-semibold text-[11px] uppercase tracking-widest">{label}</div>}
      </div>
      <div className="relative w-20 h-20 flex items-center justify-center">
        {options.map((opt, i) => {
           const ang = startAngle + step * i;
           const rad = (ang - 90) * (Math.PI / 180);
           const radius = 38; 
           const x = Math.cos(rad) * radius;
           const y = Math.sin(rad) * radius;
           return (
              <span key={i} style={{position:'absolute', left: 40 + x, top: 40 + y, transform: 'translate(-50%, -50%)'}} className="text-[10px] font-bold text-[#f0f0f0]/60 select-none pointer-events-none">
                  {opt}
              </span>
           );
        })}

        <div 
          className="relative w-16 h-16 cursor-ns-resize z-20 shadow-[0_4px_8px_rgba(0,0,0,0.6)] rounded-full"
          onPointerDown={handlePointerDown}
        >
          <motion.div 
            className="absolute inset-0 rounded-full bg-gradient-to-b from-[#222] to-[#0a0a0a] border border-[#050505]"
            animate={{ rotate: currentAngle }}
            transition={{ type: 'spring', bounce: 0.3, duration: 0.3 }}
          >
             {/* Subtle top reflection */}
             <div className="absolute inset-x-[15%] top-[5%] h-[20%] bg-gradient-to-b from-white/10 to-transparent rounded-full pointer-events-none" />
             {/* Indicator Dot */}
             <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[4px] h-[4px] bg-[#d0d0d0] shadow-[0_0_4px_rgba(255,255,255,0.4)] rounded-full opacity-90" />
             <div className="absolute inset-[30%] rounded-full bg-gradient-to-tr from-[#0a0a0a] to-[#151515] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]" />
          </motion.div>
        </div>
      </div>
      <div className="w-full text-center h-8 mt-4 flex items-start justify-center">
        {subLabel && <div className="text-[#a0a0a0] text-[8px] uppercase font-bold tracking-[0.2em]">{subLabel}</div>}
      </div>
    </div>
  );
};

const StandardToggleSwitch = ({ value, onChange, labelUp, labelDown }: { value: boolean, onChange: (v: boolean) => void, labelUp?: string, labelDown?: string }) => (
  <div className="flex flex-col items-center">
    {labelUp && <span className="text-[10px] font-bold text-[#d8d8d8] mb-2">{labelUp}</span>}
    <button 
      onClick={() => onChange(!value)}
      className="relative w-8 h-12 outline-none flex justify-center items-center cursor-pointer"
    >
      <div className="absolute w-6 h-6 rounded-full bg-[#111] border border-[#2c2c2c] shadow-[inset_0_2px_5px_rgba(0,0,0,1)] flex items-center justify-center">
        <div className="w-4 h-4 rounded-full bg-[#161616]" />
      </div>
      <motion.div 
        className="absolute w-[10px] bg-gradient-to-t from-[#666] to-[#eee] shadow-[0_4px_8px_rgba(0,0,0,0.8)] border border-[#444]"
        initial={false}
        animate={{ 
          height: '26px',
          y: value ? -10 : 10,
          rotateX: value ? '40deg' : '-40deg',
          borderTopLeftRadius: value ? '10px' : '2px',
          borderTopRightRadius: value ? '10px' : '2px',
          borderBottomLeftRadius: value ? '2px' : '10px',
          borderBottomRightRadius: value ? '2px' : '10px',
        }}
        style={{ transformOrigin: 'center' }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      />
    </button>
    {labelDown && <span className="text-[10px] font-bold text-[#d8d8d8] mt-2">{labelDown}</span>}
  </div>
);

const AmberJewelLight = ({ on }: { on: boolean }) => (
  <div className="relative w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-b from-[#222] to-[#111] shadow-[0_2px_4px_rgba(255,255,255,0.1),_inset_0_4px_6px_rgba(0,0,0,1)]">
    <div className="absolute inset-[6px] rounded-full border border-orange-950 bg-[#3a1a00] overflow-hidden">
      <div 
        className={`absolute inset-0 bg-orange-600 transition-opacity duration-300 ${on ? 'opacity-100' : 'opacity-0'}`} 
        style={{
            background: 'radial-gradient(circle at 40% 40%, #ff8c00 0%, #a33e00 50%, #401000 100%)',
            boxShadow: 'inset 0 0 10px rgba(255,255,255,0.5), 0 0 20px 5px rgba(255,140,0,0.6)'
        }}
      />
      {/* Jewel faceted reflections */}
      <div className="absolute top-[10%] left-[20%] w-[30%] h-[20%] bg-amber-100/40 rounded-full blur-[1px] rotate-[-20deg]" />
      {/* Texture for gem look */}
      <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, black 2px, black 4px)'}} />
    </div>
  </div>
);


// --- Main App Component ---
export default function App() {
  const [eqState, setEqState] = useState<EQState>({ ...DEFAULT_STATE });
  const [userPresets, setUserPresets] = useState<Record<string, Partial<EQState>>>(() => {
    const saved = localStorage.getItem('ds-eq-presets');
    return saved ? JSON.parse(saved) : {};
  });
  const [currentPreset, setCurrentPreset] = useState<string>("Default");
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  const allPresets = { ...PRESETS, ...userPresets };

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 監聽宿主 (DAW/C++) 傳來的參數更新 (例如 Automation 或是恢復專案狀態)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const juceObj = (window as any).juce;
      if (juceObj) {
        juceObj.onParameterChange = (param: string, value: any) => {
          setEqState(prev => {
            const newState = { ...prev, [param]: value };
            audioEngine.updateParams(newState);
            return newState;
          });
        };
      }
    }
  }, []);

  const handleParamChange = (param: keyof EQState, value: any) => {
    setEqState(prev => {
      const newState = { ...prev, [param]: value };
      audioEngine.updateParams(newState);
      
      // VST / JUCE Bridge: 將參數改變發送給 C++ 後端
      if (typeof window !== 'undefined') {
        const juceObj = (window as any).juce;
        if (juceObj && typeof juceObj.sendParameterChange === 'function') {
          // 如果宿主是 JUCE，呼叫 JUCE 方法
          juceObj.sendParameterChange(param, value);
        } else {
          // 在一般瀏覽器中，發送自訂事件方便擴充與除錯
          window.dispatchEvent(new CustomEvent('vst-param-change', { 
            detail: { param, value } 
          }));
        }
      }
      
      return newState;
    });
    // If we changed a parameter, we are no longer purely on the named preset
    if (currentPreset !== "Custom") {
      setCurrentPreset("Custom");
    }
  };

  const loadPreset = (name: string) => {
    const preset = allPresets[name];
    if (preset) {
      setEqState(prev => {
        const newState = { ...prev, ...preset };
        audioEngine.updateParams(newState);
        return newState;
      });
      setCurrentPreset(name);
      setIsPresetMenuOpen(false);
    }
  };

  const savePreset = () => {
    setIsSaveModalOpen(true);
    setSaveName(currentPreset === "Custom" ? "" : currentPreset);
  };

  const confirmSavePreset = () => {
    if (saveName && saveName.trim()) {
      const newPresets = { ...userPresets, [saveName.trim()]: { ...eqState } };
      setUserPresets(newPresets);
      localStorage.setItem('ds-eq-presets', JSON.stringify(newPresets));
      setCurrentPreset(saveName.trim());
      setIsSaveModalOpen(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      const url = URL.createObjectURL(file);
      if (audioRef.current) {
        audioRef.current.src = url;
      }
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (!audioEngine.isInitialized) {
        audioEngine.init(audioRef.current);
        audioEngine.updateParams(eqState);
      }
      audioEngine.resume(); 
      
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const onEnded = () => setIsPlaying(false);
      audio.addEventListener('ended', onEnded);
      return () => audio.removeEventListener('ended', onEnded);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#111111] flex flex-col items-center justify-center p-8 font-sans">
      
      {/* Audio Player and Utilities Panel */}
      <div className="w-full max-w-[1240px] bg-[#1e1e1e] p-4 rounded-t-lg border border-[#333] border-b-0 flex items-center justify-between text-gray-400 relative z-50">
        
        {/* Left: Transport */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 px-4 py-2 bg-[#2a2a2a] hover:bg-[#333] rounded cursor-pointer transition-colors text-sm font-medium shadow-sm">
            <Upload size={16} />
            {audioFile ? audioFile.name : 'Load Audio File'}
            <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
          </label>
          
          <button 
            onClick={togglePlay}
            disabled={!audioFile}
            className={`flex items-center gap-2 px-4 py-2 rounded font-medium transition-colors shadow-sm ${!audioFile ? 'bg-[#1a1a1a] text-gray-600 cursor-not-allowed' : 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'}`}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>
        </div>

        {/* Center: Presets */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button 
              onClick={() => setIsPresetMenuOpen(!isPresetMenuOpen)}
              className="flex items-center justify-between gap-3 w-48 px-4 py-2 bg-[#2a2a2a] hover:bg-[#333] rounded text-sm font-medium transition-colors border border-[#444] shadow-sm text-gray-200"
            >
              <span className="truncate">{currentPreset}</span>
              <ChevronDown size={14} className="text-gray-500" />
            </button>
            <AnimatePresence>
              {isPresetMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full mt-2 w-48 bg-[#2a2a2a] border border-[#444] rounded shadow-xl overflow-hidden"
                >
                  <div className="max-h-64 overflow-y-auto">
                    {Object.keys(allPresets).map(name => (
                      <button
                        key={name}
                        onClick={() => loadPreset(name)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-orange-500/20 hover:text-orange-400 transition-colors flex items-center justify-between"
                      >
                        {name}
                        {currentPreset === name && <Check size={14} className="text-orange-500" />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button 
            onClick={savePreset}
            className="p-2 bg-[#2a2a2a] hover:bg-[#333] rounded transition-colors text-gray-400 hover:text-orange-400 border border-[#444] shadow-sm"
            title="Save Preset"
          >
            <Save size={16} />
          </button>
        </div>

        {/* Right: Tools */}
        <div className="flex items-center gap-4">
          <div className="text-[10px] uppercase font-bold tracking-widest text-[#555] flex items-center gap-2">
            <Volume2 size={14} />
            DS DSP Engine
          </div>
        </div>
        <audio ref={audioRef} crossOrigin="anonymous" />
      </div>

      {/* Hardware Panel Container */}
      <div 
        className="w-full max-w-[1240px] relative shadow-[0_30px_60px_-15px_rgba(0,0,0,1)] select-none rounded-[1px] bg-[#1a1a1c]"
      >
        {/* Outer Frame Bevels */}
        <div className="absolute inset-0 border-[4px] border-t-[#2a2a2c] border-b-[#0c0c0d] border-l-[#222] border-r-[#151515] pointer-events-none z-20 rounded-[2px]" />
        
        {/* Inner Panel Bevel */}
        <div className="absolute inset-[4px] border border-[#050505] shadow-[inset_0_2px_15px_rgba(0,0,0,0.8)] pointer-events-none z-20" />
        
        {/* Panel Surface */}
        <div className="absolute inset-[5px] bg-gradient-to-b from-[#222325] to-[#18191a]" />
        
        {/* Horizontal Seam */}
        <div className="absolute top-[40%] left-[5px] right-[5px] h-[2px] bg-black/60 border-b border-white/5 pointer-events-none z-0" />

        {/* Subtle noise texture */}
        <div className="absolute inset-[5px] opacity-[0.07] pointer-events-none mix-blend-overlay z-0" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")'}} />
        
        {/* Rack Ear Screws */}
        {[
          {top: '12px', left: '12px'}, {bottom: '12px', left: '12px'},
          {top: '12px', right: '12px'}, {bottom: '12px', right: '12px'}
        ].map((pos, i) => (
           <div key={i} className="absolute w-[18px] h-[18px] rounded-full bg-gradient-to-br from-[#444] to-[#151515] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),_0_2px_4px_rgba(0,0,0,0.8)] border border-[#0a0a0a] z-20" style={pos}>
              <div className="absolute inset-[4px] bg-[#111] rounded-full rotate-45 flex items-center justify-center shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]">
                 <div className="w-full h-[1.5px] bg-black" />
              </div>
           </div>
        ))}

        <div className="px-12 py-10 flex flex-col gap-12 relative z-10 w-full">
          
          {/* Top Row: Main Knobs */}
          <div className="flex justify-between items-start">
            <div className="w-[280px]" /> {/* Spacer for symmetry */}
            
            <div className="flex-1 flex justify-center gap-12">
               {/* Low Band */}
               <BlackKnob value={eqState.lowBoost} onChange={v => handleParamChange('lowBoost', v)} label="BOOST" />
               <BlackKnob value={eqState.lowAtten} onChange={v => handleParamChange('lowAtten', v)} label="ATTEN" />
               
               <div className="w-12" /> {/* Section Divider gap */}

               {/* High Boost Band */}
               <BlackKnob value={eqState.highBoost} onChange={v => handleParamChange('highBoost', v)} label="BOOST" />
               <BlackKnob value={eqState.highAtten} onChange={v => handleParamChange('highAtten', v)} label="ATTEN" />
               
               <div className="w-4" />

               {/* High Atten Sel */}
               <ChickenHeadKnob index={eqState.highAttenFreqIndex} options={MAP_HIGH_ATTEN_FREQS} onChange={v => handleParamChange('highAttenFreqIndex', v)} label="ATTEN SEL" />
             </div>

            <div className="w-[280px]" />
          </div>

          {/* Bottom Row: Controls & Brand */}
          <div className="flex justify-between items-end">
            
            {/* Logo & EQ Bypass */}
            <div className="w-[280px] flex items-end justify-between pl-4 pb-2">
               <div className="flex flex-col items-center">
                 <div className="text-[11px] font-bold text-[#d8d8d8] opacity-90 tracking-widest leading-loose text-center">
                   DIRTY STUDIO<br/>
                   GOLD TUBE EQUALIZER<br/>
                 </div>
                 <div className="mt-2 flex flex-col items-center">
                   <div className="text-[9px] border-b-2 border-orange-500 px-2 py-0.5 inline-block text-orange-400">
                     PRO EDITION
                   </div>
                 </div>
               </div>
               <div className="mb-4 mr-10">
                 <StandardToggleSwitch 
                    value={!eqState.bypassEQ} 
                    onChange={v => handleParamChange('bypassEQ', !v)} 
                 />
               </div>
            </div>

            {/* Central Selectors */}
            <div className="flex-1 flex justify-center gap-20 items-end pb-2">
               <ChickenHeadKnob 
                 index={eqState.lowFreqIndex} 
                 options={MAP_LOW_FREQS} 
                 onChange={v => handleParamChange('lowFreqIndex', v)} 
                 label="Hz" 
                 subLabel="LOW FREQUENCY" 
               />
               <BlackKnob 
                 value={eqState.bandwidth} 
                 onChange={v => handleParamChange('bandwidth', v)} 
                 label="BANDWIDTH" 
                 subLabel={
                   <div className="flex justify-between w-[80px] absolute left-1/2 -translate-x-1/2">
                     <span>NARROW</span>
                     <span>WIDE</span>
                   </div>
                 } 
               />
               <ChickenHeadKnob 
                 index={eqState.highBoostFreqIndex} 
                 options={MAP_HIGH_BOOST_FREQS} 
                 onChange={v => handleParamChange('highBoostFreqIndex', v)} 
                 label="kHz" 
                 subLabel="HIGH FREQUENCY" 
               />
            </div>

            {/* Power Light & Toggle */}
            <div className="w-[280px] flex items-end justify-end gap-12 pr-[48px] pb-4">
               <div className="flex flex-col items-center gap-2">
                  <AmberJewelLight on={eqState.power} />
               </div>
               <div className="flex flex-col">
                 <StandardToggleSwitch 
                    value={eqState.power} 
                    onChange={v => handleParamChange('power', v)} 
                 />
                 <div className="flex items-center gap-6 text-[10px] uppercase font-bold text-[#d8d8d8] mt-2">
                    <span className="opacity-80">OFF</span>
                    <span className="opacity-80">ON</span>
                 </div>
               </div>
            </div>

          </div>
        </div>

      </div>

      {/* Save Modal */}
      <AnimatePresence>
        {isSaveModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1e1e1e] border border-[#333] p-6 rounded-lg shadow-2xl w-[320px]"
            >
              <div className="flex justify-between items-center mb-4 text-gray-300">
                <h3 className="font-bold">Save Preset</h3>
                <button onClick={() => setIsSaveModalOpen(false)} className="hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>
              <input 
                type="text" 
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="Enter preset name..."
                className="w-full bg-[#111] border border-[#444] rounded px-3 py-2 text-white mb-4 focus:outline-none focus:border-orange-500"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && saveName.trim()) {
                    confirmSavePreset();
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-4 py-2 rounded text-sm text-gray-400 hover:bg-[#333] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmSavePreset}
                  disabled={!saveName.trim()}
                  className="px-4 py-2 rounded text-sm bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

