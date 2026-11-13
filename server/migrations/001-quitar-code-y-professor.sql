-- Quita "código" y "profesor" de los ramos.
--
-- Por qué: el formulario pedía dos datos que después no se usaban para nada.
-- El cálculo de notas solo necesita el nombre del ramo y sus evaluaciones, así
-- que pedirlos era fricción al crear un ramo a cambio de nada.
--
-- ⚠️ Borra datos y no se puede deshacer. Si en la base hay ramos con esos
--    campos escritos y los quieres guardar, míralos antes:
--
--      SELECT id, name, code, professor
--        FROM courses
--       WHERE code IS NOT NULL OR professor IS NOT NULL;
--
-- Se corre una sola vez contra cada base (local y producción). El IF EXISTS
-- hace que repetirla no falle.

ALTER TABLE courses DROP COLUMN IF EXISTS code;
ALTER TABLE courses DROP COLUMN IF EXISTS professor;
