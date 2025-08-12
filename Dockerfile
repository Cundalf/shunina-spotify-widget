# Usa la imagen oficial de Bun
FROM oven/bun:1 as base
WORKDIR /app

# Instala dependencias
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copia el código fuente
COPY . .

# Compila la aplicación
RUN bun run build

# Configuración de producción
FROM oven/bun:1-slim
WORKDIR /app

# Copia solo los archivos necesarios
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/package.json ./package.json
# Copia public directamente del contexto de build
COPY public ./public

# Exponer puerto
EXPOSE 8080

# Comando de inicio
CMD ["bun", "run", "dist/server.js"]