import { json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db.js';
import { verifyPassword, generateToken, setSessionCookie } from '#lib/server/auth.js';

export async function POST({ request, cookies }) {
	try {
		const { email = '', password = '' } = await request.json();

		const cleanEmail = email.trim().toLowerCase();
		const cleanPassword = password.trim();

		if (!cleanEmail || !cleanPassword) {
			return json({ error: 'Mohon isi email dan password' }, { status: 400 });
		}

		const sql = await getDb();

		const [user] = await sql`
			SELECT id, email, nama, password_hash,
			       COALESCE(role, 'user') as role,
			       COALESCE(tier, 'free') as tier,
			       COALESCE(chat_count_today, 0)::int as chat_count_today,
			       COALESCE(chat_date_today::text, CURRENT_DATE::text) as chat_date_today
			FROM users
			WHERE lower(email) = ${cleanEmail}
			LIMIT 1
		`;

		if (!user) {
			return json({ error: 'Email atau password salah' }, { status: 401 });
		}

		const isValid = verifyPassword(cleanPassword, user.password_hash);
		if (!isValid) {
			return json({ error: 'Email atau password salah' }, { status: 401 });
		}

		const sessionToken = generateToken();

		await sql`
			UPDATE users
			SET session_token = ${sessionToken}
			WHERE id = ${user.id}
		`;

		setSessionCookie(cookies, sessionToken);

		const d = new Date();
		const pad = (n) => String(n).padStart(2, '0');
		const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

		const isSameDay = String(user.chat_date_today).slice(0, 10) === todayStr;
		const chatCountToday = isSameDay ? (user.chat_count_today || 0) : 0;
		const isPro = user.tier === 'pro';
		const sisaKuota = isPro ? 999999 : Math.max(0, 5 - chatCountToday);

		return json({
			success: true,
			user: {
				id: user.id,
				email: user.email,
				nama: user.nama,
				role: user.role || 'user',
				is_admin: user.role === 'admin' || user.email === 'miftahdev7@gmail.com',
				tier: user.tier || 'free',
				is_pro: isPro,
				chat_count_today: chatCountToday,
				sisa_kuota: sisaKuota,
				max_kuota: isPro ? 'unlimited' : 5
			}
		});
	} catch (err) {
		console.error('Error login:', err);
		return json({ error: err.message || 'Gagal login' }, { status: 500 });
	}
}
