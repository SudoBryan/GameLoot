
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
        (decrease-user-inventory owner)
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

(define-private (decrease-user-inventory (user principal))
    (let ((current-count (get-user-token-count user)))
        (map-set user-inventory 
            { user: user }
            { token-count: (if (> current-count u0) (- current-count u1) u0) }
        )
    )
)

(define-private (update-inventory-on-transfer (sender principal) (recipient principal))
    (begin
        (decrease-user-inventory sender)
        (update-user-inventory recipient u1)
    )
)

;; Advanced Item Management Functions
(define-public (upgrade-item (token-id uint) (new-power-level uint))
    (let ((token-meta (unwrap! (get-token-metadata token-id) err-not-found))
          (owner (unwrap! (nft-get-owner? game-loot token-id) err-not-found)))
        (asserts! (is-eq tx-sender owner) err-unauthorized)
        (asserts! (> new-power-level (get power-level token-meta)) (err u107)) ;; err-invalid-upgrade
        (asserts! (<= new-power-level (get-max-power-for-rarity (get rarity token-meta))) (err u108)) ;; err-power-too-high
        (map-set token-metadata 
            { token-id: token-id }
            (merge token-meta { power-level: new-power-level })
        )
        (ok true)
    )
)

(define-public (set-item-tradability (token-id uint) (tradable bool))
    (let ((token-meta (unwrap! (get-token-metadata token-id) err-not-found))
          (owner (unwrap! (nft-get-owner? game-loot token-id) err-not-found)))
        (asserts! (is-eq tx-sender owner) err-unauthorized)
        (map-set token-metadata 
            { token-id: token-id }
            (merge token-meta { tradable: tradable })
        )
        (ok true)
    )
)

(define-public (combine-items (token-id-1 uint) (token-id-2 uint) (result-name (string-ascii 64)))
    (let ((meta-1 (unwrap! (get-token-metadata token-id-1) err-not-found))
          (meta-2 (unwrap! (get-token-metadata token-id-2) err-not-found))
          (owner-1 (unwrap! (nft-get-owner? game-loot token-id-1) err-not-found))
          (owner-2 (unwrap! (nft-get-owner? game-loot token-id-2) err-not-found)))
        (asserts! (is-eq tx-sender owner-1) err-unauthorized)
        (asserts! (is-eq owner-1 owner-2) (err u109)) ;; err-different-owners
        (asserts! (is-eq (get rarity meta-1) (get rarity meta-2)) (err u110)) ;; err-rarity-mismatch
        (let ((new-rarity (if (< (get rarity meta-1) rarity-mythic) (+ (get rarity meta-1) u1) (get rarity meta-1)))
              (new-power (+ (get power-level meta-1) (get power-level meta-2)))
              (new-token-id (get-next-token-id)))
            ;; Burn the two original items
            (try! (nft-burn? game-loot token-id-1 owner-1))
            (try! (nft-burn? game-loot token-id-2 owner-1))
            (map-delete token-metadata { token-id: token-id-1 })
            (map-delete token-metadata { token-id: token-id-2 })
            (map-delete token-owners { token-id: token-id-1 })
            (map-delete token-owners { token-id: token-id-2 })
            ;; Create the new combined item
            (try! (nft-mint? game-loot new-token-id owner-1))
            (map-set token-metadata 
                { token-id: new-token-id }
                {
                    name: result-name,
                    description: u"Combined item with enhanced properties",
                    image: (get image meta-1),
                    rarity: new-rarity,
                    item-type: (get item-type meta-1),
                    power-level: new-power,
                    tradable: true
                }
            )
            (map-set token-owners { token-id: new-token-id } { owner: owner-1 })
            (decrease-user-inventory owner-1) ;; Net decrease of 1 item (2 burned, 1 created)
            (ok new-token-id)
        )
    )
)

;; Read-only helper functions
(define-read-only (get-max-power-for-rarity (rarity uint))
    (if (is-eq rarity rarity-common) u100
        (if (is-eq rarity rarity-uncommon) u250
            (if (is-eq rarity rarity-rare) u500
                (if (is-eq rarity rarity-epic) u1000
                    (if (is-eq rarity rarity-legendary) u2000
                        u5000 ;; mythic
                    )
                )
            )
        )
    )
)

(define-read-only (get-items-by-rarity (rarity uint))
    ;; Simple implementation - returns empty list for now
    ;; In practice, this would require iterating through all tokens
    (list)
)

(define-read-only (get-user-items (user principal))
    ;; Simple implementation - returns empty list for now  
    ;; In practice, this would require iterating through all tokens
    (list)
)

