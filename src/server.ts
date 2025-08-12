import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import type { 
  SpotifyTokenResponse, 
  SpotifyCurrentlyPlaying, 
  SpotifyTrack,
  SpotifyAudioFeatures, 
  CurrentTrackResponse,
  ApiResponse 
} from './types/spotify';

const app = express();
const PORT = process.env.PORT || 8080;

// ES Modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');

// Environment variables
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${PORT}/callback`;
const GETSONGBPM_API_KEY = process.env.GETSONGBPM_API_KEY;

// Validate required environment variables
if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ ERROR: Missing required environment variables SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET');
    process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

// Application state
interface AppState {
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiration: number | null;
    bpmCache: Map<string, SpotifyAudioFeatures>;
    lastTrackId: string | null;
}

const state: AppState = {
    accessToken: null,
    refreshToken: null,
    tokenExpiration: null,
    bpmCache: new Map<string, SpotifyAudioFeatures>(),
    lastTrackId: null
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(publicDir, 'about.html'));
});

// Start Spotify authentication
app.get('/auth', (req, res) => {
    const scopes = [
        'user-read-currently-playing',
        'user-read-playback-state',
        'user-modify-playback-state'
    ];

    const authURL = 'https://accounts.spotify.com/authorize?' +
        new URLSearchParams({
            response_type: 'code',
            client_id: CLIENT_ID!,
            scope: scopes.join(' '),
            redirect_uri: REDIRECT_URI,
            show_dialog: 'true'
        }).toString();

    res.redirect(authURL);
});

// Spotify callback
app.get('/callback', async (req, res) => {
    const code = req.query.code as string;

    if (!code) {
        return res.status(400).send('Error: No se recibió código de autorización');
    }

    try {
        const tokenData = await getAccessToken(code);
        state.accessToken = tokenData.access_token;
        state.refreshToken = tokenData.refresh_token || null;
        state.tokenExpiration = Date.now() + (tokenData.expires_in * 1000);

        console.log('✅ Autenticación exitosa con Spotify');
        res.send(`
            <html>
                <head>
                    <title>Spotify Conectado</title>
                    <meta charset="UTF-8">
                </head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>🎵 ¡Conectado a Spotify!</h1>
                    <p>Ya puedes cerrar esta pestaña y usar tu widget en OBS</p>
                    <p><strong>URL para OBS:</strong> <code>http://localhost:${PORT}/</code></p>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('❌ Error en autenticación:', error);
        res.status(500).send('Error en la autenticación con Spotify');
    }
});

// API to get current track
app.get('/api/current-track', async (req, res) => {
    try {
        await ensureValidToken();

        if (!state.accessToken) {
            const response: CurrentTrackResponse = {
                isPlaying: false,
                error: 'No autenticado',
                authUrl: '/auth'
            };
            return res.json(response);
        }

        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                'Authorization': `Bearer ${state.accessToken}`,
            },
        });

        if (response.status === 204 || response.status === 404) {
            const apiResponse: CurrentTrackResponse = {
                isPlaying: false,
                message: 'No hay música reproduciéndose'
            };
            return res.json(apiResponse);
        }

        if (!response.ok) {
            throw new Error(`Spotify API error: ${response.status}`);
        }

        const data: SpotifyCurrentlyPlaying = await response.json();

        if (!data.item) {
            const apiResponse: CurrentTrackResponse = {
                isPlaying: false,
                message: 'No hay información de la canción actual'
            };
            return res.json(apiResponse);
        }

        // Get real BPM data - only fetch when track changes
        const audioFeatures = await getBPMData(data.item);

        const trackResponse: CurrentTrackResponse = {
            isPlaying: data.is_playing,
            track: {
                name: data.item.name,
                artist: data.item.artists[0].name,
                album: data.item.album.name,
                albumCover: data.item.album.images[0]?.url,
                id: data.item.id,
                duration: data.item.duration_ms,
                progress: data.progress_ms || 0
            },
            audioFeatures: audioFeatures
        };

        res.json(trackResponse);

    } catch (error) {
        console.error('❌ Error obteniendo canción actual:', error);
        const errorResponse: CurrentTrackResponse = {
            isPlaying: false,
            error: 'Error obteniendo información de Spotify'
        };
        res.status(500).json(errorResponse);
    }
});

