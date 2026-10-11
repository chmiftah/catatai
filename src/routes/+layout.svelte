<script>
	let { children } = $props();
</script>

<svelte:head>
	<title>CatatAi — Pencatatan Transaksi & Nota</title>
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
	<meta name="theme-color" content="#faf6f0" />
	<meta name="description" content="Pencatatan keuangan cerdas, scan nota AI, dan rekap transaksi otomatis" />
	
	<!-- PWA Settings -->
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="apple-mobile-web-app-title" content="CatatAi" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
	<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />

	<!-- Fonts -->
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet">
</svelte:head>

{@render children()}

<style>
	:global(:root) {
		/* WARM COZY LINEN & PAPER PALETTE */
		--bg-primary: #f5f0e8;
		--bg-surface: #ffffff;
		--bg-subtle: #eae4d8;
		--bg-card: #ffffff;
		--bg-card-hover: #faf7f2;
		--border-subtle: #e5ded4;
		--border-strong: #d5cbbe;
		--border-focus: #059669;
		
		--text-primary: #231f1c;
		--text-secondary: #4a443d;
		--text-muted: #7c746b;

		--brand-primary: #059669;
		--brand-primary-hover: #047857;
		--brand-emerald: #10b981;
		--brand-emerald-hover: #059669;
		
		--accent-emerald: #059669;
		--accent-emerald-bg: #e6f4ea;
		--accent-rose: #e11d48;
		--accent-rose-bg: #ffe4e6;
		--accent-amber: #d97706;
		--accent-amber-bg: #fef3c7;
		--accent-indigo: #4f46e5;
		--accent-indigo-bg: #eef2ff;

		--chat-bg: #efeae2;
		--bubble-user-bg: #dcf8c6;
		--bubble-user-border: #c8e6b3;
		--bubble-user-text: #13381e;
		--bubble-bot-bg: #ffffff;
		--bubble-bot-border: #e6dfd5;
		--bubble-bot-text: #231f1c;

		--radius-sm: 8px;
		--radius-md: 12px;
		--radius-lg: 16px;
		--radius-xl: 22px;
		--radius-full: 9999px;

		--shadow-subtle: 0 1px 3px rgba(35, 31, 28, 0.05);
		--shadow-card: 0 2px 6px -1px rgba(35, 31, 28, 0.06), 0 1px 4px -1px rgba(35, 31, 28, 0.04);
		--shadow-float: 0 12px 28px -6px rgba(35, 31, 28, 0.12), 0 8px 12px -6px rgba(35, 31, 28, 0.06);
	}

	:global(*) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		background-color: var(--bg-primary);
		color: var(--text-primary);
		font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
		min-height: 100vh;
		line-height: 1.5;
		-webkit-font-smoothing: antialiased;
		overscroll-behavior-y: none;
	}

	:global(button) {
		font-family: inherit;
		cursor: pointer;
		border: none;
		outline: none;
	}

	:global(input), :global(select), :global(textarea) {
		font-family: inherit;
	}

	:global(::-webkit-scrollbar) {
		width: 6px;
		height: 6px;
	}
	:global(::-webkit-scrollbar-track) {
		background: #eae4d8;
	}
	:global(::-webkit-scrollbar-thumb) {
		background: #d4cbbe;
		border-radius: 4px;
	}
	:global(::-webkit-scrollbar-thumb:hover) {
		background: #b8ac9c;
	}
</style>
