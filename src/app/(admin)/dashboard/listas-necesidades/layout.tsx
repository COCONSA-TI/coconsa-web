import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Listas de Necesidades | COCONSA',
  description: 'Gestión de listas de necesidades para reembolsos y anticipos',
};

export default function NeedsListsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
