import { json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db.js';
import { getAuthUser } from '#lib/server/auth.js';
import { encrypt } from '#lib/server/crypto.js';

export async function POST({ request, cookies }) {
	try {
		const user = await getAuthUser(cookies);
		if (!user) {
			return json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
		}

		const sql = await getDb();
		const body = await request.json();

		const dariId = Number(body.dari_dompet_id);
		const keId = Number(body.ke_dompet_id);
		const nominal = Number(body.nominal);
		const tanggal = body.tanggal || new Date().toISOString().slice(0, 10);
		const catatan = (body.catatan || '').trim();

		if (!dariId || !keId) {
			return json({ error: 'Dompet asal dan tujuan wajib dipilih' }, { status: 400 });
		}
		if (dariId === keId) {
			return json({ error: 'Dompet asal dan tujuan tidak boleh sama' }, { status: 400 });
		}
		if (!nominal || nominal <= 0) {
			return json({ error: 'Nominal transfer harus lebih besar dari 0' }, { status: 400 });
		}

		// Verifikasi kepemilikan kedua dompet
		const [dariDompet] = await sql`SELECT id, nama FROM dompet WHERE id = ${dariId} AND user_id = ${user.id}`;
		const [keDompet] = await sql`SELECT id, nama FROM dompet WHERE id = ${keId} AND user_id = ${user.id}`;

		if (!dariDompet || !keDompet) {
			return json({ error: 'Salah satu dompet tidak ditemukan' }, { status: 404 });
		}

		const timeStr = new Date().toTimeString().slice(0, 8);

		// 1. Catat pengeluaran di dompet asal
		const tokoKeluar = encrypt(`Transfer ke ${keDompet.nama}`);
		const noteKeluar = encrypt(catatan ? `${catatan} (Transfer ke ${keDompet.nama})` : `Transfer ke ${keDompet.nama}`);

		await sql`
			INSERT INTO transaksi (
				user_id, tipe, toko, tanggal, waktu, kategori, metode_bayar, dompet, dompet_id,
				subtotal, pajak, diskon, total, catatan
			) VALUES (
				${user.id}, 'pengeluaran', ${tokoKeluar}, ${tanggal}::date, ${timeStr}::time,
				'Transfer Antar Dompet', ${dariDompet.nama}, ${dariDompet.nama}, ${dariDompet.id},
				${nominal}, 0, 0, ${nominal}, ${noteKeluar}
			)
		`;

		// 2. Catat pemasukan di dompet tujuan
		const tokoMasuk = encrypt(`Transfer dari ${dariDompet.nama}`);
		const noteMasuk = encrypt(catatan ? `${catatan} (Transfer dari ${dariDompet.nama})` : `Transfer dari ${dariDompet.nama}`);

		await sql`
			INSERT INTO transaksi (
				user_id, tipe, toko, tanggal, waktu, kategori, metode_bayar, dompet, dompet_id,
				subtotal, pajak, diskon, total, catatan
			) VALUES (
				${user.id}, 'pemasukan', ${tokoMasuk}, ${tanggal}::date, ${timeStr}::time,
				'Transfer Antar Dompet', ${keDompet.nama}, ${keDompet.nama}, ${keDompet.id},
				${nominal}, 0, 0, ${nominal}, ${noteMasuk}
			)
		`;

		return json({
			success: true,
			message: `Berhasil mentransfer Rp ${nominal.toLocaleString('id-ID')} dari ${dariDompet.nama} ke ${keDompet.nama}`
		});
	} catch (err) {
		console.error('Error POST /api/dompet/transfer:', err);
		return json({ error: err.message || 'Gagal melakukan transfer antar dompet' }, { status: 500 });
	}
}
