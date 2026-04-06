import { useState, useEffect, useCallback } from "react";

// Detect if running in Android/Capacitor environment
const isAndroid = typeof navigator !== 'undefined' && navigator.userAgent.includes('Android');

// Use IP address for Android to connect to backend
const API_BASE = isAndroid 
  ? "http://10.131.144.64:5000"  // Your computer's IP - works on same WiFi
  : "/api";

const API = API_BASE + "/api";

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
  try {
    const r = await fetch(API + path, opts);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  } catch (err) {
    console.error("API Error:", err);
    throw err;
  }
}

// ─── MOBILE STYLES ───────────────────────────────────────────────────────────
const mobileStyles = {
  touchButton: {
    minHeight: 48,
    minWidth: 48,
    padding: "12px 16px",
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    touchAction: "manipulation"
  },
  touchInput: {
    minHeight: 48,
    padding: "12px 16px",
    fontSize: 16,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--text)",
    width: "100%"
  },
  card: {
    background: "var(--card)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    border: "1px solid var(--border)"
  },
  bottomNav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "var(--card)",
    borderTop: "1px solid var(--border)",
    display: "flex",
    justifyContent: "space-around",
    padding: "8px 0",
    zIndex: 1000,
    paddingBottom: "env(safe-area-inset-bottom, 8px)"
  }
};

// ─── ICONS ──────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 24 }) => {
  const icons = {
    dashboard: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    building: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>,
    users: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    rupee: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 3h12M6 8h12M15 21 9 8"/><path d="M9 13h3a4 4 0 0 0 0-5H9"/></svg>,
    expense: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    plus: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
    edit: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    trash: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    close: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    trend: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/></svg>,
    crystal: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
    warn: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    home: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
    file: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>,
    menu: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
    back: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
    camera: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  };
  return icons[name] || null;
};

// ─── MOBILE MODAL ───────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
      zIndex: 1000, display: "flex", flexDirection: "column"
    }}>
      {/* Mobile Header */}
      <div style={{
        background: "var(--card)",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderBottom: "1px solid var(--border)"
      }}>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "var(--text)",
          padding: 8, borderRadius: 8
        }}>
          <Icon name="close" size={24} />
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text)", flex: 1 }}>{title}</h2>
      </div>
      {/* Mobile Content */}
      <div style={{
        flex: 1, overflow: "auto", padding: 16,
        background: "var(--bg)"
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── MOBILE FORM COMPONENTS ─────────────────────────────────────────────────
function MobileField({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: "block", fontSize: 14, fontWeight: 600,
        color: "var(--muted)", marginBottom: 8
      }}>{label}</label>
      {children}
    </div>
  );
}

function MobileInput({ type = "text", value, onChange, placeholder }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={mobileStyles.touchInput}
    />
  );
}

function MobileSelect({ value, onChange, children }) {
  return (
    <select value={value} onChange={onChange} style={mobileStyles.touchInput}>
      {children}
    </select>
  );
}

// ─── MOBILE BUTTONS ─────────────────────────────────────────────────────────
function MobileButton({ onClick, children, variant = "primary", disabled, style = {} }) {
  const colors = {
    primary: { bg: "var(--accent)", color: "#fff" },
    secondary: { bg: "var(--card)", color: "var(--text)" },
    danger: { bg: "#ef4444", color: "#fff" }
  };
  const c = colors[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...mobileStyles.touchButton,
        background: disabled ? "var(--border)" : c.bg,
        color: disabled ? "var(--muted)" : c.color,
        ...style
      }}
    >
      {children}
    </button>
  );
}

function FloatingActionButton({ onClick, icon = "plus" }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "fixed",
        bottom: 80,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        background: "var(--accent)",
        border: "none",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 12px rgba(249,115,22,0.4)",
        zIndex: 100,
        touchAction: "manipulation"
      }}
    >
      <Icon name={icon} size={24} />
    </button>
  );
}

// ─── STATUS BADGE ────────────────────────────────────────────────────────────
function Badge({ status }) {
  const colors = {
    active: "#22c55e", inactive: "#94a3b8", maintenance: "#f59e0b",
    paid: "#22c55e", pending: "#f59e0b", partial: "#3b82f6", overdue: "#ef4444",
    notice: "#f97316", commercial: "#8b5cf6", villa: "#06b6d4", apartment: "#3b82f6", house: "#10b981"
  };
  const c = colors[status] || "#94a3b8";
  return (
    <span style={{
      display: "inline-block", padding: "4px 12px", borderRadius: 20, fontSize: 12,
      fontWeight: 600, background: c + "22", color: c, border: `1px solid ${c}44`,
      textTransform: "capitalize"
    }}>{status}</span>
  );
}

