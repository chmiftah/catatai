import { json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db.js';
import { getAuthUser } from '#lib/server/auth.js';
import { encrypt, encryptTransaction, decryptTransaction, encryptItem } from '#lib/server/crypto.js';

export async function GET({ url, cookies }) {
	try {
		const user = await getAuthUser(cookies);
		if (!user) {
			return json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
		}

		const sql = await getDb();
		const bulan = url.searchParams.get('bulan'); // contoh: '2026-10'
		const tanggal = url.searchParams.get('tanggal'); // contoh: '2026-10-11'
		const kategori = url.searchParams.get('kategori');
		const tipe = url.searchParams.get('tipe');
		const cari = url.searchParams.get('q');

		// Ambil transaksi milik user yang sedang login
		let rawList = await sql`
			SELECT 
				t.id, t.user_id, t.tipe, t.toko, t.tanggal::text as tanggal, t.waktu::text as waktu, 
				t.kategori, t.metode_bayar, t.subtotal::float as subtotal, 
				t.pajak::float as pajak, t.diskon::float as diskon, 
				t.total::float as total, t.gambar_url, t.catatan, t.dibuat,
				COUNT(i.id)::int as jumlah_item
			FROM transaksi t
			LEFT JOIN transaksi_item i ON t.id = i.transaksi_id
			WHERE 
				t.user_id = ${user.id}
				AND (${bulan ? sql`to_char(t.tanggal, 'YYYY-MM') = ${bulan}` : sql`1=1`})
				AND (${tanggal ? sql`t.tanggal = ${tanggal}::date` : sql`1=1`})
				AND (${kategori ? sql`t.kategori = ${kategori}` : sql`1=1`})
				AND (${tipe ? sql`t.tipe = ${tipe}` : sql`1=1`})
			GROUP BY t.id
			ORDER BY t.tanggal DESC, t.waktu DESC, t.id DESC
		`;

		// Dekripsi data transaksi di sisi aplikasi
		let list = rawList.map(decryptTransaction);

		// Filter pencarian teks toko/catatan di memori secara aman
		if (cari && cari.trim()) {
			const query = cari.toLowerCase().trim();
			list = list.filter((t) => 
				(t.toko && t.toko.toLowerCase().includes(query)) ||
				(t.catatan && t.catatan.toLowerCase().includes(query))
			);
		}

		// Rekap Agregasi Bulanan milik user yang sedang login
		const statsList = await sql`
			SELECT 
				COALESCE(SUM(CASE WHEN t.tipe = 'pengeluaran' THEN t.total ELSE 0 END), 0)::float as total_pengeluaran,
				COALESCE(SUM(CASE WHEN t.tipe = 'pemasukan' THEN t.total ELSE 0 END), 0)::float as total_pemasukan,
				COUNT(t.id)::int as total_transaksi
			FROM transaksi t
			WHERE 
				t.user_id = ${user.id}
				AND (${bulan ? sql`to_char(t.tanggal, 'YYYY-MM') = ${bulan}` : sql`1=1`})
		`;

		// Rekap Harian untuk Grafik Tren milik user
		const trenHarian = await sql`
			SELECT 
				t.tanggal::text as tanggal,
				COALESCE(SUM(CASE WHEN t.tipe = 'pengeluaran' THEN t.total ELSE 0 END), 0)::float as pengeluaran,
				COALESCE(SUM(CASE WHEN t.tipe = 'pemasukan' THEN t.total ELSE 0 END), 0)::float as pemasukan,
				COUNT(t.id)::int as count
			FROM transaksi t
			WHERE 
				t.user_id = ${user.id}
				AND (${bulan ? sql`to_char(t.tanggal, 'YYYY-MM') = ${bulan}` : sql`1=1`})
			GROUP BY t.tanggal
			ORDER BY t.tanggal ASC
		`;

		// Rekap Distribusi Kategori Pengeluaran milik user
		const rekapKategori = await sql`
			SELECT 
				t.kategori,
				COALESCE(SUM(t.total), 0)::float as total,
				COUNT(t.id)::int as count
			FROM transaksi t
			WHERE 
				t.user_id = ${user.id}
				AND t.tipe = 'pengeluaran'
				AND (${bulan ? sql`to_char(t.tanggal, 'YYYY-MM') = ${bulan}` : sql`1=1`})
			GROUP BY t.kategori
			ORDER BY total DESC
		`;

		// Top 5 Toko / Merchant Terbanyak milik user (dihitung dari transaksi terdekripsi)
		const merchantMap = {};
		for (const t of rawList.map(decryptTransaction)) {
			if (t.tipe === 'pengeluaran' && t.toko && t.toko.trim() !== '') {
				const merchantName = t.toko.trim();
				if (!merchantMap[merchantName]) {
					merchantMap[merchantName] = { toko: merchantName, total: 0, count: 0 };
				}
				merchantMap[merchantName].total += Number(t.total) || 0;
				merchantMap[merchantName].count += 1;
			}
		}
		const topMerchant = Object.values(merchantMap)
			.sort((a, b) => b.total - a.total)
			.slice(0, 5);

		const stats = statsList[0] || { total_pengeluaran: 0, total_pemasukan: 0, total_transaksi: 0 };
		const saldo_bersih = (stats.total_pemasukan || 0) - (stats.total_pengeluaran || 0);

		return json({
			success: true,
			transaksi: list,
			rekap: {
				total_pengeluaran: stats.total_pengeluaran,
				total_pemasukan: stats.total_pemasukan,
				saldo_bersih,
				total_transaksi: stats.total_transaksi,
				tren_harian: trenHarian,
				rekap_kategori: rekapKategori,
				top_merchant: topMerchant
			}
		});
	} catch (err) {
		console.error('Error GET /api/transaksi:', err);
		return json({ error: err.message || 'Gagal memuat transaksi' }, { status: 500 });
	}
}

export async function POST({ request, cookies }) {
	try {
		const user = await getAuthUser(cookies);
		if (!user) {
			return json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
		}

		const sql = await getDb();
		const body = await request.json();

		const {
			tipe = 'pengeluaran',
			toko = '',
			tanggal = new Date().toISOString().slice(0, 10),
			waktu = new Date().toTimeString().slice(0, 8),
			kategori = 'Lainnya',
			metode_bayar = 'Tunai',
			subtotal = 0,
			pajak = 0,
			diskon = 0,
			total = 0,
			gambar_url = null,
			catatan = '',
			items = []
		} = body;

		// Hitung total jika belum ada
		const grandTotal = total > 0 ? total : Math.max(0, Number(subtotal) + Number(pajak) - Number(diskon));

		// Enkripsi teks sensitif sebelum disimpan ke database
		const encToko = encrypt(toko);
		const encCatatan = encrypt(catatan);
		const encGambarUrl = gambar_url ? encrypt(gambar_url) : null;

		// Insert ke transaksi dengan user_id terisolasi dan data terenkripsi
		const [trx] = await sql`
			INSERT INTO transaksi (
				user_id, tipe, toko, tanggal, waktu, kategori, metode_bayar,
				subtotal, pajak, diskon, total, gambar_url, catatan
			) VALUES (
				${user.id}, ${tipe}, ${encToko}, ${tanggal}::date, ${waktu}::time, ${kategori}, ${metode_bayar},
				${subtotal}, ${pajak}, ${diskon}, ${grandTotal}, ${encGambarUrl}, ${encCatatan}
			) RETURNING id
		`;

		// Insert items jika ada (nama_barang terenkripsi)
		if (Array.isArray(items) && items.length > 0) {
			for (const itm of items) {
				if (!itm.nama_barang) continue;
				const qty = Number(itm.qty) || 1;
				const harga = Number(itm.harga_satuan) || 0;
				const sub = Number(itm.subtotal) || (qty * harga);
				const encNamaBarang = encrypt(itm.nama_barang);
				await sql`
					INSERT INTO transaksi_item (
						transaksi_id, nama_barang, qty, harga_satuan, subtotal
					) VALUES (
						${trx.id}, ${encNamaBarang}, ${qty}, ${harga}, ${sub}
					)
				`;
			}
		}

		return json({ success: true, id: trx.id });
	} catch (err) {
		console.error('Error POST /api/transaksi:', err);
		return json({ error: err.message || 'Gagal menyimpan transaksi' }, { status: 500 });
	}
}
