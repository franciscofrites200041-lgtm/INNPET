# Guía de Configuración — n8n + VetAssist AI

## Resumen

Tu workflow de n8n actúa como el cerebro del asistente veterinario. Recibe mensajes del chat, consulta/modifica la base de datos de Supabase, y responde al veterinario.

## Arquitectura del Workflow

```
Webhook Trigger → AI Agent (con Tools) → Respond to Webhook
```

## Paso 1: Crear el Webhook Trigger

1. Agrega un nodo **Webhook**
2. Método: `POST`
3. Respuesta: **"Using Respond to Webhook Node"**
4. Copia la **URL de producción** del webhook — la vas a pegar en la configuración de VetAssist AI

El webhook recibe:
```json
{
  "message": "¿Cuáles son las alergias de Max?",
  "sessionId": "session_123456",
  "action": "sendMessage"
}
```

## Paso 2: Configurar el AI Agent

1. Agrega un nodo **AI Agent** después del Webhook
2. **Input**: `{{ $json.body.message }}`
3. **Model**: Conecta tu modelo (OpenAI GPT-4, Claude, etc.)
4. **Memory**: Agrega un nodo **Window Buffer Memory** con `sessionKey` = `{{ $json.body.sessionId }}`

### System Prompt (copiar y pegar):

```
Eres VetAssist AI, un asistente veterinario inteligente y profesional. Tu rol es ayudar a veterinarios a consultar, crear y modificar historiales clínicos de pacientes (perros y gatos).

INSTRUCCIONES:
1. Cuando el veterinario pregunte sobre un paciente, usa la herramienta "buscar_pacientes" para obtener la información.
2. Cuando pida crear un nuevo registro, hazle las preguntas necesarias paso a paso:
   - Nombre de la mascota
   - Especie (Perro/Gato)
   - Raza
   - Edad
   - Peso
   - Sexo
   - Color
   - Microchip (opcional)
   - Datos del propietario: nombre, teléfono, email, dirección
   - Alergias conocidas
   - Condiciones preexistentes
   Una vez que tengas toda la información, usa la herramienta "crear_paciente" para guardar el registro.

3. Cuando pida agregar una visita a un paciente existente, pregunta:
   - Motivo de la visita
   - Diagnóstico
   - Tratamiento
   - Prescripciones
   - Signos vitales (temperatura, frecuencia cardíaca, frecuencia respiratoria, peso)
   Luego usa la herramienta "agregar_visita" para actualizar el registro.

4. Cuando pida modificar datos de un paciente, usa "actualizar_paciente".

5. Responde siempre en español.
6. Sé preciso con la información médica.
7. Si no estás seguro de algo, avísalo.

FORMATO DE RESPUESTA:
- Usa markdown para formatear respuestas (negritas, listas, etc.)
- Para datos clínicos, muestra la información de forma organizada
```

## Paso 3: Configurar las Tools (Herramientas)

Agrega estas herramientas HTTP Request como sub-nodos del AI Agent:

### Tool 1: buscar_pacientes
- **Tipo**: HTTP Request Tool
- **Nombre**: `buscar_pacientes`
- **Descripción**: `Busca pacientes en la base de datos. Puede buscar todos o filtrar por nombre, especie o ID. Devuelve la información completa del paciente incluyendo historial médico, vacunas, alergias y visitas.`
- **Método**: `GET`
- **URL**: `https://<TU-PROJECT-REF>.supabase.co/rest/v1/clinical_records`
- **Headers**:
  - `apikey`: `<TU-ANON-KEY>`
  - `Authorization`: `Bearer <TU-ANON-KEY>`
- **Query Parameters** (opcionales, que el agente puede usar):
  - `name`: `eq.{nombre}` para buscar por nombre
  - `id`: `eq.{id}` para buscar por ID
  - `species`: `eq.{especie}` para filtrar por especie

### Tool 2: crear_paciente
- **Tipo**: HTTP Request Tool
- **Nombre**: `crear_paciente`
- **Descripción**: `Crea un nuevo registro de paciente en la base de datos. Requiere: id (formato PAT-XXX), name, species, breed, age, weight, sex, color, microchip, owner (objeto con name, phone, email, address), allergies (array), conditions (array).`
- **Método**: `POST`
- **URL**: `https://<TU-PROJECT-REF>.supabase.co/rest/v1/clinical_records`
- **Headers**:
  - `apikey`: `<TU-ANON-KEY>`
  - `Authorization`: `Bearer <TU-ANON-KEY>`
  - `Content-Type`: `application/json`
  - `Prefer`: `return=representation`
- **Body**: JSON con los campos del paciente

### Tool 3: actualizar_paciente
- **Tipo**: HTTP Request Tool
- **Nombre**: `actualizar_paciente`
- **Descripción**: `Actualiza los datos de un paciente existente. Se usa para modificar información general, agregar alergias, condiciones, etc.`
- **Método**: `PATCH`
- **URL**: `https://<TU-PROJECT-REF>.supabase.co/rest/v1/clinical_records?id=eq.{patient_id}`
- **Headers**:
  - `apikey`: `<TU-ANON-KEY>`
  - `Authorization`: `Bearer <TU-ANON-KEY>`
  - `Content-Type`: `application/json`
  - `Prefer`: `return=representation`
- **Body**: JSON con los campos a actualizar

### Tool 4: agregar_visita
- **Tipo**: Code Tool (JavaScript)
- **Nombre**: `agregar_visita`
- **Descripción**: `Agrega una nueva visita al historial de un paciente existente. Requiere el ID del paciente y los datos de la visita.`

```javascript
// Primero obtener el registro actual
const patientId = $input.patient_id;
const supabaseUrl = '<TU-PROJECT-REF>.supabase.co';
const anonKey = '<TU-ANON-KEY>';

// GET current record
const getResponse = await fetch(
  `https://${supabaseUrl}/rest/v1/clinical_records?id=eq.${patientId}&select=visits`,
  {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`
    }
  }
);
const [record] = await getResponse.json();
const visits = record.visits || [];

// Add new visit
visits.unshift({
  date: $input.date || new Date().toISOString().split('T')[0],
  reason: $input.reason,
  diagnosis: $input.diagnosis,
  treatment: $input.treatment,
  prescriptions: $input.prescriptions || [],
  vitals: $input.vitals || {},
  vet: $input.vet || 'No especificado'
});

// PATCH update
const patchResponse = await fetch(
  `https://${supabaseUrl}/rest/v1/clinical_records?id=eq.${patientId}`,
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

return await patchResponse.json();
```

## Paso 4: Respond to Webhook

1. Agrega un nodo **Respond to Webhook** al final
2. Respuesta: **JSON**
3. Body:
```json
{
  "output": "{{ $json.output }}"
}
```

## Ejemplo de Conversación

```
Vet: "¿Cuáles son las alergias de Max?"
→ n8n busca en Supabase: GET /clinical_records?name=eq.Max
→ Bot: "Max (Golden Retriever) tiene las siguientes alergias registradas:
       - **Pollo**
       - **Ciertos antibióticos (amoxicilina)**
       ⚠️ Tener en cuenta al recetar medicamentos."

Vet: "Quiero crear un registro para un nuevo paciente"
→ Bot: "¡Claro! Vamos paso a paso. ¿Cuál es el nombre de la mascota?"
→ (continúa la conversación recopilando datos...)
→ n8n inserta en Supabase: POST /clinical_records
→ Bot: "✅ Registro creado exitosamente para **Firulais** (PAT-007)"
```
