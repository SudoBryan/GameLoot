
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

;; SIP009 NFT Standard Functions
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
    (begin
        (asserts! (is-eq tx-sender sender) err-unauthorized)
        (asserts! (is-some (nft-get-owner? game-loot token-id)) err-not-found)
        (let ((token-meta (unwrap! (get-token-metadata token-id) err-not-found)))
            (asserts! (get tradable token-meta) (err u106)) ;; err-not-tradable
            (try! (nft-transfer? game-loot token-id sender recipient))
            (map-set token-owners { token-id: token-id } { owner: recipient })
            (update-inventory-on-transfer sender recipient)
            (ok true)
        )
    )
)

(define-public (mint-item (recipient principal) 
                         (name (string-ascii 64))
                         (description (string-utf8 256))
                         (image (string-utf8 256))
                         (rarity uint)
                         (item-type (string-ascii 32))
                         (power-level uint)
                         (tradable bool))
    (let ((token-id (get-next-token-id)))
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (asserts! (is-valid-rarity rarity) err-invalid-rarity)
        (try! (nft-mint? game-loot token-id recipient))
        (map-set token-metadata 
            { token-id: token-id }
            {
                name: name,
                description: description,
                image: image,
                rarity: rarity,
                item-type: item-type,
                power-level: power-level,
                tradable: tradable
            }
        )
        (map-set token-owners { token-id: token-id } { owner: recipient })
        (update-user-inventory recipient u1)
        (ok token-id)
    )
)

(define-public (batch-mint (recipients (list 10 { 
    recipient: principal,
    name: (string-ascii 64),
    description: (string-utf8 256),
    image: (string-utf8 256),
    rarity: uint,
    item-type: (string-ascii 32),
    power-level: uint,
    tradable: bool
})))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (ok (map mint-single-item recipients))
    )
)

(define-public (burn (token-id uint))
    (let ((owner (unwrap! (nft-get-owner? game-loot token-id) err-not-found)))
        (asserts! (is-eq tx-sender owner) err-unauthorized)
        (try! (nft-burn? game-loot token-id owner))
        (map-delete token-metadata { token-id: token-id })
        (map-delete token-owners { token-id: token-id })
        (update-user-inventory owner (- u0 u1))
        (ok true)
    )
)

;; Private helper functions
(define-private (mint-single-item (item-data { 
    recipient: principal,
    name: (string-ascii 64),
    description: (string-utf8 256),
    image: (string-utf8 256),
    rarity: uint,
    item-type: (string-ascii 32),
    power-level: uint,
    tradable: bool
}))
    (mint-item 
        (get recipient item-data)
        (get name item-data)
        (get description item-data)
        (get image item-data)
        (get rarity item-data)
        (get item-type item-data)
        (get power-level item-data)
        (get tradable item-data)
    )
)

(define-private (update-user-inventory (user principal) (delta uint))
    (let ((current-count (get-user-token-count user)))
        (map-set user-inventory 
            { user: user }
            { token-count: (+ current-count delta) }
        )
    )
)

(define-private (update-inventory-on-transfer (sender principal) (recipient principal))
    (begin
        (update-user-inventory sender (- u0 u1))
        (update-user-inventory recipient u1)
    )
)
