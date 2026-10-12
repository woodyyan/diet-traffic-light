import zlib, struct, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")
BARS = [(99, 153, 34), (239, 159, 39), (226, 75, 74)]  # 绿 黄 红


def rounded_rect(px, size, x0, y0, x1, y1, r, color):
    for y in range(max(0, int(y0)), min(size, int(y1))):
        for x in range(max(0, int(x0)), min(size, int(x1))):
            dx, dy = 0, 0
            if x < x0 + r and y < y0 + r:
                dx, dy = x0 + r - x, y0 + r - y
            elif x > x1 - r and y < y0 + r:
                dx, dy = x - (x1 - r), y0 + r - y
            elif x < x0 + r and y > y1 - r:
                dx, dy = x0 + r - x, y - (y1 - r)
            elif x > x1 - r and y > y1 - r:
                dx, dy = x - (x1 - r), y - (y1 - r)
            if dx * dx + dy * dy <= r * r:
                for c in range(4):
                    px[(y * size + x) * 4 + c] = color[c]


def png(path, size):
    px = bytearray(size * size * 4)
    for i in range(size * size):
        px[i * 4:i * 4 + 4] = bytes([255, 255, 255, 255])
    pad = size * 0.17
    gap = size * 0.055
    h = (size - 2 * pad - 2 * gap) / 3.0
    for i, col in enumerate(BARS):
        y0 = pad + i * (h + gap)
        rounded_rect(px, size, pad, y0, size - pad, y0 + h, h * 0.45, (col[0], col[1], col[2], 255))
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        raw += px[y * size * 4:(y + 1) * size * 4]
    comp = zlib.compress(bytes(raw), 9)

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    out = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", comp) + chunk(b"IEND", b"")
    open(path, "wb").write(out)
    print("wrote", path, size)


for s in (180, 192, 512):
    png(os.path.join(OUT, "icon-%d.png" % s), s)