// ─── MOBILE STAT CARD ────────────────────────────────────────────────────────
function MobileStatCard({ label, value, icon, color }) {
  return (
    <div style={{
      ...mobileStyles.card,
      display: "flex", alignItems: "center", gap: 12
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: color + "22", display: "flex",
        alignItems: "center", justifyContent: "center", color
      }}>
        <Icon name={icon} size={24} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{value}</div>
      </div>
    </div>
  );
}

// ─── MOBILE LIST ITEM ────────────────────────────────────────────────────────
function MobileListItem({ title, subtitle, status, onClick, onEdit, onDelete }) {
  return (
    <div
      onClick={onClick}
      style={{
        ...mobileStyles.card,
        display: "flex", alignItems: "center", gap: 12,
        cursor: onClick ? "pointer" : "default"
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 16, fontWeight: 600, color: "var(--text)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
        }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{subtitle}</div>
        )}
      </div>
      {status && <Badge status={status} />}
      {(onEdit || onDelete) && (
        <div style={{ display: "flex", gap: 8 }}>
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              style={{ background: "none", border: "none", color: "var(--accent)", padding: 8 }}
            >
              <Icon name="edit" size={20} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              style={{ background: "none", border: "none", color: "#ef4444", padding: 8 }}
            >
              <Icon name="trash" size={20} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE PAGES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── MOBILE DASHBOARD ────────────────────────────────────────────────────────
function MobileDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log("Dashboard: Starting API call to", API + "/dashboard");
    api("/dashboard")
      .then(d => {
        console.log("Dashboard: Data received", d);
        setData(d);
      })
      .catch(err => {
        console.error("Dashboard: API Error", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
      <div>Loading dashboard...</div>
      <div style={{ fontSize: 12, marginTop: 8, color: "var(--muted)" }}>
        Connecting to {API}
      </div>
    </div>
  );

  if (error) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div style={{ color: "#ef4444", fontSize: 16, marginBottom: 16 }}>
        <strong>Error:</strong> {error}
      </div>
      <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 8 }}>
        API URL: {API}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
        Check that backend is running and firewall allows port 5000
      </div>
      <button 
        onClick={() => window.location.reload()} 
        style={{ 
          padding: "12px 24px", 
          background: "var(--accent)", 
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 16
        }}
      >
        Retry
      </button>
    </div>
  );

  if (!data) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
      <div>No data received</div>
    </div>
  );
  
  const { stats } = data;

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "var(--text)" }}>Dashboard</h1>
        <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: 14 }}>Rental Overview</p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <MobileStatCard label="Properties" value={stats.totalProperties} icon="building" color="#3b82f6" />
        <MobileStatCard label="Tenants" value={stats.totalTenants} icon="users" color="#22c55e" />
        <MobileStatCard label="Collection" value={fmt(stats.monthlyCollection)} icon="rupee" color="#f97316" />
        <MobileStatCard label="Expenses" value={fmt(stats.monthlyExpenses)} icon="expense" color="#ef4444" />
      </div>

      {/* Summary Card */}
      <div style={mobileStyles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, color: "var(--muted)" }}>Net Income</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: "#22c55e" }}>{fmt(stats.netIncome)}</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
          Collection minus expenses
        </div>
      </div>
    </div>
  );
}

