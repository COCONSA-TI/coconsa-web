-- Crear tabla para documentos adjuntos de órdenes
CREATE TABLE IF NOT EXISTS order_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_order_attachments_order_id ON order_attachments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_attachments_uploaded_by ON order_attachments(uploaded_by);

-- Comentarios
COMMENT ON TABLE order_attachments IS 'Documentos adjuntos a las órdenes de compra (evidencias, comprobantes)';
COMMENT ON COLUMN order_attachments.order_id IS 'ID de la orden de compra';
COMMENT ON COLUMN order_attachments.uploaded_by IS 'Usuario que subió el documento';
COMMENT ON COLUMN order_attachments.file_name IS 'Nombre original del archivo';
COMMENT ON COLUMN order_attachments.file_size IS 'Tamaño del archivo en bytes';
COMMENT ON COLUMN order_attachments.file_type IS 'Tipo MIME del archivo';
COMMENT ON COLUMN order_attachments.file_url IS 'URL pública del archivo en Supabase Storage';
COMMENT ON COLUMN order_attachments.storage_path IS 'Ruta del archivo en Supabase Storage';
COMMENT ON COLUMN order_attachments.description IS 'Descripción opcional del documento';
