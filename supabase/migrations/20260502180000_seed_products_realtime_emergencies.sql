-- Seed catalog products + enable Realtime replication for emergencies (vet subscriptions).
-- All string literals are ASCII-only so the migration file stays valid UTF-8 on any editor/OS.

-- ---------------------------------------------------------------------------
-- Products (demo inventory)
-- ---------------------------------------------------------------------------
INSERT INTO public.products (name, description, category, price, stock)
VALUES
  ('Croquetas premium adulto', 'Alimento balanceado para perros adultos, bolsa 15 kg.', 'alimento', 549.00, 42),
  ('Pienso gato adulto', 'Receta salmon y arroz, bolsa 8 kg.', 'alimento', 389.00, 28),
  ('Snack dental perro', 'Barras para higiene oral, paquete 12 unidades.', 'snacks', 129.00, 80),
  ('Arena aglutinante', 'Arena sanitizada aroma neutro, bolsa 10 kg.', 'higiene', 199.00, 55),
  ('Shampoo hipoalergenico', 'Para bano frecuente en pieles sensibles, 500 ml.', 'higiene', 165.00, 36),
  ('Arnes reflectante M', 'Arnes acolchado talla mediana, varios colores.', 'accesorios', 249.00, 22),
  ('Antiparasitario spot-on', 'Perros medianos 10-20 kg, pipeta mensual.', 'salud', 189.00, 60),
  ('Vitaminas articulaciones', 'Suplemento glucosamina condroitina, 60 tabletas.', 'salud', 279.00, 18);

-- ---------------------------------------------------------------------------
-- Realtime: emergencies visible to assigned vet via postgres_changes
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergencies;
