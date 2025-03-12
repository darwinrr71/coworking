# Coworking Plattform

Det här projektet är en coworking-plattform som gör det möjligt för användare att boka rum, hantera sina bokningar och autentisera användare. Här följer en beskrivning av användningen av varje komponent i projektet.

## Projektstruktur

    - index.js: Huvudfil som konfigurerar och startar Express-servern, hanterar rutter och konfigurerar Socket.io.
    - docker-compose.yml: Konfigurationsfil för Docker Compose som definierar de nödvändiga tjänsterna, som Redis.
    - package.json: npm-konfigurationsfil som listar projektets beroenden och skript.
    - prisma/schema.prisma: Prisma-schemafil som definierar tabeller och relationer i databasen.
    - src/config/redis.js: Konfiguration för Redis-klienten.
    - src/controllers: Innehåller kontrollerna som hanterar logiken för rutterna.
        * authController.js: Hanterar registrering och inloggning av användare.
        * bookingController.js: Hanterar skapande, hämtning, uppdatering och borttagning av bokningar.
        * roomController.js: Hanterar skapande, hämtning, uppdatering och borttagning av rum.
    - src/middleware: Innehåller mellanprogram som används i rutterna.
        * authMiddleware.js: Middleware för autentisering och auktorisering av användare.
        * errorHandler.js: Middleware för att hantera fel.
    - src/routes: Innehåller appens rutter.
        * authRoutes.js: Rutter för registrering och inloggning av användare.
        * bookingRoutes.js: Rutter för hantering av bokningar.
        * roomRoutes.js: Rutter för hantering av rum.
    - src/services/socketService.js: Tjänst för att hantera realtidskommunikation med Socket.io.
    - src/utils/generateToken.js: Verktyg för att generera JWT-token.

## Användning av Komponenter

- **index.js**

  - _Konfigurerar och startar Express-servern._
  - Definierar autentisering, rum och bokningsrutter.
  - Initierar Socket.io-tjänsten.
  - Hanterar rotvägen och skickar periodiska händelser.

- **docker-compose.yml**

  Definierar Redis-tjänsten och mappar port 6379 från containern till port 6379 på den lokala maskinen.

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
    getUserBookings: Hämtar alla bokningar för en användare.
    updateBooking: Uppdaterar en befintlig bokning.
    deleteBooking: Tar bort en befintlig bokning.

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

  init: Initierar Socket.io-servern.
  emit: Skickar ett evenemang till alla anslutna klienter.

- **generateToken.js**

  Genererar en JWT-token med hjälp av biblioteket jsonwebtoken.

## Hur man Kör Projektet

    - Klona repo.
    - Installera beroenden med npm install.
    - Konfigurera miljövariabler i en .env-fil.
    - Starta servern i utvecklingsläge med npm run dev.
    - Använd Docker Compose för att starta Redis-tjänsten med docker-compose up.

Det var allt! Nu har du en översikt över hur varje komponent fungerar i projektet.
