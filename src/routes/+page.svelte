<script>
	import { onMount, tick } from "svelte";

	// AUTH STATE
	let currentUser = $state(null);
	let authChecking = $state(true);
	let authMode = $state("login"); // 'login' | 'register'
	let landingDemoTab = $state("voice"); // 'voice' | 'scan' | 'dompet' | 'report'

	// SEO & FAQ ACCORDION STATE
	let activeFaq = $state(0);
	const faqList = [
		{
			q: "Bagaimana cara kerja CatatAi mencatat keuangan secara otomatis?",
			badge: "Teknologi AI",
			a: "CatatAi menggunakan kecerdasan buatan (AI) terdepan untuk mengenali teks, suara (voice note), dan foto struk belanja. Cukup berbicara atau memotret struk, AI CatatAi akan otomatis mengekstrak nominal, tanggal, kategori, dan memotong saldo dari dompet yang sesuai dalam hitungan detik."
		},
		{
			q: "Apakah bisa scan struk belanja atau nota kasir fisik?",
			badge: "OCR Vision",
			a: "Ya, sangat bisa! Cukup unggah atau foto struk belanja dari Indomaret, Alfamart, SPBU, restoran, atau nota toko lainnya. AI Vision CatatAi membaca total harga, rincian barang, serta tanggal transaksi secara akurat dan menyimpannya langsung ke pembukuan Anda."
		},
		{
			q: "Bagaimana cara mencatat pengeluaran menggunakan suara (voice note)?",
			badge: "Voice Note",
			a: "Tekan tombol mikrofon di CatatAi, lalu ucapkan transaksi santai dalam bahasa Indonesia, contoh: 'Beli kopi 25 ribu bayar pakai QRIS BCA'. AI kami langsung menganalisis ucapan, menentukan dompet BCA, memasukkan kategori Makanan & Minuman, dan merekam nominalnya secara instan."
		},
		{
			q: "Bisa mengelola berapa banyak dompet atau rekening bank?",
			badge: "Multi-Dompet",
			a: "Anda bisa membuat dompet tanpa batas. Kelola uang Tunai, Rekening Bank (BCA, Mandiri, BRI, BNI), hingga Dompet Digital (GoPay, OVO, ShopeePay, DANA). Saldo tiap dompet akan terupdate secara real-time setiap kali ada transaksi masuk atau keluar."
		},
		{
			q: "Apakah data keuangan pribadi saya aman dan terenkripsi?",
			badge: "Privasi Terjamin",
			a: "Keamanan Anda adalah prioritas no. 1. CatatAi menerapkan enkripsi data bank-grade, isolasi data per akun dengan otentikasi JWT/bcrypt aman, serta infrastruktur Neon Serverless PostgreSQL dengan pencadangan teratur. Data Anda 100% pribadi dan tidak pernah dijual ke pihak ketiga."
		},
		{
			q: "Apakah aplikasi CatatAi gratis digunakan?",
			badge: "100% Gratis",
			a: "Ya! CatatAi dapat digunakan sepenuhnya gratis untuk kebutuhan pencatatan keuangan pribadi maupun pembukuan usaha mikro (UMKM) sehari-hari tanpa biaya tersembunyi."
		}
	];

	const structuredDataJson = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "WebApplication",
				"@id": "https://catatai.com/#webapp",
				"name": "CatatAi",
				"url": "https://catatai.com",
				"description": "Aplikasi pencatatan keuangan cerdas no. 1 di Indonesia dengan AI voice note, scan struk nota belanja otomatis, dan manajemen multi-dompet.",
				"applicationCategory": "FinanceApplication",
				"operatingSystem": "All (Web, Android, iOS, Windows, macOS)",
				"browserRequirements": "Requires JavaScript. Requires HTML5.",
				"inLanguage": "id-ID",
				"offers": {
					"@type": "Offer",
					"price": "0",
					"priceCurrency": "IDR"
				},
				"aggregateRating": {
					"@type": "AggregateRating",
					"ratingValue": "4.9",
					"ratingCount": "1280",
					"bestRating": "5",
					"worstRating": "1"
				},
				"featureList": [
					"Catat pengeluaran lewat Voice Note suara otomatis",
					"Scan & ekstrak struk nota belanja cerdas (AI Vision OCR)",
					"Manajemen Multi-Dompet (Bank, e-Wallet, Uang Kas/Tunai)",
					"Analisis grafik arus kas 7 hari & laporan bulanan",
					"Keamanan enkripsi bank-grade dengan isolasi data akun"
				]
			},
			{
				"@type": "Organization",
				"@id": "https://catatai.com/#organization",
				"name": "CatatAi",
				"url": "https://catatai.com",
				"logo": {
					"@type": "ImageObject",
					"url": "https://catatai.com/icon-512.png"
				}
			},
			{
				"@type": "FAQPage",
				"@id": "https://catatai.com/#faq",
				"mainEntity": faqList.map((item) => ({
					"@type": "Question",
					"name": item.q,
					"acceptedAnswer": {
						"@type": "Answer",
						"text": item.a
					}
				}))
			}
		]
	};
	let authForm = $state({ email: "", nama: "", password: "" });
	let authLoading = $state(false);
	let authError = $state("");
	let showPassword = $state(false);

	// PROFILE MODAL
	let showProfileModal = $state(false);

	// PWA INSTALL STATE
	let deferredInstallPrompt = $state(null);
	let canInstallPWA = $state(false);
	let isAppStandalone = $state(false);
	let showInstallBanner = $state(false);
	let showIosInstallGuide = $state(false);
	let isIosDevice = $state(false);

	// Navigasi Utama: Hanya 2 Tombol ('chat' | 'report')
	let activeView = $state("chat"); // 'chat' (default) | 'report'
	let reportSubTab = $state("bulanan"); // 'bulanan' | 'mingguan' | 'periode' | 'harian' | 'semua'

	let loading = $state(false);
	let errorMsg = $state("");
	let successMsg = $state("");

	// Filter Periode
	const now = new Date();
	const pad = (n) => String(n).padStart(2, "0");
	let selectedBulan = $state(
		`${now.getFullYear()}-${pad(now.getMonth() + 1)}`,
	);
	let selectedTanggal = $state(
		`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
	);

	// Filter Periode Mingguan (Senin s/d Minggu)
	let selectedWeekDate = $state(
		`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
	);

	function getWeekRange(dateStr) {
		const base = new Date(
			(dateStr ||
				`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`) +
				"T00:00:00",
		);
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
	let customStartDate = $state(
		`${sevenDaysAgo.getFullYear()}-${pad(sevenDaysAgo.getMonth() + 1)}-${pad(sevenDaysAgo.getDate())}`,
	);
	let customEndDate = $state(
		`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
	);

	function calculateDayDiff(start, end) {
		if (!start || !end) return 1;
		const d1 = new Date(start + "T00:00:00");
		const d2 = new Date(end + "T00:00:00");
		const diff =
			Math.round(Math.abs((d2 - d1) / (1000 * 60 * 60 * 24))) + 1;
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
			start_date: "",
			end_date: "",
		},
	});

	// CHAT STATE (Mobile-First WA Style)
	let chatInput = $state("");
	let chatAttachedImage = $state(null);
	let chatLoading = $state(false);
	let chatMessagesContainer = $state(null);
	let currentActiveDraft = $state(null);
	let showUpgradeModal = $state(false);
	let upgradeLoading = $state(false);

	// VOICE INPUT & RECORDING STATE
	let isRecordingVoice = $state(false);
	let voiceRecordSeconds = $state(0);
	let voiceTimerInterval = null;
	let speechRecognitionInstance = null;

	function formatDuration(sec) {
		const m = Math.floor(sec / 60);
		const s = sec % 60;
		return `${m}:${s < 10 ? "0" : ""}${s}`;
	}

	function startVoiceRecording() {
		if (
			chatLoading ||
			(currentUser?.tier !== "pro" && (currentUser?.sisa_kuota ?? 5) <= 0)
		) {
			return;
		}

		if (typeof window === "undefined") return;
		const SpeechRecognition =
			window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!SpeechRecognition) {
			errorMsg =
				"Browser ini belum mendukung Speech Recognition. Silakan gunakan Google Chrome atau Safari untuk merekam suara.";
			setTimeout(() => {
				errorMsg = "";
			}, 5000);
			return;
		}

		try {
			speechRecognitionInstance = new SpeechRecognition();
			speechRecognitionInstance.lang = "id-ID";
			speechRecognitionInstance.continuous = true;
			speechRecognitionInstance.interimResults = true;

			let finalTranscript = "";

			speechRecognitionInstance.onstart = () => {
				isRecordingVoice = true;
				voiceRecordSeconds = 0;
				chatInput = "";
				if (voiceTimerInterval) clearInterval(voiceTimerInterval);
				voiceTimerInterval = setInterval(() => {
					voiceRecordSeconds += 1;
				}, 1000);
			};

			speechRecognitionInstance.onresult = (event) => {
				let interimTranscript = "";
				for (let i = event.resultIndex; i < event.results.length; ++i) {
					if (event.results[i].isFinal) {
						finalTranscript += event.results[i][0].transcript + " ";
					} else {
						interimTranscript += event.results[i][0].transcript;
					}
				}
				const currentSpeech = (
					finalTranscript + interimTranscript
				).trim();
				if (currentSpeech) {
					chatInput = currentSpeech;
				}
			};

			speechRecognitionInstance.onerror = (event) => {
				console.error("Speech recognition error:", event.error);
				if (event.error === "not-allowed") {
					errorMsg =
						"Izin mikrofon belum diberikan. Silakan izinkan akses mikrofon di browser Anda.";
				} else if (event.error !== "no-speech") {
					errorMsg = `Gagal merekam suara: ${event.error}`;
				}
				setTimeout(() => {
					errorMsg = "";
				}, 4500);
				stopVoiceRecording(false);
			};

			speechRecognitionInstance.onend = () => {
				if (isRecordingVoice) {
					stopVoiceRecording(true);
				}
			};

			speechRecognitionInstance.start();
		} catch (err) {
			console.error("Error starting speech recognition:", err);
			errorMsg = "Gagal memulai rekaman suara: " + err.message;
			setTimeout(() => {
				errorMsg = "";
			}, 4500);
			stopVoiceRecording(false);
		}
	}

	function stopVoiceRecording(autoSend = false) {
		if (voiceTimerInterval) {
			clearInterval(voiceTimerInterval);
			voiceTimerInterval = null;
		}
		if (speechRecognitionInstance) {
			const inst = speechRecognitionInstance;
			speechRecognitionInstance = null;
			try {
				inst.stop();
			} catch (e) {}
		}
		isRecordingVoice = false;

		if (autoSend && chatInput.trim()) {
			sendChatMessage(null, true);
		}
	}

	function cancelVoiceRecording() {
		if (voiceTimerInterval) {
			clearInterval(voiceTimerInterval);
			voiceTimerInterval = null;
		}
		if (speechRecognitionInstance) {
			const inst = speechRecognitionInstance;
			speechRecognitionInstance = null;
			try {
				inst.abort();
			} catch (e) {}
		}
		isRecordingVoice = false;
		chatInput = "";
	}

	async function toggleProTier(targetTier = null) {
		upgradeLoading = true;
		try {
			const res = await fetch("/api/user/upgrade-pro", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ tier: targetTier }),
			});
			const data = await res.json();
			if (!res.ok)
				throw new Error(data.error || "Gagal mengubah status paket");

			if (currentUser) {
				currentUser.tier = data.tier;
				currentUser.is_pro = data.is_pro;
				currentUser.sisa_kuota = data.is_pro
					? 999999
					: Math.max(0, 5 - (currentUser.chat_count_today || 0));
			}

			successMsg = data.message;
			showUpgradeModal = false;
			setTimeout(() => {
				successMsg = "";
			}, 4500);
		} catch (err) {
			errorMsg = err.message;
		} finally {
			upgradeLoading = false;
		}
	}

	let chatMessages = $state([]);

	// CHAT PERSISTENCE (Agar riwayat obrolan hari ini tidak hilang saat di-refresh)
	function getChatStorageKey() {
		const uid = currentUser?.id || "anon";
		const today = getTodayDateString();
		return `catatai_chat_history_v4_${uid}_${today}`;
	}

	function saveChatHistory() {
		if (typeof window === "undefined") return;
		try {
			const key = getChatStorageKey();
			const payload = {
				date: getTodayDateString(),
				userId: currentUser?.id,
				messages: chatMessages,
				draft: currentActiveDraft,
			};
			localStorage.setItem(key, JSON.stringify(payload));
		} catch (e) {
			console.warn("Gagal menyimpan riwayat chat ke localStorage:", e);
		}
	}

	function loadChatHistory() {
		if (typeof window === "undefined") return false;
		try {
			const key = getChatStorageKey();
			const raw = localStorage.getItem(key);
			if (!raw) return false;
			const parsed = JSON.parse(raw);
			if (
				parsed &&
				Array.isArray(parsed.messages) &&
				parsed.messages.length > 0
			) {
				if (parsed.date === getTodayDateString()) {
					chatMessages = parsed.messages;
					currentActiveDraft = parsed.draft || null;
					setTimeout(scrollToBottom, 60);
					return true;
				}
			}
		} catch (e) {
			console.warn("Gagal memuat riwayat chat dari localStorage:", e);
		}
		return false;
	}

	function initChatMessages(userName = "") {
		// 1. Coba pulihkan riwayat percakapan hari ini dari storage
		const restored = loadChatHistory();
		if (restored) {
			return; // Riwayat chat hari ini berhasil dipulihkan apa adanya!
		}

		// 2. Jika hari ini belum pernah ada percakapan, buat salam pembuka hari ini
		todayTanggal = getTodayDateString();
		const name = userName || currentUser?.nama || "";
		const isToday = (txDate) => {
			if (!txDate) return false;
			return String(txDate).slice(0, 10) === todayTanggal;
		};
		const todayTx = transaksiList.filter((t) => isToday(t.tanggal));

		const historyMessages = [];

		if (todayTx.length === 0) {
			historyMessages.push({
				id: "today-empty-greeting",
				role: "assistant",
				content: `Halo${name ? ", " + name : ""}! 👋

Belum ada transaksi yang dicatat hari ini (${formatTglHari(todayTanggal)}).

Ada pengeluaran atau pemasukan baru?
Ketik misalnya:
• "beli kopi 18k"
• "makan siang 35rb pake qris"
• "gaji bulanan masuk 10jt"

Atau tekan ikon kamera di bawah untuk mengirim foto nota/struk belanja 📸`,
				time: `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`,
			});
		} else {
			const totalKeluar = todayTx
				.filter((t) => t.tipe === "pengeluaran")
				.reduce((acc, curr) => acc + Number(curr.total), 0);
			const totalMasuk = todayTx
				.filter((t) => t.tipe === "pemasukan")
				.reduce((acc, curr) => acc + Number(curr.total), 0);

			let summaryText = `Halo${name ? ", " + name : ""}! 👋 Berikut catatan riwayat transaksi kamu hari ini (${formatTglHari(todayTanggal)}):`;
			summaryText += `\n• Pengeluaran: ${formatRupiah(totalKeluar)} (${todayTx.filter((t) => t.tipe === "pengeluaran").length} transaksi)`;
			if (totalMasuk > 0) {
				summaryText += `\n• Pemasukan: ${formatRupiah(totalMasuk)}`;
			}

			historyMessages.push({
				id: "today-summary-greeting",
				role: "assistant",
				content: summaryText,
				time:
					todayTx[0].waktu?.slice(0, 5) ||
					`${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`,
			});

			for (const t of todayTx) {
				historyMessages.push({
					id: `tx-card-${t.id}`,
					role: "assistant",
					isTxCard: true,
					txData: t,
					content: `Transaksi tercatat: ${t.toko || (t.tipe === "pemasukan" ? "Pemasukan" : "Pengeluaran")} sebesar ${formatRupiah(t.total)} (${t.kategori})`,
					time:
						t.waktu?.slice(0, 5) ||
						`${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`,
				});
			}

			historyMessages.push({
				id: "today-ready-next",
				role: "assistant",
				content:
					"Ada transaksi lain yang ingin dicatat hari ini? Ketik pengeluaranmu atau unggah foto nota.",
				time: `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`,
			});
		}

		chatMessages = historyMessages;
		saveChatHistory();
		setTimeout(scrollToBottom, 60);
	}

	function resetTodayChat() {
		if (!confirm("Bersihkan percakapan chat hari ini dan mulai sesi baru?"))
			return;
		try {
			localStorage.removeItem(getChatStorageKey());
		} catch {}
		chatMessages = [];
		currentActiveDraft = null;
		initChatMessages();
	}

	// Filter Report
	let filterTipe = $state("");
	let filterKategori = $state("");
	let searchQuery = $state("");

	// Modal Manual / Edit
	let showModalTambah = $state(false);
	let modeInput = $state("manual");
	let isEditingTransaksi = $state(false);
	let editingTransaksiId = $state(null);

	// Form Transaksi Manual / Edit
	let form = $state({
		tipe: "pengeluaran",
		toko: "",
		tanggal: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
		waktu: `${pad(now.getHours())}:${pad(now.getMinutes())}:00`,
		kategori: "Makanan & Minuman",
		metode_bayar: "Tunai",
		dompet: "Tunai",
		dompet_id: null,
		subtotal: 0,
		pajak: 0,
		diskon: 0,
		total: 0,
		catatan: "",
		gambar_url: "",
		items: [],
	});

	// MULTI-DOMPET STATE
	let dompetList = $state([]);
	let totalSaldoDompet = $state(0);
	let selectedDompetFilter = $state(null); // null = semua, number = dompet.id
	let isDompetSheetOpen = $state(false);
	let isEditingDompet = $state(false);
	let dompetForm = $state({
		id: null,
		nama: "",
		tipe: "bank",
		saldo_awal: 0,
		warna: "#2563eb",
		ikon: "bank",
		nomor_rekening: "",
		catatan: "",
	});
	let isTransferSheetOpen = $state(false);
	let transferForm = $state({
		dari_dompet_id: null,
		ke_dompet_id: null,
		nominal: 0,
		tanggal: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
		catatan: "",
	});
	let transferLoading = $state(false);
	let dompetLoading = $state(false);

	const DOMPET_WARNA_PRESETS = [
		{ name: "Navy Blue", hex: "#2563eb" },
		{ name: "Emerald", hex: "#059669" },
		{ name: "Purple", hex: "#7c3aed" },
		{ name: "Warm Amber", hex: "#d97706" },
		{ name: "Crimson", hex: "#dc2626" },
		{ name: "Ocean Cyan", hex: "#0891b2" },
		{ name: "Dark Slate", hex: "#334155" },
	];

	function getDompetIcon(tipe) {
		if (tipe === "cash") return "💵";
		if (tipe === "ewallet") return "📱";
		if (tipe === "bank") return "🏦";
		return "💳";
	}

	async function loadDompet() {
		if (!currentUser) return;
		try {
			const res = await fetch("/api/dompet");
			const data = await res.json();
			if (res.ok && data.dompet) {
				dompetList = data.dompet;
				totalSaldoDompet = data.total_saldo || 0;
			}
		} catch (err) {
			console.error("Error loadDompet:", err);
		}
	}

	function openCreateDompet() {
		isEditingDompet = false;
		dompetForm = {
			id: null,
			nama: "",
			tipe: "bank",
			saldo_awal: 0,
			warna: "#2563eb",
			ikon: "bank",
			nomor_rekening: "",
			catatan: "",
		};
		isDompetSheetOpen = true;
	}

	function openEditDompet(d) {
		isEditingDompet = true;
		dompetForm = {
			id: d.id,
			nama: d.nama,
			tipe: d.tipe || "bank",
			saldo_awal: d.saldo_awal || 0,
			warna: d.warna || "#2563eb",
			ikon: d.ikon || "bank",
			nomor_rekening: d.nomor_rekening || "",
			catatan: d.catatan || "",
		};
		isDompetSheetOpen = true;
	}

	async function handleSaveDompet() {
		if (!dompetForm.nama.trim()) {
			errorMsg = "Nama dompet wajib diisi";
			return;
		}
		dompetLoading = true;
		errorMsg = "";
		try {
			const url = isEditingDompet
				? `/api/dompet/${dompetForm.id}`
				: "/api/dompet";
			const method = isEditingDompet ? "PUT" : "POST";
			const res = await fetch(url, {
				method,
				headers: { "content-type": "application/json" },
				body: JSON.stringify(dompetForm),
			});
			const data = await res.json();
			if (!res.ok)
				throw new Error(data.error || "Gagal menyimpan dompet");
			successMsg = isEditingDompet
				? "Dompet berhasil diperbarui!"
				: "Dompet baru berhasil ditambahkan!";
			setTimeout(() => {
				successMsg = "";
			}, 3500);
			isDompetSheetOpen = false;
			await loadDompet();
			await loadData();
		} catch (err) {
			errorMsg = err.message;
		} finally {
			dompetLoading = false;
		}
	}

	async function handleDeleteDompet(id) {
		if (
			!confirm(
				"Yakin ingin menghapus dompet ini? Catatan transaksi yang sudah ada tidak akan terhapus.",
			)
		)
			return;
		try {
			const res = await fetch(`/api/dompet/${id}`, { method: "DELETE" });
			const data = await res.json();
			if (!res.ok)
				throw new Error(data.error || "Gagal menghapus dompet");
			if (selectedDompetFilter === id) selectedDompetFilter = null;
			successMsg = "Dompet berhasil dihapus";
			setTimeout(() => {
				successMsg = "";
			}, 3500);
			isDompetSheetOpen = false;
			await loadDompet();
			await loadData();
		} catch (err) {
			errorMsg = err.message;
		}
	}

	function openTransferModal(fromId = null) {
		const firstId = fromId || (dompetList[0]?.id ?? null);
		const otherId =
			dompetList.find((d) => d.id !== firstId)?.id ??
			dompetList[1]?.id ??
			null;
		transferForm = {
			dari_dompet_id: firstId,
			ke_dompet_id: otherId,
			nominal: 0,
			tanggal: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
			catatan: "",
		};
		isTransferSheetOpen = true;
	}

	async function handleTransferSubmit() {
		if (!transferForm.dari_dompet_id || !transferForm.ke_dompet_id) {
			errorMsg = "Pilih dompet asal dan tujuan transfer";
			return;
		}
		if (
			Number(transferForm.dari_dompet_id) ===
			Number(transferForm.ke_dompet_id)
		) {
			errorMsg = "Dompet asal dan tujuan tidak boleh sama";
			return;
		}
		if (!transferForm.nominal || Number(transferForm.nominal) <= 0) {
			errorMsg = "Nominal transfer harus lebih dari 0";
			return;
		}

		transferLoading = true;
		errorMsg = "";
		try {
			const res = await fetch("/api/dompet/transfer", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(transferForm),
			});
			const data = await res.json();
			if (!res.ok)
				throw new Error(data.error || "Gagal memproses transfer");
			successMsg = data.message || "Transfer antar dompet berhasil!";
			setTimeout(() => {
				successMsg = "";
			}, 3500);
			isTransferSheetOpen = false;
			await loadDompet();
			await loadData();
		} catch (err) {
			errorMsg = err.message;
		} finally {
			transferLoading = false;
		}
	}

	function selectDompetFilter(id) {
		selectedDompetFilter = selectedDompetFilter === id ? null : id;
		loadData();
	}

	// Modal Detail
	let showModalDetail = $state(false);
	let detailData = $state(null);
	let detailLoading = $state(false);

	const KATEGORI_OPTIONS = [
		"Makanan & Minuman",
		"Belanja Harian",
		"Bahan Baku",
		"Operasional",
		"Transportasi",
		"Utilitas & Tagihan",
		"Elektronik & Alat",
		"Gaji & Upah",
		"Penjualan Produk",
		"Lainnya",
	];

	const METODE_OPTIONS = [
		"Tunai",
		"QRIS",
		"Transfer",
		"Kartu Debit",
		"Kartu Kredit",
	];

	function formatRupiah(num) {
		return new Intl.NumberFormat("id-ID", {
			style: "currency",
			currency: "IDR",
			maximumFractionDigits: 0,
		}).format(num || 0);
	}

	function formatRingkas(num) {
		if (!num && num !== 0) return "Rp 0";
		const abs = Math.abs(num);
		const sign = num < 0 ? "-" : "";
		if (abs >= 1_000_000_000) {
			return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
		}
		if (abs >= 1_000_000) {
			return `${sign}Rp ${(abs / 1_000_000).toFixed(1).replace(".", ",")} Jt`;
		}
		if (abs >= 1_000) {
			return `${sign}Rp ${(abs / 1_000).toFixed(0)} Rb`;
		}
		return formatRupiah(num);
	}

	function formatTglHari(str) {
		if (!str) return "-";
		const d = new Date(str + "T00:00:00");
		return d.toLocaleDateString("id-ID", {
			weekday: "long",
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	}

	function formatTgl(str) {
		if (!str) return "-";
		const d = new Date(str + "T00:00:00");
		return d.toLocaleDateString("id-ID", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	}

	// AUTH ACTIONS
	async function checkAuth() {
		authChecking = true;
		try {
			const res = await fetch("/api/auth/me");
			const data = await res.json();
			if (data.user) {
				currentUser = data.user;
				initChatMessages(data.user.nama);
				await loadDompet();
				await loadData();
			} else {
				currentUser = null;
			}
		} catch (err) {
			console.error("Error checkAuth:", err);
			currentUser = null;
		} finally {
			authChecking = false;
		}
	}

	async function handleAuthSubmit() {
		authError = "";
		authLoading = true;

		try {
			const endpoint =
				authMode === "register"
					? "/api/auth/register"
					: "/api/auth/login";
			const res = await fetch(endpoint, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(authForm),
			});

			const data = await res.json();
			if (!res.ok)
				throw new Error(data.error || "Terjadi kesalahan autentikasi");

			currentUser = data.user;
			authForm = { email: "", nama: "", password: "" };
			initChatMessages(data.user.nama);
			await loadDompet();
			await loadData();
		} catch (err) {
			authError = err.message;
		} finally {
			authLoading = false;
		}
	}

	async function handleLogout() {
		try {
			await fetch("/api/auth/logout", { method: "POST" });
			currentUser = null;
			showProfileModal = false;
			transaksiList = [];
			chatMessages = [];
			authMode = "login";
			authForm = { email: "", nama: "", password: "" };
		} catch (err) {
			console.error("Error logout:", err);
		}
	}

	async function triggerPWAInstall() {
		if (deferredInstallPrompt) {
			deferredInstallPrompt.prompt();
			const { outcome } = await deferredInstallPrompt.userChoice;
			if (outcome === "accepted") {
				canInstallPWA = false;
				isAppStandalone = true;
				showInstallBanner = false;
				successMsg = "CatatAi berhasil dipasang di perangkat Anda!";
				setTimeout(() => {
					successMsg = "";
				}, 3500);
			}
			deferredInstallPrompt = null;
		} else {
			// iOS Safari or manual install guide
			showInstallBanner = false;
			showIosInstallGuide = true;
		}
	}

	function dismissInstallBanner() {
		showInstallBanner = false;
		if (typeof window !== "undefined") {
			localStorage.setItem("catatai_pwa_dismissed", Date.now().toString());
		}
	}

	async function loadData() {
		if (!currentUser) return;
		loading = true;
		try {
			let url = `/api/transaksi`;
			if (reportSubTab === "mingguan") {
				const range = getWeekRange(selectedWeekDate);
				url += `?dari_tanggal=${range.start}&sampai_tanggal=${range.end}`;
			} else if (reportSubTab === "periode") {
				url += `?dari_tanggal=${customStartDate}&sampai_tanggal=${customEndDate}`;
			} else if (reportSubTab === "harian") {
				const monthOfTanggal = selectedTanggal.slice(0, 7);
				url += `?bulan=${monthOfTanggal}`;
			} else {
				url += `?bulan=${selectedBulan}`;
			}
			if (selectedDompetFilter) {
				url +=
					(url.includes("?") ? "&" : "?") +
					`dompet_id=${selectedDompetFilter}`;
			}
			const res = await fetch(url);
			const data = await res.json();
			if (!res.ok) {
				if (res.status === 401) {
					currentUser = null;
					return;
				}
				throw new Error(data.error || "Gagal memuat data");
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
					start_date: "",
					end_date: "",
				},
			};
			loadDompet();
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
		if (typeof window !== "undefined") {
			if (!authChecking && !currentUser) {
				const existingScript = document.querySelector(
					'script[src*="chatbotai-five-phi.vercel.app/widget.js"]',
				);
				if (!existingScript) {
					const s = document.createElement("script");
					s.src = "https://chatbotai-five-phi.vercel.app/widget.js";
					s.setAttribute("data-bot-id", "bot_hk7l2ol");
					s.async = true;
					document.body.appendChild(s);
				}
			} else if (currentUser) {
				const widgetRoot = document.getElementById(
					"ai-chatbot-widget-root",
				);
				if (widgetRoot) widgetRoot.remove();
			}
		}
	});

	onMount(() => {
		checkAuth();

		// Detect standalone display mode (PWA already installed)
		if (typeof window !== "undefined") {
			const isStandalone =
				window.matchMedia("(display-mode: standalone)").matches ||
				("standalone" in navigator && navigator.standalone);

			if (isStandalone) {
				isAppStandalone = true;
				showInstallBanner = false;
			} else {
				// Detect mobile device (Android/iOS phone or narrow viewport)
				const isMobile =
					/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
					window.innerWidth <= 768;
				isIosDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent);

				const dismissedAt = localStorage.getItem("catatai_pwa_dismissed");
				const isDismissedRecently =
					dismissedAt &&
					Date.now() - Number(dismissedAt) < 24 * 60 * 60 * 1000;

				if (isMobile && !isDismissedRecently) {
					// Show mobile install banner after short delay
					setTimeout(() => {
						if (!isAppStandalone) {
							showInstallBanner = true;
						}
					}, 1200);
				}
			}
		}

		// Listen to PWA install prompt (Chrome Android, Edge, etc.)
		window.addEventListener("beforeinstallprompt", (e) => {
			e.preventDefault();
			deferredInstallPrompt = e;
			canInstallPWA = true;
			if (!isAppStandalone) {
				showInstallBanner = true;
			}
		});

		window.addEventListener("appinstalled", () => {
			isAppStandalone = true;
			canInstallPWA = false;
			showInstallBanner = false;
			showIosInstallGuide = false;
			deferredInstallPrompt = null;
			successMsg = "CatatAi berhasil dipasang di layar utama HP Anda!";
			setTimeout(() => {
				successMsg = "";
			}, 4000);
		});
	});

	async function scrollToBottom() {
		await tick();
		if (chatMessagesContainer) {
			chatMessagesContainer.scrollTop =
				chatMessagesContainer.scrollHeight;
		}
	}

	function prevMonth() {
		const [y, m] = selectedBulan.split("-").map(Number);
		const d = new Date(y, m - 2, 1);
		selectedBulan = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
		loadData();
	}

	function nextMonth() {
		const [y, m] = selectedBulan.split("-").map(Number);
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
		const base = new Date(selectedWeekDate + "T00:00:00");
		base.setDate(base.getDate() - 7);
		selectedWeekDate = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
		loadData();
	}

	function nextWeek() {
		const base = new Date(selectedWeekDate + "T00:00:00");
		base.setDate(base.getDate() + 7);
		selectedWeekDate = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
		loadData();
	}

	function currentWeek() {
		selectedWeekDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
		loadData();
	}

	const NAMA_HARI_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
	const NAMA_HARI_FULL = [
		"Minggu",
		"Senin",
		"Selasa",
		"Rabu",
		"Kamis",
		"Jumat",
		"Sabtu",
	];

	let weekDaysData = $derived.by(() => {
		const range = currentWeekRange;
		const days = [];
		const curr = new Date(range.monday);
		const trenMap = {};
		for (const itm of rekap.tren_harian || []) {
			trenMap[itm.tanggal] = itm;
		}
		for (let i = 0; i < 7; i++) {
			const dStr = `${curr.getFullYear()}-${pad(curr.getMonth() + 1)}-${pad(curr.getDate())}`;
			const dayOfWeek = curr.getDay();
			const entry = trenMap[dStr] || {
				pengeluaran: 0,
				pemasukan: 0,
				count: 0,
			};
			days.push({
				date: dStr,
				dayShort: NAMA_HARI_SHORT[dayOfWeek],
				dayFull: NAMA_HARI_FULL[dayOfWeek],
				dayNum: pad(curr.getDate()),
				pengeluaran: entry.pengeluaran || 0,
				pemasukan: entry.pemasukan || 0,
				count: entry.count || 0,
			});
			curr.setDate(curr.getDate() + 1);
		}
		return days;
	});

	function setPeriodPreset(preset) {
		const t = new Date();
		if (preset === "hari-ini") {
			const str = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
			customStartDate = str;
			customEndDate = str;
		} else if (preset === "7-hari") {
			const past = new Date(t);
			past.setDate(past.getDate() - 6);
			customStartDate = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`;
			customEndDate = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
		} else if (preset === "14-hari") {
			const past = new Date(t);
			past.setDate(past.getDate() - 13);
			customStartDate = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`;
			customEndDate = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
		} else if (preset === "30-hari") {
			const past = new Date(t);
			past.setDate(past.getDate() - 29);
			customStartDate = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`;
			customEndDate = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
		} else if (preset === "bulan-ini") {
			const firstDay = new Date(t.getFullYear(), t.getMonth(), 1);
			const lastDay = new Date(t.getFullYear(), t.getMonth() + 1, 0);
			customStartDate = `${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-${pad(firstDay.getDate())}`;
			customEndDate = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;
		} else if (preset === "bulan-lalu") {
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
				const matchToko = (t.toko || "").toLowerCase().includes(q);
				const matchCatatan = (t.catatan || "")
					.toLowerCase()
					.includes(q);
				const matchKategori = (t.kategori || "")
					.toLowerCase()
					.includes(q);
				if (!matchToko && !matchCatatan && !matchKategori) return false;
			}
			return true;
		}),
	);

	function getTodayDateString() {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	}
	let todayTanggal = $state(getTodayDateString());
	let showTodayHistoryPanel = $state(true);

	// Catatan transaksi khusus HARI INI untuk Chat & Header
	let transaksiHariIni = $derived(
		transaksiList.filter((t) => t.tanggal === todayTanggal),
	);

	let totalHariIni = $derived(
		transaksiHariIni.reduce(
			(acc, curr) => {
				if (curr.tipe === "pengeluaran")
					acc.pengeluaran += Number(curr.total);
				else acc.pemasukan += Number(curr.total);
				return acc;
			},
			{ pengeluaran: 0, pemasukan: 0 },
		),
	);

	let companionPeriodTab = $state("minggu"); // 'minggu' | 'bulan'

	// Catatan transaksi khusus MINGGU INI untuk Chat & Sidebar
	let currentWeekRangeToday = $derived(getWeekRange(todayTanggal));

	let transaksiMingguIni = $derived(
		transaksiList.filter((t) => {
			const rng = currentWeekRangeToday;
			return t.tanggal >= rng.start && t.tanggal <= rng.end;
		}),
	);

	let totalMingguIni = $derived.by(() => {
		if (
			rekap.ringkasan_minggu_ini &&
			rekap.ringkasan_minggu_ini.total_pengeluaran !== undefined
		) {
			return {
				pengeluaran:
					Number(rekap.ringkasan_minggu_ini.total_pengeluaran) || 0,
				pemasukan:
					Number(rekap.ringkasan_minggu_ini.total_pemasukan) || 0,
				saldo_bersih:
					Number(rekap.ringkasan_minggu_ini.saldo_bersih) || 0,
				total_transaksi:
					Number(rekap.ringkasan_minggu_ini.total_transaksi) || 0,
				start_date:
					rekap.ringkasan_minggu_ini.start_date ||
					currentWeekRangeToday.start,
				end_date:
					rekap.ringkasan_minggu_ini.end_date ||
					currentWeekRangeToday.end,
			};
		}
		const calc = transaksiMingguIni.reduce(
			(acc, curr) => {
				if (curr.tipe === "pengeluaran")
					acc.pengeluaran += Number(curr.total);
				else acc.pemasukan += Number(curr.total);
				return acc;
			},
			{ pengeluaran: 0, pemasukan: 0 },
		);
		return {
			pengeluaran: calc.pengeluaran,
			pemasukan: calc.pemasukan,
			saldo_bersih: calc.pemasukan - calc.pengeluaran,
			total_transaksi: transaksiMingguIni.length,
			start_date: currentWeekRangeToday.start,
			end_date: currentWeekRangeToday.end,
		};
	});

	let harianTransaksi = $derived(
		transaksiList.filter((t) => t.tanggal === selectedTanggal),
	);

	let totalHarian = $derived(
		harianTransaksi.reduce(
			(acc, curr) => {
				if (curr.tipe === "pengeluaran") acc.pengeluaran += curr.total;
				else acc.pemasukan += curr.total;
				return acc;
			},
			{ pengeluaran: 0, pemasukan: 0 },
		),
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

	async function sendChatMessage(customText = null, isVoice = false) {
		const text = customText !== null ? customText : chatInput.trim();
		const image = chatAttachedImage;

		if (!text && !image) return;

		const userMsg = {
			id: Date.now(),
			role: "user",
			content: text,
			image: image,
			is_voice: isVoice,
			time: `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`,
		};
		chatMessages = [...chatMessages, userMsg];
		chatInput = "";
		chatAttachedImage = null;
		chatLoading = true;
		saveChatHistory();
		scrollToBottom();

		const cleanLower = (text || "").toLowerCase().trim();
		if (
			cleanLower === "ringkasan minggu ini" ||
			cleanLower === "rekap minggu ini" ||
			cleanLower === "laporan minggu ini" ||
			cleanLower === "minggu ini"
		) {
			const s = totalMingguIni;
			const botTime = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
			const msgContent =
				`📊 **Ringkasan Keuangan Minggu Ini** (${formatTgl(s.start_date)} – ${formatTgl(s.end_date)}):\n\n` +
				`• **Pengeluaran:** ${formatRupiah(s.pengeluaran)}\n` +
				`• **Pemasukan:** ${formatRupiah(s.pemasukan)}\n` +
				`• **Saldo Bersih:** ${s.saldo_bersih >= 0 ? "+" : ""}${formatRupiah(s.saldo_bersih)}\n` +
				`• **Total Transaksi:** ${s.total_transaksi} transaksi tercatat\n` +
				`• **Pengeluaran Hari Ini:** ${formatRupiah(totalHariIni.pengeluaran)}\n\n` +
				`💡 *Kamu juga bisa membuka tab **Report & Rekap → Mingguan** untuk grafik harian 7 hari dan kategori lengkap!* 📈`;
			chatMessages = [
				...chatMessages,
				{
					id: Date.now() + 1,
					role: "assistant",
					content: msgContent,
					time: botTime,
				},
			];
			saveChatHistory();
			chatLoading = false;
			scrollToBottom();
			return;
		}

		if (
			cleanLower === "ringkasan hari ini" ||
			cleanLower === "rekap hari ini" ||
			cleanLower === "laporan hari ini"
		) {
			const botTime = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
			const msgContent =
				`📅 **Ringkasan Transaksi Hari Ini** (${formatTglHari(todayTanggal)}):\n\n` +
				`• **Pengeluaran:** ${formatRupiah(totalHariIni.pengeluaran)} (${transaksiHariIni.filter((t) => t.tipe === "pengeluaran").length} transaksi)\n` +
				`• **Pemasukan:** ${formatRupiah(totalHariIni.pemasukan)} (${transaksiHariIni.filter((t) => t.tipe === "pemasukan").length} transaksi)\n` +
				`• **Saldo Bersih Hari Ini:** ${formatRupiah(totalHariIni.pemasukan - totalHariIni.pengeluaran)}\n` +
				`• **Akumulasi Minggu Ini:** ${formatRupiah(totalMingguIni.pengeluaran)}`;
			chatMessages = [
				...chatMessages,
				{
					id: Date.now() + 1,
					role: "assistant",
					content: msgContent,
					time: botTime,
				},
			];
			saveChatHistory();
			chatLoading = false;
			scrollToBottom();
			return;
		}

		try {
			const historyPayload = chatMessages
				.filter(
					(m) =>
						typeof m.content === "string" &&
						m.content.trim().length > 0,
				)
				.slice(-6)
				.map((m) => ({
					role: m.role,
					content: m.content.trim(),
				}));

			const res = await fetch("/api/chat-catat", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					pesan: text,
					image: image,
					history: historyPayload,
					currentDraft: currentActiveDraft,
				}),
			});

			const data = await res.json();
			if (!res.ok) {
				if (res.status === 403 && data.kuota_habis) {
					if (currentUser) currentUser.sisa_kuota = 0;
					showUpgradeModal = true;
				}
				throw new Error(data.error || "Gagal memproses pesan");
			}

			// Update kuota & status PRO di client
			if (currentUser) {
				if (data.sisa_kuota !== undefined)
					currentUser.sisa_kuota = data.sisa_kuota;
				if (data.chat_count_today !== undefined)
					currentUser.chat_count_today = data.chat_count_today;
				if (data.tier !== undefined) currentUser.tier = data.tier;
				if (data.is_pro !== undefined) currentUser.is_pro = data.is_pro;
			}

			const botTime = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;

			if (data.aksi === "draft") {
				const newDraft = { ...data.transaksi, status: "pending" };
				currentActiveDraft = newDraft;
				chatMessages = [
					...chatMessages,
					{
						id: Date.now() + 1,
						role: "assistant",
						content: data.jawaban_teks,
						draft: newDraft,
						time: botTime,
					},
				];
			} else if (data.aksi === "konfirmasi_simpan") {
				chatMessages = chatMessages.map((m) => {
					if (m.draft && m.draft.status === "pending") {
						return { ...m, draft: { ...m.draft, status: "saved" } };
					}
					return m;
				});

				currentActiveDraft = null;
				const savedDraft = data.transaksi
					? { ...data.transaksi, status: "saved" }
					: null;
				chatMessages = [
					...chatMessages,
					{
						id: Date.now() + 1,
						role: "assistant",
						content: data.jawaban_teks,
						savedId: data.savedId,
						draft: savedDraft,
						time: botTime,
					},
				];
				saveChatHistory();
				await loadData();
			} else if (data.aksi === "batal") {
				chatMessages = chatMessages.map((m) => {
					if (m.draft && m.draft.status === "pending") {
						return {
							...m,
							draft: { ...m.draft, status: "cancelled" },
						};
					}
					return m;
				});
				currentActiveDraft = null;
				chatMessages = [
					...chatMessages,
					{
						id: Date.now() + 1,
						role: "assistant",
						content: data.jawaban_teks,
						time: botTime,
					},
				];
			} else {
				chatMessages = [
					...chatMessages,
					{
						id: Date.now() + 1,
						role: "assistant",
						content: data.jawaban_teks,
						time: botTime,
					},
				];
			}
		} catch (err) {
			chatMessages = [
				...chatMessages,
				{
					id: Date.now() + 1,
					role: "assistant",
					content: `Maaf, ada kendala: ${err.message}`,
					time: `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`,
				},
			];
		} finally {
			chatLoading = false;
			saveChatHistory();
			scrollToBottom();
		}
	}

	async function confirmDraftDirectly(targetMsg) {
		if (targetMsg.draft) {
			targetMsg.draft.status = "saved";
		}
		currentActiveDraft = targetMsg.draft;
		await sendChatMessage("Ya, betul. Simpan sekarang!");
	}

	function cancelDraftDirectly(targetMsg) {
		if (targetMsg.draft) {
			targetMsg.draft.status = "cancelled";
		}
		currentActiveDraft = null;
		chatMessages = [
			...chatMessages,
			{
				id: Date.now(),
				role: "assistant",
				content: "Draft transaksi telah dibatalkan.",
				time: `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`,
			},
		];
		saveChatHistory();
		scrollToBottom();
	}

	function editDraftManually(draft) {
		form = {
			tipe: draft.tipe || "pengeluaran",
			toko: draft.toko || "",
			tanggal:
				draft.tanggal ||
				`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
			waktu:
				draft.waktu ||
				`${pad(now.getHours())}:${pad(now.getMinutes())}:00`,
			kategori:
				draft.kategori ||
				(draft.tipe === "pemasukan"
					? "Gaji & Upah"
					: "Makanan & Minuman"),
			metode_bayar: draft.metode_bayar || "Tunai",
			subtotal: draft.subtotal || 0,
			pajak: draft.pajak || 0,
			diskon: draft.diskon || 0,
			total: draft.total || 0,
			catatan: draft.catatan || "",
			gambar_url: draft.gambar_url || "",
			items: draft.items ? [...draft.items] : [],
		};
		modeInput = "manual";
		showModalTambah = true;
	}

	function addItem() {
		form.items = [
			...form.items,
			{ nama_barang: "", qty: 1, harga_satuan: 0, subtotal: 0 },
		];
	}

	function removeItem(index) {
		form.items = form.items.filter((_, i) => i !== index);
		hitungTotal();
	}

	function hitungTotal() {
		let sub = 0;
		form.items.forEach((itm) => {
			itm.subtotal =
				(Number(itm.qty) || 0) * (Number(itm.harga_satuan) || 0);
			sub += itm.subtotal;
		});
		form.subtotal = sub;
		const pjk = Number(form.pajak) || 0;
		const dsk = Number(form.diskon) || 0;
		form.total = Math.max(0, sub + pjk - dsk);
	}

	async function simpanTransaksi() {
		if (!form.toko.trim() && form.items.length === 0 && form.total <= 0) {
			alert("Mohon isi nama toko / sumber atau nominal transaksi.");
			return;
		}

		loading = true;
		errorMsg = "";
		try {
			const url =
				isEditingTransaksi && editingTransaksiId
					? `/api/transaksi/${editingTransaksiId}`
					: "/api/transaksi";
			const method =
				isEditingTransaksi && editingTransaksiId ? "PUT" : "POST";

			const res = await fetch(url, {
				method,
				headers: { "content-type": "application/json" },
				body: JSON.stringify(form),
			});
			const resData = await res.json();
			if (!res.ok)
				throw new Error(
					resData.error ||
						(isEditingTransaksi
							? "Gagal memperbarui transaksi"
							: "Gagal menyimpan transaksi"),
				);

			const wasEditing = isEditingTransaksi;
			const updatedToko = form.toko;
			const updatedTotal = form.total;
			const updatedTipe = form.tipe;

			showModalTambah = false;
			resetForm();
			await loadData();
			successMsg = wasEditing
				? "Transaksi berhasil diperbarui!"
				: "Transaksi berhasil disimpan!";
			setTimeout(() => {
				successMsg = "";
			}, 3500);

			if (!wasEditing) {
				chatMessages = [
					...chatMessages,
					{
						id: Date.now(),
						role: "assistant",
						content: `${updatedTipe === "pemasukan" ? "Pemasukan" : "Pengeluaran"} "${updatedToko || "Transaksi"}" sebesar ${formatRupiah(updatedTotal)} telah berhasil disimpan!`,
						time: `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`,
					},
				];
				scrollToBottom();
			}
		} catch (err) {
			errorMsg = err.message;
		} finally {
			loading = false;
		}
	}

	function resetForm() {
		isEditingTransaksi = false;
		editingTransaksiId = null;
		const defaultDompet = dompetList[0]?.nama || "Tunai";
		const defaultDompetId = dompetList[0]?.id || null;
		form = {
			tipe: "pengeluaran",
			toko: "",
			tanggal: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
			waktu: `${pad(now.getHours())}:${pad(now.getMinutes())}:00`,
			kategori: "Makanan & Minuman",
			metode_bayar: defaultDompet,
			dompet: defaultDompet,
			dompet_id: defaultDompetId,
			subtotal: 0,
			pajak: 0,
			diskon: 0,
			total: 0,
			catatan: "",
			gambar_url: "",
			items: [],
		};
	}

	async function openEditTransaksi(trxOrId) {
		if (!trxOrId) return;
		showModalDetail = false;
		const id = typeof trxOrId === "object" ? trxOrId.id : trxOrId;

		try {
			let fullTrx = typeof trxOrId === "object" && trxOrId.items ? trxOrId : null;
			if (!fullTrx) {
				loading = true;
				const res = await fetch(`/api/transaksi/${id}`);
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || "Gagal memuat transaksi");
				fullTrx = data.transaksi;
			}

			isEditingTransaksi = true;
			editingTransaksiId = fullTrx.id;
			form = {
				id: fullTrx.id,
				tipe: fullTrx.tipe || "pengeluaran",
				toko: fullTrx.toko || "",
				tanggal: fullTrx.tanggal
					? fullTrx.tanggal.slice(0, 10)
					: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
				waktu: fullTrx.waktu
					? fullTrx.waktu.slice(0, 8)
					: `${pad(now.getHours())}:${pad(now.getMinutes())}:00`,
				kategori: fullTrx.kategori || "Makanan & Minuman",
				metode_bayar: fullTrx.metode_bayar || fullTrx.dompet || "Tunai",
				dompet: fullTrx.dompet || fullTrx.metode_bayar || "Tunai",
				dompet_id: fullTrx.dompet_id || null,
				subtotal: fullTrx.subtotal || 0,
				pajak: fullTrx.pajak || 0,
				diskon: fullTrx.diskon || 0,
				total: fullTrx.total || 0,
				catatan: fullTrx.catatan || "",
				gambar_url: fullTrx.gambar_url || "",
				items: Array.isArray(fullTrx.items)
					? fullTrx.items.map((i) => ({
							id: i.id,
							nama_barang: i.nama_barang || "",
							qty: i.qty || 1,
							harga_satuan: i.harga_satuan || 0,
							subtotal: i.subtotal || 0,
						}))
					: [],
			};
			modeInput = "manual";
			showModalTambah = true;
		} catch (e) {
			alert(e.message || "Gagal membuka form edit transaksi");
		} finally {
			loading = false;
		}
	}

	async function openDetail(id) {
		showModalDetail = true;
		detailLoading = true;
		detailData = null;
		try {
			const res = await fetch(`/api/transaksi/${id}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Gagal memuat detail");
			detailData = data.transaksi;
		} catch (e) {
			alert(e.message);
			showModalDetail = false;
		} finally {
			detailLoading = false;
		}
	}

	async function deleteTransaksi(id) {
		if (!confirm("Apakah kamu yakin ingin menghapus transaksi ini?"))
			return;
		try {
			const res = await fetch(`/api/transaksi/${id}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Gagal menghapus transaksi");
			await loadData();
			if (showModalDetail) showModalDetail = false;
		} catch (e) {
			alert(e.message);
		}
	}

	function exportCSV() {
		if (filteredTransaksi.length === 0) {
			alert("Tidak ada transaksi untuk diekspor.");
			return;
		}
		const headers = [
			"ID",
			"Tipe",
			"Toko/Sumber",
			"Tanggal",
			"Waktu",
			"Kategori",
			"Metode Bayar",
			"Subtotal",
			"Pajak",
			"Diskon",
			"Total",
			"Catatan",
		];
		const rows = filteredTransaksi.map((t) => [
			t.id,
			t.tipe,
			`"${(t.toko || "").replace(/"/g, '""')}"`,
			t.tanggal,
			t.waktu,
			t.kategori,
			t.metode_bayar,
			t.subtotal,
			t.pajak,
			t.diskon,
			t.total,
			`"${(t.catatan || "").replace(/"/g, '""')}"`,
		]);
		const csvContent =
			"data:text/csv;charset=utf-8," +
			[headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
		const encodedUri = encodeURI(csvContent);
		const link = document.createElement("a");
		link.setAttribute("href", encodedUri);
		let periodSuffix = selectedBulan;
		if (reportSubTab === "mingguan") {
			const range = getWeekRange(selectedWeekDate);
			periodSuffix = `Minggu_${range.start}_sd_${range.end}`;
		} else if (reportSubTab === "periode") {
			periodSuffix = `Periode_${customStartDate}_sd_${customEndDate}`;
		} else if (reportSubTab === "harian") {
			periodSuffix = `Harian_${selectedTanggal}`;
		}
		link.setAttribute(
			"download",
			`Report_Transaksi_${currentUser?.nama || "Akun"}_${periodSuffix}.csv`,
		);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
</script>

<svelte:head>
	<title>CatatAi — Asisten Keuangan AI, Scan Struk & Catat Suara Otomatis</title>
	<meta name="description" content="Aplikasi pencatatan keuangan cerdas no. 1 di Indonesia. Catat otomatis lewat suara (voice note), scan struk & nota belanja pintar AI, serta kelola multi-dompet tanpa ribet. Gratis & aman!" />
	<meta name="keywords" content="CatatAi, aplikasi catat keuangan, scan struk belanja, catat pengeluaran suara, pembukuan umkm, ocr nota kasir, kelola multi dompet, expense tracker ai indonesia, pelacak keuangan pribadi" />
	<link rel="canonical" href="https://catatai.com/" />

	<!-- Structured Data (JSON-LD) for Google SERP First Page Rich Snippets -->
	{@html `<script type="application/ld+json">${JSON.stringify(structuredDataJson)}<\/script>`}

	{#if !currentUser}
		<script
			src="https://chatbotai-five-phi.vercel.app/widget.js"
			data-bot-id="bot_hk7l2ol"
		></script>
	{/if}
</svelte:head>

<div class="app-mobile-root {currentUser ? 'app-logged-in' : ''}">
	{#if authChecking}
		<!-- SPLASH SCREEN -->
		<div class="auth-loading-screen">
			<div class="brand-gem-large">
				<svg
					width="28"
					height="28"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
					/>
				</svg>
			</div>
			<div class="splash-title">CatatAi</div>
			<div class="splash-sub">Memuat akun & data transaksi...</div>
		</div>
	{:else if !currentUser}
		<!-- ==============================================
		     VIEW: REDESIGNED COMPREHENSIVE LANDING PAGE
		     ============================================== -->
		<div class="landing-page-wrap">
			<!-- TOP NAVIGATION BAR -->
			<header class="landing-nav-bar">
				<div class="landing-nav-inner">
					<div class="landing-nav-brand">
						<div class="brand-gem-large">
							<svg
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.3"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path
									d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
								/>
							</svg>
						</div>
						<div class="brand-logo-text">
							<span class="logo-title">CatatAi</span>
							<span class="logo-sub">Smart AI Bookkeeping</span>
						</div>
					</div>

					<nav
						class="landing-nav-links"
						aria-label="Navigasi Landing"
					>
						<a href="#fitur" class="landing-nav-link">Fitur AI</a>
						<a href="#demo" class="landing-nav-link">Simulasi</a>
						<a href="#kantong" class="landing-nav-link"
							>Multi-Dompet</a
						>
						<a href="#komparasi" class="landing-nav-link"
							>Keunggulan</a
						>
						<a href="#faq" class="landing-nav-link">FAQ</a>
					</nav>

					<div class="landing-nav-right">
						<div class="landing-status-badge">
							<span class="status-pulse-dot"></span>
							<span class="status-badge-text"
								>DeepSeek AI Voice & Vision</span
							>
						</div>
						<button
							type="button"
							class="nav-cta-btn"
							onclick={() => {
								authMode = "register";
								authError = "";
								document
									.getElementById("auth-box-section")
									?.scrollIntoView({ behavior: "smooth" });
							}}
						>
							Mulai Gratis ✨
						</button>
					</div>
				</div>
			</header>

			<!-- MAIN CONTENT CONTAINER -->
			<main class="landing-main-container">
				<!-- ==============================================
				     SECTION 1: HERO & AUTH SIDE-BY-SIDE
				     ============================================== -->
				<section class="landing-hero-auth-section">
					<div class="landing-hero-content">
						<div class="hero-tag-badge">
							<span class="tag-sparkle">🎙️📸✨</span>
							<span
								>Generasi Baru Pembukuan Finansial AI Indonesia</span
							>
						</div>

						<h1 class="landing-hero-title">
							Atur Keuangan & Scan Bon, <br class="br-desktop" />
							<span class="accent-text-highlight"
								>Semudah Bicara atau Kirim Chat</span
							>
						</h1>

						<p class="landing-hero-subtitle">
							Tinggalkan spreadsheet rumit dan struk fisik yang
							tercecer. Cukup <strong
								>bicara lewat rekaman suara</strong
							>, <strong>foto nota belanja kasir</strong>, atau
							<strong>chat santai</strong> seperti di WhatsApp. AI
							otomatis mengkategorikan pengeluaran, membagi saldo ke
							multi-dompet, dan menyusun laporan keuangan Anda secara
							real-time.
						</p>

						<!-- QUICK PILLS VALUE -->
						<div class="hero-quick-perks">
							<div class="hero-perk-item">
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									><polyline points="20 6 9 17 4 12" /></svg
								>
								<span>Tanpa Input Rumit</span>
							</div>
							<div class="hero-perk-item">
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									><polyline points="20 6 9 17 4 12" /></svg
								>
								<span>Multi-Dompet & Transfer Saldo</span>
							</div>
							<div class="hero-perk-item">
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									><polyline points="20 6 9 17 4 12" /></svg
								>
								<span>PWA Mobile Ready</span>
							</div>
						</div>

						<!-- ACTION BUTTONS -->
						<div class="hero-action-row">
							<button
								type="button"
								class="btn-hero-primary"
								onclick={() => {
									document
										.getElementById("auth-box-section")
										?.scrollIntoView({
											behavior: "smooth",
										});
								}}
							>
								<span>Daftar Sekarang — Gratis</span>
								<svg
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.2"
									><line
										x1="5"
										y1="12"
										x2="19"
										y2="12"
									/><polyline
										points="12 5 19 12 12 19"
									/></svg
								>
							</button>

							<button
								type="button"
								class="btn-hero-secondary"
								onclick={() => {
									document
										.getElementById("demo")
										?.scrollIntoView({
											behavior: "smooth",
										});
								}}
							>
								<span>Lihat Demo Interaktif</span>
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									><circle cx="12" cy="12" r="10" /><polygon
										points="10 8 16 12 10 16 10 8"
									/></svg
								>
							</button>
						</div>
					</div>

					<!-- COLUMN 2: LOGIN / REGISTER AUTH FORM -->
					<div class="landing-auth-column" id="auth-box-section">
						<div class="auth-card-box">
							<!-- AUTH CARD HEADER -->
							<div class="auth-brand-head">
								<div class="brand-gem-large">
									<svg
										width="26"
										height="26"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path
											d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
										/>
									</svg>
								</div>
								<h2 class="auth-app-title">
									{authMode === "login"
										? "Masuk ke CatatAi"
										: "Buat Akun Gratis"}
								</h2>
								<p class="auth-app-desc">
									{authMode === "login"
										? "Kelola catatan keuangan & dompet Anda dengan asisten AI pintar"
										: "Daftar dalam 10 detik. Akses seluruh fitur AI tanpa biaya langganan."}
								</p>
							</div>

							<!-- TAB SWITCHER: MASUK / DAFTAR -->
							<div class="auth-tabs-row" role="tablist">
								<button
									type="button"
									role="tab"
									aria-selected={authMode === "login"}
									class="auth-tab-btn {authMode === 'login'
										? 'active'
										: ''}"
									onclick={() => {
										authMode = "login";
										authError = "";
									}}
								>
									Masuk Akun
								</button>
								<button
									type="button"
									role="tab"
									aria-selected={authMode === "register"}
									class="auth-tab-btn {authMode === 'register'
										? 'active'
										: ''}"
									onclick={() => {
										authMode = "register";
										authError = "";
									}}
								>
									Daftar Baru
								</button>
							</div>

							<!-- ERROR BANNER -->
							{#if authError}
								<div class="auth-error-banner" role="alert">
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<circle cx="12" cy="12" r="10" /><line
											x1="12"
											y1="8"
											x2="12"
											y2="12"
										/><line
											x1="12"
											y1="16"
											x2="12.01"
											y2="16"
										/>
									</svg>
									<span>{authError}</span>
								</div>
							{/if}

							<!-- AUTH FORM -->
							<form
								class="auth-form-stack"
								onsubmit={(e) => {
									e.preventDefault();
									handleAuthSubmit();
								}}
							>
								{#if authMode === "register"}
									<div class="auth-field">
										<label for="inp-auth-nama"
											>Nama Lengkap</label
										>
										<div class="auth-input-wrap">
											<svg
												class="auth-input-icon"
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<path
													d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
												/><circle
													cx="12"
													cy="7"
													r="4"
												/>
											</svg>
											<input
												id="inp-auth-nama"
												type="text"
												placeholder="Contoh: Budi Pratama"
												bind:value={authForm.nama}
												required
												autocomplete="name"
											/>
										</div>
									</div>
								{/if}

								<div class="auth-field">
									<label for="inp-auth-email"
										>Alamat Email</label
									>
									<div class="auth-input-wrap">
										<svg
											class="auth-input-icon"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path
												d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
											/><polyline
												points="22,6 12,13 2,6"
											/>
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
										<label for="inp-auth-pwd"
											>Password</label
										>
										<button
											type="button"
											class="btn-toggle-pwd"
											onclick={() => {
												showPassword = !showPassword;
											}}
											aria-label="Lihat atau sembunyikan password"
										>
											{showPassword
												? "Sembunyikan"
												: "Tampilkan"}
										</button>
									</div>
									<div class="auth-input-wrap">
										<svg
											class="auth-input-icon"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<rect
												x="3"
												y="11"
												width="18"
												height="11"
												rx="2"
												ry="2"
											/><path
												d="M7 11V7a5 5 0 0 1 10 0v4"
											/>
										</svg>
										<input
											id="inp-auth-pwd"
											type={showPassword
												? "text"
												: "password"}
											placeholder={authMode === "register"
												? "Minimal 6 karakter"
												: "Masukkan password"}
											bind:value={authForm.password}
											required
											minlength="6"
											autocomplete={authMode ===
											"register"
												? "new-password"
												: "current-password"}
										/>
									</div>
								</div>

								<button
									type="submit"
									class="btn-auth-submit"
									disabled={authLoading}
								>
									{#if authLoading}
										<span class="btn-spinner"></span>
										<span>Memproses Akun...</span>
									{:else if authMode === "register"}
										<span
											>Daftar Akun CatatAi Gratis ✨</span
										>
									{:else}
										<span>Masuk ke Dashboard 🚀</span>
									{/if}
								</button>
							</form>

							<!-- MODE TOGGLE HELPER LINK -->
							<div class="auth-switch-helper">
								{#if authMode === "login"}
									<span>Belum memiliki akun? </span>
									<button
										type="button"
										class="link-switch-auth"
										onclick={() => {
											authMode = "register";
											authError = "";
										}}
									>
										Daftar akun baru gratis
									</button>
								{:else}
									<span>Sudah memiliki akun? </span>
									<button
										type="button"
										class="link-switch-auth"
										onclick={() => {
											authMode = "login";
											authError = "";
										}}
									>
										Masuk di sini
									</button>
								{/if}
							</div>

							<!-- SECURITY BADGE -->
							<div class="auth-security-notice">
								<svg
									width="15"
									height="15"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path
										d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
									/>
								</svg>
								<div class="security-text-box">
									<strong
										>Privasi Bank-Grade Terisolasi</strong
									>
									<p>
										Data keuangan Anda tersimpan privat di
										database terenkripsi Neon DB PostgreSQL
										dengan Scrypt Hash & Cookie HTTP-Only.
									</p>
								</div>
							</div>
						</div>
					</div>
				</section>

				<!-- ==============================================
				     SECTION 2: INTERACTIVE LIVE DEMO SHOWCASE (#demo)
				     ============================================== -->
				<section class="landing-section-block" id="demo">
					<div class="section-header-center">
						<span class="section-kicker"
							>✨ INTERACTIVE SHOWCASE</span
						>
						<h2 class="section-heading">
							Coba Rasakan Kemudahan CatatAi
						</h2>
						<p class="section-subtext">
							Pilih mode pencatatan di bawah untuk melihat
							bagaimana AI memproses transaksi keuangan secara
							cerdas.
						</p>
					</div>

					<!-- DEMO TAB SWITCHER -->
					<div class="demo-tabs-carousel">
						<button
							type="button"
							class="demo-nav-tab {landingDemoTab === 'voice'
								? 'active'
								: ''}"
							onclick={() => {
								landingDemoTab = "voice";
							}}
						>
							<span class="demo-tab-icon">🎙️</span>
							<span class="demo-tab-label"
								>Rekam Suara (Voice AI)</span
							>
						</button>
						<button
							type="button"
							class="demo-nav-tab {landingDemoTab === 'scan'
								? 'active'
								: ''}"
							onclick={() => {
								landingDemoTab = "scan";
							}}
						>
							<span class="demo-tab-icon">📸</span>
							<span class="demo-tab-label"
								>Scan Bon (Vision AI)</span
							>
						</button>
						<button
							type="button"
							class="demo-nav-tab {landingDemoTab === 'dompet'
								? 'active'
								: ''}"
							onclick={() => {
								landingDemoTab = "dompet";
							}}
						>
							<span class="demo-tab-icon">💳</span>
							<span class="demo-tab-label"
								>Multi-Dompet & Transfer</span
							>
						</button>
						<button
							type="button"
							class="demo-nav-tab {landingDemoTab === 'report'
								? 'active'
								: ''}"
							onclick={() => {
								landingDemoTab = "report";
							}}
						>
							<span class="demo-tab-icon">📊</span>
							<span class="demo-tab-label"
								>Grafik 7 Hari & Rekap</span
							>
						</button>
					</div>

					<!-- INTERACTIVE DEMO CARD VIEW -->
					<div class="demo-interactive-stage">
						{#if landingDemoTab === "voice"}
							<!-- TAB 1: VOICE AI DEMO -->
							<div class="demo-panel voice-panel">
								<div class="demo-panel-header">
									<div class="demo-panel-title">
										<span class="pulse-audio-icon">🎙️</span>
										<div>
											<strong
												>Voice-to-Expense Intelligence</strong
											>
											<span
												>Merekam ucapan langsung dalam
												Bahasa Indonesia sehari-hari</span
											>
										</div>
									</div>
									<span class="badge-tech"
										>Web Speech & AI NLU</span
									>
								</div>

								<div class="voice-simulation-content">
									<!-- Wave audio bar -->
									<div class="voice-audio-card">
										<div class="recording-badge-mock">
											<span class="rec-red-dot"></span>
											<span>Merekam Audio (00:03)</span>
										</div>
										<div class="audio-waves-visual">
											<span class="wave-bar h1"></span>
											<span class="wave-bar h3"></span>
											<span class="wave-bar h5"></span>
											<span class="wave-bar h2"></span>
											<span class="wave-bar h4"></span>
											<span class="wave-bar h5"></span>
											<span class="wave-bar h3"></span>
											<span class="wave-bar h1"></span>
										</div>
										<p class="voice-transcription-preview">
											"Tadi barusan ngopi bareng klien 45
											ribu bayar pakai QRIS Gopay"
										</p>
									</div>

									<!-- Arrow transformation -->
									<div class="demo-arrow-flow">
										<svg
											width="24"
											height="24"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											><line
												x1="12"
												y1="5"
												x2="12"
												y2="19"
											/><polyline
												points="19 12 12 19 5 12"
											/></svg
										>
										<span>AI Parsing Otomatis</span>
									</div>

									<!-- Result Card -->
									<div class="demo-result-card">
										<div class="result-header">
											<div class="result-badge-success">
												<svg
													width="14"
													height="14"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2.5"
													><polyline
														points="20 6 9 17 4 12"
													/></svg
												>
												<span
													>Pengeluaran Berhasil
													Dicatat</span
												>
											</div>
											<span class="result-time"
												>Baru Saja</span
											>
										</div>
										<div class="result-body">
											<div
												class="result-amount danger-text"
											>
												- Rp 45.000
											</div>
											<div class="result-desc">
												Kopi bareng klien
											</div>
											<div class="result-tags">
												<span
													class="tag-pill category-pill"
													>☕ Makanan & Minuman</span
												>
												<span
													class="tag-pill wallet-pill"
													>📱 E-Wallet Gopay</span
												>
												<span
													class="tag-pill voice-pill"
													>🎙️ Rekaman Suara</span
												>
											</div>
										</div>
									</div>
								</div>
							</div>
						{:else if landingDemoTab === "scan"}
							<!-- TAB 2: VISION SCAN STRUK DEMO -->
							<div class="demo-panel scan-panel">
								<div class="demo-panel-header">
									<div class="demo-panel-title">
										<span class="pulse-audio-icon">📸</span>
										<div>
											<strong
												>Vision AI Receipt Scanner</strong
											>
											<span
												>Foto struk kasir toko, AI
												membaca rincian belanjaan dan
												total</span
											>
										</div>
									</div>
									<span class="badge-tech"
										>DeepSeek OCR Vision</span
									>
								</div>

								<div class="scan-simulation-content">
									<!-- Mock Receipt Preview -->
									<div class="mock-receipt-sheet">
										<div class="receipt-torn-top"></div>
										<div class="receipt-inner">
											<div class="receipt-store-title">
												SUPERMARKET SEGAR
											</div>
											<div class="receipt-date">
												14/10/2026 • 11:20:15 WIB
											</div>
											<div class="receipt-divider">
												-----------------------------
											</div>
											<div class="receipt-item-row">
												<span
													>Susu UHT Full Cream 1L</span
												>
												<span>Rp 21.500</span>
											</div>
											<div class="receipt-item-row">
												<span>Roti Gandum Toast</span>
												<span>Rp 18.000</span>
											</div>
											<div class="receipt-item-row">
												<span
													>Telur Ayam Negeri 10btr</span
												>
												<span>Rp 28.500</span>
											</div>
											<div class="receipt-divider">
												-----------------------------
											</div>
											<div class="receipt-total-row">
												<strong>TOTAL PEMBELIAN</strong>
												<strong>Rp 68.000</strong>
											</div>
										</div>
										<div
											class="receipt-scan-laser-line"
										></div>
									</div>

									<!-- Arrow transformation -->
									<div class="demo-arrow-flow">
										<svg
											width="24"
											height="24"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											><line
												x1="12"
												y1="5"
												x2="12"
												y2="19"
											/><polyline
												points="19 12 12 19 5 12"
											/></svg
										>
										<span>Ekstraksi OCR Vision Instan</span>
									</div>

									<!-- Result Card -->
									<div class="demo-result-card">
										<div class="result-header">
											<div class="result-badge-success">
												<svg
													width="14"
													height="14"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2.5"
													><polyline
														points="20 6 9 17 4 12"
													/></svg
												>
												<span
													>Nota Belanja Terverifikasi</span
												>
											</div>
											<span class="result-time"
												>14 Okt 2026</span
											>
										</div>
										<div class="result-body">
											<div
												class="result-amount danger-text"
											>
												- Rp 68.000
											</div>
											<div class="result-desc">
												Supermarket Segar (Susu UHT,
												Roti, Telur)
											</div>
											<div class="result-tags">
												<span
													class="tag-pill category-pill"
													>🛒 Kebutuhan Harian</span
												>
												<span
													class="tag-pill wallet-pill"
													>💳 Rekening Bank</span
												>
												<span class="tag-pill scan-pill"
													>📸 Scan Struk AI</span
												>
											</div>
										</div>
									</div>
								</div>
							</div>
						{:else if landingDemoTab === "dompet"}
							<!-- TAB 3: MULTI-DOMPET & TRANSFER DEMO -->
							<div class="demo-panel dompet-panel">
								<div class="demo-panel-header">
									<div class="demo-panel-title">
										<span class="pulse-audio-icon">💳</span>
										<div>
											<strong
												>Multi-Dompet & Transfer Saldo
												Antar-Kantong</strong
											>
											<span
												>Pisahkan uang saku, rekening
												operasional, dan e-wallet dengan
												mudah</span
											>
										</div>
									</div>
									<span class="badge-tech"
										>Real-time Balance Ledger</span
									>
								</div>

								<div class="dompet-simulation-content">
									<div class="wallets-grid-demo">
										<!-- Card 1: Dompet Tunai -->
										<div class="demo-wallet-card cash-card">
											<div class="d-wallet-top">
												<span class="d-wallet-icon"
													>💵</span
												>
												<span class="d-wallet-type"
													>Uang Saku</span
												>
											</div>
											<div class="d-wallet-name">
												Dompet Tunai
											</div>
											<div class="d-wallet-balance">
												Rp 450.000
											</div>
											<div class="d-wallet-action-hint">
												Uang di dompet fisik
											</div>
										</div>

										<!-- Card 2: Rekening Bank -->
										<div class="demo-wallet-card bank-card">
											<div class="d-wallet-top">
												<span class="d-wallet-icon"
													>🏦</span
												>
												<span class="d-wallet-type"
													>Bank Utama</span
												>
											</div>
											<div class="d-wallet-name">
												Rekening BCA
											</div>
											<div class="d-wallet-balance">
												Rp 8.250.000
											</div>
											<div class="d-wallet-action-hint">
												Tabungan & Gaji
											</div>
										</div>

										<!-- Card 3: E-Wallet -->
										<div
											class="demo-wallet-card ewallet-card"
										>
											<div class="d-wallet-top">
												<span class="d-wallet-icon"
													>📱</span
												>
												<span class="d-wallet-type"
													>Digital Wallet</span
												>
											</div>
											<div class="d-wallet-name">
												Gopay / ShopeePay
											</div>
											<div class="d-wallet-balance">
												Rp 320.000
											</div>
											<div class="d-wallet-action-hint">
												Transport & Jajan QRIS
											</div>
										</div>
									</div>

									<!-- Transfer Flow Box -->
									<div class="demo-transfer-notice">
										<div class="transfer-badge">
											<svg
												width="15"
												height="15"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												><path d="M17 1l4 4-4 4" /><path
													d="M3 11V9a4 4 0 0 1 4-4h14"
												/><path
													d="M7 23l-4-4 4-4"
												/><path
													d="M21 13v2a4 4 0 0 1-4 4H3"
												/></svg
											>
											<span
												>Fitur Transfer Antar-Kantong</span
											>
										</div>
										<p>
											Top-up e-wallet dari BCA sebesar <strong
												>Rp 100.000</strong
											>? Cukup gunakan menu Transfer,
											saldo kedua dompet disesuaikan
											otomatis tanpa mengacaukan kalkulasi
											pengeluaran Anda!
										</p>
									</div>
								</div>
							</div>
						{:else if landingDemoTab === "report"}
							<!-- TAB 4: REPORT & ANALYTICS DEMO -->
							<div class="demo-panel report-panel">
								<div class="demo-panel-header">
									<div class="demo-panel-title">
										<span class="pulse-audio-icon">📊</span>
										<div>
											<strong
												>Visualisasi Grafik & Rekap
												Otomatis</strong
											>
											<span
												>Grafik batang 7 hari, rekap
												bulanan, dan perincian kategori
												belanja</span
											>
										</div>
									</div>
									<span class="badge-tech"
										>Dynamic Charts & CSV Export</span
									>
								</div>

								<div class="report-simulation-content">
									<!-- Visual Bar Chart Mockup -->
									<div class="demo-chart-box">
										<div class="chart-box-header">
											<strong
												>Tren Pengeluaran 7 Hari
												Terakhir</strong
											>
											<span class="chart-summary-stat"
												>Total: Rp 645.000</span
											>
										</div>
										<div class="demo-bars-wrap">
											<div class="demo-bar-col">
												<div
													class="demo-bar-fill"
													style="height: 35%"
												></div>
												<span class="demo-bar-day"
													>Sen</span
												>
											</div>
											<div class="demo-bar-col">
												<div
													class="demo-bar-fill"
													style="height: 60%"
												></div>
												<span class="demo-bar-day"
													>Sel</span
												>
											</div>
											<div class="demo-bar-col">
												<div
													class="demo-bar-fill active-highest"
													style="height: 90%"
												></div>
												<span class="demo-bar-day"
													>Rab</span
												>
											</div>
											<div class="demo-bar-col">
												<div
													class="demo-bar-fill"
													style="height: 45%"
												></div>
												<span class="demo-bar-day"
													>Kam</span
												>
											</div>
											<div class="demo-bar-col">
												<div
													class="demo-bar-fill"
													style="height: 70%"
												></div>
												<span class="demo-bar-day"
													>Jum</span
												>
											</div>
											<div class="demo-bar-col">
												<div
													class="demo-bar-fill"
													style="height: 85%"
												></div>
												<span class="demo-bar-day"
													>Sab</span
												>
											</div>
											<div class="demo-bar-col">
												<div
													class="demo-bar-fill"
													style="height: 25%"
												></div>
												<span class="demo-bar-day"
													>Min</span
												>
											</div>
										</div>
									</div>

									<!-- Breakdown Cards -->
									<div class="demo-breakdown-row">
										<div class="breakdown-card">
											<span class="b-label"
												>Pemasukan Bulan Ini</span
											>
											<span class="b-val success-text"
												>Rp 9.500.000</span
											>
										</div>
										<div class="breakdown-card">
											<span class="b-label"
												>Pengeluaran Bulan Ini</span
											>
											<span class="b-val danger-text"
												>Rp 4.120.000</span
											>
										</div>
										<div class="breakdown-card">
											<span class="b-label"
												>Saldo Bersih / Tabungan</span
											>
											<span class="b-val primary-text"
												>Rp 5.380.000</span
											>
										</div>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</section>

				<!-- ==============================================
				     SECTION 3: BENTO GRID FITUR LENGKAP (#fitur)
				     ============================================== -->
				<section class="landing-section-block" id="fitur">
					<div class="section-header-center">
						<span class="section-kicker"
							>✨ FITUR LENGKAP CATATAI</span
						>
						<h2 class="section-heading">
							Semua Yang Anda Butuhkan Untuk Finansial Sehat
						</h2>
						<p class="section-subtext">
							Dari pencatatan harian hingga laporan akhir bulan,
							semua dirancang cerdas, cepat, dan mudah digunakan.
						</p>
					</div>

					<div class="bento-features-grid">
						<!-- BENTO 1: VOICE OVER -->
						<div class="bento-card bento-voice highlight-border">
							<div class="bento-badge-chip">Baru 🎙️</div>
							<div class="bento-icon-box">
								<svg
									width="26"
									height="26"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.2"
									><path
										d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 6 0V4a3 3 0 0 0-3-3z"
									/><path
										d="M19 10v2a7 7 0 0 1-14 0v-2"
									/><line
										x1="12"
										y1="19"
										x2="12"
										y2="23"
									/><line
										x1="8"
										y1="23"
										x2="16"
										y2="23"
									/></svg
								>
							</div>
							<h3 class="bento-title">Speech-to-Text AI Voice</h3>
							<p class="bento-desc">
								Sedang berkendara atau jalan santai? Cukup tekan
								tombol mikrofon dan sebutkan transaksi Anda. AI
								otomatis mentranskripsi dan mengelompokkan ke
								pos anggaran yang tepat.
							</p>
							<div class="bento-mini-pill">
								🎙️ Bahasa Indonesia Alami
							</div>
						</div>

						<!-- BENTO 2: VISION RECEIPT -->
						<div class="bento-card bento-vision highlight-border">
							<div class="bento-badge-chip">AI Vision 📸</div>
							<div class="bento-icon-box">
								<svg
									width="26"
									height="26"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.2"
									><path
										d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
									/><circle cx="12" cy="13" r="4" /></svg
								>
							</div>
							<h3 class="bento-title">Scan Bon Kasir Otomatis</h3>
							<p class="bento-desc">
								Tak perlu lagi mengetik puluhan item belanjaan.
								Cukup ambil foto nota fisik minimarket atau
								kafe, DeepSeek Vision mengekstrak toko, item,
								nominal, dan tanggal secara presisi.
							</p>
							<div class="bento-mini-pill">
								📸 OCR Nota Cepat & Akurat
							</div>
						</div>

						<!-- BENTO 3: MULTI DOMPET (#kantong) -->
						<div class="bento-card bento-wallets" id="kantong">
							<div class="bento-icon-box">
								<svg
									width="26"
									height="26"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.2"
									><rect
										x="1"
										y="4"
										width="22"
										height="16"
										rx="2"
										ry="2"
									/><line
										x1="1"
										y1="10"
										x2="23"
										y2="10"
									/></svg
								>
							</div>
							<h3 class="bento-title">
								Multi-Dompet & Transfer Saldo
							</h3>
							<p class="bento-desc">
								Kelola uang kas di dompet, rekening tabungan,
								dan berbagai e-wallet Anda. Lengkap dengan fitur
								transfer saldo antar-kantong tanpa mengotori
								laporan arus kas.
							</p>
							<div class="bento-mini-pill">
								💳 Kantong Terpisah Rapi
							</div>
						</div>

						<!-- BENTO 4: CHARTS & EXPORT -->
						<div class="bento-card bento-analytics">
							<div class="bento-icon-box">
								<svg
									width="26"
									height="26"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.2"
									><line
										x1="18"
										y1="20"
										x2="18"
										y2="10"
									/><line
										x1="12"
										y1="20"
										x2="12"
										y2="4"
									/><line
										x1="6"
										y1="20"
										x2="6"
										y2="14"
									/></svg
								>
							</div>
							<h3 class="bento-title">
								Laporan Mingguan & Bulanan
							</h3>
							<p class="bento-desc">
								Pantau pengeluaran dengan visual bar chart 7
								hari yang interaktif. Temukan pos pengeluaran
								paling boros dan unduh rekap data dalam format
								spreadsheet Excel/CSV.
							</p>
							<div class="bento-mini-pill">
								📊 Grafik 7 Hari & Ekspor CSV
							</div>
						</div>

						<!-- BENTO 5: CHATBOT FINANCIAL -->
						<div class="bento-card bento-chat">
							<div class="bento-icon-box">
								<svg
									width="26"
									height="26"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.2"
									><path
										d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
									/></svg
								>
							</div>
							<h3 class="bento-title">
								Chat Interaktif Asisten Cerdas
							</h3>
							<p class="bento-desc">
								Ketik pesan layaknya chat ke teman. AI memahami
								konteks multi-transaksi, kalimat gaul, singkatan
								("rb", "k", "jt"), dan otomatis menghitung
								totalnya untuk Anda.
							</p>
							<div class="bento-mini-pill">
								💬 DeepSeek AI Natural Parsing
							</div>
						</div>

						<!-- BENTO 6: PWA MOBILE -->
						<div class="bento-card bento-pwa">
							<div class="bento-icon-box">
								<svg
									width="26"
									height="26"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.2"
									><rect
										x="5"
										y="2"
										width="14"
										height="20"
										rx="2"
										ry="2"
									/><line
										x1="12"
										y1="18"
										x2="12.01"
										y2="18"
									/></svg
								>
							</div>
							<h3 class="bento-title">
								Aplikasi Native PWA di HP
							</h3>
							<p class="bento-desc">
								Pasang langsung ke layar utama Android atau iOS
								Anda tanpa lewat toko aplikasi. Ringan,
								responsif, dan membuka instan secepat aplikasi
								mobile native.
							</p>
							<div class="bento-mini-pill">
								📱 Install Langsung ke Layar HP
							</div>
						</div>
					</div>
				</section>

				<!-- ==============================================
				     SECTION 4: KOMPARASI (KENAPA CATATAI?) (#komparasi)
				     ============================================== -->
				<section class="landing-section-block" id="komparasi">
					<div class="section-header-center">
						<span class="section-kicker"
							>⚖️ PERBANDINGAN CERDAS</span
						>
						<h2 class="section-heading">
							Mengapa Beralih ke CatatAi?
						</h2>
						<p class="section-subtext">
							Lihat bagaimana CatatAi menghemat waktu Anda
							dibandingkan metode manual atau aplikasi
							konvensional.
						</p>
					</div>

					<div class="comparison-table-wrapper">
						<table class="comparison-table">
							<thead>
								<tr>
									<th class="th-feature">Fitur & Kemudahan</th
									>
									<th class="th-catatai highlight-col"
										>CatatAi (Modern AI)</th
									>
									<th class="th-other"
										>Aplikasi Keuangan Lama</th
									>
									<th class="th-other"
										>Spreadsheet Excel Manual</th
									>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td class="td-feature-title"
										>Input Suara (Voice Note)</td
									>
									<td class="highlight-col"
										><span class="badge-yes"
											>✅ Otomatis (Bicara Santai)</span
										></td
									>
									<td
										><span class="badge-no"
											>❌ Tidak Ada</span
										></td
									>
									<td
										><span class="badge-no"
											>❌ Tidak Ada</span
										></td
									>
								</tr>
								<tr>
									<td class="td-feature-title"
										>Scan Foto Bon / Struk Kasir</td
									>
									<td class="highlight-col"
										><span class="badge-yes"
											>✅ AI Vision OCR Terpadu</span
										></td
									>
									<td
										><span class="badge-neutral"
											>⚠️ Terbatas / Perlu Langganan Mahal</span
										></td
									>
									<td
										><span class="badge-no"
											>❌ Harus Ketik Manual Satu per Satu</span
										></td
									>
								</tr>
								<tr>
									<td class="td-feature-title"
										>Cara Catat Transaksi</td
									>
									<td class="highlight-col"
										><span class="badge-yes"
											>✅ Chat Bahasa Manusia Sehari-hari</span
										></td
									>
									<td
										><span class="badge-neutral"
											>⚠️ Buka Form Rumit (10 Dropdown)</span
										></td
									>
									<td
										><span class="badge-neutral"
											>⚠️ Masukkan Baris & Rumus Sendiri</span
										></td
									>
								</tr>
								<tr>
									<td class="td-feature-title"
										>Multi-Dompet & Transfer Antar-Kantong</td
									>
									<td class="highlight-col"
										><span class="badge-yes"
											>✅ Tunai, Bank & E-Wallet Real-Time</span
										></td
									>
									<td
										><span class="badge-neutral"
											>⚠️ Terbatas / Membingungkan</span
										></td
									>
									<td
										><span class="badge-neutral"
											>⚠️ Butuh Sheet & Rumus Tambahan</span
										></td
									>
								</tr>
								<tr>
									<td class="td-feature-title"
										>Waktu Yang Dibutuhkan</td
									>
									<td class="highlight-col"
										><span class="badge-yes"
											>⚡ 2 Detik (Instan)</span
										></td
									>
									<td
										><span class="badge-neutral"
											>⏱️ 1-3 Menit Tiap Bon</span
										></td
									>
									<td
										><span class="badge-neutral"
											>⏱️ 10-20 Menit Tiap Rekap</span
										></td
									>
								</tr>
								<tr>
									<td class="td-feature-title">Biaya Akses</td
									>
									<td class="highlight-col"
										><span class="badge-yes"
											>🎉 Gratis & Mudah Digunakan</span
										></td
									>
									<td
										><span class="badge-neutral"
											>⚠️ Banyak Iklan Mengganggu</span
										></td
									>
									<td
										><span class="badge-neutral"
											>⚠️ Lisensi Office / Waktu Terbuang</span
										></td
									>
								</tr>
							</tbody>
						</table>
					</div>
				</section>

				<!-- ==============================================
				     SECTION 4.5: FAQ ACCORDION (SEO-BOOSTING)
				     ============================================== -->
				<section class="landing-section-block" id="faq">
					<div class="landing-section-head">
						<span class="landing-section-pill">Tanya Jawab</span>
						<h2 class="landing-section-title">
							Kerap Ditanyakan Seputar CatatAi
						</h2>
						<p class="landing-section-sub">
							Jawaban lengkap seputar teknologi pencatatan suara AI, scan nota belanja, keamanan data, dan cara memulai.
						</p>
					</div>

					<div class="landing-faq-container">
						{#each faqList as faq, i}
							<div class="faq-item {activeFaq === i ? 'faq-item-open' : ''}">
								<button
									type="button"
									class="faq-header-btn"
									onclick={() => activeFaq = activeFaq === i ? -1 : i}
									aria-expanded={activeFaq === i}
									id="faq-btn-{i}"
								>
									<div class="faq-question-wrap">
										<span class="faq-badge">{faq.badge}</span>
										<h3 class="faq-question-title">{faq.q}</h3>
									</div>
									<div class="faq-chevron-icon" aria-hidden="true">
										<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
											<path d="m6 9 6 6 6-6"/>
										</svg>
									</div>
								</button>
								{#if activeFaq === i}
									<div class="faq-body-panel" role="region" aria-labelledby="faq-btn-{i}">
										<p class="faq-answer-text">{faq.a}</p>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</section>

				<!-- ==============================================
				     SECTION 5: BOTTOM CALL TO ACTION
				     ============================================== -->
				<section class="landing-bottom-cta">
					<div class="bottom-cta-card">
						<div class="bottom-cta-sparkle">🚀</div>
						<h2 class="bottom-cta-title">
							Siap Atur Finansial Anda Lebih Santai & Rapi?
						</h2>
						<p class="bottom-cta-sub">
							Bergabunglah sekarang. Nikmati kemudahan catat
							pengeluaran lewat suara, scan struk belanja, dan
							kelola multi-dompet tanpa ribet.
						</p>
						<button
							type="button"
							class="btn-cta-bottom"
							onclick={() => {
								authMode = "register";
								document
									.getElementById("auth-box-section")
									?.scrollIntoView({ behavior: "smooth" });
							}}
						>
							Daftar Akun CatatAi Gratis Sekarang ✨
						</button>
					</div>
				</section>
			</main>

			<!-- LANDING FOOTER -->
			<footer class="landing-page-footer">
				<div class="footer-inner">
					<div class="footer-left">
						<div class="footer-brand-title">CatatAi</div>
						<p class="footer-copy">
							© 2026 CatatAi. Platform Pembukuan Finansial Cerdas
							dengan Suara, Scan Struk Vision, & Multi-Dompet.
						</p>
					</div>
					<div class="footer-right">
						<span>Privasi Terisolasi Bank-Grade</span>
						<span class="dot-sep">•</span>
						<span
							>Didukung Neon Serverless PostgreSQL & DeepSeek AI</span
						>
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
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.3"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path
								d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
							/>
						</svg>
					</div>
					<div class="brand-meta">
						<span class="brand-name-bold">CatatAi</span>
						<span class="brand-kpi-sub">
							Hari ini: <strong
								class={totalHariIni.pengeluaran > 0
									? "text-expense"
									: "text-neutral"}
								>{formatRupiah(
									totalHariIni.pengeluaran,
								)}</strong
							>
							<span class="brand-kpi-divider">•</span>
							Minggu ini:
							<strong
								class={totalMingguIni.pengeluaran > 0
									? "text-expense"
									: "text-neutral"}
								>{formatRupiah(
									totalMingguIni.pengeluaran,
								)}</strong
							>
						</span>
					</div>
				</div>

				<!-- CENTER NAVIGATION: CHAT vs REPORT -->
				<div class="header-tier-tabs">
					<div class="modern-segment-bar">
						<button
							class="tab-btn {activeView === 'chat'
								? 'active'
								: ''}"
							onclick={() => {
								activeView = "chat";
								if (reportSubTab !== "bulanan") {
									reportSubTab = "bulanan";
									loadData();
								}
								scrollToBottom();
							}}
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path
									d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
								/>
							</svg>
							<span>Chat Asisten</span>
						</button>
						<button
							class="tab-btn {activeView === 'report'
								? 'active'
								: ''}"
							onclick={() => (activeView = "report")}
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M3 3v18h18" /><path
									d="M18 17V9"
								/><path d="M13 17V5" /><path d="M8 17v-3" />
							</svg>
							<span>Report & Rekap</span>
							{#if transaksiList.length > 0}
								<span class="report-badge-count"
									>{transaksiList.length}</span
								>
							{/if}
						</button>
					</div>
				</div>

				<!-- RIGHT ACTION CLUSTER -->
				<div class="header-actions-cluster">
					<!-- Tombol Panel Admin Khusus Admin Miftah -->
					{#if currentUser?.role === "admin" || currentUser?.email === "miftahdev7@gmail.com"}
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
						onclick={() => {
							resetForm();
							showModalTambah = true;
						}}
						title="Catat Manual"
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.6"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<line x1="12" y1="5" x2="12" y2="19" /><line
								x1="5"
								y1="12"
								x2="19"
								y2="12"
							/>
						</svg>
						<span>Catat</span>
					</button>

					<!-- User Profile Avatar Button with PRO badge -->
					<button
						class="btn-avatar-profile"
						onclick={() => (showProfileModal = true)}
						title="Profil & Pengaturan Akun {currentUser.tier ===
						'pro'
							? '(CatatAi PRO Aktif ⭐)'
							: ''}"
						aria-label="Profil Akun"
					>
						<span class="avatar-letter-wrapper">
							<span class="avatar-letter"
								>{currentUser.nama
									.charAt(0)
									.toUpperCase()}</span
							>
							{#if currentUser.tier === "pro"}
								<span
									class="avatar-pro-badge"
									title="CatatAi PRO">⭐</span
								>
							{/if}
						</span>
						<span class="desktop-user-name">{currentUser.nama}</span
						>
						{#if currentUser.tier === "pro"}
							<span class="desktop-pro-pill">PRO</span>
						{/if}
					</button>
				</div>
			</div>
		</header>

		<!-- ALERTS -->
		{#if errorMsg}
			<div class="app-alert alert-danger">
				<div class="alert-content">
					<svg
						width="15"
						height="15"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><circle cx="12" cy="12" r="10" /><line
							x1="12"
							y1="8"
							x2="12"
							y2="12"
						/><line x1="12" y1="16" x2="12.01" y2="16" /></svg
					>
					<span>{errorMsg}</span>
				</div>
				<button
					class="alert-close"
					aria-label="Tutup notifikasi"
					onclick={() => (errorMsg = "")}
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						><line x1="18" y1="6" x2="6" y2="18" /><line
							x1="6"
							y1="6"
							x2="18"
							y2="18"
						/></svg
					>
				</button>
			</div>
		{/if}
		{#if successMsg}
			<div class="app-alert alert-success">
				<div class="alert-content">
					<svg
						width="15"
						height="15"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path
							d="M22 11.08V12a10 10 0 1 1-5.93-9.14"
						/><polyline points="22 4 12 14.01 9 11.01" /></svg
					>
					<span>{successMsg}</span>
				</div>
				<button
					class="alert-close"
					aria-label="Tutup notifikasi"
					onclick={() => (successMsg = "")}
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						><line x1="18" y1="6" x2="6" y2="18" /><line
							x1="6"
							y1="6"
							x2="18"
							y2="18"
						/></svg
					>
				</button>
			</div>
		{/if}

		<!-- MAIN CONTENT -->
		<main class="app-main">
			<!-- ==============================================
			     VIEW 1: MODE CHAT MOBILE-FIRST (CLEAN NO DOUBLE HEADER)
			     ============================================== -->
			{#if activeView === "chat"}
				<div class="chat-layout-wrapper">
					<div class="chat-mobile-container">
						<!-- Filter Indikator Aktif (Hanya muncul jika user sedang memfilter dompet tertentu) -->
						{#if selectedDompetFilter}
							{@const curDompet = dompetList.find(
								(d) => d.id === selectedDompetFilter,
							)}
							<div class="chat-active-filter-strip">
								<div class="caf-info">
									<span class="caf-icon"
										>{getDompetIcon(curDompet?.tipe)}</span
									>
									<span
										>Filter: <strong
											>{curDompet?.nama ||
												"Dompet"}</strong
										></span
									>
									<span class="caf-bal"
										>({formatRupiah(
											curDompet?.saldo_sekarang,
										)})</span
									>
								</div>
								<button
									type="button"
									class="btn-caf-clear"
									onclick={() => selectDompetFilter(null)}
								>
									✕ Semua
								</button>
							</div>
						{/if}

						<!-- Messages Stream (WITH SUBTLE DOODLE BACKGROUND) -->
						<div
							class="chat-stream-viewport"
							bind:this={chatMessagesContainer}
						>
							<!-- DATE DIVIDER PILL (CHAT STYLE) -->
							<div class="chat-date-divider-wrap">
								<span class="chat-date-pill"
									>{formatTglHari(todayTanggal)}</span
								>
							</div>

							{#each chatMessages as msg}
								<div
									class="msg-bubble-row {msg.role === 'user'
										? 'user-side'
										: 'bot-side'}"
								>
									{#if msg.role === "assistant"}
										<div class="bot-tiny-avatar">
											<svg
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<path
													d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
												/>
											</svg>
										</div>
									{/if}

									<div class="msg-card">
										{#if msg.image}
											<div class="msg-media-wrap">
												<img
													src={msg.image}
													alt="Nota Transaksi"
													class="msg-media-img"
												/>
											</div>
										{/if}

										{#if msg.isTxCard && msg.txData}
											<!-- CHAT HISTORY CARD TRANSAKSI HARI INI -->
											<div class="chat-tx-bubble-card">
												<div class="ctx-card-top">
													<div class="ctx-card-brand">
														<div
															class="ctx-card-avatar {msg
																.txData.tipe ===
															'pemasukan'
																? 'avatar-in'
																: 'avatar-out'}"
														>
															{#if msg.txData.tipe === "pemasukan"}
																<svg
																	width="15"
																	height="15"
																	viewBox="0 0 24 24"
																	fill="none"
																	stroke="currentColor"
																	stroke-width="2.5"
																	><path
																		d="M12 5v14M19 12l-7 7-7-7"
																	/></svg
																>
															{:else}
																<svg
																	width="15"
																	height="15"
																	viewBox="0 0 24 24"
																	fill="none"
																	stroke="currentColor"
																	stroke-width="2.5"
																	><path
																		d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"
																	/><line
																		x1="3"
																		y1="6"
																		x2="21"
																		y2="6"
																	/></svg
																>
															{/if}
														</div>
														<div
															class="ctx-card-info"
														>
															<span
																class="ctx-card-title"
																>{msg.txData
																	.toko ||
																	(msg.txData
																		.tipe ===
																	"pemasukan"
																		? "Pemasukan"
																		: "Transaksi")}</span
															>
															<span
																class="ctx-card-meta"
																>{msg.txData.waktu?.slice(
																	0,
																	5,
																) || "-"} • {msg
																	.txData
																	.kategori} •
																{msg.txData
																	.metode_bayar}</span
															>
														</div>
													</div>
													<div
														class="ctx-card-amount {msg
															.txData.tipe ===
														'pemasukan'
															? 'color-income'
															: 'color-expense'}"
													>
														{msg.txData.tipe ===
														"pemasukan"
															? "+"
															: "-"}{formatRupiah(
															msg.txData.total,
														)}
													</div>
												</div>

												{#if msg.txData.catatan}
													<div class="ctx-card-note">
														"{msg.txData.catatan}"
													</div>
												{/if}

												{#if msg.txData.items && msg.txData.items.length > 0}
													<div
														class="ctx-card-mini-items"
													>
														{#each msg.txData.items as itm}
															<div
																class="ctx-mini-item-row"
															>
																<span
																	>{itm.qty}x {itm.nama_barang}</span
																>
																<span
																	>{formatRupiah(
																		itm.subtotal ||
																			itm.qty *
																				itm.harga_satuan,
																	)}</span
																>
															</div>
														{/each}
													</div>
												{/if}

												<div class="ctx-card-footer">
													<span
														class="ctx-saved-label"
													>
														<svg
															width="12"
															height="12"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2.6"
															><polyline
																points="20 6 9 17 4 12"
															/></svg
														>
														<span
															>Tersimpan hari ini</span
														>
													</span>
													<button
														type="button"
														class="btn-ctx-detail"
														onclick={() =>
															openDetail(
																msg.txData.id,
															)}
														title="Lihat rincian nota & foto struk"
													>
														Lihat Detail Nota →
													</button>
												</div>
											</div>
										{:else}
											<div class="msg-text-content">
												{#if msg.is_voice}
													<div
														class="voice-note-tag"
														title="Pesan Suara"
													>
														<svg
															width="12"
															height="12"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2.5"
															><path
																d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
															/><path
																d="M19 10v2a7 7 0 0 1-14 0v-2"
															/><line
																x1="12"
																y1="19"
																x2="12"
																y2="23"
															/><line
																x1="8"
																y1="23"
																x2="16"
																y2="23"
															/></svg
														>
														<span>Pesan Suara</span>
													</div>
												{/if}
												{msg.content}
											</div>
										{/if}

										<!-- DRAFT TRANSAKSI CARD INTERAKTIF -->
										{#if msg.draft}
											<div class="tx-draft-box">
												<div class="draft-topline">
													<div
														class="draft-badge-title-row"
													>
														{#if msg.draft.tipe === "pemasukan"}
															<svg
																class="draft-icon-income"
																width="16"
																height="16"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="2.2"
																stroke-linecap="round"
																stroke-linejoin="round"
															>
																<line
																	x1="12"
																	y1="5"
																	x2="12"
																	y2="19"
																/><polyline
																	points="19 12 12 19 5 12"
																/>
															</svg>
															<span
																>Pemasukan
																Terdeteksi</span
															>
														{:else}
															<svg
																class="draft-icon-expense"
																width="16"
																height="16"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="2.2"
																stroke-linecap="round"
																stroke-linejoin="round"
															>
																<line
																	x1="12"
																	y1="19"
																	x2="12"
																	y2="5"
																/><polyline
																	points="5 12 12 5 19 12"
																/>
															</svg>
															<span
																>Pengeluaran
																Terdeteksi</span
															>
														{/if}
													</div>
													<span
														class="pill-type {msg
															.draft.tipe ===
														'pemasukan'
															? 'pill-income'
															: 'pill-expense'}"
													>
														{msg.draft.tipe.toUpperCase()}
													</span>
												</div>

												<div class="draft-grid-info">
													<div class="draft-col">
														<span class="col-k"
															>{msg.draft.tipe ===
															"pemasukan"
																? "Sumber / Dari:"
																: "Toko / Merchant:"}</span
														>
														<span class="col-v-bold"
															>{msg.draft.toko ||
																"-"}</span
														>
													</div>
													<div class="draft-col">
														<span class="col-k"
															>Kategori:</span
														>
														<span class="col-tag"
															>{msg.draft
																.kategori}</span
														>
													</div>
													<div class="draft-col">
														<span class="col-k"
															>Tanggal:</span
														>
														<span class="col-v"
															>{formatTgl(
																msg.draft
																	.tanggal,
															)}</span
														>
													</div>
													<div class="draft-col">
														<span class="col-k"
															>Metode:</span
														>
														<span
															class="col-v method-tag"
														>
															<svg
																width="12"
																height="12"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="2"
																stroke-linecap="round"
																stroke-linejoin="round"
																><rect
																	x="1"
																	y="4"
																	width="22"
																	height="16"
																	rx="2"
																	ry="2"
																/><line
																	x1="1"
																	y1="10"
																	x2="23"
																	y2="10"
																/></svg
															>
															<span
																>{msg.draft
																	.metode_bayar}</span
															>
														</span>
													</div>
												</div>

												{#if msg.draft.items && msg.draft.items.length > 0}
													<div
														class="draft-itemized-list"
													>
														{#each msg.draft.items as item}
															<div
																class="draft-item-entry"
															>
																<span
																	>{item.qty}x {item.nama_barang}</span
																>
																<span
																	class="entry-sub"
																	>{formatRupiah(
																		item.subtotal ||
																			item.qty *
																				item.harga_satuan,
																	)}</span
																>
															</div>
														{/each}
													</div>
												{/if}

												<div class="draft-total-banner">
													<span class="tot-caption"
														>Total {msg.draft
															.tipe ===
														"pemasukan"
															? "Masuk"
															: "Transaksi"}:</span
													>
													<span
														class="tot-val {msg
															.draft.tipe ===
														'pemasukan'
															? 'color-income'
															: 'color-expense'}"
													>
														{msg.draft.tipe ===
														"pemasukan"
															? "+"
															: "-"}
														{formatRupiah(
															msg.draft.total,
														)}
													</span>
												</div>

												<!-- BAGIAN TOMBOL AKSI: HILANG BEGITU SUDAH DIKLIK / DIKONFIRMASI -->
												{#if msg.draft.status === "saved"}
													<div
														class="draft-status-pill pill-saved"
													>
														<svg
															width="15"
															height="15"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2.5"
															stroke-linecap="round"
															stroke-linejoin="round"
															><path
																d="M22 11.08V12a10 10 0 1 1-5.93-9.14"
															/><polyline
																points="22 4 12 14.01 9 11.01"
															/></svg
														>
														<span
															>Transaksi Berhasil
															Disimpan</span
														>
													</div>
												{:else if msg.draft.status === "cancelled"}
													<div
														class="draft-status-pill pill-cancelled"
													>
														<svg
															width="15"
															height="15"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2.5"
															stroke-linecap="round"
															stroke-linejoin="round"
															><circle
																cx="12"
																cy="12"
																r="10"
															/><line
																x1="15"
																y1="9"
																x2="9"
																y2="15"
															/><line
																x1="9"
																y1="9"
																x2="15"
																y2="15"
															/></svg
														>
														<span
															>Draft Transaksi
															Dibatalkan</span
														>
													</div>
												{:else}
													<div
														class="draft-action-block"
													>
														<span
															class="action-question"
															>Apakah data di atas
															sudah betul?</span
														>

														<div
															class="buttons-grid"
														>
															<!-- Tombol Utama: Simpan -->
															<button
																class="btn-primary-confirm"
																onclick={() =>
																	confirmDraftDirectly(
																		msg,
																	)}
															>
																<svg
																	width="16"
																	height="16"
																	viewBox="0 0 24 24"
																	fill="none"
																	stroke="currentColor"
																	stroke-width="2.8"
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	><polyline
																		points="20 6 9 17 4 12"
																	/></svg
																>
																<span
																	>Ya, Simpan
																	Sekarang!</span
																>
															</button>

															<!-- Baris Tombol Tambahan: Koreksi & Batal -->
															<div
																class="buttons-sub-row"
															>
																<button
																	class="btn-sub-edit"
																	onclick={() =>
																		editDraftManually(
																			msg.draft,
																		)}
																>
																	<svg
																		width="13"
																		height="13"
																		viewBox="0 0 24 24"
																		fill="none"
																		stroke="currentColor"
																		stroke-width="2"
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		><path
																			d="M12 20h9"
																		/><path
																			d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
																		/></svg
																	>
																	<span
																		>Koreksi</span
																	>
																</button>
																<button
																	class="btn-sub-cancel"
																	onclick={() =>
																		cancelDraftDirectly(
																			msg,
																		)}
																>
																	<svg
																		width="13"
																		height="13"
																		viewBox="0 0 24 24"
																		fill="none"
																		stroke="currentColor"
																		stroke-width="2.2"
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		><line
																			x1="18"
																			y1="6"
																			x2="6"
																			y2="18"
																		/><line
																			x1="6"
																			y1="6"
																			x2="18"
																			y2="18"
																		/></svg
																	>
																	<span
																		>Batal</span
																	>
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
													<svg
														width="14"
														height="14"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														stroke-linecap="round"
														stroke-linejoin="round"
														><path
															d="M22 11.08V12a10 10 0 1 1-5.93-9.14"
														/><polyline
															points="22 4 12 14.01 9 11.01"
														/></svg
													>
													<span
														>Tersimpan ke database!</span
													>
												</div>
												<button
													class="btn-detail-link"
													onclick={() =>
														openDetail(msg.savedId)}
													>Lihat Detail</button
												>
											</div>
										{/if}

										<div class="msg-footer-meta">
											<span class="msg-time"
												>{msg.time}</span
											>
											{#if msg.role === "user"}
												<svg
													class="msg-check-svg"
													width="14"
													height="10"
													viewBox="0 0 16 11"
													fill="none"
													stroke="#2563eb"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
												>
													<path
														d="M1 6l3.5 3.5L11 2"
													/>
													<path
														d="M5 6l3.5 3.5L15 2"
													/>
												</svg>
											{/if}
										</div>
									</div>
								</div>
							{/each}

							{#if chatLoading}
								<div class="msg-bubble-row bot-side">
									<div class="bot-tiny-avatar">
										<svg
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path
												d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
											/>
										</svg>
									</div>
									<div class="msg-card msg-loading-card">
										<span class="bounce-dot"></span>
										<span class="bounce-dot"></span>
										<span class="bounce-dot"></span>
										<span class="loading-label"
											>Menganalisis transaksi...</span
										>
									</div>
								</div>
							{/if}
						</div>

						<!-- Attached Image Bar -->
						{#if chatAttachedImage}
							<div class="attached-media-bar">
								<div class="thumb-container">
									<img
										src={chatAttachedImage}
										alt="Lampiran"
										class="thumb-img"
									/>
									<button
										class="btn-remove-thumb"
										aria-label="Hapus lampiran"
										onclick={removeChatImage}
										title="Hapus foto"
									>
										<svg
											width="10"
											height="10"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.5"
											><line
												x1="18"
												y1="6"
												x2="6"
												y2="18"
											/><line
												x1="6"
												y1="6"
												x2="18"
												y2="18"
											/></svg
										>
									</button>
								</div>
								<span class="thumb-caption"
									>Foto nota siap dianalisis</span
								>
							</div>
						{/if}

						<!-- STICKY INPUT BAR (BOTTOM) -->
						<div class="chat-bottom-dock">
							<!-- QUOTA STRIP & PRO NOTICE -->
							{#if currentUser?.tier !== "pro"}
								{#if (currentUser?.sisa_kuota ?? 5) <= 0}
									<div class="quota-exhausted-banner">
										<div class="exhausted-text">
											<strong
												>Batas 5 pesan gratis hari ini
												tercapai</strong
											>
											<span
												>Upgrade ke CatatAi PRO untuk
												melanjutkan chat tanpa batas!</span
											>
										</div>
										<button
											type="button"
											class="btn-exhausted-upgrade"
											onclick={() =>
												(showUpgradeModal = true)}
										>
											Aktifkan PRO ⭐
										</button>
									</div>
								{:else}
									<div class="chat-quota-strip">
										<div class="quota-info-pill">
											<svg
												width="12"
												height="12"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2.2"
												><circle
													cx="12"
													cy="12"
													r="10"
												/><polyline
													points="12 6 12 12 16 14"
												/></svg
											>
											<span
												>Sisa Kuota: <strong
													>{currentUser?.sisa_kuota ??
														5} / 5 pesan gratis hari
													ini</strong
												></span
											>
										</div>
										<button
											type="button"
											class="btn-quota-pro-link"
											onclick={() =>
												(showUpgradeModal = true)}
										>
											Buka Unlimited (PRO) ⭐
										</button>
									</div>
								{/if}
							{/if}

							<div class="chat-quick-shortcuts">
								<button
									type="button"
									class="quick-chip-btn"
									onclick={() =>
										sendChatMessage("ringkasan minggu ini")}
								>
									<span>📊 Ringkasan Minggu Ini</span>
								</button>
								<button
									type="button"
									class="quick-chip-btn"
									onclick={() =>
										sendChatMessage("ringkasan hari ini")}
								>
									<span>📅 Hari Ini</span>
								</button>
								<button
									type="button"
									class="quick-chip-btn"
									onclick={() => {
										activeView = "report";
										switchReportSubTab("mingguan");
									}}
								>
									<span>📈 Grafik 7 Hari</span>
								</button>
							</div>

							<form
								class="dock-form-row {isRecordingVoice
									? 'is-recording-mode'
									: ''}"
								onsubmit={(e) => {
									e.preventDefault();
									if (isRecordingVoice) {
										stopVoiceRecording(true);
									} else {
										sendChatMessage();
									}
								}}
							>
								{#if isRecordingVoice}
									<!-- RECORDING ACTIVE STATE -->
									<div class="voice-recording-pill">
										<div class="vrp-pulse-dot"></div>
										<span class="vrp-timer"
											>{formatDuration(
												voiceRecordSeconds,
											)}</span
										>
										<div class="vrp-waves">
											<span></span><span></span><span
											></span><span></span>
										</div>
										<span class="vrp-status-text"
											>{chatInput.trim()
												? chatInput
												: "Mendengarkan suara Anda..."}</span
										>
									</div>

									<button
										type="button"
										class="btn-dock-cancel-voice"
										onclick={cancelVoiceRecording}
										title="Batalkan Rekaman"
									>
										<svg
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.4"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<line
												x1="18"
												y1="6"
												x2="6"
												y2="18"
											/><line
												x1="6"
												y1="6"
												x2="18"
												y2="18"
											/>
										</svg>
									</button>

									<button
										type="button"
										class="btn-dock-send btn-dock-send-voice"
										onclick={() => stopVoiceRecording(true)}
										title="Selesai & Analisis AI"
									>
										<svg
											width="17"
											height="17"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<line
												x1="22"
												y1="2"
												x2="11"
												y2="13"
											/>
											<polygon
												points="22 2 15 22 11 13 2 9 22 2"
											/>
										</svg>
									</button>
								{:else}
									<label
										class="btn-dock-attach"
										title="Kirim Foto Nota"
									>
										<svg
											width="19"
											height="19"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path
												d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
											/>
											<circle cx="12" cy="13" r="4" />
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
										placeholder={currentUser?.tier !==
											"pro" &&
										(currentUser?.sisa_kuota ?? 5) <= 0
											? "Batas 5 pesan gratis tercapai. Upgrade ke PRO untuk lanjut..."
											: "Ketik atau tekan tombol mic untuk suara..."}
										bind:value={chatInput}
										disabled={chatLoading ||
											(currentUser?.tier !== "pro" &&
												(currentUser?.sisa_kuota ??
													5) <= 0)}
									/>

									{#if chatInput.trim() || chatAttachedImage}
										<button
											type="submit"
											class="btn-dock-send"
											disabled={chatLoading}
											title="Kirim Pesan"
										>
											<svg
												width="17"
												height="17"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2.2"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<line
													x1="22"
													y1="2"
													x2="11"
													y2="13"
												/>
												<polygon
													points="22 2 15 22 11 13 2 9 22 2"
												/>
											</svg>
										</button>
									{:else}
										<button
											type="button"
											class="btn-dock-mic"
											onclick={startVoiceRecording}
											disabled={chatLoading ||
												(currentUser?.tier !== "pro" &&
													(currentUser?.sisa_kuota ??
														5) <= 0)}
											title="Rekam Suara (Voice Note untuk Analisis AI)"
										>
											<svg
												width="18"
												height="18"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2.2"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<path
													d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
												/>
												<path
													d="M19 10v2a7 7 0 0 1-14 0v-2"
												/>
												<line
													x1="12"
													y1="19"
													x2="12"
													y2="23"
												/>
												<line
													x1="8"
													y1="23"
													x2="16"
													y2="23"
												/>
											</svg>
										</button>
									{/if}
								{/if}
							</form>
						</div>
					</div>

					<!-- DESKTOP COMPANION SIDEBAR (LIVE FINANCE PULSE) -->
					<aside class="chat-desktop-companion">
						<!-- Card 0: Dompet & Rekening -->
						<div class="companion-card companion-dompet-card">
							<div class="companion-card-header">
								<div class="c-head-title-row">
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<rect
											x="1"
											y="4"
											width="22"
											height="16"
											rx="2"
											ry="2"
										/><line
											x1="1"
											y1="10"
											x2="23"
											y2="10"
										/>
									</svg>
									<span class="companion-card-title"
										>Dompet & Rekening</span
									>
								</div>
								<div class="companion-dompet-hdr-acts">
									<button
										type="button"
										class="c-mini-act"
										onclick={() => openTransferModal()}
										title="Transfer Antar Dompet"
										>⇄ Transfer</button
									>
								</div>
							</div>

							<div class="companion-total-balance-box">
								<span class="ctb-lbl">Total Saldo Bersih</span>
								<span class="ctb-val"
									>{formatRupiah(totalSaldoDompet)}</span
								>
							</div>

							<div class="companion-dompet-list">
								{#each dompetList as d}
									<div
										class="companion-dompet-item {selectedDompetFilter ===
										d.id
											? 'active-filter'
											: ''}"
										onclick={() => selectDompetFilter(d.id)}
										onkeydown={(e) => {
											if (e.key === "Enter")
												selectDompetFilter(d.id);
										}}
										role="button"
										tabindex="0"
										title="Klik untuk filter catatan dompet ini"
									>
										<div class="cdi-left">
											<span class="cdi-icon"
												>{getDompetIcon(d.tipe)}</span
											>
											<div class="cdi-meta">
												<span class="cdi-name"
													>{d.nama}</span
												>
												<span class="cdi-tipe"
													>{d.tipe}</span
												>
											</div>
										</div>
										<div class="cdi-right">
											<span class="cdi-bal"
												>{formatRupiah(
													d.saldo_sekarang,
												)}</span
											>
											<button
												type="button"
												class="cdi-edit"
												onclick={(e) => {
													e.stopPropagation();
													openEditDompet(d);
												}}
												title="Ubah Dompet"
											>
												✏️
											</button>
										</div>
									</div>
								{/each}
							</div>
						</div>

						<!-- Card 1: Ringkasan Saldo (Minggu Ini & Bulan Ini) -->
						<div class="companion-card">
							<div class="companion-card-header">
								<div class="c-head-title-row">
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="M3 3v18h18" /><path
											d="M18 17V9"
										/><path d="M13 17V5" /><path
											d="M8 17v-3"
										/>
									</svg>
									<span class="companion-card-title"
										>{companionPeriodTab === "minggu"
											? "Ringkasan Minggu Ini"
											: "Ringkasan Bulan Ini"}</span
									>
								</div>
								<div class="companion-switch-pill">
									<button
										type="button"
										class="c-switch-btn {companionPeriodTab ===
										'minggu'
											? 'active'
											: ''}"
										onclick={() =>
											(companionPeriodTab = "minggu")}
									>
										Minggu
									</button>
									<button
										type="button"
										class="c-switch-btn {companionPeriodTab ===
										'bulan'
											? 'active'
											: ''}"
										onclick={() =>
											(companionPeriodTab = "bulan")}
									>
										Bulan
									</button>
								</div>
							</div>

							{#if companionPeriodTab === "minggu"}
								<div class="companion-period-info-row">
									<span class="c-period-text"
										>📅 {formatTgl(
											totalMingguIni.start_date,
										)} — {formatTgl(
											totalMingguIni.end_date,
										)}</span
									>
									<span class="companion-count-pill"
										>{totalMingguIni.total_transaksi} Transaksi</span
									>
								</div>

								<div class="companion-stats-grid">
									<div class="cstat-item">
										<span class="cstat-label"
											>Pengeluaran</span
										>
										<span class="cstat-val color-expense"
											>{formatRupiah(
												totalMingguIni.pengeluaran,
											)}</span
										>
									</div>
									<div class="cstat-item">
										<span class="cstat-label"
											>Pemasukan</span
										>
										<span class="cstat-val color-income"
											>{formatRupiah(
												totalMingguIni.pemasukan,
											)}</span
										>
									</div>
								</div>

								<div class="companion-net-row">
									<span class="cstat-net-lbl"
										>Saldo Bersih</span
									>
									<span
										class="cstat-net-val {totalMingguIni.saldo_bersih >=
										0
											? 'color-income'
											: 'color-expense'}"
									>
										{totalMingguIni.saldo_bersih >= 0
											? "+"
											: ""}{formatRupiah(
											totalMingguIni.saldo_bersih,
										)}
									</span>
								</div>

								<div class="companion-today-row">
									<span>Pengeluaran Hari Ini</span>
									<strong
										class={totalHariIni.pengeluaran > 0
											? "color-expense"
											: "text-neutral"}
										>{formatRupiah(
											totalHariIni.pengeluaran,
										)}</strong
									>
								</div>

								<button
									type="button"
									class="companion-link-btn"
									onclick={() => {
										activeView = "report";
										switchReportSubTab("mingguan");
									}}
								>
									<span>Buka Laporan Mingguan Lengkap</span>
									<svg
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										><polyline
											points="9 18 15 12 9 6"
										/></svg
									>
								</button>
							{:else}
								<div class="companion-period-info-row">
									<span class="c-period-text"
										>📅 Bulan {selectedBulan}</span
									>
									<span class="companion-count-pill"
										>{rekap.total_transaksi} Transaksi</span
									>
								</div>

								<div class="companion-stats-grid">
									<div class="cstat-item">
										<span class="cstat-label"
											>Pengeluaran</span
										>
										<span class="cstat-val color-expense"
											>{formatRupiah(
												rekap.total_pengeluaran,
											)}</span
										>
									</div>
									<div class="cstat-item">
										<span class="cstat-label"
											>Pemasukan</span
										>
										<span class="cstat-val color-income"
											>{formatRupiah(
												rekap.total_pemasukan,
											)}</span
										>
									</div>
								</div>

								<div class="companion-net-row">
									<span class="cstat-net-lbl"
										>Saldo Bersih</span
									>
									<span
										class="cstat-net-val {rekap.saldo_bersih >=
										0
											? 'color-income'
											: 'color-expense'}"
									>
										{rekap.saldo_bersih >= 0
											? "+"
											: ""}{formatRupiah(
											rekap.saldo_bersih,
										)}
									</span>
								</div>

								<div class="companion-today-row">
									<span>Pengeluaran Hari Ini</span>
									<strong
										class={totalHariIni.pengeluaran > 0
											? "color-expense"
											: "text-neutral"}
										>{formatRupiah(
											totalHariIni.pengeluaran,
										)}</strong
									>
								</div>

								<button
									type="button"
									class="companion-link-btn"
									onclick={() => {
										activeView = "report";
										switchReportSubTab("bulanan");
									}}
								>
									<span>Buka Laporan Bulanan Lengkap</span>
									<svg
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										><polyline
											points="9 18 15 12 9 6"
										/></svg
									>
								</button>
							{/if}
						</div>

						<!-- Card 2: Catatan Hari Ini (Live Feed) -->
						<div class="companion-card">
							<div class="companion-card-header">
								<div class="c-head-title-row">
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<rect
											x="3"
											y="4"
											width="18"
											height="18"
											rx="2"
											ry="2"
										/>
										<line x1="16" y1="2" x2="16" y2="6" />
										<line x1="8" y1="2" x2="8" y2="6" />
										<line x1="3" y1="10" x2="21" y2="10" />
									</svg>
									<span class="companion-card-title"
										>Catatan Hari Ini</span
									>
								</div>
								<span class="companion-period-pill"
									>{formatTgl(todayTanggal)}</span
								>
							</div>

							{#if transaksiHariIni.length > 0}
								<div class="companion-tx-list">
									{#each transaksiHariIni as t}
										<div
											class="companion-tx-item"
											onclick={() => openDetail(t.id)}
											onkeydown={(e) => {
												if (e.key === "Enter")
													openDetail(t.id);
											}}
											role="button"
											tabindex="0"
											title="Klik untuk rincian"
										>
											<div
												class="ctx-icon {t.tipe ===
												'pemasukan'
													? 'icon-green'
													: 'icon-red'}"
											>
												{#if t.tipe === "pemasukan"}
													<svg
														width="13"
														height="13"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2.4"
														><path
															d="M12 5v14M19 12l-7 7-7-7"
														/></svg
													>
												{:else}
													<svg
														width="13"
														height="13"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2.4"
														><path
															d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"
														/><line
															x1="3"
															y1="6"
															x2="21"
															y2="6"
														/></svg
													>
												{/if}
											</div>
											<div class="ctx-body">
												<span class="ctx-title"
													>{t.toko ||
														(t.tipe === "pemasukan"
															? "Pemasukan"
															: "Transaksi")}</span
												>
												<span class="ctx-meta"
													>{t.waktu?.slice(0, 5) ||
														"-"} • {t.kategori}</span
												>
											</div>
											<div class="ctx-amount-cluster">
												<span
													class="ctx-amt {t.tipe ===
													'pemasukan'
														? 'color-income'
														: 'color-expense'}"
												>
													{t.tipe === "pemasukan"
														? "+"
														: "-"}{formatRupiah(
														t.total,
													)}
												</span>
												<button
													type="button"
													class="btn-row-edit"
													title="Edit Transaksi"
													aria-label="Edit Transaksi"
													onclick={(e) => {
														e.stopPropagation();
														openEditTransaksi(t);
													}}
												>
													<svg
														width="11"
														height="11"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2.2"
														stroke-linecap="round"
														stroke-linejoin="round"
													>
														<path
															d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
														/>
														<path
															d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
														/>
													</svg>
												</button>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="companion-empty">
									<svg
										width="20"
										height="20"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										style="margin-bottom: 4px; opacity: 0.6;"
										><circle cx="12" cy="12" r="10" /><line
											x1="12"
											y1="8"
											x2="12"
											y2="12"
										/><line
											x1="12"
											y1="16"
											x2="12.01"
											y2="16"
										/></svg
									>
									<div>Belum ada transaksi hari ini.</div>
									<div
										style="font-size: 0.72rem; color: #8c8479; margin-top: 2px;"
									>
										Ketik pesan di chat untuk mencatat.
									</div>
								</div>
							{/if}
						</div>

						<!-- Card 3: Tips & Perintah AI -->
						<div class="companion-card tips-card">
							<div class="companion-card-header">
								<div class="c-head-title-row">
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path
											d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
										/>
									</svg>
									<span class="companion-card-title"
										>Pintasan Catat Cepat</span
									>
								</div>
							</div>
							<div class="companion-tips-body">
								<div class="tip-line">
									<span class="tip-kbd">Ketik:</span>
									<span class="tip-text"
										>"Beli kopi gula aren 18k"</span
									>
								</div>
								<div class="tip-line">
									<span class="tip-kbd">Ketik:</span>
									<span class="tip-text"
										>"Gaji bulanan masuk 10jt"</span
									>
								</div>
								<div class="tip-line">
									<span class="tip-kbd">Kamera:</span>
									<span class="tip-text"
										>Upload / seret foto struk kasir</span
									>
								</div>
								<div class="tip-line">
									<span class="tip-kbd">Enter:</span>
									<span class="tip-text"
										>Kirim langsung tanpa klik tombol</span
									>
								</div>
							</div>
						</div>
					</aside>
				</div>
			{/if}

			{#if activeView === "report"}
				<div class="report-mobile-container">
					<!-- HUB DOMPET & REKENING (ELEGANT DASHBOARD CARD) -->
					<div class="report-dompet-hub-card">
						<div class="rdh-head">
							<div class="rdh-title-group">
								<span class="rdh-badge">MULTI-DOMPET</span>
								<h3 class="rdh-title">Dompet & Rekening</h3>
							</div>
							<div class="rdh-actions">
								<button
									type="button"
									class="btn-rdh-act btn-rdh-trf"
									onclick={() => openTransferModal()}
									title="Transfer Saldo"
								>
									<svg
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										><polyline
											points="17 1 21 5 17 9"
										/><path
											d="M3 11V9a4 4 0 0 1 4-4h14"
										/><polyline
											points="7 23 3 19 7 15"
										/><path
											d="M21 13v2a4 4 0 0 1-4 4H3"
										/></svg
									>
									<span>Transfer</span>
								</button>
								<button
									type="button"
									class="btn-rdh-act btn-rdh-add"
									onclick={openCreateDompet}
									title="Tambah Dompet"
								>
									<span>+ Dompet</span>
								</button>
							</div>
						</div>

						<!-- Horizontal Cards Scroll -->
						<div class="rdh-cards-scroll">
							<!-- Card Semua Dompet -->
							<button
								type="button"
								class="rdh-card card-all {selectedDompetFilter ===
								null
									? 'active-filter'
									: ''}"
								onclick={() => selectDompetFilter(null)}
								title="Filter: Semua Dompet"
							>
								<div class="rdhc-top">
									<span class="rdhc-badge">SEMUA</span>
									<span
										class="rdhc-dot {selectedDompetFilter ===
										null
											? 'dot-active'
											: ''}"
									></span>
								</div>
								<div class="rdhc-name">Total Saldo Bersih</div>
								<div class="rdhc-val">
									{formatRupiah(totalSaldoDompet)}
								</div>
							</button>

							{#each dompetList as d}
								<div
									class="rdh-card {selectedDompetFilter ===
									d.id
										? 'active-filter'
										: ''}"
									style="--card-color: {d.warna || '#2563eb'}"
									onclick={() => selectDompetFilter(d.id)}
									onkeydown={(e) => {
										if (e.key === "Enter")
											selectDompetFilter(d.id);
									}}
									role="button"
									tabindex="0"
									title="Klik untuk filter transaksi {d.nama}"
								>
									<div class="rdhc-top">
										<span class="rdhc-icon"
											>{getDompetIcon(d.tipe)}</span
										>
										<div class="rdhc-top-right">
											<span class="rdhc-tipe"
												>{d.tipe}</span
											>
											<button
												type="button"
												class="rdhc-edit-btn"
												onclick={(e) => {
													e.stopPropagation();
													openEditDompet(d);
												}}
												title="Edit Dompet"
											>
												✏️
											</button>
										</div>
									</div>
									<div class="rdhc-name">{d.nama}</div>
									<div class="rdhc-val">
										{formatRupiah(d.saldo_sekarang)}
									</div>
								</div>
							{/each}
						</div>

						{#if selectedDompetFilter}
							{@const curD = dompetList.find(
								(d) => d.id === selectedDompetFilter,
							)}
							<div class="rdh-filter-status-bar">
								<span
									>🔍 Filter laporan: <strong
										>{curD?.nama || "Dompet"}</strong
									></span
								>
								<button
									type="button"
									class="btn-rdh-reset"
									onclick={() => selectDompetFilter(null)}
								>
									✕ Tampilkan Semua Dompet
								</button>
							</div>
						{/if}
					</div>

					<!-- Control Toolbar -->
					<div class="report-header-card">
						{#if reportSubTab === "bulanan"}
							<div class="period-picker-row">
								<button
									class="btn-arrow-month"
									onclick={prevMonth}
									aria-label="Bulan Sebelumnya"
								>
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										stroke-linecap="round"
										stroke-linejoin="round"
										><polyline
											points="15 18 9 12 15 6"
										/></svg
									>
								</button>
								<input
									type="month"
									class="picker-month-native"
									bind:value={selectedBulan}
									onchange={loadData}
								/>
								<button
									class="btn-arrow-month"
									onclick={nextMonth}
									aria-label="Bulan Berikutnya"
								>
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										stroke-linecap="round"
										stroke-linejoin="round"
										><polyline
											points="9 18 15 12 9 6"
										/></svg
									>
								</button>
								<button
									class="btn-today-pill"
									onclick={currentMonth}>Bulan Ini</button
								>
							</div>
						{:else if reportSubTab === "mingguan"}
							<div class="period-picker-row week-picker-toolbar">
								<button
									class="btn-arrow-month"
									onclick={prevWeek}
									aria-label="Minggu Sebelumnya"
									title="Minggu Sebelumnya"
								>
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										stroke-linecap="round"
										stroke-linejoin="round"
										><polyline
											points="15 18 9 12 15 6"
										/></svg
									>
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
								<button
									class="btn-arrow-month"
									onclick={nextWeek}
									aria-label="Minggu Berikutnya"
									title="Minggu Berikutnya"
								>
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										stroke-linecap="round"
										stroke-linejoin="round"
										><polyline
											points="9 18 15 12 9 6"
										/></svg
									>
								</button>
								<button
									class="btn-today-pill"
									onclick={currentWeek}>Minggu Ini</button
								>
							</div>
						{:else if reportSubTab === "periode"}
							<div class="custom-period-control-box">
								<div class="custom-period-dates">
									<div class="date-field-group">
										<label
											for="inp-custom-start"
											class="field-label-sm"
											>Dari Tanggal:</label
										>
										<input
											id="inp-custom-start"
											type="date"
											class="picker-date-native"
											bind:value={customStartDate}
										/>
									</div>
									<span class="date-sep-arrow">→</span>
									<div class="date-field-group">
										<label
											for="inp-custom-end"
											class="field-label-sm"
											>Sampai Tanggal:</label
										>
										<input
											id="inp-custom-end"
											type="date"
											class="picker-date-native"
											bind:value={customEndDate}
										/>
									</div>
									<button
										class="btn-apply-period"
										onclick={loadData}
									>
										<svg
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.5"
											stroke-linecap="round"
											stroke-linejoin="round"
											><polyline
												points="20 6 9 17 4 12"
											/></svg
										>
										<span>Terapkan</span>
									</button>
								</div>
								<div class="period-presets-scroll">
									<span class="preset-label-hint"
										>Pintas:</span
									>
									<button
										class="preset-chip-btn"
										onclick={() =>
											setPeriodPreset("7-hari")}
										>7 Hari</button
									>
									<button
										class="preset-chip-btn"
										onclick={() =>
											setPeriodPreset("14-hari")}
										>14 Hari</button
									>
									<button
										class="preset-chip-btn"
										onclick={() =>
											setPeriodPreset("30-hari")}
										>30 Hari</button
									>
									<button
										class="preset-chip-btn"
										onclick={() =>
											setPeriodPreset("bulan-ini")}
										>Bulan Ini</button
									>
									<button
										class="preset-chip-btn"
										onclick={() =>
											setPeriodPreset("bulan-lalu")}
										>Bulan Lalu</button
									>
								</div>
							</div>
						{:else if reportSubTab === "harian"}
							<div class="period-picker-row">
								<input
									type="date"
									class="picker-date-native"
									bind:value={selectedTanggal}
									onchange={loadData}
								/>
								<button
									class="btn-today-pill"
									onclick={() => {
										selectedTanggal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
										loadData();
									}}
								>
									Hari Ini
								</button>
							</div>
						{/if}

						<div class="sub-segments-row">
							<button
								class="sub-seg-btn {reportSubTab === 'bulanan'
									? 'active'
									: ''}"
								onclick={() => switchReportSubTab("bulanan")}
							>
								Bulanan
							</button>
							<button
								class="sub-seg-btn {reportSubTab === 'mingguan'
									? 'active'
									: ''}"
								onclick={() => switchReportSubTab("mingguan")}
							>
								Mingguan
							</button>
							<button
								class="sub-seg-btn {reportSubTab === 'periode'
									? 'active'
									: ''}"
								onclick={() => switchReportSubTab("periode")}
							>
								Rentang Tanggal
							</button>
							<button
								class="sub-seg-btn {reportSubTab === 'harian'
									? 'active'
									: ''}"
								onclick={() => switchReportSubTab("harian")}
							>
								Harian
							</button>
							<button
								class="sub-seg-btn {reportSubTab === 'semua'
									? 'active'
									: ''}"
								onclick={() => switchReportSubTab("semua")}
							>
								Riwayat ({transaksiList.length})
							</button>
						</div>
					</div>

					<!-- SUBTAB 1: IKHTISAR BULANAN -->
					{#if reportSubTab === "bulanan"}
						<!-- 4 KPI Cards: Mobile 2x2 Grid -->
						<div class="kpi-mobile-2x2">
							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Pengeluaran</span>
									<span class="dot-badge badge-red">Out</span>
								</div>
								<div class="kpi-num color-expense">
									{formatRupiah(rekap.total_pengeluaran)}
								</div>
								<div class="kpi-subt">{selectedBulan}</div>
							</div>

							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Pemasukan</span>
									<span class="dot-badge badge-green">In</span
									>
								</div>
								<div class="kpi-num color-income">
									{formatRupiah(rekap.total_pemasukan)}
								</div>
								<div class="kpi-subt">{selectedBulan}</div>
							</div>

							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Saldo Bersih</span>
									<span
										class="dot-badge {rekap.saldo_bersih >=
										0
											? 'badge-green'
											: 'badge-red'}"
									>
										{rekap.saldo_bersih >= 0 ? "+" : "-"}
									</span>
								</div>
								<div
									class="kpi-num {rekap.saldo_bersih >= 0
										? 'color-income'
										: 'color-expense'}"
								>
									{formatRupiah(rekap.saldo_bersih)}
								</div>
								<div class="kpi-subt">Net Cashflow</div>
							</div>

							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Total Nota</span>
									<span class="dot-badge badge-blue">Rec</span
									>
								</div>
								<div class="kpi-num color-blue">
									{rekap.total_transaksi} Transaksi
								</div>
								<div class="kpi-subt">Tercatat</div>
							</div>
						</div>

						<!-- DESKTOP SPLIT: TREN CHART vs KATEGORI & TOKO -->
						<div class="report-desktop-split">
							<div class="report-chart-column">
								<!-- Tren Pengeluaran Harian Chart -->
								<div class="card-mobile-panel">
									<div class="panel-header">
										<h3 class="panel-title">
											Tren Pengeluaran Harian
										</h3>
										<p class="panel-sub">
											Akumulasi pengeluaran harian
											sepanjang bulan
										</p>
									</div>

									{#if rekap.tren_harian && rekap.tren_harian.length > 0}
										<div class="chart-mobile-scroll">
											{#each rekap.tren_harian as item}
												{@const maxVal = Math.max(
													...rekap.tren_harian.map(
														(x) => x.pengeluaran,
													),
													1,
												)}
												{@const heightPct = Math.min(
													100,
													Math.max(
														12,
														(item.pengeluaran /
															maxVal) *
															100,
													),
												)}
												<div
													class="chart-col-touch"
													title="{item.tanggal}: {formatRupiah(
														item.pengeluaran,
													)}"
												>
													<div
														class="touch-bar-track"
													>
														<div
															class="touch-bar-fill"
															style="height: {heightPct}%"
														></div>
													</div>
													<span class="touch-date"
														>{item.tanggal.slice(
															8,
														)}</span
													>
												</div>
											{/each}
										</div>
									{:else}
										<div class="empty-panel-text">
											<p>
												Belum ada data pengeluaran bulan
												ini.
											</p>
										</div>
									{/if}
								</div>
							</div>
							<div class="report-side-column">
								<!-- Kategori & Top Toko -->
								<div class="card-mobile-panel">
									<h3 class="panel-title">
										Kategori Belanja
									</h3>
									{#if rekap.rekap_kategori && rekap.rekap_kategori.length > 0}
										<div class="category-bars-col">
											{#each rekap.rekap_kategori as cat}
												{@const pct =
													rekap.total_pengeluaran > 0
														? Math.round(
																(cat.total /
																	rekap.total_pengeluaran) *
																	100,
															)
														: 0}
												<div class="cat-bar-item">
													<div class="cat-bar-header">
														<span class="cat-title"
															>{cat.kategori}</span
														>
														<span class="cat-sum"
															>{formatRupiah(
																cat.total,
															)} ({pct}%)</span
														>
													</div>
													<div class="cat-track">
														<div
															class="cat-fill"
															style="width: {pct}%"
														></div>
													</div>
												</div>
											{/each}
										</div>
									{:else}
										<div class="empty-panel-text">
											<p>Belum ada data kategori.</p>
										</div>
									{/if}
								</div>

								<div class="card-mobile-panel">
									<h3 class="panel-title">
										Toko / Merchant Terbanyak
									</h3>
									{#if rekap.top_merchant && rekap.top_merchant.length > 0}
										<div class="merchant-mini-list">
											{#each rekap.top_merchant as m, i}
												<div class="merchant-mini-row">
													<div class="m-rank">
														{i + 1}
													</div>
													<div class="m-info">
														<span class="m-name"
															>{m.toko}</span
														>
														<span class="m-cnt"
															>{m.count} transaksi</span
														>
													</div>
													<span class="m-tot"
														>{formatRupiah(
															m.total,
														)}</span
													>
												</div>
											{/each}
										</div>
									{:else}
										<div class="empty-panel-text">
											<p>Belum ada merchant tercatat.</p>
										</div>
									{/if}
								</div>
							</div>
						</div>
					{/if}

					<!-- SUBTAB: LAPORAN MINGGUAN -->
					{#if reportSubTab === "mingguan"}
						<!-- Week Period Banner -->
						<div class="period-banner-card">
							<div class="pbc-left">
								<span class="pbc-icon">📅</span>
								<div>
									<div class="pbc-title">
										Laporan Mingguan
									</div>
									<div class="pbc-dates">
										{formatTglHari(currentWeekRange.start)} —
										{formatTglHari(currentWeekRange.end)}
									</div>
								</div>
							</div>
							<button
								class="btn-csv-mobile"
								onclick={exportCSV}
								title="Unduh CSV Transaksi Minggu Ini"
							>
								<svg
									width="13"
									height="13"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path
										d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
									/><polyline
										points="7 10 12 15 17 10"
									/><line x1="12" y1="15" x2="12" y2="3" />
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
								<div class="kpi-num color-expense">
									{formatRupiah(rekap.total_pengeluaran)}
								</div>
								<div class="kpi-subt">Minggu Ini</div>
							</div>

							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Pemasukan</span>
									<span class="dot-badge badge-green">In</span
									>
								</div>
								<div class="kpi-num color-income">
									{formatRupiah(rekap.total_pemasukan)}
								</div>
								<div class="kpi-subt">Minggu Ini</div>
							</div>

							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Saldo Bersih</span>
									<span
										class="dot-badge {rekap.saldo_bersih >=
										0
											? 'badge-green'
											: 'badge-red'}"
									>
										{rekap.saldo_bersih >= 0 ? "+" : "-"}
									</span>
								</div>
								<div
									class="kpi-num {rekap.saldo_bersih >= 0
										? 'color-income'
										: 'color-expense'}"
								>
									{formatRupiah(rekap.saldo_bersih)}
								</div>
								<div class="kpi-subt">Net Cashflow</div>
							</div>

							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Total Nota</span>
									<span class="dot-badge badge-blue">Rec</span
									>
								</div>
								<div class="kpi-num color-blue">
									{rekap.total_transaksi} Transaksi
								</div>
								<div class="kpi-subt">Tercatat</div>
							</div>
						</div>

						<!-- 7-Hari Aktivitas Bar Chart (Senin - Minggu) -->
						<div class="card-mobile-panel">
							<div class="panel-header">
								<h3 class="panel-title">
									Aktivitas 7 Hari (Senin – Minggu)
								</h3>
								<p class="panel-sub">
									Akumulasi pengeluaran harian sepanjang
									minggu terpilih
								</p>
							</div>
							<div class="week-chart-grid">
								{#each weekDaysData as day}
									{@const maxVal = Math.max(
										...weekDaysData.map(
											(x) => x.pengeluaran,
										),
										1,
									)}
									{@const heightPct = Math.min(
										100,
										Math.max(
											12,
											(day.pengeluaran / maxVal) * 100,
										),
									)}
									{@const isToday = day.date === todayTanggal}
									<div
										class="week-day-card {isToday
											? 'is-today-day'
											: ''}"
										title="{day.dayFull}, {day.date}: Pengeluaran {formatRupiah(
											day.pengeluaran,
										)} ({day.count} transaksi)"
									>
										<div class="wdc-nominal">
											{day.pengeluaran > 0
												? day.pengeluaran >= 1000000
													? (
															day.pengeluaran /
															1000000
														).toFixed(1) + "jt"
													: (
															day.pengeluaran /
															1000
														).toFixed(0) + "rb"
												: "-"}
										</div>
										<div class="wdc-bar-track">
											<div
												class="wdc-bar-fill {day.pengeluaran >
												0
													? 'fill-has-val'
													: ''}"
												style="height: {day.pengeluaran >
												0
													? heightPct
													: 6}%"
											></div>
										</div>
										<span class="wdc-day-name"
											>{day.dayShort}</span
										>
										<span
											class="wdc-day-num {isToday
												? 'active-today-pill'
												: ''}">{day.dayNum}</span
										>
									</div>
								{/each}
							</div>
						</div>

						<!-- DESKTOP SPLIT: KATEGORI & TOKO -->
						<div class="report-desktop-split">
							<div class="report-chart-column">
								<div class="card-mobile-panel">
									<h3 class="panel-title">
										Kategori Belanja Mingguan
									</h3>
									{#if rekap.rekap_kategori && rekap.rekap_kategori.length > 0}
										<div class="category-bars-col">
											{#each rekap.rekap_kategori as cat}
												{@const pct =
													rekap.total_pengeluaran > 0
														? Math.round(
																(cat.total /
																	rekap.total_pengeluaran) *
																	100,
															)
														: 0}
												<div class="cat-bar-item">
													<div class="cat-bar-header">
														<span class="cat-title"
															>{cat.kategori}</span
														>
														<span class="cat-sum"
															>{formatRupiah(
																cat.total,
															)} ({pct}%)</span
														>
													</div>
													<div class="cat-track">
														<div
															class="cat-fill"
															style="width: {pct}%"
														></div>
													</div>
												</div>
											{/each}
										</div>
									{:else}
										<div class="empty-panel-text">
											<p>
												Belum ada data kategori minggu
												ini.
											</p>
										</div>
									{/if}
								</div>
							</div>

							<div class="report-side-column">
								<div class="card-mobile-panel">
									<h3 class="panel-title">
										Toko / Merchant Terbanyak
									</h3>
									{#if rekap.top_merchant && rekap.top_merchant.length > 0}
										<div class="merchant-mini-list">
											{#each rekap.top_merchant as m, i}
												<div class="merchant-mini-row">
													<div class="m-rank">
														{i + 1}
													</div>
													<div class="m-info">
														<span class="m-name"
															>{m.toko}</span
														>
														<span class="m-cnt"
															>{m.count} transaksi</span
														>
													</div>
													<span class="m-tot"
														>{formatRupiah(
															m.total,
														)}</span
													>
												</div>
											{/each}
										</div>
									{:else}
										<div class="empty-panel-text">
											<p>
												Belum ada merchant tercatat
												minggu ini.
											</p>
										</div>
									{/if}
								</div>
							</div>
						</div>

						<!-- Daftar Transaksi Minggu Ini -->
						<div class="card-mobile-panel">
							<div class="search-and-export">
								<h3 class="panel-title">
									Daftar Transaksi Minggu Ini ({filteredTransaksi.length})
								</h3>
								<button
									class="btn-csv-mobile"
									onclick={exportCSV}
								>
									<svg
										width="13"
										height="13"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path
											d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
										/><polyline
											points="7 10 12 15 17 10"
										/><line
											x1="12"
											y1="15"
											x2="12"
											y2="3"
										/>
									</svg>
									<span>CSV</span>
								</button>
							</div>

							<div class="mobile-filter-pills mt-2">
								<select
									bind:value={filterTipe}
									class="native-filter-select"
								>
									<option value="">Semua Tipe</option>
									<option value="pengeluaran"
										>Pengeluaran</option
									>
									<option value="pemasukan">Pemasukan</option>
								</select>
								<select
									bind:value={filterKategori}
									class="native-filter-select"
								>
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
											onkeydown={(e) => {
												if (e.key === "Enter")
													openDetail(t.id);
											}}
											role="button"
											tabindex="0"
										>
											<div
												class="entry-icon {t.tipe ===
												'pemasukan'
													? 'icon-green'
													: 'icon-red'}"
											>
												{#if t.tipe === "pemasukan"}
													<svg
														width="18"
														height="18"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2.2"
														stroke-linecap="round"
														stroke-linejoin="round"
													>
														<path
															d="M12 5v14M19 12l-7 7-7-7"
														/>
													</svg>
												{:else}
													<svg
														width="18"
														height="18"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2.2"
														stroke-linecap="round"
														stroke-linejoin="round"
													>
														<path
															d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"
														/><line
															x1="3"
															y1="6"
															x2="21"
															y2="6"
														/><path
															d="M16 10a4 4 0 0 1-8 0"
														/>
													</svg>
												{/if}
											</div>
											<div class="entry-core">
												<div class="entry-row-top">
													<span class="entry-merchant"
														>{t.toko ||
															(t.tipe ===
															"pemasukan"
																? "Pemasukan"
																: "Transaksi")}</span
													>
													<div class="entry-amount-cluster">
														<span
															class="entry-amount {t.tipe ===
															'pemasukan'
																? 'color-income'
																: 'color-expense'}"
														>
															{t.tipe === "pemasukan"
																? "+"
																: "-"}
															{formatRupiah(t.total)}
														</span>
														<button
															type="button"
															class="btn-row-edit"
															title="Edit Transaksi"
															aria-label="Edit Transaksi"
															onclick={(e) => {
																e.stopPropagation();
																openEditTransaksi(t);
															}}
														>
															<svg
																width="12"
																height="12"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="2.2"
																stroke-linecap="round"
																stroke-linejoin="round"
															>
																<path
																	d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
																/>
																<path
																	d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
																/>
															</svg>
														</button>
													</div>
												</div>
												<div class="entry-row-sub">
													<span
														>{formatTgl(t.tanggal)} •
														{t.waktu?.slice(0, 5)} •
														{t.kategori} • {t.metode_bayar}</span
													>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="empty-panel-text">
									<p>Tidak ada transaksi pada minggu ini.</p>
								</div>
							{/if}
						</div>
					{/if}

					<!-- SUBTAB: LAPORAN RENTANG PERIODE TANGGAL KUSTOM -->
					{#if reportSubTab === "periode"}
						<!-- Period Banner -->
						<div class="period-banner-card">
							<div class="pbc-left">
								<span class="pbc-icon">🗓️</span>
								<div>
									<div class="pbc-title">
										Laporan Periode Tanggal
									</div>
									<div class="pbc-dates">
										{formatTgl(customStartDate)} s/d {formatTgl(
											customEndDate,
										)} • {calculateDayDiff(
											customStartDate,
											customEndDate,
										)} Hari
									</div>
								</div>
							</div>
							<button
								class="btn-csv-mobile"
								onclick={exportCSV}
								title="Unduh CSV Transaksi Periode Ini"
							>
								<svg
									width="13"
									height="13"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path
										d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
									/><polyline
										points="7 10 12 15 17 10"
									/><line x1="12" y1="15" x2="12" y2="3" />
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
								<div class="kpi-num color-expense">
									{formatRupiah(rekap.total_pengeluaran)}
								</div>
								<div class="kpi-subt">Total Periode</div>
							</div>

							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Pemasukan</span>
									<span class="dot-badge badge-green">In</span
									>
								</div>
								<div class="kpi-num color-income">
									{formatRupiah(rekap.total_pemasukan)}
								</div>
								<div class="kpi-subt">Total Periode</div>
							</div>

							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Saldo Bersih</span>
									<span
										class="dot-badge {rekap.saldo_bersih >=
										0
											? 'badge-green'
											: 'badge-red'}"
									>
										{rekap.saldo_bersih >= 0 ? "+" : "-"}
									</span>
								</div>
								<div
									class="kpi-num {rekap.saldo_bersih >= 0
										? 'color-income'
										: 'color-expense'}"
								>
									{formatRupiah(rekap.saldo_bersih)}
								</div>
								<div class="kpi-subt">Net Cashflow</div>
							</div>

							<div class="mobile-kpi-item">
								<div class="kpi-lbl-row">
									<span class="kpi-lbl">Total Nota</span>
									<span class="dot-badge badge-blue">Rec</span
									>
								</div>
								<div class="kpi-num color-blue">
									{rekap.total_transaksi} Transaksi
								</div>
								<div class="kpi-subt">Dalam Periode</div>
							</div>
						</div>

						<!-- DESKTOP SPLIT: TREN CHART vs KATEGORI & TOKO -->
						<div class="report-desktop-split">
							<div class="report-chart-column">
								<div class="card-mobile-panel">
									<div class="panel-header">
										<h3 class="panel-title">
											Tren Pengeluaran Harian
										</h3>
										<p class="panel-sub">
											Akumulasi pengeluaran harian
											sepanjang rentang periode
										</p>
									</div>

									{#if rekap.tren_harian && rekap.tren_harian.length > 0}
										<div class="chart-mobile-scroll">
											{#each rekap.tren_harian as item}
												{@const maxVal = Math.max(
													...rekap.tren_harian.map(
														(x) => x.pengeluaran,
													),
													1,
												)}
												{@const heightPct = Math.min(
													100,
													Math.max(
														12,
														(item.pengeluaran /
															maxVal) *
															100,
													),
												)}
												<div
													class="chart-col-touch"
													title="{item.tanggal}: {formatRupiah(
														item.pengeluaran,
													)}"
												>
													<div
														class="touch-bar-track"
													>
														<div
															class="touch-bar-fill"
															style="height: {heightPct}%"
														></div>
													</div>
													<span class="touch-date"
														>{item.tanggal.slice(
															8,
														)}</span
													>
												</div>
											{/each}
										</div>
									{:else}
										<div class="empty-panel-text">
											<p>
												Belum ada data transaksi dalam
												periode ini.
											</p>
										</div>
									{/if}
								</div>
							</div>

							<div class="report-side-column">
								<div class="card-mobile-panel">
									<h3 class="panel-title">
										Kategori Belanja
									</h3>
									{#if rekap.rekap_kategori && rekap.rekap_kategori.length > 0}
										<div class="category-bars-col">
											{#each rekap.rekap_kategori as cat}
												{@const pct =
													rekap.total_pengeluaran > 0
														? Math.round(
																(cat.total /
																	rekap.total_pengeluaran) *
																	100,
															)
														: 0}
												<div class="cat-bar-item">
													<div class="cat-bar-header">
														<span class="cat-title"
															>{cat.kategori}</span
														>
														<span class="cat-sum"
															>{formatRupiah(
																cat.total,
															)} ({pct}%)</span
														>
													</div>
													<div class="cat-track">
														<div
															class="cat-fill"
															style="width: {pct}%"
														></div>
													</div>
												</div>
											{/each}
										</div>
									{:else}
										<div class="empty-panel-text">
											<p>
												Belum ada data kategori dalam
												periode ini.
											</p>
										</div>
									{/if}
								</div>

								<div class="card-mobile-panel">
									<h3 class="panel-title">
										Toko / Merchant Terbanyak
									</h3>
									{#if rekap.top_merchant && rekap.top_merchant.length > 0}
										<div class="merchant-mini-list">
											{#each rekap.top_merchant as m, i}
												<div class="merchant-mini-row">
													<div class="m-rank">
														{i + 1}
													</div>
													<div class="m-info">
														<span class="m-name"
															>{m.toko}</span
														>
														<span class="m-cnt"
															>{m.count} transaksi</span
														>
													</div>
													<span class="m-tot"
														>{formatRupiah(
															m.total,
														)}</span
													>
												</div>
											{/each}
										</div>
									{:else}
										<div class="empty-panel-text">
											<p>
												Belum ada merchant tercatat
												dalam periode ini.
											</p>
										</div>
									{/if}
								</div>
							</div>
						</div>

						<!-- Daftar Transaksi Periode Ini -->
						<div class="card-mobile-panel">
							<div class="search-and-export">
								<div class="mobile-search-bar">
									<svg
										class="search-svg"
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<circle cx="11" cy="11" r="8" /><line
											x1="21"
											y1="21"
											x2="16.65"
											y2="16.65"
										/>
									</svg>
									<input
										type="text"
										placeholder="Cari toko / catatan dalam periode..."
										bind:value={searchQuery}
									/>
								</div>
								<button
									class="btn-csv-mobile"
									onclick={exportCSV}
								>
									<svg
										width="13"
										height="13"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path
											d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
										/><polyline
											points="7 10 12 15 17 10"
										/><line
											x1="12"
											y1="15"
											x2="12"
											y2="3"
										/>
									</svg>
									<span>CSV</span>
								</button>
							</div>

							<div class="mobile-filter-pills mt-2">
								<select
									bind:value={filterTipe}
									class="native-filter-select"
								>
									<option value="">Semua Tipe</option>
									<option value="pengeluaran"
										>Pengeluaran</option
									>
									<option value="pemasukan">Pemasukan</option>
								</select>
								<select
									bind:value={filterKategori}
									class="native-filter-select"
								>
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
											onkeydown={(e) => {
												if (e.key === "Enter")
													openDetail(t.id);
											}}
											role="button"
											tabindex="0"
										>
											<div
												class="entry-icon {t.tipe ===
												'pemasukan'
													? 'icon-green'
													: 'icon-red'}"
											>
												{#if t.tipe === "pemasukan"}
													<svg
														width="18"
														height="18"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2.2"
														stroke-linecap="round"
														stroke-linejoin="round"
													>
														<path
															d="M12 5v14M19 12l-7 7-7-7"
														/>
													</svg>
												{:else}
													<svg
														width="18"
														height="18"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2.2"
														stroke-linecap="round"
														stroke-linejoin="round"
													>
														<path
															d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"
														/><line
															x1="3"
															y1="6"
															x2="21"
															y2="6"
														/><path
															d="M16 10a4 4 0 0 1-8 0"
														/>
													</svg>
												{/if}
											</div>
											<div class="entry-core">
												<div class="entry-row-top">
													<span class="entry-merchant"
														>{t.toko ||
															(t.tipe ===
															"pemasukan"
																? "Pemasukan"
																: "Transaksi")}</span
													>
													<div class="entry-amount-cluster">
														<span
															class="entry-amount {t.tipe ===
															'pemasukan'
																? 'color-income'
																: 'color-expense'}"
														>
															{t.tipe === "pemasukan"
																? "+"
																: "-"}
															{formatRupiah(t.total)}
														</span>
														<button
															type="button"
															class="btn-row-edit"
															title="Edit Transaksi"
															aria-label="Edit Transaksi"
															onclick={(e) => {
																e.stopPropagation();
																openEditTransaksi(t);
															}}
														>
															<svg
																width="12"
																height="12"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="2.2"
																stroke-linecap="round"
																stroke-linejoin="round"
															>
																<path
																	d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
																/>
																<path
																	d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
																/>
															</svg>
														</button>
													</div>
												</div>
												<div class="entry-row-sub">
													<span
														>{formatTgl(t.tanggal)} •
														{t.waktu?.slice(0, 5)} •
														{t.kategori} • {t.metode_bayar}</span
													>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="empty-panel-text">
									<p>
										Tidak ada transaksi dalam periode ini.
									</p>
								</div>
							{/if}
						</div>
					{/if}

					<!-- SUBTAB 4: REKAP HARIAN -->
					{#if reportSubTab === "harian"}
						<div class="card-mobile-panel">
							<div class="daily-picker-box">
								<div class="daily-picker-left">
									<label
										for="inp-date-daily"
										class="daily-lbl">Pilih Tanggal:</label
									>
									<input
										id="inp-date-daily"
										type="date"
										class="picker-date-native"
										bind:value={selectedTanggal}
									/>
								</div>
								<button
									class="btn-today-pill"
									onclick={() => {
										selectedTanggal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
									}}
								>
									Hari Ini
								</button>
							</div>

							<div class="daily-chips-stats">
								<div class="stat-pill-item">
									<span class="sp-lbl">Pengeluaran:</span>
									<span class="sp-val color-expense"
										>{formatRupiah(
											totalHarian.pengeluaran,
										)}</span
									>
								</div>
								<div class="stat-pill-item">
									<span class="sp-lbl">Pemasukan:</span>
									<span class="sp-val color-income"
										>{formatRupiah(
											totalHarian.pemasukan,
										)}</span
									>
								</div>
							</div>

							<h4 class="daily-list-title mt-3">
								Transaksi {formatTgl(selectedTanggal)}
							</h4>

							{#if harianTransaksi.length > 0}
								<div class="mobile-cards-stream">
									{#each harianTransaksi as t}
										<div
											class="mobile-tx-entry"
											onclick={() => openDetail(t.id)}
											onkeydown={(e) => {
												if (e.key === "Enter")
													openDetail(t.id);
											}}
											role="button"
											tabindex="0"
										>
											<div
												class="entry-icon {t.tipe ===
												'pemasukan'
													? 'icon-green'
													: 'icon-red'}"
											>
												{#if t.tipe === "pemasukan"}
													<svg
														width="18"
														height="18"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2.2"
														stroke-linecap="round"
														stroke-linejoin="round"
													>
														<path
															d="M12 5v14M19 12l-7 7-7-7"
														/>
													</svg>
												{:else}
													<svg
														width="18"
														height="18"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2.2"
														stroke-linecap="round"
														stroke-linejoin="round"
													>
														<path
															d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"
														/><line
															x1="3"
															y1="6"
															x2="21"
															y2="6"
														/><path
															d="M16 10a4 4 0 0 1-8 0"
														/>
													</svg>
												{/if}
											</div>
											<div class="entry-core">
												<div class="entry-row-top">
													<span class="entry-merchant"
														>{t.toko ||
															(t.tipe ===
															"pemasukan"
																? "Pemasukan"
																: "Transaksi")}</span
													>
													<div class="entry-amount-cluster">
														<span
															class="entry-amount {t.tipe ===
															'pemasukan'
																? 'color-income'
																: 'color-expense'}"
														>
															{t.tipe === "pemasukan"
																? "+"
																: "-"}
															{formatRupiah(t.total)}
														</span>
														<button
															type="button"
															class="btn-row-edit"
															title="Edit Transaksi"
															aria-label="Edit Transaksi"
															onclick={(e) => {
																e.stopPropagation();
																openEditTransaksi(t);
															}}
														>
															<svg
																width="12"
																height="12"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="2.2"
																stroke-linecap="round"
																stroke-linejoin="round"
															>
																<path
																	d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
																/>
																<path
																	d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
																/>
															</svg>
														</button>
													</div>
												</div>
												<div class="entry-row-sub">
													<span
														>{t.waktu?.slice(0, 5)} •
														{t.kategori} • {t.metode_bayar}</span
													>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="empty-panel-text">
									<p>Tidak ada transaksi pada tanggal ini.</p>
								</div>
							{/if}
						</div>
					{/if}

					<!-- SUBTAB 3: RIWAYAT TRANSAKSI LENGKAP -->
					{#if reportSubTab === "semua"}
						<div class="card-mobile-panel">
							<div class="search-and-export">
								<div class="mobile-search-bar">
									<svg
										class="search-svg"
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<circle cx="11" cy="11" r="8" /><line
											x1="21"
											y1="21"
											x2="16.65"
											y2="16.65"
										/>
									</svg>
									<input
										type="text"
										placeholder="Cari toko / kategori..."
										bind:value={searchQuery}
									/>
								</div>
								<button
									class="btn-csv-mobile"
									onclick={exportCSV}
								>
									<svg
										width="13"
										height="13"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path
											d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
										/><polyline
											points="7 10 12 15 17 10"
										/><line
											x1="12"
											y1="15"
											x2="12"
											y2="3"
										/>
									</svg>
									<span>CSV</span>
								</button>
							</div>

							<div class="mobile-filter-pills">
								<select
									bind:value={filterTipe}
									class="native-filter-select"
								>
									<option value="">Semua Tipe</option>
									<option value="pengeluaran"
										>Pengeluaran</option
									>
									<option value="pemasukan">Pemasukan</option>
								</select>
								<select
									bind:value={filterKategori}
									class="native-filter-select"
								>
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
											onkeydown={(e) => {
												if (e.key === "Enter")
													openDetail(t.id);
											}}
											role="button"
											tabindex="0"
										>
											<div
												class="entry-icon {t.tipe ===
												'pemasukan'
													? 'icon-green'
													: 'icon-red'}"
											>
												{#if t.tipe === "pemasukan"}
													<svg
														width="18"
														height="18"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2.2"
														stroke-linecap="round"
														stroke-linejoin="round"
													>
														<path
															d="M12 5v14M19 12l-7 7-7-7"
														/>
													</svg>
												{:else}
													<svg
														width="18"
														height="18"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2.2"
														stroke-linecap="round"
														stroke-linejoin="round"
													>
														<path
															d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"
														/><line
															x1="3"
															y1="6"
															x2="21"
															y2="6"
														/><path
															d="M16 10a4 4 0 0 1-8 0"
														/>
													</svg>
												{/if}
											</div>
											<div class="entry-core">
												<div class="entry-row-top">
													<span class="entry-merchant"
														>{t.toko ||
															(t.tipe ===
															"pemasukan"
																? "Pemasukan"
																: "Transaksi")}</span
													>
													<div class="entry-amount-cluster">
														<span
															class="entry-amount {t.tipe ===
															'pemasukan'
																? 'color-income'
																: 'color-expense'}"
														>
															{t.tipe === "pemasukan"
																? "+"
																: "-"}
															{formatRupiah(t.total)}
														</span>
														<button
															type="button"
															class="btn-row-edit"
															title="Edit Transaksi"
															aria-label="Edit Transaksi"
															onclick={(e) => {
																e.stopPropagation();
																openEditTransaksi(t);
															}}
														>
															<svg
																width="12"
																height="12"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="2.2"
																stroke-linecap="round"
																stroke-linejoin="round"
															>
																<path
																	d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
																/>
																<path
																	d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
																/>
															</svg>
														</button>
													</div>
												</div>
												<div class="entry-row-sub">
													<span
														>{formatTgl(t.tanggal)} •
														{t.kategori} • {t.metode_bayar}</span
													>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="empty-panel-text">
									<p>Tidak ada transaksi yang cocok.</p>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</main>

		<!-- MOBILE BOTTOM NAVIGATION BAR (NATIVE APP EXPERIENCE) -->
		<nav class="mobile-bottom-nav" aria-label="Navigasi Utama">
			<!-- TAB 1: CHAT AI -->
			<button
				type="button"
				class="mob-nav-btn {activeView === 'chat' ? 'active' : ''}"
				onclick={() => {
					activeView = "chat";
					if (reportSubTab !== "bulanan") {
						reportSubTab = "bulanan";
						loadData();
					}
					scrollToBottom();
				}}
			>
				<div class="mob-nav-icon-wrap">
					<svg
						width="19"
						height="19"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path
							d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
						/>
					</svg>
				</div>
				<span class="mob-nav-label">Chat</span>
			</button>

			<!-- TAB 2: LAPORAN & REKAP -->
			<button
				type="button"
				class="mob-nav-btn {activeView === 'report' ? 'active' : ''}"
				onclick={() => (activeView = "report")}
			>
				<div class="mob-nav-icon-wrap">
					<svg
						width="19"
						height="19"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M3 3v18h18" /><path d="M18 17V9" /><path
							d="M13 17V5"
						/><path d="M8 17v-3" />
					</svg>
					{#if transaksiList.length > 0}
						<span class="mob-nav-badge">{transaksiList.length > 99 ? '99+' : transaksiList.length}</span>
					{/if}
				</div>
				<span class="mob-nav-label">Laporan</span>
			</button>

			<!-- TAB 3: CENTER QUICK ADD (+) -->
			<button
				type="button"
				class="mob-nav-btn mob-nav-btn-center"
				onclick={() => {
					resetForm();
					showModalTambah = true;
				}}
				aria-label="Catat Transaksi Cepat"
			>
				<div class="mob-fab-pill">
					<svg
						width="21"
						height="21"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.6"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
				</div>
				<span class="mob-nav-label">Catat</span>
			</button>

			<!-- TAB 4: AKUN & PENGATURAN -->
			<button
				type="button"
				class="mob-nav-btn {showProfileModal ? 'active' : ''}"
				onclick={() => (showProfileModal = true)}
			>
				<div class="mob-nav-icon-wrap">
					<div class="mob-nav-avatar">
						{currentUser?.nama ? currentUser.nama.charAt(0).toUpperCase() : 'U'}
						{#if currentUser?.tier === "pro"}
							<span class="mob-nav-pro-dot" title="CatatAi PRO">⭐</span>
						{/if}
					</div>
				</div>
				<span class="mob-nav-label">Akun</span>
			</button>
		</nav>

		<!-- PROFILE & AKUN BOTTOM SHEET MODAL -->
		{#if showProfileModal}
			<div
				class="bottom-sheet-backdrop"
				onclick={() => (showProfileModal = false)}
				onkeydown={(e) => {
					if (e.key === "Escape") showProfileModal = false;
				}}
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
						<button
							class="sheet-close-btn"
							aria-label="Tutup"
							onclick={() => (showProfileModal = false)}
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.2"
								><line x1="18" y1="6" x2="6" y2="18" /><line
									x1="6"
									y1="6"
									x2="18"
									y2="18"
								/></svg
							>
						</button>
					</div>

					<div class="profile-sheet-body">
						<div class="profile-head-box">
							<div class="profile-large-avatar">
								{currentUser.nama.charAt(0).toUpperCase()}
							</div>
							<div class="profile-user-info">
								<h2 class="profile-name-text">
									{currentUser.nama}
								</h2>
								<p class="profile-email-text">
									{currentUser.email}
								</p>
							</div>
						</div>

						<div
							class="profile-tier-card {currentUser.tier === 'pro'
								? 'tier-pro-box'
								: 'tier-free-box'}"
						>
							<div class="tier-card-left">
								<div class="tier-icon-circle">
									{currentUser.tier === "pro" ? "⭐" : "🌱"}
								</div>
								<div class="tier-meta-text">
									<div class="tier-title-row">
										<span class="tier-title-text"
											>{currentUser.tier === "pro"
												? "CatatAi PRO (Aktif)"
												: "Paket Gratis (Free)"}</span
										>
										<span class="tier-status-pill"
											>{currentUser.tier === "pro"
												? "Unlimited"
												: "5 Pesan / Hari"}</span
										>
									</div>
									<p class="tier-desc-text">
										{currentUser.tier === "pro"
											? "Akses Chat Asisten & Scan Nota Tanpa Batas."
											: `Sisa kuota hari ini: ${currentUser.sisa_kuota ?? 5} dari 5 pesan gratis.`}
									</p>
								</div>
							</div>
							<button
								type="button"
								class="btn-tier-action {currentUser.tier ===
								'pro'
									? 'btn-tier-manage'
									: 'btn-tier-upgrade'}"
								onclick={() => {
									showProfileModal = false;
									showUpgradeModal = true;
								}}
							>
								{currentUser.tier === "pro"
									? "Kelola Paket"
									: "Upgrade PRO ⭐"}
							</button>
						</div>

						<div class="profile-stats-card">
							<div class="stat-mini-col">
								<span class="sm-lbl">Transaksi Bulan Ini</span>
								<span class="sm-val"
									>{rekap.total_transaksi}</span
								>
							</div>
							<div class="stat-divider-line"></div>
							<div class="stat-mini-col">
								<span class="sm-lbl">Net Saldo Bulan Ini</span>
								<span
									class="sm-val {rekap.saldo_bersih >= 0
										? 'color-income'
										: 'color-expense'}"
								>
									{formatRupiah(rekap.saldo_bersih)}
								</span>
							</div>
						</div>

						{#if currentUser?.role === "admin" || currentUser?.email === "miftahdev7@gmail.com"}
							<a href="/admin" class="btn-admin-profile-menu">
								<div class="adm-menu-left">
									<span class="adm-crown-badge">👑</span>
									<div class="adm-menu-text">
										<strong
											>Panel Admin Manajemen Pengguna</strong
										>
										<span
											>Ubah status pengguna jadi PRO &
											reset kuota</span
										>
									</div>
								</div>
								<span class="adm-arrow-right">→</span>
							</a>
						{/if}

						{#if !isAppStandalone}
							<button
								class="btn-install-pwa-sheet"
								onclick={triggerPWAInstall}
							>
								<svg
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<rect
										x="5"
										y="2"
										width="14"
										height="20"
										rx="2"
										ry="2"
									/><line
										x1="12"
										y1="18"
										x2="12.01"
										y2="18"
									/>
								</svg>
								<span>Pasang CatatAi ke Layar Utama (PWA)</span>
							</button>
						{:else}
							<div class="installed-pwa-badge">
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<polyline points="20 6 9 17 4 12" />
								</svg>
								<span
									>CatatAi terpasang di perangkat Anda (PWA)</span
								>
							</div>
						{/if}

						<button class="btn-logout-full" onclick={handleLogout}>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path
									d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
								/><polyline points="16 17 21 12 16 7" /><line
									x1="21"
									y1="12"
									x2="9"
									y2="12"
								/>
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
				onclick={() => (showUpgradeModal = false)}
				onkeydown={(e) => {
					if (e.key === "Escape") showUpgradeModal = false;
				}}
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
						<button
							class="sheet-close-btn"
							aria-label="Tutup"
							onclick={() => (showUpgradeModal = false)}
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.2"
								><line x1="18" y1="6" x2="6" y2="18" /><line
									x1="6"
									y1="6"
									x2="18"
									y2="18"
								/></svg
							>
						</button>
					</div>

					<div class="upgrade-sheet-body">
						<div class="upgrade-hero-card">
							<div class="upgrade-crown-icon">👑</div>
							<h2 class="upgrade-hero-title">
								Buka Akses Tanpa Batas
							</h2>
							<p class="upgrade-hero-sub">
								Pencatatan keuangan cerdas, scan nota AI, dan
								rekap otomatis tanpa limit harian.
							</p>
						</div>

						<!-- PERBANDINGAN TIER -->
						<div class="plans-grid-row">
							<!-- PLAN 1: GRATIS -->
							<div
								class="plan-card {currentUser.tier !== 'pro'
									? 'plan-current'
									: ''}"
							>
								<div class="plan-header">
									<div class="plan-name">Versi Gratis</div>
									<div class="plan-price">
										Rp 0 <span>/ selamanya</span>
									</div>
								</div>
								<ul class="plan-features-list">
									<li>
										<span class="feat-bullet">⏳</span> 5 pesan
										chat per hari
									</li>
									<li>
										<span class="feat-bullet">🔄</span> Reset
										kuota setiap tengah malam
									</li>
									<li>
										<span class="feat-bullet">📊</span> Rekap
										keuangan bulanan
									</li>
								</ul>
								{#if currentUser.tier !== "pro"}
									<div class="plan-badge-curr">
										Paket Anda Saat Ini ({currentUser.sisa_kuota ??
											5}/5 pesan)
									</div>
								{:else}
									<button
										type="button"
										class="btn-plan-toggle btn-plan-free"
										onclick={() => toggleProTier("free")}
										disabled={upgradeLoading}
									>
										Beralih ke Free (Demo Limit)
									</button>
								{/if}
							</div>

							<!-- PLAN 2: PRO UNLIMITED -->
							<div
								class="plan-card plan-pro-highlight {currentUser.tier ===
								'pro'
									? 'plan-current'
									: ''}"
							>
								<div class="pro-popular-ribbon">
									PALING POPULER
								</div>
								<div class="plan-header">
									<div class="plan-name">Versi PRO ⭐</div>
									<div class="plan-price">
										Unlimited <span>/ selamanya</span>
									</div>
								</div>
								<ul class="plan-features-list">
									<li>
										<span class="feat-bullet">⚡</span>
										<strong
											>Chat Tanpa Batas (Unlimited)</strong
										>
									</li>
									<li>
										<span class="feat-bullet">📸</span>
										<strong>Scan Nota AI Tanpa Batas</strong
										>
									</li>
									<li>
										<span class="feat-bullet">📑</span> Export
										CSV & Rekap Lengkap
									</li>
									<li>
										<span class="feat-bullet">🔒</span> Data
										Terisolasi & Pribadi
									</li>
								</ul>

								{#if currentUser?.tier === "pro"}
									<div class="plan-badge-curr pro-active">
										⭐ Paket Anda Aktif (Unlimited)
									</div>
								{:else}
									<a
										href="https://wa.me/6281225020952?text={encodeURIComponent(
											'Halo Admin Miftah, saya ingin upgrade akun CatatAi saya ke Versi PRO Unlimited.\n\nNama: ' +
												(currentUser?.nama || '') +
												'\nEmail: ' +
												(currentUser?.email || ''),
										)}"
										target="_blank"
										rel="noopener noreferrer"
										class="btn-plan-toggle btn-plan-pro-wa"
									>
										<svg
											width="18"
											height="18"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path
												d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
											/>
										</svg>
										<span
											>Hubungi WA Admin (081225020952) 💬</span
										>
									</a>

									{#if currentUser?.role === "admin" || currentUser?.email === "miftahdev7@gmail.com"}
										<div class="admin-quick-dev-box">
											<button
												type="button"
												class="btn-admin-instant-act"
												onclick={() =>
													toggleProTier("pro")}
												disabled={upgradeLoading}
											>
												👑 [Mode Admin] Aktifkan Akun
												Sendiri Langsung
											</button>
										</div>
									{/if}
								{/if}
							</div>
						</div>

						<div class="upgrade-note-box">
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.2"
								><circle cx="12" cy="12" r="10" /><line
									x1="12"
									y1="16"
									x2="12"
									y2="12"
								/><line x1="12" y1="8" x2="12.01" y2="8" /></svg
							>
							<span
								>Untuk aktivasi PRO, silakan klik tombol WA di
								atas atau hubungi <strong>081225020952</strong>.
								Admin Miftah akan langsung mengubah status akun
								Anda menjadi PRO Unlimited.</span
							>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- BOTTOM SHEET MODAL (MANUAL INPUT / EDIT) -->
		{#if showModalTambah}
			<div
				class="bottom-sheet-backdrop"
				onclick={() => {
					showModalTambah = false;
					resetForm();
				}}
				onkeydown={(e) => {
					if (e.key === "Escape") {
						showModalTambah = false;
						resetForm();
					}
				}}
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
						<h3 class="sheet-title">
							{isEditingTransaksi
								? "Edit Transaksi"
								: "Catat Transaksi Manual"}
						</h3>
						<button
							class="sheet-close-btn"
							aria-label="Tutup"
							onclick={() => {
								showModalTambah = false;
								resetForm();
							}}
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.2"
								><line x1="18" y1="6" x2="6" y2="18" /><line
									x1="6"
									y1="6"
									x2="18"
									y2="18"
								/></svg
							>
						</button>
					</div>

					<div class="sheet-body-scroll">
						<div class="sheet-form-grid">
							<div class="sheet-field">
								<label for="inp-sheet-type">Tipe</label>
								<select
									id="inp-sheet-type"
									class="native-sheet-input"
									bind:value={form.tipe}
								>
									<option value="pengeluaran"
										>Pengeluaran (Belanja/Biaya)</option
									>
									<option value="pemasukan"
										>Pemasukan (Gaji/Pendapatan)</option
									>
								</select>
							</div>

							<div class="sheet-field">
								<label for="inp-sheet-store"
									>{form.tipe === "pemasukan"
										? "Sumber Uang / Kantor"
										: "Nama Toko / Tempat"}</label
								>
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
								<input
									id="inp-sheet-date"
									type="date"
									class="native-sheet-input"
									bind:value={form.tanggal}
								/>
							</div>

							<div class="sheet-field">
								<label for="inp-sheet-time">Jam</label>
								<input
									id="inp-sheet-time"
									type="time"
									class="native-sheet-input"
									bind:value={form.waktu}
								/>
							</div>

							<div class="sheet-field">
								<label for="inp-sheet-cat">Kategori</label>
								<select
									id="inp-sheet-cat"
									class="native-sheet-input"
									bind:value={form.kategori}
								>
									{#each KATEGORI_OPTIONS as k}
										<option value={k}>{k}</option>
									{/each}
								</select>
							</div>

							<div class="sheet-field">
								<label for="inp-sheet-pay"
									>Pilih Dompet / Rekening</label
								>
								<select
									id="inp-sheet-pay"
									class="native-sheet-input"
									bind:value={form.dompet}
									onchange={(e) => {
										const sel = dompetList.find(
											(d) =>
												d.nama ===
												e.currentTarget.value,
										);
										if (sel) {
											form.dompet_id = sel.id;
											form.metode_bayar = sel.nama;
										} else {
											form.metode_bayar =
												e.currentTarget.value;
										}
									}}
								>
									{#if dompetList.length > 0}
										{#each dompetList as d}
											<option value={d.nama}>
												{getDompetIcon(d.tipe)}
												{d.nama} ({formatRupiah(
													d.saldo_sekarang,
												)})
											</option>
										{/each}
									{:else}
										{#each METODE_OPTIONS as m}
											<option value={m}>{m}</option>
										{/each}
									{/if}
								</select>
							</div>
						</div>

						<!-- Rincian Item (Opsional) -->
						<div class="sheet-divider mt-3">
							<div class="sheet-divider-row">
								<span class="sub-sheet-heading"
									>Rincian Barang</span
								>
								<button class="btn-sheet-mini" onclick={addItem}
									>+ Tambah Baris</button
								>
							</div>

							{#if form.items.length > 0}
								<div class="sheet-items-stack">
									{#each form.items as item, idx}
										<div class="sheet-item-row">
											<input
												type="text"
												placeholder="Nama item"
												class="native-sheet-input flex-2"
												bind:value={item.nama_barang}
											/>
											<input
												type="number"
												min="1"
												placeholder="Qty"
												class="native-sheet-input flex-1"
												bind:value={item.qty}
												oninput={hitungTotal}
											/>
											<input
												type="number"
												min="0"
												placeholder="Harga"
												class="native-sheet-input flex-1"
												bind:value={item.harga_satuan}
												oninput={hitungTotal}
											/>
											<button
												class="btn-sheet-del"
												aria-label="Hapus baris item"
												onclick={() => removeItem(idx)}
											>
												<svg
													width="13"
													height="13"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2.5"
													><line
														x1="18"
														y1="6"
														x2="6"
														y2="18"
													/><line
														x1="6"
														y1="6"
														x2="18"
														y2="18"
													/></svg
												>
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
									<input
										id="inp-sheet-tax"
										type="number"
										class="native-sheet-input-sm"
										bind:value={form.pajak}
										oninput={hitungTotal}
									/>
								</div>
								<div class="calc-col">
									<label for="inp-sheet-disc">Diskon:</label>
									<input
										id="inp-sheet-disc"
										type="number"
										class="native-sheet-input-sm"
										bind:value={form.diskon}
										oninput={hitungTotal}
									/>
								</div>
							</div>
							<div class="calc-grand-row">
								<span class="tot-title">Grand Total:</span>
								<input
									type="number"
									class="native-grand-input"
									bind:value={form.total}
								/>
							</div>
						</div>

						<div class="sheet-field mt-3">
							<label for="inp-sheet-note">Catatan Tambahan</label>
							<input
								id="inp-sheet-note"
								type="text"
								class="native-sheet-input"
								placeholder="Keterangan..."
								bind:value={form.catatan}
							/>
						</div>
					</div>

					<div class="sheet-sticky-footer">
						<button
							class="btn-sheet-cancel"
							onclick={() => {
								showModalTambah = false;
								resetForm();
							}}>Batal</button
						>
						<button
							class="btn-sheet-submit"
							onclick={simpanTransaksi}
							disabled={loading}
						>
							{loading
								? "Menyimpan..."
								: isEditingTransaksi
									? "Simpan Perubahan"
									: "Simpan Transaksi"}
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- BOTTOM SHEET MODAL (DETAIL & FOTO) -->
		{#if showModalDetail}
			<div
				class="bottom-sheet-backdrop"
				onclick={() => (showModalDetail = false)}
				onkeydown={(e) => {
					if (e.key === "Escape") showModalDetail = false;
				}}
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
						<button
							class="sheet-close-btn"
							aria-label="Tutup"
							onclick={() => (showModalDetail = false)}
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.2"
								><line x1="18" y1="6" x2="6" y2="18" /><line
									x1="6"
									y1="6"
									x2="18"
									y2="18"
								/></svg
							>
						</button>
					</div>

					{#if detailLoading}
						<div class="empty-panel-text">
							<p>Memuat rincian...</p>
						</div>
					{:else if detailData}
						<div class="sheet-body-scroll">
							{#if detailData.gambar_url}
								<div class="detail-photo-card">
									<img
										src={detailData.gambar_url}
										alt="Nota"
										class="detail-img-full"
									/>
								</div>
							{/if}

							<div class="detail-tags-cluster">
								<span
									class="pill-type {detailData.tipe ===
									'pemasukan'
										? 'pill-income'
										: 'pill-expense'}"
								>
									{detailData.tipe.toUpperCase()}
								</span>
								<span class="col-tag"
									>{detailData.kategori}</span
								>
								<span class="col-tag method-tag">
									<svg
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										><rect
											x="1"
											y="4"
											width="22"
											height="16"
											rx="2"
											ry="2"
										/><line
											x1="1"
											y1="10"
											x2="23"
											y2="10"
										/></svg
									>
									<span>{detailData.metode_bayar}</span>
								</span>
							</div>

							<h2 class="detail-hero-store">
								{detailData.toko || "Transaksi"}
							</h2>
							<p class="detail-hero-time">
								<svg
									width="13"
									height="13"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									><rect
										x="3"
										y="4"
										width="18"
										height="18"
										rx="2"
										ry="2"
									/><line
										x1="16"
										y1="2"
										x2="16"
										y2="6"
									/><line x1="8" y1="2" x2="8" y2="6" /><line
										x1="3"
										y1="10"
										x2="21"
										y2="10"
									/></svg
								>
								<span
									>{formatTgl(detailData.tanggal)} • {detailData.waktu?.slice(
										0,
										5,
									) || "-"}</span
								>
							</p>

							{#if detailData.catatan}
								<div class="detail-callout-note">
									"{detailData.catatan}"
								</div>
							{/if}

							{#if detailData.items && detailData.items.length > 0}
								<h4 class="sub-sheet-heading mt-3">
									Barang / Item:
								</h4>
								<div class="detail-items-stack">
									{#each detailData.items as itm}
										<div class="detail-item-line">
											<span
												>{itm.qty}x {itm.nama_barang}</span
											>
											<span class="entry-sub"
												>{formatRupiah(
													itm.subtotal,
												)}</span
											>
										</div>
									{/each}
								</div>
							{/if}

							<div class="sheet-calc-box mt-3">
								<div class="calc-line-row">
									<span>Subtotal:</span>
									<span
										>{formatRupiah(
											detailData.subtotal,
										)}</span
									>
								</div>
								{#if detailData.pajak > 0}
									<div class="calc-line-row">
										<span>Pajak (PPN):</span>
										<span
											>{formatRupiah(
												detailData.pajak,
											)}</span
										>
									</div>
								{/if}
								{#if detailData.diskon > 0}
									<div class="calc-line-row">
										<span>Diskon:</span>
										<span
											>-{formatRupiah(
												detailData.diskon,
											)}</span
										>
									</div>
								{/if}
								<div class="calc-grand-row">
									<span class="tot-title">Grand Total:</span>
									<span
										class="tot-val {detailData.tipe ===
										'pemasukan'
											? 'color-income'
											: 'color-expense'}"
									>
										{detailData.tipe === "pemasukan"
											? "+"
											: "-"}
										{formatRupiah(detailData.total)}
									</span>
								</div>
							</div>
						</div>

						<div class="sheet-sticky-footer">
							<button
								class="btn-sheet-danger"
								onclick={() => deleteTransaksi(detailData.id)}
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<polyline points="3 6 5 6 21 6" /><path
										d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
									/><line
										x1="10"
										y1="11"
										x2="10"
										y2="17"
									/><line x1="14" y1="11" x2="14" y2="17" />
								</svg>
								<span>Hapus</span>
							</button>
							<button
								class="btn-sheet-edit"
								onclick={() => openEditTransaksi(detailData)}
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path
										d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
									/>
									<path
										d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
									/>
								</svg>
								<span>Edit Transaksi</span>
							</button>
							<button
								class="btn-sheet-submit"
								onclick={() => (showModalDetail = false)}
								>Tutup</button
							>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- BOTTOM SHEET: KELOLA & TAMBAH/EDIT DOMPET -->
		{#if isDompetSheetOpen}
			<div
				class="bottom-sheet-backdrop"
				onclick={() => (isDompetSheetOpen = false)}
				onkeydown={(e) => {
					if (e.key === "Escape") isDompetSheetOpen = false;
				}}
				role="presentation"
			>
				<div
					class="bottom-sheet-sheet dompet-modal-sheet"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
					role="dialog"
					tabindex="-1"
				>
					<div class="sheet-grabber-bar"></div>
					<div class="sheet-header">
						<div class="dompet-sheet-title-group">
							<h3 class="sheet-title">
								{isEditingDompet
									? "Edit Dompet / Rekening"
									: "Tambah Dompet Baru"}
							</h3>
							<span class="sheet-subtitle"
								>Kelola kantong uang, rekening bank, & e-wallet</span
							>
						</div>
						<button
							class="sheet-close-btn"
							aria-label="Tutup"
							onclick={() => (isDompetSheetOpen = false)}
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.2"
								><line x1="18" y1="6" x2="6" y2="18" /><line
									x1="6"
									y1="6"
									x2="18"
									y2="18"
								/></svg
							>
						</button>
					</div>

					<div class="sheet-body-scroll">
						<!-- Preview Kartu Dompet Real-time -->
						<div
							class="dompet-card-preview"
							style="background: {dompetForm.warna || '#2563eb'};"
						>
							<div class="dcp-top">
								<span class="dcp-icon"
									>{getDompetIcon(dompetForm.tipe)}</span
								>
								<span class="dcp-type-badge"
									>{dompetForm.tipe?.toUpperCase()}</span
								>
							</div>
							<div class="dcp-name">
								{dompetForm.nama || "Nama Dompet"}
							</div>
							<div class="dcp-balance">
								<span class="dcp-bal-lbl">Saldo Awal</span>
								<span class="dcp-bal-val"
									>{formatRupiah(dompetForm.saldo_awal)}</span
								>
							</div>
							{#if dompetForm.nomor_rekening}
								<div class="dcp-acc">
									{dompetForm.nomor_rekening}
								</div>
							{/if}
						</div>

						<div class="sheet-form-grid mt-3">
							<div class="sheet-field full-width">
								<label for="inp-dompet-nama"
									>Nama Dompet / Rekening</label
								>
								<input
									id="inp-dompet-nama"
									type="text"
									class="native-sheet-input"
									placeholder="Contoh: BCA Tabungan, GoPay, Kantong Jago, Uang Fisik"
									bind:value={dompetForm.nama}
								/>
							</div>

							<div class="sheet-field">
								<label for="inp-dompet-tipe">Tipe Dompet</label>
								<select
									id="inp-dompet-tipe"
									class="native-sheet-input"
									bind:value={dompetForm.tipe}
								>
									<option value="bank"
										>🏦 Rekening Bank (BCA, Mandiri, BRI,
										dll)</option
									>
									<option value="ewallet"
										>📱 E-Wallet (GoPay, OVO, Dana,
										ShopeePay)</option
									>
									<option value="cash"
										>💵 Uang Tunai / Cash Fisik</option
									>
									<option value="lainnya"
										>💳 Lainnya / Kartu Kredit / Investasi</option
									>
								</select>
							</div>

							<div class="sheet-field">
								<label for="inp-dompet-saldo"
									>Saldo Awal (Rp)</label
								>
								<input
									id="inp-dompet-saldo"
									type="number"
									min="0"
									class="native-sheet-input"
									placeholder="0"
									bind:value={dompetForm.saldo_awal}
								/>
							</div>

							<div class="sheet-field full-width">
								<label for="inp-dompet-color-custom"
									>Warna Kartu</label
								>
								<div class="color-preset-picker">
									{#each DOMPET_WARNA_PRESETS as p}
										<button
											type="button"
											class="color-dot {dompetForm.warna ===
											p.hex
												? 'selected-color'
												: ''}"
											style="background: {p.hex};"
											onclick={() =>
												(dompetForm.warna = p.hex)}
											title={p.name}
										>
											{#if dompetForm.warna === p.hex}
												<svg
													width="12"
													height="12"
													viewBox="0 0 24 24"
													fill="none"
													stroke="#fff"
													stroke-width="3"
													><polyline
														points="20 6 9 17 4 12"
													/></svg
												>
											{/if}
										</button>
									{/each}
									<input
										id="inp-dompet-color-custom"
										type="color"
										class="color-native-input"
										bind:value={dompetForm.warna}
										title="Pilih Warna Kustom"
									/>
								</div>
							</div>

							<div class="sheet-field full-width">
								<label for="inp-dompet-rek"
									>Nomor Rekening / No. HP (Opsional)</label
								>
								<input
									id="inp-dompet-rek"
									type="text"
									class="native-sheet-input"
									placeholder="Contoh: 1234567890 / 08123456789"
									bind:value={dompetForm.nomor_rekening}
								/>
							</div>

							<div class="sheet-field full-width">
								<label for="inp-dompet-cat"
									>Catatan (Opsional)</label
								>
								<input
									id="inp-dompet-cat"
									type="text"
									class="native-sheet-input"
									placeholder="Keterangan dompet ini..."
									bind:value={dompetForm.catatan}
								/>
							</div>
						</div>
					</div>

					<div class="sheet-sticky-footer">
						{#if isEditingDompet}
							<button
								type="button"
								class="btn-sheet-danger"
								onclick={() =>
									handleDeleteDompet(dompetForm.id)}
							>
								Hapus
							</button>
						{/if}
						<button
							type="button"
							class="btn-sheet-cancel"
							onclick={() => (isDompetSheetOpen = false)}
						>
							Batal
						</button>
						<button
							type="button"
							class="btn-sheet-submit"
							onclick={handleSaveDompet}
							disabled={dompetLoading}
						>
							{dompetLoading
								? "Menyimpan..."
								: isEditingDompet
									? "Simpan Perubahan"
									: "Tambahkan Dompet"}
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- BOTTOM SHEET: TRANSFER ANTAR DOMPET -->
		{#if isTransferSheetOpen}
			<div
				class="bottom-sheet-backdrop"
				onclick={() => (isTransferSheetOpen = false)}
				onkeydown={(e) => {
					if (e.key === "Escape") isTransferSheetOpen = false;
				}}
				role="presentation"
			>
				<div
					class="bottom-sheet-sheet transfer-modal-sheet"
					onclick={(e) => e.stopPropagation()}
					onkeydown={(e) => e.stopPropagation()}
					role="dialog"
					tabindex="-1"
				>
					<div class="sheet-grabber-bar"></div>
					<div class="sheet-header">
						<div class="dompet-sheet-title-group">
							<h3 class="sheet-title">Transfer Antar Dompet</h3>
							<span class="sheet-subtitle"
								>Pindahkan saldo antar rekening atau dompet Anda</span
							>
						</div>
						<button
							class="sheet-close-btn"
							aria-label="Tutup"
							onclick={() => (isTransferSheetOpen = false)}
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.2"
								><line x1="18" y1="6" x2="6" y2="18" /><line
									x1="6"
									y1="6"
									x2="18"
									y2="18"
								/></svg
							>
						</button>
					</div>

					<div class="sheet-body-scroll">
						<div class="transfer-visual-flow">
							<div class="tv-box">
								<span class="tv-lbl">Dari:</span>
								<strong class="tv-val">
									{dompetList.find(
										(d) =>
											d.id ===
											Number(transferForm.dari_dompet_id),
									)?.nama || "Pilih Dompet"}
								</strong>
							</div>
							<div class="tv-arrow">
								<svg
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									><polyline points="9 18 15 12 9 6" /></svg
								>
							</div>
							<div class="tv-box">
								<span class="tv-lbl">Ke:</span>
								<strong class="tv-val">
									{dompetList.find(
										(d) =>
											d.id ===
											Number(transferForm.ke_dompet_id),
									)?.nama || "Pilih Dompet"}
								</strong>
							</div>
						</div>

						<div class="sheet-form-grid mt-3">
							<div class="sheet-field">
								<label for="inp-trf-dari"
									>Dari Dompet (Asal)</label
								>
								<select
									id="inp-trf-dari"
									class="native-sheet-input"
									bind:value={transferForm.dari_dompet_id}
								>
									{#each dompetList as d}
										<option value={d.id}>
											{getDompetIcon(d.tipe)}
											{d.nama} ({formatRupiah(
												d.saldo_sekarang,
											)})
										</option>
									{/each}
								</select>
							</div>

							<div class="sheet-field">
								<label for="inp-trf-ke"
									>Ke Dompet (Tujuan)</label
								>
								<select
									id="inp-trf-ke"
									class="native-sheet-input"
									bind:value={transferForm.ke_dompet_id}
								>
									{#each dompetList as d}
										<option value={d.id}>
											{getDompetIcon(d.tipe)}
											{d.nama} ({formatRupiah(
												d.saldo_sekarang,
											)})
										</option>
									{/each}
								</select>
							</div>

							<div class="sheet-field full-width">
								<label for="inp-trf-nominal"
									>Nominal Transfer (Rp)</label
								>
								<input
									id="inp-trf-nominal"
									type="number"
									min="1"
									class="native-sheet-input text-lg font-bold"
									placeholder="Contoh: 150000"
									bind:value={transferForm.nominal}
								/>
								{#if transferForm.nominal > 0}
									<div class="nominal-preview-tag">
										{formatRupiah(transferForm.nominal)}
									</div>
								{/if}
							</div>

							<div class="sheet-field">
								<label for="inp-trf-date">Tanggal</label>
								<input
									id="inp-trf-date"
									type="date"
									class="native-sheet-input"
									bind:value={transferForm.tanggal}
								/>
							</div>

							<div class="sheet-field">
								<label for="inp-trf-cat"
									>Catatan (Opsional)</label
								>
								<input
									id="inp-trf-cat"
									type="text"
									class="native-sheet-input"
									placeholder="Misal: Top up GoPay dari BCA"
									bind:value={transferForm.catatan}
								/>
							</div>
						</div>
					</div>

					<div class="sheet-sticky-footer">
						<button
							type="button"
							class="btn-sheet-cancel"
							onclick={() => (isTransferSheetOpen = false)}
						>
							Batal
						</button>
						<button
							type="button"
							class="btn-sheet-submit"
							onclick={handleTransferSubmit}
							disabled={transferLoading}
						>
							{transferLoading
								? "Memproses Transfer..."
								: "Kirim Transfer Saldo"}
						</button>
					</div>
				</div>
			</div>
		{/if}
	{/if}

	<!-- ==============================================
	     PWA MOBILE INSTALL POPUP BANNER
	     ============================================== -->
	{#if showInstallBanner && !isAppStandalone}
		<div class="pwa-install-banner-wrap {currentUser ? 'has-bottom-nav' : ''}">
			<div class="pwa-install-card">
				<button
					type="button"
					class="pwa-banner-close"
					onclick={dismissInstallBanner}
					aria-label="Tutup Banner"
				>
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
				<div class="pwa-card-top">
					<div class="pwa-app-icon">
						<svg
							width="22"
							height="22"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.3"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path
								d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
							/>
						</svg>
					</div>
					<div class="pwa-card-info">
						<div class="pwa-title-row">
							<span class="pwa-card-title">Pasang CatatAi</span>
							<span class="pwa-native-pill">Gratis</span>
						</div>
						<p class="pwa-card-sub">
							Akses instan dari layar utama HP, bebas repot & hemat kuota
						</p>
					</div>
				</div>
				<div class="pwa-card-actions">
					<button
						type="button"
						class="btn-pwa-dismiss"
						onclick={dismissInstallBanner}
					>
						Nanti Saja
					</button>
					<button
						type="button"
						class="btn-pwa-install"
						onclick={triggerPWAInstall}
					>
						<svg
							width="15"
							height="15"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.4"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="7 10 12 15 17 10" />
							<line x1="12" y1="15" x2="12" y2="3" />
						</svg>
						<span>Pasang di HP ✨</span>
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- ==============================================
	     PWA IOS & MANUAL INSTALL GUIDE BOTTOM SHEET
	     ============================================== -->
	{#if showIosInstallGuide}
		<div
			class="bottom-sheet-backdrop"
			onclick={() => (showIosInstallGuide = false)}
			onkeydown={(e) => {
				if (e.key === "Escape") showIosInstallGuide = false;
			}}
			role="presentation"
		>
			<div
				class="bottom-sheet-sheet pwa-guide-sheet"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
				role="dialog"
				tabindex="-1"
			>
				<div class="sheet-grabber-bar"></div>
				<div class="sheet-header">
					<div class="pwa-guide-header-title">
						<span class="pwa-guide-badge">PANDUAN INSTAL</span>
						<h3 class="sheet-title">Pasang di Layar Utama HP</h3>
					</div>
					<button
						class="sheet-close-btn"
						aria-label="Tutup"
						onclick={() => (showIosInstallGuide = false)}
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.2"
						>
							<line x1="18" y1="6" x2="6" y2="18" /><line
								x1="6"
								y1="6"
								x2="18"
								y2="18"
							/>
						</svg>
					</button>
				</div>

				<div class="sheet-body-scroll pwa-guide-body">
					<div class="pwa-guide-hero">
						<div class="pwa-hero-gem">
							<svg
								width="28"
								height="28"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.3"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path
									d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
								/>
							</svg>
						</div>
						<div class="pwa-hero-text">
							<h4>CatatAi Mobile Web App</h4>
							<p>Aplikasi ringan tanpa perlu download dari App Store / Play Store</p>
						</div>
					</div>

					<div class="pwa-guide-steps">
						<div class="pwa-step-card">
							<div class="step-num-pill">1</div>
							<div class="step-content">
								<p class="step-text">
									Tekan tombol <strong>Bagikan (Share)</strong>
									<span class="ios-share-badge">
										<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
											<polyline points="16 6 12 2 8 6" />
											<line x1="12" y1="2" x2="12" y2="15" />
										</svg>
									</span>
									di bar bawah Safari atau menu browser.
								</p>
							</div>
						</div>

						<div class="pwa-step-card">
							<div class="step-num-pill">2</div>
							<div class="step-content">
								<p class="step-text">
									Gulir ke bawah lalu pilih opsi <strong>"Tambah ke Layar Utama" (Add to Home Screen)</strong>
									<span class="step-icon-badge">➕</span>
								</p>
							</div>
						</div>

						<div class="pwa-step-card">
							<div class="step-num-pill">3</div>
							<div class="step-content">
								<p class="step-text">
									Ketuk tombol <strong>"Tambah" (Add)</strong> di pojok kanan atas layar. Selesai! 🎉
								</p>
							</div>
						</div>
					</div>

					<div class="pwa-guide-footer-box">
						<span class="pgf-icon">💡</span>
						<span class="pgf-text">
							CatatAi langsung tampil di home screen HP Anda seperti aplikasi bawaan dan bisa dibuka full-screen tanpa address bar browser!
						</span>
					</div>

					<button
						type="button"
						class="btn-pwa-guide-done"
						onclick={() => (showIosInstallGuide = false)}
					>
						Siap, Saya Pasang Sekarang 👍
					</button>
				</div>
			</div>
		</div>
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
	.app-mobile-root.app-logged-in {
		height: 100dvh;
		height: 100svh;
		max-height: 100dvh;
		overflow: hidden;
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
	.splash-title {
		font-size: 1.4rem;
		font-weight: 800;
		font-family: "Outfit", sans-serif;
		color: #231f1c;
	}
	.splash-sub {
		font-size: 0.85rem;
		color: #7c746a;
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
		flex-shrink: 0;
	}
	.auth-brand-head .brand-gem-large {
		width: 52px;
		height: 52px;
		border-radius: 14px;
		margin-bottom: 0.35rem;
	}

	/* ====================================================
	   LANDING PAGE: MODERN, RESPONSIVE, RICH FEATURE SHOWCASE
	   ==================================================== */
	.landing-page-wrap {
		min-height: 100dvh;
		background-color: #faf6f0;
		background-image: radial-gradient(
				circle at 10% 15%,
				rgba(16, 185, 129, 0.07) 0%,
				transparent 45%
			),
			radial-gradient(
				circle at 90% 45%,
				rgba(217, 119, 6, 0.06) 0%,
				transparent 50%
			),
			url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23706456' stroke-width='1' stroke-linecap='round' stroke-linejoin='round' opacity='0.05'%3E%3Cpath d='M16 26 h18 a2 2 0 0 1 2 2 v9 a9 9 0 0 1 -9 9 h-2 a9 9 0 0 1 -9 -9 v-9 a2 2 0 0 1 2 -2 z'/%3E%3Crect x='70' y='18' width='30' height='20' rx='4'/%3E%3Ccircle cx='95' cy='85' r='6'/%3E%3C/svg%3E");
		display: flex;
		flex-direction: column;
		scroll-behavior: smooth;
		color: #231f1c;
	}

	/* TOP NAVIGATION BAR */
	.landing-nav-bar {
		position: sticky;
		top: 0;
		z-index: 60;
		background: rgba(250, 246, 240, 0.88);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border-bottom: 1px solid rgba(227, 219, 206, 0.8);
		flex-shrink: 0;
		padding: 0.65rem 1.5rem;
		box-shadow: 0 1px 6px rgba(35, 31, 28, 0.03);
	}
	.landing-nav-inner {
		max-width: 1240px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.25rem;
	}
	.landing-nav-brand {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}
	.brand-logo-text {
		display: flex;
		flex-direction: column;
	}
	.logo-title {
		font-family: "Outfit", sans-serif;
		font-size: 1.3rem;
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

	/* NAV LINKS (DESKTOP) */
	.landing-nav-links {
		display: flex;
		align-items: center;
		gap: 1.4rem;
	}
	.landing-nav-link {
		color: #574f46;
		font-size: 0.86rem;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.15s ease;
		padding: 0.25rem 0.5rem;
		border-radius: 6px;
	}
	.landing-nav-link:hover {
		color: #059669;
		background: rgba(5, 150, 105, 0.06);
	}

	.landing-nav-right {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}
	.landing-status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		background: #ecfdf5;
		border: 1px solid #a7f3d0;
		color: #047857;
		font-size: 0.74rem;
		font-weight: 700;
		padding: 0.35rem 0.8rem;
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
		0% {
			transform: scale(0.95);
			box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
		}
		70% {
			transform: scale(1);
			box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
		}
		100% {
			transform: scale(0.95);
			box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
		}
	}
	.nav-cta-btn {
		background: #059669;
		border: 1px solid #047857;
		color: #ffffff;
		font-weight: 700;
		font-size: 0.82rem;
		padding: 0.42rem 1.05rem;
		border-radius: 8px;
		transition: all 0.15s ease;
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25);
	}
	.nav-cta-btn:hover {
		background: #047857;
		transform: translateY(-1px);
		box-shadow: 0 4px 10px rgba(5, 150, 105, 0.35);
	}

	/* MAIN WRAPPER */
	.landing-main-container {
		flex: 1;
		max-width: 1240px;
		width: 100%;
		margin: 0 auto;
		padding: 2rem 1.5rem 3.5rem;
		display: flex;
		flex-direction: column;
		gap: 4.5rem;
	}

	/* SECTION 1: HERO & AUTH SIDE-BY-SIDE */
	.landing-hero-auth-section {
		display: grid;
		grid-template-columns: 1.15fr 0.85fr;
		gap: 3rem;
		align-items: center;
		padding-top: 1rem;
	}
	.landing-hero-content {
		display: flex;
		flex-direction: column;
	}
	.hero-tag-badge {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: #eef7ee;
		border: 1px solid #c0e6ce;
		color: #047857;
		padding: 0.32rem 0.85rem;
		border-radius: 9999px;
		font-size: 0.78rem;
		font-weight: 700;
		margin-bottom: 1.1rem;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.04);
	}
	.landing-hero-title {
		font-family: "Outfit", sans-serif;
		font-size: clamp(2rem, 3.4vw, 3rem);
		font-weight: 800;
		line-height: 1.16;
		letter-spacing: -0.025em;
		color: #231f1c;
		margin: 0 0 1.1rem 0;
	}
	.accent-text-highlight {
		background: linear-gradient(
			135deg,
			#059669 0%,
			#0d9488 50%,
			#d97706 100%
		);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}
	.landing-hero-subtitle {
		font-size: 1.05rem;
		line-height: 1.6;
		color: #574f46;
		margin: 0 0 1.5rem 0;
	}
	.hero-quick-perks {
		display: flex;
		flex-wrap: wrap;
		gap: 1.1rem;
		margin-bottom: 2rem;
	}
	.hero-perk-item {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.84rem;
		font-weight: 700;
		color: #2e5939;
		background: rgba(16, 185, 129, 0.08);
		padding: 0.3rem 0.75rem;
		border-radius: 6px;
	}
	.hero-action-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.btn-hero-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		background: linear-gradient(135deg, #059669 0%, #047857 100%);
		color: #ffffff;
		font-weight: 800;
		font-size: 0.95rem;
		padding: 0.85rem 1.6rem;
		border-radius: 12px;
		border: none;
		cursor: pointer;
		box-shadow: 0 4px 14px rgba(5, 150, 105, 0.35);
		transition: all 0.2s ease;
	}
	.btn-hero-primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(5, 150, 105, 0.45);
	}
	.btn-hero-secondary {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: #ffffff;
		border: 1.5px solid #d4c7b8;
		color: #403831;
		font-weight: 700;
		font-size: 0.92rem;
		padding: 0.82rem 1.4rem;
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 2px 6px rgba(35, 31, 28, 0.04);
	}
	.btn-hero-secondary:hover {
		background: #fdfbf7;
		border-color: #059669;
		color: #059669;
	}

	/* AUTH BOX SIDE CARD */
	.landing-auth-column {
		display: flex;
		justify-content: center;
	}
	.auth-card-box {
		width: 100%;
		max-width: 440px;
		background: #ffffff;
		border: 1px solid #e3dbce;
		border-radius: 20px;
		padding: 2rem 1.8rem;
		box-shadow:
			0 12px 36px rgba(35, 31, 28, 0.08),
			0 2px 6px rgba(35, 31, 28, 0.03);
	}
	.auth-brand-head {
		text-align: center;
		margin-bottom: 1.3rem;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.auth-app-title {
		font-family: "Outfit", sans-serif;
		font-size: 1.35rem;
		font-weight: 800;
		color: #231f1c;
		margin: 0.6rem 0 0.25rem 0;
	}
	.auth-app-desc {
		font-size: 0.82rem;
		color: #7c746a;
		line-height: 1.4;
		margin: 0;
	}
	.auth-tabs-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.35rem;
		background: #f2ede4;
		padding: 0.3rem;
		border-radius: 10px;
		margin-bottom: 1.25rem;
	}
	.auth-tab-btn {
		background: transparent;
		border: none;
		padding: 0.55rem;
		font-weight: 700;
		font-size: 0.82rem;
		color: #70675c;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.auth-tab-btn.active {
		background: #ffffff;
		color: #231f1c;
		box-shadow: 0 2px 5px rgba(35, 31, 28, 0.08);
	}
	.auth-error-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #b91c1c;
		font-size: 0.8rem;
		font-weight: 600;
		padding: 0.6rem 0.85rem;
		border-radius: 8px;
		margin-bottom: 1rem;
	}
	.auth-form-stack {
		display: flex;
		flex-direction: column;
		gap: 0.95rem;
	}
	.auth-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.auth-field label {
		font-size: 0.78rem;
		font-weight: 700;
		color: #403831;
	}
	.field-label-split {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.btn-toggle-pwd {
		background: none;
		border: none;
		font-size: 0.72rem;
		font-weight: 600;
		color: #059669;
		cursor: pointer;
		padding: 0;
	}
	.auth-input-wrap {
		display: flex;
		align-items: center;
		background: #faf7f2;
		border: 1.5px solid #dfd6c8;
		border-radius: 10px;
		padding: 0 0.85rem;
		transition: all 0.15s ease;
	}
	.auth-input-wrap:focus-within {
		background: #ffffff;
		border-color: #059669;
		box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
	}
	.auth-input-icon {
		color: #8c8275;
		margin-right: 0.55rem;
		flex-shrink: 0;
	}
	.auth-input-wrap input {
		width: 100%;
		border: none;
		background: transparent;
		padding: 0.72rem 0;
		font-size: 0.88rem;
		color: #231f1c;
		outline: none;
	}
	.btn-auth-submit {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		background: linear-gradient(135deg, #059669 0%, #047857 100%);
		color: #ffffff;
		font-weight: 800;
		font-size: 0.92rem;
		padding: 0.8rem;
		border-radius: 10px;
		border: none;
		cursor: pointer;
		margin-top: 0.35rem;
		box-shadow: 0 3px 8px rgba(5, 150, 105, 0.25);
		transition: all 0.15s ease;
	}
	.btn-auth-submit:hover:not(:disabled) {
		background: #047857;
		box-shadow: 0 5px 12px rgba(5, 150, 105, 0.35);
	}
	.btn-auth-submit:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}
	.btn-spinner {
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255, 255, 255, 0.4);
		border-top-color: #ffffff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	.auth-switch-helper {
		text-align: center;
		font-size: 0.8rem;
		color: #70675c;
		margin-top: 1rem;
	}
	.link-switch-auth {
		background: none;
		border: none;
		color: #059669;
		font-weight: 700;
		font-size: 0.8rem;
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
	}
	.auth-security-notice {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		background: #f8faf9;
		border: 1px solid #d1e7dd;
		padding: 0.65rem 0.85rem;
		border-radius: 10px;
		margin-top: 1.1rem;
		color: #1b4332;
	}
	.auth-security-notice svg {
		color: #059669;
		flex-shrink: 0;
		margin-top: 0.15rem;
	}
	.security-text-box strong {
		display: block;
		font-size: 0.75rem;
		font-weight: 800;
	}
	.security-text-box p {
		margin: 0.15rem 0 0 0;
		font-size: 0.71rem;
		color: #526359;
		line-height: 1.35;
	}

	/* SECTION HEADERS */
	.landing-section-block {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		scroll-margin-top: 5rem;
	}
	.section-header-center {
		text-align: center;
		max-width: 680px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
	}
	.section-kicker {
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #059669;
		text-transform: uppercase;
	}
	.section-heading {
		font-family: "Outfit", sans-serif;
		font-size: clamp(1.6rem, 2.5vw, 2.2rem);
		font-weight: 800;
		color: #231f1c;
		line-height: 1.22;
		letter-spacing: -0.02em;
		margin: 0;
	}
	.section-subtext {
		font-size: 0.95rem;
		color: #635b51;
		line-height: 1.5;
		margin: 0;
	}

	/* INTERACTIVE DEMO STAGE */
	.demo-tabs-carousel {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.demo-nav-tab {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: #ffffff;
		border: 1.5px solid #ded5c7;
		padding: 0.65rem 1.15rem;
		border-radius: 9999px;
		font-weight: 700;
		font-size: 0.84rem;
		color: #574e45;
		cursor: pointer;
		transition: all 0.18s ease;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.04);
	}
	.demo-nav-tab:hover {
		border-color: #059669;
		color: #059669;
		background: #fdfcf9;
	}
	.demo-nav-tab.active {
		background: #059669;
		border-color: #047857;
		color: #ffffff;
		box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
	}

	.demo-interactive-stage {
		background: #ffffff;
		border: 1px solid #e1d8cb;
		border-radius: 20px;
		padding: 2rem;
		box-shadow: 0 12px 30px rgba(35, 31, 28, 0.05);
	}
	.demo-panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid #ebe4d8;
		padding-bottom: 1.1rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
		gap: 0.8rem;
	}
	.demo-panel-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.pulse-audio-icon {
		font-size: 1.6rem;
	}
	.demo-panel-title strong {
		display: block;
		font-size: 1.05rem;
		font-weight: 800;
		color: #231f1c;
	}
	.demo-panel-title span {
		font-size: 0.8rem;
		color: #756c61;
	}
	.badge-tech {
		background: #f2ede4;
		color: #4b4237;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.3rem 0.65rem;
		border-radius: 6px;
	}

	/* VOICE SIMULATION STYLES */
	.voice-simulation-content,
	.scan-simulation-content {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 1.5rem;
		align-items: center;
	}
	.voice-audio-card {
		background: #faf6f0;
		border: 1.5px dashed #cfc5b4;
		border-radius: 14px;
		padding: 1.4rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.9rem;
	}
	.recording-badge-mock {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: #fee2e2;
		color: #dc2626;
		font-size: 0.74rem;
		font-weight: 800;
		padding: 0.25rem 0.65rem;
		border-radius: 9999px;
	}
	.rec-red-dot {
		width: 7px;
		height: 7px;
		background: #dc2626;
		border-radius: 50%;
		animation: pulseDot 1s infinite;
	}
	.audio-waves-visual {
		display: flex;
		align-items: center;
		gap: 5px;
		height: 38px;
	}
	.wave-bar {
		width: 5px;
		background: #059669;
		border-radius: 9999px;
		animation: soundWave 1.2s ease-in-out infinite alternate;
	}
	.wave-bar.h1 {
		height: 12px;
		animation-delay: 0.1s;
	}
	.wave-bar.h2 {
		height: 22px;
		animation-delay: 0.3s;
	}
	.wave-bar.h3 {
		height: 32px;
		animation-delay: 0.2s;
	}
	.wave-bar.h4 {
		height: 26px;
		animation-delay: 0.4s;
	}
	.wave-bar.h5 {
		height: 38px;
		animation-delay: 0.5s;
	}
	@keyframes soundWave {
		0% {
			transform: scaleY(0.4);
			opacity: 0.6;
		}
		100% {
			transform: scaleY(1.1);
			opacity: 1;
		}
	}
	.voice-transcription-preview {
		font-style: italic;
		font-size: 0.88rem;
		color: #3b342e;
		background: #ffffff;
		border: 1px solid #ded6c9;
		padding: 0.6rem 0.85rem;
		border-radius: 8px;
		margin: 0;
	}

	.demo-arrow-flow {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		color: #059669;
		font-size: 0.72rem;
		font-weight: 800;
		text-align: center;
	}
	.demo-result-card {
		background: #fdfbf7;
		border: 1.5px solid #a7f3d0;
		border-radius: 14px;
		padding: 1.25rem 1.4rem;
		box-shadow: 0 4px 14px rgba(16, 185, 129, 0.08);
	}
	.result-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px dashed #d1fae5;
		padding-bottom: 0.65rem;
		margin-bottom: 0.75rem;
	}
	.result-badge-success {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		color: #047857;
		font-size: 0.78rem;
		font-weight: 800;
	}
	.result-time {
		font-size: 0.72rem;
		color: #797166;
	}
	.result-amount {
		font-family: "Outfit", sans-serif;
		font-size: 1.4rem;
		font-weight: 800;
		margin-bottom: 0.2rem;
	}
	.danger-text {
		color: #dc2626;
	}
	.success-text {
		color: #059669;
	}
	.primary-text {
		color: #2563eb;
	}
	.result-desc {
		font-size: 0.86rem;
		font-weight: 700;
		color: #231f1c;
		margin-bottom: 0.8rem;
	}
	.result-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.tag-pill {
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.22rem 0.55rem;
		border-radius: 6px;
	}
	.category-pill {
		background: #fef3c7;
		color: #b45309;
	}
	.wallet-pill {
		background: #e0e7ff;
		color: #4338ca;
	}
	.voice-pill {
		background: #dcfce7;
		color: #15803d;
	}
	.scan-pill {
		background: #fae8ff;
		color: #86198f;
	}

	/* RECEIPT SCAN STYLES */
	.mock-receipt-sheet {
		position: relative;
		background: #ffffff;
		border: 1px solid #d4ccbf;
		border-radius: 4px;
		padding: 1.2rem;
		box-shadow: 0 4px 12px rgba(35, 31, 28, 0.08);
		font-family: monospace;
		font-size: 0.8rem;
		color: #3b352e;
		overflow: hidden;
	}
	.receipt-store-title {
		font-weight: 900;
		text-align: center;
		font-size: 0.9rem;
		letter-spacing: 0.05em;
	}
	.receipt-date {
		text-align: center;
		font-size: 0.7rem;
		color: #756d62;
		margin-bottom: 0.4rem;
	}
	.receipt-divider {
		color: #bbb0a0;
		overflow: hidden;
		text-align: center;
		font-size: 0.7rem;
		margin: 0.3rem 0;
	}
	.receipt-item-row,
	.receipt-total-row {
		display: flex;
		justify-content: space-between;
		line-height: 1.5;
	}
	.receipt-total-row {
		margin-top: 0.4rem;
		font-size: 0.85rem;
		color: #111;
	}
	.receipt-scan-laser-line {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(90deg, transparent, #10b981, transparent);
		box-shadow: 0 0 10px #10b981;
		animation: laserScan 2.5s ease-in-out infinite alternate;
	}
	@keyframes laserScan {
		0% {
			top: 0%;
		}
		100% {
			top: 95%;
		}
	}

	/* WALLET DEMO STYLES */
	.dompet-simulation-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.wallets-grid-demo {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.2rem;
	}
	.demo-wallet-card {
		border-radius: 14px;
		padding: 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		box-shadow: 0 3px 10px rgba(35, 31, 28, 0.04);
		transition: transform 0.2s ease;
	}
	.demo-wallet-card:hover {
		transform: translateY(-2px);
	}
	.cash-card {
		background: linear-gradient(135deg, #f0fdf4 0%, #e6f4ea 100%);
		border: 1px solid #bbf7d0;
	}
	.bank-card {
		background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
		border: 1px solid #bfdbfe;
	}
	.ewallet-card {
		background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
		border: 1px solid #fde68a;
	}
	.d-wallet-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.d-wallet-icon {
		font-size: 1.3rem;
	}
	.d-wallet-type {
		font-size: 0.68rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.75;
	}
	.d-wallet-name {
		font-weight: 800;
		font-size: 0.95rem;
		color: #231f1c;
	}
	.d-wallet-balance {
		font-family: "Outfit", sans-serif;
		font-size: 1.28rem;
		font-weight: 800;
		color: #231f1c;
	}
	.d-wallet-action-hint {
		font-size: 0.72rem;
		color: #61574d;
		margin-top: 0.2rem;
	}
	.demo-transfer-notice {
		background: #fdfbf7;
		border: 1px solid #e5dcce;
		border-radius: 12px;
		padding: 1rem 1.3rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.transfer-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: #059669;
		font-weight: 800;
		font-size: 0.78rem;
	}
	.demo-transfer-notice p {
		margin: 0;
		font-size: 0.84rem;
		color: #574e44;
		line-height: 1.45;
	}

	/* REPORT & CHART DEMO STYLES */
	.report-simulation-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.demo-chart-box {
		background: #faf7f2;
		border: 1px solid #e3dacd;
		border-radius: 14px;
		padding: 1.4rem;
	}
	.chart-box-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.2rem;
		font-size: 0.88rem;
		color: #3b342e;
	}
	.chart-summary-stat {
		font-weight: 800;
		color: #dc2626;
	}
	.demo-bars-wrap {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 0.85rem;
		height: 110px;
		align-items: flex-end;
		border-bottom: 1.5px solid #ded5c8;
		padding-bottom: 0.4rem;
	}
	.demo-bar-col {
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
		gap: 0.4rem;
	}
	.demo-bar-fill {
		width: 100%;
		max-width: 32px;
		background: #cbd5e1;
		border-radius: 6px 6px 0 0;
		transition: all 0.3s ease;
	}
	.demo-bar-fill.active-highest {
		background: linear-gradient(180deg, #f87171 0%, #dc2626 100%);
	}
	.demo-bar-col:hover .demo-bar-fill {
		background: #059669;
	}
	.demo-bar-day {
		font-size: 0.72rem;
		font-weight: 700;
		color: #786f63;
	}
	.demo-breakdown-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}
	.breakdown-card {
		background: #ffffff;
		border: 1px solid #e2d9cd;
		border-radius: 12px;
		padding: 1rem 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.b-label {
		font-size: 0.72rem;
		font-weight: 700;
		color: #786f63;
	}
	.b-val {
		font-family: "Outfit", sans-serif;
		font-size: 1.2rem;
		font-weight: 800;
	}

	/* BENTO GRID (SECTION 3) */
	.bento-features-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.35rem;
	}
	.bento-card {
		position: relative;
		background: #ffffff;
		border: 1px solid #e3d9cb;
		border-radius: 18px;
		padding: 1.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		box-shadow: 0 4px 16px rgba(35, 31, 28, 0.04);
		transition: all 0.2s ease;
	}
	.bento-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 24px rgba(35, 31, 28, 0.08);
		border-color: #cbd5e1;
	}
	.bento-card.highlight-border {
		border-color: #a7f3d0;
		background: linear-gradient(180deg, #ffffff 0%, #fafffe 100%);
	}
	.bento-badge-chip {
		position: absolute;
		top: 1.2rem;
		right: 1.2rem;
		background: #e6f4ea;
		color: #047857;
		font-size: 0.72rem;
		font-weight: 800;
		padding: 0.22rem 0.55rem;
		border-radius: 9999px;
		border: 1px solid #bbf7d0;
	}
	.bento-icon-box {
		width: 46px;
		height: 46px;
		background: #f4efe7;
		border: 1px solid #e2d9cd;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #059669;
	}
	.bento-card.highlight-border .bento-icon-box {
		background: #ecfdf5;
		border-color: #bbf7d0;
	}
	.bento-title {
		font-family: "Outfit", sans-serif;
		font-size: 1.15rem;
		font-weight: 800;
		color: #231f1c;
		margin: 0;
	}
	.bento-desc {
		font-size: 0.86rem;
		color: #635b51;
		line-height: 1.5;
		margin: 0;
		flex: 1;
	}
	.bento-mini-pill {
		align-self: flex-start;
		font-size: 0.72rem;
		font-weight: 700;
		color: #059669;
		background: rgba(5, 150, 105, 0.08);
		padding: 0.28rem 0.65rem;
		border-radius: 6px;
	}

	/* COMPARISON TABLE (SECTION 4) */
	.comparison-table-wrapper {
		background: #ffffff;
		border: 1px solid #e3d9cb;
		border-radius: 18px;
		overflow-x: auto;
		box-shadow: 0 6px 20px rgba(35, 31, 28, 0.05);
	}
	.comparison-table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
		font-size: 0.86rem;
	}
	.comparison-table th,
	.comparison-table td {
		padding: 1.1rem 1.3rem;
		border-bottom: 1px solid #eee7dc;
	}
	.comparison-table thead th {
		background: #faf6f0;
		font-family: "Outfit", sans-serif;
		font-weight: 800;
		font-size: 0.92rem;
		color: #3d352d;
	}
	.th-catatai.highlight-col,
	td.highlight-col {
		background: #f4faf6;
		border-left: 2px solid #10b981;
		border-right: 2px solid #10b981;
	}
	.th-catatai.highlight-col {
		color: #047857;
		font-size: 1rem;
	}
	.td-feature-title {
		font-weight: 700;
		color: #231f1c;
	}
	.badge-yes {
		color: #047857;
		font-weight: 700;
	}
	.badge-no {
		color: #b91c1c;
		font-weight: 600;
	}
	.badge-neutral {
		color: #b45309;
		font-weight: 600;
	}

	/* FAQ ACCORDION (SECTION 4.5 - SEO RICH) */
	.landing-faq-container {
		max-width: 860px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.faq-item {
		background: #ffffff;
		border: 1px solid #e5ded4;
		border-radius: 16px;
		overflow: hidden;
		transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.04);
	}
	.faq-item:hover {
		border-color: #cbd5e1;
		box-shadow: 0 4px 12px rgba(35, 31, 28, 0.06);
	}
	.faq-item.faq-item-open {
		border-color: #10b981;
		box-shadow: 0 6px 18px rgba(16, 185, 129, 0.1);
	}
	.faq-header-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem 1.4rem;
		background: transparent;
		text-align: left;
		cursor: pointer;
		border: none;
		outline: none;
	}
	.faq-question-wrap {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
		flex-wrap: wrap;
	}
	.faq-badge {
		font-size: 0.72rem;
		font-weight: 700;
		color: #059669;
		background: #e6f4ea;
		padding: 0.22rem 0.6rem;
		border-radius: 999px;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}
	.faq-question-title {
		font-family: "Outfit", sans-serif;
		font-size: 1.05rem;
		font-weight: 700;
		color: #1f2937;
		margin: 0;
		line-height: 1.4;
	}
	.faq-item.faq-item-open .faq-question-title {
		color: #047857;
	}
	.faq-chevron-icon {
		color: #6b7280;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), color 0.25s;
		flex-shrink: 0;
	}
	.faq-item.faq-item-open .faq-chevron-icon {
		transform: rotate(180deg);
		color: #059669;
	}
	.faq-body-panel {
		padding: 0 1.4rem 1.35rem 1.4rem;
		border-top: 1px dashed #f1ece4;
		margin-top: 0.25rem;
		animation: faqFadeIn 0.25s ease-out;
	}
	.faq-answer-text {
		font-size: 0.94rem;
		color: #4b5563;
		line-height: 1.65;
		margin: 0;
		padding-top: 0.85rem;
	}
	@keyframes faqFadeIn {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* BOTTOM CTA (SECTION 5) */
	.landing-bottom-cta {
		margin-top: 1rem;
	}
	.bottom-cta-card {
		background: linear-gradient(
			135deg,
			#1f2937 0%,
			#111827 50%,
			#064e3b 100%
		);
		border-radius: 24px;
		padding: 3.5rem 2rem;
		text-align: center;
		color: #ffffff;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.1rem;
		box-shadow: 0 16px 40px rgba(17, 24, 39, 0.2);
	}
	.bottom-cta-sparkle {
		font-size: 2.2rem;
	}
	.bottom-cta-title {
		font-family: "Outfit", sans-serif;
		font-size: clamp(1.8rem, 3vw, 2.5rem);
		font-weight: 800;
		line-height: 1.2;
		max-width: 650px;
		margin: 0;
	}
	.bottom-cta-sub {
		font-size: 1rem;
		color: #d1d5db;
		max-width: 580px;
		line-height: 1.5;
		margin: 0;
	}
	.btn-cta-bottom {
		background: #10b981;
		color: #ffffff;
		font-weight: 800;
		font-size: 1rem;
		padding: 0.95rem 2rem;
		border-radius: 12px;
		border: none;
		cursor: pointer;
		margin-top: 0.6rem;
		box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);
		transition: all 0.2s ease;
	}
	.btn-cta-bottom:hover {
		background: #059669;
		transform: translateY(-2px);
		box-shadow: 0 6px 22px rgba(16, 185, 129, 0.5);
	}

	/* LANDING FOOTER */
	.landing-page-footer {
		background: #f4ede3;
		border-top: 1px solid #e1d7c9;
		padding: 1.8rem 1.5rem;
		margin-top: auto;
	}
	.footer-inner {
		max-width: 1240px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		flex-wrap: wrap;
	}
	.footer-left {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.footer-brand-title {
		font-family: "Outfit", sans-serif;
		font-weight: 800;
		font-size: 1.15rem;
		color: #231f1c;
	}
	.footer-copy {
		font-size: 0.78rem;
		color: #797166;
		margin: 0;
	}
	.footer-right {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.76rem;
		color: #797166;
	}
	.dot-sep {
		opacity: 0.5;
	}

	/* RESPONSIVE BREAKPOINTS */
	@media (max-width: 1024px) {
		.bento-features-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.wallets-grid-demo {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 860px) {
		.landing-nav-links {
			display: none;
		}
		.landing-hero-auth-section {
			grid-template-columns: 1fr;
			gap: 2.5rem;
		}
		.landing-auth-column {
			width: 100%;
		}
		.auth-card-box {
			max-width: 100%;
		}
		.voice-simulation-content,
		.scan-simulation-content {
			grid-template-columns: 1fr;
		}
		.demo-arrow-flow {
			transform: rotate(90deg);
			margin: 0.5rem 0;
		}
		.bento-features-grid {
			grid-template-columns: 1fr;
		}
		.demo-breakdown-row {
			grid-template-columns: 1fr;
		}
		.status-badge-text {
			display: none;
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
		flex-shrink: 0;
	}

	.brand-unit {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
	}

	.brand-gem-modern {
		width: 30px;
		height: 30px;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25);
		flex-shrink: 0;
	}

	.brand-meta {
		display: flex;
		flex-direction: column;
		line-height: 1.15;
		min-width: 0;
	}

	.brand-name-bold {
		font-size: 1.05rem;
		font-weight: 800;
		font-family: "Outfit", sans-serif;
		color: #231f1c;
		letter-spacing: -0.02em;
	}

	.brand-kpi-sub {
		font-size: 0.68rem;
		color: #787063;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.text-expense {
		color: #dc2626;
		font-weight: 700;
	}
	.text-neutral {
		color: #554d42;
		font-weight: 600;
	}

	.header-actions-cluster {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.btn-action-add {
		background: #ffffff;
		border: 1px solid #ded5c8;
		color: #231f1c;
		font-weight: 700;
		padding: 0.35rem 0.65rem;
		border-radius: 9999px;
		font-size: 0.76rem;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.05);
		transition:
			background 0.15s,
			transform 0.1s;
	}
	.btn-action-add:active {
		transform: scale(0.96);
		background: #f5efe4;
	}

	.btn-avatar-profile {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: transparent;
		border: none;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		position: relative;
		transition: transform 0.1s;
	}
	.btn-avatar-profile:active {
		transform: scale(0.92);
	}

	.avatar-letter-wrapper {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.btn-avatar-profile .avatar-letter {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: linear-gradient(135deg, #059669 0%, #047857 100%);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
		font-weight: 800;
		box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25);
		border: 2px solid #ffffff;
	}

	.avatar-pro-badge {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 14px;
		height: 14px;
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
		border: 1.5px solid #ffffff;
		border-radius: 50%;
		font-size: 7px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
		line-height: 1;
		pointer-events: none;
	}

	.desktop-pro-pill {
		display: none;
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
		color: #ffffff;
		font-size: 0.62rem;
		font-weight: 800;
		padding: 0.1rem 0.4rem;
		border-radius: 9999px;
		letter-spacing: 0.02em;
		font-family: "Outfit", sans-serif;
	}

	/* ROW 2: SEGMENTED TABS (HIDDEN ON MOBILE, VISIBLE ON DESKTOP) */
	.header-tier-tabs {
		display: none;
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
	.alert-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.alert-danger {
		background: #fee2e2;
		border: 1px solid #fecaca;
		color: #b91c1c;
	}
	.alert-success {
		background: #ecfdf5;
		border: 1px solid #a7f3d0;
		color: #047857;
	}
	.alert-close {
		background: transparent;
		display: flex;
		align-items: center;
		justify-content: center;
		color: inherit;
		padding: 2px;
	}

	/* MAIN VIEWPORT */
	.app-main {
		flex: 1 1 0%;
		min-height: 0;
		display: flex;
		flex-direction: column;
		max-width: 900px;
		width: 100%;
		margin: 0 auto;
		overflow: hidden;
	}

	/* ====================================================
	   CHAT MOBILE EXPERIENCE (CLEAN STREAM, ZERO OVERLAP)
	   ==================================================== */
	.chat-mobile-container {
		flex: 1 1 0%;
		min-height: 0;
		display: flex;
		flex-direction: column;
		height: 100%;
		background: #efeae2;
		position: relative;
		overflow: hidden;
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
		font-family: "Outfit", sans-serif;
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
		font-family: "Outfit", sans-serif;
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
		font-family: "Outfit", sans-serif;
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
		font-family: "Outfit", sans-serif;
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
		font-family: "Outfit", sans-serif;
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
	.feat-bullet {
		font-size: 0.8rem;
		flex-shrink: 0;
	}

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
	.upgrade-note-box svg {
		color: #d97706;
		flex-shrink: 0;
	}

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
	.bot-side {
		align-self: flex-start;
	}
	.user-side {
		align-self: flex-end;
		flex-direction: row-reverse;
	}

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

	.msg-media-wrap {
		margin-bottom: 0.45rem;
	}
	.msg-media-img {
		max-width: 100%;
		max-height: 200px;
		border-radius: 10px;
		border: 1px solid rgba(0, 0, 0, 0.08);
		object-fit: cover;
	}
	.msg-text-content {
		white-space: pre-wrap;
		word-break: break-word;
	}

	.msg-footer-meta {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.25rem;
		margin-top: 0.3rem;
		font-size: 0.64rem;
		color: #8c8376;
	}
	.user-side .msg-footer-meta {
		color: #537a5b;
	}
	.msg-check-svg {
		margin-left: 1px;
	}

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
	.draft-icon-income {
		color: #059669;
	}
	.draft-icon-expense {
		color: #dc2626;
	}

	.pill-type {
		font-size: 0.65rem;
		font-weight: 800;
		padding: 0.15rem 0.5rem;
		border-radius: 9999px;
	}
	.pill-income {
		background: #dcfce7;
		color: #15803d;
		border: 1px solid #bbf7d0;
	}
	.pill-expense {
		background: #fee2e2;
		color: #b91c1c;
		border: 1px solid #fecaca;
	}

	.draft-grid-info {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.35rem 0.65rem;
		font-size: 0.78rem;
	}
	.draft-col {
		display: flex;
		flex-direction: column;
	}
	.col-k {
		font-size: 0.68rem;
		color: #7c7366;
	}
	.col-v-bold {
		font-weight: 700;
		color: #231f1c;
	}
	.col-v {
		color: #433d34;
	}
	.method-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
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
	.draft-item-entry {
		display: flex;
		justify-content: space-between;
	}
	.entry-sub {
		font-weight: 600;
		color: #231f1c;
	}

	.draft-total-banner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-top: 1px dashed #d5ccbe;
		padding-top: 0.5rem;
	}
	.tot-caption {
		font-weight: 700;
		font-size: 0.85rem;
		color: #231f1c;
	}
	.tot-val {
		font-weight: 800;
		font-size: 1.15rem;
		font-family: "Outfit", sans-serif;
	}
	.color-expense {
		color: #dc2626;
	}
	.color-income {
		color: #059669;
	}
	.color-blue {
		color: #2563eb;
	}

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
		transition:
			transform 0.1s,
			opacity 0.1s;
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
	.btn-sub-edit:active {
		background: #f3ede2;
	}
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
	.btn-sub-cancel:active {
		background: #fed7d7;
	}

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
	.saved-banner-left {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
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
	.bounce-dot:nth-child(2) {
		animation-delay: 0.2s;
	}
	.bounce-dot:nth-child(3) {
		animation-delay: 0.4s;
	}
	.loading-label {
		font-size: 0.75rem;
		color: #7c746a;
		margin-left: 0.3rem;
	}

	@keyframes dotBounce {
		0%,
		80%,
		100% {
			transform: scale(0.6);
			opacity: 0.4;
		}
		40% {
			transform: scale(1.1);
			opacity: 1;
		}
	}

	.attached-media-bar {
		background: #faf7f0;
		border-top: 1px solid #e8dfd3;
		padding: 0.45rem 0.85rem;
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}
	.thumb-container {
		position: relative;
		width: 40px;
		height: 40px;
	}
	.thumb-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 6px;
		border: 1px solid #d5cbbe;
	}
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
	.thumb-caption {
		font-size: 0.75rem;
		color: #736b60;
	}

	/* STICKY BOTTOM INPUT BAR */
	.chat-bottom-dock {
		background: #faf6f0;
		border-top: 1px solid #ebd9c8;
		padding-bottom: 0;
	}
	.chat-quick-shortcuts {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.75rem 0.1rem;
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
		padding: 0.45rem 0.75rem;
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
	.btn-dock-attach:active {
		background: #ede6da;
	}
	.input-file-native {
		display: none;
	}
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
	.input-dock-text:focus {
		border-color: #059669;
	}
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
		transition:
			opacity 0.15s,
			transform 0.1s;
	}
	.btn-dock-send:active {
		transform: scale(0.95);
	}
	.btn-dock-send:disabled {
		background: #d5cbbe;
		opacity: 0.6;
		box-shadow: none;
	}

	/* VOICE NOTE & RECORDING STYLES */
	.btn-dock-mic {
		width: 40px;
		height: 40px;
		background: #059669;
		color: #ffffff;
		border: none;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		box-shadow: 0 2px 6px rgba(5, 150, 105, 0.28);
		transition:
			background 0.15s,
			transform 0.1s;
	}
	.btn-dock-mic:hover {
		background: #047857;
		transform: scale(1.05);
	}
	.btn-dock-mic:active {
		transform: scale(0.95);
	}
	.btn-dock-mic:disabled {
		background: #d5cbbe;
		opacity: 0.6;
		box-shadow: none;
		cursor: not-allowed;
	}

	.dock-form-row.is-recording-mode {
		background: #fff7ed;
		border-radius: 14px;
	}

	.voice-recording-pill {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: #ffffff;
		border: 1.5px solid #ea580c;
		border-radius: 9999px;
		padding: 0.45rem 0.85rem;
		min-width: 0;
		box-shadow: 0 1px 3px rgba(234, 88, 12, 0.15);
	}
	.vrp-pulse-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #dc2626;
		animation: pulseRed 0.8s infinite alternate ease-in-out;
		flex-shrink: 0;
	}
	@keyframes pulseRed {
		from {
			transform: scale(0.8);
			opacity: 0.5;
		}
		to {
			transform: scale(1.3);
			opacity: 1;
		}
	}
	.vrp-timer {
		font-weight: 800;
		font-size: 0.8rem;
		color: #dc2626;
		font-family: monospace;
		flex-shrink: 0;
	}
	.vrp-waves {
		display: flex;
		align-items: center;
		gap: 2px;
		height: 14px;
		flex-shrink: 0;
	}
	.vrp-waves span {
		width: 2.5px;
		height: 100%;
		background: #ea580c;
		border-radius: 2px;
		animation: waveBar 0.8s ease-in-out infinite alternate;
	}
	.vrp-waves span:nth-child(2) {
		animation-delay: 0.2s;
		height: 60%;
	}
	.vrp-waves span:nth-child(3) {
		animation-delay: 0.4s;
		height: 90%;
	}
	.vrp-waves span:nth-child(4) {
		animation-delay: 0.15s;
		height: 45%;
	}
	@keyframes waveBar {
		0% {
			transform: scaleY(0.25);
		}
		100% {
			transform: scaleY(1);
		}
	}
	.vrp-status-text {
		flex: 1;
		font-size: 0.82rem;
		color: #231f1c;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-style: italic;
	}
	.btn-dock-cancel-voice {
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: #fee2e2;
		border: 1px solid #fecaca;
		color: #b91c1c;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		transition:
			background 0.15s,
			transform 0.1s;
	}
	.btn-dock-cancel-voice:active {
		transform: scale(0.92);
	}
	.btn-dock-send-voice {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
	}

	.voice-note-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: #e0f2fe;
		color: #0369a1;
		border: 1px solid #bae6fd;
		padding: 0.1rem 0.45rem;
		border-radius: 9999px;
		font-size: 0.68rem;
		font-weight: 700;
		margin-bottom: 0.3rem;
	}

	/* ====================================================
	   REPORT MOBILE VIEW (WARM THEME)
	   ==================================================== */
	.report-mobile-container {
		flex: 1 1 0%;
		min-height: 0;
		height: 100%;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 0.85rem 0.85rem 3.5rem;
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
		font-family: "Outfit", sans-serif;
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
		transition:
			transform 0.15s,
			box-shadow 0.15s;
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
	.kpi-lbl-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.kpi-lbl {
		font-size: 0.72rem;
		font-weight: 600;
		color: #7c746a;
	}
	.dot-badge {
		font-size: 0.6rem;
		font-weight: 800;
		padding: 0.1rem 0.35rem;
		border-radius: 9999px;
	}
	.badge-red {
		background: #fee2e2;
		color: #b91c1c;
	}
	.badge-green {
		background: #dcfce7;
		color: #15803d;
	}
	.badge-blue {
		background: #e0e7ff;
		color: #1d4ed8;
	}
	.kpi-num {
		font-size: 1.15rem;
		font-weight: 800;
		font-family: "Outfit", sans-serif;
		margin: 0.25rem 0 0.1rem;
	}
	.kpi-subt {
		font-size: 0.65rem;
		color: #8e8579;
	}

	.card-mobile-panel {
		background: #ffffff;
		border: 1px solid #e6ded3;
		border-radius: 12px;
		padding: 0.85rem;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.03);
	}
	.panel-title {
		font-size: 0.95rem;
		font-weight: 700;
		color: #231f1c;
		font-family: "Outfit", sans-serif;
	}
	.panel-sub {
		font-size: 0.72rem;
		color: #7c746a;
		margin-bottom: 0.85rem;
	}

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
	.touch-date {
		font-size: 0.65rem;
		color: #8e8579;
		margin-top: 0.3rem;
	}

	.category-bars-col {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
	.cat-bar-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.cat-bar-header {
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
	}
	.cat-title {
		font-weight: 600;
		color: #3b352e;
	}
	.cat-sum {
		color: #7c746a;
	}
	.cat-track {
		height: 6px;
		background: #f4eee4;
		border-radius: 9999px;
		overflow: hidden;
	}
	.cat-fill {
		height: 100%;
		background: #059669;
		border-radius: 9999px;
	}

	.merchant-mini-list {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.merchant-mini-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.65rem;
		background: #faf7f2;
		border: 1px solid #e8dfd3;
		border-radius: 8px;
	}
	.m-rank {
		font-weight: 800;
		color: #7c746a;
		font-size: 0.85rem;
		width: 22px;
	}
	.m-info {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.m-name {
		font-weight: 600;
		font-size: 0.82rem;
		color: #231f1c;
	}
	.m-cnt {
		font-size: 0.68rem;
		color: #8e8579;
	}
	.m-tot {
		font-weight: 700;
		color: #dc2626;
		font-size: 0.85rem;
	}

	.daily-picker-box {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.65rem;
	}
	.daily-picker-left {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.daily-lbl {
		font-size: 0.75rem;
		font-weight: 600;
		color: #554d42;
	}
	.picker-date-native {
		background: #faf7f2;
		border: 1px solid #ded5c8;
		padding: 0.35rem 0.5rem;
		border-radius: 6px;
		font-weight: 600;
		font-size: 0.8rem;
		color: #231f1c;
	}
	.daily-chips-stats {
		display: flex;
		gap: 0.5rem;
	}
	.stat-pill-item {
		background: #faf7f2;
		border: 1px solid #e8dfd3;
		padding: 0.3rem 0.6rem;
		border-radius: 6px;
		display: flex;
		gap: 0.35rem;
		font-size: 0.75rem;
	}
	.sp-lbl {
		color: #7c746a;
	}
	.sp-val {
		font-weight: 700;
	}
	.daily-list-title {
		font-size: 0.85rem;
		font-weight: 700;
		color: #3b352e;
	}

	/* MOBILE TRANSACTION CARDS STREAM */
	.mobile-cards-stream {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
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
	.mobile-tx-entry:active {
		background: #f2ece1;
	}
	.entry-icon {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.icon-red {
		background: #fee2e2;
		color: #dc2626;
		border: 1px solid #fecaca;
	}
	.icon-green {
		background: #dcfce7;
		color: #059669;
		border: 1px solid #bbf7d0;
	}
	.entry-core {
		flex: 1;
		min-width: 0;
	}
	.entry-row-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}
	.entry-merchant {
		font-weight: 700;
		font-size: 0.85rem;
		color: #231f1c;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.entry-amount {
		font-weight: 800;
		font-size: 0.88rem;
		font-family: "Outfit", sans-serif;
		white-space: nowrap;
		flex-shrink: 0;
	}
	.entry-amount-cluster {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-shrink: 0;
	}
	.ctx-amount-cluster {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-shrink: 0;
	}
	.btn-row-edit {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: 6px;
		background: #f1ede6;
		border: 1px solid #ded6c9;
		color: #554d42;
		cursor: pointer;
		padding: 0;
		transition: all 0.15s ease;
	}
	.btn-row-edit:hover {
		background: #e0f2fe;
		border-color: #7dd3fc;
		color: #0284c7;
		transform: scale(1.05);
	}
	.btn-row-edit:active {
		transform: scale(0.95);
	}
	.entry-row-sub {
		font-size: 0.68rem;
		color: #7c746a;
		margin-top: 0.1rem;
	}

	.search-and-export {
		display: flex;
		gap: 0.45rem;
		margin-bottom: 0.5rem;
	}
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
	.mobile-search-bar input {
		background: transparent;
		border: none;
		outline: none;
		width: 100%;
		color: #231f1c;
	}
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
	.mobile-filter-pills {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 0.65rem;
	}
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

	.empty-panel-text {
		text-align: center;
		padding: 2rem 1rem;
		font-size: 0.82rem;
		color: #8e8579;
	}
	.mt-2 {
		margin-top: 0.5rem;
	}
	.mt-3 {
		margin-top: 0.75rem;
	}

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
	.profile-user-info {
		display: flex;
		flex-direction: column;
	}
	.profile-name-text {
		font-size: 1.1rem;
		font-weight: 800;
		color: #231f1c;
		font-family: "Outfit", sans-serif;
	}
	.profile-email-text {
		font-size: 0.75rem;
		color: #7c746a;
	}

	.profile-stats-card {
		display: flex;
		background: #ffffff;
		border: 1px solid #e6ded3;
		border-radius: 12px;
		padding: 0.85rem;
		box-shadow: 0 1px 4px rgba(35, 31, 28, 0.04);
	}
	.stat-mini-col {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		text-align: center;
	}
	.stat-divider-line {
		width: 1px;
		background: #e8dfd3;
		margin: 0 0.5rem;
	}
	.sm-lbl {
		font-size: 0.68rem;
		color: #7c746a;
	}
	.sm-val {
		font-size: 0.95rem;
		font-weight: 800;
		font-family: "Outfit", sans-serif;
	}

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
	.btn-install-pwa-sheet:active {
		background: #d1fae5;
	}
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
	.btn-logout-full:active {
		background: #fee2e2;
	}

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
	.sheet-title {
		font-size: 1.05rem;
		font-weight: 700;
		color: #231f1c;
		font-family: "Outfit", sans-serif;
	}
	.sheet-close-btn {
		background: transparent;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #7c746a;
		padding: 4px;
	}

	/* ====================================================
	   PWA MOBILE INSTALL POPUP BANNER & GUIDE SHEET
	   ==================================================== */
	.pwa-install-banner-wrap {
		position: fixed;
		left: 0.85rem;
		right: 0.85rem;
		bottom: max(16px, env(safe-area-inset-bottom, 16px));
		z-index: 80;
		max-width: 440px;
		margin: 0 auto;
		animation: pwaBannerSlide 0.35s cubic-bezier(0.16, 1, 0.3, 1);
		pointer-events: auto;
	}
	.pwa-install-banner-wrap.has-bottom-nav {
		bottom: calc(66px + env(safe-area-inset-bottom, 8px));
	}
	@keyframes pwaBannerSlide {
		from {
			opacity: 0;
			transform: translateY(24px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	.pwa-install-card {
		background: #ffffff;
		border: 1.5px solid #ded5c8;
		border-radius: 18px;
		box-shadow: 0 12px 36px rgba(35, 31, 28, 0.16), 0 2px 8px rgba(35, 31, 28, 0.08);
		padding: 0.85rem 1rem;
		position: relative;
	}
	.pwa-banner-close {
		position: absolute;
		top: 10px;
		right: 10px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: #f4ede3;
		color: #787063;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s;
		padding: 0;
	}
	.pwa-banner-close:active {
		background: #e5ded2;
		transform: scale(0.9);
	}
	.pwa-card-top {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
		padding-right: 1.8rem;
	}
	.pwa-app-icon {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 3px 10px rgba(5, 150, 105, 0.35);
		flex-shrink: 0;
	}
	.pwa-card-info {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.pwa-title-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
	.pwa-card-title {
		font-size: 0.95rem;
		font-weight: 800;
		font-family: "Outfit", sans-serif;
		color: #231f1c;
		margin: 0;
		line-height: 1.2;
	}
	.pwa-native-pill {
		font-size: 0.62rem;
		font-weight: 800;
		background: #e6f4ea;
		color: #059669;
		padding: 1px 6px;
		border-radius: 9999px;
		letter-spacing: 0.02em;
	}
	.pwa-card-sub {
		font-size: 0.75rem;
		color: #787063;
		line-height: 1.35;
		margin: 0;
	}
	.pwa-card-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.btn-pwa-dismiss {
		flex: 1;
		padding: 0.55rem 0.8rem;
		background: #f5f0e8;
		color: #645c52;
		border-radius: 10px;
		font-weight: 700;
		font-size: 0.78rem;
		text-align: center;
		border: 1px solid #e7ded2;
		cursor: pointer;
		transition: background 0.15s;
	}
	.btn-pwa-dismiss:active {
		background: #e8ded0;
	}
	.btn-pwa-install {
		flex: 2;
		padding: 0.55rem 0.9rem;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		border-radius: 10px;
		font-weight: 800;
		font-size: 0.82rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		border: none;
		cursor: pointer;
		box-shadow: 0 3px 10px rgba(5, 150, 105, 0.35);
		transition: transform 0.15s, box-shadow 0.15s;
	}
	.btn-pwa-install:active {
		transform: scale(0.96);
	}

	/* PWA GUIDE SHEET */
	.pwa-guide-sheet {
		max-width: 520px;
	}
	.pwa-guide-header-title {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.pwa-guide-badge {
		font-size: 0.65rem;
		font-weight: 800;
		color: #059669;
		letter-spacing: 0.05em;
	}
	.pwa-guide-body {
		padding: 1rem 1.1rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.pwa-guide-hero {
		background: #fdfaf6;
		border: 1.5px solid #ded5c8;
		border-radius: 14px;
		padding: 0.85rem 1rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.pwa-hero-gem {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 3px 8px rgba(5, 150, 105, 0.3);
		flex-shrink: 0;
	}
	.pwa-hero-text h4 {
		font-size: 0.95rem;
		font-weight: 800;
		font-family: "Outfit", sans-serif;
		color: #231f1c;
		margin: 0;
	}
	.pwa-hero-text p {
		font-size: 0.76rem;
		color: #787063;
		margin: 0;
	}
	.pwa-guide-steps {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
	.pwa-step-card {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		background: #ffffff;
		border: 1px solid #ebd9c8;
		border-radius: 12px;
		padding: 0.75rem 0.85rem;
		box-shadow: 0 1px 3px rgba(35, 31, 28, 0.03);
	}
	.step-num-pill {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: #059669;
		color: #ffffff;
		font-weight: 800;
		font-size: 0.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.step-content {
		flex: 1;
	}
	.step-text {
		font-size: 0.84rem;
		color: #383129;
		line-height: 1.45;
		margin: 0;
	}
	.ios-share-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 2px 5px;
		background: #e0f2fe;
		color: #0284c7;
		border-radius: 6px;
		vertical-align: middle;
		margin: 0 2px;
	}
	.step-icon-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
		vertical-align: middle;
	}
	.pwa-guide-footer-box {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		background: #e6f4ea;
		border: 1px solid #a7f3d0;
		border-radius: 12px;
		padding: 0.75rem 0.85rem;
	}
	.pgf-icon {
		font-size: 1rem;
		flex-shrink: 0;
	}
	.pgf-text {
		font-size: 0.78rem;
		color: #065f46;
		line-height: 1.4;
	}
	.btn-pwa-guide-done {
		width: 100%;
		padding: 0.85rem 1rem;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		border-radius: 12px;
		font-weight: 800;
		font-size: 0.9rem;
		border: none;
		cursor: pointer;
		box-shadow: 0 4px 12px rgba(5, 150, 105, 0.35);
		transition: transform 0.15s;
		text-align: center;
	}
	.btn-pwa-guide-done:active {
		transform: scale(0.97);
	}

	.sheet-body-scroll {
		padding: 1.1rem;
		overflow-y: auto;
		flex: 1;
	}
	.sheet-form-grid {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
	.sheet-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.sheet-field label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #554d42;
	}
	.native-sheet-input {
		background: #faf7f2;
		border: 1px solid #ded5c8;
		color: #231f1c;
		padding: 0.55rem 0.75rem;
		border-radius: 8px;
		font-size: 0.85rem;
		outline: none;
	}
	.native-sheet-input:focus {
		border-color: #059669;
		background: #ffffff;
	}

	.sheet-divider {
		border-top: 1px solid #eee7db;
		padding-top: 0.75rem;
	}
	.sheet-divider-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}
	.sub-sheet-heading {
		font-size: 0.82rem;
		font-weight: 700;
		color: #3b352e;
	}
	.btn-sheet-mini {
		background: #faf7f2;
		border: 1px solid #ded5c8;
		font-size: 0.72rem;
		font-weight: 600;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		color: #3b352e;
	}

	.sheet-items-stack {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.sheet-item-row {
		display: flex;
		gap: 0.35rem;
		align-items: center;
	}
	.flex-2 {
		flex: 2;
	}
	.flex-1 {
		flex: 1;
	}
	.btn-sheet-del {
		background: transparent;
		color: #dc2626;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.35rem;
	}

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
	.calc-line-row {
		display: flex;
		justify-content: space-between;
		color: #7c746a;
	}
	.calc-inputs-row {
		display: flex;
		gap: 0.65rem;
	}
	.calc-col {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.calc-col label {
		font-size: 0.68rem;
		color: #7c746a;
	}
	.native-sheet-input-sm {
		background: #ffffff;
		border: 1px solid #ded5c8;
		padding: 0.3rem 0.5rem;
		border-radius: 6px;
		font-size: 0.8rem;
	}
	.calc-grand-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-top: 1px dashed #d5ccbe;
		padding-top: 0.5rem;
	}
	.tot-title {
		font-weight: 800;
		font-size: 0.95rem;
		color: #231f1c;
	}
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
	.btn-sheet-edit {
		flex: 1.5;
		background: #eff6ff;
		color: #1d4ed8;
		border: 1px solid #bfdbfe;
		font-weight: 700;
		padding: 0.65rem 0.85rem;
		border-radius: 8px;
		font-size: 0.82rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.btn-sheet-edit:hover {
		background: #dbeafe;
		border-color: #93c5fd;
	}
	.btn-sheet-edit:active {
		transform: scale(0.98);
	}

	/* DETAIL BOTTOM SHEET */
	.detail-photo-card {
		margin-bottom: 0.75rem;
	}
	.detail-img-full {
		width: 100%;
		max-height: 250px;
		object-fit: contain;
		border-radius: 8px;
		border: 1px solid #ded5c8;
		background: #000;
	}
	.detail-tags-cluster {
		display: flex;
		gap: 0.35rem;
		margin-bottom: 0.35rem;
		flex-wrap: wrap;
	}
	.detail-hero-store {
		font-size: 1.25rem;
		font-weight: 800;
		font-family: "Outfit", sans-serif;
		color: #231f1c;
	}
	.detail-hero-time {
		font-size: 0.75rem;
		color: #7c746a;
		margin-bottom: 0.65rem;
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.detail-callout-note {
		background: #faf7f2;
		border-left: 3px solid #059669;
		padding: 0.5rem 0.75rem;
		font-size: 0.78rem;
		font-style: italic;
		margin-bottom: 0.65rem;
		color: #433d34;
	}
	.detail-items-stack {
		background: #faf7f2;
		border: 1px solid #e8dfd3;
		border-radius: 8px;
		padding: 0.5rem 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.78rem;
	}
	.detail-item-line {
		display: flex;
		justify-content: space-between;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes slideUp {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}

	/* ====================================================
	   DESKTOP & RESPONSIVE ENHANCEMENTS
	   ==================================================== */

	/* Header inner shell base (mobile first - single clean row) */
	.header-inner-shell {
		max-width: 900px;
		margin: 0 auto;
		padding: 0.45rem 0.85rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.header-inner-shell .brand-unit {
		order: 1;
		flex: 1;
		min-width: 0;
	}
	.header-inner-shell .header-actions-cluster {
		order: 2;
		flex-shrink: 0;
	}
	.header-inner-shell .header-tier-tabs {
		display: none;
	}
	.desktop-user-name {
		display: none;
	}

	/* MOBILE BOTTOM NAVIGATION BAR (NATIVE APP EXPERIENCE) */
	.mobile-bottom-nav {
		flex: 0 0 auto;
		width: 100%;
		min-height: 58px;
		height: auto;
		background: rgba(250, 246, 240, 0.96);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-top: 1px solid #ded5c8;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		align-items: center;
		justify-items: center;
		padding: 5px 0.5rem max(8px, env(safe-area-inset-bottom, 8px));
		z-index: 60;
		box-shadow: 0 -4px 18px rgba(35, 31, 28, 0.05);
	}
	.mob-nav-btn {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		background: transparent;
		border: none;
		color: #787063;
		padding: 4px 1px;
		cursor: pointer;
		transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
		position: relative;
		font-family: inherit;
		border-radius: 10px;
		-webkit-tap-highlight-color: transparent;
	}
	.mob-nav-btn:active {
		transform: scale(0.92);
	}
	.mob-nav-icon-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 26px;
		border-radius: 12px;
		transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.mob-nav-label {
		font-size: 0.67rem;
		font-weight: 600;
		line-height: 1.1;
		transition: color 0.15s ease, font-weight 0.15s ease;
		letter-spacing: -0.01em;
		white-space: nowrap;
	}
	.mob-nav-btn.active {
		color: #059669;
	}
	.mob-nav-btn.active .mob-nav-icon-wrap {
		background: rgba(5, 150, 105, 0.12);
		color: #059669;
	}
	.mob-nav-btn.active .mob-nav-label {
		font-weight: 800;
		color: #059669;
	}
	.mob-nav-btn.active svg {
		stroke-width: 2.3;
	}

	/* CENTER QUICK ADD FAB BUTTON */
	.mob-nav-btn-center {
		position: relative;
		top: -6px;
	}
	.mob-fab-pill {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 14px rgba(5, 150, 105, 0.38), 0 1px 3px rgba(35, 31, 28, 0.1);
		transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s ease;
		border: 2.5px solid #faf6f0;
	}
	.mob-nav-btn-center:active .mob-fab-pill {
		transform: scale(0.9) translateY(2px);
		box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);
	}
	.mob-nav-btn-center .mob-nav-label {
		font-weight: 800;
		color: #059669;
		margin-top: -2px;
	}

	/* NOTIFICATION BADGE */
	.mob-nav-badge {
		position: absolute;
		top: -3px;
		right: -4px;
		background: #059669;
		color: #ffffff;
		font-size: 0.58rem;
		font-weight: 800;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: 9999px;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		box-shadow: 0 1px 3px rgba(5, 150, 105, 0.4);
		border: 1.5px solid #faf6f0;
	}

	/* MINI AVATAR IN AKUN TAB */
	.mob-nav-avatar {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: linear-gradient(135deg, #059669 0%, #047857 100%);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.72rem;
		font-weight: 800;
		position: relative;
		border: 1.5px solid #ffffff;
		box-shadow: 0 1px 3px rgba(5, 150, 105, 0.25);
	}
	.mob-nav-pro-dot {
		position: absolute;
		bottom: -4px;
		right: -5px;
		font-size: 8px;
		line-height: 1;
	}

	/* Chat Layout wrapper base */
	.chat-layout-wrapper {
		display: flex;
		flex-direction: column;
		flex: 1 1 0%;
		min-height: 0;
		height: 100%;
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
		from {
			opacity: 0;
			transform: scale(0.96);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* FULL DESKTOP (>= 920px) */
	@media (min-width: 920px) {
		.app-mobile-root {
			align-items: stretch;
			width: 100%;
		}
		.app-mobile-root.app-logged-in {
			height: auto;
			max-height: none;
			overflow: visible;
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
			display: block;
			order: 2;
			flex: 0 1 auto;
			width: auto;
			padding: 0;
		}
		.mobile-bottom-nav {
			display: none !important;
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
		.desktop-pro-pill {
			display: inline-flex;
		}

		/* Main container expansive desktop width */
		.app-main {
			max-width: 1320px;
			width: 100%;
			margin: 0 auto;
			padding: 1.25rem 2rem 2.5rem;
			overflow: visible;
			height: auto;
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
			font-family: "Outfit", sans-serif;
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
			font-family: "Outfit", sans-serif;
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
			transition:
				transform 0.15s,
				box-shadow 0.15s;
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
			transition:
				transform 0.15s,
				box-shadow 0.15s,
				border-color 0.15s;
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

	/* ====================================================
	   MULTI-DOMPET (WALLET & ACCOUNTS) STYLES
	   ==================================================== */

	/* SLIM CHAT ACTIVE FILTER STRIP */
	.chat-active-filter-strip {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #f0fdf4;
		border-bottom: 1px solid #bbf7d0;
		padding: 0.35rem 0.85rem;
		font-size: 0.75rem;
		color: #166534;
		flex-shrink: 0;
		gap: 0.5rem;
	}
	.caf-info {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.caf-icon {
		font-size: 0.85rem;
	}
	.caf-bal {
		font-size: 0.72rem;
		color: #15803d;
		font-family: "Outfit", sans-serif;
		font-weight: 700;
	}
	.btn-caf-clear {
		background: #ffffff;
		border: 1px solid #86efac;
		color: #166534;
		font-size: 0.68rem;
		font-weight: 700;
		padding: 0.15rem 0.5rem;
		border-radius: 9999px;
		cursor: pointer;
		flex-shrink: 0;
	}
	.btn-caf-clear:active {
		background: #dcfce7;
	}

	/* REPORT DOMPET HUB CARD */
	.report-dompet-hub-card {
		background: #ffffff;
		border: 1px solid #e7dfd4;
		border-radius: 14px;
		padding: 0.85rem;
		margin-bottom: 0.75rem;
		box-shadow: 0 1px 4px rgba(35, 31, 28, 0.04);
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
	.rdh-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.rdh-title-group {
		display: flex;
		flex-direction: column;
		line-height: 1.1;
	}
	.rdh-badge {
		font-size: 0.6rem;
		font-weight: 800;
		color: #2563eb;
		letter-spacing: 0.05em;
	}
	.rdh-title {
		font-size: 0.95rem;
		font-weight: 800;
		font-family: "Outfit", sans-serif;
		color: #231f1c;
		margin: 0;
	}
	.rdh-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.btn-rdh-act {
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.25rem 0.55rem;
		border-radius: 8px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		transition: all 0.15s;
	}
	.btn-rdh-trf {
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		color: #1d4ed8;
	}
	.btn-rdh-trf:hover {
		background: #dbeafe;
	}
	.btn-rdh-add {
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		color: #15803d;
	}
	.btn-rdh-add:hover {
		background: #dcfce7;
	}

	.rdh-cards-scroll {
		display: flex;
		align-items: stretch;
		gap: 0.5rem;
		overflow-x: auto;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		padding-bottom: 2px;
	}
	.rdh-cards-scroll::-webkit-scrollbar {
		display: none;
	}

	.rdh-card {
		flex-shrink: 0;
		min-width: 135px;
		max-width: 165px;
		background: #faf7f2;
		border: 1.5px solid #e8dfd3;
		border-radius: 12px;
		padding: 0.55rem 0.7rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s;
	}
	.rdh-card:hover {
		border-color: #d4c8b8;
		transform: translateY(-1px);
	}
	.rdh-card.active-filter {
		background: #ffffff;
		border-color: var(--card-color, #2563eb);
		box-shadow: 0 3px 10px rgba(37, 99, 235, 0.15);
		border-width: 2px;
	}
	.rdh-card.card-all.active-filter {
		border-color: #059669;
		box-shadow: 0 3px 10px rgba(5, 150, 105, 0.15);
	}
	.rdhc-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.rdhc-badge {
		font-size: 0.58rem;
		font-weight: 800;
		color: #059669;
		background: #ecfdf5;
		padding: 0.08rem 0.3rem;
		border-radius: 4px;
	}
	.rdhc-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #d4c8b8;
	}
	.rdhc-dot.dot-active {
		background: #059669;
	}
	.rdhc-icon {
		font-size: 1rem;
	}
	.rdhc-top-right {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.rdhc-tipe {
		font-size: 0.58rem;
		color: #787063;
		background: #f5efe6;
		padding: 0.06rem 0.25rem;
		border-radius: 3px;
		text-transform: uppercase;
		font-weight: 700;
	}
	.rdhc-edit-btn {
		background: none;
		border: none;
		font-size: 0.65rem;
		opacity: 0.45;
		cursor: pointer;
		padding: 0;
	}
	.rdhc-edit-btn:hover {
		opacity: 1;
	}
	.rdhc-name {
		font-size: 0.78rem;
		font-weight: 700;
		color: #231f1c;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.rdhc-val {
		font-size: 0.9rem;
		font-weight: 800;
		font-family: "Outfit", sans-serif;
		color: #166534;
		white-space: nowrap;
	}

	.rdh-filter-status-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		padding: 0.35rem 0.65rem;
		border-radius: 8px;
		font-size: 0.72rem;
		color: #1e40af;
	}
	.btn-rdh-reset {
		background: #ffffff;
		border: 1px solid #93c5fd;
		color: #1d4ed8;
		font-size: 0.68rem;
		font-weight: 700;
		padding: 0.15rem 0.45rem;
		border-radius: 9999px;
		cursor: pointer;
	}

	/* COMPANION SIDEBAR DOMPET CARD */
	.companion-dompet-card {
		border-left: 3px solid #2563eb;
	}
	.companion-dompet-hdr-acts {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}
	.c-mini-act {
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		color: #1d4ed8;
		font-size: 0.68rem;
		font-weight: 700;
		padding: 0.2rem 0.45rem;
		border-radius: 6px;
		cursor: pointer;
		transition: background 0.15s;
	}
	.c-mini-act:hover {
		background: #dbeafe;
	}

	.companion-total-balance-box {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		padding: 0.5rem 0.65rem;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.ctb-lbl {
		font-size: 0.72rem;
		color: #64748b;
		font-weight: 600;
	}
	.ctb-val {
		font-size: 0.95rem;
		font-weight: 800;
		font-family: "Outfit", sans-serif;
		color: #0f172a;
	}

	.companion-dompet-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		max-height: 190px;
		overflow-y: auto;
	}
	.companion-dompet-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.4rem 0.55rem;
		background: #ffffff;
		border: 1px solid #ede8e1;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s;
	}
	.companion-dompet-item:hover {
		border-color: #cbd5e1;
		background: #f8fafc;
	}
	.companion-dompet-item.active-filter {
		border-color: #2563eb;
		background: #eff6ff;
	}
	.cdi-left {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
	.cdi-icon {
		font-size: 0.9rem;
	}
	.cdi-meta {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}
	.cdi-name {
		font-size: 0.76rem;
		font-weight: 700;
		color: #231f1c;
	}
	.cdi-tipe {
		font-size: 0.62rem;
		color: #8c8479;
		text-transform: uppercase;
	}
	.cdi-right {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.cdi-bal {
		font-size: 0.8rem;
		font-weight: 800;
		font-family: "Outfit", sans-serif;
		color: #166534;
	}
	.cdi-edit {
		background: none;
		border: none;
		font-size: 0.65rem;
		opacity: 0.4;
		cursor: pointer;
		padding: 0;
	}
	.cdi-edit:hover {
		opacity: 1;
	}

	/* DOMPET MODAL PREVIEW CARD & FORM */
	.dompet-modal-sheet,
	.transfer-modal-sheet {
		max-width: 520px;
	}
	.dompet-sheet-title-group {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.dompet-card-preview {
		border-radius: 14px;
		padding: 1rem 1.1rem;
		color: #ffffff;
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		position: relative;
		overflow: hidden;
	}
	.dcp-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.dcp-icon {
		font-size: 1.4rem;
	}
	.dcp-type-badge {
		font-size: 0.65rem;
		font-weight: 800;
		background: rgba(255, 255, 255, 0.2);
		padding: 0.15rem 0.45rem;
		border-radius: 9999px;
		letter-spacing: 0.05em;
	}
	.dcp-name {
		font-size: 1.15rem;
		font-weight: 800;
		font-family: "Outfit", sans-serif;
	}
	.dcp-balance {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
		margin-top: 0.2rem;
	}
	.dcp-bal-lbl {
		font-size: 0.65rem;
		opacity: 0.8;
	}
	.dcp-bal-val {
		font-size: 1.25rem;
		font-weight: 800;
		font-family: "Outfit", sans-serif;
	}
	.dcp-acc {
		font-size: 0.72rem;
		opacity: 0.85;
		letter-spacing: 0.06em;
		font-family: monospace;
	}

	/* COLOR PRESET PICKER */
	.color-preset-picker {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
		padding: 0.35rem 0;
	}
	.color-dot {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 2px solid #ffffff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.1s;
		padding: 0;
	}
	.color-dot:active {
		transform: scale(0.9);
	}
	.color-dot.selected-color {
		outline: 2.5px solid #231f1c;
		transform: scale(1.08);
	}
	.color-native-input {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		padding: 0;
		background: none;
	}

	/* TRANSFER VISUAL FLOW */
	.transfer-visual-flow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #fdfaf6;
		border: 1.5px solid #e7ded2;
		padding: 0.75rem 1rem;
		border-radius: 12px;
		gap: 0.75rem;
	}
	.tv-box {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.tv-lbl {
		font-size: 0.68rem;
		color: #8c8479;
		text-transform: uppercase;
		font-weight: 700;
	}
	.tv-val {
		font-size: 0.9rem;
		color: #231f1c;
		font-weight: 800;
		font-family: "Outfit", sans-serif;
	}
	.tv-arrow {
		color: #2563eb;
		background: #eff6ff;
		padding: 0.4rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.nominal-preview-tag {
		font-size: 0.8rem;
		color: #059669;
		font-weight: 800;
		font-family: "Outfit", sans-serif;
		margin-top: 0.25rem;
	}
</style>
