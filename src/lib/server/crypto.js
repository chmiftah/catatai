import crypto from 'node:crypto';
import { config } from '#lib/server/config.js';

let cachedKey = null;

function getKey() {
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

	try {
		const key = getKey();
		const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
		decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

		let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
		decrypted += decipher.final('utf8');
		return decrypted;
	} catch (err) {
		console.error('Gagal mendekripsi data:', err.message);
		return str;
	}
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
