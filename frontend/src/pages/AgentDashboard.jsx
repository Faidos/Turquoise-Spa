import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import {
    PlusCircle,
    UserPlus,
    ClipboardList,
    CheckCircle,
    Clock,
    XCircle,
    User,
    Plus
} from 'lucide-react';

const AgentDashboard = () => {
    const { user } = useAuth();
    const [services, setServices] = useState([]);
    const [clients, setClients] = useState([]);
    const [operations, setOperations] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form states
    const [showServiceForm, setShowServiceForm] = useState(false);
    const [showClientForm, setShowClientForm] = useState(false);
    const [selectedService, setSelectedService] = useState(null);
    const [selectedClient, setSelectedClient] = useState('');
    const [customPrice, setCustomPrice] = useState('');
    const [customServiceName, setCustomServiceName] = useState('');
    const [newClient, setNewClient] = useState({ full_name: '', phone: '', address: '' });
    const [isLibre, setIsLibre] = useState(false);
    const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);



    // Filter
    const [period, setPeriod] = useState('month'); // day, month, year, all
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    useEffect(() => {
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
            start = new Date(2025, 0, 1);
            end = new Date(2030, 11, 31);
        }

        setDateRange({ start: start.toISOString(), end: end.toISOString() });
    }, [period]);

    useEffect(() => {
        if (dateRange.start) fetchData();
    }, [dateRange]);

    const fetchData = async () => {
        try {
            // On charge services et clients en priorité
            const [servRes, clientRes] = await Promise.all([
                api.get('/api/services'),
                api.get('/api/clients')
            ]);
            setServices(servRes.data);
            setClients(clientRes.data);

            // On tente de charger les rapports séparément pour ne pas bloquer le reste en cas d'erreur
            if (dateRange.start) {
                try {
                    const opRes = await api.get('/api/agent/history', {
                        params: { start_date: dateRange.start, end_date: dateRange.end }
                    });
                    setOperations(opRes.data || []);
                } catch (err) {
                    console.error('Erreur rapports:', err);
                }
            }
        } catch (error) {
            console.error('Erreur chargement données:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddClient = async (e) => {
        if (e) e.preventDefault();
        try {
            const res = await api.post('/api/clients', newClient);
            const addedClientId = res.data.id;
            setNewClient({ full_name: '', phone: '', address: '' });
            setShowClientForm(false);
            await fetchData();
            // Si on est dans le modal de service, on sélectionne automatiquement le nouveau client
            if (showServiceForm) {
                setSelectedClient(addedClientId);
            }
        } catch (error) {
            alert('Erreur lors de l\'ajout du client');
        }
    };

    const handleRecordService = async (e) => {
        e.preventDefault();
        try {
            const serviceToPost = isLibre
                ? services.find(s => s.name === 'Service Autre')
                : selectedService;

            if (!serviceToPost) {
                alert('Erreur: Service de base non trouvé');
                return;
            }

            await api.post('/api/operations', {
                service_id: serviceToPost.id,
                client_id: selectedClient,
                price_charged: parseFloat(customPrice || serviceToPost.price),
                notes: customServiceName || null,
                service_date: serviceDate
            });

            setShowServiceForm(false);
            setCustomPrice('');
            setCustomServiceName('');
            setServiceDate(new Date().toISOString().split('T')[0]);
            setIsLibre(false);
            fetchData();
        } catch (error) {
            alert('Erreur lors de l\'enregistrement');
        }
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Chargement...</div>;

    const totalEarned = operations
        .filter(op => op.status === 'validated')
        .reduce((sum, op) => sum + op.price_charged, 0);

    return (
        <div className="fade-in">
            <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem' }}>Bonjour, {user.name}</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Session Agent - Enregistrez vos prestations</p>
                </div>
                <div className="glass" style={{ padding: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <button onClick={() => setPeriod('day')} className={`btn ${period === 'day' ? 'btn-primary' : ''}`} style={{ borderRadius: 4, padding: '5px 10px', fontSize: '0.8rem', background: period === 'day' ? 'var(--primary)' : 'transparent' }}>Jour</button>
                    <button onClick={() => setPeriod('month')} className={`btn ${period === 'month' ? 'btn-primary' : ''}`} style={{ borderRadius: 4, padding: '5px 10px', fontSize: '0.8rem', background: period === 'month' ? 'var(--primary)' : 'transparent' }}>Mois</button>
                    <button onClick={() => setPeriod('year')} className={`btn ${period === 'year' ? 'btn-primary' : ''}`} style={{ borderRadius: 4, padding: '5px 10px', fontSize: '0.8rem', background: period === 'year' ? 'var(--primary)' : 'transparent' }}>Année</button>
                    <button onClick={() => setPeriod('all')} className={`btn ${period === 'all' ? 'btn-primary' : ''}`} style={{ borderRadius: 4, padding: '5px 10px', fontSize: '0.8rem', background: period === 'all' ? 'var(--primary)' : 'transparent' }}>Tout</button>
                </div>
                <div className="glass" style={{ padding: '15px 25px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ma Part (60%)</span>
                        <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--primary)' }}>{(totalEarned * 0.6).toLocaleString()} Ksh</span>
                    </div>
                </div>
            </header>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '40px' }}>
                <button onClick={() => { setIsLibre(true); setSelectedService(null); setCustomServiceName(''); setShowServiceForm(true); }} className="btn btn-primary" style={{ flex: 1, background: 'var(--accent)' }}>
                    <PlusCircle size={20} /> Autre Service
                </button>
                <button onClick={() => setShowClientForm(true)} className="btn btn-primary" style={{ flex: 1 }}>
                    <UserPlus size={20} /> Nouveau Client
                </button>
                <div style={{ flex: 1 }}></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                <section>
                    <h2 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>Services Disponibles</h2>
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {services
                            .filter(s => s.name !== 'Service Autre')
                            .filter(s => !user.service_ids || user.service_ids.length === 0 || user.service_ids.includes(s.id))
                            .map(s => (
                                <div key={s.id} className="glass" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.1rem' }}>{s.name}</h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{s.description}</p>
                                        <span style={{ fontWeight: 'bold', color: 'var(--primary)', marginTop: '5px', display: 'block' }}>{s.price} Ksh</span>
                                    </div>
                                    <button
                                        onClick={() => { setSelectedService(s); setIsLibre(false); setCustomServiceName(''); setShowServiceForm(true); }}
                                        className="btn btn-primary"
                                        style={{ padding: '10px' }}
                                    >
                                        <PlusCircle size={20} />
                                    </button>
                                </div>
                            ))}
                    </div>
                </section>

                <section>
                    <h2 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>Mes Historiques Récents</h2>
                    <div className="glass" style={{ maxHeight: '500px', overflowY: 'auto' }}>

                        {/* Daily Summary */}
                        {operations.length > 0 && period !== 'day' && (
                            <div style={{ marginBottom: '20px', padding: '15px', borderBottom: '1px solid var(--glass-border)' }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '10px', color: 'var(--primary)' }}>Récapitulatif Journalier</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                                    {Object.entries(
                                        operations.reduce((acc, op) => {
                                            if (op.status !== 'validated') return acc;
                                            const date = new Date(op.service_date).toLocaleDateString('fr-FR');
                                            acc[date] = (acc[date] || 0) + op.price_charged;
                                            return acc;
                                        }, {})
                                    ).map(([date, total]) => (
                                        <div key={date} style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{date}</div>
                                            <div style={{ fontWeight: 'bold' }}>{total.toLocaleString()} Ksh</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {operations.length === 0 ? (
                            <p style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Aucun service enregistré</p>
                        ) : (
                            <div style={{ padding: '10px' }}>
                                {operations.map(op => (
                                    <div key={op.id} style={{
                                        padding: '15px',
                                        borderBottom: '1px solid var(--glass-border)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: '600' }}>
                                                {op.notes || op.service_name}
                                            </div>
                                            {op.notes && op.service_name !== 'Service Autre' && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({op.service_name})</div>
                                            )}
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Client: {op.client_name}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 'bold' }}>{op.price_charged} Ksh</div>
                                            <div style={{
                                                fontSize: '0.7rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                color: op.status === 'validated' ? 'var(--success)' : op.status === 'pending' ? 'var(--accent)' : 'var(--danger)'
                                            }}>
                                                {op.status === 'validated' ? <CheckCircle size={12} /> : op.status === 'pending' ? <Clock size={12} /> : <XCircle size={12} />}
                                                {op.status.toUpperCase()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* Modal Service */}
            {showServiceForm && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className="glass" style={{ padding: '30px', width: '100%', maxWidth: '500px' }}>
                        <h2 style={{ marginBottom: '20px' }}>{isLibre ? 'Prestation Libre' : `Enregistrer: ${selectedService?.name}`}</h2>
                        <form onSubmit={handleRecordService}>
                            <div className="input-group">
                                <label>{isLibre ? 'Nom de la prestation' : 'Commentaire / Détails (Optionnel)'}</label>
                                <input
                                    type="text"
                                    value={customServiceName}
                                    onChange={(e) => setCustomServiceName(e.target.value)}
                                    placeholder={isLibre ? "Ex: Soin visage spécial" : "Ex: Coupe brosse, barbe..."}
                                    required={isLibre}
                                />
                            </div>

                            <div className="input-group">
                                <label>Date de la prestation</label>
                                <input
                                    type="date"
                                    value={serviceDate}
                                    onChange={(e) => setServiceDate(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    Sélectionner le Client
                                    <button type="button" onClick={() => setShowClientForm(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Plus size={14} /> Nouveau client
                                    </button>
                                </label>
                                <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}>
                                    <option value="">-- Client de passage (Aucun) --</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>)}
                                </select>
                            </div>

                            <div className="input-group">
                                <label>Prix facturé (Ksh)</label>
                                <input
                                    type="number"
                                    placeholder={isLibre ? "0" : selectedService?.price}
                                    value={customPrice}
                                    onChange={(e) => setCustomPrice(e.target.value)}
                                    required={isLibre}
                                />
                                {!isLibre && <small style={{ color: 'var(--text-muted)' }}>Laissez vide pour utiliser le prix par défaut ({selectedService?.price} Ksh)</small>}
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                                <button type="button" onClick={() => { setShowServiceForm(false); setIsLibre(false); }} className="btn" style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)' }}>Annuler</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Confirmer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Client (Nested or separate) */}
            {showClientForm && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
                    <div className="glass" style={{ padding: '30px', width: '100%', maxWidth: '400px' }}>
                        <h2 style={{ marginBottom: '20px' }}>Ajouter un Client</h2>
                        <form onSubmit={handleAddClient}>
                            <div className="input-group">
                                <label>Nom Complet</label>
                                <input type="text" value={newClient.full_name} onChange={(e) => setNewClient({ ...newClient, full_name: e.target.value })} required />
                            </div>
                            <div className="input-group">
                                <label>Téléphone</label>
                                <input type="text" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} required />
                            </div>
                            <div className="input-group">
                                <label>Adresse (Optionnel)</label>
                                <input type="text" value={newClient.address} onChange={(e) => setNewClient({ ...newClient, address: e.target.value })} />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                                <button type="button" onClick={() => setShowClientForm(false)} className="btn" style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)' }}>Annuler</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentDashboard;
