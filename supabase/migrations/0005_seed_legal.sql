-- ZAYA — Migration 0005 : documents juridiques et textes PROVISOIRES (version 0.1)
-- Ces textes ne sont pas validés juridiquement. Les passages entre [crochets]
-- sont à compléter par un juriste compétent en droit congolais avant le lancement.

insert into public.legal_documents (slug, title, required_for_roles, is_required, sort_order) values
  ('terms',            'Termes et Conditions',                 '{}',                             true,  10),
  ('privacy',          'Politique de confidentialité',         '{}',                             true,  20),
  ('returns',          'Politique de retours et remboursements','{}',                            false, 30),
  ('delivery',         'Politique de livraison',               '{}',                             false, 40),
  ('vendor_rules',     'Règles vendeurs',                      '{vendor,business}',              true,  50),
  ('creator_rules',    'Règles créateurs',                     '{creator}',                      true,  60),
  ('driver_rules',     'Règles livreurs',                      '{driver}',                       true,  70),
  ('prohibited',       'Politique produits et services interdits', '{vendor,business,creator}',  true,  80),
  ('antifraud',        'Politique antifraude',                 '{vendor,business,creator,driver}', true, 90),
  ('premium',          'Politique Premium',                    '{}',                             false, 100);

insert into public.legal_document_versions (document_id, version, content, status, published_at, effective_at)
select d.id, '0.1', t.content, 'published', now(), now()
from (values

('terms', $zaya$## Termes et Conditions d'utilisation

Texte provisoire, à faire valider par un juriste compétent en droit congolais avant tout lancement.

## 1. Qui sommes-nous

ZAYA est une plateforme en ligne qui met en relation des acheteurs, des vendeurs, des créateurs et des livreurs. L'exploitant de ZAYA est [raison sociale, forme juridique, adresse et numéro d'immatriculation à compléter].

## 2. Notre rôle

ZAYA est une plateforme intermédiaire. Elle fournit l'infrastructure : annonces, commandes, paiement, livraison et messagerie. ZAYA n'est pas le vendeur des produits et services publiés par les utilisateurs.

## 3. Responsabilités

Les vendeurs sont responsables de leurs annonces, de leurs produits et de leurs services. Les clients sont responsables de leurs commandes et des informations qu'ils fournissent. Les livreurs sont responsables de leurs obligations de livraison. ZAYA fournit l'infrastructure qui permet ces échanges.

## 4. Votre compte

Vous fournissez des informations exactes et vous protégez votre mot de passe. Vous êtes responsable de l'activité de votre compte.

## 5. Paiements, commissions et frais

ZAYA peut percevoir des commissions sur les ventes, des frais de livraison et d'autres frais. Ils sont indiqués avant la validation de la transaction. [Modalités à compléter.]

## 6. Retours, remboursements et litiges

Ces sujets sont encadrés par la Politique de retours et remboursements et par la Politique de livraison.

## 7. Sanctions

En cas de manquement aux règles de ZAYA, la plateforme peut adresser un avertissement, restreindre des fonctionnalités, retirer une annonce, suspendre ou fermer un compte. Lorsque c'est nécessaire, une vérification précède toute sanction.

## 8. Limitation de responsabilité

La responsabilité de ZAYA est limitée dans la mesure permise par le droit applicable. [Formulation à valider par un juriste.]

## 9. Modification des conditions

Lorsque ces conditions changent, une nouvelle version est publiée et les utilisateurs concernés sont informés. Une nouvelle acceptation peut être demandée.

## 10. Droit applicable

[Droit applicable et juridiction compétente à compléter.]$zaya$),