// ─── MOBILE PROPERTIES ───────────────────────────────────────────────────────
function MobileProperties() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const refresh = useCallback(() => api("/properties").then(setItems), []);
  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    await api(modal.id ? `/properties/${modal.id}` : "/properties", modal.id ? "PUT" : "POST", form);
    setModal(null);
    refresh();
  };

  const remove = async (id) => {
    if (!confirm("Delete this property?")) return;
    await api(`/properties/${id}`, "DELETE");
    refresh();
  };

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Properties</h1>
      </div>

      {items.map(p => (
        <MobileListItem
          key={p.id}
          title={p.name}
          subtitle={`${p.type} • ${p.units} units • ${fmt(p.monthly_rent)}/month`}
          status={p.status}
          onEdit={() => { setForm(p); setModal({ id: p.id }); }}
          onDelete={() => remove(p.id)}
        />
      ))}

      <FloatingActionButton onClick={() => { setForm({}); setModal({}); }} />

      {modal && (
        <Modal title={modal.id ? "Edit Property" : "Add Property"} onClose={() => setModal(null)}>
          <MobileField label="Name">
            <MobileInput value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Property name" />
          </MobileField>
          <MobileField label="Type">
            <MobileSelect value={form.type || "apartment"} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="apartment">Apartment</option>
              <option value="villa">Villa</option>
              <option value="commercial">Commercial</option>
            </MobileSelect>
          </MobileField>
          <MobileField label="Units">
            <MobileInput type="number" value={form.units || ""} onChange={e => setForm({ ...form, units: e.target.value })} placeholder="Number of units" />
          </MobileField>
          <MobileField label="Monthly Rent (₹)">
            <MobileInput type="number" value={form.monthly_rent || ""} onChange={e => setForm({ ...form, monthly_rent: e.target.value })} placeholder="Monthly rent amount" />
          </MobileField>
          <MobileField label="Address">
            <MobileInput value={form.address || ""} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Property address" />
          </MobileField>
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <MobileButton onClick={save} style={{ flex: 1 }}>Save</MobileButton>
            <MobileButton onClick={() => setModal(null)} variant="secondary" style={{ flex: 1 }}>Cancel</MobileButton>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── MOBILE TENANTS ──────────────────────────────────────────────────────────
function MobileTenants() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const refresh = useCallback(() => api("/tenants").then(setItems), []);
  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    await api(modal.id ? `/tenants/${modal.id}` : "/tenants", modal.id ? "PUT" : "POST", form);
    setModal(null);
    refresh();
  };

  const remove = async (id) => {
    if (!confirm("Delete this tenant?")) return;
    await api(`/tenants/${id}`, "DELETE");
    refresh();
  };

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Tenants</h1>
      </div>

      {items.map(t => (
        <MobileListItem
          key={t.id}
          title={t.name}
          subtitle={`${t.phone} • Unit ${t.unit_number || "-"}`}
          status={t.status}
          onEdit={() => { setForm(t); setModal({ id: t.id }); }}
          onDelete={() => remove(t.id)}
        />
      ))}

      <FloatingActionButton onClick={() => { setForm({}); setModal({}); }} />

      {modal && (
        <Modal title={modal.id ? "Edit Tenant" : "Add Tenant"} onClose={() => setModal(null)}>
          <MobileField label="Name">
            <MobileInput value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Tenant name" />
          </MobileField>
          <MobileField label="Phone">
            <MobileInput value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" />
          </MobileField>
          <MobileField label="Email">
            <MobileInput type="email" value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email address" />
          </MobileField>
          <MobileField label="Aadhar">
            <MobileInput value={form.aadhar_number || ""} onChange={e => setForm({ ...form, aadhar_number: e.target.value })} placeholder="Aadhar number" />
          </MobileField>
          <MobileField label="PAN">
            <MobileInput value={form.pan_number || ""} onChange={e => setForm({ ...form, pan_number: e.target.value })} placeholder="PAN number" />
          </MobileField>
          <MobileField label="Unit Number">
            <MobileInput value={form.unit_number || ""} onChange={e => setForm({ ...form, unit_number: e.target.value })} placeholder="Unit/Flat number" />
          </MobileField>
          <MobileField label="Status">
            <MobileSelect value={form.status || "active"} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="notice">Notice Period</option>
            </MobileSelect>
          </MobileField>
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <MobileButton onClick={save} style={{ flex: 1 }}>Save</MobileButton>
            <MobileButton onClick={() => setModal(null)} variant="secondary" style={{ flex: 1 }}>Cancel</MobileButton>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── MOBILE COLLECTIONS ──────────────────────────────────────────────────────
function MobileCollections() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const refresh = useCallback(() => api("/collections").then(setItems), []);
  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    await api(modal.id ? `/collections/${modal.id}` : "/collections", modal.id ? "PUT" : "POST", form);
    setModal(null);
    refresh();
  };

  const remove = async (id) => {
    if (!confirm("Delete this collection?")) return;
    await api(`/collections/${id}`, "DELETE");
    refresh();
  };

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Collections</h1>
      </div>

      {items.map(c => (
        <MobileListItem
          key={c.id}
          title={fmt(c.amount)}
          subtitle={`${c.payment_method} • ${fmtDate(c.payment_date)}`}
          status={c.status}
          onEdit={() => { setForm(c); setModal({ id: c.id }); }}
          onDelete={() => remove(c.id)}
        />
      ))}

      <FloatingActionButton onClick={() => { setForm({ category: "rent", payment_method: "upi", status: "paid" }); setModal({}); }} />

      {modal && (
        <Modal title={modal.id ? "Edit Collection" : "Add Collection"} onClose={() => setModal(null)}>
          <MobileField label="Amount (₹)">
            <MobileInput type="number" value={form.amount || ""} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="Collection amount" />
          </MobileField>
          <MobileField label="Category">
            <MobileSelect value={form.category || "rent"} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="rent">Rent</option>
              <option value="utilities">Utilities</option>
              <option value="advance">Advance</option>
              <option value="maintenance">Maintenance</option>
              <option value="deposit">Deposit</option>
            </MobileSelect>
          </MobileField>
          <MobileField label="Payment Method">
            <MobileSelect value={form.payment_method || "upi"} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </MobileSelect>
          </MobileField>
          <MobileField label="Status">
            <MobileSelect value={form.status || "paid"} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
            </MobileSelect>
          </MobileField>
          <MobileField label="Payment Date">
            <MobileInput type="date" value={form.payment_date || ""} onChange={e => setForm({ ...form, payment_date: e.target.value })} />
          </MobileField>
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <MobileButton onClick={save} style={{ flex: 1 }}>Save</MobileButton>
            <MobileButton onClick={() => setModal(null)} variant="secondary" style={{ flex: 1 }}>Cancel</MobileButton>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── MOBILE EXPENSES ─────────────────────────────────────────────────────────
function MobileExpenses() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const refresh = useCallback(() => api("/expenses").then(setItems), []);
  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    await api(modal.id ? `/expenses/${modal.id}` : "/expenses", modal.id ? "PUT" : "POST", form);
    setModal(null);
    refresh();
  };

  const remove = async (id) => {
    if (!confirm("Delete this expense?")) return;
    await api(`/expenses/${id}`, "DELETE");
    refresh();
  };

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Expenses</h1>
      </div>

      {items.map(e => (
        <MobileListItem
          key={e.id}
          title={fmt(e.amount)}
          subtitle={`${e.category} • ${fmtDate(e.expense_date)}`}
          status={e.status}
          onEdit={() => { setForm(e); setModal({ id: e.id }); }}
          onDelete={() => remove(e.id)}
        />
      ))}

      <FloatingActionButton onClick={() => { setForm({ category: "maintenance", status: "paid" }); setModal({}); }} />

      {modal && (
        <Modal title={modal.id ? "Edit Expense" : "Add Expense"} onClose={() => setModal(null)}>
          <MobileField label="Amount (₹)">
            <MobileInput type="number" value={form.amount || ""} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="Expense amount" />
          </MobileField>
          <MobileField label="Category">
            <MobileSelect value={form.category || "maintenance"} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="maintenance">Maintenance</option>
              <option value="utilities">Utilities</option>
              <option value="taxes">Taxes</option>
              <option value="insurance">Insurance</option>
              <option value="repairs">Repairs</option>
              <option value="cleaning">Cleaning</option>
              <option value="security">Security</option>
            </MobileSelect>
          </MobileField>
          <MobileField label="Description">
            <MobileInput value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Expense description" />
          </MobileField>
          <MobileField label="Vendor">
            <MobileInput value={form.vendor || ""} onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="Vendor name" />
          </MobileField>
          <MobileField label="Expense Date">
            <MobileInput type="date" value={form.expense_date || ""} onChange={e => setForm({ ...form, expense_date: e.target.value })} />
          </MobileField>
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <MobileButton onClick={save} style={{ flex: 1 }}>Save</MobileButton>
            <MobileButton onClick={() => setModal(null)} variant="secondary" style={{ flex: 1 }}>Cancel</MobileButton>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── MOBILE LEDGER ───────────────────────────────────────────────────────────
function MobileLedger() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const refresh = useCallback(() => api("/ledger").then(setItems), []);
  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    await api(modal.id ? `/ledger/${modal.id}` : "/ledger", modal.id ? "PUT" : "POST", form);
    setModal(null);
    refresh();
  };

  const remove = async (id) => {
    if (!confirm("Delete this entry?")) return;
    await api(`/ledger/${id}`, "DELETE");
    refresh();
  };

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Ledger</h1>
      </div>

      {items.map(l => (
        <MobileListItem
          key={l.id}
          title={fmt(l.amount)}
          subtitle={`${l.category} • ${fmtDate(l.entry_date)}`}
          status={l.entry_type}
          onEdit={() => { setForm(l); setModal({ id: l.id }); }}
          onDelete={() => remove(l.id)}
        />
      ))}

      <FloatingActionButton onClick={() => { setForm({ entry_type: "income" }); setModal({}); }} />

      {modal && (
        <Modal title={modal.id ? "Edit Entry" : "Add Entry"} onClose={() => setModal(null)}>
          <MobileField label="Type">
            <MobileSelect value={form.entry_type || "income"} onChange={e => setForm({ ...form, entry_type: e.target.value })}>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </MobileSelect>
          </MobileField>
          <MobileField label="Amount (₹)">
            <MobileInput type="number" value={form.amount || ""} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="Amount" />
          </MobileField>
          <MobileField label="Category">
            <MobileInput value={form.category || ""} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Category" />
          </MobileField>
          <MobileField label="Description">
            <MobileInput value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" />
          </MobileField>
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <MobileButton onClick={save} style={{ flex: 1 }}>Save</MobileButton>
            <MobileButton onClick={() => setModal(null)} variant="secondary" style={{ flex: 1 }}>Cancel</MobileButton>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── MOBILE PREDICTIONS ──────────────────────────────────────────────────────
function MobilePredictions() {
  const [predictions, setPredictions] = useState(null);

  useEffect(() => {
    api("/predictions").then(setPredictions);
  }, []);

  if (!predictions) return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, marginBottom: 16 }}>Predictions</h1>

      <div style={mobileStyles.card}>
        <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 8 }}>3-Month Forecast</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "var(--accent)" }}>
          {fmt(predictions.forecast?.nextQuarter || 0)}
        </div>
      </div>

      <div style={mobileStyles.card}>
        <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 8 }}>Predicted Occupancy</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#22c55e" }}>
          {predictions.occupancy?.predicted || 0}%
        </div>
      </div>

      <div style={mobileStyles.card}>
        <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 8 }}>Risk Score</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: predictions.risk?.score > 50 ? "#ef4444" : "#22c55e" }}>
          {predictions.risk?.score || 0}/100
        </div>
      </div>
    </div>
  );
}

