import { json } from '@sveltejs/kit';
import { getAuthUser } from '#lib/server/auth.js';

export async function GET({ cookies }) {
	try {
		const user = await getAuthUser(cookies);
		if (!user) {
			return json({ success: true, user: null });
		}

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
		return json({ success: true, user: null });
	}
}
