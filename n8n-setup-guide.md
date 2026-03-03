# INNPET — Guía de configuración del workflow en n8n

## Resumen

Tu workflow de n8n recibe mensajes del chat de INNPET, consulta y modifica pacientes en Supabase, y responde al veterinario.

## Datos de conexión

```
Supabase URL:  https://czagpuxrnucbpjcprwvs.supabase.co
Supabase Key:  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6YWdwdXhybnVjYnBqY3Byd3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDI3MjYsImV4cCI6MjA4ODExODcyNn0.K2o4QhbmEYzyoqRi0_qxKhPSbHI9MCVbvmmcPQ69dkw
REST API Base: https://czagpuxrnucbpjcprwvs.supabase.co/rest/v1/clinical_records
```

---

## Estructura del workflow

```
Webhook Trigger  -->  AI Agent (con Tools)  -->  Respond to Webhook
```

---

## Paso 1: Webhook Trigger

1. Agregar nodo **Webhook**
2. Método HTTP: **POST**
3. Respuesta: seleccionar **"Using Respond to Webhook Node"**
4. Copiar la **URL de producción** (es la que ya está cargada en INNPET)

El webhook recibe este JSON del frontend:

```json
{
  "message": "texto del veterinario",
  "sessionId": "session_xxxxx",
  "action": "sendMessage"
}
```

---

## Paso 2: AI Agent

1. Agregar nodo **AI Agent** conectado al Webhook
2. En **Prompt** / **Input**: usar la expresión `{{ $json.body.message }}`
3. Conectar un **modelo** (OpenAI GPT-4, Claude, etc.)
4. Agregar **Window Buffer Memory** con sessionKey = `{{ $json.body.sessionId }}`

### System Prompt

Copiar y pegar este texto en el campo "System Message" del AI Agent:

```
Sos INNPET, un asistente veterinario profesional. Tu trabajo es ayudar a veterinarios a gestionar pacientes.

REGLAS:
1. Respondé siempre en español.
2. Sé preciso con la información médica.
3. Si no estás seguro, avisalo.
4. Usá markdown: negritas, listas, tablas cuando sea útil.

CAPACIDADES:
- Consultar pacientes: usá la herramienta "buscar_pacientes"
- Crear paciente nuevo: recopilá los datos paso a paso (nombre, especie, raza, edad, peso, sexo, color, microchip, datos del propietario, alergias, condiciones) y luego usá "crear_paciente"
- Actualizar paciente: usá "actualizar_paciente"
- Agregar visita: recopilá motivo, diagnóstico, tratamiento, prescripciones, signos vitales, y usá "agregar_visita"

Cuando crees o modifiques un paciente, confirmá la operación al veterinario con los datos guardados.
```

---

## Paso 3: Tools (herramientas del AI Agent)

Agregar estas como sub-nodos de tipo **HTTP Request Tool** dentro del AI Agent.

### Tool 1: buscar_pacientes

| Campo | Valor |
|---|---|
| Nombre | `buscar_pacientes` |
| Descripción | `Busca pacientes en la base de datos. Puede listar todos o filtrar por nombre, especie o ID. Devuelve historial médico completo.` |
| Método | GET |
| URL | `https://czagpuxrnucbpjcprwvs.supabase.co/rest/v1/clinical_records` |

**Headers** (agregar estos dos):

| Header | Valor |
|---|---|
| `apikey` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6YWdwdXhybnVjYnBqY3Byd3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDI3MjYsImV4cCI6MjA4ODExODcyNn0.K2o4QhbmEYzyoqRi0_qxKhPSbHI9MCVbvmmcPQ69dkw` |
| `Authorization` | `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6YWdwdXhybnVjYnBqY3Byd3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDI3MjYsImV4cCI6MjA4ODExODcyNn0.K2o4QhbmEYzyoqRi0_qxKhPSbHI9MCVbvmmcPQ69dkw` |

**Query Parameters** (opcionales, el agente decide cuáles usar):
- `name` = `eq.{nombre}` para filtrar por nombre
- `id` = `eq.{id}` para buscar por ID
- `species` = `eq.{especie}` para filtrar por especie

---

### Tool 2: crear_paciente

| Campo | Valor |
|---|---|
| Nombre | `crear_paciente` |
| Descripción | `Crea un nuevo paciente. Requiere: id (formato PAT-XXX), name, species, breed, age, weight, sex, color, microchip, owner (objeto JSON con name, phone, email, address), allergies (array), conditions (array).` |
| Método | POST |
| URL | `https://czagpuxrnucbpjcprwvs.supabase.co/rest/v1/clinical_records` |

