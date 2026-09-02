import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, RefreshCw, Server, ShieldCheck, Zap } from 'lucide-react';
import './styles.css';

const api = (path, options) => fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options }).then(async (res) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
});

function App() {
  const [data, setData] = useState({ services: [], incidents: [], deployments: [] });
  const [health, setHealth] = useState({ status: 'checking', database: 'checking' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadDashboard() {
    setLoading(true); setError('');
    try {
      const [dashboard, status] = await Promise.all([api('/api/dashboard'), api('/api/health')]);
      setData(dashboard); setHealth(status);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadDashboard(); }, []);

  async function resolveIncident(id) {
    await api(`/api/incidents/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) });
    await loadDashboard();
  }

  const healthy = data.services.filter((service) => service.status === 'healthy').length;
  const avgLatency = data.services.length ? Math.round(data.services.reduce((sum, service) => sum + Number(service.latency_ms), 0) / data.services.length) : 0;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Activity size={19} /></span><span>opsboard</span></div>
      <div className="workspace-label">Workspace</div><div className="workspace">production <span>⌄</span></div>
      <nav><a className="active"><Activity size={17} /> Overview</a><a><Server size={17} /> Services <b>{data.services.length}</b></a><a><AlertTriangle size={17} /> Incidents <b>{data.incidents.length}</b></a><a><ArrowUpRight size={17} /> Deployments</a></nav>
      <div className="sidebar-bottom"><div className="operator"><span className="avatar">NL</span><div><strong>neulad</strong><small>operator</small></div><span>···</span></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><div className="eyebrow">Operations / Today</div><h1>Good morning, operator.</h1><p>Here is the pulse of your production stack.</p></div><button className="refresh" onClick={loadDashboard} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh</button></header>
      {error && <div className="error"><AlertTriangle size={17} /> {error} <span>Check that the API and PostgreSQL are running.</span></div>}
      <section className="metrics"><Metric icon={<ShieldCheck />} label="Systems healthy" value={`${healthy}/${data.services.length || '—'}`} accent="green" /><Metric icon={<Clock3 />} label="Avg. latency" value={`${avgLatency || '—'} ms`} accent="amber" /><Metric icon={<AlertTriangle />} label="Open incidents" value={data.incidents.length} accent="red" /><Metric icon={<Zap />} label="Deploys today" value={data.deployments.length} accent="blue" /></section>
      <div className="content-grid"><section className="panel services-panel"><div className="panel-head"><div><h2>Service health</h2><p>Live signals from your critical services</p></div><span className="live"><i /> Live</span></div><div className="service-list">{data.services.map((service) => <div className="service-row" key={service.id}><span className={`status-dot ${service.status}`} /><div className="service-name"><strong>{service.name}</strong><small>{service.owner}</small></div><div className="service-stat"><small>Uptime</small><strong>{service.uptime}%</strong></div><div className="service-stat latency"><small>Latency</small><strong>{service.latency_ms}ms</strong></div><span className={`pill ${service.status}`}>{service.status}</span></div>)}</div></section>
        <section className="panel incidents-panel"><div className="panel-head"><div><h2>Active incidents</h2><p>Coordinate response and recovery</p></div><span className="count">{data.incidents.length}</span></div>{data.incidents.length === 0 ? <div className="empty"><CheckCircle2 size={28} /><strong>All clear</strong><span>No active incidents.</span></div> : <div className="incident-list">{data.incidents.map((incident) => <article className="incident" key={incident.id}><div className="incident-top"><span className={`severity ${incident.severity}`}>{incident.severity}</span><span>{new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><h3>{incident.title}</h3><p>{incident.summary}</p><div className="incident-foot"><span>{incident.service} · {incident.status}</span><button onClick={() => resolveIncident(incident.id)}>Resolve <CheckCircle2 size={14} /></button></div></article>)}</div>}</section>
      </div>
      <section className="panel deploy-panel"><div className="panel-head"><div><h2>Recent deployments</h2><p>Release activity across environments</p></div><a className="view-all">View all <ArrowUpRight size={15} /></a></div><div className="table-wrap"><table><thead><tr><th>Service</th><th>Version</th><th>Environment</th><th>Released by</th><th>Status</th></tr></thead><tbody>{data.deployments.map((deployment) => <tr key={deployment.id}><td><strong>{deployment.service}</strong></td><td className="mono">{deployment.version}</td><td><span className={`env ${deployment.environment}`}>{deployment.environment}</span></td><td>{deployment.deployed_by}</td><td><span className={`deploy-status ${deployment.status}`}><i /> {deployment.status}</span></td></tr>)}</tbody></table></div></section>
      <footer><span>API status: <b className={health.status === 'ok' ? 'ok' : ''}>{health.status}</b></span><span>Database: <b className={health.database === 'connected' ? 'ok' : ''}>{health.database}</b></span><span>Last checked just now</span></footer>
    </main>
  </div>
}
function Metric({ icon, label, value, accent }) { return <div className="metric"><span className={`metric-icon ${accent}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div> }

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
