const { z } = require('zod');

const storeOrderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(99),
});

const createStoreOrderSchema = z
  .object({
    fulfillment_method: z.enum(['delivery', 'pickup_contact']),
    items: z.array(storeOrderItemSchema).min(1).max(30),
    delivery_address_text: z.string().trim().max(500).optional().nullable(),
    contact_name: z.string().trim().max(160).optional().nullable(),
    contact_phone: z.string().trim().max(80).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.fulfillment_method === 'delivery' && !value.delivery_address_text?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['delivery_address_text'],
        message: 'delivery_address_text is required for delivery orders',
      });
    }

    if (value.fulfillment_method === 'pickup_contact' && !value.contact_phone?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contact_phone'],
        message: 'contact_phone is required for pickup/contact orders',
      });
    }
  });

module.exports = { createStoreOrderSchema };
