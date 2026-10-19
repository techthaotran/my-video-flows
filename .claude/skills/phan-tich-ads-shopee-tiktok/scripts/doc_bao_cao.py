#!/usr/bin/env python3
"""Đọc file báo cáo Shopee / TikTok (.xlsx, .csv) và in ra dạng bảng chữ.

Không cần thư viện ngoài (đọc .xlsx bằng zipfile + XML).
Chạy với `python3 -I` và truyền đường dẫn làm tham số.

Ví dụ:
    python3 -I doc_bao_cao.py bao-cao.xlsx
    python3 -I doc_bao_cao.py bao-cao.xlsx --sheet 4 --max-rows 50
    python3 -I doc_bao_cao.py ads.csv
"""

import argparse
import csv
import io
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def col_index(ref):
    letters = re.match(r"[A-Z]+", ref).group()
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n


def text_of(node):
    return "".join(t.text or "" for t in node.iter(NS + "t"))


def read_xlsx(path):
    """Trả về danh sách (tên sheet, các dòng)."""
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        shared = []
        if "xl/sharedStrings.xml" in names:
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            shared = [text_of(si) for si in root.findall(NS + "si")]

        rels = {}
        if "xl/_rels/workbook.xml.rels" in names:
            for rel in ET.fromstring(z.read("xl/_rels/workbook.xml.rels")):
                rels[rel.get("Id")] = rel.get("Target")

        workbook = ET.fromstring(z.read("xl/workbook.xml"))
        sheets = []
        for i, sheet in enumerate(workbook.find(NS + "sheets"), 1):
            target = rels.get(sheet.get(REL_NS + "id"), f"worksheets/sheet{i}.xml")
            target = target.lstrip("/")
            if not target.startswith("xl/"):
                target = "xl/" + target
            rows = []
            for row in ET.fromstring(z.read(target)).iter(NS + "row"):
                cells = {}
                for c in row.findall(NS + "c"):
                    v = c.find(NS + "v")
                    if v is None:
                        inline = c.find(NS + "is")
                        val = text_of(inline) if inline is not None else ""
                    elif c.get("t") == "s":
                        val = shared[int(v.text)]
                    else:
                        val = v.text or ""
                    cells[col_index(c.get("r"))] = val
                if cells:
                    rows.append([cells.get(k, "") for k in range(1, max(cells) + 1)])
            sheets.append((sheet.get("name"), rows))
        return sheets


def read_csv(path):
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "utf-16", "cp1258", "latin-1"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    rows = list(csv.reader(io.StringIO(text)))
    return [("csv", [r for r in rows if any(cell.strip() for cell in r)])]


def print_sheet(index, name, rows, max_rows, max_width):
    print(f"### Sheet {index}: {name} ({len(rows)} dòng)")
    for row in rows[:max_rows]:
        line = " | ".join(cell.strip() for cell in row)
        if max_width and len(line) > max_width:
            line = line[:max_width] + " …"
        print(line)
    if len(rows) > max_rows:
        print(f"... còn {len(rows) - max_rows} dòng, tăng --max-rows để xem tiếp")
    print()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("path")
    parser.add_argument("--sheet", type=int, help="Chỉ in sheet thứ N (bắt đầu từ 1)")
    parser.add_argument("--list", action="store_true", help="Chỉ liệt kê tên sheet và số dòng")
    parser.add_argument("--max-rows", type=int, default=80)
    parser.add_argument("--max-width", type=int, default=0, help="Cắt mỗi dòng còn N ký tự (0 = không cắt)")
    args = parser.parse_args()

    if args.path.lower().endswith((".xlsx", ".xlsm")):
        sheets = read_xlsx(args.path)
    elif args.path.lower().endswith((".csv", ".tsv", ".txt")):
        sheets = read_csv(args.path)
    else:
        sys.exit("Chỉ hỗ trợ .xlsx, .xlsm, .csv")

    if args.list:
        for i, (name, rows) in enumerate(sheets, 1):
            print(f"{i}. {name} - {len(rows)} dòng")
        return

    for i, (name, rows) in enumerate(sheets, 1):
        if args.sheet and i != args.sheet:
            continue
        print_sheet(i, name, rows, args.max_rows, args.max_width)


if __name__ == "__main__":
    main()
