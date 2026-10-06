// src/app/page.tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirige automatiquement l'utilisateur qui arrive sur http://localhost:3001/ vers /login
  redirect('/login');
}