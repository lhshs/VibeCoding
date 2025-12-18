export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  LOADING_MISSION = 'LOADING_MISSION'
}

export interface Point {
  x: number;
  y: number;
}

export interface Entity extends Point {
  width: number;
  height: number;
  speed: number;
  color: string;
  id: number;
  hp: number;
}

export interface Player extends Entity {
  score: number;
}

export interface MissionBriefing {
  name: string;
  objective: string;
  pilotCallsign: string;
  theme: 'scifi' | 'modern' | 'retro';
}
