import { redirect } from 'next/navigation';

export default function AdminPage() {
  // Redirect to dashboard (in production, check auth first)
  redirect('/admin/dashboard');
}
