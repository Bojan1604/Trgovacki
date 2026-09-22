/** Statički šifrarnici i generatori naziva za demo lanac. */

export const CATEGORY_TREE = [
  {
    code: 'HRANA', name: 'Hrana', margin: 22,
    children: [
      { code: 'HR-PEK', name: 'Pekarski proizvodi', margin: 35 },
      { code: 'HR-MLI', name: 'Mliječni proizvodi', margin: 18 },
      { code: 'HR-MES', name: 'Meso i mesni proizvodi', margin: 24 },
      { code: 'HR-VOC', name: 'Voće i povrće', margin: 30 },
      { code: 'HR-SMR', name: 'Smrznuti program', margin: 21 },
      { code: 'HR-KON', name: 'Konzervirano i gotova jela', margin: 23 },
      { code: 'HR-SLA', name: 'Slatko i grickalice', margin: 28 },
      { code: 'HR-TJE', name: 'Tjestenina, riža i brašno', margin: 19 },
      { code: 'HR-ULJ', name: 'Ulja, ocat i začini', margin: 26 },
    ],
  },
  {
    code: 'PICE', name: 'Pića', margin: 25,
    children: [
      { code: 'PI-BEZ', name: 'Bezalkoholna pića', margin: 27 },
      { code: 'PI-VOD', name: 'Vode', margin: 24 },
      { code: 'PI-PIV', name: 'Pivo', margin: 22 },
      { code: 'PI-VIN', name: 'Vino', margin: 30 },
      { code: 'PI-ZES', name: 'Žestoka pića', margin: 32 },
      { code: 'PI-KAV', name: 'Kava i čaj', margin: 29 },
    ],
  },
  {
    code: 'KUCA', name: 'Kućanstvo', margin: 30,
    children: [
      { code: 'KU-DET', name: 'Deterdženti i čišćenje', margin: 28 },
      { code: 'KU-PAP', name: 'Papirna konfekcija', margin: 26 },
      { code: 'KU-KUH', name: 'Kuhinjski pribor', margin: 38 },
      { code: 'KU-TEK', name: 'Tekstil za kućanstvo', margin: 42 },
    ],
  },
  {
    code: 'DROG', name: 'Drogerija', margin: 33,
    children: [
      { code: 'DR-HIG', name: 'Osobna higijena', margin: 31 },
      { code: 'DR-KOZ', name: 'Kozmetika', margin: 40 },
      { code: 'DR-BEB', name: 'Bebi program', margin: 22 },
    ],
  },
  {
    code: 'TEHN', name: 'Tehnika i sezona', margin: 28,
    children: [
      { code: 'TE-ELE', name: 'Mali kućanski aparati', margin: 26 },
      { code: 'TE-BAT', name: 'Baterije i žarulje', margin: 45 },
      { code: 'TE-SEZ', name: 'Sezonski program', margin: 38 },
    ],
  },
  {
    code: 'DUHA', name: 'Duhan i tisak', margin: 8,
    children: [
      { code: 'DU-CIG', name: 'Cigarete', margin: 6 },
      { code: 'DU-TIS', name: 'Tisak', margin: 12 },
    ],
  },
];

export const BRANDS = [
  'Podravka', 'Franck', 'Dukat', 'Zvijezda', 'Kraš', 'Jamnica', 'Coca-Cola', 'Nestlé',
  'Vindija', 'Ledo', 'Karlovačko', 'Ožujsko', 'Barilla', 'Ariel', 'Persil', 'Nivea',
  'L\'Oréal', 'Pampers', 'Violeta', 'Saponia', 'Gavrilović', 'PIK', 'Bobis', 'Cedevita',
  'Badel', 'Maraska', 'Vegeta', 'Lino', 'Argeta', 'Bakina tajna',
];

