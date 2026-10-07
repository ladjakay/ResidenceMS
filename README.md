<div align="center">

# 🏢 ResidenceMS — Système de Gestion de Résidences

👉 **[Switch to English Version 🇬🇧](README.en.md)**

---

</div>

## 📌 Sommaire
* [1. Présentation du Projet & Architecture](#1-présentation-du-projet--architecture)
* [2. Rôle de Chaque Élément de la Stack Technique](#2-rôle-de-chaque-élément-de-la-stack-technique)
* [3. Description Fonctionnelle & Logique Métier](#3-description-fonctionnelle--logique-métier)
* [4. Installation sur une Nouvelle Machine (Dev)](#4-installation-sur-une-nouvelle-machine-dev)
* [5. Guide de Déploiement en Production](#5-guide-de-déploiement-en-production)
* [6. Roadmap & Évolutions](#6-roadmap--évolutions)

---

### 📌 1. Présentation du Projet & Architecture

**ResidenceMS** est une solution logicielle d'entreprise conçue pour la gestion centralisée de complexes résidentiels, de meublés et de réservations hôtelières. L'application résout les problématiques de surréservation (double-booking), automatise les calculs de nuitées et de remises, gère la traçabilité des paiements (acomptes et soldes) et génère des reçus fiscaux/justificatifs officiels en PDF en temps réel.

---

### 🛠️ 2. Rôle de Chaque Élément de la Stack Technique

#### **Backend (`residence-api`)**
* **NestJS (Framework Node.js)** : 
  * Structure l'application selon une architecture modulaire solide (Modules, Controllers, Services, DTOs).
  * Assure l'injection de dépendances, le typage strict avec TypeScript et le traitement centralisé des exceptions (`HttpExceptionFilter`).
* **Prisma ORM (Data Layer)** :
  * Assure le rôle de couche d'accès aux données type-safe avec autocomplétion TypeScript.
  * Gère la modélisation du schéma BDD, la migration des données (`prisma migrate`) et le seeding initial des rôles/permissions.
* **PDFKit (Engine de Génération de Documents)** :
  * Génère dynamiquement en mémoire (Buffer binary stream) les reçus de paiement au format PDF sans sauvegarder de fichier temporaire sur le disque.
  * Permet un contrôle vectoriel précis de la mise en page, du formatage monétaire (alignements, espaces) et du calcul d'affichage des remarques juridiques.
* **JWT & Guards (Sécurité & RBAC)** :
  * `JwtAuthGuard` : Valide l'authenticité des jetons d'accès transmis via les en-têtes `Bearer Authorization`.
  * `PermissionsGuard` & Décorateur `@RequirePermissions()` : Intercepte les requêtes HTTP pour vérifier si l'utilisateur possède la permission explicite attribuée en BDD (ex: `booking:create`, `booking:edit`).

#### **Frontend (`residence-ui`)**
* **Next.js (App Router)** :
  * Framework React assurant le rendu fluide des vues applicatives côté client (CSR).
  * Gère le routage d'application dynamique (`/bookings`, `/bookings/new`, `/bookings/[id]/edit`).
* **Tailwind CSS** :
  * Framework CSS utilitaire permettant de construire des interfaces de gestion, des fenêtres modales interactives et des tableaux réactifs.
* **TypeScript** :
  * Évite les erreurs d'exécution en partageant les mêmes interfaces de types d'objets (`Booking`, `Residence`, `Tenant`) entre l'API NestJS et le Frontend.

#### **Base de Données**
* **PostgreSQL / MySQL** :
  * Stocke les données relationnelles avec contraintes d'intégrité (Clés étrangères, unicité, décimaux de haute précision pour la monnaie).

---

### 🔄 3. Description Fonctionnelle & Logique Métier

#### **A. Cycle de Vie d'une Réservation & Statuts**
1. **`PENDING` (En attente)** :
   * Créée initialement lors de la prise de commande.
   * **Calculs automatiques** : 
     $$\text{Nuitées} = \lceil \frac{\text{checkOut} - \text{checkIn}}{24 \text{h}} \rceil$$
     $$\text{Montant Brut} = \text{Nuitées} \times \text{Prix par nuit}$$
     $$\text{Montant Net} = \max(0, \text{Montant Brut} - \text{Remise})$$
   * **Reçu PDF** : Affiche un encadré d'avertissement indiquant que la réservation sera automatiquement annulée 48 heures avant le check-in en l'absence de paiement.
   * **Éditabilité** : Totalement modifiable (dates, résidence, client).

2. **`CONFIRMED` (Confirmée)** :
   * Déclenchée via le sélecteur de statut frontend qui ouvre une **boîte de dialogue modale**.
   * Nécessite la saisie d'un montant payé (`paidAmount`) :
     * **Acompte Partiel (`paidAmount < totalAmount`)** : Le reçu PDF indique l'acompte perçu, le solde restant dû à l'arrivée et conserve l'accès au bouton d'édition des dates.
     * **Paiement Intégral (`paidAmount >= totalAmount`)** : Le reçu PDF atteste du règlement complet. **Le système verrouille automatiquement toute modification subséquente (Bouton Éditer désactivé/verrouillé)**.

3. **`COMPLETED` (Terminée)** :
   * Marque la fin effective du séjour.
   * Le montant payé s'aligne automatiquement sur le montant total dû ($100\%$).
   * Le reçu fait office de **facture acquittée définitive**. Toute modification ultérieure est strictly interdite par le service backend.

4. **`CANCELLED` (Annulée)** :
   * Verrouille définitivement la réservation.
   * **Distinction sur le reçu PDF** :
     * *Annulée sans acompte (`paidAmount = 0`)* : Mentionne qu'aucun règlement n'a été perçu.
     * *Annulée avec acompte (`paidAmount > 0`)* : Précise l'annulation tout en actant le montant de l'acompte précédemment perçu.

#### **B. Algorithme Anti-Chevauchement de Dates (Anti-Overlapping)**
Avant toute création ou modification de dates, NestJS interroge Prisma avec la condition logique d'intersection d'intervalles :
$$\text{ExistingCheckIn} < \text{NewCheckOut} \quad \text{AND} \quad \text{ExistingCheckOut} > \text{NewCheckIn}$$
Sont exclues de cette vérification les réservations ayant le statut `CANCELLED` ou `REFUNDED`. En cas de conflit, une exception `409 ConflictException` est retournée.

---

### 🚀 4. Installation sur une Nouvelle Machine (Dev)

#### **Étape 1 : Cloner le Dépôt**
```bash
git clone <URL_DU_DEPOT_GIT>
cd ResidenceMS

Étape 2 : Configuration du Backend (residence-api)
cd residence-api

# 1. Installation des paquets
npm install

# 2. Fichier d'environnement
cp .env.example .env
# Mettre à jour DATABASE_URL et JWT_SECRET dans le fichier .env

# 3. Synchronisation Base de Données & Génération Client Prisma
npx prisma migrate dev
npx prisma generate

# 4. Injection des données de test (Optionnel)
npm run seed

# 5. Lancement
npm run start:dev

Étape 3 : Configuration du Frontend (residence-ui)
cd ../residence-ui

# 1. Installation des paquets
npm install

# 2. Fichier d'environnement local
cp .env.example .env.local
# Vérifier : NEXT_PUBLIC_API_URL="http://localhost:3000"

# 3. Lancement
npm run dev

📦 5. Guide de Déploiement en Production (VPS / Serveur Cloud)
A. Base de Données
Appliquer les migrations sans modifier le schéma de dev :
npx prisma migrate deploy
B. Déploiement API NestJS (PM2)
cd residence-api
npm ci --only=production
npm run build
pm2 start dist/main.js --name "residence-api"
pm2 save
C. Déploiement UI Next.js (PM2)
cd ../residence-ui
npm ci
npm run build
pm2 start npm --name "residence-ui" -- start
pm2 save
🔄 6. Roadmap & Évolutions
[x] Schéma BDD & Migrations Prisma

[x] Cycle de vie complet des réservations & Règles de verrouillage par statut

[x] Génération de reçus PDF personnalisés avec horodatage et format monétaire

[ ] Support multidevise (EUR, USD, XOF)

[ ] Containerisation Docker (docker-compose.yml)

[ ] Pipeline de déploiement automatisé CI/CD (GitHub Actions)
