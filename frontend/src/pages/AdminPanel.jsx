import React, { useState, useEffect } from 'react';

const AdminPanel = () => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [tableSchema, setTableSchema] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({});

  const API_BASE = import.meta.env.REACT_APP_API_URL ? `${import.meta.env.REACT_APP_API_URL}/admin` : '/api/admin';
  const LIMIT = 20;

  // Load tables on mount
  useEffect(() => {
    loadTables();
    loadStats();
  }, []);

  // Load table data when table is selected
  useEffect(() => {
    if (selectedTable) {
      loadTableSchema();
      loadTableData();
    }
  }, [selectedTable, page, searchTerm]);

  const loadTables = async () => {
    try {
      const response = await fetch(`${API_BASE}/tables`);
      const data = await response.json();
      setTables(data.map(t => t.TABLE_NAME));
    } catch (err) {
      console.error('Error loading tables:', err);
      alert('Failed to load tables. Is the backend running?');
    }
  };

  const loadTableSchema = async () => {
    try {
      const response = await fetch(`${API_BASE}/table/${selectedTable}/schema`);
      const data = await response.json();
      setTableSchema(data);
    } catch (err) {
      console.error('Error loading schema:', err);
    }
  };

  const loadTableData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT, search: searchTerm });
      const response = await fetch(`${API_BASE}/table/${selectedTable}?${params}`);
      const data = await response.json();
      setTableData(data.data);
    } catch (err) {
      console.error('Error loading table data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/stats/overview`);
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const handleAddRecord = () => {
    setEditingRecord(null);
    setFormData({});
    setShowForm(true);
  };

  const handleEditRecord = (record) => {
    setEditingRecord(record);
    setFormData(record);
    setShowForm(true);
  };

  const handleDeleteRecord = async (id) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        const response = await fetch(`${API_BASE}/table/${selectedTable}/${id}`, {
          method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete record');
        loadTableData();
      } catch (err) {
        alert('Error deleting record: ' + err.message);
      }
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRecord) {
        const pkColumn = tableSchema.find(col => col.COLUMN_KEY === 'PRI')?.COLUMN_NAME;
        const pkValue = editingRecord[pkColumn];
        const response = await fetch(`${API_BASE}/table/${selectedTable}/${pkValue}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (!response.ok) throw new Error('Failed to update record');
      } else {
        const response = await fetch(`${API_BASE}/table/${selectedTable}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (!response.ok) throw new Error('Failed to create record');
      }
      setShowForm(false);
      setFormData({});
      loadTableData();
      loadStats();
    } catch (err) {
      alert('Error saving record: ' + err.message);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatDateForInput = (dateValue) => {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    const iso = date.toISOString();
    return iso.slice(0, 16); // Format: YYYY-MM-DDTHH:mm
  };

  const styles = {
    container: {
      display: 'flex',
      height: '100%',
      backgroundColor: '#f5f5f5',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    },
    header: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: '30px',
      textAlign: 'center'
    },
    headerTitle: {
      fontSize: '28px',
      fontWeight: 'bold',
      margin: '0 0 10px 0'
    },
    headerSub: {
      fontSize: '14px',
      opacity: 0.9,
      margin: 0
    },
    contentArea: {
      display: 'flex',
      flex: 1,
      gap: '20px',
      padding: '20px'
    },
    sidebar: {
      width: '250px',
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflowY: 'auto',
      maxHeight: 'calc(100vh - 200px)'
    },
    sidebarTitle: {
      fontSize: '12px',
      fontWeight: '600',
      color: '#666',
      textTransform: 'uppercase',
      marginBottom: '15px',
      letterSpacing: '1px'
    },
    tableItem: {
      display: 'block',
      width: '100%',
      padding: '10px 15px',
      marginBottom: '8px',
      border: '1px solid #e0e0e0',
      borderRadius: '6px',
      backgroundColor: '#f9f9f9',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'all 0.2s',
      textAlign: 'left',
      fontWeight: 'normal'
    },
    tableItemActive: {
      backgroundColor: '#667eea',
      color: 'white',
      borderColor: '#667eea'
    },
    main: {
      flex: 1,
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '30px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflowY: 'auto'
    },
    tableHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '25px',
      gap: '20px'
    },
    tableTitle: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#333',
      margin: 0
    },
    searchInput: {
      padding: '10px 15px',
      border: '1px solid #ddd',
      borderRadius: '6px',
      fontSize: '14px',
      width: '250px'
    },
    button: {
      padding: '10px 20px',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '14px',
      transition: 'all 0.2s'
    },
    buttonPrimary: {
      backgroundColor: '#667eea',
      color: 'white'
    },
    buttonSecondary: {
      backgroundColor: '#e0e0e0',
      color: '#333'
    },
    dataTable: {
      width: '100%',
      borderCollapse: 'collapse',
      marginBottom: '20px',
      fontSize: '14px'
    },
    tableHead: {
      backgroundColor: '#f5f5f5',
      borderBottom: '2px solid #ddd'
    },
    tableHeadCell: {
      padding: '12px 15px',
      textAlign: 'left',
      fontWeight: '600',
      color: '#333'
    },
    tableRow: {
      borderBottom: '1px solid #e0e0e0'
    },
    tableCell: {
      padding: '12px 15px',
      color: '#666'
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '15px',
      marginBottom: '30px'
    },
    statCard: {
      backgroundColor: '#f9f9f9',
      padding: '20px',
      borderRadius: '8px',
      border: '1px solid #e0e0e0'
    },
    statLabel: {
      fontSize: '12px',
      color: '#999',
      marginBottom: '8px',
      textTransform: 'uppercase'
    },
    statValue: {
      fontSize: '28px',
      fontWeight: 'bold',
      color: '#667eea'
    }
  };

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>📊 MySQL Database Admin</h1>
        <p style={styles.headerSub}>Browse and manage database tables</p>
      </div>

      {/* Statistics Grid */}
      <div style={{ padding: '20px 30px' }}>
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Total Tables</div>
            <div style={styles.statValue}>{tables.length}</div>
          </div>
          {Object.entries(stats).slice(0, 4).map(([table, count]) => (
            <div key={table} style={styles.statCard}>
              <div style={styles.statLabel}>{table}</div>
              <div style={styles.statValue}>{count}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.contentArea}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarTitle}>Tables</div>
          {tables.map(table => (
            <button
              key={table}
              style={{
                ...styles.tableItem,
                ...(selectedTable === table ? styles.tableItemActive : {})
              }}
              onClick={() => {
                setSelectedTable(table);
                setPage(1);
              }}
            >
              {table} ({stats[table] || 0})
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div style={styles.main}>
          {selectedTable ? (
            <>
              <div style={styles.tableHeader}>
                <h2 style={styles.tableTitle}>{selectedTable}</h2>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  style={styles.searchInput}
                />
                <button
                  style={{ ...styles.button, ...styles.buttonPrimary }}
                  onClick={handleAddRecord}
                >
                  + Add Record
                </button>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                  Loading...
                </div>
              ) : tableData.length > 0 ? (
                <>
                  <table style={styles.dataTable}>
                    <thead style={styles.tableHead}>
                      <tr>
                        {tableSchema.map(col => (
                          <th key={col.COLUMN_NAME} style={styles.tableHeadCell}>
                            {col.COLUMN_NAME}
                          </th>
                        ))}
                        <th style={styles.tableHeadCell}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row, idx) => (
                        <tr key={idx} style={styles.tableRow}>
                          {tableSchema.map(col => (
                            <td key={col.COLUMN_NAME} style={styles.tableCell}>
                              {String(row[col.COLUMN_NAME]).substring(0, 50)}
                            </td>
                          ))}
                          <td style={styles.tableCell}>
                            <button
                              style={{ ...styles.button, backgroundColor: '#ffc107', color: 'white', marginRight: '8px' }}
                              onClick={() => handleEditRecord(row)}
                            >
                              Edit
                            </button>
                            <button
                              style={{ ...styles.button, backgroundColor: '#dc3545', color: 'white' }}
                              onClick={() => {
                                const pkCol = tableSchema.find(c => c.COLUMN_KEY === 'PRI')?.COLUMN_NAME;
                                handleDeleteRecord(row[pkCol]);
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <button
                      style={{ ...styles.button, ...styles.buttonSecondary, marginRight: '10px' }}
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                    >
                      ← Previous
                    </button>
                    <span style={{ margin: '0 15px', fontWeight: '600' }}>Page {page}</span>
                    <button
                      style={{ ...styles.button, ...styles.buttonSecondary }}
                      onClick={() => setPage(page + 1)}
                    >
                      Next →
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                  No records found
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
              <p>Select a table from the sidebar to view data</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowForm(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '30px',
              width: '90%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>
              {editingRecord ? 'Edit Record' : 'Add New Record'}
            </h2>

            <form onSubmit={handleFormSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                {tableSchema
                  .filter(col => !['created_at', 'updated_at'].includes(col.COLUMN_NAME.toLowerCase()))
                  .map(col => (
                  <div key={col.COLUMN_NAME}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px' }}>
                      {col.COLUMN_NAME}
                    </label>
                    {col.DATA_TYPE.includes('TEXT') || col.DATA_TYPE === 'LONGTEXT' ? (
                      <textarea
                        name={col.COLUMN_NAME}
                        value={formData[col.COLUMN_NAME] || ''}
                        onChange={handleFormChange}
                        rows="3"
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      />
                    ) : col.DATA_TYPE.includes('DATETIME') || col.DATA_TYPE.includes('DATE') ? (
                      <input
                        type="datetime-local"
                        name={col.COLUMN_NAME}
                        value={formatDateForInput(formData[col.COLUMN_NAME]) || ''}
                        onChange={handleFormChange}
                        disabled={col.COLUMN_KEY === 'PRI' && editingRecord}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', opacity: col.COLUMN_KEY === 'PRI' && editingRecord ? 0.5 : 1 }}
                      />
                    ) : (
                      <input
                        type={col.DATA_TYPE.includes('INT') ? 'number' : 'text'}
                        name={col.COLUMN_NAME}
                        value={formData[col.COLUMN_NAME] || ''}
                        onChange={handleFormChange}
                        disabled={col.COLUMN_KEY === 'PRI' && editingRecord}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', opacity: col.COLUMN_KEY === 'PRI' && editingRecord ? 0.5 : 1 }}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  style={{ ...styles.button, ...styles.buttonPrimary }}
                >
                  {editingRecord ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  style={{ ...styles.button, ...styles.buttonSecondary }}
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
