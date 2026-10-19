export type Kind = 'river' | 'tidal' | 'ground';
export type State = 'low' | 'normal' | 'high' | 'unknown';
export type Trend = 'rising' | 'falling' | 'steady' | 'unknown';
export type Severity = 1 | 2 | 3;

export interface Mark {
  value: number;
  date: string;
}

/** A gauge as the catalogue knows it, before any readings */
export interface Station {
  id: string;
  name: string;
  river?: string;
  town?: string;
  lat: number;
  lon: number;
  kind: Kind;
  measure: string;
  unit: string;
  rloi?: string;
  low?: number;
  high?: number;
  record?: Mark;
  recent?: Mark;
}

export interface Gauge extends Station {
  value?: number;
  at?: string;
  change?: number;
  trend: Trend;
  state: State;
}

export interface RainStation {
  id: string;
  lat: number;
  lon: number;
  measure: string;
}

export interface RainGauge extends RainStation {
  mm?: number;
  at?: string;
}

export interface Warning {
  id: string;
  severity: Severity;
  label: string;
  area?: string;
  county?: string;
  water?: string;
  message?: string;
  raised: string;
  changed?: string;
  lat?: number;
  lon?: number;
}

export interface Live {
  fetchedAt: string;
  gauges: Gauge[];
  rain: RainGauge[];
  warnings: Warning[];
}

export interface Summary {
  fetchedAt: string;
  rivers: number;
  high: number;
  low: number;
  rising: number;
  falling: number;
  tracked: number;
  warnings: Warning[];
  risers: Gauge[];
}

/** Where a gauge sits along its river, in kilometres from the source */
export interface Stop {
  id: string;
  km: number;
}

/** A river with a gauge on it, and every gauge along it from source to mouth */
export interface River {
  index: number;
  slug: string;
  name: string;
  length: number;
  bounds: [number, number, number, number];
  into?: { slug: string; name: string; km: number };
  sea?: boolean;
  stops: Stop[];
}

/** Just enough of a river to find it by name */
export interface RiverName {
  slug: string;
  name: string;
  gauges: number;
  into?: string;
}

/** [epoch minutes, value] */
export type Point = [number, number];

/** Which layers the map is showing */
export interface Shown {
  river: boolean;
  tidal: boolean;
  ground: boolean;
  rain: boolean;
  warnings: boolean;
}

export interface Picked {
  kind: 'station' | 'warning' | 'rain' | 'river';
  id: string;
}
