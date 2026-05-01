/**
 * Nombre de archivo seguro para rutas en Storage (ASCII, sin path traversal).
 */
function safeBasename(originalname) {
  const base = (originalname || 'photo').split(/[/\\]/).pop() || 'photo';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return (cleaned || 'photo').slice(0, 120);
}

module.exports = { safeBasename };
