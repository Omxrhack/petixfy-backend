const test = require('node:test');
const assert = require('node:assert/strict');

const { createPetSchema, updatePetSchema } = require('../src/schemas/pet.schema');
const { createAppointmentSchema } = require('../src/schemas/appointment.schema');
const { createProductSchema, createStoreOrderSchema, vetStoreOrderStatusSchema } = require('../src/schemas/store.schema');
const { createTrackingSessionSchema } = require('../src/schemas/tracking.schema');
const { onboardingSchema } = require('../src/schemas/auth.schema');

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

test('vet store schemas validate products and order status', () => {
  const product = createProductSchema.parse({
    name: 'Guantes veterinarios',
    category: 'insumos',
    price: '129.90',
    stock: '12',
    active: true,
  });
  assert.equal(product.price, 129.9);
  assert.equal(product.stock, 12);

  assert.equal(vetStoreOrderStatusSchema.safeParse({ status: 'confirmed' }).success, true);
  assert.equal(vetStoreOrderStatusSchema.safeParse({ status: 'refunded' }).success, false);
});

test('client onboarding schema accepts operational, store and social data', () => {
  const parsed = onboardingSchema.parse({
    role: 'client',
    full_name: 'Omar Bermejo',
    phone: '+525512345678',
    avatar_url: '',
    profile_social: {
      bio: 'Tutor de dos mascotas.',
      location: 'CDMX',
    },
    client_details: {
      address_text: 'Av. Siempre Viva 123, CDMX',
      address_notes: 'Casa azul',
      latitude: 19.4,
      longitude: -99.1,
      default_contact_name: 'Omar',
      default_contact_phone: '+525512345678',
      preferred_fulfillment_method: 'delivery',
      delivery_notes: 'Tocar timbre',
      emergency_notes: 'El perro se pone nervioso con motos.',
    },
    pet_profile: {
      name: 'Nala',
      species: 'Perro',
      breed: 'Labrador',
      sex: 'female',
      weight_kg: '24.5',
      is_neutered: true,
      vaccines_up_to_date: 'yes',
      temperament: 'friendly',
      allergies: 'Polen',
      chronic_conditions: '',
      current_medications: '',
    },
  });

  assert.equal(parsed.role, 'client');
  assert.equal(parsed.pet_profile.weight_kg, 24.5);
});

test('vet onboarding schema accepts coverage, store and finance data', () => {
  const parsed = onboardingSchema.parse({
    role: 'vet',
    full_name: 'Dra. Luna',
    phone: '+525500001111',
    avatar_url: 'https://example.com/avatar.jpg',
    profile_social: {
      bio: 'MVZ de medicina preventiva.',
      location: 'Roma Norte',
    },
    vet_details: {
      cedula: '1234567',
      university: 'UNAM',
      experience_years: '4-7',
      base_address_text: 'Consultorio Roma Norte',
      base_latitude: 19.41,
      base_longitude: -99.16,
      coverage_radius_km: '15',
      has_vehicle: true,
    },
    vet_services: {
      specialty: 'medicina_general',
      offered_services: ['Consulta general', 'Vacunación'],
      accepts_emergencies: true,
      home_visit_enabled: true,
      telemedicine_enabled: false,
      emergency_radius_km: '10',
      schedule_json: {
        label: 'Lunes a viernes 9-18',
        base_location_note: 'Entrada lateral',
      },
    },
    vet_finances: {
      account_holder: 'Luna Veterinaria',
      clabe: '123456789012345678',
      bank_name: 'BBVA',
      rfc: 'LUV900101AB1',
    },
    vet_store_settings: {
      store_display_name: 'Vetgo Roma',
      pickup_address_text: 'Consultorio Roma Norte',
      pickup_instructions: 'Recoger en recepción',
      store_contact_phone: '+525500001111',
      offers_delivery: true,
      offers_pickup: true,
    },
  });

  assert.equal(parsed.role, 'vet');
  assert.equal(parsed.vet_services.emergency_radius_km, 10);
});
