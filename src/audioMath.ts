import { MAP_LOW_FREQS, MAP_HIGH_BOOST_FREQS, MAP_HIGH_ATTEN_FREQS } from './constants';
import type { EQState } from './types';

// We'll create offline curves to get exact freq response
export async function getEqResponseCurve(state: EQState): Promise<{freq: number, db: number}[]> {
  const AudioContextClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!AudioContextClass) return [];

  // 1 sample context is enough just to use the filter API
  const ctx = new AudioContextClass(1, 1, 44100);

  const lowBoostFilter = ctx.createBiquadFilter();
  lowBoostFilter.type = 'lowshelf';
  
  const lowAttenFilter = ctx.createBiquadFilter();
  lowAttenFilter.type = 'lowshelf';

  const highBoostFilter = ctx.createBiquadFilter();
  highBoostFilter.type = 'peaking';

  const highAttenFilter = ctx.createBiquadFilter();
  highAttenFilter.type = 'highshelf';

  const lowFreq = MAP_LOW_FREQS[state.lowFreqIndex];
  const highBoostFreq = MAP_HIGH_BOOST_FREQS[state.highBoostFreqIndex] * 1000;
  const highAttenFreq = MAP_HIGH_ATTEN_FREQS[state.highAttenFreqIndex] * 1000;

  const l_boost = state.bypassEQ ? 0 : state.lowBoost;
  const l_atten = state.bypassEQ ? 0 : state.lowAtten;
  const h_boost = state.bypassEQ ? 0 : state.highBoost;
  const h_atten = state.bypassEQ ? 0 : state.highAtten;

  lowBoostFilter.frequency.value = lowFreq;
  lowAttenFilter.frequency.value = lowFreq;
  lowBoostFilter.gain.value = (l_boost / 100) * 15;
  lowAttenFilter.gain.value = -(l_atten / 100) * 15;

  highBoostFilter.frequency.value = highBoostFreq;
  highBoostFilter.gain.value = (h_boost / 100) * 15;
  const qValue = 10 - (state.bandwidth / 100) * 9.5;
  highBoostFilter.Q.value = Math.max(0.1, qValue);

  highAttenFilter.frequency.value = highAttenFreq;
  highAttenFilter.gain.value = -(h_atten / 100) * 15;

  // We want to sample across logarithmic frequencies
  const numPoints = 200;
  const frequencyArray = new Float32Array(numPoints);
  for (let i = 0; i < numPoints; i++) {
    const minFreq = 20;
    const maxFreq = 20000;
    // log space
    frequencyArray[i] = minFreq * Math.pow(maxFreq / minFreq, i / (numPoints - 1));
  }

  const mag1 = new Float32Array(numPoints);
  const pha1 = new Float32Array(numPoints);
  lowBoostFilter.getFrequencyResponse(frequencyArray, mag1, pha1);

  const mag2 = new Float32Array(numPoints);
  const pha2 = new Float32Array(numPoints);
  lowAttenFilter.getFrequencyResponse(frequencyArray, mag2, pha2);

  const mag3 = new Float32Array(numPoints);
  const pha3 = new Float32Array(numPoints);
  highBoostFilter.getFrequencyResponse(frequencyArray, mag3, pha3);

  const mag4 = new Float32Array(numPoints);
  const pha4 = new Float32Array(numPoints);
  highAttenFilter.getFrequencyResponse(frequencyArray, mag4, pha4);

  const combined = [];
  for (let i = 0; i < numPoints; i++) {
    // Total magnitude is the product of magnitudes in linear scale
    const totalMag = mag1[i] * mag2[i] * mag3[i] * mag4[i];
    // Convert to dB
    const db = 20 * Math.log10(totalMag);
    combined.push({
      freq: frequencyArray[i],
      db: state.power ? db : 0 // flat if powered off
    });
  }

  return combined;
}
