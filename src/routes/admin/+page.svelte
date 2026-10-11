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

		<main class="admin-main-container">
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
		</main>
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
