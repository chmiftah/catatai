import { getDb } from '../src/lib/server/db.js';
import { encrypt, decrypt, getKey } from '../src/lib/server/crypto.js';
import crypto from 'node:crypto';

function isEncryptedWithPrimaryKey(str, primaryKey) {
	if (!str || !str.startsWith('enc:v1:')) return false;
	const parts = str.slice(7).split(':');
	if (parts.length !== 3) return false;
	const [ivHex, tagHex, cipherHex] = parts;
	try {
		const decipher = crypto.createDecipheriv('aes-256-gcm', primaryKey, Buffer.from(ivHex, 'hex'));
		decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
		decipher.update(cipherHex, 'hex', 'utf8');
		decipher.final('utf8');
		return true;
	} catch {
		return false;
	}
}

async function run() {
	console.log('--- Memulai Migrasi & Sinkronisasi Enkripsi Database CatatAi ---');
	const sql = await getDb();
	const primaryKey = getKey();

	// 1. Ambil seluruh transaksi
	const txList = await sql`
		SELECT id, toko, catatan, gambar_url 
		FROM transaksi
		ORDER BY id ASC
	`;

	let countTx = 0;
	for (const t of txList) {
		const needsToko = t.toko && !isEncryptedWithPrimaryKey(t.toko, primaryKey);
		const needsCatatan = t.catatan && !isEncryptedWithPrimaryKey(t.catatan, primaryKey);
		const needsGambar = t.gambar_url && !isEncryptedWithPrimaryKey(t.gambar_url, primaryKey);

		if (needsToko || needsCatatan || needsGambar) {
			const encToko = needsToko ? encrypt(decrypt(t.toko)) : t.toko;
			const encCatatan = needsCatatan ? encrypt(decrypt(t.catatan)) : t.catatan;
			const encGambar = needsGambar ? encrypt(decrypt(t.gambar_url)) : t.gambar_url;

			await sql`
				UPDATE transaksi
				SET toko = ${encToko},
				    catatan = ${encCatatan},
				    gambar_url = ${encGambar}
				WHERE id = ${t.id}
			`;
			countTx++;
		}
	}
	console.log(`✓ Selesai memproses/menyelaraskan ${countTx} transaksi dari total ${txList.length}`);

	// 2. Ambil seluruh transaksi_item
	const itemList = await sql`
		SELECT id, nama_barang 
		FROM transaksi_item
		ORDER BY id ASC
	`;

	let countItem = 0;
	for (const itm of itemList) {
		if (itm.nama_barang && !isEncryptedWithPrimaryKey(itm.nama_barang, primaryKey)) {
			const encNama = encrypt(decrypt(itm.nama_barang));
			await sql`
				UPDATE transaksi_item
				SET nama_barang = ${encNama}
				WHERE id = ${itm.id}
			`;
			countItem++;
		}
	}
	console.log(`✓ Selesai memproses/menyelaraskan ${countItem} rincian item barang dari total ${itemList.length}`);

	console.log('--- Migrasi Enkripsi Selesai dengan Sukses! ---');
	process.exit(0);
}

run().catch((err) => {
	console.error('Migrasi gagal:', err);
	process.exit(1);
});
