class SpotifyPlayer {
    constructor() {
        this.isPlaying = false;
        this.currentTrack = null;
        this.tempo = 120;
        this.energy = 0.5;
        this.particles = [];
        this.visualizerBars = [];
        this.isAuthenticated = false;
        this.progressInterval = null;
        this.currentProgress = 0;
        this.trackDuration = 0;
        this.hasGetSongBPM = false;

        // Sistema de partículas optimizado
        this.particleGenerationSpeed = 1200;
        this.particleGenerationInterval = null;
        this.currentParticleSpeed = '6s';
        this.maxParticles = 8;
        this.particleCount = 0;

        this.initializeElements();
        this.createVisualizer();
        this.initializeParticleSystem();
        this.startSpotifyPolling();
    }

    initializeElements() {
        this.player = document.getElementById('player');
        this.particlesContainer = document.getElementById('particles');
        this.albumCover = document.getElementById('albumCover');
        this.songTitle = document.getElementById('songTitle');
        this.artistName = document.getElementById('artistName');
        this.playBtn = document.getElementById('playBtn');
        this.visualizer = document.getElementById('visualizer');
        this.progressBar = document.getElementById('progressBar');
        this.authMessage = document.getElementById('authMessage');

        // Event listeners
        this.playBtn.addEventListener('click', () => this.togglePlayPause());
        document.getElementById('prevBtn').addEventListener('click', () => this.previousTrack());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextTrack());
    }

    createVisualizer() {
        for (let i = 0; i < 7; i++) {
            const bar = document.createElement('div');
            bar.className = 'audio-bar';
            bar.style.height = '8px';
            this.visualizer.appendChild(bar);
            this.visualizerBars.push(bar);
        }
    }

    initializeParticleSystem() {
        this.particleEmojis = ['🌸', '🌺', '🌼', '🌻', '🌹'];
        this.particlesContainer = document.getElementById('particles');
        this.startParticleGeneration();
    }

    createSingleParticle() {
        if (this.particleCount >= this.maxParticles) return;
        
        const particle = document.createElement('div');
        particle.className = `particle ${this.isPlaying ? 'playing' : 'paused'}`;
        particle.style.animationName = 'fallDown';
        particle.style.animationDuration = this.currentParticleSpeed;
        particle.style.animationTimingFunction = 'linear';
        particle.style.animationFillMode = 'forwards';

        const randomEmoji = this.particleEmojis[Math.floor(Math.random() * this.particleEmojis.length)];
        particle.textContent = randomEmoji;
        particle.style.left = Math.random() * 100 + '%';

        this.particlesContainer.appendChild(particle);
        this.particles.push(particle);
        this.particleCount++;

        const duration = parseFloat(this.currentParticleSpeed) * 1000;
        setTimeout(() => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
                const index = this.particles.indexOf(particle);
                if (index > -1) {
                    this.particles.splice(index, 1);
                    this.particleCount--;
                }
            }
        }, duration);

        return particle;
    }

    startParticleGeneration() {
        if (this.particleGenerationInterval) {
            clearInterval(this.particleGenerationInterval);
        }

        this.particleGenerationInterval = setInterval(() => {
            // Generar múltiples partículas simultáneas basado en BPM
            const particlesToGenerate = Math.min(3, Math.ceil(this.tempo / 60));
            for (let i = 0; i < particlesToGenerate; i++) {
                setTimeout(() => this.createSingleParticle(), i * 100);
            }
        }, this.particleGenerationSpeed);
    }

    updateParticleGeneration(isPlaying, tempo = 120, energy = 0.5) {
        this.tempo = tempo;
        this.energy = energy;
        
        if (!isPlaying) {
            // Pausar todas las partículas existentes
            this.particles.forEach(particle => {
                particle.classList.remove('playing');
                particle.classList.add('paused');
            });
            
            // Sin GetSongBPM: velocidad constante moderada
            this.currentParticleSpeed = this.hasGetSongBPM ? '8s' : '6s';
            this.particleGenerationSpeed = 2000;
            this.maxParticles = 4;
        } else {
            // Reanudar todas las partículas existentes
            this.particles.forEach(particle => {
                particle.classList.remove('paused');
                particle.classList.add('playing');
            });
            
            if (this.hasGetSongBPM) {
                // Con BPM real: velocidad dinámica
                const speedFactor = Math.max(0.3, Math.min(1.2, tempo / 120));
                const energyBoost = energy * 0.5;
                this.currentParticleSpeed = Math.max(2, 6 - speedFactor - energyBoost) + 's';
                this.particleGenerationSpeed = Math.max(300, 1200 - (tempo * 5));
                this.maxParticles = Math.min(12, 6 + Math.floor(tempo / 20));
            } else {
                // Sin GetSongBPM: velocidad constante uniforme
                this.currentParticleSpeed = '4s';
                this.particleGenerationSpeed = 800;
                this.maxParticles = 6;
            }
        }
        
        console.log(`🌸 ${isPlaying ? 'Playing' : 'Paused'} | Speed: ${this.currentParticleSpeed} | Gen: ${this.particleGenerationSpeed}ms | Max: ${this.maxParticles} | BPM: ${this.hasGetSongBPM ? tempo : 'Default'}`);
        this.startParticleGeneration();
    }

    animateVisualizer() {
        if (!this.isPlaying) {
            this.visualizerBars.forEach(bar => {
                bar.style.height = '8px';
            });
            return;
        }

        this.visualizerBars.forEach((bar) => {
            const baseHeight = 8;
            const maxHeight = 40;
            const randomMultiplier = 0.5 + Math.random() * 0.5;
            const energyMultiplier = this.energy * randomMultiplier;
            const height = baseHeight + (maxHeight - baseHeight) * energyMultiplier;

            bar.style.height = height + 'px';
        });

        const interval = Math.max(50, 200 - (this.energy * 150));
        setTimeout(() => this.animateVisualizer(), interval);
    }

    pauseParticles() {
        this.updateParticleGeneration(false, this.tempo, this.energy);
    }

    resumeParticles() {
        this.updateParticleGeneration(true, this.tempo, this.energy);
    }

    updateProgress() {
        if (this.isPlaying && this.trackDuration > 0) {
            this.currentProgress += 1000;
            const percentage = (this.currentProgress / this.trackDuration) * 100;
            this.progressBar.style.width = Math.min(percentage, 100) + '%';
        }
    }

    startSpotifyPolling() {
        setInterval(async () => {
            try {
                const response = await fetch('/api/current-track');
                const data = await response.json();

                if (data.error) {
                    if (data.authUrl) {
                        this.showAuthMessage();
                    }
                    return;
                }

                this.hideAuthMessage();
                this.updateFromSpotifyData(data);

            } catch (error) {
                console.error('Error obteniendo datos de Spotify:', error);
                this.songTitle.textContent = 'Error de conexión';
                this.artistName.textContent = 'Reintentando...';
            }
        }, 3000);

        this.progressInterval = setInterval(() => {
            this.updateProgress();
        }, 1000);
    }

    updateFromSpotifyData(data) {
        if (!data.track) {
            this.songTitle.textContent = 'No hay música';
            this.artistName.textContent = 'Reproduce algo en Spotify';
            this.isPlaying = false;
            this.playBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
            this.progressBar.style.width = '0%';

            // Estado sin música
            this.pauseParticles();
            return;
        }

        this.songTitle.textContent = data.track.name;
        this.artistName.textContent = data.track.artist;

        if (data.track.albumCover) {
            this.albumCover.src = data.track.albumCover;
        }

        const wasPlaying = this.isPlaying;
        this.isPlaying = data.isPlaying;

        // Actualizar icono del botón play/pause
        if (this.isPlaying) {
            this.playBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>';
        } else {
            this.playBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
        }

        this.currentProgress = data.track.progress || 0;
        this.trackDuration = data.track.duration || 0;
        const percentage = this.trackDuration > 0 ? (this.currentProgress / this.trackDuration) * 100 : 0;
        this.progressBar.style.width = percentage + '%';

        if (data.audioFeatures) {
            this.tempo = data.audioFeatures.tempo || 120;
            this.energy = data.audioFeatures.energy || 0.5;
            this.hasGetSongBPM = data.audioFeatures.id && !data.audioFeatures.id.startsWith('fallback_');
            
            console.log(`🎵 ${this.hasGetSongBPM ? 'Real' : 'Default'} BPM: ${this.tempo} | Energy: ${this.energy.toFixed(2)} | Song: ${data.track.name}`);
        } else {
            // Sin datos de audio, usar valores por defecto
            this.tempo = 120;
            this.energy = 0.5;
            this.hasGetSongBPM = false;
        }
        
        // Actualizar partículas con los nuevos datos
        this.updateParticleGeneration(this.isPlaying, this.tempo, this.energy);

        if (this.isPlaying !== wasPlaying) {
            this.player.className = this.isPlaying ? 'player-container playing' : 'player-container paused';

            if (this.isPlaying) {
                this.resumeParticles();
                this.animateVisualizer();
            } else {
                this.pauseParticles();
            }
        } else if (this.isPlaying) {
            // Misma canción reproduciéndose, pero puede haber cambiado BPM data
            this.updateParticleGeneration(true, this.tempo, this.energy);
        }
    }

    showAuthMessage() {
        this.authMessage.style.display = 'block';
        this.songTitle.textContent = 'Autenticación requerida';
        this.artistName.textContent = 'Haz click en "Conectar Spotify"';
    }

    hideAuthMessage() {
        this.authMessage.style.display = 'none';
        this.isAuthenticated = true;
    }

    async togglePlayPause() {
        try {
            const response = await fetch('/api/play-pause', {
                method: 'POST'
            });

            if (!response.ok) {
                console.error('Error controlando reproducción');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    async previousTrack() {
        try {
            const response = await fetch('/api/previous', {
                method: 'POST'
            });

            if (!response.ok) {
                console.error('Error cambiando canción');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    async nextTrack() {
        try {
            const response = await fetch('/api/next', {
                method: 'POST'
            });

            if (!response.ok) {
                console.error('Error cambiando canción');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const player = new SpotifyPlayer();
});