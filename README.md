# ClassicArt Creator

Estudio web en español para crear imágenes, animar imágenes como video, diseñar personajes, clonar voces con autorización, sintetizar diálogo y sincronizar labios.

## Funciones implementadas

- Generación de imágenes y edición guiada por imagen de referencia mediante fal.ai.
- Video desde texto e imagen mediante modelos Seedance de fal.ai.
- Seguimiento asíncrono de trabajos, control de estado y descarga del resultado.
- Síntesis de voz y clonación de voz mediante ElevenLabs, con confirmación explícita de consentimiento.
- Sincronización de labios mediante fal.ai, con consentimiento requerido.
- Persistencia de historial y metadatos en Cloudflare D1, y archivos en R2.
- Biblioteca privada por propietario para resultados, personajes, proyectos y voces.
- Respuestas de API y validación de archivos con límites de tipo y tamaño.

La aplicación y las integraciones están implementadas. La generación real requiere credenciales activas en fal.ai y ElevenLabs; la persistencia requiere los bindings D1 (`DB`) y R2 (`MEDIA`); el uso desplegado requiere la capa de identidad configurada por el alojamiento. No se simulan resultados cuando falta una dependencia.

## Entorno local

- Node.js 22.13 o posterior
- pnpm 11.25.0
- Copia `.env.example` a `.env` y configura las claves localmente. No envíes claves por chat ni las publiques en GitHub.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

Las migraciones de D1 están en `drizzle/`. Antes de desplegar, aplícalas en el entorno correspondiente y vincula los bindings `DB` y `MEDIA`.

## Variables privadas

```dotenv
FAL_KEY=
FAL_IMAGE_MODEL=fal-ai/nano-banana-2
FAL_IMAGE_EDIT_MODEL=fal-ai/nano-banana-2/edit
FAL_VIDEO_MODEL=bytedance/seedance-2.0/fast/text-to-video
FAL_VIDEO_IMAGE_MODEL=bytedance/seedance-2.0/fast/image-to-video
FAL_LIPSYNC_MODEL=fal-ai/sync-lipsync/v2
ELEVENLABS_API_KEY=
ELEVENLABS_DEFAULT_VOICE_ID=
```

Configura estos valores como secretos del alojamiento en producción. El navegador no recibe las claves de proveedor.

## Seguridad y límites

- Los endpoints autenticados asocian generaciones, voces y archivos al propietario.
- En despliegue, las rutas fallan de forma cerrada si no reciben identidad del host. La vista previa local usa una identidad local de desarrollo.
- Clonar voz y sincronizar rostro requieren aceptación explícita de autorización.
- Los archivos de referencia y resultados tienen límites de tamaño; el almacenamiento requiere D1 y R2 disponibles.
- Los proveedores pueden cobrar por solicitud. Las pruebas automáticas usan respuestas simuladas y no llaman a servicios de pago.
