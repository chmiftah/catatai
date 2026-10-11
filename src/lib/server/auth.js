import crypto from 'node:crypto';
import { getDb } from '#lib/server/db.js';

const COOKIE_NAME = 'catatai_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 hari

/**
 * Hash password menggunakan Scrypt native Node.js
 */
export function hashPassword(password) {
	const salt = crypto.randomBytes(16).toString('hex');
	const hash = crypto.scryptSync(password, salt, 64).toString('hex');
	return `${salt}:${hash}`;
}

/**
 * Verifikasi password dengan hash tersimpan
 */
export function verifyPassword(password, storedHash) {
	if (!storedHash || !storedHash.includes(':')) return false;
	const [salt, originalHash] = storedHash.split(':');
	const hashAttempt = crypto.scryptSync(password, salt, 64).toString('hex');
	return crypto.timingSafeEqual(Buffer.from(hashAttempt, 'hex'), Buffer.from(originalHash, 'hex'));
}

/**
 * Generate secure session token
 */
export function generateToken() {
	return crypto.randomBytes(32).toString('hex');
}

/**
 * Set HTTP-only session cookie
 */
export function setSessionCookie(cookies, token) {
	cookies.set(COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: COOKIE_MAX_AGE
	});
}

/**
 * Clear session cookie saat logout
 */
export function clearSessionCookie(cookies) {
	cookies.delete(COOKIE_NAME, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax'
	});
}

/**
 * Dapatkan data user saat ini berdasarkan cookie session
 * @returns {Promise<{id: number, email: string, nama: string} | null>}
 */
export async function getAuthUser(cookies) {
	const token = cookies.get(COOKIE_NAME);
	if (!token) return null;

	try {
		const sql = await getDb();
		const [user] = await sql`
			SELECT id, email, nama, dibuat,
			       COALESCE(role, 'user') as role,
			       COALESCE(tier, 'free') as tier,
			       COALESCE(chat_count_today, 0)::int as chat_count_today,
			       COALESCE(chat_date_today::text, CURRENT_DATE::text) as chat_date_today
			FROM users
			WHERE session_token = ${token}
			LIMIT 1
		`;

		if (!user) return null;
		return user;
	} catch (err) {
		console.error('Error getAuthUser:', err);
		return null;
	}
}
