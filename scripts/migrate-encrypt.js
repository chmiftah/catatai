import { getDb } from '../src/lib/server/db.js';
import { encrypt } from '../src/lib/server/crypto.js';

async function run() {
	console.log('--- Memulai Migrasi Enkripsi Database CatatAi ---');
	const sql = await getDb();

	// 1. Ambil transaksi yang belum terenkripsi
	const txList = await sql`
		SELECT id, toko, catatan, gambar_url 
		FROM transaksi
		ORDER BY id ASC
	`;

	let countTx = 0;
	for (const t of txList) {
		const needsToko = t.toko && !t.toko.startsWith('enc:v1:');
		const needsCatatan = t.catatan && !t.catatan.startsWith('enc:v1:');
		const needsGambar = t.gambar_url && !t.gambar_url.startsWith('enc:v1:');

		if (needsToko || needsCatatan || needsGambar) {
			const encToko = needsToko ? encrypt(t.toko) : t.toko;
			const encCatatan = needsCatatan ? encrypt(t.catatan) : t.catatan;
			const encGambar = needsGambar ? encrypt(t.gambar_url) : t.gambar_url;

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
	console.log(`✓ Selesai mengenkripsi ${countTx} transaksi dari total ${txList.length}`);

	// 2. Ambil transaksi_item yang belum terenkripsi
	const itemList = await sql`
		SELECT id, nama_barang 
		FROM transaksi_item
		ORDER BY id ASC
	`;

	let countItem = 0;
	for (const itm of itemList) {
		if (itm.nama_barang && !itm.nama_barang.startsWith('enc:v1:')) {
			const encNama = encrypt(itm.nama_barang);
			await sql`
				UPDATE transaksi_item
				SET nama_barang = ${encNama}
				WHERE id = ${itm.id}
			`;
			countItem++;
		}
	}
	console.log(`✓ Selesai mengenkripsi ${countItem} rincian item barang dari total ${itemList.length}`);

	console.log('--- Migrasi Enkripsi Selesai dengan Sukses! ---');
	process.exit(0);
}

run().catch((err) => {
	console.error('Migrasi gagal:', err);
	process.exit(1);
});
