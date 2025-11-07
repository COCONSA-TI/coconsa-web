-- Crear tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  full_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice para búsquedas rápidas por email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Habilitar RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura con service role
CREATE POLICY "Service role can read users" ON users
  FOR SELECT
  USING (true);

-- Política para permitir escritura con service role
CREATE POLICY "Service role can insert users" ON users
  FOR INSERT
  WITH CHECK (true);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Insertar un usuario de ejemplo (contraseña: password123)
-- NOTA: Genera tu propio hash de contraseña usando bcrypt
-- Puedes usar: https://bcrypt-generator.com/
INSERT INTO users (email, password_hash, role, full_name)
VALUES (
  'admin@coconsa.com',
  '$2a$12$URM73cNUk6/0mfO8.7tExePYqNVFuuD3WKQCJYy9RZ5I94nakxusq',
  'admin',
  'Admin User'
) ON CONFLICT (email) DO NOTHING;

-- Para generar un hash de contraseña, puedes usar este código en Node.js:
-- const bcrypt = require('bcryptjs');
-- const hash = await bcrypt.hash('tu_contraseña', 10);
-- console.log(hash);
