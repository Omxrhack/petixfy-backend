/**
 * Valida req.body con un esquema Zod antes del controlador.
 */

function validateSchema(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }
    req.body = parsed.data;
    return next();
  };
}

module.exports = { validateSchema };
