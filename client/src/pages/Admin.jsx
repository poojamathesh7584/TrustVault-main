import { useMemo, useState } from 'react';
import { Settings, Link2, Check, CheckCircle2, XCircle, Search, Download, MailPlus, Lock, UserPlus, Trash2, KeyRound, Plus } from 'lucide-react';
import { api, fmtDate, actionLabel, cleanDetail, TYPE_LABELS, ROLE_LABELS } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAsync, ErrorText, ask, toast, Stat, PageHeader, Segmented, Callout, Field, StatusBadge, EmptyState, SkeletonRows } from '@/components/app/kit';
import { StatusDonut, ActivityLine } from '@/components/app/charts';
import { AuditTable } from './Activity';

const SearchBox = ({ value, onChange, placeholder, label }) => (
  <label className="relative w-full sm:w-80">
    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input type="search" className="pl-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
  </label>
);

// ---------- Overview: numbers, then three charts ----------
function Overview() {
  const stats = useAsync(() => api('/admin/stats'));
  const users = useAsync(() => api('/admin/users'));
  const audit = useAsync(() => api('/admin/audit'));
  if (!stats.data) return <SkeletonRows rows={3} />;
  const data = stats.data;
  const items = [
    ['Students', data.users.student ?? 0, 'violet'], ['Faculty', data.users.verifier ?? 0, 'sky'],
    ['Verified docs', data.documents.verified ?? 0, 'green'], ['Pending docs', data.documents.pending ?? 0, 'amber'],
    ['Rejected docs', data.documents.rejected ?? 0, 'card'], ['Sign-ins (24h)', data.logins24h, 'card'],
    ['Ledger blocks', data.blocks, 'ink'], ['Tampered files', data.tampered, data.tampered ? 'red' : 'card'],
  ];
  // the donut wants one entry per document; the stats give counts per status
  const docs = Object.entries(data.documents).flatMap(([status, n]) => Array.from({ length: n }, () => ({ status })));
  const roles = [['Students', data.users.student ?? 0, 'var(--violet)'], ['Faculty', data.users.verifier ?? 0, 'var(--info)'], ['Admins', data.users.admin ?? 0, 'var(--pink)']];
  const most = Math.max(1, ...roles.map(([, n]) => n));
  return (
    <div className="grid gap-6">
      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">{items.map(([label, n, tone], i) => <Stat key={label} label={label} value={n} tone={tone} style={{ '--i': i }} />)}</div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Documents by status</CardTitle></CardHeader>
          <StatusDonut docs={docs} />
        </Card>
        <Card>
          <CardHeader><CardTitle>New accounts, 14 days</CardTitle></CardHeader>
          {users.data ? <ActivityLine activity={users.data} /> : <SkeletonRows rows={1} />}
        </Card>
        <Card>
          <CardHeader><CardTitle>All activity, 14 days</CardTitle></CardHeader>
          {audit.data ? <ActivityLine activity={audit.data} /> : <SkeletonRows rows={1} />}
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>People by role</CardTitle></CardHeader>
        <ul className="grid gap-3">
          {roles.map(([label, n, tone], i) => (
            <li key={label} className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-3 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="h-3 overflow-hidden rounded-full bg-muted"><i className="block h-full origin-left animate-[bar_0.9s_var(--ease-out-expo)_both] rounded-full" style={{ width: `${(n / most) * 100}%`, background: tone, boxShadow: `0 0 16px -2px ${tone}`, animationDelay: `${i * 120}ms` }} /></span>
              <b className="text-right font-mono">{n}</b>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ---------- Users: add, remove, password management, search, filter by role, change role, unlock, reset 2FA ----------
const ROLE_FILTERS = [['all', 'Everyone'], ['student', 'Students'], ['verifier', 'Faculty'], ['admin', 'Administrators'], ['locked', 'Locked']];

function Users() {
  const { data, error, reload } = useAsync(() => api('/admin/users'));
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [newRole, setNewRole] = useState('verifier');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newIdCode, setNewIdCode] = useState('');
  const [newDept, setNewDept] = useState('Department of Computer Applications');
  const [newPassword, setNewPassword] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  const [pwdUser, setPwdUser] = useState(null);
  const [pwdValue, setPwdValue] = useState('');
  const [editUser, setEditUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRoll, setEditRoll] = useState('');
  const [editDept, setEditDept] = useState('');

  const act = async (fn, done) => { try { await fn(); reload(); toast(done); } catch (e) { toast(e.message, 'error'); } };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editUser || !editName.trim()) {
      toast('Name is required.', 'error');
      return;
    }
    await act(
      () => api(`/admin/users/${editUser.id || editUser._id}`, {
        method: 'PATCH',
        body: { name: editName.trim(), roll: editRoll.trim(), dept: editDept.trim() }
      }),
      `Updated ${editName.trim()}.`
    );
    setEditUser(null);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddError('');
    if (!newName.trim() || !newEmail.trim()) {
      setAddError('Full name and email address are required.');
      return;
    }
    if (newPassword.trim().length < 8) {
      setAddError('Password must be at least 8 characters long.');
      return;
    }
    setAdding(true);
    try {
      await api('/admin/users', {
        method: 'POST',
        body: {
          name: newName.trim(),
          email: newEmail.trim().toLowerCase(),
          role: newRole,
          roll: newIdCode.trim() || undefined,
          dept: newDept.trim() || undefined,
          password: newPassword.trim()
        }
      });
      toast(`${ROLE_LABELS[newRole] || newRole} account created for ${newName.trim()}.`);
      setNewName('');
      setNewEmail('');
      setNewIdCode('');
      setNewPassword('');
      setShowAdd(false);
      reload();
    } catch (err) {
      setAddError(err.message || 'Could not create user.');
    } finally {
      setAdding(false);
    }
  };

  const removeUser = async (u) => {
    const ok = await ask({
      title: `Remove ${u.name} (${ROLE_LABELS[u.role] || u.role})?`,
      message: `This will permanently remove ${u.email} from TrustVault and revoke their access.`,
      confirmText: 'Remove User', danger: true,
    });
    if (ok) act(() => api(`/admin/users/${u.id || u._id}`, { method: 'DELETE' }), `Removed ${u.name}.`);
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!pwdUser || pwdValue.trim().length < 8) {
      toast('Password must be at least 8 characters.', 'error');
      return;
    }
    await act(
      () => api(`/admin/users/${pwdUser.id || pwdUser._id}/password`, { method: 'POST', body: { password: pwdValue.trim() } }),
      `Password updated for ${pwdUser.name}.`
    );
    setPwdUser(null);
    setPwdValue('');
  };

  const all = data ?? [];
  const match = (u, f) => f === 'all' || (f === 'locked' ? u.locked : u.role === f);
  const needle = q.trim().toLowerCase();
  const shown = all.filter((u) => match(u, filter) && (!needle || `${u.name} ${u.email} ${u.studentId ?? ''}`.toLowerCase().includes(needle)));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Filter users" value={filter} onChange={setFilter} options={ROLE_FILTERS.map(([k, label]) => [k, label, all.filter((u) => match(u, k)).length])} />
        <div className="flex flex-wrap items-center gap-3">
          <SearchBox value={q} onChange={setQ} placeholder="Search name, email or ID…" label="Search users" />
          <Button onClick={() => setShowAdd((v) => !v)}><UserPlus /> {showAdd ? 'Close Form' : 'Add User'}</Button>
        </div>
      </div>

      {showAdd && (
        <Card className="border-primary/40 bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus className="size-4 text-primary" /> Create New User Account</CardTitle>
            <CardDescription>
              Assign login email and password for a Faculty, Student, or Admin account. Users can update their password later in Security.
            </CardDescription>
          </CardHeader>
          <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={handleAddUser}>
            <Field label="Role">
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="h-10 w-full bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="verifier">Faculty</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Full Name">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="" />
            </Field>
            <Field label="Email Address">
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required placeholder="" />
            </Field>
            <Field label={newRole === 'verifier' ? 'Staff / Faculty ID' : newRole === 'admin' ? 'Admin ID' : 'Student Roll No.'}>
              <Input value={newIdCode} onChange={(e) => setNewIdCode(e.target.value)} placeholder="" />
            </Field>
            <Field label="Department">
              <Input value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="Department of Computer Applications" />
            </Field>
            <Field label="Assigned Login Password">
              <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} placeholder="Minimum 8 characters" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center justify-between gap-3 pt-1">
              <ErrorText>{addError}</ErrorText>
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button type="submit" disabled={adding}><Plus /> {adding ? 'Creating…' : `Create ${ROLE_LABELS[newRole] || 'User'}`}</Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {pwdUser && (
        <Card className="border-amber-400/50 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="size-4 text-amber-400" /> Set / Reset Password for {pwdUser.name}</CardTitle>
            <CardDescription>{pwdUser.email} ({ROLE_LABELS[pwdUser.role] || pwdUser.role})</CardDescription>
          </CardHeader>
          <form className="flex flex-wrap items-end gap-3" onSubmit={savePassword}>
            <Field label="New Password (min 8 chars)" className="min-w-64 flex-1">
              <Input type="text" value={pwdValue} onChange={(e) => setPwdValue(e.target.value)} required minLength={8} placeholder="Enter new password" />
            </Field>
            <Button type="submit">Save Password</Button>
            <Button type="button" variant="ghost" onClick={() => setPwdUser(null)}>Cancel</Button>
          </form>
        </Card>
      )}

      {editUser && (
        <Card className="border-primary/40 bg-card">
          <CardHeader>
            <CardTitle>Update Details for {editUser.name}</CardTitle>
            <CardDescription>{editUser.email} ({ROLE_LABELS[editUser.role] || editUser.role})</CardDescription>
          </CardHeader>
          <form className="grid gap-3 sm:grid-cols-3" onSubmit={saveEdit}>
            <Field label="Full Name"><Input value={editName} onChange={(e) => setEditName(e.target.value)} required /></Field>
            <Field label="Roll / Staff ID"><Input value={editRoll} onChange={(e) => setEditRoll(e.target.value.toUpperCase())} className="font-mono uppercase" /></Field>
            <Field label="Department"><Input value={editDept} onChange={(e) => setEditDept(e.target.value)} /></Field>
            <div className="sm:col-span-3 flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </Card>
      )}

      <ErrorText>{error}</ErrorText>
      <Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>ID / Roll no.</TableHead><TableHead>Role</TableHead><TableHead>Joined</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
        <TableBody>
          {shown.map((u) => (
            <TableRow key={u.id || u._id}>
              <TableCell className="font-semibold"><span className="flex items-center gap-2">{u.name}{u.locked && <Badge variant="destructive"><Lock /> Locked</Badge>}</span></TableCell>
              <TableCell>{u.email}</TableCell><TableCell className="font-mono">{u.studentId || u.roll || '-'}</TableCell>
              <TableCell>
                <Select value={u.role} onValueChange={(role) => act(() => api(`/admin/users/${u.id || u._id}`, { method: 'PATCH', body: { role } }), `${u.name} is now ${ROLE_LABELS[role]}.`)}>
                  <SelectTrigger size="sm" className="w-32 bg-card" aria-label={`Role of ${u.name}`}><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="student">Student</SelectItem><SelectItem value="verifier">Faculty</SelectItem><SelectItem value="admin">Administrator</SelectItem></SelectContent>
                </Select>
              </TableCell>
              <TableCell className="whitespace-nowrap">{fmtDate(u.createdAt)}</TableCell>
              <TableCell>
                <span className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditUser(u); setEditName(u.name || ''); setEditRoll(u.studentId || u.roll || ''); setEditDept(u.dept || ''); }}>Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => { setPwdUser(u); setPwdValue(''); }} title="Set or reset password"><KeyRound className="size-3.5" /> Password</Button>
                  {u.locked && <Button size="sm" onClick={() => act(() => api(`/admin/users/${u.id || u._id}/unlock`, { method: 'POST' }), `${u.name} unlocked.`)}>Unlock</Button>}
                  <Button size="sm" variant="destructive" onClick={() => removeUser(u)} title="Remove user"><Trash2 className="size-3.5" /> Remove</Button>
                </span>
              </TableCell>
            </TableRow>
          ))}
          {data && !shown.length && <TableRow><TableCell colSpan={6} className="text-muted-foreground">Nobody matches.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------- Invitations: bring in a faculty member or another admin by email ----------
function Invites() {
  const { data, error, reload } = useAsync(() => api('/admin/invites'));
  const [role, setRole] = useState('verifier');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = new FormData(form).get('email');
    if (role === 'admin' && !(await ask({ title: `Invite ${email} as an admin?`, message: 'Admins can change roles, reset two-factor authentication and read the full audit log. Only invite someone you fully trust.', confirmText: 'Send admin invitation', danger: true }))) return;
    setBusy(true); setFormError('');
    try {
      await api('/admin/invites', { method: 'POST', body: { email, role } });
      toast(`Invitation emailed to ${email}.`);
      form.reset();
      reload();
    } catch (err) { setFormError(err.message); }
    setBusy(false);
  };
  const revoke = async (i) => {
    if (!(await ask({ title: 'Cancel this invitation?', message: `The link sent to ${i.email} will stop working.`, confirmText: 'Cancel invitation', danger: true }))) return;
    try { await api(`/admin/invites/${i.id}`, { method: 'DELETE' }); toast('Invitation cancelled.'); reload(); } catch (err) { toast(err.message, 'error'); }
  };
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <Card>
        <CardHeader><div><CardTitle>Invite someone</CardTitle><CardDescription>They get an email with a one-time link. It works only for that address and expires in 48 hours.</CardDescription></div></CardHeader>
        <form className="grid gap-4" onSubmit={send}>
          <Field label="Email address"><Input name="email" type="email" required placeholder="name@college.edu" autoComplete="off" /></Field>
          <Field label="Role">
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-10 w-full bg-card"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="verifier">Faculty - asks students for documents</SelectItem><SelectItem value="admin">Administrator - full control</SelectItem></SelectContent>
            </Select>
          </Field>
          <ErrorText>{formError}</ErrorText>
          <Button disabled={busy}><MailPlus /> {busy ? 'Sending…' : 'Send invitation'}</Button>
        </form>
      </Card>
      <div className="grid gap-3">
        <ErrorText>{error}</ErrorText>
        {data && !data.length && <EmptyState icon={MailPlus} title="No invitations yet" steps={[[MailPlus, 'Enter their email and pick faculty or admin'], [Link2, 'They get a one-time link that works only for that address'], [Check, 'They set a password and Google Authenticator, then appear in Users']]}>
          Bring in a faculty member or another admin without them needing a sign-up code.
        </EmptyState>}
        {data?.length > 0 && (
          <Table>
            <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Sent by</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-semibold">{i.email}</TableCell><TableCell><Badge variant={i.role === 'admin' ? 'violet' : 'info'}>{i.role}</Badge></TableCell>
                  <TableCell>{i.invitedBy ?? '-'}<small className="block text-xs whitespace-nowrap text-muted-foreground">{fmtDate(i.createdAt)}</small></TableCell>
                  <TableCell><span className="grid gap-1"><StatusBadge status={i.status} />{i.status === 'pending' && <small className="text-xs whitespace-nowrap text-muted-foreground">until {fmtDate(i.expiresAt)}</small>}</span></TableCell>
                  <TableCell>{i.status === 'pending' && <Button size="sm" variant="destructive" onClick={() => revoke(i)}>Cancel</Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

const hash = (h) => <TableCell className="font-mono text-xs" title={h}>{h.slice(0, 12)}…</TableCell>;

function Ledger() {
  const { data } = useAsync(() => api('/admin/ledger'));
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const check = async () => { setBusy(true); setResult(await api('/admin/integrity', { method: 'POST' }).catch((e) => ({ ok: false, problems: [e.message] }))); setBusy(false); };
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">Each block stores the SHA-256 of the previous block. Changing any old record breaks the chain.</p>
        <Button onClick={check} disabled={busy}><Link2 /> {busy ? 'Checking every file…' : 'Run integrity check'}</Button>
      </div>
      {result && (
        <Callout tone={result.ok ? 'ok' : 'bad'}>
          <p className="flex items-center gap-2 font-semibold">
            {result.ok ? <><CheckCircle2 className="size-4" /> All {result.blocks} blocks and {result.documents} documents are intact.</> : <><XCircle className="size-4" /> {result.problems.length} problem(s) found:</>}
          </p>
          {!result.ok && <ul className="mt-2 grid list-disc gap-1 pl-5">{result.problems.map((p, idx) => <li key={idx}>{typeof p === 'string' ? p : (p?.reason || `Block #${p?.index ?? idx} integrity mismatch`)}</li>)}</ul>}
        </Callout>
      )}
      <Table>
        <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Time</TableHead><TableHead>Action</TableHead><TableHead>File hash</TableHead><TableHead>Previous hash</TableHead><TableHead>Block hash</TableHead></TableRow></TableHeader>
        <TableBody>
          {data?.map((b) => (
            <TableRow key={b._id || b.index}>
              <TableCell className="font-mono">{b.index}</TableCell><TableCell className="whitespace-nowrap">{fmtDate(b.at || b.timestamp)}</TableCell><TableCell>{actionLabel(b.action)}</TableCell>
              {hash(b.fileHash)}{hash(b.prevHash)}{hash(b.hash)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------- Audit log: filter by kind, search, export what is shown as CSV ----------
const normAct = (a) => String(a || '').toLowerCase().replace(/_/g, '.');
const KINDS = [
  ['all', 'Everything', () => true],
  ['signin', 'Sign-ins', (a) => /^(login|session|devices|student\.register|otp|reauth)/.test(normAct(a))],
  ['docs', 'Documents', (a) => /^document/.test(normAct(a))],
  ['access', 'Access & sharing', (a) => /^(record|access|share|faculty)/.test(normAct(a))],
  ['admin', 'Admin actions', (a) => /^(user|invite|ledger|admin|account\.locked)/.test(normAct(a))],
];
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function AllAudit() {
  const { data } = useAsync(() => api('/admin/audit'));
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const logs = data ?? [];
  const shown = useMemo(() => {
    const test = KINDS.find(([k]) => k === kind)[2];
    const needle = q.trim().toLowerCase();
    return logs.filter((a) => test(a.action) && (!needle || `${actionLabel(a.action)} ${a.detail} ${a.user?.name ?? ''} ${a.subject?.name ?? ''} ${a.ip}`.toLowerCase().includes(needle)));
  }, [logs, kind, q]);
  const exportCsv = () => {
    const rows = [['Time', 'Action', 'Details', 'By', 'Role', 'Whose data', 'IP'], ...shown.map((a) => [new Date(a.createdAt || a.at).toISOString(), actionLabel(a.action), cleanDetail(a.detail), a.user?.name ?? 'system / guest', a.user?.role ?? '', a.subject?.name ?? '', a.ip])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    Object.assign(document.createElement('a'), { href: url, download: `trustvault-audit-${new Date().toISOString().slice(0, 10)}.csv` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`${shown.length} audit records exported.`);
  };
  if (!data) return <SkeletonRows rows={3} />;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Filter the audit log" value={kind} onChange={setKind} options={KINDS.map(([k, label, test]) => [k, label, logs.filter((a) => test(a.action)).length])} />
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <SearchBox value={q} onChange={setQ} placeholder="Search action, person or IP…" label="Search the audit log" />
          <Button variant="outline" onClick={exportCsv} disabled={!shown.length}><Download /> Export CSV</Button>
        </div>
      </div>
      <p className="font-mono text-xs text-muted-foreground uppercase">Showing {shown.length} of the latest {logs.length} records</p>
      <AuditTable logs={shown} showSubject />
    </div>
  );
}

// ---------- Requests: every document request faculty sent, and how students answered ----------
const REQ_FILTERS = [['all', 'All'], ['pending', 'Waiting'], ['approved', 'Shared'], ['used', 'Opened'], ['denied', 'Denied'], ['revoked', 'Withdrawn'], ['expired', 'Expired']];
function Requests() {
  const { data, error, loading } = useAsync(() => api('/admin/requests'));
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const all = data ?? [];
  const needle = q.trim().toLowerCase();
  const shown = all.filter((a) => (filter === 'all' || a.status === filter)
    && (!needle || `${a.faculty?.name} ${a.student?.name} ${a.student?.studentId}`.toLowerCase().includes(needle)));
  const types = (list = []) => list.map((t) => TYPE_LABELS[t]).join(', ') || '-';
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Filter requests" value={filter} onChange={setFilter} options={REQ_FILTERS.map(([k, label]) => [k, label, all.filter((a) => k === 'all' || a.status === k).length])} />
        <SearchBox value={q} onChange={setQ} placeholder="Search faculty, student or roll number…" label="Search requests" />
      </div>

      <ErrorText>{error}</ErrorText>
      {loading ? <SkeletonRows /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Sent</TableHead><TableHead>Faculty</TableHead><TableHead>Student</TableHead><TableHead>Asked for</TableHead><TableHead>Shared</TableHead><TableHead>Opened</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {shown.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="whitespace-nowrap">{fmtDate(a.requestedAt)}</TableCell>
                <TableCell className="font-semibold">{a.faculty?.name ?? '-'}</TableCell>
                <TableCell><span className="grid"><b>{a.student?.name ?? '-'}</b><small className="font-mono text-muted-foreground">{a.student?.studentId}</small></span></TableCell>
                <TableCell className="min-w-44">{types(a.types)}</TableCell>
                <TableCell className="min-w-36">{['approved', 'used', 'expired', 'revoked'].includes(a.status) ? types(a.granted) : '-'}</TableCell>
                <TableCell className="font-mono">{a.opened}</TableCell>
                <TableCell><StatusBadge status={a.status}>{REQ_FILTERS.find(([k]) => k === a.status)?.[1] ?? a.status}</StatusBadge></TableCell>
              </TableRow>
            ))}
            {data && !shown.length && <TableRow><TableCell colSpan={7} className="text-muted-foreground">No requests match.</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

const TABS = { Overview, Users, Requests, Invitations: Invites, Ledger, 'Audit log': AllAudit };

export default function Admin() {
  const [tab, setTab] = useState('Overview');
  const Tab = TABS[tab];
  return (
    <div className="grid gap-8">
      <PageHeader icon={Settings} kicker="Administrator" title="Admin Console">Users, faculty requests, invitations, the hash ledger and the full audit trail.</PageHeader>
      <Segmented label="Admin sections" value={tab} onChange={setTab} options={Object.keys(TABS).map((t) => [t, t])} />
      <div key={tab} className="animate-rise"><Tab /></div>
    </div>
  );
}
