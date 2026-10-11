import { json } from '@sveltejs/kit';
import { getAuthUser } from '#lib/server/auth.js';
import { getDb } from '#lib/server/db.js';

function isAdmin(user) {
	if (!user) return false;
	return user.role === 'admin' || user.email === 'miftahdev7@gmail.com';
}

export async function GET({ cookies }) {
	try {
		const currentUser = await getAuthUser(cookies);
		if (!currentUser || !isAdmin(currentUser)) {
			return json({ error: 'Akses ditolak. Halaman ini khusus Admin.' }, { status: 403 });
		}

		const sql = await getDb();
		const users = await sql`
			SELECT id, nama, email, 
			       COALESCE(role, 'user') as role, 
			       COALESCE(tier, 'free') as tier,
			       COALESCE(chat_count_today, 0)::int as chat_count_today,
			       COALESCE(chat_date_today::text, CURRENT_DATE::text) as chat_date_today,
			       dibuat
			FROM users
			ORDER BY id ASC
		`;

		const totalUsers = users.length;
		const proUsers = users.filter((u) => u.tier === 'pro').length;
		const freeUsers = totalUsers - proUsers;

		return json({
			success: true,
			users,
			stats: {
				total_users: totalUsers,
				pro_users: proUsers,
				free_users: freeUsers
			}
		});
	} catch (err) {
		console.error('Error GET /api/admin/users:', err);
		return json({ error: 'Gagal memuat data pengguna: ' + err.message }, { status: 500 });
	}
}

export async function POST({ request, cookies }) {
	try {
		const currentUser = await getAuthUser(cookies);
		if (!currentUser || !isAdmin(currentUser)) {
			return json({ error: 'Akses ditolak. Tindakan ini hanya boleh dilakukan oleh Admin.' }, { status: 403 });
		}

		const body = await request.json();
		const { userId, action, tier } = body;

		if (!userId) {
			return json({ error: 'userId wajib diisi' }, { status: 400 });
		}

		const sql = await getDb();

		if (action === 'set_tier') {
			const targetTier = tier === 'pro' ? 'pro' : 'free';
			const [updated] = await sql`
				UPDATE users
				SET tier = ${targetTier}
				WHERE id = ${userId}
				RETURNING id, nama, email, role, tier, chat_count_today, chat_date_today
			`;

			if (!updated) {
				return json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
			}

			const label = targetTier === 'pro' ? 'PRO (Unlimited) ⭐' : 'Gratis (Limit 5 pesan/hari)';
			return json({
				success: true,
				message: `Status paket pengguna ${updated.nama} (${updated.email}) berhasil diubah menjadi ${label}!`,
				user: updated
			});
		}

		if (action === 'reset_quota') {
			const [updated] = await sql`
				UPDATE users
				SET chat_count_today = 0, chat_date_today = CURRENT_DATE
				WHERE id = ${userId}
				RETURNING id, nama, email, role, tier, chat_count_today, chat_date_today
			`;

			if (!updated) {
				return json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
			}

			return json({
				success: true,
				message: `Kuota pesan harian untuk ${updated.nama} berhasil direset ke 0!`,
				user: updated
			});
		}

		return json({ error: 'Aksi tidak dikenali' }, { status: 400 });
	} catch (err) {
		console.error('Error POST /api/admin/users:', err);
		return json({ error: 'Gagal memperbarui status pengguna: ' + err.message }, { status: 500 });
	}
}
