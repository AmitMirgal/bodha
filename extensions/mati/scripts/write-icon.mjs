import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 128;
const INK = [13, 13, 15, 255];
const LIME = [198, 255, 61, 255];

function crcTable() {
	const table = new Uint32Array(256);
	for (let i = 0; i < 256; i += 1) {
		let c = i;
		for (let k = 0; k < 8; k += 1) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[i] = c;
	}
	return table;
}

const CRC_TABLE = crcTable();

function crc32(buffer) {
	let crc = 0xffffffff;
	for (let i = 0; i < buffer.length; i += 1) {
		crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const typeBuf = Buffer.from(type);
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const crcBuf = Buffer.alloc(4);
	crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
	return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function setPixel(pixels, x, y, color) {
	if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) {
		return;
	}
	const i = (y * SIZE + x) * 4;
	pixels[i] = color[0];
	pixels[i + 1] = color[1];
	pixels[i + 2] = color[2];
	pixels[i + 3] = color[3];
}

function fillRect(pixels, x0, y0, x1, y1, color) {
	const minX = Math.min(x0, x1);
	const maxX = Math.max(x0, x1);
	const minY = Math.min(y0, y1);
	const maxY = Math.max(y0, y1);
	for (let y = minY; y <= maxY; y += 1) {
		for (let x = minX; x <= maxX; x += 1) {
			setPixel(pixels, x, y, color);
		}
	}
}

function inRoundRect(x, y, radius) {
	const inset = 6;
	const left = inset + radius;
	const right = SIZE - 1 - inset - radius;
	const top = inset + radius;
	const bottom = SIZE - 1 - inset - radius;
	if (x >= left && x <= right && y >= inset && y <= SIZE - 1 - inset) {
		return true;
	}
	if (y >= top && y <= bottom && x >= inset && x <= SIZE - 1 - inset) {
		return true;
	}
	const corners = [
		[left, top],
		[right, top],
		[left, bottom],
		[right, bottom],
	];
	return corners.some(([cx, cy]) => {
		const dx = x - cx;
		const dy = y - cy;
		return dx * dx + dy * dy <= radius * radius;
	});
}

function fillSlash(pixels, originX, originY, color) {
	for (let i = 0; i < 52; i += 1) {
		const x = originX + Math.round(i * 0.55);
		const y = originY + 48 - i;
		fillRect(pixels, x, y, x + 10, y + 3, color);
	}
}

const pixels = Buffer.alloc(SIZE * SIZE * 4, 0);
for (let y = 0; y < SIZE; y += 1) {
	for (let x = 0; x < SIZE; x += 1) {
		if (inRoundRect(x, y, 22)) {
			setPixel(pixels, x, y, INK);
		}
	}
}
fillSlash(pixels, 28, 34, LIME);
fillSlash(pixels, 52, 34, LIME);

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y += 1) {
	raw[y * (SIZE * 4 + 1)] = 0;
	pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
	Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
	chunk("IHDR", ihdr),
	chunk("IDAT", deflateSync(raw, { level: 9 })),
	chunk("IEND", Buffer.alloc(0)),
]);

const out = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
	"media",
	"icon.png"
);
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, png);
process.stdout.write(`${out} ${png.length} bytes\n`);
