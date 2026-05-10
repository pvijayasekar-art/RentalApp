import { useState, useEffect, useCallback, useMemo } from "react";

const API = "/api";

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// Helper functions for system calendar
const getCurrentYear = () => new Date().getFullYear().toString();
const getCurrentMonthYear = () => {
  const date = new Date();
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};
const getCurrentFinancialYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 4) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
};
const getCurrentQuarter = () => {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return 'Q4';
  if (month <= 6) return 'Q1';
  if (month <= 9) return 'Q2';
  return 'Q3';
};

async function api(path, method = "GET", body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + path, opts);
  const data = await r.json();
  if (!r.ok) {
    throw new Error(data.error || data.message || `HTTP ${r.status}: ${r.statusText}`);
  }
  return data;
}

// ─── ICONS ──────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 20 }) => {
  const icons = {
    dashboard: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    building: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>,
    users: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    rupee: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M6 3h12M6 8h12M15 21 9 8"/><path d="M9 13h3a4 4 0 0 0 0-5H9"/></svg>,
    expense: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    receipt: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    chart: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6"/><path d="M21 21H3"/></svg>,
    tax: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    calculator: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="18" x2="12" y2="18"/><line x1="16" y1="18" x2="16" y2="18"/><line x1="8" y1="18" x2="8" y2="18"/><line x1="16" y1="10" x2="16" y2="10.01"/><line x1="12" y1="10" x2="12" y2="10.01"/><line x1="8" y1="10" x2="8" y2="10.01"/></svg>,
    book: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
    plus: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
    edit: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    trash: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    close: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    trend: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg>,
    crystal: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
    warn: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    home: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
    file: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>,
    image: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>,
    database: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="2"/><path d="M21 12h-6m-6 0h-6"/><path d="M12 17v6"/><circle cx="12" cy="12" r="1"/><path d="M12 9v3"/></svg>,
    'file-text': <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>,
    report: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>,
  };
  return icons[name] || null;
};

// ─── CARD ─────────────────────────────────────────────────────────────────────
function Card({ title, children, style = {} }) {
  return (
    <div style={{
      background: "var(--gradient-card)",
      border: "1px solid var(--border)",
      borderRadius: "16px",
      padding: "24px",
      marginBottom: "24px",
      boxShadow: "var(--shadow)",
      position: "relative",
      overflow: "hidden",
      ...style
    }}>
      {/* Decorative corner accent */}
      <div style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: "120px",
        height: "120px",
        background: "radial-gradient(circle at top right, rgba(6,182,212,0.1) 0%, transparent 70%)",
        pointerEvents: "none"
      }} />
      
      {title && (
        <div style={{ 
          marginBottom: "20px", 
          paddingBottom: "16px", 
          borderBottom: "1px solid var(--border)",
          position: "relative",
          zIndex: 1
        }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: "1.35rem", 
            fontWeight: 600,
            color: "var(--text)", 
            display: "flex", 
            alignItems: "center", 
            gap: "10px",
            letterSpacing: "-0.3px"
          }}>
            {title}
          </h2>
        </div>
      )}
      <div style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

// ─── MODAL ──────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",
      zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"
    }}>
      <div style={{
        background:"var(--card)",border:"1px solid var(--border)",borderRadius:"16px",
        width:"100%",maxWidth:"600px",maxHeight:"90vh",overflow:"auto",
        boxShadow:"0 24px 80px rgba(0,0,0,0.4)"
      }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 24px",borderBottom:"1px solid var(--border)"}}>
          <h2 style={{margin:0,fontSize:"18px",fontWeight:700,color:"var(--text)"}}>{title}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",padding:"4px"}}><Icon name="close"/></button>
        </div>
        <div style={{padding:"24px"}}>{children}</div>
      </div>
    </div>
  );
}

// ─── FORM FIELD ─────────────────────────────────────────────────────────────
function Field({ label, children, error }) {
  return (
    <div style={{marginBottom:"16px"}}>
      <label style={{display:"block",fontSize:"12px",fontWeight:600,color:error?"#ef4444":"var(--muted)",marginBottom:"6px",textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}</label>
      {children}
      {error && <span style={{display:"block",fontSize:"11px",color:"#ef4444",marginTop:"4px"}}>{error}</span>}
    </div>
  );
}

const inputStyle = {
  width:"100%",padding:"10px 12px",background:"var(--bg)",border:"1px solid var(--border)",
  borderRadius:"8px",color:"var(--text)",fontSize:"14px",boxSizing:"border-box",
  outline:"none",fontFamily:"inherit"
};

function Select({ value, onChange, children, style }) {
  return <select value={value} onChange={onChange} style={{...inputStyle,...style}}>{children}</select>;
}

function Input({ type="text", value, onChange, placeholder, style }) {
  return <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{...inputStyle,...style}}/>;
}

