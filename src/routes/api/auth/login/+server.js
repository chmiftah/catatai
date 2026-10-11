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
			SELECT id, email, nama, password_hash
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

		return json({
			success: true,
			user: {
				id: user.id,
				email: user.email,
				nama: user.nama
			}
		});
	} catch (err) {
		console.error('Error login:', err);
		return json({ error: err.message || 'Gagal login' }, { status: 500 });
	}
}