// API to control playback
app.post('/api/play-pause', async (req, res) => {
    try {
        await ensureValidToken();

        const currentTrack = await getCurrentTrackStatus();
        const endpoint = currentTrack?.is_playing ? 'pause' : 'play';

        const response = await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${state.accessToken!}`,
            },
        });

        if (response.ok || response.status === 204) {
            const apiResponse: ApiResponse = { success: true, action: endpoint };
            res.json(apiResponse);
        } else {
            throw new Error(`Error ${response.status}`);
        }

    } catch (error) {
        console.error('❌ Error controlando reproducción:', error);
        const errorResponse: ApiResponse = { error: 'Error controlando reproducción' };
        res.status(500).json(errorResponse);
    }
});

// API for previous track
app.post('/api/previous', async (req, res) => {
    try {
        await ensureValidToken();

        const response = await fetch('https://api.spotify.com/v1/me/player/previous', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.accessToken!}`,
            },
        });

        if (response.ok || response.status === 204) {
            const apiResponse: ApiResponse = { success: true };
            res.json(apiResponse);
        } else {
            throw new Error(`Error ${response.status}`);
        }

    } catch (error) {
        console.error('❌ Error canción anterior:', error);
        const errorResponse: ApiResponse = { error: 'Error cambiando canción' };
        res.status(500).json(errorResponse);
    }
});

