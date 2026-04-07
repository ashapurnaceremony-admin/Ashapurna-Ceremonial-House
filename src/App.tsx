import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  doc, 
  serverTimestamp,
  deleteDoc,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updatePassword
} from 'firebase/auth';
import { auth, db } from './firebase';
import { 
  Booking, 
  Query as BookingQuery, 
  Expense, 
  FloorOption, 
  PaymentMethod, 
  BookingStatus,
  ExpenseCategory,
  OpeningBalance
} from './types';
import { generateReceiptPDF } from './lib/pdf';
import { exportToExcel } from './lib/excel';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, getYear, getMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, isSameMonth, isSameDay } from 'date-fns';
import { 
  LayoutDashboard, 
  Calendar, 
  CalendarDays,
  MessageSquare, 
  Wallet, 
  FileText, 
  Download, 
  Plus, 
  LogOut, 
  User, 
  Key,
  Share2,
  Trash2,
  Edit2,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search
} from 'lucide-react';
import { Logo } from './components/Logo';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'calendar' | 'bookings' | 'queries' | 'expenses' | 'reports'>('calendar');
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [queries, setQueries] = useState<BookingQuery[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [openingBalances, setOpeningBalances] = useState<OpeningBalance[]>([]);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [error, setError] = useState('');

  // Form States
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showQueryForm, setShowQueryForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showOpeningBalanceForm, setShowOpeningBalanceForm] = useState(false);
  const [reportYearType, setReportYearType] = useState<'calendar' | 'financial'>('calendar');
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editingQuery, setEditingQuery] = useState<BookingQuery | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showFinalReceiptModal, setShowFinalReceiptModal] = useState<Booking | null>(null);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [finalAmountReceived, setFinalAmountReceived] = useState<number>(0);
  const [finalPaymentMethod, setFinalPaymentMethod] = useState<PaymentMethod>('Cash');
  const [isPartPayment, setIsPartPayment] = useState<boolean>(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'bookings' | 'queries' | 'expenses' } | null>(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'config', 'admin'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          setError("Database connection failed. Please check your internet or Firebase setup.");
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const qBookings = query(collection(db, 'bookings'), orderBy('eventDate', 'asc'));
    const unsubscribeBookings = onSnapshot(qBookings, (snapshot) => {
      setBookings(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
    }, (err) => handleFirestoreError(err, 'list', 'bookings'));

    const qQueries = query(collection(db, 'queries'), orderBy('eventDate', 'asc'));
    const unsubscribeQueries = onSnapshot(qQueries, (snapshot) => {
      setQueries(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BookingQuery)));
    }, (err) => handleFirestoreError(err, 'list', 'queries'));

    const qExpenses = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubscribeExpenses = onSnapshot(qExpenses, (snapshot) => {
      setExpenses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Expense)));
    }, (err) => handleFirestoreError(err, 'list', 'expenses'));

    const qOpeningBalances = query(collection(db, 'openingBalances'), orderBy('year', 'desc'));
    const unsubscribeOpeningBalances = onSnapshot(qOpeningBalances, (snapshot) => {
      setOpeningBalances(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as OpeningBalance)));
    }, (err) => handleFirestoreError(err, 'list', 'openingBalances'));

    return () => {
      unsubscribeBookings(); unsubscribeQueries(); unsubscribeExpenses(); unsubscribeOpeningBalances();
    };
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const email = (loginEmail.includes('@') ? loginEmail : `${loginEmail}@ashapurna.com`).toLowerCase();
    try {
      await signInWithEmailAndPassword(auth, email, loginPassword);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        if (loginEmail.toLowerCase() === 'ashapurna2025') {
          try {
            await createUserWithEmailAndPassword(auth, email, loginPassword);
          } catch (createErr: any) { setError('Invalid username or password.'); }
        } else { setError('Invalid username or password.'); }
      } else { setError(`Login failed: ${err.message}`); }
    }
  };

  const handleFirestoreError = (error: any, operationType: string, path: string | null) => {
    console.error('Firestore Error: ', error);
    setError(`Database Error: ${error.message}`);
  };

  const handleLogout = () => signOut(auth);

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, itemToDelete.type, itemToDelete.id));
      setItemToDelete(null);
    } catch (err) {
      handleFirestoreError(err, 'delete', itemToDelete.type);
    }
  };

  const generateReceiptNo = (date: string) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const fy = month >= 4 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
    const fyBookings = bookings.filter(b => {
      const bd = new Date(b.eventDate);
      const bMonth = bd.getMonth() + 1;
      const bYear = bd.getFullYear();
      const bFy = bMonth >= 4 ? `${bYear}-${(bYear + 1).toString().slice(-2)}` : `${bYear - 1}-${bYear.toString().slice(-2)}`;
      return bFy === fy;
    });
    const serial = (fyBookings.length + 1).toString().padStart(3, '0');
    return `ASH/${fy}/${serial}`;
  };

  const handleAddBooking = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const totalAmount = Number(formData.get('totalAmount'));
    const advancePaid = Number(formData.get('advancePaid'));
    const eventDate = formData.get('eventDate') as string;
    const bookingData: Omit<Booking, 'id'> = {
      customerName: formData.get('customerName') as string,
      address: formData.get('address') as string,
      phoneNumber: formData.get('phoneNumber') as string,
      eventDate,
      occasion: formData.get('occasion') as string,
      noOfGuests: Number(formData.get('noOfGuests')),
      floorsRented: formData.get('floorsRented') as FloorOption,
      totalAmount, advancePaid,
      balanceDue: totalAmount - advancePaid,
      paymentMethod: formData.get('paymentMethod') as PaymentMethod,
      status: 'Pending',
      receiptNo: editingBooking?.receiptNo || generateReceiptNo(eventDate),
      notes: formData.get('notes') as string,
      createdAt: editingBooking ? editingBooking.createdAt : new Date().toISOString(),
      payments: editingBooking?.payments || [{
        amount: advancePaid,
        date: new Date().toISOString(),
        method: formData.get('paymentMethod') as PaymentMethod,
        type: 'Advance'
      }]
    };
    try {
      if (editingBooking) {
        await updateDoc(doc(db, 'bookings', editingBooking.id!), bookingData);
        setEditingBooking(null);
      } else {
        await addDoc(collection(db, 'bookings'), bookingData);
      }
      setShowBookingForm(false);
    } catch (err) { handleFirestoreError(err, editingBooking ? 'update' : 'create', 'bookings'); }
  };

  const handleAddQuery = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const queryData: Omit<BookingQuery, 'id'> = {
      customerName: formData.get('customerName') as string,
      phoneNumber: formData.get('phoneNumber') as string,
      eventDate: formData.get('eventDate') as string,
      occasion: formData.get('occasion') as string,
      approxGuests: Number(formData.get('approxGuests')),
      quotedPrice: Number(formData.get('quotedPrice')),
      status: (formData.get('status') as any) || 'General Enquiry',
      createdAt: editingQuery ? editingQuery.createdAt : new Date().toISOString()
    };
    try {
      if (editingQuery) {
        await updateDoc(doc(db, 'queries', editingQuery.id!), queryData);
        setEditingQuery(null);
      } else {
        await addDoc(collection(db, 'queries'), queryData);
      }
      setShowQueryForm(false);
    } catch (err) { handleFirestoreError(err, editingQuery ? 'update' : 'create', 'queries'); }
  };

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const expenseData: Omit<Expense, 'id'> = {
      date: formData.get('date') as string,
      amount: Number(formData.get('amount')),
      category: formData.get('category') as ExpenseCategory,
      description: formData.get('description') as string,
      paymentMethod: formData.get('paymentMethod') as PaymentMethod,
      createdAt: editingExpense ? editingExpense.createdAt : new Date().toISOString()
    };
    try {
      if (editingExpense) {
        await updateDoc(doc(db, 'expenses', editingExpense.id!), expenseData);
        setEditingExpense(null);
      } else {
        await addDoc(collection(db, 'expenses'), expenseData);
      }
      setShowExpenseForm(false);
    } catch (err) { handleFirestoreError(err, editingExpense ? 'update' : 'create', 'expenses'); }
  };

  const handleAddOpeningBalance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const year = Number(formData.get('year'));
    const data: Omit<OpeningBalance, 'id'> = {
      bankBalance: Number(formData.get('bankBalance')),
      cashInHand: Number(formData.get('cashInHand')),
      year, createdAt: new Date().toISOString()
    };
    try {
      const existing = openingBalances.find(ob => ob.year === year);
      if (existing) { await updateDoc(doc(db, 'openingBalances', existing.id!), data as any); }
      else { await addDoc(collection(db, 'openingBalances'), data); }
      setShowOpeningBalanceForm(false);
    } catch (err) { handleFirestoreError(err, 'create', 'openingBalances'); }
  };

  const handleFinalPayment = async () => {
    if (!showFinalReceiptModal) return;
    const booking = showFinalReceiptModal;
    const newAdvance = booking.advancePaid + finalAmountReceived;
    const newBalance = booking.totalAmount - newAdvance;
    const newPayment = {
      amount: finalAmountReceived,
      date: new Date().toISOString(),
      method: finalPaymentMethod,
      type: isPartPayment ? 'Part' : 'Final'
    };
    try {
      const pdf = await generateReceiptPDF(booking, true, finalAmountReceived, isPartPayment);
      const safeName = booking.customerName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      pdf.save(`${isPartPayment ? 'Part' : 'Final'}_Receipt_${safeName}.pdf`);
      await updateDoc(doc(db, 'bookings', booking.id!), {
        advancePaid: newAdvance, balanceDue: newBalance,
        paymentMethod: finalPaymentMethod,
        status: !isPartPayment && newBalance <= 0 ? 'Completed' : booking.status,
        payments: [...(booking.payments || []), newPayment]
      });
      setShowFinalReceiptModal(null); setIsPartPayment(false); setFinalAmountReceived(0);
    } catch (err) { handleFirestoreError(err, 'update', 'bookings'); }
  };

  const sharePDF = async (booking: Booking, isFinal: boolean = false) => {
    try {
      const pdf = await generateReceiptPDF(booking, isFinal);
      const safeName = booking.customerName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      pdf.save(`Receipt_${safeName}.pdf`);
    } catch (err) { setError("Failed to generate PDF."); }
  };

  const groupedBookings = useMemo(() => {
    const groups: { [key: string]: Booking[] } = {};
    bookings.forEach(b => {
      const monthYear = format(new Date(b.eventDate), 'MMMM yyyy');
      if (!groups[monthYear]) groups[monthYear] = [];
      groups[monthYear].push(b);
    });
    return groups;
  }, [bookings]);

  const groupedQueries = useMemo(() => {
    const groups: { [key: string]: BookingQuery[] } = {};
    queries.forEach(q => {
      const monthYear = format(new Date(q.eventDate), 'MMMM yyyy');
      if (!groups[monthYear]) groups[monthYear] = [];
      groups[monthYear].push(q);
    });
    return groups;
  }, [queries]);

  const stats = useMemo(() => {
    const now = new Date();
    const filterByYear = (dateStr: string) => {
      const d = new Date(dateStr);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      if (reportYearType === 'calendar') return y === reportYear;
      const fyStartYear = reportYear; const fyEndYear = reportYear + 1;
      return m >= 4 ? y === fyStartYear : y === fyEndYear;
    };
    const filteredBookings = bookings.filter(b => filterByYear(b.eventDate));
    const filteredExpenses = expenses.filter(e => filterByYear(e.date));

    // Helper to get all payments for filtered bookings
    const allPayments = bookings.flatMap(b => (b.payments || []).map(p => ({ ...p, eventDate: b.eventDate })));
    const filteredPayments = allPayments.filter(p => filterByYear(p.eventDate));

    const monthlyIncome = allPayments.filter(p => getMonth(new Date(p.date)) === getMonth(now) && getYear(new Date(p.date)) === getYear(now)).reduce((acc, p) => acc + p.amount, 0);
    const monthlyExpenses = expenses.filter(e => getMonth(new Date(e.date)) === getMonth(now) && getYear(new Date(e.date)) === getYear(now) && e.category !== 'Cash Deposited to Bank').reduce((acc, e) => acc + e.amount, 0);
    
    const completedYearlyIncome = filteredBookings.filter(b => b.status === 'Completed').reduce((acc, b) => acc + b.totalAmount, 0);
    const projectedYearlyIncome = filteredBookings.reduce((acc, b) => acc + b.totalAmount, 0);
    const averageMonthlyIncome = projectedYearlyIncome / 12;

    const yearlyIncome = filteredPayments.reduce((acc, p) => acc + p.amount, 0);
    const yearlyExpenses = filteredExpenses.filter(e => e.category !== 'Cash Deposited to Bank').reduce((acc, e) => acc + e.amount, 0);
    
    const opening = openingBalances.find(ob => ob.year === reportYear) || { bankBalance: 0, cashInHand: 0 };
    
    const cashIncome = filteredPayments.filter(p => p.method === 'Cash').reduce((acc, p) => acc + p.amount, 0);
    const bankIncome = filteredPayments.filter(p => p.method !== 'Cash').reduce((acc, p) => acc + p.amount, 0);
    const cashExpenses = filteredExpenses.filter(e => e.paymentMethod === 'Cash' && e.category !== 'Cash Deposited to Bank').reduce((acc, e) => acc + e.amount, 0);
    const bankExpenses = filteredExpenses.filter(e => e.paymentMethod !== 'Cash' && e.category !== 'Cash Deposited to Bank').reduce((acc, e) => acc + e.amount, 0);
    const cashDepositedToBank = filteredExpenses.filter(e => e.category === 'Cash Deposited to Bank').reduce((acc, e) => acc + e.amount, 0);
    return { 
      monthlyIncome, monthlyExpenses, yearlyIncome, yearlyExpenses,
      completedYearlyIncome, projectedYearlyIncome, averageMonthlyIncome,
      cashInHand: opening.cashInHand + cashIncome - cashExpenses - cashDepositedToBank,
      bankBalance: opening.bankBalance + bankIncome - bankExpenses + cashDepositedToBank,
      opening 
    };
  }, [bookings, expenses, openingBalances, reportYear, reportYearType]);

  if (loading) return <div className="flex items-center justify-center h-screen"><Logo className="animate-pulse w-32 h-32" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-amber-100">
          <div className="flex flex-col items-center mb-8">
            <Logo className="w-32 h-32 mb-4" />
            <h1 className="text-3xl font-serif font-bold text-amber-900">Ashapurna</h1>
            <p className="text-amber-700 font-medium">Ceremonial Hall Management</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input type="text" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 outline-none transition-all" placeholder="Ashapurna2025" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 outline-none transition-all" placeholder="••••••••" required />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" className="w-full bg-amber-700 hover:bg-amber-800 text-white font-bold py-3 rounded-lg transition-colors shadow-lg">Login to Dashboard</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfbf7] flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-white border-r border-amber-100 flex flex-col shadow-sm">
        <div className="p-6 flex flex-col items-center border-b border-amber-50">
          <Logo className="w-20 h-20 mb-2" />
          <h2 className="text-xl font-serif font-bold text-amber-900">Ashapurna</h2>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'calendar', label: 'Calendar', icon: CalendarDays },
            { id: 'bookings', label: 'Bookings', icon: Calendar },
            { id: 'queries', label: 'Queries', icon: MessageSquare },
            { id: 'expenses', label: 'Expenses', icon: Wallet },
            { id: 'reports', label: 'Financial Reports', icon: LayoutDashboard },
          ].map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium", activeTab === item.id ? "bg-amber-50 text-amber-800 shadow-sm" : "text-gray-500 hover:bg-gray-50")}>
              <item.icon size={20} /> {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-amber-50 space-y-2">
          <button onClick={() => setShowChangePasswordModal(true)} className="w-full flex items-center gap-3 px-4 py-3 text-amber-700 hover:bg-amber-50 rounded-xl transition-all font-medium"><Key size={20} /> Change Password</button>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all font-medium"><LogOut size={20} /> Logout</button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-gray-900 capitalize">{activeTab}</h1>
            <p className="text-gray-500">Manage your banquet hall {activeTab} efficiently.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => exportToExcel(bookings, queries, expenses)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all shadow-sm text-sm font-medium"><Download size={18} /> Export Excel</button>
            {activeTab === 'bookings' && <button onClick={() => setShowBookingForm(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-all shadow-md text-sm font-medium"><Plus size={18} /> New Booking</button>}
            {activeTab === 'queries' && <button onClick={() => setShowQueryForm(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-all shadow-md text-sm font-medium"><Plus size={18} /> New Query</button>}
            {activeTab === 'expenses' && <button onClick={() => { setEditingExpense(null); setShowExpenseForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-all shadow-md text-sm font-medium"><Plus size={18} /> Add Expense</button>}
          </div>
        </header>

        <div className="space-y-8">
          {activeTab === 'calendar' && (
            <div className="bg-white rounded-2xl shadow-sm border border-amber-50 p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <select value={getMonth(currentCalendarMonth)} onChange={(e) => { const d = new Date(currentCalendarMonth); d.setMonth(parseInt(e.target.value)); setCurrentCalendarMonth(d); }} className="px-3 py-2 rounded-lg border border-gray-300 font-bold text-amber-900 bg-white">
                    {Array.from({ length: 12 }).map((_, i) => <option key={i} value={i}>{format(new Date(2000, i, 1), 'MMMM')}</option>)}
                  </select>
                  <select value={getYear(currentCalendarMonth)} onChange={(e) => { const d = new Date(currentCalendarMonth); d.setFullYear(parseInt(e.target.value)); setCurrentCalendarMonth(d); }} className="px-3 py-2 rounded-lg border border-gray-300 font-bold text-amber-900 bg-white">
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentCalendarMonth(subMonths(currentCalendarMonth, 1))} className="p-2 hover:bg-amber-50 rounded-lg text-amber-700"><ChevronLeft size={24} /></button>
                  <button onClick={() => setCurrentCalendarMonth(new Date())} className="px-4 py-2 hover:bg-amber-50 rounded-lg text-amber-700 font-medium">Today</button>
                  <button onClick={() => setCurrentCalendarMonth(addMonths(currentCalendarMonth, 1))} className="p-2 hover:bg-amber-50 rounded-lg text-amber-700"><ChevronRight size={24} /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-200">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="bg-amber-50 py-2 text-center text-sm font-bold text-amber-900">{day}</div>)}
                {eachDayOfInterval({ start: startOfWeek(startOfMonth(currentCalendarMonth)), end: endOfWeek(endOfMonth(currentCalendarMonth)) }).map((day) => {
                  const dayBookings = bookings.filter(b => isSameDay(new Date(b.eventDate), day));
                  const dayQueries = queries.filter(q => isSameDay(new Date(q.eventDate), day) && q.status === 'Keep the date on hold');
                  return (
                    <div key={day.toISOString()} className={cn("min-h-[100px] bg-white p-2", !isSameMonth(day, currentCalendarMonth) && "bg-gray-50 text-gray-400", isSameDay(day, new Date()) && "bg-amber-50/30")}>
                      <span className={cn("text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full", isSameDay(day, new Date()) ? "bg-amber-700 text-white" : "text-gray-700")}>{format(day, 'd')}</span>
                      <div className="mt-1 space-y-1">
                        {dayBookings.map(b => <div key={b.id} className="text-[10px] p-1 rounded bg-green-100 text-green-800 border border-green-200 truncate font-bold">{b.customerName}</div>)}
                        {dayQueries.map(q => <div key={q.id} className="text-[10px] p-1 rounded bg-amber-100 text-amber-800 border border-amber-200 truncate font-bold">HOLD: {q.customerName}</div>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'bookings' && Object.entries(groupedBookings).map(([month, items]) => (
            <section key={month} className="space-y-4">
              <h3 className="text-lg font-bold text-amber-900 border-b border-amber-100 pb-2">{month}</h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {(items as Booking[]).map(booking => (
                  <div key={booking.id} className="bg-white p-6 rounded-2xl shadow-sm border border-amber-50 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div><h4 className="text-xl font-bold text-gray-900">{booking.customerName}</h4><p className="text-amber-700 font-medium">{booking.occasion} • {format(new Date(booking.eventDate), 'dd MMM yyyy')}</p></div>
                      <span className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase", booking.status === 'Completed' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>{booking.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-2 text-sm text-gray-600 mb-6">
                      <p><span className="font-medium">Phone:</span> {booking.phoneNumber}</p><p><span className="font-medium">Guests:</span> {booking.noOfGuests}</p>
                      <p className="col-span-2"><span className="font-medium">Floors:</span> {booking.floorsRented}</p>
                      <p><span className="font-medium">Total:</span> ₹{booking.totalAmount}</p><p><span className="font-medium">Paid:</span> ₹{booking.advancePaid}</p>
                      <p className="col-span-2 font-bold text-red-600">Balance Due: ₹{booking.balanceDue}</p>
                      {booking.notes && <p className="col-span-2 text-xs italic text-gray-500 mt-2 bg-gray-50 p-2 rounded border border-gray-100"><span className="font-bold text-gray-700 not-italic">Notes:</span> {booking.notes}</p>}
                    </div>
                    <div className="flex gap-2 pt-4 border-t border-gray-50">
                      <button onClick={() => sharePDF(booking)} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-all"><Share2 size={16} /> Receipt</button>
                      <button onClick={() => { setShowFinalReceiptModal(booking); setFinalAmountReceived(booking.balanceDue); }} className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition-all"><CheckCircle size={16} /> Final Payment</button>
                      <button onClick={() => { setEditingBooking(booking); setShowBookingForm(true); }} className="p-2 text-gray-400 hover:text-amber-600"><Edit2 size={18} /></button>
                      <button onClick={() => setItemToDelete({ id: booking.id!, type: 'bookings' })} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {activeTab === 'queries' && Object.entries(groupedQueries).map(([month, items]) => (
            <section key={month} className="space-y-4">
              <h3 className="text-lg font-bold text-amber-900 border-b border-amber-100 pb-2">{month}</h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {(items as BookingQuery[]).map(query => (
                  <div key={query.id} className="bg-white p-6 rounded-2xl shadow-sm border border-amber-50 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div><h4 className="text-xl font-bold text-gray-900">{query.customerName}</h4><p className="text-amber-700 font-medium">{query.occasion} • {format(new Date(query.eventDate), 'dd MMM yyyy')}</p></div>
                      <span className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase", 
                        query.status === 'Converted to booking' ? "bg-green-100 text-green-700" : 
                        query.status === 'Keep the date on hold' ? "bg-amber-100 text-amber-700" : 
                        "bg-gray-100 text-gray-700")}>{query.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-2 text-sm text-gray-600 mb-6">
                      <p><span className="font-medium">Phone:</span> {query.phoneNumber}</p><p><span className="font-medium">Guests:</span> {query.approxGuests}</p>
                      <p className="col-span-2 font-bold text-amber-900">Quoted Price: ₹{query.quotedPrice}</p>
                    </div>
                    <div className="flex gap-2 pt-4 border-t border-gray-50">
                      <button onClick={() => { setEditingQuery(query); setShowQueryForm(true); }} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-all"><Edit2 size={16} /> Edit</button>
                      <button onClick={() => setItemToDelete({ id: query.id!, type: 'queries' })} className="p-2 text-gray-400 hover:text-red-600 ml-auto"><Trash2 size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {activeTab === 'expenses' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-amber-50 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-amber-50">
                      <th className="px-6 py-4 text-sm font-bold text-amber-900">Date</th>
                      <th className="px-6 py-4 text-sm font-bold text-amber-900">Category</th>
                      <th className="px-6 py-4 text-sm font-bold text-amber-900">Description</th>
                      <th className="px-6 py-4 text-sm font-bold text-amber-900">Mode</th>
                      <th className="px-6 py-4 text-sm font-bold text-amber-900 text-right">Amount</th>
                      <th className="px-6 py-4 text-sm font-bold text-amber-900 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expenses.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-medium">
                          No expenses found for the current period.
                        </td>
                      </tr>
                    ) : expenses.map(expense => (
                      <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-600">{format(new Date(expense.date), 'dd MMM yyyy')}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{expense.category}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{expense.description}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{expense.paymentMethod}</td>
                        <td className="px-6 py-4 text-sm font-bold text-red-600 text-right">₹{expense.amount}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => { setEditingExpense(expense); setShowExpenseForm(true); }} 
                              className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors text-xs font-bold"
                            >
                              <Edit2 size={14} /> Edit
                            </button>
                            <button 
                              onClick={() => setItemToDelete({ id: expense.id!, type: 'expenses' })} 
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors text-xs font-bold"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-amber-50 md:col-span-2">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-serif font-bold text-amber-900">Financial Overview</h3>
                  <div className="flex items-center gap-4">
                    <select value={reportYear} onChange={(e) => setReportYear(parseInt(e.target.value))} className="px-3 py-2 rounded-lg border border-gray-300 font-bold text-amber-900 bg-white">
                      {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                      <button onClick={() => setReportYearType('calendar')} className={cn("px-4 py-2 text-sm font-bold rounded-lg", reportYearType === 'calendar' ? "bg-white text-amber-900 shadow-sm" : "text-gray-500")}>Calendar</button>
                      <button onClick={() => setReportYearType('financial')} className={cn("px-4 py-2 text-sm font-bold rounded-lg", reportYearType === 'financial' ? "bg-white text-amber-900 shadow-sm" : "text-gray-500")}>Financial</button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  <div className="p-6 bg-blue-50 rounded-xl border border-blue-100"><span className="text-blue-800 block mb-1 text-sm font-bold">Bank Balance</span><span className="text-2xl font-bold text-blue-700">₹{stats.bankBalance.toLocaleString()}</span></div>
                  <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-100"><span className="text-emerald-800 block mb-1 text-sm font-bold">Cash in Hand</span><span className="text-2xl font-bold text-emerald-700">₹{stats.cashInHand.toLocaleString()}</span></div>
                  <div className="p-6 bg-red-50 rounded-xl border border-red-100"><span className="text-red-800 block mb-1 text-sm font-bold">Yearly Expenses</span><span className="text-2xl font-bold text-red-700">₹{stats.yearlyExpenses.toLocaleString()}</span></div>
                  
                  <div className="p-6 bg-amber-50 rounded-xl border border-amber-100"><span className="text-amber-800 block mb-1 text-sm font-bold">Actual Income (Received)</span><span className="text-2xl font-bold text-amber-700">₹{stats.yearlyIncome.toLocaleString()}</span></div>
                  <div className="p-6 bg-purple-50 rounded-xl border border-purple-100"><span className="text-purple-800 block mb-1 text-sm font-bold">Completed Work Income</span><span className="text-2xl font-bold text-purple-700">₹{stats.completedYearlyIncome.toLocaleString()}</span></div>
                  <div className="p-6 bg-indigo-50 rounded-xl border border-indigo-100"><span className="text-indigo-800 block mb-1 text-sm font-bold">Projected Annual Income</span><span className="text-2xl font-bold text-indigo-700">₹{stats.projectedYearlyIncome.toLocaleString()}</span></div>
                  
                  <div className="p-6 bg-cyan-50 rounded-xl border border-cyan-100"><span className="text-cyan-800 block mb-1 text-sm font-bold">Avg. Monthly Income (Projected)</span><span className="text-2xl font-bold text-cyan-700">₹{Math.round(stats.averageMonthlyIncome).toLocaleString()}</span></div>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setShowOpeningBalanceForm(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-all text-sm font-bold border border-amber-200">
                    <Plus size={18} /> Set Opening Balance
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showBookingForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-serif font-bold text-amber-900 mb-6">{editingBooking ? 'Edit Booking' : 'New Booking'}</h2>
            <form onSubmit={handleAddBooking} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Customer Name</label><input name="customerName" defaultValue={editingBooking?.customerName} required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Address</label><textarea name="address" defaultValue={editingBooking?.address} required className="w-full px-4 py-2 rounded-lg border" rows={2} /></div>
              <div><label className="block text-sm font-medium mb-1">Phone</label><input name="phoneNumber" defaultValue={editingBooking?.phoneNumber} required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div><label className="block text-sm font-medium mb-1">Date</label><input type="date" name="eventDate" defaultValue={editingBooking?.eventDate} required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div><label className="block text-sm font-medium mb-1">Occasion</label><input name="occasion" defaultValue={editingBooking?.occasion} required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div><label className="block text-sm font-medium mb-1">Guests</label><input type="number" step="any" name="noOfGuests" defaultValue={editingBooking?.noOfGuests} required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Floors</label><select name="floorsRented" defaultValue={editingBooking?.floorsRented} className="w-full px-4 py-2 rounded-lg border"><option>Ground Floor & Lawn Area</option><option>Ground, 1st Floor & Lawn Area</option><option>Ground, 1st, 2nd Floor & Lawn Area</option></select></div>
              <div><label className="block text-sm font-medium mb-1">Total Amount</label><input type="number" step="any" name="totalAmount" defaultValue={editingBooking?.totalAmount} required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div><label className="block text-sm font-medium mb-1">Advance Paid</label><input type="number" step="any" name="advancePaid" defaultValue={editingBooking?.advancePaid} required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div><label className="block text-sm font-medium mb-1">Payment Mode</label><select name="paymentMethod" defaultValue={editingBooking?.paymentMethod} className="w-full px-4 py-2 rounded-lg border"><option>Cash</option><option>UPI</option><option>Transfer</option></select></div>
              <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Notes</label><textarea name="notes" defaultValue={editingBooking?.notes} className="w-full px-4 py-2 rounded-lg border" rows={2} placeholder="Any special requests or instructions..." /></div>
              <div className="md:col-span-2 flex gap-3 pt-4"><button type="submit" className="flex-1 bg-amber-700 text-white font-bold py-3 rounded-lg">Confirm</button><button type="button" onClick={() => setShowBookingForm(false)} className="px-6 py-3 bg-gray-100 rounded-lg">Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {showFinalReceiptModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <h2 className="text-2xl font-serif font-bold text-amber-900 mb-6">Final Settlement</h2>
            <div className="bg-amber-50 p-4 rounded-xl mb-6"><div className="flex justify-between mb-2"><span>Total:</span><span className="font-bold">₹{showFinalReceiptModal.totalAmount}</span></div><div className="flex justify-between pt-2 border-t border-amber-100 font-bold text-red-600"><span>Due:</span><span className="text-xl">₹{showFinalReceiptModal.balanceDue}</span></div></div>
            <div className="space-y-4">
              <div className="flex p-1 bg-gray-100 rounded-lg"><button onClick={() => setIsPartPayment(false)} className={cn("flex-1 py-2 text-sm font-bold rounded-md", !isPartPayment ? "bg-white shadow-sm" : "text-gray-500")}>Full</button><button onClick={() => setIsPartPayment(true)} className={cn("flex-1 py-2 text-sm font-bold rounded-md", isPartPayment ? "bg-white shadow-sm" : "text-gray-500")}>Part</button></div>
              <div><label className="block text-sm font-medium mb-1">Amount Received</label><input type="number" step="any" value={finalAmountReceived} onChange={(e) => setFinalAmountReceived(Number(e.target.value))} className="w-full px-4 py-2 rounded-lg border" /></div>
              <div><label className="block text-sm font-medium mb-1">Mode</label><select value={finalPaymentMethod} onChange={(e) => setFinalPaymentMethod(e.target.value as any)} className="w-full px-4 py-2 rounded-lg border"><option>Cash</option><option>UPI</option><option>Transfer</option></select></div>
              <div className="flex gap-3 pt-4"><button onClick={handleFinalPayment} className="flex-1 bg-green-700 text-white font-bold py-3 rounded-lg">Generate Receipt</button><button onClick={() => setShowFinalReceiptModal(null)} className="px-6 py-3 bg-gray-100 rounded-lg">Cancel</button></div>
            </div>
          </div>
        </div>
      )}

      {showQueryForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
            <h2 className="text-2xl font-serif font-bold text-amber-900 mb-6">{editingQuery ? 'Edit Query' : 'New Query'}</h2>
            <form onSubmit={handleAddQuery} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Customer Name</label><input name="customerName" defaultValue={editingQuery?.customerName} required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div><label className="block text-sm font-medium mb-1">Phone</label><input name="phoneNumber" defaultValue={editingQuery?.phoneNumber} required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div><label className="block text-sm font-medium mb-1">Event Date</label><input type="date" name="eventDate" defaultValue={editingQuery?.eventDate} required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div><label className="block text-sm font-medium mb-1">Occasion</label><input name="occasion" defaultValue={editingQuery?.occasion} required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div><label className="block text-sm font-medium mb-1">Approx Guests</label><input type="number" step="any" name="approxGuests" defaultValue={editingQuery?.approxGuests} required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div><label className="block text-sm font-medium mb-1">Quoted Price</label><input type="number" step="any" name="quotedPrice" defaultValue={editingQuery?.quotedPrice} required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div><label className="block text-sm font-medium mb-1">Status</label><select name="status" defaultValue={editingQuery?.status} className="w-full px-4 py-2 rounded-lg border"><option>General Enquiry</option><option>Criteria did not matched</option><option>Keep the date on hold</option><option>Converted to booking</option></select></div>
              <div className="md:col-span-2 flex gap-3 pt-4"><button type="submit" className="flex-1 bg-amber-700 text-white font-bold py-3 rounded-lg">Save Query</button><button type="button" onClick={() => { setShowQueryForm(false); setEditingQuery(null); }} className="px-6 py-3 bg-gray-100 rounded-lg">Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {showExpenseForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
            <h2 className="text-2xl font-serif font-bold text-amber-900 mb-6">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h2>
            <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Date</label><input type="date" name="date" defaultValue={editingExpense?.date || format(new Date(), 'yyyy-MM-dd')} required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div><label className="block text-sm font-medium mb-1">Amount</label><input type="number" step="any" name="amount" defaultValue={editingExpense?.amount} required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Category</label><select name="category" defaultValue={editingExpense?.category} required className="w-full px-4 py-2 rounded-lg border"><option>Maintenance & Repairs</option><option>Electricity & Utilities</option><option>Staff Salary & Wages</option><option>Marketing & Advertising</option><option>Cleaning & Supplies</option><option>Refund / Cancellation</option><option>Cash Deposited to Bank</option><option>Miscellaneous / Others</option></select></div>
              <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Description</label><input name="description" defaultValue={editingExpense?.description} required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div><label className="block text-sm font-medium mb-1">Payment Mode</label><select name="paymentMethod" defaultValue={editingExpense?.paymentMethod} className="w-full px-4 py-2 rounded-lg border"><option>Cash</option><option>UPI</option><option>Transfer</option></select></div>
              <div className="md:col-span-2 flex gap-3 pt-4"><button type="submit" className="flex-1 bg-amber-700 text-white font-bold py-3 rounded-lg">{editingExpense ? 'Update Expense' : 'Add Expense'}</button><button type="button" onClick={() => { setShowExpenseForm(false); setEditingExpense(null); }} className="px-6 py-3 bg-gray-100 rounded-lg">Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {showOpeningBalanceForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <h2 className="text-2xl font-serif font-bold text-amber-900 mb-6">Opening Balance</h2>
            <form onSubmit={handleAddOpeningBalance} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Year</label><input type="number" step="1" name="year" defaultValue={reportYear} required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div><label className="block text-sm font-medium mb-1">Bank Balance</label><input type="number" step="any" name="bankBalance" required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div><label className="block text-sm font-medium mb-1">Cash in Hand</label><input type="number" step="any" name="cashInHand" required className="w-full px-4 py-2 rounded-lg border" /></div>
              <div className="flex gap-3 pt-4"><button type="submit" className="flex-1 bg-amber-700 text-white font-bold py-3 rounded-lg">Save</button><button type="button" onClick={() => setShowOpeningBalanceForm(false)} className="px-6 py-3 bg-gray-100 rounded-lg">Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {showChangePasswordModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <h2 className="text-2xl font-serif font-bold text-amber-900 mb-6">Change Password</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">New Password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-2 rounded-lg border" placeholder="••••••••" /></div>
              <div className="flex gap-3 pt-4">
                <button onClick={async () => {
                  if (!newPassword) return;
                  try {
                    await updatePassword(auth.currentUser!, newPassword);
                    setShowChangePasswordModal(false);
                    setNewPassword('');
                    alert('Password updated successfully!');
                  } catch (err: any) { setError(err.message); }
                }} className="flex-1 bg-amber-700 text-white font-bold py-3 rounded-lg">Update Password</button>
                <button onClick={() => setShowChangePasswordModal(false)} className="px-6 py-3 bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {itemToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <h2 className="text-2xl font-serif font-bold text-red-600 mb-4">Confirm Delete</h2>
            <p className="text-gray-600 mb-8">Are you sure you want to delete this {itemToDelete.type.slice(0, -1)}? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={handleDelete} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition-colors">Delete</button>
              <button onClick={() => setItemToDelete(null)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