;; Private helper functions for filtering
(define-private (get-all-token-ids)
    (list u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19 u20
          u21 u22 u23 u24 u25 u26 u27 u28 u29 u30 u31 u32 u33 u34 u35 u36 u37 u38 u39 u40
          u41 u42 u43 u44 u45 u46 u47 u48 u49 u50)
)

(define-private (is-rarity-match (token-id uint) (target-rarity uint))
    (match (get-token-metadata token-id)
        meta (is-eq (get rarity meta) target-rarity)
        false
    )
)

(define-private (is-owned-by-user (token-id uint) (target-user principal))
    (match (nft-get-owner? game-loot token-id)
        owner (is-eq owner target-user)
        false
    )
)

;; Marketplace and Trading Functions
(define-map item-listings
    { token-id: uint }
    {
        seller: principal,
        price: uint,
        active: bool
    }
)

(define-public (list-item-for-sale (token-id uint) (price uint))
    (let ((owner (unwrap! (nft-get-owner? game-loot token-id) err-not-found))
          (token-meta (unwrap! (get-token-metadata token-id) err-not-found)))
        (asserts! (is-eq tx-sender owner) err-unauthorized)
        (asserts! (get tradable token-meta) (err u111)) ;; err-not-tradable
        (asserts! (> price u0) (err u112)) ;; err-invalid-price
        (map-set item-listings
            { token-id: token-id }
            {
                seller: owner,
                price: price,
                active: true
            }
        )
        (ok true)
    )
)

(define-public (cancel-listing (token-id uint))
    (let ((listing (unwrap! (map-get? item-listings { token-id: token-id }) err-not-found)))
        (asserts! (is-eq tx-sender (get seller listing)) err-unauthorized)
        (asserts! (get active listing) (err u113)) ;; err-listing-inactive
        (map-set item-listings
            { token-id: token-id }
            (merge listing { active: false })
        )
        (ok true)
    )
)

(define-public (purchase-item (token-id uint))
    (let ((listing (unwrap! (map-get? item-listings { token-id: token-id }) err-not-found))
          (seller (get seller listing))
          (price (get price listing)))
        (asserts! (get active listing) (err u113)) ;; err-listing-inactive
        (asserts! (not (is-eq tx-sender seller)) (err u114)) ;; err-self-purchase
        ;; Transfer the NFT
        (try! (transfer token-id seller tx-sender))
        ;; Mark listing as inactive
        (map-set item-listings
            { token-id: token-id }
            (merge listing { active: false })
        )
        ;; In a real implementation, STX payment would happen here
        (ok true)
    )
)

;; Administrative Functions
(define-public (set-contract-owner (new-owner principal))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        ;; Update the constant by creating a new data var if needed
        (ok true)
    )
)

(define-public (set-contract-uri (new-uri (optional (string-utf8 256))))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (var-set contract-uri new-uri)
        (ok true)
    )
)

(define-public (emergency-pause (token-id uint))
    (let ((token-meta (unwrap! (get-token-metadata token-id) err-not-found)))
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (map-set token-metadata 
            { token-id: token-id }
            (merge token-meta { tradable: false })
        )
        ;; Cancel any active listing
        (match (map-get? item-listings { token-id: token-id })
            listing (map-set item-listings
                        { token-id: token-id }
                        (merge listing { active: false })
                    )
            true
        )
        (ok true)
    )
)

;; Enhanced Read-only Functions
(define-read-only (get-listing (token-id uint))
    (map-get? item-listings { token-id: token-id })
)

(define-read-only (get-contract-owner)
    contract-owner
)

(define-read-only (get-contract-uri)
    (var-get contract-uri)
)

(define-read-only (get-item-stats (token-id uint))
    (match (get-token-metadata token-id)
        meta (ok {
            rarity: (get rarity meta),
            power-level: (get power-level meta),
            max-power: (get-max-power-for-rarity (get rarity meta)),
            tradable: (get tradable meta),
            listed: (is-some (get-listing token-id))
        })
        err-not-found
    )
)

(define-read-only (is-item-upgradeable (token-id uint) (new-power uint))
    (match (get-token-metadata token-id)
        meta (and
            (> new-power (get power-level meta))
            (<= new-power (get-max-power-for-rarity (get rarity meta)))
        )
        false
    )
)

;; Enhanced utility functions
(define-read-only (get-rarity-name (rarity uint))
    (if (is-eq rarity rarity-common) "Common"
        (if (is-eq rarity rarity-uncommon) "Uncommon"
            (if (is-eq rarity rarity-rare) "Rare"
                (if (is-eq rarity rarity-epic) "Epic"
                    (if (is-eq rarity rarity-legendary) "Legendary"
                        (if (is-eq rarity rarity-mythic) "Mythic"
                            "Unknown"
                        )
                    )
                )
            )
        )
    )
)

(define-read-only (get-total-supply)
    (var-get last-token-id)
)
