#!/usr/bin/env python3
"""Tính lãi mỗi đơn, ROAS/ROI hoà vốn, hoặc lợi nhuận một kỳ.

Chế độ 1 - một sản phẩm:
    python3 tinh_hoa_von.py --gia 191000 --von 120000 --phi 15 [--dong-goi 3000] [--roas 4.9]

Chế độ 2 - lợi nhuận cả kỳ:
    python3 tinh_hoa_von.py --doanh-so 1584000 --gia-von-tong 960000 --phi 15 --ads 392015

--phi là phần trăm phí sàn trên giá bán (tổng phí cố định, thanh toán, freeship, voucher...).
"""

import argparse


def vnd(x):
    return f"{x:,.0f}đ".replace(",", ".")


def pct(x):
    return f"{x * 100:.1f}%".replace(".", ",")


def num(x):
    return f"{x:.2f}".replace(".", ",")


def mot_san_pham(a):
    phi = a.gia * a.phi / 100
    lai = a.gia - a.von - phi - a.dong_goi
    print(f"Giá bán:            {vnd(a.gia)}")
    print(f"Giá vốn:            {vnd(a.von)}")
    print(f"Phí sàn {a.phi:g}%:        {vnd(phi)}")
    if a.dong_goi:
        print(f"Đóng gói:           {vnd(a.dong_goi)}")
    print(f"Lãi sau phí:        {vnd(lai)} ({pct(lai / a.gia)} giá bán)")
    if lai <= 0:
        print("Lỗ ngay cả khi không chạy ads - không nên chạy quảng cáo ở giá này.")
        return
    hoa_von = a.gia / lai
    print(f"ROAS/ROI hoà vốn:   {num(hoa_von)}")
    print(f"ROAS gợi ý:         {num(hoa_von + 1)} - {num(hoa_von + 1.5)}")
    print(f"Chi ads tối đa/đơn: {vnd(lai)} (vượt mức này là lỗ)")
    if a.roas:
        ads = a.gia / a.roas
        print(f"Ở ROAS {num(a.roas)}: chi ads/đơn {vnd(ads)}, lãi/đơn {vnd(lai - ads)} ({pct((lai - ads) / a.gia)})")


def ca_ky(a):
    phi = a.doanh_so * a.phi / 100
    lai_gop = a.doanh_so - a.gia_von_tong
    loi_nhuan = lai_gop - phi - a.ads
    bien_sau_phi = (lai_gop - phi) / a.doanh_so
    print(f"Doanh số:           {vnd(a.doanh_so)}")
    print(f"Giá vốn:            -{vnd(a.gia_von_tong)}")
    print(f"Phí sàn {a.phi:g}%:        -{vnd(phi)}")
    print(f"Chi phí ads:        -{vnd(a.ads)} ({pct(a.ads / a.doanh_so)} doanh số)")
    print(f"Lợi nhuận:          {vnd(loi_nhuan)}")
    print(f"Biên sau phí TB:    {pct(bien_sau_phi)}")
    if bien_sau_phi > 0:
        print(f"ROAS hoà vốn TB:    {num(1 / bien_sau_phi)}")
    if a.ads:
        # Khác ROAS trên báo cáo ads (chỉ tính doanh số do ads mang về).
        print(f"Doanh số tổng / ads: {num(a.doanh_so / a.ads)} (không phải ROAS của ads)")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--gia", type=float)
    p.add_argument("--von", type=float)
    p.add_argument("--dong-goi", type=float, default=0)
    p.add_argument("--roas", type=float, help="Xem lãi/đơn ở một mức ROAS cụ thể")
    p.add_argument("--doanh-so", type=float)
    p.add_argument("--gia-von-tong", type=float)
    p.add_argument("--ads", type=float, default=0)
    p.add_argument("--phi", type=float, default=15, help="Phí sàn %% giá bán (mặc định 15 - là giả định)")
    a = p.parse_args()

    if a.gia is not None and a.von is not None:
        mot_san_pham(a)
    elif a.doanh_so is not None and a.gia_von_tong is not None:
        ca_ky(a)
    else:
        p.error("Cần --gia và --von, hoặc --doanh-so và --gia-von-tong")


if __name__ == "__main__":
    main()
