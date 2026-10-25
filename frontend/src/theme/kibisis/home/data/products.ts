export type KibisisProduct = {
  id: string
  handle?: string
  variantId?: string
  name: string
  title: string
  price: number
  oldPrice?: number
  image: string
  imageAlt: string
  badge: string
  badgeClass: string
  rating: string
  reviews: string
  note: string
  noteClass: string
}

export const popularProducts: KibisisProduct[] = [
  {
    id: "p1",
    name: "Baby Me Aleoveralı Islak Mendil",
    title: "Baby Me Aleoveralı Temizleme Mendili 3*50 Yaprak Günlük Bakım",
    price: 64.19,
    image:
      "https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=400&q=80",
    imageAlt: "Islak Mendil",
    badge: "AVANTAJLI",
    badgeClass: "bg-orange-500",
    rating: "4.5",
    reviews: "348",
    note: "2. Ürüne %50 İndirim",
    noteClass: "text-emerald-600",
    oldPrice: 67.19,
  },
  {
    id: "p2",
    name: "BIC Kids Pastel Boya 24 Renk",
    title: "BIC Kids Plastidecor Silinebilir Pastel Boya 24 Renk Seti",
    price: 148,
    image:
      "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=400&q=80",
    imageAlt: "Pastel Boya",
    badge: "AVANTAJLI",
    badgeClass: "bg-orange-500",
    rating: "4.7",
    reviews: "2.041",
    note: "Peşin fiyatına 3 x 49 TL",
    noteClass: "text-indigo-600",
  },
  {
    id: "p3",
    name: "Ensholl Akü Takviye Cihazı 12.000 mAh",
    title:
      "Ensholl Akü Takviye Cihazı 12.000 mAh Powerbank Özellikli Çanta Kiti",
    price: 1989.88,
    image:
      "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=400&q=80",
    imageAlt: "Akü Takviye",
    badge: "12000 mAh",
    badgeClass: "bg-amber-500",
    rating: "4.7",
    reviews: "188",
    note: "Peşin fiyatına 3 x 663 TL",
    noteClass: "text-indigo-600",
    oldPrice: 2249.1,
  },
  {
    id: "p4",
    name: "iselahome Cleara Organizer Duvar Rafı",
    title:
      "iselahome Cleara Multi Organizer Yapışkanlı Duvar Rafı Mutfak/Banyo",
    price: 399.5,
    image:
      "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80",
    imageAlt: "Duvar Rafı",
    badge: "KOLAY MONTAJ",
    badgeClass: "bg-teal-600",
    rating: "3.7",
    reviews: "7",
    note: "Peşin fiyatına 3 x 133 TL",
    noteClass: "text-indigo-600",
    oldPrice: 470.15,
  },
  {
    id: "p5",
    name: "Wohler Pilli Diş Fırçası",
    title: "Wohler Pilli Diş Fırçası Değiştirilebilir Başlık FDA Onaylı",
    price: 399,
    image:
      "https://images.unsplash.com/photo-1559591937-e1032b4ea7ba?auto=format&fit=crop&w=400&q=80",
    imageAlt: "Diş Fırçası",
    badge: "PİLLİ DİŞ FIRÇASI",
    badgeClass: "bg-blue-600",
    rating: "4.2",
    reviews: "50",
    note: "Peşin fiyatına 3 x 133 TL",
    noteClass: "text-indigo-600",
    oldPrice: 499,
  },
]

export const advantageousProducts: KibisisProduct[] = [
  {
    id: "adv1",
    name: "Wefood Hindistan Cevizi Yağı 150ml",
    title: "Wefood Organik Hindistan Cevizi Yağı 150 ml (Soğuk Sıkım Naturel)",
    price: 288.75,
    image:
      "https://images.unsplash.com/photo-1608248597359-009772c2199b?auto=format&fit=crop&w=400&q=80",
    imageAlt: "Hindistan Cevizi Yağı",
    badge: "150 ML ORGANİK",
    badgeClass: "bg-emerald-600",
    rating: "4.4",
    reviews: "4.116",
    note: "Peşin fiyatına 3 x 96 TL",
    noteClass: "text-indigo-600",
    oldPrice: 481.25,
  },
  {
    id: "adv2",
    name: "Kumtel 2000W Fanlı Isıtıcı",
    title: "Kumtel LX-6331 2000 W Fanlı Isıtıcı Güvenlik Emniyetli",
    price: 879,
    image:
      "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80",
    imageAlt: "Isıtıcı",
    badge: "2000 WATT",
    badgeClass: "bg-orange-600",
    rating: "4.2",
    reviews: "22.653",
    note: "Peşin fiyatına 3 x 293 TL",
    noteClass: "text-indigo-600",
  },
  {
    id: "adv3",
    name: "Kiperin One Kolajen Peptitler",
    title:
      "Kiperin One | Tek Hidrolize Kolajen Peptitler | Biotin & Hyaluronik Asit",
    price: 350,
    image:
      "https://images.unsplash.com/photo-1577401239170-897942555fb3?auto=format&fit=crop&w=400&q=80",
    imageAlt: "Kolajen",
    badge: "KOLAJEN ONE",
    badgeClass: "bg-rose-600",
    rating: "4.4",
    reviews: "128",
    note: "3 Al 2 Öde Kampanyası",
    noteClass: "text-rose-600",
    oldPrice: 500,
  },
  {
    id: "adv4",
    name: "Wefood Ham Kakao Tozu 140gr",
    title: "Wefood Ham Kakao Tozu 140 gr Glutensiz Katkısız Süper Gıda",
    price: 303.19,
    image:
      "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=400&q=80",
    imageAlt: "Kakao",
    badge: "HAM KAKAO",
    badgeClass: "bg-amber-800",
    rating: "4.7",
    reviews: "630",
    note: "Peşin fiyatına 3 x 101 TL",
    noteClass: "text-indigo-600",
    oldPrice: 505.31,
  },
]
