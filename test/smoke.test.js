const test = require('node:test');
const assert = require('node:assert/strict');

const { createPetSchema, updatePetSchema } = require('../src/schemas/pet.schema');
const { createAppointmentSchema } = require('../src/schemas/appointment.schema');
const { createStoreOrderSchema } = require('../src/schemas/store.schema');
const { createTrackingSessionSchema } = require('../src/schemas/tracking.schema');

test('pet schemas accept full medical payloads', () => {
  const created = createPetSchema.parse({
    name: 'Nala',
    species: 'Perro',
    breed: 'Labrador',
    weight_kg: '24.5',
    sex: 'hembra',
    is_neutered: true,
    vaccines_up_to_date: 'si',
    medical_notes: 'Alergia estacional leve',
    temperament: 'Tranquila',
  });

  assert.equal(created.weight_kg, 24.5);
  assert.equal(created.medical_notes, 'Alergia estacional leve');

  const updated = updatePetSchema.parse({ vaccines_up_to_date: 'parcial' });
  assert.equal(updated.vaccines_up_to_date, 'parcial');
});

test('appointment schema ignores client-controlled status', () => {
  const body = createAppointmentSchema.parse({
    pet_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    scheduled_at: new Date().toISOString(),
    status: 'completed',
  });

  assert.equal(body.status, undefined);
});

test('tracking schema requires exactly one target', () => {
  const ok = createTrackingSessionSchema.safeParse({
    appointment_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    vet_lat: 19.4,
    vet_lng: -99.1,
  });
  assert.equal(ok.success, true);

  const bad = createTrackingSessionSchema.safeParse({
    appointment_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    emergency_id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    vet_lat: 19.4,
    vet_lng: -99.1,
  });
  assert.equal(bad.success, false);
});

test('store checkout schema validates fulfillment requirements', () => {
  const delivery = createStoreOrderSchema.parse({
    fulfillment_method: 'delivery',
    delivery_address_text: 'Av. Siempre Viva 123',
    items: [{ product_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddd01', quantity: '2' }],
  });

  assert.equal(delivery.items[0].quantity, 2);

  const missingAddress = createStoreOrderSchema.safeParse({
    fulfillment_method: 'delivery',
    items: [{ product_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddd01', quantity: 1 }],
  });
  assert.equal(missingAddress.success, false);

  const pickup = createStoreOrderSchema.safeParse({
    fulfillment_method: 'pickup_contact',
    contact_phone: '+52 55 1234 5678',
    items: [{ product_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddd01', quantity: 1 }],
  });
  assert.equal(pickup.success, true);
});
