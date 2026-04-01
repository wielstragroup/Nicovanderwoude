# Nico van der Woude – Blog

Een complete blogsite met admin-dashboard, gebouwd met HTML, CSS, JavaScript en Firebase. Klaar voor hosting op GitHub Pages.

---

## 🗂 Mappenstructuur

```
├── index.html          ← Homepagina (blogoverzicht + enkele blog + reacties)
├── dashboard.html      ← Admin-dashboard (alleen voor ingelogde beheerders)
├── css/
│   ├── style.css       ← Stijlen voor de bezoekerskant
│   └── dashboard.css   ← Stijlen voor het admin-dashboard
├── js/
│   ├── firebase-config.js  ← Firebase initialisatie (vervang met eigen config)
│   ├── app.js              ← Front-end logica voor bezoekers
│   └── dashboard.js        ← Admin-dashboard logica
└── .nojekyll           ← Voorkomt Jekyll-verwerking door GitHub Pages
```

---

## ⚡ Functionaliteiten

### Voor bezoekers
- Overzicht van alle gepubliceerde blogs (kaarten-grid)
- Zoeken en filteren op categorie
- Volledig blogbericht lezen met afbeelding, tags en auteur
- Weergaveteller per blog
- Reacties plaatsen (naam + tekst) – na goedkeuring zichtbaar
- Realtime updates via Firebase Firestore
- Responsive design (desktop + mobiel)

### Admin-dashboard (`dashboard.html`)
- Inloggen via Firebase Authentication (e-mail + wachtwoord)
- **Blogs**: aanmaken, bewerken, verwijderen, concepten opslaan, plannen
- **Rich-text editor** (Quill.js) met opmaak, lijsten, links en afbeeldingen
- **Afbeeldingen uploaden** via drag & drop of bestandskiezer naar Firebase Storage
- **Media manager**: overzicht en verwijderen van geüploade afbeeldingen
- **Prullenbak**: verwijderde blogs herstellen of definitief verwijderen
- **Reactiebeheer**: goedkeuren, spam markeren, verwijderen, als gelezen markeren
- **Gebruikersbeheer**: admin- en redacteursaccounts aanmaken en rollen beheren
- **Statistieken**: gepubliceerde blogs, totale reacties, weergaven, wachtende reacties
- **Preview** van een blog voor publicatie

---

## 🔧 Installatie & Setup

### 1. Firebase project aanmaken

