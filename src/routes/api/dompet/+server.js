import { json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db.js';
import { getAuthUser } from '#lib/server/auth.js';

export async function GET({ cookies }) {
	try {
		const user = await getAuthUser(cookies);
		if (!user) {
			return json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
		}

		const sql = await getDb();

		// Cek apakah user sudah memiliki dompet
		const existing = await sql`SELECT id FROM dompet WHERE user_id = ${user.id} LIMIT 1`;
		if (!existing || existing.length === 0) {
			// Buat dompet awal default untuk pengguna baru
			await sql`
				INSERT INTO dompet (user_id, nama, tipe, saldo_awal, warna, ikon, catatan)
				VALUES 
					(${user.id}, 'Tunai', 'cash', 0, '#059669', 'cash', 'Uang tunai fisik harian'),
					(${user.id}, 'Rekening Bank', 'bank', 0, '#2563eb', 'bank', 'Rekening bank utama (BCA/Mandiri/BRI)'),
					(${user.id}, 'E-Wallet', 'ewallet', 0, '#7c3aed', 'phone', 'Dompet digital (GoPay/Dana/OVO)')
			`;
		}

		// Ambil daftar dompet beserta agregasi saldo mutasi transaksi
		const rawDompet = await sql`
			SELECT 
				d.id, d.user_id, d.nama, d.tipe, d.saldo_awal::float as saldo_awal, 
				d.warna, d.ikon, d.nomor_rekening, d.catatan, d.dibuat,
				COALESCE(SUM(CASE WHEN t.tipe = 'pemasukan' THEN t.total ELSE 0 END), 0)::float as total_masuk,
				COALESCE(SUM(CASE WHEN t.tipe = 'pengeluaran' THEN t.total ELSE 0 END), 0)::float as total_keluar,
				COUNT(t.id)::int as jumlah_transaksi
			FROM dompet d
			LEFT JOIN transaksi t ON t.user_id = d.user_id AND (
				t.dompet_id = d.id 
				OR (t.dompet_id IS NULL AND (LOWER(COALESCE(t.dompet, '')) = LOWER(d.nama) OR LOWER(COALESCE(t.metode_bayar, '')) = LOWER(d.nama)))
			)
			WHERE d.user_id = ${user.id}
			GROUP BY d.id
			ORDER BY d.id ASC
		`;

		const dompetList = rawDompet.map((d) => {
			const masuk = Number(d.total_masuk) || 0;
			const keluar = Number(d.total_keluar) || 0;
			const awal = Number(d.saldo_awal) || 0;
			const saldo = Math.round((awal + masuk - keluar) * 100) / 100;
			return {
				...d,
				total_masuk: masuk,
				total_keluar: keluar,
				saldo_awal: awal,
				saldo_sekarang: saldo
			};
		});

		const totalSemuaSaldo = dompetList.reduce((sum, d) => sum + d.saldo_sekarang, 0);

		return json({
			success: true,
			dompet: dompetList,
			total_saldo: Math.round(totalSemuaSaldo * 100) / 100
		});
	} catch (err) {
		console.error('Error GET /api/dompet:', err);
		return json({ error: err.message || 'Gagal memuat data dompet' }, { status: 500 });
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

		const nama = (body.nama || '').trim();
		if (!nama) {
			return json({ error: 'Nama dompet wajib diisi' }, { status: 400 });
		}

		const tipe = body.tipe || 'bank';
		const saldo_awal = Number(body.saldo_awal) || 0;
		const warna = body.warna || '#2563eb';
		const ikon = body.ikon || (tipe === 'cash' ? 'cash' : tipe === 'ewallet' ? 'phone' : 'bank');
		const nomor_rekening = (body.nomor_rekening || '').trim();
		const catatan = (body.catatan || '').trim();

		const [newDompet] = await sql`
			INSERT INTO dompet (user_id, nama, tipe, saldo_awal, warna, ikon, nomor_rekening, catatan)
			VALUES (${user.id}, ${nama}, ${tipe}, ${saldo_awal}, ${warna}, ${ikon}, ${nomor_rekening}, ${catatan})
			RETURNING id, user_id, nama, tipe, saldo_awal::float as saldo_awal, warna, ikon, nomor_rekening, catatan, dibuat
		`;

		return json({
			success: true,
			dompet: {
				...newDompet,
				total_masuk: 0,
				total_keluar: 0,
				saldo_sekarang: Number(newDompet.saldo_awal) || 0,
				jumlah_transaksi: 0
			}
		});
	} catch (err) {
		console.error('Error POST /api/dompet:', err);
		return json({ error: err.message || 'Gagal membuat dompet baru' }, { status: 500 });
	}
}
