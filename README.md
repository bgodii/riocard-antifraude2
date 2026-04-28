# Riocard Antifraude

Aplicacao React/Vite para monitoramento antifraude.

## Rodar com Docker Compose para demo

Este Docker de demo apenas serve o `dist` estatico com Nginx. Ele nao instala dependencias dentro do container.

```bash
npm install
npm run build
docker compose up --build
```

A aplicacao fica disponivel em:

```text
http://localhost:5173
```

Para rodar em segundo plano:

```bash
docker compose up --build -d
```

Para parar:

```bash
docker compose down
```