// Detect screen size for responsive design
function useScreenSize() {
  const [isTablet, setIsTablet] = useState(false);
  
  useEffect(() => {
    const checkScreenSize = () => {
      setIsTablet(window.innerWidth >= 768);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
  return { isTablet, isMobile: !isTablet };
}

// Tablet-specific styles
const tabletStyles = {
  sidebar: {
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    width: 260,
    background: "var(--card)",
    borderRight: "1px solid var(--border)",
    zIndex: 100,
    padding: "20px 0",
    display: "flex",
    flexDirection: "column"
  },
  sidebarHeader: {
    padding: "0 20px 20px",
    borderBottom: "1px solid var(--border)",
    marginBottom: 12
  },
  sidebarItem: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 20px",
    border: "none",
    background: "transparent",
    color: "var(--text)",
    fontSize: 16,
    fontWeight: 400,
    cursor: "pointer",
    transition: "all 0.2s"
  },
  sidebarItemActive: {
    background: "var(--accent)22",
    color: "var(--accent)",
    fontWeight: 600,
    borderRight: "3px solid var(--accent)"
  },
  mainContent: {
    marginLeft: 260,
    minHeight: "100vh",
    padding: "24px 32px"
  },
  tabletHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 24
  },
  gridLayout: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 20
  }
};

