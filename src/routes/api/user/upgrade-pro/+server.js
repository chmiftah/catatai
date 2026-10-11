import { json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db.js';
import { getAuthUser } from '#lib/server/auth.js';

export async function POST({ request, cookies }) {
	try {
		const user = await getAuthUser(cookies);
		if (!user) {
			return json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
		}

		let body = {};
		try {
			body = await request.json();
		} catch (e) {
			body = {};
		}

		// Jika body.tier ditentukan ('pro' atau 'free'), gunakan itu.
		// Jika tidak, toggle: jika sekarang free -> pro, jika pro -> free.
		const currentTier = user.tier || 'free';
		const targetTier = body.tier ? body.tier : (currentTier === 'pro' ? 'free' : 'pro');

		const sql = await getDb();
		await sql`
			UPDATE users
			SET tier = ${targetTier}
			WHERE id = ${user.id}
		`;

		return json({
			success: true,
			tier: targetTier,
			is_pro: targetTier === 'pro',
			message: targetTier === 'pro'
				? 'Selamat! Akun Anda kini aktif sebagai CatatAi PRO dengan akses Chat & Analisis Tanpa Batas! ⭐'
				: 'Akun Anda telah dialihkan ke Versi Gratis (kuota 5 pesan per hari).'
		});
	} catch (err) {
		console.error('Error upgrade-pro:', err);
		return json({ error: err.message || 'Gagal mengubah status tier' }, { status: 500 });
	}
}