// API for next track
app.post('/api/next', async (req, res) => {
    try {
        await ensureValidToken();

        const response = await fetch('https://api.spotify.com/v1/me/player/next', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.accessToken!}`,
            },
        });

        if (response.ok || response.status === 204) {
            const apiResponse: ApiResponse = { success: true };
            res.json(apiResponse);
        } else {
            throw new Error(`Error ${response.status}`);
        }

    } catch (error) {
        console.error('❌ Error canción siguiente:', error);
        const errorResponse: ApiResponse = { error: 'Error cambiando canción' };
        res.status(500).json(errorResponse);
    }
});

// Helper functions
async function getAccessToken(code: string): Promise<SpotifyTokenResponse> {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
        }).toString(),
    });

    if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
    }

    return await response.json() as SpotifyTokenResponse;
}

async function refreshAccessToken(): Promise<boolean> {
    if (!state.refreshToken) return false;

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(CLIENT_ID! + ':' + CLIENT_SECRET!).toString('base64'),
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: state.refreshToken,
            }).toString(),
        });

        if (!response.ok) {
            throw new Error(`Refresh token failed: ${response.status}`);
        }

        const tokenData: SpotifyTokenResponse = await response.json();
        state.accessToken = tokenData.access_token;
        state.tokenExpiration = Date.now() + (tokenData.expires_in * 1000);

        console.log('🔄 Token renovado exitosamente');
        return true;

    } catch (error) {
        console.error('❌ Error renovando token:', error);
        return false;
    }
}

async function ensureValidToken(): Promise<boolean> {
    if (!state.accessToken) return false;

    // If token expires in less than 5 minutes, refresh it
    if (state.tokenExpiration && Date.now() > (state.tokenExpiration - 300000)) {
        console.log('🔄 Token próximo a expirar, renovando...');
        await refreshAccessToken();
    }

    return true;
}

async function getCurrentTrackStatus(): Promise<SpotifyCurrentlyPlaying | null> {
    const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: {
            'Authorization': `Bearer ${state.accessToken!}`,
        },
    });

    if (response.status === 204) return null;
    return await response.json() as SpotifyCurrentlyPlaying;
}

async function getBPMData(track: SpotifyTrack): Promise<SpotifyAudioFeatures> {
    // Check if this is a new track
    const trackChanged = state.lastTrackId !== track.id;
    
    if (trackChanged) {
        console.log(`🎵 Nueva canción detectada: "${track.name}" por ${track.artists[0].name}`);
        state.lastTrackId = track.id;
        
        // Check cache first
        if (state.bpmCache.has(track.id)) {
            console.log(`💾 BPM encontrado en cache para: ${track.name}`);
            return state.bpmCache.get(track.id)!;
        }
        
        // Fetch from GetSongBPM API
        if (GETSONGBPM_API_KEY) {
            console.log(`🌐 Consultando GetSongBPM API para: ${track.name}`);
            const bpmData = await fetchFromGetSongBPM(track.name, track.artists[0].name);
            if (bpmData) {
                // Cache the result
                state.bpmCache.set(track.id, bpmData);
                return bpmData;
            }
        }
        
        // Fallback to smart defaults
        console.log(`⚠️ Usando valores por defecto para: ${track.name}`);
        const fallbackData = createFallbackAudioFeatures(track);
        state.bpmCache.set(track.id, fallbackData);
        return fallbackData;
    }
    
    // Same track, return cached data
    return state.bpmCache.get(track.id) || createFallbackAudioFeatures(track);
}

async function fetchFromGetSongBPM(songTitle: string, artistName: string): Promise<SpotifyAudioFeatures | null> {
    try {
        const query = encodeURIComponent(`${songTitle} ${artistName}`);
        const url = `https://api.getsongbpm.com/search/?api_key=${GETSONGBPM_API_KEY}&type=song&lookup=${query}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`GetSongBPM API error: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        if (data.search && data.search.length > 0) {
            const song = data.search[0]; // Take first result
            
            console.log(`✅ BPM obtenido de GetSongBPM: ${song.song.tempo}BPM para "${songTitle}"`);
            
            return {
                danceability: song.song.danceability || 0.5,
                energy: song.song.energy || 0.5,
                tempo: parseInt(song.song.tempo) || 120,
                valence: song.song.valence || 0.5,
                acousticness: song.song.acousticness || 0.3,
                instrumentalness: song.song.instrumentalness || 0.1,
                liveness: song.song.liveness || 0.2,
                loudness: song.song.loudness || -10,
                speechiness: song.song.speechiness || 0.1,
                id: `getsongbpm_${song.song.id}`
            };
        } else {
            console.warn(`No se encontró "${songTitle}" en GetSongBPM`);
            return null;
        }
        
    } catch (error) {
        console.warn('Error consultando GetSongBPM API:', error);
        return null;
    }
}

function createFallbackAudioFeatures(track: SpotifyTrack): SpotifyAudioFeatures {
    return {
        danceability: 0.5,
        energy: 0.5,
        tempo: 120,
        valence: 0.5,
        acousticness: 0.3,
        instrumentalness: 0.1,
        liveness: 0.2,
        loudness: -10,
        speechiness: 0.1,
        id: `fallback_${track.id}`
    };
}

// Start server
app.listen(PORT, () => {
    console.log('🚀 Servidor iniciado en http://127.0.0.1:' + PORT);
    console.log('📱 Para conectar Spotify: http://127.0.0.1:' + PORT + '/auth');
    console.log('🎥 URL para OBS: http://127.0.0.1:' + PORT + '/');
    console.log('ℹ️  Página de información: http://127.0.0.1:' + PORT + '/about');
    console.log('');
    console.log('💡 También puedes usar: http://localhost:' + PORT + '/');
    
    if (!GETSONGBPM_API_KEY) {
        console.warn('⚠️ AVISO: No se configuró GETSONGBPM_API_KEY - usando valores por defecto para BPM');
        console.log('💡 Obtén tu API key gratuita en: https://getsongbpm.com/api');
    } else {
        console.log('🎵 GetSongBPM API configurado - obteniendo tempos reales');
    }
});