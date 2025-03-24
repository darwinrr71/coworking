# Coworking Plattform

Det här projektet är en coworking-plattform som gör det möjligt för användare att boka rum, hantera sina bokningar och autentisera användare. Här följer en beskrivning av användningen av varje komponent i projektet.

## Projektstruktur

- **index.js:** Huvudfil som konfigurerar och startar Express-servern, anterar rutter och konfigurerar Socket.io.
- **package.json:** npm-konfigurationsfil som listar projektets beroenden och kript.
- **prisma/schema.prisma:** Prisma-schemafil som definierar tabeller och elationer i databasen.
- **src/config/redis.js:** Konfiguration för Redis-klienten.
- **src/controllers:** Innehåller kontrollerna som hanterar logiken för utterna.
  - authController.js: Hanterar registrering och inloggning av användare.
  - bookingController.js: Hanterar skapande, hämtning, uppdatering och borttagning av bokningar.
  - roomController.js: Hanterar skapande, hämtning, uppdatering och borttagning av rum.
- **src/middleware:** Innehåller mellanprogram som används i rutterna.
  - authMiddleware.js: Middleware för autentisering och auktorisering av användare.
  - errorHandler.js:\*\* Middleware för att hantera fel.
- **src/routes:** Innehåller appens rutter.
  - authRoutes.js: Rutter för registrering och inloggning av användare.
  - bookingRoutes.js: Rutter för hantering av bokningar.
  - roomRoutes.js: Rutter för hantering av rum.
- **src/services/socketService.js:** Tjänst för att hantera ealtidskommunikation med Socket.io.
- **src/utils/generateToken.js:** Verktyg för att generera JWT-token.
- **src/utils/logger.js:** System log generator.

## Användning av Komponenter

- **index.js**

  - Konfigurerar och startar Express-servern.
  - Definierar autentisering, rum och bokningsrutter.
  - Initierar Socket.io-tjänsten.
  - Hanterar rotvägen och skickar periodiska händelser.

- **package.json**

  Listar projektets beroenden, som Express, Prisma, Redis, etc.
  Definierar skript för att starta servern i utvecklingsläge (npm run dev).

- **schema.prisma**

  Definierar databasens schema, inklusive tabellerna User, Room och Booking, samt deras relationer.

- **redis.js**

  Konfigurerar Redis-klienten med miljövariablerna REDIS_HOST och REDIS_PORT.

## src/controllers

- **authController.js**

  register: Registrerar en ny användare, hashar lösenordet och genererar en JWT-token.
  login: Autentiserar en användare, jämför lösenordet och genererar en JWT-token.

- **bookingController.js**

  - createBooking: Skapar en ny bokning, verifierar tillgängligheten för rummet.
  - getUserBookings: Hämtar alla bokningar för en användare.
  - updateBooking: Uppdaterar en befintlig bokning.
  - deleteBooking: Tar bort en befintlig bokning.

- **roomController.js**

  createRoom: Skapar ett nytt rum.
  getAllRooms: Hämtar alla rum, använder Redis för cachelagring.
  updateRoom: Uppdaterar ett befintligt rum.
  deleteRoom: Tar bort ett befintligt rum.

## src/middleware

- **authMiddleware.js**

  authenticate: Verifierar JWT-token i begärans header.
  authorize: Verifierar om användaren har rätt roll för att komma åt en rutt.

- **errorHandler.js**

  Hanterar fel och mappar felmeddelanden till HTTP-statuskoder och svarsmeldingar.

## src/routes

- **authRoutes.js**

  Definierar rutter för användarregistrering (/user/register) och inloggning (/user/login).

- **bookingRoutes.js**

  ## Definierar rutter för hantering av bokningar:

  - Skapa bokning: POST /booking/create
  - Hämta bokningar: GET /booking/allbookings
  - Uppdatera bokning: PUT /booking/update/:id
  - Ta bort bokning: DELETE /booking/delete/:id

- **roomRoutes.js**

  ## Definierar rutter för hantering av rum:

  - Skapa rum: POST /room/create
  - Hämta rum: GET /room/allrooms
  - Uppdatera rum: PUT /room/update/:id
  - Ta bort rum: DELETE /room/delete/:id

- **socketService.js**

  - init: Initierar Socket.io-servern.
  - emit: Skickar ett evenemang till alla anslutna klienter.

- **generateToken.js**

  Genererar en JWT-token med hjälp av biblioteket jsonwebtoken.

