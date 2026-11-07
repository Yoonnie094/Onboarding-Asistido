# CER Analytics

Aplicación web responsive para el acceso inicial y la futura configuración de fundos de CER Analytics. Esta primera fase contiene Next.js App Router, Supabase Auth y el esquema base con acceso de solo lectura a fundos/membresías asignados.

## Requisitos locales

- Node.js 20.9 o posterior (el entorno de desarrollo usado para esta fase tiene Node.js 26.13.0).
- npm 10 o posterior.
- Un proyecto Supabase para probar autenticación y datos reales.

## Ejecutar localmente

1. Instala dependencias con `npm ci`.
2. Copia `.env.example` como `.env.local` y completa la URL y la clave publicable de Supabase (ver la sección siguiente).
3. Ejecuta `npm run dev` y abre `http://localhost:3000`.
4. Ejecuta `npm run lint`, `npm run typecheck` y `npm run build` antes de publicar.

Sin variables Supabase, las páginas de acceso y el estado de configuración siguen disponibles, pero registro, inicio de sesión y la ruta privada no pueden conectarse a un backend real.

## Conectar Supabase

### Proyecto nuevo

1. Crea un proyecto en Supabase y espera a que la base esté disponible.
2. En el panel de proyecto, copia el **Project URL** y la **Publishable key** (no una clave `service_role`/secret).
3. Completa en `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
   ```

4. En SQL Editor, revisa y ejecuta `supabase/migrations/20261106000100_foundation.sql`.
5. En Authentication → URL Configuration, agrega `http://localhost:3000/auth/callback` a los Redirect URLs. Configura el Site URL según el entorno.
6. Define si Supabase exigirá confirmación de correo y configura la entrega de emails. La app admite el flujo de confirmación al callback implementado.

### Proyecto existente

Antes de aplicar la migración, revisa si ya existen `public.profiles`, `public.farms`, `public.farm_memberships`, policies o triggers con estos nombres. La migración está versionada para la base de CER Analytics y no es una herramienta de reconciliación de esquemas; aplícala primero en un entorno de staging o adapta el esquema existente mediante una migración revisada. No elimines tablas ni desactives RLS para resolver conflictos.

La migración crea los perfiles al registrar usuarios, habilita RLS y concede lectura únicamente del perfil propio, membresías propias y fundos con membresía activa. No concede escritura de fundos o membresías ni decide qué privilegios implica cada etiqueta de rol. Por eso una cuenta recién registrada verá el estado vacío hasta que exista una asignación creada mediante un proceso aprobado.

Los archivos de variables locales (`.env.local`) no deben subirse a Git. `.env.example` solo contiene nombres de variables y se puede compartir.

## GitHub y Vercel

El proyecto se prepara para GitHub, pero no se configuró remoto porque no se proporcionó una URL de repositorio. Crea un repositorio vacío y conecta su URL:

```powershell
git remote add origin <URL-del-repositorio>
git branch -M main
git add .
git commit -m "Start CER Analytics foundation"
git push -u origin main
```

En Vercel, importa ese repositorio y añade `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en los entornos Development, Preview y Production que se usarán. Después del despliegue, agrega la URL de producción y los dominios Preview que correspondan a los Redirect URLs de Supabase, con `/auth/callback`. Vercel detecta Next.js y utiliza el `package-lock.json` de npm.

No se requiere una clave privilegiada para esta fase. No configures una variable `NEXT_PUBLIC_*` con una clave secreta. La separación de datos depende de RLS en la base de datos, no de esconder botones en el frontend.

## Esquema y alcance de la fase

- Migración inicial: `profiles`, `farms`, `farm_memberships`, índice de consulta y policies RLS.
- `farm_memberships.role` conserva un texto de rol sin catálogo ni privilegios definidos.
- Sin políticas de escritura: la creación de fundos, gestión de miembros y asignaciones espera la aprobación de permisos de CER.
- No se implementan importaciones, mapas, invitaciones ni reglas agronómicas en esta fase.
- No hay aún un runner de pruebas automatizadas; cuando se conecte Supabase, se debe comprobar Auth y aislamiento con dos usuarios y dos fundos de prueba.

## Herramientas revisadas

Node.js, npm y Git están instalados. No se encontraron Supabase CLI, Vercel CLI, Docker ni cliente `psql` en el PATH. La migración puede aplicarse desde SQL Editor; para versionar y aplicar migraciones desde CLI, sigue la [guía oficial de Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started). Para publicar desde GitHub, consulta [Deploying Git Repositories with Vercel](https://vercel.com/docs/git). El proyecto no incluye datos de demostración.

La integración SSR usa `@supabase/ssr` 0.12.7, el helper oficial documentado por Supabase para sesiones en cookies. La documentación del paquete todavía lo etiqueta como beta; está fijado a una versión exacta y debe revisarse al actualizar, porque su API puede cambiar.
