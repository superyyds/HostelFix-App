import React, { useState, useEffect } from 'react';
import { 
    FileText, 
    Download, 
    Filter, 
    Calendar, 
    MapPin, 
    Wrench, 
    CheckCircle, 
    Clock, 
    AlertCircle,
    Loader2,
    FileSpreadsheet,
    StepBack
} from 'lucide-react';
import { collection, query, getDocs, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../api/firebase';
import PrimaryButton from '../components/PrimaryButton';
import { motion } from 'framer-motion';

const GenerateReports = ({ onBack }) => {
    // --- State ---
    const [loading, setLoading] = useState(false);
    const [complaints, setComplaints] = useState([]);
    const [filteredComplaints, setFilteredComplaints] = useState([]);
    
    // Filters
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [campusFilter, setCampusFilter] = useState('All');
    const [dateRange, setDateRange] = useState('last30days'); // last24h, last7days, last30days, all
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    // Stats
    const [stats, setStats] = useState({
        total: 0,
        resolved: 0,
        pending: 0,
        inProgress: 0
    });

    // --- Options ---
    const categories = ['All', 'Electrical', 'Plumbing', 'Furniture', 'Civil Works', 'Internet/Wi-Fi', 'Pest Control', 'Others'];
    const campuses = ['All', 'Main Campus', 'Engineering Campus', 'Health Campus'];
    const dateRanges = [
        { value: 'last24h', label: 'Last 24 Hours' },
        { value: 'last7days', label: 'Last 7 Days' },
        { value: 'last30days', label: 'Last 30 Days' },
        { value: 'all', label: 'All Time' },
        { value: 'custom', label: 'Custom Range' }
    ];

    // --- Fetch Data ---
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // We'll fetch all complaints and filter client-side for maximum flexibility
                // In a production app with millions of records, you'd filter on the server.
                const q = query(collection(db, 'complaints'), orderBy('dateSubmitted', 'desc'));
                const querySnapshot = await getDocs(q);
                const data = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    // Normalize date for easier filtering
                    submittedDate: doc.data().dateSubmitted 
                        ? (doc.data().dateSubmitted.toDate ? doc.data().dateSubmitted.toDate() : new Date(doc.data().dateSubmitted))
                        : new Date() // Fallback to now if missing
                }));
                setComplaints(data);
            } catch (error) {
                console.error("Error fetching complaints for report:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // --- Apply Filters ---
    useEffect(() => {
        let result = complaints;

        // 1. Category
        if (categoryFilter !== 'All') {
            result = result.filter(c => c.category === categoryFilter);
        }

        // 2. Campus
        if (campusFilter !== 'All') {
            result = result.filter(c => c.campus === campusFilter);
        }

        // 3. Date Range
        const now = new Date();
        let startDate;

        if (dateRange === 'last24h') {
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        } else if (dateRange === 'last7days') {
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (dateRange === 'last30days') {
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else if (dateRange === 'custom' && customStartDate) {
            startDate = new Date(customStartDate);
        }

        if (startDate && dateRange !== 'all') {
            result = result.filter(c => c.submittedDate >= startDate);
        }

        if (dateRange === 'custom' && customEndDate) {
            const endDate = new Date(customEndDate);
            // Set to end of day
            endDate.setHours(23, 59, 59, 999);
            result = result.filter(c => c.submittedDate <= endDate);
        }

        setFilteredComplaints(result);

        // Update Stats
        setStats({
            total: result.length,
            resolved: result.filter(c => c.status === 'Resolved').length,
            pending: result.filter(c => c.status === 'Pending').length,
            inProgress: result.filter(c => c.status === 'In Progress').length
        });

    }, [complaints, categoryFilter, campusFilter, dateRange, customStartDate, customEndDate]);

    // --- Export to CSV ---
    const exportToCSV = () => {
        if (filteredComplaints.length === 0) return;

        // Define headers
        const headers = [
            'Complaint ID',
            'Status',
            'Category',
            'Priority',
            'Campus',
            'Hostel',
            'Description',
            'Submitted By',
            'Date Submitted',
            'Date Resolved',
            'Assigned To',
            'Remarks'
        ];

        // Convert data to CSV rows
        const csvRows = [
            headers.join(','), // Header row
            ...filteredComplaints.map(c => {
                const row = [
                    c.id,
                    c.status,
                    c.category,
                    c.priority,
                    c.campus,
                    c.hostel,
                    `"${(c.description || '').replace(/"/g, '""')}"`, // Escape quotes in description
                    c.userName || 'Unknown',
                    c.submittedDate.toLocaleString(),
                    c.dateResolved ? (c.dateResolved.toDate ? c.dateResolved.toDate().toLocaleString() : new Date(c.dateResolved).toLocaleString()) : 'N/A',
                    c.assignedTo || 'Unassigned',
                    `"${(c.remarks || '').replace(/"/g, '""')}"`
                ];
                return row.join(',');
            })
        ];

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `complaints_report_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-indigo-50 p-6 md:p-10 font-sans">
            
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-indigo-900 flex items-center gap-3">
                        <FileSpreadsheet className="w-8 h-8 text-indigo-600" />
                        Generate Reports
                    </h1>
                    <p className="text-gray-600 mt-1">Filter data and export comprehensive reports.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <PrimaryButton 
                        onClick={exportToCSV} 
                        className="!px-5 !py-3 !bg-green-600 hover:!bg-green-700 disabled:!bg-gray-400 !rounded-xl !shadow-md !flex !items-center whitespace-nowrap justify-center !gap-3"
                        disabled={filteredComplaints.length === 0}
                    >
                        <Download className="w-5 h-5" />
                        Export CSV
                    </PrimaryButton>

                    <PrimaryButton className="w-auto" onClick={onBack}>
                        <div className="flex items-center justify-center"><StepBack className="w-5 h-5 mr-2" />Back</div>
                    </PrimaryButton>
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
                
                {/* Left Sidebar: Filters */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Filter className="w-5 h-5 text-indigo-600" />
                            Filters
                        </h2>

                        {/* Category Filter */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Wrench className="w-4 h-4 text-gray-400" />
                                Category
                            </label>
                            <select 
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            >
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* Campus Filter */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                Campus
                            </label>
                            <select 
                                value={campusFilter}
                                onChange={(e) => setCampusFilter(e.target.value)}
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            >
                                {campuses.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* Date Range Filter */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                Time Range
                            </label>
                            <select 
                                value={dateRange}
                                onChange={(e) => setDateRange(e.target.value)}
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            >
                                {dateRanges.map(range => (
                                    <option key={range.value} value={range.value}>{range.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Custom Date Inputs */}
                        {dateRange === 'custom' && (
                            <div className="space-y-3 pt-2 border-t border-gray-100">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                                    <input 
                                        type="date" 
                                        value={customStartDate}
                                        onChange={(e) => setCustomStartDate(e.target.value)}
                                        className="w-full p-2 border rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">End Date</label>
                                    <input 
                                        type="date" 
                                        value={customEndDate}
                                        onChange={(e) => setCustomEndDate(e.target.value)}
                                        className="w-full p-2 border rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Stats Card */}
                    <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-6 rounded-2xl shadow-lg">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Report Summary
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="bg-white/10 rounded-xl p-3">
                                <div className="text-2xl font-bold">{stats.total}</div>
                                <div className="text-xs text-indigo-200">Total</div>
                            </div>
                            <div className="bg-green-500/20 rounded-xl p-3">
                                <div className="text-2xl font-bold text-green-300">{stats.resolved}</div>
                                <div className="text-xs text-green-200">Resolved</div>
                            </div>
                            <div className="bg-yellow-500/20 rounded-xl p-3">
                                <div className="text-2xl font-bold text-yellow-300">{stats.pending}</div>
                                <div className="text-xs text-yellow-200">Pending</div>
                            </div>
                            <div className="bg-blue-500/20 rounded-xl p-3">
                                <div className="text-2xl font-bold text-blue-300">{stats.inProgress}</div>
                                <div className="text-xs text-blue-200">In Progress</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content: Preview Table */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px] flex flex-col">
                        <div className="p-6 border-b border-indigo-500/30 bg-gradient-to-br from-indigo-600 to-indigo-800 flex justify-between items-center">
                            <h2 className="font-bold text-white">Data Preview</h2>
                            <span className="text-sm text-indigo-100">
                                Showing {filteredComplaints.length} result{filteredComplaints.length !== 1 && 's'}
                            </span>
                        </div>

                        <div className="overflow-x-auto flex-grow">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                    <Loader2 className="w-10 h-10 animate-spin mb-3 text-indigo-500" />
                                    <p>Fetching report data...</p>
                                </div>
                            ) : filteredComplaints.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                    <FileSpreadsheet className="w-12 h-12 mb-3 opacity-50" />
                                    <p>No complaints match your filters.</p>
                                </div>
                            ) : (
                                <table className="w-full text-center border-collapse">
                                    <thead className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white text-xs uppercase font-semibold tracking-wider text-center">
                                        <tr>
                                            <th className="p-4 border-b border-indigo-500/30">Status</th>
                                            <th className="p-4 border-b border-indigo-500/30">Category</th>
                                            <th className="p-4 border-b border-indigo-500/30">Location</th>
                                            <th className="p-4 border-b border-indigo-500/30">Date</th>
                                            <th className="p-4 border-b border-indigo-500/30">Submitted By</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm text-gray-700 divide-y divide-gray-100">
                                        {filteredComplaints.map((c) => (
                                            <motion.tr 
                                                key={c.id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="hover:bg-indigo-50/50 transition-colors"
                                            >
                                                <td className="p-4">
                                                    <span className={`text-xs px-5 py-2 rounded-lg font-semibold uppercase tracking-wide ${
                                                        c.status === 'Resolved' ? 'bg-green-100 text-green-700' :
                                                        c.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {c.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-medium">{c.category}</td>
                                                <td className="p-4 text-gray-600">
                                                    <div className="flex flex-col">
                                                        <span>{c.campus}</span>
                                                        <span className="text-xs text-gray-400">{c.hostel}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-gray-600">
                                                    {c.submittedDate.toLocaleDateString()}
                                                    <div className="text-xs text-gray-400">
                                                        {c.submittedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-gray-600">{c.userName}</td>
                                            </motion.tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GenerateReports;