const MOBILE_PAGES = [
  { id: "dashboard", label: "Home", icon: "dashboard" },
  { id: "properties", label: "Properties", icon: "building" },
  { id: "tenants", label: "Tenants", icon: "users" },
  { id: "collections", label: "Income", icon: "rupee" },
  { id: "expenses", label: "Expenses", icon: "expense" },
  { id: "ledger", label: "Ledger", icon: "trend" },
];

export default function MobileApp() {
  const [page, setPage] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const { isTablet, isMobile } = useScreenSize();

  const pages = {
    dashboard: <MobileDashboard />,
    properties: <MobileProperties />,
    tenants: <MobileTenants />,
    collections: <MobileCollections />,
    expenses: <MobileExpenses />,
    ledger: <MobileLedger />,
    predictions: <MobilePredictions />
  };

  // Tablet Layout
  if (isTablet) {
    return (
      <>
        <style>{`
          :root {
            --bg: #0f1117;
            --card: #1a1d27;
            --border: #2a2d3d;
            --text: #e8eaf0;
            --muted: #6b7280;
            --accent: #f97316;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
          body { 
            background: var(--bg); 
            color: var(--text); 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 16px;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          input, select, button { font-family: inherit; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: var(--bg); }
          ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        `}</style>

        {/* Tablet Sidebar Navigation */}
        <nav style={tabletStyles.sidebar}>
          <div style={tabletStyles.sidebarHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "linear-gradient(135deg,#f97316,#ea580c)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <Icon name="home" size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>RentFlow</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>Property Manager</div>
              </div>
            </div>
          </div>
          
          {MOBILE_PAGES.map(p => (
            <button
              key={p.id}
              onClick={() => setPage(p.id)}
              style={{
                ...tabletStyles.sidebarItem,
                ...(page === p.id ? tabletStyles.sidebarItemActive : {})
              }}
            >
              <Icon name={p.icon} size={22} />
              {p.label}
            </button>
          ))}
        </nav>

        {/* Tablet Main Content */}
        <main style={tabletStyles.mainContent}>
          <header style={tabletStyles.tabletHeader}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "linear-gradient(135deg,#f97316,#ea580c)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Icon name="home" size={20} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
              {MOBILE_PAGES.find(p => p.id === page)?.label || "Dashboard"}
            </h1>
          </header>
          {pages[page]}
        </main>
      </>
    );
  }

  // Mobile Layout (original)
  return (
    <>
      <style>{`
        :root {
          --bg: #0f1117;
          --card: #1a1d27;
          --border: #2a2d3d;
          --text: #e8eaf0;
          --muted: #6b7280;
          --accent: #f97316;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        body { 
          background: var(--bg); 
          color: var(--text); 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 16px;
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        input, select, button { font-family: inherit; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: var(--bg); }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
      `}</style>

      {/* Mobile Header */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0,
        background: "var(--card)", borderBottom: "1px solid var(--border)",
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
        zIndex: 100
      }}>
        <button onClick={() => setMenuOpen(true)} style={{
          background: "none", border: "none", color: "var(--text)", padding: 8
        }}>
          <Icon name="menu" size={24} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg,#f97316,#ea580c)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <Icon name="home" size={16} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18 }}>RentFlow</span>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200
          }} />
          <nav style={{
            position: "fixed", top: 0, left: 0, bottom: 0, width: 280,
            background: "var(--card)", borderRight: "1px solid var(--border)",
            zIndex: 201, padding: "16px 0"
          }}>
            <div style={{ padding: "0 16px 16px", borderBottom: "1px solid var(--border)", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "linear-gradient(135deg,#f97316,#ea580c)",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <Icon name="home" size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>RentFlow</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Property Manager</div>
                </div>
              </div>
            </div>
            {MOBILE_PAGES.map(p => (
              <button
                key={p.id}
                onClick={() => { setPage(p.id); setMenuOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px", border: "none", background: page === p.id ? "var(--accent)22" : "transparent",
                  color: page === p.id ? "var(--accent)" : "var(--text)", fontSize: 16, fontWeight: page === p.id ? 600 : 400,
                  cursor: "pointer"
                }}
              >
                <Icon name={p.icon} size={22} />
                {p.label}
              </button>
            ))}
          </nav>
        </>
      )}

      {/* Main Content */}
      <main style={{ marginTop: 56, minHeight: "calc(100vh - 56px - 64px)" }}>
        {pages[page]}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav style={mobileStyles.bottomNav}>
        {MOBILE_PAGES.slice(0, 5).map(p => (
          <button
            key={p.id}
            onClick={() => setPage(p.id)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              padding: "4px 12px", border: "none", background: "transparent",
              color: page === p.id ? "var(--accent)" : "var(--muted)", fontSize: 11,
              fontWeight: page === p.id ? 600 : 400, cursor: "pointer"
            }}
          >
            <Icon name={p.icon} size={24} />
            {p.label}
          </button>
        ))}
      </nav>
    </>
  );
}