export const SUPPLIERS = [
  { code: 'D001', name: 'Veletrgovina Zagreb d.o.o.', city: 'Zagreb', terms: 30, lead: 2 },
  { code: 'D002', name: 'Distributivni centar Sjever d.d.', city: 'Varaždin', terms: 45, lead: 3 },
  { code: 'D003', name: 'Adria Food Logistika d.o.o.', city: 'Split', terms: 30, lead: 4 },
  { code: 'D004', name: 'Mliječni put d.o.o.', city: 'Osijek', terms: 21, lead: 1 },
  { code: 'D005', name: 'Pekara Klasje d.o.o.', city: 'Zagreb', terms: 14, lead: 1 },
  { code: 'D006', name: 'Mesna industrija Slavonija d.d.', city: 'Vinkovci', terms: 30, lead: 2 },
  { code: 'D007', name: 'Piće & Više d.o.o.', city: 'Rijeka', terms: 45, lead: 3 },
  { code: 'D008', name: 'Higijena Plus d.o.o.', city: 'Zagreb', terms: 60, lead: 5 },
  { code: 'D009', name: 'Tehno Uvoz d.o.o.', city: 'Zagreb', terms: 60, lead: 10 },
  { code: 'D010', name: 'Voće i povrće Dalmacija d.o.o.', city: 'Zadar', terms: 10, lead: 1 },
  { code: 'D011', name: 'Duhanprodaja d.o.o.', city: 'Zagreb', terms: 7, lead: 1 },
  { code: 'D012', name: 'Euro Kozmetika d.o.o.', city: 'Zagreb', terms: 45, lead: 4 },
];

export const STORES = [
  { code: '1', name: 'Centar', city: 'Zagreb', address: 'Ilica 112', region: 'Zagreb', m2: 420, registers: 4 },
  { code: '2', name: 'Trešnjevka', city: 'Zagreb', address: 'Ozaljska 15', region: 'Zagreb', m2: 310, registers: 3 },
  { code: '3', name: 'Dubrava', city: 'Zagreb', address: 'Avenija Dubrava 47', region: 'Zagreb', m2: 280, registers: 3 },
  { code: '4', name: 'Split Poljud', city: 'Split', address: 'Osmih mediteranskih igara 3', region: 'Dalmacija', m2: 350, registers: 3 },
  { code: '5', name: 'Rijeka Zapad', city: 'Rijeka', address: 'Zvonimirova 22', region: 'Primorje', m2: 295, registers: 2 },
  { code: '6', name: 'Osijek Centar', city: 'Osijek', address: 'Europska avenija 9', region: 'Slavonija', m2: 260, registers: 2 },
  { code: '7', name: 'Varaždin', city: 'Varaždin', address: 'Kapucinski trg 4', region: 'Sjever', m2: 240, registers: 2 },
  { code: '8', name: 'Zadar Višnjik', city: 'Zadar', address: 'Splitska 12', region: 'Dalmacija', m2: 320, registers: 3 },
];