**Headers** (agregar estos cuatro):

| Header | Valor |
|---|---|
| `apikey` | *(mismo valor que arriba)* |
| `Authorization` | `Bearer *(mismo valor que arriba)*` |
| `Content-Type` | `application/json` |
| `Prefer` | `return=representation` |

**Body**: JSON con los campos del paciente.

---

### Tool 3: actualizar_paciente

| Campo | Valor |
|---|---|
| Nombre | `actualizar_paciente` |
| Descripción | `Actualiza datos de un paciente existente. Necesita el ID del paciente en la URL.` |
| Método | PATCH |
| URL | `https://czagpuxrnucbpjcprwvs.supabase.co/rest/v1/clinical_records?id=eq.{patient_id}` |

**Headers**: los mismos 4 que crear_paciente.

**Body**: JSON solo con los campos a actualizar.

---

### Tool 4: agregar_visita (Code Tool)

Agregar como sub-nodo de tipo **Code Tool**:

| Campo | Valor |
|---|---|
| Nombre | `agregar_visita` |
| Descripción | `Agrega una visita al historial de un paciente. Necesita: patient_id, date, reason, diagnosis, treatment, prescriptions (array), vitals (objeto con temperature, heartRate, respRate, weight), vet.` |

Código JavaScript:

```javascript
const supabaseUrl = 'https://czagpuxrnucbpjcprwvs.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6YWdwdXhybnVjYnBqY3Byd3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDI3MjYsImV4cCI6MjA4ODExODcyNn0.K2o4QhbmEYzyoqRi0_qxKhPSbHI9MCVbvmmcPQ69dkw';
const patientId = $input.patient_id;

// Obtener visitas actuales
const getRes = await fetch(
  `${supabaseUrl}/rest/v1/clinical_records?id=eq.${patientId}&select=visits`,
  { headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` } }
);
const [record] = await getRes.json();
const visits = record.visits || [];

// Agregar la nueva visita al inicio
visits.unshift({
  date: $input.date || new Date().toISOString().split('T')[0],
  reason: $input.reason,
  diagnosis: $input.diagnosis,
  treatment: $input.treatment,
  prescriptions: $input.prescriptions || [],
  vitals: $input.vitals || {},
  vet: $input.vet || 'No especificado'
});

// Guardar
const patchRes = await fetch(
  `${supabaseUrl}/rest/v1/clinical_records?id=eq.${patientId}`,
  {
    method: 'PATCH',
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ visits })
  }
);
return await patchRes.json();
```

---

## Paso 4: Respond to Webhook

1. Agregar nodo **Respond to Webhook** conectado al AI Agent
2. Tipo de respuesta: **JSON**
3. Body:

```json
{
  "output": "{{ $json.output }}"
}
```

---

## Ejemplo de conversación

```
Veterinario: "Cuáles son las alergias de Max?"

  --> n8n usa buscar_pacientes: GET /clinical_records?name=eq.Max
  --> Obtiene el registro completo

INNPET: "Max (Golden Retriever, 5 años) tiene las siguientes alergias:
         - Pollo
         - Ciertos antibióticos (amoxicilina)
         Tener en cuenta al momento de recetar."
```

```
Veterinario: "Quiero agregar un nuevo paciente"

INNPET: "Vamos a crear el registro. ¿Cuál es el nombre de la mascota?"
Veterinario: "Firulais"
INNPET: "¿Qué especie es?"
Veterinario: "Perro"
  ... (sigue recopilando datos) ...

  --> n8n usa crear_paciente: POST /clinical_records con todos los datos

INNPET: "Registro creado: Firulais (PAT-007), Perro Labrador, 2 años."
```