('privacy', $zaya$## Politique de confidentialité

Texte provisoire, à faire valider par un juriste compétent en droit congolais avant tout lancement.

## 1. Données collectées

ZAYA collecte uniquement les données nécessaires au service : informations de compte, adresses de livraison, commandes, paiements, évaluations et, pour les livreurs, les documents de vérification.

## 2. Utilisation

Ces données servent à faire fonctionner la plateforme : créer votre compte, traiter vos commandes, organiser la livraison, prévenir la fraude et respecter nos obligations légales.

## 3. Messagerie chiffrée

Les conversations entre clients, vendeurs et livreurs sont chiffrées de bout en bout. ZAYA et ses administrateurs ne peuvent pas lire leur contenu. Certaines informations techniques (par exemple la date d'un message) restent nécessaires au fonctionnement.

## 4. Localisation

La position d'un livreur n'est suivie que pendant une livraison active.

## 5. Documents sensibles

Les documents d'identité et de vérification ne sont jamais publics. Leur accès est limité aux personnes autorisées.

## 6. Conservation

Les données sont conservées pour la durée nécessaire à leur finalité. [Durées à définir.]

## 7. Vos droits

Vous pouvez demander l'accès, la correction ou la suppression de vos données, dans les limites prévues par la loi applicable. [Contact et procédure à compléter.]$zaya$),

('returns', $zaya$## Politique de retours et remboursements

Texte provisoire, à faire valider par un juriste compétent en droit congolais avant tout lancement.

## 1. Principe

Le vendeur est responsable de ses produits et services. ZAYA agit comme intermédiaire et transmet votre demande au vendeur.

## 2. Que pouvez-vous signaler

Un produit défectueux, un mauvais produit, un produit différent de l'annonce, ou un autre problème prévu par cette politique. Vous pouvez joindre des photos, des vidéos et une description. [Délai pour agir à définir.]

## 3. Produit défectueux ou non conforme

Lorsque le problème est imputable au vendeur, le retour ou l'échange est gratuit pour le client lorsque cela est prévu, et les frais applicables sont supportés par le vendeur.

## 4. Erreur du client

En cas de mauvais choix, de mauvaise taille ou de changement d'avis, lorsque le retour ou l'échange est autorisé, les frais de livraison et de retour sont à la charge du client. Les règles applicables sont affichées avant l'achat lorsque c'est possible.

## 5. Remboursements

Un remboursement peut être total ou partiel, selon les articles concernés. Pour un paiement en ligne, il est effectué par le moyen de paiement lorsque le prestataire le permet. Pour un paiement à la livraison, la méthode dépend des moyens disponibles.

## 6. Litiges

Si le client et le vendeur ne s'accordent pas, un litige peut être ouvert. ZAYA examine les preuves conservées : photos, vidéos, historique de la commande et de la livraison.$zaya$),

('delivery', $zaya$## Politique de livraison

Texte provisoire, à faire valider par un juriste compétent en droit congolais avant tout lancement.

## 1. Déroulement

Après votre commande, ZAYA recherche un livreur disponible. Le livreur récupère le colis chez le vendeur, puis vous le remet.

## 2. Suivi

Pendant une livraison active, vous voyez la position du livreur et l'heure d'arrivée estimée. Les délais estimés ne sont pas garantis. [À valider.]

## 3. Frais

Les frais de livraison sont affichés avant la validation de la commande. Ils dépendent notamment de la distance, de la zone et du type de véhicule.

## 4. Instructions

Vous pouvez laisser des instructions au livreur au moment de la commande. Elles ne sont visibles que par vous, le livreur assigné et les administrateurs autorisés lorsque c'est nécessaire.

## 5. Code de confirmation

Un code à usage unique vous est communiqué. Vous ne le donnez au livreur qu'à la réception de votre commande. Le livreur ne peut pas terminer la livraison sans ce code.

## 6. Paiement à la livraison

Si vous avez choisi de payer à la livraison, le montant à régler est indiqué au livreur et à vous avant la remise du colis.

## 7. Problème de livraison

Signalez tout problème depuis votre commande. Un incident peut être ouvert et examiné.$zaya$),

('vendor_rules', $zaya$## Règles vendeurs

Texte provisoire, à faire valider par un juriste compétent en droit congolais avant tout lancement.

## 1. Vos annonces

Vos annonces sont exactes : description, état (neuf ou occasion), prix, photos et disponibilité. Vous êtes responsable de leur contenu.

## 2. Vos produits et services

Vous êtes responsable de la conformité, de la qualité et de la livraison de ce que vous vendez, ainsi que du respect de la loi applicable.

## 3. Commandes et stock

Vous honorez les commandes acceptées. Vous tenez votre stock à jour afin d'éviter de vendre plus que ce dont vous disposez.

## 4. Retours et remboursements

Vous traitez les demandes de retour, d'échange et de remboursement selon la Politique de retours et remboursements. Une faute ou un abus peut entraîner une pénalité.

## 5. Commissions

ZAYA prélève une commission sur vos ventes. Son taux est communiqué avant la vente. [Modalités à compléter.]

## 6. Interdictions

Vous ne publiez aucun produit ni service interdit par la Politique produits et services interdits.$zaya$),

('creator_rules', $zaya$## Règles créateurs

Texte provisoire, à faire valider par un juriste compétent en droit congolais avant tout lancement.

## 1. Votre contenu

Vous présentez les produits de manière honnête. Vous n'affirmez rien de faux ou de trompeur à leur sujet.

## 2. Ventes attribuées

Lorsqu'une vente est attribuée à votre contenu, ZAYA enregistre le créateur, la vente et la commission correspondante.

## 3. Commission

Le taux de votre commission est communiqué avant la vente. [Modalités à compléter.]

## 4. Remboursements

Si une commande est remboursée, votre commission peut être ajustée. L'ajustement est enregistré et l'ancienne transaction n'est jamais supprimée.

## 5. Interdictions

Vous ne faites la promotion d'aucun produit ni service interdit par la Politique produits et services interdits.$zaya$),

('driver_rules', $zaya$## Règles livreurs

Texte provisoire, à faire valider par un juriste compétent en droit congolais avant tout lancement.

## 1. Vérification

Votre compte livreur est vérifié avant activation. Vous fournissez des documents et des informations exacts sur vous et sur votre véhicule. Ils sont protégés et ne sont jamais publics.

## 2. Localisation

Votre position est suivie uniquement pendant une livraison active, afin que le client et ZAYA puissent la suivre. [Consentement explicite à confirmer par un juriste.]

## 3. Livraison

Vous récupérez le colis chez le vendeur, le livrez avec soin et respectez les instructions du client lorsque c'est raisonnable.

## 4. Code de confirmation

Vous demandez le code au client à la remise. Vous ne déclarez jamais une livraison terminée sans ce code.

## 5. Paiement à la livraison

Pour une commande à encaisser, vous recevez le montant indiqué et le confirmez dans l'application. [Modalités de reversement à définir.]

## 6. Incidents

Vous signalez tout incident sans attendre. L'administration peut reconstituer l'événement à partir des informations enregistrées.

## 7. Sanctions

Un manquement peut entraîner un avertissement, une restriction, une suspension ou la fermeture de votre compte.$zaya$),

('prohibited', $zaya$## Politique produits et services interdits

Texte provisoire, à faire valider par un juriste compétent en droit congolais avant tout lancement.

## 1. Principe

Vous ne publiez aucun produit ni service dont la vente est interdite par la loi applicable au Congo.

## 2. Exemples d'annonces interdites

Les produits et services illégaux, volés, contrefaits ou dangereux, les annonces trompeuses ou frauduleuses, et plus généralement tout ce qui porte atteinte aux droits d'autrui. [Liste complète à établir par un juriste.]

## 3. Signalement

Tout utilisateur peut signaler une annonce.

## 4. Mesures

ZAYA peut retirer une annonce, suspendre son auteur et, lorsque c'est justifié, fermer son compte.$zaya$),

('antifraud', $zaya$## Politique antifraude

Texte provisoire, à faire valider par un juriste compétent en droit congolais avant tout lancement.

## 1. Objectif

Protéger à la fois les clients et les vendeurs. Cela couvre les fausses annonces, les produits différents de l'annonce, les faux retours, les abus de remboursement, les fausses déclarations et les abus du paiement à la livraison.

## 2. Preuves

ZAYA conserve les éléments nécessaires : photos, vidéos, historique de la commande, de la livraison et des événements.

## 3. Mesures

Selon la gravité : avertissement, restriction, pénalité, suspension ou fermeture de compte.

## 4. Vérification

Lorsque c'est nécessaire, aucune sanction n'est appliquée sans vérification préalable. [Procédure de contestation à définir.]$zaya$),

('premium', $zaya$## Politique Premium

Texte provisoire, à faire valider par un juriste compétent en droit congolais avant tout lancement.

## 1. Offres

ZAYA propose un niveau Gratuit et un niveau Premium.

## 2. Contenu de l'offre Premium

[Fonctionnalités, prix, durée et conditions de renouvellement à définir avant la mise en service de Premium.]

## 3. Gestion de l'abonnement

ZAYA conserve pour chaque abonnement son statut, sa date de début, sa date d'expiration, son paiement et son renouvellement.$zaya$)

) as t(slug, content)
join public.legal_documents d on d.slug = t.slug;