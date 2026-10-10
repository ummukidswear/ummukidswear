// Reference data lokal ringan: Provinsi → Kota/Kabupaten Indonesia. Dipakai bersama oleh
// Pelanggan & Supplier (searchable picker, tanpa free-text/GPS). Data lama yang tidak ada
// di daftar tetap ditampilkan sebagai opsi tambahan agar riwayat aman.
const RAW: Record<string, string> = {
  "Aceh": "Banda Aceh|Langsa|Lhokseumawe|Sabang|Subulussalam|Aceh Barat|Aceh Barat Daya|Aceh Besar|Aceh Jaya|Aceh Selatan|Aceh Singkil|Aceh Tamiang|Aceh Tengah|Aceh Tenggara|Aceh Timur|Aceh Utara|Bener Meriah|Bireuen|Gayo Lues|Nagan Raya|Pidie|Pidie Jaya|Simeulue",
  "Sumatera Utara": "Medan|Binjai|Gunungsitoli|Padangsidimpuan|Pematangsiantar|Sibolga|Tanjungbalai|Tebing Tinggi|Asahan|Batubara|Dairi|Deli Serdang|Humbang Hasundutan|Karo|Labuhanbatu|Labuhanbatu Selatan|Labuhanbatu Utara|Langkat|Mandailing Natal|Nias|Nias Barat|Nias Selatan|Nias Utara|Padang Lawas|Padang Lawas Utara|Pakpak Bharat|Samosir|Serdang Bedagai|Simalungun|Tapanuli Selatan|Tapanuli Tengah|Tapanuli Utara|Toba",
  "Sumatera Barat": "Padang|Bukittinggi|Padang Panjang|Pariaman|Payakumbuh|Sawahlunto|Solok|Agam|Dharmasraya|Kepulauan Mentawai|Lima Puluh Kota|Padang Pariaman|Pasaman|Pasaman Barat|Pesisir Selatan|Sijunjung|Kab. Solok|Solok Selatan|Tanah Datar",
  "Riau": "Pekanbaru|Dumai|Bengkalis|Indragiri Hilir|Indragiri Hulu|Kampar|Kepulauan Meranti|Kuantan Singingi|Pelalawan|Rokan Hilir|Rokan Hulu|Siak",
  "Kepulauan Riau": "Tanjungpinang|Batam|Bintan|Karimun|Kepulauan Anambas|Lingga|Natuna",
  "Jambi": "Jambi|Sungai Penuh|Batanghari|Bungo|Kerinci|Merangin|Muaro Jambi|Sarolangun|Tanjung Jabung Barat|Tanjung Jabung Timur|Tebo",
  "Sumatera Selatan": "Palembang|Lubuklinggau|Pagar Alam|Prabumulih|Banyuasin|Empat Lawang|Lahat|Muara Enim|Musi Banyuasin|Musi Rawas|Musi Rawas Utara|Ogan Ilir|Ogan Komering Ilir|Ogan Komering Ulu|OKU Selatan|OKU Timur|Penukal Abab Lematang Ilir",
  "Bangka Belitung": "Pangkalpinang|Bangka|Bangka Barat|Bangka Selatan|Bangka Tengah|Belitung|Belitung Timur",
  "Bengkulu": "Bengkulu|Bengkulu Selatan|Bengkulu Tengah|Bengkulu Utara|Kaur|Kepahiang|Lebong|Mukomuko|Rejang Lebong|Seluma",
  "Lampung": "Bandar Lampung|Metro|Lampung Barat|Lampung Selatan|Lampung Tengah|Lampung Timur|Lampung Utara|Mesuji|Pesawaran|Pesisir Barat|Pringsewu|Tanggamus|Tulang Bawang|Tulang Bawang Barat|Way Kanan",
  "DKI Jakarta": "Jakarta Pusat|Jakarta Utara|Jakarta Barat|Jakarta Selatan|Jakarta Timur|Kepulauan Seribu",
  "Jawa Barat": "Bandung|Banjar|Bekasi|Bogor|Cimahi|Cirebon|Depok|Sukabumi|Tasikmalaya|Kab. Bandung|Bandung Barat|Kab. Bekasi|Kab. Bogor|Ciamis|Cianjur|Kab. Cirebon|Garut|Indramayu|Karawang|Kuningan|Majalengka|Pangandaran|Purwakarta|Subang|Kab. Sukabumi|Sumedang|Kab. Tasikmalaya",
  "Banten": "Serang|Cilegon|Tangerang|Tangerang Selatan|Lebak|Pandeglang|Kab. Serang|Kab. Tangerang",
  "Jawa Tengah": "Semarang|Magelang|Pekalongan|Salatiga|Surakarta|Tegal|Banjarnegara|Banyumas|Batang|Blora|Boyolali|Brebes|Cilacap|Demak|Grobogan|Jepara|Karanganyar|Kebumen|Kendal|Klaten|Kudus|Kab. Magelang|Pati|Kab. Pekalongan|Pemalang|Purbalingga|Purworejo|Rembang|Kab. Semarang|Sragen|Sukoharjo|Kab. Tegal|Temanggung|Wonogiri|Wonosobo",
  "DI Yogyakarta": "Yogyakarta|Bantul|Gunungkidul|Kulon Progo|Sleman",
  "Jawa Timur": "Surabaya|Batu|Blitar|Kediri|Madiun|Malang|Mojokerto|Pasuruan|Probolinggo|Bangkalan|Banyuwangi|Kab. Blitar|Bojonegoro|Bondowoso|Gresik|Jember|Jombang|Kab. Kediri|Lamongan|Lumajang|Kab. Madiun|Magetan|Kab. Malang|Kab. Mojokerto|Nganjuk|Ngawi|Pacitan|Pamekasan|Kab. Pasuruan|Ponorogo|Kab. Probolinggo|Sampang|Sidoarjo|Situbondo|Sumenep|Trenggalek|Tuban|Tulungagung",
  "Bali": "Denpasar|Badung|Bangli|Buleleng|Gianyar|Jembrana|Karangasem|Klungkung|Tabanan",
  "Nusa Tenggara Barat": "Mataram|Bima|Kab. Bima|Dompu|Lombok Barat|Lombok Tengah|Lombok Timur|Lombok Utara|Sumbawa|Sumbawa Barat",
  "Nusa Tenggara Timur": "Kupang|Alor|Belu|Ende|Flores Timur|Kab. Kupang|Lembata|Malaka|Manggarai|Manggarai Barat|Manggarai Timur|Nagekeo|Ngada|Rote Ndao|Sabu Raijua|Sikka|Sumba Barat|Sumba Barat Daya|Sumba Tengah|Sumba Timur|Timor Tengah Selatan|Timor Tengah Utara",
  "Kalimantan Barat": "Pontianak|Singkawang|Bengkayang|Kapuas Hulu|Kayong Utara|Ketapang|Kubu Raya|Landak|Melawi|Mempawah|Sambas|Sanggau|Sekadau|Sintang",
  "Kalimantan Tengah": "Palangka Raya|Barito Selatan|Barito Timur|Barito Utara|Gunung Mas|Kapuas|Katingan|Kotawaringin Barat|Kotawaringin Timur|Lamandau|Murung Raya|Pulang Pisau|Seruyan|Sukamara",
  "Kalimantan Selatan": "Banjarmasin|Banjarbaru|Balangan|Banjar|Barito Kuala|Hulu Sungai Selatan|Hulu Sungai Tengah|Hulu Sungai Utara|Kotabaru|Tabalong|Tanah Bumbu|Tanah Laut|Tapin",
  "Kalimantan Timur": "Samarinda|Balikpapan|Bontang|Berau|Kutai Barat|Kutai Kartanegara|Kutai Timur|Mahakam Ulu|Paser|Penajam Paser Utara",
  "Kalimantan Utara": "Tarakan|Bulungan|Malinau|Nunukan|Tana Tidung",
  "Sulawesi Utara": "Manado|Bitung|Kotamobagu|Tomohon|Bolaang Mongondow|Bolaang Mongondow Selatan|Bolaang Mongondow Timur|Bolaang Mongondow Utara|Kepulauan Sangihe|Kepulauan Siau Tagulandang Biaro|Kepulauan Talaud|Minahasa|Minahasa Selatan|Minahasa Tenggara|Minahasa Utara",
  "Gorontalo": "Gorontalo|Boalemo|Bone Bolango|Kab. Gorontalo|Gorontalo Utara|Pohuwato",
  "Sulawesi Tengah": "Palu|Banggai|Banggai Kepulauan|Banggai Laut|Buol|Donggala|Morowali|Morowali Utara|Parigi Moutong|Poso|Sigi|Tojo Una-Una|Tolitoli",
  "Sulawesi Barat": "Mamuju|Majene|Mamasa|Mamuju Tengah|Pasangkayu|Polewali Mandar",
  "Sulawesi Selatan": "Makassar|Palopo|Parepare|Bantaeng|Barru|Bone|Bulukumba|Enrekang|Gowa|Jeneponto|Kepulauan Selayar|Luwu|Luwu Timur|Luwu Utara|Maros|Pangkep|Pinrang|Sidrap|Sinjai|Soppeng|Takalar|Tana Toraja|Toraja Utara|Wajo",
  "Sulawesi Tenggara": "Kendari|Baubau|Bombana|Buton|Buton Selatan|Buton Tengah|Buton Utara|Kolaka|Kolaka Timur|Kolaka Utara|Konawe|Konawe Kepulauan|Konawe Selatan|Konawe Utara|Muna|Muna Barat|Wakatobi",
  "Maluku": "Ambon|Tual|Buru|Buru Selatan|Kepulauan Aru|Kepulauan Tanimbar|Maluku Barat Daya|Maluku Tengah|Maluku Tenggara|Seram Bagian Barat|Seram Bagian Timur",
  "Maluku Utara": "Ternate|Tidore Kepulauan|Halmahera Barat|Halmahera Selatan|Halmahera Tengah|Halmahera Timur|Halmahera Utara|Kepulauan Sula|Pulau Morotai|Pulau Taliabu",
  "Papua": "Jayapura|Kab. Jayapura|Biak Numfor|Keerom|Kepulauan Yapen|Mamberamo Raya|Sarmi|Supiori|Waropen",
  "Papua Barat": "Manokwari|Fakfak|Kaimana|Manokwari Selatan|Pegunungan Arfak|Teluk Bintuni|Teluk Wondama",
  "Papua Barat Daya": "Sorong|Kab. Sorong|Maybrat|Raja Ampat|Sorong Selatan|Tambrauw",
  "Papua Tengah": "Nabire|Deiyai|Dogiyai|Intan Jaya|Mimika|Paniai|Puncak|Puncak Jaya",
  "Papua Pegunungan": "Jayawijaya|Lanny Jaya|Mamberamo Tengah|Nduga|Pegunungan Bintang|Tolikara|Yahukimo|Yalimo",
  "Papua Selatan": "Merauke|Asmat|Boven Digoel|Mappi",
};

export const PROVINCES = Object.keys(RAW).sort((left, right) => left.localeCompare(right));

export const citiesOf = (province: string): string[] => (RAW[province] ? RAW[province].split("|") : []);

export const provinceOptions = () => PROVINCES.map((name) => ({ value: name, label: name }));

// Opsi kota untuk provinsi terpilih; nilai lama yang tidak ada di daftar tetap ditawarkan
// (ditandai) agar data historis tidak hilang saat diedit.
export const cityOptions = (province: string, current?: string) => {
  const list = citiesOf(province);
  const options = list.map((name) => ({ value: name, label: name }));
  if (current && !list.includes(current)) options.unshift({ value: current, label: `${current} (data lama)` });
  return options;
};
