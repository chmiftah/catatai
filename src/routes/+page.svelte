<script>
	import { onMount, tick } from 'svelte';

	// AUTH STATE
	let currentUser = $state(null);
	let authChecking = $state(true);
	let authMode = $state('login'); // 'login' | 'register'
	let authForm = $state({ email: '', nama: '', password: '' });
	let authLoading = $state(false);
	let authError = $state('');
	let showPassword = $state(false);

	// PROFILE MODAL
	let showProfileModal = $state(false);

	// PWA INSTALL STATE
	let deferredInstallPrompt = $state(null);
	let canInstallPWA = $state(false);
	let isAppStandalone = $state(false);

	// Navigasi Utama: Hanya 2 Tombol ('chat' | 'report')
	let activeView = $state('chat'); // 'chat' (default) | 'report'
	let reportSubTab = $state('bulanan'); // 'bulanan' | 'mingguan' | 'periode' | 'harian' | 'semua'

	let loading = $state(false);
	let errorMsg = $state('');
	let successMsg = $state('');

	// Filter Periode
	const now = new Date();
	const pad = (n) => String(n).padStart(2, '0');
	let selectedBulan = $state(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`);
	let selectedTanggal = $state(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);

	// Filter Periode Mingguan (Senin s/d Minggu)
	let selectedWeekDate = $state(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);

	function getWeekRange(dateStr) {
		const base = new Date((dateStr || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`) + 'T00:00:00');
		const day = base.getDay(); // 0 = Minggu, 1 = Senin, ...
		const diffToMon = (day === 0 ? -6 : 1) - day;
		const mon = new Date(base);
		mon.setDate(base.getDate() + diffToMon);
		const sun = new Date(mon);
		sun.setDate(mon.getDate() + 6);
		const sStr = `${mon.getFullYear()}-${pad(mon.getMonth() + 1)}-${pad(mon.getDate())}`;
		const eStr = `${sun.getFullYear()}-${pad(sun.getMonth() + 1)}-${pad(sun.getDate())}`;
		return { start: sStr, end: eStr, monday: mon, sunday: sun };
	}

	let currentWeekRange = $derived(getWeekRange(selectedWeekDate));

	// Filter Rentang Periode Kustom (Manual Input)
	const sevenDaysAgo = new Date(now);
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
	let customStartDate = $state(`${sevenDaysAgo.getFullYear()}-${pad(sevenDaysAgo.getMonth() + 1)}-${pad(sevenDaysAgo.getDate())}`);
	let customEndDate = $state(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);

	function calculateDayDiff(start, end) {
		if (!start || !end) return 1;
		const d1 = new Date(start + 'T00:00:00');
		const d2 = new Date(end + 'T00:00:00');
		const diff = Math.round(Math.abs((d2 - d1) / (1000 * 60 * 60 * 24))) + 1;
		return diff;
	}
	
	// Data Transaksi & Rekap dari Neon DB (Terisolasi per User)
	let transaksiList = $state([]);
	let rekap = $state({
		total_pengeluaran: 0,
		total_pemasukan: 0,
		saldo_bersih: 0,
		total_transaksi: 0,
		tren_harian: [],
		rekap_kategori: [],
		top_merchant: [],
		ringkasan_minggu_ini: {
			total_pengeluaran: 0,
			total_pemasukan: 0,
			saldo_bersih: 0,
			total_transaksi: 0,
			start_date: '',
			end_date: ''
		}
	});

	// CHAT STATE (Mobile-First WA Style)
	let chatInput = $state('');
	let chatAttachedImage = $state(null);
	let chatLoading = $state(false);
	let chatMessagesContainer = $state(null);
	let currentActiveDraft = $state(null);
	let showUpgradeModal = $state(false);
	let upgradeLoading = $state(false);

	async function toggleProTier(targetTier = null) {
		upgradeLoading = true;
		try {
			const res = await fetch('/api/user/upgrade-pro', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ tier: targetTier })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal mengubah status paket');

			if (currentUser) {
				currentUser.tier = data.tier;
				currentUser.is_pro = data.is_pro;
				currentUser.sisa_kuota = data.is_pro ? 999999 : Math.max(0, 5 - (currentUser.chat_count_today || 0));
			}

			successMsg = data.message;
			showUpgradeModal = false;
			setTimeout(() => { successMsg = ''; }, 4500);
		} catch (err) {
			errorMsg = err.message;
		} finally {
			upgradeLoading = false;
		}
	}

	let chatMessages = $state([]);

	// CHAT PERSISTENCE (Agar riwayat obrolan hari ini tidak hilang saat di-refresh)
	function getChatStorageKey() {
		const uid = currentUser?.id || 'anon';
		const today = getTodayDateString();
		return `catatai_chat_history_v4_${uid}_${today}`;
	}

	function saveChatHistory() {
		if (typeof window === 'undefined') return;
		try {
			const key = getChatStorageKey();
			const payload = {
				date: getTodayDateString(),
				userId: currentUser?.id,
				messages: chatMessages,
				draft: currentActiveDraft
			};
			localStorage.setItem(key, JSON.stringify(payload));
		} catch (e) {
			console.warn('Gagal menyimpan riwayat chat ke localStorage:', e);
		}
	}

	function loadChatHistory() {
		if (typeof window === 'undefined') return false;
		try {
			const key = getChatStorageKey();
			const raw = localStorage.getItem(key);
			if (!raw) return false;
			const parsed = JSON.parse(raw);
			if (parsed && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
				if (parsed.date === getTodayDateString()) {
					chatMessages = parsed.messages;
					currentActiveDraft = parsed.draft || null;
					setTimeout(scrollToBottom, 60);
					return true;
				}
			}
		} catch (e) {
			console.warn('Gagal memuat riwayat chat dari localStorage:', e);
		}
		return false;
	}

	function initChatMessages(userName = '') {
		// 1. Coba pulihkan riwayat percakapan hari ini dari storage
		const restored = loadChatHistory();
		if (restored) {
			return; // Riwayat chat hari ini berhasil dipulihkan apa adanya!
		}

		// 2. Jika hari ini belum pernah ada percakapan, buat salam pembuka hari ini
		todayTanggal = getTodayDateString();
		const name = userName || currentUser?.nama || '';
		const isToday = (txDate) => {
			if (!txDate) return false;
			return String(txDate).slice(0, 10) === todayTanggal;
		};
		const todayTx = transaksiList.filter((t) => isToday(t.tanggal));

		const historyMessages = [];

		if (todayTx.length === 0) {
			historyMessages.push({
				id: 'today-empty-greeting',
				role: 'assistant',
				content: `Halo${name ? ', ' + name : ''}! 👋

Belum ada transaksi yang dicatat hari ini (${formatTglHari(todayTanggal)}).

Ada pengeluaran atau pemasukan baru?
Ketik misalnya:
• "beli kopi 18k"
• "makan siang 35rb pake qris"
• "gaji bulanan masuk 10jt"

Atau tekan ikon kamera di bawah untuk mengirim foto nota/struk belanja 📸`,
				time: `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`
			});
		} else {
			const totalKeluar = todayTx
				.filter((t) => t.tipe === 'pengeluaran')
				.reduce((acc, curr) => acc + Number(curr.total), 0);
			const totalMasuk = todayTx
				.filter((t) => t.tipe === 'pemasukan')
				.reduce((acc, curr) => acc + Number(curr.total), 0);

			let summaryText = `Halo${name ? ', ' + name : ''}! 👋 Berikut catatan riwayat transaksi kamu hari ini (${formatTglHari(todayTanggal)}):`;
			summaryText += `\n• Pengeluaran: ${formatRupiah(totalKeluar)} (${todayTx.filter((t) => t.tipe === 'pengeluaran').length} transaksi)`;
			if (totalMasuk > 0) {
				summaryText += `\n• Pemasukan: ${formatRupiah(totalMasuk)}`;
			}

			historyMessages.push({
				id: 'today-summary-greeting',
				role: 'assistant',
				content: summaryText,
				time: todayTx[0].waktu?.slice(0, 5) || `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`
			});

			for (const t of todayTx) {
				historyMessages.push({
					id: `tx-card-${t.id}`,
					role: 'assistant',
					isTxCard: true,
					txData: t,
					content: `Transaksi tercatat: ${t.toko || (t.tipe === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran')} sebesar ${formatRupiah(t.total)} (${t.kategori})`,
					time: t.waktu?.slice(0, 5) || `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`
				});
			}

			historyMessages.push({
				id: 'today-ready-next',
				role: 'assistant',
				content: 'Ada transaksi lain yang ingin dicatat hari ini? Ketik pengeluaranmu atau unggah foto nota.',
				time: `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`
			});
		}

		chatMessages = historyMessages;
		saveChatHistory();
		setTimeout(scrollToBottom, 60);
	}

	function resetTodayChat() {
		if (!confirm('Bersihkan percakapan chat hari ini dan mulai sesi baru?')) return;
		try {
			localStorage.removeItem(getChatStorageKey());
		} catch {}
		chatMessages = [];
		currentActiveDraft = null;
		initChatMessages();
	}

	// Filter Report
	let filterTipe = $state('');
	let filterKategori = $state('');
	let searchQuery = $state('');

	// Modal Manual / Edit
	let showModalTambah = $state(false);
	let modeInput = $state('manual');

	// Form Transaksi Manual / Edit
	let form = $state({
		tipe: 'pengeluaran',
		toko: '',
		tanggal: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
		waktu: `${pad(now.getHours())}:${pad(now.getMinutes())}:00`,
		kategori: 'Makanan & Minuman',
		metode_bayar: 'Tunai',
		subtotal: 0,
		pajak: 0,
		diskon: 0,
		total: 0,
		catatan: '',
		gambar_url: '',
		items: []
	});

	// Modal Detail
	let showModalDetail = $state(false);
	let detailData = $state(null);
	let detailLoading = $state(false);

	const KATEGORI_OPTIONS = [
		'Makanan & Minuman',
		'Belanja Harian',
		'Bahan Baku',
		'Operasional',
		'Transportasi',
		'Utilitas & Tagihan',
		'Elektronik & Alat',
		'Gaji & Upah',
		'Penjualan Produk',
		'Lainnya'
	];

	const METODE_OPTIONS = ['Tunai', 'QRIS', 'Transfer', 'Kartu Debit', 'Kartu Kredit'];

	function formatRupiah(num) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0
		}).format(num || 0);
	}

	function formatTglHari(str) {
		if (!str) return '-';
		const d = new Date(str + 'T00:00:00');
		return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
	}

	function formatTgl(str) {
		if (!str) return '-';
		const d = new Date(str + 'T00:00:00');
		return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	// AUTH ACTIONS
	async function checkAuth() {
		authChecking = true;
		try {
			const res = await fetch('/api/auth/me');
			const data = await res.json();
			if (data.user) {
				currentUser = data.user;
				initChatMessages(data.user.nama);
				await loadData();
			} else {
				currentUser = null;
			}
		} catch (err) {
			console.error('Error checkAuth:', err);
			currentUser = null;
		} finally {
			authChecking = false;
		}
	}

	async function handleAuthSubmit() {
		authError = '';
		authLoading = true;

		try {
			const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(authForm)
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan autentikasi');

			currentUser = data.user;
			authForm = { email: '', nama: '', password: '' };
			initChatMessages(data.user.nama);
			await loadData();
		} catch (err) {
			authError = err.message;
		} finally {
			authLoading = false;
		}
	}

	async function handleLogout() {
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
			currentUser = null;
			showProfileModal = false;
			transaksiList = [];
			chatMessages = [];
			authMode = 'login';
			authForm = { email: '', nama: '', password: '' };
		} catch (err) {
			console.error('Error logout:', err);
		}
	}

	async function triggerPWAInstall() {
		if (deferredInstallPrompt) {
			deferredInstallPrompt.prompt();
			const { outcome } = await deferredInstallPrompt.userChoice;
			if (outcome === 'accepted') {
				canInstallPWA = false;
				isAppStandalone = true;
				successMsg = 'CatatAi berhasil dipasang di perangkat Anda!';
				setTimeout(() => { successMsg = ''; }, 3500);
			}
			deferredInstallPrompt = null;
		} else {
			alert('📱 Cara Memasang CatatAi ke Layar Utama:\n\n• Di iPhone/iPad (Safari): Tekan ikon Bagikan (Share) ⎋ di bawah, lalu pilih "Tambah ke Layar Utama" (+).\n• Di Android (Chrome): Tekan menu titik tiga (⋮) di kanan atas, lalu pilih "Instal aplikasi" atau "Tambahkan ke Layar Utama".\n• Di Komputer (Chrome/Edge): Tekan ikon Instal di ujung kanan address bar browser.');
		}
	}

	async function loadData() {
		if (!currentUser) return;
		loading = true;
		try {
			let url = `/api/transaksi`;
			if (reportSubTab === 'mingguan') {
				const range = getWeekRange(selectedWeekDate);
				url += `?dari_tanggal=${range.start}&sampai_tanggal=${range.end}`;
			} else if (reportSubTab === 'periode') {
				url += `?dari_tanggal=${customStartDate}&sampai_tanggal=${customEndDate}`;
			} else if (reportSubTab === 'harian') {
				const monthOfTanggal = selectedTanggal.slice(0, 7);
				url += `?bulan=${monthOfTanggal}`;
			} else {
				url += `?bulan=${selectedBulan}`;
			}
			const res = await fetch(url);
			const data = await res.json();
			if (!res.ok) {
				if (res.status === 401) {
					currentUser = null;
					return;
				}
				throw new Error(data.error || 'Gagal memuat data');
			}
			transaksiList = data.transaksi || [];
			rekap = data.rekap || {
				total_pengeluaran: 0,
				total_pemasukan: 0,
				saldo_bersih: 0,
				total_transaksi: 0,
				tren_harian: [],
				rekap_kategori: [],
				top_merchant: [],
				ringkasan_minggu_ini: {
					total_pengeluaran: 0,
					total_pemasukan: 0,
					saldo_bersih: 0,
					total_transaksi: 0,
					start_date: '',
					end_date: ''
				}
			};
			// Inisialisasi chat hanya jika belum ada pesan yang dimuat
			if (chatMessages.length === 0) {
				initChatMessages();
			}
		} catch (e) {
			errorMsg = e.message;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (typeof window !== 'undefined') {
			if (!authChecking && !currentUser) {
				const existingScript = document.querySelector('script[src*="chatbotai-five-phi.vercel.app/widget.js"]');
				if (!existingScript) {
					const s = document.createElement('script');
					s.src = 'https://chatbotai-five-phi.vercel.app/widget.js';
					s.setAttribute('data-bot-id', 'bot_hk7l2ol');
					s.async = true;
					document.body.appendChild(s);
				}
			} else if (currentUser) {
				const widgetRoot = document.getElementById('ai-chatbot-widget-root');
				if (widgetRoot) widgetRoot.remove();
			}
		}
	});

	onMount(() => {
		checkAuth();

		// Detect standalone display mode (PWA installed)
		if (typeof window !== 'undefined') {
			if (window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone)) {
				isAppStandalone = true;
			}
		}

		// Listen to PWA install prompt
		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			deferredInstallPrompt = e;
			canInstallPWA = true;
		});

		window.addEventListener('appinstalled', () => {
			isAppStandalone = true;
			canInstallPWA = false;
			deferredInstallPrompt = null;
		});
	});

	async function scrollToBottom() {
		await tick();
		if (chatMessagesContainer) {
			chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
		}
	}

	function prevMonth() {
		const [y, m] = selectedBulan.split('-').map(Number);
		const d = new Date(y, m - 2, 1);
		selectedBulan = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
		loadData();
	}

	function nextMonth() {
		const [y, m] = selectedBulan.split('-').map(Number);
		const d = new Date(y, m, 1);
		selectedBulan = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
		loadData();
	}

	function currentMonth() {
		selectedBulan = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
		loadData();
	}

	function switchReportSubTab(tab) {
		reportSubTab = tab;
		loadData();
	}

	function prevWeek() {
		const base = new Date(selectedWeekDate + 'T00:00:00');
		base.setDate(base.getDate() - 7);
		selectedWeekDate = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
		loadData();
	}

	function nextWeek() {
		const base = new Date(selectedWeekDate + 'T00:00:00');
		base.setDate(base.getDate() + 7);
		selectedWeekDate = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
		loadData();
	}

	function currentWeek() {
		selectedWeekDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
		loadData();
	}

	const NAMA_HARI_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
	const NAMA_HARI_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

	let weekDaysData = $derived.by(() => {
		const range = currentWeekRange;
		const days = [];
		const curr = new Date(range.monday);
		const trenMap = {};
		for (const itm of (rekap.tren_harian || [])) {
			trenMap[itm.tanggal] = itm;
		}
		for (let i = 0; i < 7; i++) {
			const dStr = `${curr.getFullYear()}-${pad(curr.getMonth() + 1)}-${pad(curr.getDate())}`;
			const dayOfWeek = curr.getDay();
			const entry = trenMap[dStr] || { pengeluaran: 0, pemasukan: 0, count: 0 };
			days.push({
				date: dStr,
				dayShort: NAMA_HARI_SHORT[dayOfWeek],
				dayFull: NAMA_HARI_FULL[dayOfWeek],
				dayNum: pad(curr.getDate()),
				pengeluaran: entry.pengeluaran || 0,
				pemasukan: entry.pemasukan || 0,
				count: entry.count || 0
			});
			curr.setDate(curr.getDate() + 1);
		}
		return days;
	});

	function setPeriodPreset(preset) {
		const t = new Date();
		if (preset === 'hari-ini') {
			const str = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
			customStartDate = str;
			customEndDate = str;
		} else if (preset === '7-hari') {
			const past = new Date(t);
			past.setDate(past.getDate() - 6);
			customStartDate = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`;
			customEndDate = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
		} else if (preset === '14-hari') {
			const past = new Date(t);
			past.setDate(past.getDate() - 13);
			customStartDate = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`;
			customEndDate = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
		} else if (preset === '30-hari') {
			const past = new Date(t);
			past.setDate(past.getDate() - 29);
			customStartDate = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`;
			customEndDate = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
		} else if (preset === 'bulan-ini') {
			const firstDay = new Date(t.getFullYear(), t.getMonth(), 1);
			const lastDay = new Date(t.getFullYear(), t.getMonth() + 1, 0);
			customStartDate = `${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-${pad(firstDay.getDate())}`;
			customEndDate = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;
		} else if (preset === 'bulan-lalu') {
			const firstDay = new Date(t.getFullYear(), t.getMonth() - 1, 1);
			const lastDay = new Date(t.getFullYear(), t.getMonth(), 0);
			customStartDate = `${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-${pad(firstDay.getDate())}`;
			customEndDate = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;
		}
		loadData();
	}

	let filteredTransaksi = $derived(
		transaksiList.filter((t) => {
			if (filterTipe && t.tipe !== filterTipe) return false;
			if (filterKategori && t.kategori !== filterKategori) return false;
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				const matchToko = (t.toko || '').toLowerCase().includes(q);
				const matchCatatan = (t.catatan || '').toLowerCase().includes(q);
				const matchKategori = (t.kategori || '').toLowerCase().includes(q);
				if (!matchToko && !matchCatatan && !matchKategori) return false;
			}
			return true;
		})
	);

	function getTodayDateString() {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}
	let todayTanggal = $state(getTodayDateString());
	let showTodayHistoryPanel = $state(true);

	// Catatan transaksi khusus HARI INI untuk Chat & Header
	let transaksiHariIni = $derived(
		transaksiList.filter((t) => t.tanggal === todayTanggal)
	);

	let totalHariIni = $derived(
		transaksiHariIni.reduce((acc, curr) => {
			if (curr.tipe === 'pengeluaran') acc.pengeluaran += Number(curr.total);
			else acc.pemasukan += Number(curr.total);
			return acc;
		}, { pengeluaran: 0, pemasukan: 0 })
	);

	let companionPeriodTab = $state('minggu'); // 'minggu' | 'bulan'

	// Catatan transaksi khusus MINGGU INI untuk Chat & Sidebar
	let currentWeekRangeToday = $derived(getWeekRange(todayTanggal));

	let transaksiMingguIni = $derived(
		transaksiList.filter((t) => {
			const rng = currentWeekRangeToday;
			return t.tanggal >= rng.start && t.tanggal <= rng.end;
		})
	);

	let totalMingguIni = $derived.by(() => {
		if (rekap.ringkasan_minggu_ini && rekap.ringkasan_minggu_ini.total_pengeluaran !== undefined) {
			return {
				pengeluaran: Number(rekap.ringkasan_minggu_ini.total_pengeluaran) || 0,
				pemasukan: Number(rekap.ringkasan_minggu_ini.total_pemasukan) || 0,
				saldo_bersih: Number(rekap.ringkasan_minggu_ini.saldo_bersih) || 0,
				total_transaksi: Number(rekap.ringkasan_minggu_ini.total_transaksi) || 0,
				start_date: rekap.ringkasan_minggu_ini.start_date || currentWeekRangeToday.start,
				end_date: rekap.ringkasan_minggu_ini.end_date || currentWeekRangeToday.end
			};
		}
		const calc = transaksiMingguIni.reduce((acc, curr) => {
			if (curr.tipe === 'pengeluaran') acc.pengeluaran += Number(curr.total);
			else acc.pemasukan += Number(curr.total);
			return acc;
		}, { pengeluaran: 0, pemasukan: 0 });
		return {
			pengeluaran: calc.pengeluaran,
			pemasukan: calc.pemasukan,
			saldo_bersih: calc.pemasukan - calc.pengeluaran,
			total_transaksi: transaksiMingguIni.length,
			start_date: currentWeekRangeToday.start,
			end_date: currentWeekRangeToday.end
		};
	});

	let harianTransaksi = $derived(
		transaksiList.filter((t) => t.tanggal === selectedTanggal)
	);

	let totalHarian = $derived(
		harianTransaksi.reduce((acc, curr) => {
			if (curr.tipe === 'pengeluaran') acc.pengeluaran += curr.total;
			else acc.pemasukan += curr.total;
			return acc;
		}, { pengeluaran: 0, pemasukan: 0 })
	);

	// CHAT LOGIC
	function handleChatImageUpload(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (event) => {
			chatAttachedImage = event.target?.result;
		};
		reader.readAsDataURL(file);
	}

	function removeChatImage() {
		chatAttachedImage = null;
	}

	async function sendChatMessage(customText = null) {
		const text = customText !== null ? customText : chatInput.trim();
		const image = chatAttachedImage;

		if (!text && !image) return;

		const userMsg = {
			id: Date.now(),
			role: 'user',
			content: text,
			image: image,
			time: `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`
		};
		chatMessages = [...chatMessages, userMsg];
		chatInput = '';
		chatAttachedImage = null;
		chatLoading = true;
		saveChatHistory();
		scrollToBottom();

		const cleanLower = (text || '').toLowerCase().trim();
		if (cleanLower === 'ringkasan minggu ini' || cleanLower === 'rekap minggu ini' || cleanLower === 'laporan minggu ini' || cleanLower === 'minggu ini') {
			const s = totalMingguIni;
			const botTime = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
			const msgContent = `📊 **Ringkasan Keuangan Minggu Ini** (${formatTgl(s.start_date)} – ${formatTgl(s.end_date)}):\n\n` +
				`• **Pengeluaran:** ${formatRupiah(s.pengeluaran)}\n` +
				`• **Pemasukan:** ${formatRupiah(s.pemasukan)}\n` +
				`• **Saldo Bersih:** ${s.saldo_bersih >= 0 ? '+' : ''}${formatRupiah(s.saldo_bersih)}\n` +
				`• **Total Transaksi:** ${s.total_transaksi} transaksi tercatat\n` +
				`• **Pengeluaran Hari Ini:** ${formatRupiah(totalHariIni.pengeluaran)}\n\n` +
				`💡 *Kamu juga bisa membuka tab **Report & Rekap → Mingguan** untuk grafik harian 7 hari dan kategori lengkap!* 📈`;
			chatMessages = [
				...chatMessages,
				{
					id: Date.now() + 1,
					role: 'assistant',
					content: msgContent,
					time: botTime
				}
			];
			saveChatHistory();
			chatLoading = false;
			scrollToBottom();
			return;
		}

		if (cleanLower === 'ringkasan hari ini' || cleanLower === 'rekap hari ini' || cleanLower === 'laporan hari ini') {
			const botTime = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
			const msgContent = `📅 **Ringkasan Transaksi Hari Ini** (${formatTglHari(todayTanggal)}):\n\n` +
				`• **Pengeluaran:** ${formatRupiah(totalHariIni.pengeluaran)} (${transaksiHariIni.filter(t => t.tipe === 'pengeluaran').length} transaksi)\n` +
				`• **Pemasukan:** ${formatRupiah(totalHariIni.pemasukan)} (${transaksiHariIni.filter(t => t.tipe === 'pemasukan').length} transaksi)\n` +
				`• **Saldo Bersih Hari Ini:** ${formatRupiah(totalHariIni.pemasukan - totalHariIni.pengeluaran)}\n` +
				`• **Akumulasi Minggu Ini:** ${formatRupiah(totalMingguIni.pengeluaran)}`;
			chatMessages = [
				...chatMessages,
				{
					id: Date.now() + 1,
					role: 'assistant',
					content: msgContent,
					time: botTime
				}
			];
			saveChatHistory();
			chatLoading = false;
			scrollToBottom();
			return;
		}

		try {
			const historyPayload = chatMessages
				.filter((m) => typeof m.content === 'string' && m.content.trim().length > 0)
				.slice(-6)
				.map((m) => ({
					role: m.role,
					content: m.content.trim()
				}));

			const res = await fetch('/api/chat-catat', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					pesan: text,
					image: image,
					history: historyPayload,
					currentDraft: currentActiveDraft
				})
			});

			const data = await res.json();
			if (!res.ok) {
				if (res.status === 403 && data.kuota_habis) {
					if (currentUser) currentUser.sisa_kuota = 0;
					showUpgradeModal = true;
				}
				throw new Error(data.error || 'Gagal memproses pesan');
			}

			// Update kuota & status PRO di client
			if (currentUser) {
				if (data.sisa_kuota !== undefined) currentUser.sisa_kuota = data.sisa_kuota;
				if (data.chat_count_today !== undefined) currentUser.chat_count_today = data.chat_count_today;
				if (data.tier !== undefined) currentUser.tier = data.tier;
				if (data.is_pro !== undefined) currentUser.is_pro = data.is_pro;
			}

			const botTime = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;

			if (data.aksi === 'draft') {
				const newDraft = { ...data.transaksi, status: 'pending' };
				currentActiveDraft = newDraft;
				chatMessages = [
					...chatMessages,
					{
						id: Date.now() + 1,
						role: 'assistant',
						content: data.jawaban_teks,
						draft: newDraft,
						time: botTime
					}
				];
			} else if (data.aksi === 'konfirmasi_simpan') {
				chatMessages = chatMessages.map((m) => {
					if (m.draft && m.draft.status === 'pending') {
						return { ...m, draft: { ...m.draft, status: 'saved' } };
					}
					return m;
				});

				currentActiveDraft = null;
				const savedDraft = data.transaksi ? { ...data.transaksi, status: 'saved' } : null;
				chatMessages = [
					...chatMessages,
					{
						id: Date.now() + 1,
						role: 'assistant',
						content: data.jawaban_teks,
						savedId: data.savedId,
						draft: savedDraft,
						time: botTime
					}
				];
				saveChatHistory();
				await loadData();
			} else if (data.aksi === 'batal') {
				chatMessages = chatMessages.map((m) => {
					if (m.draft && m.draft.status === 'pending') {
						return { ...m, draft: { ...m.draft, status: 'cancelled' } };
					}
					return m;
				});
				currentActiveDraft = null;
				chatMessages = [
					...chatMessages,
					{
						id: Date.now() + 1,
						role: 'assistant',
						content: data.jawaban_teks,
						time: botTime
					}
				];
			} else {
				chatMessages = [
					...chatMessages,
					{
						id: Date.now() + 1,
						role: 'assistant',
						content: data.jawaban_teks,
						time: botTime
					}
				];
			}
		} catch (err) {
			chatMessages = [
				...chatMessages,
				{
					id: Date.now() + 1,
					role: 'assistant',
					content: `Maaf, ada kendala: ${err.message}`,
					time: `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`
				}
			];
		} finally {
			chatLoading = false;
			saveChatHistory();
			scrollToBottom();
		}
	}

	async function confirmDraftDirectly(targetMsg) {
		if (targetMsg.draft) {
			targetMsg.draft.status = 'saved';
		}
		currentActiveDraft = targetMsg.draft;
		await sendChatMessage('Ya, betul. Simpan sekarang!');
	}

	function cancelDraftDirectly(targetMsg) {
		if (targetMsg.draft) {
			targetMsg.draft.status = 'cancelled';
		}
		currentActiveDraft = null;
		chatMessages = [
			...chatMessages,
			{
				id: Date.now(),
				role: 'assistant',
				content: 'Draft transaksi telah dibatalkan.',
				time: `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`
			}
		];
		saveChatHistory();
		scrollToBottom();
	}

	function editDraftManually(draft) {
		form = {
			tipe: draft.tipe || 'pengeluaran',
			toko: draft.toko || '',
			tanggal: draft.tanggal || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
			waktu: draft.waktu || `${pad(now.getHours())}:${pad(now.getMinutes())}:00`,
			kategori: draft.kategori || (draft.tipe === 'pemasukan' ? 'Gaji & Upah' : 'Makanan & Minuman'),
			metode_bayar: draft.metode_bayar || 'Tunai',
			subtotal: draft.subtotal || 0,
			pajak: draft.pajak || 0,
			diskon: draft.diskon || 0,
			total: draft.total || 0,
			catatan: draft.catatan || '',
			gambar_url: draft.gambar_url || '',
			items: draft.items ? [...draft.items] : []
		};
		modeInput = 'manual';
		showModalTambah = true;
	}

	function addItem() {
		form.items = [...form.items, { nama_barang: '', qty: 1, harga_satuan: 0, subtotal: 0 }];
	}

	function removeItem(index) {
		form.items = form.items.filter((_, i) => i !== index);
		hitungTotal();
	}

	function hitungTotal() {
		let sub = 0;
		form.items.forEach((itm) => {
			itm.subtotal = (Number(itm.qty) || 0) * (Number(itm.harga_satuan) || 0);
			sub += itm.subtotal;
		});
		form.subtotal = sub;
		const pjk = Number(form.pajak) || 0;
		const dsk = Number(form.diskon) || 0;
		form.total = Math.max(0, sub + pjk - dsk);
	}

	async function simpanTransaksi() {
		if (!form.toko.trim() && form.items.length === 0 && form.total <= 0) {
			alert('Mohon isi nama toko / sumber atau nominal transaksi.');
			return;
		}

		loading = true;
		errorMsg = '';
		try {
			const res = await fetch('/api/transaksi', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(form)
			});
			const resData = await res.json();
			if (!res.ok) throw new Error(resData.error || 'Gagal menyimpan transaksi');

			showModalTambah = false;
			resetForm();
			await loadData();
			successMsg = 'Transaksi berhasil disimpan!';
			setTimeout(() => { successMsg = ''; }, 3500);

			chatMessages = [
				...chatMessages,
				{
					id: Date.now(),
					role: 'assistant',
					content: `${form.tipe === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'} "${form.toko || 'Transaksi'}" sebesar ${formatRupiah(form.total)} telah berhasil disimpan!`,
					time: `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`
				}
			];
			scrollToBottom();
		} catch (err) {
			errorMsg = err.message;
		} finally {
			loading = false;
		}
	}

	function resetForm() {
		form = {
			tipe: 'pengeluaran',
			toko: '',
			tanggal: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
			waktu: `${pad(now.getHours())}:${pad(now.getMinutes())}:00`,
			kategori: 'Makanan & Minuman',
			metode_bayar: 'Tunai',
			subtotal: 0,
			pajak: 0,
			diskon: 0,
			total: 0,
			catatan: '',
			gambar_url: '',
			items: []
		};
	}

	async function openDetail(id) {
		showModalDetail = true;
		detailLoading = true;
		detailData = null;
		try {
			const res = await fetch(`/api/transaksi/${id}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal memuat detail');
			detailData = data.transaksi;
		} catch (e) {
			alert(e.message);
			showModalDetail = false;
		} finally {
			detailLoading = false;
		}
	}

	async function deleteTransaksi(id) {
		if (!confirm('Apakah kamu yakin ingin menghapus transaksi ini?')) return;
		try {
			const res = await fetch(`/api/transaksi/${id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('Gagal menghapus transaksi');
			await loadData();
			if (showModalDetail) showModalDetail = false;
		} catch (e) {
			alert(e.message);
		}
	}

	function exportCSV() {
		if (filteredTransaksi.length === 0) {
			alert('Tidak ada transaksi untuk diekspor.');
			return;
		}
		const headers = ['ID', 'Tipe', 'Toko/Sumber', 'Tanggal', 'Waktu', 'Kategori', 'Metode Bayar', 'Subtotal', 'Pajak', 'Diskon', 'Total', 'Catatan'];
		const rows = filteredTransaksi.map((t) => [
			t.id,
			t.tipe,
			`"${(t.toko || '').replace(/"/g, '""')}"`,
			t.tanggal,
			t.waktu,
			t.kategori,
			t.metode_bayar,
			t.subtotal,
			t.pajak,
			t.diskon,
			t.total,
			`"${(t.catatan || '').replace(/"/g, '""')}"`
		]);
		const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		let periodSuffix = selectedBulan;
		if (reportSubTab === 'mingguan') {
			const range = getWeekRange(selectedWeekDate);
			periodSuffix = `Minggu_${range.start}_sd_${range.end}`;
		} else if (reportSubTab === 'periode') {
			periodSuffix = `Periode_${customStartDate}_sd_${customEndDate}`;
		} else if (reportSubTab === 'harian') {
			periodSuffix = `Harian_${selectedTanggal}`;
		}
		link.setAttribute('download', `Report_Transaksi_${currentUser?.nama || 'Akun'}_${periodSuffix}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
</script>

<svelte:head>
	{#if !currentUser}
		<script src="https://chatbotai-five-phi.vercel.app/widget.js" data-bot-id="bot_hk7l2ol"></script>
	{/if}
</svelte:head>

<div class="app-mobile-root">
	{#if authChecking}
		<!-- SPLASH SCREEN -->
		<div class="auth-loading-screen">
			<div class="brand-gem-large">
				<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
				</svg>
			</div>
			<div class="splash-title">CatatAi</div>
			<div class="splash-sub">Memuat akun & data transaksi...</div>
		</div>
	{:else if !currentUser}
		<!-- ==============================================
		     VIEW: LANDING PAGE TWO-COLUMNS (INFO + LOGIN)
		     ============================================== -->
		<div class="landing-page-wrap">
			<!-- TOP NAVIGATION BAR -->
			<header class="landing-nav-bar">
				<div class="landing-nav-inner">
					<div class="landing-nav-brand">
						<div class="brand-gem-large">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
								<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
							</svg>
						</div>
						<div class="brand-logo-text">
							<span class="logo-title">CatatAi</span>
							<span class="logo-sub">Smart AI Bookkeeping</span>
						</div>
					</div>

					<div class="landing-nav-right">
						<div class="landing-status-badge">
							<span class="status-pulse-dot"></span>
							<span>DeepSeek AI Vision Aktif</span>
						</div>
						<button 
							type="button" 
							class="nav-cta-btn" 
							onclick={() => { 
								authMode = 'register'; 
								authError = ''; 
								document.getElementById('auth-box-section')?.scrollIntoView({ behavior: 'smooth' }); 
							}}
						>
							Daftar Akun Baru
						</button>
					</div>
				</div>
			</header>

			<!-- MAIN 2-COLUMN GRID -->
			<main class="landing-main-container">
				<div class="landing-grid-layout">
					
					<!-- ==========================================
					     COLUMN 1: LANDING PAGE INFO & VALUE
					     ============================					<!-- ==========================================
					     COLUMN 1: LANDING PAGE INFO & VALUE
					     ========================================== -->
					<section class="landing-info-column">
						
						<!-- HERO BADGE -->
						<div class="hero-tag-badge">
							<span class="tag-sparkle">✨</span>
							<span>Solusi Keuangan Pribadi & UMKM Berbasis AI</span>
						</div>

						<!-- HEADLINE & LEAD -->
						<h1 class="landing-hero-title">
							Catat Keuangan & Scan Bon <span class="accent-text-highlight">Semudah Kirim Chat</span>
						</h1>
						<p class="landing-hero-subtitle">
							Tinggalkan spreadsheet rumit atau bon tercecer. Cukup kirim chat santai seperti di WhatsApp atau foto nota belanja, AI otomatis merapikan nominal, kategori, dan laporan keuangan Anda secara instan.
						</p>

						<!-- INTERACTIVE MOCKUP SHOWCASE (CHAT & STRUK SIMULATION) -->
						<div class="landing-showcase-card">
							<div class="showcase-card-header">
								<div class="showcase-assistant-avatar">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
										<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
									</svg>
								</div>
								<div class="showcase-assistant-info">
									<div class="assistant-name">CatatAi Assistant</div>
									<div class="assistant-status">
										<span class="online-indicator"></span> DeepSeek AI Vision Online
									</div>
								</div>
								<span class="showcase-mode-pill">Simulasi AI</span>
							</div>

							<div class="showcase-chat-flow">
								<!-- Message 1: User Natural Text -->
								<div class="chat-bubble-row user-row">
									<div class="chat-mock-bubble user-bubble">
										<p class="chat-text">Kopi latte 28rb dan croissant 35rb di Anomali bayar QRIS ☕🥐</p>
										<span class="chat-time">13:10 ✓✓</span>
									</div>
								</div>

								<!-- Message 2: AI Bot Response -->
								<div class="chat-bubble-row bot-row">
									<div class="chat-mock-bubble bot-bubble">
										<div class="bot-badge-tag">
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
											Pengeluaran Dicatat: <strong class="text-danger">&nbsp;Rp 63.000</strong>
										</div>
										<div class="bot-micro-meta">
											<span class="category-chip">🍔 Makanan & Minuman</span>
											<span class="chip-sub">Anomali Kopi • QRIS</span>
										</div>
									</div>
								</div>

								<!-- Message 3: AI Vision Struk Tag -->
								<div class="chat-bubble-row bot-row">
									<div class="chat-mock-bubble bot-bubble receipt-banner-bubble">
										<div class="bot-badge-tag vision-tag">
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
											Scan Nota AI Vision
										</div>
										<p class="receipt-banner-text">
											Foto struk <strong>Alfamart Kemang</strong> otomatis terbaca: <strong>4 item (Rp 89.200)</strong> masuk rekap bulanan!
										</p>
									</div>
								</div>
							</div>
						</div>

						<!-- CORE FEATURES HORIZONTAL PILLS -->
						<div class="landing-features-compact-row">
							<div class="compact-feature-pill">
								<div class="pill-icon icon-emerald-soft">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
								</div>
								<span>Chat Bahasa Alami</span>
							</div>

							<div class="compact-feature-pill">
								<div class="pill-icon icon-amber-soft">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
								</div>
								<span>Scan Bon DeepSeek AI</span>
							</div>

							<div class="compact-feature-pill">
								<div class="pill-icon icon-indigo-soft">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
								</div>
								<span>Dashboard & Ekspor CSV</span>
							</div>

							<div class="compact-feature-pill">
								<div class="pill-icon icon-rose-soft">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
								</div>
								<span>PWA Mobile Ready</span>
							</div>
						</div>
					</section>

					<!-- ==========================================
					     COLUMN 2: LOGIN / REGISTER AUTH FORM
					     ========================================== -->
					<section class="landing-auth-column" id="auth-box-section">
						<div class="auth-card-box sticky-auth-box">
							
							<!-- AUTH CARD HEADER -->
							<div class="auth-brand-head">
								<div class="brand-gem-large">
									<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
									</svg>
								</div>
								<h2 class="auth-app-title">
									{authMode === 'login' ? 'Masuk ke CatatAi' : 'Daftar Akun Baru'}
								</h2>
								<p class="auth-app-desc">
									{authMode === 'login' 
										? 'Masuk untuk mengakses asisten pencatatan & ringkasan keuangan Anda' 
										: 'Buat akun dalam hitungan detik. Gratis & terenkripsi.'}
								</p>
							</div>

							<!-- TAB SWITCHER: MASUK / DAFTAR -->
							<div class="auth-tabs-row" role="tablist">
								<button 
									type="button" 
									role="tab"
									aria-selected={authMode === 'login'}
									class="auth-tab-btn {authMode === 'login' ? 'active' : ''}" 
									onclick={() => { authMode = 'login'; authError = ''; }}
								>
									Masuk Akun
								</button>
								<button 
									type="button" 
									role="tab"
									aria-selected={authMode === 'register'}
									class="auth-tab-btn {authMode === 'register' ? 'active' : ''}" 
									onclick={() => { authMode = 'register'; authError = ''; }}
								>
									Daftar Baru
								</button>
							</div>

							<!-- ERROR BANNER -->
							{#if authError}
								<div class="auth-error-banner" role="alert">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
									</svg>
									<span>{authError}</span>
								</div>
							{/if}

							<!-- AUTH FORM -->
							<form class="auth-form-stack" onsubmit={(e) => { e.preventDefault(); handleAuthSubmit(); }}>
								{#if authMode === 'register'}
									<div class="auth-field">
										<label for="inp-auth-nama">Nama Lengkap</label>
										<div class="auth-input-wrap">
											<svg class="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
											</svg>
											<input 
												id="inp-auth-nama" 
												type="text" 
												placeholder="Contoh: Budi Santoso" 
												bind:value={authForm.nama} 
												required 
												autocomplete="name"
											/>
										</div>
									</div>
								{/if}

								<div class="auth-field">
									<label for="inp-auth-email">Alamat Email</label>
									<div class="auth-input-wrap">
										<svg class="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
										</svg>
										<input 
											id="inp-auth-email" 
											type="email" 
											placeholder="nama@email.com" 
											bind:value={authForm.email} 
											required 
											autocomplete="email"
										/>
									</div>
								</div>

								<div class="auth-field">
									<div class="field-label-split">
										<label for="inp-auth-pwd">Password</label>
										<button 
											type="button" 
											class="btn-toggle-pwd" 
											onclick={() => { showPassword = !showPassword; }}
											aria-label="Lihat atau sembunyikan password"
										>
											{showPassword ? 'Sembunyikan' : 'Tampilkan'}
										</button>
									</div>
									<div class="auth-input-wrap">
										<svg class="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
										</svg>
										<input 
											id="inp-auth-pwd" 
											type={showPassword ? 'text' : 'password'} 
											placeholder={authMode === 'register' ? 'Minimal 6 karakter' : 'Masukkan password'} 
											bind:value={authForm.password} 
											required 
											minlength="6"
											autocomplete={authMode === 'register' ? 'new-password' : 'current-password'}
										/>
									</div>
								</div>

								<button type="submit" class="btn-auth-submit" disabled={authLoading}>
									{#if authLoading}
										<span class="btn-spinner"></span>
										<span>Memproses...</span>
									{:else if authMode === 'register'}
										<span>Daftar Akun CatatAi Gratis ✨</span>
									{:else}
										<span>Masuk ke Akun Anda 🚀</span>
									{/if}
								</button>
							</form>

							<!-- MODE TOGGLE HELPER LINK -->
							<div class="auth-switch-helper">
								{#if authMode === 'login'}
									<span>Belum memiliki akun? </span>
									<button 
										type="button" 
										class="link-switch-auth" 
										onclick={() => { authMode = 'register'; authError = ''; }}
									>
										Daftar akun baru di sini
									</button>
								{:else}
									<span>Sudah pernah mendaftar? </span>
									<button 
										type="button" 
										class="link-switch-auth" 
										onclick={() => { authMode = 'login'; authError = ''; }}
									>
										Masuk ke akun Anda
									</button>
								{/if}
							</div>

							<!-- SECURITY BADGE -->
							<div class="auth-security-notice">
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
								</svg>
								<div class="security-text-box">
									<strong>Data Terisolasi Penuh & Aman</strong>
									<p>Setiap transaksi tersimpan di akun pribadi Anda dengan hashing sandi Scrypt & sesi cookie HTTP-Only.</p>
								</div>
							</div>

							<!-- VALUE BULLETS BELOW CARD -->
							<div class="auth-quick-perks">
								<div class="perk-bullet">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
									<span>Gratis digunakan</span>
								</div>
								<div class="perk-bullet">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
									<span>Scan Nota DeepSeek AI</span>
								</div>
								<div class="perk-bullet">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
									<span>Bisa diinstal di HP (PWA)</span>
								</div>
							</div>

						</div>
					</section>

				</div>
			</main>

			<!-- LANDING FOOTER -->
			<footer class="landing-page-footer">
				<div class="footer-inner">
					<div class="footer-left">
						<span class="footer-logo">CatatAi</span>
						<span class="footer-copy">© 2026 CatatAi. Pencatatan Keuangan & Scan Nota Berbasis AI.</span>
					</div>
					<div class="footer-right">
						<span>Privasi Terisolasi</span>
						<span class="dot-sep">•</span>
						<span>Didukung Neon DB & DeepSeek AI</span>
					</div>
				</div>
			</footer>
		</div>
	{:else}
		<!-- ==============================================
		     VIEW: APLIKASI UTAMA (SETELAH LOGIN)
		     HEADER MODERN 2-TIER: ZERO CRAMPED / ZERO OVERLAP
		     ============================================== -->
		<header class="app-header-modern">
			<div class="header-inner-shell">
				<!-- BRAND TITLE & STATUS -->
				<div class="brand-unit">
					<div class="brand-gem-modern">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
							<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
						</svg>
					</div>
					<div class="brand-meta">
						<span class="brand-name-bold">CatatAi</span>
						<span class="brand-kpi-sub">
							Hari ini: <strong class="{totalHariIni.pengeluaran > 0 ? 'text-expense' : 'text-neutral'}">{formatRupiah(totalHariIni.pengeluaran)}</strong>
							<span class="brand-kpi-divider">•</span>
							Minggu ini: <strong class="{totalMingguIni.pengeluaran > 0 ? 'text-expense' : 'text-neutral'}">{formatRupiah(totalMingguIni.pengeluaran)}</strong>
						</span>
					</div>
				</div>

				<!-- CENTER NAVIGATION: CHAT vs REPORT -->
				<div class="header-tier-tabs">
					<div class="modern-segment-bar">
						<button 
							class="tab-btn {activeView === 'chat' ? 'active' : ''}" 
							onclick={() => { activeView = 'chat'; if (reportSubTab !== 'bulanan') { reportSubTab = 'bulanan'; loadData(); } scrollToBottom(); }}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
							</svg>
							<span>Chat Asisten</span>
						</button>
						<button 
							class="tab-btn {activeView === 'report' ? 'active' : ''}" 
							onclick={() => activeView = 'report'}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
							</svg>
							<span>Report & Rekap</span>
							{#if transaksiList.length > 0}
								<span class="report-badge-count">{transaksiList.length}</span>
							{/if}
						</button>
					</div>
				</div>

				<!-- RIGHT ACTION CLUSTER -->
				<div class="header-actions-cluster">
					<!-- TIER STATUS BADGE (PRO UNLIMITED vs FREE 5/DAY) -->
					{#if currentUser.tier === 'pro'}
						<button 
							class="btn-tier-status tier-pro" 
							onclick={() => showUpgradeModal = true} 
							title="Paket CatatAi PRO Aktif (Chat Tanpa Batas)"
						>
							<span class="pro-star">⭐</span>
							<span class="pro-tag">PRO</span>
						</button>
					{:else}
						<button 
							class="btn-tier-status tier-free" 
							onclick={() => showUpgradeModal = true} 
							title="Batas 5 pesan per hari. Klik untuk Upgrade ke PRO!"
						>
							<span class="free-badge-lbl">Free</span>
							<span class="free-badge-count">{currentUser.sisa_kuota ?? 5}/5</span>
							<span class="free-upgrade-arrow">PRO ⭐</span>
						</button>
					{/if}

					<!-- Tombol Panel Admin Khusus Admin Miftah -->
					{#if currentUser?.role === 'admin' || currentUser?.email === 'miftahdev7@gmail.com'}
						<a 
							href="/admin" 
							class="btn-admin-header-link" 
							title="Panel Admin - Manajemen Pengguna"
						>
							<span class="admin-crown-icon">👑</span>
							<span class="admin-header-text">Admin</span>
						</a>
					{/if}
					<!-- Button Quick Add Manual -->
					<button 
						class="btn-action-add" 
						onclick={() => { resetForm(); showModalTambah = true; }} 
						title="Catat Manual"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
							<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
						</svg>
						<span>Catat</span>
					</button>

					<!-- User Profile Avatar Button -->
					<button 
						class="btn-avatar-profile" 
						onclick={() => showProfileModal = true}
						title="Profil & Pengaturan Akun"
						aria-label="Profil Akun"
					>
						<span class="avatar-letter">{currentUser.nama.charAt(0).toUpperCase()}</span>
						<span class="desktop-user-name">{currentUser.nama}</span>
					</button>
				</div>
			</div>
		</header>

		<!-- ALERTS -->
		{#if errorMsg}
			<div class="app-alert alert-danger">
				<div class="alert-content">
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
					<span>{errorMsg}</span>
				</div>
				<button class="alert-close" aria-label="Tutup notifikasi" onclick={() => errorMsg = ''}>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
			</div>
		{/if}
		{#if successMsg}
			<div class="app-alert alert-success">
				<div class="alert-content">
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
					<span>{successMsg}</span>
				</div>
				<button class="alert-close" aria-label="Tutup notifikasi" onclick={() => successMsg = ''}>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
			</div>
		{/if}

		<!-- MAIN CONTENT -->
		<main class="app-main">
			<!-- ==============================================
			     VIEW 1: MODE CHAT MOBILE-FIRST (CLEAN NO DOUBLE HEADER)
			     ============================================== -->
			{#if activeView === 'chat'}
				<div class="chat-layout-wrapper">
					<div class="chat-mobile-container">
					<!-- Messages Stream (WITH SUBTLE DOODLE BACKGROUND) -->
					
					<div class="chat-stream-viewport" bind:this={chatMessagesContainer}>
						
						<!-- DATE DIVIDER PILL (CHAT STYLE) -->
						<div class="chat-date-divider-wrap">
							<span class="chat-date-pill">{formatTglHari(todayTanggal)}</span>
						</div>

						{#each chatMessages as msg}
							<div class="msg-bubble-row {msg.role === 'user' ? 'user-side' : 'bot-side'}">
								{#if msg.role === 'assistant'}
									<div class="bot-tiny-avatar">
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
										</svg>
									</div>
								{/if}

								<div class="msg-card">
									{#if msg.image}
										<div class="msg-media-wrap">
											<img src={msg.image} alt="Nota Transaksi" class="msg-media-img" />
										</div>
									{/if}

									{#if msg.isTxCard && msg.txData}
										<!-- CHAT HISTORY CARD TRANSAKSI HARI INI -->
										<div class="chat-tx-bubble-card">
											<div class="ctx-card-top">
												<div class="ctx-card-brand">
													<div class="ctx-card-avatar {msg.txData.tipe === 'pemasukan' ? 'avatar-in' : 'avatar-out'}">
														{#if msg.txData.tipe === 'pemasukan'}
															<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
														{:else}
															<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
														{/if}
													</div>
													<div class="ctx-card-info">
														<span class="ctx-card-title">{msg.txData.toko || (msg.txData.tipe === 'pemasukan' ? 'Pemasukan' : 'Transaksi')}</span>
														<span class="ctx-card-meta">{msg.txData.waktu?.slice(0, 5) || '-'} • {msg.txData.kategori} • {msg.txData.metode_bayar}</span>
													</div>
												</div>
												<div class="ctx-card-amount {msg.txData.tipe === 'pemasukan' ? 'color-income' : 'color-expense'}">
													{msg.txData.tipe === 'pemasukan' ? '+' : '-'}{formatRupiah(msg.txData.total)}
												</div>
											</div>

											{#if msg.txData.catatan}
												<div class="ctx-card-note">"{msg.txData.catatan}"</div>
											{/if}

											{#if msg.txData.items && msg.txData.items.length > 0}
												<div class="ctx-card-mini-items">
													{#each msg.txData.items as itm}
														<div class="ctx-mini-item-row">
															<span>{itm.qty}x {itm.nama_barang}</span>
															<span>{formatRupiah(itm.subtotal || (itm.qty * itm.harga_satuan))}</span>
														</div>
													{/each}
												</div>
											{/if}

											<div class="ctx-card-footer">
												<span class="ctx-saved-label">
													<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><polyline points="20 6 9 17 4 12"/></svg>
													<span>Tersimpan hari ini</span>
												</span>
												<button 
													type="button" 
													class="btn-ctx-detail" 
													onclick={() => openDetail(msg.txData.id)}
													title="Lihat rincian nota & foto struk"
												>
													Lihat Detail Nota →
												</button>
											</div>
										</div>
									{:else}
										<div class="msg-text-content">{msg.content}</div>
									{/if}

									<!-- DRAFT TRANSAKSI CARD INTERAKTIF -->
									{#if msg.draft}
										<div class="tx-draft-box">
											<div class="draft-topline">
												<div class="draft-badge-title-row">
													{#if msg.draft.tipe === 'pemasukan'}
														<svg class="draft-icon-income" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
															<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
														</svg>
														<span>Pemasukan Terdeteksi</span>
													{:else}
														<svg class="draft-icon-expense" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
															<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
														</svg>
														<span>Pengeluaran Terdeteksi</span>
													{/if}
												</div>
												<span class="pill-type {msg.draft.tipe === 'pemasukan' ? 'pill-income' : 'pill-expense'}">
													{msg.draft.tipe.toUpperCase()}
												</span>
											</div>

											<div class="draft-grid-info">
												<div class="draft-col">
													<span class="col-k">{msg.draft.tipe === 'pemasukan' ? 'Sumber / Dari:' : 'Toko / Merchant:'}</span>
													<span class="col-v-bold">{msg.draft.toko || '-'}</span>
												</div>
												<div class="draft-col">
													<span class="col-k">Kategori:</span>
													<span class="col-tag">{msg.draft.kategori}</span>
												</div>
												<div class="draft-col">
													<span class="col-k">Tanggal:</span>
													<span class="col-v">{formatTgl(msg.draft.tanggal)}</span>
												</div>
												<div class="draft-col">
													<span class="col-k">Metode:</span>
													<span class="col-v method-tag">
														<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
														<span>{msg.draft.metode_bayar}</span>
													</span>
												</div>
											</div>

											{#if msg.draft.items && msg.draft.items.length > 0}
												<div class="draft-itemized-list">
													{#each msg.draft.items as item}
														<div class="draft-item-entry">
															<span>{item.qty}x {item.nama_barang}</span>
															<span class="entry-sub">{formatRupiah(item.subtotal || (item.qty * item.harga_satuan))}</span>
														</div>
													{/each}
												</div>
											{/if}

											<div class="draft-total-banner">
												<span class="tot-caption">Total {msg.draft.tipe === 'pemasukan' ? 'Masuk' : 'Transaksi'}:</span>
												<span class="tot-val {msg.draft.tipe === 'pemasukan' ? 'color-income' : 'color-expense'}">
													{msg.draft.tipe === 'pemasukan' ? '+' : '-'} {formatRupiah(msg.draft.total)}
												</span>
											</div>

											<!-- BAGIAN TOMBOL AKSI: HILANG BEGITU SUDAH DIKLIK / DIKONFIRMASI -->
											{#if msg.draft.status === 'saved'}
												<div class="draft-status-pill pill-saved">
													<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
													<span>Transaksi Berhasil Disimpan</span>
												</div>
											{:else if msg.draft.status === 'cancelled'}
												<div class="draft-status-pill pill-cancelled">
													<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
													<span>Draft Transaksi Dibatalkan</span>
												</div>
											{:else}
												<div class="draft-action-block">
													<span class="action-question">Apakah data di atas sudah betul?</span>
													
													<div class="buttons-grid">
														<!-- Tombol Utama: Simpan -->
														<button 
															class="btn-primary-confirm" 
															onclick={() => confirmDraftDirectly(msg)}
														>
															<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
															<span>Ya, Simpan Sekarang!</span>
														</button>
														
														<!-- Baris Tombol Tambahan: Koreksi & Batal -->
														<div class="buttons-sub-row">
															<button 
																class="btn-sub-edit" 
																onclick={() => editDraftManually(msg.draft)}
															>
																<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
																<span>Koreksi</span>
															</button>
															<button 
																class="btn-sub-cancel" 
																onclick={() => cancelDraftDirectly(msg)}
															>
																<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
																<span>Batal</span>
															</button>
														</div>
													</div>
												</div>
											{/if}
										</div>
									{/if}

									{#if msg.savedId}
										<div class="msg-saved-banner">
											<div class="saved-banner-left">
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
												<span>Tersimpan ke database!</span>
											</div>
											<button class="btn-detail-link" onclick={() => openDetail(msg.savedId)}>Lihat Detail</button>
										</div>
									{/if}

									<div class="msg-footer-meta">
										<span class="msg-time">{msg.time}</span>
										{#if msg.role === 'user'}
											<svg class="msg-check-svg" width="14" height="10" viewBox="0 0 16 11" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<path d="M1 6l3.5 3.5L11 2"/>
												<path d="M5 6l3.5 3.5L15 2"/>
											</svg>
										{/if}
									</div>
								</div>
							</div>
						{/each}

						{#if chatLoading}
							<div class="msg-bubble-row bot-side">
								<div class="bot-tiny-avatar">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
									</svg>
								</div>
								<div class="msg-card msg-loading-card">
									<span class="bounce-dot"></span>
									<span class="bounce-dot"></span>
									<span class="bounce-dot"></span>
									<span class="loading-label">Menganalisis transaksi...</span>
								</div>
							</div>
						{/if}
					</div>

					<!-- Attached Image Bar -->
					{#if chatAttachedImage}
						<div class="attached-media-bar">
							<div class="thumb-container">
								<img src={chatAttachedImage} alt="Lampiran" class="thumb-img" />
								<button class="btn-remove-thumb" aria-label="Hapus lampiran" onclick={removeChatImage} title="Hapus foto">
									<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
								</button>
							</div>
							<span class="thumb-caption">Foto nota siap dianalisis</span>
						</div>
					{/if}

					<!-- STICKY INPUT BAR (BOTTOM) -->
					<div class="chat-bottom-dock">
						<!-- QUOTA STRIP & PRO NOTICE -->
						{#if currentUser?.tier !== 'pro'}
							{#if (currentUser?.sisa_kuota ?? 5) <= 0}
								<div class="quota-exhausted-banner">
									<div class="exhausted-text">
										<strong>Batas 5 pesan gratis hari ini tercapai</strong>
										<span>Upgrade ke CatatAi PRO untuk melanjutkan chat tanpa batas!</span>
									</div>
									<button type="button" class="btn-exhausted-upgrade" onclick={() => showUpgradeModal = true}>
										Aktifkan PRO ⭐
									</button>
								</div>
							{:else}
								<div class="chat-quota-strip">
									<div class="quota-info-pill">
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
										<span>Sisa Kuota: <strong>{currentUser?.sisa_kuota ?? 5} / 5 pesan gratis hari ini</strong></span>
									</div>
									<button type="button" class="btn-quota-pro-link" onclick={() => showUpgradeModal = true}>
										Buka Unlimited (PRO) ⭐
									</button>
								</div>
							{/if}
						{/if}

						<div class="chat-quick-shortcuts">
							<button type="button" class="quick-chip-btn" onclick={() => sendChatMessage('ringkasan minggu ini')}>
								<span>📊 Ringkasan Minggu Ini</span>
							</button>
							<button type="button" class="quick-chip-btn" onclick={() => sendChatMessage('ringkasan hari ini')}>
								<span>📅 Hari Ini</span>
							</button>
							<button type="button" class="quick-chip-btn" onclick={() => { activeView = 'report'; switchReportSubTab('mingguan'); }}>
								<span>📈 Grafik 7 Hari</span>
							</button>
						</div>

						<form class="dock-form-row" onsubmit={(e) => { e.preventDefault(); sendChatMessage(); }}>
							<label class="btn-dock-attach" title="Kirim Foto Nota">
								<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
									<circle cx="12" cy="13" r="4"/>
								</svg>
								<input 
									type="file" 
									accept="image/jpeg,image/png,image/webp" 
									class="input-file-native" 
									onchange={handleChatImageUpload} 
								/>
							</label>

							<input 
								type="text" 
								class="input-dock-text" 
								placeholder={currentUser?.tier !== 'pro' && (currentUser?.sisa_kuota ?? 5) <= 0 
									? "Batas 5 pesan gratis tercapai. Upgrade ke PRO untuk lanjut..." 
									: "Ketik 'beli kopi 18k' atau 'gaji 10jt'..."} 
								bind:value={chatInput} 
								disabled={chatLoading || (currentUser?.tier !== 'pro' && (currentUser?.sisa_kuota ?? 5) <= 0)}
							/>

							<button 
								type="submit" 
								class="btn-dock-send" 
								disabled={chatLoading || (!chatInput.trim() && !chatAttachedImage) || (currentUser?.tier !== 'pro' && (currentUser?.sisa_kuota ?? 5) <= 0)}
								title="Kirim Pesan"
							>
								<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
									<line x1="22" y1="2" x2="11" y2="13"/>
									<polygon points="22 2 15 22 11 13 2 9 22 2"/>
								</svg>
							</button>
						</form>
					</div>
				</div>

					<!-- DESKTOP COMPANION SIDEBAR (LIVE FINANCE PULSE) -->
					<aside class="chat-desktop-companion">
						<!-- Card 1: Ringkasan Saldo (Minggu Ini & Bulan Ini) -->
						<div class="companion-card">
							<div class="companion-card-header">
								<div class="c-head-title-row">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
									</svg>
									<span class="companion-card-title">{companionPeriodTab === 'minggu' ? 'Ringkasan Minggu Ini' : 'Ringkasan Bulan Ini'}</span>
								</div>
								<div class="companion-switch-pill">
									<button 
										type="button"
										class="c-switch-btn {companionPeriodTab === 'minggu' ? 'active' : ''}" 
										onclick={() => companionPeriodTab = 'minggu'}
									>
										Minggu
									</button>
									<button 
										type="button"
										class="c-switch-btn {companionPeriodTab === 'bulan' ? 'active' : ''}" 
										onclick={() => companionPeriodTab = 'bulan'}
									>
										Bulan
									</button>
								</div>
							</div>

							{#if companionPeriodTab === 'minggu'}
								<div class="companion-period-info-row">
									<span class="c-period-text">📅 {formatTgl(totalMingguIni.start_date)} — {formatTgl(totalMingguIni.end_date)}</span>
									<span class="companion-count-pill">{totalMingguIni.total_transaksi} Transaksi</span>
								</div>

								<div class="companion-stats-grid">
									<div class="cstat-item">
										<span class="cstat-label">Pengeluaran</span>
										<span class="cstat-val color-expense">{formatRupiah(totalMingguIni.pengeluaran)}</span>
									</div>
									<div class="cstat-item">
										<span class="cstat-label">Pemasukan</span>
										<span class="cstat-val color-income">{formatRupiah(totalMingguIni.pemasukan)}</span>
									</div>
								</div>

								<div class="companion-net-row">
									<span class="cstat-net-lbl">Saldo Bersih</span>
									<span class="cstat-net-val {totalMingguIni.saldo_bersih >= 0 ? 'color-income' : 'color-expense'}">
										{totalMingguIni.saldo_bersih >= 0 ? '+' : ''}{formatRupiah(totalMingguIni.saldo_bersih)}
									</span>
								</div>

								<div class="companion-today-row">
									<span>Pengeluaran Hari Ini</span>
									<strong class="{totalHariIni.pengeluaran > 0 ? 'color-expense' : 'text-neutral'}">{formatRupiah(totalHariIni.pengeluaran)}</strong>
								</div>

								<button 
									type="button"
									class="companion-link-btn" 
									onclick={() => { activeView = 'report'; switchReportSubTab('mingguan'); }}
								>
									<span>Buka Laporan Mingguan Lengkap</span>
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
								</button>
							{:else}
								<div class="companion-period-info-row">
									<span class="c-period-text">📅 Bulan {selectedBulan}</span>
									<span class="companion-count-pill">{rekap.total_transaksi} Transaksi</span>
								</div>

								<div class="companion-stats-grid">
									<div class="cstat-item">
										<span class="cstat-label">Pengeluaran</span>
										<span class="cstat-val color-expense">{formatRupiah(rekap.total_pengeluaran)}</span>
									</div>
									<div class="cstat-item">
										<span class="cstat-label">Pemasukan</span>
										<span class="cstat-val color-income">{formatRupiah(rekap.total_pemasukan)}</span>
									</div>
								</div>

								<div class="companion-net-row">
									<span class="cstat-net-lbl">Saldo Bersih</span>
									<span class="cstat-net-val {rekap.saldo_bersih >= 0 ? 'color-income' : 'color-expense'}">
										{rekap.saldo_bersih >= 0 ? '+' : ''}{formatRupiah(rekap.saldo_bersih)}
									</span>
								</div>

								<div class="companion-today-row">
									<span>Pengeluaran Hari Ini</span>
									<strong class="{totalHariIni.pengeluaran > 0 ? 'color-expense' : 'text-neutral'}">{formatRupiah(totalHariIni.pengeluaran)}</strong>
								</div>

								<button 
									type="button"
									class="companion-link-btn" 
									onclick={() => { activeView = 'report'; switchReportSubTab('bulanan'); }}
								>
									<span>Buka Laporan Bulanan Lengkap</span>
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
								</button>
							{/if}
						</div>

						<!-- Card 2: Catatan Hari Ini (Live Feed) -->
						<div class="companion-card">
							<div class="companion-card-header">
								<div class="c-head-title-row">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
										<line x1="16" y1="2" x2="16" y2="6"/>
										<line x1="8" y1="2" x2="8" y2="6"/>
										<line x1="3" y1="10" x2="21" y2="10"/>
									</svg>
									<span class="companion-card-title">Catatan Hari Ini</span>
								</div>
								<span class="companion-period-pill">{formatTgl(todayTanggal)}</span>
							</div>

							{#if transaksiHariIni.length > 0}
								<div class="companion-tx-list">
									{#each transaksiHariIni as t}
										<div 
											class="companion-tx-item" 
											onclick={() => openDetail(t.id)} 
											onkeydown={(e) => { if (e.key === 'Enter') openDetail(t.id); }}
											role="button"
											tabindex="0"
											title="Klik untuk rincian"
										>
											<div class="ctx-icon {t.tipe === 'pemasukan' ? 'icon-green' : 'icon-red'}">
												{#if t.tipe === 'pemasukan'}
													<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
												{:else}
													<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
												{/if}
											</div>
											<div class="ctx-body">
												<span class="ctx-title">{t.toko || (t.tipe === 'pemasukan' ? 'Pemasukan' : 'Transaksi')}</span>
												<span class="ctx-meta">{t.waktu?.slice(0, 5) || '-'} • {t.kategori}</span>
											</div>
											<span class="ctx-amt {t.tipe === 'pemasukan' ? 'color-income' : 'color-expense'}">
												{t.tipe === 'pemasukan' ? '+' : '-'}{formatRupiah(t.total)}
											</span>
										</div>
									{/each}
								</div>
							{:else}
								<div class="companion-empty">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 4px; opacity: 0.6;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
									<div>Belum ada transaksi hari ini.</div>
									<div style="font-size: 0.72rem; color: #8c8479; margin-top: 2px;">Ketik pesan di chat untuk mencatat.</div>
								</div>
							{/if}
						</div>

						<!-- Card 3: Tips & Perintah AI -->
						<div class="companion-card tips-card">
							<div class="companion-card-header">
								<div class="c-head-title-row">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
									</svg>
									<span class="companion-card-title">Pintasan Catat Cepat</span>
								</div>
							</div>
							<div class="companion-tips-body">
								<div class="tip-line">
									<span class="tip-kbd">Ketik:</span>
									<span class="tip-text">"Beli kopi gula aren 18k"</span>
								</div>
								<div class="tip-line">
									<span class="tip-kbd">Ketik:</span>
									<span class="tip-text">"Gaji bulanan masuk 10jt"</span>
								</div>
								<div class="tip-line">
									<span class="tip-kbd">Kamera:</span>
									<span class="tip-text">Upload / seret foto struk kasir</span>
								</div>
								<div class="tip-line">
									<span class="tip-kbd">Enter:</span>
									<span class="tip-text">Kirim langsung tanpa klik tombol</span>
								</div>
							</div>
						</div>
					</aside>
				</div>
			{/if}

			{#if activeView === 'report'}
				<div class="report-mobile-container">
					<!-- Control Toolbar -->
					<div class="report-header-card">
						{#if reportSubTab === 'bulanan'}
							<div class="period-picker-row">
								<button class="btn-arrow-month" onclick={prevMonth} aria-label="Bulan Sebelumnya">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
								</button>
								<input 
									type="month" 
									class="picker-month-native" 
									bind:value={selectedBulan} 
									onchange={loadData} 
								/>
								<button class="btn-arrow-month" onclick={nextMonth} aria-label="Bulan Berikutnya">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
								</button>
								<button class="btn-today-pill" onclick={currentMonth}>Bulan Ini</button>
							</div>
						{:else if reportSubTab === 'mingguan'}
							<div class="period-picker-row week-picker-toolbar">
								<button class="btn-arrow-month" onclick={prevWeek} aria-label="Minggu Sebelumnya" title="Minggu Sebelumnya">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
								</button>
								<div class="week-picker-input-wrap">
									<input 
										type="date" 
										class="picker-date-native" 
										bind:value={selectedWeekDate} 
										onchange={loadData} 
										title="Pilih tanggal dalam minggu ini"
									/>
								</div>
								<button class="btn-arrow-month" onclick={nextWeek} aria-label="Minggu Berikutnya" title="Minggu Berikutnya">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
								</button>
								<button class="btn-today-pill" onclick={currentWeek}>Minggu Ini</button>
							</div>
						{:else if reportSubTab === 'periode'}
							<div class="custom-period-control-box">
								<div class="custom-period-dates">
									<div class="date-field-group">
										<label for="inp-custom-start" class="field-label-sm">Dari Tanggal:</label>
										<input 
											id="inp-custom-start"
											type="date" 
											class="picker-date-native" 
											bind:value={customStartDate} 
										/>
									</div>
									<span class="date-sep-arrow">→</span>
									<div class="date-field-group">
										<label for="inp-custom-end" class="field-label-sm">Sampai Tanggal:</label>
										<input 
											id="inp-custom-end"
											type="date" 
											class="picker-date-native" 
											bind:value={customEndDate} 
										/>
									</div>
									<button class="btn-apply-period" onclick={loadData}>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
										<span>Terapkan</span>
									</button>
								</div>
								<div class="period-presets-scroll">
									<span class="preset-label-hint">Pintas:</span>
									<button class="preset-chip-btn" onclick={() => setPeriodPreset('7-hari')}>7 Hari</button>
									<button class="preset-chip-btn" onclick={() => setPeriodPreset('14-hari')}>14 Hari</button>
									<button class="preset-chip-btn" onclick={() => setPeriodPreset('30-hari')}>30 Hari</button>
									<button class="preset-chip-btn" onclick={() => setPeriodPreset('bulan-ini')}>Bulan Ini</button>
									<button class="preset-chip-btn" onclick={() => setPeriodPreset('bulan-lalu')}>Bulan Lalu</button>
								</div>
							</div>
						{:else if reportSubTab === 'harian'}
							<div class="period-picker-row">
								<input 
									type="date" 
									class="picker-date-native" 
									bind:value={selectedTanggal} 
									onchange={loadData}
								/>
								<button 
									class="btn-today-pill" 
									onclick={() => { selectedTanggal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`; loadData(); }}
								>
									Hari Ini
								</button>
							</div>
						{/if}

						<div class="sub-segments-row">
							<button 
								class="sub-seg-btn {reportSubTab === 'bulanan' ? 'active' : ''}" 
								onclick={() => switchReportSubTab('bulanan')}
							>
								Bulanan
							</button>
							<button 
								class="sub-seg-btn {reportSubTab === 'mingguan' ? 'active' : ''}" 
								onclick={() => switchReportSubTab('mingguan')}
							>
								Mingguan
							</button>
							<button 
								class="sub-seg-btn {reportSubTab === 'periode' ? 'active' : ''}" 
								onclick={() => switchReportSubTab('periode')}
							>
								Rentang Tanggal
							</button>
							<button 
								class="sub-seg-btn {reportSubTab === 'harian' ? 'active' : ''}" 
								onclick={() => switchReportSubTab('harian')}
							>
								Harian
							</button>
							<button 
								class="sub-seg-btn {reportSubTab === 'semua' ? 'active' : ''}" 
								onclick={() => switchReportSubTab('semua')}
							>
								Riwayat ({transaksiList.length})
							</button>
						</div>
					</div>

					<!-- SUBTAB 1: IKHTISAR BULANAN -->
					{#if reportSubTab === 'bulanan'}
						<!-- 4 KPI Cards: Mobile 2x2 Grid -->
						<div class="kpi-mobile-2x2">
							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Pengeluaran</span>
									<span class="dot-badge badge-red">Out</span>
								</div>
								<div class="kpi-num color-expense">{formatRupiah(rekap.total_pengeluaran)}</div>
								<div class="kpi-subt">{selectedBulan}</div>
							</div>

							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Pemasukan</span>
									<span class="dot-badge badge-green">In</span>
								</div>
								<div class="kpi-num color-income">{formatRupiah(rekap.total_pemasukan)}</div>
								<div class="kpi-subt">{selectedBulan}</div>
							</div>

							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Saldo Bersih</span>
									<span class="dot-badge {rekap.saldo_bersih >= 0 ? 'badge-green' : 'badge-red'}">
										{rekap.saldo_bersih >= 0 ? '+' : '-'}
									</span>
								</div>
								<div class="kpi-num {rekap.saldo_bersih >= 0 ? 'color-income' : 'color-expense'}">
									{formatRupiah(rekap.saldo_bersih)}
								</div>
								<div class="kpi-subt">Net Cashflow</div>
							</div>

							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Total Nota</span>
									<span class="dot-badge badge-blue">Rec</span>
								</div>
								<div class="kpi-num color-blue">{rekap.total_transaksi} Transaksi</div>
								<div class="kpi-subt">Tercatat</div>
							</div>
						</div>

						
						<!-- DESKTOP SPLIT: TREN CHART vs KATEGORI & TOKO -->
						<div class="report-desktop-split">
							<div class="report-chart-column">
								<!-- Tren Pengeluaran Harian Chart -->
						<div class="card-mobile-panel">
							<div class="panel-header">
								<h3 class="panel-title">Tren Pengeluaran Harian</h3>
								<p class="panel-sub">Akumulasi pengeluaran harian sepanjang bulan</p>
							</div>

							{#if rekap.tren_harian && rekap.tren_harian.length > 0}
								<div class="chart-mobile-scroll">
									{#each rekap.tren_harian as item}
										{@const maxVal = Math.max(...rekap.tren_harian.map((x) => x.pengeluaran), 1)}
										{@const heightPct = Math.min(100, Math.max(12, (item.pengeluaran / maxVal) * 100))}
										<div class="chart-col-touch" title="{item.tanggal}: {formatRupiah(item.pengeluaran)}">
											<div class="touch-bar-track">
												<div class="touch-bar-fill" style="height: {heightPct}%"></div>
											</div>
											<span class="touch-date">{item.tanggal.slice(8)}</span>
										</div>
									{/each}
								</div>
							{:else}
								<div class="empty-panel-text"><p>Belum ada data pengeluaran bulan ini.</p></div>
							{/if}
						</div>
							</div>
							<div class="report-side-column">
								<!-- Kategori & Top Toko -->
						<div class="card-mobile-panel">
							<h3 class="panel-title">Kategori Belanja</h3>
							{#if rekap.rekap_kategori && rekap.rekap_kategori.length > 0}
								<div class="category-bars-col">
									{#each rekap.rekap_kategori as cat}
										{@const pct = rekap.total_pengeluaran > 0 ? Math.round((cat.total / rekap.total_pengeluaran) * 100) : 0}
										<div class="cat-bar-item">
											<div class="cat-bar-header">
												<span class="cat-title">{cat.kategori}</span>
												<span class="cat-sum">{formatRupiah(cat.total)} ({pct}%)</span>
											</div>
											<div class="cat-track">
												<div class="cat-fill" style="width: {pct}%"></div>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="empty-panel-text"><p>Belum ada data kategori.</p></div>
							{/if}
						</div>

						<div class="card-mobile-panel">
							<h3 class="panel-title">Toko / Merchant Terbanyak</h3>
							{#if rekap.top_merchant && rekap.top_merchant.length > 0}
								<div class="merchant-mini-list">
									{#each rekap.top_merchant as m, i}
										<div class="merchant-mini-row">
											<div class="m-rank">{i + 1}</div>
											<div class="m-info">
												<span class="m-name">{m.toko}</span>
												<span class="m-cnt">{m.count} transaksi</span>
											</div>
											<span class="m-tot">{formatRupiah(m.total)}</span>
										</div>
									{/each}
								</div>
							{:else}
								<div class="empty-panel-text"><p>Belum ada merchant tercatat.</p></div>
							{/if}
						</div>
							</div>
						</div>
					{/if}

					<!-- SUBTAB: LAPORAN MINGGUAN -->
					{#if reportSubTab === 'mingguan'}
						<!-- Week Period Banner -->
						<div class="period-banner-card">
							<div class="pbc-left">
								<span class="pbc-icon">📅</span>
								<div>
									<div class="pbc-title">Laporan Mingguan</div>
									<div class="pbc-dates">{formatTglHari(currentWeekRange.start)} — {formatTglHari(currentWeekRange.end)}</div>
								</div>
							</div>
							<button class="btn-csv-mobile" onclick={exportCSV} title="Unduh CSV Transaksi Minggu Ini">
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
								</svg>
								<span>CSV</span>
							</button>
						</div>

						<!-- 4 KPI Cards: Mobile 2x2 Grid -->
						<div class="kpi-mobile-2x2">
							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Pengeluaran</span>
									<span class="dot-badge badge-red">Out</span>
								</div>
								<div class="kpi-num color-expense">{formatRupiah(rekap.total_pengeluaran)}</div>
								<div class="kpi-subt">Minggu Ini</div>
							</div>

							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Pemasukan</span>
									<span class="dot-badge badge-green">In</span>
								</div>
								<div class="kpi-num color-income">{formatRupiah(rekap.total_pemasukan)}</div>
								<div class="kpi-subt">Minggu Ini</div>
							</div>

							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Saldo Bersih</span>
									<span class="dot-badge {rekap.saldo_bersih >= 0 ? 'badge-green' : 'badge-red'}">
										{rekap.saldo_bersih >= 0 ? '+' : '-'}
									</span>
								</div>
								<div class="kpi-num {rekap.saldo_bersih >= 0 ? 'color-income' : 'color-expense'}">
									{formatRupiah(rekap.saldo_bersih)}
								</div>
								<div class="kpi-subt">Net Cashflow</div>
							</div>

							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Total Nota</span>
									<span class="dot-badge badge-blue">Rec</span>
								</div>
								<div class="kpi-num color-blue">{rekap.total_transaksi} Transaksi</div>
								<div class="kpi-subt">Tercatat</div>
							</div>
						</div>

						<!-- 7-Hari Aktivitas Bar Chart (Senin - Minggu) -->
						<div class="card-mobile-panel">
							<div class="panel-header">
								<h3 class="panel-title">Aktivitas 7 Hari (Senin – Minggu)</h3>
								<p class="panel-sub">Akumulasi pengeluaran harian sepanjang minggu terpilih</p>
							</div>
							<div class="week-chart-grid">
								{#each weekDaysData as day}
									{@const maxVal = Math.max(...weekDaysData.map((x) => x.pengeluaran), 1)}
									{@const heightPct = Math.min(100, Math.max(12, (day.pengeluaran / maxVal) * 100))}
									{@const isToday = day.date === todayTanggal}
									<div class="week-day-card {isToday ? 'is-today-day' : ''}" title="{day.dayFull}, {day.date}: Pengeluaran {formatRupiah(day.pengeluaran)} ({day.count} transaksi)">
										<div class="wdc-nominal">{day.pengeluaran > 0 ? (day.pengeluaran >= 1000000 ? (day.pengeluaran/1000000).toFixed(1) + 'jt' : (day.pengeluaran/1000).toFixed(0) + 'rb') : '-'}</div>
										<div class="wdc-bar-track">
											<div class="wdc-bar-fill {day.pengeluaran > 0 ? 'fill-has-val' : ''}" style="height: {day.pengeluaran > 0 ? heightPct : 6}%"></div>
										</div>
										<span class="wdc-day-name">{day.dayShort}</span>
										<span class="wdc-day-num {isToday ? 'active-today-pill' : ''}">{day.dayNum}</span>
									</div>
								{/each}
							</div>
						</div>

						<!-- DESKTOP SPLIT: KATEGORI & TOKO -->
						<div class="report-desktop-split">
							<div class="report-chart-column">
								<div class="card-mobile-panel">
									<h3 class="panel-title">Kategori Belanja Mingguan</h3>
									{#if rekap.rekap_kategori && rekap.rekap_kategori.length > 0}
										<div class="category-bars-col">
											{#each rekap.rekap_kategori as cat}
												{@const pct = rekap.total_pengeluaran > 0 ? Math.round((cat.total / rekap.total_pengeluaran) * 100) : 0}
												<div class="cat-bar-item">
													<div class="cat-bar-header">
														<span class="cat-title">{cat.kategori}</span>
														<span class="cat-sum">{formatRupiah(cat.total)} ({pct}%)</span>
													</div>
													<div class="cat-track">
														<div class="cat-fill" style="width: {pct}%"></div>
													</div>
												</div>
											{/each}
										</div>
									{:else}
										<div class="empty-panel-text"><p>Belum ada data kategori minggu ini.</p></div>
									{/if}
								</div>
							</div>

							<div class="report-side-column">
								<div class="card-mobile-panel">
									<h3 class="panel-title">Toko / Merchant Terbanyak</h3>
									{#if rekap.top_merchant && rekap.top_merchant.length > 0}
										<div class="merchant-mini-list">
											{#each rekap.top_merchant as m, i}
												<div class="merchant-mini-row">
													<div class="m-rank">{i + 1}</div>
													<div class="m-info">
														<span class="m-name">{m.toko}</span>
														<span class="m-cnt">{m.count} transaksi</span>
													</div>
													<span class="m-tot">{formatRupiah(m.total)}</span>
												</div>
											{/each}
										</div>
									{:else}
										<div class="empty-panel-text"><p>Belum ada merchant tercatat minggu ini.</p></div>
									{/if}
								</div>
							</div>
						</div>

						<!-- Daftar Transaksi Minggu Ini -->
						<div class="card-mobile-panel">
							<div class="search-and-export">
								<h3 class="panel-title">Daftar Transaksi Minggu Ini ({filteredTransaksi.length})</h3>
								<button class="btn-csv-mobile" onclick={exportCSV}>
									<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
									</svg>
									<span>CSV</span>
								</button>
							</div>

							<div class="mobile-filter-pills mt-2">
								<select bind:value={filterTipe} class="native-filter-select">
									<option value="">Semua Tipe</option>
									<option value="pengeluaran">Pengeluaran</option>
									<option value="pemasukan">Pemasukan</option>
								</select>
								<select bind:value={filterKategori} class="native-filter-select">
									<option value="">Semua Kategori</option>
									{#each KATEGORI_OPTIONS as k}
										<option value={k}>{k}</option>
									{/each}
								</select>
							</div>

							{#if filteredTransaksi.length > 0}
								<div class="mobile-cards-stream mt-2">
									{#each filteredTransaksi as t}
										<div 
											class="mobile-tx-entry" 
											onclick={() => openDetail(t.id)} 
											onkeydown={(e) => { if (e.key === 'Enter') openDetail(t.id); }} 
											role="button" 
											tabindex="0"
										>
											<div class="entry-icon {t.tipe === 'pemasukan' ? 'icon-green' : 'icon-red'}">
												{#if t.tipe === 'pemasukan'}
													<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
														<path d="M12 5v14M19 12l-7 7-7-7"/>
													</svg>
												{:else}
													<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
														<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
													</svg>
												{/if}
											</div>
											<div class="entry-core">
												<div class="entry-row-top">
													<span class="entry-merchant">{t.toko || (t.tipe === 'pemasukan' ? 'Pemasukan' : 'Transaksi')}</span>
													<span class="entry-amount {t.tipe === 'pemasukan' ? 'color-income' : 'color-expense'}">
														{t.tipe === 'pemasukan' ? '+' : '-'} {formatRupiah(t.total)}
													</span>
												</div>
												<div class="entry-row-sub">
													<span>{formatTgl(t.tanggal)} • {t.waktu?.slice(0, 5)} • {t.kategori} • {t.metode_bayar}</span>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="empty-panel-text"><p>Tidak ada transaksi pada minggu ini.</p></div>
							{/if}
						</div>
					{/if}

					<!-- SUBTAB: LAPORAN RENTANG PERIODE TANGGAL KUSTOM -->
					{#if reportSubTab === 'periode'}
						<!-- Period Banner -->
						<div class="period-banner-card">
							<div class="pbc-left">
								<span class="pbc-icon">🗓️</span>
								<div>
									<div class="pbc-title">Laporan Periode Tanggal</div>
									<div class="pbc-dates">{formatTgl(customStartDate)} s/d {formatTgl(customEndDate)} • {calculateDayDiff(customStartDate, customEndDate)} Hari</div>
								</div>
							</div>
							<button class="btn-csv-mobile" onclick={exportCSV} title="Unduh CSV Transaksi Periode Ini">
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
								</svg>
								<span>CSV</span>
							</button>
						</div>

						<!-- 4 KPI Cards: Mobile 2x2 Grid -->
						<div class="kpi-mobile-2x2">
							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Pengeluaran</span>
									<span class="dot-badge badge-red">Out</span>
								</div>
								<div class="kpi-num color-expense">{formatRupiah(rekap.total_pengeluaran)}</div>
								<div class="kpi-subt">Total Periode</div>
							</div>

							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Pemasukan</span>
									<span class="dot-badge badge-green">In</span>
								</div>
								<div class="kpi-num color-income">{formatRupiah(rekap.total_pemasukan)}</div>
								<div class="kpi-subt">Total Periode</div>
							</div>

							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Saldo Bersih</span>
									<span class="dot-badge {rekap.saldo_bersih >= 0 ? 'badge-green' : 'badge-red'}">
										{rekap.saldo_bersih >= 0 ? '+' : '-'}
									</span>
								</div>
								<div class="kpi-num {rekap.saldo_bersih >= 0 ? 'color-income' : 'color-expense'}">
									{formatRupiah(rekap.saldo_bersih)}
								</div>
								<div class="kpi-subt">Net Cashflow</div>
							</div>

							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Total Nota</span>
									<span class="dot-badge badge-blue">Rec</span>
								</div>
								<div class="kpi-num color-blue">{rekap.total_transaksi} Transaksi</div>
								<div class="kpi-subt">Dalam Periode</div>
							</div>
						</div>

						<!-- DESKTOP SPLIT: TREN CHART vs KATEGORI & TOKO -->
						<div class="report-desktop-split">
							<div class="report-chart-column">
								<div class="card-mobile-panel">
									<div class="panel-header">
										<h3 class="panel-title">Tren Pengeluaran Harian</h3>
										<p class="panel-sub">Akumulasi pengeluaran harian sepanjang rentang periode</p>
									</div>

									{#if rekap.tren_harian && rekap.tren_harian.length > 0}
										<div class="chart-mobile-scroll">
											{#each rekap.tren_harian as item}
												{@const maxVal = Math.max(...rekap.tren_harian.map((x) => x.pengeluaran), 1)}
												{@const heightPct = Math.min(100, Math.max(12, (item.pengeluaran / maxVal) * 100))}
												<div class="chart-col-touch" title="{item.tanggal}: {formatRupiah(item.pengeluaran)}">
													<div class="touch-bar-track">
														<div class="touch-bar-fill" style="height: {heightPct}%"></div>
													</div>
													<span class="touch-date">{item.tanggal.slice(8)}</span>
												</div>
											{/each}
										</div>
									{:else}
										<div class="empty-panel-text"><p>Belum ada data transaksi dalam periode ini.</p></div>
									{/if}
								</div>
							</div>

							<div class="report-side-column">
								<div class="card-mobile-panel">
									<h3 class="panel-title">Kategori Belanja</h3>
									{#if rekap.rekap_kategori && rekap.rekap_kategori.length > 0}
										<div class="category-bars-col">
											{#each rekap.rekap_kategori as cat}
												{@const pct = rekap.total_pengeluaran > 0 ? Math.round((cat.total / rekap.total_pengeluaran) * 100) : 0}
												<div class="cat-bar-item">
													<div class="cat-bar-header">
														<span class="cat-title">{cat.kategori}</span>
														<span class="cat-sum">{formatRupiah(cat.total)} ({pct}%)</span>
													</div>
													<div class="cat-track">
														<div class="cat-fill" style="width: {pct}%"></div>
													</div>
												</div>
											{/each}
										</div>
									{:else}
										<div class="empty-panel-text"><p>Belum ada data kategori dalam periode ini.</p></div>
									{/if}
								</div>

								<div class="card-mobile-panel">
									<h3 class="panel-title">Toko / Merchant Terbanyak</h3>
									{#if rekap.top_merchant && rekap.top_merchant.length > 0}
										<div class="merchant-mini-list">
											{#each rekap.top_merchant as m, i}
												<div class="merchant-mini-row">
													<div class="m-rank">{i + 1}</div>
													<div class="m-info">
														<span class="m-name">{m.toko}</span>
														<span class="m-cnt">{m.count} transaksi</span>
													</div>
													<span class="m-tot">{formatRupiah(m.total)}</span>
												</div>
											{/each}
										</div>
									{:else}
										<div class="empty-panel-text"><p>Belum ada merchant tercatat dalam periode ini.</p></div>
									{/if}
								</div>
							</div>
						</div>

						<!-- Daftar Transaksi Periode Ini -->
						<div class="card-mobile-panel">
							<div class="search-and-export">
								<div class="mobile-search-bar">
									<svg class="search-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
										<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
									</svg>
									<input 
										type="text" 
										placeholder="Cari toko / catatan dalam periode..." 
										bind:value={searchQuery} 
									/>
								</div>
								<button class="btn-csv-mobile" onclick={exportCSV}>
									<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
									</svg>
									<span>CSV</span>
								</button>
							</div>

							<div class="mobile-filter-pills mt-2">
								<select bind:value={filterTipe} class="native-filter-select">
									<option value="">Semua Tipe</option>
									<option value="pengeluaran">Pengeluaran</option>
									<option value="pemasukan">Pemasukan</option>
								</select>
								<select bind:value={filterKategori} class="native-filter-select">
									<option value="">Semua Kategori</option>
									{#each KATEGORI_OPTIONS as k}
										<option value={k}>{k}</option>
									{/each}
								</select>
							</div>

							{#if filteredTransaksi.length > 0}
								<div class="mobile-cards-stream mt-2">
									{#each filteredTransaksi as t}
										<div 
											class="mobile-tx-entry" 
											onclick={() => openDetail(t.id)} 
											onkeydown={(e) => { if (e.key === 'Enter') openDetail(t.id); }} 
											role="button" 
											tabindex="0"
										>
											<div class="entry-icon {t.tipe === 'pemasukan' ? 'icon-green' : 'icon-red'}">
												{#if t.tipe === 'pemasukan'}
													<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
														<path d="M12 5v14M19 12l-7 7-7-7"/>
													</svg>
												{:else}
													<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
														<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
													</svg>
												{/if}
											</div>
											<div class="entry-core">
												<div class="entry-row-top">
													<span class="entry-merchant">{t.toko || (t.tipe === 'pemasukan' ? 'Pemasukan' : 'Transaksi')}</span>
													<span class="entry-amount {t.tipe === 'pemasukan' ? 'color-income' : 'color-expense'}">
														{t.tipe === 'pemasukan' ? '+' : '-'} {formatRupiah(t.total)}
													</span>
												</div>
												<div class="entry-row-sub">
													<span>{formatTgl(t.tanggal)} • {t.waktu?.slice(0, 5)} • {t.kategori} • {t.metode_bayar}</span>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="empty-panel-text"><p>Tidak ada transaksi dalam periode ini.</p></div>
							{/if}
						</div>
					{/if}

					<!-- SUBTAB 4: REKAP HARIAN -->
					{#if reportSubTab === 'harian'}
						<div class="card-mobile-panel">
							<div class="daily-picker-box">
								<div class="daily-picker-left">
									<label for="inp-date-daily" class="daily-lbl">Pilih Tanggal:</label>
									<input 
										id="inp-date-daily" 
										type="date" 
										class="picker-date-native" 
										bind:value={selectedTanggal} 
									/>
								</div>
								<button 
									class="btn-today-pill" 
									onclick={() => { selectedTanggal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`; }}
								>
									Hari Ini
								</button>
							</div>

							<div class="daily-chips-stats">
								<div class="stat-pill-item">
									<span class="sp-lbl">Pengeluaran:</span>
									<span class="sp-val color-expense">{formatRupiah(totalHarian.pengeluaran)}</span>
								</div>
								<div class="stat-pill-item">
									<span class="sp-lbl">Pemasukan:</span>
									<span class="sp-val color-income">{formatRupiah(totalHarian.pemasukan)}</span>
								</div>
							</div>

							<h4 class="daily-list-title mt-3">Transaksi {formatTgl(selectedTanggal)}</h4>

							{#if harianTransaksi.length > 0}
								<div class="mobile-cards-stream">
									{#each harianTransaksi as t}
										<div 
											class="mobile-tx-entry" 
											onclick={() => openDetail(t.id)} 
											onkeydown={(e) => { if (e.key === 'Enter') openDetail(t.id); }} 
											role="button" 
											tabindex="0"
										>
											<div class="entry-icon {t.tipe === 'pemasukan' ? 'icon-green' : 'icon-red'}">
												{#if t.tipe === 'pemasukan'}
													<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
														<path d="M12 5v14M19 12l-7 7-7-7"/>
													</svg>
												{:else}
													<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
														<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
													</svg>
												{/if}
											</div>
											<div class="entry-core">
												<div class="entry-row-top">
													<span class="entry-merchant">{t.toko || (t.tipe === 'pemasukan' ? 'Pemasukan' : 'Transaksi')}</span>
													<span class="entry-amount {t.tipe === 'pemasukan' ? 'color-income' : 'color-expense'}">
														{t.tipe === 'pemasukan' ? '+' : '-'} {formatRupiah(t.total)}
													</span>
												</div>
												<div class="entry-row-sub">
													<span>{t.waktu?.slice(0, 5)} • {t.kategori} • {t.metode_bayar}</span>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="empty-panel-text"><p>Tidak ada transaksi pada tanggal ini.</p></div>
							{/if}
						</div>
					{/if}

					<!-- SUBTAB 3: RIWAYAT TRANSAKSI LENGKAP -->
					{#if reportSubTab === 'semua'}
						<div class="card-mobile-panel">
							<div class="search-and-export">
								<div class="mobile-search-bar">
									<svg class="search-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
										<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
									</svg>
									<input 
										type="text" 
										placeholder="Cari toko / kategori..." 
										bind:value={searchQuery} 
									/>
								</div>
								<button class="btn-csv-mobile" onclick={exportCSV}>
									<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
									</svg>
									<span>CSV</span>
								</button>
							</div>

							<div class="mobile-filter-pills">
								<select bind:value={filterTipe} class="native-filter-select">
									<option value="">Semua Tipe</option>
									<option value="pengeluaran">Pengeluaran</option>
									<option value="pemasukan">Pemasukan</option>
								</select>
								<select bind:value={filterKategori} class="native-filter-select">
									<option value="">Semua Kategori</option>
									{#each KATEGORI_OPTIONS as k}
										<option value={k}>{k}</option>
									{/each}
								</select>
							</div>

							{#if filteredTransaksi.length > 0}
								<div class="mobile-cards-stream mt-2">
									{#each filteredTransaksi as t}
										<div 
											class="mobile-tx-entry" 
											onclick={() => openDetail(t.id)} 
											onkeydown={(e) => { if (e.key === 'Enter') openDetail(t.id); }} 
											role="button" 
											tabindex="0"
										>
											<div class="entry-icon {t.tipe === 'pemasukan' ? 'icon-green' : 'icon-red'}">
												{#if t.tipe === 'pemasukan'}
													<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
														<path d="M12 5v14M19 12l-7 7-7-7"/>
													</svg>
												{:else}
													<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
														<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
													</svg>
												{/if}
											</div>
											<div class="entry-core">
												<div class="entry-row-top">
													<span class="entry-merchant">{t.toko || (t.tipe === 'pemasukan' ? 'Pemasukan' : 'Transaksi')}</span>
													<span class="entry-amount {t.tipe === 'pemasukan' ? 'color-income' : 'color-expense'}">
														{t.tipe === 'pemasukan' ? '+' : '-'} {formatRupiah(t.total)}
													</span>
												</div>
												<div class="entry-row-sub">
													<span>{formatTgl(t.tanggal)} • {t.kategori} • {t.metode_bayar}</span>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="empty-panel-text"><p>Tidak ada transaksi yang cocok.</p></div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</main>

		<!-- PROFILE & AKUN BOTTOM SHEET MODAL -->
		{#if showProfileModal}
			<div 
				class="bottom-sheet-backdrop" 
				onclick={() => showProfileModal = false} 
				onkeydown={(e) => { if (e.key === 'Escape') showProfileModal = false; }} 
				role="presentation"
			>
				<div 
					class="bottom-sheet-sheet profile-modal-sheet" 
					onclick={(e) => e.stopPropagation()} 
					onkeydown={(e) => e.stopPropagation()} 
					role="dialog" 
					tabindex="-1"
				>
					<div class="sheet-grabber-bar"></div>
					<div class="sheet-header">
						<h3 class="sheet-title">Pengaturan Akun</h3>
						<button class="sheet-close-btn" aria-label="Tutup" onclick={() => showProfileModal = false}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</button>
					</div>

					<div class="profile-sheet-body">
						<div class="profile-head-box">
							<div class="profile-large-avatar">
								{currentUser.nama.charAt(0).toUpperCase()}
							</div>
							<div class="profile-user-info">
								<h2 class="profile-name-text">{currentUser.nama}</h2>
								<p class="profile-email-text">{currentUser.email}</p>
							</div>
						</div>

						<div class="profile-tier-card {currentUser.tier === 'pro' ? 'tier-pro-box' : 'tier-free-box'}">
							<div class="tier-card-left">
								<div class="tier-icon-circle">
									{currentUser.tier === 'pro' ? '⭐' : '🌱'}
								</div>
								<div class="tier-meta-text">
									<div class="tier-title-row">
										<span class="tier-title-text">{currentUser.tier === 'pro' ? 'CatatAi PRO (Aktif)' : 'Paket Gratis (Free)'}</span>
										<span class="tier-status-pill">{currentUser.tier === 'pro' ? 'Unlimited' : '5 Pesan / Hari'}</span>
									</div>
									<p class="tier-desc-text">
										{currentUser.tier === 'pro' 
											? 'Akses Chat Asisten & Scan Nota Tanpa Batas.' 
											: `Sisa kuota hari ini: ${currentUser.sisa_kuota ?? 5} dari 5 pesan gratis.`}
									</p>
								</div>
							</div>
							<button 
								type="button" 
								class="btn-tier-action {currentUser.tier === 'pro' ? 'btn-tier-manage' : 'btn-tier-upgrade'}"
								onclick={() => { showProfileModal = false; showUpgradeModal = true; }}
							>
								{currentUser.tier === 'pro' ? 'Kelola Paket' : 'Upgrade PRO ⭐'}
							</button>
						</div>

						<div class="profile-stats-card">
							<div class="stat-mini-col">
								<span class="sm-lbl">Transaksi Bulan Ini</span>
								<span class="sm-val">{rekap.total_transaksi}</span>
							</div>
							<div class="stat-divider-line"></div>
							<div class="stat-mini-col">
								<span class="sm-lbl">Net Saldo Bulan Ini</span>
								<span class="sm-val {rekap.saldo_bersih >= 0 ? 'color-income' : 'color-expense'}">
									{formatRupiah(rekap.saldo_bersih)}
								</span>
							</div>
						</div>

						{#if currentUser?.role === 'admin' || currentUser?.email === 'miftahdev7@gmail.com'}
							<a href="/admin" class="btn-admin-profile-menu">
								<div class="adm-menu-left">
									<span class="adm-crown-badge">👑</span>
									<div class="adm-menu-text">
										<strong>Panel Admin Manajemen Pengguna</strong>
										<span>Ubah status pengguna jadi PRO & reset kuota</span>
									</div>
								</div>
								<span class="adm-arrow-right">→</span>
							</a>
						{/if}

						{#if !isAppStandalone}
							<button class="btn-install-pwa-sheet" onclick={triggerPWAInstall}>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
								</svg>
								<span>Pasang CatatAi ke Layar Utama (PWA)</span>
							</button>
						{:else}
							<div class="installed-pwa-badge">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="20 6 9 17 4 12"/>
								</svg>
								<span>CatatAi terpasang di perangkat Anda (PWA)</span>
							</div>
						{/if}
		




						<button class="btn-logout-full" onclick={handleLogout}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
							</svg>
							<span>Keluar dari Akun</span>
						</button>
					</div>
				</div>
			</div>
		{/if}

		
		<!-- ==============================================
		     MODAL UPGRADE PRO / FREEMIUM SELECTOR (STANDALONE)
		     ============================================== -->
		{#if showUpgradeModal}
			<div 
				class="bottom-sheet-backdrop" 
				onclick={() => showUpgradeModal = false} 
				onkeydown={(e) => { if (e.key === 'Escape') showUpgradeModal = false; }} 
				role="presentation"
			>
				<div 
					class="bottom-sheet-sheet upgrade-pro-sheet" 
					onclick={(e) => e.stopPropagation()} 
					onkeydown={(e) => e.stopPropagation()} 
					role="dialog" 
					tabindex="-1"
				>
					<div class="sheet-grabber-bar"></div>
					<div class="sheet-header">
						<h3 class="sheet-title">Pilihan Paket CatatAi</h3>
						<button class="sheet-close-btn" aria-label="Tutup" onclick={() => showUpgradeModal = false}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</button>
					</div>

					<div class="upgrade-sheet-body">
						<div class="upgrade-hero-card">
							<div class="upgrade-crown-icon">👑</div>
							<h2 class="upgrade-hero-title">Buka Akses Tanpa Batas</h2>
							<p class="upgrade-hero-sub">Pencatatan keuangan cerdas, scan nota AI, dan rekap otomatis tanpa limit harian.</p>
						</div>

						<!-- PERBANDINGAN TIER -->
						<div class="plans-grid-row">
							<!-- PLAN 1: GRATIS -->
							<div class="plan-card {currentUser.tier !== 'pro' ? 'plan-current' : ''}">
								<div class="plan-header">
									<div class="plan-name">Versi Gratis</div>
									<div class="plan-price">Rp 0 <span>/ selamanya</span></div>
								</div>
								<ul class="plan-features-list">
									<li><span class="feat-bullet">⏳</span> 5 pesan chat per hari</li>
									<li><span class="feat-bullet">🔄</span> Reset kuota setiap tengah malam</li>
									<li><span class="feat-bullet">📊</span> Rekap keuangan bulanan</li>
								</ul>
								{#if currentUser.tier !== 'pro'}
									<div class="plan-badge-curr">Paket Anda Saat Ini ({currentUser.sisa_kuota ?? 5}/5 pesan)</div>
								{:else}
									<button 
										type="button"
										class="btn-plan-toggle btn-plan-free" 
										onclick={() => toggleProTier('free')}
										disabled={upgradeLoading}
									>
										Beralih ke Free (Demo Limit)
									</button>
								{/if}
							</div>

							<!-- PLAN 2: PRO UNLIMITED -->
							<div class="plan-card plan-pro-highlight {currentUser.tier === 'pro' ? 'plan-current' : ''}">
								<div class="pro-popular-ribbon">PALING POPULER</div>
								<div class="plan-header">
									<div class="plan-name">Versi PRO ⭐</div>
									<div class="plan-price">Unlimited <span>/ selamanya</span></div>
								</div>
								<ul class="plan-features-list">
									<li><span class="feat-bullet">⚡</span> <strong>Chat Tanpa Batas (Unlimited)</strong></li>
									<li><span class="feat-bullet">📸</span> <strong>Scan Nota AI Tanpa Batas</strong></li>
									<li><span class="feat-bullet">📑</span> Export CSV & Rekap Lengkap</li>
									<li><span class="feat-bullet">🔒</span> Data Terisolasi & Pribadi</li>
								</ul>

								{#if currentUser?.tier === 'pro'}
									<div class="plan-badge-curr pro-active">⭐ Paket Anda Aktif (Unlimited)</div>
								{:else}
									<a 
										href="https://wa.me/6281225020952?text={encodeURIComponent('Halo Admin Miftah, saya ingin upgrade akun CatatAi saya ke Versi PRO Unlimited.\n\nNama: ' + (currentUser?.nama || '') + '\nEmail: ' + (currentUser?.email || ''))}" 
										target="_blank" 
										rel="noopener noreferrer" 
										class="btn-plan-toggle btn-plan-pro-wa"
									>
										<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
										</svg>
										<span>Hubungi WA Admin (081225020952) 💬</span>
									</a>

									{#if currentUser?.role === 'admin' || currentUser?.email === 'miftahdev7@gmail.com'}
										<div class="admin-quick-dev-box">
											<button 
												type="button" 
												class="btn-admin-instant-act"
												onclick={() => toggleProTier('pro')}
												disabled={upgradeLoading}
											>
												👑 [Mode Admin] Aktifkan Akun Sendiri Langsung
											</button>
										</div>
									{/if}
								{/if}
							</div>
						</div>

						<div class="upgrade-note-box">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
							<span>Untuk aktivasi PRO, silakan klik tombol WA di atas atau hubungi <strong>081225020952</strong>. Admin Miftah akan langsung mengubah status akun Anda menjadi PRO Unlimited.</span>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- BOTTOM SHEET MODAL (MANUAL INPUT) -->
		{#if showModalTambah}
			<div 
				class="bottom-sheet-backdrop" 
				onclick={() => showModalTambah = false} 
				onkeydown={(e) => { if (e.key === 'Escape') showModalTambah = false; }} 
				role="presentation"
			>
				<div 
					class="bottom-sheet-sheet" 
					onclick={(e) => e.stopPropagation()} 
					onkeydown={(e) => e.stopPropagation()} 
					role="dialog" 
					tabindex="-1"
				>
					<div class="sheet-grabber-bar"></div>
					
					<div class="sheet-header">
						<h3 class="sheet-title">Catat Transaksi Manual</h3>
						<button class="sheet-close-btn" aria-label="Tutup" onclick={() => showModalTambah = false}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</button>
					</div>

					<div class="sheet-body-scroll">
						<div class="sheet-form-grid">
							<div class="sheet-field">
								<label for="inp-sheet-type">Tipe</label>
								<select id="inp-sheet-type" class="native-sheet-input" bind:value={form.tipe}>
									<option value="pengeluaran">Pengeluaran (Belanja/Biaya)</option>
									<option value="pemasukan">Pemasukan (Gaji/Pendapatan)</option>
								</select>
							</div>

							<div class="sheet-field">
								<label for="inp-sheet-store">{form.tipe === 'pemasukan' ? 'Sumber Uang / Kantor' : 'Nama Toko / Tempat'}</label>
								<input 
									id="inp-sheet-store" 
									type="text" 
									class="native-sheet-input" 
									placeholder="Contoh: Kantor, Kopi Kenangan, SPBU" 
									bind:value={form.toko} 
								/>
							</div>

							<div class="sheet-field">
								<label for="inp-sheet-date">Tanggal</label>
								<input id="inp-sheet-date" type="date" class="native-sheet-input" bind:value={form.tanggal} />
							</div>

							<div class="sheet-field">
								<label for="inp-sheet-time">Jam</label>
								<input id="inp-sheet-time" type="time" class="native-sheet-input" bind:value={form.waktu} />
							</div>

							<div class="sheet-field">
								<label for="inp-sheet-cat">Kategori</label>
								<select id="inp-sheet-cat" class="native-sheet-input" bind:value={form.kategori}>
									{#each KATEGORI_OPTIONS as k}
										<option value={k}>{k}</option>
									{/each}
								</select>
							</div>

							<div class="sheet-field">
								<label for="inp-sheet-pay">Metode Bayar</label>
								<select id="inp-sheet-pay" class="native-sheet-input" bind:value={form.metode_bayar}>
									{#each METODE_OPTIONS as m}
										<option value={m}>{m}</option>
									{/each}
								</select>
							</div>
						</div>

						<!-- Rincian Item (Opsional) -->
						<div class="sheet-divider mt-3">
							<div class="sheet-divider-row">
								<span class="sub-sheet-heading">Rincian Barang</span>
								<button class="btn-sheet-mini" onclick={addItem}>+ Tambah Baris</button>
							</div>

							{#if form.items.length > 0}
								<div class="sheet-items-stack">
									{#each form.items as item, idx}
										<div class="sheet-item-row">
											<input type="text" placeholder="Nama item" class="native-sheet-input flex-2" bind:value={item.nama_barang} />
											<input type="number" min="1" placeholder="Qty" class="native-sheet-input flex-1" bind:value={item.qty} oninput={hitungTotal} />
											<input type="number" min="0" placeholder="Harga" class="native-sheet-input flex-1" bind:value={item.harga_satuan} oninput={hitungTotal} />
											<button class="btn-sheet-del" aria-label="Hapus baris item" onclick={() => removeItem(idx)}>
												<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
											</button>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Kalkulasi Total -->
						<div class="sheet-calc-box mt-3">
							<div class="calc-line-row">
								<span>Subtotal:</span>
								<span>{formatRupiah(form.subtotal)}</span>
							</div>
							<div class="calc-inputs-row">
								<div class="calc-col">
									<label for="inp-sheet-tax">Pajak:</label>
									<input id="inp-sheet-tax" type="number" class="native-sheet-input-sm" bind:value={form.pajak} oninput={hitungTotal} />
								</div>
								<div class="calc-col">
									<label for="inp-sheet-disc">Diskon:</label>
									<input id="inp-sheet-disc" type="number" class="native-sheet-input-sm" bind:value={form.diskon} oninput={hitungTotal} />
								</div>
							</div>
							<div class="calc-grand-row">
								<span class="tot-title">Grand Total:</span>
								<input type="number" class="native-grand-input" bind:value={form.total} />
							</div>
						</div>

						<div class="sheet-field mt-3">
							<label for="inp-sheet-note">Catatan Tambahan</label>
							<input id="inp-sheet-note" type="text" class="native-sheet-input" placeholder="Keterangan..." bind:value={form.catatan} />
						</div>
					</div>

					<div class="sheet-sticky-footer">
						<button class="btn-sheet-cancel" onclick={() => showModalTambah = false}>Batal</button>
						<button class="btn-sheet-submit" onclick={simpanTransaksi} disabled={loading}>
							{loading ? 'Menyimpan...' : 'Simpan Transaksi'}
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- BOTTOM SHEET MODAL (DETAIL & FOTO) -->
		{#if showModalDetail}
			<div 
				class="bottom-sheet-backdrop" 
				onclick={() => showModalDetail = false} 
				onkeydown={(e) => { if (e.key === 'Escape') showModalDetail = false; }} 
				role="presentation"
			>
				<div 
					class="bottom-sheet-sheet" 
					onclick={(e) => e.stopPropagation()} 
					onkeydown={(e) => e.stopPropagation()} 
					role="dialog" 
					tabindex="-1"
				>
					<div class="sheet-grabber-bar"></div>

					<div class="sheet-header">
						<h3 class="sheet-title">Rincian Transaksi</h3>
						<button class="sheet-close-btn" aria-label="Tutup" onclick={() => showModalDetail = false}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</button>
					</div>

					{#if detailLoading}
						<div class="empty-panel-text"><p>Memuat rincian...</p></div>
					{:else if detailData}
						<div class="sheet-body-scroll">
							{#if detailData.gambar_url}
								<div class="detail-photo-card">
									<img src={detailData.gambar_url} alt="Nota" class="detail-img-full" />
								</div>
							{/if}

							<div class="detail-tags-cluster">
								<span class="pill-type {detailData.tipe === 'pemasukan' ? 'pill-income' : 'pill-expense'}">
									{detailData.tipe.toUpperCase()}
								</span>
								<span class="col-tag">{detailData.kategori}</span>
								<span class="col-tag method-tag">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
									<span>{detailData.metode_bayar}</span>
								</span>
							</div>

							<h2 class="detail-hero-store">{detailData.toko || 'Transaksi'}</h2>
							<p class="detail-hero-time">
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
								<span>{formatTgl(detailData.tanggal)} • {detailData.waktu?.slice(0, 5) || '-'}</span>
							</p>

							{#if detailData.catatan}
								<div class="detail-callout-note">"{detailData.catatan}"</div>
							{/if}

							{#if detailData.items && detailData.items.length > 0}
								<h4 class="sub-sheet-heading mt-3">Barang / Item:</h4>
								<div class="detail-items-stack">
									{#each detailData.items as itm}
										<div class="detail-item-line">
											<span>{itm.qty}x {itm.nama_barang}</span>
											<span class="entry-sub">{formatRupiah(itm.subtotal)}</span>
										</div>
									{/each}
								</div>
							{/if}

							<div class="sheet-calc-box mt-3">
								<div class="calc-line-row">
									<span>Subtotal:</span>
									<span>{formatRupiah(detailData.subtotal)}</span>
								</div>
								{#if detailData.pajak > 0}
									<div class="calc-line-row">
										<span>Pajak (PPN):</span>
										<span>{formatRupiah(detailData.pajak)}</span>
									</div>
								{/if}
								{#if detailData.diskon > 0}
									<div class="calc-line-row">
										<span>Diskon:</span>
										<span>-{formatRupiah(detailData.diskon)}</span>
									</div>
								{/if}
								<div class="calc-grand-row">
									<span class="tot-title">Grand Total:</span>
									<span class="tot-val {detailData.tipe === 'pemasukan' ? 'color-income' : 'color-expense'}">
										{detailData.tipe === 'pemasukan' ? '+' : '-'} {formatRupiah(detailData.total)}
									</span>
								</div>
							</div>
						</div>

						<div class="sheet-sticky-footer">
							<button class="btn-sheet-danger" onclick={() => deleteTransaksi(detailData.id)}>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
								</svg>
								<span>Hapus</span>
							</button>
							<button class="btn-sheet-submit" onclick={() => showModalDetail = false}>Tutup</button>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	/* ====================================================
	   WARM LINEN MOBILE-FIRST APP LAYOUT
	   ==================================================== */
	.app-mobile-root {
		min-height: 100dvh;
		background-color: var(--bg-primary, #f5f0e8);
		color: var(--text-primary, #231f1c);
		display: flex;
		flex-direction: column;
		-webkit-tap-highlight-color: transparent;
	}

	/* SPLASH SCREEN */
	.auth-loading-screen {
		flex: 1;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.8rem;
		background: #f5f0e8;
	}
	.splash-title { font-size: 1.4rem; font-weight: 800; font-family: 'Outfit', sans-serif; color: #231f1c; }
	.splash-sub { font-size: 0.85rem; color: #7c746a; }

	/* ====================================================
	   LANDING PAGE TWO-COLUMNS (INFO + LOGIN)
	   ==================================================== */
	.landing-page-wrap {
		min-height: 100dvh;
		background-color: #f5f0e8;
		background-image: 
			radial-gradient(circle at 12% 18%, rgba(16, 185, 129, 0.08) 0%, transparent 45%),
			radial-gradient(circle at 88% 55%, rgba(217, 119, 6, 0.06) 0%, transparent 50%),
			url("data:image/svg+xml,%3Csvg width='160' height='160' viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23706456' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round' opacity='0.08'%3E%3Cpath d='M16 26 h18 a2 2 0 0 1 2 2 v9 a9 9 0 0 1 -9 9 h-2 a9 9 0 0 1 -9 -9 v-9 a2 2 0 0 1 2 -2 z'/%3E%3Crect x='85' y='18' width='36' height='24' rx='4'/%3E%3Ccircle cx='124' cy='112' r='8'/%3E%3C/svg%3E");
		display: flex;
		flex-direction: column;
	}

	/* TOP NAVIGATION BAR */
	.landing-nav-bar {
		background: rgba(245, 240, 232, 0.92);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		border-bottom: 1px solid #e3dbce;
		flex-shrink: 0;
		padding: 0.55rem 1.5rem;
		box-shadow: 0 1px 4px rgba(35, 31, 28, 0.03);
	}
	.landing-nav-inner {
		max-width: 1240px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.landing-nav-brand {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}
	.brand-logo-text {
		display: flex;
		flex-direction: column;
	}
	.logo-title {
		font-family: 'Outfit', sans-serif;
		font-size: 1.25rem;
		font-weight: 800;
		color: #231f1c;
		line-height: 1.1;
		letter-spacing: -0.02em;
	}
	.logo-sub {
		font-size: 0.68rem;
		color: #7c746a;
		font-weight: 600;
	}
	.landing-nav-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.landing-status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: #e6f4ea;
		border: 1px solid #b7e4c7;
		color: #047857;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.3rem 0.7rem;
		border-radius: 9999px;
	}
	.status-pulse-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #10b981;
		box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
		animation: pulseDot 2s infinite;
	}
	@keyframes pulseDot {
		0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
		70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
		100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
	}
	.nav-cta-btn {
		background: #ffffff;
		border: 1.5px solid #059669;
		color: #059669;
		font-weight: 700;
		font-size: 0.78rem;
		padding: 0.35rem 0.85rem;
		border-radius: 8px;
		transition: all 0.15s ease;
		cursor: pointer;
	}
	.nav-cta-btn:hover {
		background: #059669;
		color: #ffffff;
		box-shadow: 0 3px 8px rgba(5, 150, 105, 0.25);
	}

	/* MAIN 2-COLUMN LAYOUT */
	.landing-main-container {
		flex: 1;
		min-height: 0;
		max-width: 1240px;
		width: 100%;
		margin: 0 auto;
		padding: 0.8rem 1.5rem;
		display: flex;
		align-items: center;
	}
	.landing-grid-layout {
		display: grid;
		grid-template-columns: 1.15fr 0.85fr;
		gap: 2.4rem;
		align-items: center;
		width: 100%;
	}

	/* COLUMN 1: LANDING PAGE INFO */
	.landing-info-column {
		display: flex;
		flex-direction: column;
	}
	.hero-tag-badge {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: #eef7ee;
		border: 1px solid #c0e6ce;
		color: #047857;
		padding: 0.26rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.74rem;
		font-weight: 700;
		margin-bottom: 0.6rem;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.04);
	}
	.landing-hero-title {
		font-family: 'Outfit', sans-serif;
		font-size: clamp(1.6rem, 2.3vw, 2.15rem);
		font-weight: 800;
		color: #231f1c;
		line-height: 1.18;
		letter-spacing: -0.025em;
		margin-bottom: 0.5rem;
	}
	.accent-text-highlight {
		background: linear-gradient(135deg, #059669 0%, #10b981 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		display: inline;
	}
	.landing-hero-subtitle {
		font-size: 0.86rem;
		line-height: 1.48;
		color: #554d44;
		margin-bottom: 0.9rem;
		max-width: 540px;
	}

	/* INTERACTIVE SHOWCASE CARD (CHAT SIMULATION) */
	.landing-showcase-card {
		background: #ffffff;
		border: 1.5px solid #ded5c8;
		border-radius: 16px;
		box-shadow: 0 10px 26px -8px rgba(35, 31, 28, 0.08), 0 3px 8px rgba(35, 31, 28, 0.03);
		overflow: hidden;
		margin-bottom: 0.85rem;
	}
	.showcase-card-header {
		background: #faf6f0;
		border-bottom: 1px solid #e7ded2;
		padding: 0.5rem 0.85rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem;
	}
	.showcase-assistant-avatar {
		width: 30px;
		height: 30px;
		border-radius: 8px;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.showcase-assistant-info {
		flex: 1;
		min-width: 0;
	}
	.assistant-name {
		font-size: 0.82rem;
		font-weight: 800;
		color: #231f1c;
	}
	.assistant-status {
		font-size: 0.68rem;
		color: #736b61;
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}
	.online-indicator {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #10b981;
	}
	.showcase-mode-pill {
		font-size: 0.68rem;
		font-weight: 700;
		background: #eae3d6;
		color: #554d44;
		padding: 0.2rem 0.55rem;
		border-radius: 9999px;
		border: 1px solid #ddd5c7;
	}

	.showcase-chat-flow {
		padding: 0.75rem 0.85rem;
		background: #efeae2;
		background-image: url("data:image/svg+xml,%3Csvg width='140' height='140' viewBox='0 0 140 140' xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23706456' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round' opacity='0.08'%3E%3Cpath d='M16 26 h18 a2 2 0 0 1 2 2 v9 a9 9 0 0 1 -9 9 h-2 a9 9 0 0 1 -9 -9 v-9 a2 2 0 0 1 2 -2 z'/%3E%3Crect x='85' y='18' width='36' height='24' rx='4'/%3E%3Ccircle cx='124' cy='112' r='8'/%3E%3C/svg%3E");
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.chat-bubble-row {
		display: flex;
		width: 100%;
	}
	.chat-bubble-row.user-row { justify-content: flex-end; }
	.chat-bubble-row.bot-row { justify-content: flex-start; }

	.chat-mock-bubble {
		max-width: 88%;
		border-radius: 12px;
		padding: 0.5rem 0.75rem;
		font-size: 0.8rem;
		line-height: 1.35;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.06);
		position: relative;
	}
	.user-bubble {
		background: #dcf8c6;
		color: #13381e;
		border: 1px solid #c8e6b3;
		border-top-right-radius: 3px;
	}
	.bot-bubble {
		background: #ffffff;
		color: #231f1c;
		border: 1px solid #e3dbce;
		border-top-left-radius: 3px;
	}
	.chat-time {
		display: block;
		text-align: right;
		font-size: 0.65rem;
		color: #7c746b;
		margin-top: 0.15rem;
	}
	.bot-badge-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.7rem;
		font-weight: 800;
		color: #047857;
		background: #e6f4ea;
		padding: 0.15rem 0.45rem;
		border-radius: 5px;
		margin-bottom: 0.25rem;
	}
	.bot-badge-tag.vision-tag {
		color: #92400e;
		background: #fef3c7;
	}
	.bot-badge-tag .text-danger { color: #e11d48; font-weight: 800; }
	.bot-micro-meta {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.72rem;
		color: #6d6459;
	}
	.category-chip {
		background: #eef2ff;
		color: #4338ca;
		font-weight: 700;
		font-size: 0.68rem;
		padding: 0.1rem 0.4rem;
		border-radius: 5px;
	}
	.chip-sub {
		color: #554d44;
		font-size: 0.7rem;
		font-weight: 600;
	}
	.receipt-banner-bubble {
		background: #fffdfa;
	}
	.receipt-banner-text {
		font-size: 0.74rem;
		color: #433d34;
		line-height: 1.32;
	}

	/* COMPACT FEATURES ROW */
	.landing-features-compact-row {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.45rem;
	}
	.compact-feature-pill {
		background: #ffffff;
		border: 1px solid #ded5c8;
		border-radius: 10px;
		padding: 0.42rem 0.65rem;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.75rem;
		font-weight: 700;
		color: #231f1c;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.03);
	}
	.pill-icon {
		width: 26px;
		height: 26px;
		border-radius: 7px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.icon-emerald-soft { background: #e6f4ea; color: #059669; }
	.icon-amber-soft { background: #fef3c7; color: #d97706; }
	.icon-indigo-soft { background: #eef2ff; color: #4f46e5; }
	.icon-rose-soft { background: #ffe4e6; color: #e11d48; }

	/* COLUMN 2: AUTH CARD BOX */
	.landing-auth-column {
		position: relative;
	}
	.sticky-auth-box {
		position: static;
	}
	.auth-card-box {
		width: 100%;
		background: #ffffff;
		border: 1.5px solid #ded5c8;
		border-radius: 20px;
		padding: 1.45rem 1.45rem;
		box-shadow: 0 14px 34px -10px rgba(35, 31, 28, 0.1), 0 3px 10px rgba(35, 31, 28, 0.04);
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		animation: fadeIn 0.25s ease;
	}
	.auth-brand-head {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
	}
	.brand-gem-large {
		width: 44px;
		height: 44px;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 3px 10px rgba(5, 150, 105, 0.26);
		margin-bottom: 0.15rem;
	}
	.auth-app-title {
		font-size: 1.3rem;
		font-weight: 800;
		font-family: 'Outfit', sans-serif;
		color: #231f1c;
		letter-spacing: -0.02em;
	}
	.auth-app-desc {
		font-size: 0.76rem;
		color: #6d6459;
		line-height: 1.35;
	}

	.auth-tabs-row {
		display: flex;
		background: #eae3d6;
		padding: 0.2rem;
		border-radius: 10px;
		border: 1px solid #ded5c8;
	}
	.auth-tab-btn {
		flex: 1;
		background: transparent;
		color: #6d6459;
		padding: 0.45rem 0;
		border-radius: 8px;
		font-weight: 700;
		font-size: 0.82rem;
		text-align: center;
		transition: all 0.18s ease;
	}
	.auth-tab-btn.active {
		background: #ffffff;
		color: #231f1c;
		box-shadow: 0 1px 4px rgba(35, 31, 28, 0.1);
	}

	.auth-error-banner {
		background: #fee2e2;
		border: 1px solid #fecaca;
		color: #b91c1c;
		padding: 0.55rem 0.8rem;
		border-radius: 8px;
		font-size: 0.78rem;
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.auth-form-stack {
		display: flex;
		flex-direction: column;
		gap: 0.72rem;
	}
	.auth-field {
		display: flex;
		flex-direction: column;
		gap: 0.22rem;
	}
	.field-label-split {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.auth-field label {
		font-size: 0.76rem;
		font-weight: 700;
		color: #3b352e;
	}
	.btn-toggle-pwd {
		background: transparent;
		color: #059669;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0;
		cursor: pointer;
	}
	.btn-toggle-pwd:hover {
		text-decoration: underline;
	}
	.auth-input-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: #faf7f2;
		border: 1.5px solid #ded5c8;
		border-radius: 9px;
		padding: 0.58rem 0.8rem;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}
	.auth-input-wrap:focus-within {
		border-color: #059669;
		background: #ffffff;
		box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
	}
	.auth-input-icon { color: #8e8579; flex-shrink: 0; }
	.auth-input-wrap input {
		width: 100%;
		border: none;
		outline: none;
		background: transparent;
		color: #231f1c;
		font-size: 0.86rem;
	}

	.btn-auth-submit {
		margin-top: 0.2rem;
		width: 100%;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		font-weight: 700;
		font-size: 0.9rem;
		padding: 0.76rem;
		border-radius: 10px;
		box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
		transition: transform 0.12s ease, opacity 0.12s ease, box-shadow 0.12s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}
	.btn-auth-submit:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 6px 18px rgba(16, 185, 129, 0.36);
	}
	.btn-auth-submit:active { transform: scale(0.98); }
	.btn-auth-submit:disabled { opacity: 0.65; cursor: not-allowed; }

	.btn-spinner {
		width: 15px;
		height: 15px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: #ffffff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.auth-switch-helper {
		text-align: center;
		font-size: 0.78rem;
		color: #6d6459;
	}
	.link-switch-auth {
		background: transparent;
		border: none;
		color: #059669;
		font-weight: 700;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
	}
	.link-switch-auth:hover { color: #047857; }

	.auth-security-notice {
		display: flex;
		align-items: flex-start;
		gap: 0.45rem;
		background: #faf7f2;
		border: 1px solid #e8dfd3;
		padding: 0.55rem 0.75rem;
		border-radius: 8px;
		font-size: 0.7rem;
		color: #6d6459;
		line-height: 1.35;
	}
	.auth-security-notice svg { flex-shrink: 0; color: #059669; margin-top: 1px; }
	.security-text-box strong { color: #231f1c; display: block; margin-bottom: 0.05rem; }

	.auth-quick-perks {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		border-top: 1px solid #eee7dc;
		padding-top: 0.65rem;
	}
	.perk-bullet {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		color: #554d44;
		font-weight: 600;
	}
	.perk-bullet svg { color: #10b981; flex-shrink: 0; }

	/* LANDING FOOTER */
	.landing-page-footer {
		background: #ece5d9;
		border-top: 1px solid #ded5c8;
		padding: 0.55rem 1.5rem;
		flex-shrink: 0;
	}
	.footer-inner {
		max-width: 1240px;
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.75rem;
		font-size: 0.75rem;
		color: #736b61;
	}
	.footer-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.footer-logo {
		font-family: 'Outfit', sans-serif;
		font-weight: 800;
		color: #231f1c;
		font-size: 0.9rem;
	}
	.footer-right {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
	.dot-sep { opacity: 0.5; }

	/* ====================================================
	   DESKTOP (>= 960px): FIT IN EXACTLY 1 VIEWPORT SCREEN (NO SCROLL)
	   ==================================================== */
	@media (min-width: 960px) {
		.landing-page-wrap {
			height: 100dvh;
			max-height: 100dvh;
			overflow: hidden;
		}
	}

	/* ====================================================
	   MOBILE MODE (< 960px): DIRECT LOGIN ONLY!
	   SEPERTI DIMINTA: TAMPIL HALAMAN LOGIN AJA LANGSUNG
	   ==================================================== */
	@media (max-width: 959px) {
		.landing-page-wrap {
			min-height: 100dvh;
			justify-content: center;
			align-items: center;
			padding: 1.25rem 1rem;
		}
		/* Sembunyikan elemen landing info, navbar, dan footer di mode mobile */
		.landing-nav-bar,
		.landing-info-column,
		.landing-page-footer {
			display: none !important;
		}
		.landing-main-container {
			padding: 0;
			width: 100%;
			max-width: 440px;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.landing-grid-layout {
			display: block;
			width: 100%;
		}
		.landing-auth-column {
			width: 100%;
		}
		.auth-card-box {
			width: 100%;
			max-width: 440px;
			margin: 0 auto;
			padding: 1.8rem 1.4rem;
			box-shadow: 0 10px 30px rgba(35, 31, 28, 0.08);
		}
	}

	/* ====================================================
	   APP HEADER MODERN 2-TIER (ZERO CRAMPED, ZERO OVERLAP)
	   ==================================================== */
	.app-header-modern {
		background: #faf6f0;
		border-bottom: 1px solid #e6ded3;
		position: sticky;
		top: 0;
		z-index: 50;
		padding-top: env(safe-area-inset-top, 0px);
		box-shadow: 0 2px 8px rgba(35, 31, 28, 0.03);
	}

	

	.brand-unit {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.brand-gem-modern {
		width: 34px;
		height: 34px;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25);
		flex-shrink: 0;
	}

	.brand-meta {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}

	.brand-name-bold {
		font-size: 1.15rem;
		font-weight: 800;
		font-family: 'Outfit', sans-serif;
		color: #231f1c;
		letter-spacing: -0.02em;
	}

	.brand-kpi-sub {
		font-size: 0.72rem;
		color: #787063;
	}
	.text-expense { color: #dc2626; font-weight: 700; }
	.text-neutral { color: #554d42; font-weight: 600; }

	.header-actions-cluster {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.btn-action-add {
		background: #ffffff;
		border: 1px solid #ded5c8;
		color: #231f1c;
		font-weight: 700;
		padding: 0.4rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.78rem;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.05);
		transition: background 0.15s, transform 0.1s;
	}
	.btn-action-add:active { transform: scale(0.96); background: #f5efe4; }

	.btn-avatar-profile {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: linear-gradient(135deg, #059669 0%, #047857 100%);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.88rem;
		font-weight: 800;
		box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25);
		border: 2px solid #ffffff;
		transition: transform 0.1s;
		cursor: pointer;
	}
	.btn-avatar-profile:active { transform: scale(0.92); }

	/* ROW 2: SEGMENTED TABS (FULL-WIDTH & MODERN) */
	.header-tier-tabs {
		max-width: 900px;
		margin: 0 auto;
		padding: 0.15rem 1rem 0.65rem;
	}

	.modern-segment-bar {
		display: flex;
		background: #eae3d6;
		padding: 0.22rem;
		border-radius: 12px;
		border: 1px solid #ddd5c7;
		gap: 0.2rem;
	}

	.tab-btn {
		flex: 1;
		background: transparent;
		color: #6d6459;
		padding: 0.45rem 0.5rem;
		border-radius: 9px;
		font-weight: 700;
		font-size: 0.86rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
		white-space: nowrap;
	}

	.tab-btn.active {
		background: #ffffff;
		color: #1f1b16;
		box-shadow: 0 2px 6px rgba(35, 31, 28, 0.08);
	}

	.report-badge-count {
		background: #e6dfd4;
		color: #4a4339;
		font-size: 0.68rem;
		font-weight: 800;
		padding: 0.1rem 0.42rem;
		border-radius: 9999px;
	}
	.tab-btn.active .report-badge-count {
		background: #e6f4ea;
		color: #059669;
	}

	/* ALERTS */
	.app-alert {
		max-width: 900px;
		margin: 0.5rem auto 0;
		padding: 0.65rem 1rem;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.85rem;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.04);
	}
	.alert-content { display: flex; align-items: center; gap: 0.5rem; }
	.alert-danger { background: #fee2e2; border: 1px solid #fecaca; color: #b91c1c; }
	.alert-success { background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; }
	.alert-close { background: transparent; display: flex; align-items: center; justify-content: center; color: inherit; padding: 2px; }

	/* MAIN VIEWPORT */
	.app-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		max-width: 900px;
		width: 100%;
		margin: 0 auto;
	}

	/* ====================================================
	   CHAT MOBILE EXPERIENCE (CLEAN STREAM, ZERO OVERLAP)
	   ==================================================== */
	.chat-mobile-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		height: calc(100dvh - 100px);
		background: #efeae2;
		position: relative;
	}

	/* ====================================================
	   CHAT DATE DIVIDER & TODAY'S TRANSACTION CARDS
	   ==================================================== */
	.chat-date-divider-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0.5rem 0 0.85rem;
		width: 100%;
	}

	.chat-date-pill {
		background: #e4dcce;
		color: #4b443b;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.25rem 0.85rem;
		border-radius: 9999px;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.06);
		letter-spacing: 0.01em;
	}

	/* Card Transaksi Tercatat di Dalam Chat */
	.chat-tx-bubble-card {
		background: #faf7f2;
		border: 1.5px solid #ded5c8;
		border-radius: 14px;
		padding: 0.75rem 0.85rem;
		margin-top: 0.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		box-shadow: 0 2px 6px rgba(35, 31, 28, 0.04);
		transition: border-color 0.15s;
	}
	.chat-tx-bubble-card:hover {
		border-color: #059669;
	}

	.ctx-card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem;
	}

	.ctx-card-brand {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
	}

	.ctx-card-avatar {
		width: 32px;
		height: 32px;
		border-radius: 9px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.avatar-in {
		background: #e6f4ea;
		color: #059669;
	}
	.avatar-out {
		background: #fee2e2;
		color: #dc2626;
	}

	.ctx-card-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		line-height: 1.25;
	}

	.ctx-card-title {
		font-size: 0.88rem;
		font-weight: 800;
		color: #231f1c;
		font-family: 'Outfit', sans-serif;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ctx-card-meta {
		font-size: 0.72rem;
		color: #787063;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ctx-card-amount {
		font-size: 0.95rem;
		font-weight: 800;
		font-family: 'Outfit', sans-serif;
		white-space: nowrap;
		text-align: right;
	}

	.ctx-card-note {
		font-size: 0.75rem;
		color: #554d42;
		background: #ffffff;
		border-left: 3px solid #059669;
		padding: 0.35rem 0.6rem;
		border-radius: 4px;
		font-style: italic;
	}

	.ctx-card-mini-items {
		background: #ffffff;
		border: 1px solid #eee7db;
		border-radius: 8px;
		padding: 0.4rem 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.75rem;
	}

	.ctx-mini-item-row {
		display: flex;
		justify-content: space-between;
		color: #554d42;
	}

	.ctx-card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 0.35rem;
		border-top: 1px dashed #ded5c8;
		font-size: 0.72rem;
	}

	.ctx-saved-label {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		color: #059669;
		font-weight: 700;
	}

	.btn-ctx-detail {
		background: #ffffff;
		border: 1px solid #ded5c8;
		color: #231f1c;
		font-weight: 700;
		font-size: 0.72rem;
		padding: 0.25rem 0.65rem;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s;
	}
	.btn-ctx-detail:hover {
		background: #059669;
		color: #ffffff;
		border-color: #059669;
	}

	/* ====================================================
	   PRO & FREEMIUM TIER STYLING
	   ==================================================== */
	/* Header Tier Pills */
	.btn-tier-status {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.65rem;
		border-radius: 9999px;
		font-size: 0.76rem;
		font-weight: 700;
		cursor: pointer;
		transition: transform 0.1s, box-shadow 0.15s;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.05);
	}
	.btn-tier-status:hover {
		transform: translateY(-1px);
	}

	.tier-pro {
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
		color: #ffffff;
		border: 1px solid #b45309;
		box-shadow: 0 2px 6px rgba(217, 119, 6, 0.3);
	}
	.pro-star { font-size: 0.8rem; }
	.pro-tag { font-family: 'Outfit', sans-serif; letter-spacing: 0.02em; }

	.tier-free {
		background: #ffffff;
		border: 1px solid #ded5c8;
		color: #554d42;
	}
	.free-badge-lbl { color: #7c746a; }
	.free-badge-count { font-weight: 800; color: #231f1c; }
	.free-upgrade-arrow {
		background: #fef3c7;
		color: #b45309;
		padding: 0.05rem 0.35rem;
		border-radius: 9999px;
		font-size: 0.68rem;
		font-weight: 800;
	}

	/* Chat Bottom Dock Quota Strip */
	.chat-quota-strip {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.35rem 0.85rem;
		background: #faf7f2;
		border-bottom: 1px solid #ebd9b8;
		font-size: 0.72rem;
		color: #554d42;
	}
	.quota-info-pill {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.quota-info-pill strong {
		color: #b45309;
	}
	.btn-quota-pro-link {
		background: transparent;
		color: #d97706;
		font-weight: 800;
		font-size: 0.72rem;
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
	}

	.quota-exhausted-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 0.85rem;
		background: #fef2f2;
		border-bottom: 1.5px solid #fecaca;
		gap: 0.5rem;
	}
	.exhausted-text {
		display: flex;
		flex-direction: column;
		line-height: 1.25;
	}
	.exhausted-text strong {
		font-size: 0.78rem;
		color: #dc2626;
	}
	.exhausted-text span {
		font-size: 0.7rem;
		color: #7f1d1d;
	}
	.btn-exhausted-upgrade {
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
		color: #ffffff;
		font-weight: 800;
		font-size: 0.75rem;
		padding: 0.4rem 0.75rem;
		border-radius: 8px;
		white-space: nowrap;
		box-shadow: 0 2px 6px rgba(217, 119, 6, 0.3);
		cursor: pointer;
	}

	/* Profile Modal Tier Card */
	.profile-tier-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.85rem 1rem;
		border-radius: 12px;
		margin-bottom: 0.85rem;
		gap: 0.75rem;
	}
	.tier-free-box {
		background: #faf7f2;
		border: 1.5px solid #ded5c8;
	}
	.tier-pro-box {
		background: #fffbeb;
		border: 1.5px solid #fcd34d;
		box-shadow: 0 2px 8px rgba(245, 158, 11, 0.12);
	}
	.tier-card-left {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		min-width: 0;
	}
	.tier-icon-circle {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		flex-shrink: 0;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.08);
	}
	.tier-meta-text {
		display: flex;
		flex-direction: column;
		line-height: 1.25;
		min-width: 0;
	}
	.tier-title-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
	.tier-title-text {
		font-size: 0.88rem;
		font-weight: 800;
		color: #231f1c;
		font-family: 'Outfit', sans-serif;
	}
	.tier-status-pill {
		font-size: 0.68rem;
		font-weight: 700;
		background: #eae3d6;
		padding: 0.1rem 0.4rem;
		border-radius: 9999px;
		color: #554d42;
	}
	.tier-pro-box .tier-status-pill {
		background: #fef3c7;
		color: #b45309;
	}
	.tier-desc-text {
		font-size: 0.72rem;
		color: #787063;
		margin-top: 1px;
	}
	.btn-tier-action {
		font-size: 0.78rem;
		font-weight: 800;
		padding: 0.45rem 0.85rem;
		border-radius: 8px;
		white-space: nowrap;
		cursor: pointer;
		transition: all 0.15s;
	}
	.btn-tier-upgrade {
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
		color: #ffffff;
		box-shadow: 0 2px 6px rgba(217, 119, 6, 0.25);
	}
	.btn-tier-manage {
		background: #ffffff;
		border: 1px solid #ded5c8;
		color: #231f1c;
	}

	/* Upgrade Pro Modal Sheet */
	.upgrade-sheet-body {
		padding: 1.15rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overflow-y: auto;
	}
	.upgrade-hero-card {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
	}
	.upgrade-crown-icon {
		font-size: 2.2rem;
		line-height: 1;
	}
	.upgrade-hero-title {
		font-size: 1.35rem;
		font-weight: 800;
		font-family: 'Outfit', sans-serif;
		color: #231f1c;
		letter-spacing: -0.02em;
	}
	.upgrade-hero-sub {
		font-size: 0.8rem;
		color: #736b61;
		max-width: 360px;
		line-height: 1.4;
	}

	.plans-grid-row {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.85rem;
	}
	@media (min-width: 580px) {
		.plans-grid-row {
			grid-template-columns: 1fr 1fr;
		}
	}

	.plan-card {
		background: #faf7f2;
		border: 1.5px solid #ded5c8;
		border-radius: 14px;
		padding: 1.15rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		position: relative;
	}
	.plan-pro-highlight {
		background: #fffdf5;
		border: 2px solid #f59e0b;
		box-shadow: 0 4px 16px rgba(245, 158, 11, 0.15);
	}
	.pro-popular-ribbon {
		position: absolute;
		top: -10px;
		right: 14px;
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
		color: #ffffff;
		font-size: 0.64rem;
		font-weight: 800;
		padding: 0.15rem 0.55rem;
		border-radius: 9999px;
		letter-spacing: 0.04em;
	}
	.plan-header {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		border-bottom: 1px solid #eee7db;
		padding-bottom: 0.65rem;
	}
	.plan-name {
		font-size: 0.95rem;
		font-weight: 800;
		color: #231f1c;
		font-family: 'Outfit', sans-serif;
	}
	.plan-price {
		font-size: 1.25rem;
		font-weight: 800;
		color: #231f1c;
	}
	.plan-price span {
		font-size: 0.72rem;
		font-weight: 500;
		color: #7c746a;
	}

	.plan-features-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		font-size: 0.78rem;
		color: #4b443b;
		flex: 1;
	}
	.plan-features-list li {
		display: flex;
		align-items: flex-start;
		gap: 0.45rem;
		line-height: 1.35;
	}
	.feat-bullet { font-size: 0.8rem; flex-shrink: 0; }

	.btn-plan-toggle {
		width: 100%;
		padding: 0.65rem;
		border-radius: 10px;
		font-weight: 800;
		font-size: 0.82rem;
		cursor: pointer;
		transition: all 0.15s;
		text-align: center;
	}

	.btn-plan-free {
		background: #ffffff;
		border: 1px solid #ded5c8;
		color: #554d42;
	}

	.plan-badge-curr {
		text-align: center;
		padding: 0.5rem;
		border-radius: 8px;
		background: #eae3d6;
		font-size: 0.74rem;
		font-weight: 700;
		color: #554d42;
	}
	.plan-badge-curr.pro-active {
		background: #fef3c7;
		color: #92400e;
		border: 1px solid #fde68a;
	}

	.upgrade-note-box {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		background: #faf7f2;
		border: 1px solid #e8dfd3;
		padding: 0.6rem 0.85rem;
		border-radius: 10px;
		font-size: 0.72rem;
		color: #736b61;
	}
	.upgrade-note-box svg { color: #d97706; flex-shrink: 0; }

	/* WA DOODLE PATTERN BACKGROUND */
	.chat-stream-viewport {
		flex: 1;
		overflow-y: auto;
		padding: 1rem 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		background-color: #efeae2;
		background-image: url("data:image/svg+xml,%3Csvg width='140' height='140' viewBox='0 0 140 140' xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23706456' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round' opacity='0.16'%3E%3C!-- Coffee Cup --%3E%3Cpath d='M16 26 h18 a2 2 0 0 1 2 2 v9 a9 9 0 0 1 -9 9 h-2 a9 9 0 0 1 -9 -9 v-9 a2 2 0 0 1 2 -2 z'/%3E%3Cpath d='M36 30 h4 a3 3 0 0 1 3 3 v2 a3 3 0 0 1 -3 3 h-4'/%3E%3C!-- Wallet --%3E%3Crect x='85' y='18' width='36' height='24' rx='4'/%3E%3Cpath d='M85 26 h36'/%3E%3Ccircle cx='110' cy='32' r='2' fill='%23706456'/%3E%3C!-- Speech Bubble --%3E%3Cpath d='M22 80 a10 10 0 0 1 10 -10 h8 a10 10 0 0 1 10 10 v4 a10 10 0 0 1 -10 10 h-3 l-7 6 v-6 h-1 a10 10 0 0 1 -9 -10 z'/%3E%3C!-- Shopping Bag --%3E%3Cpath d='M95 78 h22 l-2 18 h-18 z'/%3E%3Cpath d='M99 78 a6 6 0 0 1 14 0'/%3E%3C!-- Sparkles / Stars --%3E%3Cpath d='M60 46 l1 5 5 1 -5 1 -1 5 -1 -5 -5 -1 5 -1 z'/%3E%3Cpath d='M120 62 l1 4 4 1 -4 1 -1 4 -1 -4 -4 -1 4 -1 z'/%3E%3Cpath d='M46 112 l1 4 4 1 -4 1 -1 4 -1 -4 -4 -1 4 -1 z'/%3E%3C!-- Receipt note --%3E%3Cpath d='M58 14 h16 v18 l-4 -2 -4 2 -4 -2 -4 2 z'/%3E%3C!-- Coin with rupiah symbol --%3E%3Ccircle cx='124' cy='112' r='8'/%3E%3Cpath d='M124 108 v8 M121 110 h5 a2 2 0 0 1 0 4 h-5'/%3E%3C!-- Heart --%3E%3Cpath d='M16 118 a4 4 0 0 1 6 -2 a4 4 0 0 1 6 2 c0 5 -6 9 -6 9 s-6 -4 -6 -9 z'/%3E%3C!-- Tag --%3E%3Cpath d='M68 85 l12 -12 h8 v8 l-12 12 z'/%3E%3Ccircle cx='84' cy='77' r='1.5' fill='%23706456'/%3E%3C/svg%3E");
		background-repeat: repeat;
		-webkit-overflow-scrolling: touch;
	}

	.msg-bubble-row {
		display: flex;
		gap: 0.45rem;
		max-width: 90%;
		animation: fadeIn 0.15s ease;
	}
	.bot-side { align-self: flex-start; }
	.user-side { align-self: flex-end; flex-direction: row-reverse; }

	.bot-tiny-avatar {
		width: 28px;
		height: 28px;
		background: #ffffff;
		border: 1px solid #ded5c7;
		color: #059669;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin-top: 2px;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.05);
	}

	.msg-card {
		border-radius: 14px;
		padding: 0.75rem 0.95rem;
		position: relative;
		font-size: 0.88rem;
		line-height: 1.48;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.08);
	}
	.bot-side .msg-card {
		background: #ffffff;
		color: #231f1c;
		border: 1px solid #e5dfd5;
		border-top-left-radius: 4px;
	}
	.user-side .msg-card {
		background: #dcf8c6;
		color: #13381e;
		border: 1px solid #c7e6b2;
		border-top-right-radius: 4px;
	}

	.msg-media-wrap { margin-bottom: 0.45rem; }
	.msg-media-img {
		max-width: 100%;
		max-height: 200px;
		border-radius: 10px;
		border: 1px solid rgba(0, 0, 0, 0.08);
		object-fit: cover;
	}
	.msg-text-content { white-space: pre-wrap; word-break: break-word; }

	.msg-footer-meta {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.25rem;
		margin-top: 0.3rem;
		font-size: 0.64rem;
		color: #8c8376;
	}
	.user-side .msg-footer-meta { color: #537a5b; }
	.msg-check-svg { margin-left: 1px; }

	/* DRAFT CARD STYLES */
	.tx-draft-box {
		margin-top: 0.65rem;
		background: #ffffff;
		border: 1.5px solid #d9d0c3;
		border-radius: 12px;
		padding: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		box-shadow: 0 2px 6px rgba(35, 31, 28, 0.04);
	}
	.draft-topline {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid #eee7db;
		padding-bottom: 0.45rem;
	}
	.draft-badge-title-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-weight: 700;
		font-size: 0.82rem;
		color: #2b251f;
	}
	.draft-icon-income { color: #059669; }
	.draft-icon-expense { color: #dc2626; }

	.pill-type { font-size: 0.65rem; font-weight: 800; padding: 0.15rem 0.5rem; border-radius: 9999px; }
	.pill-income { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
	.pill-expense { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }

	.draft-grid-info {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.35rem 0.65rem;
		font-size: 0.78rem;
	}
	.draft-col { display: flex; flex-direction: column; }
	.col-k { font-size: 0.68rem; color: #7c7366; }
	.col-v-bold { font-weight: 700; color: #231f1c; }
	.col-v { color: #433d34; }
	.method-tag { display: inline-flex; align-items: center; gap: 0.25rem; }
	.col-tag {
		background: #f4eee3;
		padding: 0.1rem 0.45rem;
		border-radius: 4px;
		font-size: 0.72rem;
		width: fit-content;
		color: #433d34;
		border: 1px solid #e7dfd2;
	}

	.draft-itemized-list {
		background: #fbf9f5;
		border: 1px solid #eae2d5;
		border-radius: 8px;
		padding: 0.5rem 0.65rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.75rem;
	}
	.draft-item-entry { display: flex; justify-content: space-between; }
	.entry-sub { font-weight: 600; color: #231f1c; }

	.draft-total-banner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-top: 1px dashed #d5ccbe;
		padding-top: 0.5rem;
	}
	.tot-caption { font-weight: 700; font-size: 0.85rem; color: #231f1c; }
	.tot-val { font-weight: 800; font-size: 1.15rem; font-family: 'Outfit', sans-serif; }
	.color-expense { color: #dc2626; }
	.color-income { color: #059669; }
	.color-blue { color: #2563eb; }

	/* TOMBOL AKSI YANG DISULAP & BISA HILANG */
	.draft-action-block {
		margin-top: 0.25rem;
		background: #faf6ef;
		border: 1px solid #e8e0d4;
		border-radius: 10px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.action-question {
		font-weight: 700;
		font-size: 0.82rem;
		color: #231f1c;
		text-align: center;
	}
	.buttons-grid {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.btn-primary-confirm {
		width: 100%;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		font-weight: 700;
		font-size: 0.88rem;
		padding: 0.7rem 1rem;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);
		transition: transform 0.1s, opacity 0.1s;
	}
	.btn-primary-confirm:active {
		transform: scale(0.98);
		opacity: 0.9;
	}

	.buttons-sub-row {
		display: flex;
		gap: 0.45rem;
	}
	.btn-sub-edit {
		flex: 1;
		background: #ffffff;
		border: 1.5px solid #ded6c8;
		color: #3b352e;
		font-weight: 600;
		font-size: 0.8rem;
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		transition: background 0.15s;
	}
	.btn-sub-edit:active { background: #f3ede2; }
	.btn-sub-cancel {
		flex: 1;
		background: #fff5f5;
		border: 1px solid #fed7d7;
		color: #e53e3e;
		font-weight: 600;
		font-size: 0.8rem;
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		transition: background 0.15s;
	}
	.btn-sub-cancel:active { background: #fed7d7; }

	/* INDIKATOR STATUS (MENGGANTIKAN TOMBOL SETELAH DIKLIK) */
	.draft-status-pill {
		margin-top: 0.25rem;
		padding: 0.6rem 0.85rem;
		border-radius: 8px;
		font-size: 0.8rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		animation: fadeIn 0.2s ease;
	}
	.pill-saved {
		background: #ecfdf5;
		border: 1px solid #a7f3d0;
		color: #047857;
	}
	.pill-cancelled {
		background: #f4eee4;
		border: 1px solid #e5ded2;
		color: #787063;
	}

	.msg-saved-banner {
		margin-top: 0.5rem;
		background: #ecfdf5;
		border: 1px solid #a7f3d0;
		color: #047857;
		padding: 0.45rem 0.65rem;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.78rem;
	}
	.saved-banner-left { display: flex; align-items: center; gap: 0.35rem; }
	.btn-detail-link {
		background: #ffffff;
		border: 1px solid #a7f3d0;
		color: #047857;
		font-weight: 700;
		padding: 0.18rem 0.5rem;
		border-radius: 5px;
		font-size: 0.7rem;
	}

	.msg-loading-card {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		background: #ffffff;
		border: 1px solid #e5dfd5;
	}
	.bounce-dot {
		width: 5px;
		height: 5px;
		background: #10b981;
		border-radius: 50%;
		animation: dotBounce 1.2s infinite ease-in-out;
	}
	.bounce-dot:nth-child(2) { animation-delay: 0.2s; }
	.bounce-dot:nth-child(3) { animation-delay: 0.4s; }
	.loading-label { font-size: 0.75rem; color: #7c746a; margin-left: 0.3rem; }

	@keyframes dotBounce {
		0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
		40% { transform: scale(1.1); opacity: 1; }
	}

	.attached-media-bar {
		background: #faf7f0;
		border-top: 1px solid #e8dfd3;
		padding: 0.45rem 0.85rem;
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}
	.thumb-container { position: relative; width: 40px; height: 40px; }
	.thumb-img { width: 100%; height: 100%; object-fit: cover; border-radius: 6px; border: 1px solid #d5cbbe; }
	.btn-remove-thumb {
		position: absolute;
		top: -6px;
		right: -6px;
		background: #ef4444;
		color: #fff;
		width: 17px;
		height: 17px;
		border-radius: 50%;
		font-size: 0.6rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.thumb-caption { font-size: 0.75rem; color: #736b60; }

	/* STICKY BOTTOM INPUT BAR */
	.chat-bottom-dock {
		background: #faf6f0;
		border-top: 1px solid #e6ded3;
		padding-bottom: env(safe-area-inset-bottom, 8px);
	}
	.chat-quick-shortcuts {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.75rem 0.15rem;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}
	.chat-quick-shortcuts::-webkit-scrollbar {
		display: none;
	}
	.quick-chip-btn {
		background: #ffffff;
		border: 1px solid #ded6c9;
		color: #4a4237;
		font-size: 0.74rem;
		font-weight: 700;
		padding: 0.3rem 0.65rem;
		border-radius: 9999px;
		white-space: nowrap;
		cursor: pointer;
		box-shadow: 0 1px 2px rgba(35, 31, 28, 0.04);
		transition: all 0.15s;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
	.quick-chip-btn:hover {
		background: #fdfaf5;
		border-color: #059669;
		color: #059669;
		transform: translateY(-1px);
	}
	.quick-chip-btn:active {
		transform: scale(0.96);
	}
	.brand-kpi-divider {
		margin: 0 0.3rem;
		opacity: 0.45;
	}
	.dock-form-row {
		padding: 0.55rem 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.btn-dock-attach {
		background: #ffffff;
		color: #554d42;
		border: 1px solid #ddd5c7;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		box-shadow: 0 1px 2px rgba(35, 31, 28, 0.05);
		transition: background 0.15s;
	}
	.btn-dock-attach:active { background: #ede6da; }
	.input-file-native { display: none; }
	.input-dock-text {
		flex: 1;
		background: #ffffff;
		border: 1.5px solid #ded5c8;
		color: #231f1c;
		padding: 0.65rem 0.95rem;
		border-radius: 9999px;
		font-size: 0.88rem;
		outline: none;
		box-shadow: inset 0 1px 2px rgba(35, 31, 28, 0.03);
	}
	.input-dock-text:focus { border-color: #059669; }
	.btn-dock-send {
		width: 40px;
		height: 40px;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		box-shadow: 0 2px 6px rgba(5, 150, 105, 0.28);
		transition: opacity 0.15s, transform 0.1s;
	}
	.btn-dock-send:active { transform: scale(0.95); }
	.btn-dock-send:disabled { background: #d5cbbe; opacity: 0.6; box-shadow: none; }

	/* ====================================================
	   REPORT MOBILE VIEW (WARM THEME)
	   ==================================================== */
	.report-mobile-container {
		padding: 0.85rem 0.85rem 3rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.report-header-card {
		background: #ffffff;
		border: 1px solid #e6ded3;
		border-radius: 12px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.04);
	}
	.period-picker-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.picker-month-native {
		flex: 1;
		border: 1px solid #ded5c8;
		background: #faf7f2;
		padding: 0.35rem 0.5rem;
		border-radius: 6px;
		font-weight: 700;
		font-size: 0.85rem;
		color: #231f1c;
	}
	.btn-arrow-month {
		background: #f4eee4;
		border: 1px solid #e6ded3;
		padding: 0.35rem 0.55rem;
		border-radius: 6px;
		color: #554d42;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.btn-today-pill {
		background: #f4eee4;
		border: 1px solid #e6ded3;
		color: #3b352e;
		font-weight: 600;
		padding: 0.35rem 0.65rem;
		border-radius: 6px;
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.sub-segments-row {
		display: flex;
		background: #eae3d6;
		padding: 0.2rem;
		border-radius: 8px;
		border: 1px solid #ddd5c7;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}
	.sub-segments-row::-webkit-scrollbar {
		display: none;
	}
	.sub-seg-btn {
		flex: 1;
		min-width: max-content;
		white-space: nowrap;
		background: transparent;
		color: #6d6459;
		padding: 0.35rem 0.55rem;
		border-radius: 6px;
		font-weight: 700;
		font-size: 0.78rem;
		text-align: center;
		transition: all 0.15s;
		cursor: pointer;
	}
	.sub-seg-btn.active {
		background: #ffffff;
		color: #231f1c;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.06);
	}

	/* Week & Custom Period Toolbars */
	.week-picker-toolbar {
		width: 100%;
	}
	.week-picker-input-wrap {
		flex: 1;
		display: flex;
	}
	.picker-date-native {
		width: 100%;
		border: 1px solid #ded5c8;
		background: #faf7f2;
		padding: 0.35rem 0.5rem;
		border-radius: 6px;
		font-weight: 700;
		font-size: 0.85rem;
		color: #231f1c;
	}

	.custom-period-control-box {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
	}
	.custom-period-dates {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.date-field-group {
		flex: 1;
		min-width: 120px;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.field-label-sm {
		font-size: 0.68rem;
		font-weight: 700;
		color: #6b6357;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}
	.date-sep-arrow {
		font-size: 0.95rem;
		color: #8c8273;
		font-weight: 700;
		margin-top: 1rem;
	}
	.btn-apply-period {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: #231f1c;
		color: #f7f4ee;
		border: none;
		border-radius: 6px;
		font-weight: 700;
		font-size: 0.78rem;
		padding: 0.45rem 0.85rem;
		margin-top: 0.95rem;
		cursor: pointer;
		transition: background 0.15s;
		white-space: nowrap;
	}
	.btn-apply-period:hover {
		background: #3b352e;
	}
	.period-presets-scroll {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
		padding: 0.1rem 0;
	}
	.period-presets-scroll::-webkit-scrollbar {
		display: none;
	}
	.preset-label-hint {
		font-size: 0.7rem;
		font-weight: 700;
		color: #8c8273;
		white-space: nowrap;
	}
	.preset-chip-btn {
		background: #f4eee4;
		border: 1px solid #e2dad0;
		border-radius: 9999px;
		padding: 0.2rem 0.55rem;
		font-size: 0.68rem;
		font-weight: 600;
		color: #524a3e;
		white-space: nowrap;
		cursor: pointer;
		transition: all 0.15s;
	}
	.preset-chip-btn:hover {
		background: #eae1d3;
		color: #231f1c;
		border-color: #cbbead;
	}

	.period-banner-card {
		background: #ffffff;
		border: 1px solid #e6ded3;
		border-radius: 12px;
		padding: 0.75rem 0.85rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.03);
	}
	.pbc-left {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.pbc-icon {
		font-size: 1.35rem;
		line-height: 1;
	}
	.pbc-title {
		font-size: 0.85rem;
		font-weight: 800;
		color: #231f1c;
		font-family: 'Outfit', sans-serif;
	}
	.pbc-dates {
		font-size: 0.72rem;
		color: #7c746a;
		font-weight: 500;
	}

	/* Week 7-Day Chart Grid */
	.week-chart-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 0.35rem;
		padding-top: 0.4rem;
	}
	.week-day-card {
		background: #faf7f2;
		border: 1px solid #eae3d6;
		border-radius: 10px;
		padding: 0.5rem 0.25rem 0.4rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		transition: transform 0.15s, box-shadow 0.15s;
	}
	.week-day-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 3px 8px rgba(35, 31, 28, 0.06);
	}
	.week-day-card.is-today-day {
		background: #fff8f0;
		border-color: #fed7aa;
	}
	.wdc-nominal {
		font-size: 0.62rem;
		font-weight: 700;
		color: #7c746a;
		height: 14px;
		line-height: 14px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}
	.wdc-bar-track {
		width: 12px;
		height: 85px;
		background: #eae2d5;
		border-radius: 9999px;
		display: flex;
		align-items: flex-end;
		overflow: hidden;
	}
	.wdc-bar-fill {
		width: 100%;
		background: #d5cbbe;
		border-radius: 9999px;
		transition: height 0.3s ease;
	}
	.wdc-bar-fill.fill-has-val {
		background: linear-gradient(180deg, #ef4444 0%, #f97316 100%);
	}
	.wdc-day-name {
		font-size: 0.65rem;
		font-weight: 700;
		color: #635b4f;
		text-transform: uppercase;
	}
	.wdc-day-num {
		font-size: 0.72rem;
		font-weight: 800;
		color: #231f1c;
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
	}
	.wdc-day-num.active-today-pill {
		background: #231f1c;
		color: #ffffff;
	}

	.kpi-mobile-2x2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.65rem;
	}
	.mobile-kpi-item {
		background: #ffffff;
		border: 1px solid #e6ded3;
		border-radius: 12px;
		padding: 0.85rem;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.03);
	}
	.kpi-lbl-row { display: flex; justify-content: space-between; align-items: center; }
	.kpi-lbl { font-size: 0.72rem; font-weight: 600; color: #7c746a; }
	.dot-badge { font-size: 0.6rem; font-weight: 800; padding: 0.1rem 0.35rem; border-radius: 9999px; }
	.badge-red { background: #fee2e2; color: #b91c1c; }
	.badge-green { background: #dcfce7; color: #15803d; }
	.badge-blue { background: #e0e7ff; color: #1d4ed8; }
	.kpi-num { font-size: 1.15rem; font-weight: 800; font-family: 'Outfit', sans-serif; margin: 0.25rem 0 0.1rem; }
	.kpi-subt { font-size: 0.65rem; color: #8e8579; }

	.card-mobile-panel {
		background: #ffffff;
		border: 1px solid #e6ded3;
		border-radius: 12px;
		padding: 0.85rem;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.03);
	}
	.panel-title { font-size: 0.95rem; font-weight: 700; color: #231f1c; font-family: 'Outfit', sans-serif; }
	.panel-sub { font-size: 0.72rem; color: #7c746a; margin-bottom: 0.85rem; }

	.chart-mobile-scroll {
		display: flex;
		align-items: flex-end;
		gap: 0.4rem;
		height: 140px;
		padding: 0.35rem 0;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}
	.chart-col-touch {
		flex: 1;
		min-width: 20px;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
	}
	.touch-bar-track {
		width: 10px;
		height: 100px;
		background: #f4eee4;
		border-radius: 9999px;
		display: flex;
		align-items: flex-end;
		overflow: hidden;
	}
	.touch-bar-fill {
		width: 100%;
		background: linear-gradient(180deg, #ef4444 0%, #f97316 100%);
		border-radius: 9999px;
	}
	.touch-date { font-size: 0.65rem; color: #8e8579; margin-top: 0.3rem; }

	.category-bars-col { display: flex; flex-direction: column; gap: 0.65rem; }
	.cat-bar-item { display: flex; flex-direction: column; gap: 0.25rem; }
	.cat-bar-header { display: flex; justify-content: space-between; font-size: 0.75rem; }
	.cat-title { font-weight: 600; color: #3b352e; }
	.cat-sum { color: #7c746a; }
	.cat-track { height: 6px; background: #f4eee4; border-radius: 9999px; overflow: hidden; }
	.cat-fill { height: 100%; background: #059669; border-radius: 9999px; }

	.merchant-mini-list { display: flex; flex-direction: column; gap: 0.45rem; }
	.merchant-mini-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.65rem;
		background: #faf7f2;
		border: 1px solid #e8dfd3;
		border-radius: 8px;
	}
	.m-rank { font-weight: 800; color: #7c746a; font-size: 0.85rem; width: 22px; }
	.m-info { flex: 1; display: flex; flex-direction: column; }
	.m-name { font-weight: 600; font-size: 0.82rem; color: #231f1c; }
	.m-cnt { font-size: 0.68rem; color: #8e8579; }
	.m-tot { font-weight: 700; color: #dc2626; font-size: 0.85rem; }

	.daily-picker-box { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; }
	.daily-picker-left { display: flex; align-items: center; gap: 0.4rem; }
	.daily-lbl { font-size: 0.75rem; font-weight: 600; color: #554d42; }
	.picker-date-native {
		background: #faf7f2;
		border: 1px solid #ded5c8;
		padding: 0.35rem 0.5rem;
		border-radius: 6px;
		font-weight: 600;
		font-size: 0.8rem;
		color: #231f1c;
	}
	.daily-chips-stats { display: flex; gap: 0.5rem; }
	.stat-pill-item {
		background: #faf7f2;
		border: 1px solid #e8dfd3;
		padding: 0.3rem 0.6rem;
		border-radius: 6px;
		display: flex;
		gap: 0.35rem;
		font-size: 0.75rem;
	}
	.sp-lbl { color: #7c746a; }
	.sp-val { font-weight: 700; }
	.daily-list-title { font-size: 0.85rem; font-weight: 700; color: #3b352e; }

	/* MOBILE TRANSACTION CARDS STREAM */
	.mobile-cards-stream { display: flex; flex-direction: column; gap: 0.45rem; }
	.mobile-tx-entry {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.7rem 0.8rem;
		background: #faf7f2;
		border: 1px solid #e8dfd3;
		border-radius: 10px;
		cursor: pointer;
		transition: background 0.15s;
		text-align: left;
		width: 100%;
	}
	.mobile-tx-entry:active { background: #f2ece1; }
	.entry-icon {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.icon-red { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
	.icon-green { background: #dcfce7; color: #059669; border: 1px solid #bbf7d0; }
	.entry-core { flex: 1; min-width: 0; }
	.entry-row-top { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
	.entry-merchant { font-weight: 700; font-size: 0.85rem; color: #231f1c; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.entry-amount { font-weight: 800; font-size: 0.88rem; font-family: 'Outfit', sans-serif; white-space: nowrap; flex-shrink: 0; }
	.entry-row-sub { font-size: 0.68rem; color: #7c746a; margin-top: 0.1rem; }

	.search-and-export { display: flex; gap: 0.45rem; margin-bottom: 0.5rem; }
	.mobile-search-bar {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		background: #faf7f2;
		border: 1px solid #ded5c8;
		padding: 0.45rem 0.65rem;
		border-radius: 8px;
		font-size: 0.82rem;
		color: #7c746a;
	}
	.mobile-search-bar input { background: transparent; border: none; outline: none; width: 100%; color: #231f1c; }
	.btn-csv-mobile {
		background: #ffffff;
		border: 1px solid #ded5c8;
		padding: 0.45rem 0.75rem;
		border-radius: 8px;
		font-size: 0.75rem;
		font-weight: 700;
		color: #3b352e;
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.mobile-filter-pills { display: flex; gap: 0.4rem; margin-bottom: 0.65rem; }
	.native-filter-select {
		flex: 1;
		background: #faf7f2;
		border: 1px solid #ded5c8;
		padding: 0.35rem 0.5rem;
		border-radius: 6px;
		font-size: 0.75rem;
		outline: none;
		color: #231f1c;
	}

	.empty-panel-text { text-align: center; padding: 2rem 1rem; font-size: 0.82rem; color: #8e8579; }
	.mt-2 { margin-top: 0.5rem; }
	.mt-3 { margin-top: 0.75rem; }

	/* ====================================================
	   PROFILE POPUP MODAL
	   ==================================================== */
	.profile-modal-sheet {
		max-height: 80dvh;
	}
	.profile-sheet-body {
		padding: 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.profile-head-box {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		background: #faf7f2;
		padding: 0.85rem;
		border-radius: 14px;
		border: 1px solid #e8dfd3;
	}
	.profile-large-avatar {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: linear-gradient(135deg, #059669 0%, #047857 100%);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.3rem;
		font-weight: 800;
		box-shadow: 0 4px 10px rgba(5, 150, 105, 0.3);
	}
	.profile-user-info { display: flex; flex-direction: column; }
	.profile-name-text { font-size: 1.1rem; font-weight: 800; color: #231f1c; font-family: 'Outfit', sans-serif; }
	.profile-email-text { font-size: 0.75rem; color: #7c746a; }

	.profile-stats-card {
		display: flex;
		background: #ffffff;
		border: 1px solid #e6ded3;
		border-radius: 12px;
		padding: 0.85rem;
		box-shadow: 0 1px 4px rgba(35, 31, 28, 0.04);
	}
	.stat-mini-col { flex: 1; display: flex; flex-direction: column; gap: 0.2rem; text-align: center; }
	.stat-divider-line { width: 1px; background: #e8dfd3; margin: 0 0.5rem; }
	.sm-lbl { font-size: 0.68rem; color: #7c746a; }
	.sm-val { font-size: 0.95rem; font-weight: 800; font-family: 'Outfit', sans-serif; }

	.btn-install-pwa-sheet {
		background: #ecfdf5;
		border: 1.5px solid #a7f3d0;
		color: #047857;
		font-weight: 700;
		padding: 0.75rem;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		transition: background 0.15s;
	}
	.btn-install-pwa-sheet:active { background: #d1fae5; }
	.installed-pwa-badge {
		background: #f0fdf4;
		border: 1.5px solid #bbf7d0;
		color: #166534;
		font-weight: 600;
		padding: 0.65rem 0.85rem;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-size: 0.82rem;
	}

	.btn-logout-full {
		background: #fff5f5;
		border: 1.5px solid #fed7d7;
		color: #dc2626;
		font-weight: 700;
		padding: 0.75rem;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		font-size: 0.85rem;
		transition: background 0.15s;
	}
	.btn-logout-full:active { background: #fee2e2; }

	/* ====================================================
	   NATIVE BOTTOM SHEET MODAL (WARM UX)
	   ==================================================== */
	.bottom-sheet-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(35, 31, 28, 0.55);
		backdrop-filter: blur(3px);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		z-index: 100;
		animation: fadeIn 0.15s ease;
	}
	.bottom-sheet-sheet {
		background: #ffffff;
		border-top-left-radius: 20px;
		border-top-right-radius: 20px;
		width: 100%;
		max-width: 600px;
		max-height: 88dvh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 -10px 25px rgba(35, 31, 28, 0.15);
		animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
		padding-bottom: env(safe-area-inset-bottom, 8px);
	}
	.sheet-grabber-bar {
		width: 36px;
		height: 4px;
		background: #d5cbbe;
		border-radius: 2px;
		margin: 0.5rem auto 0.25rem;
	}
	.sheet-header {
		padding: 0.65rem 1.1rem;
		border-bottom: 1px solid #eee7db;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.sheet-title { font-size: 1.05rem; font-weight: 700; color: #231f1c; font-family: 'Outfit', sans-serif; }
	.sheet-close-btn { background: transparent; display: flex; align-items: center; justify-content: center; color: #7c746a; padding: 4px; }

	.sheet-body-scroll { padding: 1.1rem; overflow-y: auto; flex: 1; }
	.sheet-form-grid { display: flex; flex-direction: column; gap: 0.65rem; }
	.sheet-field { display: flex; flex-direction: column; gap: 0.25rem; }
	.sheet-field label { font-size: 0.75rem; font-weight: 600; color: #554d42; }
	.native-sheet-input {
		background: #faf7f2;
		border: 1px solid #ded5c8;
		color: #231f1c;
		padding: 0.55rem 0.75rem;
		border-radius: 8px;
		font-size: 0.85rem;
		outline: none;
	}
	.native-sheet-input:focus { border-color: #059669; background: #ffffff; }

	.sheet-divider { border-top: 1px solid #eee7db; padding-top: 0.75rem; }
	.sheet-divider-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
	.sub-sheet-heading { font-size: 0.82rem; font-weight: 700; color: #3b352e; }
	.btn-sheet-mini { background: #faf7f2; border: 1px solid #ded5c8; font-size: 0.72rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 6px; color: #3b352e; }

	.sheet-items-stack { display: flex; flex-direction: column; gap: 0.35rem; }
	.sheet-item-row { display: flex; gap: 0.35rem; align-items: center; }
	.flex-2 { flex: 2; }
	.flex-1 { flex: 1; }
	.btn-sheet-del { background: transparent; color: #dc2626; display: flex; align-items: center; justify-content: center; padding: 0.35rem; }

	.sheet-calc-box {
		background: #faf7f2;
		border: 1px solid #e8dfd3;
		border-radius: 8px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.8rem;
	}
	.calc-line-row { display: flex; justify-content: space-between; color: #7c746a; }
	.calc-inputs-row { display: flex; gap: 0.65rem; }
	.calc-col { flex: 1; display: flex; flex-direction: column; gap: 0.2rem; }
	.calc-col label { font-size: 0.68rem; color: #7c746a; }
	.native-sheet-input-sm { background: #ffffff; border: 1px solid #ded5c8; padding: 0.3rem 0.5rem; border-radius: 6px; font-size: 0.8rem; }
	.calc-grand-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-top: 1px dashed #d5ccbe;
		padding-top: 0.5rem;
	}
	.tot-title { font-weight: 800; font-size: 0.95rem; color: #231f1c; }
	.native-grand-input {
		background: #ffffff;
		border: 1.5px solid #059669;
		font-size: 1rem;
		font-weight: 800;
		padding: 0.3rem 0.5rem;
		border-radius: 6px;
		text-align: right;
		width: 140px;
		color: #231f1c;
	}

	.sheet-sticky-footer {
		padding: 0.75rem 1.1rem;
		border-top: 1px solid #eee7db;
		display: flex;
		gap: 0.5rem;
	}
	.btn-sheet-cancel {
		flex: 1;
		background: #faf7f2;
		border: 1px solid #ded5c8;
		color: #554d42;
		font-weight: 600;
		padding: 0.65rem;
		border-radius: 8px;
		font-size: 0.82rem;
	}
	.btn-sheet-submit {
		flex: 2;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		font-weight: 700;
		padding: 0.65rem;
		border-radius: 8px;
		font-size: 0.85rem;
	}
	.btn-sheet-danger {
		background: #fee2e2;
		color: #b91c1c;
		border: 1px solid #fecaca;
		font-weight: 700;
		padding: 0.65rem 0.85rem;
		border-radius: 8px;
		font-size: 0.82rem;
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	/* DETAIL BOTTOM SHEET */
	.detail-photo-card { margin-bottom: 0.75rem; }
	.detail-img-full { width: 100%; max-height: 250px; object-fit: contain; border-radius: 8px; border: 1px solid #ded5c8; background: #000; }
	.detail-tags-cluster { display: flex; gap: 0.35rem; margin-bottom: 0.35rem; flex-wrap: wrap; }
	.detail-hero-store { font-size: 1.25rem; font-weight: 800; font-family: 'Outfit', sans-serif; color: #231f1c; }
	.detail-hero-time { font-size: 0.75rem; color: #7c746a; margin-bottom: 0.65rem; display: flex; align-items: center; gap: 0.35rem; }
	.detail-callout-note { background: #faf7f2; border-left: 3px solid #059669; padding: 0.5rem 0.75rem; font-size: 0.78rem; font-style: italic; margin-bottom: 0.65rem; color: #433d34; }
	.detail-items-stack { background: #faf7f2; border: 1px solid #e8dfd3; border-radius: 8px; padding: 0.5rem 0.75rem; display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.78rem; }
	.detail-item-line { display: flex; justify-content: space-between; }

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@keyframes slideUp {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}

	/* ====================================================
	   DESKTOP & RESPONSIVE ENHANCEMENTS
	   ==================================================== */

	/* Header inner shell base (mobile first) */
	.header-inner-shell {
		max-width: 900px;
		margin: 0 auto;
		padding: 0.65rem 1rem 0.5rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.45rem 0;
	}
	.header-inner-shell .brand-unit { order: 1; }
	.header-inner-shell .header-actions-cluster { order: 2; }
	.header-inner-shell .header-tier-tabs { order: 3; width: 100%; padding: 0.2rem 0 0; }
	.desktop-user-name { display: none; }

	/* Chat Layout wrapper base */
	.chat-layout-wrapper {
		display: flex;
		flex-direction: column;
		flex: 1;
		width: 100%;
	}
	.chat-desktop-companion {
		display: none;
	}

	/* Report Desktop split base */
	.report-desktop-split {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.report-side-column {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	/* TABLET & DESKTOP (>= 641px) */
	@media (min-width: 641px) {
		.bottom-sheet-backdrop {
			align-items: center;
			justify-content: center;
			padding: 1.5rem;
		}
		.bottom-sheet-sheet {
			border-radius: 20px;
			max-width: 580px;
			max-height: 85vh;
			box-shadow: 0 20px 60px rgba(35, 31, 28, 0.2);
			animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		}
		.sheet-grabber-bar {
			display: none;
		}
	}

	@keyframes modalPop {
		from { opacity: 0; transform: scale(0.96); }
		to { opacity: 1; transform: scale(1); }
	}

	/* FULL DESKTOP (>= 920px) */
	@media (min-width: 920px) {
		.app-mobile-root {
			align-items: stretch;
			width: 100%;
		}

		/* Sleek Unified 1-Tier Desktop Navbar */
		.app-header-modern {
			padding: 0;
			box-shadow: 0 1px 4px rgba(35, 31, 28, 0.05);
		}
		.header-inner-shell {
			max-width: 1320px;
			margin: 0 auto;
			padding: 0.8rem 2rem;
			display: flex;
			flex-wrap: nowrap;
			align-items: center;
			justify-content: space-between;
			gap: 1.5rem;
		}
		.header-inner-shell .brand-unit {
			order: 1;
			flex: 0 0 auto;
		}
		.brand-name-bold {
			font-size: 1.25rem;
		}
		.header-inner-shell .header-tier-tabs {
			order: 2;
			flex: 0 1 auto;
			width: auto;
			padding: 0;
		}
		.modern-segment-bar {
			min-width: 380px;
			padding: 0.25rem;
		}
		.tab-btn {
			padding: 0.5rem 1.1rem;
			font-size: 0.88rem;
		}
		.header-inner-shell .header-actions-cluster {
			order: 3;
			flex: 0 0 auto;
			gap: 0.75rem;
		}

		.btn-action-add {
			padding: 0.45rem 1rem;
			font-size: 0.82rem;
			box-shadow: 0 2px 6px rgba(35, 31, 28, 0.06);
		}
		.btn-action-add:hover {
			background: #f7f3ec;
			border-color: #059669;
		}

		.desktop-user-name {
			display: inline-block;
			font-size: 0.84rem;
			font-weight: 700;
			color: #231f1c;
			max-width: 150px;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.btn-avatar-profile {
			width: auto;
			height: 38px;
			border-radius: 9999px;
			background: #ffffff;
			border: 1.5px solid #ded5c8;
			padding: 0.2rem 0.75rem 0.2rem 0.3rem;
			display: flex;
			align-items: center;
			gap: 0.45rem;
			box-shadow: 0 1px 4px rgba(35, 31, 28, 0.05);
			transition: all 0.15s;
		}
		.btn-avatar-profile:hover {
			border-color: #059669;
			transform: translateY(-1px);
			box-shadow: 0 3px 8px rgba(35, 31, 28, 0.08);
		}
		.btn-avatar-profile .avatar-letter {
			width: 28px;
			height: 28px;
			border-radius: 50%;
			background: linear-gradient(135deg, #059669 0%, #047857 100%);
			color: #ffffff;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 0.82rem;
			font-weight: 800;
		}

		/* Main container expansive desktop width */
		.app-main {
			max-width: 1320px;
			width: 100%;
			margin: 0 auto;
			padding: 1.25rem 2rem 2.5rem;
		}

		/* ALERTS DESKTOP */
		.app-alert {
			max-width: 1320px;
			margin: 0.75rem auto 0;
			padding: 0.75rem 1.25rem;
			border-radius: 12px;
		}

		/* ====================================================
		   DESKTOP CHAT SPLIT VIEW (CHAT + LIVE COMPANION SIDEBAR)
		   ==================================================== */
		.chat-layout-wrapper {
			display: grid;
			grid-template-columns: 1fr 380px;
			gap: 1.35rem;
			height: calc(100vh - 110px);
			min-height: 600px;
		}

		.chat-mobile-container {
			border: 1px solid #ded5c8;
			border-radius: 20px;
			height: 100%;
			overflow: hidden;
			box-shadow: 0 4px 24px rgba(35, 31, 28, 0.06);
		}

		.chat-stream-viewport {
			padding: 1.5rem 2rem;
		}

		.msg-card {
			max-width: 680px;
			font-size: 0.94rem;
			line-height: 1.5;
		}

		.chat-bottom-dock {
			padding: 0.85rem 1.5rem;
			background: #faf6f0;
			border-top: 1px solid #e2dacd;
		}
		.dock-form-row {
			gap: 0.75rem;
		}
		.input-dock-text {
			font-size: 0.94rem;
			padding: 0.75rem 1rem;
		}
		.btn-dock-send {
			width: 44px;
			height: 44px;
			border-radius: 12px;
		}
		.btn-dock-attach {
			width: 44px;
			height: 44px;
			border-radius: 12px;
		}

		/* Companion Sidebar Styles */
		.chat-desktop-companion {
			display: flex;
			flex-direction: column;
			gap: 1rem;
			height: 100%;
			overflow-y: auto;
			padding-right: 4px;
		}

		.companion-card {
			background: #ffffff;
			border: 1px solid #ded5c8;
			border-radius: 18px;
			padding: 1.2rem;
			box-shadow: 0 2px 10px rgba(35, 31, 28, 0.04);
			display: flex;
			flex-direction: column;
			gap: 0.85rem;
		}

		.companion-card-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
		}
		.c-head-title-row {
			display: flex;
			align-items: center;
			gap: 0.45rem;
			color: #231f1c;
			font-family: 'Outfit', sans-serif;
			font-weight: 700;
			font-size: 0.95rem;
		}
		.c-head-title-row svg {
			color: #059669;
		}
		.companion-period-pill {
			font-size: 0.72rem;
			font-weight: 700;
			background: #eae3d6;
			color: #554d42;
			padding: 0.15rem 0.55rem;
			border-radius: 9999px;
		}
		.companion-switch-pill {
			display: flex;
			background: #eae3d6;
			padding: 0.15rem;
			border-radius: 9999px;
			border: 1px solid #ddd5c7;
		}
		.c-switch-btn {
			background: transparent;
			border: none;
			color: #6d6459;
			font-size: 0.7rem;
			font-weight: 700;
			padding: 0.2rem 0.55rem;
			border-radius: 9999px;
			cursor: pointer;
			transition: all 0.15s;
		}
		.c-switch-btn.active {
			background: #ffffff;
			color: #231f1c;
			box-shadow: 0 1px 3px rgba(35, 31, 28, 0.08);
		}
		.companion-period-info-row {
			display: flex;
			justify-content: space-between;
			align-items: center;
			font-size: 0.72rem;
			color: #7c746a;
		}
		.c-period-text {
			font-weight: 600;
		}
		.companion-count-pill {
			background: #f4eee4;
			border: 1px solid #e6ded3;
			padding: 0.15rem 0.45rem;
			border-radius: 9999px;
			font-weight: 700;
			font-size: 0.68rem;
			color: #554d42;
		}
		.companion-link-btn {
			margin-top: 0.25rem;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.35rem;
			background: #fdfbf7;
			border: 1px dashed #ded5c8;
			color: #059669;
			font-size: 0.78rem;
			font-weight: 700;
			padding: 0.45rem 0.75rem;
			border-radius: 10px;
			cursor: pointer;
			transition: all 0.15s;
		}
		.companion-link-btn:hover {
			background: #ecfdf5;
			border-color: #a7f3d0;
			border-style: solid;
		}

		.companion-stats-grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0.65rem;
		}
		.cstat-item {
			background: #faf7f2;
			border: 1px solid #eee7db;
			border-radius: 12px;
			padding: 0.65rem 0.75rem;
			display: flex;
			flex-direction: column;
			gap: 0.2rem;
		}
		.cstat-label {
			font-size: 0.72rem;
			color: #7c746a;
			font-weight: 600;
		}
		.cstat-val {
			font-size: 0.98rem;
			font-weight: 800;
		}

		.companion-net-row {
			display: flex;
			justify-content: space-between;
			align-items: center;
			background: #faf7f2;
			border: 1px solid #eee7db;
			border-radius: 12px;
			padding: 0.75rem 0.9rem;
		}
		.cstat-net-lbl {
			font-size: 0.82rem;
			font-weight: 700;
			color: #433d34;
		}
		.cstat-net-val {
			font-size: 1.15rem;
			font-weight: 800;
			font-family: 'Outfit', sans-serif;
		}

		.companion-today-row {
			display: flex;
			justify-content: space-between;
			align-items: center;
			font-size: 0.78rem;
			color: #7c746a;
			border-top: 1px dashed #ded5c8;
			padding-top: 0.65rem;
		}

		.companion-tx-list {
			display: flex;
			flex-direction: column;
			gap: 0.45rem;
		}
		.companion-tx-item {
			display: flex;
			align-items: center;
			gap: 0.65rem;
			padding: 0.6rem 0.75rem;
			background: #faf7f2;
			border: 1px solid #eee7db;
			border-radius: 12px;
			cursor: pointer;
			transition: all 0.15s;
		}
		.companion-tx-item:hover {
			background: #ffffff;
			border-color: #059669;
			transform: translateX(3px);
			box-shadow: 0 3px 8px rgba(35, 31, 28, 0.06);
		}
		.ctx-icon {
			width: 28px;
			height: 28px;
			border-radius: 8px;
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
		}
		.ctx-body {
			flex: 1;
			display: flex;
			flex-direction: column;
			min-width: 0;
		}
		.ctx-title {
			font-size: 0.82rem;
			font-weight: 700;
			color: #231f1c;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.ctx-meta {
			font-size: 0.7rem;
			color: #7c746a;
		}
		.ctx-amt {
			font-size: 0.84rem;
			font-weight: 800;
			white-space: nowrap;
		}
		
		.companion-empty {
			font-size: 0.82rem;
			color: #7c746a;
			text-align: center;
			padding: 0.85rem;
		}

		.tips-card {
			background: #fdfbf7;
			border-color: #e5ded2;
		}
		.companion-tips-body {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			font-size: 0.78rem;
		}
		.tip-line {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}
		.tip-kbd {
			background: #eae3d6;
			font-size: 0.68rem;
			font-weight: 700;
			padding: 0.15rem 0.45rem;
			border-radius: 6px;
			color: #433d34;
			flex-shrink: 0;
		}
		.tip-text {
			color: #554d42;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		/* ====================================================
		   DESKTOP REPORT & REKAP EXPERIENCE
		   ==================================================== */
		.report-mobile-container {
			gap: 1.25rem;
		}

		.report-header-card {
			display: flex;
			flex-direction: column;
			gap: 0.85rem;
			padding: 1.1rem 1.4rem;
			border-radius: 16px;
		}
		.period-picker-row {
			margin-bottom: 0;
			max-width: 480px;
		}
		.sub-segments-row {
			width: 100%;
			max-width: 680px;
		}
		.custom-period-control-box {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
			gap: 1rem;
		}
		.custom-period-dates {
			flex-wrap: nowrap;
			flex: 1;
			max-width: 520px;
		}
		.week-chart-grid {
			gap: 0.65rem;
			padding: 0.75rem 0.25rem 0.25rem;
		}
		.wdc-bar-track {
			width: 18px;
			height: 120px;
		}
		.week-day-card {
			padding: 0.75rem 0.5rem 0.6rem;
		}
		.wdc-nominal {
			font-size: 0.72rem;
		}

		/* 4 KPI Cards: Horizontal 4-Column Strip */
		.kpi-mobile-2x2 {
			grid-template-columns: repeat(4, 1fr);
			gap: 1.25rem;
		}
		.mobile-kpi-item {
			padding: 1.25rem;
			border-radius: 16px;
			box-shadow: 0 2px 8px rgba(35, 31, 28, 0.04);
			transition: transform 0.15s, box-shadow 0.15s;
		}
		.mobile-kpi-item:hover {
			transform: translateY(-2px);
			box-shadow: 0 6px 16px rgba(35, 31, 28, 0.08);
		}
		.kpi-num {
			font-size: 1.45rem;
		}

		/* Report Desktop Split 2-Column Dashboard */
		.report-desktop-split {
			display: grid;
			grid-template-columns: 1.25fr 1fr;
			gap: 1.25rem;
			align-items: start;
		}
		.report-side-column {
			display: flex;
			flex-direction: column;
			gap: 1.25rem;
		}

		.card-mobile-panel {
			border-radius: 18px;
			padding: 1.35rem 1.6rem;
			box-shadow: 0 2px 8px rgba(35, 31, 28, 0.04);
		}
		.chart-mobile-scroll {
			height: 220px;
			padding: 1.25rem 0.5rem 0.5rem;
		}
		.touch-bar-track {
			width: 22px;
			border-radius: 6px;
		}

		/* Search and filter controls on desktop */
		.search-and-export {
			display: flex;
			gap: 0.85rem;
			align-items: center;
		}
		.mobile-search-bar {
			flex: 1;
		}
		.mobile-filter-pills {
			display: flex;
			gap: 0.85rem;
		}
		.native-filter-select {
			flex: 1;
			max-width: 220px;
		}

		/* Transaction card multi-column grid on desktop */
		.mobile-cards-stream {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
			gap: 0.85rem;
		}
		.mobile-tx-entry {
			border-radius: 14px;
			transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
		}
		.mobile-tx-entry:hover {
			transform: translateY(-2px);
			box-shadow: 0 4px 14px rgba(35, 31, 28, 0.07);
			border-color: #059669;
		}
	}


	/* Admin Header Button */
	.btn-admin-header-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: #fae8ff;
		color: #86198f;
		border: 1.5px solid #f0abfc;
		padding: 0.4rem 0.75rem;
		border-radius: 20px;
		text-decoration: none;
		font-size: 0.76rem;
		font-weight: 800;
		transition: all 0.15s;
		box-shadow: 0 1px 3px rgba(134, 25, 143, 0.1);
	}
	.btn-admin-header-link:hover {
		background: #f5d0fe;
		transform: translateY(-1px);
	}
	.admin-crown-icon {
		font-size: 0.85rem;
	}

	/* Admin Profile Menu Item */
	.btn-admin-profile-menu {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.85rem 1rem;
		background: #fae8ff;
		border: 1.5px solid #f0abfc;
		border-radius: 12px;
		text-decoration: none;
		color: #86198f;
		margin-bottom: 0.65rem;
		transition: all 0.15s;
	}
	.btn-admin-profile-menu:hover {
		background: #f5d0fe;
	}
	.adm-menu-left {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}
	.adm-crown-badge {
		font-size: 1.35rem;
	}
	.adm-menu-text {
		display: flex;
		flex-direction: column;
		line-height: 1.3;
	}
	.adm-menu-text strong {
		font-size: 0.84rem;
		font-weight: 800;
		color: #701a75;
	}
	.adm-menu-text span {
		font-size: 0.74rem;
		color: #a21caf;
	}
	.adm-arrow-right {
		font-size: 1.1rem;
		font-weight: 800;
	}

	/* WA Pro Button */
	.btn-plan-pro-wa {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		box-shadow: 0 4px 12px rgba(5, 150, 105, 0.35);
		text-decoration: none;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-radius: 10px;
		font-weight: 800;
		font-size: 0.82rem;
		text-align: center;
		transition: all 0.15s;
	}
	.btn-plan-pro-wa:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 16px rgba(5, 150, 105, 0.45);
		color: #ffffff;
	}
	.admin-quick-dev-box {
		margin-top: 0.4rem;
		text-align: center;
	}
	.btn-admin-instant-act {
		background: none;
		border: 1px dashed #d97706;
		color: #b45309;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.3rem 0.6rem;
		border-radius: 6px;
		cursor: pointer;
		width: 100%;
	}
	.btn-admin-instant-act:hover {
		background: #fffbeb;
	}

</style>