import crypto from 'node:crypto';
import { config } from '#lib/server/config.js';

let cachedKey = null;

export function getKey() {
	if (cachedKey) return cachedKey;

	const rawKey = (config.ENCRYPTION_KEY || '').trim();
	if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
		cachedKey = Buffer.from(rawKey, 'hex');
	} else if (rawKey.length === 32) {
		cachedKey = Buffer.from(rawKey, 'utf8');
	} else if (rawKey.length > 0) {
		// Jika kunci tidak tepat 32 byte, hash menggunakan SHA-256 agar selalu tepat 32 bytes (256-bit)
		cachedKey = crypto.createHash('sha256').update(rawKey).digest();
	} else {
		// Fallback turunan dari AUTH_SECRET
		const secret = config.AUTH_SECRET || 'catatai-default-encryption-salt-2026';
		cachedKey = crypto.createHash('sha256').update(secret).digest();
	}

	return cachedKey;
}

/**
 * Mendapatkan daftar kunci dekripsi (kunci utama + fallback kunci turunan AUTH_SECRET).
 * Hal ini memastikan data yang terenkripsi sebelum ENCRYPTION_KEY diset tetap bisa didekripsi dengan mulus.
 */
function getDecryptionKeys() {
	const keys = [];
	const primary = getKey();
	if (primary) keys.push(primary);

	// Fallback 1: turunan dari AUTH_SECRET
	if (config.AUTH_SECRET) {
		const authKey = crypto.createHash('sha256').update(config.AUTH_SECRET).digest();
		if (!keys.some((k) => k.equals(authKey))) {
			keys.push(authKey);
		}
	}

	// Fallback 2: salt bawaan CatatAi
	const defaultSaltKey = crypto.createHash('sha256').update('catatai-default-encryption-salt-2026').digest();
	if (!keys.some((k) => k.equals(defaultSaltKey))) {
		keys.push(defaultSaltKey);
	}

	return keys;
}

/**
 * Enkripsi teks menggunakan AES-256-GCM.
 * Output format: enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encrypt(text) {
	if (text === null || text === undefined) return text;
	const str = String(text);
	if (!str.trim()) return str;

	// Cegah double encryption jika data sudah terenkripsi
	if (str.startsWith('enc:v1:')) return str;

	try {
		const key = getKey();
		const iv = crypto.randomBytes(12); // 96-bit IV standar untuk AES-GCM
		const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

		let encrypted = cipher.update(str, 'utf8', 'hex');
		encrypted += cipher.final('hex');

		const authTag = cipher.getAuthTag().toString('hex');
		return `enc:v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
	} catch (err) {
		console.error('Gagal mengenkripsi:', err.message);
		return str;
	}
}

/**
 * Dekripsi teks terenkripsi format enc:v1.
 * Jika teks masih format plaintext lama, dikembalikan apa adanya tanpa error (backward compatible).
 * Mencoba kunci utama terlebih dahulu, lalu kunci fallback jika ada pergantian ENCRYPTION_KEY.
 */
export function decrypt(text) {
	if (text === null || text === undefined) return text;
	const str = String(text);

	if (!str.startsWith('enc:v1:')) {
		// Format plaintext lama, langsung return
		return str;
	}

	const parts = str.slice(7).split(':');
	if (parts.length !== 3) return str;

	const [ivHex, tagHex, cipherHex] = parts;
	let iv, tag;
	try {
		iv = Buffer.from(ivHex, 'hex');
		tag = Buffer.from(tagHex, 'hex');
	} catch {
		return str;
	}

	const keys = getDecryptionKeys();
	for (const key of keys) {
		try {
			const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
			decipher.setAuthTag(tag);

			let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
			decrypted += decipher.final('utf8');
			return decrypted;
		} catch {
			// Autentikasi AES-GCM gagal untuk kunci ini, coba kunci berikutnya di daftar keys
			continue;
		}
	}

	console.error('Gagal mendekripsi data: Kunci enkripsi tidak cocok untuk ciphertext ini');
	return str;
}

/**
 * Enkripsi kolom sensitif pada transaksi sebelum disimpan ke DB.
 */
export function encryptTransaction(tx) {
	if (!tx) return tx;
	return {
		...tx,
		toko: tx.toko !== undefined ? encrypt(tx.toko) : tx.toko,
		catatan: tx.catatan !== undefined ? encrypt(tx.catatan) : tx.catatan,
		gambar_url: tx.gambar_url ? encrypt(tx.gambar_url) : tx.gambar_url
	};
}

/**
 * Dekripsi kolom sensitif transaksi setelah diambil dari DB.
 */
export function decryptTransaction(tx) {
	if (!tx) return tx;
	return {
		...tx,
		toko: tx.toko !== undefined ? decrypt(tx.toko) : tx.toko,
		catatan: tx.catatan !== undefined ? decrypt(tx.catatan) : tx.catatan,
		gambar_url: tx.gambar_url ? decrypt(tx.gambar_url) : tx.gambar_url
	};
}

/**
 * Enkripsi item rincian transaksi sebelum disimpan ke DB.
 */
export function encryptItem(item) {
	if (!item) return item;
	return {
		...item,
		nama_barang: item.nama_barang !== undefined ? encrypt(item.nama_barang) : item.nama_barang
	};
}

/**
 * Dekripsi item rincian transaksi setelah diambil dari DB.
 */
export function decryptItem(item) {
	if (!item) return item;
	return {
		...item,
		nama_barang: item.nama_barang !== undefined ? decrypt(item.nama_barang) : item.nama_barang
	};
}
