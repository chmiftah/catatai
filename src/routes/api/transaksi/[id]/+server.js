import { json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db.js';
import { getAuthUser } from '#lib/server/auth.js';
import { decryptTransaction, decryptItem, encrypt } from '#lib/server/crypto.js';

export async function GET({ params, cookies }) {
	try {
		const user = await getAuthUser(cookies);
		if (!user) {
			return json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
		}

		const sql = await getDb();
		const id = Number(params.id);

		const [trx] = await sql`
			SELECT 
				id, user_id, tipe, toko, tanggal::text as tanggal, waktu::text as waktu, 
				kategori, metode_bayar, dompet, dompet_id, subtotal::float as subtotal, 
				pajak::float as pajak, diskon::float as diskon, 
				total::float as total, gambar_url, catatan, dibuat
			FROM transaksi
			WHERE id = ${id} AND user_id = ${user.id}
		`;

		if (!trx) {
			return json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
		}

		const items = await sql`
			SELECT id, nama_barang, qty::float as qty, harga_satuan::float as harga_satuan, subtotal::float as subtotal
			FROM transaksi_item
			WHERE transaksi_id = ${id}
			ORDER BY id ASC
		`;

		const decryptedTrx = decryptTransaction(trx);
		const decryptedItems = (items || []).map(decryptItem);

		return json({ success: true, transaksi: { ...decryptedTrx, items: decryptedItems } });
	} catch (err) {
		console.error('Error GET /api/transaksi/[id]:', err);
		return json({ error: err.message || 'Gagal memuat detail transaksi' }, { status: 500 });
	}
}

export async function PUT({ params, request, cookies }) {
	try {
		const user = await getAuthUser(cookies);
		if (!user) {
			return json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
		}

		const sql = await getDb();
		const id = Number(params.id);
		const body = await request.json();

		let {
			tipe = 'pengeluaran',
			toko = '',
			tanggal = '',
			waktu = '',
			kategori = 'Lainnya',
			metode_bayar = 'Tunai',
			dompet = '',
			dompet_id = null,
			subtotal = 0,
			pajak = 0,
			diskon = 0,
			total = 0,
			gambar_url = null,
			catatan = '',
			items = []
		} = body;

		if (!dompet && metode_bayar) dompet = metode_bayar;
		if (!metode_bayar && dompet) metode_bayar = dompet;
		if (!dompet) dompet = 'Tunai';

		if (!dompet_id && dompet) {
			const [foundD] = await sql`SELECT id FROM dompet WHERE user_id = ${user.id} AND LOWER(nama) = LOWER(${dompet}) LIMIT 1`;
			if (foundD) dompet_id = foundD.id;
		}

		const safeTanggal = (tanggal && typeof tanggal === 'string' && tanggal.trim()) 
			? tanggal.trim().slice(0, 10) 
			: new Date().toISOString().slice(0, 10);
		const safeWaktu = (waktu && typeof waktu === 'string' && waktu.trim()) 
			? waktu.trim().slice(0, 8) 
			: new Date().toTimeString().slice(0, 8);

		const numSubtotal = Number(subtotal) || 0;
		const numPajak = Number(pajak) || 0;
		const numDiskon = Number(diskon) || 0;
		const grandTotal = Number(total) > 0 ? Number(total) : Math.max(0, numSubtotal + numPajak - numDiskon);

		const encToko = encrypt(toko || '');
		const encCatatan = encrypt(catatan || '');
		const encGambarUrl = gambar_url ? encrypt(gambar_url) : null;

		const [updated] = await sql`
			UPDATE transaksi
			SET tipe = ${tipe},
			    toko = ${encToko},
			    tanggal = ${safeTanggal}::date,
			    waktu = ${safeWaktu}::time,
			    kategori = ${kategori},
			    metode_bayar = ${metode_bayar},
			    dompet = ${dompet},
			    dompet_id = ${dompet_id || null},
			    subtotal = ${numSubtotal},
			    pajak = ${numPajak},
			    diskon = ${numDiskon},
			    total = ${grandTotal},
			    gambar_url = ${encGambarUrl},
			    catatan = ${encCatatan}
			WHERE id = ${id} AND user_id = ${user.id}
			RETURNING id
		`;

		if (!updated) {
			return json({ error: 'Transaksi tidak ditemukan atau bukan milik Anda' }, { status: 404 });
		}

		// Update items
		if (Array.isArray(items)) {
			await sql`DELETE FROM transaksi_item WHERE transaksi_id = ${id}`;
			for (const itm of items) {
				if (!itm.nama_barang) continue;
				const qty = Number(itm.qty) || 1;
				const harga = Number(itm.harga_satuan) || 0;
				const sub = Number(itm.subtotal) || (qty * harga);
				const encNama = encrypt(itm.nama_barang);
				await sql`
					INSERT INTO transaksi_item (transaksi_id, nama_barang, qty, harga_satuan, subtotal)
					VALUES (${id}, ${encNama}, ${qty}, ${harga}, ${sub})
				`;
			}
		}

		return json({ success: true, id });
	} catch (err) {
		console.error('Error PUT /api/transaksi/[id]:', err);
		return json({ error: err.message || 'Gagal memperbarui transaksi' }, { status: 500 });
	}
}

export async function DELETE({ params, cookies }) {
	try {
		const user = await getAuthUser(cookies);
		if (!user) {
			return json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
		}

		const sql = await getDb();
		const id = Number(params.id);

		const [deleted] = await sql`DELETE FROM transaksi WHERE id = ${id} AND user_id = ${user.id} RETURNING id`;
		if (!deleted) {
			return json({ error: 'Transaksi tidak ditemukan atau bukan milik Anda' }, { status: 404 });
		}
		return json({ success: true });
	} catch (err) {
		console.error('Error DELETE /api/transaksi/[id]:', err);
		return json({ error: err.message || 'Gagal menghapus transaksi' }, { status: 500 });
	}
}
