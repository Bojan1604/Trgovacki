'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Prijava nije uspjela.');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Poslužitelj nije dostupan. Pokušajte ponovno.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input
        label="E-pošta"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        prefix={<Mail className="size-3.5" />}
        placeholder="ime@tvrtka.hr"
      />
      <Input
        label="Lozinka"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        prefix={<Lock className="size-3.5" />}
        placeholder="••••••••"
      />

      {error && (
        <p className="rounded-md bg-negative-soft px-2 py-1.5 text-sm text-negative">{error}</p>
      )}

      <Button type="submit" variant="primary" size="lg" block loading={loading} iconRight={<ArrowRight className="size-3.5" />}>
        Prijavi se
      </Button>
    </form>
  );
}
