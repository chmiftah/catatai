import { json } from '@sveltejs/kit';
import { getAuthUser } from '#lib/server/auth.js';
import { getDb } from '#lib/server/db.js';
import { decryptTransaction, decryptItem } from '#lib/server/crypto.js';

function isAdmin(user) {
	if (!user) return false;
	return user.role === 'admin' || user.email === 'miftahdev7@gmail.com';
}

export async function GET({ url, cookies }) {
	try {
		const currentUser = await getAuthUser(cookies);
		if (!currentUser || !isAdmin(currentUser)) {
			return json({ error: 'Akses ditolak. Halaman ini khusus Admin.' }, { status: 403 });
		}

		const sql = await getDb();
		const userId = url.searchParams.get('userId');
		const bulan = url.searchParams.get('bulan');
		const tipe = url.searchParams.get('tipe');
		const q = url.searchParams.get('q');
		const transaksiId = url.searchParams.get('transaksiId');

		// 1. Jika meminta detail 1 transaksi beserta rincian item
		if (transaksiId) {
			const [tx] = await sql`
				SELECT 
					t.id, t.user_id, t.tipe, t.toko, t.tanggal::text as tanggal, t.waktu::text as waktu, 
					t.kategori, t.metode_bayar, t.subtotal::float as subtotal, 
					t.pajak::float as pajak, t.diskon::float as diskon, 
					t.total::float as total, t.gambar_url, t.catatan, t.dibuat,
					u.nama as user_nama, u.email as user_email
				FROM transaksi t
				LEFT JOIN users u ON t.user_id = u.id
				WHERE t.id = ${parseInt(transaksiId)}
				LIMIT 1
			`;

			if (!tx) {
				return json({ error: 'Transaksi tidak ditemukan' }, { status: 404 });
			}

			const items = await sql`
				SELECT id, transaksi_id, nama_barang, qty::float as qty, harga_satuan::float as harga_satuan, subtotal::float as subtotal
				FROM transaksi_item
				WHERE transaksi_id = ${tx.id}
				ORDER BY id ASC
			`;

			return json({
				success: true,
				transaksi: {
					...decryptTransaction(tx),
					items: (items || []).map(decryptItem)
				}
			});
		}

		// 2. Query transaksi pengguna dengan filter
		const parsedUserId = userId ? parseInt(userId) : null;

		const rawList = await sql`
			SELECT 
				t.id, t.user_id, t.tipe, t.toko, t.tanggal::text as tanggal, t.waktu::text as waktu, 
				t.kategori, t.metode_bayar, t.subtotal::float as subtotal, 
				t.pajak::float as pajak, t.diskon::float as diskon, 
				t.total::float as total, t.gambar_url, t.catatan, t.dibuat,
				u.nama as user_nama, u.email as user_email,
				COUNT(i.id)::int as jumlah_item
			FROM transaksi t
			LEFT JOIN users u ON t.user_id = u.id
			LEFT JOIN transaksi_item i ON t.id = i.transaksi_id
			WHERE 
				(${parsedUserId ? sql`t.user_id = ${parsedUserId}` : sql`1=1`})
				AND (${bulan ? sql`to_char(t.tanggal, 'YYYY-MM') = ${bulan}` : sql`1=1`})
				AND (${tipe && tipe !== 'semua' ? sql`t.tipe = ${tipe}` : sql`1=1`})
			GROUP BY t.id, u.id
			ORDER BY t.tanggal DESC, t.waktu DESC, t.id DESC
			LIMIT 300
		`;

		// Dekripsi transaksi di sisi aplikasi
		let list = rawList.map(decryptTransaction);

		// Filter pencarian toko, catatan, nama pengguna, atau email
		if (q && q.trim()) {
			const query = q.toLowerCase().trim();
			list = list.filter((t) => 
				(t.toko && t.toko.toLowerCase().includes(query)) ||
				(t.catatan && t.catatan.toLowerCase().includes(query)) ||
				(t.user_nama && t.user_nama.toLowerCase().includes(query)) ||
				(t.user_email && t.user_email.toLowerCase().includes(query))
			);
		}

		// 3. Ringkasan statistik transaksi yang terfilter
		const totalPengeluaran = list.reduce((acc, t) => acc + (t.tipe === 'pengeluaran' ? Number(t.total) || 0 : 0), 0);
		const totalPemasukan = list.reduce((acc, t) => acc + (t.tipe === 'pemasukan' ? Number(t.total) || 0 : 0), 0);
		const saldoBersih = totalPemasukan - totalPengeluaran;

		// 4. Daftar user untuk opsi dropdown filter
		const users = await sql`
			SELECT id, nama, email
			FROM users
			ORDER BY nama ASC
		`;

		return json({
			success: true,
			transaksi: list,
			stats: {
				total_transaksi: list.length,
				total_pengeluaran: totalPengeluaran,
				total_pemasukan: totalPemasukan,
				saldo_bersih: saldoBersih
			},
			users
		});
	} catch (err) {
		console.error('Error GET /api/admin/transaksi:', err);
		return json({ error: 'Gagal memuat transaksi: ' + err.message }, { status: 500 });
	}
}