1. Ga naar [Firebase Console](https://console.firebase.google.com/) en maak een nieuw project aan.
2. Voeg een **Web-app** toe aan het project.
3. Activeer de volgende Firebase-diensten:
   - **Authentication** → aanmeldingsmethode: E-mail/wachtwoord inschakelen
   - **Firestore Database** → maak een database aan (begin in testmodus of zie Beveiligingsregels hieronder)
   - **Storage** → maak een storage bucket aan

### 2. Firebase-configuratie invullen

Open `js/firebase-config.js` en vervang de placeholder-waarden met de gegevens van jouw Firebase-project (te vinden in de Firebase Console → Projectinstellingen → Jouw apps):

```js
const firebaseConfig = {
  apiKey:            "JOUW_API_KEY",
  authDomain:        "JOUW_PROJECT.firebaseapp.com",
  projectId:         "JOUW_PROJECT_ID",
  storageBucket:     "JOUW_PROJECT.appspot.com",
  messagingSenderId: "JOUW_SENDER_ID",
  appId:             "JOUW_APP_ID"
};
```

### 3. Eerste admin-account aanmaken

1. Ga in de Firebase Console naar **Authentication → Gebruikers → Gebruiker toevoegen**.
2. Voer een e-mailadres en wachtwoord in voor het admin-account.
3. Open `dashboard.html` in je browser en log in met dit account.
4. Bij de eerste inlog wordt automatisch een admin-document aangemaakt in Firestore.

---

## 🔒 Firestore Beveiligingsregels

Vervang de standaard testregels in **Firestore → Regels** met het volgende om de database te beveiligen:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Blogs: iedereen mag gepubliceerde blogs lezen; alleen ingelogde gebruikers mogen schrijven
    match /blogs/{blogId} {
      allow read: if resource.data.status == 'published' || request.auth != null;
      allow write: if request.auth != null;
    }

    // Reacties: iedereen mag goedgekeurde reacties lezen en nieuwe plaatsen; beheerder mag alles
    match /comments/{commentId} {
      allow read: if resource.data.approved == true || request.auth != null;
      allow create: if request.resource.data.keys().hasAll(['blogId', 'name', 'text'])
                    && request.resource.data.text.size() >= 3
                    && request.resource.data.text.size() <= 2000;
      allow update, delete: if request.auth != null;
    }

    // Gebruikers: alleen ingelogde gebruikers
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }

    // Media: alleen ingelogde gebruikers
    match /media/{mediaId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Firebase Storage Beveiligingsregels

Ga naar **Storage → Regels** en gebruik:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /images/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

---

## 🗄 Databasestructuur

### `blogs` (collectie)
| Veld | Type | Beschrijving |
|------|------|-------------|
| `title` | string | Blogtitel |
| `content` | string | HTML-inhoud (Quill) |
| `excerpt` | string | Korte samenvatting |
| `category` | string | Categorie |
| `tags` | array | Tags |
| `imageUrl` | string | URL van uitgelichte afbeelding |
| `status` | string | `published` / `draft` / `scheduled` / `trash` |
| `author` | string | Naam van de auteur |
| `authorId` | string | UID van de auteur |
| `views` | number | Weergaveteller |
| `createdAt` | timestamp | Aanmaakdatum |
| `publishedAt` | timestamp | Publicatiedatum |
| `scheduledAt` | timestamp | Geplande publicatiedatum |

### `comments` (collectie)
| Veld | Type | Beschrijving |
|------|------|-------------|
| `blogId` | string | ID van de bijbehorende blog |
| `name` | string | Naam van de reageerder |
| `text` | string | Reactietekst |
| `approved` | boolean | Goedgekeurd door beheerder |
| `spam` | boolean | Gemarkeerd als spam |
| `read` | boolean | Gelezen door beheerder |
| `createdAt` | timestamp | Datum van plaatsing |

### `users` (collectie)
| Veld | Type | Beschrijving |
|------|------|-------------|
| `uid` | string | Firebase Auth UID |
| `name` | string | Volledige naam |
| `email` | string | E-mailadres |
| `role` | string | `admin` of `editor` |
| `createdAt` | timestamp | Aanmaakdatum |

### `media` (collectie)
| Veld | Type | Beschrijving |
|------|------|-------------|
| `url` | string | Download-URL |
| `name` | string | Originele bestandsnaam |
| `size` | number | Bestandsgrootte in bytes |
| `type` | string | MIME-type |
| `uploadedBy` | string | UID van de uploader |
| `createdAt` | timestamp | Uploaddatum |

---

## 🚀 Deployen op GitHub Pages

1. Push de repository naar GitHub.
2. Ga naar **Settings → Pages**.
3. Selecteer bij **Source** de branch `main` (of `master`) en de map `/ (root)`.
4. Klik op **Save**. De site is beschikbaar op `https://<gebruikersnaam>.github.io/<repository>/`.

> **Let op:** `dashboard.html` bevat `<meta name="robots" content="noindex, nofollow">` zodat zoekmachines het dashboard niet indexeren.

---

## 🛠 Technologieën

- **HTML5 / CSS3 / JavaScript (ES2020+)** – geen build-stap vereist
- **Firebase SDK v8** (compat, via CDN) – Firestore, Authentication, Storage
- **Quill.js v1.3.7** (via CDN) – rich-text editor
- **GitHub Pages** – gratis hosting voor de front-end

---

## 📄 Licentie

© Nico van der Woude. Alle rechten voorbehouden.