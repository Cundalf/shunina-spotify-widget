# 🎵 Spotify OBS Widget

Un widget elegante para mostrar tu música de Spotify en OBS Studio, construido con **Bun** y **TypeScript**.

## ✨ Características

- 🎮 **Perfecto para streaming**: Diseñado específicamente para OBS Studio
- 🎨 **Interfaz hermosa**: Tema rosado con animaciones fluidas
- 🎵 **Control completo**: Play/pause, anterior, siguiente
- 📊 **Visualizador de audio**: Barras animadas basadas en las características de la música
- 🌸 **Efectos visuales**: Partículas animadas que responden al tempo REAL de la música (BPM reales via GetSongBPM API)
- 🎵 **Cache inteligente**: Solo consulta BPM cuando cambia la canción, no en cada actualización
- ⚡ **Tecnología moderna**: Bun + TypeScript para máximo rendimiento

## 🚀 Instalación

### Prerrequisitos

1. **Bun**: [Instalar Bun](https://bun.sh/)
2. **Spotify Developer Account**: [Spotify for Developers](https://developer.spotify.com/)
3. **GetSongBPM API Key** (gratuita): [GetSongBPM API](https://getsongbpm.com/api)

### Configuración

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/tuusuario/spotify-obs-widget
   cd spotify-obs-widget
   ```

2. **Instalar dependencias**:
   ```bash
   bun install
   ```

3. **Configurar Spotify App**:
   - Ve a [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Crea una nueva aplicación
   - En la configuración de la app, añade `http://127.0.0.1:8080/callback` como Redirect URI
   - **Nota**: Usa `127.0.0.1` en lugar de `localhost` (Spotify a veces es estricto con esto)
   - Copia el `Client ID` y `Client Secret`

4. **Configurar GetSongBPM API** (para tempos reales):
   - Ve a [GetSongBPM API](https://getsongbpm.com/api)
   - Regístrate con tu email (gratis)
   - Copia tu API Key

5. **Configurar variables de entorno**:
   ```bash
   cp .env.example .env
   ```
   
   Edita el archivo `.env` con tus credenciales:
   ```env
   SPOTIFY_CLIENT_ID=tu_client_id_aqui
   SPOTIFY_CLIENT_SECRET=tu_client_secret_aqui
   GETSONGBPM_API_KEY=tu_getsongbpm_api_key_aqui
   PORT=8080
   ```

## 🎮 Uso

### Iniciar el servidor

```bash
# Desarrollo (con recarga automática)
bun run dev

# Producción
bun run start
```

### Configurar en OBS

1. Inicia el servidor
2. Ve a `http://127.0.0.1:8080/auth` para conectar tu cuenta de Spotify
3. En OBS Studio:
   - Añade una nueva fuente **"Browser Source"**
   - URL: `http://127.0.0.1:8080/` (o `http://localhost:8080/`)
   - Ancho: `540px`
   - Alto: `160px`
   - Marcar ✅ **"Shutdown source when not visible"**
   - Marcar ✅ **"Refresh browser when scene becomes active"**

## 🛠️ Scripts disponibles

```bash
bun run dev        # Servidor de desarrollo con recarga automática
bun run start      # Servidor de producción
bun run build      # Compilar para producción
bun run typecheck  # Verificar tipos de TypeScript
```

## 🎵 **GetSongBPM API Integration**

Este widget usa la **GetSongBPM API gratuita** para obtener datos reales de tempo y características musicales:

### **¿Cómo funciona?**
- **Solo consulta BPM cuando cambias de canción** - eficiente y rápido
- **Cache inteligente** - una vez obtenido el BPM, lo guarda en memoria
- **70+ millones de canciones** en la base de datos
- **Datos reales**: BPM, key, danceability, energy, etc.

### **Características que obtienes:**
- ✅ **Tempo real** (BPM exacto de la canción)
- ✅ **Danceability** (qué tan bailable es 0-1)
- ✅ **Energy** (nivel de energía 0-1) 
- ✅ **Key & Mode** (clave musical)
- ✅ **Valence** (qué tan positiva suena)

### **Registro GetSongBPM** (gratuito):
1. Ve a: https://getsongbpm.com/api
2. Regístrate con tu email
3. Copia tu API key
4. Añádela a tu `.env`
5. **Requisito**: Agregar link a GetSongBPM.com en tu proyecto (términos de uso)

### **Sin API key:**
- El widget **funciona perfectamente** sin API key
- Usa algoritmo inteligente basado en duración y tipo de canción
- Las animaciones siguen siendo dinámicas y bonitas

**¡Lo mejor de ambos mundos!** 🎶

## 🙏 Créditos

- **BPM Data**: Powered by [GetSongBPM.com](https://getsongbpm.com) - Free API for real-time music tempo and audio features
- **Spotify Integration**: Built using the Spotify Web API

