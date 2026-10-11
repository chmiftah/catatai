<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		// Arahkan ke root halaman utama yang berisi form login
		goto('/');
	});
</script>

<svelte:head>
	<title>Masuk ke CatatAi</title>
	<script src="https://chatbotai-five-phi.vercel.app/widget.js" data-bot-id="bot_hk7l2ol"></script>
</svelte:head>

<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#574e44;">
	<p>Mengalihkan ke halaman masuk CatatAi...</p>
</div>
