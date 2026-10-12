import { json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db.js';
import { getAuthUser } from '#lib/server/auth.js';
import { decryptTransaction, decryptItem } from '#lib/server/crypto.js';

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
				kategori, metode_bayar, subtotal::float as subtotal, 
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
