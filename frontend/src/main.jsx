import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CloudUpload, Download, File, FileText, LogOut, ShieldCheck, Trash2, UploadCloud } from 'lucide-react';
import './styles.css';

const maxSize = 20 * 1024 * 1024;

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'include', ...options });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || 'Something went wrong');
  return data;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function App() {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [authMode, setAuthMode] = useState('login');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadSession() {
    try {
      const session = await api('/api/auth/me');
      setUser(session.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadFiles() {
    const data = await api('/api/files');
    setFiles(data.files);
  }

  useEffect(() => { loadSession(); }, []);
  useEffect(() => { if (user) loadFiles().catch((requestError) => setError(requestError.message)); }, [user]);

  async function submitAuth(event) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const data = await api(`/api/auth/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: form.get('nickname'), password: form.get('password') }),
      });
      setUser(data.user);
      event.currentTarget.reset();
    } catch (requestError) { setError(requestError.message); }
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setFiles([]);
  }

  async function deleteFile(id) {
    setError('');
    try {
      await api(`/api/files/${id}`, { method: 'DELETE' });
      setFiles((current) => current.filter((file) => file.id !== id));
    } catch (requestError) { setError(requestError.message); }
  }

  if (loading) return <div className="loading-screen"><UploadCloud size={30} /><span>Opening your filebox...</span></div>;
  if (!user) return <AuthScreen mode={authMode} setMode={setAuthMode} onSubmit={submitAuth} error={error} />;
  return <Workspace user={user} files={files} onLogout={logout} onDelete={deleteFile} setFiles={setFiles} error={error} setError={setError} />;
}

function AuthScreen({ mode, setMode, onSubmit, error }) {
  const register = mode === 'register';
   return <main className="auth-layout"><section className="intro"><div className="logo"><span><CloudUpload size={19} /></span> filebox</div><div className="intro-copy"><p className="kicker">Private file sharing</p><h1>Your files,<br /><em>quietly kept.</em></h1><p className="intro-text">A small, dependable place for the files you need close at hand.</p></div><div className="trust"><ShieldCheck size={17} /> Your files belong only to you</div></section><section className="auth-panel"><div className="auth-card"><p className="kicker">{register ? 'Create your space' : 'Welcome back'}</p><h2>{register ? 'Start with a nickname.' : 'Sign in to filebox.'}</h2><p className="muted">{register ? 'No email required. Just you and your files.' : 'Your personal files are waiting.'}</p>{error && <div className="form-error">{error}</div>}<form onSubmit={onSubmit}><label>Nickname<input name="nickname" required minLength="3" maxLength="32" pattern="[a-zA-Z0-9_-]+" autoComplete="username" placeholder="mira_7" /></label><label>Password<input name="password" type="password" required minLength="8" maxLength="72" autoComplete={register ? 'new-password' : 'current-password'} placeholder="At least 8 characters" /></label><button className="primary-button" type="submit">{register ? 'Create account' : 'Sign in'} <span>-&gt;</span></button></form><p className="switch">{register ? 'Already have an account?' : 'New to filebox?'} <button onClick={() => setMode(register ? 'login' : 'register')}>{register ? 'Sign in' : 'Create one'}</button></p></div></section></main>;
}

function Workspace({ user, files, onLogout, onDelete, setFiles, error, setError }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  function uploadFile(file) {
    if (!file) return;
    if (file.size > maxSize) { setError('Files must be smaller than 20 MB'); return; }
    setError('');
    setUploading(true);
    setProgress(0);
    const request = new XMLHttpRequest();
    request.open('POST', '/api/files');
    request.withCredentials = true;
    request.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onload = async () => {
      setUploading(false);
      if (request.status >= 200 && request.status < 300) {
        setFiles((current) => [JSON.parse(request.responseText).file, ...current]);
      } else {
        try { setError(JSON.parse(request.responseText).error); } catch { setError('Upload failed'); }
      }
    };
    request.onerror = () => { setUploading(false); setError('Upload failed'); };
    const body = new FormData();
    body.append('file', file);
    request.send(body);
  }

  return <main className="workspace-layout"><header className="workspace-header"><div className="logo dark"><span><CloudUpload size={19} /></span> filebox</div><div className="account"><span className="avatar">{user.nickname.slice(0, 1).toUpperCase()}</span><strong>{user.nickname}</strong><button onClick={onLogout} title="Sign out"><LogOut size={17} /></button></div></header><section className="workspace-content"><div className="heading-row"><div><p className="kicker">Your private space</p><h1>Good to have you, {user.nickname}.</h1><p className="muted">Keep the important things in one calm, simple place.</p></div><span className="file-count">{files.length} {files.length === 1 ? 'file' : 'files'}</span></div><div className={`dropzone ${uploading ? 'uploading' : ''}`} onClick={() => !uploading && inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); uploadFile(event.dataTransfer.files[0]); }}><input ref={inputRef} type="file" hidden onChange={(event) => uploadFile(event.target.files[0])} /><div className="upload-icon"><CloudUpload size={27} /></div>{uploading ? <><strong>Uploading... {progress}%</strong><div className="progress"><i style={{ width: `${progress}%` }} /></div></> : <><strong>Drop a file here, or browse</strong><span>Up to 20 MB per file</span></>}</div>{error && <div className="form-error page-error">{error}</div>}<section className="files-section"><div className="section-heading"><h2>Your files</h2><span>Stored securely</span></div>{files.length === 0 ? <div className="empty-files"><FileText size={28} /><strong>No files yet</strong><span>Upload your first file to get started.</span></div> : <div className="file-list">{files.map((file) => <article className="file-row" key={file.id}><div className="file-type"><File size={19} /></div><div className="file-details"><strong>{file.original_name}</strong><span>{formatBytes(Number(file.size_bytes))} · {new Date(file.created_at).toLocaleDateString()}</span></div><a className="icon-button" href={`/api/files/${file.id}/download`} title="Download"><Download size={17} /></a><button className="icon-button danger" onClick={() => onDelete(file.id)} title="Delete"><Trash2 size={17} /></button></article>)}</div>}</section></section></main>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
