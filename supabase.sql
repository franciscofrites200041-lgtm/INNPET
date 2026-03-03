-- ============================================
-- VetAssist AI — Supabase Migration
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Create the clinical_records table
CREATE TABLE IF NOT EXISTS clinical_records (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  breed TEXT DEFAULT '',
  age TEXT DEFAULT '',
  weight TEXT DEFAULT '',
  sex TEXT DEFAULT '',
  color TEXT DEFAULT '',
  microchip TEXT DEFAULT '',
  owner JSONB DEFAULT '{}',
  vaccinations JSONB DEFAULT '[]',
  allergies JSONB DEFAULT '[]',
  conditions JSONB DEFAULT '[]',
  visits JSONB DEFAULT '[]',
  lab_results JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clinical_records_updated_at ON clinical_records;
CREATE TRIGGER clinical_records_updated_at
  BEFORE UPDATE ON clinical_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Enable Row Level Security (public access for MVP)
ALTER TABLE clinical_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON clinical_records
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON clinical_records
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON clinical_records
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete" ON clinical_records
  FOR DELETE USING (true);

-- 4. Seed data — 6 clinical records (3 dogs, 3 cats)

INSERT INTO clinical_records (id, name, species, breed, age, weight, sex, color, microchip, owner, vaccinations, allergies, conditions, visits, lab_results)
VALUES
(
  'PAT-001', 'Max', 'Perro', 'Golden Retriever', '5 años', '32 kg', 'Macho', 'Dorado', '985112345678901',
  '{"name":"Carlos Mendoza","phone":"+54 11 5555-1234","email":"carlos.mendoza@email.com","address":"Av. Libertador 1250, Buenos Aires"}',
  '[{"vaccine":"Séxtuple","date":"2025-03-15","nextDue":"2026-03-15","vet":"Dra. García"},{"vaccine":"Antirrábica","date":"2025-03-15","nextDue":"2026-03-15","vet":"Dra. García"},{"vaccine":"Bordetella","date":"2025-06-10","nextDue":"2026-06-10","vet":"Dr. López"}]',
  '["Pollo","Ciertos antibióticos (amoxicilina)"]',
  '["Displasia de cadera leve","Dermatitis alérgica estacional"]',
  '[{"date":"2026-01-20","reason":"Control de rutina","diagnosis":"Buen estado general. Leve sobrepeso.","treatment":"Dieta reducida en calorías. Ejercicio moderado diario.","prescriptions":["Condroitín sulfato 500mg - 1 diaria por 30 días"],"vitals":{"temperature":"38.5°C","heartRate":"90 bpm","respRate":"18 rpm","weight":"32 kg"},"vet":"Dra. García"},{"date":"2025-11-05","reason":"Dermatitis recurrente","diagnosis":"Dermatitis alérgica. Lesiones eritematosas en abdomen.","treatment":"Baños medicados con clorhexidina 2x/semana. Antihistamínico oral.","prescriptions":["Cetirizina 10mg - 1 diaria por 14 días","Shampoo clorhexidina 2%"],"vitals":{"temperature":"38.7°C","heartRate":"95 bpm","respRate":"20 rpm","weight":"33.1 kg"},"vet":"Dra. García"}]',
  '[{"date":"2026-01-20","type":"Hemograma completo","results":{"GR":"6.8 x10⁶/µL (normal)","GB":"10.2 x10³/µL (normal)","Hematocrito":"45% (normal)","Plaquetas":"280 x10³/µL (normal)"}}]'
),
(
  'PAT-002', 'Luna', 'Gato', 'Siamés', '3 años', '4.2 kg', 'Hembra (esterilizada)', 'Seal point', '985112345678902',
  '{"name":"María Fernández","phone":"+54 11 5555-5678","email":"maria.fernandez@email.com","address":"Calle Florida 820, Buenos Aires"}',
  '[{"vaccine":"Triple felina","date":"2025-05-20","nextDue":"2026-05-20","vet":"Dr. López"},{"vaccine":"Antirrábica","date":"2025-05-20","nextDue":"2026-05-20","vet":"Dr. López"}]',
  '[]',
  '["Gingivitis leve"]',
  '[{"date":"2026-02-10","reason":"Inapetencia y letargia","diagnosis":"Infección urinaria (cistitis). Cristales de estruvita en orina.","treatment":"Antibiótico oral. Dieta urinaria especial. Aumentar ingesta de agua.","prescriptions":["Enrofloxacina 25mg - 1 cada 12h por 10 días","Dieta Hills c/d Multicare"],"vitals":{"temperature":"39.2°C","heartRate":"180 bpm","respRate":"28 rpm","weight":"4.0 kg"},"vet":"Dr. López"},{"date":"2025-08-15","reason":"Limpieza dental","diagnosis":"Gingivitis grado I. Placa leve en premolares.","treatment":"Profilaxis dental bajo anestesia general. Aplicación de flúor.","prescriptions":["Meloxicam 0.1mg/kg - 1 diaria por 3 días post-procedimiento"],"vitals":{"temperature":"38.8°C","heartRate":"170 bpm","respRate":"25 rpm","weight":"4.2 kg"},"vet":"Dra. García"}]',
  '[{"date":"2026-02-10","type":"Urianálisis","results":{"pH":"7.8 (elevado)","Densidad":"1.035","Cristales":"Estruvita (+)","Bacterias":"Moderadas","Leucocitos":"15-20/campo (elevado)"}}]'
),
(
  'PAT-003', 'Rocky', 'Perro', 'Bulldog Francés', '2 años', '12.5 kg', 'Macho', 'Atigrado', '985112345678903',
  '{"name":"Alejandro Ruiz","phone":"+54 11 5555-9012","email":"alejandro.ruiz@email.com","address":"Av. Corrientes 3450, Buenos Aires"}',
  '[{"vaccine":"Séxtuple","date":"2025-09-01","nextDue":"2026-09-01","vet":"Dra. García"},{"vaccine":"Antirrábica","date":"2025-09-01","nextDue":"2026-09-01","vet":"Dra. García"},{"vaccine":"Giardia","date":"2025-09-15","nextDue":"2026-09-15","vet":"Dra. García"}]',
  '["Granos (trigo, maíz)"]',
  '["Síndrome braquicefálico","Otitis crónica bilateral"]',
  '[{"date":"2026-02-28","reason":"Dificultad respiratoria","diagnosis":"Exacerbación síndrome braquicefálico. Estenosis de narinas moderada.","treatment":"Antiinflamatorio. Evitar ejercicio intenso y calor. Evaluar cirugía correctiva.","prescriptions":["Prednisolona 5mg - 1 cada 12h por 5 días","Omeprazol 10mg - 1 diaria por 10 días"],"vitals":{"temperature":"39.0°C","heartRate":"120 bpm","respRate":"35 rpm","weight":"12.5 kg"},"vet":"Dra. García"},{"date":"2025-12-10","reason":"Otitis bilateral","diagnosis":"Otitis externa por Malassezia. Ambos oídos afectados.","treatment":"Limpieza ótica diaria. Gotas antimicóticas.","prescriptions":["Surolan gotas óticas - 5 gotas c/oído cada 12h por 14 días","Limpiador ótico Epi-Otic"],"vitals":{"temperature":"38.6°C","heartRate":"110 bpm","respRate":"22 rpm","weight":"12.3 kg"},"vet":"Dr. López"}]',
  '[{"date":"2026-02-28","type":"Radiografía torácica","results":{"Hallazgo":"Paladar blando elongado. Tráquea hipoplásica leve.","Conclusión":"Compatible con síndrome braquicefálico. Se recomienda valoración quirúrgica."}}]'
),
(
  'PAT-004', 'Michi', 'Gato', 'Persa', '7 años', '5.8 kg', 'Macho (castrado)', 'Blanco', '985112345678904',
  '{"name":"Valentina Torres","phone":"+54 11 5555-3456","email":"valentina.torres@email.com","address":"Calle Defensa 1100, San Telmo, Buenos Aires"}',
  '[{"vaccine":"Triple felina","date":"2025-07-10","nextDue":"2026-07-10","vet":"Dr. López"},{"vaccine":"Antirrábica","date":"2025-07-10","nextDue":"2026-07-10","vet":"Dr. López"}]',
  '["Pescado crudo"]',
  '["Enfermedad renal crónica (estadio II IRIS)","Epífora crónica bilateral"]',
  '[{"date":"2026-02-15","reason":"Control renal trimestral","diagnosis":"ERC estadio II estable. Valores de creatinina sin cambios significativos.","treatment":"Continuar con dieta renal. Fluidoterapia subcutánea si hay deshidratación.","prescriptions":["Dieta Royal Canin Renal","Benazepril 2.5mg - 1 diaria","Fosfato de aluminio 500mg - 1 con cada comida"],"vitals":{"temperature":"38.3°C","heartRate":"160 bpm","respRate":"24 rpm","weight":"5.6 kg"},"vet":"Dr. López"},{"date":"2025-11-18","reason":"Control renal trimestral","diagnosis":"ERC estadio II. Leve aumento de fósforo sérico.","treatment":"Ajuste de quelante de fósforo. Mantener dieta renal estricta.","prescriptions":["Aumentar fosfato de aluminio a 2 con cada comida"],"vitals":{"temperature":"38.5°C","heartRate":"165 bpm","respRate":"22 rpm","weight":"5.8 kg"},"vet":"Dr. López"}]',
  '[{"date":"2026-02-15","type":"Panel renal completo","results":{"Creatinina":"2.1 mg/dL (leve elevación)","BUN":"38 mg/dL (elevado)","Fósforo":"5.2 mg/dL (normal-alto)","Potasio":"4.0 mEq/L (normal)","Proteína en orina":"Traza"}}]'
),
(
  'PAT-005', 'Canela', 'Perro', 'Mestizo', '8 años', '18 kg', 'Hembra (esterilizada)', 'Canela/Marrón', '985112345678905',
  '{"name":"Jorge Sánchez","phone":"+54 11 5555-7890","email":"jorge.sanchez@email.com","address":"Av. Rivadavia 5600, Buenos Aires"}',
  '[{"vaccine":"Séxtuple","date":"2025-04-22","nextDue":"2026-04-22","vet":"Dra. García"},{"vaccine":"Antirrábica","date":"2025-04-22","nextDue":"2026-04-22","vet":"Dra. García"}]',
  '[]',
  '["Hipotiroidismo","Artritis en miembros posteriores"]',
  '[{"date":"2026-01-08","reason":"Control de tiroides","diagnosis":"Hipotiroidismo controlado. T4 en rango terapéutico. Artritis estable.","treatment":"Continuar levotiroxina. Agregar suplemento articular.","prescriptions":["Levotiroxina 0.3mg - 1 cada 12h","Glucosamina/Condroitín - 1 diaria","Meloxicam 1.5mg - si hay dolor articular"],"vitals":{"temperature":"38.4°C","heartRate":"85 bpm","respRate":"16 rpm","weight":"18 kg"},"vet":"Dra. García"},{"date":"2025-10-02","reason":"Cojera miembro posterior derecho","diagnosis":"Artritis degenerativa. Inflamación en articulación de rodilla derecha.","treatment":"Antiinflamatorio. Reposo relativo. Fisioterapia.","prescriptions":["Meloxicam 1.5mg - 1 diaria por 7 días","Tramadol 50mg - si dolor intenso"],"vitals":{"temperature":"38.6°C","heartRate":"88 bpm","respRate":"18 rpm","weight":"18.3 kg"},"vet":"Dr. López"}]',
  '[{"date":"2026-01-08","type":"Panel tiroideo","results":{"T4 total":"2.8 µg/dL (normal bajo tto)","TSH":"0.35 ng/mL (normal)","Colesterol":"220 mg/dL (leve elevación)"}}]'
),
(
  'PAT-006', 'Simba', 'Gato', 'Maine Coon', '4 años', '7.5 kg', 'Macho (castrado)', 'Tabby marrón', '985112345678906',
  '{"name":"Laura Giménez","phone":"+54 11 5555-2345","email":"laura.gimenez@email.com","address":"Av. Santa Fe 2200, Buenos Aires"}',
  '[{"vaccine":"Triple felina","date":"2025-11-05","nextDue":"2026-11-05","vet":"Dra. García"},{"vaccine":"Antirrábica","date":"2025-11-05","nextDue":"2026-11-05","vet":"Dra. García"},{"vaccine":"Leucemia felina","date":"2025-11-05","nextDue":"2026-11-05","vet":"Dra. García"}]',
  '["Látex (guantes de exploración)"]',
  '["Cardiomiopatía hipertrófica (HCM) leve"]',
  '[{"date":"2026-02-20","reason":"Ecocardiograma de control","diagnosis":"HCM leve-moderada. Grosor septal de 6.2mm. Sin signos de ICC.","treatment":"Iniciar atenolol. Control eco en 6 meses.","prescriptions":["Atenolol 6.25mg - 1 cada 12h","Ácidos grasos omega-3 - 1 cápsula diaria"],"vitals":{"temperature":"38.4°C","heartRate":"200 bpm","respRate":"26 rpm","weight":"7.5 kg"},"vet":"Dra. García"},{"date":"2025-08-20","reason":"Ecocardiograma inicial (soplo detectado en control)","diagnosis":"HCM leve. Grosor septal de 5.8mm. Sin obstrucción dinámica.","treatment":"Monitoreo cada 6 meses. Evitar estrés excesivo.","prescriptions":[],"vitals":{"temperature":"38.6°C","heartRate":"195 bpm","respRate":"24 rpm","weight":"7.3 kg"},"vet":"Dra. García"}]',
  '[{"date":"2026-02-20","type":"ProBNP cardíaco","results":{"NT-proBNP":"180 pmol/L (leve elevación)","Troponina I":"0.08 ng/mL (normal)","Tiroxina T4":"2.5 µg/dL (normal)"}}]'
);