export const PRODUCT_TEMPLATES: Record<string, { names: string[]; priceRange: [number, number]; tax: string }> = {
  'HR-PEK': {
    names: ['Kruh polubijeli', 'Kruh raženi', 'Kruh integralni', 'Pecivo kajzerica', 'Bureki sirni', 'Croissant maslac', 'Kifla obična', 'Pogača domaća', 'Štrudla jabuka', 'Baguette'],
    priceRange: [0.55, 3.5], tax: 'PDV5',
  },
  'HR-MLI': {
    names: ['Mlijeko 2,8% 1l', 'Mlijeko trajno 3,2% 1l', 'Jogurt tekući 1kg', 'Jogurt čvrsti 180g', 'Vrhnje za kuhanje 200ml', 'Sir svježi 500g', 'Maslac 250g', 'Gauda narezana 150g', 'Mliječni namaz 200g', 'Kefir 500ml'],
    priceRange: [0.79, 5.9], tax: 'PDV5',
  },
  'HR-MES': {
    names: ['Pileća prsa 1kg', 'Svinjski vrat 1kg', 'Mljeveno meso miješano 500g', 'Kobasice domaće 400g', 'Šunka narezana 100g', 'Salama zimska 150g', 'Pašteta jetrena 100g', 'Slanina dimljena 300g', 'Junetina but 1kg', 'Čajna kobasica 200g'],
    priceRange: [1.2, 12.9], tax: 'PDV25',
  },
  'HR-VOC': {
    names: ['Banane 1kg', 'Jabuke Idared 1kg', 'Naranče 1kg', 'Limun 1kg', 'Krumpir 2kg', 'Luk crveni 1kg', 'Rajčica 1kg', 'Krastavci 1kg', 'Paprika babura 1kg', 'Mrkva 1kg'],
    priceRange: [0.69, 4.5], tax: 'PDV5',
  },
  'HR-SMR': {
    names: ['Sladoled vanilija 1l', 'Smrznuto povrće mix 750g', 'Pomfrit 1kg', 'Riblji štapići 300g', 'Pizza smrznuta 350g', 'Lisnato tijesto 500g', 'Smrznute jagode 450g', 'Sladoled štapić 6/1'],
    priceRange: [1.5, 7.9], tax: 'PDV25',
  },
  'HR-KON': {
    names: ['Grah u limenci 400g', 'Kukuruz šećerac 300g', 'Tuna u ulju 160g', 'Ajvar blagi 350g', 'Kečap 500g', 'Majoneza 620g', 'Juha kokošja 65g', 'Gotovo jelo grah 400g', 'Paradajz pelati 400g'],
    priceRange: [0.85, 4.2], tax: 'PDV25',
  },
  'HR-SLA': {
    names: ['Čokolada mliječna 100g', 'Keks petit beurre 300g', 'Bomboni voćni 100g', 'Čips slani 150g', 'Štapići slani 200g', 'Napolitanke 250g', 'Kikiriki slani 200g', 'Žvakaće gume 14g', 'Kakao krema 400g', 'Sirovi bar 35g'],
    priceRange: [0.65, 5.2], tax: 'PDV25',
  },
  'HR-TJE': {
    names: ['Špageti 500g', 'Makaroni 400g', 'Riža dugozrnata 1kg', 'Brašno glatko 1kg', 'Brašno oštro 1kg', 'Kukuruzno brašno 1kg', 'Njoki 500g', 'Zobene pahuljice 500g'],
    priceRange: [0.75, 3.6], tax: 'PDV5',
  },
  'HR-ULJ': {
    names: ['Suncokretovo ulje 1l', 'Maslinovo ulje 500ml', 'Ocat alkoholni 1l', 'Sol kuhinjska 1kg', 'Papar mljeveni 20g', 'Vegeta 250g', 'Origano 10g', 'Cimet mljeveni 15g'],
    priceRange: [0.55, 12.9], tax: 'PDV25',
  },
  'PI-BEZ': {
    names: ['Cola 2l', 'Cola 0,5l', 'Sok naranča 1l', 'Sok jabuka 1l', 'Gazirani sok limun 1,5l', 'Ledeni čaj breskva 1,5l', 'Energetski napitak 250ml', 'Sok multivitamin 0,2l'],
    priceRange: [0.75, 3.2], tax: 'PDV25',
  },
  'PI-VOD': {
    names: ['Voda negazirana 1,5l', 'Voda gazirana 1,5l', 'Voda negazirana 0,5l', 'Mineralna voda 1l', 'Izvorska voda 5l'],
    priceRange: [0.45, 2.4], tax: 'PDV25',
  },
  'PI-PIV': {
    names: ['Pivo svijetlo 0,5l', 'Pivo tamno 0,5l', 'Pivo limenka 0,5l', 'Pivo pakiranje 6x0,5l', 'Bezalkoholno pivo 0,5l', 'Craft pivo IPA 0,33l'],
    priceRange: [0.99, 7.5], tax: 'PDV25',
  },
  'PI-VIN': {
    names: ['Vino bijelo graševina 0,75l', 'Vino crno plavac 0,75l', 'Vino rose 0,75l', 'Pjenušac brut 0,75l', 'Vino stolno 1l'],
    priceRange: [3.2, 18.9], tax: 'PDV25',
  },
  'PI-ZES': {
    names: ['Rakija šljivovica 1l', 'Vinjak 0,7l', 'Travarica 1l', 'Viski 0,7l', 'Vodka 1l', 'Gin 0,7l', 'Liker višnja 0,7l'],
    priceRange: [8.9, 32.0], tax: 'PDV25',
  },
  'PI-KAV': {
    names: ['Kava mljevena 250g', 'Kava mljevena 500g', 'Instant kava 100g', 'Kapsule espresso 10/1', 'Čaj kamilica 20/1', 'Čaj šumsko voće 20/1'],
    priceRange: [1.6, 9.9], tax: 'PDV25',
  },
  'KU-DET': {
    names: ['Deterdžent za rublje 3l', 'Omekšivač 1l', 'Tablete za perilicu 40/1', 'Sredstvo za suđe 900ml', 'Sredstvo za staklo 750ml', 'Univerzalno sredstvo 1l', 'WC gel 750ml'],
    priceRange: [1.4, 14.9], tax: 'PDV25',
  },
  'KU-PAP': {
    names: ['Toaletni papir 10/1', 'Papirnati ručnici 2/1', 'Salvete 100/1', 'Maramice 10x10', 'Vreće za smeće 35l 20/1', 'Aluminijska folija 30m'],
    priceRange: [0.85, 8.9], tax: 'PDV25',
  },
  'KU-KUH': {
    names: ['Tava 24cm', 'Lonac 3l', 'Set noževa 3/1', 'Daska za rezanje', 'Kuhača drvena', 'Posuda za pohranu 1l'],
    priceRange: [2.9, 29.9], tax: 'PDV25',
  },
  'KU-TEK': {
    names: ['Ručnik 50x90', 'Plahta 160x200', 'Krpa za pod', 'Kuhinjska krpa 3/1', 'Prostirka za kupaonicu'],
    priceRange: [2.5, 19.9], tax: 'PDV25',
  },
  'DR-HIG': {
    names: ['Šampon 400ml', 'Gel za tuširanje 400ml', 'Sapun tekući 300ml', 'Pasta za zube 75ml', 'Četkica za zube', 'Dezodorans 150ml', 'Žileti 4/1'],
    priceRange: [1.1, 9.9], tax: 'PDV25',
  },
  'DR-KOZ': {
    names: ['Krema za lice 50ml', 'Krema za ruke 100ml', 'Maskara', 'Ruž za usne', 'Lak za nokte', 'Parfem 50ml'],
    priceRange: [2.9, 39.9], tax: 'PDV25',
  },
  'DR-BEB': {
    names: ['Pelene 4 (44/1)', 'Vlažne maramice 64/1', 'Dječja kašica 190g', 'Dječji šampon 200ml', 'Mlijeko za dojenčad 800g'],
    priceRange: [1.9, 24.9], tax: 'PDV5',
  },
  'TE-ELE': {
    names: ['Toster', 'Kuhalo za vodu 1,7l', 'Mikser ručni', 'Pegla parna', 'Usisavač 700W'],
    priceRange: [14.9, 99.0], tax: 'PDV25',
  },
  'TE-BAT': {
    names: ['Baterije AA 4/1', 'Baterije AAA 4/1', 'LED žarulja E27 9W', 'Baterija 9V', 'Produžni kabel 3m'],
    priceRange: [1.9, 12.9], tax: 'PDV25',
  },
  'TE-SEZ': {
    names: ['Suncobran 2m', 'Ležaljka', 'Roštilj prijenosni', 'Grijalica 2000W', 'Lopata za snijeg'],
    priceRange: [7.9, 59.0], tax: 'PDV25',
  },
  'DU-CIG': {
    names: ['Cigarete A 20/1', 'Cigarete B 20/1', 'Cigarete C 20/1', 'Duhan za motanje 30g'],
    priceRange: [4.2, 6.5], tax: 'PDV25',
  },
  'DU-TIS': {
    names: ['Dnevne novine', 'Tjedni magazin', 'Časopis mjesečni', 'Križaljke'],
    priceRange: [1.2, 4.5], tax: 'PDV5',
  },
};

