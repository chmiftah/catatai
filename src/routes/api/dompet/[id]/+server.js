import { json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db.js';
import { getAuthUser } from '#lib/server/auth.js';

export async function PUT({ params, request, cookies }) {
	try {
		const user = await getAuthUser(cookies);
		if (!user) {
			return json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
		}

		const sql = await getDb();
		const id = Number(params.id);
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

		const [updated] = await sql`
			UPDATE dompet
			SET nama = ${nama},
			    tipe = ${tipe},
			    saldo_awal = ${saldo_awal},
			    warna = ${warna},
			    ikon = ${ikon},
			    nomor_rekening = ${nomor_rekening},
			    catatan = ${catatan}
			WHERE id = ${id} AND user_id = ${user.id}
			RETURNING id, user_id, nama, tipe, saldo_awal::float as saldo_awal, warna, ikon, nomor_rekening, catatan, dibuat
		`;

		if (!updated) {
			return json({ error: 'Dompet tidak ditemukan atau bukan milik Anda' }, { status: 404 });
		}

		return json({ success: true, dompet: updated });
	} catch (err) {
		console.error('Error PUT /api/dompet/[id]:', err);
		return json({ error: err.message || 'Gagal memperbarui dompet' }, { status: 500 });
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

		// Hapus dompet
		const [deleted] = await sql`
			DELETE FROM dompet
			WHERE id = ${id} AND user_id = ${user.id}
			RETURNING id
		`;

		if (!deleted) {
			return json({ error: 'Dompet tidak ditemukan' }, { status: 404 });
		}

		return json({ success: true, deleted_id: id });
	} catch (err) {
		console.error('Error DELETE /api/dompet/[id]:', err);
		return json({ error: err.message || 'Gagal menghapus dompet' }, { status: 500 });
	}
}