// ─── STATUS BADGE ────────────────────────────────────────────────────────────
function Badge({ status }) {
  const colors = {
    active:"#22c55e", inactive:"#94a3b8", maintenance:"#f59e0b",
    paid:"#22c55e", pending:"#f59e0b", partial:"#3b82f6", overdue:"#ef4444",
    notice:"#f97316", commercial:"#8b5cf6", villa:"#06b6d4", apartment:"#3b82f6", house:"#10b981"
  };
  const c = colors[status] || "#94a3b8";
  return (
    <span style={{
      display:"inline-block",padding:"2px 10px",borderRadius:"20px",fontSize:"11px",
      fontWeight:600,background:c+"22",color:c,border:`1px solid ${c}44`,textTransform:"capitalize"
    }}>{status}</span>
  );
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, sub }) {
  return (
    <div style={{
      background:"var(--card)",border:"1px solid var(--border)",borderRadius:"16px",
      padding:"24px",display:"flex",flexDirection:"column",gap:"12px",
      boxShadow:"0 2px 12px rgba(0,0,0,0.1)"
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <span style={{fontSize:"13px",fontWeight:500,color:"var(--muted)",letterSpacing:"0.3px"}}>{label}</span>
        <div style={{width:40,height:40,borderRadius:"10px",background:color+"22",display:"flex",alignItems:"center",justifyContent:"center",color}}><Icon name={icon} size={18}/></div>
      </div>
      <div style={{fontSize:"28px",fontWeight:800,color:"var(--text)",letterSpacing:"-0.5px"}}>{value}</div>
      {sub && <div style={{fontSize:"12px",color:"var(--muted)"}}>{sub}</div>}
    </div>
  );
}

// ─── MINI CHART ──────────────────────────────────────────────────────────────
function MiniChart({ data }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.collections));
  const w = 480, h = 120, pad = 8;
  const step = (w - pad * 2) / (data.length - 1 || 1);
  const pts = data.map((d, i) => [pad + i * step, h - pad - ((d.collections / max) * (h - pad * 2))]);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const area = `${path} L${pts[pts.length-1][0]},${h-pad} L${pts[0][0]},${h-pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height:"100%"}}>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#f97316" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#cg)"/>
      <path d={path} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="4" fill="#f97316"/>
          <text x={p[0]} y={h-2} textAnchor="middle" fontSize="9" fill="#94a3b8">{data[i].month?.split(" ")[0]}</text>
        </g>
      ))}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api("/dashboard").then(setData); }, []);
  if (!data) return <div style={{color:"var(--muted)",padding:"40px",textAlign:"center"}}>Loading dashboard...</div>;
  const { stats, recentCollections, recentExpenses, monthlyTrend } = data;
  return (
    <div>
      <div style={{marginBottom:"28px"}}>
        <h1 style={{fontSize:"26px",fontWeight:800,color:"var(--text)",margin:0}}>Dashboard</h1>
        <p style={{color:"var(--muted)",margin:"4px 0 0",fontSize:"14px"}}>Overview of your rental portfolio</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"16px",marginBottom:"28px"}}>
        <StatCard label="Total Properties" value={stats.totalProperties} icon="building" color="#3b82f6"/>
        <StatCard label="Total Tenants" value={stats.totalTenants} icon="users" color="#22c55e" sub={`${stats.activeTenants || 0} active`}/>
        <StatCard label="This Month Collection" value={fmt(stats.monthlyCollection)} icon="rupee" color="#f97316"/>
        <StatCard label="This Month Expenses" value={fmt(stats.monthlyExpenses)} icon="expense" color="#ef4444"/>
        <StatCard label="Net Income" value={fmt(stats.netIncome)} icon="trend" color="#8b5cf6" sub="Collection minus expenses"/>
        <StatCard label="Pending Payments" value={stats.pendingRent} icon="warn" color="#f59e0b" sub="Awaiting collection"/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px",marginBottom:"20px"}}>
        <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"16px",padding:"24px"}}>
          <h3 style={{margin:"0 0 16px",fontSize:"15px",fontWeight:700,color:"var(--text)"}}>Collection Trend</h3>
          <div style={{height:"130px"}}><MiniChart data={monthlyTrend}/></div>
        </div>
        <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"16px",padding:"24px"}}>
          <h3 style={{margin:"0 0 16px",fontSize:"15px",fontWeight:700,color:"var(--text)"}}>Recent Expenses</h3>
          {recentExpenses.map(e => (
            <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
              <div>
                <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>{e.description.length>35?e.description.slice(0,35)+"…":e.description}</div>
                <div style={{fontSize:"11px",color:"var(--muted)"}}>{e.property_name||"General"} · {fmtDate(e.expense_date)}</div>
              </div>
              <span style={{color:"#ef4444",fontWeight:700,fontSize:"14px"}}>{fmt(e.amount)}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"16px",padding:"24px"}}>
        <h3 style={{margin:"0 0 16px",fontSize:"15px",fontWeight:700,color:"var(--text)"}}>Recent Collections</h3>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
          <thead>
            <tr style={{color:"var(--muted)",fontWeight:600,textTransform:"uppercase",fontSize:"11px",letterSpacing:"0.5px"}}>
              <th style={{textAlign:"left",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>Tenant</th>
              <th style={{textAlign:"left",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>Property</th>
              <th style={{textAlign:"left",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>Month</th>
              <th style={{textAlign:"left",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>Method</th>
              <th style={{textAlign:"right",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>Amount</th>
              <th style={{textAlign:"center",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentCollections.map(c => (
              <tr key={c.id}>
                <td style={{padding:"10px 0",color:"var(--text)",fontWeight:500,borderBottom:"1px solid var(--border)"}}>{c.tenant_name}</td>
                <td style={{padding:"10px 0",color:"var(--muted)",borderBottom:"1px solid var(--border)"}}>{c.property_name}</td>
                <td style={{padding:"10px 0",color:"var(--muted)",borderBottom:"1px solid var(--border)"}}>{c.month_year}</td>
                <td style={{padding:"10px 0",color:"var(--muted)",textTransform:"capitalize",borderBottom:"1px solid var(--border)"}}>{c.payment_method?.replace("_"," ")}</td>
                <td style={{padding:"10px 0",textAlign:"right",fontWeight:700,color:"var(--text)",borderBottom:"1px solid var(--border)"}}>{fmt(c.amount)}</td>
                <td style={{padding:"10px 0",textAlign:"center",borderBottom:"1px solid var(--border)"}}><Badge status={c.status}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── PROPERTIES ───────────────────────────────────────────────────────────────
function Properties() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name:"",address:"",type:"apartment",total_units:1,monthly_rent:"",status:"active",eb_service_number:"",property_assessment_number:"",water_connection_number:"" });
  const load = useCallback(() => api("/properties").then(setItems), []);
  useEffect(() => { load(); }, [load]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const open = (item) => {
    if (item) setForm({ ...item }); else setForm({ name:"",address:"",type:"apartment",total_units:1,monthly_rent:"",status:"active" });
    setModal(item || true);
  };
  const save = async () => {
    if (modal?.id) await api(`/properties/${modal.id}`, "PUT", form);
    else await api("/properties", "POST", form);
    setModal(null); load();
  };
  const del = async (id) => { if (confirm("Delete this property?")) { await api(`/properties/${id}`, "DELETE"); load(); } };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
        <div>
          <h1 style={{fontSize:"26px",fontWeight:800,color:"var(--text)",margin:0}}>Properties</h1>
          <p style={{color:"var(--muted)",margin:"4px 0 0",fontSize:"14px"}}>{items.length} properties in your portfolio</p>
        </div>
        <button onClick={() => open(null)} style={{display:"flex",alignItems:"center",gap:"8px",padding:"10px 20px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:"10px",fontWeight:600,cursor:"pointer",fontSize:"14px"}}>
          <Icon name="plus" size={16}/>Add Property
        </button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:"16px"}}>
        {items.map(p => (
          <div key={p.id} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"16px",padding:"24px",boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"12px"}}>
              <div>
                <div style={{fontSize:"16px",fontWeight:700,color:"var(--text)"}}>{p.name}</div>
                <div style={{fontSize:"12px",color:"var(--muted)",marginTop:"2px"}}>ID: #{p.id}</div>
              </div>
              <div style={{display:"flex",gap:"6px"}}>
                <Badge status={p.type}/> <Badge status={p.status}/>
              </div>
            </div>
            <div style={{fontSize:"13px",color:"var(--muted)",marginBottom:"16px",lineHeight:"1.5"}}>{p.address}</div>
            {p.eb_service_number && (
              <div style={{fontSize:"12px",color:"var(--muted)",marginBottom:"4px"}}>
                <strong>EB Service:</strong> {p.eb_service_number}
              </div>
            )}
            {p.property_assessment_number && (
              <div style={{fontSize:"12px",color:"var(--muted)",marginBottom:"4px"}}>
                <strong>Property Assessment:</strong> {p.property_assessment_number}
              </div>
            )}
            {p.water_connection_number && (
              <div style={{fontSize:"12px",color:"var(--muted)",marginBottom:"8px"}}>
                <strong>Water Connection:</strong> {p.water_connection_number}
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px",padding:"12px",background:"var(--bg)",borderRadius:"10px"}}>
              <div><div style={{fontSize:"11px",color:"var(--muted)",marginBottom:"4px",textTransform:"uppercase",letterSpacing:"0.5px"}}>Rent/Month</div><div style={{fontWeight:700,color:"var(--accent)",fontSize:"15px"}}>{fmt(p.monthly_rent)}</div></div>
              <div><div style={{fontSize:"11px",color:"var(--muted)",marginBottom:"4px",textTransform:"uppercase",letterSpacing:"0.5px"}}>Units</div><div style={{fontWeight:700,color:"var(--text)"}}>{p.total_units}</div></div>
              <div><div style={{fontSize:"11px",color:"var(--muted)",marginBottom:"4px",textTransform:"uppercase",letterSpacing:"0.5px"}}>Tenants</div><div style={{fontWeight:700,color:"var(--text)"}}>{p.tenant_count}</div></div>
            </div>
            <div style={{display:"flex",gap:"8px",marginTop:"16px"}}>
              <button onClick={() => open(p)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",padding:"8px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"8px",color:"var(--text)",cursor:"pointer",fontSize:"13px",fontWeight:500}}>
                <Icon name="edit" size={14}/>Edit
              </button>
              <button onClick={() => del(p.id)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",padding:"8px",background:"#ef444411",border:"1px solid #ef444433",borderRadius:"8px",color:"#ef4444",cursor:"pointer",fontSize:"13px",fontWeight:500}}>
                <Icon name="trash" size={14}/>Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      {modal && (
        <Modal title={modal?.id ? "Edit Property" : "Add Property"} onClose={() => setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <div style={{gridColumn:"1/-1"}}><Field label="Property Name"><Input value={form.name} onChange={e => set("name",e.target.value)} placeholder="e.g. Sunrise Apartments"/></Field></div>
            <div style={{gridColumn:"1/-1"}}><Field label="Full Address"><textarea value={form.address} onChange={e => set("address",e.target.value)} placeholder="Complete property address" style={{...inputStyle,height:"72px",resize:"vertical"}}/></Field></div>
            <Field label="Type"><Select value={form.type} onChange={e => set("type",e.target.value)}><option value="apartment">Apartment</option><option value="house">House</option><option value="villa">Villa</option><option value="commercial">Commercial</option></Select></Field>
            <Field label="Monthly Rent (₹)"><Input type="number" value={form.monthly_rent} onChange={e => set("monthly_rent",e.target.value)} placeholder="18000"/></Field>
            <Field label="Total Units"><Input type="number" value={form.total_units} onChange={e => set("total_units",e.target.value)}/></Field>
            <Field label="EB Service Number (Optional)"><Input value={form.eb_service_number} onChange={e => set("eb_service_number",e.target.value)} placeholder="EB Service Number"/></Field>
            <Field label="Property Assessment Number (Optional)"><Input value={form.property_assessment_number} onChange={e => set("property_assessment_number",e.target.value)} placeholder="Property Assessment Number"/></Field>
            <Field label="Water Connection Number (Optional)"><Input value={form.water_connection_number} onChange={e => set("water_connection_number",e.target.value)} placeholder="Water Connection Number"/></Field>
            <Field label="Status"><Select value={form.status} onChange={e => set("status",e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="maintenance">Maintenance</option></Select></Field>
          </div>
          <div style={{display:"flex",gap:"10px",justifyContent:"flex-end",marginTop:"8px"}}>
            <button onClick={() => setModal(null)} style={{padding:"10px 20px",border:"1px solid var(--border)",background:"var(--bg)",color:"var(--text)",borderRadius:"8px",cursor:"pointer",fontWeight:500}}>Cancel</button>
            <button onClick={save} style={{padding:"10px 24px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:600}}>Save Property</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── TENANTS ──────────────────────────────────────────────────────────────────
function Tenants() {
  const [items, setItems] = useState([]);
  const [properties, setProperties] = useState([]);
  const [modal, setModal] = useState(null);
  const [docModal, setDocModal] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [docModalFile, setDocModalFile] = useState(null);
  const [docForm, setDocForm] = useState({ document_type: 'other', description: '' });
  const [extractModal, setExtractModal] = useState(null);
  const [extractedData, setExtractedData] = useState({ name: '', dateOfBirth: '', aadharNumber: '', panNumber: '', address: '', rawText: '', error: '' });
  const [extracting, setExtracting] = useState(false);
  const [search, setSearch] = useState("");
  const blank = { name:"",email:"",phone:"",aadhar_number:"",pan_number:"",emergency_contact:"",property_id:"",unit_number:"",start_date:"",end_date:"",security_deposit:"",monthly_rent:"",status:"active",tds_applicable:false,tds_rate:5.00,tds_section:"194-IB" };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    if (!form.name?.trim()) newErrors.name = "Full Name is required";
    if (!form.phone?.trim()) newErrors.phone = "Phone number is required";
    else if (!/^[0-9]{10}$/.test(form.phone?.replace(/\s/g, ''))) newErrors.phone = "Enter valid 10-digit phone number";
    if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = "Enter valid email address";
    if (!form.property_id) newErrors.property_id = "Property is required";
    if (!form.unit_number?.trim()) newErrors.unit_number = "Unit Number is required";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const setField = (k, v) => {
    setForm(f => {
      const updated = { ...f, [k]: v };
      // Auto-calculate TDS when monthly_rent changes
      if (k === 'monthly_rent') {
        const rent = parseFloat(v) || 0;
        updated.tds_applicable = rent > 50000;
        updated.tds_rate = rent > 50000 ? 5.00 : 0;
      }
      return updated;
    });
    if (errors[k]) setErrors(e => ({ ...e, [k]: null }));
  };
  const load = useCallback(async () => {
    const [t, p] = await Promise.all([api("/tenants"), api("/properties")]);
    setItems(t); setProperties(p);
  }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k, v) => setField(k, v);
  
  const pickProperty = (pid) => {
    const p = properties.find(p => p.id == pid);
    setField("property_id", pid);
    // Auto-suggest first unit if available (in a real system, you'd fetch available units)
    if (p && !form.unit_number) {
      // Keep existing unit number if property changes, or clear if new property
      // This allows user to manually enter unit number
    }
  };
  
  const open = (item) => { 
    if (item) setForm({ ...item, start_date: item.start_date?.slice(0,10)||"", end_date: item.end_date?.slice(0,10)||"" }); 
    else setForm(blank); 
    setErrors({});
    setSelectedFile(null);
    setModal(item||true); 
  };
  const save = async () => {
    if (!validateForm()) {
      alert("Please fix the errors highlighted in the form");
      return;
    }
    try {
      let tenantId = modal?.id;
      if (modal?.id) {
        await api(`/tenants/${modal.id}`, "PUT", form);
      } else {
        const result = await api("/tenants", "POST", form);
        tenantId = result.id;
      }
      // Upload document if file selected
      if (selectedFile && tenantId) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('document_type', docForm.document_type || 'other');
        formData.append('description', docForm.description || 'Tenant document');
        const res = await fetch(`${API}/tenants/${tenantId}/documents`, {
          method: 'POST',
          body: formData
        });
        if (!res.ok) console.error('Document upload failed');
      }
      setModal(null); 
      setSelectedFile(null);
      setDocForm({ document_type: 'other', description: '' });
      load();
    } catch (err) {
      alert('Failed to save tenant: ' + err.message);
    }
  };
  const del = async (id) => { if (confirm("Delete this tenant?")) { await api(`/tenants/${id}`, "DELETE"); load(); } };
  const filtered = items.filter(t => t.name?.toLowerCase().includes(search.toLowerCase()) || t.phone?.includes(search) || t.aadhar_number?.includes(search));
  
  // Document functions
  const openDocModal = async (tenant) => {
    setDocModal(tenant);
    const docs = await api(`/tenants/${tenant.id}/documents`);
    setDocuments(docs);
  };
  
  const uploadDoc = async () => {
    if (!docModalFile) return alert('Please select a file');
    if (!docModal || !docModal.id) return alert('Error: No tenant selected');
    
    console.log(`[FRONTEND] Uploading file for tenant ${docModal.id}:`, docModalFile.name);
    const formData = new FormData();
    formData.append('file', docModalFile);
    formData.append('document_type', docForm.document_type);
    formData.append('description', docForm.description);
    
    try {
      const res = await fetch(`${API}/tenants/${docModal.id}/documents`, {
        method: 'POST',
        body: formData
      });
      
      console.log(`[FRONTEND] Upload response:`, res.status, res.statusText);
      
      if (res.ok) {
        setDocModalFile(null);
        setDocForm({ document_type: 'other', description: '' });
        const docs = await api(`/tenants/${docModal.id}/documents`);
        setDocuments(docs);
        alert('Document uploaded successfully');
      } else {
        const errorData = await res.json();
        console.error(`[FRONTEND] Upload failed:`, errorData);
        alert('Upload failed: ' + (errorData.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(`[FRONTEND] Upload exception:`, err);
      alert('Upload failed: ' + err.message);
    }
  };
  
  const deleteDoc = async (docId) => {
    if (!confirm('Delete this document?')) return;
    await api(`/documents/${docId}`, 'DELETE');
    const docs = await api(`/tenants/${docModal.id}/documents`);
    setDocuments(docs);
  };
  
  // OCR extraction functions
  const extractData = async (doc) => {
    setExtracting(true);
    try {
      const res = await fetch(`${API}/documents/${doc.id}/extract`, { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) {
        alert('Extraction failed: ' + (data.error || 'Unknown error'));
        setExtractedData({
          name: '', dateOfBirth: '', aadharNumber: '', panNumber: '', address: '',
          rawText: data.rawText || '',
          error: data.error || 'Extraction failed'
        });
        setExtractModal({ doc, tenant: docModal });
        return;
      }
      
      setExtractedData({
        name: data.extracted.name || '',
        dateOfBirth: data.extracted.dateOfBirth || '',
        aadharNumber: data.extracted.aadharNumber || '',
        panNumber: data.extracted.panNumber || '',
        address: data.extracted.address || '',
        rawText: data.rawText || '',
        error: ''
      });
      setExtractModal({ doc, tenant: docModal });
    } catch (err) {
      alert('Extraction failed: ' + err.message);
    }
    setExtracting(false);
  };
  
  const applyExtractedData = async () => {
    const payload = {};
    if (extractedData.name) payload.name = extractedData.name;
    if (extractedData.aadharNumber) payload.aadhar_number = extractedData.aadharNumber;
    if (extractedData.panNumber) payload.pan_number = extractedData.panNumber;
    
    await fetch(`${API}/tenants/${extractModal.tenant.id}/update-from-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    setExtractModal(null);
    setExtractedData({ name: '', dateOfBirth: '', aadharNumber: '', panNumber: '', address: '', rawText: '', error: '' });
    load();
  };
  
  // Generic text extraction for copy-paste
  const extractContent = async (docId) => {
    setExtracting(true);
    try {
      const res = await fetch(`${API}/documents/${docId}/extract-content`, { method: 'POST' });
      const data = await res.json();
      if (data.copyPaste) {
        navigator.clipboard.writeText(data.copyPaste).then(() => {
          alert('Content copied to clipboard!');
        });
      } else {
        alert(data.error || 'Failed to extract content');
      }
    } catch (err) {
      alert('Extraction failed: ' + err.message);
    } finally {
      setExtracting(false);
    }
  };
  
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
        <div>
          <h1 style={{fontSize:"26px",fontWeight:800,color:"var(--text)",margin:0}}>Tenants</h1>
          <p style={{color:"var(--muted)",margin:"4px 0 0",fontSize:"14px"}}>{items.length} registered tenants</p>
        </div>
        <button onClick={() => open(null)} style={{display:"flex",alignItems:"center",gap:"8px",padding:"10px 20px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:"10px",fontWeight:600,cursor:"pointer",fontSize:"14px"}}>
          <Icon name="plus" size={16}/>Add Tenant
        </button>
      </div>
      <div style={{marginBottom:"16px"}}>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, or Aadhar…" style={{maxWidth:"360px"}}/>
      </div>
      <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"16px",overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
          <thead style={{background:"var(--bg)"}}>
            <tr style={{color:"var(--muted)",fontWeight:600,textTransform:"uppercase",fontSize:"11px",letterSpacing:"0.5px"}}>
              {["ID","Tenant","Contact","Property/Unit","IDs","Tenancy Period","Tenure Remaining","Status",""].map((h,i) => (
                <th key={i} style={{textAlign:"left",padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} style={{borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"12px 16px",color:"var(--muted)",fontFamily:"monospace",fontSize:"12px"}}>#{t.id}</td>
                <td style={{padding:"12px 16px"}}>
                  <div style={{fontWeight:700,color:"var(--text)"}}>{t.name}</div>
                  <div style={{fontSize:"11px",color:"var(--muted)"}}>{t.email}</div>
                </td>
                <td style={{padding:"12px 16px",color:"var(--muted)"}}>{t.phone}<br/><span style={{fontSize:"11px"}}>Emer: {t.emergency_contact||"—"}</span></td>
                <td style={{padding:"12px 16px"}}>
                  <div style={{fontWeight:500,color:"var(--text)",fontSize:"12px"}}>{t.property_name||"—"}</div>
                  <div style={{fontSize:"11px",color:"var(--muted)"}}>Unit: {t.unit_number||"—"}</div>
                  {t.monthly_rent && <div style={{fontSize:"11px",color:"var(--muted)"}}>Rent: ₹{t.monthly_rent}</div>}
                </td>
                <td style={{padding:"12px 16px",fontSize:"11px",color:"var(--muted)"}}>
                  <div>Aadhar: {t.aadhar_number||"—"}</div>
                  <div>PAN: {t.pan_number||"—"}</div>
                </td>
                <td style={{padding:"12px 16px",fontSize:"12px",color:"var(--muted)"}}>
                  <div>{fmtDate(t.start_date)}</div>
                  <div>to {fmtDate(t.end_date)}</div>
                </td>
                <td style={{padding:"12px 16px",fontSize:"12px",color:"var(--muted)"}}>
                  {(() => {
                    if (!t.start_date) return '—';
                    const start = new Date(t.start_date);
                    const end = t.end_date ? new Date(t.end_date) : new Date();
                    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
                    const years = Math.floor(months / 12);
                    const remainingMonths = months % 12;
                    
                    if (years > 0 && remainingMonths > 0) {
                      return `${years}y ${remainingMonths}m`;
                    } else if (years > 0) {
                      return `${years}y`;
                    } else {
                      return `${remainingMonths}m`;
                    }
                  })()}
                </td>
                <td style={{padding:"12px 16px"}}>
                  <Badge status={t.status}/>    
                </td>
                <td style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",gap:"6px"}}>
                    <button onClick={() => open(t)} style={{padding:"6px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"6px",color:"var(--text)",cursor:"pointer"}}><Icon name="edit" size={13}/></button>
                    <button onClick={() => openDocModal(t)} style={{padding:"6px",background:"#3b82f622",border:"1px solid #3b82f644",borderRadius:"6px",color:"#3b82f6",cursor:"pointer"}} title="Documents"><Icon name="file" size={13}/></button>
                    <button onClick={() => del(t.id)} style={{padding:"6px",background:"#ef444411",border:"1px solid #ef444433",borderRadius:"6px",color:"#ef4444",cursor:"pointer"}}><Icon name="trash" size={13}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <div style={{padding:"40px",textAlign:"center",color:"var(--muted)"}}>No tenants found</div>}
      </div>
      {modal && (
        <Modal title={modal?.id ? "Edit Tenant" : "Add Tenant"} onClose={() => setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Field label="Full Name *" error={errors.name}><Input value={form.name} onChange={e => set("name",e.target.value)} placeholder="Rajesh Kumar" style={errors.name ? {borderColor:"#ef4444"} : {}}/></Field>
            <Field label="Phone *" error={errors.phone}><Input value={form.phone} onChange={e => set("phone",e.target.value)} placeholder="9876543210" style={errors.phone ? {borderColor:"#ef4444"} : {}}/></Field>
            <Field label="Email" error={errors.email}><Input type="email" value={form.email} onChange={e => set("email",e.target.value)} placeholder="tenant@email.com (optional)" style={errors.email ? {borderColor:"#ef4444"} : {}}/></Field>
            <Field label="Emergency Contact"><Input value={form.emergency_contact} onChange={e => set("emergency_contact",e.target.value)} placeholder="9876543211"/></Field>
            <Field label="Aadhar Number"><Input value={form.aadhar_number} onChange={e => set("aadhar_number",e.target.value)} placeholder="1234 5678 9012"/></Field>
            <Field label="PAN Number"><Input value={form.pan_number} onChange={e => set("pan_number",e.target.value)} placeholder="ABCDE1234F"/></Field>
            <Field label="Property *" error={errors.property_id}><Select value={form.property_id} onChange={e => pickProperty(e.target.value)} style={errors.property_id ? {borderColor:"#ef4444"} : {}}><option value="">Select property…</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
            <Field label="Unit Number *" error={errors.unit_number}><Input value={form.unit_number} onChange={e => set("unit_number",e.target.value)} placeholder="A-101" style={errors.unit_number ? {borderColor:"#ef4444"} : {}}/></Field>
            <Field label="Start Date"><Input type="date" value={form.start_date} onChange={e => set("start_date",e.target.value)}/></Field>
            <Field label="End Date"><Input type="date" value={form.end_date} onChange={e => set("end_date",e.target.value)}/></Field>
            <Field label="Monthly Rent (₹)"><Input type="number" value={form.monthly_rent} onChange={e => set("monthly_rent",e.target.value)} placeholder="36000"/></Field>
            <Field label="Security Deposit (₹)"><Input type="number" value={form.security_deposit} onChange={e => set("security_deposit",e.target.value)} placeholder="36000"/></Field>
            <Field label="Status"><Select value={form.status} onChange={e => set("status",e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="notice">Notice Period</option></Select></Field>
            {form.tds_applicable && (
              <div style={{gridColumn:"1/-1",padding:"12px",background:"#fef3c7",borderRadius:"8px",border:"1px solid #f59e0b",marginBottom:"12px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px",color:"#92400e",fontWeight:600}}>
                  <span style={{fontSize:"18px"}}>⚠️</span>
                  <span>TDS Applicable (Section 194-IB)</span>
                </div>
                <div style={{fontSize:"13px",color:"#92400e"}}>
                  Monthly rent exceeds ₹50,000. TDS at {form.tds_rate}% = ₹{(form.monthly_rent * form.tds_rate / 100).toFixed(2)}/month
                  <br/><small>Must deduct and deposit TDS to government monthly</small>
                </div>
              </div>
            )}
            <div style={{gridColumn:"1/-1"}}><Field label="Upload Document (optional)">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
                <Select value={docForm.document_type} onChange={e => setDocForm({...docForm, document_type: e.target.value})}>
                  <option value="aadhar">Aadhar Card</option>
                  <option value="pan">PAN Card</option>
                  <option value="lease">Lease Agreement</option>
                  <option value="agreement">Rental Agreement</option>
                  <option value="id_proof">ID Proof</option>
                  <option value="address_proof">Address Proof</option>
                  <option value="other">Other</option>
                </Select>
                <input type="file" onChange={e => setSelectedFile(e.target.files[0])} style={inputStyle} accept=".pdf,.jpg,.jpeg,.png"/>
              </div>
            </Field></div>
            {selectedFile && (
              <div style={{gridColumn:"1/-1",fontSize:"12px",color:"var(--muted)"}}>
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:"10px",justifyContent:"flex-end",marginTop:"8px"}}>
            <button onClick={() => setModal(null)} style={{padding:"10px 20px",border:"1px solid var(--border)",background:"var(--bg)",color:"var(--text)",borderRadius:"8px",cursor:"pointer",fontWeight:500}}>Cancel</button>
            <button onClick={save} style={{padding:"10px 24px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:600}}>Save Tenant</button>
          </div>
        </Modal>
      )}
      
      {/* Document Upload Modal */}
      {docModal && (
        <Modal title={`Documents - ${docModal.name}`} onClose={() => { setDocModal(null); setDocuments([]); setDocModalFile(null); }}>
          <div style={{marginBottom:"20px",padding:"16px",background:"var(--bg)",borderRadius:"12px"}}>
            <h4 style={{margin:"0 0 12px",fontSize:"14px",color:"var(--text)"}}>Upload New Document</h4>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"12px"}}>
              <Field label="Document Type">
                <Select value={docForm.document_type} onChange={e => setDocForm({...docForm, document_type: e.target.value})}>
                  <option value="aadhar">Aadhar Card</option>
                  <option value="pan">PAN Card</option>
                  <option value="lease">Lease Agreement</option>
                  <option value="agreement">Rental Agreement</option>
                  <option value="id_proof">ID Proof</option>
                  <option value="address_proof">Address Proof</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Select File">
                <input type="file" onChange={e => setDocModalFile(e.target.files[0])} style={inputStyle} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"/>
              </Field>
            </div>
            <Field label="Description (optional)">
              <input type="text" value={docForm.description} onChange={e => setDocForm({...docForm, description: e.target.value})} placeholder="Document description..." style={inputStyle}/>
            </Field>
            {docModalFile && (
              <div style={{fontSize:"12px",color:"var(--muted)",marginTop:"8px"}}>
                Selected: {docModalFile.name} ({formatFileSize(docModalFile.size)})
              </div>
            )}
            <button onClick={uploadDoc} disabled={!docModalFile} style={{marginTop:"12px",padding:"8px 16px",background:docModalFile?"var(--accent)":"var(--border)",color:"#fff",border:"none",borderRadius:"8px",cursor:docModalFile?"pointer":"not-allowed",fontWeight:600}}>
              Upload Document
            </button>
          </div>
          
          <h4 style={{margin:"0 0 12px",fontSize:"14px",color:"var(--text)"}}>Uploaded Documents ({documents.length})</h4>
          {documents.length === 0 ? (
            <div style={{textAlign:"center",padding:"20px",color:"var(--muted)"}}>No documents uploaded yet</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {documents.map(doc => (
                <div key={doc.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px",background:"var(--bg)",borderRadius:"8px",border:"1px solid var(--border)"}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:"13px",color:"var(--text)"}}>{doc.original_name}</div>
                    <div style={{fontSize:"11px",color:"var(--muted)"}}>
                      <Badge status={doc.document_type}/> · {formatFileSize(doc.file_size)} · {fmtDate(doc.uploaded_at)}
                    </div>
                    {doc.description && <div style={{fontSize:"11px",color:"var(--muted)",marginTop:"2px"}}>{doc.description}</div>}
                  </div>
                  <div style={{display:"flex",gap:"6px"}}>
                    {(doc.document_type === 'aadhar' || doc.document_type === 'pan') && (
                      <button onClick={() => extractData(doc)} disabled={extracting} style={{padding:"6px 12px",background:"#22c55e22",border:"1px solid #22c55e44",borderRadius:"6px",color:"#22c55e",cursor:"pointer",fontSize:"12px",fontWeight:500}}>
                        {extracting ? 'Extracting...' : 'Extract'}
                      </button>
                    )}
                    <button onClick={() => extractContent(doc.id)} disabled={extracting} style={{padding:"6px 12px",background:"#3b82f622",border:"1px solid #3b82f644",borderRadius:"6px",color:"#3b82f6",cursor:"pointer",fontSize:"12px",fontWeight:500}}>
                      {extracting ? 'Extracting...' : 'Extract Text'}
                    </button>
                    <a href={`${API}/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer" style={{padding:"6px 12px",background:"#3b82f622",border:"1px solid #3b82f644",borderRadius:"6px",color:"#3b82f6",textDecoration:"none",fontSize:"12px",fontWeight:500}}>View</a>
                    <button onClick={() => deleteDoc(doc.id)} style={{padding:"6px",background:"#ef444411",border:"1px solid #ef444433",borderRadius:"6px",color:"#ef4444",cursor:"pointer"}}><Icon name="trash" size={12}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
      
      {/* Extracted Data Preview Modal */}
      {extractModal && (
        <Modal title="Review Extracted Data" onClose={() => { setExtractModal(null); setExtractedData({ name: '', dateOfBirth: '', aadharNumber: '', panNumber: '', address: '', rawText: '', error: '' }); }}>
          {extractedData.error && (
            <div style={{background:"#ef444422",border:"1px solid #ef444444",borderRadius:"8px",padding:"12px",marginBottom:"16px",color:"#ef4444",fontSize:"13px"}}>
              <strong>Error:</strong> {extractedData.error}
            </div>
          )}
          
          <p style={{fontSize:"12px",color:"var(--muted)",marginBottom:"16px"}}>Review and edit the extracted information before applying to tenant profile.</p>
          
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"16px"}}>
            <Field label="Name">
              <input type="text" value={extractedData.name} onChange={e => setExtractedData({...extractedData, name: e.target.value})} style={inputStyle}/>
            </Field>
            <Field label="Date of Birth">
              <input type="text" value={extractedData.dateOfBirth} onChange={e => setExtractedData({...extractedData, dateOfBirth: e.target.value})} style={inputStyle}/>
            </Field>
            <Field label="Aadhar Number">
              <input type="text" value={extractedData.aadharNumber} onChange={e => setExtractedData({...extractedData, aadharNumber: e.target.value})} style={inputStyle}/>
            </Field>
            <Field label="PAN Number">
              <input type="text" value={extractedData.panNumber} onChange={e => setExtractedData({...extractedData, panNumber: e.target.value})} style={inputStyle}/>
            </Field>
            <div style={{gridColumn:"1/-1"}}>
              <Field label="Address">
                <textarea value={extractedData.address} onChange={e => setExtractedData({...extractedData, address: e.target.value})} style={{...inputStyle,height:"60px",resize:"vertical"}}/>
              </Field>
            </div>
          </div>
          
          {extractedData.rawText && (
            <div style={{marginBottom:"16px"}}>
              <Field label="Raw Extracted Text (for debugging)">
                <textarea value={extractedData.rawText} readOnly style={{...inputStyle,height:"100px",resize:"vertical",fontSize:"11px",fontFamily:"monospace",background:"var(--bg)"}}/>
              </Field>
            </div>
          )}
          
          <div style={{display:"flex",gap:"10px",justifyContent:"flex-end"}}>
            <button onClick={() => setExtractModal(null)} style={{padding:"10px 20px",border:"1px solid var(--border)",background:"var(--bg)",color:"var(--text)",borderRadius:"8px",cursor:"pointer",fontWeight:500}}>Cancel</button>
            <button onClick={applyExtractedData} disabled={!extractedData.name && !extractedData.aadharNumber && !extractedData.panNumber} style={{padding:"10px 24px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:600,opacity:(!extractedData.name && !extractedData.aadharNumber && !extractedData.panNumber)?0.5:1}}>Apply to Tenant</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── COLLECTIONS ─────────────────────────────────────────────────────────────
function Collections() {
  const [items, setItems] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [modal, setModal] = useState(null);
  const [uploadModal, setUploadModal] = useState(null);
  const [collectionDocs, setCollectionDocs] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filter, setFilter] = useState("all");
  const [extracting, setExtracting] = useState(false);
  const blank = { tenant_id:"",property_id:"",amount:"",payment_date:new Date().toISOString().slice(0,10),payment_method:"upi",category:"rent",month_year:getCurrentMonthYear(),status:"paid",notes:"",reference_number:"" };
  const [form, setForm] = useState(blank);
  const [paymentFile, setPaymentFile] = useState(null);
  const load = useCallback(async () => {
    const [c, t, p] = await Promise.all([api("/collections"), api("/tenants"), api("/properties")]);
    setItems(c); setTenants(t); setProperties(p);
  }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const pickTenant = (tid) => {
    const t = tenants.find(t => t.id == tid);
    set("tenant_id", tid);
    if (t) {
      set("property_id", t.property_id || "");
      // Look up the property to get its monthly_rent
      const property = properties.find(p => p.id == t.property_id);
      set("amount", property?.monthly_rent || "");
    }
  };
  const open = (item) => { 
    if (item) setForm({ ...item, payment_date: item.payment_date?.slice(0,10)||"", payment_method: item.payment_method||"upi", category: item.category||"rent" }); 
    else setForm(blank); 
    setPaymentFile(null);
    setModal(item||true); 
  };
  const save = async () => {
    try {
      let collectionId = modal?.id;
      
      // First save the collection data
      if (modal?.id) {
        await api(`/collections/${modal.id}`, "PUT", form);
      } else {
        const result = await api("/collections", "POST", form);
        collectionId = result.id;
      }
      
      // Then upload the payment proof if a file was selected
      if (paymentFile && collectionId) {
        const formData = new FormData();
        formData.append('file', paymentFile);
        formData.append('description', 'Payment proof');
        
        const res = await fetch(`${API}/collections/${collectionId}/documents`, {
          method: 'POST',
          body: formData
        });
        
        if (!res.ok) {
          console.error('Payment proof upload failed');
        } else {
          // Optionally extract reference number automatically
          const extractRes = await fetch(`${API}/collections/${collectionId}/extract-reference`, { method: 'POST' });
          const extractData = await extractRes.json();
          if (extractData.extractedReference) {
            console.log(`Auto-extracted reference: ${extractData.extractedReference}`);
          }
        }
      }
      
      setModal(null); 
      setPaymentFile(null);
      load();
    } catch (err) {
      alert('Failed to save collection: ' + err.message);
    }
  };
  const del = async (id) => { if (confirm("Delete this record?")) { await api(`/collections/${id}`, "DELETE"); load(); } };
  const filtered = filter === "all" ? items : items.filter(i => i.status === filter);
  const total = filtered.reduce((s, i) => s + parseFloat(i.amount||0), 0);
  
  const collectionCats = { rent: "#22c55e", utilities: "#3b82f6", advance: "#f59e0b", maintenance: "#8b5cf6", deposit: "#ec4899", other: "#94a3b8" };
  
  // Collection document functions
  const openUploadModal = async (collection) => {
    setUploadModal(collection);
    const docs = await api(`/collections/${collection.id}/documents`);
    setCollectionDocs(docs);
  };
  
  const uploadCollectionDoc = async () => {
    if (!selectedFile) return alert('Please select a file');
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('description', 'Payment proof');
    
    const res = await fetch(`${API}/collections/${uploadModal.id}/documents`, {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      setSelectedFile(null);
      const docs = await api(`/collections/${uploadModal.id}/documents`);
      setCollectionDocs(docs);
    } else {
      alert('Upload failed');
    }
  };
  
  const deleteCollectionDoc = async (docId) => {
    if (!confirm('Delete this payment proof?')) return;
    await api(`/collection-documents/${docId}`, 'DELETE');
    const docs = await api(`/collections/${uploadModal.id}/documents`);
    setCollectionDocs(docs);
  };
  
  // Generate receipt for collection
  const generateReceipt = async (collection) => {
    if (collection.receipt_id) {
      alert('Receipt already exists for this collection');
      return;
    }
    
    try {
      const res = await api('/receipts/generate', 'POST', {
        collection_id: collection.id,
        receipt_date: new Date().toISOString().slice(0,10)
      });
      alert(`Receipt generated: ${res.receipt.receipt_number}`);
      load(); // Refresh to show receipt_id
    } catch (err) {
      alert('Failed to generate receipt: ' + err.message);
    }
  };
  
  // Generic text extraction for copy-paste
  const extractContent = async (docId) => {
    setExtracting(true);
    try {
      const res = await fetch(`${API}/documents/${docId}/extract-content`, { method: 'POST' });
      const data = await res.json();
      if (data.copyPaste) {
        navigator.clipboard.writeText(data.copyPaste).then(() => {
          alert('Content copied to clipboard!');
        });
      } else {
        alert(data.error || 'Failed to extract content');
      }
    } catch (err) {
      alert('Extraction failed: ' + err.message);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
        <div>
          <h1 style={{fontSize:"26px",fontWeight:800,color:"var(--text)",margin:0}}>Rent Collections</h1>
          <p style={{color:"var(--muted)",margin:"4px 0 0",fontSize:"14px"}}>{filtered.length} records · Total: {fmt(total)}</p>
        </div>
        <button onClick={() => open(null)} style={{display:"flex",alignItems:"center",gap:"8px",padding:"10px 20px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:"10px",fontWeight:600,cursor:"pointer",fontSize:"14px"}}>
          <Icon name="plus" size={16}/>Record Payment
        </button>
      </div>
      <div style={{display:"flex",gap:"8px",marginBottom:"16px",flexWrap:"wrap"}}>
        {["all","paid","pending","partial","overdue"].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{padding:"6px 14px",borderRadius:"20px",fontSize:"12px",fontWeight:600,cursor:"pointer",textTransform:"capitalize",border:`1px solid ${filter===s?"var(--accent)":"var(--border)"}`,background:filter===s?"var(--accent)":"var(--card)",color:filter===s?"#fff":"var(--muted)"}}>
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>
      <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"16px",overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
          <thead style={{background:"var(--bg)"}}>
            <tr style={{color:"var(--muted)",fontWeight:600,textTransform:"uppercase",fontSize:"11px",letterSpacing:"0.5px"}}>
              {["Tenant","Property","Category","Month","Date","Method","Ref. No.","Amount","Status","Receipt",""].map((h,i) => (
                <th key={i} style={{textAlign:i===7?"right":"left",padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const catColor = collectionCats[c.category] || "#94a3b8";
              return (
                <tr key={c.id} style={{borderBottom:"1px solid var(--border)"}}>
                  <td style={{padding:"12px 16px",fontWeight:600,color:"var(--text)"}}>{c.tenant_name}</td>
                  <td style={{padding:"12px 16px",color:"var(--muted)",fontSize:"12px"}}>{c.property_name}</td>
                  <td style={{padding:"12px 16px"}}>
                    <span style={{display:"inline-block",padding:"3px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:600,background:catColor+"22",color:catColor,textTransform:"capitalize"}}>{c.category}</span>
                  </td>
                  <td style={{padding:"12px 16px",color:"var(--muted)"}}>{c.month_year}</td>
                  <td style={{padding:"12px 16px",color:"var(--muted)"}}>{fmtDate(c.payment_date)}</td>
                  <td style={{padding:"12px 16px",color:"var(--muted)",textTransform:"capitalize"}}>{c.payment_method?.replace("_"," ")}</td>
                  <td style={{padding:"12px 16px",color:"var(--muted)",fontSize:"11px",fontFamily:"monospace"}}>{c.reference_number||"—"}</td>
                  <td style={{padding:"12px 16px",textAlign:"right",fontWeight:700,color:"#22c55e",fontSize:"14px"}}>{fmt(c.amount)}</td>
                  <td style={{padding:"12px 16px"}}><Badge status={c.status}/></td>
                  <td style={{padding:"12px 16px"}}>
                    {c.receipt_id ? (
                      <span style={{display:"inline-flex",alignItems:"center",gap:"4px",padding:"4px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:600,background:"#22c55e22",color:"#22c55e"}}>
                        <Icon name="receipt" size={12}/> Generated
                      </span>
                    ) : (
                      <span style={{display:"inline-flex",alignItems:"center",gap:"4px",padding:"4px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:600,background:"#ef444422",color:"#ef4444"}}>
                        <Icon name="warn" size={12}/> Not Generated
                      </span>
                    )}
                  </td>
                  <td style={{padding:"12px 16px"}}>
                    <div style={{display:"flex",gap:"6px"}}>
                      <button onClick={() => open(c)} style={{padding:"6px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"6px",color:"var(--text)",cursor:"pointer"}}><Icon name="edit" size={13}/></button>
                      <button onClick={() => openUploadModal(c)} style={{padding:"6px",background:"#3b82f622",border:"1px solid #3b82f644",borderRadius:"6px",color:"#3b82f6",cursor:"pointer"}} title="Payment Proof"><Icon name="file" size={13}/></button>
                      <button 
                        onClick={() => generateReceipt(c)} 
                        style={{
                          padding:"6px", 
                          background: c.receipt_id ? "#22c55e22" : "#f59e0b22", 
                          border: c.receipt_id ? "1px solid #22c55e44" : "1px solid #f59e0b44", 
                          borderRadius:"6px", 
                          color: c.receipt_id ? "#22c55e" : "#f59e0b", 
                          cursor: c.receipt_id ? "default" : "pointer",
                          opacity: c.receipt_id ? 0.7 : 1
                        }} 
                        title={c.receipt_id ? "Receipt Generated" : "Generate Receipt"}
                        disabled={c.receipt_id}
                      >
                        <Icon name="receipt" size={13}/>
                      </button>
                      <button onClick={() => del(c.id)} style={{padding:"6px",background:"#ef444411",border:"1px solid #ef444433",borderRadius:"6px",color:"#ef4444",cursor:"pointer"}}><Icon name="trash" size={13}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && <div style={{padding:"40px",textAlign:"center",color:"var(--muted)"}}>No records found</div>}
      </div>
      {modal && (
        <Modal title={modal?.id ? "Edit Collection" : "Record Payment"} onClose={() => setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Field label="Tenant"><Select value={form.tenant_id} onChange={e => pickTenant(e.target.value)}><option value="">Select tenant…</option>{tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
            <Field label="Property"><Select value={form.property_id} onChange={e => set("property_id",e.target.value)}><option value="">Select property…</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
            <Field label="Amount (₹)"><Input type="number" value={form.amount} onChange={e => set("amount",e.target.value)} placeholder="18000"/></Field>
            <Field label="Category"><Select value={form.category} onChange={e => set("category",e.target.value)}>{["rent","utilities","advance","maintenance","deposit","other"].map(c => <option key={c} value={c} style={{textTransform:"capitalize"}}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}</Select></Field>
            <Field label="Month/Year"><Input value={form.month_year} onChange={e => set("month_year",e.target.value)} placeholder={getCurrentMonthYear()}/></Field>
            <Field label="Payment Date"><Input type="date" value={form.payment_date} onChange={e => set("payment_date",e.target.value)}/></Field>
            <Field label="Payment Method"><Select value={form.payment_method} onChange={e => set("payment_method",e.target.value)}><option value="upi">UPI</option><option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option><option value="cheque">Cheque</option></Select></Field>
            <Field label="Status"><Select value={form.status} onChange={e => set("status",e.target.value)}><option value="paid">Paid</option><option value="pending">Pending</option><option value="partial">Partial</option><option value="overdue">Overdue</option></Select></Field>
            <Field label="Reference Number"><Input value={form.reference_number} onChange={e => set("reference_number",e.target.value)} placeholder="UPI/NEFT/Cheque ref…"/></Field>
            <Field label="Payment Proof"><input type="file" onChange={e => setPaymentFile(e.target.files[0])} style={inputStyle} accept=".pdf,.jpg,.jpeg,.png"/></Field>
            {paymentFile && (
              <div style={{gridColumn:"1/-1",fontSize:"12px",color:"var(--muted)"}}>
                Selected file: {paymentFile.name} ({(paymentFile.size / 1024).toFixed(1)} KB)
              </div>
            )}
            <div style={{gridColumn:"1/-1"}}><Field label="Notes (optional)"><textarea value={form.notes} onChange={e => set("notes",e.target.value)} placeholder="Any additional notes…" style={{...inputStyle,height:"60px",resize:"vertical"}}/></Field></div>
          </div>
          <div style={{display:"flex",gap:"10px",justifyContent:"flex-end",marginTop:"8px"}}>
            <button onClick={() => setModal(null)} style={{padding:"10px 20px",border:"1px solid var(--border)",background:"var(--bg)",color:"var(--text)",borderRadius:"8px",cursor:"pointer",fontWeight:500}}>Cancel</button>
            <button onClick={save} style={{padding:"10px 24px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:600}}>Save</button>
          </div>
        </Modal>
      )}
      
      {/* Collection Document Upload Modal */}
      {uploadModal && (
        <Modal title={`Payment Proof - ${uploadModal.tenant_name}`} onClose={() => { setUploadModal(null); setCollectionDocs([]); setSelectedFile(null); }}>
          <div style={{marginBottom:"20px",padding:"16px",background:"var(--bg)",borderRadius:"12px"}}>
            <h4 style={{margin:"0 0 12px",fontSize:"14px",color:"var(--text)"}}>Upload Payment Proof</h4>
            <div style={{marginBottom:"12px"}}>
              <Field label="Select File (Screenshot, PDF, Image)">
                <input type="file" onChange={e => setSelectedFile(e.target.files[0])} style={inputStyle} accept=".pdf,.jpg,.jpeg,.png"/>
              </Field>
            </div>
            {selectedFile && (
              <div style={{fontSize:"12px",color:"var(--muted)",marginTop:"8px",marginBottom:"12px"}}>
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            )}
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={uploadCollectionDoc} disabled={!selectedFile} style={{padding:"8px 16px",background:selectedFile?"var(--accent)":"var(--border)",color:"#fff",border:"none",borderRadius:"8px",cursor:selectedFile?"pointer":"not-allowed",fontWeight:600}}>
                Upload
              </button>
              {collectionDocs.length > 0 && (
                <button onClick={async () => {
                  const res = await fetch(`${API}/collections/${uploadModal.id}/extract-reference`, { method: 'POST' });
                  const data = await res.json();
                  if (data.extractedReference) {
                    alert(`Reference number extracted: ${data.extractedReference}`);
                    load();
                  } else {
                    alert('Could not extract reference number. Please enter manually.');
                  }
                }} style={{padding:"8px 16px",background:"#22c55e",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:600}}>
                  Extract Ref
                </button>
              )}
            </div>
          </div>
          
          <h4 style={{margin:"0 0 12px",fontSize:"14px",color:"var(--text)"}}>Uploaded Documents ({collectionDocs.length})</h4>
          {collectionDocs.length === 0 ? (
            <div style={{textAlign:"center",padding:"20px",color:"var(--muted)"}}>No payment proof uploaded yet</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {collectionDocs.map(doc => (
                <div key={doc.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px",background:"var(--bg)",borderRadius:"8px",border:"1px solid var(--border)"}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:"13px",color:"var(--text)"}}>{doc.original_name}</div>
                    <div style={{fontSize:"11px",color:"var(--muted)"}}>{(doc.file_size / 1024).toFixed(1)} KB · {fmtDate(doc.uploaded_at)}</div>
                  </div>
                  <div style={{display:"flex",gap:"6px"}}>
                    <button onClick={() => extractContent(doc.id)} disabled={extracting} style={{padding:"6px 12px",background:"#3b82f622",border:"1px solid #3b82f644",borderRadius:"6px",color:"#3b82f6",cursor:"pointer",fontSize:"12px",fontWeight:500}}>
                      {extracting ? 'Extracting...' : 'Extract Text'}
                    </button>
                    <a href={`${API}/collection-documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer" style={{padding:"6px 12px",background:"#3b82f622",border:"1px solid #3b82f644",borderRadius:"6px",color:"#3b82f6",textDecoration:"none",fontSize:"12px",fontWeight:500}}>View</a>
                    <button onClick={() => deleteCollectionDoc(doc.id)} style={{padding:"6px",background:"#ef444411",border:"1px solid #ef444433",borderRadius:"6px",color:"#ef4444",cursor:"pointer"}}><Icon name="trash" size={12}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function Expenses() {
  const [items, setItems] = useState([]);
  const [properties, setProperties] = useState([]);
  const [modal, setModal] = useState(null);
  const [docModal, setDocModal] = useState(null);
  const [expenseDocs, setExpenseDocs] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractingContent, setExtractingContent] = useState(false);
  const [contentModal, setContentModal] = useState(null);
  const [extractedContent, setExtractedContent] = useState('');
  const blank = { property_id:"",category:"maintenance",description:"",amount:"",expense_date:new Date().toISOString().slice(0,10),vendor:"",status:"paid",receipt_number:"" };
  const [form, setForm] = useState(blank);
  const [expenseFile, setExpenseFile] = useState(null);
  const load = useCallback(async () => {
    const [e, p] = await Promise.all([api("/expenses"), api("/properties")]);
    setItems(e); setProperties(p);
  }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const open = (item) => { 
    if (item) setForm({ ...item, expense_date: item.expense_date?.slice(0,10)||"", property_id: item.property_id||"" }); 
    else setForm(blank); 
    setExpenseFile(null);
    setModal(item||true); 
  };
  const save = async () => {
    try {
      let expenseId = modal?.id;
      if (modal?.id) {
        await api(`/expenses/${modal.id}`, "PUT", form);
      } else {
        const result = await api("/expenses", "POST", form);
        expenseId = result.id;
      }
      if (expenseFile && expenseId) {
        const formData = new FormData();
        formData.append('file', expenseFile);
        formData.append('description', 'Expense receipt');
        const res = await fetch(`${API}/expenses/${expenseId}/documents`, {
          method: 'POST',
          body: formData
        });
        if (!res.ok) {
          console.error('Expense receipt upload failed');
        }
      }
      setModal(null); 
      setExpenseFile(null);
      load();
    } catch (err) {
      alert('Failed to save expense: ' + err.message);
    }
  };
  const del = async (id) => { 
    if (!confirm("Delete this expense?")) return;
    try {
      await api(`/expenses/${id}`, "DELETE"); 
      load(); 
    } catch (err) {
      alert('Failed to delete expense: ' + err.message);
    }
  };
  const total = items.reduce((s, i) => s + parseFloat(i.amount||0), 0);

  const catColors = { maintenance:"#3b82f6", utilities:"#06b6d4", taxes:"#f59e0b", insurance:"#8b5cf6", repairs:"#ef4444", cleaning:"#22c55e", security:"#f97316", other:"#94a3b8" };
  
  const openDocModal = async (expense) => {
    setDocModal(expense);
    const docs = await api(`/expenses/${expense.id}/documents`);
    setExpenseDocs(docs);
  };
  
  const uploadExpenseDoc = async () => {
    if (!selectedFile) return alert('Please select a file');
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('description', 'Expense receipt');
    const res = await fetch(`${API}/expenses/${docModal.id}/documents`, {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      setSelectedFile(null);
      const docs = await api(`/expenses/${docModal.id}/documents`);
      setExpenseDocs(docs);
    } else {
      alert('Upload failed');
    }
  };
  
  const deleteExpenseDoc = async (docId) => {
    if (!confirm('Delete this receipt?')) return;
    await api(`/expense-documents/${docId}`, 'DELETE');
    const docs = await api(`/expenses/${docModal.id}/documents`);
    setExpenseDocs(docs);
  };
  
  const extractContent = async (docId) => {
    setExtractingContent(true);
    try {
      const res = await fetch(`${API}/documents/${docId}/extract-content`, { method: 'POST' });
      const data = await res.json();
      if (data.copyPaste) {
        setExtractedContent(data.copyPaste);
        setContentModal(true);
      } else {
        alert(data.error || 'Failed to extract content');
      }
    } catch (err) {
      alert('Extraction failed: ' + err.message);
    } finally {
      setExtractingContent(false);
    }
  };
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(extractedContent).then(() => {
      alert('Content copied to clipboard!');
    });
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
        <div>
          <h1 style={{fontSize:"26px",fontWeight:800,color:"var(--text)",margin:0}}>Expenses</h1>
          <p style={{color:"var(--muted)",margin:"4px 0 0",fontSize:"14px"}}>{items.length} records · Total: {fmt(total)}</p>
        </div>
        <button onClick={() => open(null)} style={{display:"flex",alignItems:"center",gap:"8px",padding:"10px 20px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:"10px",fontWeight:600,cursor:"pointer",fontSize:"14px"}}>
          <Icon name="plus" size={16}/>Add Expense
        </button>
      </div>
      <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"16px",overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
          <thead style={{background:"var(--bg)"}}>
            <tr style={{color:"var(--muted)",fontWeight:600,textTransform:"uppercase",fontSize:"11px",letterSpacing:"0.5px"}}>
              {["Category","Description","Property","Vendor","Date","Receipt","Amount","Status",""].map((h,i) => (
                <th key={i} style={{textAlign:i===6?"right":"left",padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(e => {
              const c = catColors[e.category] || "#94a3b8";
              return (
                <tr key={e.id} style={{borderBottom:"1px solid var(--border)"}}>
                  <td style={{padding:"12px 16px"}}>
                    <span style={{display:"inline-block",padding:"3px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:600,background:c+"22",color:c,textTransform:"capitalize"}}>{e.category}</span>
                  </td>
                  <td style={{padding:"12px 16px",color:"var(--text)",fontWeight:500,maxWidth:"200px"}}><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.description}</div></td>
                  <td style={{padding:"12px 16px",color:"var(--muted)",fontSize:"12px"}}>{e.property_name||"General"}</td>
                  <td style={{padding:"12px 16px",color:"var(--muted)",fontSize:"12px"}}>{e.vendor||"—"}</td>
                  <td style={{padding:"12px 16px",color:"var(--muted)"}}>{fmtDate(e.expense_date)}</td>
                  <td style={{padding:"12px 16px",color:"var(--muted)",fontSize:"11px",fontFamily:"monospace"}}>{e.receipt_number||"—"}</td>
                  <td style={{padding:"12px 16px",textAlign:"right",fontWeight:700,color:"#ef4444",fontSize:"14px"}}>{fmt(e.amount)}</td>
                  <td style={{padding:"12px 16px"}}><Badge status={e.status}/></td>
                  <td style={{padding:"12px 16px"}}>
                    <div style={{display:"flex",gap:"6px"}}>
                      <button onClick={() => open(e)} style={{padding:"6px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"6px",color:"var(--text)",cursor:"pointer"}}><Icon name="edit" size={13}/></button>
                      <button onClick={() => openDocModal(e)} style={{padding:"6px",background:"#3b82f622",border:"1px solid #3b82f644",borderRadius:"6px",color:"#3b82f6",cursor:"pointer"}} title="Receipts"><Icon name="file" size={13}/></button>
                      <button onClick={() => del(e.id)} style={{padding:"6px",background:"#ef444411",border:"1px solid #ef444433",borderRadius:"6px",color:"#ef4444",cursor:"pointer"}}><Icon name="trash" size={13}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!items.length && <div style={{padding:"40px",textAlign:"center",color:"var(--muted)"}}>No expenses recorded</div>}
      </div>
      
      {/* Add/Edit Expense Modal */}
      {modal && (
        <Modal title={modal?.id ? "Edit Expense" : "Add Expense"} onClose={() => setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Field label="Category"><Select value={form.category} onChange={e => set("category",e.target.value)}>{["maintenance","utilities","taxes","insurance","repairs","cleaning","security","other"].map(c => <option key={c} value={c} style={{textTransform:"capitalize"}}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}</Select></Field>
            <Field label="Property"><Select value={form.property_id} onChange={e => set("property_id",e.target.value)}><option value="">General (no property)</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
            <div style={{gridColumn:"1/-1"}}><Field label="Description"><Input value={form.description} onChange={e => set("description",e.target.value)} placeholder="Describe the expense…"/></Field></div>
            <Field label="Amount (₹)"><Input type="number" value={form.amount} onChange={e => set("amount",e.target.value)} placeholder="5000"/></Field>
            <Field label="Expense Date"><Input type="date" value={form.expense_date} onChange={e => set("expense_date",e.target.value)}/></Field>
            <Field label="Vendor / Payee"><Input value={form.vendor} onChange={e => set("vendor",e.target.value)} placeholder="Company or person name"/></Field>
            <Field label="Status"><Select value={form.status} onChange={e => set("status",e.target.value)}><option value="paid">Paid</option><option value="pending">Pending</option></Select></Field>
            <Field label="Receipt Number"><Input value={form.receipt_number} onChange={e => set("receipt_number",e.target.value)} placeholder="Receipt/Invoice ref…"/></Field>
            <Field label="Receipt (Bill/Invoice)"><input type="file" onChange={e => setExpenseFile(e.target.files[0])} style={inputStyle} accept=".pdf,.jpg,.jpeg,.png"/></Field>
            {expenseFile && (
              <div style={{gridColumn:"1/-1",fontSize:"12px",color:"var(--muted)"}}>
                Selected file: {expenseFile.name} ({(expenseFile.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:"10px",justifyContent:"flex-end",marginTop:"8px"}}>
            <button onClick={() => setModal(null)} style={{padding:"10px 20px",border:"1px solid var(--border)",background:"var(--bg)",color:"var(--text)",borderRadius:"8px",cursor:"pointer",fontWeight:500}}>Cancel</button>
            <button onClick={save} style={{padding:"10px 24px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:600}}>Save</button>
          </div>
        </Modal>
      )}
      
      {/* Expense Document Modal */}
      {docModal && (
        <Modal title={`Expense Receipts - ${docModal.description?.substring(0, 30)}${docModal.description?.length > 30 ? '...' : ''}`} onClose={() => { setDocModal(null); setExpenseDocs([]); setSelectedFile(null); }}>
          <div style={{marginBottom:"20px",padding:"16px",background:"var(--bg)",borderRadius:"12px"}}>
            <h4 style={{margin:"0 0 12px",fontSize:"14px",color:"var(--text)"}}>Upload Receipt</h4>
            <div style={{marginBottom:"12px"}}>
              <Field label="Select File (PDF, Image)">
                <input type="file" onChange={e => setSelectedFile(e.target.files[0])} style={inputStyle} accept=".pdf,.jpg,.jpeg,.png"/>
              </Field>
            </div>
            {selectedFile && (
              <div style={{fontSize:"12px",color:"var(--muted)",marginTop:"8px",marginBottom:"12px"}}>
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            )}
            <button onClick={uploadExpenseDoc} disabled={!selectedFile} style={{padding:"8px 16px",background:selectedFile?"var(--accent)":"var(--border)",color:"#fff",border:"none",borderRadius:"8px",cursor:selectedFile?"pointer":"not-allowed",fontWeight:600}}>
              Upload Receipt
            </button>
          </div>
          
          <h4 style={{margin:"0 0 12px",fontSize:"14px",color:"var(--text)"}}>Uploaded Receipts ({expenseDocs.length})</h4>
          {expenseDocs.length === 0 ? (
            <div style={{textAlign:"center",padding:"20px",color:"var(--muted)"}}>No receipts uploaded yet</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {expenseDocs.map(doc => (
                <div key={doc.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px",background:"var(--bg)",borderRadius:"8px",border:"1px solid var(--border)"}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:"13px",color:"var(--text)"}}>{doc.original_name}</div>
                    <div style={{fontSize:"11px",color:"var(--muted)"}}>{(doc.file_size / 1024).toFixed(1)} KB · {fmtDate(doc.uploaded_at)}</div>
                  </div>
                  <div style={{display:"flex",gap:"6px"}}>
                    <button onClick={() => extractContent(doc.id)} disabled={extractingContent} style={{padding:"6px 12px",background:"#22c55e22",border:"1px solid #22c55e44",borderRadius:"6px",color:"#22c55e",cursor:"pointer",fontSize:"12px",fontWeight:500}}>
                      {extractingContent ? 'Extracting...' : 'Extract Text'}
                    </button>
                    <a href={`${API}/expense-documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer" style={{padding:"6px 12px",background:"#3b82f622",border:"1px solid #3b82f644",borderRadius:"6px",color:"#3b82f6",textDecoration:"none",fontSize:"12px",fontWeight:500}}>View</a>
                    <button onClick={() => deleteExpenseDoc(doc.id)} style={{padding:"6px",background:"#ef444411",border:"1px solid #ef444433",borderRadius:"6px",color:"#ef4444",cursor:"pointer"}}><Icon name="trash" size={12}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
      
      {/* Content Extraction Modal */}
      {contentModal && (
        <Modal title="Extracted Content - Copy & Paste" onClose={() => { setContentModal(null); setExtractedContent(''); }}>
          <div style={{marginBottom:"12px"}}>
            <p style={{fontSize:"12px",color:"var(--muted)"}}>The following text was extracted from the document. Click "Copy" to copy it to your clipboard.</p>
          </div>
          <textarea 
            value={extractedContent} 
            readOnly 
            style={{...inputStyle, height:"200px", resize:"vertical", fontFamily:"monospace", fontSize:"12px", background:"var(--bg)", marginBottom:"16px"}}
          />
          <div style={{display:"flex",gap:"10px",justifyContent:"flex-end"}}>
            <button onClick={() => setContentModal(null)} style={{padding:"10px 20px",border:"1px solid var(--border)",background:"var(--bg)",color:"var(--text)",borderRadius:"8px",cursor:"pointer",fontWeight:500}}>Close</button>
            <button onClick={copyToClipboard} style={{padding:"10px 24px",background:"#22c55e",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:600}}>
              Copy to Clipboard
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── PREDICTIONS & FORECASTS ─────────────────────────────────────────────────
function Predictions() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => { 
    api("/predictions").then(d => { setData(d); setLoading(false); })
    .catch(err => { 
      console.error('Failed to load predictions:', err);
      setLoading(false); 
    });
  }, []);
  
  if (loading) return <div style={{color:"var(--muted)",padding:"40px",textAlign:"center"}}>Loading predictions...</div>;
  if (!data) return <div style={{color:"var(--muted)",padding:"40px",textAlign:"center"}}>Failed to load predictions</div>;
  
  // Safely extract data with defaults
  const summary = data.summary || null;
  const forecast = data.forecast || null;
  const propertyPredictions = data.propertyPredictions || null;
  const yearEndProjections = data.yearEndProjections || null;
  const risks = data.risks || null;
  const recommendations = data.recommendations || null;
  
  // Defensive check for forecast data
  if (!forecast || !Array.isArray(forecast)) {
    console.error('Forecast data is missing or not an array:', data);
    return <div style={{color:"var(--muted)",padding:"40px",textAlign:"center"}}>Error loading forecast data</div>;
  }
  
  const confidenceColor = (c) => c === 'high' ? '#22c55e' : c === 'medium' ? '#f59e0b' : '#ef4444';
  const riskColor = (r) => r === 'high' ? '#ef4444' : r === 'medium' ? '#f59e0b' : '#22c55e';
  
  return (
    <div>
      <div style={{marginBottom:"28px"}}>
        <h1 style={{fontSize:"26px",fontWeight:800,color:"var(--text)",margin:0}}>Financial Predictions</h1>
        <p style={{color:"var(--muted)",margin:"4px 0 0",fontSize:"14px"}}>AI-powered forecasts and risk analysis for your portfolio</p>
      </div>
      
      {/* Summary Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"16px",marginBottom:"28px"}}>
        <StatCard label="Projected Monthly Income" value={fmt(summary.projectedMonthlyIncome)} icon="rupee" color="#22c55e" sub={`${summary.activeTenants} active tenants`}/>
        <StatCard label="Collection Rate" value={`${summary.averageCollectionRate}%`} icon="trend" color="#3b82f6" sub={`Based on ${summary.monthsOfHistory} months data`}/>
        <StatCard label="Year-End Projection" value={fmt(yearEndProjections.projectedNetIncome)} icon="crystal" color="#f97316" sub="Estimated net income"/>
        <StatCard label="Risk Alerts" value={risks.latePayments + risks.expiringLeases} icon="warn" color={risks.latePayments > 0 ? '#ef4444' : '#22c55e'} sub={risks.latePayments > 0 ? 'Action required' : 'All clear'}/>
        
        {/* Occupancy Stats */}
        <StatCard label="Total Units" value={summary.total_units} icon="building" color="#3b82f6" sub={`${summary.occupied_units} occupied`}/>
        <StatCard label="Occupancy Rate" value={`${summary.occupancy_rate}%`} icon="home" color={summary.occupancy_rate >= 80 ? '#22c55e' : summary.occupancy_rate >= 60 ? '#f59e0b' : '#ef4444'} sub={`${summary.vacant_units} vacant units`}/>
        <StatCard label="Vacant Units" value={summary.vacant_units} icon="users" color="#ef4444" sub="Available for rent"/>
      </div>
      
      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div style={{marginBottom:"28px"}}>
          <h3 style={{fontSize:"15px",fontWeight:700,color:"var(--text)",marginBottom:"12px"}}>Smart Recommendations</h3>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {recommendations.map((rec, i) => (
              <div key={i} style={{
                padding:"12px 16px",borderRadius:"10px",borderLeft:"4px solid",
                borderLeftColor: rec.type === 'warning' ? '#f59e0b' : rec.type === 'action' ? '#ef4444' : rec.type === 'success' ? '#22c55e' : '#3b82f6',
                background:"var(--card)",border:"1px solid var(--border)"
              }}>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <span style={{
                    fontSize:"11px",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",
                    color: rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#f59e0b' : '#22c55e'
                  }}>{rec.priority}</span>
                  <span style={{fontSize:"13px",color:"var(--text)"}}>{rec.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Financial Year Forecast */}
      <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"16px",padding:"24px",marginBottom:"28px"}}>
        <h3 style={{fontSize:"15px",fontWeight:700,color:"var(--text)",margin:"0 0 20px"}}>Current Financial Year Forecast ({getCurrentFinancialYear()})</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"12px"}}>
          {forecast.map((f, i) => (
            <div key={i} style={{
              padding:"14px",borderRadius:"10px",background:"var(--bg)",border:"1px solid var(--border)",
              position:"relative",overflow:"hidden"
            }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px"}}>
                <div>
                  <div style={{fontSize:"12px",fontWeight:600,color:"var(--text)"}}>{f.month}</div>
                  <div style={{fontSize:"10px",color:"var(--muted)"}}>{f.year}</div>
                </div>
                <span style={{
                  padding:"2px 6px",borderRadius:"10px",fontSize:"9px",fontWeight:600,
                  background:confidenceColor(f.confidence)+"22",color:confidenceColor(f.confidence)
                }}>{f.confidence}</span>
              </div>
              <div style={{marginBottom:"6px"}}>
                <div style={{fontSize:"10px",color:"var(--muted)",marginBottom:"1px"}}>Income</div>
                <div style={{fontSize:"16px",fontWeight:700,color:"var(--accent)"}}>{fmt(f.predictedIncome)}</div>
              </div>
              <div style={{marginBottom:"6px"}}>
                <div style={{fontSize:"10px",color:"var(--muted)",marginBottom:"1px"}}>Expenses</div>
                <div style={{fontSize:"13px",fontWeight:600,color:"#ef4444"}}>{fmt(f.predictedExpenses)}</div>
              </div>
              <div>
                <div style={{fontSize:"10px",color:"var(--muted)",marginBottom:"1px"}}>Net</div>
                <div style={{fontSize:"13px",fontWeight:600,color:f.predictedNet >= 0 ? "#22c55e" : "#ef4444"}}>{fmt(f.predictedNet)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Property Predictions */}
      <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"16px",padding:"24px",marginBottom:"28px"}}>
        <h3 style={{fontSize:"15px",fontWeight:700,color:"var(--text)",margin:"0 0 20px"}}>Property-Level Forecast</h3>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
          <thead>
            <tr style={{color:"var(--muted)",fontWeight:600,textTransform:"uppercase",fontSize:"11px",letterSpacing:"0.5px"}}>
              <th style={{textAlign:"left",padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>Property</th>
              <th style={{textAlign:"center",padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>Occupancy</th>
              <th style={{textAlign:"right",padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>Monthly Rent</th>
              <th style={{textAlign:"right",padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>Projected Income</th>
              <th style={{textAlign:"center",padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>Vacancy Risk</th>
            </tr>
          </thead>
          <tbody>
            {propertyPredictions.map(p => (
              <tr key={p.id}>
                <td style={{padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>
                  <div style={{fontWeight:600,color:"var(--text)"}}>{p.name}</div>
                  <div style={{fontSize:"11px",color:"var(--muted)",textTransform:"capitalize"}}>{p.type}</div>
                </td>
                <td style={{padding:"12px 16px",textAlign:"center",borderBottom:"1px solid var(--border)"}}>
                  <div style={{fontWeight:700,color:p.occupancyRate > 80 ? '#22c55e' : p.occupancyRate > 50 ? '#f59e0b' : '#ef4444'}}>
                    {p.occupancyRate}%
                  </div>
                  <div style={{fontSize:"11px",color:"var(--muted)"}}>{p.occupiedUnits}/{p.totalUnits} units</div>
                </td>
                <td style={{padding:"12px 16px",textAlign:"right",color:"var(--muted)",borderBottom:"1px solid var(--border)"}}>{fmt(p.monthlyRent)}</td>
                <td style={{padding:"12px 16px",textAlign:"right",fontWeight:700,color:"var(--accent)",borderBottom:"1px solid var(--border)"}}>{fmt(p.projectedMonthlyIncome)}</td>
                <td style={{padding:"12px 16px",textAlign:"center",borderBottom:"1px solid var(--border)"}}>
                  <span style={{
                    display:"inline-block",padding:"2px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:600,
                    background: riskColor(p.vacancyRisk) + '22',color: riskColor(p.vacancyRisk),textTransform:"uppercase"
                  }}>{p.vacancyRisk}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Year-End Summary */}
      <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"16px",padding:"24px"}}>
        <h3 style={{fontSize:"15px",fontWeight:700,color:"var(--text)",margin:"0 0 20px"}}>Year-End Financial Projection</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"20px"}}>
          <div style={{textAlign:"center",padding:"20px",background:"var(--bg)",borderRadius:"12px"}}>
            <div style={{fontSize:"12px",color:"var(--muted)",marginBottom:"8px"}}>Projected Total Income</div>
            <div style={{fontSize:"24px",fontWeight:800,color:"#22c55e"}}>{fmt(yearEndProjections.projectedTotalIncome)}</div>
            <div style={{fontSize:"11px",color:"var(--muted)",marginTop:"4px"}}>
              Actual so far: {fmt(yearEndProjections.currentYearActuals.income)}
            </div>
          </div>
          <div style={{textAlign:"center",padding:"20px",background:"var(--bg)",borderRadius:"12px"}}>
            <div style={{fontSize:"12px",color:"var(--muted)",marginBottom:"8px"}}>Projected Total Expenses</div>
            <div style={{fontSize:"24px",fontWeight:800,color:"#ef4444"}}>{fmt(yearEndProjections.projectedTotalExpenses)}</div>
            <div style={{fontSize:"11px",color:"var(--muted)",marginTop:"4px"}}>
              Actual so far: {fmt(yearEndProjections.currentYearActuals.expenses)}
            </div>
          </div>
          <div style={{textAlign:"center",padding:"20px",background:"var(--bg)",borderRadius:"12px",border:"2px solid",borderColor: yearEndProjections.projectedNetIncome > 0 ? '#22c55e' : '#ef4444'}}>
            <div style={{fontSize:"12px",color:"var(--muted)",marginBottom:"8px"}}>Projected Net Income</div>
            <div style={{fontSize:"28px",fontWeight:800,color: yearEndProjections.projectedNetIncome > 0 ? '#22c55e' : '#ef4444'}}>
              {fmt(yearEndProjections.projectedNetIncome)}
            </div>
            <div style={{fontSize:"11px",color:"var(--muted)",marginTop:"4px"}}>
              Margin: {((yearEndProjections.projectedNetIncome / yearEndProjections.projectedTotalIncome) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LEDGER (Tax Management) ─────────────────────────────────────────────────
function Ledger() {
  const [items, setItems] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [modal, setModal] = useState(null);
  const [summaryModal, setSummaryModal] = useState(null);
  const [fyYear, setFyYear] = useState(getCurrentFinancialYear());
  const [calendarYear, setCalendarYear] = useState(getCurrentYear());
  const [filter, setFilter] = useState("all");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [returnsFiling, setReturnsFiling] = useState(null);
  const blank = { entry_date:new Date().toISOString().slice(0,10),entry_type:"income",category:"rent",description:"",amount:"",gst_amount:"",tds_amount:"",net_amount:"",property_id:"",tenant_id:"",vendor:"",pan_number:"",gst_number:"",fy_year:getCurrentFinancialYear(),quarter:getCurrentQuarter(),notes:"" };
  const [form, setForm] = useState(blank);
  const load = useCallback(async () => {
    const [l, p, t] = await Promise.all([api("/ledger"), api("/properties"), api("/tenants")]);
    setItems(l); setProperties(p); setTenants(t);
  }, []);
  
  const loadReturnsFiling = async () => {
    if (calendarYear === "all") {
      alert("Please select a specific calendar year to view returns filing data");
      return;
    }
    const data = await api(`/ledger/returns-filing/${calendarYear}`);
    setReturnsFiling(data);
  };
  useEffect(() => { load(); }, [load]);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const open = (item) => { 
    if (item) setForm({ ...item, entry_date: item.entry_date?.slice(0,10)||"" }); 
    else setForm(blank); 
    setModal(item||true); 
  };
  const save = async () => {
    const net = parseFloat(form.net_amount) || (parseFloat(form.amount) - parseFloat(form.tds_amount||0));
    const payload = { ...form, net_amount: net };
    if (modal?.id) await api(`/ledger/${modal.id}`, "PUT", payload);
    else await api("/ledger", "POST", payload);
    setModal(null); load();
  };
  const del = async (id) => { 
    if (!confirm("Delete this ledger entry?")) return;
    try {
      await api(`/ledger/${id}`, "DELETE"); 
      load(); 
    } catch (err) {
      alert('Failed to delete ledger entry: ' + err.message);
    }
  };
  
  const filtered = filter === "all" ? items : items.filter(i => i.entry_type === filter);
  const filteredByProperty = propertyFilter === "all" ? filtered : 
    propertyFilter === "vilankurichi-all" ? filtered.filter(i => {
      // Filter for properties that contain "Vilankurichi" in their name
      const property = properties.find(p => String(p.id) === String(i.property_id));
      return property && property.name.toLowerCase().includes('vilankurichi');
    }) :
    filtered.filter(i => {
      // Handle both string and number comparisons, and filter out null/undefined values
      return i.property_id && String(i.property_id) === String(propertyFilter);
    });
  const filteredByYear = fyYear === "all"
    ? filteredByProperty
    : filteredByProperty.filter(i => {
        return i.fy_year === fyYear;
      });
  
  // Calculate totals from all data for the selected year (not filtered by entry type)
  const allForYear = fyYear === "all" ? items : items.filter(i => i.fy_year === fyYear);
  const allByYear = propertyFilter === "all" ? allForYear : 
    propertyFilter === "vilankurichi-all" ? allForYear.filter(i => {
      // Filter for properties that contain "Vilankurichi" in their name
      const property = properties.find(p => String(p.id) === String(i.property_id));
      return property && property.name.toLowerCase().includes('vilankurichi');
    }) :
    allForYear.filter(i => {
      return i.property_id && String(i.property_id) === String(propertyFilter);
    });
  const totalIncome = allByYear.filter(i => i.entry_type === 'income').reduce((s, i) => s + parseFloat(i.amount||0), 0);
  const totalExpense = allByYear.filter(i => i.entry_type === 'expense').reduce((s, i) => s + parseFloat(i.amount||0), 0);
  const totalMargin = totalIncome - totalExpense;
  const totalGST = filteredByYear.reduce((s, i) => s + parseFloat(i.gst_amount||0), 0);
  const totalTDS = allByYear.filter(i => i.entry_type === 'income').reduce((s, i) => s + parseFloat(i.tds_amount||0), 0);
  
  const typeColors = { income: "#22c55e", expense: "#ef4444" };
  const quarters = ["Q1","Q2","Q3","Q4"];
  const currentYear = new Date().getFullYear();
  const fyYears = [`${currentYear-2}-${currentYear-1}`,`${currentYear-1}-${currentYear}`,`${currentYear}-${currentYear+1}`,`${currentYear+1}-${currentYear+2}`];
  const calendarYears = [`${currentYear-2}`,`${currentYear-1}`,`${currentYear}`,`${currentYear+1}`,`${currentYear+2}`];

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
        <div>
          <h1 style={{fontSize:"26px",fontWeight:800,color:"var(--text)",margin:0}}>General Ledger</h1>
          <p style={{color:"var(--muted)",margin:"4px 0 0",fontSize:"14px"}}>Income & Expense Tracking</p>
        </div>
        <div style={{display:"flex",gap:"10px"}}>
          <button onClick={() => open(null)} style={{display:"flex",alignItems:"center",gap:"8px",padding:"10px 20px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:"10px",fontWeight:600,cursor:"pointer",fontSize:"14px"}}>
            <Icon name="plus" size={16}/>Add Entry
          </button>
        </div>
      </div>
    
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"16px",marginBottom:"24px"}}>
        <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"12px",padding:"16px"}}>
          <div style={{fontSize:"12px",color:"var(--muted)"}}>Total Income</div>
          <div style={{fontSize:"20px",fontWeight:700,color:"#22c55e"}}>{fmt(totalIncome)}</div>
        </div>
        <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"12px",padding:"16px"}}>
          <div style={{fontSize:"12px",color:"var(--muted)"}}>Total Expense</div>
          <div style={{fontSize:"20px",fontWeight:700,color:"#ef4444"}}>{fmt(totalExpense)}</div>
        </div>
      </div>
      <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"12px",padding:"16px"}}>
          <div style={{fontSize:"12px",color:"var(--muted)"}}>Margin</div>
          <div style={{fontSize:"20px",fontWeight:700,color:"#2240c5"}}>{fmt(totalMargin)}</div>
        </div>
      
      <div style={{display:"flex",gap:"8px",marginBottom:"16px",flexWrap:"wrap",alignItems:"center"}}>
        {["all","income","expense"].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{padding:"6px 14px",borderRadius:"20px",fontSize:"12px",fontWeight:600,cursor:"pointer",textTransform:"capitalize",border:`1px solid ${filter===s?"var(--accent)":"var(--border)"}`,background:filter===s?"var(--accent)":"var(--card)",color:filter===s?"#fff":"var(--muted)"}}>
            {s === "all" ? "All Entries" : s}
          </button>
        ))}
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          <span style={{fontSize:"12px",color:"var(--muted)"}}>Property:</span>
          <Select value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)}>
            <option value="all">All Properties</option>
            <option value="vilankurichi-all">All Vilankurichi Properties</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          <span style={{fontSize:"12px",color:"var(--muted)"}}>Financial Year:</span>
          <Select value={fyYear} onChange={e => setFyYear(e.target.value)}>
            <option value="all">All Years</option>
            {fyYears.map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
        </div>
        <button 
          onClick={() => {
            setFilter("all");
            setPropertyFilter("all");
            setFyYear(getCurrentFinancialYear());
          }}
          style={{padding:"6px 14px",borderRadius:"20px",fontSize:"12px",fontWeight:600,cursor:"pointer",border:"1px solid var(--border)",background:"var(--card)",color:"var(--muted)"}}
        >
          Clear Filters
        </button>
      </div>
      
      <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"16px",overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
          <thead style={{background:"var(--bg)"}}>
            <tr style={{color:"var(--muted)",fontWeight:600,textTransform:"uppercase",fontSize:"11px",letterSpacing:"0.5px"}}>
              {["Date","Type","Category","Description","Amount","FY","Q","Status"].map((h,i) => (
                <th key={i} style={{textAlign:i>=4?"right":(i>=5?"center":"left"),padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredByYear.map(l => {
              const color = typeColors[l.entry_type] || "#94a3b8";
              return (
                <tr key={l.id} style={{borderBottom:"1px solid var(--border)"}}>
                  <td style={{padding:"12px 16px",color:"var(--muted)"}}>{fmtDate(l.entry_date)}</td>
                  <td style={{padding:"12px 16px"}}>
                    <span style={{display:"inline-block",padding:"3px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:600,background:color+"22",color:color,textTransform:"capitalize"}}>{l.entry_type}</span>
                  </td>
                  <td style={{padding:"12px 16px",fontSize:"12px",color:"var(--text)"}}>{l.category}</td>
                  <td style={{padding:"12px 16px",color:"var(--text)",maxWidth:"200px"}}>
                    <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.description}</div>
                  </td>
                  <td style={{padding:"12px 16px",textAlign:"right",fontWeight:600,color}}>{fmt(l.amount)}</td>
                  <td style={{padding:"12px 16px",fontSize:"11px",color:"var(--muted)",textAlign:"center"}}>{l.fy_year}</td>
                  <td style={{padding:"12px 16px",fontSize:"11px",color:"var(--muted)",textAlign:"center"}}>{l.quarter}</td>
                  <td style={{padding:"12px 16px",fontSize:"11px",textAlign:"center"}}>
                    <span style={{
                      display:"inline-block",
                      padding:"2px 8px",
                      borderRadius:"12px",
                      fontSize:"10px",
                      fontWeight:600,
                      background:(l.status || "paid") === "paid" ? "#22c55e22" : "#ef444422",
                      color:(l.status || "paid") === "paid" ? "#22c55e" : "#ef4444",
                      textTransform:"capitalize"
                    }}>
                      {l.status || "paid"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filteredByYear.length && <div style={{padding:"40px",textAlign:"center",color:"var(--muted)"}}>No ledger entries found</div>}
      </div>
            {modal && (
        <Modal title={modal?.id ? "Edit Ledger Entry" : "Add Ledger Entry"} onClose={() => setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Field label="Entry Date"><Input type="date" value={form.entry_date} onChange={e => set("entry_date",e.target.value)}/></Field>
            <Field label="Entry Type"><Select value={form.entry_type} onChange={e => set("entry_type",e.target.value)}><option value="income">Income</option><option value="expense">Expense</option></Select></Field>
            <Field label="Category"><Input value={form.category} onChange={e => set("category",e.target.value)} placeholder="rent, utilities, etc"/></Field>
            <Field label="Amount (₹)"><Input type="number" value={form.amount} onChange={e => set("amount",e.target.value)} placeholder="18000"/></Field>
            <Field label="GST Amount"><Input type="number" value={form.gst_amount} onChange={e => set("gst_amount",e.target.value)} placeholder="0"/></Field>
            <Field label="TDS Amount"><Input type="number" value={form.tds_amount} onChange={e => set("tds_amount",e.target.value)} placeholder="0"/></Field>
            <Field label="Property"><Select value={form.property_id} onChange={e => set("property_id",e.target.value)}><option value="">Select property…</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
            <Field label="Tenant/Vendor"><Input value={form.vendor} onChange={e => set("vendor",e.target.value)} placeholder="Name"/></Field>
            <Field label="Financial Year"><Select value={form.fy_year} onChange={e => set("fy_year",e.target.value)}>{fyYears.map(y => <option key={y} value={y}>{y}</option>)}</Select></Field>
            <Field label="Quarter"><Select value={form.quarter} onChange={e => set("quarter",e.target.value)}>{quarters.map(q => <option key={q} value={q}>{q}</option>)}</Select></Field>
            <Field label="PAN Number"><Input value={form.pan_number} onChange={e => set("pan_number",e.target.value)} placeholder="ABCDE1234F"/></Field>
            <Field label="GST Number"><Input value={form.gst_number} onChange={e => set("gst_number",e.target.value)} placeholder="22AAAAA0000A1Z5"/></Field>
            <div style={{gridColumn:"1/-1"}}><Field label="Description"><Input value={form.description} onChange={e => set("description",e.target.value)} placeholder="Entry description…"/></Field></div>
            <div style={{gridColumn:"1/-1"}}><Field label="Notes"><textarea value={form.notes} onChange={e => set("notes",e.target.value)} placeholder="Additional notes…" style={{...inputStyle,height:"60px",resize:"vertical"}}/></Field></div>
          </div>
          <div style={{display:"flex",gap:"10px",justifyContent:"flex-end",marginTop:"8px"}}>
            <button onClick={() => setModal(null)} style={{padding:"10px 20px",border:"1px solid var(--border)",background:"var(--bg)",color:"var(--text)",borderRadius:"8px",cursor:"pointer",fontWeight:500}}>Cancel</button>
            <button onClick={save} style={{padding:"10px 24px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontWeight:600}}>Save</button>
          </div>
        </Modal>
      )}
      
      {/* Returns Filing Modal */}
      {returnsFiling && (
        <Modal title={`ITR Filing - ${returnsFiling.calendar_year} - Individual Resident`} onClose={() => setReturnsFiling(null)}>
          <div style={{maxHeight:"70vh",overflow:"auto"}}>
            {/* Income Tax Summary */}
            <div style={{background:"var(--bg)",borderRadius:"12px",padding:"16px",marginBottom:"20px"}}>
              <h3 style={{margin:"0 0 16px",fontSize:"14px",color:"var(--text)"}}>ITR-1 (Sahaj) - Individual Resident with Rental Income</h3>
              <div style={{fontSize:"11px",color:"var(--muted)",marginBottom:"12px",padding:"8px 12px",background:"var(--card)",borderRadius:"6px"}}>
                For individual resident Indians having income from house property
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"12px"}}>
                <div>
                  <div style={{fontSize:"11px",color:"var(--muted)"}}>Total Rental Income</div>
                  <div style={{fontSize:"18px",fontWeight:700,color:"#22c55e"}}>{fmt(returnsFiling.income_tax?.total_rental_income || 0)}</div>
                </div>
                <div>
                  <div style={{fontSize:"11px",color:"var(--muted)"}}>Total Expenses</div>
                  <div style={{fontSize:"18px",fontWeight:700,color:"#ef4444"}}>{fmt(returnsFiling.income_tax?.total_expenses || 0)}</div>
                </div>
                <div>
                  <div style={{fontSize:"11px",color:"var(--muted)"}}>TDS Deducted (26AS)</div>
                  <div style={{fontSize:"18px",fontWeight:700,color:"#3b82f6"}}>{fmt(returnsFiling.income_tax?.total_tds_deducted || 0)}</div>
                </div>
                <div>
                  <div style={{fontSize:"11px",color:"var(--muted)"}}>Net Taxable Income</div>
                  <div style={{fontSize:"18px",fontWeight:700,color:"var(--text)"}}>
                    {fmt((returnsFiling.income_tax?.total_rental_income || 0) - (returnsFiling.income_tax?.total_expenses || 0))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* GST Summary */}
            <div style={{background:"var(--bg)",borderRadius:"12px",padding:"16px",marginBottom:"20px"}}>
              <h3 style={{margin:"0 0 16px",fontSize:"14px",color:"var(--text)"}}>GST Returns (Only if Registered)</h3>
              <div style={{fontSize:"11px",color:"var(--muted)",marginBottom:"12px",padding:"8px 12px",background:"var(--card)",borderRadius:"6px"}}>
                Individual landlords must register for GST only if aggregate turnover exceeds ₹20 lakhs (₹10 lakhs for special category states)
              </div>
              {returnsFiling.gst?.gstr3b_quarterly?.length > 0 ? (
                <table style={{width:"100%",fontSize:"12px",borderCollapse:"collapse"}}>
                  <thead>
                    <tr style={{color:"var(--muted)",textAlign:"left"}}>
                      <th style={{padding:"8px",borderBottom:"1px solid var(--border)"}}>Quarter</th>
                      <th style={{padding:"8px",borderBottom:"1px solid var(--border)",textAlign:"right"}}>Outward Supply</th>
                      <th style={{padding:"8px",borderBottom:"1px solid var(--border)",textAlign:"right"}}>GST Collected</th>
                      <th style={{padding:"8px",borderBottom:"1px solid var(--border)",textAlign:"right"}}>GST Payable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnsFiling.gst.gstr3b_quarterly.map((q, i) => (
                      <tr key={i}>
                        <td style={{padding:"8px",borderBottom:"1px solid var(--border)"}}>{q.quarter}</td>
                        <td style={{padding:"8px",borderBottom:"1px solid var(--border)",textAlign:"right"}}>{fmt(q.outward_taxable_supply)}</td>
                        <td style={{padding:"8px",borderBottom:"1px solid var(--border)",textAlign:"right",color:"#22c55e"}}>{fmt(q.outward_gst)}</td>
                        <td style={{padding:"8px",borderBottom:"1px solid var(--border)",textAlign:"right",color:"#f59e0b"}}>{fmt(q.outward_gst - q.inward_gst)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{color:"var(--muted)",fontSize:"12px"}}>No GST data available for {returnsFiling.calendar_year}</div>
              )}
              <div style={{marginTop:"12px",paddingTop:"12px",borderTop:"1px solid var(--border)"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"12px"}}>
                  <span style={{color:"var(--muted)"}}>Total GST Collected:</span>
                  <span style={{fontWeight:700,color:"#22c55e"}}>{fmt(returnsFiling.income_tax?.gst_collected || 0)}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"12px",marginTop:"4px"}}>
                  <span style={{color:"var(--muted)"}}>Total GST Paid (Input):</span>
                  <span style={{fontWeight:700,color:"#ef4444"}}>{fmt(returnsFiling.income_tax?.gst_paid || 0)}</span>
                </div>
              </div>
            </div>
            
            {/* TDS Return (Form 26Q) */}
            <div style={{background:"var(--bg)",borderRadius:"12px",padding:"16px",marginBottom:"20px"}}>
              <h3 style={{margin:"0 0 16px",fontSize:"14px",color:"var(--text)"}}>TDS on Rent (Form 26QB) - Tenant Deducts TDS</h3>
              <div style={{fontSize:"11px",color:"var(--muted)",marginBottom:"12px",padding:"8px 12px",background:"var(--card)",borderRadius:"6px"}}>
                If monthly rent exceeds ₹50,000, tenant must deduct 5% TDS u/s 194-IB and deposit via Form 26QB within 30 days
              </div>
              {returnsFiling.tds?.form26q?.length > 0 ? (
                <>
                  <table style={{width:"100%",fontSize:"12px",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{color:"var(--muted)",textAlign:"left"}}>
                        <th style={{padding:"8px",borderBottom:"1px solid var(--border)"}}>Tenant/Deductee</th>
                        <th style={{padding:"8px",borderBottom:"1px solid var(--border)"}}>PAN</th>
                        <th style={{padding:"8px",borderBottom:"1px solid var(--border)",textAlign:"right"}}>Total Payment</th>
                        <th style={{padding:"8px",borderBottom:"1px solid var(--border)",textAlign:"right"}}>TDS Deducted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnsFiling.tds.form26q.map((t, i) => (
                        <tr key={i}>
                          <td style={{padding:"8px",borderBottom:"1px solid var(--border)"}}>{t.deductee_name}</td>
                          <td style={{padding:"8px",borderBottom:"1px solid var(--border)",fontFamily:"monospace"}}>{t.deductee_pan || "—"}</td>
                          <td style={{padding:"8px",borderBottom:"1px solid var(--border)",textAlign:"right"}}>{fmt(t.total_payment)}</td>
                          <td style={{padding:"8px",borderBottom:"1px solid var(--border)",textAlign:"right",color:"#3b82f6",fontWeight:600}}>{fmt(t.total_tds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{marginTop:"12px",paddingTop:"12px",borderTop:"1px solid var(--border)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:"12px"}}>
                      <span style={{color:"var(--muted)"}}>Total TDS to be deposited:</span>
                      <span style={{fontWeight:700,color:"#3b82f6"}}>
                        {fmt(returnsFiling.tds.form26q.reduce((s, t) => s + parseFloat(t.total_tds || 0), 0))}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{color:"var(--muted)",fontSize:"12px"}}>No TDS data available for {returnsFiling.calendar_year}</div>
              )}
            </div>
            
            {/* Monthly TDS Challans */}
            {returnsFiling.tds?.monthly_challans?.length > 0 && (
              <div style={{background:"var(--bg)",borderRadius:"12px",padding:"16px"}}>
                <h3 style={{margin:"0 0 16px",fontSize:"14px",color:"var(--text)"}}>Monthly TDS Challans (Form 26QB) - Tenant Payments</h3>
                <div style={{fontSize:"11px",color:"var(--muted)",marginBottom:"12px",padding:"8px 12px",background:"var(--card)",borderRadius:"6px"}}>
                  TDS deposited by tenants on your behalf. Verify in Form 26AS.
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px"}}>
                  {returnsFiling.tds.monthly_challans.map((m, i) => {
                    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                    return (
                      <div key={i} style={{background:"var(--card)",padding:"10px",borderRadius:"8px",border:"1px solid var(--border)"}}>
                        <div style={{fontSize:"11px",color:"var(--muted)"}}>{monthNames[m.month - 1]} {returnsFiling.calendar_year}</div>
                        <div style={{fontSize:"14px",fontWeight:700,color:"#3b82f6"}}>{fmt(m.tds_amount)}</div>
                        <div style={{fontSize:"10px",color:"var(--muted)"}}>{m.transactions} transactions</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:"10px",justifyContent:"flex-end",marginTop:"16px",paddingTop:"16px",borderTop:"1px solid var(--border)"}}>
            <button onClick={() => setReturnsFiling(null)} style={{padding:"10px 20px",border:"1px solid var(--border)",background:"var(--bg)",color:"var(--text)",borderRadius:"8px",cursor:"pointer",fontWeight:500}}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TDS REPORT (Section 194-IB)
// ═══════════════════════════════════════════════════════════════════════════════
function TDSReport() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [tdsForm, setTdsForm] = useState({ month_year: '', rent_amount: '', tds_amount: '', tds_rate: 5.00, deposit_date: '', challan_number: '', notes: '' });
  
  const load = useCallback(async () => {
    try {
      const data = await api('/tds-report-detailed');
      console.log('TDS Report data:', data);
      if (data && data.tenant_wise_details) {
        setItems(data.tenant_wise_details);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error('Failed to load TDS report:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => { load(); }, [load]);
  
  const openTdsModal = (tenant) => {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const monthlyTds = (tenant.monthly_rent * (tenant.tds_rate || 5) / 100).toFixed(2);
    setTdsForm({
      month_year: currentMonth,
      rent_amount: tenant.monthly_rent || '',
      tds_amount: monthlyTds,
      tds_rate: tenant.tds_rate || 5.00,
      deposit_date: new Date().toISOString().slice(0, 10),
      challan_number: '',
      notes: ''
    });
    setModal(tenant);
  };
  
  const saveTds = async () => {
    if (!tdsForm.month_year || !tdsForm.tds_amount) {
      alert('Please fill in month/year and TDS amount');
      return;
    }
    try {
      await api(`/tenants/${modal.id}/tds`, 'POST', tdsForm);
      setModal(null);
      load();
      alert('TDS deposit recorded successfully');
    } catch (err) {
      alert('Failed to record TDS: ' + err.message);
    }
  };
  
  const totalPending = items.reduce((sum, i) => sum + parseFloat(i.pending_tds || 0), 0);
  const totalDeposited = items.reduce((sum, i) => sum + parseFloat(i.deposited_tds || 0), 0);
  const totalMonthlyTds = items.reduce((sum, i) => sum + (i.tds_applicable ? (i.monthly_rent * i.tds_rate / 100) : 0), 0);
  
  if (loading) return <div style={{padding:"40px",textAlign:"center",color:"var(--muted)"}}>Loading TDS report...</div>;
  
  return (
    <Card title={<><Icon name="tax"/> TDS Report (Section 194-IB)</>}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"16px",marginBottom:"24px"}}>
        <div style={{padding:"16px",background:"var(--bg)",borderRadius:"8px",border:"1px solid var(--border)"}}>
          <div style={{fontSize:"12px",color:"var(--muted)",marginBottom:"4px"}}>Tenants with TDS</div>
          <div style={{fontSize:"24px",fontWeight:700,color:"var(--text)"}}>{items.length}</div>
        </div>
        <div style={{padding:"16px",background:"var(--bg)",borderRadius:"8px",border:"1px solid var(--border)"}}>
          <div style={{fontSize:"12px",color:"var(--muted)",marginBottom:"4px"}}>Monthly TDS Liability</div>
          <div style={{fontSize:"24px",fontWeight:700,color:"var(--warning)"}}>{fmt(totalMonthlyTds)}</div>
        </div>
        <div style={{padding:"16px",background:"var(--bg)",borderRadius:"8px",border:"1px solid var(--border)"}}>
          <div style={{fontSize:"12px",color:"var(--muted)",marginBottom:"4px"}}>Total Deposited</div>
          <div style={{fontSize:"24px",fontWeight:700,color:"var(--success)"}}>{fmt(totalDeposited)}</div>
        </div>
        <div style={{padding:"16px",background:"var(--bg)",borderRadius:"8px",border:"1px solid var(--border)"}}>
          <div style={{fontSize:"12px",color:"var(--muted)",marginBottom:"4px"}}>Pending Deposits</div>
          <div style={{fontSize:"24px",fontWeight:700,color:totalPending > 0 ? "#ef4444" : "var(--success)"}}>{fmt(totalPending)}</div>
        </div>
      </div>
      
      <div style={{fontSize:"13px",color:"var(--muted)",marginBottom:"16px",padding:"12px",background:"#fef3c7",borderRadius:"8px",border:"1px solid #f59e0b"}}>
        <strong style={{color:"#92400e"}}>Section 194-IB:</strong> Individual/HUF paying rent exceeding ₹50,000/month must deduct TDS at 5% and deposit to government by 7th of next month.
      </div>
      
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr style={{borderBottom:"1px solid var(--border)"}}>
            <th style={{textAlign:"left",padding:"12px",fontSize:"12px",fontWeight:600,color:"var(--muted)"}}>Tenant</th>
            <th style={{textAlign:"left",padding:"12px",fontSize:"12px",fontWeight:600,color:"var(--muted)"}}>Property</th>
            <th style={{textAlign:"right",padding:"12px",fontSize:"12px",fontWeight:600,color:"var(--muted)"}}>Monthly Rent</th>
            <th style={{textAlign:"center",padding:"12px",fontSize:"12px",fontWeight:600,color:"var(--muted)"}}>TDS Rate</th>
            <th style={{textAlign:"right",padding:"12px",fontSize:"12px",fontWeight:600,color:"var(--muted)"}}>Monthly TDS</th>
            <th style={{textAlign:"right",padding:"12px",fontSize:"12px",fontWeight:600,color:"var(--muted)"}}>Deposited</th>
            <th style={{textAlign:"right",padding:"12px",fontSize:"12px",fontWeight:600,color:"var(--muted)"}}>Pending</th>
            <th style={{textAlign:"center",padding:"12px",fontSize:"12px",fontWeight:600,color:"var(--muted)"}}>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map(t => {
            const monthlyTds = (t.monthly_rent * (t.tds_rate || 5) / 100);
            return (
              <tr key={t.tenant_id} style={{borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"12px",fontWeight:500,color:"var(--text)"}}>{t.tenant_name}</td>
                <td style={{padding:"12px",color:"var(--muted)",fontSize:"13px"}}>{t.property_name}</td>
                <td style={{padding:"12px",textAlign:"right",fontWeight:500}}>{fmt(t.monthly_rent)}</td>
                <td style={{padding:"12px",textAlign:"center",color:"var(--muted)"}}>{t.tds_rate}%</td>
                <td style={{padding:"12px",textAlign:"right",color:"var(--warning)",fontWeight:600}}>{fmt(monthlyTds)}</td>
                <td style={{padding:"12px",textAlign:"right",color:"var(--success)"}}>{fmt(t.deposited_tds || 0)}</td>
                <td style={{padding:"12px",textAlign:"right",color:parseFloat(t.pending_tds||0)>0?"#ef4444":"var(--success)"}}>{fmt(t.pending_tds || 0)}</td>
                <td style={{padding:"12px",textAlign:"center"}}>
                  <button onClick={() => openTdsModal(t)} style={{padding:"6px 12px",background:"#3b82f6",color:"#fff",border:"none",borderRadius:"6px",fontSize:"12px",cursor:"pointer"}}>Record Deposit</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {items.length === 0 && (
        <div style={{padding:"40px",textAlign:"center",color:"var(--muted)"}}>
          <p>No tenants with TDS applicable found.</p>
          <p style={{fontSize:"13px",marginTop:"8px"}}>Tenants with monthly rent exceeding ₹50,000 will appear here.</p>
        </div>
      )}
      
      {modal && (
        <Modal title={`Record TDS Deposit - ${modal.tenant_name}`} onClose={() => setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
            <Field label="Month/Year"><Input type="month" value={tdsForm.month_year} onChange={e => setTdsForm(f => ({ ...f, month_year: e.target.value }))}/></Field>
            <Field label="Rent Amount (₹)"><Input type="number" value={tdsForm.rent_amount} onChange={e => setTdsForm(f => ({ ...f, rent_amount: e.target.value, tds_amount: (e.target.value * tdsForm.tds_rate / 100).toFixed(2) }))}/></Field>
            <Field label="TDS Rate (%)"><Input type="number" step="0.01" value={tdsForm.tds_rate} onChange={e => setTdsForm(f => ({ ...f, tds_rate: e.target.value, tds_amount: (tdsForm.rent_amount * e.target.value / 100).toFixed(2) }))}/></Field>
            <Field label="TDS Amount (₹)"><Input type="number" value={tdsForm.tds_amount} onChange={e => setTdsForm(f => ({ ...f, tds_amount: e.target.value }))}/></Field>
            <Field label="Deposit Date"><Input type="date" value={tdsForm.deposit_date} onChange={e => setTdsForm(f => ({ ...f, deposit_date: e.target.value }))}/></Field>
            <Field label="Challan Number"><Input value={tdsForm.challan_number} onChange={e => setTdsForm(f => ({ ...f, challan_number: e.target.value }))} placeholder="ITNS 281 Challan"/></Field>
            <Field label="Notes" style={{gridColumn:"1/-1"}}><Input value={tdsForm.notes} onChange={e => setTdsForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes"/></Field>
          </div>
          <div style={{display:"flex",gap:"12px",justifyContent:"flex-end",marginTop:"20px"}}>
            <button onClick={() => setModal(null)} style={{padding:"10px 20px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"8px",color:"var(--text)",cursor:"pointer"}}>Cancel</button>
            <button onClick={saveTds} style={{padding:"10px 20px",background:"#3b82f6",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer"}}>Record TDS Deposit</button>
          </div>
        </Modal>
      )}
    </Card>
  );
}

// ─── PROFIT & LOSS REPORT ─────────────────────────────────────────────────────
function ProfitLossReport() {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    propertyId: '',
    period: 'monthly',
    format: 'json'
  });
  const [properties, setProperties] = useState([]);

  useEffect(() => {
    // Load properties for filter dropdown
    api('/properties').then(setProperties);
  }, []);

  const generateReport = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.propertyId) queryParams.append('propertyId', filters.propertyId);
      queryParams.append('period', filters.period);
      queryParams.append('format', filters.format);
      
      const response = await fetch(`${API}/reports/profit-loss?${queryParams}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setReportData(data);
      
      // Handle export formats
      if (filters.format !== 'json' && data.data) {
        // For now, just show the data. PDF/Excel export would need additional implementation
        setReportData(data.data);
      }
    } catch (err) {
      alert('Failed to generate report: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const setFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ startDate: '', endDate: '', propertyId: '', period: 'monthly', format: 'json' });
    setReportData(null);
  };

  const downloadReport = () => {
    if (!reportData) return;
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `profit-loss-report-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
        <div>
          <h1 style={{fontSize:"26px",fontWeight:800,color:"var(--text)",margin:0}}>Profit & Loss Report</h1>
          <p style={{color:"var(--muted)",margin:"4px 0 0",fontSize:"14px"}}>
            Generate detailed financial reports for analysis and record-keeping
          </p>
        </div>
      </div>

      {/* Report Filters */}
      <Card style={{marginBottom:"24px"}}>
        <h3 style={{margin:"0 0 16px",fontSize:"15px",fontWeight:700,color:"var(--text)"}}>Report Filters</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"16px",alignItems:"end"}}>
          <Field label="Start Date">
            <Input 
              type="date" 
              value={filters.startDate} 
              onChange={e => setFilter('startDate', e.target.value)} 
            />
          </Field>
          <Field label="End Date">
            <Input 
              type="date" 
              value={filters.endDate} 
              onChange={e => setFilter('endDate', e.target.value)} 
            />
          </Field>
          <Field label="Property">
            <Select value={filters.propertyId} onChange={e => setFilter('propertyId', e.target.value)}>
              <option value="">All Properties</option>
              <option value="vilankurichi-all">Vilankurichi All</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Period">
            <Select value={filters.period} onChange={e => setFilter('period', e.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </Field>
          <Field label="Export Format">
            <Select value={filters.format} onChange={e => setFilter('format', e.target.value)}>
              <option value="json">JSON</option>
              <option value="pdf">PDF (Coming Soon)</option>
              <option value="excel">Excel (Coming Soon)</option>
            </Select>
          </Field>
          <div style={{display:"flex",gap:"8px"}}>
            <button 
              onClick={clearFilters}
              style={{padding:"8px 16px",background:"var(--card)",border:"1px solid var(--border)",borderRadius:"8px",color:"var(--text)",cursor:"pointer",fontSize:"14px"}}
            >
              Clear Filters
            </button>
            <button 
              onClick={generateReport}
              disabled={loading}
              style={{padding:"8px 16px",background:"var(--primary)",border:"none",borderRadius:"8px",color:"white",cursor:"pointer",fontSize:"14px",opacity: loading ? 0.7 : 1}}
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>
      </Card>

      {/* Report Results */}
      {reportData && (
        <Card style={{marginBottom:"24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
            <h3 style={{margin:0,fontSize:"15px",fontWeight:700,color:"var(--text)"}}>
              Report Generated on {new Date(reportData.generated_at).toLocaleDateString()}
            </h3>
            <button 
              onClick={downloadReport}
              style={{padding:"8px 16px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:"8px",cursor:"pointer",fontSize:"14px"}}
            >
              Download JSON
            </button>
          </div>

          {/* Summary Section */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"16px",marginBottom:"24px"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"16px",marginBottom:"24px"}}>
              <div style={{padding:"16px",background:"var(--bg)",borderRadius:"10px",border:"1px solid var(--border)"}}>
                <div style={{fontSize:"12px",color:"var(--muted)",marginBottom:"4px"}}>Total Income</div>
                <div style={{fontSize:"20px",fontWeight:700,color:"#10b981"}}>{fmt(reportData.summary.total_income)}</div>
              </div>
              <div style={{padding:"16px",background:"var(--bg)",borderRadius:"10px",border:"1px solid var(--border)"}}>
                <div style={{fontSize:"12px",color:"var(--muted)",marginBottom:"4px"}}>Total Expenses</div>
                <div style={{fontSize:"20px",fontWeight:700,color:"#ef4444"}}>{fmt(reportData.summary.total_expenses)}</div>
              </div>
              <div style={{padding:"16px",background:"var(--bg)",borderRadius:"10px",border:"1px solid var(--border)"}}>
                <div style={{fontSize:"12px",color:"var(--muted)",marginBottom:"4px"}}>Net Profit/Loss</div>
                <div style={{fontSize:"20px",fontWeight:700,color: reportData.summary.net_profit >= 0 ? "#10b981" : "#ef4444"}}>
                {fmt(reportData.summary.net_profit)}
              </div>
            </div>
            <div style={{padding:"16px",background:"var(--bg)",borderRadius:"10px",border:"1px solid var(--border)"}}>
                <div style={{fontSize:"12px",color:"var(--muted)",marginBottom:"4px"}}>Profit Margin</div>
                <div style={{fontSize:"20px",fontWeight:700,color: reportData.summary.profit_margin >= 0 ? "#10b981" : "#ef4444"}}>
                {reportData.summary.profit_margin}%
              </div>
            </div>
            {reportData.summary.total_pending > 0 && (
              <div style={{padding:"16px",background:"var(--bg)",borderRadius:"10px",border:"1px solid var(--border)"}}>
                <div style={{fontSize:"12px",color:"var(--muted)",marginBottom:"4px"}}>Pending Payments</div>
                <div style={{fontSize:"20px",fontWeight:700,color:"#f59e0b"}}>{fmt(reportData.summary.total_pending)}</div>
              </div>
            )}
            <div style={{padding:"16px",background:"var(--bg)",borderRadius:"10px",border:"1px solid var(--border)"}}>
              <div style={{fontSize:"12px",color:"var(--muted)",marginBottom:"4px"}}>Profit Margin</div>
              <div style={{fontSize:"20px",fontWeight:700,color: reportData.summary.profit_margin >= 0 ? "#10b981" : "#ef4444"}}>
                {reportData.summary.profit_margin}%
              </div>
            </div>
          </div>
          </div>

          {/* Income and Expense Breakdown */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
            <div>
              <h4 style={{margin:"0 0 12px",fontSize:"14px",fontWeight:600,color:"var(--text)"}}>Income Breakdown</h4>
              <div style={{background:"var(--bg)",borderRadius:"8px",padding:"12px"}}>
                {reportData.income_breakdown.map((item, index) => (
                  <div key={index} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid var(--border-light)"}}>
                    <span style={{fontSize:"13px"}}>{item.category}</span>
                    <span style={{fontSize:"13px",fontWeight:600,color:"#10b981"}}>{fmt(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{margin:"0 0 12px",fontSize:"14px",fontWeight:600,color:"var(--text)"}}>Expense Breakdown</h4>
              <div style={{background:"var(--bg)",borderRadius:"8px",padding:"12px"}}>
                {reportData.expense_breakdown.map((item, index) => (
                  <div key={index} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid var(--border-light)"}}>
                    <span style={{fontSize:"13px"}}>{item.category}</span>
                    <span style={{fontSize:"13px",fontWeight:600,color:"#ef4444"}}>{fmt(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── RECEIPTS (Rent Payment Receipts) ──────────────────────────────────────────
function Receipts() {
  const [allReceipts, setAllReceipts] = useState([]);
  const [filteredReceipts, setFilteredReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('');
  const [filterTenantId, setFilterTenantId] = useState('');
  const [filterPropertyId, setFilterPropertyId] = useState('');
  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  
  useEffect(() => {
    loadAllReceipts();
    loadTenants();
  }, []);
  
  useEffect(() => {
    applyFilters();
  }, [allReceipts, selectedYear, filterTenantId, filterPropertyId]);
  
  async function loadTenants() {
    try {
      const data = await api('/tenants');
      setTenants(data || []);
    } catch (err) {
      console.error('Error loading tenants:', err);
    }
  }
  
  async function loadAllReceipts() {
    setLoading(true);
    try {
      // Load all receipts without month filter
      const [receiptsData, tenantsData, propertiesData] = await Promise.all([
        api('/receipts?limit=1000'),
        api('/tenants'),
        api('/properties')
      ]);
      setAllReceipts(receiptsData || []);
      setFilteredReceipts(receiptsData || []);
      setTenants(tenantsData || []);
      setProperties(propertiesData || []);
    } catch (err) {
      console.error('Error loading receipts:', err);
      setAllReceipts([]);
      setFilteredReceipts([]);
    } finally {
      setLoading(false);
    }
  }
  
  // Get unique years from receipts
  const availableYears = useMemo(() => {
    const years = new Set();
    allReceipts.forEach(r => {
      if (r.receipt_date) {
        years.add(new Date(r.receipt_date).getFullYear());
      }
      if (r.month_year) {
        const match = r.month_year.match(/(\d{4})/);
        if (match) years.add(parseInt(match[1]));
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [allReceipts]);
  
  function applyFilters() {
    let filtered = [...allReceipts];
    
    // Filter by year
    if (selectedYear) {
      filtered = filtered.filter(r => {
        if (r.receipt_date) {
          return new Date(r.receipt_date).getFullYear().toString() === selectedYear;
        }
        if (r.month_year) {
          return r.month_year.includes(selectedYear);
        }
        return false;
      });
    }
    
    // Filter by tenant
    if (filterTenantId) {
      filtered = filtered.filter(r => r.tenant_id?.toString() === filterTenantId);
    }
    
    // Filter by property
    if (filterPropertyId) {
      filtered = filtered.filter(r => r.property_id?.toString() === filterPropertyId);
    }
    
    setFilteredReceipts(filtered);
  }
  
  function clearFilters() {
    setSelectedYear('');
    setFilterTenantId('');
    setFilterPropertyId('');
  }
  
  async function deleteReceipt(receiptId) {
    if (!confirm('Are you sure you want to delete this receipt?')) return;
    try {
      await api(`/receipts/${receiptId}`, 'DELETE');
      loadAllReceipts();
      alert('Receipt deleted successfully');
    } catch (err) {
      alert('Error deleting receipt: ' + err.message);
    }
  }
  
  async function sendReceiptEmail(receiptId) {
    try {
      await api(`/receipts/${receiptId}/send-email`, 'POST');
      alert('Receipt sent via email successfully');
      loadAllReceipts();
    } catch (err) {
      alert('Error sending email: ' + err.message);
    }
  }
  
  async function sendReceiptWhatsApp(receiptId) {
    try {
      const receipt = allReceipts.find(r => r.id === receiptId);
      const phoneNumber = getValidPhoneNumber(receipt);
      if (receipt && phoneNumber) {
        const message = `Hello ${receipt.tenant_name}, your rent receipt ${receipt.receipt_number} for ${receipt.month_year} amounting to ₹${receipt.total_amount} has been generated. You can download it from the portal.`;
        const whatsappUrl = `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
      } else {
        alert('Tenant phone number not available');
      }
    } catch (err) {
      alert('Error sending WhatsApp: ' + err.message);
    }
  }
  
  async function downloadReceipt(id) {
    try {
      const receipt = await api(`/receipts/${id}`);
      const receiptText = `
RENT PAYMENT RECEIPT
====================

Receipt Number: ${receipt.receipt_number}
Receipt Date: ${receipt.receipt_date}
Tenant Name: ${receipt.tenant_name}
Property: ${receipt.property_name}
Unit: ${receipt.unit_number || 'N/A'}
Month/Year: ${receipt.month_year}
Amount: ₹${receipt.total_amount}
Payment Method: ${receipt.payment_method}
Payment Date: ${receipt.payment_date}
Reference: ${receipt.reference_number || 'N/A'}

Thank you for your payment!
      `;
      const blob = new Blob([receiptText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt-${receipt.receipt_number}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error downloading receipt: ' + err.message);
    }
  }

  async function downloadReceiptAsImage(id) {
    try {
      const receipt = await api(`/receipts/${id}`);
      
      // Create a temporary div for the receipt template
      const receiptDiv = document.createElement('div');
      receiptDiv.style.cssText = `
        position: fixed;
        top: -9999px;
        left: -9999px;
        width: 400px;
        padding: 40px;
        background: white;
        border: 2px solid #333;
        font-family: 'Arial', sans-serif;
        color: #333;
        line-height: 1.4;
      `;
      
      receiptDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 24px; color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px;">
            RENT PAYMENT RECEIPT
          </h1>
        </div>
        
        <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="font-weight: bold; color: #555;">Receipt Number:</span>
            <span style="font-family: monospace; background: #f8f9fa; padding: 2px 8px; border-radius: 4px;">${receipt.receipt_number}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="font-weight: bold; color: #555;">Receipt Date:</span>
            <span>${new Date(receipt.receipt_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 16px;">Tenant Information</h3>
          <div style="margin-bottom: 8px;">
            <span style="font-weight: bold; color: #555;">Name:</span>
            <span style="margin-left: 10px;">${receipt.tenant_name}</span>
          </div>
          <div style="margin-bottom: 8px;">
            <span style="font-weight: bold; color: #555;">Property:</span>
            <span style="margin-left: 10px;">${receipt.property_name}</span>
          </div>
          <div style="margin-bottom: 8px;">
            <span style="font-weight: bold; color: #555;">Unit:</span>
            <span style="margin-left: 10px;">${receipt.unit_number || 'N/A'}</span>
          </div>
        </div>
        
        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #27ae60;">
          <h3 style="margin: 0 0 15px 0; color: #27ae60; font-size: 16px;">Payment Details</h3>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="font-weight: bold; color: #555;">Month/Year:</span>
            <span>${receipt.month_year}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="font-weight: bold; color: #555;">Amount:</span>
            <span style="font-size: 18px; font-weight: bold; color: #27ae60;">₹${parseFloat(receipt.total_amount).toLocaleString('en-IN')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="font-weight: bold; color: #555;">Payment Method:</span>
            <span style="text-transform: capitalize;">${receipt.payment_method}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="font-weight: bold; color: #555;">Payment Date:</span>
            <span>${new Date(receipt.payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="font-weight: bold; color: #555;">Payment Reference:</span>
            <span style="font-family: monospace; background: #f8f9fa; padding: 2px 8px; border-radius: 4px;">${receipt.reference_number || 'N/A'}</span>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="margin: 0; color: #7f8c8d; font-style: italic;">Thank you for your payment!</p>
          <p style="margin: 5px 0 0; color: #95a5a6; font-size: 12px;">This is a computer-generated receipt</p>
        </div>
      `;
      
      document.body.appendChild(receiptDiv);
      
      // Use html2canvas if available, otherwise use a canvas-based approach
      if (window.html2canvas) {
        const canvas = await window.html2canvas(receiptDiv, {
          scale: 2,
          backgroundColor: '#ffffff'
        });
        document.body.removeChild(receiptDiv);
        
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Receipt-${receipt.receipt_number}.png`;
          a.click();
          URL.revokeObjectURL(url);
        });
      } else {
        // Fallback: create a simple canvas representation
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 400;
        canvas.height = 600;
        
        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Title
        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('RENT PAYMENT RECEIPT', 200, 40);
        
        // Receipt details
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#555';
        let y = 80;
        
        ctx.fillText(`Receipt Number: ${receipt.receipt_number}`, 40, y);
        y += 20;
        ctx.fillText(`Receipt Date: ${new Date(receipt.receipt_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, 40, y);
        y += 30;
        
        ctx.font = 'bold 14px Arial';
        ctx.fillText('Tenant Information', 40, y);
        y += 20;
        ctx.font = '12px Arial';
        ctx.fillText(`Name: ${receipt.tenant_name}`, 40, y);
        y += 20;
        ctx.fillText(`Property: ${receipt.property_name}`, 40, y);
        y += 20;
        ctx.fillText(`Unit: ${receipt.unit_number || 'N/A'}`, 40, y);
        y += 30;
        
        ctx.font = 'bold 14px Arial';
        ctx.fillText('Payment Details', 40, y);
        y += 20;
        ctx.font = '12px Arial';
        ctx.fillText(`Month/Year: ${receipt.month_year}`, 40, y);
        y += 20;
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#27ae60';
        ctx.fillText(`Amount: ₹${parseFloat(receipt.total_amount).toLocaleString('en-IN')}`, 40, y);
        y += 20;
        ctx.font = '12px Arial';
        ctx.fillStyle = '#555';
        ctx.fillText(`Payment Method: ${receipt.payment_method}`, 40, y);
        y += 20;
        ctx.fillText(`Payment Date: ${new Date(receipt.payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, 40, y);
        y += 20;
        ctx.fillText(`Payment Reference: ${receipt.reference_number || 'N/A'}`, 40, y);
        
        // Thank you message
        ctx.font = 'italic 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#7f8c8d';
        ctx.fillText('Thank you for your payment!', 200, y + 60);
        
        document.body.removeChild(receiptDiv);
        
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Receipt-${receipt.receipt_number}.png`;
          a.click();
          URL.revokeObjectURL(url);
        });
      }
    } catch (err) {
      alert('Error downloading receipt image: ' + err.message);
    }
  }
  
  // Helper function to validate mobile number format
  const isValidMobileNumber = (phone) => {
    if (!phone) return false;
    // Remove all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');
    // More lenient validation - accept any phone number with at least 10 digits
    return cleanPhone.length >= 10;
  };

  // Helper function to get valid phone number from tenant data
  const getValidPhoneNumber = (tenant) => {
    console.log('Tenant data for phone validation:', tenant);
    // Check phone field first, then emergency_contact
    const phoneToCheck = tenant.phone || tenant.emergency_contact || tenant.tenant_phone;
    console.log('Phone to check:', phoneToCheck);
    const isValid = isValidMobileNumber(phoneToCheck);
    console.log('Is valid:', isValid);
    return isValid ? phoneToCheck : null;
  };

  const totalAmount = filteredReceipts.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
  
  return (
    <Card>
      <h2 style={{margin:"0 0 20px",fontSize:"1.5rem",color:"var(--text)",display:"flex",alignItems:"center",gap:"10px"}}>
        <span style={{fontSize:"1.8rem"}}>📄</span> Rent Payment Receipts
        <span style={{marginLeft:"auto",fontSize:"0.9rem",color:"var(--text-muted)",fontWeight:500}}>
          Total: <strong style={{color:"var(--success)"}}>{filteredReceipts.length}</strong> receipts | <strong style={{color:"var(--success)"}}>₹{totalAmount.toLocaleString()}</strong>
        </span>
      </h2>
      
      {/* Filters from Receipts Table */}
      <div style={{display:"flex",gap:"12px",marginBottom:"20px",padding:"16px",background:"var(--bg-secondary)",borderRadius:"12px",border:"1px solid var(--border)",flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:"0.9rem",fontWeight:600,color:"var(--text)",marginRight:"8px"}}>Filter by:</span>
        
        <select 
          value={filterTenantId} 
          onChange={e => setFilterTenantId(e.target.value)}
          style={{padding:"8px 12px",borderRadius:"8px",border:"1px solid var(--border)",background:"var(--card)",color:"var(--text)",fontSize:"0.9rem",cursor:"pointer"}}
        >
          <option value="">All Tenants</option>
          {tenants.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        
        <select 
          value={filterPropertyId} 
          onChange={e => setFilterPropertyId(e.target.value)}
          style={{padding:"8px 12px",borderRadius:"8px",border:"1px solid var(--border)",background:"var(--card)",color:"var(--text)",fontSize:"0.9rem",cursor:"pointer"}}
        >
          <option value="">All Properties</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        
        <select 
          value={selectedYear} 
          onChange={e => setSelectedYear(e.target.value)}
          style={{padding:"8px 12px",borderRadius:"8px",border:"1px solid var(--border)",background:"var(--card)",color:"var(--text)",fontSize:"0.9rem",cursor:"pointer"}}
        >
          <option value="">All Years</option>
          {availableYears.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        
        {(filterTenantId || filterPropertyId || selectedYear) && (
          <button 
            onClick={clearFilters}
            style={{padding:"8px 16px",background:"var(--card)",border:"1px solid var(--border)",borderRadius:"8px",color:"var(--text)",cursor:"pointer",fontSize:"0.85rem"}}
          >
            Clear Filters
          </button>
        )}
      </div>
      
      {loading ? (
        <p style={{textAlign:"center",padding:"40px",color:"var(--text-secondary)"}}>Loading receipts...</p>
      ) : filteredReceipts.length === 0 ? (
        <p style={{color:"var(--text-muted)",textAlign:"center",padding:"40px",fontSize:"1rem"}}>
          {allReceipts.length === 0 
            ? "No receipts generated yet. Select a month and click 'Generate Receipts' to create receipts from rent collections."
            : "No receipts match the current filters. Try adjusting your search criteria."
          }
        </p>
      ) : (
        <div style={{overflowX:"auto",borderRadius:"12px",border:"1px solid var(--border)"}}>
          <table style={{width:"100%",borderCollapse:"separate",borderSpacing:0,fontSize:"0.9rem",background:"var(--bg-secondary)"}}>
            <thead>
              <tr style={{background:"var(--card)"}}>
                <th style={{padding:"14px 12px",textAlign:"left",borderBottom:"2px solid var(--border)",color:"var(--text)",fontWeight:600,fontSize:"0.85rem",textTransform:"uppercase",letterSpacing:"0.5px"}}>Receipt #</th>
                <th style={{padding:"14px 12px",textAlign:"left",borderBottom:"2px solid var(--border)",color:"var(--text)",fontWeight:600,fontSize:"0.85rem",textTransform:"uppercase",letterSpacing:"0.5px"}}>Date</th>
                <th style={{padding:"14px 12px",textAlign:"left",borderBottom:"2px solid var(--border)",color:"var(--text)",fontWeight:600,fontSize:"0.85rem",textTransform:"uppercase",letterSpacing:"0.5px"}}>Month/Year</th>
                <th style={{padding:"14px 12px",textAlign:"left",borderBottom:"2px solid var(--border)",color:"var(--text)",fontWeight:600,fontSize:"0.85rem",textTransform:"uppercase",letterSpacing:"0.5px"}}>Tenant</th>
                <th style={{padding:"14px 12px",textAlign:"left",borderBottom:"2px solid var(--border)",color:"var(--text)",fontWeight:600,fontSize:"0.85rem",textTransform:"uppercase",letterSpacing:"0.5px"}}>Property</th>
                <th style={{padding:"14px 12px",textAlign:"right",borderBottom:"2px solid var(--border)",color:"var(--text)",fontWeight:600,fontSize:"0.85rem",textTransform:"uppercase",letterSpacing:"0.5px"}}>Amount</th>
                <th style={{padding:"14px 12px",textAlign:"center",borderBottom:"2px solid var(--border)",color:"var(--text)",fontWeight:600,fontSize:"0.85rem",textTransform:"uppercase",letterSpacing:"0.5px"}}>Status</th>
                <th style={{padding:"14px 12px",textAlign:"center",borderBottom:"2px solid var(--border)",color:"var(--text)",fontWeight:600,fontSize:"0.85rem",textTransform:"uppercase",letterSpacing:"0.5px"}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReceipts.map(r => (
                <tr key={r.id} style={{borderBottom:"1px solid var(--border)",background:r.status==='generated'?"var(--bg-secondary)":r.status==='sent'?"rgba(59, 130, 246, 0.1)":"rgba(16, 185, 129, 0.1)",transition:"all 0.15s ease"}}>
                  <td style={{padding:"12px",fontFamily:"monospace",fontSize:"0.85rem",color:"var(--accent)",fontWeight:600}}>{r.receipt_number}</td>
                  <td style={{padding:"12px",fontSize:"0.9rem",color:"var(--text-secondary)"}}>{r.receipt_date ? new Date(r.receipt_date).toLocaleDateString('en-GB') : '-'}</td>
                  <td style={{padding:"12px",fontSize:"0.9rem",color:"var(--text)"}}>{r.month_year}</td>
                  <td style={{padding:"12px",color:"var(--text)",fontWeight:500}}>{r.tenant_name}</td>
                  <td style={{padding:"12px",fontSize:"0.9rem",color:"var(--text-secondary)"}}>{r.property_name}</td>
                  <td style={{padding:"12px",textAlign:"right",fontWeight:600,color:"var(--success)",fontSize:"0.95rem"}}>₹{parseFloat(r.total_amount)?.toLocaleString()}</td>
                  <td style={{padding:"12px",textAlign:"center"}}>
                    <span style={{padding:"6px 12px",borderRadius:"20px",fontSize:"0.75rem",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.3px",background:r.status==='generated'?"var(--warning-bg)":r.status==='sent'?"var(--info-bg)":"var(--success-bg)",color:r.status==='generated'?"var(--warning)":r.status==='sent'?"var(--info)":"var(--success)",border:`1px solid ${r.status==='generated'?'rgba(245, 158, 11, 0.3)':r.status==='sent'?'rgba(59, 130, 246, 0.3)':'rgba(16, 185, 129, 0.3)'}`}}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{padding:"10px",textAlign:"center"}}>
                    <div style={{display:"flex",gap:"6px",justifyContent:"center"}}>
                      <button onClick={() => downloadReceipt(r.id)} style={{padding:"6px 10px",background:"var(--info)",color:"#fff",border:"none",borderRadius:"6px",cursor:"pointer",fontSize:"0.75rem",fontWeight:500}} title="Download Text">
                        <Icon name="file" size={14}/>
                      </button>
                      <button onClick={() => downloadReceiptAsImage(r.id)} style={{padding:"6px 10px",background:"#8b5cf6",color:"#fff",border:"none",borderRadius:"6px",cursor:"pointer",fontSize:"0.7rem",fontWeight:500}} title="Download Image">
                        <Icon name="image" size={14}/>
                      </button>
                      <button 
                        onClick={() => sendReceiptEmail(r.id)} 
                        disabled={!r.tenant_email}
                        style={{
                          padding:"6px 10px",
                          background: r.tenant_email ? "var(--success)" : "#94a3b8",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          cursor: r.tenant_email ? "pointer" : "not-allowed",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          opacity: r.tenant_email ? 1 : 0.6
                        }} 
                        title={r.tenant_email ? "Send Email" : "Email not available - tenant email missing"}
                      >
                        <Icon name="users" size={14}/>
                      </button>
                      <button 
                        onClick={() => sendReceiptWhatsApp(r.id)} 
                        disabled={!getValidPhoneNumber(r)}
                        style={{
                          padding:"6px 10px",
                          background: getValidPhoneNumber(r) ? "#25D366" : "#94a3b8",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          cursor: getValidPhoneNumber(r) ? "pointer" : "not-allowed",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          opacity: getValidPhoneNumber(r) ? 1 : 0.6
                        }} 
                        title={
                          getValidPhoneNumber(r) 
                            ? "Send WhatsApp" 
                            : (r.phone || r.emergency_contact)
                              ? "WhatsApp not available - invalid mobile number format" 
                              : "WhatsApp not available - tenant phone missing"
                        }
                      >
                        <Icon name="crystal" size={14}/>
                      </button>
                      <button onClick={() => deleteReceipt(r.id)} style={{padding:"6px 10px",background:"#ef4444",color:"#fff",border:"none",borderRadius:"6px",cursor:"pointer",fontSize:"0.75rem",fontWeight:500}} title="Delete">
                        <Icon name="trash" size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─── TAX FILING (Income Tax Calculator) ────────────────────────────────────
function TaxFiling() {
  const [financialYear, setFinancialYear] = useState(getCurrentFinancialYear);
  const [taxData, setTaxData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  async function calculateTax() {
    setLoading(true);
    try {
      const data = await api(`/tax/calculate-financial-year/${financialYear}?municipalTaxes=0&deductions80C=0`);
      setTaxData(data);
    } catch (err) {
      console.error('Tax calculation error:', err);
      alert('Error calculating tax: ' + err.message);
    } finally {
      setLoading(false);
    }
  }
  
  async function saveFiling() {
    if (!taxData) return;
    setSaving(true);
    try {
      await api('/tax/filing', 'POST', {
        assessment_year: taxData.assessment_year,
        financial_year: taxData.financial_year,
        salary_income: 0,
        house_property_income: taxData.income_details.gross_annual_value,
        municipal_taxes_paid: taxData.income_details.property_tax_paid,
        standard_deduction: taxData.income_details.standard_deduction,
        taxable_income: taxData.income_details.taxable_income,
        tax_payable: taxData.tax_calculation.tax_payable,
        cess_amount: taxData.tax_calculation.health_education_cess_4_percent,
        total_tax_liability: taxData.tax_calculation.total_tax_liability,
        tds_credit: 0,
        tax_regime: 'new'
      });
      alert('Tax filing saved successfully!');
    } catch (err) {
      alert('Error saving filing: ' + err.message);
    } finally {
      setSaving(false);
    }
  }
  
  return (
    <Card>
      <h2 style={{margin:"0 0 20px",fontSize:"1.5rem",color:"#1f2937",display:"flex",alignItems:"center",gap:"10px"}}>
        <span style={{fontSize:"1.8rem"}}>🧮</span> Income Tax Calculator (ITR-2) - Financial Year Mode
      </h2>
      
      
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:"15px",marginBottom:"20px"}}>
        <div>
          <label style={{display:"block",marginBottom:"5px",fontWeight:"500"}}>Financial Year</label>
          <select value={financialYear} onChange={e => setFinancialYear(e.target.value)} style={{width:"100%",padding:"10px",borderRadius:"8px",border:"1px solid #d1d5db"}}>
            <option value="2026-27">2026-27</option>
            <option value="2025-26">2025-26</option>
            <option value="2024-25">2024-25</option>
            <option value="2023-24">2023-24</option>
          </select>
        </div>
      </div>
      
      <div style={{marginBottom:"20px"}}>
        <button onClick={calculateTax} disabled={loading} style={{padding:"12px 24px",background:loading?"#9ca3af":"#3b82f6",color:"#fff",border:"none",borderRadius:"8px",cursor:loading?"not-allowed":"pointer",fontWeight:"500"}}>
          {loading ? 'Calculating...' : 'Calculate Tax'}
        </button>
      </div>
      
      {taxData && (
        <div style={{marginTop:"20px"}}>
          <div style={{padding:"15px",background:"#f0f9ff",borderRadius:"8px",marginBottom:"20px",borderLeft:"4px solid #0ea5e9"}}>
            <h3 style={{margin:"0 0 10px",color:"#0369a1"}}>
              Tax Summary for Financial Year {financialYear}
            </h3>
            <p style={{margin:0,fontSize:"0.9rem",color:"#374151"}}>
              <><strong>Regime:</strong> {taxData.tax_regime}</>
            </p>
            {taxData.due_date && (
              <p style={{margin:"5px 0 0",fontSize:"0.85rem",color:"#dc2626"}}>
                <strong>ITR Filing Due Date:</strong> {taxData.due_date}
              </p>
            )}
          </div>
            
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:"15px"}}>
              <div style={{padding:"20px",background:"#e0f2fe",borderRadius:"12px",border:"2px solid #0284c7"}}>
                <div style={{fontSize:"0.9rem",color:"#075985",marginBottom:"5px",fontWeight:"600"}}>
                  Gross Annual Value
                </div>
                <div style={{fontSize:"1.5rem",fontWeight:"700",color:"#0c4a6e"}}>
                  ₹{(taxData.income_details?.gross_annual_value || 0).toLocaleString()}
                </div>
              </div>
              <div style={{padding:"20px",background:"#fef9c3",borderRadius:"12px",border:"2px solid #f59e0b"}}>
                <div style={{fontSize:"0.9rem",color:"#92400e",marginBottom:"5px",fontWeight:"600"}}>Property Tax</div>
                <div style={{fontSize:"1.5rem",fontWeight:"700",color:"#78350f"}}>
                  ₹{(taxData.income_details?.property_tax_paid || 0).toLocaleString()}
                </div>
              </div>
              <div style={{padding:"20px",background:"#dcfce7",borderRadius:"12px",border:"2px solid #16a34a"}}>
                <div style={{fontSize:"0.9rem",color:"#15803d",marginBottom:"5px",fontWeight:"600"}}>
                  Standard Deduction (₹50,000)
                </div>
                <div style={{fontSize:"1.5rem",fontWeight:"700",color:"#14532d"}}>
                  ₹{(taxData.income_details?.standard_deduction || 0).toLocaleString()}
                </div>
              </div>
              <div style={{padding:"20px",background:"#f3e8ff",borderRadius:"12px",border:"2px solid #9333ea"}}>
                <div style={{fontSize:"0.9rem",color:"#6b21a8",marginBottom:"5px",fontWeight:"600"}}>Taxable Income</div>
                <div style={{fontSize:"1.5rem",fontWeight:"700",color:"#581c87"}}>
                  ₹{(taxData.income_details?.taxable_income || 0).toLocaleString()}
                </div>
              </div>
            </div>
            
            {taxData.tax_calculation?.slab_details && (
              <div style={{padding:"20px",background:"#f9fafb",borderRadius:"12px",border:"2px solid #d1d5db",marginTop:"20px"}}>
                <h4 style={{margin:"0 0 15px",color:"#111827",fontWeight:"600"}}>Tax Slab Breakdown (New Regime FY 2026-27)</h4>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.9rem"}}>
                  <thead>
                    <tr style={{background:"#e5e7eb"}}>
                      <th style={{padding:"10px",textAlign:"left",color:"#374151",fontWeight:"600"}}>Income Slab</th>
                      <th style={{padding:"10px",textAlign:"center",color:"#374151",fontWeight:"600"}}>Rate</th>
                      <th style={{padding:"10px",textAlign:"right",color:"#374151",fontWeight:"600"}}>Taxable Amount</th>
                      <th style={{padding:"10px",textAlign:"right",color:"#374151",fontWeight:"600"}}>Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxData.tax_calculation.slab_details.map((slab, idx) => (
                      <tr key={idx} style={{borderBottom:"1px solid #d1d5db"}}>
                        <td style={{padding:"10px",color:"#111827"}}>{slab.slab}</td>
                        <td style={{padding:"10px",textAlign:"center",color:"#111827"}}>{slab.rate}</td>
                        <td style={{padding:"10px",textAlign:"right",color:"#111827"}}>₹{Math.round(slab.amount).toLocaleString()}</td>
                        <td style={{padding:"10px",textAlign:"right",fontWeight:"600",color:"#111827"}}>₹{Math.round(slab.tax).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div style={{padding:"20px",background:taxData.tax_calculation.total_tax_liability === 0 ? "#dcfce7" : "#fee2e2",borderRadius:"12px",border:"2px solid " + (taxData.tax_calculation.total_tax_liability === 0 ? "#16a34a" : "#dc2626"),marginTop:"20px"}}>
              <h3 style={{margin:"0 0 15px",color:taxData.tax_calculation.total_tax_liability === 0 ? "#15803d" : "#991b1b",fontWeight:"600"}}>
                {taxData.tax_calculation.total_tax_liability === 0 ? "No Tax Payable!" : "Tax Liability"}
              </h3>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:"15px"}}>
                <div>
                  <div style={{fontSize:"0.85rem",color:"#374151",fontWeight:"500"}}>Base Tax</div>
                  <div style={{fontSize:"1.2rem",fontWeight:"600",color:"#111827"}}>₹{taxData.tax_calculation.base_tax?.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{fontSize:"0.85rem",color:"#374151",fontWeight:"500"}}>Health & Education Cess (4%)</div>
                  <div style={{fontSize:"1.2rem",fontWeight:"600",color:"#111827"}}>₹{taxData.tax_calculation.cess_4_percent?.toLocaleString() || taxData.tax_calculation.health_education_cess_4_percent?.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{fontSize:"0.85rem",color:"#374151",fontWeight:"500"}}>Total Tax Liability</div>
                  <div style={{fontSize:"1.2rem",fontWeight:"600",color:taxData.tax_calculation.total_tax_liability > 0 ? "#dc2626" : "#16a34a"}}>₹{taxData.tax_calculation.total_tax_liability?.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{fontSize:"0.85rem",color:"#374151",fontWeight:"500"}}>Tax Payable</div>
                  <div style={{fontSize:"1.2rem",fontWeight:"600",color:taxData.tax_calculation.tax_payable > 0 ? "#dc2626" : "#16a34a"}}>
                    ₹{taxData.tax_calculation.tax_payable?.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
            
            {taxData.property_breakdown && (
              <div style={{padding:"20px",background:"#f9fafb",borderRadius:"12px",marginTop:"20px"}}>
                <h4 style={{margin:"0 0 15px"}}>Property-wise Income Breakdown</h4>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.9rem"}}>
                  <thead>
                    <tr style={{background:"#e5e7eb"}}>
                      <th style={{padding:"10px",textAlign:"left"}}>Property</th>
                      <th style={{padding:"10px",textAlign:"right"}}>GAV</th>
                      <th style={{padding:"10px",textAlign:"right"}}>Municipal Tax</th>
                      <th style={{padding:"10px",textAlign:"right"}}>Std Deduction</th>
                      <th style={{padding:"10px",textAlign:"right"}}>Income</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxData.property_breakdown.map(p => (
                      <tr key={p.property_id} style={{borderBottom:"1px solid #e5e7eb"}}>
                        <td style={{padding:"10px"}}>{p.property_name}</td>
                        <td style={{padding:"10px",textAlign:"right"}}>₹{p.gross_annual_value?.toLocaleString()}</td>
                        <td style={{padding:"10px",textAlign:"right"}}>₹{Math.round(p.municipal_taxes).toLocaleString()}</td>
                        <td style={{padding:"10px",textAlign:"right"}}>₹{Math.round(p.standard_deduction_30).toLocaleString()}</td>
                        <td style={{padding:"10px",textAlign:"right",fontWeight:"500"}}>₹{Math.round(p.income_from_property).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYOUT / APP
// ═══════════════════════════════════════════════════════════════════════════════
const PAGES = [
  { id:"dashboard", label:"Dashboard", icon:"dashboard" },
  { id:"properties", label:"Properties", icon:"building" },
  { id:"tenants", label:"Tenants", icon:"users" },
  { id:"collections", label:"Collections", icon:"rupee" },
  { id:"expenses", label:"Expenses", icon:"receipt" },
  { id:"receipts", label:"Receipts", icon:"receipt" },
  { id:"taxfiling", label:"Tax Filing", icon:"calculator" },
  { id:"ledger", label:"Ledger", icon:"book" },
  { id:"predictions", label:"Predictions", icon:"chart" },
  { id:"profitlossreport", label:"P&L Report", icon:"report" },
];

export default function App() {
  const [page, setPage] = useState("dashboard");

  const pages = { dashboard: <Dashboard/>, properties: <Properties/>, tenants: <Tenants/>, collections: <Collections/>, expenses: <Expenses/>, receipts: <Receipts/>, predictions: <Predictions/>, taxfiling: <TaxFiling/>, ledger: <Ledger/>, profitlossreport: <ProfitLossReport/> };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        
        :root {
          /* Primary Colors - Rich Navy & Teal */
          --bg: #0a0f1a;
          --bg-secondary: #111827;
          --card: #1e293b;
          --card-hover: #252f47;
          --border: #334155;
          --border-light: #475569;
          
          /* Text Colors - Better Contrast */
          --text: #f1f5f9;
          --text-secondary: #94a3b8;
          --text-muted: #64748b;
          
          /* Accent Colors */
          --accent: #06b6d4;
          --accent-hover: #0891b2;
          --accent-light: #22d3ee;
          
          /* Semantic Colors */
          --success: #10b981;
          --success-bg: rgba(16, 185, 129, 0.15);
          --warning: #f59e0b;
          --warning-bg: rgba(245, 158, 11, 0.15);
          --error: #ef4444;
          --error-bg: rgba(239, 68, 68, 0.15);
          --info: #3b82f6;
          --info-bg: rgba(59, 130, 246, 0.15);
          
          /* Gradients */
          --gradient-primary: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
          --gradient-success: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
          --gradient-card: linear-gradient(145deg, #1e293b 0%, #172033 100%);
          
          /* Shadows */
          --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
          --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
          --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3);
          --glow-accent: 0 0 20px rgba(6, 182, 212, 0.3);
        }
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body { 
          background: var(--bg); 
          color: var(--text); 
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        /* Scrollbar */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: var(--bg-secondary); border-radius: 4px; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--border-light); }
        
        /* Focus States */
        input:focus, select:focus, textarea:focus { 
          border-color: var(--accent) !important; 
          box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.25);
          outline: none;
        }
        
        /* Selection */
        ::selection {
          background: var(--accent);
          color: var(--bg);
        }
      `}</style>
      <div style={{display:"flex",minHeight:"100vh",background:"var(--bg)"}}>
        {/* Sidebar */}
        <aside style={{width:"260px",background:"linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,bottom:0,zIndex:100,boxShadow:"var(--shadow-lg)"}}>
          <div style={{padding:"28px 24px",borderBottom:"1px solid var(--border)"}}>
            <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
              <div style={{width:44,height:44,borderRadius:"12px",background:"var(--gradient-primary)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"var(--glow-accent)"}}>
                <Icon name="home" size={20} color="#fff"/>
              </div>
              <div>
                <div style={{fontWeight:700,fontSize:"16px",color:"var(--text)",letterSpacing:"-0.3px"}}>Rental Manager</div>
                <div style={{fontSize:"12px",color:"var(--text-secondary)",marginTop:"2px"}}>Property Manager</div>
              </div>
            </div>
          </div>
          <nav style={{padding:"16px 12px",flex:1}}>
            {PAGES.map(p => (
              <button key={p.id} onClick={() => setPage(p.id)} style={{
                width:"100%",display:"flex",alignItems:"center",gap:"12px",padding:"12px 16px",
                borderRadius:"10px",border:"none",cursor:"pointer",fontSize:"14px",fontWeight:page===p.id?600:500,
                textAlign:"left",marginBottom:"4px",transition:"all 0.2s ease",
                background:page===p.id?"var(--accent)":"transparent",
                color:page===p.id?"#fff":"var(--text-secondary)",
                boxShadow:page===p.id?"var(--shadow)":"none"
              }}>
                <Icon name={p.icon} size={18} color={page===p.id?"#fff":"var(--text-muted)"}/>
                <span>{p.label}</span>
                {page===p.id && <span style={{marginLeft:"auto",fontSize:"10px",opacity:0.7}}>●</span>}
              </button>
            ))}
          </nav>
          <div style={{padding:"20px",borderTop:"1px solid var(--border)",fontSize:"12px",color:"var(--text-muted)",textAlign:"center",background:"rgba(15, 23, 42, 0.5)"}}>
            <div style={{fontWeight:500,color:"var(--text-secondary)"}}>Rental Manager v2.0</div>
            <div style={{marginTop:"4px"}}>All amounts in ₹ INR</div>
          </div>
        </aside>
        {/* Main */}
        <main style={{marginLeft:"260px",flex:1,padding:"32px",minHeight:"100vh",maxWidth:"calc(100vw - 260px)",boxSizing:"border-box"}}>
          {pages[page]}
        </main>
      </div>
    </>
  );
}
