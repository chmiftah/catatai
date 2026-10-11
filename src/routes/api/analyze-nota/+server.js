import { json } from '@sveltejs/kit';
import { config } from '#lib/server/config.js';
import { getAuthUser } from '#lib/server/auth.js';

export async function POST({ request, cookies }) {
	try {
		const user = await getAuthUser(cookies);
		if (!user) {
			return json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
		}

		const { image } = await request.json();

		if (!image || typeof image !== 'string' || !/^data:image\/(jpeg|png|webp|gif);base64,/.test(image)) {
			return json({ error: 'Format gambar tidak valid. Gunakan JPEG, PNG, atau WebP (Base64).' }, { status: 400 });
		}

		const apiKey = config.DEEPSEEK_API_KEY;
		if (!apiKey) {
			return json({ error: 'DEEPSEEK_API_KEY belum dikonfigurasi di file .env' }, { status: 500 });
		}

		const systemPrompt = `Kamu adalah sistem OCR dan ekstraktor data nota / struk belanja / transaksi keuangan profesional.
Tugasmu adalah menganalisis gambar nota yang diberikan dan mengekstrak datanya ke dalam format JSON murni TANPA markdown block, TANPA pengantar, TANPA komentar apapun.

Format JSON yang HARUS kamu kembalikan:
{
  "toko": "Nama Toko / Restoran / Merchant (string, default kosong jika tidak ditemukan)",
  "tanggal": "YYYY-MM-DD (string tanggal transaksi, jika tahun tidak ada gunakan tahun ini)",
  "waktu": "HH:MM:SS (string waktu, jika tidak ada gunakan 12:00:00)",
  "kategori": "Pilih salah satu: Makanan & Minuman | Belanja Harian | Bahan Baku | Operasional | Transportasi | Utilitas & Tagihan | Elektronik & Alat | Lainnya",
  "tipe": "pengeluaran",
  "metode_bayar": "Tunai | QRIS | Transfer | Kartu Debit | Kartu Kredit (default: Tunai)",
  "subtotal": 0,
  "pajak": 0,
  "diskon": 0,
  "total": 0,
  "items": [
    {
      "nama_barang": "Nama produk / item",
      "qty": 1,
      "harga_satuan": 0,
      "subtotal": 0
    }
  ],
  "catatan": "Catatan singkat atau nomor struk jika ada"
}

Pastikan:
1. Angka numerik untuk subtotal, pajak, diskon, total, qty, dan harga_satuan (bukan string bertanda koma/titik ribuan).
2. Jika ada item belanja, rincikan setiap baris ke dalam array items. Jika tidak terbaca itemnya, kosongkan items: [] dan isi totalnya saja.
3. Selalu validasi agar total mendekati (subtotal + pajak - diskon).`;

		const response = await fetch('https://api.deepseek.com/chat/completions', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: config.DEEPSEEK_VISION_MODEL || 'deepseek-flash',
				messages: [
					{ role: 'system', content: systemPrompt },
					{
						role: 'user',
						content: [
							{ type: 'text', text: 'Analisis nota ini dan kembalikan hanya JSON murni sesuai format instruksi:' },
							{ type: 'image_url', image_url: { url: image } }
						]
					}
				],
				temperature: 0.1
			})
		});

		if (!response.ok) {
			const errText = await response.text();
			return json({ error: `Gagal memproses gambar ke DeepSeek (${response.status}): ${errText.slice(0, 200)}` }, { status: 502 });
		}

		const data = await response.json();
		let rawContent = data.choices?.[0]?.message?.content?.trim() || '';

		rawContent = rawContent.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

		let parsedResult;
		try {
			parsedResult = JSON.parse(rawContent);
		} catch (e) {
			const firstBrace = rawContent.indexOf('{');
			const lastBrace = rawContent.lastIndexOf('}');
			if (firstBrace !== -1 && lastBrace !== -1) {
				parsedResult = JSON.parse(rawContent.substring(firstBrace, lastBrace + 1));
			} else {
				throw new Error('Hasil ekstraksi AI bukan JSON yang valid');
			}
		}

		return json({ success: true, data: parsedResult });
	} catch (err) {
		console.error('Error analyze-nota:', err);
		return json({ error: err.message || 'Terjadi kesalahan saat menganalisis nota' }, { status: 500 });
	}
}
