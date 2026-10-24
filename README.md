> Estado actual: interfaz migrada a SARA v0.5.0 Prisma Glass OS (Zafiro, Cian, Coral), preservando el acceso público anónimo a mapa, horarios, profesores y materias. La cuenta central SARA es estrictamente opcional. Ver [registro del despliegue](docs/DEPLOYMENT-2026-09-24.md).

# Student Hub - Producción Standalone

Este repositorio contiene la versión migrada e independiente de **Student Hub** lista para ser desplegada en producción.

---

## [UI] Diseño e Identidad Visual — SARA v0.5.0 Prisma Glass OS

La interfaz web de todos los servicios públicos (`services/landing` y `services/student-hub`) ha sido migrada al lenguaje de diseño **SARA v0.5.0 Prisma Glass OS**:

- **Paleta Cromática Oficial:**
  - Primario Zafiro (`#1A367A` / `--sara-sapphire-500` / `--sara-sapphire-700`)
  - Acento Cian Óptico (`#159AB3` / `--sara-cyan-500` / `--sara-cyan-600`)
  - Acento Coral Refracción (`#E65642` / `--sara-coral-600`)
  - Verde Institucional UdeC (`#0E6B47` / `--sara-udec-green`)
  - Banda Refractiva SARA Möbius: gradiente continuo Zafiro &rarr; Cian &rarr; Verde UdeC &rarr; Coral.
- **Tipografía Institucional:**
  - `Manrope` (Display / Títulos y Jerarquía Numérica)
  - `Inter` (Cuerpo de Lectura y Controles UI)
  - `JetBrains Mono` (Datos Académicos, Indicadores y Claves)
- **Glass OS & Caústicas de Luz:**
  - Dock superior y barra móvil flotante con `backdrop-filter: blur(20px)`, specular rim de 1px (`rgba(255, 255, 255, 0.4)` / `rgba(26, 54, 122, 0.14)`).
  - Superficies de lectura opacas y contrastadas para máxima legibilidad.
- **Iconografía Vectorial & Accesibilidad:**
  - Reemplazo total de emojis y caracteres ASCII operativos (`[•_•]`, `[o_o]`, `[⇄]`, flechas de texto) por vectores SVG limpios y SVGs oficiales de la marca SARA.
  - Objetivos táctiles mínimos de 44x44px en móviles (360px+), soporte de `env(safe-area-inset-bottom)`, navegación por teclado (`:focus-visible`), y soporte completo para preferencias de movimiento reducido (`prefers-reduced-motion`).
- **Acceso Público Académico Libre:**
  - Se mantiene íntegro el acceso anónimo y sin login a horarios, planos de campus, semestres, directores, docentes, asignaturas y fechas de evaluación.
  - La cuenta SARA es un servicio de ecosistema central opcional y no interfiere con la consulta académica pública.

---

## [SEC] Arquitectura y Aislamiento de Red

Por motivos de seguridad y cumplimiento del principio de menor privilegio:
- **Red Privada Interna:** Todos los microservicios (`auth-service`, `professors-service`, `academic-service`, `reference-service`, `cv-extractor-service`), la base de datos (`postgres`) y la capa de caché (`redis`) se ejecutan dentro de la red privada Docker `student-hub-network`.
- **Puertos del Host No Expuestos:** Ninguno de los servicios backend expone puertos hacia la interfaz externa del sistema anfitrión (`0.0.0.0`). Esto garantiza que los servicios no sean accesibles desde fuera de la red interna de contenedores.
- **Acceso Exclusivo por Nginx:** Únicamente el Reverse Proxy `proxy` expone el puerto público `80` (o el configurado en `HOST_PORT`), redirigiendo las solicitudes hacia la aplicación frontend de `student-hub`.
- **Filtro de Rutas:** Se han eliminado las pasarelas hacia otros servicios como `admin-hub-frontend` y `project-hub`.

---

## [DEPLOY] Despliegue en Producción

### Requisitos Previos
- Docker Engine `>= 20.10`
- Docker Compose v2 (`docker compose`)

### Instrucciones de Inicio

1. **Configurar variables de entorno:**
   ```bash
   cp .env.production .env
   ```

2. **Iniciar el clúster de contenedores:**
   ```bash
   docker compose --env-file .env up --build -d
   ```

3. **Verificar el estado del clúster:**
   ```bash
   docker compose ps
   ```

4. **Acceso al portal:**
   Abre un navegador web e ingresa a `http://localhost/` (o la IP del servidor).

---

## [TREE] Estructura del Proyecto

