# ClassicArt Creator

Estudio creativo para preparar imágenes, video, personajes y voz desde una sola interfaz.

## Estado

La primera entrega contiene la interfaz del estudio, validación de solicitudes, puntos de integración de proveedores, modelo de datos inicial y soporte declarado para D1 y R2. La creación real de contenido y la sincronización de voz quedan desactivadas hasta configurar proveedores y credenciales. La aplicación lo informa en pantalla y no sustituye resultados falsos por generaciones reales.

## Entorno local

- Node.js 22.13 o posterior
- pnpm 11.25.0
- Copia `.env.example` a `.env` para configurar proveedores en local. No subas credenciales al repositorio.

Comandos principales:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm typecheck
pnpm db:generate
pnpm build
```

## Integraciones

Configura URL y clave privada para cada proveedor:

- `IMAGE_PROVIDER_BASE_URL` y `IMAGE_PROVIDER_API_KEY`
- `VIDEO_PROVIDER_BASE_URL` y `VIDEO_PROVIDER_API_KEY`
- `VOICE_PROVIDER_BASE_URL` y `VOICE_PROVIDER_API_KEY`

El proyecto separa los contratos de generación de la aplicación. Así se pueden integrar proveedores distintos por modalidad sin exponer credenciales al navegador.

## Datos y archivos

- D1 (`DB`) conserva proyectos, personajes, historial de generación y perfiles de voz.
- R2 (`MEDIA`) conserva archivos de imagen, video y audio; D1 guarda sus metadatos.
- Antes de ofrecer datos persistentes a varios usuarios, falta incorporar autenticación, autorización por propietario, carga segura y política de retención.
- La clonación o reproducción de una voz requiere consentimiento verificable de la persona titular antes de activar esa integración.

## Próximos pasos

1. Elegir proveedor para imagen, video y voz.
2. Configurar credenciales privadas y vincular D1/R2.
3. Completar autenticación, carga segura y control de acceso.
4. Conectar la generación asíncrona, revisión de resultados, exportación y sincronización de labios.
5. Validar con cuentas de prueba y límites de uso antes de abrir a usuarios.
