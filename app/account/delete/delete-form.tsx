'use client';

import { useState, type FormEvent } from 'react';

export default function DeleteForm({ displayName }: { displayName: string }) {
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || confirmation !== 'УСТГАХ') return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteMyData', payload: { confirmation } }),
      });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error || 'Устгах хүсэлт амжилтгүй.');
      }
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Холболтоо шалгаад дахин оролдоно уу.');
    } finally {
      setBusy(false);
    }
  }

  if (done) return (
    <div role="status">
      <h2>Таны AJIL мэдээллийг устгалаа.</h2>
      <a href="/signout-with-chatgpt?return_to=%2F" target="_top">Бүртгэлээс гарах</a>
    </div>
  );

  return (
    <form onSubmit={submit}>
      <p>Нэвтэрсэн хэрэглэгч <strong>{displayName}</strong></p>
      <label>
        Баталгаажуулахын тулд УСТГАХ гэж бичнэ үү
        <input value={confirmation} onChange={event => setConfirmation(event.target.value)}
          disabled={busy} autoComplete="off" spellCheck={false} required />
      </label>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <button className="primary wide" disabled={busy || confirmation !== 'УСТГАХ'}>
        {busy ? 'Устгаж байна…' : 'Миний мэдээллийг бүрмөсөн устгах'}
      </button>
    </form>
  );
}
