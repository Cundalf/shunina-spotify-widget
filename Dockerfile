# Usa la imagen oficial de Bun
FROM oven/bun:1 as base
WORKDIR /app

# Debug: Lista archivos en el contexto
RUN ls -la /

# Instala dependencias
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copia el código fuente
COPY . .

# Debug: Lista lo que se copió
RUN ls -la ./
RUN ls -la ./public/ || echo "public directory not found"

# Compila la aplicación
RUN bun run build

# Configuración de producción
FROM oven/bun:1-slim
WORKDIR /app

# Copia solo los archivos necesarios
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/public ./public

# Exponer puerto
EXPOSE 8080

# Comando de inicio
CMD ["bun", "run", "dist/server.js"]