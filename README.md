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
