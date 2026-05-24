import { EQState } from './types';

export const DEFAULT_STATE: EQState = {
  power: true,
  bypassEQ: false,
  lowBoost: 0,
  lowAtten: 0,
  lowFreqIndex: 1, // 30Hz
  highBoost: 0,
  bandwidth: 50,
  highBoostFreqIndex: 4, // 10kHz
  highAtten: 0,
  highAttenFreqIndex: 1, // 10kHz
};

export const PRESETS: Record<string, Partial<EQState>> = {
  "Default": { ...DEFAULT_STATE },
  "Punchy Kick": {
    lowBoost: 80,
    lowAtten: 40,
    lowFreqIndex: 3, // 60Hz
    highBoost: 30,
    bandwidth: 60,
    highBoostFreqIndex: 2, // 5kHz
    highAtten: 10,
    highAttenFreqIndex: 1, // 10kHz
  },
  "Vocal Sparkle": {
    lowBoost: 10,
    lowAtten: 20,
    lowFreqIndex: 4, // 100Hz
    highBoost: 60,
    bandwidth: 30, // Sharp
    highBoostFreqIndex: 5, // 12kHz
    highAtten: 0,
    highAttenFreqIndex: 3, // 20kHz
  },
  "Warm Bass": {
    lowBoost: 60,
    lowAtten: 10,
    lowFreqIndex: 1, // 30Hz
    highBoost: 10,
    bandwidth: 80, // Broad
    highBoostFreqIndex: 1, // 4kHz
    highAtten: 30,
    highAttenFreqIndex: 0, // 5kHz
  }
};
