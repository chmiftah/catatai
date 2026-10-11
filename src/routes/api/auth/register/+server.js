import { json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db.js';
import { hashPassword, generateToken, setSessionCookie } from '#lib/server/auth.js';

export async function POST({ request, cookies }) {
	try {
		const { email = '', nama = '', password = '' } = await request.json();

		const cleanEmail = email.trim().toLowerCase();
		const cleanNama = nama.trim();
		const cleanPassword = password.trim();

		if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
			return json({ error: 'Format email tidak valid' }, { status: 400 });
		}
		if (cleanNama.length < 2) {
			return json({ error: 'Nama minimal 2 karakter' }, { status: 400 });
		}
		if (cleanPassword.length < 6) {
			return json({ error: 'Password minimal 6 karakter' }, { status: 400 });
		}

		const sql = await getDb();

		// Cek apakah email sudah terdaftar
		const [existing] = await sql`
			SELECT id FROM users WHERE lower(email) = ${cleanEmail} LIMIT 1
		`;
		if (existing) {
			return json({ error: 'Email sudah terdaftar. Silakan login atau gunakan email lain.' }, { status: 400 });
		}

		const passwordHash = hashPassword(cleanPassword);
		const sessionToken = generateToken();

		const [newUser] = await sql`
			INSERT INTO users (email, nama, password_hash, session_token)
			VALUES (${cleanEmail}, ${cleanNama}, ${passwordHash}, ${sessionToken})
			RETURNING id, email, nama, dibuat
		`;

		setSessionCookie(cookies, sessionToken);

		return json({
			success: true,
			user: {
				id: newUser.id,
				email: newUser.email,
				nama: newUser.nama
			}
		});
	} catch (err) {
		console.error('Error register:', err);
		return json({ error: err.message || 'Gagal mendaftar akun' }, { status: 500 });
	}
}
