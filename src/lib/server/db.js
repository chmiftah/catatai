import { neon } from '@neondatabase/serverless';
import { config } from '#lib/server/config.js';

let sql;
let ready;

export async function getDb() {
	if (!sql) {
		const dbUrl = (config.DATABASE_URL || config.DATABASE_URL_POOLED || config.POSTGRES_URL || '').trim();
		if (!dbUrl) {
			throw new Error('DATABASE_URL tidak ditemukan di file .env');
		}
		sql = neon(dbUrl);
	}

	ready ??= (async () => {
		// Tabel Pengguna (Multi-User Auth)
		await sql`create table if not exists users (
			id serial primary key,
			email text unique not null,
			nama text not null,
			password_hash text not null,
			session_token text,
			dibuat timestamptz not null default now()
		)`;
		await sql`create index if not exists idx_users_email on users (lower(email))`;
		await sql`create index if not exists idx_users_session_token on users (session_token)`;

		// Tabel Transaksi Utama
		await sql`create table if not exists transaksi (
			id serial primary key,
			user_id int references users(id) on delete cascade,
			tipe text not null default 'pengeluaran',
			toko text not null default '',
			tanggal date not null default current_date,
			waktu time not null default current_time,
			kategori text not null default 'Lainnya',
			metode_bayar text not null default 'Tunai',
			subtotal numeric(14, 2) not null default 0,
			pajak numeric(14, 2) not null default 0,
			diskon numeric(14, 2) not null default 0,
			total numeric(14, 2) not null default 0,
			gambar_url text,
			catatan text default '',
			dibuat timestamptz not null default now()
		)`;

		// Migrasi: Tambah kolom user_id jika tabel transaksi sudah ada dari versi sebelumnya
		await sql`alter table transaksi add column if not exists user_id int references users(id) on delete cascade`;

		// Tabel Item / Rincian Barang
		await sql`create table if not exists transaksi_item (
			id serial primary key,
			transaksi_id int not null references transaksi(id) on delete cascade,
			nama_barang text not null,
			qty numeric(10, 2) not null default 1,
			harga_satuan numeric(14, 2) not null default 0,
			subtotal numeric(14, 2) not null default 0
		)`;

		// Index untuk performa query terisolasi per user
		await sql`create index if not exists idx_transaksi_user_id on transaksi (user_id)`;
		await sql`create index if not exists idx_transaksi_tanggal on transaksi (tanggal desc)`;
		await sql`create index if not exists idx_transaksi_item_transaksi_id on transaksi_item (transaksi_id)`;
	})().catch((e) => {
		ready = undefined;
		throw e;
	});

	await ready;
	return sql;
}
