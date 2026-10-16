import { json } from '@sveltejs/kit';
import { config } from '#lib/server/config.js';
import { getDb } from '#lib/server/db.js';
import { getAuthUser } from '#lib/server/auth.js';
import { encrypt, decryptTransaction } from '#lib/server/crypto.js';

function formatRupiah(num) {
	return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

async function insertTransaksiRecord(sql, user, userDompet, t, todayStr, timeStr) {
	const numSubtotal = Number(t.subtotal) || 0;
	const numPajak = Number(t.pajak) || 0;
	const numDiskon = Number(t.diskon) || 0;
	const grandTotal = Number(t.total) > 0 ? Number(t.total) : Math.max(0, numSubtotal + numPajak - numDiskon);

	const dompetName = t.dompet || t.metode_bayar || 'Tunai';
	let matchedDompetId = null;
	const matched = userDompet.find((d) => d.nama.toLowerCase() === dompetName.toLowerCase());
	if (matched) {
		matchedDompetId = matched.id;
	} else if (userDompet.length > 0) {
		const fallback = userDompet.find((d) => d.tipe === 'cash') || userDompet[0];
		matchedDompetId = fallback?.id || null;
	}

	const safeTanggal = (t.tanggal && typeof t.tanggal === 'string' && t.tanggal.trim())
		? t.tanggal.trim().slice(0, 10)
		: todayStr;
	const safeWaktu = (t.waktu && typeof t.waktu === 'string' && t.waktu.trim())
		? t.waktu.trim().slice(0, 8)
		: timeStr;

	const encToko = encrypt(t.toko || '');
	const encCatatan = encrypt(t.catatan || '');
	const encGambarUrl = t.gambar_url ? encrypt(t.gambar_url) : null;

	const [saved] = await sql`
		INSERT INTO transaksi (
			user_id, tipe, toko, tanggal, waktu, kategori, metode_bayar, dompet, dompet_id,
			subtotal, pajak, diskon, total, gambar_url, catatan
		) VALUES (
			${user.id}, ${t.tipe || 'pengeluaran'}, ${encToko}, ${safeTanggal}::date, 
			${safeWaktu}::time, ${t.kategori || 'Lainnya'}, ${t.metode_bayar || dompetName},
			${dompetName}, ${matchedDompetId},
			${numSubtotal || grandTotal}, ${numPajak}, ${numDiskon}, ${grandTotal}, 
			${encGambarUrl}, ${encCatatan}
		) RETURNING id
	`;

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
	return saved.id;
}

async function updateTransaksiRecord(sql, user, userDompet, targetId, t, todayStr, timeStr) {
	const numSubtotal = Number(t.subtotal) || 0;
	const numPajak = Number(t.pajak) || 0;
	const numDiskon = Number(t.diskon) || 0;
	const grandTotal = Number(t.total) > 0 ? Number(t.total) : Math.max(0, numSubtotal + numPajak - numDiskon);

	const dompetName = t.dompet || t.metode_bayar || 'Tunai';
	let matchedDompetId = null;
	const matched = userDompet.find((d) => d.nama.toLowerCase() === dompetName.toLowerCase());
	if (matched) {
		matchedDompetId = matched.id;
	} else if (userDompet.length > 0) {
		const fallback = userDompet.find((d) => d.tipe === 'cash') || userDompet[0];
		matchedDompetId = fallback?.id || null;
	}

	const safeTanggal = (t.tanggal && typeof t.tanggal === 'string' && t.tanggal.trim())
		? t.tanggal.trim().slice(0, 10)
		: todayStr;
	const safeWaktu = (t.waktu && typeof t.waktu === 'string' && t.waktu.trim())
		? t.waktu.trim().slice(0, 8)
		: timeStr;

	const encToko = encrypt(t.toko || '');
	const encCatatan = encrypt(t.catatan || '');
	const encGambarUrl = t.gambar_url ? encrypt(t.gambar_url) : null;

	const [updated] = await sql`
		UPDATE transaksi
		SET tipe = ${t.tipe || 'pengeluaran'},
		    toko = ${encToko},
		    tanggal = ${safeTanggal}::date,
		    waktu = ${safeWaktu}::time,
		    kategori = ${t.kategori || 'Lainnya'},
		    metode_bayar = ${t.metode_bayar || dompetName},
		    dompet = ${dompetName},
		    dompet_id = ${matchedDompetId},
		    subtotal = ${numSubtotal || grandTotal},
		    pajak = ${numPajak},
		    diskon = ${numDiskon},
		    total = ${grandTotal},
		    gambar_url = COALESCE(${encGambarUrl}, gambar_url),
		    catatan = ${encCatatan}
		WHERE id = ${targetId} AND user_id = ${user.id}
		RETURNING id
	`;

	if (updated && Array.isArray(t.items) && t.items.length > 0) {
		await sql`DELETE FROM transaksi_item WHERE transaksi_id = ${targetId}`;
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
					${targetId}, ${encNamaBarang}, ${qty}, ${harga}, ${sub}
				)
			`;
		}
	}
	return updated?.id || null;
}

export async function POST({ request, cookies }) {
	try {
		const user = await getAuthUser(cookies);
		if (!user) {
			return json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
		}

		const {
			pesan = '',
			image = null,
			history = [],
			currentDraft = null,
			currentSplitData = null,
			splitAction = null,
			splitData = null
		} = await request.json();

		const today = new Date();
		const pad = (n) => String(n).padStart(2, '0');
		const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
		const timeStr = `${pad(today.getHours())}:${pad(today.getMinutes())}:00`;

		const sql = await getDb();
		const userDompet = await sql`SELECT id, nama, tipe FROM dompet WHERE user_id = ${user.id} ORDER BY id ASC`;
		const dompetNames = userDompet.length > 0 
			? userDompet.map((d) => d.nama).join(', ') 
			: 'Tunai, Rekening Bank, E-Wallet';

		const isPro = user.tier === 'pro';
		const isSameDay = String(user.chat_date_today || '').slice(0, 10) === todayStr;
		const currentCount = isSameDay ? (user.chat_count_today || 0) : 0;

		// JIKA SPLIT ACTION DIKIRIM LANGSUNG LEWAT TOMBOL
		if (splitAction === 'gabung' && splitData?.gabungan) {
			const savedId = await insertTransaksiRecord(sql, user, userDompet, splitData.gabungan, todayStr, timeStr);
			return json({
				success: true,
				tier: isPro ? 'pro' : 'free',
				is_pro: isPro,
				sisa_kuota: isPro ? 999999 : Math.max(0, 5 - currentCount),
				chat_count_today: currentCount,
				aksi: 'selesai_split_gabung',
				jawaban_teks: `Siap, ${user.nama}! 1 transaksi gabungan sebesar ${formatRupiah(splitData.gabungan.total)} berhasil disimpan ke rekap keuangan! 🎉`,
				transaksi: splitData.gabungan,
				savedId
			});
		}

		if (splitAction === 'pisah' && Array.isArray(splitData?.terpisah) && splitData.terpisah.length > 0) {
			const savedIds = [];
			for (const itm of splitData.terpisah) {
				const sId = await insertTransaksiRecord(sql, user, userDompet, itm, todayStr, timeStr);
				savedIds.push(sId);
			}
			return json({
				success: true,
				tier: isPro ? 'pro' : 'free',
				is_pro: isPro,
				sisa_kuota: isPro ? 999999 : Math.max(0, 5 - currentCount),
				chat_count_today: currentCount,
				aksi: 'selesai_split_pisah',
				jawaban_teks: `Siap, ${user.nama}! Sebanyak ${splitData.terpisah.length} transaksi berhasil dicatat terpisah ke rekap keuangan! 🎉`,
				listTransaksi: splitData.terpisah,
				savedIds
			});
		}

		// CEK TIER & KUOTA CHAT HARIAN
		if (!isPro && currentCount >= 5) {
			return json({
				error: 'Kuota chat gratis harian Anda telah mencapai batas maksimal (5/5 pesan). Upgrade ke CatatAi PRO untuk menikmati chat tanpa batas! ⭐',
				kuota_habis: true,
				tier: 'free',
				sisa_kuota: 0
			}, { status: 403 });
		}

		const apiKey = config.DEEPSEEK_API_KEY;
		if (!apiKey) {
			return json({ error: 'DEEPSEEK_API_KEY belum dikonfigurasi di file .env' }, { status: 500 });
		}

		// AMBIL DAFTAR TRANSAKSI TERAKHIR USER UNTUK PENGENALAN EDIT
		const rawRecent = await sql`
			SELECT id, tipe, toko, tanggal::text as tanggal, waktu::text as waktu, 
			       kategori, metode_bayar, dompet, total::float as total, catatan
			FROM transaksi
			WHERE user_id = ${user.id}
			ORDER BY tanggal DESC, dibuat DESC
			LIMIT 25
		`;
		const recentList = rawRecent.map(decryptTransaction).map((t) => ({
			id: t.id,
			tipe: t.tipe,
			toko: t.toko,
			tanggal: t.tanggal,
			waktu: t.waktu,
			total: t.total,
			kategori: t.kategori,
			dompet: t.dompet || t.metode_bayar || 'Tunai'
		}));

		const systemPrompt = `Kamu adalah CatatAi — asisten pintar pencatatan dan pengelolaan keuangan (PENGELUARAN & PEMASUKAN) dalam percakapan chat seperti WhatsApp.
Pengguna yang sedang kamu layani bernama: ${user.nama}.
Tanggal hari ini adalah: ${todayStr}, jam sekarang: ${timeStr}.
DAFTAR DOMPET PENGGUNA TERSEDIA: [${dompetNames}]

DAFTAR TRANSAKSI TERAKHIR MILIK PENGGUNA (Gunakan daftar ini untuk mengenali jika pengguna ingin MENGEDIT, MENGUBAH, atau MENGOREKSI transaksi yang sudah ada):
${JSON.stringify(recentList, null, 2)}

ATURAN UTAMA:
1. PENCATATAN TRANSAKSI TUNGGAL (TEKS / SUARA BIASA):
   - Jika pengguna menyebutkan pengeluaran atau pemasukan baru (misal: "beli kopi 18k", "makan siang 25rb tunai", "dapat gaji 10jt"):
     -> AKSI: "konfirmasi_simpan"
     -> Jawaban singkat ramah (1-2 kalimat): "Siap, ${user.nama}! [Pengeluaran / Pemasukan] [nama barang/toko] sebesar Rp [nominal] sudah langsung dicatat ke rekap keuangan! 🎉"

2. MENGEDIT / MENGUBAH / MENGOREKSI TRANSAKSI YANG SUDAH ADA:
   - Jika pengguna meminta MENGEDIT, MENGUBAH, atau MENGOREKSI transaksi yang sudah pernah dicatat (misalnya:
     "edit tgl transaksi kemarin jadi 15 september",
     "ubah tanggal transaksi tgl 16 september 2026 jadi tgl 15 september",
     "ubah transaksi abid jadi 15 september",
     "ganti nominal transaksi kopi kenangan jadi 25rb",
     "ubah kategori transaksi spbu jadi Operasional",
     "koreksi transaksi tadi, pakai transfer bca bukan tunai"):
   - CARI transaksi yang paling cocok di "DAFTAR TRANSAKSI TERAKHIR MILIK PENGGUNA" di atas berdasarkan toko/sumber, tanggal, atau nominal.
   - JANGAN PERNAH membuat transaksi baru (JANGAN pakai "konfirmasi_simpan")!
   - AKSI HARUS: "edit_transaksi"!
   - Wajib isi "target_id": <id angka dari transaksi yang ditemukan di daftar>.
   - Di objek "transaksi", sertakan data lengkap transaksi tersebut dengan perubahan yang diminta oleh pengguna (misal tanggal diubah menjadi "YYYY-MM-DD", nominal diubah, atau toko diubah).
   - Format tanggal harus selalu "YYYY-MM-DD" (contoh: "2026-09-15" untuk 15 September 2026).
   - Jawaban singkat: "Siap, ${user.nama}! Transaksi '[toko]' telah berhasil diperbarui [jelaskan perubahannya secara ringkas]! ✏️"
   - Jika transaksi yang dimaksud benar-benar tidak ditemukan di daftar transaksi terakhir, gunakan aksi "chat" dan jelaskan dengan sopan bahwa transaksi tersebut tidak ditemukan dalam 25 transaksi terakhir Anda.

3. DETEKSI BANYAK TRANSAKSI (FOTO LIST TRANSAKSI / DAFTAR ORANG & NOMINAL):
   - Jika gambar atau teks berisi DAFTAR BANYAK TRANSAKSI atau DAFTAR ORANG dengan nominal berbeda (misalnya catatan kasbon, list order, atau daftar seperti:
     "1 abid 2000
      2. yusuf 3000"):
   - JANGAN LANGSUNG SIMPAN sepihak!
   - AKSI: "tanya_split"!
   - Sediakan objek "split_data" berisi:
     - "total_keseluruhan": total angka dari semua entri (misal: 5000)
     - "jumlah_transaksi": jumlah entri yang terdeteksi (misal: 2)
     - "gabungan": satu objek transaksi gabungan (toko: "Daftar Transaksi", total: 5000, items: [{nama_barang: "Abid", qty: 1, harga_satuan: 2000, subtotal: 2000}, {nama_barang: "Yusuf", qty: 1, harga_satuan: 3000, subtotal: 3000}])
     - "terpisah": array berisi masing-masing transaksi secara mandiri ([{toko: "Abid", total: 2000, ...}, {toko: "Yusuf", total: 3000, ...}])
   - Jawaban singkat: "Saya menemukan [X] transaksi dalam catatan ini: [Sebutkan nama dan nominal]. Mau dicatat sebagai 1 transaksi gabungan (Rp [total]) atau dipisah menjadi [X] transaksi tersendiri?"

4. RESPON DARI PERTANYAAN SPLIT TRANSAKSI:
   - Jika pesan sebelumnya adalah pertanyaan split (apakah mau digabung atau dipisah), dan pengguna menjawab "gabung", "jadikan satu", "1 transaksi", "satukan":
     -> AKSI: "pilih_split_gabung"
   - Jika pengguna menjawab "pisah", "pisahkan", "per transaksi", "sendiri-sendiri", "beda transaksi":
     -> AKSI: "pilih_split_pisah"

5. EKSTRAKSI FOTO NOTA BELANJA BIASA (1 STRUK):
   - Jika foto adalah struk/nota belanja normal (misal struk minimarket, kafe, SPBU):
     -> AKSI: "draft"
     -> Jawaban singkat: "Siap, ${user.nama}! Nota belanja sudah saya ekstrak lengkap. Cek drafnya ya, kalau sudah pas tinggal bilang 'simpan'."

6. KONFIRMASI DRAFT BIASA:
   - Jika pengguna merespons konfirmasi draft ("ya", "ok", "betul", "simpan", "oke"):
     -> AKSI: "konfirmasi_simpan"

7. BATAL:
   - Jika pengguna membatalkan draf atau pertanyaan split ("batal", "jangan", "ga jadi"):
     -> AKSI: "batal"

STATUS DRAFT SAAT INI:
${currentDraft ? JSON.stringify(currentDraft) : 'Tidak ada draft transaksi yang sedang menunggu konfirmasi.'}

STATUS PILIHAN SPLIT SAAT INI:
${currentSplitData ? JSON.stringify(currentSplitData) : 'Tidak ada pertanyaan split yang sedang menunggu konfirmasi.'}

OUTPUT HARUS HANYA JSON MURNI TANPA MARKDOWN BACKTICKS, TANPA PENJELASAN DI LUAR JSON:
{
  "aksi": "konfirmasi_simpan" | "edit_transaksi" | "tanya_split" | "pilih_split_gabung" | "pilih_split_pisah" | "draft" | "batal" | "chat",
  "target_id": null,
  "jawaban_teks": "Kalimat singkat dan ramah",
  "transaksi": {
    "id": null,
    "tipe": "pengeluaran" | "pemasukan",
    "toko": "Nama Toko / Sumber",
    "tanggal": "${todayStr}",
    "waktu": "${timeStr}",
    "kategori": "Makanan & Minuman | Belanja Harian | Bahan Baku | Operasional | Transportasi | Utilitas & Tagihan | Elektronik & Alat | Gaji & Upah | Penjualan Produk | Lainnya",
    "dompet": "Nama dompet",
    "metode_bayar": "Tunai | QRIS | Transfer | Kartu Debit | Kartu Kredit",
    "subtotal": 0,
    "pajak": 0,
    "diskon": 0,
    "total": 0,
    "catatan": "catatan",
    "gambar_url": ${image ? '"ada_gambar"' : 'null'},
    "items": []
  },
  "split_data": null
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
					{ type: 'text', text: pesan ? pesan : 'Tolong analisis foto ini dan catat transaksinya.' },
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
		let savedIds = [];

		// EKSEKUSI EDIT TRANSAKSI
		if (parsed.aksi === 'edit_transaksi' && (parsed.target_id || parsed.transaksi?.id)) {
			const targetId = Number(parsed.target_id || parsed.transaksi.id);
			const updatedId = await updateTransaksiRecord(sql, user, userDompet, targetId, parsed.transaksi, todayStr, timeStr);
			if (updatedId) {
				savedId = updatedId;
				parsed.transaksi.id = updatedId;
			}
		}
		// EKSEKUSI PILIHAN SPLIT GABUNG
		else if (parsed.aksi === 'pilih_split_gabung' && (currentSplitData?.gabungan || parsed.transaksi)) {
			const targetTrx = currentSplitData?.gabungan || parsed.transaksi;
			savedId = await insertTransaksiRecord(sql, user, userDompet, targetTrx, todayStr, timeStr);
			parsed.transaksi = targetTrx;
			parsed.transaksi.id = savedId;
		}
		// EKSEKUSI PILIHAN SPLIT PISAH
		else if (parsed.aksi === 'pilih_split_pisah' && (Array.isArray(currentSplitData?.terpisah) || Array.isArray(parsed.list_transaksi))) {
			const list = currentSplitData?.terpisah || parsed.list_transaksi;
			for (const itm of list) {
				const sId = await insertTransaksiRecord(sql, user, userDompet, itm, todayStr, timeStr);
				savedIds.push(sId);
			}
		}
		// EKSEKUSI SIMPAN NORMAL
		else if (parsed.aksi === 'konfirmasi_simpan' && parsed.transaksi) {
			savedId = await insertTransaksiRecord(sql, user, userDompet, parsed.transaksi, todayStr, timeStr);
			parsed.transaksi.id = savedId;
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
			split_data: parsed.split_data || null,
			savedId,
			savedIds
		});
	} catch (err) {
		console.error('Error POST /api/chat-catat:', err);
		return json({ error: err.message || 'Terjadi kesalahan saat memproses chat' }, { status: 500 });
	}
}
