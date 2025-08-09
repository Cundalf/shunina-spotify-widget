// server.js - Servidor Node.js para el widget de Spotify
const express = require('express');
const cors = require('cors');
const path = require('path');
const querystring = require('querystring');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Configuración de Spotify
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Variable para almacenar tokens (en producción usar una base de datos)
let accessToken = null;
let refreshToken = null;
let tokenExpiration = null;

// Ruta principal - sirve el widget
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ruta para iniciar autenticación con Spotify
app.get('/auth', (req, res) => {
    const scopes = [
        'user-read-currently-playing',
        'user-read-playback-state',
        'user-modify-playback-state'
    ];

    const authURL = 'https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: scopes.join(' '),
            redirect_uri: REDIRECT_URI,
            show_dialog: true
        });

    res.redirect(authURL);
});

// Callback de Spotify
app.get('/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.status(400).send('Error: No se recibió código de autorización');
    }

    try {
        const tokenData = await getAccessToken(code);
        accessToken = tokenData.access_token;
        refreshToken = tokenData.refresh_token;
        tokenExpiration = Date.now() + (tokenData.expires_in * 1000);

        console.log('✅ Autenticación exitosa con Spotify');
        res.send(`
            <html>
                <head><title>Spotify Conectado</title></head>
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

// API para obtener la canción actual
app.get('/api/current-track', async (req, res) => {
    try {
        await ensureValidToken();

        if (!accessToken) {
            return res.json({
                error: 'No autenticado',
                authUrl: `/auth`
            });
        }

        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (response.status === 204 || response.status === 404) {
            return res.json({
                isPlaying: false,
                message: 'No hay música reproduciéndose'
            });
        }

        if (!response.ok) {
            throw new Error(`Spotify API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.item) {
            return res.json({
                isPlaying: false,
                message: 'No hay información de la canción actual'
            });
        }

        // Obtener características de audio
        const audioFeatures = await getAudioFeatures(data.item.id);

        res.json({
            isPlaying: data.is_playing,
            track: {
                name: data.item.name,
                artist: data.item.artists[0].name,
                album: data.item.album.name,
                albumCover: data.item.album.images[0]?.url,
                id: data.item.id,
                duration: data.item.duration_ms,
                progress: data.progress_ms
            },
            audioFeatures: audioFeatures
        });

    } catch (error) {
        console.error('❌ Error obteniendo canción actual:', error);
        res.status(500).json({ error: 'Error obteniendo información de Spotify' });
    }
});

// API para controlar reproducción
app.post('/api/play-pause', async (req, res) => {
    try {
        await ensureValidToken();

        const currentTrack = await getCurrentTrackStatus();
        const endpoint = currentTrack?.is_playing ? 'pause' : 'play';

        const response = await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (response.ok || response.status === 204) {
            res.json({ success: true, action: endpoint });
        } else {
            throw new Error(`Error ${response.status}`);
        }

    } catch (error) {
        console.error('❌ Error controlando reproducción:', error);
        res.status(500).json({ error: 'Error controlando reproducción' });
    }
});

// API para canción anterior
app.post('/api/previous', async (req, res) => {
    try {
        await ensureValidToken();

        const response = await fetch('https://api.spotify.com/v1/me/player/previous', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (response.ok || response.status === 204) {
            res.json({ success: true });
        } else {
            throw new Error(`Error ${response.status}`);
        }

    } catch (error) {
        console.error('❌ Error canción anterior:', error);
        res.status(500).json({ error: 'Error cambiando canción' });
    }
});

// API para canción siguiente
app.post('/api/next', async (req, res) => {
    try {
        await ensureValidToken();

        const response = await fetch('https://api.spotify.com/v1/me/player/next', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (response.ok || response.status === 204) {
            res.json({ success: true });
        } else {
            throw new Error(`Error ${response.status}`);
        }

    } catch (error) {
        console.error('❌ Error canción siguiente:', error);
        res.status(500).json({ error: 'Error cambiando canción' });
    }
});

// Funciones auxiliares
async function getAccessToken(code) {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
        },
        body: querystring.stringify({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
        }),
    });

    if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
    }

    return await response.json();
}

async function refreshAccessToken() {
    if (!refreshToken) return false;

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
            },
            body: querystring.stringify({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }),
        });

        if (!response.ok) {
            throw new Error(`Refresh token failed: ${response.status}`);
        }

        const tokenData = await response.json();
        accessToken = tokenData.access_token;
        tokenExpiration = Date.now() + (tokenData.expires_in * 1000);

        console.log('🔄 Token renovado exitosamente');
        return true;

    } catch (error) {
        console.error('❌ Error renovando token:', error);
        return false;
    }
}

async function ensureValidToken() {
    if (!accessToken) return false;

    // Si el token expira en menos de 5 minutos, renovarlo
    if (tokenExpiration && Date.now() > (tokenExpiration - 300000)) {
        console.log('🔄 Token próximo a expirar, renovando...');
        await refreshAccessToken();
    }

    return true;
}

async function getCurrentTrackStatus() {
    const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (response.status === 204) return null;
    return await response.json();
}

async function getAudioFeatures(trackId) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            console.warn('No se pudieron obtener características de audio');
            return null;
        }

        return await response.json();

    } catch (error) {
        console.warn('Error obteniendo características de audio:', error);
        return null;
    }
}

// Iniciar servidor
app.listen(PORT, () => {
    console.log('🚀 Servidor iniciado en http://localhost:' + PORT);
    console.log('📱 Para conectar Spotify: http://localhost:' + PORT + '/auth');
    console.log('🎥 URL para OBS: http://localhost:' + PORT + '/');

    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error('❌ ERROR: Faltan variables de entorno SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET');
        console.log('💡 Crea un archivo .env con tus credenciales de Spotify');
    }
});