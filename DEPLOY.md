# Deploy QPro en Vercel (PWA)

## 1. Variables de entorno en Vercel

Al conectar el repo en Vercel, agrega estas variables en **Settings → Environment Variables**:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
EXPO_PUBLIC_FOOTBALL_API_KEY=tu-football-api-key
```

## 2. Configuración del proyecto en Vercel

- **Framework Preset:** Other
- **Build Command:** `npx expo export --platform web`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

> Vercel detecta `vercel.json` automáticamente, no necesitas cambiar nada más.

## 3. Probar localmente antes de subir

```bash
npm install
npm run build:web
npx serve dist
```

## 4. Instalar como PWA

### En iPhone (Safari):
1. Abre la URL en Safari
2. Toca el ícono de compartir ↑
3. Selecciona "Añadir a pantalla de inicio"

### En Android (Chrome):
1. Abre la URL en Chrome
2. Toca los 3 puntos ⋮
3. Selecciona "Añadir a pantalla de inicio"
   
O Chrome mostrará automáticamente un banner de instalación.

## 5. Dominio personalizado (opcional)

En Vercel → Settings → Domains → agrega tu dominio.
