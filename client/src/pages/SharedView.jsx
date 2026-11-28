import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, fmtDate } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorText, StatusBadge, OtpInput, FileFrame } from '@/components/app/kit';
import { PublicShell, Kicker } from '@/components/app/public';

// Page for the person a document was shared with: email code -> watermarked view.
export default function SharedView() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [sent, setSent] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api(`/public/share/${token}`).then(setInfo, (e) => setError(e.message)); }, [token]);
  useEffect(() => () => file && URL.revokeObjectURL(file.url), [file]);

  const send = async () => {
    if (busy) return;
    setError('');
    setBusy(true);
    try { await api(`/public/share/${token}/otp`, { method: 'POST' }); setSent(true); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const view = async (e) => {
    e.preventDefault();
    if (busy || file) return;
    const code = new FormData(e.currentTarget).get('code');
    if (!code || String(code).trim().length < 6) {
      setError('Enter the 6-digit verification code.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await api(`/public/share/${token}/view`, { method: 'POST', body: { code }, raw: true });
      const blob = await res.blob();
      setError('');
      setFile({ url: URL.createObjectURL(blob), pdf: res.headers.get('Content-Type') === 'application/pdf' });
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <PublicShell brandTo="/" className="max-w-3xl gap-6">
      <Kicker>Secure shared document</Kicker>
      {!file && <ErrorText>{error}</ErrorText>}
      {info && !file && (
        <Card className="grid gap-4 rounded-2xl shadow-brutal-lg">
          <h1 className="text-4xl leading-none">{info.title}</h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            Shared by <b className="text-foreground">{info.owner}</b> · <StatusBadge status={info.status} /> · link expires {fmtDate(info.expiresAt)} · {info.viewsLeft} view(s) left
          </p>
          {!sent ? (
            <Button size="lg" disabled={busy} onClick={send}>{busy ? 'Sending code…' : `Send a code to ${info.recipient}`}</Button>
          ) : (
            <form className="grid gap-4" onSubmit={view}>
              <p className="text-sm font-semibold">Enter the 6-digit code we emailed you:</p>
              <OtpInput />
              <Button size="lg" disabled={busy}>{busy ? 'Verifying…' : 'Open document'}</Button>
            </form>
          )}
        </Card>
      )}
      {file && <FileFrame url={file.url} pdf={file.pdf} title="Shared document">Watermarked with your email. This view was reported to the owner.</FileFrame>}
    </PublicShell>
  );
}
