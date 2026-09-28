export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Message {
  id: string;
  authorId: string;
  location: Coordinates;
  type: 'audio' | 'text';
  name: string;
  audioUrl?: string;
  text?: string;
  visibility: 'public' | 'personal';
  timestamp: string;
}

export enum AppState {
  Idle,
  Finding,
  Placing,
}

export enum RecordingState {
  Idle,
  Recording,
  Recorded,
  Playing,
}