
;; Game-loot
;; Manages in-game NFT assets with tradable items, rarity enforcement, and upgrade mechanisms

;; Implements SIP009 NFT standard

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-already-exists (err u102))
(define-constant err-insufficient-balance (err u103))
(define-constant err-invalid-rarity (err u104))
(define-constant err-unauthorized (err u105))

;; Rarity levels (0-5: Common, Uncommon, Rare, Epic, Legendary, Mythic)
(define-constant rarity-common u0)
(define-constant rarity-uncommon u1)
(define-constant rarity-rare u2)
(define-constant rarity-epic u3)
(define-constant rarity-legendary u4)
(define-constant rarity-mythic u5)

;; Data variables
(define-data-var last-token-id uint u0)
(define-data-var contract-uri (optional (string-utf8 256)) none)

;; NFT Definition
(define-non-fungible-token game-loot uint)

;; Data Maps
(define-map token-metadata
    { token-id: uint }
    {
        name: (string-ascii 64),
        description: (string-utf8 256),
        image: (string-utf8 256),
        rarity: uint,
        item-type: (string-ascii 32),
        power-level: uint,
        tradable: bool
    }
)

(define-map token-owners
    { token-id: uint }
    { owner: principal }
)

(define-map user-inventory
    { user: principal }
    { token-count: uint }
)

;; Private Functions
(define-private (get-next-token-id)
    (begin
        (var-set last-token-id (+ (var-get last-token-id) u1))
        (var-get last-token-id)
    )
)

(define-private (is-valid-rarity (rarity uint))
    (and (>= rarity rarity-common) (<= rarity rarity-mythic))
)

;; Read-only Functions
(define-read-only (get-last-token-id)
    (ok (var-get last-token-id))
)

(define-read-only (get-owner (token-id uint))
    (ok (nft-get-owner? game-loot token-id))
)

(define-read-only (get-token-metadata (token-id uint))
    (map-get? token-metadata { token-id: token-id })
)

(define-read-only (get-user-token-count (user principal))
    (default-to u0 (get token-count (map-get? user-inventory { user: user })))
)

;; Public Functions
(define-public (get-token-uri (token-id uint))
    (ok none)
)