export const FIRST_NAMES = [
  'Ana', 'Ivan', 'Marija', 'Luka', 'Petra', 'Marko', 'Ivana', 'Josip', 'Martina', 'Tomislav',
  'Nikolina', 'Filip', 'Sara', 'Antonio', 'Maja', 'Matej', 'Lucija', 'Domagoj', 'Kristina', 'Karlo',
  'Dora', 'Stjepan', 'Iva', 'Hrvoje', 'Tea', 'Dario', 'Nikola', 'Katarina', 'Mislav', 'Valentina',
];

export const LAST_NAMES = [
  'Horvat', 'Kovačević', 'Babić', 'Marić', 'Jurić', 'Novak', 'Kovačić', 'Vuković', 'Knežević',
  'Marković', 'Petrović', 'Matić', 'Tomić', 'Pavlović', 'Blažević', 'Grgić', 'Perić', 'Radić',
  'Filipović', 'Božić', 'Lovrić', 'Šimić', 'Vidović', 'Barišić', 'Ivanković',
];

export const COMPANY_NAMES = [
  'Alfa gradnja d.o.o.', 'Beta servis j.d.o.o.', 'Gamma ugostiteljstvo d.o.o.',
  'Delta transport d.o.o.', 'Epsilon studio d.o.o.', 'Zeta konzalting d.o.o.',
  'Eta tehnika d.o.o.', 'Theta mediji d.o.o.', 'Jota turizam d.o.o.', 'Kappa logistika d.o.o.',
];

export const CITIES = [
  ['Zagreb', '10000'], ['Split', '21000'], ['Rijeka', '51000'], ['Osijek', '31000'],
  ['Zadar', '23000'], ['Varaždin', '42000'], ['Slavonski Brod', '35000'], ['Pula', '52100'],
  ['Karlovac', '47000'], ['Sisak', '44000'], ['Šibenik', '22000'], ['Dubrovnik', '20000'],
];
