# Trgovački

Maloprodajni sustav za trgovačke lance — blagajna, zalihe, nabava, cijene,
akcije, program vjernosti i izvještaji u jednoj web aplikaciji.

Sustav je građen za rad od jedne trgovine do stotina poslovnica: svi podaci su
razdvojeni po organizaciji, dokumenti imaju zakonske brojače po poslovnici i
naplatnom uređaju, a svaka promjena podataka ostavlja revizijski trag.

---

## Pokretanje

```bash
# 1. Baza (ili vlastiti PostgreSQL 14+)
docker compose up -d

# 2. Ovisnosti i konfiguracija
npm install
cp .env.example .env          # po potrebi podesite DATABASE_URL i AUTH_SECRET

# 3. Shema i demo podaci
npm run db:push
npm run db:seed

# 4. Razvojni poslužitelj
npm run dev                   # http://localhost:3000
                              # drugi port: PORT=3001 npm run dev
```

### Windows — korak po korak

Bez Gita: preuzmite [ZIP grane](https://github.com/Bojan1604/Trgovacki/archive/refs/heads/claude/retail-pos-web-app-953bv5.zip)
i raspakirajte ga. Mapa će se zvati `Trgovacki-claude-retail-pos-web-app-953bv5`.

Preduvjeti:

1. **Node.js LTS** — <https://nodejs.org> (verzija 20.9 ili novija)
2. **PostgreSQL** — <https://www.postgresql.org/download/windows/>;
   zapamtite lozinku koju postavite za korisnika `postgres`

> Nakon instalacije **otvorite novi Command Prompt** — stari ne vidi nove
> programe u `PATH`-u. Provjera: `node -v` i `psql --version`.

U mapi projekta:

```bat
copy .env.example .env
```

Otvorite `.env` u Notepadu i u `DATABASE_URL` upišite svoju lozinku:

```
DATABASE_URL="postgresql://postgres:VASA_LOZINKA@localhost:5432/trgovacki?schema=public"
```

Zatim:

```bat
npm install
npm run doctor      :: provjera je li sve spremno
npm run db:push     :: kreira bazu i tablice
npm run db:seed     :: demo podaci
npm run dev
```

Bazu ne morate ručno kreirati — `db:push` to napravi sam.

Ako nešto zapne, `npm run doctor` provjerava verziju Node-a, `.env`, lozinku u
`DATABASE_URL`, dostupnost PostgreSQL-a, generirani Prisma klijent i stanje
baze, pa za svaki problem ispisuje što konkretno napraviti.

**Najčešća greška: `P1000 Authentication failed`** — lozinka u `.env` nije ona
koju PostgreSQL očekuje. Provjerite je izravno:

```bat
psql -U postgres -h localhost -d postgres
```

Ako ni ondje ne prolazi, lozinka nije ta. Ako prolazi, prepišite je točno u
`.env`. Znakovi `/`, `#`, `?` i razmak u lozinci moraju biti kodirani
(`/` → `%2F`, `#` → `%23`, `?` → `%3F`, razmak → `%20`).

Drugi port: `set PORT=3001` pa `npm run dev` (PowerShell: `$env:PORT=3001`).

---

### Demo pristup

| Uloga | E-pošta | Lozinka |
|---|---|---|
| Vlasnik | `vlasnik@trgovacki.hr` | `demo1234` |
| Voditelj lanca | `voditelj@trgovacki.hr` | `demo1234` |
| Nabava | `nabava@trgovacki.hr` | `demo1234` |
| Računovodstvo | `racunovodstvo@trgovacki.hr` | `demo1234` |
| Blagajnik | `blagajna@trgovacki.hr` | `demo1234` |

Demo skup sadrži 9 lokacija, 22 blagajne, ~295 artikala s barkodovima i
cjenicima, 180 kupaca s programom vjernosti te 60 dana povijesti prodaje
(~11 000 računa) — dovoljno da svi izvještaji i nadzorna ploča imaju smisla.

---

## Što sustav pokriva

### Blagajna (`/pos`)
Otvaranje i zatvaranje smjene s obračunom gotovine, skeniranje barkoda
(uključujući interne barkodove s ugrađenom težinom), pretraga i mreža artikala,
ručni popusti unutar ovlasti prodavača, parkiranje i vraćanje računa, kupac i
bodovi vjernosti, dijeljeno plaćanje s automatskim izračunom povrata,
zaokruživanje gotovinskog računa, povrat robe po izvornom računu i Z-izvještaj.

Naplata je **idempotentna**: blagajna šalje vlastiti ključ transakcije, pa
prekid veze ili ponovno slanje ne stvaraju dvostruki račun.

### Katalog i cijene
Artikli s varijantama, više barkodova, jedinicama mjere, poreznim stopama,
povratnom naknadom, dobnom granicom i praćenjem roka trajanja. Stablo
kategorija s ciljanom maržom, brendovi, dobavljači s komercijalnim uvjetima.
Više cjenika s hijerarhijom (grupa kupaca → poslovnica → zadani cjenik),
dokument nivelacije s razlikom u vrijednosti zalihe i najnižom cijenom u 30
dana (EU Omnibus).

### Motor akcija
Postotni i iznosni popust, fiksna cijena, kupi X dobij Y, cijena paketa, svaki
N-ti artikl, popust na košaricu iznad praga, vremenski prozori (happy hour,
dani u tjednu), ograničenja po poslovnici, kanalu i grupi kupaca, kuponi,
ekskluzivne akcije i limiti potrošnje.

### Skladište
Knjiga kretanja zalihe kao nepromjenjiv izvor istine, ponderirana prosječna
nabavna cijena (WAC), stanje po skladištima s rezervacijama, međuskladišnice
sa statusima i tranzitom, inventure s razlikama i knjiženjem, otpisi sa
šifrarnikom razloga, pravila nadopune i prijedlog narudžbe.

### Nabava
Narudžbenice s praćenjem zaprimanja, primke s punom kalkulacijom: fakturna
cijena, rabat, razrez zavisnih troškova (po vrijednosti, količini ili težini),
konačna nabavna cijena, maloprodajna cijena i marža po stavci.

### Kupci i vjernost
Fizičke i pravne osobe, grupe kupaca s vlastitim cjenikom, kreditni limit i
rok plaćanja, program vjernosti s razinama i množiteljima bodova, poklon
kartice s praćenjem salda.

### Izvještaji
Promet po danima i satima, prodaja po artiklima, usporedba poslovnica, marža i
RUC, vrijednost zaliha, ABC analiza, učinak prodavača, rekapitulacija PDV-a,
struktura naplate, artikli bez obrtaja i knjiga popisa (KEPU).

### Sustav
Sesije s rotirajućim tokenima i zaključavanjem računa nakon uzastopnih
neuspjelih prijava, sedam preddefiniranih rola s granularnim pravima
(`modul.akcija`), pristup po poslovnicama, revizijski trag svake radnje,
transakcijski outbox za pouzdanu isporuku događaja vanjskim sustavima.

---

## Fiskalizacija

Fiskalizacija je iza sučelja `FiscalAdapter` — sustav ne ovisi o zemlji ni
servisu. Isporučena su tri adaptera:

| `FISCAL_ADAPTER` | Ponašanje |
|---|---|
| `none` *(zadano)* | Računi se izdaju bez slanja; status `NOT_REQUIRED`. |
| `hr-demo` | Reproducira tok hrvatske fiskalizacije (ZKI, JIR, QR, XML zahtjev) bez FINA certifikata. |
| `hr-production` | Mjesto za integraciju s APIS-IT servisom; zahtijeva certifikat i XML-DSIG potpisivanje. |

Račun se **prvo proknjiži u bazi, pa tek onda šalje** servisu. Neuspjeh slanja
ne ruši naplatu — dokument ostaje u redu za ponovni pokušaj, a svaki pokušaj se
bilježi sa zahtjevom, odgovorom i trajanjem (`/sales/fiscal`).

Za drugu zemlju dovoljno je napisati novi adapter; poslovna logika ostaje ista.

---

## Arhitektura

```
prisma/schema.prisma        69 tablica — organizacija, katalog, cijene, zalihe,
                            nabava, prodaja, vjernost, financije, sustav
src/lib/
  money.ts                  novčana aritmetika u cijelim brojevima, razrez bez
                            gubitka centi, zaokruživanje gotovine
  pricing-math.ts           kalkulacija maloprodajne cijene (marža ↔ MPC)
  auth.ts, permissions.ts   sesije, role, granularna prava
  services/
    inventory.ts            knjiga zaliha, WAC, rezervacije, prijedlog nabave
    pricing.ts              razrješavanje cijena i motor akcija
    sales.ts                naplata računa u jednoj transakciji
    refunds.ts              povrati s vraćanjem robe i storniranjem bodova
    shifts.ts               smjene, blagajna, Z-izvještaj
    numbering.ts            atomarni brojači dokumenata
    analytics.ts            upiti za izvještaje
  fiscal/                   adapteri fiskalizacije
src/app/(app)/              back office
src/app/pos/                blagajna
src/app/api/                REST sloj (blagajna, katalog, prijava, pretraga)
src/components/             dizajn sustav, grafikoni, moduli sučelja
```

### Odluke koje nose skalabilnost

- **Novac u cijelim brojevima.** Sva aritmetika ide kroz `money.ts`; razrez
  zavisnih troškova i popusta nikad ne gubi cent.
- **Zaliha kao knjiga.** `StockMovement` je nepromjenjiv zapis s tekućim
  saldom; `StockItem` je denormalizirani sažetak za brzinu. Stanje se uvijek
  može rekonstruirati iz knjige.
- **Brojači dokumenata s eksplicitnim opsegom.** Jedinstveni indeks u
  PostgreSQL-u tretira `NULL` vrijednosti kao različite, pa opseg brojača nikad
  nije `NULL` — prazan niz znači "cijela organizacija".
- **Fiskalizacija izvan transakcije.** Mrežni poziv ne drži otvorenu
  transakciju baze i ne može srušiti već naplaćeni račun.
- **Dnevni agregati.** `DailyKpi` se ažurira pri svakoj naplati, pa nadzorna
  ploča ne skenira milijune redaka.
- **Transakcijski outbox.** Događaji za vanjske sustave upisuju se u istoj
  transakciji kao poslovna promjena.

---

## Sučelje

Gust raspored inspiriran macOS/iOS sučeljima: bazna tipografija 13 px, visina
retka tablice 30 px, mekane sjene i hairline granice umjesto debelih okvira.
Svijetla i tamna tema dijele isti skup tokena (`globals.css`), tablične brojke
su uvijek poravnate.

Boje grafikona uzete su iz palete provjerene na razdvojenost za daltoniste i
kontrast prema podlozi, zasebno za svijetlu i tamnu temu. Grafikoni s više
serija uvijek nose i izravne oznake — identitet nikad ne ovisi samo o boji.

---

## Testovi

```bash
npm test             # svi testovi (44) — zahtijeva napunjenu bazu
npm run test:unit    # samo jedinični, bez baze
```

- **Jedinični** (`money`, `pricing-math`, `promotions`): novčana aritmetika i
  zaokruživanje, razrez iznosa bez gubitka centi, kalkulacija marže i RUC-a te
  cijeli motor akcija — postotni i fiksni popust, kupi X dobij Y, svaki N-ti
  artikl, prag košarice, ekskluzivne akcije, kuponi, popust razine vjernosti i
  vremenski prozori.
- **Integracijski** (`checkout`): radi protiv stvarne baze i provjerava ono što
  se jedinično ne može — knjiženje računa i izlaza sa zalihe u jednoj
  transakciji, slaganje zbroja stavki i rekapitulacije PDV-a s ukupnim iznosom,
  idempotentnost naplate, odbijanje prodaje iznad zalihe i nedostatnog
  plaćanja, povrat s vraćanjem robe te praćenje prometa smjene. Test za sobom
  čisti dokumente koje je kreirao.

Testovi se pokreću s `--conditions=react-server`, čime paket `server-only`
postaje prazan modul i poslužiteljski servisi se mogu pozvati izravno iz Node-a.

---

## Priručnik za korisnike

`docs/Trgovacki-prirucnik.pdf` — 60 stranica uputa sa snimkama zaslona iz radne
aplikacije. Nastaje u dva koraka:

```bash
npm run db:seed                 # čisto početno stanje
npm run build && npm run start  # produkcijski poslužitelj
npm run e2e                     # prolaz kroz sve funkcije + snimke zaslona
npm run manual                  # priprema snimki i izrada PDF-a
```

`npm run e2e` vozi stvarne tokove u pregledniku — otvaranje smjene, prodaju s
popustom i kupcem, parkiranje, naplatu gotovinom i karticom, povrat, zatvaranje
smjene, te sve ekrane back officea — i provjerava ishode (77 provjera).
Snimke nastale tijekom prolaza ulaze u priručnik, a rezultat provjere ispisuje
se u dodatku PDF-a. Tako upute i slike ne mogu zastarjeti u odnosu na kod.

---

## Naredbe

```bash
npm run dev          # razvojni poslužitelj
npm test             # testovi
npm run doctor       # provjera okoline prije prvog pokretanja
npm run e2e          # funkcionalni prolaz + snimke zaslona
npm run manual       # izrada PDF priručnika
npm run build        # produkcijski build (uključuje prisma generate)
npm run start        # pokretanje builda
npm run typecheck    # provjera tipova
npm run db:push      # sinkronizacija sheme bez migracija (razvoj)
npm run db:migrate   # migracija s poviješću
npm run db:deploy    # primjena migracija (produkcija)
npm run db:seed      # demo podaci
npm run db:reset     # reset sheme i ponovno punjenje
```

---

## Što još nije napravljeno

Namjerno izvan opsega ove faze, uz pripremljene temelje:

- **Fiskalizacija s certifikatom** — adapter i tok postoje, nedostaje FINA
  certifikat i XML-DSIG potpisivanje.
- **Hardver** — POS terminali, vage i pisači naljepnica imaju konfiguraciju i
  mjesto u modelu (`Register.printerConfig`, `terminalConfig`, `scaleConfig`),
  ali nisu testirani na uređajima.
- **Offline rad blagajne** — naplata je idempotentna i spremna za red čekanja,
  ali lokalna pohrana košarice i sinkronizacija nisu implementirane.
- **Uređivanje kroz sučelje** — dio šifrarnika (poslovnice, role, akcije) za
  sada se popunjava kroz punjenje podataka; obrasci za izmjenu su sljedeći korak.
- **Testovi sučelja** — pokriveni su domenska logika i tok naplate; nema
  automatiziranih testova samih ekrana.
