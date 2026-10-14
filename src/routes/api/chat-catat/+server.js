import { json } from '@sveltejs/kit';
import { config } from '#lib/server/config.js';
import { getDb } from '#lib/server/db.js';
import { getAuthUser } from '#lib/server/auth.js';
import { encrypt } from '#lib/server/crypto.js';

export async function POST({ request, cookies }) {
	try {
		const user = await getAuthUser(cookies);
		if (!user) {
			return json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
		}

		const { pesan = '', image = null, history = [], currentDraft = null } = await request.json();

		const apiKey = config.DEEPSEEK_API_KEY;
		if (!apiKey) {
			return json({ error: 'DEEPSEEK_API_KEY belum dikonfigurasi di file .env' }, { status: 500 });
		}

		const today = new Date();
		const pad = (n) => String(n).padStart(2, '0');
		const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
		const timeStr = `${pad(today.getHours())}:${pad(today.getMinutes())}:00`;

		// CEK TIER & KUOTA CHAT HARIAN
		const isPro = user.tier === 'pro';
		const isSameDay = String(user.chat_date_today || '').slice(0, 10) === todayStr;
		const currentCount = isSameDay ? (user.chat_count_today || 0) : 0;

		if (!isPro && currentCount >= 5) {
			return json({
				error: 'Kuota chat gratis harian Anda telah mencapai batas maksimal (5/5 pesan). Upgrade ke CatatAi PRO untuk menikmati chat tanpa batas! ⭐',
				kuota_habis: true,
				tier: 'free',
				sisa_kuota: 0
			}, { status: 403 });
		}

		const sql = await getDb();
		const userDompet = await sql`SELECT id, nama, tipe FROM dompet WHERE user_id = ${user.id} ORDER BY id ASC`;
		const dompetNames = userDompet.length > 0 
			? userDompet.map((d) => d.nama).join(', ') 
			: 'Tunai, Rekening Bank, E-Wallet';

		const systemPrompt = `Kamu adalah CatatAi — asisten pintar pencatatan transaksi keuangan (PENGELUARAN & PEMASUKAN) dalam percakapan chat seperti WhatsApp.
Pengguna yang sedang kamu layani bernama: ${user.nama}.
Tanggal hari ini adalah: ${todayStr}, jam sekarang: ${timeStr}.
DAFTAR DOMPET PENGGUNA TERSEDIA: [${dompetNames}]

ATURAN DOMPET / METODE BAYAR:
- Jika pengguna menyebutkan rekening atau dompet (contoh: "pake gopay", "transfer bca", "debit bri", "cash", "tunai", "dana", "shopeepay"), cocokkan dengan daftar dompet di atas. Masukkan nama yang paling sesuai ke properti "dompet" dan "metode_bayar".
- Jika pengguna tidak menyebutkan secara spesifik, gunakan "Tunai".

PENTING TENTANG JAWABAN TEKS:
- JANGAN menuliskan ulang rincian poin-poin bullet (* Tipe, * Sumber, * Kategori, dsb) di dalam "jawaban_teks", karena semua data tersebut SUDAH OTOMATIS DITAMPILKAN oleh sistem dalam bentuk kartu interaktif yang rapi di bawah pesanmu.
- Cukup berikan 1-2 kalimat ramah dan padat.
  Contoh yang BAIK: "Siap, ${user.nama}! Pemasukan gaji sebesar Rp 10.000.000 via transfer BCA sudah saya siapkan drafnya." atau "Oke, beli kopi Rp 18.000 sudah saya buatkan drafnya."
  Contoh yang BURUK: Menuliskan daftar list panjang dengan tanda bintang di jawaban teks.

ATURAN AKSI PENCATATAN (SANGAT PENTING):
1. PENCATATAN TEKS ATAU SUARA (VOICE NOTE LANGSUNG, TANPA FOTO NOTA):
   - Jika pengguna mengetik pesan teks ATAU mengirimkan rekaman suara (voice note) pencatatan pengeluaran atau pemasukan (sangat toleran terhadap bahasa percakapan sehari-hari / lisan seperti "tadi barusan beli kopi 18 ribu pake gopay", "makan siang nasi padang 25 ribu tunai", "isi bensin pertamax 50rb di spbu pake bca", "beli token listrik 100k", "dapet transferan gaji 10jt", dsb):
     -> AKSI HARUS: "konfirmasi_simpan"!
     -> KARENA PENGGUNA INGIN TRANSAKSI LANGSUNG TERCATAT KE DATABASE TANPA PERLU DUA KALI KONFIRMASI.
     -> Jawaban singkat: "Siap, ${user.nama}! [Pengeluaran / Pemasukan] [keterangan barang/toko] sebesar Rp [nominal] sudah langsung dicatat ke rekap keuangan! 🎉"
   - Contoh nominal: "12k" = 12000, "35rb" = 35000, "1.5jt" = 1500000, "10jt" = 10000000, "seratus ribu" = 100000, "dua puluh lima ribu" = 25000.

2. EKSTRAKSI FOTO NOTA / STRUK GAMBAR:
   - HANYA JIKA pengguna mengirimkan FOTO NOTA / GAMBAR (karena struk belanja bisa panjang dan perlu dicek item-itemnya):
     -> AKSI: "draft"
     -> Jawaban singkat: "Siap, ${user.nama}! Nota belanja sudah saya ekstrak lengkap. Cek drafnya ya, kalau sudah pas tinggal bilang 'simpan'."

3. KONFIRMASI DRAFT NOTA:
   - Jika pengguna merespons: "ya", "ok", "betul", "gas", "lanjut", "sip", "simpan", "sudah", "oke", "yoi":
     -> AKSI: "konfirmasi_simpan"
     -> Jawaban singkat: "Siap, transaksi sudah dikonfirmasi dan langsung disimpan ke rekap! 🎉"

4. BATAL:
   - Jika pengguna membatalkan draf: "batal", "jangan simpan", "ga jadi":
     -> AKSI: "batal"

5. CHAT BIASA:
   - Jika pesan hanya sapaan atau bukan instruksi keuangan ("halo", "tes", "siapa kamu"):
     -> AKSI: "chat"

STATUS DRAFT SAAT INI:
${currentDraft ? JSON.stringify(currentDraft) : 'Tidak ada draft transaksi yang sedang menunggu konfirmasi.'}

OUTPUT HARUS HANYA JSON MURNI TANPA MARKDOWN BACKTICKS, TANPA PENJELASAN DI LUAR JSON:
{
  "aksi": "konfirmasi_simpan" | "draft" | "batal" | "chat",
  "jawaban_teks": "Kalimat singkat dan ramah (tanpa bullet points redundant)",
  "transaksi": {
    "tipe": "pengeluaran" | "pemasukan",
    "toko": "Nama Toko / Sumber Uang (misal: 'Kantor', 'Klien', 'Kopi Kenangan')",
    "tanggal": "${todayStr}",
    "waktu": "${timeStr}",
    "kategori": "Makanan & Minuman | Belanja Harian | Bahan Baku | Operasional | Transportasi | Utilitas & Tagihan | Elektronik & Alat | Gaji & Upah | Penjualan Produk | Lainnya",
    "dompet": "Nama dompet yang digunakan (pilih dari: ${dompetNames})",
    "metode_bayar": "Tunai | QRIS | Transfer | Kartu Debit | Kartu Kredit",
    "subtotal": 0,
    "pajak": 0,
    "diskon": 0,
    "total": 0,
    "catatan": "keterangan transaksi",
    "gambar_url": ${image ? '"ada_gambar"' : 'null'},
    "items": [
      { "nama_barang": "Nama barang atau sumber", "qty": 1, "harga_satuan": 0, "subtotal": 0 }
    ]
  }
}`;

		const messages = [{ role: 'system', content: systemPrompt }];

		if (Array.isArray(history)) {
			for (const h of history.slice(-6)) {
				const textContent = typeof h?.content === 'string' ? h.content.trim() : '';
				if (!textContent) continue;
				messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: textContent });
			}
		}

		if (image) {
			messages.push({
				role: 'user',
				content: [
					{ type: 'text', text: pesan ? pesan : 'Tolong analisis foto nota ini dan buatkan rincian transaksi.' },
					{ type: 'image_url', image_url: { url: image } }
				]
			});
		} else {
			messages.push({
				role: 'user',
				content: pesan
			});
		}

		const response = await fetch('https://api.deepseek.com/chat/completions', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: image ? (config.DEEPSEEK_VISION_MODEL || 'deepseek-flash') : (config.DEEPSEEK_MODEL || 'deepseek-flash'),
				messages,
				temperature: 0.1
			})
		});

		if (!response.ok) {
			const errText = await response.text();
			return json({ error: `Gagal memproses ke DeepSeek (${response.status}): ${errText.slice(0, 200)}` }, { status: 502 });
		}

		const data = await response.json();
		let rawContent = data.choices?.[0]?.message?.content?.trim() || '';
		rawContent = rawContent.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

		let parsed;
		try {
			parsed = JSON.parse(rawContent);
		} catch (e) {
			const first = rawContent.indexOf('{');
			const last = rawContent.lastIndexOf('}');
			if (first !== -1 && last !== -1) {
				parsed = JSON.parse(rawContent.substring(first, last + 1));
			} else {
				parsed = {
					aksi: 'chat',
					jawaban_teks: rawContent,
					transaksi: null
				};
			}
		}

		if (image && parsed.transaksi) {
			parsed.transaksi.gambar_url = image;
		} else if (currentDraft?.gambar_url && parsed.transaksi && !parsed.transaksi.gambar_url) {
			parsed.transaksi.gambar_url = currentDraft.gambar_url;
		}

		let savedId = null;
		if (parsed.aksi === 'konfirmasi_simpan' && parsed.transaksi) {
			const t = parsed.transaksi;
			const grandTotal = t.total > 0 ? t.total : Math.max(0, (Number(t.subtotal) || 0) + (Number(t.pajak) || 0) - (Number(t.diskon) || 0));

			const dompetName = t.dompet || t.metode_bayar || 'Tunai';
			let matchedDompetId = null;
			const matched = userDompet.find((d) => d.nama.toLowerCase() === dompetName.toLowerCase());
			if (matched) {
				matchedDompetId = matched.id;
			} else if (userDompet.length > 0) {
				const fallback = userDompet.find((d) => d.tipe === 'cash') || userDompet[0];
				matchedDompetId = fallback?.id || null;
			}

			const encToko = encrypt(t.toko || '');
			const encCatatan = encrypt(t.catatan || '');
			const encGambarUrl = t.gambar_url ? encrypt(t.gambar_url) : null;

			const [saved] = await sql`
				INSERT INTO transaksi (
					user_id, tipe, toko, tanggal, waktu, kategori, metode_bayar, dompet, dompet_id,
					subtotal, pajak, diskon, total, gambar_url, catatan
				) VALUES (
					${user.id}, ${t.tipe || 'pengeluaran'}, ${encToko}, ${t.tanggal || todayStr}::date, 
					${t.waktu || timeStr}::time, ${t.kategori || 'Lainnya'}, ${t.metode_bayar || dompetName},
					${dompetName}, ${matchedDompetId},
					${t.subtotal || grandTotal}, ${t.pajak || 0}, ${t.diskon || 0}, ${grandTotal}, 
					${encGambarUrl}, ${encCatatan}
				) RETURNING id
			`;
			savedId = saved.id;

			if (Array.isArray(t.items) && t.items.length > 0) {
				for (const itm of t.items) {
					if (!itm.nama_barang) continue;
					const qty = Number(itm.qty) || 1;
					const harga = Number(itm.harga_satuan) || 0;
					const sub = Number(itm.subtotal) || (qty * harga);
					const encNamaBarang = encrypt(itm.nama_barang);
					await sql`
						INSERT INTO transaksi_item (
							transaksi_id, nama_barang, qty, harga_satuan, subtotal
						) VALUES (
							${saved.id}, ${encNamaBarang}, ${qty}, ${harga}, ${sub}
						)
					`;
				}
			}
		}

		let updatedCount = currentCount;
		if (!isPro) {
			updatedCount = currentCount + 1;
			await sql`
				UPDATE users
				SET chat_count_today = ${updatedCount},
				    chat_date_today = ${todayStr}::date
				WHERE id = ${user.id}
			`;
		}

		return json({
			success: true,
			tier: isPro ? 'pro' : 'free',
			is_pro: isPro,
			sisa_kuota: isPro ? 999999 : Math.max(0, 5 - updatedCount),
			chat_count_today: updatedCount,
			aksi: parsed.aksi,
			jawaban_teks: parsed.jawaban_teks,
			transaksi: parsed.transaksi,
			savedId
		});
	} catch (err) {
		console.error('Error POST /api/chat-catat:', err);
		return json({ error: err.message || 'Terjadi kesalahan saat memproses chat' }, { status: 500 });
	}
}
