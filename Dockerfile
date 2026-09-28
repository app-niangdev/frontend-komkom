# ---- Étape 1 : build Angular ----
FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build -- --configuration production

# ---- Étape 2 : image d'exécution Nginx ----
FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Adapter "vex" au nom réel du dossier généré sous dist/
# (confirmé dans komkom-cicd : build Angular produit dist/frontend, sans sous-dossier "browser")
COPY --from=build /app/dist/frontend /usr/share/nginx/html

EXPOSE 80
