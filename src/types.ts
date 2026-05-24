export type EQState = {
  power: boolean;
  bypassEQ: boolean; // false = In, true = Out (Bypassed)
  lowBoost: number;
  lowAtten: number;
  lowFreqIndex: number;
  highBoost: number;
  bandwidth: number;
  highBoostFreqIndex: number;
  highAtten: number;
  highAttenFreqIndex: number;
};
