export interface SpotifyTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  album: {
    name: string;
    images: Array<{
      url: string;
      height: number;
      width: number;
    }>;
  };
  artists: Array<{
    name: string;
    id: string;
  }>;
}

export interface SpotifyCurrentlyPlaying {
  is_playing: boolean;
  item: SpotifyTrack | null;
  progress_ms: number | null;
  timestamp: number;
}

export interface SpotifyAudioFeatures {
  danceability: number;
  energy: number;
  tempo: number;
  valence: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  loudness: number;
  speechiness: number;
  id: string;
}

export interface CurrentTrackResponse {
  isPlaying: boolean;
  track?: {
    name: string;
    artist: string;
    album: string;
    albumCover?: string;
    id: string;
    duration: number;
    progress: number;
  };
  audioFeatures?: SpotifyAudioFeatures | null;
  error?: string;
  authUrl?: string;
  message?: string;
}

export interface ApiResponse {
  success?: boolean;
  action?: string;
  error?: string;
}