- **logger.js**

  Den här modulen sätter upp ett system för att spara händelser och fel för appen Coworking Platform. Den använder biblioteket Winston för att skapa strukturerade loggar och automatiskt rotera loggfiler varje dag. Loggarna inkluderar tidsstämplar, stackspårningar för fel och sparas i JSON-format för enkel analys.

  - **Huvudfunktioner**

  - Standardloggnivå: varna (sparar varningar och fel).
  - Loggformat:
    - Tidsstämpel i formatet ÅÅÅÅ-MM-DD HH:mm:ss.
    - Stackspårningar för fel.
    - Utdata i JSON-format.
  - Loggfilrotation:
    - Filer skapas dagligen med mönstret app-ÅÅÅÅ-MM-DD.log.
    - Filer komprimeras automatiskt (zippedArchive).
    - Maximal storlek per fil: 20 MB.
    - Maximal lagringstid: 14 dagar.

## Hur man kör Projektet

- Klona repo.
- Installera beroenden med npm install.
- Konfigurera miljövariabler i en .env-fil (DATABASE_URL, PORT, JWT_SECRET, REDIS_URL).
- Starta servern i utvecklingsläge med "npm run dev".

Det var allt! Nu har du en översikt över hur varje komponent fungerar i projektet.

# Guide för att köra Coworking-projektet:

🛠 Verktigen

- [_Thunder Client (Visual Studio Code)_](https://www.thunderclient.com/)
- [_Railway_](https://Railway.com)
- [_Supabase_](https://Supabase.com)
- [_Upstash_](https://Upstash.com)

## Beskrivning

Detta projekt låter användare registrera sig, logga in, skapa mötesrum och hantera bokningar. Backend är hostat på Railway.com, databasen PostgreSQL finns på Supabase.com, och cachehanteringen görs med Redis via Upstash.com.

# 1. Registrering och inloggning

OBS: I GET/POST/PUT/DELETE-förfrågningar för Room och Booking väljer du fliken Body.

- **Registrera en användare**

  _Endpoint:_

  `POST https://coworking-production.up.railway.app/user/register`

  _Body (JSON):_

  ```bash
  {
    "username": "User01",
    "password": "User01",
    "role": "Admin"
  }
  ```

- **Logga in**

  _Endpoint:_

  `POST https://coworking-production.up.railway.app/user/login`

  _Body (JSON):_

  ```bash
  {
    "username": "User01",
    "password": "User01"
  }
  ```

  _Svar (JSON):_

  `{
"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..  ."}`

  Spara token: Kopiera den returnerade token, eftersom den behövs för autentisering i nästa steg.

## 2. Använda token i Thunder Client

För GET/POST/PUT/DELETE-förfrågningar för Room och Booking:

- Gå till fliken Headers i Thunder Client.
- Välj Authorization.
- Klistra in den kopierade token i fältet till höger om Authorization.

_Exempel:_

`Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(token)`

## 3. Hantering av Rum (Rooms)

- **Skapa ett rum**

  _Endpoint:_

  `POST https://coworking-production.up.railway.app/room/create`

  _Body (JSON):_

  ```bash
  {
    "name": "Conference room 7",
    "capacity": 10,
    "type": "conference"
  }
  ```

- **Uppdatera ett rum**

  _Endpoint:_

  `PUT https://coworking-production.up.railway.app/room/update/9`

  _Body (JSON):_

  ```bash
  {
    "name": "Conference room 8",
    "type": "conference"
  }
  ```

- **Ta bort ett rum**

  _Endpoint:_

  `DELETE https://coworking-production.up.railway.app/room/delete/9`

- **Lista alla rum**

  _Endpoint:_

  `GET https://coworking-production.up.railway.app/room/allroom`

## 4. Hantering av Bokningar (Bookings)

- **Skapa en bokning**

  _Endpoint:_

  `POST https://coworking-production.up.railway.app/booking/create`

  _Body (JSON):_

  ```bash
  {
   "roomId": "1",
    "startTime": "2025-06-11T10:00:00Z",
    "endTime": "2025-06-11T12:00:00Z"
  }
  ```

- **Uppdatera en bokning**

  _Endpoint:_

  `PUT https://coworking-production.up.railway.app/booking/update/1`

  _Body (JSON):_

  ```bash
  {
    "roomId": "2",
    "startTime": "2025-02-12T10:00:00Z",
    "endTime": "2025-02-12T12:00:00Z"
  }
  ```

- **Ta bort en bokning**

  _Endpoint:_

  `DELETE https://coworking-production.up.railway.app/booking/delete/20`

- **Lista alla bokningar**

  _Endpoint:_

  `GET https://coworking-production.up.railway.app/booking/allbookning`

## 5. Extra information

- Railway.com: Används för att hosta backend.
- Supabase.com: Används för att lagra PostgreSQL-databasen.
- Upstash.com: Används för att hantera cacheminnet med Redis.

Med denna guide kan du enkelt testa och hantera Coworking-projektet i Thunder Client. 🚀
