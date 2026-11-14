# AJIL хөгжүүлэлтийг үргэлжлүүлэх

## VS Code дээр нээх

Node.js 24 болон pnpm 11.25.0 шаардлагатай.

```sh
git clone https://github.com/shonhoonot/worker-app.git
cd worker-app
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run build
```

`npm run install:ci` нь managed Linux-ийн туслах команд. Mac дээр дээрх pnpm командыг ашиглана.

## Local өгөгдлийн сан

Анхны build-ийн дараа migration-уудыг дарааллаар нь зөвхөн local санд ажиллуулна:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lethal_christian_walker.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_known_rumiko_fujikawa.sql
pnpm dev
```

Preview-ийн URL terminal дээр гарна. Local болон нийтлэгдсэн өгөгдлийн сан тусдаа. Хэрэв Wrangler migration хавтас олж чадахгүй бол `drizzle/` доторх SQL файлуудыг README-ийн заавраар нэг удаа дарааллаар нь ажиллуул. Production migration-ийг гараар дахин ажиллуулахгүй.

## Одоогийн боломж

- Зар нэмэх, засах, хаах, хуулж шинэ зар үүсгэх.
- Админ батлах/буцаах, audit, гомдол, блок, хадгалсан зар.
- Нэг өдөр, огнооны хүрээ, сонгосон өдрүүд; өдөр тус бүрийн хүний тоо.
- Ажиллах огноо, хүсэлт авах хугацаа, зар харагдах хугацаа тусдаа.
- Зар батлагдсанаас хойш 24 цагийн нэгжээр харагдах хугацаа эхэлнэ.
- ¥50/өдөр нь зөвхөн үнийн жишиг тооцоо. Төлбөрийн холболт байхгүй.

## Дараагийн ажлын дараалал

1. Нэвтэрсэн employer → зар нэмэх → admin батлах → jobseeker харах урсгалыг live орчинд шалгах.
2. Апп дотор хүсэлт өгөх: өөрийн хүсэлт, давхардлаас хамгаалалт, цуцлах боломж.
3. Ажил олгогч хүсэлтийг гараар зөвшөөрөх; өдөр тус бүрийн хүний тоог давуулж батлахгүй байх.
4. Зөвшөөрөлтэй LINE / push мэдэгдэл.
5. Төлбөрийн үйлчилгээ болон native аппыг тусдаа үе шатанд шийдэх.

## Claude Code-д өгөх заавар

Эхлээд README.md, энэ файл, lib/domain.ts, lib/service.ts, db/schema.ts,
app/api/board/route.ts, app/ui.tsx болон tests/service.test.mjs-ийг унш.
Байгаа боломжийг дахин эхнээс нь бүү бүтээ. Шинэ хүсэлт өгөх урсгалд
сервер талын эрхийн хяналт, давхардлын хамгаалалт, transaction болон
баталгаажсан хүмүүсийн тооны хязгаарыг эхэлж төлөвлө.
Schema өөрчлөлтийг шинэ migration-аар нэм; ажилласан migration-ийг засахгүй.
Нэвтрэлтийн эрхийг клиентээс ирсэн userId эсвэл isAdmin утгаар бүү шийд.
Өөрчлөлтийн дараа typecheck, tests, build ажиллуулж үр дүнг тайлагна.

## Нууц мэдээлэл ба байршуулалт

`.env`, `.dev.vars`, API token, local DB, хэрэглэгчийн өгөгдлийг commit хийхгүй.
`.env.example` нь зөвхөн хоосон загвар. GitHub public болсон нь AJIL-ийн live
Site-ийн хандах эрхийг өөрчлөхгүй. GitHub CI нь зөвхөн шалгалт хийнэ;
автоматаар production руу байршуулдаггүй.

Одоогийн authentication нь Sites-ийн баталгаажуулсан header-д тулгуурладаг.
Өөр hosting руу зөөвөл эдгээр header-ийг интернэтээс шууд итгэж болохгүй;
итгэмжлэгдсэн auth gateway эсвэл баталгаажсан session хэрэгтэй.
