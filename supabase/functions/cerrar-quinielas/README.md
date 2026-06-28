# Edge Function: `cerrar-quinielas`

Ejecutada automáticamente cada minuto por `pg_cron`.

## Qué hace

1. Busca quinielas con `estado = 'abierta'`, `cierre_automatico = true` y `primer_partido <= now()`.
2. Para cada una cuenta los jugadores pagados.
3. Si `jugadores_pagados >= jugadores_minimos` → cambia estado a `cerrada`.
4. Si `jugadores_pagados < jugadores_minimos` → cambia estado a `anulada` y reembolsa a cada jugador en su wallet con un movimiento tipo `reembolso`.

## Setup (una sola vez)

### 1. Activar extensiones en Supabase Dashboard

```
Dashboard → Database → Extensions → pg_cron  ✓
Dashboard → Database → Extensions → pg_net   ✓
```

### 2. Hacer deploy de la función

```bash
supabase functions deploy cerrar-quinielas --no-verify-jwt
```

### 3. Configurar el secret

```bash
# Generar un secret seguro
openssl rand -hex 32

# Subirlo a Supabase
supabase secrets set CRON_SECRET=tu_secret_aqui
```

### 4. Ejecutar la migración SQL

En Supabase Dashboard → SQL Editor, ejecuta el archivo
`supabase/migrations/20260628_pg_cron_cierre.sql` **reemplazando**:

- `TU_PROJECT_REF` → el ref de tu proyecto (ej: `abcdefghijklmnop`)
- `TU_CRON_SECRET` → el mismo valor que pusiste en `CRON_SECRET`

### 5. Verificar que el cron corre

```sql
-- Ver jobs activos
SELECT * FROM cron.job;

-- Ver historial de ejecuciones
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

## Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | Inyectada automáticamente por Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Inyectada automáticamente por Supabase |
| `CRON_SECRET` | Secret propio para autenticar el cron job |

## Prueba manual

```bash
curl -X POST https://TU_PROJECT_REF.supabase.co/functions/v1/cerrar-quinielas \
  -H "Authorization: Bearer TU_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Respuesta esperada:
```json
{
  "cerradas": 1,
  "resultados": [
    {
      "id": "uuid...",
      "titulo": "Jornada 15",
      "accion": "cerrada",
      "jugadores": 8
    }
  ]
}
```
