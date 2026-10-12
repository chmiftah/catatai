<script>
	import { onMount } from 'svelte';

	let loading = $state(true);
	let actionLoading = $state(null);
	let currentUser = $state(null);
	let usersList = $state([]);
	let stats = $state({ total_users: 0, pro_users: 0, free_users: 0 });
	let searchQuery = $state('');
	let filterTier = $state('all'); // 'all', 'pro', 'free'
	let toastMessage = $state('');
	let toastType = $state('success');

	function showToast(msg, type = 'success') {
		toastMessage = msg;
		toastType = type;
		setTimeout(() => {
			toastMessage = '';
		}, 4000);
	}

	async function checkAuthAndLoadUsers() {
		loading = true;
		try {
			// 1. Cek currentUser
			const meRes = await fetch('/api/auth/me');
			const meData = await meRes.json();
			currentUser = meData.user;

			if (!currentUser || (!currentUser.is_admin && currentUser.role !== 'admin' && currentUser.email !== 'miftahdev7@gmail.com')) {
				loading = false;
				return;
			}

			// 2. Muat data pengguna
			const usersRes = await fetch('/api/admin/users');
			const usersData = await usersRes.json();
			if (!usersRes.ok) throw new Error(usersData.error || 'Gagal memuat pengguna');

			usersList = usersData.users || [];
			stats = usersData.stats || { total_users: 0, pro_users: 0, free_users: 0 };
		} catch (err) {
			showToast(err.message, 'error');
		} finally {
			loading = false;
		}
	}

	async function handleUpdateTier(user, targetTier) {
		const actionConfirmText = targetTier === 'pro' 
			? `Aktifkan paket PRO (Unlimited) untuk ${user.nama} (${user.email})?` 
			: `Kembalikan ${user.nama} (${user.email}) ke paket Free (5 pesan/hari)?`;

		if (!confirm(actionConfirmText)) return;

		actionLoading = user.id;
		try {
			const res = await fetch('/api/admin/users', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					userId: user.id,
					action: 'set_tier',
					tier: targetTier
				})
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal memperbarui paket');

			// Perbarui local state
			const idx = usersList.findIndex((u) => u.id === user.id);
			if (idx !== -1) {
				usersList[idx].tier = targetTier;
			}

			// Update stats
			stats.pro_users = usersList.filter((u) => u.tier === 'pro').length;
			stats.free_users = usersList.length - stats.pro_users;

			showToast(data.message, 'success');
		} catch (err) {
			showToast(err.message, 'error');
		} finally {
			actionLoading = null;
		}
	}

	async function handleResetQuota(user) {
		if (!confirm(`Reset kuota chat hari ini untuk ${user.nama} (${user.email}) ke 0?`)) return;

		actionLoading = user.id;
		try {
			const res = await fetch('/api/admin/users', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					userId: user.id,
					action: 'reset_quota'
				})
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal mereset kuota');

			const idx = usersList.findIndex((u) => u.id === user.id);
			if (idx !== -1) {
				usersList[idx].chat_count_today = 0;
			}

			showToast(data.message, 'success');
		} catch (err) {
			showToast(err.message, 'error');
		} finally {
			actionLoading = null;
		}
	}

	function formatDate(dt) {
		if (!dt) return '-';
		try {
			const d = new Date(dt);
			return d.toLocaleDateString('id-ID', {
				day: 'numeric',
				month: 'short',
				year: 'numeric'
			});
		} catch {
			return String(dt).slice(0, 10);
		}
	}

	// TAB SWITCH: 'users' (Manajemen Pengguna) | 'transaksi' (Semua Transaksi Pengguna)
	let activeTab = $state('users');

	// TRANSAKSI STATE
	let txList = $state([]);
	let txStats = $state({ total_transaksi: 0, total_pengeluaran: 0, total_pemasukan: 0, saldo_bersih: 0 });
	let txLoading = $state(false);
	let selectedUserFilter = $state(''); // user id or ''
	let selectedTipeFilter = $state('semua'); // 'semua' | 'pengeluaran' | 'pemasukan'
	let txSearchQuery = $state('');
	let selectedBulanFilter = $state(''); // 'YYYY-MM'

	// MODAL: RIWAYAT TRANSAKSI USER TERTENTU
	let showUserTxModal = $state(false);
	let inspectingUser = $state(null);
	let userSpecificTxList = $state([]);
	let userSpecificStats = $state({ total_transaksi: 0, total_pengeluaran: 0, total_pemasukan: 0, saldo_bersih: 0 });
	let loadingUserSpecificTx = $state(false);

	// MODAL: DETAIL 1 TRANSAKSI + RINCIAN STRUK
	let showTxDetailModal = $state(false);
	let selectedTxDetail = $state(null);
	let loadingTxDetail = $state(false);

	function formatRupiah(num) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0
		}).format(num || 0);
	}

	function formatTime(tm) {
		if (!tm) return '';
		return String(tm).slice(0, 5);
	}

	async function loadTransactions() {
		txLoading = true;
		try {
			const params = new URLSearchParams();
			if (selectedUserFilter) params.append('userId', selectedUserFilter);
			if (selectedTipeFilter && selectedTipeFilter !== 'semua') params.append('tipe', selectedTipeFilter);
			if (txSearchQuery) params.append('q', txSearchQuery);
			if (selectedBulanFilter) params.append('bulan', selectedBulanFilter);

			const res = await fetch(`/api/admin/transaksi?${params.toString()}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal memuat transaksi');

			txList = data.transaksi || [];
			txStats = data.stats || { total_transaksi: 0, total_pengeluaran: 0, total_pemasukan: 0, saldo_bersih: 0 };
		} catch (err) {
			showToast(err.message, 'error');
		} finally {
			txLoading = false;
		}
	}

	async function openUserTransactions(u) {
		inspectingUser = u;
		showUserTxModal = true;
		loadingUserSpecificTx = true;
		try {
			const res = await fetch(`/api/admin/transaksi?userId=${u.id}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Gagal memuat transaksi pengguna');
			userSpecificTxList = data.transaksi || [];
			userSpecificStats = data.stats || { total_transaksi: 0, total_pengeluaran: 0, total_pemasukan: 0, saldo_bersih: 0 };
		} catch (err) {
			showToast(err.message, 'error');
		} finally {
			loadingUserSpecificTx = false;
		}
	}

	async function openTransactionDetail(tx) {
		selectedTxDetail = tx;
		showTxDetailModal = true;
		loadingTxDetail = true;
		try {
			const res = await fetch(`/api/admin/transaksi?transaksiId=${tx.id}`);
			const data = await res.json();
			if (res.ok && data.transaksi) {
				selectedTxDetail = data.transaksi;
			}
		} catch (err) {
			console.error('Error load detail:', err);
		} finally {
			loadingTxDetail = false;
		}
	}

	function handleTabChange(tab) {
		activeTab = tab;
		if (tab === 'transaksi' && txList.length === 0) {
			loadTransactions();
		}
	}

	let totalPlatformTransactions = $derived(
		usersList.reduce((acc, u) => acc + (u.total_transaksi || 0), 0)
	);
	let totalPlatformExpense = $derived(
		usersList.reduce((acc, u) => acc + (u.total_pengeluaran || 0), 0)
	);
	let totalPlatformIncome = $derived(
		usersList.reduce((acc, u) => acc + (u.total_pemasukan || 0), 0)
	);

	let filteredUsers = $derived(
		usersList.filter((u) => {
			const matchSearch = 
				u.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
				u.email.toLowerCase().includes(searchQuery.toLowerCase());
			
			if (!matchSearch) return false;
			if (filterTier === 'pro') return u.tier === 'pro';
			if (filterTier === 'free') return u.tier !== 'pro';
			return true;
		})
	);

	onMount(() => {
		checkAuthAndLoadUsers();
	});
</script>

<svelte:head>
	<title>Panel Admin - Manajemen Pengguna CatatAi</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet">
</svelte:head>

<div class="admin-page-root">
	<!-- TOAST NOTIFICATION -->
	{#if toastMessage}
		<div class="admin-toast {toastType === 'success' ? 'toast-success' : 'toast-error'}">
			<span>{toastType === 'success' ? '✓' : '⚠️'}</span>
			<p>{toastMessage}</p>
		</div>
	{/if}

	{#if loading}
		<div class="admin-loading-screen">
			<div class="spinner"></div>
			<p>Memuat Panel Admin CatatAi...</p>
		</div>
	{:else if !currentUser || (!currentUser.is_admin && currentUser.role !== 'admin' && currentUser.email !== 'miftahdev7@gmail.com')}
		<div class="admin-denied-box">
			<div class="denied-icon">🔒</div>
			<h2>Akses Terbatas Khusus Admin</h2>
			<p>Halaman manajemen pengguna ini khusus untuk akun Administrator (Miftah).</p>
			<div class="denied-actions">
				<a href="/" class="btn-primary-back">← Kembali ke Halaman Utama</a>
				<a href="/login" class="btn-secondary-link">Login sebagai Admin</a>
			</div>
		</div>
	{:else}
		<!-- TOP HEADER -->
		<header class="admin-header">
			<div class="header-inner">
				<div class="brand-left">
					<a href="/" class="back-link" title="Kembali ke Dashboard">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
					</a>
					<div class="title-meta">
						<div class="badge-admin-tag">PANEL ADMINISTRATOR</div>
						<h1 class="header-title">Manajemen Pengguna CatatAi</h1>
					</div>
				</div>

				<div class="admin-user-pill">
					<div class="admin-avatar">
						{currentUser.nama.charAt(0).toUpperCase()}
					</div>
					<div class="admin-info-text">
						<span class="admin-name">{currentUser.nama} (Admin)</span>
						<span class="admin-email">{currentUser.email}</span>
					</div>
					<a href="/" class="btn-to-app">Buka Chat App ⚡</a>
				</div>
			</div>
		</header>

		<!-- SUB NAVIGATION TABS: USERS vs TRANSACTIONS -->
		<nav class="admin-tab-nav-bar">
			<div class="tab-nav-inner">
				<button 
					type="button" 
					class="admin-nav-tab {activeTab === 'users' ? 'active' : ''}" 
					onclick={() => handleTabChange('users')}
				>
					<span class="tab-icon">👥</span>
					<span>Manajemen Pengguna</span>
					<span class="tab-counter-badge">{usersList.length}</span>
				</button>
				<button 
					type="button" 
					class="admin-nav-tab {activeTab === 'transaksi' ? 'active' : ''}" 
					onclick={() => handleTabChange('transaksi')}
				>
					<span class="tab-icon">💳</span>
					<span>Seluruh Transaksi Pengguna</span>
					<span class="tab-counter-badge counter-green">{totalPlatformTransactions}</span>
				</button>
			</div>
		</nav>

		<main class="admin-main-container">
			{#if activeTab === 'users'}
				<!-- ==============================================
				     TAB 1: MANAJEMEN PENGGUNA
				     ============================================== -->
				<!-- STATS CARDS -->
				<section class="stats-overview-grid">
					<div class="stat-card">
						<div class="stat-card-icon bg-amber">👥</div>
						<div class="stat-meta">
							<span class="stat-label">Total Pengguna Terdaftar</span>
							<h3 class="stat-value">{stats.total_users} <span class="unit">Akun</span></h3>
						</div>
					</div>

					<div class="stat-card">
						<div class="stat-card-icon bg-gold">⭐</div>
						<div class="stat-meta">
							<span class="stat-label">Pengguna PRO (Unlimited)</span>
							<h3 class="stat-value text-gold">{stats.pro_users} <span class="unit">Pengguna</span></h3>
						</div>
					</div>

					<div class="stat-card">
						<div class="stat-card-icon bg-green">🌱</div>
						<div class="stat-meta">
							<span class="stat-label">Pengguna Free (5 Pesan/Hari)</span>
							<h3 class="stat-value text-green">{stats.free_users} <span class="unit">Pengguna</span></h3>
						</div>
					</div>

					<div class="stat-card">
						<div class="stat-card-icon bg-indigo">📊</div>
						<div class="stat-meta">
							<span class="stat-label">Total Transaksi Pengguna</span>
							<h3 class="stat-value text-indigo">{totalPlatformTransactions} <span class="unit">Transaksi</span></h3>
						</div>
					</div>
				</section>

				<!-- WA ADMIN INFO NOTICE -->
				<div class="admin-wa-guide-banner">
					<div class="wa-icon-bubble">💬</div>
					<div class="wa-guide-text">
						<strong>Alur Upgrade Manual WhatsApp:</strong>
						<p>Pengguna yang ingin PRO diarahkan menghubungi WhatsApp <code>081225020952</code>. Setelah pembayaran/konfirmasi diterima, klik tombol <strong>"Jadikan PRO ⭐"</strong> di bawah untuk mengaktifkan akun mereka seketika tanpa perlu kartu kredit.</p>
					</div>
				</div>

				<!-- CONTROLS & FILTER -->
				<section class="table-controls-bar">
					<div class="search-input-wrapper">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
						<input 
							type="text" 
							placeholder="Cari berdasarkan nama atau email pengguna..." 
							bind:value={searchQuery}
							class="search-input"
						/>
						{#if searchQuery}
							<button class="clear-search-btn" onclick={() => searchQuery = ''}>✕</button>
						{/if}
					</div>

					<div class="filter-tabs-wrapper">
						<button 
							class="tab-btn {filterTier === 'all' ? 'active' : ''}" 
							onclick={() => filterTier = 'all'}
						>
							Semua ({usersList.length})
						</button>
						<button 
							class="tab-btn {filterTier === 'pro' ? 'active' : ''}" 
							onclick={() => filterTier = 'pro'}
						>
							⭐ PRO ({stats.pro_users})
						</button>
						<button 
							class="tab-btn {filterTier === 'free' ? 'active' : ''}" 
							onclick={() => filterTier = 'free'}
						>
							🌱 Free ({stats.free_users})
						</button>
					</div>
				</section>

				<!-- USERS TABLE CONTAINER -->
				<div class="users-table-card">
					<div class="table-card-header">
						<h3>Daftar Pengguna ({filteredUsers.length} ditemukan)</h3>
						<button class="btn-refresh-data" onclick={checkAuthAndLoadUsers} title="Segarkan Data">
							<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
							<span>Refresh</span>
						</button>
					</div>

					{#if filteredUsers.length === 0}
						<div class="empty-users-state">
							<div class="empty-icon">🔍</div>
							<h4>Tidak ada pengguna yang cocok</h4>
							<p>Coba gunakan kata kunci pencarian yang lain.</p>
						</div>
					{:else}
						<div class="table-scroll-wrapper">
							<table class="users-data-table">
								<thead>
									<tr>
										<th>ID</th>
										<th>Nama & Email</th>
										<th>Status Paket</th>
										<th>Role</th>
										<th>Transaksi Pengguna</th>
										<th>Chat Hari Ini</th>
										<th>Terdaftar</th>
										<th class="text-right">Aksi Manajemen</th>
									</tr>
								</thead>
								<tbody>
									{#each filteredUsers as u (u.id)}
										<tr class="user-row {u.tier === 'pro' ? 'row-pro' : ''}">
											<td class="col-id">#{u.id}</td>
											<td class="col-user">
												<div class="user-item-flex">
													<div class="user-avatar-circle {u.tier === 'pro' ? 'avatar-pro' : ''}">
														{u.nama.charAt(0).toUpperCase()}
													</div>
													<div class="user-names">
														<div class="u-name-line">
															<span class="user-full-name">{u.nama}</span>
															{#if u.id === currentUser.id}
																<span class="badge-you">(Anda)</span>
															{/if}
														</div>
														<span class="user-email-addr">{u.email}</span>
													</div>
												</div>
											</td>
											<td class="col-tier">
												{#if u.tier === 'pro'}
													<span class="tier-pill tier-pill-pro">
														<span>⭐</span> PRO Unlimited
													</span>
												{:else}
													<span class="tier-pill tier-pill-free">
														<span>🌱</span> Free (5 / hari)
													</span>
												{/if}
											</td>
											<td class="col-role">
												<span class="role-pill {u.role === 'admin' ? 'role-admin' : 'role-user'}">
													{u.role === 'admin' ? '👑 Admin' : 'Pengguna'}
												</span>
											</td>
											<td class="col-tx">
												<div class="user-tx-meta-box">
													{#if (u.total_transaksi || 0) > 0}
														<button 
															type="button" 
															class="btn-view-user-tx" 
															onclick={() => openUserTransactions(u)}
															title="Klik untuk melihat seluruh transaksi pengguna ini"
														>
															<span class="tx-count-pill">{u.total_transaksi} Transaksi</span>
															<span class="tx-total-sub">{formatRupiah(u.total_pengeluaran)}</span>
														</button>
													{:else}
														<span class="no-tx-label">Belum ada transaksi</span>
													{/if}
												</div>
											</td>
											<td class="col-chat">
												<div class="chat-meter-box">
													{#if u.tier === 'pro'}
														<span class="text-unlimited">Tanpa Batas ⚡</span>
														<span class="sub-meter">({u.chat_count_today} dikirim hari ini)</span>
													{:else}
														<span class="chat-counter {u.chat_count_today >= 5 ? 'counter-exhausted' : ''}">
															{u.chat_count_today} / 5 pesan
														</span>
														{#if u.chat_count_today >= 5}
															<span class="badge-limit-full">Habis</span>
														{/if}
													{/if}
												</div>
											</td>
											<td class="col-date">
												<span class="date-text">{formatDate(u.dibuat)}</span>
											</td>
											<td class="col-actions text-right">
												<div class="actions-group-inline">
													{#if (u.total_transaksi || 0) > 0}
														<button 
															type="button" 
															class="btn-act-inspect-tx" 
															onclick={() => openUserTransactions(u)}
															title="Lihat riwayat transaksi pengguna"
														>
															📊 Transaksi
														</button>
													{/if}

													{#if u.tier !== 'pro'}
														<button 
															type="button" 
															class="btn-act-pro" 
															onclick={() => handleUpdateTier(u, 'pro')}
															disabled={actionLoading === u.id}
															title="Ubah paket pengguna ini ke PRO Unlimited"
														>
															{actionLoading === u.id ? 'Memproses...' : '⭐ Jadikan PRO'}
														</button>
													{:else}
														<button 
															type="button" 
															class="btn-act-free" 
															onclick={() => handleUpdateTier(u, 'free')}
															disabled={actionLoading === u.id}
															title="Turunkan pengguna ini ke paket Free"
														>
															{actionLoading === u.id ? 'Memproses...' : 'Beralih ke Free'}
														</button>
													{/if}

													{#if u.tier !== 'pro' && u.chat_count_today > 0}
														<button 
															type="button" 
															class="btn-act-reset" 
															onclick={() => handleResetQuota(u)}
															disabled={actionLoading === u.id}
															title="Reset kuota chat hari ini ke 0"
														>
															Reset Kuota
														</button>
													{/if}
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>

			{:else if activeTab === 'transaksi'}
				<!-- ==============================================
				     TAB 2: SELURUH TRANSAKSI PENGGUNA
				     ============================================== -->
				<!-- KPI CARDS FOR TRANSACTIONS -->
				<section class="stats-overview-grid">
					<div class="stat-card">
						<div class="stat-card-icon bg-indigo">📋</div>
						<div class="stat-meta">
							<span class="stat-label">Total Transaksi</span>
							<h3 class="stat-value text-indigo">{txStats.total_transaksi} <span class="unit">Entri</span></h3>
						</div>
					</div>

					<div class="stat-card">
						<div class="stat-card-icon bg-rose">💸</div>
						<div class="stat-meta">
							<span class="stat-label">Total Pengeluaran</span>
							<h3 class="stat-value text-expense">{formatRupiah(txStats.total_pengeluaran)}</h3>
						</div>
					</div>

					<div class="stat-card">
						<div class="stat-card-icon bg-green">💰</div>
						<div class="stat-meta">
							<span class="stat-label">Total Pemasukan</span>
							<h3 class="stat-value text-income">{formatRupiah(txStats.total_pemasukan)}</h3>
						</div>
					</div>

					<div class="stat-card">
						<div class="stat-card-icon bg-amber">📈</div>
						<div class="stat-meta">
							<span class="stat-label">Saldo Bersih Terpantau</span>
							<h3 class="stat-value {txStats.saldo_bersih >= 0 ? 'text-income' : 'text-expense'}">
								{formatRupiah(txStats.saldo_bersih)}
							</h3>
						</div>
					</div>
				</section>

				<!-- ADVANCED FILTERS BAR -->
				<section class="table-controls-bar tx-controls-bar">
					<div class="tx-filters-cluster">
						<!-- User Select Filter -->
						<div class="select-filter-wrap">
							<label for="admin-filter-user">Pengguna:</label>
							<select 
								id="admin-filter-user" 
								bind:value={selectedUserFilter} 
								onchange={loadTransactions}
								class="admin-filter-select"
							>
								<option value="">Semua Pengguna</option>
								{#each usersList as u}
									<option value={u.id}>{u.nama} ({u.email})</option>
								{/each}
							</select>
						</div>

						<!-- Type Filter -->
						<div class="select-filter-wrap">
							<label for="admin-filter-tipe">Tipe:</label>
							<select 
								id="admin-filter-tipe" 
								bind:value={selectedTipeFilter} 
								onchange={loadTransactions}
								class="admin-filter-select"
							>
								<option value="semua">Semua Tipe</option>
								<option value="pengeluaran">Pengeluaran 🔴</option>
								<option value="pemasukan">Pemasukan 🟢</option>
							</select>
						</div>

						<!-- Bulan Filter -->
						<div class="select-filter-wrap">
							<label for="admin-filter-bulan">Bulan:</label>
							<input 
								id="admin-filter-bulan" 
								type="month" 
								bind:value={selectedBulanFilter} 
								onchange={loadTransactions}
								class="admin-filter-month"
							/>
						</div>
					</div>

					<!-- Search input -->
					<div class="search-input-wrapper tx-search-box">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
						<input 
							type="text" 
							placeholder="Cari toko, catatan, nama, email..." 
							bind:value={txSearchQuery}
							onkeydown={(e) => { if (e.key === 'Enter') loadTransactions(); }}
							class="search-input"
						/>
						{#if txSearchQuery}
							<button class="clear-search-btn" onclick={() => { txSearchQuery = ''; loadTransactions(); }}>✕</button>
						{/if}
						<button type="button" class="btn-search-act" onclick={loadTransactions}>Cari</button>
					</div>

					<button class="btn-refresh-data" onclick={loadTransactions} title="Muat Ulang Transaksi">
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
						<span>Refresh</span>
					</button>
				</section>

				<!-- TRANSACTIONS TABLE -->
				<div class="users-table-card">
					<div class="table-card-header">
						<h3>Daftar Transaksi ({txList.length} transaksi dimuat)</h3>
						{#if selectedUserFilter}
							<button 
								class="btn-clear-user-filter" 
								onclick={() => { selectedUserFilter = ''; loadTransactions(); }}
							>
								✕ Hapus Filter User
							</button>
						{/if}
					</div>

					{#if txLoading}
						<div class="admin-loading-screen inner-loading">
							<div class="spinner"></div>
							<p>Memuat data transaksi pengguna...</p>
						</div>
					{:else if txList.length === 0}
						<div class="empty-users-state">
							<div class="empty-icon">📂</div>
							<h4>Belum ada transaksi ditemukan</h4>
							<p>Coba sesuaikan filter pengguna, tipe, atau kata kunci pencarian.</p>
						</div>
					{:else}
						<div class="table-scroll-wrapper">
							<table class="users-data-table tx-data-table">
								<thead>
									<tr>
										<th>ID & Waktu</th>
										<th>Pengguna</th>
										<th>Tipe</th>
										<th>Toko / Merchant</th>
										<th>Kategori</th>
										<th>Nominal</th>
										<th>Metode</th>
										<th>Struk</th>
										<th class="text-right">Aksi</th>
									</tr>
								</thead>
								<tbody>
									{#each txList as tx (tx.id)}
										<tr class="user-row">
											<td class="col-id">
												<div class="tx-id-time">
													<strong>#{tx.id}</strong>
													<span>{formatDate(tx.tanggal)}</span>
													<small>{formatTime(tx.waktu)}</small>
												</div>
											</td>
											<td class="col-user">
												<div class="user-item-flex">
													<div class="user-avatar-circle avatar-small">
														{(tx.user_nama || 'U').charAt(0).toUpperCase()}
													</div>
													<div class="user-names">
														<span class="user-full-name">{tx.user_nama || 'Tanpa Nama'}</span>
														<span class="user-email-addr">{tx.user_email}</span>
													</div>
												</div>
											</td>
											<td class="col-type">
												{#if tx.tipe === 'pemasukan'}
													<span class="type-pill pill-income">🟢 Masuk</span>
												{:else}
													<span class="type-pill pill-expense">🔴 Keluar</span>
												{/if}
											</td>
											<td class="col-store">
												<div class="store-info-cell">
													<strong>{tx.toko || '(Tanpa Toko)'}</strong>
													{#if tx.catatan}
														<span class="store-note-sub">{tx.catatan}</span>
													{/if}
												</div>
											</td>
											<td class="col-cat">
												<span class="category-chip-admin">{tx.kategori || 'Lainnya'}</span>
											</td>
											<td class="col-amount">
												<strong class="tx-nominal {tx.tipe === 'pemasukan' ? 'text-income' : 'text-expense'}">
													{tx.tipe === 'pemasukan' ? '+' : '-'} {formatRupiah(tx.total)}
												</strong>
											</td>
											<td class="col-method">
												<span class="method-text">{tx.metode_bayar || 'Tunai'}</span>
											</td>
											<td class="col-receipt">
												{#if tx.gambar_url}
													<button 
														type="button" 
														class="btn-receipt-thumb" 
														onclick={() => openTransactionDetail(tx)}
														title="Lihat foto nota struk belanja"
													>
														📸 Ada Struk
													</button>
												{:else}
													<span class="text-muted">-</span>
												{/if}
											</td>
											<td class="col-actions text-right">
												<button 
													type="button" 
													class="btn-act-detail" 
													onclick={() => openTransactionDetail(tx)}
													title="Lihat rincian lengkap transaksi"
												>
													🔍 Rincian
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/if}
		</main>

		<!-- ==============================================
		     MODAL 1: RIWAYAT TRANSAKSI PENGGUNA TERTENTU
		     ============================================== -->
		{#if showUserTxModal && inspectingUser}
			<div class="admin-modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) showUserTxModal = false; }} role="presentation">
				<div class="admin-modal-card" role="dialog" aria-modal="true" tabindex="-1">
					<div class="modal-card-header">
						<div class="modal-user-title">
							<div class="user-avatar-circle modal-avatar {inspectingUser.tier === 'pro' ? 'avatar-pro' : ''}">
								{inspectingUser.nama.charAt(0).toUpperCase()}
							</div>
							<div>
								<h3>Transaksi: {inspectingUser.nama}</h3>
								<p>{inspectingUser.email} • ID #{inspectingUser.id} • Paket: {inspectingUser.tier === 'pro' ? '⭐ PRO' : '🌱 Free'}</p>
							</div>
						</div>
						<button type="button" class="btn-close-modal" onclick={() => showUserTxModal = false}>✕</button>
					</div>

					<div class="modal-body-content">
						<!-- User KPI Summary -->
						<div class="modal-kpi-row">
							<div class="modal-kpi-item">
								<span>Total Transaksi</span>
								<strong>{userSpecificStats.total_transaksi} Entri</strong>
							</div>
							<div class="modal-kpi-item">
								<span>Total Pengeluaran</span>
								<strong class="text-expense">{formatRupiah(userSpecificStats.total_pengeluaran)}</strong>
							</div>
							<div class="modal-kpi-item">
								<span>Total Pemasukan</span>
								<strong class="text-income">{formatRupiah(userSpecificStats.total_pemasukan)}</strong>
							</div>
							<div class="modal-kpi-item">
								<span>Saldo Bersih</span>
								<strong class="{userSpecificStats.saldo_bersih >= 0 ? 'text-income' : 'text-expense'}">
									{formatRupiah(userSpecificStats.saldo_bersih)}
								</strong>
							</div>
						</div>

						{#if loadingUserSpecificTx}
							<div class="inner-loading-box">
								<div class="spinner"></div>
								<p>Memuat riwayat transaksi {inspectingUser.nama}...</p>
							</div>
						{:else if userSpecificTxList.length === 0}
							<div class="empty-modal-tx">
								<p>Pengguna ini belum memiliki transaksi yang tercatat.</p>
							</div>
						{:else}
							<div class="modal-table-scroll">
								<table class="users-data-table modal-tx-table">
									<thead>
										<tr>
											<th>Waktu</th>
											<th>Tipe</th>
											<th>Toko / Merchant</th>
											<th>Kategori</th>
											<th>Nominal</th>
											<th>Metode</th>
											<th class="text-right">Aksi</th>
										</tr>
									</thead>
									<tbody>
										{#each userSpecificTxList as tx (tx.id)}
											<tr>
												<td>
													<strong>{formatDate(tx.tanggal)}</strong>
													<small>{formatTime(tx.waktu)}</small>
												</td>
												<td>
													<span class="type-pill {tx.tipe === 'pemasukan' ? 'pill-income' : 'pill-expense'}">
														{tx.tipe === 'pemasukan' ? '🟢 Masuk' : '🔴 Keluar'}
													</span>
												</td>
												<td>
													<strong>{tx.toko || '-'}</strong>
													{#if tx.catatan}<br/><small>{tx.catatan}</small>{/if}
												</td>
												<td>
													<span class="category-chip-admin">{tx.kategori}</span>
												</td>
												<td>
													<strong class="{tx.tipe === 'pemasukan' ? 'text-income' : 'text-expense'}">
														{formatRupiah(tx.total)}
													</strong>
												</td>
												<td>{tx.metode_bayar || 'Tunai'}</td>
												<td class="text-right">
													<button 
														type="button" 
														class="btn-act-detail" 
														onclick={() => openTransactionDetail(tx)}
													>
														Detail
													</button>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</div>

					<div class="modal-card-footer">
						<button 
							type="button" 
							class="btn-modal-secondary" 
							onclick={() => {
								showUserTxModal = false;
								selectedUserFilter = String(inspectingUser.id);
								activeTab = 'transaksi';
								loadTransactions();
							}}
						>
							Buka di Tab Semua Transaksi ↗
						</button>
						<button type="button" class="btn-modal-primary" onclick={() => showUserTxModal = false}>
							Tutup
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- ==============================================
		     MODAL 2: RINCIAN TRANSAKSI & STRUK NOTA
		     ============================================== -->
		{#if showTxDetailModal && selectedTxDetail}
			<div class="admin-modal-backdrop" onclick={(e) => { if (e.target === e.currentTarget) showTxDetailModal = false; }} role="presentation">
				<div class="admin-modal-card modal-detail-card" role="dialog" aria-modal="true" tabindex="-1">
					<div class="modal-card-header">
						<div>
							<h3>Rincian Transaksi #{selectedTxDetail.id}</h3>
							<p>Dicatat oleh: <strong>{selectedTxDetail.user_nama}</strong> ({selectedTxDetail.user_email})</p>
						</div>
						<button type="button" class="btn-close-modal" onclick={() => showTxDetailModal = false}>✕</button>
					</div>

					<div class="modal-body-content detail-grid-body">
						<!-- META DATA ROW -->
						<div class="tx-meta-overview">
							<div class="overview-item">
								<span class="lbl">Toko / Merchant:</span>
								<strong class="val">{selectedTxDetail.toko || '-'}</strong>
							</div>
							<div class="overview-item">
								<span class="lbl">Tipe Transaksi:</span>
								<span class="type-pill {selectedTxDetail.tipe === 'pemasukan' ? 'pill-income' : 'pill-expense'}">
									{selectedTxDetail.tipe === 'pemasukan' ? '🟢 Pemasukan' : '🔴 Pengeluaran'}
								</span>
							</div>
							<div class="overview-item">
								<span class="lbl">Kategori:</span>
								<span class="category-chip-admin">{selectedTxDetail.kategori}</span>
							</div>
							<div class="overview-item">
								<span class="lbl">Tanggal & Waktu:</span>
								<span class="val">{formatDate(selectedTxDetail.tanggal)} • {formatTime(selectedTxDetail.waktu)}</span>
							</div>
							<div class="overview-item">
								<span class="lbl">Metode Bayar:</span>
								<span class="val">{selectedTxDetail.metode_bayar || 'Tunai'}</span>
							</div>
							<div class="overview-item">
								<span class="lbl">Total Nominal:</span>
								<strong class="val tx-big-nominal {selectedTxDetail.tipe === 'pemasukan' ? 'text-income' : 'text-expense'}">
									{formatRupiah(selectedTxDetail.total)}
								</strong>
							</div>
							{#if selectedTxDetail.catatan}
								<div class="overview-item full-width">
									<span class="lbl">Catatan Tambahan:</span>
									<p class="catatan-box">{selectedTxDetail.catatan}</p>
								</div>
							{/if}
						</div>

						<!-- RECEIPT IMAGE (IF ANY) -->
						{#if selectedTxDetail.gambar_url}
							<div class="receipt-preview-section">
								<h4>Foto Struk / Bukti Nota Belanja:</h4>
								<div class="receipt-img-frame">
									<img src={selectedTxDetail.gambar_url} alt="Struk {selectedTxDetail.toko}" />
								</div>
							</div>
						{/if}

						<!-- ITEMS BREAKDOWN TABLE (IF ANY) -->
						<div class="items-breakdown-section">
							<h4>Rincian Barang / Item Belanja:</h4>
							{#if loadingTxDetail}
								<p class="text-muted">Memuat daftar item...</p>
							{:else if selectedTxDetail.items && selectedTxDetail.items.length > 0}
								<table class="items-table">
									<thead>
										<tr>
											<th>Nama Barang</th>
											<th>Qty</th>
											<th>Harga Satuan</th>
											<th class="text-right">Subtotal</th>
										</tr>
									</thead>
									<tbody>
										{#each selectedTxDetail.items as it}
											<tr>
												<td>{it.nama_barang}</td>
												<td>{it.qty}</td>
												<td>{formatRupiah(it.harga_satuan)}</td>
												<td class="text-right">{formatRupiah(it.subtotal)}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							{:else}
								<p class="text-muted">Tidak ada rincian item per produk untuk transaksi ini.</p>
							{/if}
						</div>
					</div>

					<div class="modal-card-footer">
						<button type="button" class="btn-modal-primary" onclick={() => showTxDetailModal = false}>
							Tutup Rincian
						</button>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
		background-color: #f7f4ee;
		color: #231f1c;
	}

	.admin-page-root {
		min-height: 100vh;
		background: #f7f4ee;
		padding-bottom: 4rem;
	}

	/* Toast Notification */
	.admin-toast {
		position: fixed;
		top: 1.5rem;
		right: 1.5rem;
		z-index: 9999;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.85rem 1.25rem;
		border-radius: 12px;
		box-shadow: 0 8px 24px rgba(35, 31, 28, 0.15);
		font-size: 0.88rem;
		font-weight: 600;
		animation: slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1);
	}
	.toast-success {
		background: #047857;
		color: #ffffff;
	}
	.toast-error {
		background: #dc2626;
		color: #ffffff;
	}
	.admin-toast p {
		margin: 0;
	}

	@keyframes slideDown {
		from { opacity: 0; transform: translateY(-12px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* Loading & Denied Screen */
	.admin-loading-screen, .admin-denied-box {
		min-height: 80vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 2rem;
	}
	.spinner {
		width: 36px;
		height: 36px;
		border: 3.5px solid #e0d7c7;
		border-top-color: #d97706;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin-bottom: 1rem;
	}
	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.admin-denied-box {
		background: #ffffff;
		max-width: 460px;
		margin: 4rem auto;
		border-radius: 20px;
		border: 1px solid #e4dacb;
		box-shadow: 0 10px 30px rgba(35, 31, 28, 0.05);
	}
	.denied-icon {
		font-size: 3rem;
		margin-bottom: 0.5rem;
	}
	.admin-denied-box h2 {
		font-family: 'Outfit', sans-serif;
		font-size: 1.4rem;
		margin: 0.25rem 0 0.5rem;
	}
	.admin-denied-box p {
		color: #736b61;
		font-size: 0.9rem;
		margin-bottom: 1.5rem;
	}
	.denied-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
	}
	.btn-primary-back {
		background: #231f1c;
		color: #ffffff;
		padding: 0.75rem 1.25rem;
		border-radius: 10px;
		text-decoration: none;
		font-weight: 600;
		font-size: 0.88rem;
	}
	.btn-secondary-link {
		color: #736b61;
		text-decoration: none;
		font-size: 0.85rem;
		font-weight: 500;
	}

	/* Admin Header */
	.admin-header {
		background: #ffffff;
		border-bottom: 1.5px solid #e8dfd3;
		position: sticky;
		top: 0;
		z-index: 50;
		box-shadow: 0 2px 8px rgba(35, 31, 28, 0.03);
	}
	.header-inner {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem 1.5rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.brand-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.back-link {
		width: 38px;
		height: 38px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 10px;
		border: 1.5px solid #ded5c8;
		color: #574e44;
		text-decoration: none;
		transition: all 0.15s;
		background: #faf7f2;
	}
	.back-link:hover {
		background: #ede5d7;
		color: #231f1c;
	}
	.badge-admin-tag {
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #d97706;
		margin-bottom: 2px;
	}
	.header-title {
		font-family: 'Outfit', sans-serif;
		font-size: 1.35rem;
		font-weight: 800;
		margin: 0;
		color: #231f1c;
		letter-spacing: -0.02em;
	}

	.admin-user-pill {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: #faf7f2;
		padding: 0.45rem 0.85rem;
		border-radius: 14px;
		border: 1px solid #e6ded3;
	}
	.admin-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		font-size: 0.85rem;
	}
	.admin-info-text {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}
	.admin-name {
		font-size: 0.82rem;
		font-weight: 700;
		color: #231f1c;
	}
	.admin-email {
		font-size: 0.72rem;
		color: #8c8275;
	}
	.btn-to-app {
		background: #231f1c;
		color: #ffffff;
		padding: 0.4rem 0.75rem;
		border-radius: 8px;
		text-decoration: none;
		font-size: 0.75rem;
		font-weight: 700;
		margin-left: 0.25rem;
		transition: opacity 0.15s;
	}
	.btn-to-app:hover {
		opacity: 0.9;
	}

	/* Main Container */
	.admin-main-container {
		max-width: 1200px;
		margin: 1.75rem auto 0;
		padding: 0 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.35rem;
	}

	/* Stats Grid */
	.stats-overview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1rem;
	}
	.stat-card {
		background: #ffffff;
		border: 1.5px solid #e8dfd3;
		border-radius: 16px;
		padding: 1.15rem 1.25rem;
		display: flex;
		align-items: center;
		gap: 1rem;
		box-shadow: 0 2px 8px rgba(35, 31, 28, 0.03);
	}
	.stat-card-icon {
		width: 46px;
		height: 46px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.35rem;
		flex-shrink: 0;
	}
	.bg-amber { background: #fef3c7; color: #b45309; }
	.bg-gold { background: #fffbeb; color: #d97706; }
	.bg-green { background: #ecfdf5; color: #047857; }

	.stat-meta {
		display: flex;
		flex-direction: column;
	}
	.stat-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #736b61;
		margin-bottom: 2px;
	}
	.stat-value {
		margin: 0;
		font-family: 'Outfit', sans-serif;
		font-size: 1.55rem;
		font-weight: 800;
		color: #231f1c;
		letter-spacing: -0.02em;
	}
	.stat-value .unit {
		font-size: 0.8rem;
		font-weight: 600;
		color: #8c8275;
		font-family: 'Plus Jakarta Sans', sans-serif;
	}
	.text-gold { color: #d97706; }
	.text-green { color: #047857; }

	/* WA Guide Banner */
	.admin-wa-guide-banner {
		background: #f0fdf4;
		border: 1.5px solid #bbf7d0;
		border-radius: 14px;
		padding: 0.95rem 1.25rem;
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
	}
	.wa-icon-bubble {
		font-size: 1.5rem;
		line-height: 1;
	}
	.wa-guide-text {
		font-size: 0.84rem;
		color: #14532d;
		line-height: 1.45;
	}
	.wa-guide-text strong {
		font-weight: 700;
		color: #166534;
	}
	.wa-guide-text p {
		margin: 0.2rem 0 0;
	}
	.wa-guide-text code {
		background: #dcfce7;
		padding: 0.15rem 0.4rem;
		border-radius: 6px;
		font-weight: 700;
		font-family: monospace;
	}

	/* Controls Bar */
	.table-controls-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.85rem;
	}
	.search-input-wrapper {
		position: relative;
		flex: 1;
		min-width: 260px;
		display: flex;
		align-items: center;
	}
	.search-input-wrapper svg {
		position: absolute;
		left: 0.95rem;
		color: #8c8275;
		pointer-events: none;
	}
	.search-input {
		width: 100%;
		padding: 0.65rem 2.2rem 0.65rem 2.6rem;
		background: #ffffff;
		border: 1.5px solid #ded5c8;
		border-radius: 12px;
		font-size: 0.85rem;
		color: #231f1c;
		font-family: inherit;
		outline: none;
		transition: border-color 0.15s;
	}
	.search-input:focus {
		border-color: #d97706;
	}
	.clear-search-btn {
		position: absolute;
		right: 0.75rem;
		background: none;
		border: none;
		color: #8c8275;
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0.2rem;
	}

	.filter-tabs-wrapper {
		display: flex;
		background: #ede6d8;
		padding: 3px;
		border-radius: 10px;
		gap: 2px;
	}
	.tab-btn {
		background: transparent;
		border: none;
		padding: 0.45rem 0.85rem;
		font-size: 0.78rem;
		font-weight: 700;
		color: #5c5449;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}
	.tab-btn.active {
		background: #ffffff;
		color: #231f1c;
		box-shadow: 0 1px 4px rgba(35, 31, 28, 0.08);
	}

	/* Users Table Card */
	.users-table-card {
		background: #ffffff;
		border: 1.5px solid #e8dfd3;
		border-radius: 18px;
		overflow: hidden;
		box-shadow: 0 4px 14px rgba(35, 31, 28, 0.03);
	}
	.table-card-header {
		padding: 1rem 1.35rem;
		border-bottom: 1px solid #f0e9df;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.table-card-header h3 {
		margin: 0;
		font-family: 'Outfit', sans-serif;
		font-size: 1.05rem;
		font-weight: 700;
		color: #231f1c;
	}
	.btn-refresh-data {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		background: #faf7f2;
		border: 1px solid #ded5c8;
		padding: 0.35rem 0.65rem;
		border-radius: 8px;
		font-size: 0.75rem;
		font-weight: 600;
		color: #574e44;
		cursor: pointer;
		transition: background 0.15s;
	}
	.btn-refresh-data:hover {
		background: #eee5d7;
	}

	.empty-users-state {
		padding: 3.5rem 1.5rem;
		text-align: center;
		color: #736b61;
	}
	.empty-icon {
		font-size: 2.2rem;
		margin-bottom: 0.5rem;
	}
	.empty-users-state h4 {
		margin: 0 0 0.25rem;
		font-size: 1rem;
		color: #231f1c;
	}
	.empty-users-state p {
		margin: 0;
		font-size: 0.82rem;
	}

	.table-scroll-wrapper {
		overflow-x: auto;
	}
	.users-data-table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
		font-size: 0.85rem;
	}
	.users-data-table thead th {
		background: #faf7f2;
		padding: 0.85rem 1.25rem;
		font-weight: 700;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #736b61;
		border-bottom: 1.5px solid #ede5d7;
	}
	.users-data-table tbody td {
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #f5efe6;
		vertical-align: middle;
	}
	.user-row:hover {
		background: #fdfcf9;
	}
	.row-pro {
		background: #fffdf7;
	}

	.col-id {
		font-family: monospace;
		font-weight: 700;
		color: #8c8275;
		font-size: 0.8rem;
		width: 50px;
	}

	.user-item-flex {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.user-avatar-circle {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: #ede6d8;
		color: #4a4237;
		font-weight: 800;
		font-size: 0.85rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.avatar-pro {
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
		color: #ffffff;
		box-shadow: 0 2px 6px rgba(217, 119, 6, 0.25);
	}
	.user-names {
		display: flex;
		flex-direction: column;
		line-height: 1.25;
	}
	.u-name-line {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.user-full-name {
		font-weight: 700;
		color: #231f1c;
		font-size: 0.88rem;
	}
	.badge-you {
		font-size: 0.65rem;
		background: #e0d7c7;
		padding: 1px 5px;
		border-radius: 4px;
		font-weight: 700;
		color: #4a4237;
	}
	.user-email-addr {
		font-size: 0.76rem;
		color: #8c8275;
	}

	.tier-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.65rem;
		border-radius: 20px;
		font-size: 0.75rem;
		font-weight: 700;
	}
	.tier-pill-pro {
		background: #fef3c7;
		color: #b45309;
		border: 1px solid #fde68a;
	}
	.tier-pill-free {
		background: #f3f4f6;
		color: #4b5563;
		border: 1px solid #e5e7eb;
	}

	.role-pill {
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.25rem 0.5rem;
		border-radius: 6px;
	}
	.role-admin {
		background: #fae8ff;
		color: #86198f;
	}
	.role-user {
		background: #f1f5f9;
		color: #475569;
	}

	.chat-meter-box {
		display: flex;
		flex-direction: column;
		line-height: 1.25;
	}
	.text-unlimited {
		font-size: 0.8rem;
		font-weight: 700;
		color: #d97706;
	}
	.sub-meter {
		font-size: 0.7rem;
		color: #8c8275;
	}
	.chat-counter {
		font-weight: 600;
		font-size: 0.82rem;
		color: #231f1c;
	}
	.counter-exhausted {
		color: #dc2626;
		font-weight: 800;
	}
	.badge-limit-full {
		display: inline-block;
		font-size: 0.65rem;
		background: #fee2e2;
		color: #b91c1c;
		padding: 1px 4px;
		border-radius: 4px;
		font-weight: 800;
		width: fit-content;
		margin-top: 2px;
	}

	.date-text {
		color: #736b61;
		font-size: 0.78rem;
	}

	.text-right {
		text-align: right;
	}
	.actions-group-inline {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.4rem;
	}
	.btn-act-pro {
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
		color: #ffffff;
		border: none;
		padding: 0.45rem 0.85rem;
		border-radius: 8px;
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(217, 119, 6, 0.25);
		transition: all 0.15s;
		font-family: inherit;
	}
	.btn-act-pro:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 4px 10px rgba(217, 119, 6, 0.35);
	}
	.btn-act-free {
		background: #ffffff;
		border: 1.5px solid #ded5c8;
		color: #574e44;
		padding: 0.4rem 0.75rem;
		border-radius: 8px;
		font-size: 0.74rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}
	.btn-act-free:hover:not(:disabled) {
		background: #faf7f2;
		border-color: #c4b8a5;
	}
	.btn-act-reset {
		background: #f1f5f9;
		border: 1px solid #cbd5e1;
		color: #475569;
		padding: 0.4rem 0.65rem;
		border-radius: 8px;
		font-size: 0.72rem;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
	}
	.btn-act-reset:hover:not(:disabled) {
		background: #e2e8f0;
	}

	.bg-indigo { background: #e0e7ff; color: #4338ca; }
	.bg-rose { background: #ffe4e6; color: #e11d48; }
	.text-indigo { color: #4f46e5; }
	.text-expense { color: #dc2626; }
	.text-income { color: #16a34a; }

	/* Sub Navigation Tabs */
	.admin-tab-nav-bar {
		background: #ffffff;
		border-bottom: 1.5px solid #ede4d8;
		padding: 0 1.5rem;
	}
	.tab-nav-inner {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		gap: 0.5rem;
	}
	.admin-nav-tab {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: none;
		border-bottom: 3px solid transparent;
		padding: 0.85rem 1.1rem;
		font-family: inherit;
		font-size: 0.88rem;
		font-weight: 700;
		color: #736b61;
		cursor: pointer;
		transition: all 0.15s;
	}
	.admin-nav-tab:hover {
		color: #231f1c;
		background: #faf7f2;
	}
	.admin-nav-tab.active {
		color: #231f1c;
		border-bottom-color: #d97706;
	}
	.tab-icon {
		font-size: 1.1rem;
	}
	.tab-counter-badge {
		background: #f1ebd9;
		color: #736b61;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.15rem 0.45rem;
		border-radius: 20px;
	}
	.tab-counter-badge.counter-green {
		background: #dcfce7;
		color: #15803d;
	}

	/* User Transactions column */
	.col-tx {
		min-width: 130px;
	}
	.user-tx-meta-box {
		display: flex;
		align-items: center;
	}
	.btn-view-user-tx {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		background: #f8fafc;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		padding: 0.35rem 0.6rem;
		cursor: pointer;
		transition: all 0.15s;
		text-align: left;
	}
	.btn-view-user-tx:hover {
		background: #f1f5f9;
		border-color: #94a3b8;
		transform: translateY(-1px);
	}
	.tx-count-pill {
		font-size: 0.73rem;
		font-weight: 700;
		color: #0f172a;
	}
	.tx-total-sub {
		font-size: 0.68rem;
		color: #64748b;
		font-weight: 600;
	}
	.no-tx-label {
		font-size: 0.75rem;
		color: #94a3b8;
		font-style: italic;
	}

	.btn-act-inspect-tx {
		background: #f0fdf4;
		border: 1px solid #86efac;
		color: #166534;
		padding: 0.4rem 0.65rem;
		border-radius: 8px;
		font-size: 0.72rem;
		font-weight: 700;
		cursor: pointer;
		font-family: inherit;
		transition: all 0.15s;
	}
	.btn-act-inspect-tx:hover {
		background: #dcfce7;
	}

	/* Transactions Tab & Filters */
	.tx-controls-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.tx-filters-cluster {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.65rem;
	}
	.select-filter-wrap {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: #574e44;
	}
	.admin-filter-select,
	.admin-filter-month {
		background: #ffffff;
		border: 1.5px solid #ded5c8;
		border-radius: 10px;
		padding: 0.45rem 0.65rem;
		font-size: 0.8rem;
		font-family: inherit;
		color: #231f1c;
		outline: none;
	}
	.admin-filter-select:focus,
	.admin-filter-month:focus {
		border-color: #d97706;
	}
	.tx-search-box {
		min-width: 280px;
		flex: 1;
	}
	.btn-search-act {
		position: absolute;
		right: 0.35rem;
		background: #231f1c;
		color: #ffffff;
		border: none;
		border-radius: 8px;
		padding: 0.35rem 0.65rem;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
	}
	.btn-clear-user-filter {
		background: #fee2e2;
		color: #991b1b;
		border: 1px solid #fca5a5;
		padding: 0.3rem 0.6rem;
		border-radius: 8px;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
	}

	/* Transactions Table Specifics */
	.tx-data-table {
		min-width: 900px;
	}
	.tx-id-time {
		display: flex;
		flex-direction: column;
		line-height: 1.25;
	}
	.tx-id-time strong {
		font-size: 0.78rem;
		color: #475569;
	}
	.tx-id-time span {
		font-size: 0.75rem;
		color: #1e293b;
		font-weight: 600;
	}
	.tx-id-time small {
		font-size: 0.7rem;
		color: #94a3b8;
	}
	.avatar-small {
		width: 28px;
		height: 28px;
		font-size: 0.75rem;
	}
	.type-pill {
		display: inline-block;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.2rem 0.5rem;
		border-radius: 20px;
		white-space: nowrap;
	}
	.pill-income {
		background: #dcfce7;
		color: #15803d;
	}
	.pill-expense {
		background: #fee2e2;
		color: #b91c1c;
	}
	.store-info-cell {
		display: flex;
		flex-direction: column;
	}
	.store-info-cell strong {
		color: #1e293b;
		font-size: 0.85rem;
	}
	.store-note-sub {
		font-size: 0.72rem;
		color: #64748b;
	}
	.category-chip-admin {
		background: #f1f5f9;
		color: #334155;
		font-size: 0.72rem;
		font-weight: 600;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
		border: 1px solid #e2e8f0;
	}
	.tx-nominal {
		font-size: 0.88rem;
		font-family: 'Outfit', sans-serif;
		font-weight: 700;
	}
	.method-text {
		font-size: 0.75rem;
		color: #64748b;
		text-transform: capitalize;
	}
	.btn-receipt-thumb {
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		color: #1d4ed8;
		padding: 0.25rem 0.5rem;
		border-radius: 6px;
		font-size: 0.72rem;
		font-weight: 600;
		cursor: pointer;
	}
	.btn-act-detail {
		background: #f8fafc;
		border: 1px solid #cbd5e1;
		color: #1e293b;
		padding: 0.35rem 0.65rem;
		border-radius: 8px;
		font-size: 0.74rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
	}
	.btn-act-detail:hover {
		background: #e2e8f0;
	}

	/* Modal Dialogs */
	.admin-modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.6);
		backdrop-filter: blur(4px);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}
	.admin-modal-card {
		background: #ffffff;
		border-radius: 20px;
		width: 100%;
		max-width: 900px;
		max-height: 88vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
		border: 1px solid #e2e8f0;
		overflow: hidden;
		animation: modalFadeIn 0.2s ease-out;
	}
	.modal-detail-card {
		max-width: 720px;
	}
	@keyframes modalFadeIn {
		from { opacity: 0; transform: translateY(12px) scale(0.98); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}
	.modal-card-header {
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid #e2e8f0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #f8fafc;
	}
	.modal-user-title {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}
	.modal-user-title h3,
	.modal-card-header h3 {
		margin: 0;
		font-size: 1.1rem;
		color: #0f172a;
		font-family: 'Outfit', sans-serif;
	}
	.modal-user-title p,
	.modal-card-header p {
		margin: 0.2rem 0 0;
		font-size: 0.78rem;
		color: #64748b;
	}
	.modal-avatar {
		width: 44px;
		height: 44px;
		font-size: 1.1rem;
	}
	.btn-close-modal {
		background: none;
		border: none;
		font-size: 1.2rem;
		color: #94a3b8;
		cursor: pointer;
		padding: 0.3rem 0.5rem;
		border-radius: 6px;
	}
	.btn-close-modal:hover {
		color: #0f172a;
		background: #e2e8f0;
	}
	.modal-body-content {
		padding: 1.5rem;
		overflow-y: auto;
		flex: 1;
	}
	.modal-kpi-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}
	.modal-kpi-item {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 0.75rem 0.9rem;
		display: flex;
		flex-direction: column;
	}
	.modal-kpi-item span {
		font-size: 0.7rem;
		font-weight: 600;
		color: #64748b;
		margin-bottom: 0.2rem;
	}
	.modal-kpi-item strong {
		font-size: 0.95rem;
		font-family: 'Outfit', sans-serif;
		color: #0f172a;
	}
	.modal-table-scroll {
		max-height: 400px;
		overflow-y: auto;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
	}
	.modal-tx-table {
		margin: 0;
	}
	.inner-loading-box,
	.empty-modal-tx {
		padding: 2.5rem 1rem;
		text-align: center;
		color: #64748b;
		font-size: 0.85rem;
	}
	.modal-card-footer {
		padding: 1rem 1.5rem;
		border-top: 1px solid #e2e8f0;
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		background: #f8fafc;
	}
	.btn-modal-primary {
		background: #231f1c;
		color: #ffffff;
		border: none;
		border-radius: 10px;
		padding: 0.55rem 1.25rem;
		font-size: 0.82rem;
		font-weight: 700;
		cursor: pointer;
		font-family: inherit;
	}
	.btn-modal-secondary {
		background: #ffffff;
		border: 1.5px solid #cbd5e1;
		color: #334155;
		border-radius: 10px;
		padding: 0.55rem 1.1rem;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
	}

	/* Transaction Detail Meta Overview */
	.tx-meta-overview {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.85rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 14px;
		padding: 1.15rem;
		margin-bottom: 1.25rem;
	}
	.overview-item {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.overview-item.full-width {
		grid-column: 1 / -1;
	}
	.overview-item .lbl {
		font-size: 0.72rem;
		font-weight: 600;
		color: #64748b;
	}
	.overview-item .val {
		font-size: 0.88rem;
		font-weight: 700;
		color: #0f172a;
	}
	.tx-big-nominal {
		font-size: 1.15rem !important;
	}
	.catatan-box {
		margin: 0;
		background: #ffffff;
		padding: 0.65rem 0.85rem;
		border-radius: 8px;
		border: 1px solid #e2e8f0;
		font-size: 0.82rem;
		color: #334155;
	}
	.receipt-preview-section {
		margin-bottom: 1.25rem;
	}
	.receipt-preview-section h4,
	.items-breakdown-section h4 {
		margin: 0 0 0.65rem;
		font-size: 0.88rem;
		color: #0f172a;
		font-weight: 700;
	}
	.receipt-img-frame {
		max-height: 340px;
		overflow: hidden;
		border-radius: 12px;
		border: 1.5px solid #e2e8f0;
		background: #0f172a;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.receipt-img-frame img {
		max-width: 100%;
		max-height: 340px;
		object-fit: contain;
	}
	.items-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.82rem;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		overflow: hidden;
	}
	.items-table th {
		background: #f1f5f9;
		padding: 0.6rem 0.85rem;
		font-weight: 700;
		color: #475569;
		text-align: left;
		font-size: 0.75rem;
	}
	.items-table td {
		padding: 0.6rem 0.85rem;
		border-top: 1px solid #e2e8f0;
		color: #1e293b;
	}
	.items-table .text-right {
		text-align: right;
	}

	@media (max-width: 768px) {
		.header-inner {
			flex-direction: column;
			align-items: flex-start;
		}
		.admin-user-pill {
			width: 100%;
			box-sizing: border-box;
			justify-content: space-between;
		}
		.table-controls-bar {
			flex-direction: column;
			align-items: stretch;
		}
		.filter-tabs-wrapper {
			overflow-x: auto;
		}
	}
</style>