```text
.
├── docker-compose.yml       # Orquestación de producción con red aislada
├── .env.production          # Variables de entorno por defecto
├── data/                    # Archivos YAML de datos de referencia (facultades, carreras, delegaciones)
├── scripts/                 # Scripts SQL de inicialización DDL y datos pre-cargados
├── packages/                # Definiciones y tipos compartidos
└── services/
    ├── student-hub/         # Frontend web en Astro (SSR)
    ├── landing/             # Portal web estático y chatbot FimeBot (Pedro)
    ├── fimebot-backend/     # Backend de FimeBot con conocimiento verificado
    ├── auth-service/        # Microservicio de autenticación de estudiantes
    ├── professors-service/  # Microservicio de consulta de información docente
    ├── academic-service/    # Microservicio de materias, grupos y horarios
    ├── reference-service/   # Microservicio de estructuras institucionales
    ├── cv-extractor-service/# Servicio de procesamiento de semblanzas
    └── proxy/               # Reverse proxy Nginx aislado
```

---

## [TEST] Verificación de Aislamiento de Red

Para verificar que la base de datos y microservicios no son alcanzables desde el host exterior:
```bash
# Intento de conexión directa a PostgreSQL (debe fallar/ser rechazado)
nc -zv 127.0.0.1 5432

# Intento de conexión directa a Microservicio de Profesores (debe fallar)
curl http://localhost:6771/professors
```
Ambas pruebas confirmarán que únicamente el puerto 80 del proxy responde peticiones legítimas para Student Hub.


## FimeBot local y mapa sin claves

FimeBot usa respuestas revisadas de la FIME **Universidad de Colima**, incluyendo
las cinco licenciaturas publicadas por la facultad. La base editable es
`services/fimebot-backend/context/knowledge.json`; cada entrada conserva fuentes
y fecha de verificación. Las fechas, costos y convocatorias deben consultarse en
los enlaces oficiales. Para ampliar la base: verificar el contenido oficial,
actualizar entradas y palabras clave, ejecutar las pruebas del backend y recrear
el servicio. Consulta también `services/fimebot-backend/README.md`.

El bot combina respuestas factuales deterministas con orientación de carreras
mediante `qwen-local`, alojado en el servidor, sin API de pago. El directorio
`context/people.json` conserva nombres, grados y fuentes de docentes y autoridades.
Las consultas abiertas de orientación recuperan fichas de carreras y el modelo
selecciona evidencia y afinidades; la salida se valida y se presenta con redacción
controlada. Las consultas ajenas se redirigen, no se envían instrucciones del
visitante al modelo y se ignoran respuestas previas enviadas por el navegador.
Si la inferencia falla, se devuelve el contenido verificado de las fichas.

El backend se conecta al gateway local por la red Docker externa `llm-apps`.
En `.env.production`, `LLM_BASE_URL`, `LLM_MODEL` y `LLM_API_KEY` configuran esa
conexión privada; no se exponen al navegador. `FIMEBOT_HYBRID_ENABLED=false`
desactiva la inferencia. Para otra instalación, crear la red `llm-apps` y conectar
un gateway compatible, o mantener el modo determinista sin gateway.

El mapa utiliza Leaflet (BSD-2-Clause), cartografía OpenStreetMap con atribución,
y los polígonos del campus existentes. El selector **Plano del campus** usa el
GeoJSON local y funciona sin imágenes externas. El servicio público de teselas de
OSM no requiere clave, tiene una política de uso y no garantiza disponibilidad:
https://operations.osmfoundation.org/policies/tiles/. No se descargan teselas en
masa ni para uso sin conexión. Si aumenta mucho el tráfico, usar un proveedor
compatible o alojar teselas propias. El plano no es una imagen satelital.

La edición pública mediante `?edit=true` está deshabilitada y las rutas de escritura
responden 403: la selección de grupo no autentica a un administrador. Para mantener
edificios/aulas, editar `services/student-hub/public/campus.geojson` por el proceso
de despliegue. No sobrescribir ese archivo al desplegar cambios solo de interfaz.

Despliegue de estos componentes, conservando base de datos y servicios restantes:

```bash
docker compose --env-file .env.production build landing fimebot-backend student-hub proxy
docker compose --env-file .env.production up -d --no-deps landing fimebot-backend student-hub proxy
```

El límite del proxy es 10 solicitudes/segundo con ráfaga de 30 y cuerpo de 64 KiB
para `/api/chat`. Detrás del túnel puede ser compartido entre visitantes; no se
confía en una cabecera de IP enviada por el cliente para eludirlo.
