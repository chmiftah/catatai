import fs from 'node:fs';
import path from 'node:path';

function loadEnv() {
	const vars = { ...process.env };
	const candidates = [
		path.resolve(process.cwd(), '.env'),
		path.resolve(process.cwd(), '../CatatAi/.env'),
		'/Users/user/development/CatatAi/.env'
	];

	for (const p of candidates) {
		if (fs.existsSync(p)) {
			try {
				const content = fs.readFileSync(p, 'utf8');
				for (const line of content.split('\n')) {
					const trimmed = line.trim();
					if (!trimmed || trimmed.startsWith('#')) continue;
					const eq = trimmed.indexOf('=');
					if (eq !== -1) {
						const key = trimmed.slice(0, eq).trim();
						let val = trimmed.slice(eq + 1).trim();
						if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
							val = val.slice(1, -1);
						}
						if (!vars[key]) {
							vars[key] = val;
						}
					}
				}
				break;
			} catch (e) {
				console.error('Gagal membaca env di', p, e);
			}
		}
	}
	return vars;
}

export const config = loadEnv();
