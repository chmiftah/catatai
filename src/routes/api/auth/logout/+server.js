import { json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db.js';
import { clearSessionCookie } from '#lib/server/auth.js';

export async function POST({ cookies }) {
	try {
		const token = cookies.get('catatai_session');
		if (token) {
			const sql = await getDb();
			await sql`
				UPDATE users
				SET session_token = null
				WHERE session_token = ${token}
			`;
		}

		clearSessionCookie(cookies);
		return json({ success: true });
	} catch (err) {
		console.error('Error logout:', err);
		clearSessionCookie(cookies);
		return json({ success: true });
	}
}
