import React, { useEffect, useState } from 'react';
import api from '../api';
import {
    Users,
    TrendingUp,
    Calendar,
    CheckCircle,
    XCircle,
    Clock,
    DollarSign,
    Briefcase,
    Plus,
    Lock,
    Unlock,
    Download,
    UserPlus,
    Trash2,
    Edit
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [pendingOps, setPendingOps] = useState([]);
    const [users, setUsers] = useState([]);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' or 'agents'
    const [showAddModal, setShowAddModal] = useState(false);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [newAgent, setNewAgent] = useState({
        name: '',
        email: '',
        phone: '',
        account_name: '',
        password: '',
        service_ids: []
    });
    const [newService, setNewService] = useState({
        name: '',
        description: '',
        price: ''
    });

    // Périodes
    const [period, setPeriod] = useState('month'); // day, month, year, all, custom
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [customRange, setCustomRange] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [selectedAgentId, setSelectedAgentId] = useState('');

    useEffect(() => {
        calculateDateRange();
    }, [period, customRange]);

    useEffect(() => {
        if (activeTab === 'overview' && dateRange.start) {
            fetchStats();
        }
    }, [dateRange, selectedAgentId]);

    const calculateDateRange = () => {
        if (period === 'custom') {
            const start = new Date(customRange.start);
            start.setHours(0, 0, 0, 0);
            const end = new Date(customRange.end);
            end.setHours(23, 59, 59, 999);
            setDateRange({
                start: start.toISOString(),
                end: end.toISOString()
            });
            return;
        }

        const now = new Date();
        let start = new Date();
        let end = new Date();

        if (period === 'day') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (period === 'month') {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        } else if (period === 'year') {
            start.setMonth(0, 1);
            start.setHours(0, 0, 0, 0);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        } else {
            // All time
            start = new Date(2025, 0, 1);
            end = new Date(2030, 11, 31);
        }

        setDateRange({
            start: start.toISOString(),
            end: end.toISOString()
        });
    };

    const fetchStats = async () => {
        try {
            const res = await api.get('/api/reports', {
                params: {
                    start_date: dateRange.start,
                    end_date: dateRange.end,
                    agent_id: selectedAgentId || undefined
                }
            });
            setStats(res.data);
        } catch (error) {
            console.error('Erreur stats:', error);
        }
    };

    useEffect(() => {
        fetchData();
        fetchUsers();
    }, []);

    const fetchData = async () => {
        try {
            const [pendingRes, servicesRes] = await Promise.all([
                api.get('/api/admin/operations/pending'),
                api.get('/api/services')
            ]);
            setPendingOps(pendingRes.data);
            setServices(servicesRes.data);
            // Report is fetched via separate effect now based on date, but initial load needed?
            // actually fetchStats handles it via effect [dateRange] which runs after calculateDateRange
        } catch (error) {
            console.error('Erreur lors du chargement des données', error);
        } finally {
            setLoading(false);
        }
    };

    // Data fetching trigger

    useEffect(() => {
        // Trigger initial calculation
        if (!dateRange.start) calculateDateRange();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/api/admin/users');
            setUsers(res.data.filter(u => u.role === 'agent'));
        } catch (error) {
            console.error('Erreur lors du chargement des agents', error);
        }
    };

    const handleAction = async (id, status) => {
        try {
            await api.patch(`/api/admin/operations/${id}/validate`, { status });
            fetchData();
        } catch (error) {
            alert('Erreur lors de l\'action');
        }
    };

    const handleBlockAndWipe = async (id, name) => {
        if (window.confirm(`ATTENTION: Vous allez bloquer l'agent ${name} ET SUPPRIMER DÉFINITIVEMENT toutes ses réalisations. Cette action est irréversible. Continuer ?`)) {
            const url = `/api/admin/users/${id}/wipe`;
            console.log('Appel de wipe:', url);
            try {
                await api.post(url);
                fetchUsers();
                if (dateRange.start) fetchStats();
                alert('Agent bloqué et historique supprimé.');
            } catch (error) {
                console.error('Erreur Block & Wipe:', error);
                const msg = error.response?.data?.error || error.message || 'Erreur lors de l\'opération';
                alert(`Erreur: ${msg}`);
            }
        }
    };

    const toggleUserStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
        try {
            await api.patch(`/api/admin/users/${id}/status`, { status: newStatus });
            fetchUsers();
        } catch (error) {
            alert('Erreur lors du changement de statut');
        }
    };

    const handleDeleteUser = async (id, name) => {
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'agent ${name} ? Cette action est irréversible.`)) {
            try {
                await api.delete(`/api/admin/users/${id}`);
                fetchUsers();
            } catch (error) {
                alert(error.response?.data?.error || 'Erreur lors de la suppression de l\'agent');
            }
        }
    };

    const handleAddAgent = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/admin/users', newAgent);
            setShowAddModal(false);
            setNewAgent({ name: '', email: '', phone: '', account_name: '', password: '', service_ids: [] });
            fetchUsers();
        } catch (error) {
            alert(error.response?.data?.error || 'Erreur lors de la création de l\'agent');
        }
    };

    const handleAddService = async (e) => {
        e.preventDefault();
        try {
            if (editingService) {
                await api.put(`/api/admin/services/${editingService.id}`, newService);
            } else {
                await api.post('/api/admin/services', newService);
            }
            setShowServiceModal(false);
            setEditingService(null);
            setNewService({ name: '', description: '', price: '' });
            fetchData();
        } catch (error) {
            alert(error.response?.data?.error || 'Erreur lors de l\'opération');
        }
    };

    const handleDeleteService = async (id, name) => {
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer le service "${name}" ?`)) {
            try {
                await api.delete(`/api/admin/services/${id}`);
                fetchData();
            } catch (error) {
                alert(error.response?.data?.error || 'Erreur lors de la suppression');
            }
        }
    };

    const exportPDF = () => {
        if (!stats) {
            alert("Veuillez attendre le chargement des données");
            return;
        }

        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.text('Rapport d\'Activité - TURQUOISE SPA', 14, 22);

        doc.setFontSize(12);
        doc.text(`Date du rapport : ${new Date().toLocaleDateString('fr-FR')}`, 14, 32);

        doc.autoTable({
            startY: 40,
            head: [['Statistique', 'Valeur']],
            body: [
                ['Total Encaissé', `${(stats.total || 0).toLocaleString()} Ksh`],
                ['Part Salon (40%)', `${(stats.salon_share || 0).toLocaleString()} Ksh`],
                ['Part Agents (60%)', `${(stats.agents_share || 0).toLocaleString()} Ksh`],
                ['Nombre de Services', stats.operation_count || 0]
            ],
            theme: 'grid',
            headStyles: { fillColor: [45, 212, 191] }
        });

        doc.text('Détail des Opérations Validées', 14, doc.lastAutoTable.finalY + 15);

        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 20,
            head: [['Agent', 'Service', 'Client', 'Prix', 'Date']],
            body: (stats.operations || []).map(op => [
                op.agent_name,
                op.notes || op.service_name,
                op.client_name,
                `${op.price_charged} Ksh`,
                new Date(op.service_date).toLocaleString('fr-FR')
            ]),
            theme: 'striped',
            headStyles: { fillColor: [45, 212, 191] }
        });

        doc.save(`rapport-spa-${new Date().toISOString().split('T')[0]}.pdf`);
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Chargement...</div>;

    return (
        <div className="fade-in">
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem' }}>Tableau de bord Admin</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Vue d'ensemble de l'activité du SPA</p>
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Filtrer par :</span>
                        <select
                            className="glass"
                            style={{ padding: '10px', borderRadius: '8px', color: 'white' }}
                            value={selectedAgentId}
                            onChange={(e) => setSelectedAgentId(e.target.value)}
                        >
                            <option value="">Tous les agents</option>
                            {users?.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="glass" style={{ padding: '0', overflow: 'hidden', display: 'flex' }}>
                        <button onClick={() => setPeriod('day')} className={`btn ${period === 'day' ? 'btn-primary' : ''}`} style={{ borderRadius: 0, padding: '10px 15px', background: period === 'day' ? 'var(--primary)' : 'transparent' }}>Jour</button>
                        <button onClick={() => setPeriod('month')} className={`btn ${period === 'month' ? 'btn-primary' : ''}`} style={{ borderRadius: 0, padding: '10px 15px', background: period === 'month' ? 'var(--primary)' : 'transparent' }}>Mois</button>
                        <button onClick={() => setPeriod('year')} className={`btn ${period === 'year' ? 'btn-primary' : ''}`} style={{ borderRadius: 0, padding: '10px 15px', background: period === 'year' ? 'var(--primary)' : 'transparent' }}>Année</button>
                        <button onClick={() => setPeriod('all')} className={`btn ${period === 'all' ? 'btn-primary' : ''}`} style={{ borderRadius: 0, padding: '10px 15px', background: period === 'all' ? 'var(--primary)' : 'transparent' }}>Tout</button>
                        <button onClick={() => setPeriod('custom')} className={`btn ${period === 'custom' ? 'btn-primary' : ''}`} style={{ borderRadius: 0, padding: '10px 15px', background: period === 'custom' ? 'var(--primary)' : 'transparent' }}>Perso</button>
                    </div>

                    {period === 'custom' && (
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <input
                                type="date"
                                className="glass"
                                style={{ padding: '8px', borderRadius: '6px' }}
                                value={customRange.start}
                                onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                            />
                            <span>au</span>
                            <input
                                type="date"
                                className="glass"
                                style={{ padding: '8px', borderRadius: '6px' }}
                                value={customRange.end}
                                onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                            />
                        </div>
                    )}

                    <button className="btn" onClick={exportPDF} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Download size={18} /> Exporter PDF
                    </button>
                    <div className="glass" style={{ padding: '10px 20px', display: 'flex', gap: '20px' }}>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total</span>
                            <span style={{ fontWeight: 'bold' }}>{stats?.total?.toLocaleString() || 0} Ksh</span>
                        </div>
                        <div style={{ textAlign: 'right', color: 'var(--primary)' }}>
                            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Salon</span>
                            <span style={{ fontWeight: 'bold' }}>{stats?.salon_share?.toLocaleString() || 0} Ksh</span>
                        </div>
                    </div>
                </div>
            </header>

            <nav style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`btn ${activeTab === 'overview' ? '' : 'btn-outline'}`}
                    style={{ background: activeTab === 'overview' ? 'var(--primary)' : 'transparent' }}
                >
                    Vue d'ensemble
                </button>
                <button
                    onClick={() => setActiveTab('agents')}
                    className={`btn ${activeTab === 'agents' ? '' : 'btn-outline'}`}
                    style={{ background: activeTab === 'agents' ? 'var(--primary)' : 'transparent' }}
                >
                    Gestion des Agents
                </button>
                <button
                    onClick={() => setActiveTab('services')}
                    className={`btn ${activeTab === 'services' ? '' : 'btn-outline'}`}
                    style={{ background: activeTab === 'services' ? 'var(--primary)' : 'transparent' }}
                >
                    Gestion des Services
                </button>
                <button
                    onClick={() => setActiveTab('stats')}
                    className={`btn ${activeTab === 'stats' ? '' : 'btn-outline'}`}
                    style={{ background: activeTab === 'stats' ? 'var(--primary)' : 'transparent' }}
                >
                    Rapports & Statistiques
                </button>
            </nav>

            {activeTab === 'overview' ? (
                <>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '20px',
                        marginBottom: '40px'
                    }}>
                        <div className="glass" style={{ padding: '25px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{ background: 'rgba(45, 212, 191, 0.1)', padding: '15px', borderRadius: '12px', color: 'var(--primary)' }}>
                                <TrendingUp size={28} />
                            </div>
                            <div>
                                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Services Validés</span>
                                <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats?.operation_count}</span>
                            </div>
                        </div>
                        <div className="glass" style={{ padding: '25px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '15px', borderRadius: '12px', color: 'var(--accent)' }}>
                                <Clock size={28} />
                            </div>
                            <div>
                                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.9rem' }}>En attente</span>
                                <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{pendingOps.length}</span>
                            </div>
                        </div>
                        <div className="glass" style={{ padding: '25px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '15px', borderRadius: '12px', color: 'var(--success)' }}>
                                <Users size={28} />
                            </div>
                            <div>
                                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Agents Actifs</span>
                                <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{users.filter(u => u.status === 'active').length}</span>
                            </div>
                        </div>
                    </div>

                    <section>
                        <h2 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>Opérations en attente de validation</h2>
                        <div className="glass" style={{ overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                                        <th style={{ padding: '15px' }}>Agent</th>
                                        <th style={{ padding: '15px' }}>Service</th>
                                        <th style={{ padding: '15px' }}>Client</th>
                                        <th style={{ padding: '15px' }}>Prix</th>
                                        <th style={{ padding: '15px' }}>Date</th>
                                        <th style={{ padding: '15px', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingOps.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                Aucune opération en attente
                                            </td>
                                        </tr>
                                    ) : pendingOps.map(op => (
                                        <tr key={op.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                            <td style={{ padding: '15px' }}>{op.agent_name}</td>
                                            <td style={{ padding: '15px' }}>
                                                <div style={{ fontWeight: '600' }}>{op.notes || op.service_name}</div>
                                                {op.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({op.service_name})</div>}
                                            </td>
                                            <td style={{ padding: '15px' }}>{op.client_name}</td>
                                            <td style={{ padding: '15px', fontWeight: 'bold' }}>{op.price_charged} Ksh</td>
                                            <td style={{ padding: '15px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                                {new Date(op.service_date).toLocaleString('fr-FR')}
                                            </td>
                                            <td style={{ padding: '15px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                                <button
                                                    onClick={() => handleAction(op.id, 'validated')}
                                                    className="btn"
                                                    style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)', padding: '8px 12px' }}
                                                >
                                                    <CheckCircle size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleAction(op.id, 'rejected')}
                                                    className="btn"
                                                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '8px 12px' }}
                                                >
                                                    <XCircle size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            ) : activeTab === 'agents' ? (
                <section>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '1.2rem' }}>Liste des Agents</h2>
                        <button className="btn" onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <UserPlus size={18} /> Ajouter un Agent
                        </button>
                    </div>

                    <div className="glass" style={{ overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                                    <th style={{ padding: '15px' }}>Nom</th>
                                    <th style={{ padding: '15px' }}>Identifiant</th>
                                    <th style={{ padding: '15px' }}>Email</th>
                                    <th style={{ padding: '15px' }}>Service</th>
                                    <th style={{ padding: '15px' }}>Statut</th>
                                    <th style={{ padding: '15px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <td style={{ padding: '15px' }}>{user.name}</td>
                                        <td style={{ padding: '15px', color: 'var(--primary)' }}>{user.account_name}</td>
                                        <td style={{ padding: '15px' }}>{user.email}</td>
                                        <td style={{ padding: '15px' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                                {user.service_ids && user.service_ids.length > 0 ? (
                                                    user.service_ids.map(sId => {
                                                        const service = services.find(s => s.id === sId);
                                                        return service ? (
                                                            <span key={sId} style={{
                                                                color: 'var(--primary)',
                                                                fontWeight: '500',
                                                                backgroundColor: 'rgba(45, 212, 191, 0.1)',
                                                                padding: '2px 8px',
                                                                borderRadius: '4px',
                                                                fontSize: '0.85rem'
                                                            }}>
                                                                {service.name}
                                                            </span>
                                                        ) : null;
                                                    })
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)' }}>Non assigné</span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '15px' }}>
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                fontSize: '0.8rem',
                                                background: user.status === 'active' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                color: user.status === 'active' ? 'var(--success)' : 'var(--danger)'
                                            }}>
                                                {user.status === 'active' ? 'Actif' : 'Bloqué'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '15px', textAlign: 'right' }}>
                                            <button
                                                onClick={() => toggleUserStatus(user.id, user.status)}
                                                className="btn"
                                                style={{
                                                    background: 'transparent',
                                                    color: user.status === 'active' ? 'var(--danger)' : 'var(--success)',
                                                    padding: '5px'
                                                }}
                                                title={user.status === 'active' ? 'Bloquer' : 'Débloquer'}
                                            >
                                                {user.status === 'active' ? <Lock size={18} /> : <Unlock size={18} />}
                                            </button>
                                            <button
                                                onClick={() => handleBlockAndWipe(user.id, user.name)}
                                                className="btn"
                                                style={{
                                                    background: 'transparent',
                                                    color: 'var(--accent)',
                                                    padding: '5px',
                                                    marginLeft: '5px'
                                                }}
                                                title="Bloquer & Purger l'historique"
                                            >
                                                <XCircle size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user.id, user.name)}
                                                className="btn"
                                                style={{
                                                    background: 'transparent',
                                                    color: 'var(--danger)',
                                                    padding: '5px',
                                                    marginLeft: '10px'
                                                }}
                                                title="Supprimer"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ) : activeTab === 'services' ? (
                <section>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '1.2rem' }}>Liste des Services</h2>
                        <button className="btn" onClick={() => setShowServiceModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Plus size={18} /> Ajouter un Service
                        </button>
                    </div>

                    <div className="glass" style={{ overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                                    <th style={{ padding: '15px' }}>Nom</th>
                                    <th style={{ padding: '15px' }}>Description</th>
                                    <th style={{ padding: '15px' }}>Prix</th>
                                    <th style={{ padding: '15px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {services.map(service => (
                                    <tr key={service.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <td style={{ padding: '15px', fontWeight: 'bold' }}>{service.name}</td>
                                        <td style={{ padding: '15px', color: 'var(--text-muted)' }}>{service.description}</td>
                                        <td style={{ padding: '15px', color: 'var(--primary)', fontWeight: 'bold' }}>{service.price.toLocaleString()} Ksh</td>
                                        <td style={{ padding: '15px', textAlign: 'right' }}>
                                            <button
                                                onClick={() => {
                                                    setEditingService(service);
                                                    setNewService({
                                                        name: service.name,
                                                        description: service.description || '',
                                                        price: service.price
                                                    });
                                                    setShowServiceModal(true);
                                                }}
                                                className="btn"
                                                style={{ background: 'transparent', color: 'var(--primary)', padding: '5px' }}
                                                title="Modifier"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteService(service.id, service.name)}
                                                className="btn"
                                                style={{ background: 'transparent', color: 'var(--danger)', padding: '5px', marginLeft: '10px' }}
                                                title="Supprimer"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ) : activeTab === 'stats' ? (
                <section className="fade-in">
                    <h2 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>Rapports et Statistiques</h2>

                    {/* Performance par Agent */}
                    <div style={{ marginBottom: '40px' }}>
                        <h3 style={{ marginBottom: '15px', color: 'var(--text-muted)' }}>Performance par Agent</h3>
                        <div className="glass" style={{ overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={{ padding: '15px', textAlign: 'left' }}>Agent</th>
                                        <th style={{ padding: '15px', textAlign: 'left' }}>Date</th>
                                        <th style={{ padding: '15px', textAlign: 'right' }}>Total Généré</th>
                                        <th style={{ padding: '15px', textAlign: 'right' }}>Commission Agent (60%)</th>
                                        <th style={{ padding: '15px', textAlign: 'right' }}>Part Salon (40%)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(
                                        (stats?.operations || []).reduce((acc, op) => {
                                            const date = new Date(op.service_date).toLocaleDateString('fr-FR');
                                            const key = `${op.agent_name}|${date}`;
                                            acc[key] = (acc[key] || 0) + op.price_charged;
                                            return acc;
                                        }, {})
                                    ).map(([key, total]) => {
                                        const [agent, date] = key.split('|');
                                        return (
                                            <tr key={key} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                                <td style={{ padding: '15px' }}>{agent}</td>
                                                <td style={{ padding: '15px', color: 'var(--text-muted)' }}>{date}</td>
                                                <td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold' }}>{total.toLocaleString()} Ksh</td>
                                                <td style={{ padding: '15px', textAlign: 'right', color: 'var(--accent)' }}>{(total * 0.6).toLocaleString()} Ksh</td>
                                                <td style={{ padding: '15px', textAlign: 'right', color: 'var(--primary)' }}>{(total * 0.4).toLocaleString()} Ksh</td>
                                            </tr>
                                        );
                                    })}
                                    {(stats?.operations || []).length === 0 && (
                                        <tr>
                                            <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Aucune donnée pour cette période</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Breakdown Temporel (Jour/Mois) */}
                    <div>
                        <h3 style={{ marginBottom: '15px', color: 'var(--text-muted)' }}>Détail par Période</h3>
                        <div className="glass" style={{ overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={{ padding: '15px', textAlign: 'left' }}>Date</th>
                                        <th style={{ padding: '15px', textAlign: 'right' }}>Total Encaissé</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(
                                        (stats?.operations || []).reduce((acc, op) => {
                                            // Group by Month if period is Year or All, otherwise by Day
                                            let key;
                                            const date = new Date(op.service_date);
                                            if (period === 'year' || period === 'all') {
                                                key = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                                            } else {
                                                key = date.toLocaleDateString('fr-FR');
                                            }
                                            acc[key] = (acc[key] || 0) + op.price_charged;
                                            return acc;
                                        }, {})
                                    ).map(([date, total]) => (
                                        <tr key={date} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                            <td style={{ padding: '15px' }}>{date}</td>
                                            <td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold' }}>{total.toLocaleString()} Ksh</td>
                                        </tr>
                                    ))}
                                    {(stats?.operations || []).length === 0 && (
                                        <tr>
                                            <td colSpan="2" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Aucune donnée pour cette période</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            ) : null
            }

            {
                showAddModal && (
                    <div style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.8)',
                        backdropFilter: 'blur(5px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div className="glass" style={{ width: '100%', maxWidth: '500px', padding: '30px' }}>
                            <h2 style={{ marginBottom: '20px' }}>Nouvel Agent</h2>
                            <form onSubmit={handleAddAgent} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div className="form-group">
                                    <label>Nom complet</label>
                                    <input
                                        type="text"
                                        className="glass"
                                        style={{ width: '100%', padding: '12px', marginTop: '5px' }}
                                        value={newAgent.name}
                                        onChange={e => setNewAgent({ ...newAgent, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    <div className="form-group">
                                        <label>Identifiant (Login)</label>
                                        <input
                                            type="text"
                                            className="glass"
                                            style={{ width: '100%', padding: '12px', marginTop: '5px' }}
                                            value={newAgent.account_name}
                                            onChange={e => setNewAgent({ ...newAgent, account_name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Téléphone</label>
                                        <input
                                            type="text"
                                            className="glass"
                                            style={{ width: '100%', padding: '12px', marginTop: '5px' }}
                                            value={newAgent.phone}
                                            onChange={e => setNewAgent({ ...newAgent, phone: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        className="glass"
                                        style={{ width: '100%', padding: '12px', marginTop: '5px' }}
                                        value={newAgent.email}
                                        onChange={e => setNewAgent({ ...newAgent, email: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Mot de passe</label>
                                    <input
                                        type="password"
                                        className="glass"
                                        style={{ width: '100%', padding: '12px', marginTop: '5px' }}
                                        value={newAgent.password}
                                        onChange={e => setNewAgent({ ...newAgent, password: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Services Assignés</label>
                                    <div className="glass" style={{
                                        marginTop: '10px',
                                        padding: '15px',
                                        maxHeight: '150px',
                                        overflowY: 'auto',
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '10px',
                                        background: 'rgba(0,0,0,0.3)'
                                    }}>
                                        {services.map(s => (
                                            <label key={s.id} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                cursor: 'pointer',
                                                fontSize: '0.9rem'
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={newAgent.service_ids.includes(s.id)}
                                                    onChange={e => {
                                                        const ids = e.target.checked
                                                            ? [...newAgent.service_ids, s.id]
                                                            : newAgent.service_ids.filter(id => id !== s.id);
                                                        setNewAgent({ ...newAgent, service_ids: ids });
                                                    }}
                                                    style={{ accentColor: 'var(--primary)' }}
                                                />
                                                {s.name}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <button type="submit" className="btn" style={{ flex: 1 }}>Enregistrer</button>
                                    <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>Annuler</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {
                showServiceModal && (
                    <div style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.8)',
                        backdropFilter: 'blur(5px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div className="glass" style={{ width: '100%', maxWidth: '500px', padding: '30px' }}>
                            <h2 style={{ marginBottom: '20px' }}>{editingService ? 'Modifier le Service' : 'Nouveau Service'}</h2>
                            <form onSubmit={handleAddService} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div className="form-group">
                                    <label>Nom du service</label>
                                    <input
                                        type="text"
                                        className="glass"
                                        style={{ width: '100%', padding: '12px', marginTop: '5px' }}
                                        value={newService.name}
                                        onChange={e => setNewService({ ...newService, name: e.target.value })}
                                        required
                                        placeholder="Ex: Massage Suédois"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                        className="glass"
                                        style={{ width: '100%', padding: '12px', marginTop: '5px', minHeight: '80px', fontFamily: 'inherit' }}
                                        value={newService.description}
                                        onChange={e => setNewService({ ...newService, description: e.target.value })}
                                        placeholder="Ex: Massage relaxant de 60 minutes"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Prix (Ksh)</label>
                                    <input
                                        type="number"
                                        className="glass"
                                        style={{ width: '100%', padding: '12px', marginTop: '5px' }}
                                        value={newService.price}
                                        onChange={e => setNewService({ ...newService, price: e.target.value })}
                                        required
                                        placeholder="3000"
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <button type="submit" className="btn" style={{ flex: 1 }}>
                                        {editingService ? 'Mettre à jour' : 'Enregistrer'}
                                    </button>
                                    <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => {
                                        setShowServiceModal(false);
                                        setEditingService(null);
                                        setNewService({ name: '', description: '', price: '' });
                                    }}>Annuler</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default AdminDashboard;

