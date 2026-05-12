# Vetgo Backend

Backend Express + Supabase para Vetgo.

## Requisitos

- Node.js 20+
- Proyecto Supabase con las migraciones aplicadas
- Variables de entorno en `.env`

## Variables

```env
PORT=3000
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
```

## Ejecutar

```sh
npm install
npm run dev
```

Healthcheck:

```sh
curl http://localhost:3000/health
```

Docs:

```text
http://localhost:3000/api-docs
```

## Seeders Sin Docker

Si no usas Docker, no ejecutes `supabase start` ni `supabase db reset`.

1. Abre Supabase Dashboard.
2. Entra a SQL Editor.
3. Copia el contenido de `supabase/seed.sql`.
4. Ejecuta el SQL en una base de desarrollo.

Usuarios demo: todos usan `VetgoDemo123!`.

## Flujos MVP Cubiertos

- Auth, onboarding y perfiles.
- CRUD de mascotas, foto y expediente.
- Citas cliente/veterinario, cancelacion y completado.
- SOS, asignacion veterinaria, tracking y cierre.
- Feed social con follows, posts, likes, comentarios, reposts, busqueda, reportes y reviews.
- Tienda como catalogo MVP.

## Tests

```sh
npm test
```
